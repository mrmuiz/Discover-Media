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
    public class ArrIdDto { public int id { get; set; } }
    public class ArrRootDto { public string path { get; set; } }
    public class RadarrMovieDto { public int id { get; set; } public int tmdbId { get; set; } public bool hasFile { get; set; } public bool monitored { get; set; } public string added { get; set; } }
    public class SonarrStatsDto { public int episodeFileCount { get; set; } public int episodeCount { get; set; } }
    public class SonarrSeasonDto { public int seasonNumber { get; set; } public bool monitored { get; set; } public SonarrStatsDto statistics { get; set; } }
    public class SonarrSeriesDto { public int id { get; set; } public int tmdbId { get; set; } public int tvdbId { get; set; } public string title { get; set; } public int year { get; set; } public string imdbId { get; set; } public bool monitored { get; set; } public string added { get; set; } public SonarrStatsDto statistics { get; set; } public List<SonarrSeasonDto> seasons { get; set; } }
    public class SonarrEpisodeDto { public int id { get; set; } public int seasonNumber { get; set; } public bool monitored { get; set; } public bool hasFile { get; set; } public string airDateUtc { get; set; } }
    public class ArrQueueItemDto { public int id { get; set; } public int movieId { get; set; } public int seriesId { get; set; } }
    public class ArrQueueDto { public List<ArrQueueItemDto> records { get; set; } }
    public class RecentEntry { public int TmdbId { get; set; } public bool HasFile { get; set; } public string Added { get; set; } }

    /// <summary>Praat met Radarr (films) en Sonarr v4 (series), of in de Seerr-modus via SeerrClient met Seerr.</summary>
    internal class ArrClient
    {
        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler(true)) { Timeout = TimeSpan.FromSeconds(30) };
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
        private static readonly SemaphoreSlim _movieLock = new SemaphoreSlim(1, 1);
        private static readonly SemaphoreSlim _seriesLock = new SemaphoreSlim(1, 1);

        private static Dictionary<int, bool> _movieCache;
        private static DateTime _movieCacheAt;
        private static Dictionary<int, bool> _seriesCache;
        private static DateTime _seriesCacheAt;
        private static Dictionary<int, Dictionary<int, SonarrSeasonDto>> _seriesSeasonCache =
            new Dictionary<int, Dictionary<int, SonarrSeasonDto>>();
        private static HashSet<int> _seriesTvdbIds = new HashSet<int>();
        private static HashSet<int> _seriesPartial = new HashSet<int>();

        /// <summary>Serie staat in Sonarr met een deel van de (uitgezonden) afleveringen. Gevuld door GetSeriesStates.</summary>
        public static bool IsPartial(int tmdbId) { lock (_seriesCacheLock) { return _seriesPartial.Contains(tmdbId); } }
        private static readonly object _seriesCacheLock = new object();
        private static List<RecentEntry> _movieRecent = new List<RecentEntry>();
        private static List<RecentEntry> _seriesRecent = new List<RecentEntry>();

        private readonly IJsonSerializer _json;

        public ArrClient(IJsonSerializer json) { _json = json; }

        /// <summary>GET op Radarr (sonarr = false) of Sonarr (sonarr = true) met de ingestelde URL en API-sleutel.</summary>
        internal static Task<string> GetRaw(bool sonarr, string path, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            return sonarr
                ? Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, path, null, ct)
                : Send(HttpMethod.Get, cfg.RadarrUrl, cfg.RadarrApiKey, path, null, ct);
        }

        internal static Task<string> PostRaw(bool sonarr, string path, string body, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            return sonarr
                ? Send(HttpMethod.Post, cfg.SonarrUrl, cfg.SonarrApiKey, path, body, ct)
                : Send(HttpMethod.Post, cfg.RadarrUrl, cfg.RadarrApiKey, path, body, ct);
        }

        /// <summary>In de Seerr-modus: true als Seerr is ingesteld (Seerr regelt dan zowel films als series).</summary>
        public static bool RadarrConfigured => SeerrClient.Enabled ? SeerrClient.Configured :
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().RadarrUrl) &&
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().RadarrApiKey);

        public static bool SonarrConfigured => SeerrClient.Enabled ? SeerrClient.Configured :
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().SonarrUrl) &&
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().SonarrApiKey);

        /// <summary>Naam van de dienst waar aanvragen heen gaan, voor meldingen: "Seerr", of "Sonarr"/"Radarr".</summary>
        public static string ServiceName(bool tv) => SeerrClient.Enabled ? "Seerr" : (tv ? "Sonarr" : "Radarr");

        /// <summary>Spaties weg, geen slash aan het eind en http:// ervoor als het schema ontbreekt.</summary>
        private static string NormalizeBase(string baseUrl)
        {
            var u = (baseUrl ?? "").Trim().TrimEnd('/');
            if (!u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !u.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                u = "http://" + u;
            return u;
        }

        private static async Task<string> Send(HttpMethod method, string baseUrl, string apiKey,
            string path, string body, CancellationToken ct)
        {
            var req = new HttpRequestMessage(method, NormalizeBase(baseUrl) + path);
            req.Headers.Add("X-Api-Key", (apiKey ?? "").Trim());
            if (body != null)
                req.Content = new StringContent(body, Encoding.UTF8, "application/json");

            using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
            {
                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    throw new HttpRequestException((int)resp.StatusCode + " " + resp.ReasonPhrase + ": " + text);
                return text;
            }
        }

        private static string Esc(string s)
        {
            var sb = new StringBuilder();
            foreach (var c in s ?? "")
            {
                switch (c)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u" + ((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }

        // ---------- Status (voor het ✓ / ⏳ voorvoegsel) ----------

        /// <summary>tmdbId -> true als Radarr het bestand heeft, false als alleen aangevraagd.</summary>
        public async Task<Dictionary<int, bool>> GetMovieStates(CancellationToken ct)
        {
            if (!RadarrConfigured) return new Dictionary<int, bool>();
            if (SeerrClient.Enabled) return await SeerrClient.GetStates(_json, false, ct).ConfigureAwait(false);
            var cachedNow = _movieCache;
            if (cachedNow != null && DateTime.UtcNow - _movieCacheAt < CacheTtl) return cachedNow;

            // Gelijktijdige aanvragen wachten op één download in plaats van de hele filmlijst meerdere keren op te halen.
            await _movieLock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
            cachedNow = _movieCache;
            if (cachedNow != null && DateTime.UtcNow - _movieCacheAt < CacheTtl) return cachedNow;

            var cfg = Plugin.GetCurrentConfiguration();
            var text = await Send(HttpMethod.Get, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<RadarrMovieDto>>(text) ?? new List<RadarrMovieDto>();

            var dict = new Dictionary<int, bool>();
            foreach (var m in list) dict[m.tmdbId] = m.hasFile;
            _movieRecent = list.Where(m => m.tmdbId > 0).Select(m => new RecentEntry { TmdbId = m.tmdbId, HasFile = m.hasFile, Added = m.added }).ToList();
            _movieCache = dict; _movieCacheAt = DateTime.UtcNow;
            return dict;
            }
            finally { _movieLock.Release(); }
        }

        /// <summary>tmdbId -> true als Sonarr minstens 1 aflevering heeft.</summary>
        public async Task<Dictionary<int, bool>> GetSeriesStates(CancellationToken ct)
        {
            if (!SonarrConfigured) return new Dictionary<int, bool>();
            if (SeerrClient.Enabled)
            {
                var seerrStates = await SeerrClient.GetStates(_json, true, ct).ConfigureAwait(false);
                var seerrPartial = await SeerrClient.GetPartial(_json, ct).ConfigureAwait(false);
                lock (_seriesCacheLock) { _seriesPartial = seerrPartial; }
                return seerrStates;
            }
            var cachedNow = _seriesCache;
            if (cachedNow != null && DateTime.UtcNow - _seriesCacheAt < CacheTtl) return cachedNow;

            await _seriesLock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
            cachedNow = _seriesCache;
            if (cachedNow != null && DateTime.UtcNow - _seriesCacheAt < CacheTtl) return cachedNow;

            var cfg = Plugin.GetCurrentConfiguration();
            var text = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<SonarrSeriesDto>>(text) ?? new List<SonarrSeriesDto>();

            var dict = new Dictionary<int, bool>();
            var seasonStates = new Dictionary<int, Dictionary<int, SonarrSeasonDto>>();
            var tvdbIds = new HashSet<int>();
            var partial = new HashSet<int>();
            int noTmdb = 0;
            foreach (var s in list)
            {
                if (s.tvdbId > 0) tvdbIds.Add(s.tvdbId);
                if (s.tmdbId > 0) dict[s.tmdbId] = s.statistics != null && s.statistics.episodeFileCount > 0;
                if (s.tmdbId > 0 && s.seasons != null)
                {
                    var byNumber = new Dictionary<int, SonarrSeasonDto>();
                    foreach (var season in s.seasons)
                    {
                        if (season != null && season.seasonNumber > 0) byNumber[season.seasonNumber] = season;
                    }
                    seasonStates[s.tmdbId] = byNumber;
                }
                if (s.tmdbId > 0 && s.statistics != null && s.statistics.episodeFileCount > 0 &&
                    s.statistics.episodeFileCount < s.statistics.episodeCount) partial.Add(s.tmdbId);
                else noTmdb++;
            }
            if (noTmdb > 0)
                DiscoverDiagnostics.Add("Sonarr: " + noTmdb + " serie(s) zonder tmdbId, die krijgen geen status op de Discover-pagina (ververs ze in Sonarr).");
            _seriesTvdbIds = tvdbIds;
            lock (_seriesCacheLock)
            {
                _seriesPartial = partial;
                _seriesSeasonCache = seasonStates;
            }
            _seriesRecent = list.Where(x => x.tmdbId > 0).Select(x => new RecentEntry { TmdbId = x.tmdbId, HasFile = x.statistics != null && x.statistics.episodeFileCount > 0, Added = x.added }).ToList();
            _seriesCache = dict; _seriesCacheAt = DateTime.UtcNow;
            return dict;
            }
            finally { _seriesLock.Release(); }
        }

        public async Task<Dictionary<int, SonarrSeasonDto>> GetSeasonStates(int tmdbId, CancellationToken ct)
        {
            if (!SonarrConfigured) return new Dictionary<int, SonarrSeasonDto>();
            if (SeerrClient.Enabled) return await SeerrClient.GetSeasonStates(_json, tmdbId, ct).ConfigureAwait(false);
            await GetSeriesStates(ct).ConfigureAwait(false);
            lock (_seriesCacheLock)
            {
                Dictionary<int, SonarrSeasonDto> states;
                return _seriesSeasonCache.TryGetValue(tmdbId, out states)
                    ? new Dictionary<int, SonarrSeasonDto>(states)
                    : new Dictionary<int, SonarrSeasonDto>();
            }
        }

        /// <summary>Laatst toegevoegde titels in Radarr/Sonarr (nieuwste eerst).</summary>
        public async Task<List<RecentEntry>> GetRecent(bool tv, CancellationToken ct)
        {
            if (SeerrClient.Enabled) return await SeerrClient.GetRecent(_json, tv, ct).ConfigureAwait(false);
            if (tv) await GetSeriesStates(ct).ConfigureAwait(false); else await GetMovieStates(ct).ConfigureAwait(false);
            return new List<RecentEntry>(tv ? _seriesRecent : _movieRecent);
        }

        /// <summary>Zet een net toegevoegde serie in de bewaarde Sonarr-gegevens. false = niet gelukt, wis dan de cache.</summary>
        private bool TryAddToSeriesCache(string createdJson, int tmdbId, int tvdbId)
        {
            try
            {
                var dto = _json.DeserializeFromString<SonarrSeriesDto>(createdJson);
                if (dto == null || dto.id <= 0) return false;
                var cache = _seriesCache;
                if (cache == null) return true;   // niets bewaard: de volgende keer wordt de lijst toch vers opgehaald

                var cacheCopy = new Dictionary<int, bool>(cache);
                cacheCopy[tmdbId] = dto.statistics != null && dto.statistics.episodeFileCount > 0;

                var byNumber = new Dictionary<int, SonarrSeasonDto>();
                if (dto.seasons != null)
                    foreach (var season in dto.seasons)
                        if (season != null && season.seasonNumber > 0) byNumber[season.seasonNumber] = season;

                lock (_seriesCacheLock)
                {
                    var seasonCopy = new Dictionary<int, Dictionary<int, SonarrSeasonDto>>(_seriesSeasonCache);
                    seasonCopy[tmdbId] = byNumber;
                    _seriesSeasonCache = seasonCopy;
                    var partialCopy = new HashSet<int>(_seriesPartial);
                    partialCopy.Remove(tmdbId);
                    _seriesPartial = partialCopy;
                }
                var tvdbCopy = new HashSet<int>(_seriesTvdbIds);
                if (tvdbId > 0) tvdbCopy.Add(tvdbId);
                _seriesTvdbIds = tvdbCopy;
                var recent = new List<RecentEntry>(_seriesRecent);
                recent.Insert(0, new RecentEntry { TmdbId = tmdbId, HasFile = false, Added = dto.added });
                _seriesRecent = recent;
                _seriesCache = cacheCopy;   // als laatste: _seriesCacheAt blijft staan, na de gewone 5 minuten volgt een verse lijst
                return true;
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("Sonarr-cache bijwerken mislukt, cache gewist: " + ex.Message);
                return false;
            }
        }

        public static void InvalidateCaches()
        {
            _movieCache = null;
            _seriesCache = null;
            SeerrClient.Invalidate();
            lock (_seriesCacheLock) { _seriesSeasonCache = new Dictionary<int, Dictionary<int, SonarrSeasonDto>>(); }
        }

        // ---------- Aanvragen ----------

        private async Task<int> ResolveProfile(string url, string key, int configured, CancellationToken ct)
        {
            if (configured > 0) return configured;
            var text = await Send(HttpMethod.Get, url, key, "/api/v3/qualityprofile", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<ArrIdDto>>(text);
            if (list == null || list.Count == 0) throw new InvalidOperationException("Geen quality profile gevonden.");
            return list[0].id;
        }

        private async Task<string> ResolveRoot(string url, string key, string configured, CancellationToken ct)
        {
            if (!string.IsNullOrWhiteSpace(configured)) return configured;
            var text = await Send(HttpMethod.Get, url, key, "/api/v3/rootfolder", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<ArrRootDto>>(text);
            if (list == null || list.Count == 0) throw new InvalidOperationException("Geen root folder gevonden.");
            return list[0].path;
        }

        /// <returns>true = nieuw toegevoegd, false = stond al in Radarr.</returns>
        /// <summary>Radarr's minimumAvailability: the given value when valid, else the setting, else "released".</summary>
        internal static string MinimumAvailability(string wanted)
        {
            foreach (var v in new[] { wanted, Plugin.GetCurrentConfiguration()?.RadarrMinimumAvailability })
            {
                if (string.Equals(v, "announced", StringComparison.OrdinalIgnoreCase)) return "announced";
                if (string.Equals(v, "inCinemas", StringComparison.OrdinalIgnoreCase)) return "inCinemas";
                if (string.Equals(v, "released", StringComparison.OrdinalIgnoreCase)) return "released";
            }
            return "released";
        }

        public async Task<bool> AddMovie(int tmdbId, string title, int year, CancellationToken ct, object embyUserId = null, string minimumAvailability = null)
        {
            if (SeerrClient.Enabled)
            {
                if (await SeerrClient.Request(_json, false, tmdbId, 0, null, embyUserId, ct).ConfigureAwait(false)) return true;
                // Stond al in Seerr: een mislukte aanvraag opnieuw proberen en, als Radarr ook is ingesteld, de film daar
                // op gemonitord zetten en laten zoeken (Seerr zoekt zelf niet opnieuw).
                bool retried = await SeerrClient.RetryFailed(_json, false, tmdbId, ct).ConfigureAwait(false);
                bool searched = RadarrConfigured && await ExtendExistingMovie(tmdbId, title, ct).ConfigureAwait(false);
                return retried || searched;
            }
            if (!RadarrConfigured) throw new InvalidOperationException(DiscoverLanguage.Text("Radarr is niet ingesteld.", "Radarr is not configured.", "Radarr ist nicht eingerichtet."));
            var cfg = Plugin.GetCurrentConfiguration();

            var states = await GetMovieStates(ct).ConfigureAwait(false);
            if (states.ContainsKey(tmdbId)) return await ExtendExistingMovie(tmdbId, title, ct).ConfigureAwait(false);

            var profile = await ResolveProfile(cfg.RadarrUrl, cfg.RadarrApiKey, cfg.RadarrQualityProfileId, ct).ConfigureAwait(false);
            var root = await ResolveRoot(cfg.RadarrUrl, cfg.RadarrApiKey, cfg.RadarrRootFolder, ct).ConfigureAwait(false);

            var body = "{\"title\":\"" + Esc(title) + "\",\"tmdbId\":" + tmdbId + ",\"year\":" + year +
                       ",\"qualityProfileId\":" + profile + ",\"rootFolderPath\":\"" + Esc(root) + "\"" +
                       ",\"monitored\":true,\"minimumAvailability\":\"" + MinimumAvailability(minimumAvailability) + "\"" +
                       ",\"addOptions\":{\"searchForMovie\":true}}";

            await Send(HttpMethod.Post, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie", body, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }

        /// <summary>
        /// De film staat al in Radarr (eerder aangevraagd). Heeft hij nog geen bestand, dan wordt hij op gemonitord gezet en
        /// start Radarr een zoekopdracht; anders bleef hij eeuwig op "aangevraagd" staan zonder dat er iets werd gedownload.
        /// </summary>
        /// <returns>true = gemonitord gezet of zoekopdracht gestart, false = niets te doen (al beschikbaar of niet in Radarr).</returns>
        private async Task<bool> ExtendExistingMovie(int tmdbId, string title, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            RadarrMovieDto movie = null;
            try
            {
                var body = await Send(HttpMethod.Get, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie?tmdbId=" + tmdbId, null, ct).ConfigureAwait(false);
                var list = _json.DeserializeFromString<List<RadarrMovieDto>>(body);
                movie = list == null ? null : list.FirstOrDefault(m => m.tmdbId == tmdbId);
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("Radarr movie lookup (" + title + "): " + ex.Message);
            }
            if (movie == null || movie.id <= 0) { InvalidateCaches(); return false; }
            if (movie.hasFile) return false;

            bool changed = false;
            if (!movie.monitored)
            {
                try
                {
                    await Send(HttpMethod.Put, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie/editor",
                        "{\"movieIds\":[" + movie.id + "],\"monitored\":true}", ct).ConfigureAwait(false);
                    changed = true;
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("Radarr monitor movie (" + title + "): " + ex.Message);
                }
            }
            try
            {
                await Send(HttpMethod.Post, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/command",
                    "{\"name\":\"MoviesSearch\",\"movieIds\":[" + movie.id + "]}", ct).ConfigureAwait(false);
                changed = true;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("Radarr zoeken (" + title + "): " + ex.Message);
            }
            if (changed) InvalidateCaches();
            DiscoverDiagnostics.Add("Radarr " + title + " (already in Radarr, no file): " + (movie.monitored ? "already monitored" : "now monitored") + ", search started");
            return changed;
        }

        /// <summary>
        /// Voegt een serie toe. seasons = null of leeg → alle seizoenen (monitor all).
        /// Anders alleen de opgegeven seizoensnummers (0 = specials).
        /// </summary>
        /// <remarks>
        /// Staat de serie al in Sonarr, dan wordt die niet opnieuw toegevoegd maar uitgebreid (zie ExtendExistingSeries):
        /// de gevraagde seizoenen gaan erbij op gemonitord en wat ontbreekt wordt gezocht.
        /// </remarks>
        /// <returns>true = nieuw toegevoegd of bij een bestaande serie iets aangezet/gezocht, false = er was niets te doen.</returns>
        /// <summary>
        /// TMDB has no TVDB id for some series. Ask Sonarr's own lookup instead: by TMDB id, then IMDb id, then title (+ year).
        /// Returns 0 when Sonarr (TheTVDB) does not know the series either.
        /// </summary>
        public async Task<int> ResolveTvdbId(int tmdbId, string imdbId, string title, string firstAirDate, CancellationToken ct)
        {
            if (!SonarrConfigured) return 0;
            var cfg = Plugin.GetCurrentConfiguration();
            int year = 0;
            if (!string.IsNullOrEmpty(firstAirDate) && firstAirDate.Length >= 4) int.TryParse(firstAirDate.Substring(0, 4), out year);
            async Task<List<SonarrSeriesDto>> Lookup(string term)
            {
                try
                {
                    var text = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series/lookup?term=" + Uri.EscapeDataString(term), null, ct).ConfigureAwait(false);
                    return _json.DeserializeFromString<List<SonarrSeriesDto>>(text) ?? new List<SonarrSeriesDto>();
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("Sonarr lookup '" + term + "' failed: " + ex.Message);
                    return new List<SonarrSeriesDto>();
                }
            }
            var byTmdb = (await Lookup("tmdb:" + tmdbId).ConfigureAwait(false)).FirstOrDefault(x => x.tvdbId > 0 && (x.tmdbId == tmdbId || x.tmdbId == 0));
            if (byTmdb != null) { DiscoverDiagnostics.Add("TVDB id " + byTmdb.tvdbId + " for TMDB " + tmdbId + " found via Sonarr (tmdb lookup)"); return byTmdb.tvdbId; }
            if (!string.IsNullOrWhiteSpace(imdbId))
            {
                var byImdb = (await Lookup("imdb:" + imdbId.Trim()).ConfigureAwait(false)).FirstOrDefault(x => x.tvdbId > 0);
                if (byImdb != null) { DiscoverDiagnostics.Add("TVDB id " + byImdb.tvdbId + " for TMDB " + tmdbId + " found via Sonarr (imdb lookup)"); return byImdb.tvdbId; }
            }
            if (!string.IsNullOrWhiteSpace(title))
            {
                var list = await Lookup(title.Trim()).ConfigureAwait(false);
                var hit = list.FirstOrDefault(x => x.tvdbId > 0 && x.tmdbId == tmdbId)
                          ?? list.FirstOrDefault(x => x.tvdbId > 0 && year > 0 && x.year == year && string.Equals((x.title ?? "").Trim(), title.Trim(), StringComparison.OrdinalIgnoreCase));
                if (hit != null) { DiscoverDiagnostics.Add("TVDB id " + hit.tvdbId + " for TMDB " + tmdbId + " found via Sonarr (title lookup)"); return hit.tvdbId; }
            }
            DiscoverDiagnostics.Add("No TVDB id for TMDB " + tmdbId + " (" + title + "): not on TMDB and not found by Sonarr");
            return 0;
        }

        public async Task<bool> AddSeries(int tmdbId, int tvdbId, string title, int[] seasons, CancellationToken ct, object embyUserId = null)
        {
            if (SeerrClient.Enabled)
            {
                if (await SeerrClient.Request(_json, true, tmdbId, tvdbId, seasons, embyUserId, ct).ConfigureAwait(false)) return true;
                // Stond al in Seerr: mislukte aanvraag opnieuw proberen en, als Sonarr ook is ingesteld, de seizoenen daar
                // op gemonitord zetten en ontbrekende afleveringen laten zoeken.
                bool retried = await SeerrClient.RetryFailed(_json, true, tmdbId, ct).ConfigureAwait(false);
                bool searched = SonarrConfigured && await ExtendExistingSeries(tmdbId, tvdbId, title, seasons, ct).ConfigureAwait(false);
                return retried || searched;
            }
            if (!SonarrConfigured) throw new InvalidOperationException(DiscoverLanguage.Text("Sonarr is niet ingesteld.", "Sonarr is not configured.", "Sonarr ist nicht eingerichtet."));
            var cfg = Plugin.GetCurrentConfiguration();

            var states = await GetSeriesStates(ct).ConfigureAwait(false);
            if (states.ContainsKey(tmdbId) || _seriesTvdbIds.Contains(tvdbId))
                return await ExtendExistingSeries(tmdbId, tvdbId, title, seasons, ct).ConfigureAwait(false);

            var profile = await ResolveProfile(cfg.SonarrUrl, cfg.SonarrApiKey, cfg.SonarrQualityProfileId, ct).ConfigureAwait(false);
            var root = await ResolveRoot(cfg.SonarrUrl, cfg.SonarrApiKey, cfg.SonarrRootFolder, ct).ConfigureAwait(false);

            string addOptions;
            string seasonsJson = null;
            string monitorNew = "none";
            if (seasons == null || seasons.Length == 0)
            {
                addOptions = "{\"monitor\":\"all\",\"searchForMissingEpisodes\":true}";
            }
            else
            {
                // Specifieke seizoenen: de seasons-array bepaalt wat gemonitord wordt. Geen addOptions.monitor meesturen:
                // "none" zet na het toevoegen alle seizoenen weer op niet-gemonitord, waardoor Sonarr niets downloadt.
                // Alle seizoenen van Sonarr worden meegestuurd (gekozen = true, rest = false), zodat de rest ook echt uit blijft.
                var selected = new HashSet<int>(seasons);
                var all = new SortedSet<int>(selected);
                var sonarrKnows = new HashSet<int>();
                try
                {
                    var lookupText = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey,
                        "/api/v3/series/lookup?term=tvdb%3A" + tvdbId, null, ct).ConfigureAwait(false);
                    var lookup = _json.DeserializeFromString<List<SonarrSeriesDto>>(lookupText);
                    var found = lookup == null ? null : lookup.FirstOrDefault(x => x.tvdbId == tvdbId) ?? lookup.FirstOrDefault();
                    if (found != null && found.seasons != null)
                        foreach (var sn in found.seasons) { all.Add(sn.seasonNumber); sonarrKnows.Add(sn.seasonNumber); }
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("Sonarr season lookup failed (only the selected seasons were sent): " + ex.Message);
                }
                var parts = new List<string>();
                foreach (var n in all)
                    parts.Add("{\"seasonNumber\":" + n + ",\"monitored\":" + (selected.Contains(n) ? "true" : "false") + "}");
                seasonsJson = "[" + string.Join(",", parts) + "]";
                addOptions = "{\"searchForMissingEpisodes\":true}";
                // Aangekondigd seizoen dat Sonarr (TVDB) nog niet kent: nieuwe seizoenen laten monitoren,
                // dan staat het meteen aan zodra het in Sonarr verschijnt.
                if (sonarrKnows.Count > 0 && selected.Any(n => !sonarrKnows.Contains(n)))
                {
                    monitorNew = "all";
                    DiscoverDiagnostics.Add("Sonarr does not know season " + string.Join(",", selected.Where(n => !sonarrKnows.Contains(n))) + " of " + title + " yet: new seasons will be monitored");
                }
            }

            var body = "{\"title\":\"" + Esc(title) + "\",\"tvdbId\":" + tvdbId +
                       ",\"qualityProfileId\":" + profile + ",\"rootFolderPath\":\"" + Esc(root) + "\"" +
                       ",\"monitored\":true,\"seasonFolder\":true,\"seriesType\":\"standard\"" +
                       (seasonsJson != null ? ",\"seasons\":" + seasonsJson + ",\"monitorNewItems\":\"" + monitorNew + "\"" : "") +
                       ",\"addOptions\":" + addOptions + "}";

            var created = await Send(HttpMethod.Post, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series", body, ct).ConfigureAwait(false);
            // Alleen deze serie in de bewaarde lijst zetten in plaats van de hele Sonarr-lijst weg te gooien: anders moet de
            // eerstvolgende klik de complete serielijst opnieuw ophalen (traag bij een grote bibliotheek). Lukt dat niet, dan
            // valt het terug op het wissen van de cache.
            if (!TryAddToSeriesCache(created, tmdbId, tvdbId)) InvalidateCaches();

            if (seasons != null && seasons.Length > 0)
            {
                int newId = 0;
                try { var dto = _json.DeserializeFromString<SonarrSeriesDto>(created); if (dto != null) newId = dto.id; }
                catch { }
                if (newId > 0)
                {
                    var chosen = seasons.Distinct().ToArray();
                    var ignored = Task.Run(() => FinishSeasonRequest(newId, chosen, title));
                }
                else DiscoverDiagnostics.Add("Sonarr returned no series id for " + title + "; seasons not double-checked");
            }
            return true;
        }

        /// <summary>Zoekt een serie in Sonarr op TVDB-id (snel), met terugval op de hele lijst (TMDB- of TVDB-id).</summary>
        private async Task<SonarrSeriesDto> FindSeries(int tmdbId, int tvdbId, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            if (tvdbId > 0)
            {
                try
                {
                    var one = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series?tvdbId=" + tvdbId, null, ct).ConfigureAwait(false);
                    var found = (_json.DeserializeFromString<List<SonarrSeriesDto>>(one) ?? new List<SonarrSeriesDto>()).FirstOrDefault(x => x.id > 0);
                    if (found != null) return found;
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                }
            }
            var text = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<SonarrSeriesDto>>(text) ?? new List<SonarrSeriesDto>();
            return list.FirstOrDefault(x => tmdbId > 0 && x.tmdbId == tmdbId) ?? list.FirstOrDefault(x => tvdbId > 0 && x.tvdbId == tvdbId);
        }

        private static bool HasAired(string airDateUtc, DateTime nowUtc)
        {
            DateTime d;
            return !string.IsNullOrEmpty(airDateUtc) &&
                DateTime.TryParse(airDateUtc, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out d) &&
                d <= nowUtc;
        }

        /// <summary>
        /// De serie staat al in Sonarr. Zet de gevraagde seizoenen erbij op gemonitord (seasons = null of leeg: alle seizoenen
        /// behalve specials) en start een zoekopdracht voor de uitgezonden afleveringen die nog ontbreken. Seizoenen die al
        /// gemonitord waren worden niet uitgezet. Anders dan bij een nieuwe serie hoeft er niet gewacht te worden: Sonarr kent de afleveringen al.
        /// </summary>
        /// <returns>true = er is iets aangezet of er is een zoekopdracht gestart, false = er was niets te doen (of de serie bleek er niet meer te staan).</returns>
        private async Task<bool> ExtendExistingSeries(int tmdbId, int tvdbId, string title, int[] seasons, CancellationToken ct)
        {
            var existing = await FindSeries(tmdbId, tvdbId, ct).ConfigureAwait(false);
            if (existing == null) { InvalidateCaches(); return false; }

            bool all = seasons == null || seasons.Length == 0;
            var target = new SortedSet<int>();
            if (all)
            {
                if (existing.seasons != null)
                    foreach (var s in existing.seasons)
                        if (s != null && s.seasonNumber > 0) target.Add(s.seasonNumber);
            }
            else
            {
                foreach (var n in seasons) target.Add(n);
            }
            if (target.Count == 0) return false;

            bool changed = false;

            // De serie zelf moet gemonitord zijn, anders grijpt Sonarr geen enkele aflevering.
            if (!existing.monitored)
            {
                try
                {
                    await SendApi(HttpMethod.Put, "/series/editor", "{\"seriesIds\":[" + existing.id + "],\"monitored\":true}").ConfigureAwait(false);
                    changed = true;
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr monitor series (" + title + "): " + ex.Message); }
            }

            // Seizoensvlag (alleen Sonarr v5 heeft dit endpoint; bij een fout gaan we gewoon door met de afleveringen).
            var known = new Dictionary<int, SonarrSeasonDto>();
            if (existing.seasons != null)
                foreach (var s in existing.seasons)
                    if (s != null) known[s.seasonNumber] = s;
            // Gevraagd seizoen dat Sonarr nog niet kent (aangekondigd, TVDB loopt achter): nieuwe seizoenen laten monitoren.
            var unknown = target.Where(n => !known.ContainsKey(n)).ToList();
            // "Alle seizoenen" belooft ook latere seizoenen: dan ook nieuwe seizoenen laten monitoren.
            if (all || unknown.Count > 0)
            {
                try
                {
                    await SendApi(HttpMethod.Put, "/series/editor", "{\"seriesIds\":[" + existing.id + "],\"monitorNewItems\":\"all\"}").ConfigureAwait(false);
                    if (unknown.Count > 0) changed = true;
                    DiscoverDiagnostics.Add(all ? "Sonarr: new seasons of " + title + " will be monitored"
                        : "Sonarr does not know season " + string.Join(",", unknown) + " of " + title + " yet: new seasons will be monitored");
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr monitor new seasons (" + title + "): " + ex.Message); }
            }
            foreach (var n in target)
            {
                SonarrSeasonDto sd;
                if (!known.ContainsKey(n)) continue;   // bestaat (nog) niet in Sonarr
                if (known.TryGetValue(n, out sd) && sd.monitored) continue;
                try
                {
                    await SendApi(HttpMethod.Put, "/series/" + existing.id + "/season", "{\"seasonNumber\":" + n + ",\"monitored\":true}").ConfigureAwait(false);
                    changed = true;
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr season " + n + " monitoren (" + title + "): " + ex.Message); }
            }

            List<SonarrEpisodeDto> eps = null;
            try
            {
                var t = await SendApi(HttpMethod.Get, "/episode?seriesId=" + existing.id, null).ConfigureAwait(false);
                eps = _json.DeserializeFromString<List<SonarrEpisodeDto>>(t);
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr fetch episodes (" + title + "): " + ex.Message); }
            if (eps == null || eps.Count == 0)
            {
                DiscoverDiagnostics.Add("Sonarr does not know the episodes of " + title + " yet; only the season flags were updated");
                if (changed) InvalidateCaches();
                return changed;
            }

            // Alleen aanzetten, nooit uitzetten: een seizoen dat al gemonitord was blijft zoals het was.
            var on = eps.Where(e => target.Contains(e.seasonNumber) && !e.monitored).Select(e => e.id).ToList();
            if (on.Count > 0)
            {
                try
                {
                    await SendApi(HttpMethod.Put, "/episode/monitor", "{\"episodeIds\":[" + string.Join(",", on) + "],\"monitored\":true}").ConfigureAwait(false);
                    changed = true;
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr monitor episodes (" + title + "): " + ex.Message); }
            }

            // Zoeken alleen als er uitgezonden afleveringen zonder bestand zijn; wat nog niet is uitgezonden pakt Sonarr zelf op.
            var now = DateTime.UtcNow;
            var missing = new SortedSet<int>(eps
                .Where(e => target.Contains(e.seasonNumber) && !e.hasFile && HasAired(e.airDateUtc, now))
                .Select(e => e.seasonNumber));
            if (missing.Count > 0)
            {
                try
                {
                    if (all)
                        await SendApi(HttpMethod.Post, "/command", "{\"name\":\"SeriesSearch\",\"seriesId\":" + existing.id + "}").ConfigureAwait(false);
                    else
                        foreach (var n in missing)
                            await SendApi(HttpMethod.Post, "/command", "{\"name\":\"SeasonSearch\",\"seriesId\":" + existing.id + ",\"seasonNumber\":" + n + "}").ConfigureAwait(false);
                    changed = true;
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr zoeken (" + title + "): " + ex.Message); }
            }

            if (changed) InvalidateCaches();
            DiscoverDiagnostics.Add("Sonarr " + title + " (already in Sonarr): season " + string.Join(", ", target) + " gemonitord (" + on.Count +
                " episodes enabled), search for " + (missing.Count == 0 ? "nothing (no missing aired episodes)" : (all ? "the whole series" : "season " + string.Join(", ", missing))));
            return changed;
        }

        /// <summary>Sonarr v5 heeft /api/v5; oudere versies alleen /api/v3. Eerst v5, bij een fout v3.</summary>
        private static async Task<string> SendApi(HttpMethod method, string path, string body)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            try { return await Send(method, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v5" + path, body, CancellationToken.None).ConfigureAwait(false); }
            catch (Exception) { return await Send(method, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3" + path, body, CancellationToken.None).ConfigureAwait(false); }
        }

        /// <summary>
        /// Draait op de achtergrond na het toevoegen van een serie met gekozen seizoenen: wacht tot Sonarr de afleveringen kent,
        /// zet dan precies de gekozen seizoenen en hun afleveringen op gemonitord (de rest uit) en start de zoekopdracht.
        /// Dat gebeurt expliciet omdat de seizoensvlaggen bij het toevoegen niet altijd op de afleveringen doorwerken.
        /// </summary>
        private async Task FinishSeasonRequest(int seriesId, int[] seasons, string title)
        {
            try
            {
                var selected = new HashSet<int>(seasons);
                List<SonarrEpisodeDto> eps = null;
                for (int i = 0; i < 60; i++)
                {
                    // Snel pollen: de zoekopdracht moet vrijwel direct na het toevoegen starten (totaal maximaal ca. 90 s wachten).
                    await Task.Delay(i == 0 ? 1000 : 1500).ConfigureAwait(false);
                    try
                    {
                        var t = await SendApi(HttpMethod.Get, "/episode?seriesId=" + seriesId, null).ConfigureAwait(false);
                        eps = _json.DeserializeFromString<List<SonarrEpisodeDto>>(t);
                    }
                    catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr fetch episodes (" + title + "): " + ex.Message); }
                    if (eps != null && eps.Count > 0) break;
                }
                if (eps == null || eps.Count == 0)
                {
                    DiscoverDiagnostics.Add("Sonarr does not know the episodes of " + title + " yet; monitoring not verified");
                    return;
                }

                // Seizoensvlag (alleen Sonarr v5 heeft dit endpoint; bij een fout gaan we gewoon door met de afleveringen).
                foreach (var n in selected)
                {
                    try { await SendApi(HttpMethod.Put, "/series/" + seriesId + "/season", "{\"seasonNumber\":" + n + ",\"monitored\":true}").ConfigureAwait(false); }
                    catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr season " + n + " monitoren (" + title + "): " + ex.Message); }
                }

                var on = eps.Where(e => selected.Contains(e.seasonNumber) && !e.monitored).Select(e => e.id).ToList();
                var off = eps.Where(e => !selected.Contains(e.seasonNumber) && e.monitored).Select(e => e.id).ToList();
                try
                {
                    if (on.Count > 0)
                        await SendApi(HttpMethod.Put, "/episode/monitor", "{\"episodeIds\":[" + string.Join(",", on) + "],\"monitored\":true}").ConfigureAwait(false);
                    if (off.Count > 0)
                        await SendApi(HttpMethod.Put, "/episode/monitor", "{\"episodeIds\":[" + string.Join(",", off) + "],\"monitored\":false}").ConfigureAwait(false);
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr monitor episodes (" + title + "): " + ex.Message); }

                // SeriesSearch zoekt alleen de gemonitorde afleveringen: dat zijn nu precies de gekozen seizoenen.
                try { await SendApi(HttpMethod.Post, "/command", "{\"name\":\"SeriesSearch\",\"seriesId\":" + seriesId + "}").ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("Sonarr zoeken (" + title + "): " + ex.Message); }

                InvalidateCaches();
                DiscoverDiagnostics.Add("Sonarr " + title + ": season " + string.Join(", ", selected.OrderBy(x => x)) +
                    " gemonitord (" + on.Count + " episodes enabled, " + off.Count + " disabled) and search (SeriesSearch) started");
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("ERROR season monitoring " + title + ": " + ex.Message);
            }
        }

        // ---------- Verwijderen / aanvraag annuleren ----------

        /// <summary>
        /// Haalt lopende downloads van deze film/serie uit de Radarr/Sonarr-wachtrij en verwijdert ze ook
        /// uit de downloadclient (SABnzbd e.d.). Zonder dit blijft de download doorlopen nadat de film of
        /// serie uit Radarr/Sonarr is gehaald. Fouten hier breken het annuleren niet af.
        /// </summary>
        private async Task PurgeQueue(string baseUrl, string apiKey, bool movie, int itemId, CancellationToken ct)
        {
            string name = movie ? "Radarr" : "Sonarr";
            try
            {
                var text = await Send(HttpMethod.Get, baseUrl, apiKey, "/api/v3/queue?page=1&pageSize=1000", null, ct).ConfigureAwait(false);
                var q = _json.DeserializeFromString<ArrQueueDto>(text);
                var items = (q != null && q.records != null ? q.records : new List<ArrQueueItemDto>())
                    .Where(x => movie ? x.movieId == itemId : x.seriesId == itemId).ToList();

                foreach (var it in items)
                {
                    try
                    {
                        await Send(HttpMethod.Delete, baseUrl, apiKey,
                            "/api/v3/queue/" + it.id + "?removeFromClient=true&blocklist=false", null, ct).ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        if (ex is OperationCanceledException) throw;
                        DiscoverDiagnostics.Add("ERROR queue item " + it.id + " removal in " + name + ": " + ex.Message);
                    }
                }
                if (items.Count > 0)
                    DiscoverDiagnostics.Add(name + ": " + items.Count + " download(s) removed from the queue and download client");
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("ERROR clearing queue in " + name + ": " + ex.Message);
            }
        }

        /// <returns>true = verwijderd uit Radarr, false = stond er niet in.</returns>
        public async Task<bool> RemoveMovie(int tmdbId, bool deleteFiles, CancellationToken ct)
        {
            if (SeerrClient.Enabled) return await SeerrClient.Remove(_json, false, tmdbId, deleteFiles, ct).ConfigureAwait(false);
            if (!RadarrConfigured) throw new InvalidOperationException(DiscoverLanguage.Text("Radarr is niet ingesteld.", "Radarr is not configured.", "Radarr ist nicht eingerichtet."));
            var cfg = Plugin.GetCurrentConfiguration();

            var text = await Send(HttpMethod.Get, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<RadarrMovieDto>>(text) ?? new List<RadarrMovieDto>();
            var m = list.FirstOrDefault(x => x.tmdbId == tmdbId);
            if (m == null) { InvalidateCaches(); return false; }

            await PurgeQueue(cfg.RadarrUrl, cfg.RadarrApiKey, true, m.id, ct).ConfigureAwait(false);
            await Send(HttpMethod.Delete, cfg.RadarrUrl, cfg.RadarrApiKey,
                "/api/v3/movie/" + m.id + "?deleteFiles=" + (deleteFiles ? "true" : "false") + "&addImportExclusion=false",
                null, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }

        /// <returns>true = verwijderd uit Sonarr, false = stond er niet in.</returns>
        public async Task<bool> RemoveSeries(int tmdbId, bool deleteFiles, CancellationToken ct)
        {
            if (SeerrClient.Enabled) return await SeerrClient.Remove(_json, true, tmdbId, deleteFiles, ct).ConfigureAwait(false);
            if (!SonarrConfigured) throw new InvalidOperationException(DiscoverLanguage.Text("Sonarr is niet ingesteld.", "Sonarr is not configured.", "Sonarr ist nicht eingerichtet."));
            var cfg = Plugin.GetCurrentConfiguration();

            var text = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<SonarrSeriesDto>>(text) ?? new List<SonarrSeriesDto>();
            var sr = list.FirstOrDefault(x => x.tmdbId == tmdbId);
            if (sr == null) { InvalidateCaches(); return false; }

            await PurgeQueue(cfg.SonarrUrl, cfg.SonarrApiKey, false, sr.id, ct).ConfigureAwait(false);
            await Send(HttpMethod.Delete, cfg.SonarrUrl, cfg.SonarrApiKey,
                "/api/v3/series/" + sr.id + "?deleteFiles=" + (deleteFiles ? "true" : "false") + "&addImportListExclusion=false",
                null, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }
    }
}
