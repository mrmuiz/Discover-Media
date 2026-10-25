using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    [Route("/Discover/Home", "GET", Summary = "Rijen voor de Discover-pagina")]
    [Authenticated]
    public class DiscoverHomeRequest : IReturn<DiscoverHomeResponse> { }

    [Route("/Discover/List", "GET", Summary = "Volgende pagina van een rij")]
    [Authenticated]
    public class DiscoverListRequest : IReturn<DiscoverRow>
    {
        public string Key { get; set; }
        public int Page { get; set; }
    }

    [Route("/Discover/Search", "GET", Summary = "Zoek films en series")]
    [Authenticated]
    public class DiscoverSearchRequest : IReturn<DiscoverRow>
    {
        public string Query { get; set; }
    }

    [Route("/Discover/RequestItem", "POST", Summary = "Vraag een film of serie aan")]
    [Authenticated]
    public class DiscoverRequestItem : IReturn<DiscoverRequestResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
        /// <summary>Optioneel: seizoensnummers om te monitoren (alleen series). Leeg/null = alle seizoenen.</summary>
        public int[] Seasons { get; set; }
    }

    [Route("/Discover/RemoveItem", "POST", Summary = "Verwijder een film of serie uit Radarr/Sonarr (alleen beheerders)")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverRemoveItem : IReturn<DiscoverRequestResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
        /// <summary>true = ook de bestanden op schijf verwijderen.</summary>
        public bool DeleteFiles { get; set; }
    }

    [Route("/Discover/Resolve", "GET", Summary = "Zoek het TMDB-item en de status bij een Emby-kanaalitem (voor de Aanvragen-knop)")]
    [Authenticated]
    public class DiscoverResolveRequest : IReturn<DiscoverResolveResult>
    {
        public string Name { get; set; }
        public int Year { get; set; }
        public string Overview { get; set; }
        /// <summary>Optioneel: TMDB-id uit de metadata van het item (Trailers-kanaal). Alleen voor films.</summary>
        public int TmdbId { get; set; }
    }

    [Route("/Discover/Info", "GET", Summary = "Infotekst (releasedatum, status, seizoenen, netwerk/studio, genres) voor de popup")]
    [Authenticated]
    public class DiscoverInfoRequest : IReturn<DiscoverInfoResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
    }

    public class DiscoverInfoResult
    {
        public List<string> Lines { get; set; } = new List<string>();
    }

    [Route("/Discover/SeriesCard", "GET", Summary = "Seriegegevens voor de seizoensdetailkaart")]
    [Authenticated]
    public class DiscoverSeriesCardRequest : IReturn<DiscoverSeriesCardResult>
    {
        public int TmdbId { get; set; }
    }

    public class DiscoverSeriesCardResult
    {
        public string Status { get; set; }
        public string FirstAirDate { get; set; }
        public string OriginalLanguage { get; set; }
        public string ProductionCountry { get; set; }
        public string Network { get; set; }
        public int TmdbRating { get; set; }
        public List<string> StreamingOn { get; set; } = new List<string>();
    }

    public class DiscoverSeasonInfo
    {
        public int Number { get; set; }
        public string Name { get; set; }
        public int EpisodeCount { get; set; }
    }

    public class DiscoverResolveResult
    {
        public bool Found { get; set; }
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        /// <summary>Grote achtergrondafbeelding (TMDB) voor de detailpagina.</summary>
        public string Backdrop { get; set; }
        /// <summary>0 = niet aangevraagd, 1 = aangevraagd, 2 = beschikbaar</summary>
        public int Status { get; set; }
        /// <summary>Seizoenen van de serie (alleen Type=tv), specials (0) uitgesloten tenzij er afleveringen zijn.</summary>
        public List<DiscoverSeasonInfo> Seasons { get; set; }
    }

    [Route("/Discover/Status", "GET", Summary = "Status en recente kanaalactiviteit")]
    [Authenticated]
    public class DiscoverStatusRequest : IReturn<DiscoverStatusResponse> { }

    public class DiscoverStatusResponse
    {
        public string PluginVersion { get; set; }
        public bool TmdbKeySet { get; set; }
        public bool ShowDiagnostics { get; set; }
        public string PluginLanguage { get; set; }
        public string TmdbLanguage { get; set; }
        public bool RadarrSet { get; set; }
        public bool SonarrSet { get; set; }
        public string LoadedAt { get; set; }
        public int ChannelCalls { get; set; }
        public int Requests { get; set; }
        public int RequestErrors { get; set; }
        public string ClipPath { get; set; }
        public string ClipError { get; set; }
        public string ButtonScript { get; set; }
        public List<string> Events { get; set; } = new List<string>();
    }

    public class DiscoverItemDto
    {
        public int TmdbId { get; set; }
        public string Type { get; set; }
        public string Title { get; set; }
        public int Year { get; set; }
        public string Poster { get; set; }
        public string Backdrop { get; set; }
        public double Rating { get; set; }
        public string Overview { get; set; }
        /// <summary>0 = niet aangevraagd, 1 = aangevraagd, 2 = beschikbaar</summary>
        public int Status { get; set; }
    }

    public class DiscoverTileDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        /// <summary>Logo-URL (studio/netwerk), anders leeg.</summary>
        public string Image { get; set; }
        public string Color { get; set; }
    }

    [Route("/Discover/Browse", "GET", Summary = "Films/series per genre, studio of netwerk")]
    [Authenticated]
    public class DiscoverBrowseRequest : IReturn<DiscoverRow>
    {
        /// <summary>genre_movie, genre_tv, studio of network</summary>
        public string Kind { get; set; }
        public int Id { get; set; }
        public int Page { get; set; }
    }

    public class DiscoverRow
    {
        public string Key { get; set; }
        public string Title { get; set; }
        /// <summary>posters of tiles</summary>
        public string Kind { get; set; } = "posters";
        public string TileKind { get; set; }
        public List<DiscoverTileDto> Tiles { get; set; } = new List<DiscoverTileDto>();
        /// <summary>Eerstvolgende TMDB-pagina die /Discover/List kan ophalen.</summary>
        public int NextPage { get; set; }
        public List<DiscoverItemDto> Items { get; set; } = new List<DiscoverItemDto>();
    }

    public class DiscoverHomeResponse
    {
        public string Language { get; set; }
        public string Message { get; set; }
        public List<DiscoverRow> Rows { get; set; } = new List<DiscoverRow>();
    }

    public class DiscoverRequestResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public int Status { get; set; }
    }

    public class DiscoverApiService : IService
    {
        private class RowDef
        {
            public string Key; public string Title; public string Path; public bool Tv; public bool Mixed;
            public string Kind = "list";      // list, recent_added, recent_requests, tiles
            public string TileKind;           // genre_movie, genre_tv, studio, network
        }

        // Volgorde zoals op de Seerr-startpagina.
        private static readonly List<RowDef> Defs = new List<RowDef>
        {
            new RowDef { Key = "recent_added", Title = "Onlangs toegevoegd", Kind = "recent_added" },
            new RowDef { Key = "recent_requests", Title = "Recente aanvragen", Kind = "recent_requests" },
            new RowDef { Key = "trending", Title = "Trending", Path = "/trending/all/week", Mixed = true },
            new RowDef { Key = "popular_movie", Title = "Populaire films", Path = "/movie/popular", Tv = false },
            new RowDef { Key = "genres_movie", Title = "Filmgenres", Kind = "tiles", TileKind = "genre_movie" },
            new RowDef { Key = "upcoming_movie", Title = "Aankomende films", Path = "/movie/upcoming", Tv = false },
            new RowDef { Key = "studios", Title = "Studio's", Kind = "tiles", TileKind = "studio" },
            new RowDef { Key = "popular_tv", Title = "Populaire series", Path = "/tv/popular", Tv = true },
            new RowDef { Key = "genres_tv", Title = "Seriegenres", Kind = "tiles", TileKind = "genre_tv" },
            new RowDef { Key = "upcoming_tv", Title = "Aankomende series", Path = "/tv/upcoming", Tv = true },
            new RowDef { Key = "networks", Title = "Netwerken", Kind = "tiles", TileKind = "network" }
        };

        internal static readonly KeyValuePair<int, string>[] Studios =
        {
            new KeyValuePair<int, string>(2, "Walt Disney Pictures"),
            new KeyValuePair<int, string>(127928, "20th Century Studios"),
            new KeyValuePair<int, string>(34, "Sony Pictures"),
            new KeyValuePair<int, string>(174, "Warner Bros. Pictures"),
            new KeyValuePair<int, string>(33, "Universal Pictures"),
            new KeyValuePair<int, string>(4, "Paramount Pictures"),
            new KeyValuePair<int, string>(3, "Pixar"),
            new KeyValuePair<int, string>(521, "DreamWorks Animation"),
            new KeyValuePair<int, string>(420, "Marvel Studios"),
            new KeyValuePair<int, string>(9993, "DC"),
            new KeyValuePair<int, string>(41077, "A24")
        };

        internal static readonly KeyValuePair<int, string>[] Networks =
        {
            new KeyValuePair<int, string>(213, "Netflix"),
            new KeyValuePair<int, string>(2739, "Disney+"),
            new KeyValuePair<int, string>(1024, "Prime Video"),
            new KeyValuePair<int, string>(2552, "Apple TV+"),
            new KeyValuePair<int, string>(453, "Hulu"),
            new KeyValuePair<int, string>(49, "HBO"),
            new KeyValuePair<int, string>(4353, "discovery+"),
            new KeyValuePair<int, string>(2, "ABC"),
            new KeyValuePair<int, string>(19, "FOX"),
            new KeyValuePair<int, string>(359, "Cinemax"),
            new KeyValuePair<int, string>(174, "AMC"),
            new KeyValuePair<int, string>(67, "Showtime"),
            new KeyValuePair<int, string>(318, "Starz"),
            new KeyValuePair<int, string>(71, "The CW"),
            new KeyValuePair<int, string>(6, "NBC"),
            new KeyValuePair<int, string>(16, "CBS"),
            new KeyValuePair<int, string>(4330, "Paramount+"),
            new KeyValuePair<int, string>(4, "BBC One"),
            new KeyValuePair<int, string>(56, "Cartoon Network"),
            new KeyValuePair<int, string>(80, "Adult Swim"),
            new KeyValuePair<int, string>(13, "Nickelodeon"),
            new KeyValuePair<int, string>(3353, "Peacock")
        };

        private static readonly string[] Palette =
        {
            "#b91c1c", "#0e7490", "#7e22ce", "#047857", "#be185d", "#4d7c0f", "#1d4ed8", "#a16207",
            "#475569", "#c2410c", "#0369a1", "#6d28d9"
        };

        private static readonly Dictionary<string, TmdbItem> DetailCache = new Dictionary<string, TmdbItem>();

        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly ILogger _logger;

        public DiscoverApiService(ILogManager logManager, IJsonSerializer json)
        {
            _logger = logManager.GetLogger("Discover");
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
        }

        public object Get(DiscoverStatusRequest request)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            string clipError;
            var clipPath = ClipPathOrError(out clipError);
            return new DiscoverStatusResponse
            {
                PluginVersion = typeof(Plugin).Assembly.GetName().Version.ToString(),
                TmdbKeySet = !string.IsNullOrWhiteSpace(cfg.TmdbApiKey),
                ShowDiagnostics = cfg.ShowDiagnostics,
                PluginLanguage = DiscoverLanguage.PluginLanguage,
                TmdbLanguage = TmdbClient.Language(),
                RadarrSet = ArrClient.RadarrConfigured,
                SonarrSet = ArrClient.SonarrConfigured,
                LoadedAt = DiscoverDiagnostics.LoadedUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss"),
                ChannelCalls = DiscoverDiagnostics.ChannelCalls,
                Requests = DiscoverDiagnostics.Requests,
                RequestErrors = DiscoverDiagnostics.RequestErrors,
                ClipPath = clipPath,
                ClipError = clipError,
                ButtonScript = DiscoverLanguage.Text("OK Emby-pluginresource; open Discover om het script in deze browser te laden.",
                    "OK Emby plugin resource; open Discover to load the script in this browser.",
                    "OK Emby-Pluginressource; öffne Discover, um das Skript in diesem Browser zu laden."),
                Events = DiscoverDiagnostics.Snapshot()
            };
        }

        public async Task<object> Get(DiscoverHomeRequest request)
        {
            var resp = new DiscoverHomeResponse { Language = DiscoverLanguage.PluginLanguage };
            if (string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().TmdbApiKey))
            {
                resp.Message = DiscoverLanguage.Text(
                    "Vul eerst je TMDB API key in bij de plugininstellingen (Dashboard > Plugins > Discover).",
                    "Enter your TMDB API key in the plugin settings first (Dashboard > Plugins > Discover).",
                    "Gib zuerst deinen TMDB-API-Schlüssel in den Plugin-Einstellungen ein (Dashboard > Plugins > Discover).");
                return resp;
            }

            try
            {
                var movieStatesTask = SafeStates(false);
                var tvStatesTask = SafeStates(true);
                await Task.WhenAll(movieStatesTask, tvStatesTask).ConfigureAwait(false);
                var ms = movieStatesTask.Result;
                var ts = tvStatesTask.Result;

                var tasks = Defs.Select(d => BuildRow(d, ms, ts)).ToList();
                var rows = await Task.WhenAll(tasks).ConfigureAwait(false);
                foreach (var r in rows) if (r != null) resp.Rows.Add(r);
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: home laden mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT home laden: " + ex.Message);
                resp.Message = DiscoverLanguage.Text("Laden mislukt: ", "Loading failed: ", "Laden fehlgeschlagen: ") + ex.Message;
            }
            return resp;
        }

        private async Task<DiscoverRow> BuildRow(RowDef d, Dictionary<int, bool> ms, Dictionary<int, bool> ts)
        {
            var row = new DiscoverRow
            {
                Key = d.Key,
                Title = LocalizedRowTitle(d.Key),
                NextPage = TmdbClient.PagesPerRow + 1,
                Kind = d.Kind == "tiles" ? "tiles" : "posters",
                TileKind = d.TileKind
            };
            try
            {
                switch (d.Kind)
                {
                    case "list":
                        row.Items = ToDtos(await SafeList(d.Path).ConfigureAwait(false), d, ms, ts);
                        break;
                    case "recent_added":
                        row.Items = await RecentDtos(true, ms, ts).ConfigureAwait(false);
                        break;
                    case "recent_requests":
                        row.Items = await RecentDtos(false, ms, ts).ConfigureAwait(false);
                        break;
                    case "tiles":
                        row.Tiles = await TilesFor(d.TileKind).ConfigureAwait(false);
                        break;
                }

            }
            catch (Exception ex)
            {
                _logger.Error("Discover: rij {0} mislukt: {1}", d.Key, ex.Message);
                DiscoverDiagnostics.Add("FOUT rij " + d.Key + ": " + ex.Message);
            }
            return row;
        }

        private static string LocalizedRowTitle(string key)
        {
            switch (key)
            {
                case "recent_added": return DiscoverLanguage.Text("Onlangs toegevoegd", "Recently added", "Kürzlich hinzugefügt");
                case "recent_requests": return DiscoverLanguage.Text("Recente aanvragen", "Recent requests", "Kürzlich angefragt");
                case "trending": return "Trending";
                case "popular_movie": return DiscoverLanguage.Text("Populaire films", "Popular Movies", "Beliebte Filme");
                case "genres_movie": return DiscoverLanguage.Text("Filmgenres", "Movie Genres", "Filmgenres");
                case "upcoming_movie": return DiscoverLanguage.Text("Aankomende films", "Upcoming Movies", "Kommende Filme");
                case "studios": return DiscoverLanguage.Text("Studio's", "Studios", "Studios");
                case "popular_tv": return DiscoverLanguage.Text("Populaire series", "Popular Series", "Beliebte Serien");
                case "genres_tv": return DiscoverLanguage.Text("Seriegenres", "Series Genres", "Seriengenres");
                case "upcoming_tv": return DiscoverLanguage.Text("Aankomende series", "Upcoming Series", "Kommende Serien");
                case "networks": return DiscoverLanguage.Text("Netwerken", "Networks", "Sender");
                default: return key;
            }
        }

        public async Task<object> Get(DiscoverListRequest request)
        {
            var row = new DiscoverRow { Key = request.Key, NextPage = request.Page + 1 };
            var def = Defs.FirstOrDefault(d => d.Key == request.Key && d.Kind == "list");
            if (def == null || request.Page < 1 || request.Page > 500) return row;
            try
            {
                var ms = SafeStates(false);
                var ts = SafeStates(true);
                var itemsTask = _tmdb.GetListPages(def.Path, request.Page, request.Page, CancellationToken.None);
                await Task.WhenAll(ms, ts, itemsTask).ConfigureAwait(false);
                row.Items = ToDtos(itemsTask.Result, def, ms.Result, ts.Result);
            }
            catch (Exception ex)
            {
                // Voorbij de laatste pagina geeft TMDB een fout: dan is de rij gewoon op.
                DiscoverDiagnostics.Add("rij " + request.Key + " pagina " + request.Page + ": " + ex.Message);
            }
            return row;
        }

        public async Task<object> Get(DiscoverBrowseRequest request)
        {
            int page = request.Page < 1 ? 1 : request.Page;
            var row = new DiscoverRow { Key = "browse", NextPage = page + 2 };
            if (page > 250) return row;
            try
            {
                bool tv;
                string filter;
                switch (request.Kind)
                {
                    case "genre_movie": tv = false; filter = "&with_genres=" + request.Id; break;
                    case "genre_tv": tv = true; filter = "&with_genres=" + request.Id; break;
                    case "studio": tv = false; filter = "&with_companies=" + request.Id; break;
                    case "network": tv = true; filter = "&with_networks=" + request.Id; break;
                    default: return row;
                }
                var states = SafeStates(tv);
                var itemsTask = _tmdb.BrowsePages(tv, filter, page, page + 1, CancellationToken.None);
                await Task.WhenAll(states, itemsTask).ConfigureAwait(false);
                row.Items = itemsTask.Result
                    .Where(x => !x.adult && !string.IsNullOrEmpty(x.poster_path) &&
                        (!tv || TmdbClient.IsDutchOrUsTv(x)))
                    .Select(x => ToDto(x, tv, states.Result))
                    .ToList();
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("browse " + request.Kind + " " + request.Id + " pagina " + page + ": " + ex.Message);
            }
            return row;
        }

        // ---------- tegels (genres, studio's, netwerken) ----------
        private async Task<List<DiscoverTileDto>> TilesFor(string kind)
        {
            var tiles = new List<DiscoverTileDto>();
            if (kind == "genre_movie" || kind == "genre_tv")
            {
                var genres = await _tmdb.GetGenres(kind == "genre_tv", CancellationToken.None).ConfigureAwait(false);
                foreach (var g in genres)
                {
                    bool tv = kind == "genre_tv";
                    tiles.Add(new DiscoverTileDto
                    {
                        Id = g.id.ToString(),
                        Name = DiscoverMediaChannel.LocalizedGenreName(g.id, tv, g.name),
                        Color = Palette[Math.Abs(g.id) % Palette.Length]
                    });
                }
                return tiles;
            }

            bool network = kind == "network";
            var src = network ? Networks : Studios;
            var logos = await Task.WhenAll(src.Select(x => _tmdb.GetLogo(network, x.Key, CancellationToken.None))).ConfigureAwait(false);
            for (int i = 0; i < src.Length; i++)
            {
                tiles.Add(new DiscoverTileDto
                {
                    Id = src[i].Key.ToString(),
                    Name = src[i].Value,
                    Image = string.IsNullOrEmpty(logos[i]) ? null : "https://image.tmdb.org/t/p/w300" + logos[i],
                    Color = "#1c2640"
                });
            }
            return tiles;
        }

        // ---------- onlangs toegevoegd / recente aanvragen (uit Radarr en Sonarr) ----------
        private async Task<TmdbItem> CachedDetail(bool tv, int id)
        {
            var key = TmdbClient.Language() + "|" + (tv ? "tv:" : "movie:") + id;
            lock (DetailCache) { TmdbItem c; if (DetailCache.TryGetValue(key, out c)) return c; }
            try
            {
                var item = tv ? await _tmdb.GetTv(id, CancellationToken.None).ConfigureAwait(false)
                              : await _tmdb.GetMovie(id, CancellationToken.None).ConfigureAwait(false);
                if (item != null) lock (DetailCache) { DetailCache[key] = item; }
                return item;
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("TMDB detail " + key + " mislukt: " + ex.Message);
                return null;
            }
        }

        private async Task<List<DiscoverItemDto>> RecentDtos(bool onlyWithFiles, Dictionary<int, bool> ms, Dictionary<int, bool> ts)
        {
            var movies = ArrClient.RadarrConfigured ? await SafeRecent(false).ConfigureAwait(false) : new List<RecentEntry>();
            var series = ArrClient.SonarrConfigured ? await SafeRecent(true).ConfigureAwait(false) : new List<RecentEntry>();

            var pick = movies.Select(e => new { E = e, Tv = false })
                .Concat(series.Select(e => new { E = e, Tv = true }))
                .Where(x => !onlyWithFiles || x.E.HasFile)
                .OrderByDescending(x => x.E.Added ?? "")
                .Take(20)
                .ToList();

            var details = await Task.WhenAll(pick.Select(x => CachedDetail(x.Tv, x.E.TmdbId))).ConfigureAwait(false);
            var res = new List<DiscoverItemDto>();
            for (int i = 0; i < pick.Count; i++)
            {
                var d = details[i];
                if (d == null || string.IsNullOrEmpty(d.poster_path)) continue;
                res.Add(ToDto(d, pick[i].Tv, pick[i].Tv ? ts : ms));
            }
            return res;
        }

        private async Task<List<RecentEntry>> SafeRecent(bool tv)
        {
            try { return await _arr.GetRecent(tv, CancellationToken.None).ConfigureAwait(false); }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT recent " + (tv ? "Sonarr" : "Radarr") + ": " + ex.Message);
                return new List<RecentEntry>();
            }
        }

        private static List<DiscoverItemDto> ToDtos(List<TmdbItem> list, RowDef d, Dictionary<int, bool> ms, Dictionary<int, bool> ts)
        {
            var res = new List<DiscoverItemDto>();
            foreach (var x in list)
            {
                // Zonder poster of als volwassen-titel valt een kaart weg: dat zijn de "niet juiste" items.
                if (x.adult || string.IsNullOrEmpty(x.poster_path)) continue;
                bool tv = d.Tv;
                if (d.Mixed)
                {
                    if (string.Equals(x.media_type, "tv", StringComparison.OrdinalIgnoreCase)) tv = true;
                    else if (string.Equals(x.media_type, "movie", StringComparison.OrdinalIgnoreCase)) tv = false;
                    else continue; // personen e.d.
                }
                if (tv && !TmdbClient.IsDutchOrUsTv(x)) continue;
                res.Add(ToDto(x, tv, tv ? ts : ms));
            }
            return res;
        }

        public async Task<object> Get(DiscoverSearchRequest request)
        {
            var row = new DiscoverRow { Key = "search", Title = "Zoekresultaten" };
            if (string.IsNullOrWhiteSpace(request.Query)) return row;

            try
            {
                var q = request.Query.Trim();
                var movieStatesTask = SafeStates(false);
                var tvStatesTask = SafeStates(true);
                var movieTask = _tmdb.SearchTyped(q, false, 2, CancellationToken.None);
                var tvTask = _tmdb.SearchTyped(q, true, 2, CancellationToken.None);
                await Task.WhenAll(movieStatesTask, tvStatesTask, movieTask, tvTask).ConfigureAwait(false);

                var combined = movieTask.Result.Select(i => new { Item = i, Tv = false })
                    .Concat(tvTask.Result.Select(i => new { Item = i, Tv = true }))
                    .Where(x => !x.Item.adult && (!string.IsNullOrEmpty(x.Item.poster_path) || x.Item.vote_count > 0))
                    // Exacte titel eerst, daarna op populariteit.
                    .OrderByDescending(x => string.Equals(TitleOf(x.Item, x.Tv), q, StringComparison.OrdinalIgnoreCase))
                    .ThenByDescending(x => x.Item.popularity)
                    .ToList();

                foreach (var x in combined)
                    row.Items.Add(ToDto(x.Item, x.Tv, x.Tv ? tvStatesTask.Result : movieStatesTask.Result));
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: zoeken mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT zoeken: " + ex.Message);
            }
            return row;
        }


        public async Task<object> Get(DiscoverInfoRequest request)
        {
            var res = new DiscoverInfoResult();
            try
            {
                bool tv = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase);
                if (request.TmdbId <= 0 || string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().TmdbApiKey)) return res;
                var x = await _tmdb.GetExtraCached(tv, request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                if (x == null) return res;
                var states = await SafeStates(tv).ConfigureAwait(false);
                bool hasFiles;
                if (tv && states.TryGetValue(request.TmdbId, out hasFiles) && hasFiles && ArrClient.IsPartial(request.TmdbId))
                    res.Lines.Add(DiscoverLanguage.Text(
                        "\u2713 Gedeeltelijk beschikbaar",
                        "\u2713 Partially available",
                        "\u2713 Teilweise verfügbar"));
                res.Lines.AddRange(InfoText.Lines(null, x, tv, true));
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("FOUT info " + request.Type + "/" + request.TmdbId + ": " + ex.Message);
            }
            return res;
        }

        public async Task<object> Get(DiscoverSeriesCardRequest request)
        {
            var result = new DiscoverSeriesCardResult();
            if (request.TmdbId <= 0 || string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().TmdbApiKey))
                return result;
            try
            {
                var detailTask = _tmdb.GetTvDetail(request.TmdbId, CancellationToken.None);
                var extraTask = _tmdb.GetExtraCached(true, request.TmdbId, CancellationToken.None);
                var providerTask = _tmdb.GetTvWatchProviders(request.TmdbId, CancellationToken.None);
                await Task.WhenAll(detailTask, extraTask).ConfigureAwait(false);
                var detail = await detailTask.ConfigureAwait(false);
                var extra = await extraTask.ConfigureAwait(false);
                TmdbWatchProviderCountry providers = null;
                try { providers = await providerTask.ConfigureAwait(false); }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("TMDB streamingdiensten " + request.TmdbId + " mislukt: " + ex.Message);
                }

                if (detail == null) return result;
                result.Status = LocalizedSeriesStatus(extra?.status);
                DateTime firstAirDate;
                if (InfoText.TryDate(detail.first_air_date, out firstAirDate))
                    result.FirstAirDate = InfoText.LongDate(firstAirDate);
                result.OriginalLanguage = LanguageName(detail.original_language);
                result.ProductionCountry = CountryNames(detail.origin_country);
                result.Network = extra?.networks == null ? null : string.Join(", ",
                    extra.networks.Where(x => !string.IsNullOrWhiteSpace(x?.name))
                        .Select(x => x.name.Trim()).Distinct().Take(3));
                result.TmdbRating = (int)Math.Round((extra?.vote_average ?? detail.vote_average) * 10);
                if (providers != null)
                    result.StreamingOn = (providers.flatrate ?? new List<TmdbNamed>())
                        .Concat(providers.free ?? new List<TmdbNamed>())
                        .Concat(providers.ads ?? new List<TmdbNamed>())
                        .Where(x => !string.IsNullOrWhiteSpace(x?.name))
                        .Select(x => x.name.Trim()).Distinct().Take(5).ToList();
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT seriekaart " + request.TmdbId + ": " + ex.Message);
            }
            return result;
        }

        public async Task<object> Get(DiscoverResolveRequest request)
        {
            var res = new DiscoverResolveResult();
            try
            {
                var name = (request.Name ?? "").Trim();
                // Het kanaal zet een status-icoon voor de titel.
                while (name.Length > 1 && (name[0] == '\u2713' || name[0] == '\u23F3')) name = name.Substring(1).TrimStart();
                if (name.Length == 0 || string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().TmdbApiKey)) return res;

                bool tv = false;
                TmdbItem hit = null;
                // Eerst kanaal-cache (weet meteen film vs serie).
                hit = DiscoverMediaChannel.FindCached(name, request.Year, request.Overview, out tv);
                if (hit == null && request.TmdbId > 0)
                {
                    // Trailers-kanaal of ProviderIds.Tmdb: probeer film, dan serie.
                    try
                    {
                        hit = await _tmdb.GetMovie(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                        tv = false;
                    }
                    catch (Exception ex)
                    {
                        DiscoverDiagnostics.Add("knop: TMDB film " + request.TmdbId + ": " + ex.Message);
                    }
                    if (hit == null)
                    {
                        try
                        {
                            hit = await _tmdb.GetTv(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                            tv = hit != null;
                        }
                        catch (Exception ex)
                        {
                            DiscoverDiagnostics.Add("knop: TMDB serie " + request.TmdbId + ": " + ex.Message);
                        }
                    }
                }
                if (hit == null)
                {
                    // Niet in cache: zoek op titel, eerst films, dan series.
                    hit = await FindBySearch(name, request.Year, false).ConfigureAwait(false);
                    tv = false;
                    if (hit == null)
                    {
                        hit = await FindBySearch(name, request.Year, true).ConfigureAwait(false);
                        tv = hit != null;
                    }
                }
                if (hit == null)
                {
                    DiscoverDiagnostics.Add("knop: geen TMDB-item gevonden voor '" + name + "' (" + request.Year + ")");
                    return res;
                }

                var states = await SafeStates(tv).ConfigureAwait(false);
                int status = 0;
                bool hasFiles;
                if (states.TryGetValue(hit.id, out hasFiles)) status = hasFiles ? 2 : 1;

                res.Found = true;
                res.Type = tv ? "tv" : "movie";
                res.TmdbId = hit.id;
                res.Title = TitleOf(hit, tv);
                res.Backdrop = string.IsNullOrEmpty(hit.backdrop_path) ? null : "https://image.tmdb.org/t/p/w1280" + hit.backdrop_path;
                res.Status = status;

                if (tv)
                {
                    try
                    {
                        var detail = await _tmdb.GetTvDetail(hit.id, CancellationToken.None).ConfigureAwait(false);
                        if (detail?.seasons != null)
                        {
                            res.Seasons = detail.seasons
                                .Where(s => s.season_number > 0 || s.episode_count > 0)
                                .OrderBy(s => s.season_number)
                                .Select(s => new DiscoverSeasonInfo
                                {
                                    Number = s.season_number,
                                    Name = string.IsNullOrWhiteSpace(s.name) ? "Seizoen " + s.season_number : s.name,
                                    EpisodeCount = s.episode_count
                                })
                                .ToList();
                        }
                    }
                    catch (Exception ex)
                    {
                        DiscoverDiagnostics.Add("knop: seizoenen ophalen mislukt: " + ex.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: resolve mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT knop (resolve): " + ex.Message);
            }
            return res;
        }

        // Titels vergelijken zonder hoofdletters, accenten en leestekens ("¡PIKA!" == "pika").
        private static string Norm(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var sb = new System.Text.StringBuilder();
            foreach (var c in s.Normalize(System.Text.NormalizationForm.FormD))
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) == System.Globalization.UnicodeCategory.NonSpacingMark) continue;
                if (char.IsLetterOrDigit(c)) sb.Append(char.ToLowerInvariant(c));
            }
            return sb.ToString();
        }

        private async Task<TmdbItem> FindBySearch(string name, int year, bool tv)
        {
            var list = await _tmdb.SearchTyped(name, tv, 1, CancellationToken.None).ConfigureAwait(false);
            var want = Norm(name);
            TmdbItem best = null;
            foreach (var i in list)
            {
                // De titel in de ingestelde taal (nl) kan afwijken van de Engelse titel uit Trailers: ook de originele titel testen.
                var titles = new[] { Norm(TitleOf(i, tv)), Norm(tv ? i.original_name : i.original_title), Norm(i.title), Norm(i.name) };
                if (want.Length == 0 || Array.IndexOf(titles, want) < 0) continue;
                int y = YearOf(tv ? i.first_air_date : i.release_date);
                if (year > 0 && y > 0 && Math.Abs(y - year) > 1) continue;
                if (best == null || i.popularity > best.popularity) best = i;
            }
            return best;
        }

        public async Task<object> Post(DiscoverRequestItem request)
        {
            var res = new DiscoverRequestResult();
            try
            {
                bool tv = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase);
                bool added;
                if (tv)
                {
                    var t = await _tmdb.GetTv(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                    var ext = await _tmdb.GetTvExternalIds(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                    if (ext?.tvdb_id == null)
                        throw new InvalidOperationException("Geen TVDB-id bij deze serie; Sonarr kan hem niet toevoegen.");
                    added = await _arr.AddSeries(request.TmdbId, ext.tvdb_id.Value, t.name ?? t.title, request.Seasons, CancellationToken.None).ConfigureAwait(false);
                }
                else
                {
                    var m = await _tmdb.GetMovie(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                    added = await _arr.AddMovie(request.TmdbId, m.title ?? m.name, YearOf(m.release_date), CancellationToken.None).ConfigureAwait(false);
                }

                res.Success = true;
                res.Status = 1;
                string seasonNote = "";
                if (tv && request.Seasons != null && request.Seasons.Length > 0)
                    seasonNote = " (" + DiscoverLanguage.Text("seizoen ", "season ", "Staffel ") +
                        string.Join(", ", request.Seasons.OrderBy(x => x)) + ")";
                res.Message = added
                    ? DiscoverLanguage.Text("Aangevraagd", "Requested", "Angefordert") + seasonNote
                    : DiscoverLanguage.Text("Stond al in ", "Already in ", "Bereits in ") + (tv ? "Sonarr" : "Radarr");
                _logger.Info("Discover: {0} {1} {2}", tv ? "serie" : "film", request.TmdbId, res.Message);
                DiscoverDiagnostics.Add((tv ? "serie " : "film ") + request.TmdbId + ": " + res.Message);
                DiscoverDiagnostics.CountRequest(true);
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: aanvraag mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT aanvraag (webpagina): " + ex.Message);
                DiscoverDiagnostics.CountRequest(false);
                res.Message = ex.Message;
            }
            return res;
        }

        public async Task<object> Post(DiscoverRemoveItem request)
        {
            var res = new DiscoverRequestResult();
            try
            {
                bool tv = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase);
                bool removed = tv
                    ? await _arr.RemoveSeries(request.TmdbId, request.DeleteFiles, CancellationToken.None).ConfigureAwait(false)
                    : await _arr.RemoveMovie(request.TmdbId, request.DeleteFiles, CancellationToken.None).ConfigureAwait(false);

                res.Success = true;
                res.Status = 0;
                res.Message = removed
                    ? DiscoverLanguage.Text("Verwijderd uit ", "Removed from ", "Entfernt aus ") + (tv ? "Sonarr" : "Radarr")
                    : DiscoverLanguage.Text("Stond niet meer in ", "Was no longer in ", "War nicht mehr in ") + (tv ? "Sonarr" : "Radarr");
                _logger.Info("Discover: {0} {1} {2}", tv ? "serie" : "film", request.TmdbId, res.Message);
                DiscoverDiagnostics.Add((tv ? "serie " : "film ") + request.TmdbId + ": " + res.Message);
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: verwijderen mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT verwijderen: " + ex.Message);
                res.Message = ex.Message;
            }
            return res;
        }

        // ---------- hulpjes ----------
        /// <summary>Probeert de clip nu al klaar te zetten, zodat de statuspagina een schrijfprobleem meteen toont.</summary>
        private static string ClipPathOrError(out string error)
        {
            error = null;
            try { return Plugin.Instance.EnsureClip(); }
            catch (Exception ex) { error = ex.Message; return null; }
        }

        private async Task<Dictionary<int, bool>> SafeStates(bool tv)
        {
            try
            {
                return tv ? await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false)
                          : await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: status ophalen mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT status " + (tv ? "Sonarr" : "Radarr") + ": " + ex.Message);
                return new Dictionary<int, bool>();
            }
        }

        private async Task<List<TmdbItem>> SafeList(string path)
        {
            try { return await _tmdb.GetListPages(path, 1, TmdbClient.PagesPerRow, CancellationToken.None).ConfigureAwait(false); }
            catch (Exception ex)
            {
                _logger.Error("Discover: TMDB {0} mislukt: {1}", path, ex.Message);
                DiscoverDiagnostics.Add("FOUT TMDB " + path + ": " + ex.Message);
                return new List<TmdbItem>();
            }
        }

        private static string TitleOf(TmdbItem i, bool tv) =>
            tv ? (i.name ?? i.title ?? "?") : (i.title ?? i.name ?? "?");

        private static string LocalizedSeriesStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status)) return null;
            if (DiscoverLanguage.IsDutch)
            {
                switch (status)
                {
                    case "Returning Series": return "Lopend";
                    case "Ended": return "Beëindigd";
                    case "Canceled": return "Geannuleerd";
                    case "In Production": return "In productie";
                    case "Planned": return "Gepland";
                    case "Pilot": return "Pilot";
                }
            }
            else if (DiscoverLanguage.IsGerman)
            {
                switch (status)
                {
                    case "Returning Series": return "Laufende Serie";
                    case "Ended": return "Beendet";
                    case "Canceled": return "Abgebrochen";
                    case "In Production": return "In Produktion";
                    case "Planned": return "Geplant";
                    case "Pilot": return "Pilotfolge";
                }
            }
            return status;
        }

        private static string LanguageName(string language)
        {
            if (string.IsNullOrWhiteSpace(language)) return null;
            try { return CultureInfo.GetCultureInfo(language).EnglishName; }
            catch (CultureNotFoundException) { return language.ToUpperInvariant(); }
        }

        private static string CountryNames(IEnumerable<string> countries)
        {
            if (countries == null) return null;
            var names = new List<string>();
            foreach (var country in countries.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().Take(3))
            {
                try { names.Add(new RegionInfo(country).EnglishName); }
                catch (ArgumentException) { names.Add(country.ToUpperInvariant()); }
            }
            return names.Count == 0 ? null : string.Join(", ", names);
        }

        private static DiscoverItemDto ToDto(TmdbItem i, bool tv, Dictionary<int, bool> states)
        {
            int status = 0;
            if (states != null && states.TryGetValue(i.id, out var hasFiles)) status = hasFiles ? 2 : 1;

            return new DiscoverItemDto
            {
                TmdbId = i.id,
                Type = tv ? "tv" : "movie",
                Title = tv ? (i.name ?? i.title ?? "?") : (i.title ?? i.name ?? "?"),
                Year = YearOf(tv ? i.first_air_date : i.release_date),
                Poster = string.IsNullOrEmpty(i.poster_path) ? null : "https://image.tmdb.org/t/p/w342" + i.poster_path,
                Backdrop = string.IsNullOrEmpty(i.backdrop_path) ? null : "https://image.tmdb.org/t/p/w780" + i.backdrop_path,
                Rating = i.vote_average,
                Overview = i.overview,
                Status = status
            };
        }

        private static int YearOf(string date) =>
            !string.IsNullOrEmpty(date) && date.Length >= 4 && int.TryParse(date.Substring(0, 4), out var y) ? y : 0;
    }
}
