using System;
using System.Collections.Generic;

namespace Emby.Plugins.Discover
{
    internal static class DiscoverLanguage
    {
        public const string Auto = "auto";
        public const string English = "en-US";
        public const string Dutch = "nl-NL";
        public const string German = "de-DE";
        public const string Norwegian = "nb-NO";

        /// <summary>
        /// De talen die de plugin kent, op volgorde van de keuzelijst. De naam staat in de taal zelf,
        /// want een vlag is een land en geen taal (Engels, Spaans en Portugees horen bij meerdere landen).
        /// De cultuurcode gaat naar TMDB en naar de browserscripts.
        /// </summary>
        internal struct LanguageInfo
        {
            public string Code;     // korte code, ook de naam van het taalbestand (en.json, pt-br.json)
            public string Culture;  // cultuurcode voor TMDB en Emby
            public string Name;     // naam in de taal zelf
            public LanguageInfo(string code, string culture, string name) { Code = code; Culture = culture; Name = name; }
        }

        internal static readonly LanguageInfo[] Known =
        {
            new LanguageInfo("en", "en-US", "English"),
            new LanguageInfo("nl", "nl-NL", "Nederlands"),
            new LanguageInfo("de", "de-DE", "Deutsch"),
            new LanguageInfo("nb", "nb-NO", "Norsk"),
        };

        /// <summary>De korte taalcode die nu geldt ("nl", "de", "pt-br", ...), altijd een taal die bestaat.</summary>
        public static string Code
        {
            get
            {
                var configured = Plugin.GetCurrentConfiguration().PluginLanguage;
                if (string.IsNullOrWhiteSpace(configured) || string.Equals(configured, Auto, StringComparison.OrdinalIgnoreCase))
                {
                    configured = Plugin.Instance == null ? null : Plugin.Instance.ServerUiCulture;
                }
                return ResolveCode(configured);
            }
        }

        /// <summary>Zoekt bij een cultuurcode van Emby of van de browser de taal die de plugin heeft.</summary>
        public static string ResolveCode(string culture)
        {
            if (string.IsNullOrWhiteSpace(culture)) { return "en"; }
            var value = culture.Trim().ToLowerInvariant().Replace('_', '-');
            if (DiscoverStrings.Has(value)) { return value; }

            var dash = value.IndexOf('-');
            var baseCode = dash < 0 ? value : value.Substring(0, dash);
            if (baseCode == "nn" || baseCode == "no") { baseCode = "nb"; }
            if (DiscoverStrings.Has(baseCode)) { return baseCode; }

            // Chinees valt niet terug op "zh": vereenvoudigd en traditioneel zijn twee schriften.
            if (baseCode == "zh")
            {
                var traditional = value.Contains("hant") || value.Contains("tw") || value.Contains("hk") || value.Contains("mo");
                var wanted = traditional ? "zh-tw" : "zh-cn";
                if (DiscoverStrings.Has(wanted)) { return wanted; }
            }
            // Een variant zonder eigen bestand (pt-pt zonder pt-pt.json) mag naar een andere variant.
            foreach (var code in DiscoverStrings.Codes)
            {
                if (code.StartsWith(baseCode + "-", StringComparison.Ordinal)) { return code; }
            }
            return "en";
        }

        /// <summary>De cultuurcode van de huidige taal (voor TMDB en de scripts), bv. "nl-NL".</summary>
        public static string PluginLanguage { get { return CultureOf(Code); } }

        public static string CultureOf(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) { return English; }
            // Een taalbestand mag zijn eigen cultuurcode meebrengen (language.culture).
            var own = DiscoverStrings.Own(code, "language.culture");
            if (!string.IsNullOrWhiteSpace(own)) { return own; }
            foreach (var info in Known)
            {
                if (string.Equals(info.Code, code, StringComparison.OrdinalIgnoreCase)) { return info.Culture; }
            }
            // Onbekende taal (eigen bestand van een gebruiker): "pt-br" wordt "pt-BR", "es" blijft "es".
            var dash = code.IndexOf('-');
            if (dash < 0) { return code.ToLowerInvariant(); }
            return code.Substring(0, dash).ToLowerInvariant() + "-" + code.Substring(dash + 1).ToUpperInvariant();
        }

        /// <summary>Naam van een taal in de taal zelf; voor een onbekende taal de code.</summary>
        public static string NameOf(string code)
        {
            // Een taalbestand mag zijn eigen naam meebrengen (language.name), in die taal zelf.
            var own = DiscoverStrings.Own(code, "language.name");
            if (!string.IsNullOrWhiteSpace(own)) { return own; }
            foreach (var info in Known)
            {
                if (string.Equals(info.Code, code, StringComparison.OrdinalIgnoreCase)) { return info.Name; }
            }
            return code;
        }

        /// <summary>Alle talen die te kiezen zijn: de meegeleverde plus eigen bestanden van de gebruiker.</summary>
        public static List<LanguageInfo> Available()
        {
            var list = new List<LanguageInfo>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var info in Known)
            {
                if (DiscoverStrings.Has(info.Code) && seen.Add(info.Code)) { list.Add(info); }
            }
            foreach (var code in DiscoverStrings.Codes)
            {
                if (seen.Add(code)) { list.Add(new LanguageInfo(code, CultureOf(code), NameOf(code))); }
            }
            return list;
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

        /// <summary>Taal staat op Automatisch: de browser-scripts volgen dan de taal van de Emby-app van de kijker.</summary>
        public static bool IsAuto
        {
            get
            {
                var configured = Plugin.GetCurrentConfiguration().PluginLanguage;
                return string.IsNullOrWhiteSpace(configured) || string.Equals(configured, Auto, StringComparison.OrdinalIgnoreCase);
            }
        }

        public static bool IsDutch { get { return Code == "nl"; } }
        public static bool IsGerman { get { return Code == "de"; } }
        public static bool IsNorwegian { get { return Code == "nb"; } }

        /// <summary>Cultuur van de huidige taal, voor datums en getallen in teksten.</summary>
        public static System.Globalization.CultureInfo Culture
        {
            get
            {
                try { return new System.Globalization.CultureInfo(PluginLanguage); }
                catch { return System.Globalization.CultureInfo.InvariantCulture; }
            }
        }

        /// <summary>De tekst bij een sleutel, in de taal van de plugin. Engels is de terugval.</summary>
        public static string T(string key) { return DiscoverStrings.Get(Code, key); }

        /// <summary>Zelfde, maar met {0}, {1}, ... ingevuld.</summary>
        public static string T(string key, params object[] args)
        {
            var format = DiscoverStrings.Get(Code, key);
            if (args == null || args.Length == 0) { return format; }
            try { return string.Format(System.Globalization.CultureInfo.InvariantCulture, format, args); }
            catch { return format; }
        }

        // De oude vorm Text(nl, en, de, nb) met de tekst per taal in de code staat hier niet meer:
        // die gaf de twaalf andere talen altijd Engels. Elke tekst hoort in de taalbestanden,
        // via T("sleutel"), zodat hij te vertalen is.

        public static string FromEmbyCulture(string culture) { return CultureOf(ResolveCode(culture)); }
    }
}
