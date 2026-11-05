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
    /// Maakt liggende tegelafbeeldingen met de naam van de map in wit Poppins Bold. Het plaatje komt als bestand
    /// op schijf; het kanaal geeft het pad door aan Emby. Lukt iets niet (geen ffmpeg, geen schrijfrechten,
    /// TMDB niet bereikbaar), dan geeft Create null
    /// terug en gebruikt het kanaal de achtergrond zonder tekst, zoals in 0.23.
    /// </summary>
    internal static class FolderTile
    {
        // Ophogen als de opmaak verandert, dan worden bewaarde plaatjes niet meer hergebruikt.
        private const int TileVersion = 5;

        private const int W = 1280;
        private const int H = 720;

        private static readonly HttpClient Http = CreateHttp();
        // Maximaal twee ffmpeg-processen tegelijk (negen mappen bij de eerste keer openen).
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(2, 2);

        // Downloads gebeuren buiten de ffmpeg-wachtrij, zodat de twee ffmpeg-plaatsen niet op het netwerk staan te wachten.
        private static readonly SemaphoreSlim DownloadGate = new SemaphoreSlim(8, 8);
        // Plaatjes die al op de achtergrond opnieuw gemaakt worden (niet dubbel starten).
        private static readonly System.Collections.Generic.HashSet<string> Building = new System.Collections.Generic.HashSet<string>();

        private static async Task<string> PreDownload(string url, string dir, string ext, CancellationToken ct)
        {
            var tmp = Path.Combine(dir, "dl-" + Guid.NewGuid().ToString("N") + ext);
            await DownloadGate.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                if (await Download(url, tmp, ct).ConfigureAwait(false)) return tmp;
            }
            finally { DownloadGate.Release(); }
            try { if (File.Exists(tmp)) File.Delete(tmp); } catch { }
            return null;
        }

        /// <summary>Nieuwste bestaande versie van hetzelfde plaatje (andere achtergrond), of null.</summary>
        private static string FindStale(string dir, string pattern, string final)
        {
            try
            {
                FileInfo best = null;
                foreach (var f in Directory.GetFiles(dir, pattern))
                {
                    if (string.Equals(f, final, StringComparison.OrdinalIgnoreCase)) continue;
                    var fi = new FileInfo(f);
                    if (fi.Length > 0 && (best == null || fi.LastWriteTimeUtc > best.LastWriteTimeUtc)) best = fi;
                }
                return best == null ? null : best.FullName;
            }
            catch { return null; }
        }

        private static void RebuildInBackground(string final, Func<Task<string>> make)
        {
            lock (Building) { if (!Building.Add(final)) return; }
            Task.Run(async () =>
            {
                try { await make().ConfigureAwait(false); }
                catch (Exception ex) { DiscoverDiagnostics.Add("plaatje op de achtergrond vernieuwen mislukt: " + ex.Message); }
                finally { lock (Building) { Building.Remove(final); } }
            });
        }

        private static HttpClient CreateHttp()
        {
            var c = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            try { c.DefaultRequestHeaders.UserAgent.ParseAdd("EmbyDiscover/1.1"); } catch { }
            return c;
        }

        /// <summary>Geeft het pad van het plaatje (uit de bewaarde bestanden of net gemaakt), of null als het niet lukt.</summary>
        // Achtergrondrij voor tegels die tijdens een kanaalverversing nog ontbreken: één tegelijk, zodat Emby niet stil valt.
        private static readonly SemaphoreSlim BackgroundLane = new SemaphoreSlim(1, 1);
        private static int _backgroundQueued;
        private static int _backgroundMade;

        /// <summary>
        /// Maak een tegel op de achtergrond (niet wachten). Emby 4.11 vraagt kanaalmappen bij het openen niet altijd opnieuw op
        /// bij de plugin; dan worden de tegels nooit "bij het openen" gemaakt. Zo staan ze er bij de volgende verversing wel.
        /// </summary>
        public static void EnsureInBackground(string key, string text, string backgroundUrl)
        {
            if (!Plugin.GetCurrentConfiguration().TileTextImages || string.IsNullOrEmpty(text) || string.IsNullOrEmpty(backgroundUrl)) return;
            var tag = "bg|" + key + "|" + text + "|" + backgroundUrl;
            lock (Building)
            {
                if (Building.Contains(tag) || _backgroundQueued >= 5000) return;
                Building.Add(tag);
                _backgroundQueued++;
            }
            Task.Run(async () =>
            {
                try
                {
                    await BackgroundLane.WaitAsync().ConfigureAwait(false);
                    try
                    {
                        var made = await Create(key, text, backgroundUrl, CancellationToken.None, null, false).ConfigureAwait(false);
                        if (made != null) Interlocked.Increment(ref _backgroundMade);
                    }
                    finally { BackgroundLane.Release(); }
                }
                catch (Exception ex) { DiscoverDiagnostics.Add("tegel op de achtergrond mislukt: " + ex.Message); }
                finally
                {
                    bool drained;
                    lock (Building) { Building.Remove(tag); _backgroundQueued--; drained = _backgroundQueued == 0; }
                    // Rij leeg en er is iets gemaakt: Emby laten verversen, zodat de tegels met tekst ook echt verschijnen.
                    if (drained && Interlocked.Exchange(ref _backgroundMade, 0) > 0) ChannelRefresher.Request("nieuwe tegels klaar");
                }
            });
        }

        /// <summary>
        /// Al gemaakte tegel (liggend, zonder ffmpeg te starten), of een oudere versie ervan; anders null.
        /// Voor de kanaalverversing zonder gebruiker: dan blijft de tekst op de tegel staan in plaats van te verdwijnen.
        /// </summary>
        public static string Existing(string key, string text, string backgroundUrl)
        {
            try
            {
                if (!Plugin.GetCurrentConfiguration().TileTextImages || string.IsNullOrEmpty(text)) return null;
                var dir = Plugin.Instance.WorkDir("discover-tiles");
                var final = Path.Combine(dir, string.Format("tile-{0}-{1}-v{2}.jpg", key, Hash(text + "|" + backgroundUrl + "|" + (string)null), TileVersion));
                if (File.Exists(final) && new FileInfo(final).Length > 0) { CacheCleaner.Touch(final); return final; }
                return FindStale(dir, "tile-" + key + "-????????-v" + TileVersion + ".jpg", final);
            }
            catch { return null; }
        }

        public static async Task<string> Create(string key, string text, string backgroundUrl, CancellationToken ct, string fallbackColor = null, bool allowStale = true, int width = 0, int height = 0)
        {
            try
            {
                if (!Plugin.GetCurrentConfiguration().TileTextImages) return null;
                if (string.IsNullOrEmpty(text)) return null;
                if (string.IsNullOrEmpty(backgroundUrl) && string.IsNullOrEmpty(fallbackColor)) return null;
                // Standaard liggend (1280x720); met width/height bv. een staande tegel (2:3) voor het "Alle seizoenen"-item.
                int tw = width > 0 ? width : W;
                int th = height > 0 ? height : H;

                var ffmpeg = RequestCard.FindFfmpeg();
                if (ffmpeg == null)
                {
                    DiscoverDiagnostics.Add("mapplaatje '" + text + "': ffmpeg niet gevonden (plaatje zonder tekst gebruikt)");
                    return null;
                }

                var dir = Plugin.Instance.WorkDir("discover-tiles");
                var final = Path.Combine(dir, string.Format("tile-{0}-{1}-v{2}.jpg", key, Hash(text + "|" + backgroundUrl + "|" + fallbackColor + (width > 0 || height > 0 ? "|" + tw + "x" + th : "")), TileVersion));
                if (File.Exists(final) && new FileInfo(final).Length > 0) { CacheCleaner.Touch(final); return final; }

                // Is er al een eerder plaatje van deze tegel, toon dat dan meteen en maak het nieuwe op de achtergrond.
                if (allowStale)
                {
                    var stale = FindStale(dir, "tile-" + key + "-????????-v" + TileVersion + ".jpg", final);
                    if (stale != null)
                    {
                        RebuildInBackground(final, () => Create(key, text, backgroundUrl, CancellationToken.None, fallbackColor, false, width, height));
                        return stale;
                    }
                }

                string pre = null;
                if (!string.IsNullOrEmpty(backgroundUrl))
                    pre = await PreDownload(backgroundUrl, dir, ".jpg", ct).ConfigureAwait(false);
                try
                {
                await Gate.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                    var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                    Directory.CreateDirectory(work);
                    try
                    {
                        var input = string.Empty;
                        if (pre != null)
                        {
                            File.Move(pre, Path.Combine(work, "bg.jpg"));
                            pre = null;
                            input = "-i bg.jpg";
                        }
                        else if (!string.IsNullOrEmpty(fallbackColor))
                        {
                            DiscoverDiagnostics.Add("mapplaatje '" + text + "': effen achtergrond gebruikt");
                            input = "-f lavfi -i color=c=0x" + fallbackColor.TrimStart('#') + ":s=" + tw + "x" + th + ":d=1";
                        }
                        else
                        {
                            DiscoverDiagnostics.Add("mapplaatje '" + text + "': achtergrond niet opgehaald (plaatje zonder tekst gebruikt)");
                            return null;
                        }
                        CopyResource("Poppins-Bold.ttf", Path.Combine(work, "bold.ttf"));
                        File.WriteAllText(Path.Combine(work, "text.txt"), text, new UTF8Encoding(false));

                        // Lettergrootte: zo groot mogelijk (max 120), maar de tekst blijft binnen 81% van de breedte (1040 px van de 1280).
                        // Bij meerdere regels (\n in de tekst) telt de breedste regel.
                        int size = 120;
                        double textWidth = 0;
                        foreach (var line in text.Split('\n')) textWidth = Math.Max(textWidth, RequestCard.Measure(line, size, true));
                        double maxWidth = tw * 1040.0 / W;
                        if (textWidth > maxWidth) size = (int)Math.Floor(size * maxWidth / textWidth);

                        // Eerst de volledige opmaak (donkerder, schaduw); werkt die niet in jouw ffmpeg, dan een eenvoudiger versie.
                        var scaleCrop = "scale=" + tw + ":" + th + ":force_original_aspect_ratio=increase,crop=" + tw + ":" + th;
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
                                var args = "-y -hide_banner -loglevel error " + input + " -filter_complex \"" + variants[v] +
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

                    return final;
                }
                finally { Gate.Release(); }
                }
                finally { if (pre != null) { try { File.Delete(pre); } catch { } } }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("mapplaatje '" + text + "' mislukt: " + ex.Message + " (plaatje zonder tekst gebruikt)");
                return null;
            }
        }

        /// <summary>
        /// Staande tegel (720x1080) voor "Alle seizoenen": het midden van een liggende achtergrondfoto van de serie, naar onderen
        /// donkerder, met het logo van de serie (of de naam als tekst), een geel lijntje, het label en het aantal seizoenen.
        /// Zo lijkt hij nooit op een seizoensposter. Null als het niet lukt (geen ffmpeg, geen achtergrond, ...).
        /// </summary>
        public static async Task<string> CreateAllSeasons(string key, string backdropUrl, string logoUrl, string name, string label, string sub, CancellationToken ct, bool allowStale = true)
        {
            const int tw = 720, th = 1080;
            try
            {
                if (string.IsNullOrEmpty(backdropUrl) || string.IsNullOrEmpty(label)) return null;
                var ffmpeg = RequestCard.FindFfmpeg();
                if (ffmpeg == null) return null;
                var dir = Plugin.Instance.WorkDir("discover-tiles");
                var final = Path.Combine(dir, string.Format("alls-{0}-{1}-v{2}.jpg", key, Hash(backdropUrl + "|" + logoUrl + "|" + name + "|" + label + "|" + sub), TileVersion));
                if (File.Exists(final) && new FileInfo(final).Length > 0) { CacheCleaner.Touch(final); return final; }
                if (allowStale)
                {
                    var stale = FindStale(dir, "alls-" + key + "-????????-v" + TileVersion + ".jpg", final);
                    if (stale != null)
                    {
                        RebuildInBackground(final, () => CreateAllSeasons(key, backdropUrl, logoUrl, name, label, sub, CancellationToken.None, false));
                        return stale;
                    }
                }

                var bgPre = await PreDownload(backdropUrl, dir, ".jpg", ct).ConfigureAwait(false);
                if (bgPre == null) return null;
                string logoPre = string.IsNullOrEmpty(logoUrl) ? null : await PreDownload(logoUrl, dir, ".png", ct).ConfigureAwait(false);
                try
                {
                    await Gate.WaitAsync(ct).ConfigureAwait(false);
                    try
                    {
                        if (File.Exists(final) && new FileInfo(final).Length > 0) return final;
                        var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                        Directory.CreateDirectory(work);
                        try
                        {
                            File.Move(bgPre, Path.Combine(work, "bg.jpg")); bgPre = null;
                            bool hasLogo = false;
                            if (logoPre != null) { File.Move(logoPre, Path.Combine(work, "logo.png")); logoPre = null; hasLogo = true; }
                            CopyResource("Poppins-Bold.ttf", Path.Combine(work, "bold.ttf"));
                            CopyResource("Poppins-Regular.ttf", Path.Combine(work, "reg.ttf"));
                            File.WriteAllText(Path.Combine(work, "label.txt"), label, new UTF8Encoding(false));
                            File.WriteAllText(Path.Combine(work, "sub.txt"), sub ?? "", new UTF8Encoding(false));

                            int labelSize = 76;
                            double lw = RequestCard.Measure(label, labelSize, true);
                            if (lw > tw * 0.86) labelSize = (int)Math.Floor(labelSize * tw * 0.86 / lw);

                            // Achtergrond: midden uitsnijden, iets donkerder; daaronder een verloop naar bijna zwart.
                            var chain = "[0:v]scale=" + tw + ":" + th + ":force_original_aspect_ratio=increase,crop=" + tw + ":" + th +
                                        ",colorchannelmixer=rr=0.8:gg=0.8:bb=0.8,format=rgba[bg];" +
                                        "color=c=black:s=" + tw + "x" + th + ":d=1,format=rgba,geq=r=8:g=12:b=24:a='if(gt(Y,H*0.3),min(235,30+205*pow((Y-H*0.3)/(H*0.7),1.1)),30)'[gr];" +
                                        "[bg][gr]overlay=0:0[b0];";
                            string last = "b0";
                            if (hasLogo)
                            {
                                chain += "[1:v]format=rgba,scale=" + (int)(tw * 0.8) + ":" + (int)(th * 0.2) + ":force_original_aspect_ratio=decrease[lg];" +
                                         "[b0][lg]overlay=x=(W-w)/2:y=" + (int)(th * 0.63) + "-h/2[b1];";
                                last = "b1";
                            }
                            else
                            {
                                var nm = string.IsNullOrWhiteSpace(name) ? label : name.Trim();
                                File.WriteAllText(Path.Combine(work, "name.txt"), nm, new UTF8Encoding(false));
                                int ns = 84;
                                double nw = RequestCard.Measure(nm, ns, true);
                                if (nw > tw * 0.86) ns = Math.Max(40, (int)Math.Floor(ns * tw * 0.86 / nw));
                                chain += "[b0]drawtext=fontfile=bold.ttf:textfile=name.txt:expansion=none:fontsize=" + ns +
                                         ":fontcolor=white:x=(w-text_w)/2:y=" + (int)(th * 0.63) + "-text_h/2:shadowcolor=black@0.7:shadowx=3:shadowy=3[b1];";
                                last = "b1";
                            }
                            chain += "[" + last + "]drawbox=x=" + (int)(tw * 0.2) + ":y=" + (int)(th * 0.75) + ":w=" + (int)(tw * 0.6) + ":h=4:color=0xFFC83C@1:t=fill," +
                                     "drawtext=fontfile=bold.ttf:textfile=label.txt:expansion=none:fontsize=" + labelSize +
                                     ":fontcolor=white:x=(w-text_w)/2:y=" + (int)(th * 0.775) + ":shadowcolor=black@0.6:shadowx=3:shadowy=3";
                            if (!string.IsNullOrEmpty(sub))
                                chain += ",drawtext=fontfile=reg.ttf:textfile=sub.txt:expansion=none:fontsize=40:fontcolor=0xFFC83C:x=(w-text_w)/2:y=" + (int)(th * 0.775 + labelSize * 1.25);
                            chain += ",format=yuvj420p[v]";
                            var args = "-y -hide_banner -loglevel error -i bg.jpg" + (hasLogo ? " -i logo.png" : "") +
                                       " -filter_complex \"" + chain + "\" -map [v] -frames:v 1 -q:v 3 out.jpg";
                            await RunFfmpeg(ffmpeg, work, args).ConfigureAwait(false);
                            var made = Path.Combine(work, "out.jpg");
                            if (!File.Exists(made) || new FileInfo(made).Length == 0) throw new InvalidOperationException("ffmpeg maakte geen bestand");
                            if (File.Exists(final)) File.Delete(final);
                            File.Move(made, final);
                            DiscoverDiagnostics.Add("tegel 'alle seizoenen' gemaakt: " + final);
                        }
                        finally { try { Directory.Delete(work, true); } catch { } }
                        return final;
                    }
                    finally { Gate.Release(); }
                }
                finally
                {
                    if (bgPre != null) { try { File.Delete(bgPre); } catch { } }
                    if (logoPre != null) { try { File.Delete(logoPre); } catch { } }
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("tegel 'alle seizoenen' mislukt: " + ex.Message);
                return null;
            }
        }

        /// <summary>
        /// Zet een studio- of netwerklogo (al in kleur gezet door TMDB) in het midden van een liggend, doorzichtig plaatje
        /// van 1280x720, met de tegelnaam onder het logo. Geeft het pad van het PNG-bestand, of null als het niet lukt
        /// (dan gebruikt het kanaal het logo zoals het is).
        /// </summary>
        public static async Task<string> CreateLogo(string key, string logoUrl, string text, CancellationToken ct, bool allowStale = true)
        {
            try
            {
                if (string.IsNullOrEmpty(logoUrl) || string.IsNullOrEmpty(text)) return null;

                var ffmpeg = RequestCard.FindFfmpeg();
                if (ffmpeg == null) return null;

                bool addText = Plugin.GetCurrentConfiguration().TileTextImages;
                var dir = Plugin.Instance.WorkDir("discover-tiles");
                var final = Path.Combine(dir, string.Format("logo-{0}-{1}-v{2}.png", key, Hash((addText ? text : "") + "|" + logoUrl), TileVersion));
                if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                if (allowStale)
                {
                    var stale = FindStale(dir, "logo-" + key + "-????????-v" + TileVersion + ".png", final);
                    if (stale != null)
                    {
                        RebuildInBackground(final, () => CreateLogo(key, logoUrl, text, CancellationToken.None, false));
                        return stale;
                    }
                }

                var pre = await PreDownload(logoUrl, dir, ".png", ct).ConfigureAwait(false);
                if (pre == null) return null;
                try
                {
                await Gate.WaitAsync(ct).ConfigureAwait(false);
                try
                {
                    if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                    var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                    Directory.CreateDirectory(work);
                    try
                    {
                        File.Move(pre, Path.Combine(work, "logo.png"));
                        pre = null;

                        // Passend maken binnen 1000x400 (met ruime marge rondom) op een doorzichtig vlak van 1280x720.
                        var args = "-y -hide_banner -loglevel error -i logo.png -vf \"format=rgba,scale=1000:400:force_original_aspect_ratio=decrease," +
                                   "pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2:color=black@0";
                        if (addText)
                        {
                            CopyResource("Poppins-Bold.ttf", Path.Combine(work, "bold.ttf"));
                            File.WriteAllText(Path.Combine(work, "text.txt"), text, new UTF8Encoding(false));
                            int size = 72;
                            double width = RequestCard.Measure(text, size, true);
                            if (width > 1080) size = (int)Math.Floor(size * 1080 / width);
                            args += ",drawtext=fontfile=bold.ttf:textfile=text.txt:expansion=none:fontsize=" + size +
                                    ":fontcolor=white:x=(w-text_w)/2:y=h-text_h-48:shadowcolor=black@0.8:shadowx=3:shadowy=3";
                        }
                        args += "\" -frames:v 1 out.png";
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

                    return final;
                }
                finally { Gate.Release(); }
                }
                finally { if (pre != null) { try { File.Delete(pre); } catch { } } }
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
