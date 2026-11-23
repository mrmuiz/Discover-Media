using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
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

    [Route("/Discover/ImdbScores", "GET", Summary = "IMDb scores for several titles at once")]
    [Authenticated]
    public class DiscoverImdbScoresRequest : IReturn<DiscoverImdbScoresResult>
    {
        /// <summary>Komma-gescheiden, bv. "m:550,t:1399" (m = film, t = serie).</summary>
        public string Items { get; set; }
    }

    public class DiscoverImdbScoreEntry
    {
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string ImdbId { get; set; }
        public string Imdb { get; set; }
        public int Votes { get; set; }
    }

    public class DiscoverImdbScoresResult
    {
        public List<DiscoverImdbScoreEntry> Items { get; set; } = new List<DiscoverImdbScoreEntry>();
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
                            DiscoverDiagnostics.Add("log.imdb.imdb_dataset_downloaden_mislukt", ex.Message);
                        }
                    }
                    if (File.Exists(path)) Load(path);
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("log.imdb.imdb_dataset_laden_mislukt", ex.Message); }
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
            DiscoverDiagnostics.Add("log.imdb.imdb_dataset_ververst");
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
            DiscoverDiagnostics.Add("log.imdb.imdb_dataset_geladen", Info);
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
        // Eén opvraging per titel, ook als tientallen posters tegelijk om een score vragen, en begrensd
        // zodat verlopen regels niet tot een herstart blijven staan.
        private static readonly AsyncCache<string> ImdbIds = new AsyncCache<string>(TimeSpan.FromDays(7), 20000);
        private readonly TmdbClient _tmdb;

        public ImdbScoreService(IJsonSerializer json) { _tmdb = new TmdbClient(json); }

        private Task<string> IdFor(bool tv, int tmdbId)
        {
            return ImdbIds.Get((tv ? "t" : "m") + tmdbId, async () =>
            {
                string id;
                if (tv)
                {
                    var ext = await _tmdb.GetTvExternalIds(tmdbId, CancellationToken.None).ConfigureAwait(false);
                    id = ext == null ? null : ext.imdb_id;
                }
                else
                {
                    var x = await _tmdb.GetExtraCached(false, tmdbId, CancellationToken.None).ConfigureAwait(false);
                    id = x == null ? null : x.imdb_id;
                }
                // Leeg antwoord mag bewaard worden (de titel heeft gewoon geen IMDb-id); een fout niet.
                return id ?? "";
            });
        }

        private async Task<DiscoverImdbScoreResult> ScoreFor(bool tv, int tmdbId)
        {
            var res = new DiscoverImdbScoreResult();
            if (tmdbId <= 0) { return res; }
            string imdb;
            try { imdb = await IdFor(tv, tmdbId).ConfigureAwait(false); }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("log.imdb.imdb_id", (tv ? "tv" : "movie"), tmdbId, ex.Message);
                return res;
            }
            string rating; int votes;
            if (!string.IsNullOrEmpty(imdb) && ImdbDataset.TryGet(imdb, out rating, out votes))
            {
                res.ImdbId = imdb; res.Imdb = rating; res.Votes = votes;
            }
            return res;
        }

        public async Task<object> Get(DiscoverImdbScoreRequest request)
        {
            ImdbDataset.EnsureLoaded();
            if (ImdbDataset.Count == 0) { return new DiscoverImdbScoreResult(); }
            return await ScoreFor(string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase), request.TmdbId).ConfigureAwait(false);
        }

        /// <summary>
        /// Veel titels in één keer. De pagina vroeg de score per poster op: zestig posters waren zestig
        /// verzoeken per gebruiker, en elk daarvan moest bij TMDB het IMDb-id opzoeken.
        /// </summary>
        public async Task<object> Get(DiscoverImdbScoresRequest request)
        {
            var res = new DiscoverImdbScoresResult();
            ImdbDataset.EnsureLoaded();
            if (ImdbDataset.Count == 0 || string.IsNullOrWhiteSpace(request.Items)) { return res; }

            var wanted = new List<KeyValuePair<bool, int>>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var part in request.Items.Split(','))
            {
                var one = (part ?? "").Trim();
                if (one.Length < 3 || (one[0] != 'm' && one[0] != 't') || one[1] != ':') { continue; }
                int id;
                if (!int.TryParse(one.Substring(2), NumberStyles.Integer, CultureInfo.InvariantCulture, out id) || id <= 0) { continue; }
                if (!seen.Add(one)) { continue; }
                wanted.Add(new KeyValuePair<bool, int>(one[0] == 't', id));
                if (wanted.Count >= 60) { break; }
            }

            var scores = await Task.WhenAll(wanted.Select(x => ScoreFor(x.Key, x.Value))).ConfigureAwait(false);
            for (var i = 0; i < wanted.Count; i++)
            {
                var s = scores[i];
                res.Items.Add(new DiscoverImdbScoreEntry
                {
                    Type = wanted[i].Key ? "tv" : "movie",
                    TmdbId = wanted[i].Value,
                    ImdbId = s.ImdbId,
                    Imdb = s.Imdb,
                    Votes = s.Votes
                });
            }
            return res;
        }
    }
}
