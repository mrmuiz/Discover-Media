using MediaBrowser.Model.Plugins;

namespace Emby.Plugins.Discover
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public string TmdbApiKey { get; set; } = "";
        public string TmdbLanguage { get; set; } = "nl-NL";
        public string TmdbLanguageMode { get; set; } = "auto";
        public string PluginLanguage { get; set; } = "auto";
        public bool ShowDiagnostics { get; set; } = false;
        public bool DiagnosticsDefaultApplied { get; set; } = false;

        public string RadarrUrl { get; set; } = "";
        public string RadarrApiKey { get; set; } = "";
        // 0 / leeg = eerste profiel / eerste root folder uit Radarr
        public int RadarrQualityProfileId { get; set; } = 0;
        public string RadarrRootFolder { get; set; } = "";
        /// <summary>Radarr "Minimum availability" for new movies: announced, inCinemas or released (default).</summary>
        public string RadarrMinimumAvailability { get; set; } = "released";
        /// <summary>Accept https certificates that do not validate (self-signed / by IP) for Radarr, Sonarr, Seerr and download clients.</summary>
        public bool AllowInvalidCertificates { get; set; }
        /// <summary>Dagelijks bij GitHub kijken naar een nieuwe Discover (melding op de instellingenpagina).</summary>
        public bool UpdateCheck { get; set; } = true;
        /// <summary>Nieuwe versie 's nachts zelf installeren.</summary>
        public bool UpdateAutoInstall { get; set; }
        /// <summary>Na automatisch installeren Emby herstarten zodra niemand iets afspeelt.</summary>
        public bool UpdateAutoRestart { get; set; }
        /// <summary>Ook testversies (pre-releases op GitHub).</summary>
        public bool UpdateIncludeBeta { get; set; }

        public string SonarrUrl { get; set; } = "";
        public string SonarrApiKey { get; set; } = "";
        public int SonarrQualityProfileId { get; set; } = 0;
        public string SonarrRootFolder { get; set; } = "";

        /// <summary>Waarheen aanvragen gaan: "arr" = rechtstreeks naar Radarr en Sonarr (standaard), "seerr" = via Seerr.</summary>
        public string RequestService { get; set; } = "arr";
        /// <summary>Alleen bij Seerr: ook de wachtrij van Radarr en Sonarr lezen voor de echte importfases en de reden bij een probleem.</summary>
        public bool SeerrArrStatus { get; set; } = false;
        public string SeerrUrl { get; set; } = "";
        public string SeerrApiKey { get; set; } = "";

        /// <summary>Optioneel: SABnzbd voor snelheid en de fases na 100% (verifiëren, repareren, uitpakken, verplaatsen, script).</summary>
        public string SabUrl { get; set; } = "";
        public string SabApiKey { get; set; } = "";
        /// <summary>Optioneel: andere downloaders (snelheid, fases, seeders, ratio). Gebruikersnaam en wachtwoord zijn van de webinterface van de downloader.</summary>
        public string QbitUrl { get; set; } = "";
        public string QbitUser { get; set; } = "";
        public string QbitPassword { get; set; } = "";
        public string NzbgetUrl { get; set; } = "";
        public string NzbgetUser { get; set; } = "";
        public string NzbgetPassword { get; set; } = "";
        public string TransmissionUrl { get; set; } = "";
        public string TransmissionUser { get; set; } = "";
        public string TransmissionPassword { get; set; } = "";

        /// <summary>Maximaal aantal aanvragen per gebruiker binnen RequestLimitDays (0 = geen limiet). Beheerders tellen niet mee. In de Seerr-modus regelt Seerr dit.</summary>
        public int RequestLimit { get; set; } = 0;
        public int RequestLimitDays { get; set; } = 7;

        /// <summary>Optioneel: Trakt-watchlist als rij op de Discover-pagina (openbaar profiel nodig).</summary>
        public string TraktUser { get; set; } = "";
        public string TraktClientId { get; set; } = "";
        /// <summary>Optioneel: openbare TMDB-lijst (id of link) als rij op de Discover-pagina.</summary>
        public string TmdbListId { get; set; } = "";
        /// <summary>OMDb API-sleutel (omdbapi.com) voor de scores van IMDb, Rotten Tomatoes en Metacritic.</summary>
        public string OmdbApiKey { get; set; } = "";
        /// <summary>IMDb-, Rotten Tomatoes- en Metacritic-scores in de popup (alleen met een OMDb-sleutel).</summary>
        public bool ShowOmdbRatings { get; set; } = true;
        /// <summary>Titellogo (TMDB, anders fanart.tv) in plaats van de titel als tekst bovenaan de popup.</summary>
        public bool ShowTitleLogo { get; set; } = true;
        /// <summary>Optionele fanart.tv-sleutel (Personal API Key): reserve voor titellogo's die TMDB niet heeft.</summary>
        public string FanartApiKey { get; set; } = "";
        /// <summary>Optionele MDBList-sleutel: scores van IMDb, Rotten Tomatoes (critici en publiek), Metacritic, Letterboxd en Trakt. Gaat voor OMDb.</summary>
        public string MdblistApiKey { get; set; } = "";
        /// <summary>Bij een lopende serie de volgende aflevering (TVmaze, geen sleutel nodig) in het infoblok van de popup.</summary>
        public bool ShowNextEpisode { get; set; } = true;
        /// <summary>Jaar onder de posters.</summary>
        public bool PosterShowYear { get; set; } = true;
        /// <summary>Specials (seizoen 0) als keuze bij de seizoenen van een serie.</summary>
        public bool ShowSpecials { get; set; } = true;
        /// <summary>TMDB-score onder de posters.</summary>
        public bool PosterShowScore { get; set; } = true;
        /// <summary>Score onder de posters: tmdb, imdb (IMDb-dataset) of none. Leeg = migratie vanuit PosterShowScore (aan = tmdb).</summary>
        public string PosterScoreSource { get; set; } = "";
        public string EffPosterScoreSource
        {
            get
            {
                var s = (PosterScoreSource ?? "").Trim().ToLowerInvariant();
                if (s == "tmdb" || s == "imdb" || s == "none") return s;
                return PosterShowScore ? "tmdb" : "none";
            }
        }
        /// <summary>Themakleur (knoppen, focus, accenten) als #rrggbb.</summary>
        public string AccentColor { get; set; } = "#ffb400";
        /// <summary>Rij "Onlangs toegevoegd" op de Discover-pagina.</summary>
        public bool ShowRecentlyAdded { get; set; } = true;
        /// <summary>Rij "Recente aanvragen" (van iedereen) op de Discover-pagina.</summary>
        public bool ShowRecentRequests { get; set; } = true;
        /// <summary>Rij "Mijn aanvragen" bovenaan de Discover-pagina.</summary>
        public bool ShowMyRequests { get; set; } = true;
        /// <summary>Rij "Nieuwe seizoenen" (series in de bibliotheek met een nieuwer seizoen op TMDB).</summary>
        public bool ShowNewSeasons { get; set; } = true;

        /// <summary>Optioneel: map van de Emby-webclient (met index.html) als die niet vanzelf gevonden wordt.</summary>
        public string DashboardUiPath { get; set; } = "";

        /// <summary>Als dit aan staat, zet de plugin een klein lader-script in de index.html van de Emby-webclient,
        /// zodat een tik op de tegel/menu-ingang "Discover Media" meteen de Discover-pagina opent (in de browser
        /// en in apps die de webclient van de server laden) en de Aanvragen-knop overal werkt. Standaard uit.</summary>
        public bool InjectWebClientLoader { get; set; } = true;

        /// <summary>Eenmalig: bestaande installaties (loader stond standaard uit) krijgen de loader één keer aan; daarna beslist de gebruiker.</summary>
        public bool LoaderDefaultApplied { get; set; } = false;

        /// <summary>Optioneel: volledig pad naar ffmpeg, voor de bevestigingskaart per titel. Leeg = zoeken op gangbare plekken.</summary>
        public string FfmpegPath { get; set; } = "";

        /// <summary>Toon de tegelnaam als tekst op kanaaltegelafbeeldingen. Op false = plaatjes zonder toegevoegde tekst.</summary>
        public bool TileTextImages { get; set; } = true;

        /// <summary>Toon de tegel Trailer naast Aanvragen in het kanaal en de Trailer-knop op de Discover-pagina. Uit = alleen Aanvragen.</summary>
        public bool ShowTrailerTile { get; set; } = true;

        // Oorspronkelijke talen (ISO 639-1, komma-gescheiden, bv. "ja,ko,hi") die niet in rijen/mappen verschijnen.
        public string ExcludedOriginalLanguages { get; set; } = "";

        /// <summary>Kaartclips en tekst-tegels per titel vooraf maken (tijdens de kanaalverversing). Uit = alleen als iemand ze nodig heeft.</summary>
        public bool PrecreateCards { get; set; } = false;
        /// <summary>Bewaartermijn kaartclips in dagen (0 = niet op leeftijd opruimen).</summary>
        public int CardRetentionDays { get; set; } = 14;
        /// <summary>Bewaartermijn tegelplaatjes in dagen (0 = niet op leeftijd opruimen).</summary>
        public int TileRetentionDays { get; set; } = 30;
        /// <summary>Maximale grootte van kaarten en tegels samen in MB (0 = geen limiet). Daarboven gaan de oudste bestanden eerst weg.</summary>
        public int MaxCacheMb { get; set; } = 2048;

        /// <summary>Emby-gebruikers (id, komma-gescheiden) die NIET mogen aanvragen. Leeg = iedereen mag.</summary>
        public string BlockedUserIds { get; set; } = "";
    }
}
