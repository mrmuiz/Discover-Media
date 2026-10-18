using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Maakt voor een hoofdmap een liggend plaatje: de kleurachtergrond van TMDB (duotone) met de naam van de map
    /// er in het Engels op, in wit Poppins Bold. Het plaatje komt als bestand op schijf; het kanaal geeft het pad door
    /// aan Emby. Lukt iets niet (geen ffmpeg, geen schrijfrechten, TMDB niet bereikbaar), dan geeft Create null
    /// terug en gebruikt het kanaal de achtergrond zonder tekst, zoals in 0.23.
    /// </summary>
    internal static class FolderTile
    {
        // Ophogen als de opmaak verandert, dan worden bewaarde plaatjes niet meer hergebruikt.
        private const int TileVersion = 2;

        private const int W = 1280;
        private const int H = 720;

        private static readonly HttpClient Http = CreateHttp();
        // Maximaal twee ffmpeg-processen tegelijk (negen mappen bij de eerste keer openen).
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(2, 2);

        private static HttpClient CreateHttp()
        {
            var c = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            try { c.DefaultRequestHeaders.UserAgent.ParseAdd("EmbyDiscover/1.0-beta"); } catch { }
            return c;
        }

        /// <summary>Geeft het pad van het plaatje (uit de bewaarde bestanden of net gemaakt), of null als het niet lukt.</summary>
        public static async Task<string> Create(string key, string text, string backgroundUrl, CancellationToken ct)
        {
            try
            {
                if (!Plugin.Instance.Configuration.TileTextImages) return null;
                if (string.IsNullOrEmpty(backgroundUrl) || string.IsNullOrEmpty(text)) return null;

                var ffmpeg = RequestCard.FindFfmpeg();
                if (ffmpeg == null)
                {
                    DiscoverDiagnostics.Add("mapplaatje '" + text + "': ffmpeg niet gevonden (plaatje zonder tekst gebruikt)");
                    return null;
                }

                var dir = Plugin.Instance.WorkDir("discover-tiles");
                var final = Path.Combine(dir, string.Format("tile-{0}-{1}-v{2}.jpg", key, Hash(text + "|" + backgroundUrl), TileVersion));
                if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                await Gate.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                    var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                    Directory.CreateDirectory(work);
                    try
                    {
                        if (!await Download(backgroundUrl, Path.Combine(work, "bg.jpg"), ct).ConfigureAwait(false))
                        {
                            DiscoverDiagnostics.Add("mapplaatje '" + text + "': achtergrond niet opgehaald (plaatje zonder tekst gebruikt)");
                            return null;
                        }
                        CopyResource("Poppins-Bold.ttf", Path.Combine(work, "bold.ttf"));
                        File.WriteAllText(Path.Combine(work, "text.txt"), text, new UTF8Encoding(false));

                        // Lettergrootte: zo groot mogelijk (max 120), maar de tekst blijft binnen 1040 px van de 1280.
                        int size = 120;
                        double width = RequestCard.Measure(text, size, true);
                        if (width > 1040) size = (int)Math.Floor(size * 1040 / width);

                        // Eerst de volledige opmaak (donkerder, schaduw); werkt die niet in jouw ffmpeg, dan een eenvoudiger versie.
                        var scaleCrop = "scale=" + W + ":" + H + ":force_original_aspect_ratio=increase,crop=" + W + ":" + H;
                        var full =
                            "[0:v]" + scaleCrop + "," +
                            "colorchannelmixer=rr=0.75:gg=0.75:bb=0.75," +
                            "drawtext=fontfile=bold.ttf:textfile=text.txt:expansion=none:fontsize=" + size +
                            ":fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black@0.55:shadowx=4:shadowy=4," +
                            "format=yuvj420p[v]";
                        var simple =
                            "[0:v]" + scaleCrop + "," +
                            "drawtext=fontfile=bold.ttf:textfile=text.txt:expansion=none:fontsize=" + size +
                            ":fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2[v]";
                        var variants = new[] { full, simple };
                        Exception lastError = null;
                        for (int v = 0; v < variants.Length; v++)
                        {
                            try
                            {
                                var args = "-y -hide_banner -loglevel error -i bg.jpg -filter_complex \"" + variants[v] +
                                           "\" -map [v] -frames:v 1 -q:v 3 out.jpg";
                                await RunFfmpeg(ffmpeg, work, args).ConfigureAwait(false);
                                if (File.Exists(Path.Combine(work, "out.jpg")) && new FileInfo(Path.Combine(work, "out.jpg")).Length > 0) { lastError = null; break; }
                                lastError = new InvalidOperationException("ffmpeg maakte geen bestand");
                            }
                            catch (Exception fx)
                            {
                                if (fx is OperationCanceledException) throw;
                                lastError = fx;
                                DiscoverDiagnostics.Add("mapplaatje '" + text + "': opmaak " + (v + 1) + " mislukt: " + fx.Message);
                            }
                        }
                        if (lastError != null) throw lastError;

                        var made = Path.Combine(work, "out.jpg");
                        if (!File.Exists(made) || new FileInfo(made).Length == 0)
                            throw new InvalidOperationException("ffmpeg maakte geen bestand");
                        if (File.Exists(final)) File.Delete(final);
                        File.Move(made, final);
                        DiscoverDiagnostics.Add("mapplaatje '" + text + "' gemaakt: " + final);
                    }
                    finally
                    {
                        try { Directory.Delete(work, true); } catch { }
                    }

                    // Oude plaatjes opruimen (30 dagen); de achtergronden wisselen mee met wat trending is.
                    try
                    {
                        foreach (var f in Directory.GetFiles(dir, "tile-*.jpg"))
                            if (File.GetLastWriteTimeUtc(f) < DateTime.UtcNow.AddDays(-30)) File.Delete(f);
                    }
                    catch { }
                    return final;
                }
                finally { Gate.Release(); }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("mapplaatje '" + text + "' mislukt: " + ex.Message + " (plaatje zonder tekst gebruikt)");
                return null;
            }
        }

        /// <summary>
        /// Zet een studio- of netwerklogo (al in kleur gezet door TMDB) in het midden van een liggend, doorzichtig plaatje
        /// van 1280x720, zodat Emby het niet afsnijdt. Geeft het pad van het PNG-bestand, of null als het niet lukt
        /// (dan gebruikt het kanaal het logo zoals het is).
        /// </summary>
        public static async Task<string> CreateLogo(string key, string logoUrl, CancellationToken ct)
        {
            try
            {
                if (string.IsNullOrEmpty(logoUrl)) return null;

                var ffmpeg = RequestCard.FindFfmpeg();
                if (ffmpeg == null) return null;

                var dir = Plugin.Instance.WorkDir("discover-tiles");
                var final = Path.Combine(dir, string.Format("logo-{0}-{1}-v{2}.png", key, Hash(logoUrl), TileVersion));
                if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                await Gate.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                    var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                    Directory.CreateDirectory(work);
                    try
                    {
                        if (!await Download(logoUrl, Path.Combine(work, "logo.png"), ct).ConfigureAwait(false)) return null;

                        // Passend maken binnen 1000x400 (met ruime marge rondom) op een doorzichtig vlak van 1280x720.
                        var args = "-y -hide_banner -loglevel error -i logo.png -vf \"format=rgba,scale=1000:400:force_original_aspect_ratio=decrease," +
                                   "pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2:color=black@0\" -frames:v 1 out.png";
                        await RunFfmpeg(ffmpeg, work, args).ConfigureAwait(false);

                        var made = Path.Combine(work, "out.png");
                        if (!File.Exists(made) || new FileInfo(made).Length == 0)
                            throw new InvalidOperationException("ffmpeg maakte geen bestand");
                        if (File.Exists(final)) File.Delete(final);
                        File.Move(made, final);
                    }
                    finally
                    {
                        try { Directory.Delete(work, true); } catch { }
                    }

                    try
                    {
                        foreach (var f in Directory.GetFiles(dir, "logo-*.png"))
                            if (File.GetLastWriteTimeUtc(f) < DateTime.UtcNow.AddDays(-30)) File.Delete(f);
                    }
                    catch { }
                    return final;
                }
                finally { Gate.Release(); }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("logotegel '" + key + "' mislukt: " + ex.Message + " (logo zonder opmaak gebruikt)");
                return null;
            }
        }

        private static async Task RunFfmpeg(string ffmpeg, string work, string args)
        {
            var psi = new ProcessStartInfo
            {
                FileName = ffmpeg,
                Arguments = args,
                WorkingDirectory = work,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true
            };
            var err = new StringBuilder();
            using (var p = new Process { StartInfo = psi })
            {
                p.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data == null) return;
                    lock (err) { if (err.Length < 3000) err.AppendLine(e.Data); }
                };
                p.Start();
                p.BeginErrorReadLine();
                bool done = await Task.Run(() => p.WaitForExit(30000)).ConfigureAwait(false);
                if (!done)
                {
                    try { p.Kill(); } catch { }
                    throw new TimeoutException("ffmpeg duurde langer dan 30 seconden");
                }
                p.WaitForExit();
                if (p.ExitCode != 0)
                {
                    string tail;
                    lock (err) { tail = err.ToString().Trim(); }
                    if (tail.Length > 400) tail = tail.Substring(tail.Length - 400);
                    throw new InvalidOperationException("ffmpeg gaf code " + p.ExitCode + ": " + tail);
                }
            }
        }

        // Vaste (niet willekeurige) korte code van een tekst, voor de bestandsnaam.
        private static string Hash(string s)
        {
            uint h = 2166136261;
            foreach (var ch in s) { h ^= ch; h *= 16777619; }
            return h.ToString("x8", CultureInfo.InvariantCulture);
        }

        private static void CopyResource(string name, string target)
        {
            var asm = typeof(FolderTile).Assembly;
            using (var src = asm.GetManifestResourceStream(typeof(FolderTile).Namespace + ".Resources." + name))
            {
                if (src == null) throw new InvalidOperationException("Lettertype ontbreekt in de DLL: " + name);
                using (var dst = File.Create(target)) { src.CopyTo(dst); }
            }
        }

        private static async Task<bool> Download(string url, string path, CancellationToken ct)
        {
            try
            {
                using (var resp = await Http.GetAsync(url, ct).ConfigureAwait(false))
                {
                    if (!resp.IsSuccessStatusCode) return false;
                    var bytes = await resp.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
                    if (bytes.Length < 500) return false;
                    File.WriteAllBytes(path, bytes);
                    return true;
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("achtergrond voor mapplaatje niet opgehaald: " + ex.Message);
                return false;
            }
        }
    }
}
