using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Globalization;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    public class TvmazeEpisodeDto { public int season { get; set; } public int number { get; set; } public string name { get; set; } public string airstamp { get; set; } public string airdate { get; set; } }
    public class TvmazeEmbeddedDto { public TvmazeEpisodeDto nextepisode { get; set; } }
    public class TvmazeShowDto { public int id { get; set; } public string status { get; set; } public TvmazeEmbeddedDto _embedded { get; set; } }

    /// <summary>
    /// Volgende aflevering van een lopende serie via TVmaze (gratis, geen sleutel). De serie wordt gevonden via het
    /// TVDB-nummer (anders het IMDb-nummer) dat TMDB levert. Het TVmaze-nummer wordt een week bewaard, de regel 6 uur.
    /// </summary>
    internal static class NextEpisode
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        private static readonly ConcurrentDictionary<int, Tuple<DateTime, int>> ShowIds = new ConcurrentDictionary<int, Tuple<DateTime, int>>();
        private static readonly ConcurrentDictionary<string, Tuple<DateTime, string>> Lines = new ConcurrentDictionary<string, Tuple<DateTime, string>>();

        static NextEpisode()
        {
            try { Http.DefaultRequestHeaders.UserAgent.ParseAdd("EmbyDiscoverMedia/1.0"); } catch { }
        }

        /// <summary>
        /// Houdt een cache klein. De houdbaarheid wordt bij het lezen gecontroleerd, maar verlopen regels bleven
        /// staan tot Emby herstart; bij veel gebruikers die veel series openen loopt dat op.
        /// </summary>
        private static void Cap<TKey, TValue>(ConcurrentDictionary<TKey, TValue> map, int max, Func<TValue, DateTime> at)
        {
            if (map.Count <= max) { return; }
            foreach (var key in map.ToArray().OrderBy(kv => at(kv.Value)).Take(map.Count - max * 3 / 4).Select(kv => kv.Key))
            {
                TValue ignored;
                map.TryRemove(key, out ignored);
            }
        }

        /// <summary>TVmaze-nummer als dat al bekend is (voor de link in het infoblok), anders 0.</summary>
        internal static int KnownShowId(int tmdbId)
        {
            Tuple<DateTime, int> hit;
            return ShowIds.TryGetValue(tmdbId, out hit) ? hit.Item2 : 0;
        }

        private static readonly ConcurrentDictionary<int, Tuple<DateTime, string, DateTime?>> Next = new ConcurrentDictionary<int, Tuple<DateTime, string, DateTime?>>();

        /// <summary>Volgende aflevering als code ("S03E05") en datum (lokaal), of null.</summary>
        internal static async Task<Tuple<string, DateTime?>> Get(IJsonSerializer json, TmdbClient tmdb, int tmdbId, CancellationToken ct)
        {
            Tuple<DateTime, string, DateTime?> hit;
            if (Next.TryGetValue(tmdbId, out hit) && DateTime.UtcNow - hit.Item1 < TimeSpan.FromHours(6))
                return hit.Item2 == null ? null : Tuple.Create(hit.Item2, hit.Item3);
            string code = null; DateTime? when = null;
            try
            {
                int showId = await ShowId(json, tmdb, tmdbId, ct).ConfigureAwait(false);
                if (showId > 0)
                {
                    var text = await Http.GetStringAsync("https://api.tvmaze.com/shows/" + showId + "?embed=nextepisode").ConfigureAwait(false);
                    var show = json.DeserializeFromString<TvmazeShowDto>(text);
                    var ep = show != null && show._embedded != null ? show._embedded.nextepisode : null;
                    if (ep != null)
                    {
                        code = "S" + ep.season.ToString("00") + "E" + ep.number.ToString("00");
                        DateTime w;
                        if (DateTime.TryParse(ep.airstamp, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out w)) when = w.Kind == DateTimeKind.Utc ? w.ToLocalTime() : w;
                        else if (DateTime.TryParse(ep.airdate, CultureInfo.InvariantCulture, DateTimeStyles.None, out w)) when = w;
                    }
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("log.next.tvmaze_volgende_aflevering_mislukt", tmdbId, ex.Message);
            }
            Next[tmdbId] = Tuple.Create(DateTime.UtcNow, code, when);
            Cap(Next, 2000, v => v.Item1);
            return code == null ? null : Tuple.Create(code, when);
        }

        internal static async Task<string> Line(IJsonSerializer json, TmdbClient tmdb, int tmdbId, CancellationToken ct)
        {
            var key = tmdbId + "|" + DiscoverLanguage.PluginLanguage;
            Tuple<DateTime, string> hit;
            if (Lines.TryGetValue(key, out hit) && DateTime.UtcNow - hit.Item1 < TimeSpan.FromHours(6)) return hit.Item2;

            string line = null;
            try
            {
                int showId = await ShowId(json, tmdb, tmdbId, ct).ConfigureAwait(false);
                if (showId > 0)
                {
                    var text = await Http.GetStringAsync("https://api.tvmaze.com/shows/" + showId + "?embed=nextepisode").ConfigureAwait(false);
                    var show = json.DeserializeFromString<TvmazeShowDto>(text);
                    var ep = show != null && show._embedded != null ? show._embedded.nextepisode : null;
                    if (ep != null)
                    {
                        DateTime when;
                        bool hasDate = DateTime.TryParse(ep.airstamp, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out when)
                                       || DateTime.TryParse(ep.airdate, CultureInfo.InvariantCulture, DateTimeStyles.None, out when);
                        var code = "S" + ep.season.ToString("00") + "E" + ep.number.ToString("00");
                        line = DiscoverLanguage.T("api.next_episode") + code +
                               (hasDate ? " · " + InfoText.LongDate(when.Kind == DateTimeKind.Utc ? when.ToLocalTime() : when) : "");
                    }
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("log.next.tvmaze_volgende_aflevering_mislukt", tmdbId, ex.Message);
            }
            Lines[key] = Tuple.Create(DateTime.UtcNow, line);
            Cap(Lines, 2000, v => v.Item1);
            return line;
        }

        private static async Task<int> ShowId(IJsonSerializer json, TmdbClient tmdb, int tmdbId, CancellationToken ct)
        {
            Tuple<DateTime, int> hit;
            if (ShowIds.TryGetValue(tmdbId, out hit) && DateTime.UtcNow - hit.Item1 < TimeSpan.FromDays(7)) return hit.Item2;
            int id = 0;
            var ext = await tmdb.GetTvExternalIds(tmdbId, ct).ConfigureAwait(false);
            if (ext != null && ext.tvdb_id.HasValue && ext.tvdb_id.Value > 0)
                id = await Lookup(json, "thetvdb=" + ext.tvdb_id.Value).ConfigureAwait(false);
            if (id <= 0 && ext != null && !string.IsNullOrWhiteSpace(ext.imdb_id))
                id = await Lookup(json, "imdb=" + Uri.EscapeDataString(ext.imdb_id.Trim())).ConfigureAwait(false);
            ShowIds[tmdbId] = Tuple.Create(DateTime.UtcNow, id);
            Cap(ShowIds, 2000, v => v.Item1);
            return id;
        }

        private static async Task<int> Lookup(IJsonSerializer json, string query)
        {
            // TVmaze stuurt een redirect naar /shows/{id}; HttpClient volgt die vanzelf. 404 = onbekend.
            using (var resp = await Http.GetAsync("https://api.tvmaze.com/lookup/shows?" + query).ConfigureAwait(false))
            {
                if (!resp.IsSuccessStatusCode) return 0;
                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                var show = json.DeserializeFromString<TvmazeShowDto>(text);
                return show != null ? show.id : 0;
            }
        }
    }
}
