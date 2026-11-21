using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Emby.Plugins.Discover
{
    /// <summary>Bouwt de Seerr-achtige infoteksten (releasedatum, status, seizoenen, netwerk/studio, genres).</summary>
    internal static class InfoText
    {
        private static readonly string[] DutchMonths =
        {
            "januari", "februari", "maart", "april", "mei", "juni",
            "juli", "augustus", "september", "oktober", "november", "december"
        };

        private static readonly string[] EnglishMonths =
        {
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        };

        private static readonly string[] GermanMonths =
        {
            "Januar", "Februar", "März", "April", "Mai", "Juni",
            "Juli", "August", "September", "Oktober", "November", "Dezember"
        };

        private static readonly Dictionary<string, string> DutchMovieStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Released", "Verschenen" }, { "Post Production", "Postproductie" }, { "In Production", "In productie" },
            { "Planned", "Gepland" }, { "Rumored", "Geruchten" }, { "Canceled", "Geannuleerd" }
        };

        private static readonly Dictionary<string, string> EnglishMovieStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Released", "Released" }, { "Post Production", "Post-production" }, { "In Production", "In production" },
            { "Planned", "Planned" }, { "Rumored", "Rumored" }, { "Canceled", "Canceled" }
        };

        private static readonly Dictionary<string, string> DutchTvStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Returning Series", "Lopend" }, { "Ended", "Beëindigd" }, { "Canceled", "Geannuleerd" },
            { "In Production", "In productie" }, { "Planned", "Gepland" }, { "Pilot", "Pilot" }
        };

        private static readonly Dictionary<string, string> EnglishTvStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Returning Series", "Returning" }, { "Ended", "Ended" }, { "Canceled", "Canceled" },
            { "In Production", "In production" }, { "Planned", "Planned" }, { "Pilot", "Pilot" }
        };

        private static readonly Dictionary<string, string> GermanMovieStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Released", "Veröffentlicht" }, { "Post Production", "Nachproduktion" }, { "In Production", "In Produktion" },
            { "Planned", "Geplant" }, { "Rumored", "Vermutet" }, { "Canceled", "Abgebrochen" }
        };

        private static readonly Dictionary<string, string> GermanTvStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Returning Series", "Laufende Serie" }, { "Ended", "Beendet" }, { "Canceled", "Abgebrochen" },
            { "In Production", "In Produktion" }, { "Planned", "Geplant" }, { "Pilot", "Pilotfolge" }
        };

        public static bool TryDate(string date, out DateTime d) =>
            DateTime.TryParseExact(date ?? "", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d);

        public static string LongDate(DateTime d) =>
            DiscoverLanguage.IsDutch
                ? d.Day + " " + DutchMonths[d.Month - 1] + " " + d.Year
                : DiscoverLanguage.IsGerman
                    ? d.Day + ". " + GermanMonths[d.Month - 1] + " " + d.Year
                    : EnglishMonths[d.Month - 1] + " " + d.Day + ", " + d.Year;

        /// <summary>"Verschijnt op 14 november 2026" / "Verschenen op ..." (series: "Eerste aflevering op" / "Gestart op"). Leeg als de datum onbekend is.</summary>
        public static string DateLine(string date, bool tv)
        {
            DateTime d;
            if (!TryDate(date, out d)) return null;
            bool future = d.Date > DateTime.UtcNow.Date;
            if (tv)
                return future ? DiscoverLanguage.T("info.first_episode_on") : DiscoverLanguage.T("info.started_on") + LongDate(d);
            return future ? DiscoverLanguage.T("info.coming_on") : DiscoverLanguage.T("info.released_on") + LongDate(d);
        }

        private static string Names(List<TmdbNamed> list, int max)
        {
            if (list == null) return null;
            var n = list.Where(x => !string.IsNullOrWhiteSpace(x.name)).Select(x => x.name.Trim()).Distinct().Take(max).ToList();
            return n.Count == 0 ? null : string.Join(", ", n);
        }

        /// <summary>Regels (zonder lege) voor een titel. includeRating: TMDB-percentage toevoegen (de Emby-apps tonen hun eigen cijfer al).</summary>
        internal static string StatusText(string status, bool tv)
        {
            if (string.IsNullOrWhiteSpace(status)) return null;
            var map = tv
                ? (DiscoverLanguage.IsDutch ? DutchTvStatus : DiscoverLanguage.IsGerman ? GermanTvStatus : EnglishTvStatus)
                : (DiscoverLanguage.IsDutch ? DutchMovieStatus : DiscoverLanguage.IsGerman ? GermanMovieStatus : EnglishMovieStatus);
            string st;
            return map.TryGetValue(status.Trim(), out st) ? st : status.Trim();
        }

        public static List<string> Lines(TmdbItem t, TmdbExtra x, bool tv, bool includeRating)
        {
            var lines = new List<string>();
            if (x == null)
            {
                var only = DateLine(tv ? t?.first_air_date : t?.release_date, tv);
                if (only != null) lines.Add(only);
                return lines;
            }

            var tag = (x.tagline ?? "").Trim().Trim('"', '\'', '\u201C', '\u201D', '\u201E', '\u201F', '\u2018', '\u2019', '\u00AB', '\u00BB').Trim();
            if (tag.Length > 0) lines.Add("\u201C" + tag + "\u201D");

            var date = tv ? (x.first_air_date ?? t?.first_air_date) : (x.release_date ?? t?.release_date);
            var dl = DateLine(date, tv);
            if (dl != null) lines.Add(dl);

            var parts = new List<string>();
            string st;
            var statusMap = tv
                ? (DiscoverLanguage.IsDutch ? DutchTvStatus : DiscoverLanguage.IsGerman ? GermanTvStatus : EnglishTvStatus)
                : (DiscoverLanguage.IsDutch ? DutchMovieStatus : DiscoverLanguage.IsGerman ? GermanMovieStatus : EnglishMovieStatus);
            if (!string.IsNullOrWhiteSpace(x.status) && statusMap.TryGetValue(x.status.Trim(), out st))
                parts.Add("Status: " + st);
            if (tv)
            {
                if (x.number_of_seasons > 0)
                    parts.Add(x.number_of_seasons + x.number_of_seasons == 1 ? DiscoverLanguage.T("info.seasons_one_suffix") : DiscoverLanguage.T("info.seasons_many_suffix"));
                if (x.number_of_episodes > 0)
                    parts.Add(x.number_of_episodes + x.number_of_episodes == 1 ? DiscoverLanguage.T("info.episodes_one_suffix") : DiscoverLanguage.T("info.episodes_many_suffix"));
                int ep = x.episode_run_time != null ? x.episode_run_time.FirstOrDefault(m => m > 0) : 0;
                if (ep > 0) parts.Add(DiscoverLanguage.T("info.min_per_episode", ep));
            }
            else if (x.runtime > 0)
            {
                parts.Add(x.runtime >= 60
                    ? DiscoverLanguage.T("info.hours_minutes", x.runtime / 60, x.runtime % 60)
                    : x.runtime + " min");
            }
            if (parts.Count > 0) lines.Add(string.Join(" · ", parts));

            DateTime nd;
            if (tv && x.next_episode_to_air != null && TryDate(x.next_episode_to_air.air_date, out nd))
                lines.Add(DiscoverLanguage.T("info.next_episode_s") +
                          x.next_episode_to_air.season_number.ToString("00") +
                          "E" + x.next_episode_to_air.episode_number.ToString("00") +
                          DiscoverLanguage.T("info.on") + LongDate(nd));

            var genres = Names(x.genres, 5);
            if (genres != null) lines.Add("Genres: " + genres);

            var studio = Names(tv ? x.networks : x.production_companies, 3);
            if (studio != null)
                lines.Add(tv ? DiscoverLanguage.T("info.network_label") : DiscoverLanguage.T("info.studio_label") + studio);
            if (tv)
            {
                var by = Names(x.created_by, 3);
                if (by != null) lines.Add(DiscoverLanguage.T("info.created_by") + by);
            }
            else if (x.credits != null && x.credits.crew != null)
            {
                var dir = x.credits.crew.Where(c => string.Equals(c.job, "Director", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(c.name))
                    .Select(c => c.name.Trim()).Distinct().Take(2).ToList();
                if (dir.Count > 0) lines.Add(DiscoverLanguage.T("info.director") + string.Join(", ", dir));
            }

            if (includeRating && x.vote_average > 0 && x.vote_count > 0)
                lines.Add(DiscoverLanguage.T("info.tmdb_rating") +
                          (int)Math.Round(x.vote_average * 10) + "% (" +
                          x.vote_count.ToString("N0", CultureInfo.InvariantCulture).Replace(",", ".") +
                          DiscoverLanguage.T("info.votes"));
            return lines;
        }
    }
}
