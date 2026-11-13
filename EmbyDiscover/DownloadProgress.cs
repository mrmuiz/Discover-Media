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
        /// <summary>ID van de download in de downloader (bij SABnzbd het nzo_id).</summary>
        public string downloadId { get; set; }
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
        /// <summary>downloading, queued, paused, processing (SABnzbd-fase, zie Stage), importwait, importing, importblocked, stalled (probleem)</summary>
        public string State { get; set; }
        /// <summary>Alleen bij State = processing: verifying, repairing, extracting, moving, script, waiting.</summary>
        public string Stage { get; set; }
        /// <summary>Alleen bij Stage = script: de laatste uitvoerregel van het script in SABnzbd.</summary>
        public string Action { get; set; }
        /// <summary>Resterende tijd in seconden, -1 = onbekend.</summary>
        public int TimeLeft { get; set; }
        /// <summary>Totale grootte en wat nog moet in bytes (0 = onbekend).</summary>
        public double Size { get; set; }
        public double SizeLeft { get; set; }
        /// <summary>Downloadsnelheid in bytes per seconde (alleen met SABnzbd), 0 = onbekend.</summary>
        public double Speed { get; set; }
        /// <summary>Voor iedereen: waarom een import geblokkeerd is of wat het probleem is.</summary>
        public string Reason { get; set; }
        /// <summary>Alleen voor beheerders: releasenaam, downloadclient en indexer.</summary>
        public string Release { get; set; }
        public string Client { get; set; }
        public string Indexer { get; set; }
        /// <summary>Alleen voor beheerders: downloadclient, indexer en een eventuele foutmelding (oudere schermen).</summary>
        public string Detail { get; set; }
        /// <summary>Gekoppeld aan een download in SABnzbd.</summary>
        public bool Sab { get; set; }
        /// <summary>Naam van de downloader waaraan deze download is gekoppeld (SABnzbd, NZBGet, qBittorrent, Transmission), anders leeg.</summary>
        public string Via { get; set; }
        /// <summary>Seeders en ratio (torrents), -1 = onbekend.</summary>
        public int Seeds { get; set; } = -1;
        public double Ratio { get; set; } = -1;
    }

    /// <summary>Alle downloads van één film of serie samen.</summary>
    public class QueueEntryDto
    {
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        public int Progress { get; set; }
        public string State { get; set; }
        public string Stage { get; set; }
        public string Action { get; set; }
        public int TimeLeft { get; set; }
        public double Size { get; set; }
        public double SizeLeft { get; set; }
        public double Speed { get; set; }
        public string Reason { get; set; }
        public int Count { get; set; }
        public List<QueuePartDto> Parts { get; set; } = new List<QueuePartDto>();
    }

    public class QueueResultDto
    {
        public List<QueueEntryDto> Items { get; set; } = new List<QueueEntryDto>();
        /// <summary>Algemene toestand van SABnzbd; null als SABnzbd niet is ingesteld of niet bereikbaar was.</summary>
        public SabInfoDto Sab { get; set; }
    }

    internal class RawPart
    {
        public string Type; public int TmdbId; public string Title; public string Label; public string Name;
        public double Size; public double SizeLeft; public string State; public int TimeLeft; public string Release; public string Detail;
        public int Season; public int Episode;
        public string DownloadId, Stage, Reason, Client, Indexer, Via, Action;
        public double Speed;
        public bool Sab;
        public int Seeds = -1;
        public double Ratio = -1;
    }

    /// <summary>
    /// Leest de wachtrijen van Radarr en Sonarr. Het resultaat wordt 2 seconden bewaard, zodat veel
    /// browsers die tegelijk de voortgang verversen samen maar één keer per wachtrij vragen.
    /// </summary>
    internal static class DownloadQueue
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(2);
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
                    if (Plugin.GetCurrentConfiguration().SeerrArrStatus && (RadarrSet || SonarrSet))
                    {
                        try { MergeArr(seerrParts, await ArrParts(json, ct).ConfigureAwait(false)); }
                        catch (Exception ex)
                        {
                            if (ex is OperationCanceledException) throw;
                            DiscoverDiagnostics.Add("ERROR queue Radarr/Sonarr next to Seerr: " + ex.Message);
                        }
                    }
                    if (Plugin.GetCurrentConfiguration().SeerrArrStatus) NudgeArr(json, seerrParts);
                    await WithSab(seerrParts, json, ct).ConfigureAwait(false);
                    _cache = seerrParts;
                    _cacheAt = DateTime.UtcNow;
                    return seerrParts;
                }
                var list = await ArrParts(json, ct).ConfigureAwait(false);
                NudgeArr(json, list);
                await WithSab(list, json, ct).ConfigureAwait(false);
                _cache = list;
                _cacheAt = DateTime.UtcNow;
                return list;
            }
            finally { Lock.Release(); }
        }

        private static readonly TimeSpan NudgeEvery = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan NudgeWindow = TimeSpan.FromMinutes(15);
        private static DateTime _nudgeMovieAt = DateTime.MinValue, _nudgeTvAt = DateTime.MinValue;

        /// <summary>
        /// Radarr/Sonarr verversen hun wachtrij maar eens per minuut. Een net aangevraagde titel die al bij SABnzbd e.d.
        /// binnenkomt, verscheen daardoor pas na ~1 minuut (bij een snelle lijn al op 30-40%). Zolang een aanvraag van de
        /// laatste 15 minuten nog niet in de wachtrij staat, vragen we Radarr/Sonarr (hooguit elke 10 s) om de downloads
        /// meteen te verversen (commando RefreshMonitoredDownloads). Gaat op de achtergrond; fouten worden alleen gelogd.
        /// </summary>
        private static void NudgeArr(IJsonSerializer json, List<RawPart> parts)
        {
            try
            {
                var now = DateTime.UtcNow;
                bool doMovie = RadarrSet && now - _nudgeMovieAt >= NudgeEvery;
                bool doTv = SonarrSet && now - _nudgeTvAt >= NudgeEvery;
                if (!doMovie && !doTv) return;
                bool wantMovie = false, wantTv = false;
                foreach (var r in RequestStore.All(json))
                {
                    DateTime added;
                    if (!DateTime.TryParse(r.Added, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out added)) continue;
                    if (now - added.ToUniversalTime() > NudgeWindow) continue;
                    if (parts.Any(p => p.Type == r.Type && p.TmdbId == r.TmdbId)) continue;
                    if (r.Type == "tv") wantTv = true; else wantMovie = true;
                }
                if (doMovie && wantMovie) { _nudgeMovieAt = now; Refresh(false); }
                if (doTv && wantTv) { _nudgeTvAt = now; Refresh(true); }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("ERROR refreshing queue: " + ex.Message); }
        }

        private static readonly TimeSpan PendingWindow = TimeSpan.FromHours(6);

        /// <summary>Aanvragen van de laatste 6 uur die niet in de wachtrij van Radarr/Sonarr/Seerr staan (één per titel).</summary>
        private static List<StoredRequest> PendingRequests(IJsonSerializer json, List<RawPart> parts)
        {
            var res = new List<StoredRequest>();
            try
            {
                var now = DateTime.UtcNow;
                foreach (var r in RequestStore.All(json))
                {
                    DateTime added;
                    if (!DateTime.TryParse(r.Added, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out added)) continue;
                    if (now - added.ToUniversalTime() > PendingWindow) continue;
                    if (parts.Any(p => p.Type == r.Type && p.TmdbId == r.TmdbId)) continue;
                    if (res.Any(x => x.Type == r.Type && x.TmdbId == r.TmdbId)) continue;
                    res.Add(r);
                }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("ERROR reading recent requests: " + ex.Message); }
            return res;
        }

        private static void Refresh(bool sonarr)
        {
            Task.Run(async () =>
            {
                try
                {
                    await ArrClient.PostRaw(sonarr, "/api/v3/command", "{\"name\":\"RefreshMonitoredDownloads\"}", CancellationToken.None).ConfigureAwait(false);
                    Invalidate();
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("ERROR " + (sonarr ? "Sonarr" : "Radarr") + " RefreshMonitoredDownloads: " + ex.Message); }
            });
        }

        // Echte instellingen van Radarr en Sonarr (ArrClient.RadarrConfigured telt in de Seerr-modus Seerr mee).
        private static bool RadarrSet { get { var c = Plugin.GetCurrentConfiguration(); return !string.IsNullOrWhiteSpace(c.RadarrUrl) && !string.IsNullOrWhiteSpace(c.RadarrApiKey); } }
        private static bool SonarrSet { get { var c = Plugin.GetCurrentConfiguration(); return !string.IsNullOrWhiteSpace(c.SonarrUrl) && !string.IsNullOrWhiteSpace(c.SonarrApiKey); } }

        /// <summary>De wachtrij van Radarr en Sonarr als lijst downloads.</summary>
        private static async Task<List<RawPart>> ArrParts(IJsonSerializer json, CancellationToken ct)
        {
            var list = new List<RawPart>();
            var movies = RadarrSet ? ReadSafe(json, false, ct) : Task.FromResult(new List<ArrQueueFullItemDto>());
            var series = SonarrSet ? ReadSafe(json, true, ct) : Task.FromResult(new List<ArrQueueFullItemDto>());
            await Task.WhenAll(movies, series).ConfigureAwait(false);
            foreach (var r in movies.Result)
            {
                if (r.movie == null || r.movie.tmdbId <= 0 || IsImported(r)) continue;
                list.Add(ToPart(r, "movie", r.movie.tmdbId, r.movie.title, 0, 0, null));
            }
            foreach (var r in series.Result)
            {
                if (r.series == null || r.series.tmdbId <= 0 || IsImported(r)) continue;
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
            return list;
        }

        /// <summary>
        /// Seerr-modus met Radarr/Sonarr erbij: de downloads van Seerr krijgen de status uit Radarr/Sonarr (importfases,
        /// reden bij een probleem, downloadclient en indexer). Koppeling via download-ID, anders via de releasenaam;
        /// bij een film (één download) volstaat de titel.
        /// </summary>
        private static void MergeArr(List<RawPart> seerr, List<RawPart> arr)
        {
            foreach (var p in seerr)
            {
                RawPart m = null;
                if (!string.IsNullOrEmpty(p.DownloadId))
                    m = arr.FirstOrDefault(a => a.Type == p.Type && a.TmdbId == p.TmdbId && string.Equals(a.DownloadId, p.DownloadId, StringComparison.OrdinalIgnoreCase));
                if (m == null)
                {
                    var n = SabClient.Norm(p.Release);
                    if (n.Length > 0) m = arr.FirstOrDefault(a => a.Type == p.Type && a.TmdbId == p.TmdbId && SabClient.Norm(a.Release) == n);
                }
                if (m == null && p.Type == "movie") m = arr.FirstOrDefault(a => a.Type == "movie" && a.TmdbId == p.TmdbId);
                if (m == null) continue;
                p.State = m.State;
                p.Reason = m.Reason;
                p.Client = m.Client;
                p.Indexer = m.Indexer;
                p.Detail = m.Detail;
                if (!string.IsNullOrEmpty(m.Title)) p.Title = m.Title;
                if (!string.IsNullOrEmpty(m.Name)) p.Name = m.Name;
                if (!string.IsNullOrEmpty(m.Release) && string.IsNullOrEmpty(p.Release)) p.Release = m.Release;
                if (string.IsNullOrEmpty(p.DownloadId)) p.DownloadId = m.DownloadId;
                if (m.Size > 0) { p.Size = m.Size; p.SizeLeft = m.SizeLeft; }
                if (m.TimeLeft >= 0) p.TimeLeft = m.TimeLeft;
            }
        }

        /// <summary>
        /// Vult de downloads aan met wat de ingestelde downloaders weten (SABnzbd, NZBGet, qBittorrent, Transmission):
        /// snelheid, fases na 100%, seeders en ratio. Een fout bij één downloader houdt de rest niet tegen.
        /// </summary>
        private static async Task WithSab(List<RawPart> parts, IJsonSerializer json, CancellationToken ct)
        {
            SabClient.Last = null;
            var pending = PendingRequests(json, parts);
            if (parts.Count == 0 && pending.Count == 0) return;
            var fetchers = new List<Tuple<string, Func<Task<SabSnapshot>>>>();
            if (SabClient.Configured) fetchers.Add(Tuple.Create<string, Func<Task<SabSnapshot>>>("SABnzbd", () => SabClient.Fetch(json, ct)));
            if (NzbgetClient.Configured) fetchers.Add(Tuple.Create<string, Func<Task<SabSnapshot>>>("NZBGet", () => NzbgetClient.Fetch(json, ct)));
            if (QbitClient.Configured) fetchers.Add(Tuple.Create<string, Func<Task<SabSnapshot>>>("qBittorrent", () => QbitClient.Fetch(json, ct)));
            if (TransmissionClient.Configured) fetchers.Add(Tuple.Create<string, Func<Task<SabSnapshot>>>("Transmission", () => TransmissionClient.Fetch(json, ct)));
            foreach (var f in fetchers)
            {
                try
                {
                    var snap = await f.Item2().ConfigureAwait(false);
                    if (snap == null) continue;
                    SabClient.Apply(snap, parts);
                    SabClient.AddMissing(snap, parts, pending);
                    if (snap.HasGlobal && SabClient.Last == null) SabClient.Last = snap;
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("ERROR " + f.Item1 + " read: " + ex.Message);
                }
            }
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
                DiscoverDiagnostics.Add("ERROR queue " + (sonarr ? "Sonarr" : "Radarr") + " read: " + ex.Message);
                return new List<ArrQueueFullItemDto>();
            }
        }

        private static RawPart ToPart(ArrQueueFullItemDto r, string type, int tmdbId, string title, int season, int number, string label, string epTitle = null)
        {
            // De reden (foutmelding of statusberichten van Radarr/Sonarr) is voor iedereen; client en indexer alleen voor beheerders.
            var why = new List<string>();
            if (!string.IsNullOrWhiteSpace(r.errorMessage)) why.Add(r.errorMessage.Trim());
            if (r.statusMessages != null)
                foreach (var m in r.statusMessages)
                    if (m != null && m.messages != null)
                        foreach (var s in m.messages)
                            if (!string.IsNullOrWhiteSpace(s) && !why.Contains(s.Trim())) why.Add(s.Trim());
            var detail = new List<string>();
            if (!string.IsNullOrWhiteSpace(r.downloadClient)) detail.Add(r.downloadClient);
            if (!string.IsNullOrWhiteSpace(r.indexer)) detail.Add(r.indexer);
            detail.AddRange(why);
            return new RawPart
            {
                Type = type, TmdbId = tmdbId, Title = title, Label = label ?? "", Name = epTitle,
                Size = r.size, SizeLeft = r.sizeleft, State = MapState(r), TimeLeft = ParseTime(r.timeleft),
                Release = r.title, Detail = detail.Count > 0 ? string.Join(" · ", detail) : null,
                Reason = why.Count > 0 ? string.Join(" · ", why) : null,
                Client = string.IsNullOrWhiteSpace(r.downloadClient) ? null : r.downloadClient,
                Indexer = string.IsNullOrWhiteSpace(r.indexer) ? null : r.indexer,
                DownloadId = r.downloadId,
                Season = season, Episode = number
            };
        }

        /// <summary>
        /// "imported" betekent dat de import klaar is; de download blijft dan nog in de wachtrij staan
        /// (bijvoorbeeld een torrent die blijft seeden). Dat is geen "bezig met importeren" meer.
        /// </summary>
        private static bool IsImported(ArrQueueFullItemDto r)
        {
            return string.Equals(r.trackedDownloadState, "imported", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>Radarr/Sonarr-status vertaald naar de paar toestanden die de browser kent.</summary>
        internal static string MapState(ArrQueueFullItemDto r)
        {
            var tracked = (r.trackedDownloadState ?? "").ToLowerInvariant();
            var status = (r.status ?? "").ToLowerInvariant();
            // Importfases uit elkaar: een geblokkeerde import mag er niet uitzien als een lopende import.
            if (tracked == "importblocked" || tracked == "importfailed") return "importblocked";
            if (tracked == "importpending") return "importwait";
            if (tracked == "importing") return "importing";
            if (tracked.StartsWith("failed", StringComparison.Ordinal) || status == "failed" || status == "warning" ||
                status == "downloadclientunavailable" || string.Equals(r.trackedDownloadStatus, "error", StringComparison.OrdinalIgnoreCase)) return "stalled";
            if (tracked.StartsWith("import", StringComparison.Ordinal) || status == "completed") return "importing";
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

        /// <summary>
        /// Toestand van een hele film of serie. Downloaden gaat voor; daarna nabewerking en import. Een geblokkeerde import
        /// of een probleem staat boven wachten en pauze, zodat het niet onder een rustige status verdwijnt.
        /// </summary>
        private static string EntryState(List<RawPart> list)
        {
            Func<string, bool> any = s => list.Any(p => p.State == s);
            if (any("downloading")) return "downloading";
            if (any("processing")) return "processing";
            if (any("importing")) return "importing";
            if (any("importblocked")) return "importblocked";
            if (any("stalled")) return "stalled";
            if (any("importwait")) return "importwait";
            if (list.All(p => p.State == "paused")) return "paused";
            if (any("paused") && !any("queued")) return "paused";
            return "queued";
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
                    State = EntryState(list),
                    Size = size,
                    SizeLeft = left,
                    Speed = list.Max(p => p.Speed)
                };
                var processing = list.FirstOrDefault(p => p.State == "processing");
                if (processing != null) { entry.Stage = processing.Stage; entry.Action = processing.Action; }
                var problem = list.FirstOrDefault(p => (p.State == "importblocked" || p.State == "stalled") && !string.IsNullOrWhiteSpace(p.Reason));
                if (problem != null) entry.Reason = problem.Reason;
                foreach (var p in list)
                {
                    entry.Parts.Add(new QueuePartDto
                    {
                        Label = p.Label,
                        Name = p.Name,
                        Progress = Pct(p.Size, p.SizeLeft),
                        State = p.State,
                        Stage = p.Stage,
                        Action = p.Action,
                        TimeLeft = p.TimeLeft,
                        Size = p.Size,
                        SizeLeft = p.SizeLeft,
                        Speed = p.Speed,
                        Reason = p.Reason,
                        Sab = p.Sab,
                        Via = p.Via,
                        Seeds = p.Seeds,
                        Ratio = p.Ratio,
                        Release = admin ? p.Release : null,
                        Client = admin ? p.Client : null,
                        Indexer = admin ? p.Indexer : null,
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
        /// <summary>Er is al een melding "beschikbaar" naar de aanvrager gestuurd.</summary>
        public bool Notified { get; set; }
        /// <summary>Is ooit gezien als "nog niet beschikbaar"; alleen dan volgt een melding (geen meldingen voor oude aanvragen).</summary>
        public bool SeenPending { get; set; }
    }

    public class AdminRequestDto
    {
        public string UserId { get; set; }
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        public int Year { get; set; }
        public string Poster { get; set; }
        public string Added { get; set; }
        /// <summary>0 = niet (meer) in Radarr/Sonarr/Seerr, 1 = aangevraagd, 2 = beschikbaar</summary>
        public int Status { get; set; }
    }

    public class AdminRequestsDto
    {
        public List<AdminRequestDto> Items { get; set; } = new List<AdminRequestDto>();
        public int Limit { get; set; }
        public int LimitDays { get; set; }
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
            catch (Exception ex) { DiscoverDiagnostics.Add("reading the request list failed: " + ex.Message); }
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
            catch (Exception ex) { DiscoverDiagnostics.Add("saving the request list failed: " + ex.Message); }
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
            catch (Exception ex) { DiscoverDiagnostics.Add("remembering the request failed: " + ex.Message); }
        }

        /// <summary>Aanvragen van deze gebruiker sinds een moment, oudste datum eerst (voor de limiet).</summary>
        internal static List<DateTime> DatesSince(IJsonSerializer json, object userId, DateTime sinceUtc)
        {
            var uid = RequestAccess.Normalize(userId);
            var res = new List<DateTime>();
            lock (Gate)
            {
                foreach (var r in Load(json).Requests)
                {
                    DateTime d;
                    if (r.UserId == uid && DateTime.TryParse(r.Added, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out d) &&
                        d.ToUniversalTime() >= sinceUtc) res.Add(d.ToUniversalTime());
                }
            }
            res.Sort();
            return res;
        }

        /// <summary>Wijzig de lijst onder het slot en sla op als de functie true teruggeeft.</summary>
        internal static void Update(IJsonSerializer json, Func<List<StoredRequest>, bool> change)
        {
            lock (Gate)
            {
                var d = Load(json);
                if (change(d.Requests)) Save(json);
            }
        }

        internal static List<StoredRequest> All(IJsonSerializer json)
        {
            lock (Gate) { return new List<StoredRequest>(Load(json).Requests); }
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

    [Route("/Discover/Queue", "GET", Summary = "Download progress from the Radarr and Sonarr queue")]
    [Authenticated]
    public class DiscoverQueueRequest : IReturn<QueueResultDto> { }

    [Route("/Discover/MyRequests", "GET", Summary = "What the logged-in user has requested through Discover")]
    [Authenticated]
    public class DiscoverMyRequestsRequest : IReturn<DiscoverRow> { }

    [Route("/Discover/AllRequests", "GET", Summary = "All requests through Discover, for administrators")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverAllRequestsRequest : IReturn<AdminRequestsDto> { }

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
                res.Sab = SabClient.Info();
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("ERROR queue: " + ex.Message); }
            return res;
        }

        public async Task<object> Get(DiscoverAllRequestsRequest request)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var res = new AdminRequestsDto { Limit = cfg.RequestLimit, LimitDays = cfg.RequestLimitDays };
            var all = RequestStore.All(_json);
            Dictionary<int, bool> ms = new Dictionary<int, bool>(), ts = new Dictionary<int, bool>();
            try
            {
                if (all.Any(r => r.Type == "movie")) ms = await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false);
                if (all.Any(r => r.Type == "tv")) ts = await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("ERROR status for the requests overview: " + ex.Message); }
            foreach (var r in all)
            {
                var states = r.Type == "tv" ? ts : ms;
                bool hasFiles;
                int status = states.TryGetValue(r.TmdbId, out hasFiles) ? (hasFiles ? 2 : 1) : 0;
                res.Items.Add(new AdminRequestDto
                {
                    UserId = r.UserId, Type = r.Type, TmdbId = r.TmdbId, Title = r.Title, Year = r.Year,
                    Poster = r.Poster, Added = r.Added, Status = status
                });
            }
            res.Items = res.Items.OrderByDescending(x => x.Added ?? "").ToList();
            return res;
        }

        public async Task<object> Get(DiscoverMyRequestsRequest request)
        {
            var row = new DiscoverRow
            {
                Key = "my_requests",
                Title = DiscoverLanguage.Text("Mijn aanvragen", "My requests", "Meine Anfragen")
            };
            if (!Plugin.GetCurrentConfiguration().ShowMyRequests) return row; // rij uitgezet in de instellingen
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
            catch (Exception ex) { DiscoverDiagnostics.Add("ERROR status for My requests: " + ex.Message); }

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
