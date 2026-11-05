using System;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Session;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Doet de echte aanvraag pas als je op Afspelen drukt bij "Aanvragen: titel".
    /// Emby vraagt de mediabron van een kanaalitem ook op zodra de detailpagina opent; een aanvraag in
    /// GetChannelItemMediaInfo zou dus bij het openen van de pagina al worden uitgevoerd.
    /// </summary>
    public class RequestOnPlay : IServerEntryPoint
    {
        private readonly ISessionManager _sessions;
        private readonly ILogger _logger;
        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly IJsonSerializer _json;

        public RequestOnPlay(ISessionManager sessions, ILogManager logManager, IJsonSerializer json)
        {
            _sessions = sessions;
            _logger = logManager.GetLogger("Discover");
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
            _json = json;
        }

        public void Run()
        {
            _sessions.PlaybackStart += OnPlaybackStart;
        }

        public void Dispose()
        {
            _sessions.PlaybackStart -= OnPlaybackStart;
        }

        // Stopt het afspelen en toont een melding bij de geblokkeerde gebruiker. Mislukt dit, dan is de aanvraag
        // toch al niet gedaan; alleen de melding ontbreekt dan.
        private void NotifyBlocked(PlaybackProgressEventArgs e, string text = null)
        {
            try
            {
                var sessionId = e.Session != null ? e.Session.Id : null;
                if (string.IsNullOrEmpty(sessionId)) return;
                _sessions.SendPlaystateCommand(sessionId, sessionId, new PlaystateRequest { Command = PlaystateCommand.Stop }, CancellationToken.None);
                _sessions.SendMessageCommand(sessionId, sessionId, new MessageCommand
                {
                    Header = "Discover",
                    Text = text ?? RequestAccess.DeniedMessage(),
                    TimeoutMs = 8000
                }, CancellationToken.None);
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("melding geblokkeerde aanvraag mislukt: " + ex.Message);
            }
        }

        private void OnPlaybackStart(object sender, PlaybackProgressEventArgs e)
        {
            try
            {
                var ext = e == null || e.Item == null ? null : e.Item.ExternalId;
                if (string.IsNullOrEmpty(ext)) return;
                // "Alle seizoenen" (hele serie in een keer) of het gewone aanvraagitem.
                bool allSeasons = ext.StartsWith(DiscoverMediaChannel.AskAllPrefix, StringComparison.Ordinal);
                if (!allSeasons && !ext.StartsWith(DiscoverMediaChannel.AskPrefix, StringComparison.Ordinal)) return;

                var rest = DiscoverMediaChannel.StripTileMark(ext.Substring((allSeasons ? DiscoverMediaChannel.AskAllPrefix : DiscoverMediaChannel.AskPrefix).Length));   // "m:123" of "t:123"
                bool tv = rest.StartsWith("t:", StringComparison.Ordinal);
                int tmdbId;
                if (rest.Length < 3 || !int.TryParse(rest.Substring(2), out tmdbId))
                {
                    DiscoverDiagnostics.Add("aanvraag bij afspelen: onbekend id " + ext);
                    return;
                }

                // Mag deze gebruiker aanvragen? Zo niet: niets naar Radarr/Sonarr, het afspelen stoppen en een melding tonen.
                var user = e.Users != null && e.Users.Count > 0 ? e.Users[0] : null;
                if (user != null && !RequestAccess.IsAllowed(user.Id))
                {
                    DiscoverDiagnostics.Add("aanvraag geblokkeerd voor gebruiker " + user.Name + ": " + ext);
                    _logger.Info("Discover: aanvraag {0} geblokkeerd voor gebruiker {1}", ext, user.Name);
                    NotifyBlocked(e);
                    return;
                }
                if (user != null)
                {
                    var limitMsg = RequestAccess.LimitMessage(_json, user.Id, user.Policy != null && user.Policy.IsAdministrator);
                    if (limitMsg != null)
                    {
                        DiscoverDiagnostics.Add("aanvraag (Afspelen) boven de limiet voor " + user.Name + ": " + ext);
                        NotifyBlocked(e, limitMsg);
                        return;
                    }
                }

                Task.Run(async () =>
                {
                    try
                    {
                        var msg = await DiscoverMediaChannel.RequestTitle(_tmdb, _arr, tv, tmdbId, null, CancellationToken.None, user != null ? (object)user.Id : null).ConfigureAwait(false);
                        DiscoverDiagnostics.Add("aanvraag via Afspelen: " + ext + " -> " + msg);
                        if (user != null)
                        {
                            try
                            {
                                var it = tv ? await _tmdb.GetTv(tmdbId, CancellationToken.None).ConfigureAwait(false)
                                            : await _tmdb.GetMovie(tmdbId, CancellationToken.None).ConfigureAwait(false);
                                RequestStore.Add(_json, user.Id, tv, it, tmdbId);
                            }
                            catch (Exception ex) { DiscoverDiagnostics.Add("aanvraag (Afspelen) onthouden mislukt: " + ex.Message); }
                        }
                        DownloadQueue.Invalidate();
                        _logger.Info("Discover: aanvraag via Afspelen {0}: {1}", ext, msg);
                    }
                    catch (Exception ex)
                    {
                        _logger.Error("Discover: aanvraag via Afspelen mislukt voor {0}: {1}", ext, ex.Message);
                        DiscoverDiagnostics.Add("FOUT aanvraag (Afspelen) " + ext + ": " + ex.Message);
                        DiscoverDiagnostics.CountRequest(false);
                    }
                });
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT PlaybackStart: " + ex.Message);
            }
        }
    }
}
