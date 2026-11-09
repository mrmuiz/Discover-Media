using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    // ---------- Gemeenschappelijke hulpjes ----------

    internal static class DlHttp
    {
        internal static string BaseUrl(string url)
        {
            var b = (url ?? "").Trim().TrimEnd('/');
            if (b.Length == 0) return b;
            if (!b.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !b.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                b = "http://" + b;
            return b;
        }

        internal static string Basic(string user, string pass)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes((user ?? "") + ":" + (pass ?? "")));
        }

        internal static void Add(SabSnapshot snap, SabItem item)
        {
            snap.All.Add(item);
            if (!string.IsNullOrEmpty(item.Id) && !snap.ById.ContainsKey(item.Id)) snap.ById[item.Id] = item;
        }
    }

    // ---------- qBittorrent (WebUI API v2) ----------

    public class QbitTorrentDto
    {
        public string hash { get; set; }
        public string name { get; set; }
        public string state { get; set; }
        public double dlspeed { get; set; }
        public double ratio { get; set; }
        public int num_complete { get; set; }
        public int num_seeds { get; set; }
    }

    internal static class QbitClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        private static string _cookie;
        private static string _cookieFor;
        private static DateTime _failUntil;

        internal static bool Configured
        {
            get { var c = Plugin.GetCurrentConfiguration(); return c != null && !string.IsNullOrWhiteSpace(c.QbitUrl); }
        }

        private static async Task<string> Login(string url, string user, string pass, CancellationToken ct, bool force)
        {
            var b = DlHttp.BaseUrl(url);
            var key = b + "|" + user;
            if (!force && _cookie != null && _cookieFor == key) return _cookie;
            if (string.IsNullOrWhiteSpace(user)) { _cookie = ""; _cookieFor = key; return ""; } // geen login nodig (bijv. localhost-bypass)
            // Te vaak met een verkeerd wachtwoord proberen laat qBittorrent het IP-adres blokkeren; daarom even wachten na een mislukte poging.
            if (DateTime.UtcNow < _failUntil) throw new InvalidOperationException("inloggen mislukt; volgende poging over enkele minuten (controleer gebruikersnaam en wachtwoord)");
            using (var req = new HttpRequestMessage(HttpMethod.Post, b + "/api/v2/auth/login"))
            {
                req.Headers.Referrer = new Uri(b);
                req.Content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("username", user ?? ""),
                    new KeyValuePair<string, string>("password", pass ?? "")
                });
                using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                {
                    var text = (await resp.Content.ReadAsStringAsync().ConfigureAwait(false) ?? "").Trim();
                    string cookie = null;
                    IEnumerable<string> vals;
                    if (resp.Headers.TryGetValues("Set-Cookie", out vals))
                        foreach (var v in vals)
                        {
                            if (v == null || v.IndexOf("SID", StringComparison.OrdinalIgnoreCase) < 0) continue;
                            var semi = v.IndexOf(';');
                            cookie = semi > 0 ? v.Substring(0, semi) : v;
                            break;
                        }
                    if (!resp.IsSuccessStatusCode || !string.Equals(text, "Ok.", StringComparison.OrdinalIgnoreCase) || cookie == null)
                    {
                        _failUntil = DateTime.UtcNow.AddMinutes(5);
                        throw new InvalidOperationException("inloggen mislukt" + (resp.IsSuccessStatusCode ? " (controleer gebruikersnaam en wachtwoord)" : " (HTTP " + (int)resp.StatusCode + ")"));
                    }
                    _cookie = cookie;
                    _cookieFor = key;
                    return cookie;
                }
            }
        }

        private static async Task<string> GetInfo(string url, string user, string pass, CancellationToken ct)
        {
            for (int attempt = 0; attempt < 2; attempt++)
            {
                var cookie = await Login(url, user, pass, ct, attempt > 0).ConfigureAwait(false);
                using (var req = new HttpRequestMessage(HttpMethod.Get, DlHttp.BaseUrl(url) + "/api/v2/torrents/info"))
                {
                    req.Headers.Referrer = new Uri(DlHttp.BaseUrl(url));
                    if (!string.IsNullOrEmpty(cookie)) req.Headers.TryAddWithoutValidation("Cookie", cookie);
                    using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                    {
                        if ((int)resp.StatusCode == 403 && attempt == 0) { _cookie = null; continue; }
                        if (!resp.IsSuccessStatusCode) throw new InvalidOperationException("HTTP " + (int)resp.StatusCode + " " + resp.ReasonPhrase);
                        return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    }
                }
            }
            throw new InvalidOperationException("geen toegang (403)");
        }

        internal static async Task<SabSnapshot> Fetch(IJsonSerializer json, CancellationToken ct)
        {
            var c = Plugin.GetCurrentConfiguration();
            var text = await GetInfo(c.QbitUrl, c.QbitUser, c.QbitPassword, ct).ConfigureAwait(false);
            var list = json.DeserializeFromString<List<QbitTorrentDto>>(text) ?? new List<QbitTorrentDto>();
            var snap = new SabSnapshot { Source = "qBittorrent" };
            foreach (var t in list)
            {
                if (t == null) continue;
                var st = (t.state ?? "").ToLowerInvariant();
                var item = new SabItem
                {
                    Id = (t.hash ?? "").ToUpperInvariant(),
                    NameNorm = SabClient.Norm(t.name),
                    InQueue = true,
                    Downloading = st == "downloading" || st == "forceddl" || st == "metadl" || st == "forcedmetadl" || st == "stalleddl",
                    Paused = st == "pauseddl" || st == "stoppeddl",
                    Failed = st == "error" || st == "missingfiles",
                    Reason = st == "error" || st == "missingfiles" ? "qBittorrent: " + (st == "missingfiles" ? "bestanden ontbreken" : "fout") : null,
                    Stage = st.StartsWith("checking", StringComparison.Ordinal) ? "verifying" : st == "moving" ? "moving" : null,
                    Speed = t.dlspeed,
                    Seeds = Math.Max(t.num_complete, t.num_seeds),
                    Ratio = t.ratio
                };
                DlHttp.Add(snap, item);
            }
            snap.QueueCount = list.Count;
            return snap;
        }

        internal static async Task<string> Test(IJsonSerializer json, string url, string user, string pass, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException("Vul eerst een URL in.");
            _failUntil = DateTime.MinValue;
            _cookie = null;
            try
            {
                await GetInfo(url, user, pass, ct).ConfigureAwait(false);
            }
            catch (InvalidOperationException ex) { throw new InvalidOperationException("qBittorrent: " + ex.Message); }
            return "";
        }
    }

    // ---------- Transmission (RPC) ----------

    public class TransTrackerDto { public int seederCount { get; set; } }

    public class TransTorrentDto
    {
        public string hashString { get; set; }
        public string name { get; set; }
        public int status { get; set; }
        public double rateDownload { get; set; }
        public double uploadRatio { get; set; }
        public double percentDone { get; set; }
        public int error { get; set; }
        public string errorString { get; set; }
        public List<TransTrackerDto> trackerStats { get; set; }
    }

    public class TransArgsDto { public List<TransTorrentDto> torrents { get; set; } }
    public class TransResultDto { public string result { get; set; } public TransArgsDto arguments { get; set; } }

    internal static class TransmissionClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
        private static string _session;

        internal static bool Configured
        {
            get { var c = Plugin.GetCurrentConfiguration(); return c != null && !string.IsNullOrWhiteSpace(c.TransmissionUrl); }
        }

        private static string RpcUrl(string url)
        {
            var b = DlHttp.BaseUrl(url);
            return b.IndexOf("/rpc", StringComparison.OrdinalIgnoreCase) >= 0 ? b : b + "/transmission/rpc";
        }

        private static async Task<string> Rpc(string url, string user, string pass, string body, CancellationToken ct)
        {
            for (int attempt = 0; attempt < 2; attempt++)
            {
                using (var req = new HttpRequestMessage(HttpMethod.Post, RpcUrl(url)))
                {
                    req.Content = new StringContent(body, Encoding.UTF8, "application/json");
                    if (!string.IsNullOrWhiteSpace(user)) req.Headers.Authorization = new AuthenticationHeaderValue("Basic", DlHttp.Basic(user, pass));
                    if (!string.IsNullOrEmpty(_session)) req.Headers.TryAddWithoutValidation("X-Transmission-Session-Id", _session);
                    using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                    {
                        if ((int)resp.StatusCode == 409 && attempt == 0)
                        {
                            IEnumerable<string> vals;
                            if (resp.Headers.TryGetValues("X-Transmission-Session-Id", out vals)) _session = vals.FirstOrDefault();
                            continue;
                        }
                        if ((int)resp.StatusCode == 401) throw new InvalidOperationException("Transmission: gebruikersnaam of wachtwoord klopt niet (401).");
                        if (!resp.IsSuccessStatusCode) throw new InvalidOperationException("Transmission gaf HTTP " + (int)resp.StatusCode + " " + resp.ReasonPhrase + ".");
                        return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    }
                }
            }
            throw new InvalidOperationException("Transmission: geen sessie gekregen (409).");
        }

        internal static async Task<SabSnapshot> Fetch(IJsonSerializer json, CancellationToken ct)
        {
            var c = Plugin.GetCurrentConfiguration();
            var text = await Rpc(c.TransmissionUrl, c.TransmissionUser, c.TransmissionPassword,
                "{\"method\":\"torrent-get\",\"arguments\":{\"fields\":[\"hashString\",\"name\",\"status\",\"rateDownload\",\"uploadRatio\",\"percentDone\",\"error\",\"errorString\",\"trackerStats\"]}}", ct).ConfigureAwait(false);
            var r = json.DeserializeFromString<TransResultDto>(text);
            if (r == null || r.arguments == null || r.arguments.torrents == null)
                throw new InvalidOperationException("Transmission gaf geen torrentlijst terug" + (r != null && !string.IsNullOrWhiteSpace(r.result) ? " (" + r.result + ")" : "") + ".");
            var snap = new SabSnapshot { Source = "Transmission" };
            foreach (var t in r.arguments.torrents)
            {
                if (t == null) continue;
                // status: 0 gestopt, 1-2 controleren, 3 wacht op download, 4 downloaden, 5-6 seeden
                int seeds = -1;
                if (t.trackerStats != null) foreach (var ts in t.trackerStats) if (ts != null && ts.seederCount > seeds) seeds = ts.seederCount;
                var item = new SabItem
                {
                    Id = (t.hashString ?? "").ToUpperInvariant(),
                    NameNorm = SabClient.Norm(t.name),
                    InQueue = true,
                    Downloading = t.status == 4,
                    Paused = t.status == 0 && t.percentDone < 1.0,
                    Failed = t.error > 0,
                    Reason = t.error > 0 ? "Transmission: " + (string.IsNullOrWhiteSpace(t.errorString) ? "fout" : t.errorString.Trim()) : null,
                    Stage = t.status == 1 || t.status == 2 ? "verifying" : null,
                    Speed = t.rateDownload,
                    Seeds = seeds,
                    Ratio = t.uploadRatio >= 0 ? t.uploadRatio : -1
                };
                DlHttp.Add(snap, item);
            }
            snap.QueueCount = r.arguments.torrents.Count;
            return snap;
        }

        internal static async Task<string> Test(IJsonSerializer json, string url, string user, string pass, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException("Vul eerst een URL in.");
            _session = null;
            var text = await Rpc(url, user, pass, "{\"method\":\"session-get\",\"arguments\":{\"fields\":[\"version\"]}}", ct).ConfigureAwait(false);
            if (text == null || text.IndexOf("\"success\"", StringComparison.OrdinalIgnoreCase) < 0)
                throw new InvalidOperationException("Transmission gaf geen geldig antwoord. Controleer de URL.");
            var i = text.IndexOf("\"version\":\"", StringComparison.Ordinal);
            if (i < 0) return "";
            i += 11;
            var j = text.IndexOf('"', i);
            return j > i ? text.Substring(i, j - i) : "";
        }
    }

    // ---------- NZBGet (JSON-RPC) ----------

    public class NzbGroupDto { public int NZBID { get; set; } public string NZBName { get; set; } public string Status { get; set; } }
    public class NzbGroupsDto { public List<NzbGroupDto> result { get; set; } }
    public class NzbStatusBodyDto { public double DownloadRate { get; set; } public bool DownloadPaused { get; set; } public double DownloadLimit { get; set; } }
    public class NzbStatusDto { public NzbStatusBodyDto result { get; set; } }
    public class NzbVersionDto { public string result { get; set; } }

    internal static class NzbgetClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };

        internal static bool Configured
        {
            get { var c = Plugin.GetCurrentConfiguration(); return c != null && !string.IsNullOrWhiteSpace(c.NzbgetUrl); }
        }

        private static async Task<string> Rpc(string url, string user, string pass, string method, string paramsJson, CancellationToken ct)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Post, DlHttp.BaseUrl(url) + "/jsonrpc"))
            {
                req.Content = new StringContent("{\"method\":\"" + method + "\",\"params\":" + paramsJson + ",\"id\":1}", Encoding.UTF8, "application/json");
                if (!string.IsNullOrWhiteSpace(user)) req.Headers.Authorization = new AuthenticationHeaderValue("Basic", DlHttp.Basic(user, pass));
                using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                {
                    if ((int)resp.StatusCode == 401) throw new InvalidOperationException("NZBGet: gebruikersnaam of wachtwoord klopt niet (401).");
                    if (!resp.IsSuccessStatusCode) throw new InvalidOperationException("NZBGet gaf HTTP " + (int)resp.StatusCode + " " + resp.ReasonPhrase + ".");
                    return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                }
            }
        }

        private static string StageOf(string status)
        {
            switch ((status ?? "").ToUpperInvariant())
            {
                case "PP_QUEUED": return "waiting";
                case "LOADING_PARS":
                case "VERIFYING_SOURCES":
                case "VERIFYING_REPAIRED": return "verifying";
                case "REPAIRING": return "repairing";
                case "UNPACKING": return "extracting";
                case "RENAMING":
                case "MOVING": return "moving";
                case "EXECUTING_SCRIPT": return "script";
                default: return null;
            }
        }

        internal static async Task<SabSnapshot> Fetch(IJsonSerializer json, CancellationToken ct)
        {
            var c = Plugin.GetCurrentConfiguration();
            var gText = await Rpc(c.NzbgetUrl, c.NzbgetUser, c.NzbgetPassword, "listgroups", "[0]", ct).ConfigureAwait(false);
            var groups = json.DeserializeFromString<NzbGroupsDto>(gText);
            var snap = new SabSnapshot { Source = "NZBGet", HasGlobal = true };
            if (groups != null && groups.result != null)
            {
                foreach (var g in groups.result)
                {
                    if (g == null) continue;
                    var st = (g.Status ?? "").ToUpperInvariant();
                    DlHttp.Add(snap, new SabItem
                    {
                        Id = g.NZBID.ToString(CultureInfo.InvariantCulture),
                        NameNorm = SabClient.Norm(g.NZBName),
                        InQueue = true,
                        Downloading = st == "DOWNLOADING" || st == "FETCHING",
                        Paused = st == "PAUSED",
                        Stage = StageOf(g.Status)
                    });
                }
                snap.QueueCount = groups.result.Count;
            }
            try
            {
                var sText = await Rpc(c.NzbgetUrl, c.NzbgetUser, c.NzbgetPassword, "status", "[]", ct).ConfigureAwait(false);
                var s = json.DeserializeFromString<NzbStatusDto>(sText);
                if (s != null && s.result != null)
                {
                    snap.Paused = s.result.DownloadPaused;
                    snap.SpeedBps = s.result.DownloadRate;
                    snap.LimitBps = s.result.DownloadLimit;
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
            }
            return snap;
        }

        internal static async Task<string> Test(IJsonSerializer json, string url, string user, string pass, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException("Vul eerst een URL in.");
            var text = await Rpc(url, user, pass, "version", "[]", ct).ConfigureAwait(false);
            var v = json.DeserializeFromString<NzbVersionDto>(text);
            if (v == null || string.IsNullOrWhiteSpace(v.result))
                throw new InvalidOperationException("NZBGet gaf geen geldig antwoord. Controleer de URL.");
            return v.result.Trim();
        }
    }
}
