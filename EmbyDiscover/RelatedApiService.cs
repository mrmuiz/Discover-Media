using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    // Rijen op gewone Emby-pagina's (webclient): "Meer zoals dit" en de collectie op film/serie-pagina's,
    // en "Niet in je bibliotheek" op acteur/regisseur-pagina's. Het knopscript filtert wat al in Emby staat.

    [Route("/Discover/PersonCredits", "GET", Summary = "Films en series van een acteur/regisseur (TMDB), ook als ze niet in de bibliotheek staan")]
    [Authenticated]
    public class DiscoverPersonCreditsRequest : IReturn<DiscoverRelatedRow>
    {
        public string Name { get; set; }
        public int TmdbPersonId { get; set; }
    }

    [Route("/Discover/Related", "GET", Summary = "TMDB-aanbevelingen en collectie bij een film of serie")]
    [Authenticated]
    public class DiscoverRelatedRequest : IReturn<DiscoverRelatedResult>
    {
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
        /// <summary>Optioneel, als het item in Emby geen TMDB-id heeft.</summary>
        public string TvdbId { get; set; }
        public string ImdbId { get; set; }
    }

    [Route("/Discover/Seasons", "GET", Summary = "Seizoenen van een serie (voor de seizoenskeuze vanuit een rij)")]
    [Authenticated]
    public class DiscoverSeasonsRequest : IReturn<DiscoverSeasonsResult>
    {
        public int TmdbId { get; set; }
    }

    public class DiscoverRelatedItemDto : DiscoverItemDto
    {
        /// <summary>Rol van de persoon (personage of "Director"); alleen bij PersonCredits.</summary>
        public string Role { get; set; }
    }

    public class DiscoverRelatedRow
    {
        public int TmdbPersonId { get; set; }
        public List<DiscoverRelatedItemDto> Items { get; set; } = new List<DiscoverRelatedItemDto>();
    }

    public class DiscoverRelatedResult
    {
        public int TmdbId { get; set; }
        public List<DiscoverRelatedItemDto> Recommendations { get; set; } = new List<DiscoverRelatedItemDto>();
        public string CollectionName { get; set; }
        public List<DiscoverRelatedItemDto> Collection { get; set; } = new List<DiscoverRelatedItemDto>();
    }

    public class DiscoverSeasonsResult
    {
        public List<DiscoverSeasonInfo> Seasons { get; set; } = new List<DiscoverSeasonInfo>();
    }

    public class RelatedApiService : IService
    {
        private const int MaxPersonItems = 80;
        private const int MaxRecommendations = 20;

        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly ILogger _logger;

        public RelatedApiService(ILogManager logManager, IJsonSerializer json)
        {
            _logger = logManager.GetLogger("Discover");
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
        }

        private static bool TmdbReady => !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().TmdbApiKey);

        public async Task<object> Get(DiscoverPersonCreditsRequest request)
        {
            var row = new DiscoverRelatedRow();
            if (!TmdbReady) return row;
            try
            {
                int personId = request.TmdbPersonId;
                if (personId <= 0) personId = await _tmdb.FindPersonId(request.Name, CancellationToken.None).ConfigureAwait(false);
                if (personId <= 0)
                {
                    DiscoverDiagnostics.Add("persoon: geen TMDB-id gevonden voor '" + request.Name + "'");
                    return row;
                }
                row.TmdbPersonId = personId;

                var creditsTask = _tmdb.GetPersonCredits(personId, CancellationToken.None);
                var msTask = SafeStates(false);
                var tsTask = SafeStates(true);
                await Task.WhenAll(creditsTask, msTask, tsTask).ConfigureAwait(false);

                foreach (var c in creditsTask.Result.Take(MaxPersonItems))
                {
                    var dto = ToDto(c.Item, c.Tv, c.Tv ? tsTask.Result : msTask.Result);
                    dto.Role = c.Role;
                    row.Items.Add(dto);
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                _logger.Error("Discover: persoonscredits mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT persoonscredits '" + request.Name + "': " + ex.Message);
            }
            return row;
        }

        public async Task<object> Get(DiscoverRelatedRequest request)
        {
            var res = new DiscoverRelatedResult();
            if (!TmdbReady) return res;
            bool tv = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase);
            try
            {
                int id = request.TmdbId;
                if (id <= 0 && tv && !string.IsNullOrWhiteSpace(request.TvdbId))
                    id = await _tmdb.FindByExternalId(request.TvdbId, "tvdb_id", true, CancellationToken.None).ConfigureAwait(false);
                if (id <= 0 && !string.IsNullOrWhiteSpace(request.ImdbId))
                    id = await _tmdb.FindByExternalId(request.ImdbId, "imdb_id", tv, CancellationToken.None).ConfigureAwait(false);
                if (id <= 0) return res;
                res.TmdbId = id;

                var recTask = _tmdb.GetRecommendations(tv, id, CancellationToken.None);
                var colTask = tv ? Task.FromResult<TmdbCollection>(null) : SafeCollection(id);
                var statesTask = SafeStates(tv);
                await Task.WhenAll(recTask, colTask, statesTask).ConfigureAwait(false);
                var states = statesTask.Result;

                var col = colTask.Result;
                var colIds = new HashSet<int>();
                if (col?.parts != null)
                {
                    res.CollectionName = col.name;
                    foreach (var p in col.parts
                        .Where(p => !p.adult && !string.IsNullOrEmpty(p.poster_path))
                        .OrderBy(p => string.IsNullOrEmpty(p.release_date) ? "9999" : p.release_date))
                    {
                        colIds.Add(p.id);
                        res.Collection.Add(ToDto(p, false, states));
                    }
                }

                foreach (var r in recTask.Result
                    .Where(r => !r.adult && !string.IsNullOrEmpty(r.poster_path) && !colIds.Contains(r.id))
                    .Take(MaxRecommendations))
                    res.Recommendations.Add(ToDto(r, tv, states));
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                _logger.Error("Discover: aanbevelingen mislukt: {0}", ex.Message);
                DiscoverDiagnostics.Add("FOUT aanbevelingen " + request.Type + "/" + request.TmdbId + ": " + ex.Message);
            }
            return res;
        }

        public async Task<object> Get(DiscoverSeasonsRequest request)
        {
            var res = new DiscoverSeasonsResult();
            if (request.TmdbId <= 0 || !TmdbReady) return res;
            try
            {
                var detail = await _tmdb.GetTvDetail(request.TmdbId, CancellationToken.None).ConfigureAwait(false);
                if (detail?.seasons != null)
                {
                    res.Seasons = detail.seasons
                        .Where(s => s.season_number > 0 || s.episode_count > 0)
                        .OrderBy(s => s.season_number)
                        .Select(s => new DiscoverSeasonInfo
                        {
                            Number = s.season_number,
                            Name = string.IsNullOrWhiteSpace(s.name)
                                ? DiscoverLanguage.Text("Seizoen ", "Season ", "Staffel ") + s.season_number
                                : s.name,
                            EpisodeCount = s.episode_count
                        })
                        .ToList();
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("FOUT seizoenen " + request.TmdbId + ": " + ex.Message);
            }
            return res;
        }

        private async Task<TmdbCollection> SafeCollection(int movieId)
        {
            try { return await _tmdb.GetMovieCollection(movieId, CancellationToken.None).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB collectie bij film " + movieId + " mislukt: " + ex.Message);
                return null;
            }
        }

        private async Task<Dictionary<int, bool>> SafeStates(bool tv)
        {
            try
            {
                if (tv ? !ArrClient.SonarrConfigured : !ArrClient.RadarrConfigured) return new Dictionary<int, bool>();
                return tv ? await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false)
                          : await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT status " + (tv ? "Sonarr" : "Radarr") + ": " + ex.Message);
                return new Dictionary<int, bool>();
            }
        }

        private static DiscoverRelatedItemDto ToDto(TmdbItem i, bool tv, Dictionary<int, bool> states)
        {
            int status = 0;
            bool hasFiles;
            if (states != null && states.TryGetValue(i.id, out hasFiles)) status = hasFiles ? 2 : 1;
            var date = tv ? i.first_air_date : i.release_date;
            int year = 0;
            if (!string.IsNullOrEmpty(date) && date.Length >= 4) int.TryParse(date.Substring(0, 4), out year);
            return new DiscoverRelatedItemDto
            {
                TmdbId = i.id,
                Type = tv ? "tv" : "movie",
                Title = tv ? (i.name ?? i.title ?? "?") : (i.title ?? i.name ?? "?"),
                Year = year,
                Poster = string.IsNullOrEmpty(i.poster_path) ? null : "https://image.tmdb.org/t/p/w342" + i.poster_path,
                Backdrop = string.IsNullOrEmpty(i.backdrop_path) ? null : "https://image.tmdb.org/t/p/w780" + i.backdrop_path,
                Rating = i.vote_average,
                Overview = i.overview,
                Status = status
            };
        }
    }
}
