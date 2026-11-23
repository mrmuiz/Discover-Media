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

    [Route("/Discover/Ratings", "GET", Summary = "IMDb, Rotten Tomatoes and Metacritic score (via OMDb)")]
    [Authenticated]
    public class DiscoverRatingsRequest : IReturn<DiscoverRatingsResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
    }

    [Route("/Discover/TestOmdb", "POST", Summary = "Test an OMDb key")]
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

    [Route("/Discover/TestMdblist", "POST", Summary = "Test an MDBList key")]
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
        // Begrensd, en per titel één opvraging tegelijk (zie AsyncCache).
        private static readonly AsyncCache<DiscoverRatingsResult> Cache = new AsyncCache<DiscoverRatingsResult>(Ttl, 3000);
        private static readonly AsyncCache<string> ImdbIds = new AsyncCache<string>(TimeSpan.FromDays(7), 5000);

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

        private Task<string> ImdbIdFor(bool tv, int tmdbId)
        {
            var k = (tv ? "t" : "m") + tmdbId;
            return ImdbIds.Get(k, async () =>
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
                // Niets gevonden? Niet bewaren, dan wordt het later opnieuw geprobeerd.
                if (string.IsNullOrWhiteSpace(id)) { throw new InvalidOperationException("no imdb id"); }
                return id;
            });
        }

        private static readonly AsyncCache<DiscoverRatingsResult> MdbCache = new AsyncCache<DiscoverRatingsResult>(Ttl, 3000);

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
                try
                {
                    // Eén opvraging per titel, ook als twintig gebruikers tegelijk dezelfde popup openen.
                    var m = await MdbCache.Get(mk, async () =>
                    {
                        var dto = FromMdb(await FetchMdb(cfg.MdblistApiKey, tv, request.TmdbId).ConfigureAwait(false));
                        if (dto == null) { throw new InvalidOperationException("MDBList has no ratings"); }
                        return dto;
                    }).ConfigureAwait(false);
                    if (m != null) { return m; }
                }
                catch (Exception ex)
                {
                    if (!(ex is InvalidOperationException))
                        DiscoverDiagnostics.Add("log.omdb.fout_mdblist", request.Type, request.TmdbId, ex.Message);
                }
            }
            if (string.IsNullOrWhiteSpace(cfg.OmdbApiKey)) return res;
            try
            {
                string imdb = null;
                try { imdb = await ImdbIdFor(tv, request.TmdbId).ConfigureAwait(false); }
                catch (InvalidOperationException) { }   // deze titel heeft geen IMDb-id bij TMDB
                if (string.IsNullOrWhiteSpace(imdb)) return res;
                // Ook hier één opvraging per titel: de gratis OMDb-sleutel is duizend verzoeken per dag, en
                // zonder dit haalde elke gebruiker die dezelfde titel opende zijn eigen exemplaar op.
                return await Cache.Get(imdb, async () =>
                {
                    var one = new DiscoverRatingsResult { ImdbId = imdb };
                    var r = await Fetch(cfg.OmdbApiKey, imdb).ConfigureAwait(false);
                    if (string.Equals(r.Response, "True", StringComparison.OrdinalIgnoreCase))
                    {
                        one.Imdb = Clean(r.imdbRating);
                        one.ImdbVotes = Clean(r.imdbVotes);
                        one.Metacritic = Clean(r.Metascore);
                        var rt = (r.Ratings ?? new List<OmdbRating>()).FirstOrDefault(x => x != null && string.Equals(x.Source, "Rotten Tomatoes", StringComparison.OrdinalIgnoreCase));
                        one.RottenTomatoes = Clean(rt?.Value);
                    }
                    else
                    {
                        DiscoverDiagnostics.Add("log.omdb.omdb", imdb, (object)(r.Error) ?? DiscoverDiagnostics.W("word.geen_resultaat"));
                    }
                    return one;
                }).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("log.omdb.fout_omdb", request.Type, request.TmdbId, ex.Message);
            }
            return res;
        }

        public async Task<object> Post(DiscoverTestMdblist request)
        {
            var res = new DiscoverRequestResult();
            try
            {
                if (string.IsNullOrWhiteSpace(request.Key))
                    throw new InvalidOperationException(DiscoverLanguage.T("omdb.enter_an_mdblist_key_first"));
                // Vaste testtitel: The Shawshank Redemption (TMDB 278).
                var r = await FetchMdb(request.Key, false, 278).ConfigureAwait(false);
                var m = FromMdb(r);
                res.Success = m != null;
                res.Message = res.Success
                    ? DiscoverLanguage.T("omdb.mdblist_works") + (r.title ?? "The Shawshank Redemption") + " · IMDb " + (m.Imdb ?? "?")
                    : "MDBList: " + DiscoverLanguage.T("omdb.no_scores_received");
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
                    throw new InvalidOperationException(DiscoverLanguage.T("omdb.enter_an_omdb_key_first"));
                // Vaste testtitel: The Shawshank Redemption.
                var r = await Fetch(request.Key, "tt0111161").ConfigureAwait(false);
                res.Success = string.Equals(r.Response, "True", StringComparison.OrdinalIgnoreCase);
                res.Message = res.Success
                    ? DiscoverLanguage.T("omdb.omdb_works") + r.Title + " · IMDb " + (Clean(r.imdbRating) ?? "?")
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
