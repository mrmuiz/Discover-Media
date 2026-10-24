using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Channels;
using MediaBrowser.Model.Channels;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.MediaInfo;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Controller.Providers;

namespace Emby.Plugins.Discover
{
    // Let op: dit is een eerste versie, nog niet gecompileerd tegen jouw SDK-versie.
    // Kleine signatuurverschillen (zie README) kun je makkelijk aanpassen.
    // IDisableMediaSourceDisplay: verbergt "Media informatie" (YouTube-pad) op de detailpagina.
    // Marked obsolete in nieuwere SDK's, maar de server respecteert het nog voor weergave.
#pragma warning disable CS0618
    public class DiscoverMediaChannel : IChannel, IHasChannelFeatures, IRequiresMediaInfoCallback, IDisableMediaSourceDisplay
    {
#pragma warning restore CS0618
        // Versioned IDs refresh only the affected channel lists without invalidating every cached list.
        private const string AskRoot = "ask16root";
        private const string AskItemPrefix = "ask16item:";   // versioned folder identity to avoid stale cached children
        private const string AskTvItemPrefix = "ask21tvitem:"; // refresh filtered series lists, not movie folders
        private const string AskSeasonFolderPrefix = "ask19seasons:"; // refresh season folder cache after label/order changes
        private const string LegacyAskSeasonFolderPrefix = "ask18seasons:"; // keep previously cached season folders working
        private const string AskListPrefix = "ask16list:";
        private const string AskGenrePrefix = "ask16genres:";   // map met genretegels (movie of tv)
        private const string AskStudioRoot = "ask16studios";       // map met studio- en netwerktegels
        internal const string AskPrefix = "ask16:";           // het aanvraagitem zelf
        internal const string AskSeasonPrefix = "ask20season:"; // seizoenaanvraagitems
        private const string TrailerPrefix = "tr10:";         // het trailer-item naast het aanvraagitem

        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly ILogger _logger;

        public DiscoverMediaChannel(ILogManager logManager, IJsonSerializer json)
        {
            _logger = logManager.GetLogger("Discover");
            _logger.Info("Discover: kanaal geladen (naam: {0})", Name);
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
        }

        // ---------- IChannel ----------
        public string Name => "Discover Media";
        public string Description => DiscoverLanguage.Text(
            "Ontdek films en series en vraag ze aan.",
            "Discover movies and series and request them.",
            "Entdecke Filme und Serien und fordere sie an.");
        public string HomePageUrl => "";

        // Ophogen als Emby oude (bewaarde) kanaalinhoud blijft tonen.
        public string DataVersion => "67";
        public ChannelParentalRating ParentalRating => ChannelParentalRating.GeneralAudience;
        public bool IsEnabledFor(string userId) => true;

        public IEnumerable<ImageType> GetSupportedChannelImages() =>
            new[] { ImageType.Primary, ImageType.Thumb };

        public Task<DynamicImageResponse> GetChannelImage(ImageType type, CancellationToken cancellationToken)
        {
            var stream = GetType().Assembly.GetManifestResourceStream(
                GetType().Namespace + ".Resources.discover.png");
            var response = new DynamicImageResponse();
            if (stream != null)
            {
                response.Stream = stream;
                response.Format = ImageFormat.Png;
            }
            return Task.FromResult(response);
        }

        public ChannelFeatures Features => new ChannelFeatures
        {
            ShowRootFoldersAtTopLevel = true
        };

