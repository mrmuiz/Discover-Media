using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    // ---------- Radarr/Sonarr-wachtrij (zoals Seerr de voortgang toont) ----------

    public class ArrQueueMovieRef { public int tmdbId { get; set; } public string title { get; set; } }
    public class ArrQueueSeriesRef { public int tmdbId { get; set; } public string title { get; set; } }
    public class ArrQueueEpisodeRef { public int seasonNumber { get; set; } public int episodeNumber { get; set; } public string title { get; set; } }
    public class ArrQueueMessage { public string title { get; set; } public List<string> messages { get; set; } }

    public class ArrQueueFullItemDto
    {
        public int id { get; set; }
        public int movieId { get; set; }
        public int seriesId { get; set; }
        public int seasonNumber { get; set; }
        public string title { get; set; }
        public double size { get; set; }
        public double sizeleft { get; set; }
        public string timeleft { get; set; }
        public string status { get; set; }
        public string trackedDownloadStatus { get; set; }
        public string trackedDownloadState { get; set; }
        public string errorMessage { get; set; }
        public string downloadClient { get; set; }
        public string indexer { get; set; }
        public List<ArrQueueMessage> statusMessages { get; set; }
        public ArrQueueMovieRef movie { get; set; }
        public ArrQueueSeriesRef series { get; set; }
        public ArrQueueEpisodeRef episode { get; set; }
        public List<ArrQueueEpisodeRef> episodes { get; set; }
    }

    public class ArrQueueFullDto { public List<ArrQueueFullItemDto> records { get; set; } }

    /// <summary>Eén download (film of aflevering) zoals de browser hem toont.</summary>
    public class QueuePartDto
    {
        /// <summary>"S03E05", leeg bij een film.</summary>
        public string Label { get; set; }
        /// <summary>Titel van de aflevering (zonder releasenaam).</summary>
        public string Name { get; set; }
        public int Progress { get; set; }
        /// <summary>downloading, paused, queued, importing, stalled</summary>
        public string State { get; set; }
        /// <summary>Resterende tijd in seconden, -1 = onbekend.</summary>
        public int TimeLeft { get; set; }
        /// <summary>Alleen voor beheerders: releasenaam.</summary>
        public string Release { get; set; }
        /// <summary>Alleen voor beheerders: downloadclient, indexer en een eventuele foutmelding.</summary>
        public string Detail { get; set; }
    }

    /// <summary>Alle downloads van één film of serie samen.</summary>
    public class QueueEntryDto
    {
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        public int Progress { get; set; }
        public string State { get; set; }
        public int TimeLeft { get; set; }
        public int Count { get; set; }
        public List<QueuePartDto> Parts { get; set; } = new List<QueuePartDto>();
    }

    public class QueueResultDto
    {
        public List<QueueEntryDto> Items { get; set; } = new List<QueueEntryDto>();
    }

    internal class RawPart
    {
        public string Type; public int TmdbId; public string Title; public string Label; public string Name;
        public double Size; public double SizeLeft; public string State; public int TimeLeft; public string Release; public string Detail;
        public int Season; public int Episode;
    }

    /// <summary>
    /// Leest de wachtrijen van Radarr en Sonarr. Het resultaat wordt 8 seconden bewaard, zodat veel
    /// browsers die tegelijk de voortgang verversen samen maar één keer per wachtrij vragen.
    /// </summary>
    internal static class DownloadQueue
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(8);
        private static readonly SemaphoreSlim Lock = new SemaphoreSlim(1, 1);
        private static List<RawPart> _cache;
        private static DateTime _cacheAt;

        internal static void Invalidate() { _cache = null; }

        internal static async Task<List<RawPart>> GetParts(IJsonSerializer json, CancellationToken ct)
        {
            var c = _cache;
            if (c != null && DateTime.UtcNow - _cacheAt < Ttl) return c;
            await Lock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                c = _cache;
                if (c != null && DateTime.UtcNow - _cacheAt < Ttl) return c;
                if (SeerrClient.Enabled)
                {
                    var seerrParts = SeerrClient.Configured
                        ? await SeerrClient.GetQueueParts(json, ct).ConfigureAwait(false)
                        : new List<RawPart>();
                    _cache = seerrParts;
                    _cacheAt = DateTime.UtcNow;
                    return seerrParts;
                }
                var list = new List<RawPart>();
                var movies = ArrClient.RadarrConfigured ? ReadSafe(json, false, ct) : Task.FromResult(new List<ArrQueueFullItemDto>());
                var series = ArrClient.SonarrConfigured ? ReadSafe(json, true, ct) : Task.FromResult(new List<ArrQueueFullItemDto>());
                await Task.WhenAll(movies, series).ConfigureAwait(false);
                foreach (var r in movies.Result)
                {
                    if (r.movie == null || r.movie.tmdbId <= 0) continue;
                    list.Add(ToPart(r, "movie", r.movie.tmdbId, r.movie.title, 0, 0, null));
                }
                foreach (var r in series.Result)
                {
                    if (r.series == null || r.series.tmdbId <= 0) continue;
                    var ep = r.episode ?? (r.episodes != null && r.episodes.Count > 0 ? r.episodes[0] : null);
                    int season = ep != null ? ep.seasonNumber : r.seasonNumber;
                    int number = ep != null ? ep.episodeNumber : 0;
                    // Een seizoenspakket bevat meer afleveringen; dan staat er "S03E01-E08".
                    string label = season > 0 || number > 0 ? "S" + season.ToString("00") + (number > 0 ? "E" + number.ToString("00") : "") : "";
                    if (r.episodes != null && r.episodes.Count > 1)
                    {
                        var last = r.episodes.OrderBy(e => e.episodeNumber).Last();
                        if (last.episodeNumber > number) label += "-E" + last.episodeNumber.ToString("00");
                    }
                    list.Add(ToPart(r, "tv", r.series.tmdbId, r.series.title, season, number, label, ep != null ? ep.title : null));
                }
                _cache = list;
                _cacheAt = DateTime.UtcNow;
                return list;
            }
            finally { Lock.Release(); }
        }

        private static async Task<List<ArrQueueFullItemDto>> ReadSafe(IJsonSerializer json, bool sonarr, CancellationToken ct)
        {
            try
            {
                var path = sonarr
                    ? "/api/v3/queue?page=1&pageSize=500&includeSeries=true&includeEpisode=true&includeUnknownSeriesItems=false"
                    : "/api/v3/queue?page=1&pageSize=500&includeMovie=true&includeUnknownMovieItems=false";
                var text = await ArrClient.GetRaw(sonarr, path, ct).ConfigureAwait(false);
                var q = json.DeserializeFromString<ArrQueueFullDto>(text);
                return q != null && q.records != null ? q.records : new List<ArrQueueFullItemDto>();
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("FOUT wachtrij " + (sonarr ? "Sonarr" : "Radarr") + " lezen: " + ex.Message);
                return new List<ArrQueueFullItemDto>();
            }
        }

        private static RawPart ToPart(ArrQueueFullItemDto r, string type, int tmdbId, string title, int season, int number, string label, string epTitle = null)
        {
            var detail = new List<string>();
            if (!string.IsNullOrWhiteSpace(r.downloadClient)) detail.Add(r.downloadClient);
            if (!string.IsNullOrWhiteSpace(r.indexer)) detail.Add(r.indexer);
            if (!string.IsNullOrWhiteSpace(r.errorMessage)) detail.Add(r.errorMessage);
            if (r.statusMessages != null)
                foreach (var m in r.statusMessages)
                    if (m != null && m.messages != null)
                        foreach (var s in m.messages)
                            if (!string.IsNullOrWhiteSpace(s) && !detail.Contains(s)) detail.Add(s);
            return new RawPart
            {
                Type = type, TmdbId = tmdbId, Title = title, Label = label ?? "", Name = epTitle,
                Size = r.size, SizeLeft = r.sizeleft, State = MapState(r), TimeLeft = ParseTime(r.timeleft),
                Release = r.title, Detail = detail.Count > 0 ? string.Join(" · ", detail) : null,
                Season = season, Episode = number
            };
        }

        /// <summary>Radarr/Sonarr-status vertaald naar de paar toestanden die de browser kent.</summary>
        internal static string MapState(ArrQueueFullItemDto r)
        {
            var tracked = (r.trackedDownloadState ?? "").ToLowerInvariant();
            var status = (r.status ?? "").ToLowerInvariant();
            if (tracked.StartsWith("import", StringComparison.Ordinal) || status == "completed") return "importing";
            if (tracked.StartsWith("failed", StringComparison.Ordinal) || status == "failed" || status == "warning" ||
                status == "downloadclientunavailable" || string.Equals(r.trackedDownloadStatus, "error", StringComparison.OrdinalIgnoreCase)) return "stalled";
            if (status == "paused") return "paused";
            if (status == "queued" || status == "delay" || status == "fallback") return "queued";
            if (status == "downloading") return "downloading";
            return "queued";
        }

        internal static int ParseTime(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return -1;
            TimeSpan t;
            if (TimeSpan.TryParse(s, CultureInfo.InvariantCulture, out t) && t.TotalSeconds >= 0)
                return (int)Math.Min(int.MaxValue, t.TotalSeconds);
            return -1;
        }

        private static int Pct(double size, double left)
        {
            if (size <= 0) return 0;
            var p = (int)Math.Floor((size - Math.Max(0, left)) * 100.0 / size);
            return Math.Max(0, Math.Min(100, p));
        }

        /// <summary>Per film/serie samengevoegd. admin = releasenaam en details meesturen.</summary>
        internal static List<QueueEntryDto> Group(List<RawPart> parts, bool admin)
        {
            var result = new List<QueueEntryDto>();
            foreach (var g in parts.GroupBy(p => p.Type + ":" + p.TmdbId))
            {
                var list = g.OrderBy(p => p.Season).ThenBy(p => p.Episode).ToList();
                var first = list[0];
                double size = list.Sum(p => p.Size), left = list.Sum(p => p.SizeLeft);
                var entry = new QueueEntryDto
                {
                    Type = first.Type,
                    TmdbId = first.TmdbId,
                    Title = first.Title,
                    Count = list.Count,
                    Progress = Pct(size, left),
                    TimeLeft = list.Any(p => p.TimeLeft >= 0) ? list.Where(p => p.TimeLeft >= 0).Max(p => p.TimeLeft) : -1,
                    State = list.Any(p => p.State == "downloading") ? "downloading"
                        : list.All(p => p.State == "importing") ? "importing"
                        : list.All(p => p.State == "paused") ? "paused"
                        : list.Any(p => p.State == "stalled") && list.All(p => p.State == "stalled" || p.State == "paused") ? "stalled"
                        : list.Any(p => p.State == "paused") && !list.Any(p => p.State == "queued") ? "paused"
                        : "queued"
                };
                foreach (var p in list)
                {
                    entry.Parts.Add(new QueuePartDto
                    {
                        Label = p.Label,
                        Name = p.Name,
                        Progress = Pct(p.Size, p.SizeLeft),
                        State = p.State,
                        TimeLeft = p.TimeLeft,
                        Release = admin ? p.Release : null,
                        Detail = admin ? p.Detail : null
                    });
                }
                result.Add(entry);
            }
            return result;
        }
    }

    // ---------- Aanvragen per gebruiker (voor de rij "Mijn aanvragen") ----------

    public class StoredRequest
    {
        public string UserId { get; set; }
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        public int Year { get; set; }
        public string Poster { get; set; }
        public string Backdrop { get; set; }
        public double Rating { get; set; }
        public string Overview { get; set; }
        public string Added { get; set; }
    }

    public class StoredRequestFile { public List<StoredRequest> Requests { get; set; } = new List<StoredRequest>(); }

    /// <summary>
    /// Onthoudt wie wat heeft aangevraagd, in discover-requests.json in Emby's datamap. Alleen gebruiker,
    /// titel, TMDB-id en datum; per gebruiker de laatste 50. Aanvragen die rechtstreeks in Radarr, Sonarr
    /// of Seerr zijn gedaan staan hier niet in.
    /// </summary>
    internal static class RequestStore
    {
        private const int MaxPerUser = 50;
        private static readonly object Gate = new object();
        private static StoredRequestFile _data;

        private static string FilePath()
        {
            var dir = Plugin.Instance != null ? Plugin.Instance.DataPath : null;
            if (string.IsNullOrWhiteSpace(dir)) dir = Path.GetTempPath();
            return Path.Combine(dir, "discover-requests.json");
        }

        private static StoredRequestFile Load(IJsonSerializer json)
        {
            if (_data != null) return _data;
            try
            {
                var path = FilePath();
                if (File.Exists(path))
                    _data = json.DeserializeFromString<StoredRequestFile>(File.ReadAllText(path));
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("aanvragenlijst lezen mislukt: " + ex.Message); }
            if (_data == null) _data = new StoredRequestFile();
            if (_data.Requests == null) _data.Requests = new List<StoredRequest>();
            return _data;
        }

        private static void Save(IJsonSerializer json)
        {
            try
            {
                var path = FilePath();
                var tmp = path + ".tmp";
                File.WriteAllText(tmp, json.SerializeToString(_data));
                if (File.Exists(path)) File.Delete(path);
                File.Move(tmp, path);
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("aanvragenlijst opslaan mislukt: " + ex.Message); }
        }

        internal static void Add(IJsonSerializer json, object userId, bool tv, TmdbItem item, int tmdbId)
        {
            var uid = RequestAccess.Normalize(userId);
            if (uid.Length == 0 || tmdbId <= 0) return;
            try
            {
                lock (Gate)
                {
                    var d = Load(json);
                    var type = tv ? "tv" : "movie";
                    d.Requests.RemoveAll(r => r.UserId == uid && r.Type == type && r.TmdbId == tmdbId);
                    var date = item == null ? null : (tv ? item.first_air_date : item.release_date);
                    int year;
                    d.Requests.Insert(0, new StoredRequest
                    {
                        UserId = uid,
                        Type = type,
                        TmdbId = tmdbId,
                        Title = item == null ? null : (tv ? (item.name ?? item.title) : (item.title ?? item.name)),
                        Year = !string.IsNullOrEmpty(date) && date.Length >= 4 && int.TryParse(date.Substring(0, 4), out year) ? year : 0,
                        Poster = item == null || string.IsNullOrEmpty(item.poster_path) ? null : "https://image.tmdb.org/t/p/w342" + item.poster_path,
                        Backdrop = item == null || string.IsNullOrEmpty(item.backdrop_path) ? null : "https://image.tmdb.org/t/p/w780" + item.backdrop_path,
                        Rating = item == null ? 0 : item.vote_average,
                        Overview = item == null ? null : item.overview,
                        Added = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture)
                    });
                    var mine = d.Requests.Where(r => r.UserId == uid).Skip(MaxPerUser).ToList();
                    foreach (var r in mine) d.Requests.Remove(r);
                    Save(json);
                }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("aanvraag onthouden mislukt: " + ex.Message); }
        }

        internal static List<StoredRequest> For(IJsonSerializer json, object userId)
        {
            var uid = RequestAccess.Normalize(userId);
            lock (Gate)
            {
                return Load(json).Requests.Where(r => r.UserId == uid).ToList();
            }
        }
    }

    // ---------- API ----------

    [Route("/Discover/Queue", "GET", Summary = "Downloadvoortgang uit de wachtrij van Radarr en Sonarr")]
    [Authenticated]
    public class DiscoverQueueRequest : IReturn<QueueResultDto> { }

    [Route("/Discover/MyRequests", "GET", Summary = "Wat de ingelogde gebruiker via Discover heeft aangevraagd")]
    [Authenticated]
    public class DiscoverMyRequestsRequest : IReturn<DiscoverRow> { }

    public class DownloadProgressService : IService, IRequiresRequest
    {
        /// <summary>Beschikbare titels blijven zo lang in "Mijn aanvragen" staan.</summary>
        private static readonly TimeSpan KeepAvailable = TimeSpan.FromDays(14);
        private const int MaxShown = 30;

        private readonly IJsonSerializer _json;
        private readonly IAuthorizationContext _auth;
        private readonly ArrClient _arr;

        public IRequest Request { get; set; }

        public DownloadProgressService(IJsonSerializer json, IAuthorizationContext auth)
        {
            _json = json;
            _auth = auth;
            _arr = new ArrClient(json);
        }

        private AuthorizationInfo Who()
        {
            try { return _auth.GetAuthorizationInfo(Request); } catch { return null; }
        }

        public async Task<object> Get(DiscoverQueueRequest request)
        {
            var info = Who();
            bool admin = info != null && info.User != null && info.User.Policy != null && info.User.Policy.IsAdministrator;
            var res = new QueueResultDto();
            try
            {
                var parts = await DownloadQueue.GetParts(_json, CancellationToken.None).ConfigureAwait(false);
                res.Items = DownloadQueue.Group(parts, admin);
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("FOUT wachtrij: " + ex.Message); }
            return res;
        }

        public async Task<object> Get(DiscoverMyRequestsRequest request)
        {
            var row = new DiscoverRow
            {
                Key = "my_requests",
                Title = DiscoverLanguage.Text("Mijn aanvragen", "My requests", "Meine Anfragen")
            };
            var info = Who();
            if (info == null) return row;
            var mine = RequestStore.For(_json, info.UserId);
            if (mine.Count == 0) return row;

            Dictionary<int, bool> ms = new Dictionary<int, bool>(), ts = new Dictionary<int, bool>();
            try
            {
                if (mine.Any(r => r.Type == "movie")) ms = await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false);
                if (mine.Any(r => r.Type == "tv")) ts = await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("FOUT status voor Mijn aanvragen: " + ex.Message); }

            foreach (var r in mine)
            {
                var states = r.Type == "tv" ? ts : ms;
                bool hasFiles;
                // Niet meer in Radarr/Sonarr (geannuleerd of verwijderd): niet meer tonen.
                if (!states.TryGetValue(r.TmdbId, out hasFiles)) continue;
                DateTime added;
                if (hasFiles && DateTime.TryParse(r.Added, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out added) &&
                    DateTime.UtcNow - added.ToUniversalTime() > KeepAvailable) continue;
                row.Items.Add(new DiscoverItemDto
                {
                    TmdbId = r.TmdbId,
                    Type = r.Type,
                    Title = r.Title ?? "?",
                    Year = r.Year,
                    Poster = r.Poster,
                    Backdrop = r.Backdrop,
                    Rating = r.Rating,
                    Overview = r.Overview,
                    Status = hasFiles ? 2 : 1
                });
                if (row.Items.Count >= MaxShown) break;
            }
            return row;
        }
    }
}
