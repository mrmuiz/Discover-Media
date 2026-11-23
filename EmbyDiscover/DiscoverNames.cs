using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Namen van talen en landen in de taal van de plugin. Eén plek, zodat het infoblok van de popup
    /// en de gegevens van de webscripts hetzelfde zeggen. De namen staan in de taalbestanden
    /// (info.lang.en, info.country.US); een onbekende code valt terug op .NET en anders op de code zelf.
    /// </summary>
    internal static class DiscoverNames
    {
        /// <summary>Naam van een taal ("en", "nl-NL") in de taal van de plugin, of null bij een lege code.</summary>
        internal static string Language(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) { return null; }
            var value = code.Trim();
            var key = "info.lang." + value.ToLowerInvariant();
            var name = DiscoverStrings.Find(DiscoverLanguage.Code, key);
            if (!string.IsNullOrWhiteSpace(name)) { return name; }

            // "pt-BR" zonder eigen naam valt terug op "pt".
            var dash = value.IndexOf('-');
            if (dash > 0)
            {
                name = DiscoverStrings.Find(DiscoverLanguage.Code, "info.lang." + value.Substring(0, dash).ToLowerInvariant());
                if (!string.IsNullOrWhiteSpace(name)) { return name; }
            }
            try { return CultureInfo.GetCultureInfo(value).DisplayName; }
            catch { return value.ToUpperInvariant(); }
        }

        /// <summary>Naam van een land ("US", "nl"); de terugval is de naam die TMDB meestuurt.</summary>
        internal static string Country(string code, string fallback)
        {
            if (!string.IsNullOrWhiteSpace(code))
            {
                var name = DiscoverStrings.Find(DiscoverLanguage.Code, "info.country." + code.Trim().ToUpperInvariant());
                if (!string.IsNullOrWhiteSpace(name)) { return name; }
            }
            if (!string.IsNullOrWhiteSpace(fallback)) { return fallback.Trim(); }
            try { return new RegionInfo(code).DisplayName; }
            catch { return (code ?? "").ToUpperInvariant(); }
        }

        /// <summary>Namen van landen achter elkaar, zonder dubbele en zonder lege.</summary>
        internal static string Countries(IEnumerable<string> codes)
        {
            if (codes == null) { return null; }
            var names = codes.Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => Country(c, null))
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Distinct()
                .ToList();
            return names.Count == 0 ? null : string.Join(", ", names);
        }

        /// <summary>
        /// Het land waarvan verschijningsdata en keuringen gelden: het land van de plugin-taal
        /// ("nl-NL" wordt NL, "pt-BR" wordt BR), anders de Verenigde Staten.
        /// </summary>
        internal static string Region
        {
            get
            {
                try
                {
                    var culture = CultureInfo.GetCultureInfo(DiscoverLanguage.PluginLanguage);
                    // Een taal zonder land ("es", "ja") heeft geen land; .NET kent er het gebruikelijke bij.
                    if (culture.IsNeutralCulture) { culture = CultureInfo.CreateSpecificCulture(culture.Name); }
                    var region = new RegionInfo(culture.Name).TwoLetterISORegionName;
                    if (!string.IsNullOrWhiteSpace(region)) { return region.ToUpperInvariant(); }
                }
                catch { }
                return "US";
            }
        }
    }
}
