using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    // ---------- SABnzbd: snelheid, nabewerkingsfases (verifiëren, repareren, uitpakken, ...) en algemene toestand ----------

    public class SabSlotDto
    {
        public string nzo_id { get; set; }
        public string filename { get; set; }
        public string name { get; set; }
        public string status { get; set; }
        public string fail_message { get; set; }
        public string mb { get; set; }
        public string mbleft { get; set; }
        public string timeleft { get; set; }
        /// <summary>Wat SABnzbd nu doet, bijvoorbeeld de laatste uitvoerregel van een script ("Script uitvoeren: [###  ] 16%").</summary>
        public string action_line { get; set; }
    }

    public class SabQueueBodyDto
    {
        public string status { get; set; }
        public string paused { get; set; }
        public string kbpersec { get; set; }
        public string speedlimit { get; set; }
        public string speedlimit_abs { get; set; }
        public List<SabSlotDto> slots { get; set; }
    }

    public class SabQueueEnvelopeDto { public SabQueueBodyDto queue { get; set; } public string error { get; set; } }

    public class SabHistoryBodyDto { public List<SabSlotDto> slots { get; set; } }

    public class SabHistoryEnvelopeDto { public SabHistoryBodyDto history { get; set; } public string error { get; set; } }

    public class SabVersionDto { public string version { get; set; } }

    /// <summary>Eén download in SABnzbd (in de wachtrij of in de geschiedenis, waar de nabewerking staat).</summary>
    internal class SabItem
    {
        public string Id;
        /// <summary>Naam zoals SABnzbd hem toont (releasenaam); null bij andere downloaders.</summary>
        public string Name;
        public string NameNorm;
        public bool InQueue;
        public bool Downloading;
        public bool Paused;
        /// <summary>Snelheid van déze download in bytes/s; -1 = onbekend (SABnzbd kent alleen een totaalsnelheid).</summary>
        public double Speed = -1;
        /// <summary>Seeders en ratio (torrents); -1 = onbekend.</summary>
        public int Seeds = -1;
        public double Ratio = -1;
        public bool Failed;
        /// <summary>Klaar in SABnzbd (geschiedenis, status Completed): niet meer aan het downloaden of nabewerken.</summary>
        public bool Done;
        /// <summary>verifying, repairing, extracting, moving, script, waiting of null.</summary>
        public string Stage;
        public string Reason;
        /// <summary>Tekst die SABnzbd bij de nabewerking toont (bij een script: de laatste uitvoerregel); null = geen.</summary>
        public string Action;
        /// <summary>Live grootte en nog te gaan in bytes en resterende tijd in seconden (SABnzbd-wachtrij); -1 = onbekend.</summary>
        public double Size = -1, SizeLeft = -1;
        public int TimeLeft = -1;
    }

    internal class SabSnapshot
    {
        public bool Paused;
        public double SpeedBps;
        public double LimitBps;
        public int LimitPct;
        public int QueueCount;
        /// <summary>Naam van de downloader: SABnzbd, NZBGet, qBittorrent of Transmission.</summary>
        public string Source = "SABnzbd";
        /// <summary>Heeft deze downloader een algemene toestand (pauze, limiet) die we tonen?</summary>
        public bool HasGlobal;
        public Dictionary<string, SabItem> ById = new Dictionary<string, SabItem>(StringComparer.OrdinalIgnoreCase);
        public List<SabItem> All = new List<SabItem>();
    }

    public class SabInfoDto
    {
        /// <summary>SABnzbd of NZBGet.</summary>
        public string Name { get; set; }
        public bool Paused { get; set; }
        /// <summary>Bytes per seconde, 0 = niets aan het downloaden.</summary>
        public double Speed { get; set; }
        /// <summary>Snelheidslimiet in bytes per seconde (0 = geen).</summary>
        public double LimitBps { get; set; }
        /// <summary>Snelheidslimiet als percentage van de lijnsnelheid (0 = geen).</summary>
        public int LimitPct { get; set; }
    }

    internal static class SabClient
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };

        /// <summary>De laatste momentopname (hoort bij de gecachte wachtrij in DownloadQueue).</summary>
        internal static volatile SabSnapshot Last;

        internal static bool Configured
        {
            get
            {
                var cfg = Plugin.GetCurrentConfiguration();
                return cfg != null && !string.IsNullOrWhiteSpace(cfg.SabUrl) && !string.IsNullOrWhiteSpace(cfg.SabApiKey);
            }
        }

        private static string BaseUrl(string url)
        {
            var b = (url ?? "").Trim().TrimEnd('/');
            if (!b.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !b.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                b = "http://" + b;
            return b;
        }

        private static async Task<string> Call(string url, string apiKey, string query, CancellationToken ct)
        {
            var full = BaseUrl(url) + "/api?output=json&" + query + "&apikey=" + Uri.EscapeDataString((apiKey ?? "").Trim());
            using (var req = new HttpRequestMessage(HttpMethod.Get, full))
            using (var resp = await Http.SendAsync(req, ct).ConfigureAwait(false))
            {
                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    throw new InvalidOperationException("SABnzbd gaf HTTP " + (int)resp.StatusCode + " " + resp.ReasonPhrase + ".");
                return text;
            }
        }

        private static double Num(string s)
        {
            double d;
            return !string.IsNullOrWhiteSpace(s) && double.TryParse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out d) ? d : 0;
        }

        private static bool IsTrue(string s)
        {
            return string.Equals((s ?? "").Trim(), "true", StringComparison.OrdinalIgnoreCase) || (s ?? "").Trim() == "1";
        }

        /// <summary>Alleen letters en cijfers, kleine letters: "Film.2020.1080p-GRP" en "Film 2020 1080p GRP" worden gelijk.</summary>
        internal static string Norm(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var sb = new StringBuilder(s.Length);
            foreach (var ch in s)
                if (char.IsLetterOrDigit(ch)) sb.Append(char.ToLowerInvariant(ch));
            return sb.ToString();
        }

        /// <summary>SABnzbd-status vertaald naar onze fase; null als het geen nabewerking is.</summary>
        private static string StageOf(string status)
        {
            switch ((status ?? "").Trim().ToLowerInvariant())
            {
                case "verifying":
                case "quickcheck":
                    return "verifying";
                case "repairing":
                case "fetching":
                    return "repairing";
                case "extracting":
                    return "extracting";
                case "moving":
                    return "moving";
                case "running":
                    return "script";
                default:
                    return null;
            }
        }

        internal static async Task<SabSnapshot> Fetch(IJsonSerializer json, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var snap = new SabSnapshot { HasGlobal = true };

            var qText = await Call(cfg.SabUrl, cfg.SabApiKey, "mode=queue&start=0&limit=200", ct).ConfigureAwait(false);
            var qEnv = json.DeserializeFromString<SabQueueEnvelopeDto>(qText);
            if (qEnv == null || (qEnv.queue == null && !string.IsNullOrWhiteSpace(qEnv.error)))
                throw new InvalidOperationException("SABnzbd: " + (qEnv != null && !string.IsNullOrWhiteSpace(qEnv.error) ? qEnv.error : "onverwacht antwoord") + ".");
            var q = qEnv.queue;
            if (q != null)
            {
                snap.Paused = IsTrue(q.paused) || string.Equals(q.status, "Paused", StringComparison.OrdinalIgnoreCase);
                snap.SpeedBps = Num(q.kbpersec) * 1024.0;
                snap.LimitBps = Num(q.speedlimit_abs);
                var pct = (int)Math.Round(Num(q.speedlimit));
                snap.LimitPct = pct > 0 && pct < 100 ? pct : 0;
                if (q.slots != null)
                {
                    foreach (var s in q.slots)
                    {
                        if (s == null) continue;
                        var st = (s.status ?? "").Trim().ToLowerInvariant();
                        var item = new SabItem
                        {
                            Id = s.nzo_id,
                            Name = s.filename ?? s.name,
                            NameNorm = Norm(s.filename ?? s.name),
                            InQueue = true,
                            Downloading = st == "downloading",
                            Paused = st == "paused",
                            Stage = StageOf(s.status)
                        };
                        var mb = Num(s.mb);
                        if (mb > 0)
                        {
                            item.Size = mb * 1048576.0;
                            item.SizeLeft = Math.Max(0, Math.Min(mb, Num(s.mbleft))) * 1048576.0;
                            TimeSpan tl;
                            if (!string.IsNullOrWhiteSpace(s.timeleft) && TimeSpan.TryParse(s.timeleft.Trim(), CultureInfo.InvariantCulture, out tl) && tl.TotalSeconds >= 0)
                                item.TimeLeft = (int)Math.Min(int.MaxValue, tl.TotalSeconds);
                        }
                        Add(snap, item);
                    }
                    snap.QueueCount = q.slots.Count;
                }
            }

            // Nabewerking staat in de geschiedenis. Mislukt dit, dan werkt de rest gewoon door.
            try
            {
                var hText = await Call(cfg.SabUrl, cfg.SabApiKey, "mode=history&start=0&limit=60", ct).ConfigureAwait(false);
                var hEnv = json.DeserializeFromString<SabHistoryEnvelopeDto>(hText);
                if (hEnv != null && hEnv.history != null && hEnv.history.slots != null)
                {
                    foreach (var s in hEnv.history.slots)
                    {
                        if (s == null) continue;
                        var st = (s.status ?? "").Trim().ToLowerInvariant();
                        var item = new SabItem
                        {
                            Id = s.nzo_id,
                            Name = s.name ?? s.filename,
                            NameNorm = Norm(s.name ?? s.filename),
                            InQueue = false,
                            Failed = st == "failed",
                            Done = st == "completed",
                            Reason = st == "failed" && !string.IsNullOrWhiteSpace(s.fail_message) ? "SABnzbd: " + s.fail_message.Trim() : null,
                            Stage = st == "queued" ? "waiting" : StageOf(s.status)
                        };
                        // SABnzbd geeft bij elke stap een regel met de voortgang ("Unpacking: 2/5", "Repairing: 41%");
                        // bij een script is het de laatste uitvoerregel van het script.
                        if (item.Stage != null && !string.IsNullOrWhiteSpace(s.action_line))
                        {
                            var act = s.action_line.Trim();
                            item.Action = act.Length > 120 ? act.Substring(0, 120) : act;
                        }
                        Add(snap, item);
                    }
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("FOUT SABnzbd-geschiedenis lezen: " + ex.Message);
            }
            return snap;
        }

        private static void Add(SabSnapshot snap, SabItem item)
        {
            snap.All.Add(item); // wachtrij eerst, dan geschiedenis: bij dezelfde naam wint de wachtrij
            if (!string.IsNullOrEmpty(item.Id) && !snap.ById.ContainsKey(item.Id)) snap.ById[item.Id] = item;
        }

        private static SabItem Find(SabSnapshot s, string downloadId, string release)
        {
            SabItem item;
            if (!string.IsNullOrEmpty(downloadId) && s.ById.TryGetValue(downloadId, out item)) return item;
            var n = Norm(release);
            if (n.Length == 0) return null;
            foreach (var it in s.All)
            {
                var m = it.NameNorm;
                if (string.IsNullOrEmpty(m)) continue;
                if (m == n) return it;
                if (n.Length >= 15 && m.Length >= 15 && (m.Contains(n) || n.Contains(m))) return it;
            }
            return null;
        }

        /// <summary>
        /// Vult de downloads uit Radarr/Sonarr/Seerr aan met wat alleen SABnzbd weet. Radarr en Sonarr tonen een
        /// download na 100% nog als "downloading" terwijl SABnzbd verifieert of uitpakt; dat wordt hier een eigen fase.
        /// De status van Radarr/Sonarr wordt alleen overschreven zolang de import nog niet begonnen is.
        /// </summary>
        internal static void Apply(SabSnapshot s, List<RawPart> parts)
        {
            foreach (var p in parts)
            {
                if (p.Via != null) continue; // al aan een downloader gekoppeld
                var it = Find(s, p.DownloadId, p.Release);
                if (it == null) continue;
                p.Via = s.Source;
                p.Sab = s.Source == "SABnzbd";
                if (it.Seeds >= 0) p.Seeds = it.Seeds;
                if (it.Ratio >= 0) p.Ratio = it.Ratio;
                bool early = p.State == "downloading" || p.State == "queued" || p.State == "paused";
                // Radarr/Sonarr/Seerr verversen hun wachtrij maar eens per minuut of langzamer; SABnzbd weet het nu.
                // Daarom komen voortgang en resterende tijd van SABnzbd zelf zodra de download daar in de wachtrij staat.
                if (it.InQueue && !it.Failed && it.Stage == null && it.Size > 0 && early)
                {
                    p.Size = it.Size;
                    p.SizeLeft = it.SizeLeft;
                    if (it.Downloading && it.TimeLeft >= 0) p.TimeLeft = it.TimeLeft;
                }
                if (it.Failed)
                {
                    if (early || p.State == "stalled")
                    {
                        p.State = "stalled";
                        if (string.IsNullOrWhiteSpace(p.Reason)) p.Reason = it.Reason ?? "SABnzbd: download mislukt";
                    }
                }
                else if (it.Stage != null)
                {
                    if (early) { p.State = "processing"; p.Stage = it.Stage; p.Action = it.Action; }
                }
                else if (it.Done && !it.InQueue)
                {
                    // Klaar in SABnzbd, maar Radarr/Sonarr/Seerr zeggen nog "downloading" (hun wachtrij loopt achter):
                    // dan is de volgende stap het importeren.
                    if (early) { p.State = "importing"; p.SizeLeft = 0; p.TimeLeft = -1; }
                }
                else if (it.InQueue)
                {
                    if (it.Paused || s.Paused) { if (early) p.State = "paused"; }
                    else
                    {
                        // SABnzbd weet het nu: hervat na een pauze mag de status niet op "paused" blijven hangen,
                        // ook al meldt Radarr/Sonarr/Seerr dat pas na hun volgende verversing.
                        if (early) p.State = it.Downloading ? "downloading" : "queued";
                        if (it.Downloading) p.Speed = it.Speed >= 0 ? it.Speed : s.SpeedBps;
                    }
                }
            }
        }

        private static readonly Regex TvRest = new Regex("^((19|20)\\d{2})?s\\d{2}", RegexOptions.Compiled);

        /// <summary>
        /// Recente aanvragen die (nog) niet in de wachtrij van Radarr/Sonarr/Seerr staan, maar wel al in de downloader:
        /// Radarr/Sonarr verversen hun wachtrij maar eens per minuut, en tijdens de nabewerking in SABnzbd (bijv. een script)
        /// verdwijnt een download soms even uit hun wachtrij. Zo'n aanvraag wordt op naam gekoppeld: de releasenaam begint
        /// met de titel, bij een film gevolgd door het jaar, bij een serie door SxxEyy. Klaar in de downloader telt niet mee
        /// (dan importeert Radarr/Sonarr hem en staat hij daarna in de bibliotheek).
        /// </summary>
        internal static void AddMissing(SabSnapshot s, List<RawPart> parts, List<StoredRequest> pending)
        {
            if (s == null || pending == null || pending.Count == 0) return;
            var used = new HashSet<SabItem>();
            foreach (var p in parts)
            {
                var hit = Find(s, p.DownloadId, p.Release);
                if (hit != null) used.Add(hit);
            }
            foreach (var r in pending)
            {
                if (parts.Any(p => p.Type == r.Type && p.TmdbId == r.TmdbId)) continue;
                var key = Norm(r.Title);
                if (key.Length < 2) continue;
                bool tv = r.Type == "tv";
                var year = r.Year > 0 ? r.Year.ToString(CultureInfo.InvariantCulture) : "";
                SabItem it = null;
                foreach (var cand in s.All)
                {
                    if (used.Contains(cand) || cand.Done || string.IsNullOrEmpty(cand.NameNorm)) continue;
                    if (!cand.NameNorm.StartsWith(key, StringComparison.Ordinal)) continue;
                    var rest = cand.NameNorm.Substring(key.Length);
                    bool ok = tv ? TvRest.IsMatch(rest) : (year.Length > 0 && rest.StartsWith(year, StringComparison.Ordinal));
                    if (ok) { it = cand; break; }
                }
                if (it == null) continue;
                used.Add(it);
                var part = new RawPart
                {
                    Type = r.Type, TmdbId = r.TmdbId, Title = r.Title ?? "?", Label = "",
                    Release = it.Name, Detail = s.Source, Client = s.Source, Via = s.Source, Sab = s.Source == "SABnzbd",
                    DownloadId = it.Id, Size = it.Size > 0 ? it.Size : 0, SizeLeft = it.SizeLeft > 0 ? it.SizeLeft : 0,
                    TimeLeft = -1, State = "queued"
                };
                if (it.Seeds >= 0) part.Seeds = it.Seeds;
                if (it.Ratio >= 0) part.Ratio = it.Ratio;
                if (it.Failed)
                {
                    part.State = "stalled";
                    part.Reason = it.Reason ?? "SABnzbd: download mislukt";
                }
                else if (it.Stage != null)
                {
                    part.State = "processing";
                    part.Stage = it.Stage;
                    part.Action = it.Action;
                    part.SizeLeft = 0;
                    if (part.Size <= 0) part.Size = 1;
                }
                else if (it.InQueue)
                {
                    if (it.Paused || s.Paused) part.State = "paused";
                    else
                    {
                        part.State = it.Downloading ? "downloading" : "queued";
                        if (it.Downloading)
                        {
                            part.Speed = it.Speed >= 0 ? it.Speed : s.SpeedBps;
                            if (it.TimeLeft >= 0) part.TimeLeft = it.TimeLeft;
                        }
                    }
                }
                parts.Add(part);
            }
        }

        internal static SabInfoDto Info()
        {
            var s = Last;
            if (s == null) return null;
            return new SabInfoDto { Name = s.Source, Paused = s.Paused, Speed = s.SpeedBps, LimitBps = s.LimitBps, LimitPct = s.LimitPct };
        }

        /// <summary>Test URL en API key. Geeft de SABnzbd-versie terug.</summary>
        internal static async Task<string> Test(IJsonSerializer json, string url, string apiKey, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(url)) throw new InvalidOperationException("Vul eerst een URL in.");
            if (string.IsNullOrWhiteSpace(apiKey)) throw new InvalidOperationException("Vul eerst een API key in.");
            // mode=version vraagt geen key; mode=queue wel, dus daarmee controleren we de key.
            var qText = await Call(url, apiKey, "mode=queue&start=0&limit=1", ct).ConfigureAwait(false);
            var env = json.DeserializeFromString<SabQueueEnvelopeDto>(qText);
            if (env == null || env.queue == null)
                throw new InvalidOperationException(env != null && !string.IsNullOrWhiteSpace(env.error) ? "SABnzbd: " + env.error : "SABnzbd gaf geen geldig antwoord. Controleer de URL en de API key.");
            string version = "";
            try
            {
                var vText = await Call(url, apiKey, "mode=version", ct).ConfigureAwait(false);
                var v = json.DeserializeFromString<SabVersionDto>(vText);
                if (v != null && !string.IsNullOrWhiteSpace(v.version)) version = v.version.Trim();
            }
            catch (Exception ex) { if (ex is OperationCanceledException) throw; }
            return version;
        }
    }
}
