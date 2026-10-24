using System;
using System.Collections.Generic;
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
    public class RadarrMovieDto { public int id { get; set; } public int tmdbId { get; set; } public bool hasFile { get; set; } public string added { get; set; } }
    public class SonarrStatsDto { public int episodeFileCount { get; set; } public int episodeCount { get; set; } }
    public class SonarrSeasonDto { public int seasonNumber { get; set; } public bool monitored { get; set; } public SonarrStatsDto statistics { get; set; } }
    public class SonarrSeriesDto { public int id { get; set; } public int tmdbId { get; set; } public int tvdbId { get; set; } public string added { get; set; } public SonarrStatsDto statistics { get; set; } public List<SonarrSeasonDto> seasons { get; set; } }
    public class RecentEntry { public int TmdbId { get; set; } public bool HasFile { get; set; } public string Added { get; set; } }

    /// <summary>Praat met Radarr (films) en Sonarr v4 (series).</summary>
    internal class ArrClient
    {
        private static readonly HttpClient Http = new HttpClient(new HttpClientHandler { AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate }) { Timeout = TimeSpan.FromSeconds(30) };
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

        public static bool RadarrConfigured =>
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().RadarrUrl) &&
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().RadarrApiKey);

        public static bool SonarrConfigured =>
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().SonarrUrl) &&
            !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().SonarrApiKey);

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
            if (tv) await GetSeriesStates(ct).ConfigureAwait(false); else await GetMovieStates(ct).ConfigureAwait(false);
            return new List<RecentEntry>(tv ? _seriesRecent : _movieRecent);
        }

        public static void InvalidateCaches()
        {
            _movieCache = null;
            _seriesCache = null;
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
        public async Task<bool> AddMovie(int tmdbId, string title, int year, CancellationToken ct)
        {
            if (!RadarrConfigured) throw new InvalidOperationException("Radarr is niet ingesteld.");
            var cfg = Plugin.GetCurrentConfiguration();

            var states = await GetMovieStates(ct).ConfigureAwait(false);
            if (states.ContainsKey(tmdbId)) return false;

            var profile = await ResolveProfile(cfg.RadarrUrl, cfg.RadarrApiKey, cfg.RadarrQualityProfileId, ct).ConfigureAwait(false);
            var root = await ResolveRoot(cfg.RadarrUrl, cfg.RadarrApiKey, cfg.RadarrRootFolder, ct).ConfigureAwait(false);

            var body = "{\"title\":\"" + Esc(title) + "\",\"tmdbId\":" + tmdbId + ",\"year\":" + year +
                       ",\"qualityProfileId\":" + profile + ",\"rootFolderPath\":\"" + Esc(root) + "\"" +
                       ",\"monitored\":true,\"minimumAvailability\":\"released\"" +
                       ",\"addOptions\":{\"searchForMovie\":true}}";

            await Send(HttpMethod.Post, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie", body, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }

        /// <summary>
        /// Voegt een serie toe. seasons = null of leeg → alle seizoenen (monitor all).
        /// Anders alleen de opgegeven seizoensnummers (0 = specials).
        /// </summary>
        /// <returns>true = nieuw toegevoegd, false = stond al in Sonarr.</returns>
        public async Task<bool> AddSeries(int tmdbId, int tvdbId, string title, int[] seasons, CancellationToken ct)
        {
            if (!SonarrConfigured) throw new InvalidOperationException("Sonarr is niet ingesteld.");
            var cfg = Plugin.GetCurrentConfiguration();

            var states = await GetSeriesStates(ct).ConfigureAwait(false);
            if (states.ContainsKey(tmdbId) || _seriesTvdbIds.Contains(tvdbId)) return false;

            var profile = await ResolveProfile(cfg.SonarrUrl, cfg.SonarrApiKey, cfg.SonarrQualityProfileId, ct).ConfigureAwait(false);
            var root = await ResolveRoot(cfg.SonarrUrl, cfg.SonarrApiKey, cfg.SonarrRootFolder, ct).ConfigureAwait(false);

            string addOptions;
            string seasonsJson = null;
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
                try
                {
                    var lookupText = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey,
                        "/api/v3/series/lookup?term=tvdb%3A" + tvdbId, null, ct).ConfigureAwait(false);
                    var lookup = _json.DeserializeFromString<List<SonarrSeriesDto>>(lookupText);
                    var found = lookup == null ? null : lookup.FirstOrDefault(x => x.tvdbId == tvdbId) ?? lookup.FirstOrDefault();
                    if (found != null && found.seasons != null)
                        foreach (var sn in found.seasons) all.Add(sn.seasonNumber);
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("Sonarr seizoenen opzoeken mislukt (alleen gekozen seizoenen meegestuurd): " + ex.Message);
                }
                var parts = new List<string>();
                foreach (var n in all)
                    parts.Add("{\"seasonNumber\":" + n + ",\"monitored\":" + (selected.Contains(n) ? "true" : "false") + "}");
                seasonsJson = "[" + string.Join(",", parts) + "]";
                addOptions = "{\"searchForMissingEpisodes\":true}";
            }

            var body = "{\"title\":\"" + Esc(title) + "\",\"tvdbId\":" + tvdbId +
                       ",\"qualityProfileId\":" + profile + ",\"rootFolderPath\":\"" + Esc(root) + "\"" +
                       ",\"monitored\":true,\"seasonFolder\":true,\"seriesType\":\"standard\"" +
                       (seasonsJson != null ? ",\"seasons\":" + seasonsJson : "") +
                       ",\"addOptions\":" + addOptions + "}";

            await Send(HttpMethod.Post, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series", body, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }

        // ---------- Verwijderen / aanvraag annuleren ----------

        /// <returns>true = verwijderd uit Radarr, false = stond er niet in.</returns>
        public async Task<bool> RemoveMovie(int tmdbId, bool deleteFiles, CancellationToken ct)
        {
            if (!RadarrConfigured) throw new InvalidOperationException("Radarr is niet ingesteld.");
            var cfg = Plugin.GetCurrentConfiguration();

            var text = await Send(HttpMethod.Get, cfg.RadarrUrl, cfg.RadarrApiKey, "/api/v3/movie", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<RadarrMovieDto>>(text) ?? new List<RadarrMovieDto>();
            var m = list.FirstOrDefault(x => x.tmdbId == tmdbId);
            if (m == null) { InvalidateCaches(); return false; }

            await Send(HttpMethod.Delete, cfg.RadarrUrl, cfg.RadarrApiKey,
                "/api/v3/movie/" + m.id + "?deleteFiles=" + (deleteFiles ? "true" : "false") + "&addImportExclusion=false",
                null, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }

        /// <returns>true = verwijderd uit Sonarr, false = stond er niet in.</returns>
        public async Task<bool> RemoveSeries(int tmdbId, bool deleteFiles, CancellationToken ct)
        {
            if (!SonarrConfigured) throw new InvalidOperationException("Sonarr is niet ingesteld.");
            var cfg = Plugin.GetCurrentConfiguration();

            var text = await Send(HttpMethod.Get, cfg.SonarrUrl, cfg.SonarrApiKey, "/api/v3/series", null, ct).ConfigureAwait(false);
            var list = _json.DeserializeFromString<List<SonarrSeriesDto>>(text) ?? new List<SonarrSeriesDto>();
            var sr = list.FirstOrDefault(x => x.tmdbId == tmdbId);
            if (sr == null) { InvalidateCaches(); return false; }

            await Send(HttpMethod.Delete, cfg.SonarrUrl, cfg.SonarrApiKey,
                "/api/v3/series/" + sr.id + "?deleteFiles=" + (deleteFiles ? "true" : "false") + "&addImportListExclusion=false",
                null, ct).ConfigureAwait(false);
            InvalidateCaches();
            return true;
        }
    }
}
