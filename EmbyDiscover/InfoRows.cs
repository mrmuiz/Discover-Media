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
        private static string T(string key) => DiscoverLanguage.T(key);

        private static string T(string key, params object[] args) => DiscoverLanguage.T(key, args);

        private static CultureInfo Culture
        {
            get
            {
                try { return CultureInfo.GetCultureInfo(DiscoverLanguage.PluginLanguage); }
                catch { return CultureInfo.InvariantCulture; }
            }
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
            var rc = country(DiscoverNames.Region) ?? country("US");
            if (rc == null) return res;
            var kinds = new[]
            {
                Tuple.Create(3, "ticket", T("info.row.in_cinemas")),
                Tuple.Create(4, "cloud", T("info.row.digital")),
                Tuple.Create(5, "disc", T("info.row.physical"))
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
                rows.Add(Row(T("info.row.original_title"), orig.Trim()));

            var st = InfoText.StatusText(x.status, tv);
            if (st != null) rows.Add(Row(T("info.row.status"), st));

            DateTime d;
            if (tv)
            {
                if (InfoText.TryDate(x.first_air_date, out d))
                    rows.Add(Row(T("info.row.first_aired"), InfoText.LongDate(d)));
                string code = null; DateTime? when = null;
                if (x.next_episode_to_air != null && InfoText.TryDate(x.next_episode_to_air.air_date, out d))
                {
                    code = "S" + x.next_episode_to_air.season_number.ToString("00") + "E" + x.next_episode_to_air.episode_number.ToString("00");
                    when = d;
                }
                else if (next != null) { code = next.Item1; when = next.Item2; }
                if (code != null)
                    rows.Add(Row(T("info.row.next_episode"), code + (when.HasValue ? " · " + InfoText.LongDate(when.Value) : "")));
                var sea = new List<string>();
                if (x.number_of_seasons > 0) sea.Add(x.number_of_seasons.ToString());
                if (x.number_of_episodes > 0) sea.Add(x.number_of_episodes + " " + T(x.number_of_episodes == 1 ? "info.row.episode" : "info.row.episodes"));
                if (sea.Count > 0) rows.Add(Row(T("info.row.seasons"), string.Join(" · ", sea)));
                int ep = x.episode_run_time != null ? x.episode_run_time.FirstOrDefault(m => m > 0) : 0;
                if (ep > 0) rows.Add(Row(T("info.row.runtime"), T("info.min_per_episode", ep)));
            }
            else
            {
                var rel = ReleaseItems(x);
                if (rel.Count > 0)
                {
                    var r = new DiscoverInfoRow { Label = T("info.row.release_dates") };
                    r.Items.AddRange(rel);
                    rows.Add(r);
                }
                else if (InfoText.TryDate(x.release_date, out d))
                    rows.Add(Row(T("info.row.release_date"), InfoText.LongDate(d)));
                if (x.runtime > 0)
                    rows.Add(Row(T("info.row.runtime"), x.runtime >= 60
                        ? T("info.hours_minutes", x.runtime / 60, x.runtime % 60)
                        : x.runtime + " min"));
                if (x.revenue > 0) rows.Add(Row(T("info.row.revenue"), Money(x.revenue)));
                if (x.budget > 0) rows.Add(Row(T("info.row.budget"), Money(x.budget)));
            }

            var lang = DiscoverNames.Language(x.original_language);
            if (lang != null) rows.Add(Row(T("info.row.original_language"), lang));

            var countries = new List<DiscoverInfoItem>();
            if (x.production_countries != null && x.production_countries.Count > 0)
                countries.AddRange(x.production_countries.Where(c => c != null && !string.IsNullOrWhiteSpace(c.iso_3166_1)).Take(4)
                    .Select(c => new DiscoverInfoItem { Text = DiscoverNames.Country(c.iso_3166_1, c.name), Flag = c.iso_3166_1.Trim().ToLowerInvariant() }));
            else if (x.origin_country != null)
                countries.AddRange(x.origin_country.Where(c => !string.IsNullOrWhiteSpace(c)).Take(4)
                    .Select(c => new DiscoverInfoItem { Text = DiscoverNames.Country(c, null), Flag = c.Trim().ToLowerInvariant() }));
            if (countries.Count > 0)
            {
                var r = new DiscoverInfoRow { Label = countries.Count == 1 ? T("info.row.country") : T("info.row.production_countries") };
                r.Items.AddRange(countries);
                rows.Add(r);
            }

            if (tv)
            {
                var by = (x.created_by ?? new List<TmdbNamed>()).Where(n => n != null && !string.IsNullOrWhiteSpace(n.name)).Select(n => n.name.Trim()).Distinct().Take(3).ToList();
                if (by.Count > 0) rows.Add(Row(T("info.row.created_by"), string.Join(", ", by)));
            }
            else if (x.credits != null && x.credits.crew != null)
            {
                var dir = x.credits.crew.Where(c => string.Equals(c.job, "Director", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(c.name))
                    .Select(c => c.name.Trim()).Distinct().Take(2).ToList();
                if (dir.Count > 0) rows.Add(Row(T("info.row.director"), string.Join(", ", dir)));
            }

            var comp = (tv ? x.networks : x.production_companies) ?? new List<TmdbNamed>();
            var names = comp.Where(n => n != null && !string.IsNullOrWhiteSpace(n.name)).Select(n => n.name.Trim()).Distinct().ToList();
            if (names.Count > 0)
            {
                var r = new DiscoverInfoRow
                {
                    Label = tv ? (names.Count == 1 ? T("info.row.network") : T("info.row.networks")) : T("info.row.studios"),
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