        // ---------- Mappen en items ----------
        public async Task<ChannelItemResult> GetChannelItems(InternalChannelItemQuery query, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var hasKey = !string.IsNullOrWhiteSpace(cfg.TmdbApiKey);
            var folder = string.IsNullOrEmpty(query.FolderId) ? "(root)" : query.FolderId;

            DiscoverDiagnostics.CountCall();
            var tmdbLanguage = TmdbClient.Language();
            DiscoverDiagnostics.Add(string.Format("opgevraagd: map={0} start={1} limit={2} key={3} taal={4}",
                folder, query.StartIndex, query.Limit, hasKey, tmdbLanguage));
            _logger.Info("Discover: kanaal geopend, map '{0}', TMDB-key ingesteld: {1}, TMDB-taal: {2}, Radarr: {3}, Sonarr: {4}, start: {5}, limit: {6}",
                folder, hasKey, tmdbLanguage, ArrClient.RadarrConfigured, ArrClient.SonarrConfigured, query.StartIndex, query.Limit);

            var id = query.FolderId;
            // Bewust een exception en geen "bericht-item": een normaal resultaat wordt door Emby bewaard,
            // waardoor "niet ingesteld" of een tijdelijke netwerkfout blijft staan na het instellen/herstellen.
            if (!hasKey)
            {
                DiscoverDiagnostics.Add("FOUT: geen TMDB-key ingesteld");
                throw new InvalidOperationException(
                    DiscoverLanguage.Text(
                        "Discover is nog niet ingesteld: vul de TMDB API key in bij Dashboard > Plugins > Discover.",
                        "Discover is not configured: enter the TMDB API key under Dashboard > Plugins > Discover.",
                        "Discover ist noch nicht eingerichtet: Gib den TMDB-API-Schlüssel unter Dashboard > Plugins > Discover ein."));
            }

            if (string.IsNullOrEmpty(id)) return await Root(ct).ConfigureAwait(false);

            try
            {
                ChannelItemResult res = null;
                if (id == AskRoot) res = await RequestRoot(ct).ConfigureAwait(false);
                else if (id.StartsWith(AskTvItemPrefix)) { var two = await RequestItems(id.Substring(AskTvItemPrefix.Length), ct).ConfigureAwait(false); res = new ChannelItemResult { Items = two, TotalRecordCount = two.Count }; }
                else if (id.StartsWith(AskItemPrefix)) { var two = await RequestItems(id.Substring(AskItemPrefix.Length), ct).ConfigureAwait(false); res = new ChannelItemResult { Items = two, TotalRecordCount = two.Count }; }
                else if (id.StartsWith(AskSeasonFolderPrefix)) res = await RequestSeasons(id.Substring(AskSeasonFolderPrefix.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(LegacyAskSeasonFolderPrefix)) res = await RequestSeasons(id.Substring(LegacyAskSeasonFolderPrefix.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(AskGenrePrefix)) res = await GenreTiles(id.Substring(AskGenrePrefix.Length) == "tv", ct).ConfigureAwait(false);
                else if (id == AskStudioRoot) res = await StudioTiles(ct).ConfigureAwait(false);
                else if (id.StartsWith(AskListPrefix)) res = await GetList(id.Substring(AskListPrefix.Length), query, ct, true).ConfigureAwait(false);
                else if (id.StartsWith("list:")) res = await GetList(id.Substring(5), query, ct, false).ConfigureAwait(false);

                if (res != null)
                {
                    DiscoverDiagnostics.Add(string.Format("teruggegeven: map={0} items={1} totaal={2}",
                        id, res.Items == null ? 0 : res.Items.Count(), res.TotalRecordCount));
                    return res;
                }
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: laden mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT bij map " + id + ": " + ex.Message);
                throw;
            }
            DiscoverDiagnostics.Add("onbekende map, leeg teruggegeven: " + id);
            return new ChannelItemResult { Items = new List<ChannelItemInfo>(), TotalRecordCount = 0 };
        }

        private static ChannelItemResult Single(ChannelItemInfo item) =>
            new ChannelItemResult { Items = new List<ChannelItemInfo> { item }, TotalRecordCount = 1 };

        private static ChannelItemInfo Folder(string id, string name, string image, string overview) =>
            new ChannelItemInfo
            {
                Id = id,
                Name = name,
                Type = ChannelItemType.Folder,
                FolderType = ChannelFolderType.Container,
                ImageUrl = image,
                Overview = overview
            };

        // Hoofdniveau: direct de zes lijsten (elke titel daarin heeft Trailer + Aanvragen), geen tussenmap.
        private Task<ChannelItemResult> Root(CancellationToken ct) => RequestRoot(ct);

        // Binnen de titelmap: een los video-item dat bij Afspelen de aanvraag doet. Met de titel in de naam,
        // zodat je op de TV ziet waarvoor je drukt.
        private async Task<List<ChannelItemInfo>> RequestItems(string rest, CancellationToken ct)
        {
            bool tv = rest.StartsWith("t:");
            int tmdbId;
            if (rest.Length < 3 || !int.TryParse(rest.Substring(2), out tmdbId))
                throw new InvalidOperationException("Onbekend aanvraagitem: " + rest);

            // Eerst de al geladen lijst (geen extra TMDB-call), anders de details bij TMDB.
            TmdbItem t = FindInCache(tv, tmdbId);
            if (t == null)
            {
                try
                {
                    t = tv ? await _tmdb.GetTv(tmdbId, ct).ConfigureAwait(false)
                           : await _tmdb.GetMovie(tmdbId, ct).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("titel voor aanvraag-item " + rest + " mislukt: " + ex.Message);
                }
            }
            // Bewust een exception en geen leeg item: Emby bewaart een normaal resultaat, en dan blijft
            // "Aanvragen" zonder poster en info staan, ook als TMDB daarna weer werkt.
            if (t == null)
                throw new InvalidOperationException("Titelgegevens van TMDB niet beschikbaar voor " + rest + "; probeer het zo opnieuw.");

            string title = TitleOf(t, tv);
            string arr = tv ? "Sonarr" : "Radarr";

            // Status (Radarr/Sonarr) en extra info (TMDB) tegelijk ophalen; mislukt de extra info, dan blijft het bij de basis.
            var statesTask = SafeStates(tv, ct);
            var extraTask = SafeExtra(tv, tmdbId, ct);
            var states = await statesTask.ConfigureAwait(false);
            TmdbExtra extra = await extraTask.ConfigureAwait(false);
            int status = 0;
            bool hasFiles;
            if (states.TryGetValue(tmdbId, out hasFiles)) status = hasFiles ? 2 : 1;

            var infoLines = InfoText.Lines(t, extra, tv, false);
            string info = infoLines.Count > 0 ? string.Join("\n", infoLines) : null;

            // De bevestigingskaart alvast maken (op de achtergrond), zodat Afspelen later niet hoeft te wachten op ffmpeg.
            if (extra != null) PrewarmCard(t, extra, tv, status != 0);

            string action;
            if (status == 2 && tv && ArrClient.IsPartial(tmdbId))
                action = DiscoverLanguage.Text("\u2713 Gedeeltelijk beschikbaar: een deel van de afleveringen staat al in je bibliotheek.",
                    "\u2713 Partially available: some episodes are already in your library.",
                    "\u2713 Teilweise verfügbar: Einige Folgen befinden sich bereits in deiner Bibliothek.");
            else if (status == 2)
                action = DiscoverLanguage.Text("\u2713 Deze titel is al beschikbaar in je bibliotheek.",
                    "\u2713 This title is already available in your library.",
                    "\u2713 Dieser Titel ist bereits in deiner Bibliothek verfügbar.");
            else if (status == 1)
                action = DiscoverLanguage.Text("\u23F3 Deze titel is al aangevraagd en staat in " + arr + ".",
                    "\u23F3 This title has already been requested from " + arr + ".",
                    "\u23F3 Dieser Titel wurde bereits bei " + arr + " angefordert.");
            else
                action = DiscoverLanguage.Text("DRUK OP DE \u25B6 KNOP OM AAN TE VRAGEN.",
                    "PRESS THE \u25B6 BUTTON TO REQUEST.",
                    "DRÜCKE AUF DIE \u25B6-TASTE, UM DEN TITEL ANZUFORDERN.");

            var date = tv ? t.first_air_date : t.release_date;
            var y = YearOf(date);
            var genres = GenresOf(t, tv);

            var overview = new System.Text.StringBuilder();
            overview.Append(action);
            if (info != null) overview.Append("\n").Append(info);
            if (!string.IsNullOrWhiteSpace(t.overview)) overview.Append("\n\n").Append(t.overview.Trim());

            var item = new ChannelItemInfo
            {
                Id = AskPrefix + rest,
                Name = DiscoverLanguage.Text("Aanvragen: ", "Request: ", "Anfragen: ") + title,
                Type = ChannelItemType.Media,
                MediaType = ChannelMediaType.Video,
                ContentType = ChannelMediaContentType.Clip,
                // Het item wordt als liggende (16:9) tegel getoond; een staande poster wordt daar afgesneden.
                ImageUrl = !string.IsNullOrEmpty(t.backdrop_path)
                    ? "https://image.tmdb.org/t/p/w780" + t.backdrop_path
                    : TmdbClient.PosterUrl(t.poster_path),
                Overview = overview.ToString(),
                ProviderIds = new ProviderIdDictionary { { "Tmdb", tmdbId.ToString() } }
            };
            if (y.HasValue) item.ProductionYear = y;
            if (t.vote_average > 0) item.CommunityRating = (float)t.vote_average;
            if (genres.Count > 0) item.Genres = genres;
            DateTime dt;
            if (!string.IsNullOrEmpty(date) &&
                DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out dt))
                item.PremiereDate = new DateTimeOffset(dt, TimeSpan.Zero);

            // Naast "Aanvragen" ook de trailer, zodat je op de TV eerst kunt kijken en dan aanvragen.
            var trailer = new ChannelItemInfo
            {
                Id = TrailerPrefix + rest,
                Name = DiscoverLanguage.Text("Trailer: ", "Trailer: ", "Trailer: ") + title,
                Type = ChannelItemType.Media,
                MediaType = ChannelMediaType.Video,
                ContentType = ChannelMediaContentType.Clip,
                ImageUrl = item.ImageUrl,
                Overview = DiscoverLanguage.Text("Druk op de \u25B6 knop om de trailer te bekijken.",
                    "Press the \u25B6 button to watch the trailer.",
                    "Drücke auf die \u25B6-Taste, um den Trailer anzusehen.")
                           + (info == null ? "" : "\n\n" + info)
                           + (string.IsNullOrWhiteSpace(t.overview) ? "" : "\n\n" + t.overview.Trim()),
                ProviderIds = item.ProviderIds,
                ProductionYear = item.ProductionYear,
                CommunityRating = item.CommunityRating,
                PremiereDate = item.PremiereDate
            };
            if (genres.Count > 0) trailer.Genres = genres;
            if (tv)
            {
                // The Aanvragen: <series> folder is the season selector; do not add a whole-series request tile.
                return new List<ChannelItemInfo>
                {
                    trailer,
                    Folder(AskSeasonFolderPrefix + rest,
                    DiscoverLanguage.Text("Aanvragen: ", "Request: ", "Anfragen: ") + title,
                    item.ImageUrl,
                    DiscoverLanguage.Text("Kies een seizoen om alleen dat seizoen aan te vragen.",
                        "Choose a season to request only that season.",
                        "Wähle eine Staffel aus, um nur diese anzufordern."))
                };
            }
            return new List<ChannelItemInfo> { trailer, item };
        }

        private async Task<ChannelItemResult> RequestSeasons(string rest, CancellationToken ct)
        {
            var parts = rest.Split(':');
            int tmdbId;
            if (parts.Length != 2 || parts[0] != "t" || !int.TryParse(parts[1], out tmdbId))
                throw new InvalidOperationException("Onbekend serie-id voor seizoenskeuze: " + rest);

            var detail = await _tmdb.GetTvDetail(tmdbId, ct).ConfigureAwait(false);
            if (detail == null || detail.seasons == null)
                throw new InvalidOperationException("Seizoenen van TMDB niet beschikbaar voor serie " + tmdbId);

            var seasons = detail.seasons
                .Where(s => s != null && s.season_number > 0)
                .GroupBy(s => s.season_number)
                .Select(g => g.First())
                .OrderBy(s => s.season_number)
                .ToList();
            var sonarrSeasons = new Dictionary<int, SonarrSeasonDto>();
            if (ArrClient.SonarrConfigured)
            {
                try { sonarrSeasons = await _arr.GetSeasonStates(tmdbId, ct).ConfigureAwait(false); }
                catch (Exception ex)
                {
                    DiscoverDiagnostics.Add("seizoensstatus uit Sonarr ophalen mislukt voor " + tmdbId + ": " + ex.Message);
                }
            }
            string background = !string.IsNullOrEmpty(detail.backdrop_path)
                ? "https://image.tmdb.org/t/p/w780" + detail.backdrop_path
                : TmdbClient.PosterUrl(detail.poster_path);
            var items = new List<ChannelItemInfo>();
            for (int i = 0; i < seasons.Count; i++)
            {
                var season = seasons[i];
                var seasonNumber = season.season_number;
                SonarrSeasonDto sonarrSeason;
                bool hasSonarrSeason = sonarrSeasons.TryGetValue(seasonNumber, out sonarrSeason);
                bool hasFiles = hasSonarrSeason && sonarrSeason.statistics != null &&
                    sonarrSeason.statistics.episodeFileCount > 0;
                bool showHourglass = hasSonarrSeason && (sonarrSeason.monitored || hasFiles);
                if (showHourglass && string.IsNullOrWhiteSpace(season.overview))
                {
                    try
                    {
                        var fullSeason = await _tmdb.GetTvSeasonDetail(tmdbId, seasonNumber, ct).ConfigureAwait(false);
                        if (!string.IsNullOrWhiteSpace(fullSeason?.overview)) season.overview = fullSeason.overview;
                    }
                    catch (Exception ex)
                    {
                        if (ex is OperationCanceledException) throw;
                        DiscoverDiagnostics.Add("seizoensbeschrijving ophalen mislukt voor " + tmdbId +
                            "/seizoen " + seasonNumber + ": " + ex.Message);
                    }
                }
                // De seizoenslijst van de serie mist soms een poster die het seizoen zelf wel heeft: dan het seizoen rechtstreeks opvragen.
                if (string.IsNullOrWhiteSpace(season.poster_path))
                {
                    try
                    {
                        var seasonPoster = await _tmdb.GetSeasonPosterPath(tmdbId, seasonNumber, ct).ConfigureAwait(false);
                        if (!string.IsNullOrWhiteSpace(seasonPoster)) season.poster_path = seasonPoster;
                        else DiscoverDiagnostics.Add("geen seizoensposter bij TMDB voor " + tmdbId + "/seizoen " + seasonNumber + " (serieposter gebruikt)");
                    }
                    catch (Exception ex)
                    {
                        if (ex is OperationCanceledException) throw;
                        DiscoverDiagnostics.Add("seizoensposter ophalen mislukt voor " + tmdbId + "/seizoen " + seasonNumber + ": " + ex.Message);
                    }
                }
                // Seizoenstegels zijn staand (2:3): is er echt geen seizoensposter, dan de serieposter, pas daarna de liggende achtergrond.
                var image = !string.IsNullOrEmpty(season.poster_path)
                    ? TmdbClient.PosterUrl(season.poster_path)
                    : (!string.IsNullOrEmpty(detail.poster_path) ? TmdbClient.PosterUrl(detail.poster_path) : background);
                var countText = season.episode_count > 0
                    ? DiscoverLanguage.Text(
                        season.episode_count == 1 ? "1 aflevering" : season.episode_count + " afleveringen",
                        season.episode_count == 1 ? "1 episode" : season.episode_count + " episodes",
                        season.episode_count == 1 ? "1 Folge" : season.episode_count + " Folgen")
                    : null;
                var overview = DiscoverLanguage.Text(
                    "Druk op \u25B6 om alleen seizoen " + seasonNumber + " aan te vragen.",
                    "Press \u25B6 to request season " + seasonNumber + " only.",
                    "Drücke auf \u25B6, um nur Staffel " + seasonNumber + " anzufordern.");
                if (!string.IsNullOrWhiteSpace(countText)) overview += "\n" + countText + ".";
                if (!string.IsNullOrWhiteSpace(season.overview)) overview += "\n\n" + season.overview.Trim();

                var displayName = DiscoverLanguage.Text("Seizoen ", "Season ", "Staffel ") +
                    seasonNumber.ToString(CultureInfo.InvariantCulture);
                if (showHourglass) displayName += " \u23F3";

                items.Add(new ChannelItemInfo
                {
                    Id = AskSeasonPrefix + "t:" + tmdbId + ":s:" + seasonNumber,
                    Name = displayName,
                    Type = ChannelItemType.Media,
                    MediaType = ChannelMediaType.Video,
                    ContentType = ChannelMediaContentType.Clip,
                    // Media items need a client-fetchable URL; local generated file paths leave blank tiles here.
                    ImageUrl = image,
                    Overview = overview,
                    ProviderIds = new ProviderIdDictionary { { "Tmdb", tmdbId.ToString() } },
                    IndexNumber = seasonNumber,
                    ForceUpdate = true
                });
            }

            if (items.Count == 0)
                throw new InvalidOperationException("TMDB heeft geen aanvraagbare seizoenen voor serie " + tmdbId);

            return new ChannelItemResult { Items = items, TotalRecordCount = items.Count };
        }

        private async Task<TmdbExtra> SafeExtra(bool tv, int tmdbId, CancellationToken ct)
        {
            try { return await _tmdb.GetExtraCached(tv, tmdbId, ct).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("extra info " + tmdbId + " mislukt: " + ex.Message);
                return null;
            }
        }

        private static void PrewarmCard(TmdbItem t, TmdbExtra extra, bool tv, bool alreadyThere)
        {
            Task.Run(async () =>
            {
                try { await RequestCard.Create(t, extra, tv, alreadyThere, CancellationToken.None).ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("kaart vooraf maken mislukt: " + ex.Message); }
            });
        }

        /// <summary>Zoekt een titel in de bewaarde TMDB-lijsten (zonder netwerkcall).</summary>
        private static TmdbItem FindInCache(bool tv, int id)
        {
            lock (ListCache)
            {
                foreach (var kv in ListCache)
                {
                    if (kv.Key.EndsWith("_tv") != tv) continue;
                    foreach (var i in kv.Value.Value)
                        if (i.id == id) return i;
                }
            }
            return null;
        }

        private sealed class TileSpec
        {
            public readonly string Id, Caption, Color, Backdrop;
            public TileSpec(string id, string caption, string color, string backdrop)
            { Id = id; Caption = caption; Color = color; Backdrop = backdrop; }
        }

        // Artwork is optional and must not hold up Emby's channel refresh.
        private async Task<ChannelItemResult> RequestRoot(CancellationToken ct)
        {
            string[] paths =
            {
                "/trending/movie/week", "/movie/popular", "/movie/upcoming",
                "/trending/tv/week", "/tv/popular", "/tv/upcoming"
            };
            List<string>[] tops;
            var topTask = Task.WhenAll(paths.Select(x => TopBackdrops(x, CancellationToken.None)));
            var topWait = await Task.WhenAny(topTask, Task.Delay(TimeSpan.FromSeconds(5))).ConfigureAwait(false);
            if (topWait == topTask)
            {
                try { tops = await topTask.ConfigureAwait(false); }
                catch (Exception ex)
                {
                    DiscoverDiagnostics.Add("achtergrondlijst ophalen mislukt: " + ex.Message);
                    tops = paths.Select(x => new List<string>()).ToArray();
                }
            }
            else
            {
                DiscoverDiagnostics.Add("root-artwork na 5 seconden uitgesteld; kanaal wordt direct teruggegeven");
                _ = ObserveTopBackdrops(topTask);
                tops = paths.Select(x => new List<string>()).ToArray();
            }

            // Elke map een andere achtergrond: eerst vanaf plek 3 zoeken (de bovenste titels komen in meer lijsten voor).
            var used = new HashSet<string>();
            Func<int, int, string> pick = (listIndex, start) =>
            {
                var l = tops[listIndex];
                if (l.Count == 0) return null;
                for (int k = 0; k < l.Count; k++)
                {
                    var c = l[(start + k) % l.Count];
                    if (used.Add(c)) return c;
                }
                return l[start % l.Count];
            };

            // Use the same localized captions on the artwork and below each tile.
            // Keep the existing pick() order so tiles still use distinct titles.
            var specs = new[]
            {
                new TileSpec(AskListPrefix + "trending_movie", DiscoverLanguage.Text("Trending films", "Trending Movies", "Aktuelle Filme"), "orange", pick(0, 3)),
                new TileSpec(AskListPrefix + "popular_movie", DiscoverLanguage.Text("Populaire films", "Popular Movies", "Beliebte Filme"), "red", pick(1, 3)),
                new TileSpec(AskListPrefix + "upcoming_movie", DiscoverLanguage.Text("Verwachte films", "Upcoming Movies", "Kommende Filme"), "purple", pick(2, 3)),
                new TileSpec(AskGenrePrefix + "movie", DiscoverLanguage.Text("Filmgenres", "Movie Genres", "Filmgenres"), "green", pick(1, 8)),
                new TileSpec(AskListPrefix + "trending_tv", DiscoverLanguage.Text("Trending series", "Trending Series", "Aktuelle Serien"), "yellow", pick(3, 3)),
                new TileSpec(AskListPrefix + "popular_tv", DiscoverLanguage.Text("Populaire series", "Popular Series", "Beliebte Serien"), "pink", pick(4, 3)),
                new TileSpec(AskListPrefix + "upcoming_tv", DiscoverLanguage.Text("Verwachte series", "Upcoming Series", "Kommende Serien"), "blue", pick(5, 3)),
                new TileSpec(AskGenrePrefix + "tv", DiscoverLanguage.Text("Seriegenres", "Series Genres", "Seriengenres"), "lightgreen", pick(4, 8)),
                new TileSpec(AskStudioRoot, DiscoverLanguage.Text("Studio's", "Studios", "Studios"), "black", pick(0, 8))
            };

            // Start every tile together, then allow one shared time budget for the text artwork.
            var creationOrder = specs
                .OrderBy(spec => spec.Id == AskListPrefix + "trending_movie" ? 0 :
                    spec.Id == AskStudioRoot ? 1 : 2)
                .ToArray();
            var creations = creationOrder.Select(spec => FolderTile.Create(
                spec.Id.Replace(":", "-"), spec.Caption, DuotoneUrl(spec.Color, spec.Backdrop),
                CancellationToken.None, ColorTones[spec.Color][0])).ToArray();
            var files = new Dictionary<string, string>();
            var deadline = DateTime.UtcNow.AddSeconds(10);
            for (int i = 0; i < creations.Length; i++)
            {
                var remaining = deadline - DateTime.UtcNow;
                if (remaining > TimeSpan.Zero)
                    await Task.WhenAny(creations[i], Task.Delay(remaining)).ConfigureAwait(false);

                if (creations[i].IsCompleted)
                {
                    try { files[creationOrder[i].Id] = await creations[i].ConfigureAwait(false); }
                    catch (Exception ex) { DiscoverDiagnostics.Add("tegelafbeelding '" + creationOrder[i].Caption + "' mislukt: " + ex.Message); }
                }
                else
                {
                    _ = ObserveTileCreation(creations[i], creationOrder[i].Caption);
                }
            }

            // Return series folders first so Emby starts fetching them before movie lists during a channel refresh.
            // Keep the IDs and DataVersion unchanged so this display-order change does not invalidate all cached lists.
            var displayOrder = specs
                .OrderBy(spec =>
                    spec.Id == AskListPrefix + "trending_tv" ||
                    spec.Id == AskListPrefix + "popular_tv" ||
                    spec.Id == AskListPrefix + "upcoming_tv" ||
                    spec.Id == AskGenrePrefix + "tv" ? 0 :
                    spec.Id == AskStudioRoot ? 2 : 1)
                .ToArray();

            var items = new List<ChannelItemInfo>();
            for (int i = 0; i < displayOrder.Length; i++)
            {
                var sp = displayOrder[i];
                string file;
                files.TryGetValue(sp.Id, out file);
                var folder = Folder(sp.Id, sp.Caption, file ?? DuotoneUrl(sp.Color, sp.Backdrop), null);
                folder.ForceUpdate = true;
                items.Add(folder);
            }
            return new ChannelItemResult { Items = items, TotalRecordCount = items.Count };
        }

        private static async Task ObserveTileCreation(Task<string> creation, string text)
        {
            try { await creation.ConfigureAwait(false); }
            catch (Exception ex) { DiscoverDiagnostics.Add("tegelafbeelding '" + text + "' mislukt: " + ex.Message); }
        }

        private static async Task ObserveTopBackdrops(Task<List<string>[]> loading)
        {
            try { await loading.ConfigureAwait(false); }
            catch (Exception ex) { DiscoverDiagnostics.Add("achtergrondlijst ophalen mislukt: " + ex.Message); }
        }

        // ---------- genre-, studio- en netwerktegels (zoals Seerr) ----------
        // Kleuren per genre-id: dezelfde als Seerr (genreColorMap), als duotone-filter op de achtergrondafbeelding.
        private static readonly Dictionary<string, string[]> ColorTones = new Dictionary<string, string[]>
        {
            { "red", new[] { "991B1B", "FCA5A5" } }, { "darkred", new[] { "1F2937", "F87171" } },
            { "blue", new[] { "032541", "01b4e4" } }, { "lightblue", new[] { "1F2937", "60A5FA" } },
            { "darkblue", new[] { "1F2937", "2864d2" } }, { "orange", new[] { "92400E", "FCD34D" } },
            { "lightgreen", new[] { "065F46", "6EE7B7" } }, { "green", new[] { "087d29", "21cb51" } },
            { "purple", new[] { "5B21B6", "C4B5FD" } }, { "yellow", new[] { "777e0d", "e4ed55" } },
            { "darkorange", new[] { "552c01", "d47c1d" } }, { "black", new[] { "1F2937", "D1D5DB" } },
            { "pink", new[] { "9D174D", "F9A8D4" } }, { "darkpurple", new[] { "480c8b", "a96bef" } }
        };

        private static readonly Dictionary<int, string> GenreColor = new Dictionary<int, string>
        {
            { 0, "black" }, { 28, "red" }, { 12, "blue" }, { 16, "orange" }, { 35, "lightgreen" }, { 80, "darkblue" },
            { 99, "green" }, { 18, "purple" }, { 10751, "yellow" }, { 14, "darkorange" }, { 36, "green" }, { 27, "black" },
            { 10402, "blue" }, { 9648, "purple" }, { 10749, "pink" }, { 878, "lightblue" }, { 10770, "red" },
            { 53, "darkpurple" }, { 10752, "darkred" }, { 37, "orange" }, { 10759, "blue" }, { 10762, "blue" },
            { 10764, "red" }, { 10765, "lightblue" }, { 10766, "darkpurple" }, { 10767, "lightgreen" }, { 10768, "darkred" }
        };

        private static readonly Dictionary<string, KeyValuePair<DateTime, string>> GenreBackdropCache =
            new Dictionary<string, KeyValuePair<DateTime, string>>();

        private static string DuotoneUrl(string colorName, string backdrop)
        {
            if (string.IsNullOrEmpty(backdrop)) return null;
            var c = ColorTones[colorName];
            return "https://www.themoviedb.org/t/p/w1280_filter(duotone," + c[0] + "," + c[1] + ")" + backdrop;
        }

        private static string GenreImageUrl(int genreId, string backdrop)
        {
            string name;
            if (!GenreColor.TryGetValue(genreId, out name)) name = GenreColor[0];
            return DuotoneUrl(name, backdrop);
        }

        private static string GenreFallbackColor(int genreId)
        {
            string name;
            if (!GenreColor.TryGetValue(genreId, out name)) name = GenreColor[0];
            return ColorTones[name][0];
        }

        // Achtergronden van de bovenste titels van een lijst (voor de plaatjes van de hoofdmappen); 6 uur bewaard.
        private static readonly Dictionary<string, KeyValuePair<DateTime, List<string>>> TopBackdropCache =
            new Dictionary<string, KeyValuePair<DateTime, List<string>>>();

        private async Task<List<string>> TopBackdrops(string path, CancellationToken ct)
        {
            var cacheKey = TmdbClient.Language() + "|" + path;
            lock (TopBackdropCache)
            {
                KeyValuePair<DateTime, List<string>> hit;
                if (TopBackdropCache.TryGetValue(cacheKey, out hit) && DateTime.UtcNow - hit.Key < TimeSpan.FromHours(6)) return hit.Value;
            }
            try
            {
                var page = await _tmdb.GetList(path, 1, ct).ConfigureAwait(false);
                var list = (page == null || page.results == null)
                    ? new List<string>()
                    : page.results.Where(x => !x.adult && !string.IsNullOrEmpty(x.backdrop_path)).Select(x => x.backdrop_path).ToList();
                if (list.Count > 0)
                    lock (TopBackdropCache) { TopBackdropCache[cacheKey] = new KeyValuePair<DateTime, List<string>>(DateTime.UtcNow, list); }
                return list;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("achtergronden " + path + " mislukt: " + ex.Message);
                return new List<string>();
            }
        }

        // Zoals Seerr: de vijfde achtergrond uit de populairste titels van dat genre.
        private async Task<string> GenreBackdrop(bool tv, int genreId, CancellationToken ct)
        {
            var key = TmdbClient.Language() + "|" + (tv ? "t" : "m") + genreId;
            lock (GenreBackdropCache)
            {
                KeyValuePair<DateTime, string> hit;
                if (GenreBackdropCache.TryGetValue(key, out hit) && DateTime.UtcNow - hit.Key < TimeSpan.FromHours(12)) return hit.Value;
            }
            string chosen = null;
            try
            {
                var items = await _tmdb.BrowsePages(tv, "&with_genres=" + genreId, 1, 1, ct).ConfigureAwait(false);
                var backs = items.Where(x => !string.IsNullOrEmpty(x.backdrop_path)).Select(x => x.backdrop_path).ToList();
                if (backs.Count > 0) chosen = backs.Count > 4 ? backs[4] : backs[backs.Count - 1];
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("genre-achtergrond " + key + " mislukt: " + ex.Message);
                return null;
            }
            lock (GenreBackdropCache) { GenreBackdropCache[key] = new KeyValuePair<DateTime, string>(DateTime.UtcNow, chosen); }
            return chosen;
        }

        private async Task<ChannelItemResult> GenreTiles(bool tv, CancellationToken ct)
        {
            var genres = await _tmdb.GetGenres(tv, ct).ConfigureAwait(false);
            var names = genres.Select(genre => LocalizedGenreName(genre.id, tv, genre.name)).ToArray();
            var backs = await Task.WhenAll(genres.Select(g => GenreBackdrop(tv, g.id, ct))).ConfigureAwait(false);
            var imageUrls = genres.Select((genre, i) => GenreImageUrl(genre.id, backs[i])).ToArray();
            var creations = genres.Select((genre, i) => FolderTile.Create(
                "genre-" + (tv ? "tv-" : "movie-") + genre.id,
                names[i],
                imageUrls[i],
                CancellationToken.None,
                GenreFallbackColor(genre.id))).ToArray();
            var files = new string[genres.Count];
            for (int i = 0; i < creations.Length; i++)
            {
                try { files[i] = await creations[i].ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("genretegel '" + names[i] + "' mislukt: " + ex.Message); }
            }

            var items = new List<ChannelItemInfo>();
            for (int i = 0; i < genres.Count; i++)
            {
                var folder = Folder(AskListPrefix + (tv ? "gt_" : "gm_") + genres[i].id, names[i],
                                    files[i] ?? imageUrls[i], null);
                folder.ForceUpdate = true;
                items.Add(folder);
            }
            items = items.OrderBy(x => x.Name, StringComparer.CurrentCultureIgnoreCase).ToList();
            return new ChannelItemResult { Items = items, TotalRecordCount = items.Count };
        }

        // Logo's zijn wit zodat ze bij de donkere kanaalstijl passen.
        private static string LogoImageUrl(string logoPath) =>
            string.IsNullOrEmpty(logoPath) ? null
                : "https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,ffffff)" + logoPath;

        private async Task<ChannelItemResult> StudioTiles(CancellationToken ct)
        {
            var studios = DiscoverApiService.Studios;
            var networks = DiscoverApiService.Networks;
            var sLogos = await Task.WhenAll(studios.Select(x => _tmdb.GetLogo(false, x.Key, ct))).ConfigureAwait(false);
            var nLogos = await Task.WhenAll(networks.Select(x => _tmdb.GetLogo(true, x.Key, ct))).ConfigureAwait(false);
            var sUrls = sLogos.Select(LogoImageUrl).ToArray();
            var nUrls = nLogos.Select(LogoImageUrl).ToArray();

            // Elk logo midden in een liggend, doorzichtig plaatje (niets afgesneden); lukt dat niet, dan het logo zelf.
            var sFiles = await Task.WhenAll(studios.Select((x, i) => FolderTile.CreateLogo("s" + x.Key, sUrls[i], x.Value, ct))).ConfigureAwait(false);
            var nFiles = await Task.WhenAll(networks.Select((x, i) => FolderTile.CreateLogo("n" + x.Key, nUrls[i], x.Value, ct))).ConfigureAwait(false);

            var items = new List<ChannelItemInfo>();
            for (int i = 0; i < studios.Length; i++)
            {
                var folder = Folder(AskListPrefix + "s_" + studios[i].Key, studios[i].Value, sFiles[i] ?? sUrls[i], null);
                folder.ForceUpdate = true;
                items.Add(folder);
            }
            for (int i = 0; i < networks.Length; i++)
            {
                var folder = Folder(AskListPrefix + "n_" + networks[i].Key, networks[i].Value, nFiles[i] ?? nUrls[i], null);
                folder.ForceUpdate = true;
                items.Add(folder);
            }
            return new ChannelItemResult { Items = items, TotalRecordCount = items.Count };
        }

        // Zoals het Emby Trailers-kanaal: geen paginering naar Emby toe. We geven de hele lijst in een keer
        // terug (tot ChannelPages x 20 titels), houden ons aan de gevraagde sortering en laten Emby zelf pagineren.
        private const int ChannelPages = 10;
        private static readonly TimeSpan ListCacheTtl = TimeSpan.FromMinutes(30);
        private static readonly Dictionary<string, KeyValuePair<DateTime, List<TmdbItem>>> ListCache =
            new Dictionary<string, KeyValuePair<DateTime, List<TmdbItem>>>();

        private async Task<List<TmdbItem>> GetCachedList(string key, string path, CancellationToken ct, bool tv = false, string filter = null)
        {
            var cacheKey = TmdbClient.Language() + "|" + key;
            lock (ListCache)
            {
                KeyValuePair<DateTime, List<TmdbItem>> hit;
                if (ListCache.TryGetValue(cacheKey, out hit) && DateTime.UtcNow - hit.Key < ListCacheTtl) return hit.Value;
            }
            List<TmdbItem> list;
            try
            {
                list = filter != null
                    ? await _tmdb.BrowsePages(tv, filter, 1, ChannelPages, ct).ConfigureAwait(false)
                    : await _tmdb.GetListPages(path, 1, ChannelPages, ct).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT TMDB " + path + ": " + ex.Message);
                throw;
            }
            lock (ListCache) { ListCache[cacheKey] = new KeyValuePair<DateTime, List<TmdbItem>>(DateTime.UtcNow, list); }
            return list;
        }

        private async Task<ChannelItemResult> GetList(string key, InternalChannelItemQuery q, CancellationToken ct, bool request)
        {
            string path = null; bool tv = false; string filter = null;
            int browseId = 0;
            if (key.StartsWith("gm_") && int.TryParse(key.Substring(3), out browseId)) { tv = false; filter = "&with_genres=" + browseId; }
            else if (key.StartsWith("gt_") && int.TryParse(key.Substring(3), out browseId)) { tv = true; filter = "&with_genres=" + browseId; }
            else if (key.StartsWith("s_") && int.TryParse(key.Substring(2), out browseId)) { tv = false; filter = "&with_companies=" + browseId; }
            else if (key.StartsWith("n_") && int.TryParse(key.Substring(2), out browseId)) { tv = true; filter = "&with_networks=" + browseId; }
            else
            switch (key)
            {
                case "trending_movie": path = "/trending/movie/week"; tv = false; break;
                case "popular_movie": path = "/movie/popular"; tv = false; break;
                case "upcoming_movie": path = "/movie/upcoming"; tv = false; break;
                case "trending_tv": path = "/trending/tv/week"; tv = true; break;
                case "popular_tv": path = "/tv/popular"; tv = true; break;
                case "upcoming_tv": path = "/tv/upcoming"; tv = true; break;
                default: return new ChannelItemResult { Items = new List<ChannelItemInfo>(), TotalRecordCount = 0 };
            }

            // Lijst en Radarr/Sonarr-status tegelijk ophalen (SafeStates geeft bij een fout gewoon een lege lijst).
            var allTask = GetCachedList(key, path, ct, tv, filter);
            var statesTask = SafeStates(tv, ct);
            var all = await allTask.ConfigureAwait(false);
            var states = await statesTask.ConfigureAwait(false);

            var titles = new Dictionary<string, string>();
            var items = new List<ChannelItemInfo>();
            int rank = 0;
            var now = DateTimeOffset.UtcNow;
            var candidates = all.Where(i => !tv || TmdbClient.IsDutchOrUsTv(i)).ToList();
            foreach (var i in candidates)
            {
                if (i.adult || string.IsNullOrEmpty(i.poster_path)) continue;
                rank++;
                string clean = TitleOf(i, tv);
                string prefix = states.TryGetValue(i.id, out var hasFiles) ? (hasFiles ? "\u2713 " : "\u23F3 ") : "";
                // Zoals bij het Trailers-kanaal: de titel zelf is het item (geen map). Klik je erop, dan opent
                // de detailpagina; het ingebedde Emby-pluginresource-script voegt daar de knop "Aanvragen" toe.
                var f = new ChannelItemInfo
                {
                    Id = (request ? (tv ? AskTvItemPrefix : AskItemPrefix) : "") + (tv ? "t:" : "m:") + i.id,
                    Name = prefix + clean,
                    Type = request ? ChannelItemType.Folder : ChannelItemType.Media,
                    MediaType = ChannelMediaType.Video,
                    ContentType = ChannelMediaContentType.Trailer,
                    ImageUrl = TmdbClient.PosterUrl(i.poster_path),
                    Overview = WithDate(i, tv),
                    ProviderIds = new ProviderIdDictionary { { "Tmdb", i.id.ToString() } }
                };
                if (request)
                {
                    f.FolderType = ChannelFolderType.Container;
                    f.ForceUpdate = tv;
                }
                var genres = GenresOf(i, tv);
                if (genres.Count > 0) f.Genres = genres;
                var date = tv ? i.first_air_date : i.release_date;
                f.ProductionYear = YearOf(date);
                if (i.vote_average > 0) f.CommunityRating = (float)i.vote_average;
                DateTime dt;
                if (!string.IsNullOrEmpty(date) &&
                    DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out dt))
                    f.PremiereDate = new DateTimeOffset(dt, TimeSpan.Zero);
                // "Datum toegevoegd" = volgorde van TMDB (populairste eerst), zodat die sortering die volgorde geeft.
                f.DateCreated = now.AddMinutes(-rank);
                titles[f.Id] = clean;
                items.Add(f);
            }

            // Sortering die Emby vraagt (Naam, Datum, Beoordeling, ...). Zonder voorkeur: TMDB-volgorde.
            string sort = q.SortBy.HasValue ? q.SortBy.Value.ToString() : null;
            bool desc = q.SortDescending;
            IEnumerable<ChannelItemInfo> ordered = items;
            switch (sort)
            {
                case "Name":
                    ordered = desc ? items.OrderByDescending(x => titles[x.Id], StringComparer.CurrentCultureIgnoreCase)
                                   : items.OrderBy(x => titles[x.Id], StringComparer.CurrentCultureIgnoreCase);
                    break;
                case "CommunityRating":
                    ordered = desc ? items.OrderByDescending(x => x.CommunityRating ?? 0f)
                                   : items.OrderBy(x => x.CommunityRating ?? 0f);
                    break;
                case "PremiereDate":
                    ordered = desc ? items.OrderByDescending(x => x.PremiereDate ?? DateTimeOffset.MinValue)
                                   : items.OrderBy(x => x.PremiereDate ?? DateTimeOffset.MinValue);
                    break;
                case "DateCreated":
                    ordered = desc ? items.OrderByDescending(x => x.DateCreated ?? DateTimeOffset.MinValue)
                                   : items.OrderBy(x => x.DateCreated ?? DateTimeOffset.MinValue);
                    break;
            }
            var result = ordered.ToList();

            _logger.Info("Discover: lijst '{0}': TMDB gaf {1} items, na landfilter {2}, teruggegeven aan Emby: {3}, sortering: {4} {5}",
                key, all.Count, candidates.Count, result.Count, sort ?? "(geen)", desc ? "aflopend" : "oplopend");
            return new ChannelItemResult { Items = result, TotalRecordCount = result.Count };
        }

