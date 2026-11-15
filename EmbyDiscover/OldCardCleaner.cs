using System;
using System.Linq;
using System.Threading.Tasks;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Logging;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Once after an update: removes the cached Discover cards that Emby stored with the old provider id ("Tmdb").
    /// Those cards share their playback position with library movies (they show up in "Continue Watching").
    /// They are only a cache of the channel: Emby recreates them (now with "DiscoverTmdb") when a user opens the channel.
    /// </summary>
    public class OldCardCleaner : IServerEntryPoint
    {
        private const string Marker = "1.4.0.20";
        private readonly ILibraryManager _library;
        private readonly ILogger _logger;

        public OldCardCleaner(ILibraryManager library, ILogManager logManager)
        {
            _library = library;
            _logger = logManager.GetLogger("Discover");
        }

        public void Dispose() { }

        public void Run()
        {
            Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(3)).ConfigureAwait(false);
                    var cfg = Plugin.GetCurrentConfiguration();
                    if (string.Equals(cfg.OldCardsCleanedFor, Marker, StringComparison.Ordinal)) return;
                    var removed = Clean();
                    cfg = Plugin.GetCurrentConfiguration();
                    cfg.OldCardsCleanedFor = Marker;
                    try { Plugin.Instance.UpdateConfiguration(cfg); } catch { }
                    _logger.Info("Discover: removed {0} cached cards with the old provider id", removed);
                    DiscoverDiagnostics.Add("old cached cards removed: " + removed);
                }
                catch (Exception ex)
                {
                    _logger.Error("Discover: removing old cached cards failed: {0}", ex.Message);
                    DiscoverDiagnostics.Add("removing old cached cards failed: " + ex.Message);
                }
            });
        }

        private static bool OurExternalId(string ext) =>
            !string.IsNullOrEmpty(ext) && (ext.StartsWith("ask", StringComparison.Ordinal) || ext.StartsWith("tr", StringComparison.Ordinal));

        private int Clean()
        {
            var removed = 0;
            var channels = _library.GetItemList(new InternalItemsQuery { IncludeItemTypes = new[] { "Channel" } });
            foreach (var ch in channels)
            {
                var kids = _library.GetItemList(new InternalItemsQuery { ParentIds = new[] { ch.InternalId }, Limit = 25 });
                if (!kids.Any(k => OurExternalId(k.ExternalId)) && !string.Equals(ch.Name, "Discover Media", StringComparison.OrdinalIgnoreCase)) continue;

                var items = _library.GetItemList(new InternalItemsQuery { ChannelIds = new[] { ch.InternalId } });
                foreach (var it in items)
                {
                    if (it.InternalId == ch.InternalId || !OurExternalId(it.ExternalId)) continue;
                    var ids = it.ProviderIds;
                    if (ids == null || !ids.ContainsKey("Tmdb") || ids.ContainsKey("DiscoverTmdb")) continue;
                    try
                    {
                        _library.DeleteItem(it, new DeleteOptions { DeleteFileLocation = false }, false);
                        removed++;
                    }
                    catch (Exception ex) { DiscoverDiagnostics.Add("removing cached card failed: " + ex.Message); }
                }
            }
            return removed;
        }
    }
}
