using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Text.RegularExpressions;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Logging;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Emby heeft geen officiele manier waarop een plugin een knop op de detailpagina van een item zet.
    /// Daarom zet deze klasse bij het opstarten een klein script (discover-request-button.js) naast index.html
    /// van de Emby-webclient en laadt index.html dat script. Het script zet de knop "Aanvragen" op de
    /// detailpagina van items uit het Discover-kanaal. Lukt het schrijven niet (rechten), dan staat de reden
    /// op de statuspagina en kun je het handmatig doen (zie README).
    /// </summary>
    public class ScriptInstaller : IServerEntryPoint
    {
        private const string ScriptName = "discover-request-button.js";
        private readonly ILogger _logger;
        private Timer _timer;

        public ScriptInstaller(ILogManager logManager)
        {
            _logger = logManager.GetLogger("Discover");
        }

        public void Run()
        {
            try
            {
                var dirs = FindDashboardUi();
                if (dirs.Count == 0)
                {
                    Fail("webclient-map (web of dashboard-ui) niet gevonden; vul DashboardUiPath in de plugin-config in of installeer handmatig");
                    return;
                }

                // Installeer in ALLE gevonden webclient-mappen (web en dashboard-ui kunnen naast elkaar bestaan;
                // welke Emby echt serveert verschilt per versie).
                foreach (var dir in dirs) Install(dir, false);

                if (_timer == null)
                    _timer = new Timer(delegate { Heal(); }, null, TimeSpan.FromSeconds(20), TimeSpan.FromSeconds(90));
            }
            catch (Exception ex)
            {
                Fail("installeren mislukt: " + ex.Message);
            }
        }

        /// <summary>
        /// Andere plugins/updates schrijven index.html soms opnieuw en gooien onze script-regel weg.
        /// Daarom controleren we elke 90 seconden en zetten de regel zo nodig terug (ververs daarna met Ctrl+F5).
        /// </summary>
        private void Heal()
        {
            try
            {
                foreach (var dir in FindDashboardUi()) Install(dir, true);
            }
            catch { }
        }

        private void Fail(string reason)
        {
            DiscoverDiagnostics.ButtonScript = "FOUT " + reason;
            DiscoverDiagnostics.Add("FOUT knop-script: " + reason);
            _logger.Error("Discover: knop-script: {0}", reason);
        }

        private static List<string> FindDashboardUi()
        {
            var candidates = new List<string>();
            try
            {
                var cfg = Plugin.Instance == null ? null : Plugin.Instance.Configuration.DashboardUiPath;
                if (!string.IsNullOrWhiteSpace(cfg)) candidates.Add(cfg.Trim());
            }
            catch { }

            var roots = new List<string>();
            try { roots.Add(AppContext.BaseDirectory); } catch { }
            try { roots.Add(Path.GetDirectoryName(typeof(IServerEntryPoint).Assembly.Location)); } catch { }
            try { roots.Add(Path.GetDirectoryName(typeof(Plugin).Assembly.Location)); } catch { }

            // Emby 4.11+ gebruikt "web"; oudere versies "dashboard-ui".
            string[] folders = { "web", "dashboard-ui" };
            string[] sub = { "", "system" };

            foreach (var r in roots)
            {
                if (string.IsNullOrWhiteSpace(r)) continue;
                var cur = r.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                // Huidige map + tot 4 niveaus omhoog (plugins → system → root, enz.)
                for (int up = 0; up < 5 && !string.IsNullOrEmpty(cur); up++)
                {
                    foreach (var f in folders)
                    {
                        candidates.Add(Path.Combine(cur, f));
                        candidates.Add(Path.Combine(cur, "system", f));
                        candidates.Add(Path.Combine(cur, "app", "emby", "system", f));
                    }
                    cur = Path.GetDirectoryName(cur);
                }
            }

            // Docker/Linux veelvoorkomende paden
            candidates.Add("/system/dashboard-ui");
            candidates.Add("/system/web");
            candidates.Add("/app/emby/system/dashboard-ui");
            candidates.Add("/app/emby/system/web");
            candidates.Add("/config/system/dashboard-ui");
            candidates.Add("/config/system/web");

            var found = new List<string>();
            foreach (var c in candidates)
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(c)) continue;
                    if (!File.Exists(Path.Combine(c, "index.html"))) continue;
                    var full = Path.GetFullPath(c);
                    if (!found.Contains(full)) found.Add(full);
                }
                catch { }
            }
            return found;
        }

        private void Install(string dir, bool quiet)
        {
            // 1. het script zelf (altijd bijwerken)
            string js;
            using (var src = typeof(ScriptInstaller).Assembly.GetManifestResourceStream(
                typeof(ScriptInstaller).Namespace + ".Resources." + ScriptName))
            {
                if (src == null) { Fail("script ontbreekt in de DLL"); return; }
                using (var rd = new StreamReader(src)) js = rd.ReadToEnd();
            }

            var jsPath = Path.Combine(dir, ScriptName);
            try { if (!File.Exists(jsPath) || File.ReadAllText(jsPath) != js) File.WriteAllText(jsPath, js); }
            catch (Exception ex) { Fail("kan " + ScriptName + " niet schrijven in " + dir + ": " + ex.Message); return; }

            // 2. index.html: script-tag zetten (externe src + markering)
            var version = typeof(ScriptInstaller).Assembly.GetName().Version.ToString();
            var marker = "<!-- discover-request-button v" + version + " -->";
            var tag = marker + "<script src=\"" + ScriptName + "?v=" + version + "\"></script>";
            var indexPath = Path.Combine(dir, "index.html");
            string html;
            try { html = File.ReadAllText(indexPath); }
            catch (Exception ex) { Fail("kan index.html niet lezen: " + ex.Message); return; }

            if (html.Contains(marker))
            {
                if (!quiet) Ok(dir, "al aanwezig v" + version);
                return;
            }

            var backup = indexPath + ".discover-backup";
            try { if (!File.Exists(backup)) File.Copy(indexPath, backup); }
            catch { /* backup is handig maar niet verplicht */ }

            // oude tags (elke versie) weghalen
            html = Regex.Replace(html, "<!-- discover-request-button v[^>]*-->", "");
            html = Regex.Replace(html, "<script src=\"" + Regex.Escape(ScriptName) + "[^\"]*\"></script>", "");
            int at = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (at < 0) at = html.LastIndexOf("</html>", StringComparison.OrdinalIgnoreCase);
            html = at >= 0 ? html.Insert(at, tag) : html + tag;
            try { File.WriteAllText(indexPath, html); }
            catch (Exception ex) { Fail("kan index.html niet schrijven: " + ex.Message); return; }

            Ok(dir, (quiet ? "HERSTELD (regel was weg) v" : "geinstalleerd v") + version);
        }

        private void Ok(string dir, string what)
        {
            DiscoverDiagnostics.ButtonScript = "OK " + what + " in " + dir + " (ververs de browser met Ctrl+F5)";
            DiscoverDiagnostics.Add("knop-script " + what + " in " + dir);
            _logger.Info("Discover: knop-script {0} in {1}", what, dir);
        }

        public void Dispose() { try { if (_timer != null) _timer.Dispose(); } catch { } }
    }
}
