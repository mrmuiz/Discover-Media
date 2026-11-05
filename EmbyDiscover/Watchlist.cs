using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    [Route("/Discover/Watchlist", "GET", Summary = "Rijen uit de Trakt-watchlist en/of een TMDB-lijst")]
    [Authenticated]
    public class DiscoverWatchlistRequest : IReturn<WatchlistResult> { }

    [Route("/Discover/TestWatchlist", "POST", Summary = "Test Trakt of TMDB-lijst")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverTestWatchlist : IReturn<DiscoverRequestResult>
    {
        /// <summary>"trakt" of "tmdb"</summary>
        public string Kind { get; set; }
        public string User { get; set; }
        public string ClientId { get; set; }
        public string ListId { get; set; }
    }

    public class WatchlistResult { public List<DiscoverRow> Rows { get; set; } = new List<DiscoverRow>(); }

    public class TraktIds { public int? tmdb { get; set; } }
    public class TraktMedia { public string title { get; set; } public int? year { get; set; } public TraktIds ids { get; set; } }
    public class TraktEntry { public string type { get; set; } public TraktMedia movie { get; set; } public TraktMedia show { get; set; } public string listed_at { get; set; } }

    /// <summary>
    /// Watchlist-rijen: Trakt (gebruikersnaam + Client ID van een eigen Trakt-app; de watchlist moet openbaar zijn)
    /// en/of een openbare TMDB-lijst. Beide optioneel en los van elkaar. 30 minuten bewaard.
    /// </summary>
    public class WatchlistService : IService
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);
        private const int MaxItems = 60;
        private static readonly object CacheGate = new object();
        private static KeyValuePair<string, KeyValuePair<DateTime, List<DiscoverRow>>> _cache;

        private readonly IJsonSerializer _json;
        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;

        public WatchlistService(IJsonSerializer json)
        {
            _json = json;
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
        }

        internal static string ListIdOf(string raw)
        {
            raw = (raw ?? "").Trim();
            if (raw.Length == 0) return "";
            var m = Regex.Match(raw, @"list/(\d+)");
            if (m.Success) return m.Groups[1].Value;
            m = Regex.Match(raw, @"^\d+$");
            return m.Success ? raw : "";
        }

        public async Task<object> Get(DiscoverWatchlistRequest request)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var res = new WatchlistResult();
            var listId = ListIdOf(cfg.TmdbListId);
            bool trakt = !string.IsNullOrWhiteSpace(cfg.TraktUser) && !string.IsNullOrWhiteSpace(cfg.TraktClientId);
            if (!trakt && listId.Length == 0) return res;
            if (string.IsNullOrWhiteSpace(cfg.TmdbApiKey)) return res;

            var key = (trakt ? cfg.TraktUser.Trim() + "|" + cfg.TraktClientId.Trim() : "") + "|" + listId + "|" + DiscoverLanguage.Text("nl", "en", "de");
            List<DiscoverRow> rows = null;
            lock (CacheGate)
            {
                if (_cache.Key == key && DateTime.UtcNow - _cache.Value.Key < Ttl) rows = _cache.Value.Value;
            }
            if (rows == null)
            {
                rows = new List<DiscoverRow>();
                if (trakt)
                {
                    try { var r = await TraktRow(cfg.TraktUser.Trim(), cfg.TraktClientId.Trim()).ConfigureAwait(false); if (r != null) rows.Add(r); }
                    catch (Exception ex) { DiscoverDiagnostics.Add("FOUT Trakt-watchlist: " + ex.Message); }
                }
                if (listId.Length > 0)
                {
                    try { var r = await TmdbRow(listId).ConfigureAwait(false); if (r != null) rows.Add(r); }
                    catch (Exception ex) { DiscoverDiagnostics.Add("FOUT TMDB-lijst " + listId + ": " + ex.Message); }
                }
                lock (CacheGate) { _cache = new KeyValuePair<string, KeyValuePair<DateTime, List<DiscoverRow>>>(key, new KeyValuePair<DateTime, List<DiscoverRow>>(DateTime.UtcNow, rows)); }
            }

            // Status (aangevraagd / beschikbaar) altijd vers.
            Dictionary<int, bool> ms = new Dictionary<int, bool>(), ts = new Dictionary<int, bool>();
            try
            {
                if (rows.Any(r => r.Items.Any(i => i.Type == "movie"))) ms = await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false);
                if (rows.Any(r => r.Items.Any(i => i.Type == "tv"))) ts = await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("FOUT status voor watchlist: " + ex.Message); }
            foreach (var row in rows)
            {
                var copy = new DiscoverRow { Key = row.Key, Title = row.Title };
                foreach (var i in row.Items)
                {
                    var states = i.Type == "tv" ? ts : ms;
                    bool hasFiles;
                    int st = states.TryGetValue(i.TmdbId, out hasFiles) ? (hasFiles ? 2 : 1) : 0;
                    copy.Items.Add(new DiscoverItemDto
                    {
                        TmdbId = i.TmdbId, Type = i.Type, Title = i.Title, Year = i.Year, Poster = i.Poster, Backdrop = i.Backdrop,
                        Rating = i.Rating, Lang = i.Lang, Overview = i.Overview, Status = st
                    });
                }
                res.Rows.Add(copy);
            }
            return res;
        }

        private static async Task<string> TraktGet(string user, string clientId, string path)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Get, "https://api.trakt.tv/users/" + Uri.EscapeDataString(user) + path))
            {
                req.Headers.Add("trakt-api-version", "2");
                req.Headers.Add("trakt-api-key", clientId);
                req.Headers.TryAddWithoutValidation("User-Agent", "Emby-Discover-Plugin");
                using (var resp = await Http.SendAsync(req).ConfigureAwait(false))
                {
                    int code = (int)resp.StatusCode;
                    if (code == 401 || code == 403) throw new InvalidOperationException("Trakt weigert de toegang (" + code + "). Klopt de Client ID, en is het profiel openbaar?");
                    if (code == 404) throw new InvalidOperationException("Trakt-gebruiker niet gevonden (404).");
                    resp.EnsureSuccessStatusCode();
                    return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                }
            }
        }

        private async Task<DiscoverRow> TraktRow(string user, string clientId)
        {
            var list = new List<TraktEntry>();
            foreach (var t in new[] { "movies", "shows" })
            {
                var part = _json.DeserializeFromString<List<TraktEntry>>(await TraktGet(user, clientId, "/watchlist/" + t + "/added?page=1&limit=" + MaxItems).ConfigureAwait(false));
                if (part != null) list.AddRange(part);
            }
            // Nieuwst toegevoegd eerst (ISO-datums sorteren als tekst).
            list = list.OrderByDescending(e => e.listed_at ?? "").ToList();
            var row = new DiscoverRow { Key = "watch_trakt", Title = DiscoverLanguage.Text("Trakt-watchlist", "Trakt watchlist", "Trakt-Merkliste") };
            var picks = list.Select(e => new { tv = e.type == "show", m = e.type == "show" ? e.show : e.movie })
                .Where(e => e.m != null && e.m.ids != null && e.m.ids.tmdb.HasValue && e.m.ids.tmdb.Value > 0)
                .Take(MaxItems).ToList();
            var dtos = new DiscoverItemDto[picks.Count];
            var gate = new SemaphoreSlim(4, 4);
            await Task.WhenAll(picks.Select(async (p, idx) =>
            {
                await gate.WaitAsync().ConfigureAwait(false);
                try
                {
                    var x = await _tmdb.GetExtraCached(p.tv, p.m.ids.tmdb.Value, CancellationToken.None).ConfigureAwait(false);
                    if (x == null) return;
                    dtos[idx] = DiscoverApiService.ToDto(new TmdbItem
                    {
                        id = p.m.ids.tmdb.Value, title = x.title ?? p.m.title, name = x.name ?? p.m.title,
                        release_date = x.release_date, first_air_date = x.first_air_date, poster_path = x.poster_path,
                        backdrop_path = x.backdrop_path, vote_average = x.vote_average, original_language = x.original_language,
                        overview = x.overview
                    }, p.tv, null);
                }
                finally { gate.Release(); }
            })).ConfigureAwait(false);
            row.Items = dtos.Where(d => d != null).ToList();
            return row;
        }

        private async Task<DiscoverRow> TmdbRow(string listId)
        {
            var page = await _tmdb.GetList(listId, CancellationToken.None).ConfigureAwait(false);
            if (page == null) return null;
            var row = new DiscoverRow { Key = "watch_tmdb", Title = string.IsNullOrWhiteSpace(page.name) ? DiscoverLanguage.Text("TMDB-lijst", "TMDB list", "TMDB-Liste") : page.name };
            foreach (var i in page.items)
            {
                if (i == null || i.adult) continue;
                bool tv = string.Equals(i.media_type, "tv", StringComparison.OrdinalIgnoreCase);
                if (!tv && !string.Equals(i.media_type ?? "movie", "movie", StringComparison.OrdinalIgnoreCase)) continue;
                row.Items.Add(DiscoverApiService.ToDto(i, tv, null));
                if (row.Items.Count >= MaxItems) break;
            }
            return row;
        }

        public async Task<object> Post(DiscoverTestWatchlist request)
        {
            var res = new DiscoverRequestResult();
            try
            {
                if (string.Equals(request.Kind, "trakt", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(request.User) || string.IsNullOrWhiteSpace(request.ClientId))
                        throw new InvalidOperationException(DiscoverLanguage.Text("Vul gebruikersnaam en Client ID in.", "Fill in username and Client ID.", "Benutzername und Client-ID eingeben."));
                    var list = _json.DeserializeFromString<List<TraktEntry>>(await TraktGet(request.User.Trim(), request.ClientId.Trim(), "/watchlist/movies?page=1&limit=100").ConfigureAwait(false)) ?? new List<TraktEntry>();
                    res.Success = true;
                    res.Message = DiscoverLanguage.Text("Verbonden: ", "Connected: ", "Verbunden: ") + list.Count + DiscoverLanguage.Text(" films op de watchlist (eerste pagina).", " movies on the watchlist (first page).", " Filme auf der Merkliste (erste Seite).");
                }
                else
                {
                    var id = ListIdOf(request.ListId);
                    if (id.Length == 0) throw new InvalidOperationException(DiscoverLanguage.Text("Geen geldig lijst-id of link.", "Not a valid list id or link.", "Keine gültige Listen-ID oder Link."));
                    var page = await _tmdb.GetList(id, CancellationToken.None).ConfigureAwait(false);
                    if (page == null) throw new InvalidOperationException(DiscoverLanguage.Text("Lijst niet gevonden of niet openbaar.", "List not found or not public.", "Liste nicht gefunden oder nicht öffentlich."));
                    res.Success = true;
                    res.Message = "\u201C" + (page.name ?? id) + "\u201D: " + (page.items == null ? 0 : page.items.Count) + DiscoverLanguage.Text(" titels.", " titles.", " Titel.");
                }
            }
            catch (Exception ex) { res.Success = false; res.Message = ex.Message; }
            return res;
        }
    }
}
