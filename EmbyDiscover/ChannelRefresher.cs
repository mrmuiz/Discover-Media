using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Tasks;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Start "Refresh Internet Channels" zelf zodra de tegels die op de achtergrond gemaakt werden klaar zijn.
    /// Emby 4.11 neemt nieuwe tegelafbeeldingen pas over bij een kanaalverversing; zo hoeft niemand die met de hand te starten.
    /// Hoogstens één keer per 3 uur, en niet als de taak al loopt (dan later nog eens proberen).
    /// </summary>
    public class ChannelRefresher : IServerEntryPoint
    {
        private static ITaskManager _tasks;
        private static DateTime _last = DateTime.MinValue;
        private static int _pending;
        private static readonly TimeSpan MinGap = TimeSpan.FromHours(3);

        public ChannelRefresher(ITaskManager tasks) { _tasks = tasks; }

        public void Run() { }
        public void Dispose() { }

        /// <summary>Vraag om een kanaalverversing (wacht eerst even, zodat een reeks tegels samen meegaat).</summary>
        internal static void Request(string why)
        {
            if (_tasks == null) return;
            if (Interlocked.Exchange(ref _pending, 1) == 1) return;
            Task.Run(async () =>
            {
                try
                {
                    for (int attempt = 0; attempt < 48; attempt++)
                    {
                        await Task.Delay(TimeSpan.FromMinutes(attempt == 0 ? 2 : 15)).ConfigureAwait(false);
                        var wait = _last + MinGap - DateTime.UtcNow;
                        if (wait > TimeSpan.Zero) { await Task.Delay(wait).ConfigureAwait(false); }
                        var worker = Find();
                        if (worker == null) { DiscoverDiagnostics.Add("channel refresh: task 'Refresh Internet Channels' not found"); return; }
                        if (worker.State != TaskState.Idle) continue;   // loopt al: straks opnieuw kijken
                        _last = DateTime.UtcNow;
                        DiscoverDiagnostics.Add("channel refresh started by the plugin (" + why + ")");
                        _tasks.QueueScheduledTask(worker.ScheduledTask, new TaskOptions());
                        return;
                    }
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("starting the channel refresh failed: " + ex.Message); }
                finally { Interlocked.Exchange(ref _pending, 0); }
            });
        }

        private static IScheduledTaskWorker Find()
        {
            var all = _tasks.ScheduledTasks ?? new IScheduledTaskWorker[0];
            return all.FirstOrDefault(w => w.ScheduledTask != null && string.Equals(w.ScheduledTask.Key, "RefreshInternetChannels", StringComparison.OrdinalIgnoreCase))
                ?? all.FirstOrDefault(w => (w.Name ?? "").IndexOf("Internet Channels", StringComparison.OrdinalIgnoreCase) >= 0)
                ?? all.FirstOrDefault(w => (w.ScheduledTask?.GetType().Name ?? "").IndexOf("RefreshChannels", StringComparison.OrdinalIgnoreCase) >= 0);
        }
    }
}
