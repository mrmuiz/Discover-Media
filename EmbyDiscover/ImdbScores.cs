using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    // IMDb-score onder de posters uit de officiële gratis IMDb-dataset (title.ratings.tsv.gz, alleen niet-commercieel gebruik).
    // Geen API-sleutel of limiet: het bestand wordt lokaal bewaard (plugin-datamap) en wekelijks ververst.

    [Route("/Discover/ImdbScore", "GET", Summary = "IMDb score from the IMDb dataset")]
    [Authenticated]
    public class DiscoverImdbScoreRequest : IReturn<DiscoverImdbScoreResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
    }

    public class DiscoverImdbScoreResult
    {
        public string ImdbId { get; set; }
        /// <summary>Bijv. "8.1"; leeg als er geen data is (dan toont de client de TMDB-score).</summary>
        public string Imdb { get; set; }
        public int Votes { get; set; }
    }

    // Compact opgeslagen: gesorteerde id's + (score*10 &lt;&lt; 24 | stemmen), ca. 12 MB voor ~1,4 miljoen titels.
    public static class ImdbDataset
    {
        private const string Url = "https://datasets.imdbws.com/title.ratings.tsv.gz";
        private static readonly TimeSpan MaxAge = TimeSpan.FromDays(7);
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromMinutes(3) };
        private static readonly object Gate = new object();
        private static int[] _ids = new int[0];
        private static int[] _vals = new int[0];
        private static DateTime _loadedFrom = DateTime.MinValue;
        private static bool _busy;
        private static DateTime _lastFail = DateTime.MinValue;

        public static int Count { get { return _ids.Length; } }
        public static string Info { get; private set; }

        private static string FilePath()
        {
            var dir = Plugin.Instance != null ? Plugin.Instance.DataPath : null;
            return string.IsNullOrEmpty(dir) ? null : Path.Combine(dir, "discover-imdb-ratings.tsv.gz");
        }

        /// <summary>Start (op de achtergrond) het laden of verversen indien nodig; blokkeert nooit.</summary>
        public static void EnsureLoaded()
        {
            var path = FilePath();
            if (path == null) return;
            DateTime stamp = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;
            bool stale = DateTime.UtcNow - stamp > MaxAge;
            bool needLoad = _loadedFrom != stamp && stamp != DateTime.MinValue;
            if (!stale && !needLoad) return;
            lock (Gate)
            {
                if (_busy) return;
                if (stale && DateTime.UtcNow - _lastFail < TimeSpan.FromHours(1) && !needLoad) return;
                _busy = true;
            }
            Task.Run(async () =>
            {
                try
                {
                    if (stale)
                    {
                        try { await Download(path).ConfigureAwait(false); }
                        catch (Exception ex)
                        {
                            _lastFail = DateTime.UtcNow;
                            DiscoverDiagnostics.Add("downloading the IMDb dataset failed: " + ex.Message);
                        }
                    }
                    if (File.Exists(path)) Load(path);
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("loading the IMDb dataset failed: " + ex.Message); }
                finally { lock (Gate) { _busy = false; } }
            });
        }

        private static async Task Download(string path)
        {
            var tmp = path + ".tmp";
            using (var resp = await Http.GetAsync(Url, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false))
            {
                resp.EnsureSuccessStatusCode();
                using (var src = await resp.Content.ReadAsStreamAsync().ConfigureAwait(false))
                using (var dst = new FileStream(tmp, FileMode.Create, FileAccess.Write))
                    await src.CopyToAsync(dst).ConfigureAwait(false);
            }
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
            DiscoverDiagnostics.Add("IMDb-dataset ververst");
        }

        private static void Load(string path)
        {
            var stamp = File.GetLastWriteTimeUtc(path);
            var ids = new List<int>(1500000);
            var vals = new List<int>(1500000);
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read))
            using (var gz = new GZipStream(fs, CompressionMode.Decompress))
            using (var rd = new StreamReader(gz))
            {
                rd.ReadLine(); // kopregel
                string line;
                while ((line = rd.ReadLine()) != null)
                {
                    // tconst \t averageRating \t numVotes
                    if (line.Length < 9 || line[0] != 't' || line[1] != 't') continue;
                    var a = line.IndexOf('\t'); if (a < 0) continue;
                    var b = line.IndexOf('\t', a + 1); if (b < 0) continue;
                    int id, votes; double rating;
                    if (!int.TryParse(line.Substring(2, a - 2), NumberStyles.None, CultureInfo.InvariantCulture, out id)) continue;
                    if (!double.TryParse(line.Substring(a + 1, b - a - 1), NumberStyles.Float, CultureInfo.InvariantCulture, out rating)) continue;
                    if (!int.TryParse(line.Substring(b + 1), NumberStyles.None, CultureInfo.InvariantCulture, out votes)) votes = 0;
                    ids.Add(id);
                    vals.Add((((int)Math.Round(rating * 10)) << 24) | Math.Min(votes, 0xFFFFFF));
                }
            }
            var ia = ids.ToArray(); var va = vals.ToArray();
            Array.Sort(ia, va);
            _ids = ia; _vals = va; _loadedFrom = stamp;
            Info = ia.Length + " titels (" + stamp.ToLocalTime().ToString("yyyy-MM-dd") + ")";
            DiscoverDiagnostics.Add("IMDb-dataset geladen: " + Info);
        }

        public static bool TryGet(string imdbId, out string rating, out int votes)
        {
            rating = null; votes = 0;
            int id;
            if (string.IsNullOrEmpty(imdbId) || imdbId.Length < 3 || !int.TryParse(imdbId.Substring(2), NumberStyles.None, CultureInfo.InvariantCulture, out id)) return false;
            var ids = _ids; var vals = _vals;
            var ix = Array.BinarySearch(ids, id);
            if (ix < 0) return false;
            var v = vals[ix];
            rating = ((v >> 24) / 10.0).ToString("0.0", CultureInfo.InvariantCulture);
            votes = v & 0xFFFFFF;
            return true;
        }
    }

    public class ImdbScoreService : IService
    {
        private static readonly Dictionary<string, string> ImdbIds = new Dictionary<string, string>();
        private readonly TmdbClient _tmdb;

        public ImdbScoreService(IJsonSerializer json) { _tmdb = new TmdbClient(json); }

        public async Task<object> Get(DiscoverImdbScoreRequest request)
        {
            var res = new DiscoverImdbScoreResult();
            ImdbDataset.EnsureLoaded();
            if (request.TmdbId <= 0 || ImdbDataset.Count == 0) return res;
            bool tv = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase);
            var k = (tv ? "t" : "m") + request.TmdbId;
            string imdb;
            lock (ImdbIds) { ImdbIds.TryGetValue(k, out imdb); }
            try
            {
                if (imdb == null)
                {
                    if (tv)
                    {
                        var ext = await _tmdb.GetTvExternalIds(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                        imdb = ext == null ? null : ext.imdb_id;
                    }
                    else
                    {
                        var x = await _tmdb.GetExtraCached(false, request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                        imdb = x == null ? null : x.imdb_id;
                    }
                    lock (ImdbIds) { ImdbIds[k] = imdb ?? ""; }
                }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("IMDb-id " + request.Type + "/" + request.TmdbId + ": " + ex.Message); return res; }
            string rating; int votes;
            if (!string.IsNullOrEmpty(imdb) && ImdbDataset.TryGet(imdb, out rating, out votes))
            {
                res.ImdbId = imdb; res.Imdb = rating; res.Votes = votes;
            }
            return res;
        }
    }
}
