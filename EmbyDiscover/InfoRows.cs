using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Emby.Plugins.Discover
{
    /// <summary>Eén waarde in een regel van het infoblok; Icon (ticket/cloud/disc) of Flag (landcode) optioneel.</summary>
    public class DiscoverInfoItem
    {
        public string Text { get; set; }
        public string Icon { get; set; }
        public string Flag { get; set; }
        public string Hint { get; set; }
    }

    public class DiscoverInfoRow
    {
        public string Label { get; set; }
        public List<DiscoverInfoItem> Items { get; set; } = new List<DiscoverInfoItem>();
        /// <summary>Toon de eerste N items, de rest achter "Meer tonen" (0 = alles).</summary>
        public int Show { get; set; }
    }

    public class DiscoverInfoLink
    {
        public string Name { get; set; }
        public string Url { get; set; }
    }

    /// <summary>Infoblok van de popup als tabel (label links, waarde rechts) met links eronder, zoals Seerr het doet.</summary>
    internal static class InfoRows
    {
        private static string T(string nl, string en, string de, string nb = null) => DiscoverLanguage.Text(nl, en, de, nb);

        private static CultureInfo Culture
        {
            get
            {
                try { return CultureInfo.GetCultureInfo(DiscoverLanguage.PluginLanguage); }
                catch { return CultureInfo.InvariantCulture; }
            }
        }

        private static string Region =>
            DiscoverLanguage.IsDutch ? "NL" : DiscoverLanguage.IsGerman ? "DE" : DiscoverLanguage.IsNorwegian ? "NO" : "US";

        private static readonly Dictionary<string, string[]> Languages = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            // nl, en, de, nb
            { "en", new[] { "Engels", "English", "Englisch", "Engelsk" } },
            { "nl", new[] { "Nederlands", "Dutch", "Niederländisch", "Nederlandsk" } },
            { "de", new[] { "Duits", "German", "Deutsch", "Tysk" } },
            { "fr", new[] { "Frans", "French", "Französisch", "Fransk" } },
            { "es", new[] { "Spaans", "Spanish", "Spanisch", "Spansk" } },
            { "it", new[] { "Italiaans", "Italian", "Italienisch", "Italiensk" } },
            { "pt", new[] { "Portugees", "Portuguese", "Portugiesisch", "Portugisisk" } },
            { "ja", new[] { "Japans", "Japanese", "Japanisch", "Japansk" } },
            { "ko", new[] { "Koreaans", "Korean", "Koreanisch", "Koreansk" } },
            { "zh", new[] { "Chinees", "Chinese", "Chinesisch", "Kinesisk" } },
            { "sv", new[] { "Zweeds", "Swedish", "Schwedisch", "Svensk" } },
            { "da", new[] { "Deens", "Danish", "Dänisch", "Dansk" } },
            { "no", new[] { "Noors", "Norwegian", "Norwegisch", "Norsk" } },
            { "nb", new[] { "Noors", "Norwegian", "Norwegisch", "Norsk" } },
            { "fi", new[] { "Fins", "Finnish", "Finnisch", "Finsk" } },
            { "pl", new[] { "Pools", "Polish", "Polnisch", "Polsk" } },
            { "ru", new[] { "Russisch", "Russian", "Russisch", "Russisk" } },
            { "tr", new[] { "Turks", "Turkish", "Türkisch", "Tyrkisk" } },
            { "hi", new[] { "Hindi", "Hindi", "Hindi", "Hindi" } },
            { "th", new[] { "Thai", "Thai", "Thailändisch", "Thai" } },
        };

        private static readonly Dictionary<string, string[]> Countries = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            { "US", new[] { "Verenigde Staten", "United States", "Vereinigte Staaten", "USA" } },
            { "GB", new[] { "Verenigd Koninkrijk", "United Kingdom", "Vereinigtes Königreich", "Storbritannia" } },
            { "NL", new[] { "Nederland", "Netherlands", "Niederlande", "Nederland" } },
            { "BE", new[] { "België", "Belgium", "Belgien", "Belgia" } },
            { "DE", new[] { "Duitsland", "Germany", "Deutschland", "Tyskland" } },
            { "FR", new[] { "Frankrijk", "France", "Frankreich", "Frankrike" } },
            { "ES", new[] { "Spanje", "Spain", "Spanien", "Spania" } },
            { "IT", new[] { "Italië", "Italy", "Italien", "Italia" } },
            { "CA", new[] { "Canada", "Canada", "Kanada", "Canada" } },
            { "AU", new[] { "Australië", "Australia", "Australien", "Australia" } },
            { "NZ", new[] { "Nieuw-Zeeland", "New Zealand", "Neuseeland", "New Zealand" } },
            { "IE", new[] { "Ierland", "Ireland", "Irland", "Irland" } },
            { "JP", new[] { "Japan", "Japan", "Japan", "Japan" } },
            { "KR", new[] { "Zuid-Korea", "South Korea", "Südkorea", "Sør-Korea" } },
            { "CN", new[] { "China", "China", "China", "Kina" } },
            { "IN", new[] { "India", "India", "Indien", "India" } },
            { "SE", new[] { "Zweden", "Sweden", "Schweden", "Sverige" } },
            { "DK", new[] { "Denemarken", "Denmark", "Dänemark", "Danmark" } },
            { "NO", new[] { "Noorwegen", "Norway", "Norwegen", "Norge" } },
            { "FI", new[] { "Finland", "Finland", "Finnland", "Finland" } },
            { "MX", new[] { "Mexico", "Mexico", "Mexiko", "Mexico" } },
            { "BR", new[] { "Brazilië", "Brazil", "Brasilien", "Brasil" } },
            { "ZA", new[] { "Zuid-Afrika", "South Africa", "Südafrika", "Sør-Afrika" } },
            { "CZ", new[] { "Tsjechië", "Czechia", "Tschechien", "Tsjekkia" } },
            { "HU", new[] { "Hongarije", "Hungary", "Ungarn", "Ungarn" } },
        };

        private static string Pick(string[] names) =>
            DiscoverLanguage.IsDutch ? names[0] : DiscoverLanguage.IsGerman ? names[2] : DiscoverLanguage.IsNorwegian ? names[3] : names[1];

        private static string LanguageName(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;
            string[] n;
            if (Languages.TryGetValue(code.Trim(), out n)) return Pick(n);
            try { return CultureInfo.GetCultureInfo(code.Trim()).EnglishName; } catch { return code.ToUpperInvariant(); }
        }

        private static string CountryName(string code, string fallback)
        {
            string[] n;
            if (!string.IsNullOrWhiteSpace(code) && Countries.TryGetValue(code.Trim(), out n)) return Pick(n);
            if (!string.IsNullOrWhiteSpace(fallback)) return fallback.Trim();
            try { return new RegionInfo(code).EnglishName; } catch { return (code ?? "").ToUpperInvariant(); }
        }

        private static string Money(long v) => "US$ " + v.ToString("N0", Culture);

        private static DiscoverInfoRow Row(string label, string text)
        {
            var r = new DiscoverInfoRow { Label = label };
            r.Items.Add(new DiscoverInfoItem { Text = text });
            return r;
        }

        /// <summary>Verschijningsdata per soort (3 bioscoop, 4 digitaal, 5 schijf) in het land van de plugin-taal, anders de VS.</summary>
        private static List<DiscoverInfoItem> ReleaseItems(TmdbExtra x)
        {
            var res = new List<DiscoverInfoItem>();
            var all = x.release_dates != null && x.release_dates.results != null ? x.release_dates.results : new List<TmdbReleaseCountry>();
            Func<string, TmdbReleaseCountry> country = c => all.FirstOrDefault(r => r != null && string.Equals(r.iso_3166_1, c, StringComparison.OrdinalIgnoreCase) && r.release_dates != null && r.release_dates.Count > 0);
            var rc = country(Region) ?? country("US");
            if (rc == null) return res;
            var kinds = new[]
            {
                Tuple.Create(3, "ticket", T("In de bioscoop", "In cinemas", "Im Kino", "På kino")),
                Tuple.Create(4, "cloud", T("Digitaal", "Digital", "Digital", "Digitalt")),
                Tuple.Create(5, "disc", T("Op schijf", "Physical", "Auf Disc", "På plate"))
            };
            foreach (var k in kinds)
            {
                DateTime best = DateTime.MaxValue;
                foreach (var d in rc.release_dates.Where(d => d != null && d.type == k.Item1))
                {
                    DateTime dt;
                    if (InfoText.TryDate(d.release_date, out dt) && dt < best) best = dt;
                }
                if (best != DateTime.MaxValue) res.Add(new DiscoverInfoItem { Text = InfoText.LongDate(best), Icon = k.Item2, Hint = k.Item3 + (rc.iso_3166_1 != null ? " (" + rc.iso_3166_1.ToUpperInvariant() + ")" : "") });
            }
            return res;
        }

        internal static List<DiscoverInfoRow> Build(TmdbExtra x, bool tv, Tuple<string, DateTime?> next)
        {
            var rows = new List<DiscoverInfoRow>();
            if (x == null) return rows;

            var title = tv ? x.name : x.title;
            var orig = tv ? x.original_name : x.original_title;
            if (!string.IsNullOrWhiteSpace(orig) && !string.Equals(orig.Trim(), (title ?? "").Trim(), StringComparison.OrdinalIgnoreCase))
                rows.Add(Row(T("Oorspronkelijke titel", "Original title", "Originaltitel", "Originaltittel"), orig.Trim()));

            var st = InfoText.StatusText(x.status, tv);
            if (st != null) rows.Add(Row("Status", st));

            DateTime d;
            if (tv)
            {
                if (InfoText.TryDate(x.first_air_date, out d))
                    rows.Add(Row(T("Eerste uitzending", "First aired", "Erstausstrahlung", "Første sending"), InfoText.LongDate(d)));
                string code = null; DateTime? when = null;
                if (x.next_episode_to_air != null && InfoText.TryDate(x.next_episode_to_air.air_date, out d))
                {
                    code = "S" + x.next_episode_to_air.season_number.ToString("00") + "E" + x.next_episode_to_air.episode_number.ToString("00");
                    when = d;
                }
                else if (next != null) { code = next.Item1; when = next.Item2; }
                if (code != null)
                    rows.Add(Row(T("Volgende aflevering", "Next episode", "Nächste Folge", "Neste episode"), code + (when.HasValue ? " · " + InfoText.LongDate(when.Value) : "")));
                var sea = new List<string>();
                if (x.number_of_seasons > 0) sea.Add(x.number_of_seasons.ToString());
                if (x.number_of_episodes > 0) sea.Add(x.number_of_episodes + " " + T(x.number_of_episodes == 1 ? "aflevering" : "afleveringen", x.number_of_episodes == 1 ? "episode" : "episodes", x.number_of_episodes == 1 ? "Folge" : "Folgen", x.number_of_episodes == 1 ? "episode" : "episoder"));
                if (sea.Count > 0) rows.Add(Row(T("Seizoenen", "Seasons", "Staffeln", "Sesonger"), string.Join(" · ", sea)));
                int ep = x.episode_run_time != null ? x.episode_run_time.FirstOrDefault(m => m > 0) : 0;
                if (ep > 0) rows.Add(Row(T("Speelduur", "Runtime", "Laufzeit", "Spilletid"), T("± " + ep + " min per aflevering", "approx. " + ep + " min per episode", "ca. " + ep + " Min. pro Folge", "ca. " + ep + " min per episode")));
            }
            else
            {
                var rel = ReleaseItems(x);
                if (rel.Count > 0)
                {
                    var r = new DiscoverInfoRow { Label = T("Verschijningsdata", "Release dates", "Erscheinungstermine", "Utgivelser") };
                    r.Items.AddRange(rel);
                    rows.Add(r);
                }
                else if (InfoText.TryDate(x.release_date, out d))
                    rows.Add(Row(T("Verschijnt", "Release date", "Erscheint", "Utgivelse"), InfoText.LongDate(d)));
                if (x.runtime > 0)
                    rows.Add(Row(T("Speelduur", "Runtime", "Laufzeit", "Spilletid"), x.runtime >= 60
                        ? T((x.runtime / 60) + " u " + (x.runtime % 60) + " min", (x.runtime / 60) + " hr " + (x.runtime % 60) + " min", (x.runtime / 60) + " Std. " + (x.runtime % 60) + " Min.", (x.runtime / 60) + " t " + (x.runtime % 60) + " min")
                        : x.runtime + " min"));
                if (x.revenue > 0) rows.Add(Row(T("Omzet", "Revenue", "Einnahmen", "Inntekter"), Money(x.revenue)));
                if (x.budget > 0) rows.Add(Row("Budget", Money(x.budget)));
            }

            var lang = LanguageName(x.original_language);
            if (lang != null) rows.Add(Row(T("Oorspronkelijke taal", "Original language", "Originalsprache", "Originalspråk"), lang));

            var countries = new List<DiscoverInfoItem>();
            if (x.production_countries != null && x.production_countries.Count > 0)
                countries.AddRange(x.production_countries.Where(c => c != null && !string.IsNullOrWhiteSpace(c.iso_3166_1)).Take(4)
                    .Select(c => new DiscoverInfoItem { Text = CountryName(c.iso_3166_1, c.name), Flag = c.iso_3166_1.Trim().ToLowerInvariant() }));
            else if (x.origin_country != null)
                countries.AddRange(x.origin_country.Where(c => !string.IsNullOrWhiteSpace(c)).Take(4)
                    .Select(c => new DiscoverInfoItem { Text = CountryName(c, null), Flag = c.Trim().ToLowerInvariant() }));
            if (countries.Count > 0)
            {
                var r = new DiscoverInfoRow { Label = countries.Count == 1 ? T("Land", "Country", "Land", "Land") : T("Productielanden", "Production countries", "Produktionsländer", "Produksjonsland") };
                r.Items.AddRange(countries);
                rows.Add(r);
            }

            if (tv)
            {
                var by = (x.created_by ?? new List<TmdbNamed>()).Where(n => n != null && !string.IsNullOrWhiteSpace(n.name)).Select(n => n.name.Trim()).Distinct().Take(3).ToList();
                if (by.Count > 0) rows.Add(Row(T("Bedacht door", "Created by", "Erschaffen von", "Skapt av"), string.Join(", ", by)));
            }
            else if (x.credits != null && x.credits.crew != null)
            {
                var dir = x.credits.crew.Where(c => string.Equals(c.job, "Director", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(c.name))
                    .Select(c => c.name.Trim()).Distinct().Take(2).ToList();
                if (dir.Count > 0) rows.Add(Row(T("Regie", "Director", "Regie", "Regi"), string.Join(", ", dir)));
            }

            var comp = (tv ? x.networks : x.production_companies) ?? new List<TmdbNamed>();
            var names = comp.Where(n => n != null && !string.IsNullOrWhiteSpace(n.name)).Select(n => n.name.Trim()).Distinct().ToList();
            if (names.Count > 0)
            {
                var r = new DiscoverInfoRow
                {
                    Label = tv ? (names.Count == 1 ? T("Zender", "Network", "Sender", "Kanal") : T("Zenders", "Networks", "Sender", "Kanaler")) : T("Studio's", "Studios", "Studios", "Studioer"),
                    Show = 0
                };
                r.Items.AddRange(names.Take(4).Select(n => new DiscoverInfoItem { Text = n }));
                rows.Add(r);
            }
            return rows;
        }

        internal static List<DiscoverInfoLink> Links(TmdbExtra x, bool tv, int tmdbId)
        {
            var links = new List<DiscoverInfoLink>
            {
                new DiscoverInfoLink { Name = "TMDB", Url = "https://www.themoviedb.org/" + (tv ? "tv/" : "movie/") + tmdbId }
            };
            var imdb = x != null ? (x.imdb_id ?? (x.external_ids != null ? x.external_ids.imdb_id : null)) : null;
            if (!string.IsNullOrWhiteSpace(imdb)) links.Add(new DiscoverInfoLink { Name = "IMDb", Url = "https://www.imdb.com/title/" + imdb.Trim() + "/" });
            links.Add(new DiscoverInfoLink { Name = "Trakt", Url = "https://trakt.tv/search/tmdb/" + tmdbId + "?id_type=" + (tv ? "show" : "movie") });
            if (!tv) links.Add(new DiscoverInfoLink { Name = "Letterboxd", Url = "https://letterboxd.com/tmdb/" + tmdbId + "/" });
            var title = x != null ? (tv ? x.name : x.title) : null;
            if (!string.IsNullOrWhiteSpace(title)) links.Add(new DiscoverInfoLink { Name = "Rotten Tomatoes", Url = "https://www.rottentomatoes.com/search?search=" + Uri.EscapeDataString(title.Trim()) });
            if (tv)
            {
                var tvmaze = NextEpisode.KnownShowId(tmdbId);
                if (tvmaze > 0) links.Add(new DiscoverInfoLink { Name = "TVmaze", Url = "https://www.tvmaze.com/shows/" + tvmaze });
            }
            return links;
        }
    }
}
