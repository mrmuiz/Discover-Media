using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    // ---------- Seerr-API (seerr-team/seerr, ook Overseerr/Jellyseerr) ----------

    public class SeerrSeasonDto { public int seasonNumber { get; set; } public int status { get; set; } }

    public class SeerrEpisodeRef { public int seasonNumber { get; set; } public int episodeNumber { get; set; } }

    public class SeerrDownloadDto
    {
        public string mediaType { get; set; }
        public double size { get; set; }
        public double sizeLeft { get; set; }
        public string status { get; set; }
        public string timeLeft { get; set; }
        public string title { get; set; }
        /// <summary>ID van de download in de downloader; niet elke Seerr-versie stuurt dit mee (dan koppelen we op releasenaam).</summary>
        public string downloadId { get; set; }
        public SeerrEpisodeRef episode { get; set; }
    }

    public class SeerrRequestRef { public int id { get; set; } public int status { get; set; } }

    public class SeerrMediaDto
    {
        public int id { get; set; }
        public string mediaType { get; set; }
        public int tmdbId { get; set; }
        public int tvdbId { get; set; }
        /// <summary>1 onbekend, 2 in afwachting, 3 bezig, 4 gedeeltelijk, 5 beschikbaar, 6 geblokkeerd, 7 verwijderd.</summary>
        public int status { get; set; }
        public string createdAt { get; set; }
        public List<SeerrSeasonDto> seasons { get; set; }
        public List<SeerrDownloadDto> downloadStatus { get; set; }
        /// <summary>Aanvragen bij deze titel (status 1 wacht op goedkeuring, 2 goedgekeurd, 3 afgewezen, 4 mislukt).</summary>
        public List<SeerrRequestRef> requests { get; set; }
    }

    public class SeerrPageInfo { public int pages { get; set; } public int page { get; set; } public int results { get; set; } }
    public class SeerrMediaPage { public SeerrPageInfo pageInfo { get; set; } public List<SeerrMediaDto> results { get; set; } }

    public class SeerrUserDto { public int id { get; set; } public string jellyfinUserId { get; set; } public string displayName { get; set; } }
    public class SeerrUserPage { public SeerrPageInfo pageInfo { get; set; } public List<SeerrUserDto> results { get; set; } }

    public class SeerrMessageDto { public string message { get; set; } }
    public class SeerrStatusDto { public string version { get; set; } }
    public class SeerrMeDto { public int id { get; set; } public string displayName { get; set; } }
    public class SeerrServerDto { public int id { get; set; } public bool is4k { get; set; } public bool isDefault { get; set; } }
    public class SeerrMediaInfoHolder { public SeerrMediaDto mediaInfo { get; set; } }
    /// <summary>Aanvraag zoals Seerr hem teruggeeft: status 1 = wacht op goedkeuring, 2 = goedgekeurd.</summary>
    public class SeerrRequestDto { public int id { get; set; } public int status { get; set; } }

    /// <summary>
    /// Aanvragen via Seerr in plaats van rechtstreeks naar Radarr/Sonarr. Seerr beheert zelf zijn Radarr- en
    /// Sonarr-servers; de plugin praat alleen met de Seerr-API (X-Api-Key, optioneel X-Api-User).
    /// </summary>
    internal static class SeerrClient
    {
        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler(true)) { Timeout = TimeSpan.FromSeconds(30) };
        private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan UserTtl = TimeSpan.FromMinutes(10);
        private static readonly SemaphoreSlim _mediaLock = new SemaphoreSlim(1, 1);
        private static readonly SemaphoreSlim _userLock = new SemaphoreSlim(1, 1);

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _pending =
            new System.Collections.Concurrent.ConcurrentDictionary<string, bool>();

        /// <summary>De laatste aanvraag voor deze titel wacht in Seerr op goedkeuring door een beheerder.</summary>
        internal static bool WaitsForApproval(bool tv, int tmdbId)
        {
            bool v;
            return Enabled && _pending.TryGetValue((tv ? "t:" : "m:") + tmdbId, out v) && v;
        }

        private static List<SeerrMediaDto> _media;
        private static DateTime _mediaAt;
        private static Dictionary<string, int> _users;
        private static DateTime _usersAt;

        internal static bool Enabled
        {
            get
            {
                var c = Plugin.GetCurrentConfiguration();
                return string.Equals(c.RequestService, "seerr", StringComparison.OrdinalIgnoreCase);
            }
        }

        internal static bool Configured
        {
            get
            {
                var c = Plugin.GetCurrentConfiguration();
                return Enabled && !string.IsNullOrWhiteSpace(c.SeerrUrl) && !string.IsNullOrWhiteSpace(c.SeerrApiKey);
            }
        }

        internal static void Invalidate() { _media = null; }

        // ---------- 4K: alleen als Seerr een aparte 4K-server heeft ----------
        private static bool _has4kMovie, _has4kTv;
        private static DateTime _4kAt;
        private static int _4kBusy;

        /// <summary>Bewaarde waarde (10 min); ververst op de achtergrond. Alleen in de Seerr-modus.</summary>
        internal static bool Has4k(IJsonSerializer json, bool tv)
        {
            if (!Configured) return false;
            if (DateTime.UtcNow - _4kAt > TimeSpan.FromMinutes(10) && Interlocked.Exchange(ref _4kBusy, 1) == 0)
            {
                Task.Run(async () =>
                {
                    try
                    {
                        _has4kMovie = await AnyFourK(json, "/settings/radarr").ConfigureAwait(false);
                        _has4kTv = await AnyFourK(json, "/settings/sonarr").ConfigureAwait(false);
                        _4kAt = DateTime.UtcNow;
                    }
                    catch (Exception ex) { DiscoverDiagnostics.Add("Seerr 4K-servers opvragen mislukt: " + ex.Message); _4kAt = DateTime.UtcNow; }
                    finally { Interlocked.Exchange(ref _4kBusy, 0); }
                });
            }
            return tv ? _has4kTv : _has4kMovie;
        }

        private static async Task<bool> AnyFourK(IJsonSerializer json, string path)
        {
            var r = await Call(HttpMethod.Get, path, null, CancellationToken.None).ConfigureAwait(false);
            if (r.Code < 200 || r.Code > 299) return false;
            var list = json.DeserializeFromString<List<SeerrServerDto>>(r.Text) ?? new List<SeerrServerDto>();
            return list.Any(s => s != null && s.is4k);
        }

        // ---------- HTTP ----------

        internal static string NormalizeBase(string baseUrl)
        {
            var u = (baseUrl ?? "").Trim().TrimEnd('/');
            if (!u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !u.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                u = "http://" + u;
            // Wie de URL met /api/v1 erachter invult, krijgt die er niet dubbel achter.
            if (u.EndsWith("/api/v1", StringComparison.OrdinalIgnoreCase)) u = u.Substring(0, u.Length - 7);
            return u;
        }

        internal struct Reply { public int Code; public string Text; }

        internal static async Task<Reply> Send(HttpMethod method, string baseUrl, string apiKey, string path, string body, int? asUser, CancellationToken ct)
        {
            var req = new HttpRequestMessage(method, NormalizeBase(baseUrl) + "/api/v1" + path);
            req.Headers.Add("X-Api-Key", (apiKey ?? "").Trim());
            if (asUser.HasValue && asUser.Value > 0) req.Headers.Add("X-Api-User", asUser.Value.ToString());
            if (body != null) req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
            {
                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                return new Reply { Code = (int)resp.StatusCode, Text = text };
            }
        }

        private static Task<Reply> Call(HttpMethod method, string path, string body, CancellationToken ct, int? asUser = null)
        {
            var c = Plugin.GetCurrentConfiguration();
            return Send(method, c.SeerrUrl, c.SeerrApiKey, path, body, asUser, ct);
        }

        /// <summary>Foutmelding van Seerr ({"message": "..."}) of de ruwe tekst.</summary>
        internal static string MessageOf(IJsonSerializer json, Reply r)
        {
            try
            {
                var m = json.DeserializeFromString<SeerrMessageDto>(r.Text);
                if (m != null && !string.IsNullOrWhiteSpace(m.message)) return m.message;
            }
            catch { }
            var t = (r.Text ?? "").Trim();
            if (t.Length > 200) t = t.Substring(0, 200);
            return r.Code + (t.Length > 0 ? ": " + t : "");
        }

        private static async Task<string> GetOk(IJsonSerializer json, string path, CancellationToken ct)
        {
            var r = await Call(HttpMethod.Get, path, null, ct).ConfigureAwait(false);
            if (r.Code < 200 || r.Code > 299) throw new HttpRequestException("Seerr " + path + ": " + MessageOf(json, r));
            return r.Text;
        }

        // ---------- Media (status, seizoenen, recent) ----------

        /// <summary>Alle media die Seerr kent (aangevraagd of in de bibliotheek), 5 minuten bewaard.</summary>
        internal static async Task<List<SeerrMediaDto>> GetMedia(IJsonSerializer json, CancellationToken ct)
        {
            var cached = _media;
            if (cached != null && DateTime.UtcNow - _mediaAt < CacheTtl) return cached;
            await _mediaLock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                cached = _media;
                if (cached != null && DateTime.UtcNow - _mediaAt < CacheTtl) return cached;
                var all = new List<SeerrMediaDto>();
                const int take = 500;
                for (int page = 0; page < 200; page++)
                {
                    var text = await GetOk(json, "/media?take=" + take + "&skip=" + (page * take) + "&sort=added", ct).ConfigureAwait(false);
                    var p = json.DeserializeFromString<SeerrMediaPage>(text);
                    if (p == null || p.results == null || p.results.Count == 0) break;
                    all.AddRange(p.results.Where(m => m != null && m.tmdbId > 0));
                    if (p.results.Count < take || (p.pageInfo != null && p.pageInfo.pages <= page + 1)) break;
                }
                _media = all;
                _mediaAt = DateTime.UtcNow;
                return all;
            }
            finally { _mediaLock.Release(); }
        }

        private static bool IsTv(SeerrMediaDto m) => string.Equals(m.mediaType, "tv", StringComparison.OrdinalIgnoreCase);

        /// <summary>Telt als "aangevraagd of aanwezig": in afwachting, bezig, gedeeltelijk of beschikbaar.</summary>
        private static bool Known(int status) => status >= 2 && status <= 5;
        private static bool HasFiles(int status) => status == 4 || status == 5;

        /// <summary>tmdbId -> true als (een deel) beschikbaar is, false als alleen aangevraagd. Zelfde vorm als bij Radarr/Sonarr.</summary>
        internal static async Task<Dictionary<int, bool>> GetStates(IJsonSerializer json, bool tv, CancellationToken ct)
        {
            var dict = new Dictionary<int, bool>();
            foreach (var m in await GetMedia(json, ct).ConfigureAwait(false))
                if (IsTv(m) == tv && Known(m.status)) dict[m.tmdbId] = HasFiles(m.status);
            return dict;
        }

        internal static async Task<HashSet<int>> GetPartial(IJsonSerializer json, CancellationToken ct)
        {
            var set = new HashSet<int>();
            foreach (var m in await GetMedia(json, ct).ConfigureAwait(false))
                if (IsTv(m) && m.status == 4) set.Add(m.tmdbId);
            return set;
        }

        /// <summary>Seizoensstatus omgezet naar de Sonarr-vorm die de rest van de plugin al kent.</summary>
        internal static async Task<Dictionary<int, SonarrSeasonDto>> GetSeasonStates(IJsonSerializer json, int tmdbId, CancellationToken ct)
        {
            var result = new Dictionary<int, SonarrSeasonDto>();
            var m = (await GetMedia(json, ct).ConfigureAwait(false)).FirstOrDefault(x => IsTv(x) && x.tmdbId == tmdbId);
            if (m == null || m.seasons == null) return result;
            foreach (var s in m.seasons)
            {
                if (s == null || s.seasonNumber <= 0 || !Known(s.status)) continue;
                result[s.seasonNumber] = new SonarrSeasonDto
                {
                    seasonNumber = s.seasonNumber,
                    monitored = true,
                    statistics = new SonarrStatsDto
                    {
                        episodeFileCount = HasFiles(s.status) ? 1 : 0,
                        episodeCount = s.status == 4 ? 2 : 1
                    }
                };
            }
            return result;
        }

        internal static async Task<List<RecentEntry>> GetRecent(IJsonSerializer json, bool tv, CancellationToken ct)
        {
            return (await GetMedia(json, ct).ConfigureAwait(false))
                .Where(m => IsTv(m) == tv && Known(m.status))
                .Select(m => new RecentEntry { TmdbId = m.tmdbId, HasFile = HasFiles(m.status), Added = m.createdAt })
                .ToList();
        }

        // ---------- Gebruikers: Emby-gebruiker -> Seerr-gebruiker ----------

        /// <summary>
        /// Seerr-gebruikers die uit Emby/Jellyfin zijn geïmporteerd hebben het Emby-gebruikers-id (jellyfinUserId).
        /// Zo komt een aanvraag op naam van de juiste Seerr-gebruiker, met diens rechten, limieten en goedkeuring.
        /// null = geen koppeling, dan vraagt de plugin aan als de eigenaar van de API-key.
        /// </summary>
        internal static async Task<int?> MapUser(IJsonSerializer json, object embyUserId, CancellationToken ct)
        {
            var key = RequestAccess.Normalize(embyUserId);
            if (key.Length == 0) return null;
            var users = _users;
            if (users == null || DateTime.UtcNow - _usersAt > UserTtl)
            {
                await _userLock.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    users = _users;
                    if (users == null || DateTime.UtcNow - _usersAt > UserTtl)
                    {
                        var map = new Dictionary<string, int>();
                        try
                        {
                            for (int page = 0; page < 20; page++)
                            {
                                var text = await GetOk(json, "/user?take=500&skip=" + (page * 500), ct).ConfigureAwait(false);
                                var p = json.DeserializeFromString<SeerrUserPage>(text);
                                if (p == null || p.results == null || p.results.Count == 0) break;
                                foreach (var u in p.results)
                                {
                                    var k = RequestAccess.Normalize(u.jellyfinUserId);
                                    if (u.id > 0 && k.Length > 0) map[k] = u.id;
                                }
                                if (p.results.Count < 500) break;
                            }
                        }
                        catch (Exception ex)
                        {
                            if (ex is OperationCanceledException) throw;
                            DiscoverDiagnostics.Add("Seerr-gebruikers ophalen mislukt (aanvraag gaat op naam van de API-key): " + ex.Message);
                        }
                        _users = users = map;
                        _usersAt = DateTime.UtcNow;
                    }
                }
                finally { _userLock.Release(); }
            }
            int id;
            if (users.TryGetValue(key, out id)) return id;
            DiscoverDiagnostics.Add("Seerr: geen Seerr-gebruiker gekoppeld aan Emby-gebruiker " + key + "; aanvraag op naam van de API-key");
            return null;
        }

        // ---------- Aanvragen ----------

        /// <returns>true = aangevraagd, false = stond al aangevraagd / niets nieuws om aan te vragen.</returns>
        internal static async Task<bool> Request(IJsonSerializer json, bool tv, int tmdbId, int tvdbId, int[] seasons, object embyUserId, CancellationToken ct, bool is4k = false)
        {
            if (!Configured) throw new InvalidOperationException("Seerr is niet ingesteld.");
            string body;
            if (tv)
            {
                var s = seasons == null || seasons.Length == 0
                    ? "\"all\""
                    : "[" + string.Join(",", seasons.Where(n => n >= 0).Distinct().OrderBy(n => n)) + "]";
                body = "{\"mediaType\":\"tv\",\"mediaId\":" + tmdbId + (tvdbId > 0 ? ",\"tvdbId\":" + tvdbId : "") + ",\"seasons\":" + s + (is4k ? ",\"is4k\":true" : "") + "}";
            }
            else
            {
                body = "{\"mediaType\":\"movie\",\"mediaId\":" + tmdbId + (is4k ? ",\"is4k\":true" : "") + "}";
            }

            var asUser = await MapUser(json, embyUserId, ct).ConfigureAwait(false);
            var r = await Call(HttpMethod.Post, "/request", body, ct, asUser).ConfigureAwait(false);
            if (r.Code == 409 || r.Code == 202)
            {
                // 409: al aangevraagd. 202: alle gevraagde seizoenen zijn al aangevraagd of beschikbaar.
                DiscoverDiagnostics.Add("Seerr " + (tv ? "serie " : "film ") + tmdbId + ": " + MessageOf(json, r));
                return false;
            }
            if (r.Code < 200 || r.Code > 299)
                throw new InvalidOperationException("Seerr: " + MessageOf(json, r));
            bool pending = false;
            try
            {
                var created = json.DeserializeFromString<SeerrRequestDto>(r.Text);
                pending = created != null && created.status == 1;
            }
            catch { }
            _pending[(tv ? "t:" : "m:") + tmdbId] = pending;
            if (is4k) DiscoverDiagnostics.Add("Seerr: 4K-aanvraag voor " + (tv ? "serie " : "film ") + tmdbId);
            Invalidate();
            DownloadQueue.Invalidate();
            DiscoverDiagnostics.Add("Seerr " + (tv ? "serie " : "film ") + tmdbId + " aangevraagd" + (asUser.HasValue ? " als Seerr-gebruiker " + asUser.Value : "") +
                (pending ? " (wacht op goedkeuring)" : ""));
            return true;
        }

        /// <summary>
        /// De titel stond al in Seerr: een mislukte aanvraag (status 4) opnieuw laten versturen. Een goedgekeurde aanvraag die
        /// niets oplevert zoekt Seerr zelf niet opnieuw; dat doet de plugin dan via Radarr/Sonarr (zie ArrClient).
        /// </summary>
        /// <returns>true = minstens één mislukte aanvraag opnieuw verstuurd.</returns>
        internal static async Task<bool> RetryFailed(IJsonSerializer json, bool tv, int tmdbId, CancellationToken ct)
        {
            if (!Configured) return false;
            SeerrMediaDto media = null;
            try { media = await FindMedia(json, tv, tmdbId, ct).ConfigureAwait(false); }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("Seerr aanvraag opzoeken (" + (tv ? "serie " : "film ") + tmdbId + "): " + ex.Message);
            }
            if (media == null || media.requests == null) return false;
            bool any = false;
            foreach (var rq in media.requests.Where(x => x != null && x.status == 4).ToList())
            {
                var r = await Call(HttpMethod.Post, "/request/" + rq.id + "/retry", "{}", ct).ConfigureAwait(false);
                bool ok = r.Code >= 200 && r.Code <= 299;
                if (ok) any = true;
                DiscoverDiagnostics.Add("Seerr aanvraag " + rq.id + " opnieuw proberen: " + (ok ? "gelukt" : "mislukt (" + MessageOf(json, r) + ")"));
            }
            if (any) { Invalidate(); DownloadQueue.Invalidate(); }
            return any;
        }

        // ---------- Verwijderen / annuleren ----------

        private static async Task<SeerrMediaDto> FindMedia(IJsonSerializer json, bool tv, int tmdbId, CancellationToken ct)
        {
            // Vers opvragen: de bewaarde lijst kan net achterlopen.
            var r = await Call(HttpMethod.Get, (tv ? "/tv/" : "/movie/") + tmdbId, null, ct).ConfigureAwait(false);
            if (r.Code >= 200 && r.Code <= 299)
            {
                var holder = json.DeserializeFromString<SeerrMediaInfoHolder>(r.Text);
                if (holder != null && holder.mediaInfo != null && holder.mediaInfo.id > 0) return holder.mediaInfo;
            }
            return (await GetMedia(json, ct).ConfigureAwait(false)).FirstOrDefault(m => IsTv(m) == tv && m.tmdbId == tmdbId);
        }

        /// <summary>
        /// Haalt de titel via Seerr uit Radarr/Sonarr (met bestanden) en wist de aanvragen en de status in Seerr.
        /// deleteFiles = false bij een titel die al beschikbaar is: dan blijft Radarr/Sonarr ongemoeid en verdwijnt
        /// alleen de aanvraag uit Seerr.
        /// </summary>
        /// <returns>true = verwijderd, false = Seerr kende de titel niet.</returns>
        internal static async Task<bool> Remove(IJsonSerializer json, bool tv, int tmdbId, bool deleteFiles, CancellationToken ct)
        {
            if (!Configured) throw new InvalidOperationException("Seerr is niet ingesteld.");
            var m = await FindMedia(json, tv, tmdbId, ct).ConfigureAwait(false);
            if (m == null || m.id <= 0) { Invalidate(); return false; }

            // Bij annuleren (nog niet beschikbaar) ook uit Radarr/Sonarr halen, anders downloadt die gewoon door.
            bool fromArr = deleteFiles || !HasFiles(m.status);
            if (fromArr)
            {
                var f = await Call(HttpMethod.Delete, "/media/" + m.id + "/file", null, ct).ConfigureAwait(false);
                if (f.Code < 200 || f.Code > 299)
                    DiscoverDiagnostics.Add("Seerr: uit " + (tv ? "Sonarr" : "Radarr") + " halen mislukt voor " + tmdbId + ": " + MessageOf(json, f));
            }
            var d = await Call(HttpMethod.Delete, "/media/" + m.id, null, ct).ConfigureAwait(false);
            if ((d.Code < 200 || d.Code > 299) && d.Code != 404)
                throw new InvalidOperationException("Seerr: " + MessageOf(json, d));
            Invalidate();
            DownloadQueue.Invalidate();
            return true;
        }

        // ---------- Downloadvoortgang ----------

        /// <summary>Lopende downloads volgens Seerr (die leest zelf de wachtrijen van zijn Radarr/Sonarr).</summary>
        internal static async Task<List<RawPart>> GetQueueParts(IJsonSerializer json, CancellationToken ct)
        {
            var parts = new List<RawPart>();
            var seen = new HashSet<int>();
            foreach (var filter in new[] { "processing", "partial" })
            {
                SeerrMediaPage p;
                try
                {
                    var text = await GetOk(json, "/media?take=200&skip=0&filter=" + filter + "&sort=modified", ct).ConfigureAwait(false);
                    p = json.DeserializeFromString<SeerrMediaPage>(text);
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("FOUT wachtrij Seerr lezen: " + ex.Message);
                    continue;
                }
                if (p == null || p.results == null) continue;
                foreach (var m in p.results)
                {
                    if (m == null || m.tmdbId <= 0 || m.downloadStatus == null || !seen.Add(m.id)) continue;
                    bool tv = IsTv(m);
                    foreach (var d in m.downloadStatus)
                    {
                        if (d == null) continue;
                        int season = d.episode != null ? d.episode.seasonNumber : 0;
                        int number = d.episode != null ? d.episode.episodeNumber : 0;
                        string label = tv && (season > 0 || number > 0)
                            ? "S" + season.ToString("00") + (number > 0 ? "E" + number.ToString("00") : "")
                            : "";
                        parts.Add(new RawPart
                        {
                            Type = tv ? "tv" : "movie",
                            TmdbId = m.tmdbId,
                            Title = null,
                            Label = label,
                            Name = null,
                            Size = d.size,
                            SizeLeft = d.sizeLeft,
                            State = DownloadQueue.MapState(new ArrQueueFullItemDto { status = d.status }),
                            TimeLeft = DownloadQueue.ParseTime(d.timeLeft),
                            Release = d.title,
                            DownloadId = d.downloadId,
                            Detail = "Seerr",
                            Client = "Seerr",
                            Season = season,
                            Episode = number
                        });
                    }
                }
            }
            return parts;
        }

        // ---------- Verbinding testen ----------

        internal static async Task<string> Test(IJsonSerializer json, string url, string apiKey, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException("Vul eerst een URL in.");
            if (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException("Vul eerst een API key in.");

            var st = await Send(HttpMethod.Get, url, apiKey, "/status", null, null, ct).ConfigureAwait(false);
            if (st.Code < 200 || st.Code > 299)
                throw new InvalidOperationException("Seerr niet bereikbaar op " + NormalizeBase(url) + " (" + MessageOf(json, st) + ").");
            var status = json.DeserializeFromString<SeerrStatusDto>(st.Text);

            var me = await Send(HttpMethod.Get, url, apiKey, "/auth/me", null, null, ct).ConfigureAwait(false);
            if (me.Code == 401 || me.Code == 403)
                throw new InvalidOperationException("Seerr weigert de API key (" + me.Code + "). Gebruik de API key uit Seerr > Instellingen > Algemeen.");
            if (me.Code < 200 || me.Code > 299)
                throw new InvalidOperationException("Seerr: " + MessageOf(json, me));

            int radarr = -1, sonarr = -1;
            try
            {
                var ra = await Send(HttpMethod.Get, url, apiKey, "/settings/radarr", null, null, ct).ConfigureAwait(false);
                if (ra.Code >= 200 && ra.Code <= 299) radarr = (json.DeserializeFromString<List<SeerrMeDto>>(ra.Text) ?? new List<SeerrMeDto>()).Count;
                var so = await Send(HttpMethod.Get, url, apiKey, "/settings/sonarr", null, null, ct).ConfigureAwait(false);
                if (so.Code >= 200 && so.Code <= 299) sonarr = (json.DeserializeFromString<List<SeerrMeDto>>(so.Text) ?? new List<SeerrMeDto>()).Count;
            }
            catch (Exception ex) { if (ex is OperationCanceledException) throw; }

            _users = null;
            Invalidate();
            var version = status != null ? status.version : null;
            return (string.IsNullOrEmpty(version) ? "" : version) +
                (radarr >= 0 ? "|" + radarr + "|" + sonarr : "");
        }
    }
}
