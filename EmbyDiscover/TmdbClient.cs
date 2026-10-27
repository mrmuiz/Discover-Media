using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    // Eigenschapsnamen komen bewust 1-op-1 overeen met de TMDB JSON.
    public class TmdbPage
    {
        public int page { get; set; }
        public int total_pages { get; set; }
        public int total_results { get; set; }
        public List<TmdbItem> results { get; set; }
    }

    public class TmdbItem
    {
        public int id { get; set; }
        public string title { get; set; }
        public string name { get; set; }
        public string original_title { get; set; }
        public string original_name { get; set; }
        public string original_language { get; set; }
        public List<string> origin_country { get; set; }
        public string overview { get; set; }
        public string poster_path { get; set; }
        public string release_date { get; set; }
        public string first_air_date { get; set; }
        public double vote_average { get; set; }
        public int vote_count { get; set; }
        public double popularity { get; set; }
        public bool adult { get; set; }
        public string media_type { get; set; }
        public string backdrop_path { get; set; }
        public List<int> genre_ids { get; set; }
    }

    /// <summary>Extra gegevens voor de bevestigingskaart (genres, speelduur, cast, regie).</summary>
    public class TmdbExtra
    {
        public string tagline { get; set; }
        public int runtime { get; set; }
        public int number_of_seasons { get; set; }
        public int number_of_episodes { get; set; }
        public List<TmdbNamed> genres { get; set; }
        public List<TmdbNamed> created_by { get; set; }
        public List<int> episode_run_time { get; set; }
        public TmdbCredits credits { get; set; }
        public string status { get; set; }
        public string release_date { get; set; }
        public string first_air_date { get; set; }
        public double vote_average { get; set; }
        public int vote_count { get; set; }
        public List<TmdbNamed> production_companies { get; set; }
        public List<TmdbNamed> networks { get; set; }
        public TmdbEpisodeBrief next_episode_to_air { get; set; }
    }

    public class TmdbEpisodeBrief
    {
        public int season_number { get; set; }
        public int episode_number { get; set; }
        public string air_date { get; set; }
    }

    public class TmdbNamed
    {
        public string name { get; set; }
    }

    public class TmdbCredits
    {
        public List<TmdbPerson> cast { get; set; }
        public List<TmdbPerson> crew { get; set; }
    }

    public class TmdbPerson
    {
        public string name { get; set; }
        public string job { get; set; }
    }

    public class TmdbExternalIds
    {
        public int? tvdb_id { get; set; }
    }

    public class TmdbVideo
    {
        public string id { get; set; }
        public string key { get; set; }
        public string name { get; set; }
        public string site { get; set; }
        public string type { get; set; }
        public bool official { get; set; }
        public string iso_639_1 { get; set; }
        public int size { get; set; }
    }

    public class TmdbVideosPage
    {
        public int id { get; set; }
        public List<TmdbVideo> results { get; set; }
    }

    public class TmdbImage
    {
        public string file_path { get; set; }
        public string iso_639_1 { get; set; }
        public double vote_average { get; set; }
        public int width { get; set; }
    }

    public class TmdbImagesPage
    {
        public List<TmdbImage> posters { get; set; }
    }

    public class TmdbSeasonBrief
    {
        public int season_number { get; set; }
        public string name { get; set; }
        public int episode_count { get; set; }
        public string air_date { get; set; }
        public string overview { get; set; }
        public string poster_path { get; set; }
    }

    public class TmdbTvDetail : TmdbItem
    {
        public int number_of_seasons { get; set; }
        public int number_of_episodes { get; set; }
        public List<TmdbSeasonBrief> seasons { get; set; }
    }

    public class TmdbWatchProviders
    {
        public Dictionary<string, TmdbWatchProviderCountry> results { get; set; }
    }

    public class TmdbWatchProviderCountry
    {
        public List<TmdbNamed> flatrate { get; set; }
        public List<TmdbNamed> free { get; set; }
        public List<TmdbNamed> ads { get; set; }
    }

    public class TmdbGenre { public int id { get; set; } public string name { get; set; } }
    public class TmdbGenreList { public List<TmdbGenre> genres { get; set; } }
    public class TmdbLogoInfo { public int id { get; set; } public string name { get; set; } public string logo_path { get; set; } }

    internal partial class TmdbClient
    {
        private static readonly Dictionary<string, string> LogoCache = new Dictionary<string, string>();

        /// <summary>Aantal TMDB-pagina's (20 items per stuk) per rij op de Discover-pagina.</summary>
        public const int PagesPerRow = 3;

        private const string FallbackLanguage = DiscoverLanguage.English;

        private static readonly HttpClient Http = new HttpClient(new HttpClientHandler { AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate }) { Timeout = TimeSpan.FromSeconds(20) };
        // Niet te veel tegelijk, TMDB geeft anders 429.
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(12, 12);
        private readonly IJsonSerializer _json;

        public TmdbClient(IJsonSerializer json) { _json = json; }

        public static string PosterUrl(string posterPath) =>
            string.IsNullOrEmpty(posterPath) ? null : "https://image.tmdb.org/t/p/w500" + posterPath;

        internal static string Language() => DiscoverLanguage.TmdbLanguage;

        internal static bool IsDutchOrUsTv(TmdbItem item) =>
            item?.origin_country != null &&
            item.origin_country.Any(country =>
                string.Equals(country, "NL", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(country, "US", StringComparison.OrdinalIgnoreCase));

        private async Task<T> Get<T>(string path, string extra, string language, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var url = "https://api.themoviedb.org/3" + path
                      + "?api_key=" + Uri.EscapeDataString((cfg.TmdbApiKey ?? "").Trim())
                      + "&language=" + Uri.EscapeDataString(language)
                      + "&include_adult=false"
                      + extra;

            await Gate.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                for (int attempt = 0; ; attempt++)
                {
                    using (var resp = await Http.GetAsync(url, ct).ConfigureAwait(false))
                    {
                        if ((int)resp.StatusCode == 429 && attempt < 2)
                        {
                            await Task.Delay(1000 * (attempt + 1), ct).ConfigureAwait(false);
                            continue;
                        }
                        resp.EnsureSuccessStatusCode();
                        var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                        return _json.DeserializeFromString<T>(body);
                    }
                }
            }
            finally { Gate.Release(); }
        }

        /// <summary>Vul lege velden (beschrijving, poster, titel) aan uit de Engelse versie.</summary>
        private static void Fill(TmdbItem item, TmdbItem fallback)
        {
            if (item == null || fallback == null) return;
            if (string.IsNullOrWhiteSpace(item.overview)) item.overview = fallback.overview;
            if (string.IsNullOrWhiteSpace(item.poster_path)) item.poster_path = fallback.poster_path;
            if (string.IsNullOrWhiteSpace(item.backdrop_path)) item.backdrop_path = fallback.backdrop_path;
            if (string.IsNullOrWhiteSpace(item.title)) item.title = fallback.title;
            if (string.IsNullOrWhiteSpace(item.name)) item.name = fallback.name;
        }

        private static bool NonLatin(string s)
        {
            if (string.IsNullOrEmpty(s)) return false;
            foreach (var c in s) if (c > '\u024F' && char.IsLetter(c)) return true;
            return false;
        }

        /// <summary>Titel in Koreaans/Japans/Chinees/enz. terwijl er een Engelse titel is: gebruik de Engelse.</summary>
        private static void PreferLatin(TmdbItem item, TmdbItem fallback)
        {
            if (item == null || fallback == null) return;
            if (NonLatin(item.title) && !string.IsNullOrWhiteSpace(fallback.title) && !NonLatin(fallback.title)) item.title = fallback.title;
            if (NonLatin(item.name) && !string.IsNullOrWhiteSpace(fallback.name) && !NonLatin(fallback.name)) item.name = fallback.name;
        }

        /// <summary>Haalt een pagina in de ingestelde taal op en vult gaten aan uit en-US.</summary>
        private async Task<TmdbPage> GetMerged(string path, string extra, CancellationToken ct)
        {
            var lang = Language();
            var primaryTask = Get<TmdbPage>(path, extra, lang, ct);
            if (string.Equals(lang, FallbackLanguage, StringComparison.OrdinalIgnoreCase))
                return await primaryTask.ConfigureAwait(false);

            var fallbackTask = Get<TmdbPage>(path, extra, FallbackLanguage, ct);
            var primary = await primaryTask.ConfigureAwait(false);
            TmdbPage fallback = null;
            try { fallback = await fallbackTask.ConfigureAwait(false); } catch { /* Engels is alleen een extraatje */ }

            if (primary?.results != null && fallback?.results != null)
            {
                var byId = new Dictionary<int, TmdbItem>();
                foreach (var f in fallback.results) if (!byId.ContainsKey(f.id)) byId[f.id] = f;
                foreach (var p in primary.results)
                    if (byId.TryGetValue(p.id, out var f)) { Fill(p, f); PreferLatin(p, f); }
            }
            return primary;
        }

        // ---- Paginacache: dezelfde TMDB-pagina wordt door kanaal en Discover-pagina gedeeld, gelijktijdige
        // aanvragen wachten op dezelfde download, en een verlopen pagina wordt direct getoond terwijl hij op de
        // achtergrond ververst wordt. De inhoud is hetzelfde als voorheen, alleen sneller beschikbaar.
        private sealed class PageEntry
        {
            public Task<TmdbPage> Task;
            public DateTime At;
            public bool Refreshing;
        }

        private static readonly Dictionary<string, PageEntry> PageCache = new Dictionary<string, PageEntry>();
        private static readonly TimeSpan PageFresh = TimeSpan.FromMinutes(15);
        private static readonly TimeSpan PageStale = TimeSpan.FromHours(6);

        private async Task<TmdbPage> GetMergedCached(string path, string extra, CancellationToken ct)
        {
            var key = Language() + "|" + path + extra;
            Task<TmdbPage> task = null;
            bool startRefresh = false;
            lock (PageCache)
            {
                PageEntry e;
                if (PageCache.TryGetValue(key, out e))
                {
                    var age = DateTime.UtcNow - e.At;
                    if (!e.Task.IsCompleted)
                    {
                        task = e.Task;
                    }
                    else if (e.Task.Status == TaskStatus.RanToCompletion && age < PageFresh)
                    {
                        task = e.Task;
                    }
                    else if (e.Task.Status == TaskStatus.RanToCompletion && age < PageStale)
                    {
                        task = e.Task;
                        if (!e.Refreshing) { e.Refreshing = true; startRefresh = true; }
                    }
                }
                if (task == null)
                {
                    // Niet delen met de annulering van een enkele aanvrager: de download mag doorlopen voor de rest.
                    task = LoadPage(key, path, extra);
                    PageCache[key] = new PageEntry { Task = task, At = DateTime.UtcNow };
                    if (PageCache.Count > 400)
                    {
                        var old = PageCache.Where(kv => kv.Value.Task.IsCompleted && DateTime.UtcNow - kv.Value.At > PageStale)
                                           .Select(kv => kv.Key).ToList();
                        foreach (var k in old) PageCache.Remove(k);
                    }
                }
            }
            if (startRefresh) { var ignore = RefreshPage(key, path, extra); }
            ct.ThrowIfCancellationRequested();
            return await task.ConfigureAwait(false);
        }

        private async Task<TmdbPage> LoadPage(string key, string path, string extra)
        {
            try { return await GetMerged(path, extra, CancellationToken.None).ConfigureAwait(false); }
            catch
            {
                lock (PageCache)
                {
                    PageEntry e;
                    if (PageCache.TryGetValue(key, out e) && e.Task.IsCompleted && e.Task.Status != TaskStatus.RanToCompletion) PageCache.Remove(key);
                }
                throw;
            }
        }

        private async Task RefreshPage(string key, string path, string extra)
        {
            try
            {
                var t = GetMerged(path, extra, CancellationToken.None);
                await t.ConfigureAwait(false);
                lock (PageCache) { PageCache[key] = new PageEntry { Task = t, At = DateTime.UtcNow }; }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("TMDB " + path + " verversen op de achtergrond mislukt: " + ex.Message);
                lock (PageCache) { PageEntry e; if (PageCache.TryGetValue(key, out e)) e.Refreshing = false; }
            }
        }

        private async Task<TmdbPage> GetMergedSafe(string path, string extra, CancellationToken ct, bool cache = false)
        {
            try { return cache ? await GetMergedCached(path, extra, ct).ConfigureAwait(false) : await GetMerged(path, extra, ct).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB " + path + " (extra pagina) mislukt: " + ex.Message);
                return new TmdbPage { results = new List<TmdbItem>() };
            }
        }

        private static List<TmdbItem> Dedupe(IEnumerable<TmdbPage> pages)
        {
            var seen = new HashSet<int>();
            var list = new List<TmdbItem>();
            foreach (var pg in pages)
            {
                if (pg?.results == null) continue;
                foreach (var i in pg.results)
                    if (seen.Add(i.id)) list.Add(i);
            }
            return list;
        }

        /// <summary>
        /// "Binnenkort" gebruikt /discover/movie op populariteit (zoals Seerr). /movie/upcoming met region
        /// geeft maar ~30 titels, inclusief concertfilms en heruitgaven.
        /// </summary>
        private static string ListExtra(string path, int page, out string realPath)
        {
            realPath = path;
            var extra = "&page=" + page;
            if (path == "/movie/upcoming")
            {
                realPath = "/discover/movie";
                var from = DateTime.UtcNow.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var to = DateTime.UtcNow.Date.AddYears(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                extra += "&sort_by=popularity.desc&include_video=false&primary_release_date.gte=" + from +
                         "&primary_release_date.lte=" + to;
            }
            else if (path == "/tv/upcoming")
            {
                realPath = "/discover/tv";
                var from = DateTime.UtcNow.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var to = DateTime.UtcNow.Date.AddYears(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                extra += "&sort_by=popularity.desc&first_air_date.gte=" + from + "&first_air_date.lte=" + to;
            }
            return extra;
        }

        /// <summary>Een pagina (20 items), taal-aangevuld. Gebruikt door het Emby-kanaal.</summary>
        public Task<TmdbPage> GetList(string path, int page, CancellationToken ct)
        {
            string real;
            var extra = ListExtra(path, page, out real);
            return GetMergedCached(real, extra, ct);
        }

        /// <summary>Meerdere pagina's tegelijk, ontdubbeld. Gebruikt door de Discover-pagina.</summary>
        public async Task<List<TmdbItem>> GetListPages(string path, int firstPage, int lastPage, CancellationToken ct)
        {
            var tasks = new List<Task<TmdbPage>>();
            for (int p = firstPage; p <= lastPage; p++)
            {
                string real;
                var extra = ListExtra(path, p, out real);
                tasks.Add(p == firstPage ? GetMergedCached(real, extra, ct) : GetMergedSafe(real, extra, ct, true));
            }
            await Task.WhenAll(tasks).ConfigureAwait(false);
            return Dedupe(tasks.Select(t => t.Result));
        }

        /// <summary>Zoeken per type (film of serie), zodat personen en rommel er niet tussen komen.</summary>
        public async Task<List<TmdbItem>> SearchTyped(string query, bool tv, int pages, CancellationToken ct)
        {
            var path = tv ? "/search/tv" : "/search/movie";
            var q = "&query=" + Uri.EscapeDataString(query ?? "");
            var tasks = new List<Task<TmdbPage>>();
            for (int p = 1; p <= pages; p++)
                tasks.Add(p == 1 ? GetMerged(path, q + "&page=1", ct) : GetMergedSafe(path, q + "&page=" + p, ct));
            await Task.WhenAll(tasks).ConfigureAwait(false);
            var items = Dedupe(tasks.Select(t => t.Result));
            foreach (var i in items) i.media_type = tv ? "tv" : "movie";
            return items;
        }


        /// <summary>Genrelijst (film of serie) in de ingestelde taal.</summary>
        public async Task<List<TmdbGenre>> GetGenres(bool tv, CancellationToken ct)
        {
            var r = await Get<TmdbGenreList>("/genre/" + (tv ? "tv" : "movie") + "/list", "", Language(), ct).ConfigureAwait(false);
            return r?.genres ?? new List<TmdbGenre>();
        }

        /// <summary>Logo-pad van een studio (company) of netwerk; blijft in het geheugen bewaard.</summary>
        public async Task<string> GetLogo(bool network, int id, CancellationToken ct)
        {
            var key = (network ? "n" : "c") + id;
            lock (LogoCache) { string c; if (LogoCache.TryGetValue(key, out c)) return c; }
            string logo = null;
            try
            {
                var r = await Get<TmdbLogoInfo>((network ? "/network/" : "/company/") + id, "", FallbackLanguage, ct).ConfigureAwait(false);
                logo = r?.logo_path;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB logo " + key + " mislukt: " + ex.Message);
            }
            if (!string.IsNullOrEmpty(logo)) lock (LogoCache) { LogoCache[key] = logo; }
            return logo;
        }

        /// <summary>/discover/movie of /discover/tv op populariteit met een filter (genre, studio, netwerk).</summary>
        public async Task<List<TmdbItem>> BrowsePages(bool tv, string filter, int firstPage, int lastPage, CancellationToken ct)
        {
            var path = tv ? "/discover/tv" : "/discover/movie";
            var tasks = new List<Task<TmdbPage>>();
            for (int p = firstPage; p <= lastPage; p++)
            {
                var extra = "&page=" + p + "&sort_by=popularity.desc" + filter;
                tasks.Add(p == firstPage ? GetMergedCached(path, extra, ct) : GetMergedSafe(path, extra, ct, true));
            }
            await Task.WhenAll(tasks).ConfigureAwait(false);
            var items = Dedupe(tasks.Select(t => t.Result));
            foreach (var i in items) i.media_type = tv ? "tv" : "movie";
            return items;
        }

        private async Task<TmdbItem> GetDetail(string path, CancellationToken ct)
        {
            var lang = Language();
            var item = await Get<TmdbItem>(path, "", lang, ct).ConfigureAwait(false);
            if (!string.Equals(lang, FallbackLanguage, StringComparison.OrdinalIgnoreCase) &&
                (string.IsNullOrWhiteSpace(item.overview) || string.IsNullOrWhiteSpace(item.poster_path) ||
                 (string.IsNullOrWhiteSpace(item.title) && string.IsNullOrWhiteSpace(item.name)) ||
                 NonLatin(item.title) || NonLatin(item.name)))
            {
                try
                {
                    var fb = await Get<TmdbItem>(path, "", FallbackLanguage, ct).ConfigureAwait(false);
                    Fill(item, fb); PreferLatin(item, fb);
                }
                catch { }
            }
            return item;
        }

        private static readonly TimeSpan ExtraTtl = TimeSpan.FromHours(6);
        private static readonly Dictionary<string, KeyValuePair<DateTime, TmdbExtra>> ExtraCache =
            new Dictionary<string, KeyValuePair<DateTime, TmdbExtra>>();

        /// <summary>Zoals GetExtra, maar 6 uur bewaard in het geheugen (voor de infotekst in lijsten en popup).</summary>
        public async Task<TmdbExtra> GetExtraCached(bool tv, int id, CancellationToken ct)
        {
            var key = (tv ? "t" : "m") + id + "|" + Language();
            lock (ExtraCache)
            {
                KeyValuePair<DateTime, TmdbExtra> hit;
                if (ExtraCache.TryGetValue(key, out hit) && DateTime.UtcNow - hit.Key < ExtraTtl) return hit.Value;
            }
            var x = await GetExtra(tv, id, ct).ConfigureAwait(false);
            if (x != null) lock (ExtraCache) { ExtraCache[key] = new KeyValuePair<DateTime, TmdbExtra>(DateTime.UtcNow, x); }
            return x;
        }

        /// <summary>Genres, speelduur, cast en regie. Mislukt dit, dan krijg je null (de kaart werkt ook zonder).</summary>
        public async Task<TmdbExtra> GetExtra(bool tv, int id, CancellationToken ct)
        {
            try
            {
                return await Get<TmdbExtra>((tv ? "/tv/" : "/movie/") + id, "&append_to_response=credits",
                    Language(), ct).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB extra's " + (tv ? "tv/" : "film/") + id + " mislukt: " + ex.Message);
                return null;
            }
        }

        public Task<TmdbItem> GetMovie(int id, CancellationToken ct) => GetDetail("/movie/" + id, ct);

        public Task<TmdbItem> GetTv(int id, CancellationToken ct) => GetDetail("/tv/" + id, ct);

        public Task<TmdbExternalIds> GetTvExternalIds(int id, CancellationToken ct) =>
            Get<TmdbExternalIds>("/tv/" + id + "/external_ids", "", FallbackLanguage, ct);

        public async Task<TmdbTvDetail> GetTvDetail(int id, CancellationToken ct)
        {
            var lang = Language();
            var item = await Get<TmdbTvDetail>("/tv/" + id, "", lang, ct).ConfigureAwait(false);
            bool missingSeasonOverview = item?.seasons != null &&
                item.seasons.Any(season => season != null && string.IsNullOrWhiteSpace(season.overview));
            if (item != null && !string.Equals(lang, FallbackLanguage, StringComparison.OrdinalIgnoreCase) &&
                (string.IsNullOrWhiteSpace(item.overview) || string.IsNullOrWhiteSpace(item.poster_path) ||
                 string.IsNullOrWhiteSpace(item.name) || missingSeasonOverview))
            {
                try
                {
                    var fb = await Get<TmdbTvDetail>("/tv/" + id, "", FallbackLanguage, ct).ConfigureAwait(false);
                    if (fb != null)
                    {
                        if (string.IsNullOrWhiteSpace(item.overview)) item.overview = fb.overview;
                        if (string.IsNullOrWhiteSpace(item.poster_path)) item.poster_path = fb.poster_path;
                        if (string.IsNullOrWhiteSpace(item.name)) item.name = fb.name;
                        if (item.seasons == null || item.seasons.Count == 0) item.seasons = fb.seasons;
                        else if (fb.seasons != null)
                        {
                            foreach (var season in item.seasons)
                            {
                                if (season == null) continue;
                                var fallbackSeason = fb.seasons.FirstOrDefault(candidate =>
                                    candidate != null && candidate.season_number == season.season_number);
                                if (fallbackSeason == null) continue;
                                if (string.IsNullOrWhiteSpace(season.overview)) season.overview = fallbackSeason.overview;
                                if (string.IsNullOrWhiteSpace(season.poster_path)) season.poster_path = fallbackSeason.poster_path;
                                if (string.IsNullOrWhiteSpace(season.name)) season.name = fallbackSeason.name;
                            }
                        }
                        if (item.number_of_seasons == 0) item.number_of_seasons = fb.number_of_seasons;
                    }
                }
                catch { }
            }
            return item;
        }

        public async Task<TmdbSeasonBrief> GetTvSeasonDetail(int id, int seasonNumber, CancellationToken ct)
        {
            var path = "/tv/" + id + "/season/" + seasonNumber;
            var lang = Language();
            TmdbSeasonBrief item = null;
            try { item = await Get<TmdbSeasonBrief>(path, "", lang, ct).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB seizoensbeschrijving " + id + "/s" + seasonNumber + " (" + lang + ") mislukt: " + ex.Message);
            }

            if (!string.Equals(lang, FallbackLanguage, StringComparison.OrdinalIgnoreCase) &&
                string.IsNullOrWhiteSpace(item?.overview))
            {
                try
                {
                    var fallback = await Get<TmdbSeasonBrief>(path, "", FallbackLanguage, ct).ConfigureAwait(false);
                    if (fallback != null)
                    {
                        if (item == null) item = fallback;
                        else
                        {
                            if (string.IsNullOrWhiteSpace(item.overview)) item.overview = fallback.overview;
                            if (string.IsNullOrWhiteSpace(item.poster_path)) item.poster_path = fallback.poster_path;
                            if (string.IsNullOrWhiteSpace(item.name)) item.name = fallback.name;
                        }
                    }
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("TMDB Engelse seizoensbeschrijving " + id + "/s" + seasonNumber + " mislukt: " + ex.Message);
                }
            }
            return item;
        }

        /// <summary>
        /// Zoekt de poster van één seizoen rechtstreeks bij TMDB, voor als de seizoenslijst van de serie er geen heeft:
        /// eerst het seizoen zelf (ingestelde taal, dan Engels), daarna de seizoensafbeeldingen (taal, Engels, taalloos).
        /// Geeft null als er echt geen poster is.
        /// </summary>
        public async Task<string> GetSeasonPosterPath(int id, int seasonNumber, CancellationToken ct)
        {
            try
            {
                var detail = await GetTvSeasonDetail(id, seasonNumber, ct).ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(detail?.poster_path)) return detail.poster_path;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB seizoensposter " + id + "/s" + seasonNumber + " (seizoen) mislukt: " + ex.Message);
            }

            try
            {
                string lang = Language();
                string shortLang = lang.Length >= 2 ? lang.Substring(0, 2).ToLowerInvariant() : "en";
                var images = await Get<TmdbImagesPage>("/tv/" + id + "/season/" + seasonNumber + "/images",
                    "&include_image_language=" + shortLang + ",en,null", FallbackLanguage, ct).ConfigureAwait(false);
                var posters = (images?.posters ?? new List<TmdbImage>())
                    .Where(x => !string.IsNullOrWhiteSpace(x.file_path)).ToList();
                var pick = posters.Where(x => string.Equals(x.iso_639_1, shortLang, StringComparison.OrdinalIgnoreCase))
                               .OrderByDescending(x => x.vote_average).FirstOrDefault()
                           ?? posters.Where(x => string.Equals(x.iso_639_1, "en", StringComparison.OrdinalIgnoreCase))
                               .OrderByDescending(x => x.vote_average).FirstOrDefault()
                           ?? posters.OrderByDescending(x => x.vote_average).FirstOrDefault();
                if (pick != null) return pick.file_path;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB seizoensposter " + id + "/s" + seasonNumber + " (afbeeldingen) mislukt: " + ex.Message);
            }
            return null;
        }

        public async Task<TmdbWatchProviderCountry> GetTvWatchProviders(int id, CancellationToken ct)
        {
            var providers = await Get<TmdbWatchProviders>("/tv/" + id + "/watch/providers", "", FallbackLanguage, ct)
                .ConfigureAwait(false);
            var language = Language();
            var separator = language.LastIndexOf('-');
            var region = separator >= 0 && separator < language.Length - 1
                ? language.Substring(separator + 1).ToUpperInvariant()
                : null;
            TmdbWatchProviderCountry country;
            return !string.IsNullOrEmpty(region) && providers?.results != null &&
                   providers.results.TryGetValue(region, out country)
                ? country
                : null;
        }

        /// <summary>
        /// Haalt YouTube-trailer/teaser op (officiële trailer in de ingestelde taal eerst).
        /// Geeft de YouTube-key terug, of null als TMDB antwoordt maar er geen YouTube-video is.
        /// Gooit een exception als TMDB niet bereikbaar was (zodat de aanroeper geen "geen trailer" meldt).
        /// </summary>
        public async Task<string> GetYoutubeTrailerKey(bool tv, int tmdbId, CancellationToken ct)
        {
            string lang = Language();
            string shortLang = lang.Length >= 2 ? lang.Substring(0, 2).ToLowerInvariant() : "en";
            string basePath = (tv ? "/tv/" : "/movie/") + tmdbId;

            // TMDB geeft bij language=xx alleen video's in die taal terug. Daarom ook expliciet Engels en
            // taalloze video's opvragen; nieuwe titels hebben vaak alleen een Engelse trailer.
            var attempts = new List<Tuple<string, string, string>>
            {
                Tuple.Create(basePath + "/videos", "&include_video_language=" + shortLang + ",en,null", lang),
                Tuple.Create(basePath + "/videos", "&include_video_language=en,null", FallbackLanguage)
            };
            if (tv)
            {
                attempts.Add(Tuple.Create(basePath + "/season/1/videos", "&include_video_language=" + shortLang + ",en,null", lang));
                attempts.Add(Tuple.Create(basePath + "/season/1/videos", "&include_video_language=en,null", FallbackLanguage));
            }

            Exception lastError = null;
            bool answered = false;
            foreach (var a in attempts)
            {
                ct.ThrowIfCancellationRequested();
                TmdbVideosPage page = null;
                for (int retry = 0; retry < 2 && page == null; retry++)
                {
                    try
                    {
                        page = await Get<TmdbVideosPage>(a.Item1, a.Item2, a.Item3, ct).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) { throw; }
                    catch (Exception ex)
                    {
                        lastError = ex;
                        // 404 = (seizoen) bestaat niet: niet opnieuw proberen.
                        if (ex.Message.IndexOf("404", StringComparison.Ordinal) >= 0) break;
                        DiscoverDiagnostics.Add("TMDB video's " + a.Item1 + " (" + a.Item3 + ") poging " + (retry + 1) + " mislukt: " + ex.Message);
                        await Task.Delay(500, ct).ConfigureAwait(false);
                    }
                }
                if (page == null) continue;
                answered = true;

                var yt = (page.results ?? new List<TmdbVideo>()).Where(v =>
                    string.Equals(v.site, "YouTube", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(v.key)).ToList();
                if (yt.Count == 0) continue;

                // Preferentie: officiële Trailer in taal > Trailer in taal > officiële Trailer > Trailer > Teaser > rest
                TmdbVideo pick =
                    yt.FirstOrDefault(v => v.official && EqType(v, "Trailer") && LangMatch(v, shortLang))
                    ?? yt.FirstOrDefault(v => EqType(v, "Trailer") && LangMatch(v, shortLang))
                    ?? yt.FirstOrDefault(v => v.official && EqType(v, "Trailer"))
                    ?? yt.FirstOrDefault(v => EqType(v, "Trailer"))
                    ?? yt.FirstOrDefault(v => EqType(v, "Teaser") && LangMatch(v, shortLang))
                    ?? yt.FirstOrDefault(v => EqType(v, "Teaser"))
                    ?? yt.OrderByDescending(v => v.size).FirstOrDefault();
                if (pick != null) return pick.key;
            }

            if (!answered && lastError != null)
                throw new InvalidOperationException("TMDB niet bereikbaar voor video's: " + lastError.Message, lastError);
            return null;
        }

        private static bool EqType(TmdbVideo v, string type) =>
            string.Equals(v.type, type, StringComparison.OrdinalIgnoreCase);

        private static bool LangMatch(TmdbVideo v, string shortLang) =>
            string.Equals(v.iso_639_1, shortLang, StringComparison.OrdinalIgnoreCase)
            || (shortLang == "en" && string.IsNullOrEmpty(v.iso_639_1));
    }
}