        // ---------- Afspelen = YouTube-trailer (aanvragen gebeurt via de aparte knop / API) ----------
        public async Task<IEnumerable<MediaSourceInfo>> GetChannelItemMediaInfo(string id, CancellationToken ct)
        {
            DiscoverDiagnostics.Add("trailer afspelen: " + id);
            bool isSeasonReq = id.StartsWith(AskSeasonPrefix);
            bool isReq = id.StartsWith(AskPrefix) || isSeasonReq;
            int requestedSeason = 0;
            if (isSeasonReq)
            {
                var seasonParts = id.Substring(AskSeasonPrefix.Length).Split(':');
                int tmdbSeasonId;
                if (seasonParts.Length != 4 || seasonParts[0] != "t" || seasonParts[2] != "s" ||
                    !int.TryParse(seasonParts[1], out tmdbSeasonId) ||
                    !int.TryParse(seasonParts[3], out requestedSeason) || requestedSeason <= 0)
                    throw new InvalidOperationException("Onbekend seizoensaanvraagitem: " + id);
                id = seasonParts[0] + ":" + tmdbSeasonId;
            }
            else if (id.StartsWith(AskPrefix)) id = id.Substring(AskPrefix.Length);
            else if (id.StartsWith(TrailerPrefix)) id = id.Substring(TrailerPrefix.Length);

            bool tv = false;
            int tmdbId = 0;
            if (id.StartsWith("m:"))
            {
                tmdbId = int.Parse(id.Substring(2));
            }
            else if (id.StartsWith("t:"))
            {
                tv = true;
                tmdbId = int.Parse(id.Substring(2));
            }
            else
            {
                throw new InvalidOperationException("Onbekend Discover-item: " + id);
            }

            if (isReq)
            {
                // Let op: Emby roept deze methode ook aan zodra de detailpagina opent (voor "Media informatie"),
                // dus hier mag NIETS aangevraagd worden. De echte aanvraag gebeurt bij het starten van het afspelen
                // (zie RequestOnPlay). De kaart toont de situatie van nu: "Aangevraagd" of "Staat al in Radarr/Sonarr".
                try
                {
                    DiscoverDiagnostics.Add(isSeasonReq
                        ? "seizoensaanvraagclip voor seizoen " + requestedSeason
                        : "aanvraagclip voor alle seizoenen");
                    TmdbItem info = FindInCache(tv, tmdbId);
                    if (info == null)
                        info = tv ? await _tmdb.GetTv(tmdbId, ct).ConfigureAwait(false)
                                  : await _tmdb.GetMovie(tmdbId, ct).ConfigureAwait(false);
                    var extraTask = SafeExtra(tv, tmdbId, ct);
                    var statesTask = SafeStates(tv, ct);
                    await Task.WhenAll(extraTask, statesTask).ConfigureAwait(false);
                    var extra = await extraTask.ConfigureAwait(false);
                    var states = await statesTask.ConfigureAwait(false);
                    bool hasFiles;
                    bool there = states.TryGetValue(tmdbId, out hasFiles);

                    // Wacht tot de staande kaart klaar is (bij een koude start duurt ffmpeg enkele seconden); pas daarna de vaste liggende clip.
                    var cardTask = RequestCard.Create(info, extra, tv, there, CancellationToken.None);
                    _ = cardTask.ContinueWith(x => { var ignored = x.Exception; }, TaskContinuationOptions.OnlyOnFaulted);
                    var first = await Task.WhenAny(cardTask, Task.Delay(30000, ct)).ConfigureAwait(false);
                    if (first != cardTask) throw new TimeoutException("kaart nog niet klaar");
                    var card = await cardTask.ConfigureAwait(false);
                    DiscoverDiagnostics.Add("kaartclip: " + card);
                    return new List<MediaSourceInfo>
                    {
                        new MediaSourceInfo
                        {
                            Id = "discover-requested-" + (tv ? "t" : "m") + tmdbId,
                            Name = "Aangevraagd",
                            Path = card,
                            Protocol = MediaProtocol.File,
                            Container = "mp4",
                            RunTimeTicks = RequestCard.Seconds * TimeSpan.TicksPerSecond,
                            SupportsDirectPlay = true,
                            SupportsDirectStream = true,
                            SupportsTranscoding = true
                        }
                    };
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    _logger.Error("Discover: kaartclip mislukt voor {0}: {1}", id, ex.Message);
                    DiscoverDiagnostics.Add("kaartclip " + id + ": " + ex.Message + " (vaste clip gebruikt)");
                }
            }

            if (!isReq)
            {
                // Trailer-item: speelt ALTIJD de trailer of geeft een eerlijke fout. Nooit de "Aangevraagd"-clip,
                // want die lijkt op een aanvraag terwijl er niets is aangevraagd.
                string ytKey;
                try
                {
                    ytKey = await _tmdb.GetYoutubeTrailerKey(tv, tmdbId, ct).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    _logger.Error("Discover: trailer ophalen mislukt voor {0}: {1}", id, ex.Message);
                    DiscoverDiagnostics.Add("FOUT trailer " + id + ": " + ex.Message);
                    throw new InvalidOperationException("Trailer ophalen mislukt: " + ex.Message);
                }

                if (string.IsNullOrEmpty(ytKey))
                {
                    DiscoverDiagnostics.Add("geen YouTube-trailer voor " + id);
                    _logger.Info("Discover: geen YouTube-trailer voor {0}", id);
                    throw new InvalidOperationException("Geen trailer beschikbaar voor deze titel.");
                }

                var path = "https://www.youtube.com/watch?v=" + ytKey;
                DiscoverDiagnostics.Add("trailer: " + id + " -> " + path);
                _logger.Info("Discover: trailer voor {0}: {1}", id, path);
                return new List<MediaSourceInfo>
                {
                    new MediaSourceInfo
                    {
                        Id = "yt-" + ytKey,
                        Name = "Trailer",
                        Path = path,
                        Protocol = MediaProtocol.Http,
                        Container = "mp4",
                        IsRemote = true,
                        SupportsDirectPlay = true,
                        SupportsDirectStream = true,
                        SupportsTranscoding = false
                    }
                };
            }

            // Alleen een aanvraagitem komt hier terecht (kaartclip mislukt): speel de vaste bevestigingsclip.
            string clip;
            try
            {
                clip = Plugin.Instance.EnsureClip();
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: clip niet beschikbaar: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT clip: " + ex.Message);
                throw new InvalidOperationException("Geen trailer beschikbaar voor deze titel.");
            }

            return new List<MediaSourceInfo>
            {
                new MediaSourceInfo
                {
                    Id = "discover-requested",
                    Name = "Aangevraagd",
                    Path = clip,
                    Protocol = MediaProtocol.File,
                    Container = "mp4",
                    RunTimeTicks = 33 * TimeSpan.TicksPerSecond / 10,
                    SupportsDirectPlay = true,
                    SupportsDirectStream = true,
                    SupportsTranscoding = true
                }
            };
        }


