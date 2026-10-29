using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Logging;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Zet (optioneel) de lader in de index.html van de Emby-webclient, zodat een tik op de tegel/menu-ingang
    /// "Discover Media" meteen de Discover-pagina opent en de Aanvragen-knop overal werkt. Wordt bij elke start
    /// opnieuw toegepast (Emby-updates overschrijven de webclient) en netjes verwijderd als de instelling uit staat.
    ///
    /// Alles is defensief: lukt het niet (map niet gevonden, geen schrijfrechten), dan logt het dat en blijft de
    /// rest van de plugin gewoon werken. De instelling staat standaard UIT.
    /// </summary>
    public class WebClientInjector : IServerEntryPoint
    {
        private const string LoaderFile = "discover-web-loader.js";
        private const string StartMark = "<!--discover-loader-start-->";
        private const string EndMark = "<!--discover-loader-end-->";

        private const string NsFile = "discover-nativeshell.js";
        private const string NsStart = "<!--discover-ns-start-->";
        private const string NsEnd = "<!--discover-ns-end-->";

        private readonly ILogger _logger;

        public WebClientInjector(ILogManager logManager)
        {
            _logger = logManager.GetLogger("Discover");
        }

        public void Run()
        {
            try { Apply(); }
            catch (Exception ex)
            {
                DiscoverDiagnostics.WebInject = "fout: " + ex.Message;
                try { _logger.Error("Discover: webclient-lader toepassen mislukt: {0}", ex.Message); } catch { }
            }
        }

        public void Dispose() { }

        private void Apply()
        {
            bool loaderOn = false, nsOn = false;
            string configuredPath = "";
            try
            {
                var cfg = Plugin.GetCurrentConfiguration();
                loaderOn = cfg.InjectWebClientLoader;
                nsOn = cfg.NativeShellMode;
                configuredPath = cfg.DashboardUiPath ?? "";
            }
            catch { }

            string indexPath = FindIndexHtml(configuredPath);
            if (indexPath == null)
            {
                string msg = (loaderOn || nsOn)
                    ? "webclient niet gevonden; vul het pad van de webclient-map (met index.html) in bij de instellingen"
                    : "uit";
                DiscoverDiagnostics.WebInject = msg;
                DiscoverDiagnostics.NativeShell = msg;
                return;
            }

            DiscoverDiagnostics.WebInject = ApplyLoader(indexPath, loaderOn);
            DiscoverDiagnostics.NativeShell = ApplyNativeShell(indexPath, nsOn);
            try { _logger.Info("Discover: webclient-injectie tegel={0}; app-modus={1}", DiscoverDiagnostics.WebInject, DiscoverDiagnostics.NativeShell); } catch { }
        }

        // Lader (tegel -> Discover + knop globaal): een extern <script> voor </body>.
        private string ApplyLoader(string indexPath, bool enabled)
        {
            string dir = Path.GetDirectoryName(indexPath);
            string loaderPath = Path.Combine(dir, LoaderFile);
            if (!enabled)
            {
                bool removed = RemoveFromIndex(indexPath);
                try { if (File.Exists(loaderPath)) File.Delete(loaderPath); } catch { }
                return removed ? "verwijderd uit " + indexPath : "uit";
            }
            try
            {
                using (var src = GetType().Assembly.GetManifestResourceStream(GetType().Namespace + ".Resources." + LoaderFile))
                {
                    if (src == null) { return "fout: lader ontbreekt in de DLL"; }
                    var tmp = loaderPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
                    using (var dst = File.Create(tmp)) { src.CopyTo(dst); }
                    if (File.Exists(loaderPath)) File.Delete(loaderPath);
                    File.Move(tmp, loaderPath);
                }
                bool added = AddToIndex(indexPath);
                return (added ? "actief in " : "al actief in ") + indexPath;
            }
            catch (Exception ex) { return "fout: " + ex.Message; }
        }

        // NativeShell (webOS app-modus): inline <script> VROEG in <head>, zodat Emby de app-modus kiest.
        private string ApplyNativeShell(string indexPath, bool enabled)
        {
            try
            {
                bool bom;
                string html = ReadText(indexPath, out bom);
                string cleaned = StripBlock(html, NsStart, NsEnd);
                if (!enabled)
                {
                    if (cleaned == html) { return "uit"; }
                    WriteText(indexPath, cleaned, bom);
                    return "verwijderd uit " + indexPath;
                }
                string shim;
                using (var src = GetType().Assembly.GetManifestResourceStream(GetType().Namespace + ".Resources." + NsFile))
                {
                    if (src == null) { return "fout: NativeShell ontbreekt in de DLL"; }
                    using (var r = new StreamReader(src, Encoding.UTF8)) { shim = r.ReadToEnd(); }
                }
                int head = cleaned.IndexOf("<head", StringComparison.OrdinalIgnoreCase);
                int headEnd = head >= 0 ? cleaned.IndexOf('>', head) : -1;
                string block = NsStart + "<script>\n" + shim + "\n</scr" + "ipt>" + NsEnd;
                string result = headEnd >= 0
                    ? cleaned.Substring(0, headEnd + 1) + "\n" + block + cleaned.Substring(headEnd + 1)
                    : block + cleaned;
                if (result == html) { return "al actief in " + indexPath; }
                WriteText(indexPath, result, bom);
                return "actief in " + indexPath;
            }
            catch (Exception ex) { return "fout: " + ex.Message; }
        }

        private string StripBlock(string html, string start, string end)
        {
            int a = html.IndexOf(start, StringComparison.Ordinal);
            int b = html.IndexOf(end, StringComparison.Ordinal);
            if (a >= 0 && b > a)
            {
                int e = b + end.Length;
                string before = html.Substring(0, a).TrimEnd('\r', '\n', ' ', '\t');
                return before + html.Substring(e);
            }
            return html;
        }

        private string FindIndexHtml(string configuredPath)
        {
            foreach (var dir in CandidateDirs(configuredPath))
            {
                if (string.IsNullOrWhiteSpace(dir)) continue;
                try
                {
                    var p = Path.Combine(dir, "index.html");
                    if (File.Exists(p)) return p;
                }
                catch { }
            }
            return null;
        }

        private IEnumerable<string> CandidateDirs(string configuredPath)
        {
            var list = new List<string>();
            if (!string.IsNullOrWhiteSpace(configuredPath))
            {
                list.Add(configuredPath);
                // als het pad direct naar index.html wijst, ook de map proberen
                try { if (configuredPath.EndsWith("index.html", StringComparison.OrdinalIgnoreCase)) list.Add(Path.GetDirectoryName(configuredPath)); } catch { }
            }
            string baseDir = null;
            try { baseDir = AppContext.BaseDirectory; } catch { }
            if (string.IsNullOrWhiteSpace(baseDir))
            {
                try { baseDir = AppDomain.CurrentDomain.BaseDirectory; } catch { }
            }
            if (!string.IsNullOrWhiteSpace(baseDir))
            {
                string[] subs = { "dashboard-ui", "system/dashboard-ui", "../dashboard-ui", "web", "../web" };
                foreach (var s in subs)
                {
                    try { list.Add(Path.GetFullPath(Path.Combine(baseDir, s.Replace('/', Path.DirectorySeparatorChar)))); } catch { }
                }
            }
            return list;
        }

        private string ReadText(string path, out bool bom)
        {
            var bytes = File.ReadAllBytes(path);
            bom = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
            int start = bom ? 3 : 0;
            return Encoding.UTF8.GetString(bytes, start, bytes.Length - start);
        }

        private void WriteText(string path, string text, bool bom)
        {
            var body = Encoding.UTF8.GetBytes(text);
            var tmp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            using (var fs = File.Create(tmp))
            {
                if (bom) fs.Write(new byte[] { 0xEF, 0xBB, 0xBF }, 0, 3);
                fs.Write(body, 0, body.Length);
            }
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        private string StripExisting(string html)
        {
            int a = html.IndexOf(StartMark, StringComparison.Ordinal);
            int b = html.IndexOf(EndMark, StringComparison.Ordinal);
            if (a >= 0 && b > a)
            {
                int end = b + EndMark.Length;
                // ook een eventuele voorafgaande witregel opruimen
                string before = html.Substring(0, a).TrimEnd('\r', '\n', ' ', '\t');
                string after = html.Substring(end);
                return before + after;
            }
            return html;
        }

        private bool AddToIndex(string indexPath)
        {
            bool bom;
            string html = ReadText(indexPath, out bom);
            string cleaned = StripExisting(html);
            string block = "\n" + StartMark +
                "<script src=\"" + LoaderFile + "?v=" + Plugin.VersionString + "\" defer></script>" +
                EndMark + "\n";

            int bodyClose = cleaned.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            string result;
            if (bodyClose >= 0) { result = cleaned.Substring(0, bodyClose) + block + cleaned.Substring(bodyClose); }
            else { result = cleaned + block; }

            if (result == html) return false;      // was al correct aanwezig
            WriteText(indexPath, result, bom);
            return true;
        }

        private bool RemoveFromIndex(string indexPath)
        {
            try
            {
                bool bom;
                string html = ReadText(indexPath, out bom);
                string cleaned = StripExisting(html);
                if (cleaned == html) return false;
                WriteText(indexPath, cleaned, bom);
                return true;
            }
            catch { return false; }
        }
    }
}
