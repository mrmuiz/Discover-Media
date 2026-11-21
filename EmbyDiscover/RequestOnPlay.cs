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
                DiscoverDiagnostics.Add("log.play.melding_geblokkeerde_aanvraag_mislukt", ex.Message);
            }
        }

        private void OnPlaybackStart(object sender, PlaybackProgressEventArgs e)
        {
            try
            {
                var ext = e == null || e.Item == null ? null : e.Item.ExternalId;
                if (string.IsNullOrEmpty(ext)) return;
                ext = DiscoverMediaChannel.StripTileMark(ext);
                bool seasonRequest = ext.StartsWith(DiscoverMediaChannel.AskSeasonPrefix, StringComparison.Ordinal);
                bool allSeasons = ext.StartsWith(DiscoverMediaChannel.AskAllPrefix, StringComparison.Ordinal);
                if (!seasonRequest && !allSeasons && !ext.StartsWith(DiscoverMediaChannel.AskPrefix, StringComparison.Ordinal)) return;

                int[] seasons = null;
                string rest;
                if (seasonRequest)
                {
                    var parts = ext.Substring(DiscoverMediaChannel.AskSeasonPrefix.Length).Split(':');
                    int seasonTmdbId;
                    int seasonNumber;
                    if (parts.Length != 4 || parts[0] != "t" || parts[2] != "s" ||
                        !int.TryParse(parts[1], out seasonTmdbId) || seasonTmdbId <= 0 ||
                        !int.TryParse(parts[3], out seasonNumber) || seasonNumber <= 0)
                    {
                        DiscoverDiagnostics.Add("log.play.aanvraag_bij_afspelen_onbekend_seizoens", ext);
                        return;
                    }
                    rest = "t:" + seasonTmdbId;
                    seasons = new[] { seasonNumber };
                }
                else
                {
                    var prefix = allSeasons ? DiscoverMediaChannel.AskAllPrefix : DiscoverMediaChannel.AskPrefix;
                    rest = ext.Substring(prefix.Length); // "m:123" of "t:123"
                }
                bool tv = rest.StartsWith("t:", StringComparison.Ordinal);
                int tmdbId;
                if (rest.Length < 3 || !int.TryParse(rest.Substring(2), out tmdbId))
                {
                    DiscoverDiagnostics.Add("log.play.aanvraag_bij_afspelen_onbekend_id", ext);
                    return;
                }

                // Mag deze gebruiker aanvragen? Zo niet: niets naar Radarr/Sonarr, het afspelen stoppen en een melding tonen.
                var user = e.Users != null && e.Users.Count > 0 ? e.Users[0] : null;
                if (user != null && !RequestAccess.IsAllowed(user.Id))
                {
                    DiscoverDiagnostics.Add("log.play.aanvraag_geblokkeerd_voor_gebruiker", user.Name, ext);
                    _logger.Info("Discover: request {0} blocked for user {1}", ext, user.Name);
                    NotifyBlocked(e);
                    return;
                }
                if (user != null)
                {
                    var limitMsg = RequestAccess.LimitMessage(_json, user.Id, user.Policy != null && user.Policy.IsAdministrator);
                    if (limitMsg != null)
                    {
                        DiscoverDiagnostics.Add("log.play.aanvraag_afspelen_boven_de_limiet_voor", user.Name, ext);
                        NotifyBlocked(e, limitMsg);
                        return;
                    }
                }

                Task.Run(async () =>
                {
                    try
                    {
                        var msg = await DiscoverMediaChannel.RequestTitle(_tmdb, _arr, tv, tmdbId, seasons, CancellationToken.None, user != null ? (object)user.Id : null, user != null ? user.Name : null).ConfigureAwait(false);
                        DiscoverDiagnostics.Add("log.play.aanvraag_via_afspelen", ext, msg);
                        if (user != null)
                        {
                            try
                            {
                                var it = tv ? await _tmdb.GetTv(tmdbId, CancellationToken.None).ConfigureAwait(false)
                                            : await _tmdb.GetMovie(tmdbId, CancellationToken.None).ConfigureAwait(false);
                                RequestStore.Add(_json, user.Id, tv, it, tmdbId);
                            }
                            catch (Exception ex) { DiscoverDiagnostics.Add("log.play.aanvraag_afspelen_onthouden_mislukt", ex.Message); }
                        }
                        DownloadQueue.Invalidate();
                        _logger.Info("Discover: request via Play {0}: {1}", ext, msg);
                    }
                    catch (Exception ex)
                    {
                        _logger.Error("Discover: request via Play failed for {0}: {1}", ext, ex.Message);
                        DiscoverDiagnostics.Add("log.play.fout_aanvraag_afspelen", ext, ex.Message);
                        DiscoverDiagnostics.CountRequest(false);
                    }
                });
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("log.play.fout_playbackstart", ex.Message);
            }
        }
    }
}