        /// <summary>Vraagt een titel aan bij Radarr/Sonarr; null seasons behoudt de bestaande all-seasons-aanvraag.</summary>
        internal static async Task<string> RequestTitle(TmdbClient tmdb, ArrClient arr, bool tv, int tmdbId, int[] seasons, CancellationToken ct)
        {
            bool added;
            if (tv)
            {
                var t = await tmdb.GetTv(tmdbId, ct).ConfigureAwait(false);
                var ext = await tmdb.GetTvExternalIds(tmdbId, ct).ConfigureAwait(false);
                if (ext == null || ext.tvdb_id == null)
                    throw new InvalidOperationException("Geen TVDB-id bij deze serie; Sonarr kan hem niet toevoegen.");
                added = await arr.AddSeries(tmdbId, ext.tvdb_id.Value, t.name ?? t.title, seasons, ct).ConfigureAwait(false);
            }
            else
            {
                var m = await tmdb.GetMovie(tmdbId, ct).ConfigureAwait(false);
                added = await arr.AddMovie(tmdbId, m.title ?? m.name, YearOf(m.release_date) ?? 0, ct).ConfigureAwait(false);
            }
            DiscoverDiagnostics.CountRequest(true);
            return added
                ? (seasons != null && seasons.Length > 0
                    ? "Aangevraagd seizoen " + string.Join(", ", seasons)
                    : "Aangevraagd")
                : "Stond al in " + (tv ? "Sonarr" : "Radarr");
        }

