using System;

namespace Emby.Plugins.Discover
{
    internal static class DiscoverLanguage
    {
        public const string Auto = "auto";
        public const string English = "en-US";
        public const string Dutch = "nl-NL";
        public const string German = "de-DE";

        public static string PluginLanguage
        {
            get
            {
                var config = Plugin.GetCurrentConfiguration();
                var configured = config.PluginLanguage;
                if (string.IsNullOrWhiteSpace(configured) ||
                    string.Equals(configured, Auto, StringComparison.OrdinalIgnoreCase))
                {
                    return FromEmbyCulture(Plugin.Instance.ServerUiCulture);
                }

                return Normalize(configured);
            }
        }

        public static string TmdbLanguage
        {
            get
            {
                var config = Plugin.GetCurrentConfiguration();
                if (string.Equals(config.TmdbLanguageMode, "manual", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrWhiteSpace(config.TmdbLanguage))
                {
                    return config.TmdbLanguage.Trim();
                }

                return PluginLanguage;
            }
        }

        public static bool IsDutch => PluginLanguage == Dutch;
        public static bool IsGerman => PluginLanguage == German;

        public static string Text(string dutch, string english, string german = null) =>
            IsDutch ? dutch : IsGerman ? (german ?? english) : english;

        public static string FromEmbyCulture(string culture) => Normalize(culture);

        private static string Normalize(string culture)
        {
            if (string.IsNullOrWhiteSpace(culture)) return English;
            var normalized = culture.Trim();
            if (normalized.StartsWith("nl", StringComparison.OrdinalIgnoreCase)) return Dutch;
            if (normalized.StartsWith("de", StringComparison.OrdinalIgnoreCase)) return German;
            return English;
        }
    }
}
