using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    // OMDb (omdbapi.com): scores van IMDb, Rotten Tomatoes en Metacritic voor de popup.
    // Alleen actief met een eigen OMDb-sleutel in de instellingen. Per IMDb-id 24 uur bewaard (gratis sleutel: 1000/dag).

    [Route("/Discover/Ratings", "GET", Summary = "IMDb-, Rotten Tomatoes- en Metacritic-score (via OMDb)")]
    [Authenticated]
    public class DiscoverRatingsRequest : IReturn<DiscoverRatingsResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
    }

    [Route("/Discover/TestOmdb", "POST", Summary = "Test een OMDb-sleutel")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverTestOmdb : IReturn<DiscoverRequestResult>
    {
        public string Key { get; set; }
    }

    public class DiscoverRatingsResult
    {
        public string ImdbId { get; set; }
        /// <summary>bv. "7.8"</summary>
        public string Imdb { get; set; }
        /// <summary>bv. "1,234,567"</summary>
        public string ImdbVotes { get; set; }
        /// <summary>bv. "93%"</summary>
        public string RottenTomatoes { get; set; }
        /// <summary>bv. "74"</summary>
        public string Metacritic { get; set; }
        /// <summary>Rotten Tomatoes publiek (popcorn), bv. "88%" (alleen MDBList).</summary>
        public string Audience { get; set; }
        /// <summary>Letterboxd, bv. "4.1" van 5 (alleen MDBList).</summary>
        public string Letterboxd { get; set; }
        /// <summary>Trakt, bv. "86%" (alleen MDBList).</summary>
        public string Trakt { get; set; }
    }

    [Route("/Discover/TestMdblist", "POST", Summary = "Test een MDBList-sleutel")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverTestMdblist : IReturn<DiscoverRequestResult>
    {
        public string Key { get; set; }
    }

    public class MdbRatingDto { public string source { get; set; } public double? value { get; set; } public int? score { get; set; } public long? votes { get; set; } }
    public class MdbItemDto { public string title { get; set; } public List<MdbRatingDto> ratings { get; set; } public string error { get; set; } }

    public class OmdbRating { public string Source { get; set; } public string Value { get; set; } }
    public class OmdbResponse
    {
        public string Response { get; set; }
        public string Error { get; set; }
        public string Title { get; set; }
        public string imdbRating { get; set; }
        public string imdbVotes { get; set; }
        public string Metascore { get; set; }
        public List<OmdbRating> Ratings { get; set; }
    }

    public class OmdbService : IService
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        private static readonly TimeSpan Ttl = TimeSpan.FromHours(24);
        private static readonly Dictionary<string, KeyValuePair<DateTime, DiscoverRatingsResult>> Cache =
            new Dictionary<string, KeyValuePair<DateTime, DiscoverRatingsResult>>();
        private static readonly Dictionary<string, string> ImdbIds = new Dictionary<string, string>();

        private readonly IJsonSerializer _json;
        private readonly TmdbClient _tmdb;

        public OmdbService(IJsonSerializer json)
        {
            _json = json;
            _tmdb = new TmdbClient(json);
        }

        private async Task<OmdbResponse> Fetch(string key, string imdbId)
        {
            var url = "https://www.omdbapi.com/?apikey=" + Uri.EscapeDataString(key.Trim()) + "&i=" + Uri.EscapeDataString(imdbId);
            using (var resp = await Http.GetAsync(url).ConfigureAwait(false))
            {
                var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                OmdbResponse r = null;
                try { r = _json.DeserializeFromString<OmdbResponse>(body); } catch { }
                if (r == null) throw new InvalidOperationException("OMDb: HTTP " + (int)resp.StatusCode);
                return r;
            }
        }

        private static string Clean(string v) => string.IsNullOrWhiteSpace(v) || v == "N/A" ? null : v.Trim();

        private async Task<string> ImdbIdFor(bool tv, int tmdbId)
        {
            var k = (tv ? "t" : "m") + tmdbId;
            lock (ImdbIds) { string c; if (ImdbIds.TryGetValue(k, out c)) return c; }
            string id = null;
            if (tv)
            {
                var ext = await _tmdb.GetTvExternalIds(tmdbId, CancellationToken.None).ConfigureAwait(false);
                id = ext?.imdb_id;
            }
            else
            {
                var x = await _tmdb.GetExtraCached(false, tmdbId, CancellationToken.None).ConfigureAwait(false);
                id = x?.imdb_id;
            }
            if (!string.IsNullOrWhiteSpace(id)) lock (ImdbIds) { ImdbIds[k] = id; }
            return id;
        }

        private static readonly Dictionary<string, KeyValuePair<DateTime, DiscoverRatingsResult>> MdbCache =
            new Dictionary<string, KeyValuePair<DateTime, DiscoverRatingsResult>>();

        private async Task<MdbItemDto> FetchMdb(string key, bool tv, int tmdbId)
        {
            var url = "https://api.mdblist.com/tmdb/" + (tv ? "show/" : "movie/") + tmdbId + "?apikey=" + Uri.EscapeDataString(key.Trim());
            using (var resp = await Http.GetAsync(url).ConfigureAwait(false))
            {
                var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                if ((int)resp.StatusCode == 404) return null;
                MdbItemDto r = null;
                try { r = _json.DeserializeFromString<MdbItemDto>(body); } catch { }
                if (!resp.IsSuccessStatusCode || r == null)
                    throw new InvalidOperationException("MDBList: HTTP " + (int)resp.StatusCode + (r != null && !string.IsNullOrWhiteSpace(r.error) ? " " + r.error : ""));
                return r;
            }
        }

        private static string Num1(double v) => v.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>MDBList-scores omgezet naar dezelfde velden als OMDb, plus publiek, Letterboxd en Trakt. Null = niets bruikbaars.</summary>
        private static DiscoverRatingsResult FromMdb(MdbItemDto r)
        {
            if (r == null || r.ratings == null) return null;
            var res = new DiscoverRatingsResult();
            foreach (var x in r.ratings)
            {
                if (x == null || !x.value.HasValue || x.value.Value <= 0) continue;
                var v = x.value.Value;
                switch ((x.source ?? "").ToLowerInvariant())
                {
                    case "imdb":
                        res.Imdb = Num1(v);
                        if (x.votes.HasValue && x.votes.Value > 0) res.ImdbVotes = x.votes.Value.ToString("N0", System.Globalization.CultureInfo.InvariantCulture);
                        break;
                    case "tomatoes": res.RottenTomatoes = Math.Round(v) + "%"; break;
                    case "tomatoesaudience":
                    case "popcorn": res.Audience = Math.Round(v) + "%"; break;
                    case "metacritic": res.Metacritic = Math.Round(v).ToString(); break;
                    case "letterboxd": res.Letterboxd = Num1(v > 5 ? v / 2 : v); break;
                    case "trakt": res.Trakt = Math.Round(v) + "%"; break;
                }
            }
            bool any = res.Imdb != null || res.RottenTomatoes != null || res.Audience != null || res.Metacritic != null || res.Letterboxd != null || res.Trakt != null;
            return any ? res : null;
        }

        public async Task<object> Get(DiscoverRatingsRequest request)
        {
            var res = new DiscoverRatingsResult();
            var cfg = Plugin.GetCurrentConfiguration();
            if (!cfg.ShowOmdbRatings || request.TmdbId <= 0) return res;
            bool tv = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase);

            // MDBList eerst (meer bronnen); lukt dat niet of heeft MDBList niets, dan OMDb zoals voorheen.
            if (!string.IsNullOrWhiteSpace(cfg.MdblistApiKey))
            {
                var mk = (tv ? "t" : "m") + request.TmdbId;
                lock (MdbCache)
                {
                    KeyValuePair<DateTime, DiscoverRatingsResult> hit;
                    if (MdbCache.TryGetValue(mk, out hit) && DateTime.UtcNow - hit.Key < Ttl && hit.Value != null) return hit.Value;
                }
                try
                {
                    var m = FromMdb(await FetchMdb(cfg.MdblistApiKey, tv, request.TmdbId).ConfigureAwait(false));
                    if (m != null)
                    {
                        lock (MdbCache) { MdbCache[mk] = new KeyValuePair<DateTime, DiscoverRatingsResult>(DateTime.UtcNow, m); }
                        return m;
                    }
                }
                catch (Exception ex)
                {
                    DiscoverDiagnostics.Add("FOUT MDBList " + request.Type + "/" + request.TmdbId + ": " + ex.Message);
                }
            }
            if (string.IsNullOrWhiteSpace(cfg.OmdbApiKey)) return res;
            try
            {
                var imdb = await ImdbIdFor(tv, request.TmdbId).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(imdb)) return res;
                lock (Cache)
                {
                    KeyValuePair<DateTime, DiscoverRatingsResult> hit;
                    if (Cache.TryGetValue(imdb, out hit) && DateTime.UtcNow - hit.Key < Ttl) return hit.Value;
                }
                var r = await Fetch(cfg.OmdbApiKey, imdb).ConfigureAwait(false);
                res.ImdbId = imdb;
                if (string.Equals(r.Response, "True", StringComparison.OrdinalIgnoreCase))
                {
                    res.Imdb = Clean(r.imdbRating);
                    res.ImdbVotes = Clean(r.imdbVotes);
                    res.Metacritic = Clean(r.Metascore);
                    var rt = (r.Ratings ?? new List<OmdbRating>()).FirstOrDefault(x => x != null && string.Equals(x.Source, "Rotten Tomatoes", StringComparison.OrdinalIgnoreCase));
                    res.RottenTomatoes = Clean(rt?.Value);
                }
                else
                {
                    DiscoverDiagnostics.Add("OMDb " + imdb + ": " + (r.Error ?? "geen resultaat"));
                }
                lock (Cache) { Cache[imdb] = new KeyValuePair<DateTime, DiscoverRatingsResult>(DateTime.UtcNow, res); }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT OMDb " + request.Type + "/" + request.TmdbId + ": " + ex.Message);
            }
            return res;
        }

        public async Task<object> Post(DiscoverTestMdblist request)
        {
            var res = new DiscoverRequestResult();
            try
            {
                if (string.IsNullOrWhiteSpace(request.Key))
                    throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een MDBList-sleutel in.", "Enter an MDBList key first.", "Zuerst einen MDBList-Schlüssel eingeben."));
                // Vaste testtitel: The Shawshank Redemption (TMDB 278).
                var r = await FetchMdb(request.Key, false, 278).ConfigureAwait(false);
                var m = FromMdb(r);
                res.Success = m != null;
                res.Message = res.Success
                    ? DiscoverLanguage.Text("MDBList werkt: ", "MDBList works: ", "MDBList funktioniert: ") + (r.title ?? "The Shawshank Redemption") + " · IMDb " + (m.Imdb ?? "?")
                    : "MDBList: " + DiscoverLanguage.Text("geen scores ontvangen", "no scores received", "keine Bewertungen erhalten");
            }
            catch (Exception ex)
            {
                res.Success = false;
                res.Message = ex.Message;
            }
            return res;
        }

        public async Task<object> Post(DiscoverTestOmdb request)
        {
            var res = new DiscoverRequestResult();
            try
            {
                if (string.IsNullOrWhiteSpace(request.Key))
                    throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een OMDb-sleutel in.", "Enter an OMDb key first.", "Zuerst einen OMDb-Schlüssel eingeben."));
                // Vaste testtitel: The Shawshank Redemption.
                var r = await Fetch(request.Key, "tt0111161").ConfigureAwait(false);
                res.Success = string.Equals(r.Response, "True", StringComparison.OrdinalIgnoreCase);
                res.Message = res.Success
                    ? DiscoverLanguage.Text("OMDb werkt: ", "OMDb works: ", "OMDb funktioniert: ") + r.Title + " · IMDb " + (Clean(r.imdbRating) ?? "?")
                    : "OMDb: " + (r.Error ?? "?");
            }
            catch (Exception ex)
            {
                res.Success = false;
                res.Message = ex.Message;
            }
            return res;
        }
    }
}