        // ---------- Koppeling met het knop-script ----------
        /// <summary>
        /// Zoekt in de bewaarde lijsten welk TMDB-item bij een Emby-kanaalitem hoort (op titel, jaar en beschrijving).
        /// Het knop-script kent alleen de Emby-gegevens van het item, niet het TMDB-id.
        /// </summary>
        internal static TmdbItem FindCached(string title, int year, string overview, out bool tv)
        {
            tv = false;
            TmdbItem best = null; bool bestTv = false; int bestScore = -1;
            lock (ListCache)
            {
                foreach (var kv in ListCache)
                {
                    bool isTv = kv.Key.EndsWith("_tv");
                    foreach (var i in kv.Value.Value)
                    {
                        if (!string.Equals(TitleOf(i, isTv), title, StringComparison.OrdinalIgnoreCase)) continue;
                        int y = YearOf(isTv ? i.first_air_date : i.release_date) ?? 0;
                        if (year > 0 && y > 0 && y != year) continue;
                        int score = 1;
                        if (!string.IsNullOrEmpty(overview) && (string.Equals(i.overview, overview, StringComparison.Ordinal) || string.Equals(WithDate(i, isTv), overview, StringComparison.Ordinal))) score += 2;
                        if (score > bestScore) { best = i; bestTv = isTv; bestScore = score; }
                    }
                }
            }
            tv = bestTv;
            return best;
        }

