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

        internal static string FormEncode(string s)
        {
            var sb = new StringBuilder();
            foreach (var by in Encoding.UTF8.GetBytes(s ?? ""))
            {
                var ch = (char)by;
                if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == '.' || ch == '~')
                    sb.Append(ch);
                else
                    sb.Append('%').Append(by.ToString("X2", CultureInfo.InvariantCulture));
            }
            return sb.ToString();
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
        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler()) { Timeout = TimeSpan.FromSeconds(8) };
        private static string _cookie;
        private static string _cookieFor;
        private static DateTime _failUntil;
        private static string _failFor;

        internal static bool Configured
        {
            get { var c = Plugin.GetCurrentConfiguration(); return c != null && !string.IsNullOrWhiteSpace(c.QbitUrl); }
        }

        private static string Fail(string english, string dutch, string german, string norwegian) =>
            DiscoverLanguage.Text(dutch, english, german, norwegian);

        private static async Task<string> Login(string url, string user, string pass, CancellationToken ct, bool force)
        {
            var b = DlHttp.BaseUrl(url);
            var key = b + "|" + user;
            if (!force && _cookie != null && _cookieFor == key) return _cookie;
            if (string.IsNullOrWhiteSpace(user)) { _cookie = ""; _cookieFor = key; return ""; } // no login needed (e.g. localhost bypass)
            // Retrying a wrong password too often makes qBittorrent ban the IP; wait a while after a failed attempt,
            // but only for the same URL, user and password (changed credentials are tried right away).
            var failKey = key + "|" + (pass ?? "").GetHashCode().ToString(CultureInfo.InvariantCulture);
            if (DateTime.UtcNow < _failUntil && _failFor == failKey)
                throw new InvalidOperationException(Fail("login failed; next attempt in a few minutes (check username and password)", "inloggen mislukt; volgende poging over enkele minuten (controleer gebruikersnaam en wachtwoord)", "Anmeldung fehlgeschlagen; nächster Versuch in einigen Minuten (Benutzername und Passwort prüfen)", "innlogging mislyktes; nytt forsøk om noen minutter (sjekk brukernavn og passord)"));
            using (var req = new HttpRequestMessage(HttpMethod.Post, b + "/api/v2/auth/login"))
            {
                req.Headers.Referrer = new Uri(b);
                // Encode ourselves (UTF-8, only A-Z a-z 0-9 - _ . ~ kept): FormUrlEncodedContent differs between .NET/Mono
                // versions for characters like ! * ' ( ) + & % and non-ASCII.
                var body = "username=" + DlHttp.FormEncode(user) + "&password=" + DlHttp.FormEncode(pass);
                req.Content = new StringContent(body, Encoding.ASCII, "application/x-www-form-urlencoded");
                using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                {
                    var text = (await resp.Content.ReadAsStringAsync().ConfigureAwait(false) ?? "").Trim();
                    string cookie = null;
                    IEnumerable<string> vals;
                    if (resp.Headers.TryGetValues("Set-Cookie", out vals))
                        foreach (var v in vals)
                        {
                            // qBittorrent < 5.2: "SID=..."; 5.2+: "QBT_SID_<port>=..."
                            if (v == null || v.IndexOf("SID", StringComparison.OrdinalIgnoreCase) < 0) continue;
                            var semi = v.IndexOf(';');
                            cookie = semi > 0 ? v.Substring(0, semi) : v;
                            break;
                        }
                    int code = (int)resp.StatusCode;
                    if (code == 403)
                    {
                        _failUntil = DateTime.UtcNow.AddMinutes(5); _failFor = failKey;
                        throw new InvalidOperationException(Fail("qBittorrent has temporarily banned this IP address after too many failed logins (HTTP 403). Wait, or restart qBittorrent, then test again.", "qBittorrent heeft dit IP-adres tijdelijk geblokkeerd na te veel mislukte logins (HTTP 403). Wacht even of herstart qBittorrent en test opnieuw.", "qBittorrent hat diese IP-Adresse nach zu vielen fehlgeschlagenen Anmeldungen vorübergehend gesperrt (HTTP 403). Warte oder starte qBittorrent neu und teste erneut.", "qBittorrent har midlertidig blokkert denne IP-adressen etter for mange mislykkede innlogginger (HTTP 403). Vent, eller start qBittorrent på nytt, og test igjen."));
                    }
                    // qBittorrent < 5.2 answers 200 "Ok."; 5.2+ answers 204 No Content. A wrong password gives 200 "Fails." (or 401 on 5.2+).
                    bool ok = resp.IsSuccessStatusCode && (code == 204 || string.Equals(text, "Ok.", StringComparison.OrdinalIgnoreCase) || (text.Length == 0 && cookie != null));
                    if (!ok)
                    {
                        _failUntil = DateTime.UtcNow.AddMinutes(5); _failFor = failKey;
                        bool wrongPassword = string.Equals(text, "Fails.", StringComparison.OrdinalIgnoreCase) || code == 401 || resp.IsSuccessStatusCode;
                        throw new InvalidOperationException(Fail("login failed", "inloggen mislukt", "Anmeldung fehlgeschlagen", "innlogging mislyktes") +
                            (wrongPassword ? Fail(" (check username and password)", " (controleer gebruikersnaam en wachtwoord)", " (Benutzername und Passwort prüfen)", " (sjekk brukernavn og passord)") : " (HTTP " + code + ")"));
                    }
                    _failFor = null;
                    _cookie = cookie ?? "";
                    _cookieFor = key;
                    return _cookie;
                }
            }
        }

        private static async Task<string> GetInfo(string url, string user, string pass, string apiKey, CancellationToken ct)
        {
            var b = DlHttp.BaseUrl(url);
            apiKey = (apiKey ?? "").Trim();
            if (apiKey.Length > 0)
            {
                // qBittorrent 5.2+ API key: no login, just a Bearer header on every request.
                using (var req = new HttpRequestMessage(HttpMethod.Get, b + "/api/v2/torrents/info"))
                {
                    req.Headers.Referrer = new Uri(b);
                    req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
                    using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                    {
                        int code = (int)resp.StatusCode;
                        if (code == 401 || code == 403)
                            throw new InvalidOperationException(Fail("API key rejected (HTTP " + code + "); check the key, it needs qBittorrent 5.2 or newer", "API key geweigerd (HTTP " + code + "); controleer de key, hiervoor is qBittorrent 5.2 of nieuwer nodig", "API-Schlüssel abgelehnt (HTTP " + code + "); prüfe den Schlüssel, dafür ist qBittorrent 5.2 oder neuer nötig", "API-nøkkel avvist (HTTP " + code + "); sjekk nøkkelen, dette krever qBittorrent 5.2 eller nyere"));
                        if (!resp.IsSuccessStatusCode) throw new InvalidOperationException("HTTP " + code + " " + resp.ReasonPhrase);
                        return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    }
                }
            }
            for (int attempt = 0; attempt < 2; attempt++)
            {
                var cookie = await Login(url, user, pass, ct, attempt > 0).ConfigureAwait(false);
                using (var req = new HttpRequestMessage(HttpMethod.Get, b + "/api/v2/torrents/info"))
                {
                    req.Headers.Referrer = new Uri(b);
                    if (!string.IsNullOrEmpty(cookie)) req.Headers.TryAddWithoutValidation("Cookie", cookie);
                    using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
                    {
                        int code = (int)resp.StatusCode;
                        if ((code == 403 || code == 401) && attempt == 0) { _cookie = null; continue; }
                        if (!resp.IsSuccessStatusCode) throw new InvalidOperationException("HTTP " + code + " " + resp.ReasonPhrase);
                        return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    }
                }
            }
            throw new InvalidOperationException(Fail("no access (403)", "geen toegang (403)", "kein Zugriff (403)", "ingen tilgang (403)"));
        }

        internal static async Task<SabSnapshot> Fetch(IJsonSerializer json, CancellationToken ct)
        {
            var c = Plugin.GetCurrentConfiguration();
            var text = await GetInfo(c.QbitUrl, c.QbitUser, c.QbitPassword, c.QbitApiKey, ct).ConfigureAwait(false);
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
                    Reason = st == "error" || st == "missingfiles" ? "qBittorrent: " + (st == "missingfiles" ? DiscoverLanguage.Text("bestanden ontbreken", "files missing", "Dateien fehlen") : DiscoverLanguage.Text("fout", "error", "Fehler")) : null,
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

        internal static async Task<string> Test(IJsonSerializer json, string url, string user, string pass, string apiKey, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een URL in.", "Enter a URL first.", "Zuerst eine URL eingeben.", "Skriv inn en URL først."));
            _failUntil = DateTime.MinValue;
            _failFor = null;
            _cookie = null;
            try
            {
                await GetInfo(url, user, pass, apiKey, ct).ConfigureAwait(false);
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
        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler()) { Timeout = TimeSpan.FromSeconds(8) };
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
                        if ((int)resp.StatusCode == 401) throw new InvalidOperationException(DiscoverLanguage.Text("Transmission: gebruikersnaam of wachtwoord klopt niet (401).", "Transmission: wrong username or password (401).", "Transmission: Benutzername oder Passwort falsch (401)."));
                        if (!resp.IsSuccessStatusCode) throw new InvalidOperationException(DiscoverLanguage.Text("Transmission gaf HTTP ", "Transmission returned HTTP ", "Transmission antwortete mit HTTP ") + (int)resp.StatusCode + " " + resp.ReasonPhrase + ".");
                        return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    }
                }
            }
            throw new InvalidOperationException(DiscoverLanguage.Text("Transmission: geen sessie gekregen (409).", "Transmission: no session received (409).", "Transmission: keine Sitzung erhalten (409)."));
        }

        internal static async Task<SabSnapshot> Fetch(IJsonSerializer json, CancellationToken ct)
        {
            var c = Plugin.GetCurrentConfiguration();
            var text = await Rpc(c.TransmissionUrl, c.TransmissionUser, c.TransmissionPassword,
                "{\"method\":\"torrent-get\",\"arguments\":{\"fields\":[\"hashString\",\"name\",\"status\",\"rateDownload\",\"uploadRatio\",\"percentDone\",\"error\",\"errorString\",\"trackerStats\"]}}", ct).ConfigureAwait(false);
            var r = json.DeserializeFromString<TransResultDto>(text);
            if (r == null || r.arguments == null || r.arguments.torrents == null)
                throw new InvalidOperationException(DiscoverLanguage.Text("Transmission gaf geen torrentlijst terug", "Transmission returned no torrent list", "Transmission lieferte keine Torrent-Liste") + (r != null && !string.IsNullOrWhiteSpace(r.result) ? " (" + r.result + ")" : "") + ".");
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
                    Reason = t.error > 0 ? "Transmission: " + (string.IsNullOrWhiteSpace(t.errorString) ? DiscoverLanguage.Text("fout", "error", "Fehler") : t.errorString.Trim()) : null,
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
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een URL in.", "Enter a URL first.", "Zuerst eine URL eingeben."));
            _session = null;
            var text = await Rpc(url, user, pass, "{\"method\":\"session-get\",\"arguments\":{\"fields\":[\"version\"]}}", ct).ConfigureAwait(false);
            if (text == null || text.IndexOf("\"success\"", StringComparison.OrdinalIgnoreCase) < 0)
                throw new InvalidOperationException(DiscoverLanguage.Text("Transmission gaf geen geldig antwoord. Controleer de URL.", "Transmission gave no valid response. Check the URL.", "Transmission lieferte keine gültige Antwort. URL prüfen."));
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
        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler()) { Timeout = TimeSpan.FromSeconds(8) };

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
                    if ((int)resp.StatusCode == 401) throw new InvalidOperationException(DiscoverLanguage.Text("NZBGet: gebruikersnaam of wachtwoord klopt niet (401).", "NZBGet: wrong username or password (401).", "NZBGet: Benutzername oder Passwort falsch (401)."));
                    if (!resp.IsSuccessStatusCode) throw new InvalidOperationException(DiscoverLanguage.Text("NZBGet gaf HTTP ", "NZBGet returned HTTP ", "NZBGet antwortete mit HTTP ") + (int)resp.StatusCode + " " + resp.ReasonPhrase + ".");
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
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een URL in.", "Enter a URL first.", "Zuerst eine URL eingeben."));
            var text = await Rpc(url, user, pass, "version", "[]", ct).ConfigureAwait(false);
            var v = json.DeserializeFromString<NzbVersionDto>(text);
            if (v == null || string.IsNullOrWhiteSpace(v.result))
                throw new InvalidOperationException(DiscoverLanguage.Text("NZBGet gaf geen geldig antwoord. Controleer de URL.", "NZBGet gave no valid response. Check the URL.", "NZBGet lieferte keine gültige Antwort. URL prüfen."));
            return v.result.Trim();
        }
    }
}
