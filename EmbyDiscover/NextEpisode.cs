using System;
using System.Collections.Concurrent;
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
                        line = DiscoverLanguage.Text("Volgende aflevering: ", "Next episode: ", "Nächste Folge: ", "Neste episode: ") + code +
                               (hasDate ? " · " + InfoText.LongDate(when.Kind == DateTimeKind.Utc ? when.ToLocalTime() : when) : "");
                    }
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TVmaze volgende aflevering " + tmdbId + " mislukt: " + ex.Message);
            }
            Lines[key] = Tuple.Create(DateTime.UtcNow, line);
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
