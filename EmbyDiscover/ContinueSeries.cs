using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    [Route("/Discover/ContinueSeries", "GET", Summary = "Series in de bibliotheek waar TMDB al een nieuwer seizoen van heeft")]
    [Authenticated]
    public class DiscoverContinueRequest : IReturn<DiscoverRow> { }

    /// <summary>
    /// Rij "Nieuwe seizoenen": series die je in de bibliotheek hebt, waarvan TMDB een later (al uitgezonden)
    /// seizoen kent dan het hoogste seizoen in de bibliotheek. Per gebruiker (alleen bibliotheken die hij mag zien),
    /// 3 uur bewaard.
    /// </summary>
    public class ContinueSeriesService : IService, IRequiresRequest
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromHours(3);
        private const int MaxShown = 30;
        private const int MaxSeries = 400;
        private static readonly Dictionary<string, KeyValuePair<DateTime, DiscoverRow>> Cache = new Dictionary<string, KeyValuePair<DateTime, DiscoverRow>>();
        private static readonly SemaphoreSlim Build = new SemaphoreSlim(1, 1);

        private readonly ILibraryManager _library;
        private readonly IAuthorizationContext _auth;
        private readonly TmdbClient _tmdb;

        public IRequest Request { get; set; }

        public ContinueSeriesService(ILibraryManager library, IAuthorizationContext auth, IJsonSerializer json)
        {
            _library = library;
            _auth = auth;
            _tmdb = new TmdbClient(json);
        }

        private static string Title() => DiscoverLanguage.Text("Nieuwe seizoenen", "New seasons", "Neue Staffeln");

        public async Task<object> Get(DiscoverContinueRequest request)
        {
            var row = new DiscoverRow { Key = "continue_series", Title = Title() };
            var pc = Plugin.GetCurrentConfiguration();
            if (!pc.ShowNewSeasons || string.IsNullOrWhiteSpace(pc.TmdbApiKey)) return row;
            MediaBrowser.Controller.Entities.User user = null;
            try { var info = _auth.GetAuthorizationInfo(Request); user = info != null ? info.User : null; } catch { }
            var ck = (user != null ? user.Id.ToString("N") : "-") + "|" + DiscoverLanguage.Text("nl", "en", "de");
            lock (Cache)
            {
                KeyValuePair<DateTime, DiscoverRow> hit;
                if (Cache.TryGetValue(ck, out hit) && DateTime.UtcNow - hit.Key < Ttl) return hit.Value;
            }
            await Build.WaitAsync().ConfigureAwait(false);
            try
            {
                lock (Cache)
                {
                    KeyValuePair<DateTime, DiscoverRow> hit;
                    if (Cache.TryGetValue(ck, out hit) && DateTime.UtcNow - hit.Key < Ttl) return hit.Value;
                }
                row = await Compute(user).ConfigureAwait(false);
                lock (Cache) { Cache[ck] = new KeyValuePair<DateTime, DiscoverRow>(DateTime.UtcNow, row); }
                return row;
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT rij Nieuwe seizoenen: " + ex.Message);
                return row;
            }
            finally { Build.Release(); }
        }

        private async Task<DiscoverRow> Compute(MediaBrowser.Controller.Entities.User user)
        {
            var row = new DiscoverRow { Key = "continue_series", Title = Title() };

            var seriesQuery = new InternalItemsQuery { IncludeItemTypes = new[] { "Series" }, Recursive = true };
            if (user != null) seriesQuery.User = user;
            var series = _library.GetItemList(seriesQuery).OfType<Series>().ToList();
            if (series.Count == 0) return row;

            var seasonQuery = new InternalItemsQuery { IncludeItemTypes = new[] { "Season" }, Recursive = true, IsVirtualItem = false };
            if (user != null) seasonQuery.User = user;
            var maxSeason = new Dictionary<long, int>();
            foreach (var s in _library.GetItemList(seasonQuery).OfType<Season>())
            {
                if (!s.IndexNumber.HasValue || s.IndexNumber.Value <= 0) continue;
                int cur;
                if (!maxSeason.TryGetValue(s.SeriesId, out cur) || s.IndexNumber.Value > cur) maxSeason[s.SeriesId] = s.IndexNumber.Value;
            }

            // Meest recent bijgewerkte series eerst; de rest volgt bij een volgende ronde niet, dat is genoeg voor een rij.
            var candidates = new List<KeyValuePair<Series, int>>();
            foreach (var s in series.OrderByDescending(x => x.DateModified))
            {
                int tmdbId, have;
                var raw = s.GetProviderId("Tmdb");
                if (string.IsNullOrEmpty(raw) || !int.TryParse(raw, out tmdbId) || tmdbId <= 0) continue;
                if (!maxSeason.TryGetValue(s.InternalId, out have)) continue;
                candidates.Add(new KeyValuePair<Series, int>(s, have));
                if (candidates.Count >= MaxSeries) break;
            }

            var found = new List<KeyValuePair<DateTime, DiscoverItemDto>>();
            var gate = new SemaphoreSlim(4, 4);
            var tasks = candidates.Select(async kv =>
            {
                await gate.WaitAsync().ConfigureAwait(false);
                try
                {
                    int tmdbId = int.Parse(kv.Key.GetProviderId("Tmdb"), CultureInfo.InvariantCulture);
                    var x = await _tmdb.GetExtraCached(true, tmdbId, CancellationToken.None).ConfigureAwait(false);
                    if (x == null || x.last_episode_to_air == null) return;
                    int aired = x.last_episode_to_air.season_number;
                    if (aired <= kv.Value) return;
                    DateTime airDate;
                    DateTime.TryParse(x.last_episode_to_air.air_date, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out airDate);
                    int year;
                    var note = aired == kv.Value + 1
                        ? DiscoverLanguage.Text("Nieuw: seizoen " + aired + ".", "New: season " + aired + ".", "Neu: Staffel " + aired + ".")
                        : DiscoverLanguage.Text("Nieuw: seizoen " + (kv.Value + 1) + " t/m " + aired + ".", "New: seasons " + (kv.Value + 1) + " to " + aired + ".", "Neu: Staffeln " + (kv.Value + 1) + " bis " + aired + ".");
                    var dto = new DiscoverItemDto
                    {
                        TmdbId = tmdbId,
                        Type = "tv",
                        Title = x.name ?? kv.Key.Name,
                        Year = !string.IsNullOrEmpty(x.first_air_date) && x.first_air_date.Length >= 4 && int.TryParse(x.first_air_date.Substring(0, 4), out year) ? year : 0,
                        Poster = string.IsNullOrEmpty(x.poster_path) ? null : "https://image.tmdb.org/t/p/w342" + x.poster_path,
                        Backdrop = string.IsNullOrEmpty(x.backdrop_path) ? null : "https://image.tmdb.org/t/p/w780" + x.backdrop_path,
                        Rating = x.vote_average,
                        Lang = x.original_language,
                        Overview = note + (string.IsNullOrEmpty(x.overview) ? "" : " " + x.overview),
                        Status = 0
                    };
                    lock (found) found.Add(new KeyValuePair<DateTime, DiscoverItemDto>(airDate, dto));
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("Nieuwe seizoenen: " + kv.Key.Name + " mislukt: " + ex.Message); }
                finally { gate.Release(); }
            }).ToList();
            await Task.WhenAll(tasks).ConfigureAwait(false);

            row.Items = found.OrderByDescending(f => f.Key).Select(f => f.Value).Take(MaxShown).ToList();
            DiscoverDiagnostics.Add("rij Nieuwe seizoenen: " + row.Items.Count + " van " + candidates.Count + " series");
            return row;
        }
    }
}
