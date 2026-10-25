using System;
using System.Collections.Generic;
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
    /// Maakt per aanvraag een bevestigingsclip van <see cref="Seconds"/> seconden: een grote poster met daaronder groot
    /// de status (Aangevraagd / Staat al in ...) en wat is aangevraagd (Film, Serie of Seizoen N). Bewust weinig tekst,
    /// zodat het ook op een tv of telefoon leesbaar blijft (gewone ffmpeg-aanroep, lettertype zit in de DLL).
    /// Lukt iets niet (geen ffmpeg, geen schrijfrechten, ...), dan gooit Create een exception en speelt
    /// het kanaal de vaste clip, zoals voorheen.
    /// </summary>
    internal static class RequestCard
    {
        public const int Seconds = 12;

        // Ophogen als de opmaak verandert, dan worden bewaarde clips niet meer hergebruikt.
        private const int CardVersion = 6;

        private const int W = 720;
        private const int H = 1080;

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        // Maximaal twee ffmpeg's tegelijk (een Pi of NAS wordt anders traag). Een kaart die iemand nu nodig heeft
        // (Afspelen / detailpagina) hoeft alleen op een van die twee plekken te wachten. Kaarten die op de achtergrond
        // vooraf gemaakt worden gebruiken er hooguit een, via BackgroundGate. Zo staat een kaart die nu nodig is nooit
        // achter een rij voorbereide kaarten (dat gaf een time-out en dus de vaste clip zonder info).
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(2, 2);
        private static readonly SemaphoreSlim BackgroundGate = new SemaphoreSlim(1, 1);
        // Kaarten die al worden gemaakt, zodat twee aanroepen voor dezelfde kaart niet dubbel renderen.
        private static readonly object InFlightLock = new object();
        private static readonly Dictionary<string, Task<string>> InFlightNow = new Dictionary<string, Task<string>>();
        private static readonly Dictionary<string, Task<string>> InFlightBackground = new Dictionary<string, Task<string>>();

        /// <summary>Geeft het pad van de clip voor deze titel (uit de bewaarde clips of net gemaakt).
        /// background=true: vooraf maken op de achtergrond (wacht op een vrije plek en houdt een kaart die nu nodig is niet op).</summary>
        public static async Task<string> Create(TmdbItem t, TmdbExtra x, bool tv, bool alreadyThere, CancellationToken ct, int season = 0, string posterPath = null, bool background = false)
        {
            var ffmpeg = FindFfmpeg();
            if (ffmpeg == null)
                throw new InvalidOperationException(
                    "ffmpeg niet gevonden; zet FfmpegPath in Emby.Plugins.Discover.xml");

            var dir = Plugin.Instance.WorkDir("discover-cards");
            var final = Path.Combine(dir, string.Format("card-{0}{1}-s{2}-{3}-v{4}.mp4",
                tv ? "t" : "m", t.id, season, alreadyThere ? "dup" : "new", CardVersion));
            if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

            Task<string> task;
            Dictionary<string, Task<string>> own = background ? InFlightBackground : InFlightNow;
            lock (InFlightLock)
            {
                if (!InFlightNow.TryGetValue(final, out task) && (!background || !InFlightBackground.TryGetValue(final, out task)))
                {
                    task = Build(ffmpeg, dir, final, t, tv, alreadyThere, season, posterPath, background);
                    own[final] = task;
                }
            }
            try { return await task.ConfigureAwait(false); }
            finally
            {
                lock (InFlightLock)
                {
                    Task<string> cur;
                    if (task.IsCompleted && own.TryGetValue(final, out cur) && ReferenceEquals(cur, task)) own.Remove(final);
                }
            }
        }

        private static async Task<string> Build(string ffmpeg, string dir, string final, TmdbItem t, bool tv, bool alreadyThere, int season, string posterPath, bool background)
        {
            if (background) await BackgroundGate.WaitAsync().ConfigureAwait(false);
            try
            {
                await Gate.WaitAsync().ConfigureAwait(false);
                try
                {
                    if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                    var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                    Directory.CreateDirectory(work);
                    try
                    {
                        await Render(ffmpeg, work, t, tv, alreadyThere, season, posterPath, CancellationToken.None).ConfigureAwait(false);
                        var made = Path.Combine(work, "out.mp4");
                        if (!File.Exists(made) || new FileInfo(made).Length == 0)
                            throw new InvalidOperationException("ffmpeg maakte geen bestand");
                        if (File.Exists(final)) File.Delete(final);
                        File.Move(made, final);
                    }
                    finally
                    {
                        try { Directory.Delete(work, true); } catch { }
                    }

                    // Oude clips opruimen (60 dagen).
                    try
                    {
                        foreach (var f in Directory.GetFiles(dir, "card-*.mp4"))
                            if (File.GetLastWriteTimeUtc(f) < DateTime.UtcNow.AddDays(-60)) File.Delete(f);
                    }
                    catch { }
                    return final;
                }
                finally { Gate.Release(); }
            }
            finally { if (background) BackgroundGate.Release(); }
        }

        private const int PX = 100, PY = 44, PW = 520, PH = 780;   // poster (2:3), groot
        private const int PadShadow = 36;

        private static async Task Render(string ffmpeg, string work, TmdbItem t, bool tv, bool alreadyThere, int season, string posterPath, CancellationToken ct)
        {
            CopyResource("Poppins-Bold.ttf", Path.Combine(work, "bold.ttf"));
            CopyResource("Poppins-Regular.ttf", Path.Combine(work, "regular.ttf"));
            CopyResource("card-grad.png", Path.Combine(work, "grad.png"));

            // Poster en achtergrond tegelijk ophalen. Bij een seizoen de seizoensposter als die er is, anders de serieposter.
            string posterFile = Path.Combine(work, "poster.jpg");
            string bdUrl = string.IsNullOrEmpty(t.backdrop_path) ? null : "https://image.tmdb.org/t/p/w780" + t.backdrop_path;
            var posterTask = Download(TmdbClient.PosterUrl(string.IsNullOrEmpty(posterPath) ? t.poster_path : posterPath), posterFile, ct);
            var backdropTask = bdUrl == null ? Task.FromResult(false) : Download(bdUrl, Path.Combine(work, "backdrop.jpg"), ct);
            await Task.WhenAll(posterTask, backdropTask).ConfigureAwait(false);
            bool hasPoster = await posterTask.ConfigureAwait(false);
            if (!hasPoster && !string.IsNullOrEmpty(posterPath))
                hasPoster = await Download(TmdbClient.PosterUrl(t.poster_path), posterFile, ct).ConfigureAwait(false);
            bool hasBackdrop = await backdropTask.ConfigureAwait(false);

            // ---- Teksten: alleen status en wat is aangevraagd (groot), plus de titel als er geen poster is ----
            string arr = tv ? "Sonarr" : "Radarr";
            string title = tv ? (t.name ?? t.title ?? "?") : (t.title ?? t.name ?? "?");
            string badge = alreadyThere
                ? DiscoverLanguage.Text("Staat al in ", "Already in ", "Bereits in ") + arr
                : DiscoverLanguage.Text("Aangevraagd", "Requested", "Angefordert");
            string what = season > 0
                ? DiscoverLanguage.Text("Seizoen " + season, "Season " + season, "Staffel " + season)
                : tv
                    ? DiscoverLanguage.Text("Serie \u00B7 alle seizoenen", "Series \u00B7 all seasons", "Serie \u00B7 alle Staffeln")
                    : DiscoverLanguage.Text("Film", "Movie", "Film");
            string boxColor = alreadyThere ? "0x2F6FDB" : "0x22A559";

            if (hasPoster)
            {
                CopyResource("card-mask.png", Path.Combine(work, "mask.png"));
                CopyResource("card-shadow.png", Path.Combine(work, "shadow.png"));
            }

            WriteText(Path.Combine(work, "badge.txt"), badge);
            WriteText(Path.Combine(work, "what.txt"), what);
            WriteText(Path.Combine(work, "title.txt"), WrapPx(title, 600, 52, true, 3));

            int badgeY = hasPoster ? PY + PH + 46 : 700;
            int whatY = badgeY + 118;

            // ---- ffmpeg, stap 1: een enkel stilstaand beeld (achtergrond, poster en tekst) ----
            // Vroeger werd de zoom en blur op elk van de 120 beeldjes herhaald; dat duurde op een NAS of Pi te lang
            // (time-out, dus de vaste clip zonder poster). Nu wordt het beeld een keer gemaakt.
            var a = new StringBuilder();
            a.Append("-y -hide_banner -loglevel error ");
            int next = 0;
            Func<string, int> addImg = file =>
            {
                a.Append("-i " + file + " ");
                return next++;
            };
            int bgIdx;
            bool bgIsImage = hasBackdrop || hasPoster;
            if (hasBackdrop) bgIdx = addImg("backdrop.jpg");
            else if (hasPoster) bgIdx = addImg("poster.jpg");
            else
            {
                a.Append("-f lavfi -i color=c=0x1B2540:s=" + W + "x" + H + ":r=1 ");
                bgIdx = next++;
            }
            int gradIdx = addImg("grad.png");
            int shadowIdx = -1, posterIdx = -1, maskIdx = -1;
            if (hasPoster) { shadowIdx = addImg("shadow.png"); posterIdx = addImg("poster.jpg"); maskIdx = addImg("mask.png"); }

            var f = new StringBuilder();
            if (bgIsImage)
            {
                // Achtergrond vullen en vervagen; zonder echte achtergrond (alleen poster) extra vaag.
                f.Append("[" + bgIdx + ":v]scale=" + W + ":" + H + ":force_original_aspect_ratio=increase,crop=" + W + ":" + H + "," +
                         (hasBackdrop ? "boxblur=2:1" : "boxblur=19:3") + ",setsar=1,format=yuv420p[bg];");
            }
            else f.Append("[" + bgIdx + ":v]setsar=1,format=yuv420p[bg];");

            f.Append("[" + gradIdx + ":v]format=rgba[gr];[bg][gr]overlay=0:0:format=auto[b1];");
            string cur = "b1";
            if (hasPoster)
            {
                // Rand en schaduw zijn gemaakt voor 380x570; ze worden naar de grotere poster geschaald.
                f.Append("[" + shadowIdx + ":v]scale=" + (PW + 72) + ":" + (PH + 72) + ",format=rgba[sh];[" + cur + "][sh]overlay=" +
                         (PX - 36) + ":" + (PY - 36 + 14) + ":format=auto[b2];");
                f.Append("[" + posterIdx + ":v]scale=" + PW + ":" + PH + ":force_original_aspect_ratio=increase,crop=" + PW + ":" + PH + ",format=rgba[pp];");
                f.Append("[" + maskIdx + ":v]scale=" + PW + ":" + PH + ",format=gray[mk];[pp][mk]alphamerge[pr];");
                f.Append("[b2][pr]overlay=" + PX + ":" + PY + ":format=auto[b3];");
                cur = "b3";
            }

            f.Append("[" + cur + "]");
            if (!hasPoster)
                f.Append(DrawTextX("bold.ttf", "title.txt", 52, "white", "(w-text_w)/2", "260", ":line_spacing=6") + ",");
            f.Append(DrawTextX("bold.ttf", "badge.txt", 46, "white", "(w-text_w)/2", badgeY.ToString(),
                ":box=1:boxcolor=" + boxColor + ":boxborderw=22") + ",");
            f.Append(DrawTextX("regular.ttf", "what.txt", 44, "white", "(w-text_w)/2", whatY.ToString(), "") + ",");
            f.Append("format=rgb24[v]");

            a.Append("-filter_complex \"" + f + "\" ");
            a.Append("-map [v] -frames:v 1 frame.png");
            await RunFfmpeg(ffmpeg, work, a.ToString(), 60000).ConfigureAwait(false);
            if (!File.Exists(Path.Combine(work, "frame.png")) || new FileInfo(Path.Combine(work, "frame.png")).Length == 0)
                throw new InvalidOperationException("ffmpeg maakte het kaartbeeld niet");

            // ---- stap 2: het beeld als clip van <Seconds> seconden met in- en uitfaden ----
            var c = new StringBuilder();
            c.Append("-y -hide_banner -loglevel error ");
            c.Append("-loop 1 -framerate 10 -t " + Seconds + " -i frame.png ");
            c.Append("-f lavfi -t " + Seconds + " -i anullsrc=r=44100:cl=stereo ");
            c.Append("-vf \"fade=t=in:st=0:d=0.5,fade=t=out:st=" + (Seconds - 0.6).ToString("0.0", CultureInfo.InvariantCulture) +
                     ":d=0.6,format=yuv420p\" ");
            c.Append("-map 0:v -map 1:a ");
            c.Append("-c:v libx264 -preset veryfast -tune stillimage -crf 20 -pix_fmt yuv420p -r 10 -g 20 ");
            c.Append("-c:a aac -b:a 32k -shortest -movflags +faststart out.mp4");
            await RunFfmpeg(ffmpeg, work, c.ToString(), 90000).ConfigureAwait(false);
        }

        private static async Task RunFfmpeg(string ffmpeg, string work, string args, int timeoutMs)
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
                bool done = await Task.Run(() => p.WaitForExit(timeoutMs)).ConfigureAwait(false);
                if (!done)
                {
                    try { p.Kill(); } catch { }
                    throw new TimeoutException("ffmpeg duurde langer dan " + (timeoutMs / 1000) + " seconden");
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

        // x en y mogen een expressie zijn (bv. "(w-text_w)/2"). Geen komma's gebruiken in expressies.
        private static string DrawTextX(string font, string file, int size, string color, string x, string y, string extra)
        {
            return "drawtext=fontfile=" + font + ":textfile=" + file + ":expansion=none:fontsize=" + size +
                   ":fontcolor=" + color + ":x=" + x + ":y=" + y + extra;
        }

        // ---------- Hulpjes ----------

        private static string LengthOf(TmdbItem t, TmdbExtra x, bool tv)
        {
            if (x == null) return null;
            if (tv)
            {
                if (x.number_of_seasons > 0)
                    return x.number_of_seasons + DiscoverLanguage.Text(
                        x.number_of_seasons == 1 ? " seizoen" : " seizoenen",
                        x.number_of_seasons == 1 ? " season" : " seasons",
                        x.number_of_seasons == 1 ? " Staffel" : " Staffeln");
                return null;
            }
            if (x.runtime <= 0) return null;
            int h = x.runtime / 60, m = x.runtime % 60;
            return h > 0
                ? DiscoverLanguage.Text(
                    h + " u " + m.ToString("00", CultureInfo.InvariantCulture) + " min",
                    h + " hr " + m.ToString("00", CultureInfo.InvariantCulture) + " min",
                    h + " Std. " + m.ToString("00", CultureInfo.InvariantCulture) + " Min.")
                : DiscoverLanguage.Text(m + " min", m + " min", m + " Min.");
        }

        // Breedte per teken (in em) van Poppins, ASCII 32..126 (gemeten uit de lettertypes in de DLL).
        private static readonly double[] RegW = { 0.267, 0.298, 0.292, 0.840, 0.622, 0.759, 0.739, 0.159, 0.454, 0.454, 0.486, 0.683, 0.198, 0.551, 0.210, 0.476, 0.628, 0.320, 0.575, 0.589, 0.629, 0.628, 0.635, 0.546, 0.631, 0.630, 0.213, 0.264, 0.555, 0.723, 0.539, 0.524, 1.013, 0.674, 0.613, 0.772, 0.707, 0.513, 0.504, 0.778, 0.692, 0.246, 0.530, 0.599, 0.432, 0.861, 0.703, 0.786, 0.579, 0.788, 0.608, 0.587, 0.541, 0.675, 0.676, 0.976, 0.621, 0.584, 0.541, 0.423, 0.658, 0.423, 0.629, 0.733, 0.257, 0.676, 0.676, 0.607, 0.676, 0.620, 0.329, 0.676, 0.640, 0.246, 0.248, 0.515, 0.246, 1.030, 0.640, 0.640, 0.676, 0.676, 0.373, 0.522, 0.364, 0.640, 0.561, 0.820, 0.479, 0.563, 0.455, 0.462, 0.291, 0.462, 0.519 };
        private static readonly double[] BoldW = { 0.212, 0.392, 0.411, 0.904, 0.658, 0.870, 0.798, 0.221, 0.477, 0.477, 0.534, 0.628, 0.287, 0.580, 0.282, 0.453, 0.652, 0.376, 0.571, 0.605, 0.677, 0.650, 0.637, 0.535, 0.648, 0.615, 0.284, 0.347, 0.551, 0.696, 0.541, 0.538, 1.080, 0.737, 0.659, 0.762, 0.727, 0.541, 0.547, 0.762, 0.731, 0.295, 0.578, 0.697, 0.477, 0.918, 0.752, 0.786, 0.624, 0.788, 0.652, 0.615, 0.591, 0.705, 0.730, 1.052, 0.715, 0.671, 0.596, 0.510, 0.802, 0.510, 0.709, 0.780, 0.291, 0.679, 0.679, 0.605, 0.679, 0.616, 0.360, 0.679, 0.674, 0.295, 0.294, 0.618, 0.295, 1.059, 0.674, 0.637, 0.679, 0.679, 0.428, 0.558, 0.406, 0.674, 0.626, 0.866, 0.588, 0.632, 0.496, 0.499, 0.291, 0.499, 0.636 };

        /// <summary>Breedte in pixels van een tekst in Poppins (zonder kerning; accenten worden geschat).</summary>
        internal static double Measure(string text, double size, bool bold)
        {
            if (string.IsNullOrEmpty(text)) return 0;
            var tab = bold ? BoldW : RegW;
            double em = 0;
            foreach (var ch in text)
                em += ch >= 32 && ch <= 126 ? tab[ch - 32] : (bold ? 0.62 : 0.58);
            return em * size;
        }

        /// <summary>Breekt tekst op woordgrenzen af op basis van de echte tekstbreedte (ffmpeg doet dat zelf niet).
        /// Te lang? Dan eindigt de laatste regel op "...".</summary>
        internal static string WrapPx(string text, int maxPx, double size, bool bold, int maxLines)
        {
            var lines = new List<string>();
            var cur = new StringBuilder();
            bool truncated = false;
            var words = (text ?? "").Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var w0 in words)
            {
                var w = w0;
                while (Measure(w, size, bold) > maxPx && w.Length > 1)
                {
                    int n = w.Length;
                    while (n > 1 && Measure(w.Substring(0, n), size, bold) > maxPx) n--;
                    if (cur.Length > 0) { lines.Add(cur.ToString()); cur.Clear(); }
                    lines.Add(w.Substring(0, n));
                    w = w.Substring(n);
                }
                if (cur.Length == 0) cur.Append(w);
                else if (Measure(cur + " " + w, size, bold) <= maxPx) cur.Append(' ').Append(w);
                else { lines.Add(cur.ToString()); cur.Clear(); cur.Append(w); }
            }
            if (cur.Length > 0) lines.Add(cur.ToString());

            if (lines.Count > maxLines)
            {
                truncated = true;
                lines = lines.GetRange(0, maxLines);
            }
            if (truncated)
            {
                var last = lines[lines.Count - 1];
                while (last.Length > 1 && Measure(last + "...", size, bold) > maxPx) last = last.Substring(0, last.Length - 1);
                lines[lines.Count - 1] = last.TrimEnd(' ', ',', '.', ';', ':') + "...";
            }
            return string.Join("\n", lines);
        }

        private static void WriteText(string path, string text)
        {
            // UTF-8 zonder BOM, zonder afsluitende regelovergang.
            File.WriteAllText(path, text ?? "", new UTF8Encoding(false));
        }

        private static void CopyResource(string name, string target)
        {
            var asm = typeof(RequestCard).Assembly;
            using (var src = asm.GetManifestResourceStream(typeof(RequestCard).Namespace + ".Resources." + name))
            {
                if (src == null) throw new InvalidOperationException("Lettertype ontbreekt in de DLL: " + name);
                using (var dst = File.Create(target)) { src.CopyTo(dst); }
            }
        }

        private static async Task<bool> Download(string url, string path, CancellationToken ct)
        {
            if (string.IsNullOrEmpty(url)) return false;
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
                DiscoverDiagnostics.Add("afbeelding voor kaartclip niet opgehaald: " + ex.Message);
                return false;
            }
        }

        internal static string FindFfmpeg()
        {
            var configured = Plugin.GetCurrentConfiguration().FfmpegPath;
            if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured.Trim())) return configured.Trim();

            bool win = Environment.OSVersion.Platform == PlatformID.Win32NT;
            string exe = win ? "ffmpeg.exe" : "ffmpeg";

            var dirs = new List<string>();
            try
            {
                var b = AppContext.BaseDirectory;
                if (!string.IsNullOrEmpty(b))
                {
                    dirs.Add(b);
                    dirs.Add(Path.Combine(b, "bin"));
                    dirs.Add(Path.Combine(b, "ffmpeg"));
                    var parent = Directory.GetParent(b.TrimEnd(Path.DirectorySeparatorChar, '/'));
                    if (parent != null) { dirs.Add(parent.FullName); dirs.Add(Path.Combine(parent.FullName, "bin")); }
                }
            }
            catch { }
            dirs.AddRange(new[]
            {
                "/opt/emby-server/bin", "/usr/lib/emby-server/bin", "/app/emby/bin", "/system",
                "/bin", "/usr/bin", "/usr/local/bin", "/usr/lib/jellyfin-ffmpeg"
            });
            try
            {
                var path = Environment.GetEnvironmentVariable("PATH");
                if (!string.IsNullOrEmpty(path)) dirs.AddRange(path.Split(Path.PathSeparator));
            }
            catch { }

            foreach (var d in dirs)
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(d)) continue;
                    var candidate = Path.Combine(d.Trim(), exe);
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }
            return null;
        }
    }
}
