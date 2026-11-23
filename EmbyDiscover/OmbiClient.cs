using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    // ---------- Ombi-API (Ombi-app/Ombi v4) ----------
    // Ombi geeft camelCase terug, dus de velden hieronder heten precies zoals in de JSON.

    public class OmbiEpisodeDto
    {
        public int episodeNumber { get; set; }
        public bool available { get; set; }
        public bool approved { get; set; }
        public bool requested { get; set; }
    }

    public class OmbiSeasonDto
    {
        public int seasonNumber { get; set; }
        public List<OmbiEpisodeDto> episodes { get; set; }
    }

    /// <summary>Eén aanvraag binnen een serie: de seizoenen die iemand heeft aangevraagd.</summary>
    public class OmbiChildDto
    {
        public int id { get; set; }
        public bool approved { get; set; }
        public bool available { get; set; }
        public bool? denied { get; set; }
        public string requestedDate { get; set; }
        public List<OmbiSeasonDto> seasonRequests { get; set; }
    }

    /// <summary>Serie in Ombi. externalProviderId is het TMDB-id (TvDbId wordt niet meer gebruikt).</summary>
    public class OmbiTvDto
    {
        public int id { get; set; }
        public int externalProviderId { get; set; }
        public string title { get; set; }
        public int totalSeasons { get; set; }
        public List<OmbiChildDto> childRequests { get; set; }
    }

    public class OmbiMovieDto
    {
        public int id { get; set; }
        public int theMovieDbId { get; set; }
        public string title { get; set; }
        public bool approved { get; set; }
        public bool available { get; set; }
        public bool? denied { get; set; }
        public string requestedDate { get; set; }
        public bool available4K { get; set; }
        public bool has4KRequest { get; set; }
    }

    /// <summary>Antwoord van Ombi op een aanvraag.</summary>
    public class OmbiResultDto
    {
        public bool result { get; set; }
        public string message { get; set; }
        public string errorMessage { get; set; }
        public string errorCode { get; set; }
        public int requestId { get; set; }
    }

    public class OmbiEnabledDto { public bool enabled { get; set; } }
    public class OmbiRadarrSettingsDto { public OmbiEnabledDto radarr { get; set; } public OmbiEnabledDto radarr4K { get; set; } }
    public class OmbiCountDto { public int pending { get; set; } public int approved { get; set; } public int available { get; set; } public int denied { get; set; } }

    /// <summary>
    /// Aanvragen via Ombi in plaats van rechtstreeks naar Radarr/Sonarr. Ombi beheert zelf zijn Radarr- en
    /// Sonarr-servers; de plugin praat alleen met de Ombi-API (ApiKey-header, optioneel ApiAlias).
    ///
    /// Verschil met Seerr: met een API-sleutel komt elke aanvraag binnen op naam van de eigenaar van die sleutel.
    /// Ombi kan niet namens een andere gebruiker aanvragen; alleen de naam van de aanvrager gaat mee als label
    /// (ApiAlias). Daarom blijft de aanvraaglimiet van Discover zelf in deze modus wel gelden.
    /// </summary>
    internal static class OmbiClient
    {
        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler(true)) { Timeout = TimeSpan.FromSeconds(30) };
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
        private static readonly SemaphoreSlim _movieLock = new SemaphoreSlim(1, 1);
        private static readonly SemaphoreSlim _tvLock = new SemaphoreSlim(1, 1);

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _pending =
            new System.Collections.Concurrent.ConcurrentDictionary<string, bool>();

        private static List<OmbiMovieDto> _movies;
        private static DateTime _moviesAt;
        private static List<OmbiTvDto> _tv;
        private static DateTime _tvAt;

        internal static bool Enabled
        {
            get
            {
                var c = Plugin.GetCurrentConfiguration();
                return string.Equals(c.RequestService, "ombi", StringComparison.OrdinalIgnoreCase);
            }
        }

        internal static bool Configured
        {
            get
            {
                var c = Plugin.GetCurrentConfiguration();
                return Enabled && !string.IsNullOrWhiteSpace(c.OmbiUrl) && !string.IsNullOrWhiteSpace(c.OmbiApiKey);
            }
        }

        internal static void Invalidate() { _movies = null; _tv = null; }

        /// <summary>De laatste aanvraag voor deze titel wacht in Ombi op goedkeuring door een beheerder.</summary>
        internal static bool WaitsForApproval(bool tv, int tmdbId)
        {
            bool v;
            return Enabled && _pending.TryGetValue((tv ? "t:" : "m:") + tmdbId, out v) && v;
        }

        // ---------- HTTP ----------

        internal static string NormalizeBase(string baseUrl)
        {
            var u = (baseUrl ?? "").Trim().TrimEnd('/');
            if (!u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !u.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                u = "http://" + u;
            // Wie de URL met /api erachter invult, krijgt die er niet dubbel achter.
            foreach (var tail in new[] { "/api/v2", "/api/v1", "/api" })
            {
                if (u.EndsWith(tail, StringComparison.OrdinalIgnoreCase)) { u = u.Substring(0, u.Length - tail.Length); break; }
            }
            return u;
        }

        internal struct Reply { public int Code; public string Text; }

        internal static async Task<Reply> Send(HttpMethod method, string baseUrl, string apiKey, string path, string body, string alias, CancellationToken ct)
        {
            var req = new HttpRequestMessage(method, NormalizeBase(baseUrl) + path);
            req.Headers.Add("ApiKey", (apiKey ?? "").Trim());
            // Ombi zet dit als "aangevraagd door" bij de aanvraag; het blijft wel de API-gebruiker die aanvraagt.
            if (!string.IsNullOrWhiteSpace(alias)) req.Headers.Add("ApiAlias", alias.Trim());
            if (body != null) req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
            {
                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                return new Reply { Code = (int)resp.StatusCode, Text = text };
            }
        }

        private static Task<Reply> Call(HttpMethod method, string path, string body, CancellationToken ct, string alias = null)
        {
            var c = Plugin.GetCurrentConfiguration();
            return Send(method, c.OmbiUrl, c.OmbiApiKey, path, body, alias, ct);
        }

        /// <summary>Foutmelding van Ombi of de ruwe tekst.</summary>
        internal static string MessageOf(IJsonSerializer json, Reply r)
        {
            try
            {
                var m = json.DeserializeFromString<OmbiResultDto>(r.Text);
                if (m != null)
                {
                    if (!string.IsNullOrWhiteSpace(m.errorMessage)) return m.errorMessage;
                    if (!string.IsNullOrWhiteSpace(m.message)) return m.message;
                }
            }
            catch { }
            var t = (r.Text ?? "").Trim();
            if (t.Length > 200) t = t.Substring(0, 200);
            return r.Code + (t.Length > 0 ? ": " + t : "");
        }

        private static async Task<string> GetOk(IJsonSerializer json, string path, CancellationToken ct)
        {
            var r = await Call(HttpMethod.Get, path, null, ct).ConfigureAwait(false);
            if (r.Code < 200 || r.Code > 299) throw new HttpRequestException("Ombi " + path + ": " + MessageOf(json, r));
            return r.Text;
        }

        // ---------- Aanvragen ophalen ----------

        internal static async Task<List<OmbiMovieDto>> GetMovies(IJsonSerializer json, CancellationToken ct)
        {
            var cached = _movies;
            if (cached != null && DateTime.UtcNow - _moviesAt < CacheTtl) return cached;
            await _movieLock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                cached = _movies;
                if (cached != null && DateTime.UtcNow - _moviesAt < CacheTtl) return cached;
                var text = await GetOk(json, "/api/v1/Request/movie", ct).ConfigureAwait(false);
                var list = (json.DeserializeFromString<List<OmbiMovieDto>>(text) ?? new List<OmbiMovieDto>())
                    .Where(m => m != null && m.theMovieDbId > 0).ToList();
                _movies = list;
                _moviesAt = DateTime.UtcNow;
                return list;
            }
            finally { _movieLock.Release(); }
        }

        internal static async Task<List<OmbiTvDto>> GetTv(IJsonSerializer json, CancellationToken ct)
        {
            var cached = _tv;
            if (cached != null && DateTime.UtcNow - _tvAt < CacheTtl) return cached;
            await _tvLock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                cached = _tv;
                if (cached != null && DateTime.UtcNow - _tvAt < CacheTtl) return cached;
                var text = await GetOk(json, "/api/v1/Request/tv", ct).ConfigureAwait(false);
                var list = (json.DeserializeFromString<List<OmbiTvDto>>(text) ?? new List<OmbiTvDto>())
                    .Where(t => t != null && t.externalProviderId > 0).ToList();
                _tv = list;
                _tvAt = DateTime.UtcNow;
                return list;
            }
            finally { _tvLock.Release(); }
        }

        private static IEnumerable<OmbiChildDto> Children(OmbiTvDto t)
        {
            return t.childRequests ?? Enumerable.Empty<OmbiChildDto>();
        }

        private static bool AnyAvailable(OmbiTvDto t)
        {
            foreach (var c in Children(t))
            {
                if (c == null) continue;
                if (c.available) return true;
                foreach (var s in c.seasonRequests ?? Enumerable.Empty<OmbiSeasonDto>())
                    if (s != null && (s.episodes ?? Enumerable.Empty<OmbiEpisodeDto>()).Any(e => e != null && e.available)) return true;
            }
            return false;
        }

        private static bool AllAvailable(OmbiTvDto t)
        {
            var kids = Children(t).Where(c => c != null).ToList();
            if (kids.Count == 0) return false;
            foreach (var c in kids)
            {
                if (c.available) continue;
                var eps = (c.seasonRequests ?? Enumerable.Empty<OmbiSeasonDto>())
                    .SelectMany(s => (s == null ? null : s.episodes) ?? Enumerable.Empty<OmbiEpisodeDto>())
                    .Where(e => e != null).ToList();
                if (eps.Count == 0 || !eps.All(e => e.available)) return false;
            }
            return true;
        }

        /// <summary>tmdbId -> true als (een deel) beschikbaar is, false als alleen aangevraagd.</summary>
        internal static async Task<Dictionary<int, bool>> GetStates(IJsonSerializer json, bool tv, CancellationToken ct)
        {
            var dict = new Dictionary<int, bool>();
            if (tv)
            {
                foreach (var t in await GetTv(json, ct).ConfigureAwait(false))
                    dict[t.externalProviderId] = AnyAvailable(t);
            }
            else
            {
                foreach (var m in await GetMovies(json, ct).ConfigureAwait(false))
                    dict[m.theMovieDbId] = m.available || m.available4K;
            }
            return dict;
        }

        /// <summary>Series waarvan een deel binnen is, maar nog niet alles.</summary>
        internal static async Task<HashSet<int>> GetPartial(IJsonSerializer json, CancellationToken ct)
        {
            var set = new HashSet<int>();
            foreach (var t in await GetTv(json, ct).ConfigureAwait(false))
                if (AnyAvailable(t) && !AllAvailable(t)) set.Add(t.externalProviderId);
            return set;
        }

        /// <summary>Seizoensstatus omgezet naar de Sonarr-vorm die de rest van de plugin al kent.</summary>
        internal static async Task<Dictionary<int, SonarrSeasonDto>> GetSeasonStates(IJsonSerializer json, int tmdbId, CancellationToken ct)
        {
            var result = new Dictionary<int, SonarrSeasonDto>();
            var t = (await GetTv(json, ct).ConfigureAwait(false)).FirstOrDefault(x => x.externalProviderId == tmdbId);
            if (t == null) return result;
            foreach (var c in Children(t))
            {
                if (c == null) continue;
                foreach (var s in c.seasonRequests ?? Enumerable.Empty<OmbiSeasonDto>())
                {
                    if (s == null || s.seasonNumber <= 0) continue;
                    var eps = (s.episodes ?? Enumerable.Empty<OmbiEpisodeDto>()).Where(e => e != null).ToList();
                    int total = Math.Max(eps.Count, 1);
                    int have = c.available ? total : eps.Count(e => e.available);
                    SonarrSeasonDto existing;
                    if (result.TryGetValue(s.seasonNumber, out existing) && existing.statistics != null)
                    {
                        // Twee aanvragen voor hetzelfde seizoen: het gunstigste aantal telt.
                        existing.statistics.episodeFileCount = Math.Max(existing.statistics.episodeFileCount, have);
                        existing.statistics.episodeCount = Math.Max(existing.statistics.episodeCount, total);
                        continue;
                    }
                    result[s.seasonNumber] = new SonarrSeasonDto
                    {
                        seasonNumber = s.seasonNumber,
                        monitored = true,
                        statistics = new SonarrStatsDto { episodeFileCount = have, episodeCount = total }
                    };
                }
            }
            return result;
        }

        internal static async Task<List<RecentEntry>> GetRecent(IJsonSerializer json, bool tv, CancellationToken ct)
        {
            if (!tv)
            {
                return (await GetMovies(json, ct).ConfigureAwait(false))
                    .Select(m => new RecentEntry { TmdbId = m.theMovieDbId, HasFile = m.available || m.available4K, Added = m.requestedDate })
                    .ToList();
            }
            return (await GetTv(json, ct).ConfigureAwait(false))
                .Select(t => new RecentEntry
                {
                    TmdbId = t.externalProviderId,
                    HasFile = AnyAvailable(t),
                    Added = Children(t).Where(c => c != null).Select(c => c.requestedDate)
                        .Where(d => !string.IsNullOrEmpty(d)).OrderByDescending(d => d).FirstOrDefault()
                })
                .ToList();
        }

        // ---------- Aanvragen ----------

        private static bool AlreadyRequested(OmbiResultDto res)
        {
            if (res == null) return false;
            var code = res.errorCode ?? "";
            return code.IndexOf("AlreadyRequested", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        /// <returns>true = aangevraagd, false = stond al aangevraagd / niets nieuws om aan te vragen.</returns>
        internal static async Task<bool> Request(IJsonSerializer json, bool tv, int tmdbId, int[] seasons, string alias, CancellationToken ct, bool is4k = false)
        {
            if (!Configured) throw new InvalidOperationException(DiscoverLanguage.T("ombi.ombi_is_not_configured"));

            string path, body;
            if (tv)
            {
                // De v2-route werkt met het TMDB-id; de oude v1-route wil een TVDB-id.
                path = "/api/v2/Requests/tv";
                if (seasons == null || seasons.Length == 0)
                {
                    body = "{\"theMovieDbId\":" + tmdbId + ",\"requestAll\":true}";
                }
                else
                {
                    // Seizoen 0 (specials) telt mee, anders zou "alleen de specials" de hele serie aanvragen.
                    var wanted = seasons.Where(n => n >= 0).Distinct().OrderBy(n => n).ToList();
                    if (wanted.Count == 0)
                    {
                        throw new InvalidOperationException(DiscoverLanguage.T("ombi.no_valid_season_chosen"));
                    }
                    // Lege episodes-lijst = het hele seizoen.
                    var parts = wanted.Select(n => "{\"seasonNumber\":" + n + ",\"episodes\":[]}");
                    body = "{\"theMovieDbId\":" + tmdbId + ",\"requestAll\":false,\"seasons\":[" + string.Join(",", parts) + "]}";
                }
            }
            else
            {
                path = "/api/v1/Request/movie";
                body = "{\"theMovieDbId\":" + tmdbId + (is4k ? ",\"is4kRequest\":true" : "") + "}";
            }

            var r = await Call(HttpMethod.Post, path, body, ct, alias).ConfigureAwait(false);
            OmbiResultDto res = null;
            try { res = json.DeserializeFromString<OmbiResultDto>(r.Text); } catch { }

            if (r.Code >= 200 && r.Code <= 299 && res != null && !res.result)
            {
                if (AlreadyRequested(res))
                {
                    DiscoverDiagnostics.Add("log.ombi.ombi", DiscoverDiagnostics.W(tv ? "word.serie" : "word.film"), tmdbId, MessageOf(json, r));
                    return false;
                }
                throw new InvalidOperationException("Ombi: " + MessageOf(json, r));
            }
            if (r.Code < 200 || r.Code > 299)
                throw new InvalidOperationException("Ombi: " + MessageOf(json, r));

            bool pending = false;
            if (res != null && res.requestId > 0)
            {
                try { pending = !await IsApproved(json, tv, res.requestId, ct).ConfigureAwait(false); }
                catch (Exception ex) { if (ex is OperationCanceledException) throw; }
            }
            if (_pending.Count > 5000) { _pending.Clear(); }
            _pending[(tv ? "t:" : "m:") + tmdbId] = pending;
            if (is4k && !tv) DiscoverDiagnostics.Add("log.ombi.ombi_4k_request_for_movie", tmdbId);
            Invalidate();
            DownloadQueue.Invalidate();
            var waiting = DiscoverDiagnostics.W(pending ? "word.awaiting_approval" : "word.none");
            if (string.IsNullOrWhiteSpace(alias)) { DiscoverDiagnostics.Add("log.ombi.requested", DiscoverDiagnostics.W(tv ? "word.series" : "word.movie"), tmdbId, waiting); }
            else { DiscoverDiagnostics.Add("log.ombi.requested_for", DiscoverDiagnostics.W(tv ? "word.series" : "word.movie"), tmdbId, alias, waiting); }
            return true;
        }

        /// <summary>Is de zojuist gemaakte aanvraag al goedgekeurd? Eén kleine vraag aan Ombi.</summary>
        private static async Task<bool> IsApproved(IJsonSerializer json, bool tv, int requestId, CancellationToken ct)
        {
            if (tv)
            {
                var r = await Call(HttpMethod.Get, "/api/v1/Request/tv/" + requestId, null, ct).ConfigureAwait(false);
                if (r.Code < 200 || r.Code > 299) return true;
                var t = json.DeserializeFromString<OmbiTvDto>(r.Text);
                if (t == null) return true;
                var kids = Children(t).Where(c => c != null).ToList();
                return kids.Count == 0 || kids.Any(c => c.approved || c.available);
            }
            var m = await Call(HttpMethod.Get, "/api/v1/Request/movie/info/" + requestId, null, ct).ConfigureAwait(false);
            if (m.Code < 200 || m.Code > 299) return true;
            var mv = json.DeserializeFromString<OmbiMovieDto>(m.Text);
            return mv == null || mv.approved || mv.available;
        }

        // ---------- Verwijderen / annuleren ----------

        /// <summary>
        /// Haalt de aanvraag uit Ombi. Ombi haalt een titel niet uit Radarr/Sonarr, dus de bestanden en de
        /// download blijven daar staan; dat doet de plugin zelf als Radarr/Sonarr ook is ingevuld.
        /// </summary>
        /// <returns>true = verwijderd, false = Ombi kende de titel niet.</returns>
        internal static async Task<bool> Remove(IJsonSerializer json, bool tv, int tmdbId, CancellationToken ct)
        {
            if (!Configured) throw new InvalidOperationException(DiscoverLanguage.T("ombi.ombi_is_not_configured"));
            int id = 0;
            if (tv)
            {
                var t = (await GetTv(json, ct).ConfigureAwait(false)).FirstOrDefault(x => x.externalProviderId == tmdbId);
                if (t != null) id = t.id;
            }
            else
            {
                var m = (await GetMovies(json, ct).ConfigureAwait(false)).FirstOrDefault(x => x.theMovieDbId == tmdbId);
                if (m != null) id = m.id;
            }
            if (id <= 0) { Invalidate(); return false; }

            var d = await Call(HttpMethod.Delete, "/api/v1/Request/" + (tv ? "tv/" : "movie/") + id, null, ct).ConfigureAwait(false);
            if ((d.Code < 200 || d.Code > 299) && d.Code != 404)
                throw new InvalidOperationException("Ombi: " + MessageOf(json, d));
            Invalidate();
            DownloadQueue.Invalidate();
            return true;
        }

        // ---------- 4K ----------

        private static bool _has4kMovie;
        private static DateTime _4kAt;
        private static int _4kBusy;

        /// <summary>Bewaarde waarde (10 min); ververst op de achtergrond. Ombi kent 4K alleen voor films.</summary>
        internal static bool Has4k(IJsonSerializer json, bool tv)
        {
            if (tv || !Configured) return false;
            if (DateTime.UtcNow - _4kAt > TimeSpan.FromMinutes(10) && Interlocked.Exchange(ref _4kBusy, 1) == 0)
            {
                Task.Run(async () =>
                {
                    try
                    {
                        var r = await Call(HttpMethod.Get, "/api/v1/Settings/radarr", null, CancellationToken.None).ConfigureAwait(false);
                        var s = r.Code >= 200 && r.Code <= 299 ? json.DeserializeFromString<OmbiRadarrSettingsDto>(r.Text) : null;
                        _has4kMovie = s != null && s.radarr4K != null && s.radarr4K.enabled;
                        _4kAt = DateTime.UtcNow;
                    }
                    catch (Exception ex) { DiscoverDiagnostics.Add("log.ombi.ombi_4k_server_opvragen_mislukt", ex.Message); _4kAt = DateTime.UtcNow; }
                    finally { Interlocked.Exchange(ref _4kBusy, 0); }
                });
            }
            return _has4kMovie;
        }

        // ---------- Verbinding testen ----------

        /// <returns>"versie|aantal Radarr-servers|aantal Sonarr-servers", net als bij Seerr.</returns>
        internal static async Task<string> Test(IJsonSerializer json, string url, string apiKey, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException(DiscoverLanguage.T("dl.enter_a_url_first"));
            if (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException(DiscoverLanguage.T("ombi.enter_an_api_key_first"));

            // Status/info mag zonder sleutel, dus dit zegt alleen of Ombi bereikbaar is.
            var st = await Send(HttpMethod.Get, url, apiKey, "/api/v1/Status/info", null, null, ct).ConfigureAwait(false);
            if (st.Code < 200 || st.Code > 299)
                throw new InvalidOperationException(DiscoverLanguage.T("ombi.ombi_not_reachable_at") + NormalizeBase(url) + " (" + MessageOf(json, st) + ").");
            var version = (st.Text ?? "").Trim().Trim('"');
            if (version.Length > 40) version = version.Substring(0, 40);

            // Deze vraagt wel om de sleutel.
            var count = await Send(HttpMethod.Get, url, apiKey, "/api/v1/Request/count", null, null, ct).ConfigureAwait(false);
            if (count.Code == 401 || count.Code == 403)
                throw new InvalidOperationException(DiscoverLanguage.T("ombi.ombi_rejects_the_api_key") + count.Code +
                    DiscoverLanguage.T("ombi.use_the_api_key_from_ombi_settings_configuration"));
            if (count.Code < 200 || count.Code > 299)
                throw new InvalidOperationException("Ombi: " + MessageOf(json, count));

            int radarr = -1, sonarr = -1;
            try
            {
                var ra = await Send(HttpMethod.Get, url, apiKey, "/api/v1/Settings/radarr", null, null, ct).ConfigureAwait(false);
                if (ra.Code >= 200 && ra.Code <= 299)
                {
                    var s = json.DeserializeFromString<OmbiRadarrSettingsDto>(ra.Text);
                    radarr = (s != null && s.radarr != null && s.radarr.enabled ? 1 : 0) + (s != null && s.radarr4K != null && s.radarr4K.enabled ? 1 : 0);
                }
                var so = await Send(HttpMethod.Get, url, apiKey, "/api/v1/Settings/sonarr", null, null, ct).ConfigureAwait(false);
                if (so.Code >= 200 && so.Code <= 299)
                {
                    var s = json.DeserializeFromString<OmbiEnabledDto>(so.Text);
                    sonarr = s != null && s.enabled ? 1 : 0;
                }
            }
            catch (Exception ex) { if (ex is OperationCanceledException) throw; }

            Invalidate();
            _4kAt = DateTime.MinValue;
            return version + (radarr >= 0 ? "|" + radarr.ToString(CultureInfo.InvariantCulture) + "|" + sonarr.ToString(CultureInfo.InvariantCulture) : "");
        }
    }
}
