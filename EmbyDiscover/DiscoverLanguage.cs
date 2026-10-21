using System;

namespace Emby.Plugins.Discover
{
    internal static class DiscoverLanguage
    {
        public const string Auto = "auto";
        public const string English = "en-US";
        public const string Dutch = "nl-NL";

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

                return FromEmbyCulture(Plugin.Instance.ServerUiCulture);
            }
        }

        public static bool IsDutch => PluginLanguage == Dutch;

        public static string Text(string dutch, string english) => IsDutch ? dutch : english;

        public static string FromEmbyCulture(string culture) => Normalize(culture);

        private static string Normalize(string culture) =>
            !string.IsNullOrWhiteSpace(culture) &&
            culture.Trim().StartsWith("nl", StringComparison.OrdinalIgnoreCase)
                ? Dutch
                : English;
    }
}