        private static readonly Dictionary<int, string[]> MovieGenres = new Dictionary<int, string[]>
        {
            {28, new[]{"Actie","Action","Action"}}, {12, new[]{"Avontuur","Adventure","Abenteuer"}}, {16, new[]{"Animatie","Animation","Animation"}},
            {35, new[]{"Komedie","Comedy","Komödie"}}, {80, new[]{"Misdaad","Crime","Krimi"}}, {99, new[]{"Documentaire","Documentary","Dokumentarfilm"}},
            {18, new[]{"Drama","Drama","Drama"}}, {10751, new[]{"Familie","Family","Familie"}}, {14, new[]{"Fantasie","Fantasy","Fantasy"}},
            {36, new[]{"Geschiedenis","History","Geschichte"}}, {27, new[]{"Horror","Horror","Horror"}}, {10402, new[]{"Muziek","Music","Musik"}},
            {9648, new[]{"Mysterie","Mystery","Mystery"}}, {10749, new[]{"Romantiek","Romance","Liebesfilm"}}, {878, new[]{"Science fiction","Science Fiction","Science-Fiction"}},
            {10770, new[]{"Tv-film","TV Movie","Fernsehfilm"}}, {53, new[]{"Thriller","Thriller","Thriller"}}, {10752, new[]{"Oorlog","War","Kriegsfilm"}},
            {37, new[]{"Western","Western","Western"}}
        };

