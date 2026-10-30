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

        public string SonarrUrl { get; set; } = "";
        public string SonarrApiKey { get; set; } = "";
        public int SonarrQualityProfileId { get; set; } = 0;
        public string SonarrRootFolder { get; set; } = "";

        /// <summary>Optioneel: map van de Emby-webclient (met index.html) als die niet vanzelf gevonden wordt.</summary>
        public string DashboardUiPath { get; set; } = "";

        /// <summary>Als dit aan staat, zet de plugin een klein lader-script in de index.html van de Emby-webclient,
        /// zodat een tik op de tegel/menu-ingang "Discover Media" meteen de Discover-pagina opent (in de browser
        /// en in apps die de webclient van de server laden) en de Aanvragen-knop overal werkt. Standaard uit.</summary>
        public bool InjectWebClientLoader { get; set; } = false;

        /// <summary>Optioneel: volledig pad naar ffmpeg, voor de bevestigingskaart per titel. Leeg = zoeken op gangbare plekken.</summary>
        public string FfmpegPath { get; set; } = "";

        /// <summary>Toon de tegelnaam als tekst op kanaaltegelafbeeldingen. Op false = plaatjes zonder toegevoegde tekst.</summary>
        public bool TileTextImages { get; set; } = true;

        /// <summary>Toon de tegel Trailer naast Aanvragen in het kanaal en de Trailer-knop op de Discover-pagina. Uit = alleen Aanvragen.</summary>
        public bool ShowTrailerTile { get; set; } = true;

        // Oorspronkelijke talen (ISO 639-1, komma-gescheiden, bv. "ja,ko,hi") die niet in rijen/mappen verschijnen.
        public string ExcludedOriginalLanguages { get; set; } = "";
    }
}
