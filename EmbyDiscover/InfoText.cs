using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace Emby.Plugins.Discover
{
    /// <summary>Bouwt de Seerr-achtige infoteksten (releasedatum, status, seizoenen, netwerk/studio, genres).</summary>
    internal static class InfoText
    {
        private static readonly string[] Months =
        {
            "januari", "februari", "maart", "april", "mei", "juni",
            "juli", "augustus", "september", "oktober", "november", "december"
        };

        private static readonly Dictionary<string, string> MovieStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Released", "Verschenen" }, { "Post Production", "Postproductie" }, { "In Production", "In productie" },
            { "Planned", "Gepland" }, { "Rumored", "Geruchten" }, { "Canceled", "Geannuleerd" }
        };

        private static readonly Dictionary<string, string> TvStatus = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Returning Series", "Lopend" }, { "Ended", "Beëindigd" }, { "Canceled", "Geannuleerd" },
            { "In Production", "In productie" }, { "Planned", "Gepland" }, { "Pilot", "Pilot" }
        };

        public static bool TryDate(string date, out DateTime d) =>
            DateTime.TryParseExact(date ?? "", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d);

        public static string LongDate(DateTime d) => d.Day + " " + Months[d.Month - 1] + " " + d.Year;

        /// <summary>"Verschijnt op 14 november 2026" / "Verschenen op ..." (series: "Eerste aflevering op" / "Gestart op"). Leeg als de datum onbekend is.</summary>
        public static string DateLine(string date, bool tv)
        {
            DateTime d;
            if (!TryDate(date, out d)) return null;
            bool future = d.Date > DateTime.UtcNow.Date;
            if (tv) return (future ? "Eerste aflevering op " : "Gestart op ") + LongDate(d);
            return (future ? "Verschijnt op " : "Verschenen op ") + LongDate(d);
        }

        private static string Names(List<TmdbNamed> list, int max)
        {
            if (list == null) return null;
            var n = list.Where(x => !string.IsNullOrWhiteSpace(x.name)).Select(x => x.name.Trim()).Distinct().Take(max).ToList();
            return n.Count == 0 ? null : string.Join(", ", n);
        }

        /// <summary>Regels (zonder lege) voor een titel. includeRating: TMDB-percentage toevoegen (de Emby-apps tonen hun eigen cijfer al).</summary>
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
            if (!string.IsNullOrWhiteSpace(x.status) && (tv ? TvStatus : MovieStatus).TryGetValue(x.status.Trim(), out st))
                parts.Add("Status: " + st);
            if (tv)
            {
                if (x.number_of_seasons > 0) parts.Add(x.number_of_seasons + (x.number_of_seasons == 1 ? " seizoen" : " seizoenen"));
                if (x.number_of_episodes > 0) parts.Add(x.number_of_episodes + (x.number_of_episodes == 1 ? " aflevering" : " afleveringen"));
                int ep = x.episode_run_time != null ? x.episode_run_time.FirstOrDefault(m => m > 0) : 0;
                if (ep > 0) parts.Add("± " + ep + " min per aflevering");
            }
            else if (x.runtime > 0)
            {
                parts.Add(x.runtime >= 60 ? (x.runtime / 60) + " u " + (x.runtime % 60) + " min" : x.runtime + " min");
            }
            if (parts.Count > 0) lines.Add(string.Join(" · ", parts));

            DateTime nd;
            if (tv && x.next_episode_to_air != null && TryDate(x.next_episode_to_air.air_date, out nd))
                lines.Add("Volgende aflevering: S" + x.next_episode_to_air.season_number.ToString("00") +
                          "E" + x.next_episode_to_air.episode_number.ToString("00") + " op " + LongDate(nd));

            var genres = Names(x.genres, 5);
            if (genres != null) lines.Add("Genres: " + genres);

            var studio = Names(tv ? x.networks : x.production_companies, 3);
            if (studio != null) lines.Add((tv ? "Netwerk: " : "Studio: ") + studio);
            if (tv)
            {
                var by = Names(x.created_by, 3);
                if (by != null) lines.Add("Bedenker: " + by);
            }
            else if (x.credits != null && x.credits.crew != null)
            {
                var dir = x.credits.crew.Where(c => string.Equals(c.job, "Director", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(c.name))
                    .Select(c => c.name.Trim()).Distinct().Take(2).ToList();
                if (dir.Count > 0) lines.Add("Regie: " + string.Join(", ", dir));
            }

            if (includeRating && x.vote_average > 0 && x.vote_count > 0)
                lines.Add("TMDB-beoordeling: " + (int)Math.Round(x.vote_average * 10) + "% (" +
                          x.vote_count.ToString("N0", CultureInfo.InvariantCulture).Replace(",", ".") + " stemmen)");
            return lines;
        }
    }
}
