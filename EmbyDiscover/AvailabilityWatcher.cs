using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Emby.Notifications;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Notifications;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Session;

namespace Emby.Plugins.Discover
{
    /// <summary>Maakt het meldingstype "Aangevraagde titel beschikbaar" bekend bij Emby (Instellingen > Meldingen).</summary>
    public class DiscoverNotificationTypes : INotificationTypeFactory
    {
        internal const string AvailableEventId = "discover.request.available";

        public List<NotificationTypeInfo> GetNotificationTypes(string language)
        {
            return new List<NotificationTypeInfo>
            {
                new NotificationTypeInfo
                {
                    Id = AvailableEventId,
                    Name = DiscoverLanguage.Text("Aangevraagde titel is beschikbaar", "Requested title is available", "Angefragter Titel ist verfügbar"),
                    CategoryId = "discover",
                    CategoryName = "Discover"
                }
            };
        }
    }

    /// <summary>
    /// Kijkt elke 5 minuten of aangevraagde titels binnen zijn (bestand in Radarr/Sonarr) en stuurt de aanvrager dan
    /// een melding: als pop-up in de Emby-apps waar hij nu ingelogd is, en als Emby-melding voor wie die heeft ingesteld.
    /// </summary>
    public class AvailabilityWatcher : IServerEntryPoint
    {
        private static readonly TimeSpan FirstRun = TimeSpan.FromMinutes(2);
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

        private readonly ISessionManager _sessions;
        private readonly IUserManager _users;
        private readonly INotificationManager _notifications;
        private readonly ILogger _logger;
        private readonly ArrClient _arr;
        private Timer _timer;
        private int _running;

        public AvailabilityWatcher(ISessionManager sessions, IUserManager users, INotificationManager notifications,
            ILogManager logManager, IJsonSerializer json)
        {
            _sessions = sessions;
            _users = users;
            _notifications = notifications;
            _logger = logManager.GetLogger("Discover");
            _arr = new ArrClient(json);
            RequestStore.Init(json);
        }

        public void Run()
        {
            _timer = new Timer(_ => { var ignored = Check(); }, null, FirstRun, Interval);
        }

        public void Dispose()
        {
            _timer?.Dispose();
            _timer = null;
        }

        private async Task Check()
        {
            if (Interlocked.Exchange(ref _running, 1) == 1) return;
            try
            {
                var open = RequestStore.All().Where(r => r.State == RequestStates.Sent && !r.Notified && r.UserId != 0).ToList();
                if (open.Count == 0) return;

                var movieStates = open.Any(r => r.Type == "movie") ? await _arr.GetMovieStates(CancellationToken.None).ConfigureAwait(false) : new Dictionary<int, bool>();
                var seriesStates = open.Any(r => r.Type == "tv") ? await _arr.GetSeriesStates(CancellationToken.None).ConfigureAwait(false) : new Dictionary<int, bool>();

                foreach (var r in open)
                {
                    bool hasFiles;
                    var states = r.Type == "tv" ? seriesStates : movieStates;
                    if (!states.TryGetValue(r.TmdbId, out hasFiles) || !hasFiles) continue;

                    RequestStore.Update(r.Id, x => { x.Notified = true; x.AvailableAt = RequestStore.Now(); });
                    await Notify(r).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT beschikbaarheidscontrole: " + ex.Message);
            }
            finally
            {
                Interlocked.Exchange(ref _running, 0);
            }
        }

        private async Task Notify(RequestRecord r)
        {
            var title = r.Title + (r.Year > 0 ? " (" + r.Year + ")" : "");
            var text = DiscoverLanguage.Text(title + " is nu beschikbaar.", title + " is now available.", title + " ist jetzt verfügbar.");
            DiscoverDiagnostics.Add("melding beschikbaar: " + (r.UserName ?? r.UserId.ToString()) + " - " + title);
            _logger.Info("Discover: {0} beschikbaar, melding naar {1}", title, r.UserName ?? r.UserId.ToString());

            // 1. Pop-up in de apps waar de gebruiker nu ingelogd is.
            try
            {
                foreach (var s in _sessions.Sessions.Where(s => s.UserInternalId == r.UserId && s.IsActive).ToList())
                {
                    try
                    {
                        await _sessions.SendMessageCommand(null, s.Id, new MessageCommand
                        {
                            Header = "Discover",
                            Text = text,
                            TimeoutMs = 15000
                        }, CancellationToken.None).ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        DiscoverDiagnostics.Add("pop-up naar sessie " + s.Client + " mislukt: " + ex.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT sessies voor melding: " + ex.Message);
            }

            // 2. Emby-melding (e-mail, push, webhook... zoals de gebruiker of beheerder het heeft ingesteld).
            try
            {
                var user = _users.GetUserById(r.UserId);
                if (user != null)
                {
                    _notifications.SendNotification(new NotificationRequest
                    {
                        EventId = DiscoverNotificationTypes.AvailableEventId,
                        Title = DiscoverLanguage.Text("Nu beschikbaar: ", "Now available: ", "Jetzt verfügbar: ") + title,
                        Description = text,
                        User = user,
                        Date = DateTimeOffset.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT Emby-melding: " + ex.Message);
            }
        }
    }
}
