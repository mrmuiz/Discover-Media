using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Net;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;
using MediaBrowser.Model.Tasks;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Zelf-update vanuit de GitHub-releases van mrmuiz/Discover-Media: kijken, downloaden (met SHA-256-controle),
    /// de DLL vervangen (met .bak) en Emby laten herstarten.
    /// </summary>
    internal static class Updater
    {
        internal const string Repo = "mrmuiz/Discover-Media";
        internal const string AssetName = "Emby.Plugins.Discover.dll";
        private static readonly Version FirstWithUpdater = new Version(1, 4, 0, 10);

        private static readonly HttpClient Http = CreateClient();
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(1, 1);
        private static UpdateInfo _cache;
        private static DateTime _cacheAt = DateTime.MinValue;
        private static bool _cacheBeta;

        /// <summary>Versie die al geïnstalleerd is maar pas na een herstart actief wordt.</summary>
        internal static string PendingVersion { get; private set; }

        internal static IServerApplicationHost Host { get; set; }
        internal static IApplicationPaths Paths { get; set; }
        internal static IJsonSerializer Json { get; set; }

        private static HttpClient CreateClient()
        {
            var c = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
            c.DefaultRequestHeaders.UserAgent.ParseAdd("Discover-Media-Emby-Plugin");
            c.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
            return c;
        }

        internal static Version Current
        {
            get { try { return typeof(Plugin).Assembly.GetName().Version; } catch { return new Version(0, 0); } }
        }

        internal static Version ParseTag(string tag)
        {
            if (string.IsNullOrWhiteSpace(tag)) return null;
            var t = tag.Trim().TrimStart('v', 'V');
            var dash = t.IndexOfAny(new[] { '-', '+', ' ' });
            if (dash > 0) t = t.Substring(0, dash);
            return Version.TryParse(t, out var v) ? v : null;
        }

        internal static async Task<UpdateInfo> Check(bool fresh, CancellationToken ct)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            var beta = cfg.UpdateIncludeBeta;
            if (!fresh && _cache != null && _cacheBeta == beta && DateTime.UtcNow - _cacheAt < TimeSpan.FromMinutes(30))
                return Finish(_cache);

            var info = new UpdateInfo { Current = Current.ToString() };
            try
            {
                var url = "https://api.github.com/repos/" + Repo + "/releases?per_page=30";
                using (var resp = await Http.GetAsync(url, ct).ConfigureAwait(false))
                {
                    var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                    if (!resp.IsSuccessStatusCode)
                        throw new InvalidOperationException("GitHub: HTTP " + (int)resp.StatusCode);
                    var releases = Json.DeserializeFromString<List<GhRelease>>(body) ?? new List<GhRelease>();
                    var all = releases
                        .Where(r => r != null && !r.draft)
                        .Select(r => new { r, v = ParseTag(r.tag_name), a = (r.assets ?? new List<GhAsset>()).FirstOrDefault(a => string.Equals(a.name, AssetName, StringComparison.OrdinalIgnoreCase)) })
                        .Where(x => x.v != null && x.a != null)
                        .OrderByDescending(x => x.v)
                        .ToList();
                    info.Versions = all.Select(x => new ReleaseVersion
                    {
                        Version = x.v.ToString(),
                        Tag = x.r.tag_name,
                        IsBeta = x.r.prerelease,
                        Date = x.r.published_at,
                        Url = x.r.html_url,
                        HasUpdater = x.v >= FirstWithUpdater,
                        DownloadUrl = x.a.browser_download_url,
                        Size = x.a.size,
                        Digest = x.a.digest
                    }).ToList();
                    var best = info.Versions.FirstOrDefault(x => beta || !x.IsBeta);
                    if (best != null)
                    {
                        info.Latest = best.Version;
                        info.Tag = best.Tag;
                        info.IsBeta = best.IsBeta;
                        info.Url = best.Url;
                        info.Available = new Version(best.Version) > Current;
                    }
                }
            }
            catch (Exception ex)
            {
                info.Error = ex.Message;
                DiscoverDiagnostics.Add("update: kijken mislukt: " + ex.Message);
            }
            if (info.Error == null) { _cache = info; _cacheAt = DateTime.UtcNow; _cacheBeta = beta; }
            return Finish(info);
        }

        private static UpdateInfo Finish(UpdateInfo i)
        {
            i.Current = Current.ToString();
            i.PendingVersion = PendingVersion;
            i.CanRestart = CanRestart();
            if (PendingVersion != null && i.Latest == PendingVersion) i.Available = false;
            return i;
        }

        internal static string PluginFilePath()
        {
            try
            {
                var p = Plugin.Instance?.AssemblyFilePath;
                if (!string.IsNullOrEmpty(p) && File.Exists(p)) return p;
            }
            catch { }
            try
            {
                var loc = typeof(Plugin).Assembly.Location;
                if (!string.IsNullOrEmpty(loc) && File.Exists(loc)) return loc;
            }
            catch { }
            return Path.Combine(Paths.PluginsPath, AssetName);
        }

        /// <summary>Download en vervang de DLL. Geeft de geïnstalleerde versie terug.</summary>
        internal static async Task<string> Install(CancellationToken ct, string tag = null)
        {
            await Gate.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                var info = await Check(true, ct).ConfigureAwait(false);
                if (info.Error != null) throw new InvalidOperationException(info.Error);
                ReleaseVersion pick;
                if (!string.IsNullOrEmpty(tag))
                {
                    pick = (info.Versions ?? new List<ReleaseVersion>()).FirstOrDefault(x => x.Tag == tag);
                    if (pick == null) throw new InvalidOperationException(DiscoverLanguage.Text("Die versie staat niet (meer) op GitHub.", "That version is not on GitHub (anymore).", "Diese Version ist nicht (mehr) auf GitHub.", "Den versjonen finnes ikke (lenger) på GitHub."));
                }
                else
                {
                    pick = info.Available ? (info.Versions ?? new List<ReleaseVersion>()).FirstOrDefault(x => x.Tag == info.Tag) : null;
                    if (pick == null) throw new InvalidOperationException(DiscoverLanguage.Text("Er is geen nieuwere versie.", "There is no newer version.", "Es gibt keine neuere Version.", "Det finnes ingen nyere versjon."));
                }

                var bytes = await Http.GetByteArrayAsync(pick.DownloadUrl).ConfigureAwait(false);
                if (bytes.Length < 1024 || bytes[0] != (byte)'M' || bytes[1] != (byte)'Z')
                    throw new InvalidOperationException("Download is not a valid DLL. Nothing was changed.");
                if (pick.Size > 0 && bytes.Length != pick.Size)
                    throw new InvalidOperationException("Download incomplete. Nothing was changed.");
                if (!string.IsNullOrEmpty(pick.Digest) && pick.Digest.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase))
                {
                    using (var sha = SHA256.Create())
                    {
                        var actual = string.Concat(sha.ComputeHash(bytes).Select(b => b.ToString("x2")));
                        if (!string.Equals(actual, pick.Digest.Substring(7), StringComparison.OrdinalIgnoreCase))
                            throw new InvalidOperationException("Checksum does not match GitHub's. Nothing was changed.");
                    }
                }

                var target = PluginFilePath();
                var temp = target + ".download";
                File.WriteAllBytes(temp, bytes);
                try
                {
                    if (File.Exists(target)) File.Replace(temp, target, target + ".bak");
                    else File.Move(temp, target);
                }
                catch
                {
                    try { File.Delete(temp); } catch { }
                    throw;
                }

                PendingVersion = pick.Version;
                DiscoverDiagnostics.Add("update: " + pick.Version + " geïnstalleerd in " + target + ", herstart nodig");
                try { Host?.NotifyPendingRestart(); } catch { }
                return pick.Version;
            }
            finally { Gate.Release(); }
        }

        internal static bool CanRestart()
        {
            try
            {
                var p = Host?.GetType().GetProperty("CanSelfRestart");
                if (p != null && p.PropertyType == typeof(bool)) return (bool)p.GetValue(Host);
            }
            catch { }
            return Host != null;
        }

        /// <summary>Herstart Emby (zoals de herstartknop in het dashboard).</summary>
        internal static void Restart()
        {
            if (Host == null) throw new InvalidOperationException("Emby host unavailable.");
            var m = Host.GetType().GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(x => x.Name == "Restart" && x.GetParameters().Length == 0);
            if (m == null) throw new InvalidOperationException("Emby cannot restart itself here. Restart it from the dashboard.");
            DiscoverDiagnostics.Add("update: Emby herstart");
            Task.Run(async () =>
            {
                await Task.Delay(1500).ConfigureAwait(false);   // eerst het antwoord naar de browser laten gaan
                try { var r = m.Invoke(Host, null); if (r is Task t) await t.ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("update: herstart mislukt: " + (ex.InnerException?.Message ?? ex.Message)); }
            });
        }
    }

    public class UpdateInfo
    {
        public string Current { get; set; }
        public string Latest { get; set; }
        public string Tag { get; set; }
        public bool IsBeta { get; set; }
        public bool Available { get; set; }
        public List<ReleaseVersion> Versions { get; set; }
        public string Url { get; set; }
        public string PendingVersion { get; set; }
        public bool CanRestart { get; set; }
        public string Error { get; set; }
        public string TaskId { get; set; }
    }

    public class ReleaseVersion
    {
        public string Version { get; set; }
        public string Tag { get; set; }
        public bool IsBeta { get; set; }
        public string Date { get; set; }
        public string Url { get; set; }
        /// <summary>Vanaf 1.4.0.10 zit de updater erin; oudere versies kun je daarna alleen met de hand bijwerken.</summary>
        public bool HasUpdater { get; set; }
        internal string DownloadUrl { get; set; }
        internal long Size { get; set; }
        internal string Digest { get; set; }
    }

    public class GhRelease
    {
        public string tag_name { get; set; }
        public string html_url { get; set; }
        public bool draft { get; set; }
        public bool prerelease { get; set; }
        public string published_at { get; set; }
        public List<GhAsset> assets { get; set; }
    }

    public class GhAsset
    {
        public string name { get; set; }
        public long size { get; set; }
        public string digest { get; set; }
        public string browser_download_url { get; set; }
    }

    [Route("/Discover/Update", "GET", Summary = "Is er een nieuwere Discover op GitHub?")]
    [Authenticated(Roles = "Admin")]
    public class GetDiscoverUpdate : IReturn<UpdateInfo>
    {
        public bool Fresh { get; set; }
    }

    [Route("/Discover/Update/Install", "POST", Summary = "Nieuwste Discover van GitHub installeren")]
    [Authenticated(Roles = "Admin")]
    public class InstallDiscoverUpdate : IReturn<UpdateInfo>
    {
        /// <summary>Leeg: de nieuwste. Anders deze release-tag (ook een oudere versie).</summary>
        public string Tag { get; set; }
    }

    [Route("/Discover/Update/Restart", "POST", Summary = "Emby herstarten om de update te activeren")]
    [Authenticated(Roles = "Admin")]
    public class RestartForDiscoverUpdate : IReturnVoid { }

    public class DiscoverUpdateService : IService
    {
        private readonly ITaskManager _tasks;

        public DiscoverUpdateService(IServerApplicationHost host, IApplicationPaths paths, IJsonSerializer json, ITaskManager tasks)
        {
            _tasks = tasks;
            Updater.Json = json;
            Updater.Host = host;
            Updater.Paths = paths;
        }

        public async Task<object> Get(GetDiscoverUpdate request)
        {
            var i = await Updater.Check(request.Fresh, CancellationToken.None).ConfigureAwait(false);
            try
            {
                var w = (_tasks?.ScheduledTasks ?? new IScheduledTaskWorker[0])
                    .FirstOrDefault(x => x?.ScheduledTask != null && x.ScheduledTask.Key == "DiscoverMediaUpdate");
                i.TaskId = w?.Id;
            }
            catch { }
            return i;
        }

        public async Task<object> Post(InstallDiscoverUpdate request)
        {
            try { await Updater.Install(CancellationToken.None, request.Tag).ConfigureAwait(false); }
            catch (Exception ex)
            {
                var i = await Updater.Check(false, CancellationToken.None).ConfigureAwait(false);
                i.Error = ex.Message;
                return i;
            }
            return await Updater.Check(false, CancellationToken.None).ConfigureAwait(false);
        }

        public void Post(RestartForDiscoverUpdate request) => Updater.Restart();
    }

    /// <summary>Dagelijkse taak (Dashboard > Geplande taken): kijken, en zo ingesteld installeren en herstarten.</summary>
    public class DiscoverUpdateTask : IScheduledTask
    {
        private readonly ISessionManager _sessions;

        public DiscoverUpdateTask(IServerApplicationHost host, IApplicationPaths paths, ISessionManager sessions, IJsonSerializer json)
        {
            Updater.Json = json;
            Updater.Host = host;
            Updater.Paths = paths;
            _sessions = sessions;
        }

        public string Name => "Discover Media: check for updates";
        public string Key => "DiscoverMediaUpdate";
        public string Description => "Checks GitHub for a new Discover Media version and, when enabled, installs it and restarts Emby when nobody is watching.";
        public string Category => "Discover Media";

        public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
            => new[] { new TaskTriggerInfo { Type = TaskTriggerInfo.TriggerDaily, TimeOfDayTicks = TimeSpan.FromHours(4).Ticks } };

        public async Task Execute(CancellationToken ct, IProgress<double> progress)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            if (!cfg.UpdateCheck) { progress.Report(100); return; }
            var info = await Updater.Check(true, ct).ConfigureAwait(false);
            progress.Report(30);
            if (info.Available && cfg.UpdateAutoInstall)
            {
                try { await Updater.Install(ct).ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("update: automatisch installeren mislukt: " + ex.Message); }
            }
            progress.Report(60);
            if (Updater.PendingVersion != null && cfg.UpdateAutoInstall && cfg.UpdateAutoRestart)
            {
                // Hooguit 3 uur wachten tot niemand iets afspeelt.
                for (int i = 0; i < 36; i++)
                {
                    if (!SomeonePlaying()) { Updater.Restart(); break; }
                    await Task.Delay(TimeSpan.FromMinutes(5), ct).ConfigureAwait(false);
                }
            }
            progress.Report(100);
        }

        private bool SomeonePlaying()
        {
            try { return (_sessions?.Sessions ?? Enumerable.Empty<SessionInfo>()).Any(s => s != null && s.NowPlayingItem != null); }
            catch { return true; }
        }
    }
}
