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
        private const string AskSeasonFolderPrefix = "ask25seasons:"; // new ID so Emby re-reads the season list (new tile and text on the "All seasons" item)
        private const string LegacyAskSeasonFolderPrefix5 = "ask24seasons:"; // idem
        private const string LegacyAskSeasonFolderPrefix4 = "ask23seasons:"; // idem
        private const string LegacyAskSeasonFolderPrefix3 = "ask22seasons:"; // idem
        private const string LegacyAskSeasonFolderPrefix = "ask18seasons:"; // keep previously cached season folders working
        private const string LegacyAskSeasonFolderPrefix2 = "ask19seasons:"; // idem
        private const string AskListPrefix = "ask16list:";
        private const string AskGenrePrefix = "ask16genres:";   // map met genretegels (movie of tv)
        private const string AskStudioRoot = "ask16studios";       // map met studio- en netwerktegels
        internal const string AskPrefix = "ask16:";           // het aanvraagitem zelf
        /// <summary>
        /// Achtervoegsel aan het id van het aanvraag-/traileritem zodra de tegel met tekst klaar is. Emby zet de afbeelding van
        /// een kanaalitem alleen bij het aanmaken; met een nieuw id maakt Emby het item opnieuw aan, nu met de tegel met tekst.
        /// </summary>
        internal const string TileMark = ":x";
        internal static string StripTileMark(string id) =>
            id != null && id.EndsWith(TileMark, StringComparison.Ordinal) ? id.Substring(0, id.Length - TileMark.Length) : id;
        internal const string AskSeasonPrefix = "ask22season:"; // seizoenaanvraagitems
        internal const string AskAllPrefix = "ask22all:";       // "Alle seizoenen"-item: de hele serie in een keer aanvragen
        private const string TrailerPrefix = "tr10:";         // het trailer-item naast het aanvraagitem

        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly ILogger _logger;

        public DiscoverMediaChannel(ILogManager logManager, IJsonSerializer json)
        {
            _logger = logManager.GetLogger("Discover");
            _logger.Info("Discover: channel loaded (name: {0})", Name);
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
        }

        // ---------- IChannel ----------
        public string Name => "Discover Media";
        public string Description => DiscoverLanguage.T("channel.discover_movies_and_series_and_request_them");
        public string HomePageUrl => "";

        // Ophogen als Emby oude (bewaarde) kanaalinhoud blijft tonen.
        // De tegel-epoch verandert als de opruiming tegelplaatjes heeft verwijderd: dan vraagt Emby de mappen opnieuw op
        // en maakt de plugin de ontbrekende plaatjes opnieuw (anders verwijst Emby naar een bestand dat niet meer bestaat).
        public string DataVersion => (Plugin.GetCurrentConfiguration().ShowTrailerTile ? "77" : "77-notrailer") + "-e" + CacheCleaner.TileEpoch;
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

        /// <summary>
        /// Wat voor Discover-item is dit, volgens het id dat het kanaal zelf heeft uitgedeeld (de ExternalId die
        /// Emby bewaart)? Dit is de enige betrouwbare manier: de naam van een item staat in de taal van de kijker,
        /// dus daarop zoeken werkt alleen in de talen die in de code staan.
        /// kind: "ask" (aanvraagitem), "season" (één seizoen), "all" (alle seizoenen), "trailer", "folder" of "".
        /// </summary>
        internal static void DescribeExternalId(string externalId, out string kind, out bool tv, out int tmdbId, out int season)
        {
            kind = ""; tv = false; tmdbId = 0; season = 0;
            var id = StripTileMark(externalId);
            if (string.IsNullOrEmpty(id)) { return; }

            string rest = null;
            if (id.StartsWith(AskSeasonPrefix, StringComparison.Ordinal))
            {
                // ask22season:t:<id>:s:<nummer>
                var parts = id.Substring(AskSeasonPrefix.Length).Split(':');
                if (parts.Length == 4 && parts[0] == "t" && parts[2] == "s" &&
                    int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out tmdbId) &&
                    int.TryParse(parts[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out season))
                {
                    kind = "season"; tv = true;
                }
                return;
            }
            if (id.StartsWith(AskAllPrefix, StringComparison.Ordinal)) { kind = "all"; rest = id.Substring(AskAllPrefix.Length); }
            else if (id.StartsWith(AskPrefix, StringComparison.Ordinal)) { kind = "ask"; rest = id.Substring(AskPrefix.Length); }
            else if (id.StartsWith(TrailerPrefix, StringComparison.Ordinal)) { kind = "trailer"; rest = id.Substring(TrailerPrefix.Length); }
            else if (id.StartsWith(AskSeasonFolderPrefix, StringComparison.Ordinal) ||
                     id.StartsWith(LegacyAskSeasonFolderPrefix, StringComparison.Ordinal) ||
                     id.StartsWith(LegacyAskSeasonFolderPrefix2, StringComparison.Ordinal) ||
                     id.StartsWith(LegacyAskSeasonFolderPrefix3, StringComparison.Ordinal) ||
                     id.StartsWith(LegacyAskSeasonFolderPrefix4, StringComparison.Ordinal) ||
                     id.StartsWith(LegacyAskSeasonFolderPrefix5, StringComparison.Ordinal) ||
                     id.StartsWith(AskItemPrefix, StringComparison.Ordinal) ||
                     id.StartsWith(AskTvItemPrefix, StringComparison.Ordinal) ||
                     id.StartsWith(AskListPrefix, StringComparison.Ordinal) ||
                     id.StartsWith(AskGenrePrefix, StringComparison.Ordinal) ||
                     id == AskStudioRoot || id == AskRoot)
            {
                kind = "folder";
                return;
            }
            else { return; }

            // rest is "m:<id>" of "t:<id>"
            if (rest != null && rest.Length > 2 && (rest[0] == 'm' || rest[0] == 't') && rest[1] == ':' &&
                int.TryParse(rest.Substring(2), NumberStyles.Integer, CultureInfo.InvariantCulture, out tmdbId))
            {
                tv = rest[0] == 't';
                return;
            }
            kind = ""; tmdbId = 0;
        }

        private static bool IsDeepFolder(string id)
        {
            return !string.IsNullOrEmpty(id)
                && (id.StartsWith(AskItemPrefix) || id.StartsWith(AskTvItemPrefix)
                    || id.StartsWith(AskSeasonFolderPrefix) || id.StartsWith(LegacyAskSeasonFolderPrefix));
        }

        // ---------- Mappen en items ----------
        public async Task<ChannelItemResult> GetChannelItems(InternalChannelItemQuery query, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var hasKey = !string.IsNullOrWhiteSpace(cfg.TmdbApiKey);
            var folder = string.IsNullOrEmpty(query.FolderId) ? "(root)" : query.FolderId;

            // Emby's own background refresh (no user) walks every folder; the title and season folders are skipped for it:
            // they only make sense for a user who opens them, and crawling them hammers TMDB for nothing.
            var systemCall = query.UserId == 0;
            if (systemCall && IsDeepFolder(query.FolderId))
            {
                throw new InvalidOperationException("Discover: skipped (background refresh does not crawl title folders)");
            }

            DiscoverDiagnostics.CountCall();
            var tmdbLanguage = TmdbClient.Language();
            DiscoverDiagnostics.Add("log.channel.opgevraagd_map_start_limit_key_taal", folder, query.StartIndex, query.Limit, hasKey, tmdbLanguage);
            _logger.Info("Discover: channel opened, folder '{0}', TMDB key set: {1}, TMDB language: {2}, Radarr: {3}, Sonarr: {4}, start: {5}, limit: {6}, user: {7}",
                folder, hasKey, tmdbLanguage, ArrClient.RadarrConfigured, ArrClient.SonarrConfigured, query.StartIndex, query.Limit, query.UserId);

            var id = query.FolderId;
            // Bewust een exception en geen "bericht-item": een normaal resultaat wordt door Emby bewaard,
            // waardoor "niet ingesteld" of een tijdelijke netwerkfout blijft staan na het instellen/herstellen.
            if (!hasKey)
            {
                DiscoverDiagnostics.Add("log.channel.fout_geen_tmdb_key_ingesteld");
                throw new InvalidOperationException(
                    DiscoverLanguage.T("channel.discover_is_not_configured_enter_the_tmdb"));
            }

            if (string.IsNullOrEmpty(id)) return await Root(ct).ConfigureAwait(false);

            try
            {
                ChannelItemResult res = null;
                if (id == AskRoot) res = await RequestRoot(ct).ConfigureAwait(false);
                else if (id.StartsWith(AskTvItemPrefix)) { var two = await RequestItems(id.Substring(AskTvItemPrefix.Length), ct, query.UserId != 0).ConfigureAwait(false); res = new ChannelItemResult { Items = two, TotalRecordCount = two.Count }; }
                else if (id.StartsWith(AskItemPrefix)) { var two = await RequestItems(id.Substring(AskItemPrefix.Length), ct, query.UserId != 0).ConfigureAwait(false); res = new ChannelItemResult { Items = two, TotalRecordCount = two.Count }; }
                else if (id.StartsWith(AskSeasonFolderPrefix)) res = await RequestSeasons(id.Substring(AskSeasonFolderPrefix.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(LegacyAskSeasonFolderPrefix5)) res = await RequestSeasons(id.Substring(LegacyAskSeasonFolderPrefix5.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(LegacyAskSeasonFolderPrefix4)) res = await RequestSeasons(id.Substring(LegacyAskSeasonFolderPrefix4.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(LegacyAskSeasonFolderPrefix3)) res = await RequestSeasons(id.Substring(LegacyAskSeasonFolderPrefix3.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(LegacyAskSeasonFolderPrefix2)) res = await RequestSeasons(id.Substring(LegacyAskSeasonFolderPrefix2.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(LegacyAskSeasonFolderPrefix)) res = await RequestSeasons(id.Substring(LegacyAskSeasonFolderPrefix.Length), ct).ConfigureAwait(false);
                else if (id.StartsWith(AskGenrePrefix)) res = await GenreTiles(id.Substring(AskGenrePrefix.Length) == "tv", ct).ConfigureAwait(false);
                else if (id == AskStudioRoot) res = await StudioTiles(ct).ConfigureAwait(false);
                else if (id.StartsWith(AskListPrefix)) res = await GetList(id.Substring(AskListPrefix.Length), query, ct, true).ConfigureAwait(false);
                else if (id.StartsWith("list:")) res = await GetList(id.Substring(5), query, ct, false).ConfigureAwait(false);

                if (res != null)
                {
                    DiscoverDiagnostics.Add("log.channel.teruggegeven_map_items_totaal", id, res.Items == null ? 0 : res.Items.Count(), res.TotalRecordCount);
                    return res;
                }
            }
            catch (Exception ex)
            {
                _logger.Error("Discover: loading failed: {0}", ex.Message);
                DiscoverDiagnostics.Add("log.channel.fout_bij_map", id, ex.Message);
                throw;
            }
            DiscoverDiagnostics.Add("log.channel.onbekende_map_leeg_teruggegeven", id);
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
        private async Task<List<ChannelItemInfo>> RequestItems(string rest, CancellationToken ct, bool userBrowsing = false)
        {
            bool tv = rest.StartsWith("t:");
            int tmdbId;
            if (rest.Length < 3 || !int.TryParse(rest.Substring(2), out tmdbId))
                throw new InvalidOperationException(DiscoverLanguage.T("channel.unknown_request_item") + rest);

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
                    DiscoverDiagnostics.Add("log.channel.titel_voor_aanvraag_item_mislukt", rest, ex.Message);
                }
            }
            // Bewust een exception en geen leeg item: Emby bewaart een normaal resultaat, en dan blijft
            // "Aanvragen" zonder poster en info staan, ook als TMDB daarna weer werkt.
            if (t == null)
                throw new InvalidOperationException(DiscoverLanguage.T("channel.title_details_from_tmdb_not_available_for") + rest + DiscoverLanguage.T("channel.try_again_in_a_moment"));

            string title = TitleOf(t, tv);
            string arr = ArrClient.ServiceName(tv);

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
                action = DiscoverLanguage.T("channel.u2713_partially_available_some_episodes");
            else if (status == 2)
                action = DiscoverLanguage.T("channel.u2713_this_title_is_already_available_in");
            else if (status == 1)
                action = DiscoverLanguage.T("channel.title_already_requested", arr);
            else
                action = DiscoverLanguage.T("channel.press_the_u25b6_button_to_request");

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
                Name = DiscoverLanguage.T("channel.request") + title,
                Type = ChannelItemType.Media,
                MediaType = ChannelMediaType.Video,
                ContentType = ChannelMediaContentType.Clip,
                // Het item wordt als liggende (16:9) tegel getoond; een staande poster wordt daar afgesneden.
                ImageUrl = !string.IsNullOrEmpty(t.backdrop_path)
                    ? "https://image.tmdb.org/t/p/w780" + t.backdrop_path
                    : TmdbClient.PosterUrl(t.poster_path),
                Overview = overview.ToString(),
                ProviderIds = new ProviderIdDictionary { { "DiscoverTmdb", tmdbId.ToString() } }
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
                Name = DiscoverLanguage.T("channel.trailer") + title,
                Type = ChannelItemType.Media,
                MediaType = ChannelMediaType.Video,
                ContentType = ChannelMediaContentType.Clip,
                ImageUrl = item.ImageUrl,
                Overview = DiscoverLanguage.T("channel.press_the_u25b6_button_to_watch_the_trailer")
                           + (info == null ? "" : "\n\n" + info)
                           + (string.IsNullOrWhiteSpace(t.overview) ? "" : "\n\n" + t.overview.Trim()),
                ProviderIds = item.ProviderIds,
                ProductionYear = item.ProductionYear,
                CommunityRating = item.CommunityRating,
                PremiereDate = item.PremiereDate
            };
            if (genres.Count > 0) trailer.Genres = genres;

            // Zet de tekst "Aanvragen" resp. "Trailer" op de tegelafbeelding, zodat je de twee tegels direct uit elkaar houdt.
            // Lukt dat niet (of duurt het te lang), dan blijft de gewone achtergrond staan.
            bool showTrailerTile = Plugin.GetCurrentConfiguration().ShowTrailerTile;
            // Alleen als een gebruiker de titel echt opent (UserId gezet), niet tijdens "Refresh Internet Channels"
            // (dat opent elke titel en zou dan voor alles ffmpeg starten), tenzij "vooraf maken" aan staat.
            if (!string.IsNullOrEmpty(t.backdrop_path) && (userBrowsing || Plugin.GetCurrentConfiguration().PrecreateCards))
            {
                var tileKey = "rq" + (tv ? "t" : "m") + tmdbId;
                var askTile = FolderTile.Create(tileKey + "ask", DiscoverLanguage.T("channel.request_2"),
                    item.ImageUrl, CancellationToken.None);
                var trailerTile = showTrailerTile
                    ? FolderTile.Create(tileKey + "tr", DiscoverLanguage.T("channel.trailer_2"),
                        item.ImageUrl, CancellationToken.None)
                    : null;
                var askFile = await TileWithin(askTile, TimeSpan.FromSeconds(8)).ConfigureAwait(false);
                var trailerFile = trailerTile == null ? null : await TileWithin(trailerTile, TimeSpan.FromSeconds(8)).ConfigureAwait(false);
                if (askFile != null) { item.ImageUrl = askFile; item.Id += TileMark; }
                if (trailerFile != null) { trailer.ImageUrl = trailerFile; trailer.Id += TileMark; }
            }
            else if (!string.IsNullOrEmpty(t.backdrop_path))
            {
                // Kanaalverversing zonder gebruiker: geen ffmpeg starten, maar wel de al gemaakte tegels gebruiken.
                // Anders zet Emby bij elke verversing de gewone foto terug en verdwijnt de tekst "Aanvragen"/"Trailer".
                var tileKey = "rq" + (tv ? "t" : "m") + tmdbId;
                var bgUrl = item.ImageUrl;
                var askFile = FolderTile.Existing(tileKey + "ask", DiscoverLanguage.T("channel.request_2"), bgUrl);
                var trailerFile = showTrailerTile ? FolderTile.Existing(tileKey + "tr", DiscoverLanguage.T("channel.trailer_2"), bgUrl) : null;
                if (askFile == null) FolderTile.EnsureInBackground(tileKey + "ask", DiscoverLanguage.T("channel.request_2"), bgUrl);
                if (showTrailerTile && trailerFile == null) FolderTile.EnsureInBackground(tileKey + "tr", DiscoverLanguage.T("channel.trailer_2"), bgUrl);
                if (askFile != null) { item.ImageUrl = askFile; item.Id += TileMark; }
                if (trailerFile != null) { trailer.ImageUrl = trailerFile; trailer.Id += TileMark; }
            }

            if (tv)
            {
                // The Aanvragen: <series> folder is the season selector; do not add a whole-series request tile.
                // Ook de seizoensmap ("Request: serie") krijgt met de tegel met tekst een nieuw id, anders houdt Emby de oude foto.
                bool askHasTile = item.Id.EndsWith(TileMark, StringComparison.Ordinal);
                var seasonFolder = Folder(AskSeasonFolderPrefix + rest + (askHasTile ? TileMark : ""),
                    DiscoverLanguage.T("channel.request") + title,
                    item.ImageUrl,
                    DiscoverLanguage.T("channel.choose_a_season_to_request_only_that_season"));
                return showTrailerTile
                    ? new List<ChannelItemInfo> { trailer, seasonFolder }
                    : new List<ChannelItemInfo> { seasonFolder };
            }
            return showTrailerTile
                ? new List<ChannelItemInfo> { trailer, item }
                : new List<ChannelItemInfo> { item };
        }

        private async Task<ChannelItemResult> RequestSeasons(string rest, CancellationToken ct)
        {
            rest = StripTileMark(rest);
            var parts = rest.Split(':');
            int tmdbId;
            if (parts.Length != 2 || parts[0] != "t" || !int.TryParse(parts[1], out tmdbId))
                throw new InvalidOperationException(DiscoverLanguage.T("channel.unknown_series_id_for_season_selection") + rest);

            var detail = await _tmdb.GetTvDetail(tmdbId, ct).ConfigureAwait(false);
            if (detail == null || detail.seasons == null)
                throw new InvalidOperationException(DiscoverLanguage.T("channel.seasons_from_tmdb_not_available_for_series") + tmdbId);

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
                    DiscoverDiagnostics.Add("log.channel.seizoensstatus_uit_sonarr_ophalen_mislukt", tmdbId, ex.Message);
                }
            }
            string background = !string.IsNullOrEmpty(detail.backdrop_path)
                ? "https://image.tmdb.org/t/p/w780" + detail.backdrop_path
                : TmdbClient.PosterUrl(detail.poster_path);
            var items = new List<ChannelItemInfo>();

            // Eerst een item om de hele serie in een keer aan te vragen. Zonder seizoenslijst monitort Sonarr alles,
            // ook seizoenen die later uitkomen. (Op naam gesorteerd staat dit item vanzelf vooraan.)
            {
                // Neutrale staande tegel (2:3, effen grijsblauw) met de tekst "Alle seizoenen" in plaats van een serieposter, zodat het
                // niet op een gewoon seizoen lijkt. Lukt dat niet (geen ffmpeg, tekstplaatjes uit of te traag), dan de serieposter.
                // Tegel: achtergrondfoto van de serie met het logo (of de naam), "Alle seizoenen" en het aantal seizoenen.
                // Geen achtergrondfoto: dan de serieposter als achtergrond. Lukt het helemaal niet, dan de oude grijze tegel.
                var allImage = !string.IsNullOrEmpty(detail.poster_path) ? TmdbClient.PosterUrl(detail.poster_path) : background;
                var allLabel = DiscoverLanguage.T("channel.all_seasons");
                int seasonCount = seasons.Count;
                var allSub = seasonCount == 1 ? DiscoverLanguage.T("channel.seasons_one") : DiscoverLanguage.T("channel.seasons_many", seasonCount);
                string allTile = null;
                bool allTileNew = false;
                if (Plugin.GetCurrentConfiguration().TileTextImages)
                {
                    string logoPath = null;
                    try { logoPath = await _tmdb.GetTitleLogo(true, tmdbId, ct).ConfigureAwait(false); } catch (Exception ex) { if (ex is OperationCanceledException) throw; }
                    var bdUrl = !string.IsNullOrEmpty(detail.backdrop_path) ? "https://image.tmdb.org/t/p/w1280" + detail.backdrop_path
                        : (!string.IsNullOrEmpty(detail.poster_path) ? TmdbClient.PosterUrl(detail.poster_path) : null);
                    if (bdUrl != null)
                        allTile = await TileWithin(FolderTile.CreateAllSeasons("t" + tmdbId, bdUrl,
                            string.IsNullOrEmpty(logoPath) ? null : "https://image.tmdb.org/t/p/w500" + logoPath,
                            TitleOf(detail, true), allLabel, allSub, CancellationToken.None), TimeSpan.FromSeconds(20)).ConfigureAwait(false);
                    allTileNew = allTile != null;
                    if (allTile == null)
                        allTile = await TileWithin(FolderTile.Create("allseasons", allLabel.Replace(' ', '\n'), null, CancellationToken.None, "5B6573", true, 720, 1080),
                            TimeSpan.FromSeconds(20)).ConfigureAwait(false);
                }
                if (allTile != null) allImage = allTile;
                string allOverview = DiscoverLanguage.T("channel.press_u25b6_to_request_all_seasons_at_once");
                if (sonarrSeasons.Count > 0 && RequestHub.External)
                    allOverview += "\n\n" + DiscoverLanguage.T("channel.series_already_requested", RequestHub.Name);
                else if (sonarrSeasons.Count > 0)
                    allOverview += "\n\n" + DiscoverLanguage.T("channel.u23f3_this_series_is_already_in_sonarr_requesting");
                // Seriesinfo zoals op de trailerpagina (ook zichtbaar in de tv- en mobiele apps).
                try
                {
                    var seriesExtra = await SafeExtra(true, tmdbId, ct).ConfigureAwait(false);
                    var seriesLines = InfoText.Lines(detail, seriesExtra, true, false);
                    if (seriesLines.Count > 0) allOverview += "\n\n" + string.Join("\n", seriesLines);
                }
                catch (Exception ex) { if (ex is OperationCanceledException) throw; }
                if (!string.IsNullOrWhiteSpace(detail.overview)) allOverview += "\n\n" + detail.overview.Trim();

                items.Add(new ChannelItemInfo
                {
                    // Met de nieuwe tegel een ander id, zodat Emby het item opnieuw aanmaakt (oude grijze tegel weg).
                    Id = AskAllPrefix + "t:" + tmdbId + (allTileNew ? TileMark : ""),
                    Name = DiscoverLanguage.T("channel.all_seasons"),
                    Type = ChannelItemType.Media,
                    MediaType = ChannelMediaType.Video,
                    ContentType = ChannelMediaContentType.Clip,
                    ImageUrl = allImage,
                    Overview = allOverview,
                    ProviderIds = new ProviderIdDictionary { { "DiscoverTmdb", tmdbId.ToString() } },
                    ForceUpdate = true
                });
            }

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
                        DiscoverDiagnostics.Add("log.channel.seizoensbeschrijving_ophalen_mislukt_voor", tmdbId, seasonNumber, ex.Message);
                    }
                }
                // De seizoenslijst van de serie mist soms een poster die het seizoen zelf wel heeft: dan het seizoen rechtstreeks opvragen.
                if (string.IsNullOrWhiteSpace(season.poster_path))
                {
                    try
                    {
                        var seasonPoster = await _tmdb.GetSeasonPosterPath(tmdbId, seasonNumber, ct).ConfigureAwait(false);
                        if (!string.IsNullOrWhiteSpace(seasonPoster)) season.poster_path = seasonPoster;
                        else DiscoverDiagnostics.Add("log.channel.geen_seizoensposter_bij_tmdb_voor_seizoen", tmdbId, seasonNumber);
                    }
                    catch (Exception ex)
                    {
                        if (ex is OperationCanceledException) throw;
                        DiscoverDiagnostics.Add("log.channel.seizoensposter_ophalen_mislukt_voor_seizoen", tmdbId, seasonNumber, ex.Message);
                    }
                }
                // Seizoenstegels zijn staand (2:3): is er echt geen seizoensposter, dan de serieposter, pas daarna de liggende achtergrond.
                var image = !string.IsNullOrEmpty(season.poster_path)
                    ? TmdbClient.PosterUrl(season.poster_path)
                    : (!string.IsNullOrEmpty(detail.poster_path) ? TmdbClient.PosterUrl(detail.poster_path) : background);
                var countText = season.episode_count > 0
                    ? season.episode_count == 1 ? DiscoverLanguage.T("channel.episodes_one") : DiscoverLanguage.T("channel.episodes_many", season.episode_count)
                    : null;
                // Staat het seizoen al in Sonarr, dan zeg dat erbij; opnieuw aanvragen kan nog steeds.
                bool allFiles = hasFiles && sonarrSeason.statistics.episodeCount > 0 &&
                    sonarrSeason.statistics.episodeFileCount >= sonarrSeason.statistics.episodeCount;
                string overview;
                if (allFiles)
                    overview = DiscoverLanguage.T("channel.u2713_this_season_is_already_in_your_library");
                else if (hasFiles)
                    overview = DiscoverLanguage.T("channel.u2713_partially_available_some_episodes_2");
                else if (showHourglass)
                    overview = DiscoverLanguage.T("channel.season_already_requested", ArrClient.ServiceName(true));
                else
                    overview = DiscoverLanguage.T("channel.press_play_season_only", seasonNumber);
                // Aangekondigd seizoen (nog niet begonnen of nog zonder datum): "Binnenkort", aanvragen kan al.
                DateTime seasonStart;
                bool hasStart = InfoText.TryDate(season.air_date, out seasonStart);
                bool upcoming = !hasFiles && (!hasStart || seasonStart.Date > DateTime.UtcNow.Date);
                if (upcoming)
                {
                    overview += "\n" + (hasStart
                        ? DiscoverLanguage.T("channel.coming_soon_from", InfoText.LongDate(seasonStart))
                        : DiscoverLanguage.T("channel.announced_no_start_date_yet"));
                    overview += " " + DiscoverLanguage.T("channel.you_can_request_it_now_it_is_downloaded");
                }
                else if (hasStart)
                    overview += "\n" + DiscoverLanguage.T("channel.aired_from") + InfoText.LongDate(seasonStart) + ".";
                if (!string.IsNullOrWhiteSpace(countText)) overview += "\n" + countText + ".";
                if (!string.IsNullOrWhiteSpace(season.overview)) overview += "\n\n" + season.overview.Trim();

                var displayName = DiscoverLanguage.T("channel.season") +
                    seasonNumber.ToString(CultureInfo.InvariantCulture);
                if (upcoming && !showHourglass) displayName += DiscoverLanguage.T("channel.u00b7_coming_soon");
                if (allFiles) displayName += " \u2713";
                else if (showHourglass) displayName += " \u23F3";

                // De bevestigingskaart van dit seizoen alvast maken (op de achtergrond): zo staat de kaart met poster en
                // status klaar zodra je op Afspelen drukt, ook voor een seizoen dat nog nooit is aangevraagd.
                PrewarmCard(detail, null, true, sonarrSeasons.Count > 0, seasonNumber, season.poster_path);

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
                    ProviderIds = new ProviderIdDictionary { { "DiscoverTmdb", tmdbId.ToString() } },
                    IndexNumber = seasonNumber,
                    ForceUpdate = true
                });
            }

            if (items.Count == 0)
                throw new InvalidOperationException(DiscoverLanguage.T("channel.tmdb_has_no_requestable_seasons_for_series") + tmdbId);

            return new ChannelItemResult { Items = items, TotalRecordCount = items.Count };
        }

        private async Task<string> SafeSeasonPoster(int tmdbId, int season, CancellationToken ct)
        {
            try { return await _tmdb.GetSeasonPosterPath(tmdbId, season, ct).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("log.channel.seizoensposter_voor_kaart_seizoen", tmdbId, season, ex.Message);
                return null;
            }
        }

        private async Task<TmdbExtra> SafeExtra(bool tv, int tmdbId, CancellationToken ct)
        {
            try { return await _tmdb.GetExtraCached(tv, tmdbId, ct).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("log.channel.extra_info_mislukt", tmdbId, ex.Message);
                return null;
            }
        }

        private static void PrewarmCard(TmdbItem t, TmdbExtra extra, bool tv, bool alreadyThere, int season = 0, string posterPath = null)
        {
            // Standaard niet vooraf maken: tijdens de kanaalverversing zou dat voor elke titel een ffmpeg-run starten.
            // De kaart wordt dan pas gemaakt als iemand echt op Afspelen drukt.
            if (!Plugin.GetCurrentConfiguration().PrecreateCards) return;
            Task.Run(async () =>
            {
                try { await RequestCard.Create(t, extra, tv, alreadyThere, CancellationToken.None, season, posterPath, true).ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("log.channel.kaart_vooraf_maken_mislukt", ex.Message); }
            });
        }

        /// <summary>Zoekt een titel in de bewaarde TMDB-lijsten (zonder netwerkcall).</summary>
        private static TmdbItem FindInCache(bool tv, int id)
        {
            lock (ListCache)
            {
                foreach (var kv in ListCache)
                {
                    if (kv.Value.Tv != tv) continue;
                    foreach (var i in kv.Value.Items)
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
                    DiscoverDiagnostics.Add("log.channel.achtergrondlijst_ophalen_mislukt", ex.Message);
                    tops = paths.Select(x => new List<string>()).ToArray();
                }
            }
            else
            {
                DiscoverDiagnostics.Add("log.channel.root_artwork_na_5_seconden_uitgesteld_kanaal");
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
                new TileSpec(AskListPrefix + "trending_movie", DiscoverLanguage.T("channel.trending_movies"), "orange", pick(0, 3)),
                new TileSpec(AskListPrefix + "popular_movie", DiscoverLanguage.T("channel.popular_movies"), "red", pick(1, 3)),
                new TileSpec(AskListPrefix + "upcoming_movie", DiscoverLanguage.T("channel.upcoming_movies"), "purple", pick(2, 3)),
                new TileSpec(AskGenrePrefix + "movie", DiscoverLanguage.T("channel.movie_genres"), "green", pick(1, 8)),
                new TileSpec(AskListPrefix + "trending_tv", DiscoverLanguage.T("channel.trending_series"), "yellow", pick(3, 3)),
                new TileSpec(AskListPrefix + "popular_tv", DiscoverLanguage.T("channel.popular_series"), "pink", pick(4, 3)),
                new TileSpec(AskListPrefix + "upcoming_tv", DiscoverLanguage.T("channel.upcoming_series"), "blue", pick(5, 3)),
                new TileSpec(AskGenrePrefix + "tv", DiscoverLanguage.T("channel.series_genres"), "lightgreen", pick(4, 8)),
                new TileSpec(AskStudioRoot, DiscoverLanguage.T("channel.studios"), "black", pick(0, 8))
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
                    catch (Exception ex) { DiscoverDiagnostics.Add("log.channel.tegelafbeelding_mislukt", creationOrder[i].Caption, ex.Message); }
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

        // Wacht hoogstens 'max' op een tegelafbeelding; daarna gaat het maken op de achtergrond door en wordt null gegeven.
        private static async Task<string> TileWithin(Task<string> creation, TimeSpan max)
        {
            try
            {
                await Task.WhenAny(creation, Task.Delay(max)).ConfigureAwait(false);
                if (creation.IsCompleted) return await creation.ConfigureAwait(false);
                _ = ObserveTileCreation(creation, "request/trailer");
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("log.channel.tegelafbeelding_aanvraag_trailer_mislukt", ex.Message);
            }
            return null;
        }

        /// <summary>Het resultaat als de tegel al klaar is, anders null (dan wordt de gewone afbeelding gebruikt).</summary>
        private static string DoneOrNull(Task<string> t)
        {
            try { return t.Status == TaskStatus.RanToCompletion ? t.Result : null; }
            catch { return null; }
        }

        private static async Task ObserveTiles(Task waiting)
        {
            try { await waiting.ConfigureAwait(false); }
            catch (Exception ex) { DiscoverDiagnostics.Add("log.channel.tegelafbeelding_mislukt", "studio/netwerk", ex.Message); }
        }

        private static async Task ObserveTileCreation(Task<string> creation, string text)
        {
            try { await creation.ConfigureAwait(false); }
            catch (Exception ex) { DiscoverDiagnostics.Add("log.channel.tegelafbeelding_mislukt", text, ex.Message); }
        }

        private static async Task ObserveTopBackdrops(Task<List<string>[]> loading)
        {
            try { await loading.ConfigureAwait(false); }
            catch (Exception ex) { DiscoverDiagnostics.Add("log.channel.achtergrondlijst_ophalen_mislukt", ex.Message); }
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

        internal static string GenreImageUrl(int genreId, string backdrop)
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
                    lock (TopBackdropCache)
                    {
                        TopBackdropCache[cacheKey] = new KeyValuePair<DateTime, List<string>>(DateTime.UtcNow, list);
                        CacheLimit.Trim(TopBackdropCache, 100, e => e.Key);
                    }
                return list;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("log.channel.achtergronden_mislukt", path, ex.Message);
                return new List<string>();
            }
        }

        // Zoals Seerr: de vijfde achtergrond uit de populairste titels van dat genre.
        private Task<string> GenreBackdrop(bool tv, int genreId, CancellationToken ct) => GenreBackdropFor(_tmdb, tv, genreId, ct);

        /// <summary>Ook gebruikt door de Discover-pagina (genretegels met foto), dezelfde cache van 12 uur.</summary>
        internal static async Task<string> GenreBackdropFor(TmdbClient tmdb, bool tv, int genreId, CancellationToken ct)
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
                var items = await tmdb.BrowsePages(tv, "&with_genres=" + genreId, 1, 1, ct).ConfigureAwait(false);
                var backs = items.Where(x => !string.IsNullOrEmpty(x.backdrop_path)).Select(x => x.backdrop_path).ToList();
                if (backs.Count > 0) chosen = backs.Count > 4 ? backs[4] : backs[backs.Count - 1];
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("log.channel.genre_achtergrond_mislukt", key, ex.Message);
                return null;
            }
            lock (GenreBackdropCache)
            {
                GenreBackdropCache[key] = new KeyValuePair<DateTime, string>(DateTime.UtcNow, chosen);
                CacheLimit.Trim(GenreBackdropCache, 200, e => e.Key);
            }
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
            // Eén gezamenlijk tijdbudget, zoals bij de hoofdmappen: met twintig genres en een koude cache zou
            // Emby anders minuten op ffmpeg staan wachten. Wat niet klaar is, wordt op de achtergrond afgemaakt
            // en staat de volgende keer klaar; tot die tijd gebruiken we de gewone afbeelding.
            var files = new string[genres.Count];
            var tileDeadline = DateTime.UtcNow.AddSeconds(20);
            for (int i = 0; i < creations.Length; i++)
            {
                var left = tileDeadline - DateTime.UtcNow;
                if (left > TimeSpan.Zero) { await Task.WhenAny(creations[i], Task.Delay(left)).ConfigureAwait(false); }
                if (!creations[i].IsCompleted) { _ = ObserveTileCreation(creations[i], names[i]); continue; }
                try { files[i] = await creations[i].ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("log.channel.genretegel_mislukt", names[i], ex.Message); }
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
            // Met een gezamenlijk tijdbudget: wat niet binnen 20 seconden klaar is, wordt op de achtergrond
            // afgemaakt en staat de volgende keer klaar (anders wacht Emby bij een koude cache heel lang).
            var sTasks = studios.Select((x, i) => FolderTile.CreateLogo("s" + x.Key, sUrls[i], x.Value, ct)).ToArray();
            var nTasks = networks.Select((x, i) => FolderTile.CreateLogo("n" + x.Key, nUrls[i], x.Value, ct)).ToArray();
            var all = Task.WhenAll(sTasks.Concat(nTasks).ToArray());
            if (await Task.WhenAny(all, Task.Delay(TimeSpan.FromSeconds(20))).ConfigureAwait(false) != all)
            {
                DiscoverDiagnostics.Add("log.channel.studiotegels_duren_langer_achtergrond");
                _ = ObserveTiles(all);
            }
            var sFiles = sTasks.Select(DoneOrNull).ToArray();
            var nFiles = nTasks.Select(DoneOrNull).ToArray();

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

        /// <summary>
        /// Een bewaarde lijst, met erbij of het om series gaat. Dat laatste stond eerder niet in de cache en werd
        /// uit de sleutelnaam geraden ("..._tv"); een tv-genrelijst (gt_18) of netwerklijst (n_213) viel daar
        /// buiten en gold dan als film, met de verkeerde titel als gevolg (TMDB-id's overlappen).
        /// </summary>
        private sealed class CachedList
        {
            public DateTime At;
            public List<TmdbItem> Items;
            public bool Tv;
        }

        private static readonly Dictionary<string, CachedList> ListCache = new Dictionary<string, CachedList>();

        private async Task<List<TmdbItem>> GetCachedList(string key, string path, CancellationToken ct, bool tv = false, string filter = null)
        {
            var cacheKey = TmdbClient.Language() + "|" + key;
            lock (ListCache)
            {
                CachedList hit;
                if (ListCache.TryGetValue(cacheKey, out hit) && DateTime.UtcNow - hit.At < ListCacheTtl) return hit.Items;
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
                DiscoverDiagnostics.Add("log.channel.fout_tmdb", path, ex.Message);
                throw;
            }
            lock (ListCache)
            {
                ListCache[cacheKey] = new CachedList { At = DateTime.UtcNow, Items = list, Tv = tv };
                CacheLimit.Trim(ListCache, 200, e => e.At);
            }
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
                // Marker goes after the title so it never affects title sorting.
                string suffix = states.TryGetValue(i.id, out var hasFiles) ? (hasFiles ? " \u2713" : " \u23F3") : "";
                // Zoals bij het Trailers-kanaal: de titel zelf is het item (geen map). Klik je erop, dan opent
                // de detailpagina; het ingebedde Emby-pluginresource-script voegt daar de knop "Aanvragen" toe.
                var f = new ChannelItemInfo
                {
                    Id = (request ? (tv ? AskTvItemPrefix : AskItemPrefix) : "") + (tv ? "t:" : "m:") + i.id,
                    Name = clean + suffix,
                    Type = request ? ChannelItemType.Folder : ChannelItemType.Media,
                    MediaType = ChannelMediaType.Video,
                    ContentType = ChannelMediaContentType.Trailer,
                    ImageUrl = TmdbClient.PosterUrl(i.poster_path),
                    Overview = WithDate(i, tv),
                    ProviderIds = new ProviderIdDictionary { { "DiscoverTmdb", i.id.ToString() } }
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

            _logger.Info("Discover: list '{0}': TMDB returned {1} items, after country filter {2}, returned to Emby: {3}, sort: {4} {5}",
                key, all.Count, candidates.Count, result.Count, sort ?? "(none)", desc ? "descending" : "ascending");
            return new ChannelItemResult { Items = result, TotalRecordCount = result.Count };
        }

        // ---------- Afspelen = YouTube-trailer (aanvragen gebeurt via de aparte knop / API) ----------
        public async Task<IEnumerable<MediaSourceInfo>> GetChannelItemMediaInfo(string id, CancellationToken ct)
        {
            DiscoverDiagnostics.Add("log.channel.trailer_afspelen", id);
            id = StripTileMark(id);
            bool isSeasonReq = id.StartsWith(AskSeasonPrefix);
            bool isAllReq = id.StartsWith(AskAllPrefix);
            bool isReq = id.StartsWith(AskPrefix) || isSeasonReq || isAllReq;
            int requestedSeason = 0;
            if (isSeasonReq)
            {
                var seasonParts = id.Substring(AskSeasonPrefix.Length).Split(':');
                int tmdbSeasonId;
                if (seasonParts.Length != 4 || seasonParts[0] != "t" || seasonParts[2] != "s" ||
                    !int.TryParse(seasonParts[1], out tmdbSeasonId) ||
                    !int.TryParse(seasonParts[3], out requestedSeason) || requestedSeason <= 0)
                    throw new InvalidOperationException(DiscoverLanguage.T("channel.unknown_season_request_item") + id);
                id = seasonParts[0] + ":" + tmdbSeasonId;
            }
            else if (isAllReq) id = id.Substring(AskAllPrefix.Length);
            else if (id.StartsWith(AskPrefix)) id = id.Substring(AskPrefix.Length);
            else if (id.StartsWith(TrailerPrefix)) id = id.Substring(TrailerPrefix.Length);

            bool tv = false;
            int tmdbId = 0;
            if (id.StartsWith("m:") || id.StartsWith("t:"))
            {
                tv = id[0] == 't';
                // Het id komt van de client, dus een rare waarde mag geen harde fout geven.
                if (!int.TryParse(id.Substring(2), NumberStyles.Integer, CultureInfo.InvariantCulture, out tmdbId) || tmdbId <= 0)
                {
                    throw new InvalidOperationException(DiscoverLanguage.T("channel.unknown_discover_item") + id);
                }
            }
            else
            {
                throw new InvalidOperationException(DiscoverLanguage.T("channel.unknown_discover_item") + id);
            }

            if (isReq)
            {
                // Let op: Emby roept deze methode ook aan zodra de detailpagina opent (voor "Media informatie"),
                // dus hier mag NIETS aangevraagd worden. De echte aanvraag gebeurt bij het starten van het afspelen
                // (zie RequestOnPlay). De kaart toont de situatie van nu: "Aangevraagd" of "Staat al in Radarr/Sonarr".
                try
                {
                    if (isSeasonReq) { DiscoverDiagnostics.Add("log.channel.season_request_clip", requestedSeason); }
                    else { DiscoverDiagnostics.Add("log.channel.request_clip_all_seasons"); }
                    TmdbItem info = FindInCache(tv, tmdbId);
                    if (info == null)
                        info = tv ? await _tmdb.GetTv(tmdbId, ct).ConfigureAwait(false)
                                  : await _tmdb.GetMovie(tmdbId, ct).ConfigureAwait(false);
                    // Alles tegelijk ophalen: extra info (TMDB), status (Radarr/Sonarr) en bij een seizoen de seizoensposter (TMDB).
                    var extraTask = SafeExtra(tv, tmdbId, ct);
                    var statesTask = SafeStates(tv, ct);
                    var posterTask = isSeasonReq ? SafeSeasonPoster(tmdbId, requestedSeason, ct) : Task.FromResult<string>(null);
                    await Task.WhenAll(extraTask, statesTask, posterTask).ConfigureAwait(false);
                    var extra = await extraTask.ConfigureAwait(false);
                    var states = await statesTask.ConfigureAwait(false);
                    string seasonPoster = await posterTask.ConfigureAwait(false);
                    bool hasFiles;
                    bool there = states.TryGetValue(tmdbId, out hasFiles);

                    // Wacht tot de staande kaart klaar is (bij een koude start duurt ffmpeg enkele seconden); pas daarna de vaste liggende clip.
                    // Bij een seizoensaanvraag staat op de kaart de poster van dat seizoen (als TMDB er een heeft).
                    var cardTask = RequestCard.Create(info, extra, tv, there, CancellationToken.None, requestedSeason, seasonPoster);
                    _ = cardTask.ContinueWith(x => { var ignored = x.Exception; }, TaskContinuationOptions.OnlyOnFaulted);
                    var first = await Task.WhenAny(cardTask, Task.Delay(60000, ct)).ConfigureAwait(false);
                    if (first != cardTask)
                    {
                        // Emby heeft het verzoek zelf afgebroken (bv. detailpagina gesloten): geen vaste clip teruggeven,
                        // de kaart wordt op de achtergrond afgemaakt en staat bij de volgende keer klaar.
                        ct.ThrowIfCancellationRequested();
                        throw new TimeoutException("card not ready yet");
                    }
                    var card = await cardTask.ConfigureAwait(false);
                    DiscoverDiagnostics.Add("log.channel.kaartclip", card);
                    return new List<MediaSourceInfo>
                    {
                        new MediaSourceInfo
                        {
                            Id = "discover-requested-" + (tv ? "t" : "m") + tmdbId,
                            Name = DiscoverLanguage.T("channel.requested"),
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
                    _logger.Error("Discover: card clip failed for {0}: {1}", id, ex.Message);
                    DiscoverDiagnostics.Add("log.channel.kaartclip_vaste_clip_gebruikt", id, ex.Message);
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
                    _logger.Error("Discover: fetching trailer failed for {0}: {1}", id, ex.Message);
                    DiscoverDiagnostics.Add("log.channel.fout_trailer", id, ex.Message);
                    throw new InvalidOperationException(DiscoverLanguage.T("channel.fetching_the_trailer_failed") + ex.Message);
                }

                if (string.IsNullOrEmpty(ytKey))
                {
                    DiscoverDiagnostics.Add("log.channel.geen_youtube_trailer_voor", id);
                    _logger.Info("Discover: no YouTube trailer for {0}", id);
                    throw new InvalidOperationException(DiscoverLanguage.T("channel.no_trailer_available_for_this_title"));
                }

                var path = "https://www.youtube.com/watch?v=" + ytKey;
                DiscoverDiagnostics.Add("log.channel.trailer", id, path);
                _logger.Info("Discover: trailer for {0}: {1}", id, path);
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
                _logger.Error("Discover: clip not available: {0}", ex.Message);
                DiscoverDiagnostics.Add("log.channel.fout_clip", ex.Message);
                throw new InvalidOperationException(DiscoverLanguage.T("channel.no_trailer_available_for_this_title"));
            }

            return new List<MediaSourceInfo>
            {
                new MediaSourceInfo
                {
                    Id = "discover-requested",
                    Name = DiscoverLanguage.T("channel.requested"),
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
        internal static async Task<string> RequestTitle(TmdbClient tmdb, ArrClient arr, bool tv, int tmdbId, int[] seasons, CancellationToken ct, object embyUserId = null, string alias = null)
        {
            bool added;
            if (tv)
            {
                var t = await tmdb.GetTv(tmdbId, ct).ConfigureAwait(false);
                var ext = await tmdb.GetTvExternalIds(tmdbId, ct).ConfigureAwait(false);
                int tvdbId = ext?.tvdb_id ?? 0;
                if (tvdbId <= 0 && RequestHub.NeedsTvdbId)
                    tvdbId = await arr.ResolveTvdbId(tmdbId, ext?.imdb_id, t.name ?? t.title, t.first_air_date, ct).ConfigureAwait(false);
                if (tvdbId <= 0 && RequestHub.NeedsTvdbId)
                    throw new InvalidOperationException(DiscoverLanguage.T("channel.this_series_is_not_on_thetvdb_so_sonarr"));
                added = await arr.AddSeries(tmdbId, tvdbId, t.name ?? t.title, seasons, ct, embyUserId, alias).ConfigureAwait(false);
            }
            else
            {
                var m = await tmdb.GetMovie(tmdbId, ct).ConfigureAwait(false);
                added = await arr.AddMovie(tmdbId, m.title ?? m.name, YearOf(m.release_date) ?? 0, ct, embyUserId, null, alias).ConfigureAwait(false);
            }
            DiscoverDiagnostics.CountRequest(true);
            return added
                ? (seasons != null && seasons.Length > 0
                    ? DiscoverLanguage.T("channel.requested_season") + string.Join(", ", seasons)
                    : DiscoverLanguage.T("channel.requested_2"))
                : DiscoverLanguage.T("channel.already_in") + ArrClient.ServiceName(tv);
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
                    bool isTv = kv.Value.Tv;
                    foreach (var i in kv.Value.Items)
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
                _logger.Error("Discover: fetching status failed: {0}", ex.Message);
                DiscoverDiagnostics.Add("log.channel.fout_status", (tv ? "Sonarr" : "Radarr"), ex.Message);
                return new Dictionary<int, bool>();
            }
        }

        private static string TitleOf(TmdbItem i, bool tv) =>
            tv ? (i.name ?? i.title ?? "?") : (i.title ?? i.name ?? "?");

        private static int? YearOf(string date) =>
            !string.IsNullOrEmpty(date) && date.Length >= 4 && int.TryParse(date.Substring(0, 4), out var y) ? y : (int?)null;
    }
}