        private static readonly Dictionary<int, string[]> TvGenres = new Dictionary<int, string[]>
        {
            {10759, new[]{"Actie & avontuur","Action & Adventure","Action & Abenteuer"}}, {16, new[]{"Animatie","Animation","Animation"}},
            {35, new[]{"Komedie","Comedy","Komödie"}}, {80, new[]{"Misdaad","Crime","Krimi"}}, {99, new[]{"Documentaire","Documentary","Dokumentarfilm"}},
            {18, new[]{"Drama","Drama","Drama"}}, {10751, new[]{"Familie","Family","Familie"}}, {10762, new[]{"Kinderen","Kids","Kinder"}},
            {9648, new[]{"Mysterie","Mystery","Mystery"}}, {10763, new[]{"Nieuws","News","Nachrichten"}}, {10764, new[]{"Reality","Reality","Reality"}},
            {10765, new[]{"Sci-fi & fantasie","Sci-Fi & Fantasy","Science-Fiction & Fantasy"}}, {10766, new[]{"Soap","Soap","Seifenoper"}}, {10767, new[]{"Talkshow","Talk","Talkshow"}},
            {10768, new[]{"Oorlog & politiek","War & Politics","Krieg & Politik"}}, {37, new[]{"Western","Western","Western"}}
        };

