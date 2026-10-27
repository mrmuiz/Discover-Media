using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Serialization;

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

        public RequestOnPlay(ISessionManager sessions, ILogManager logManager, IJsonSerializer json)
        {
            _sessions = sessions;
            _logger = logManager.GetLogger("Discover");
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
            RequestStore.Init(json);
        }

        public void Run()
        {
            _sessions.PlaybackStart += OnPlaybackStart;
        }

        public void Dispose()
        {
            _sessions.PlaybackStart -= OnPlaybackStart;
        }

        private void OnPlaybackStart(object sender, PlaybackProgressEventArgs e)
        {
            try
            {
                var ext = e == null || e.Item == null ? null : e.Item.ExternalId;
                if (string.IsNullOrEmpty(ext) || !ext.StartsWith(DiscoverMediaChannel.AskPrefix, StringComparison.Ordinal)) return;

                var rest = ext.Substring(DiscoverMediaChannel.AskPrefix.Length);   // "m:123" of "t:123"
                bool tv = rest.StartsWith("t:", StringComparison.Ordinal);
                int tmdbId;
                if (rest.Length < 3 || !int.TryParse(rest.Substring(2), out tmdbId))
                {
                    DiscoverDiagnostics.Add("aanvraag bij afspelen: onbekend id " + ext);
                    return;
                }

                Requester who = null;
                try { who = Requester.From(e.Users != null ? e.Users.FirstOrDefault() : null); } catch { }

                Task.Run(async () =>
                {
                    try
                    {
                        var outcome = await RequestFlow.Submit(_tmdb, _arr, who, tv, tmdbId, null, CancellationToken.None).ConfigureAwait(false);
                        var msg = outcome.Message + (who == null ? "" : " (" + who.Name + ")");
                        DiscoverDiagnostics.Add("aanvraag via Afspelen: " + ext + " -> " + msg);
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
