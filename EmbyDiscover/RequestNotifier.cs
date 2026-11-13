using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Session;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Stuurt de aanvrager een melding in Emby zodra een aangevraagde titel beschikbaar is (Radarr/Sonarr of Seerr).
    /// Elke 10 minuten wordt de status van open aanvragen bekeken. Is de aanvrager op dat moment niet
    /// actief in Emby, dan volgt de melding bij een volgende controle zodra hij er wel is (tot 30 dagen).
    /// </summary>
    public class RequestNotifier : IServerEntryPoint
    {
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan MaxAge = TimeSpan.FromDays(30);

        private readonly ISessionManager _sessions;
        private readonly IJsonSerializer _json;
        private readonly ArrClient _arr;
        private Timer _timer;
        private int _busy;

        public RequestNotifier(ISessionManager sessions, IJsonSerializer json)
        {
            _sessions = sessions;
            _json = json;
            _arr = new ArrClient(json);
        }

        public void Run()
        {
            _timer = new Timer(_ => { var t = Check(); }, null, TimeSpan.FromMinutes(3), Interval);
        }

        public void Dispose()
        {
            var t = _timer; _timer = null;
            if (t != null) t.Dispose();
        }

        private static bool Recent(StoredRequest r)
        {
            DateTime d;
            return DateTime.TryParse(r.Added, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out d) &&
                   DateTime.UtcNow - d.ToUniversalTime() < MaxAge;
        }

        internal async Task Check()
        {
            if (Interlocked.Exchange(ref _busy, 1) == 1) return;
            try
            {
                var open = RequestStore.All(_json).Where(r => !r.Notified && Recent(r)).ToList();
                if (open.Count == 0) return;
                Dictionary<int, bool> ms = new Dictionary<int, bool>(), ts = new Dictionary<int, bool>();
                if (open.Any(r => r.Type == "movie")) ms = await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false);
                if (open.Any(r => r.Type == "tv")) ts = await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false);

                var active = new Dictionary<string, List<string>>();
                foreach (var s in _sessions.Sessions)
                {
                    if (s == null || string.IsNullOrEmpty(s.Id) || s.UserId == null) continue;
                    var uid = RequestAccess.Normalize(s.UserId);
                    if (uid.Length == 0) continue;
                    List<string> l;
                    if (!active.TryGetValue(uid, out l)) active[uid] = l = new List<string>();
                    l.Add(s.Id);
                }

                var send = new List<KeyValuePair<StoredRequest, List<string>>>();
                RequestStore.Update(_json, list =>
                {
                    bool changed = false;
                    foreach (var r in list)
                    {
                        if (r.Notified || !Recent(r)) continue;
                        var states = r.Type == "tv" ? ts : ms;
                        bool hasFiles;
                        if (!states.TryGetValue(r.TmdbId, out hasFiles)) continue;
                        if (!hasFiles)
                        {
                            if (!r.SeenPending) { r.SeenPending = true; changed = true; }
                            continue;
                        }
                        if (!r.SeenPending)
                        {
                            // Al beschikbaar voordat we keken (oude aanvraag of het stond er al): geen melding.
                            r.Notified = true; changed = true;
                            continue;
                        }
                        List<string> ids;
                        if (!active.TryGetValue(r.UserId ?? "", out ids)) continue; // later opnieuw proberen
                        r.Notified = true; changed = true;
                        send.Add(new KeyValuePair<StoredRequest, List<string>>(r, ids));
                    }
                    return changed;
                });

                foreach (var kv in send)
                {
                    var r = kv.Key;
                    var title = (r.Title ?? "?") + (r.Year > 0 ? " (" + r.Year + ")" : "");
                    var text = DiscoverLanguage.Text(
                        title + " is beschikbaar om te kijken.",
                        title + " is available to watch.",
                        title + " ist jetzt verfügbar.");
                    foreach (var sid in kv.Value)
                    {
                        try
                        {
                            await _sessions.SendMessageCommand(sid, sid, new MessageCommand
                            {
                                Header = "Discover",
                                Text = text,
                                TimeoutMs = 15000
                            }, CancellationToken.None).ConfigureAwait(false);
                        }
                        catch (Exception ex) { DiscoverDiagnostics.Add("available notification failed: " + ex.Message); }
                    }
                    DiscoverDiagnostics.Add("available notification sent: " + title);
                }
            }
            catch (Exception ex) { DiscoverDiagnostics.Add("ERROR checking available requests: " + ex.Message); }
            finally { Interlocked.Exchange(ref _busy, 0); }
        }
    }
}
