using MediaBrowser.Model.Plugins;

namespace Emby.Plugins.Discover
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public string TmdbApiKey { get; set; } = "";
        public string TmdbLanguage { get; set; } = "nl-NL";

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

        /// <summary>Optioneel: volledig pad naar ffmpeg, voor de bevestigingskaart per titel. Leeg = zoeken op gangbare plekken.</summary>
        public string FfmpegPath { get; set; } = "";

        /// <summary>Zet de Engelse naam als tekst op de plaatjes van de hoofdmappen. Op false (in Emby.Plugins.Discover.xml) = plaatjes zonder tekst, zoals in 0.23.</summary>
        public bool TileTextImages { get; set; } = true;
    }
}
