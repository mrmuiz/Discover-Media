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

    [Route("/Discover/PersonCredits", "GET", Summary = "Movies and series of an actor/director (TMDB), also when they are not in the library")]
    [Authenticated]
    public class DiscoverPersonCreditsRequest : IReturn<DiscoverRelatedRow>
    {
        public string Name { get; set; }
        public int TmdbPersonId { get; set; }
    }

    [Route("/Discover/Person", "GET", Summary = "Details of a person (TMDB) for the person page in Discover")]
    [Authenticated]
    public class DiscoverPersonRequest : IReturn<DiscoverPersonResult>
    {
        public int Id { get; set; }
    }

    public class DiscoverPersonResult
    {
        public bool Found { get; set; }
        public int Id { get; set; }
        public string Name { get; set; }
        public string Photo { get; set; }
        public string Biography { get; set; }
        public string Birthday { get; set; }
        public string Deathday { get; set; }
        public string PlaceOfBirth { get; set; }
        public string Department { get; set; }
        /// <summary>0 onbekend, 1 vrouw, 2 man, 3 non-binair (TMDB)</summary>
        public int Gender { get; set; }
    }

    [Route("/Discover/Related", "GET", Summary = "TMDB recommendations and collection for a movie or series")]
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

    [Route("/Discover/LoaderConfig", "GET", Summary = "Is 'Tile opens the Discover page' on? (for the loader script)")]
    [Authenticated]
    public class DiscoverLoaderConfigRequest : IReturn<DiscoverLoaderConfigResult> { }

    public class DiscoverLoaderConfigResult
    {
        public bool RedirectTile { get; set; }
        /// <summary>Huidige paginanamen, zodat een lader (ook een ingebakken kopie in een eigen app) altijd het actuele script laadt.</summary>
        public string UiPage { get; set; }
        public string ButtonPage { get; set; }
        public string Version { get; set; }
    }

    [Route("/Discover/Backdrops", "GET", Summary = "Backgrounds (TMDB trending) for the Discover Media tile on the Emby home page")]
    [Authenticated]
    public class DiscoverBackdropsRequest : IReturn<DiscoverBackdropsResult> { }

    public class DiscoverBackdropsResult
    {
        public List<string> Urls { get; set; } = new List<string>();
    }

    [Route("/Discover/ChannelInfo", "GET", Summary = "Emby id of the Discover channel (also when the channel has been renamed in Emby)")]
    [Authenticated]
    public class DiscoverChannelInfoRequest : IReturn<DiscoverChannelInfoResult> { }

    public class DiscoverChannelInfoResult
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }

    [Route("/Discover/IsDiscoverItem", "GET", Summary = "Does this Emby item belong to the Discover channel? (Emby 4.11 does not always supply ChannelId)")]
    [Authenticated]
    public class DiscoverIsItemRequest : IReturn<DiscoverIsItemResult>
    {
        public string Id { get; set; }
        /// <summary>Optioneel: meerdere id's, komma-gescheiden; het antwoord noemt er dan in Ids welke van Discover zijn.</summary>
        public string Ids { get; set; }
    }

    public class DiscoverIsItemResult
    {
        public bool Ours { get; set; }
        public bool Folder { get; set; }
        public List<string> OurIds { get; set; } = new List<string>();
    }

    [Route("/Discover/ItemCast", "GET", Summary = "Cast (with photo) of a title in the Discover channel")]
    [Authenticated]
    public class DiscoverItemCastRequest : IReturn<DiscoverItemCastResult>
    {
        /// <summary>Emby-item-id van een kanaalmap of kanaalitem.</summary>
        public string Id { get; set; }
    }

    public class DiscoverItemCastResult
    {
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public List<DiscoverPersonDto> Cast { get; set; } = new List<DiscoverPersonDto>();
        /// <summary>Voor het infoblok boven een map: titel, jaar, score, infoteksten en beschrijving.</summary>
        public string Title { get; set; }
        public int Year { get; set; }
        public double Rating { get; set; }
        public List<string> Lines { get; set; } = new List<string>();
        public string Overview { get; set; }
    }

    [Route("/Discover/ItemBackdrop", "GET", Summary = "Background for a page or tile in the Discover channel")]
    [Authenticated]
    public class DiscoverItemBackdropRequest : IReturn<DiscoverItemBackdropResult>
    {
        /// <summary>Emby-item-id (zoals in de URL van de webclient).</summary>
        public string Id { get; set; }
    }

    public class DiscoverItemBackdropResult
    {
        /// <summary>Het item hoort bij het Discover-kanaal.</summary>
        public bool InChannel { get; set; }
        /// <summary>Achtergrond van de titel; leeg = map zonder eigen titel (dan een willekeurige uit /Discover/Backdrops).</summary>
        public string Url { get; set; }
    }

    [Route("/Discover/Seasons", "GET", Summary = "Seasons of a series (for the season picker from a row)")]
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
        private const int MaxPersonItems = 150;
        private const int MaxRecommendations = 20;

        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly ILogger _logger;

        private readonly MediaBrowser.Controller.Library.ILibraryManager _library;

        public RelatedApiService(ILogManager logManager, IJsonSerializer json, MediaBrowser.Controller.Library.ILibraryManager library)
        {
            _library = library;
            _logger = logManager.GetLogger("Discover");
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
        }

        private static bool TmdbReady => !string.IsNullOrWhiteSpace(Plugin.GetCurrentConfiguration().TmdbApiKey);

        private static List<string> _backdrops;
        private static DateTime _backdropsAt;

        /// <summary>Achtergronden van wat nu trending is (films en series), 6 uur bewaard.</summary>
        public async Task<object> Get(DiscoverBackdropsRequest request)
        {
            var res = new DiscoverBackdropsResult();
            if (!TmdbReady) return res;
            var cached = _backdrops;
            if (cached != null && DateTime.UtcNow - _backdropsAt < TimeSpan.FromHours(6)) { res.Urls = cached; return res; }
            try
            {
                var list = new List<string>();
                for (int page = 1; page <= 2; page++)
                {
                    var p = await _tmdb.GetList("/trending/all/week", page, CancellationToken.None).ConfigureAwait(false);
                    if (p == null || p.results == null) break;
                    foreach (var x in p.results)
                        if (x != null && !x.adult && !string.IsNullOrEmpty(x.backdrop_path))
                        {
                            var url = "https://image.tmdb.org/t/p/w1280" + x.backdrop_path;
                            if (!list.Contains(url)) list.Add(url);
                        }
                }
                if (list.Count > 0) { _backdrops = list; _backdropsAt = DateTime.UtcNow; }
                res.Urls = list;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("backgrounds for the home page failed: " + ex.Message);
                if (cached != null) res.Urls = cached;
            }
            return res;
        }

        private static readonly Dictionary<string, string> _itemBackdrops = new Dictionary<string, string>();
        private static readonly System.Text.RegularExpressions.Regex ChannelTitleId =
            new System.Text.RegularExpressions.Regex(@"(?:^|:)([mt]):(\d+)(?::|$)");

        /// <summary>
        /// Zoekt bij een kanaalpagina (titelmap, aanvraagmap, seizoen, trailer) de TMDB-achtergrond van die titel.
        /// Kanaalitems herken je aan hun ExternalId ("ask..."/"tr..."), met daarin "m:123" (film) of "t:123" (serie).
        /// </summary>
        private static readonly object ChannelGate = new object();
        private static DiscoverChannelInfoResult _channel;
        private static DateTime _channelAt;

        private static bool OurExternalId(string ext) =>
            !string.IsNullOrEmpty(ext) && (ext.StartsWith("ask", StringComparison.Ordinal) || ext.StartsWith("tr", StringComparison.Ordinal));

        /// <summary>
        /// Zoekt het Discover-kanaal op inhoud in plaats van op naam: het kanaal waarvan de mappen onze ExternalId's hebben
        /// ("ask..."/"tr..."). Zo werkt alles ook als iemand het kanaal in Emby hernoemt (bv. naar "Aanvragen").
        /// </summary>
        public object Get(DiscoverChannelInfoRequest request)
        {
            lock (ChannelGate)
            {
                if (_channel != null && DateTime.UtcNow - _channelAt < TimeSpan.FromMinutes(10)) return _channel;
            }
            var res = new DiscoverChannelInfoResult();
            try
            {
                var channels = _library.GetItemList(new MediaBrowser.Controller.Entities.InternalItemsQuery { IncludeItemTypes = new[] { "Channel" } });
                foreach (var ch in channels)
                {
                    var kids = _library.GetItemList(new MediaBrowser.Controller.Entities.InternalItemsQuery { ParentIds = new[] { ch.InternalId }, Limit = 25 });
                    if (kids.Any(k => OurExternalId(k.ExternalId)) || string.Equals(ch.Name, "Discover Media", StringComparison.OrdinalIgnoreCase))
                    {
                        res.Id = ch.InternalId.ToString(System.Globalization.CultureInfo.InvariantCulture);
                        res.Name = ch.Name;
                        break;
                    }
                }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("channel lookup failed: " + ex.Message); }
            lock (ChannelGate) { if (res.Id != null) { _channel = res; _channelAt = DateTime.UtcNow; } }
            return res;
        }

        public object Get(DiscoverIsItemRequest request)
        {
            var res = new DiscoverIsItemResult();
            if (!string.IsNullOrWhiteSpace(request.Ids))
            {
                var chInfo = Get(new DiscoverChannelInfoRequest()) as DiscoverChannelInfoResult;
                foreach (var one in request.Ids.Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().Take(400))
                {
                    try
                    {
                        MediaBrowser.Controller.Entities.BaseItem it = null;
                        long iid; Guid g;
                        if (long.TryParse(one, out iid)) it = _library.GetItemById(iid);
                        else if (Guid.TryParse(one, out g)) it = _library.GetItemById(g);
                        if (it == null) continue;
                        if (OurExternalId(it.ExternalId) || (chInfo != null && chInfo.Id == it.InternalId.ToString(System.Globalization.CultureInfo.InvariantCulture)))
                            res.OurIds.Add(one);
                    }
                    catch { }
                }
                return res;
            }
            try
            {
                var raw = (request.Id ?? "").Trim();
                MediaBrowser.Controller.Entities.BaseItem item = null;
                long internalId; Guid guid;
                if (long.TryParse(raw, out internalId)) item = _library.GetItemById(internalId);
                else if (Guid.TryParse(raw, out guid)) item = _library.GetItemById(guid);
                if (item == null) return res;
                res.Folder = item.IsDisplayedAsFolder;
                res.Ours = OurExternalId(item.ExternalId);
                if (!res.Ours)
                {
                    var ch = Get(new DiscoverChannelInfoRequest()) as DiscoverChannelInfoResult;
                    res.Ours = ch != null && ch.Id == item.InternalId.ToString(System.Globalization.CultureInfo.InvariantCulture);
                }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("checking item failed: " + ex.Message); }
            return res;
        }

        public async Task<object> Get(DiscoverItemCastRequest request)
        {
            var res = new DiscoverItemCastResult();
            if (!TmdbReady) return res;
            try
            {
                var raw = (request.Id ?? "").Trim();
                if (raw.Length == 0) return res;
                MediaBrowser.Controller.Entities.BaseItem item = null;
                long internalId;
                Guid guid;
                if (long.TryParse(raw, out internalId)) item = _library.GetItemById(internalId);
                else if (Guid.TryParse(raw, out guid)) item = _library.GetItemById(guid);
                var ext = item == null ? null : item.ExternalId;
                if (string.IsNullOrEmpty(ext) || !(ext.StartsWith("ask", StringComparison.Ordinal) || ext.StartsWith("tr", StringComparison.Ordinal)))
                    return res;
                var m = ChannelTitleId.Match(ext);
                if (!m.Success) return res;
                bool tv = m.Groups[1].Value == "t";
                int tmdbId = int.Parse(m.Groups[2].Value);
                res.Type = tv ? "tv" : "movie";
                res.TmdbId = tmdbId;
                var x = await _tmdb.GetExtraCached(tv, tmdbId, CancellationToken.None).ConfigureAwait(false);
                if (x == null) return res;
                res.Title = tv ? (x.name ?? x.title) : (x.title ?? x.name);
                var d0 = tv ? x.first_air_date : x.release_date;
                int yr; if (!string.IsNullOrEmpty(d0) && d0.Length >= 4 && int.TryParse(d0.Substring(0, 4), out yr)) res.Year = yr;
                res.Rating = x.vote_average;
                res.Overview = x.overview;
                try { res.Lines = InfoText.Lines(null, x, tv, false); } catch { }
                if (x.credits == null || x.credits.cast == null) return res;
                res.Cast = x.credits.cast
                    .Where(c => c != null && c.id > 0 && !string.IsNullOrWhiteSpace(c.name))
                    .OrderBy(c => c.order)
                    .Take(20)
                    .Select(c => new DiscoverPersonDto
                    {
                        Id = c.id,
                        Name = c.name.Trim(),
                        Character = string.IsNullOrWhiteSpace(c.character) ? null : c.character.Trim(),
                        Photo = string.IsNullOrEmpty(c.profile_path) ? null : "https://image.tmdb.org/t/p/w185" + c.profile_path,
                        Department = "Acting"
                    }).ToList();
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("cast item " + request.Id + ": " + ex.Message);
            }
            return res;
        }

        public async Task<object> Get(DiscoverItemBackdropRequest request)
        {
            var res = new DiscoverItemBackdropResult();
            try
            {
                var raw = (request.Id ?? "").Trim();
                if (raw.Length == 0) return res;
                MediaBrowser.Controller.Entities.BaseItem item = null;
                long internalId;
                Guid guid;
                if (long.TryParse(raw, out internalId)) item = _library.GetItemById(internalId);
                else if (Guid.TryParse(raw, out guid)) item = _library.GetItemById(guid);
                var ext = item == null ? null : item.ExternalId;
                if (string.IsNullOrEmpty(ext) || !(ext.StartsWith("ask", StringComparison.Ordinal) || ext.StartsWith("tr", StringComparison.Ordinal)))
                    return res;
                res.InChannel = true;
                var m = ChannelTitleId.Match(ext);
                if (!m.Success || !TmdbReady) return res;
                var key = m.Groups[1].Value + ":" + m.Groups[2].Value;
                string url;
                lock (_itemBackdrops) { if (_itemBackdrops.TryGetValue(key, out url)) { res.Url = url; return res; } }
                int tmdbId = int.Parse(m.Groups[2].Value);
                var t = m.Groups[1].Value == "t"
                    ? await _tmdb.GetTv(tmdbId, CancellationToken.None).ConfigureAwait(false)
                    : await _tmdb.GetMovie(tmdbId, CancellationToken.None).ConfigureAwait(false);
                url = t != null && !string.IsNullOrEmpty(t.backdrop_path) ? "https://image.tmdb.org/t/p/w1280" + t.backdrop_path : null;
                lock (_itemBackdrops) { if (_itemBackdrops.Count > 2000) _itemBackdrops.Clear(); _itemBackdrops[key] = url; }
                res.Url = url;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("background item " + request.Id + ": " + ex.Message);
            }
            return res;
        }

        public object Get(DiscoverLoaderConfigRequest request)
        {
            var res = new DiscoverLoaderConfigResult { RedirectTile = Plugin.GetCurrentConfiguration().InjectWebClientLoader };
            try
            {
                var pages = Plugin.Instance?.GetPages()?.Select(p => p.Name).ToList() ?? new List<string>();
                res.UiPage = pages.FirstOrDefault(n => System.Text.RegularExpressions.Regex.IsMatch(n ?? "", "^discoverui\\d+$"));
                res.ButtonPage = pages.FirstOrDefault(n => (n ?? "").StartsWith("discoverbuttonjs", StringComparison.OrdinalIgnoreCase));
                res.Version = Plugin.VersionString;
            }
            catch { }
            return res;
        }

        public async Task<object> Get(DiscoverPersonRequest request)
        {
            var res = new DiscoverPersonResult();
            if (!TmdbReady || request.Id <= 0) return res;
            try
            {
                var p = await _tmdb.GetPerson(request.Id, CancellationToken.None).ConfigureAwait(false);
                if (p == null) return res;
                res.Found = true;
                res.Id = p.id;
                res.Name = p.name;
                res.Photo = string.IsNullOrEmpty(p.profile_path) ? null : "https://image.tmdb.org/t/p/h632" + p.profile_path;
                res.Biography = p.biography;
                res.Birthday = p.birthday;
                res.Deathday = p.deathday;
                res.PlaceOfBirth = p.place_of_birth;
                res.Department = p.known_for_department;
                res.Gender = p.gender;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("ERROR person " + request.Id + ": " + ex.Message);
            }
            return res;
        }

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
                    DiscoverDiagnostics.Add("person: no TMDB id found for '" + request.Name + "'");
                    return row;
                }
                row.TmdbPersonId = personId;

                var creditsTask = _tmdb.GetPersonCredits(personId, CancellationToken.None);
                var msTask = SafeStates(false);
                var tsTask = SafeStates(true);
                await Task.WhenAll(creditsTask, msTask, tsTask).ConfigureAwait(false);

                // Dubbele TMDB-pagina's van dezelfde titel (bv. "Night in Color" en "Night in Colors"):
                // zelfde soort en jaar en vrijwel dezelfde titel, of precies dezelfde poster -> één houden.
                var seenTitle = new HashSet<string>();
                var seenPoster = new HashSet<string>();
                foreach (var c in creditsTask.Result)
                {
                    if (row.Items.Count >= MaxPersonItems) break;
                    var dto = ToDto(c.Item, c.Tv, c.Tv ? tsTask.Result : msTask.Result);
                    dto.Role = c.Role;
                    var tk = dto.Type + "|" + dto.Year + "|" + LooseTitle(dto.Title);
                    if (!seenTitle.Add(tk)) continue;
                    if (!string.IsNullOrEmpty(dto.Poster) && !seenPoster.Add(dto.Poster)) continue;
                    row.Items.Add(dto);
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                _logger.Error("Discover: person credits failed: {0}", ex.Message);
                DiscoverDiagnostics.Add("ERROR person credits '" + request.Name + "': " + ex.Message);
            }
            return row;
        }

        /// <summary>Titel zonder hoofdletters, accenten, leestekens en de letter s (voor het herkennen van dubbelen).</summary>
        internal static string LooseTitle(string t)
        {
            if (string.IsNullOrEmpty(t)) return "";
            var d = t.Normalize(System.Text.NormalizationForm.FormD);
            var sb = new System.Text.StringBuilder();
            foreach (var ch in d)
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) == System.Globalization.UnicodeCategory.NonSpacingMark) continue;
                var c = char.ToLowerInvariant(ch);
                if (char.IsLetterOrDigit(c) && c != 's') sb.Append(c);
            }
            return sb.ToString();
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
                _logger.Error("Discover: recommendations failed: {0}", ex.Message);
                DiscoverDiagnostics.Add("ERROR recommendations " + request.Type + "/" + request.TmdbId + ": " + ex.Message);
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
                            EpisodeCount = s.episode_count,
                            AirDate = s.air_date,
                            Upcoming = s.season_number > 0 && (string.IsNullOrEmpty(s.air_date) ||
                                string.CompareOrdinal(s.air_date, DateTime.UtcNow.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)) > 0)
                        })
                        .ToList();
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("ERROR seasons " + request.TmdbId + ": " + ex.Message);
            }
            return res;
        }

        private async Task<TmdbCollection> SafeCollection(int movieId)
        {
            try { return await _tmdb.GetMovieCollection(movieId, CancellationToken.None).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB collection for movie " + movieId + " failed: " + ex.Message);
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
                DiscoverDiagnostics.Add("ERROR status " + (tv ? "Sonarr" : "Radarr") + ": " + ex.Message);
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