        internal static string LocalizedGenreName(int genreId, bool tv, string fallback)
        {
            string[] names;
            var map = tv ? TvGenres : MovieGenres;
            if (!map.TryGetValue(genreId, out names)) return fallback;
            int column = DiscoverLanguage.IsDutch ? 0 : DiscoverLanguage.IsGerman ? 2 : 1;
            return names[column];
        }

        /// <summary>Beschrijving uit de lijst met de releasedatum eraan voorop (geen extra TMDB-call).</summary>
        private static string WithDate(TmdbItem i, bool tv)
        {
            var dl = InfoText.DateLine(tv ? i.first_air_date : i.release_date, tv);
            if (dl == null) return i.overview;
            return string.IsNullOrWhiteSpace(i.overview) ? dl : dl + "\n\n" + i.overview.Trim();
        }

        private static List<string> GenresOf(TmdbItem i, bool tv)
        {
            var result = new List<string>();
            if (i.genre_ids == null) return result;
            int col = DiscoverLanguage.IsDutch ? 0 : DiscoverLanguage.IsGerman ? 2 : 1;
            var map = tv ? TvGenres : MovieGenres;
            foreach (var g in i.genre_ids)
            {
                string[] names;
                if (map.TryGetValue(g, out names)) result.Add(names[col]);
            }
            return result;
        }

        // ---------- Hulpjes ----------
        private async Task<Dictionary<int, bool>> SafeStates(bool tv, CancellationToken ct)
        {
            try
            {
                return tv ? await _arr.GetSeriesStates(ct).ConfigureAwait(false)
                          : await _arr.GetMovieStates(ct).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: status ophalen mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT status " + (tv ? "Sonarr" : "Radarr") + ": " + ex.Message);
                return new Dictionary<int, bool>();
            }
        }

        private static string TitleOf(TmdbItem i, bool tv) =>
            tv ? (i.name ?? i.title ?? "?") : (i.title ?? i.name ?? "?");

        private static int? YearOf(string date) =>
            !string.IsNullOrEmpty(date) && date.Length >= 4 && int.TryParse(date.Substring(0, 4), out var y) ? y : (int?)null;
    }
}
