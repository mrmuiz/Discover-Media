using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using MediaBrowser.Controller.Plugins;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Ruimt de gemaakte kaartclips (discover-cards) en tegelplaatjes (discover-tiles) op:
    /// eerst op leeftijd, daarna zo nodig de oudste eerst tot de map onder de maximale grootte zit.
    /// Draait bij het opstarten (na 2 minuten) en daarna elke 24 uur, los van het aanmaken van bestanden.
    /// </summary>
    internal static class CacheCleaner
    {
        private static readonly object Gate = new object();

        internal sealed class Stats
        {
            public int CardFiles; public long CardBytes;
            public int TileFiles; public long TileBytes;
        }

        private static List<FileInfo> Files(string sub, params string[] patterns)
        {
            var result = new List<FileInfo>();
            string dir;
            try { dir = Plugin.Instance.WorkDir(sub); } catch { return result; }
            foreach (var pattern in patterns)
            {
                string[] names;
                try { names = Directory.GetFiles(dir, pattern); } catch { continue; }
                foreach (var n in names)
                {
                    try { result.Add(new FileInfo(n)); } catch { }
                }
            }
            return result;
        }

        private static List<FileInfo> Cards() { return Files("discover-cards", "card-*.mp4"); }
        private static List<FileInfo> Tiles() { return Files("discover-tiles", "tile-*.jpg", "logo-*.png"); }

        internal static Stats GetStats()
        {
            var s = new Stats();
            foreach (var f in Cards()) { s.CardFiles++; s.CardBytes += f.Length; }
            foreach (var f in Tiles()) { s.TileFiles++; s.TileBytes += f.Length; }
            return s;
        }

        /// <summary>all=true: alles verwijderen (de bestanden worden bij gebruik vanzelf opnieuw gemaakt).</summary>
        internal static string Run(bool all)
        {
            lock (Gate)
            {
                var cfg = Plugin.GetCurrentConfiguration();
                var cards = Cards();
                var tiles = Tiles();
                int removed = 0; long freed = 0;

                Action<FileInfo> delete = f =>
                {
                    try { var len = f.Length; f.Delete(); removed++; freed += len; } catch { }
                };

                var keep = new List<FileInfo>();
                var now = DateTime.UtcNow;
                foreach (var f in cards)
                {
                    if (all || (cfg.CardRetentionDays > 0 && f.LastWriteTimeUtc < now.AddDays(-cfg.CardRetentionDays))) delete(f);
                    else keep.Add(f);
                }
                foreach (var f in tiles)
                {
                    if (all || (cfg.TileRetentionDays > 0 && f.LastWriteTimeUtc < now.AddDays(-cfg.TileRetentionDays))) delete(f);
                    else keep.Add(f);
                }

                // Maximale grootte (kaarten en tegels samen): oudste eerst weg.
                if (!all && cfg.MaxCacheMb > 0)
                {
                    long max = (long)cfg.MaxCacheMb * 1024 * 1024;
                    long total = keep.Sum(f => f.Length);
                    foreach (var f in keep.OrderBy(x => x.LastWriteTimeUtc))
                    {
                        if (total <= max) break;
                        long len = f.Length;
                        int before = removed;
                        delete(f);
                        if (removed > before) total -= len;
                    }
                }

                var msg = "opruimen: " + removed + " bestanden verwijderd (" + (freed / 1048576) + " MB)";
                DiscoverDiagnostics.Add(msg);
                return msg;
            }
        }
    }

    /// <summary>Start de opruiming 2 minuten na het opstarten en daarna dagelijks.</summary>
    public class CacheCleanupEntryPoint : IServerEntryPoint
    {
        private Timer _timer;

        public void Run()
        {
            _timer = new Timer(_ =>
            {
                try { CacheCleaner.Run(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("FOUT opruimen: " + ex.Message); }
            }, null, TimeSpan.FromMinutes(2), TimeSpan.FromHours(24));
        }

        public void Dispose()
        {
            if (_timer != null) { _timer.Dispose(); _timer = null; }
        }
    }
}
