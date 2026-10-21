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
    /// Maakt per titel een bevestigingsclip van <see cref="Seconds"/> seconden met poster, titel, jaar,
    /// beoordeling en beschrijving (gewone ffmpeg-aanroep, lettertype zit in de DLL).
    /// Lukt iets niet (geen ffmpeg, geen schrijfrechten, ...), dan gooit Create een exception en speelt
    /// het kanaal de vaste clip, zoals voorheen.
    /// </summary>
    internal static class RequestCard
    {
        public const int Seconds = 12;

        // Ophogen als de opmaak verandert, dan worden bewaarde clips niet meer hergebruikt.
        private const int CardVersion = 2;

        private const int W = 1280;
        private const int H = 720;

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        // Eén ffmpeg tegelijk: een Pi of NAS wordt anders traag bij meerdere aanvragen.
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(1, 1);

        /// <summary>Geeft het pad van de clip voor deze titel (uit de bewaarde clips of net gemaakt).</summary>
        public static async Task<string> Create(TmdbItem t, TmdbExtra x, bool tv, bool alreadyThere, CancellationToken ct)
        {
            var ffmpeg = FindFfmpeg();
            if (ffmpeg == null)
                throw new InvalidOperationException(
                    "ffmpeg niet gevonden; zet FfmpegPath in Emby.Plugins.Discover.xml");

            var dir = Plugin.Instance.WorkDir("discover-cards");
            var final = Path.Combine(dir, string.Format("card-{0}{1}-{2}-v{3}.mp4",
                tv ? "t" : "m", t.id, alreadyThere ? "dup" : "new", CardVersion));
            if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

            await Gate.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                if (File.Exists(final) && new FileInfo(final).Length > 0) return final;

                var work = Path.Combine(dir, "w-" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(work);
                try
                {
                    await Render(ffmpeg, work, t, x, tv, alreadyThere, ct).ConfigureAwait(false);
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

        private const int PX = 80, PY = 105, PW = 340, PH = 510;   // poster
        private const int PadShadow = 60;

        private static async Task Render(string ffmpeg, string work, TmdbItem t, TmdbExtra x, bool tv, bool alreadyThere, CancellationToken ct)
        {
            CopyResource("Poppins-Bold.ttf", Path.Combine(work, "bold.ttf"));
            CopyResource("Poppins-Regular.ttf", Path.Combine(work, "regular.ttf"));
            CopyResource("card-grad.png", Path.Combine(work, "grad.png"));

            bool hasPoster = await Download(TmdbClient.PosterUrl(t.poster_path), Path.Combine(work, "poster.jpg"), ct).ConfigureAwait(false);
            string bdUrl = string.IsNullOrEmpty(t.backdrop_path) ? null : "https://image.tmdb.org/t/p/w780" + t.backdrop_path;
            bool hasBackdrop = bdUrl != null &&
                await Download(bdUrl, Path.Combine(work, "backdrop.jpg"), ct).ConfigureAwait(false);

            // ---- Teksten ----
            string arr = tv ? "Sonarr" : "Radarr";
            string title = tv ? (t.name ?? t.title ?? "?") : (t.title ?? t.name ?? "?");
            var date = tv ? t.first_air_date : t.release_date;

            var meta = new List<string>();
            if (!string.IsNullOrEmpty(date) && date.Length >= 4) meta.Add(date.Substring(0, 4));
            meta.Add(tv ? "Serie" : "Film");
            string length = LengthOf(t, x, tv);
            if (length != null) meta.Add(length);
            bool hasRating = t.vote_average > 0;
            string rating = hasRating ? t.vote_average.ToString("0.0", CultureInfo.InvariantCulture).Replace('.', ',') : null;
            if (hasRating) meta.Insert(0, rating);

            var genres = new List<string>();
            if (x != null && x.genres != null)
                foreach (var g in x.genres) if (!string.IsNullOrWhiteSpace(g.name) && genres.Count < 4) genres.Add(g.name.Trim());

            string overviewRaw = (t.overview ?? "").Replace("\r", " ").Replace("\n", " ").Trim();
            if (overviewRaw.Length == 0 && x != null && !string.IsNullOrWhiteSpace(x.tagline)) overviewRaw = x.tagline.Trim();

            // Regie / maker en cast: echte inhoud van de titel, ook als er geen beschrijving is.
            var credits = new List<KeyValuePair<string, string>>();
            if (x != null)
            {
                var makers = new List<string>();
                if (tv)
                {
                    if (x.created_by != null) foreach (var c in x.created_by) if (!string.IsNullOrWhiteSpace(c.name) && makers.Count < 2) makers.Add(c.name);
                }
                else if (x.credits != null && x.credits.crew != null)
                {
                    foreach (var c in x.credits.crew)
                        if (c.job == "Director" && !string.IsNullOrWhiteSpace(c.name) && !makers.Contains(c.name) && makers.Count < 2) makers.Add(c.name);
                }
                if (makers.Count > 0) credits.Add(new KeyValuePair<string, string>(tv ? "MAKER" : "REGIE", string.Join(", ", makers)));
                var cast = new List<string>();
                if (x.credits != null && x.credits.cast != null)
                    foreach (var c in x.credits.cast) if (!string.IsNullOrWhiteSpace(c.name) && cast.Count < 5) cast.Add(c.name);
                if (cast.Count > 0) credits.Add(new KeyValuePair<string, string>("CAST", string.Join(", ", cast)));
            }

            string badge = alreadyThere ? "Staat al in " + arr : "Aangevraagd";
            string pillFile = alreadyThere ? (tv ? "card-pill-dup-sonarr.png" : "card-pill-dup-radarr.png") : "card-pill-new.png";
            string sub = alreadyThere
                ? "Er is niets dubbel aangevraagd."
                : "Zodra de download klaar is, staat hij in je bibliotheek.";
            CopyResource(pillFile, Path.Combine(work, "pill.png"));
            if (hasPoster)
            {
                CopyResource("card-mask.png", Path.Combine(work, "mask.png"));
                CopyResource("card-shadow.png", Path.Combine(work, "shadow.png"));
            }
            if (hasRating) CopyResource("card-star.png", Path.Combine(work, "star.png"));

            // ---- Opmaak (pixels op 1280x720) ----
            int textX = hasPoster ? 480 : 90;
            int textW = W - textX - 80;
            var titleLines = WrapPx(title, textW, 54, true, 2);
            int titleLineCount = titleLines.Split('\n').Length;

            int pillY = titleLineCount == 1 ? 96 : 70;
            int titleY = pillY + 56 + 26;
            int metaY = titleY + titleLineCount * 74 + 8;
            int genreY = metaY + 46;
            int y = genreY + (genres.Count > 0 ? 58 : 6);

            int creditRows = credits.Count;
            int subY = 662;
            int creditsBlock = creditRows * 40 + (creditRows > 0 ? 18 : 0);
            int overviewBottom = subY - 26 - creditsBlock;
            int overviewMax = Math.Max(0, (overviewBottom - y) / 41);
            if (overviewMax < 2 && creditRows > 1) { credits.RemoveAt(credits.Count - 1); creditRows--; creditsBlock = 58; overviewBottom = subY - 26 - creditsBlock; overviewMax = Math.Max(0, (overviewBottom - y) / 41); }
            string overview = overviewMax > 0 && overviewRaw.Length > 0
                ? WrapPx(overviewRaw, textW, 25, false, Math.Min(overviewMax, 6)) : "";
            int overviewLines = overview.Length == 0 ? 0 : overview.Split('\n').Length;
            int creditsY = y + overviewLines * 41 + (overviewLines > 0 ? 20 : 0);

            WriteText(Path.Combine(work, "title.txt"), titleLines);
            WriteText(Path.Combine(work, "meta.txt"), string.Join("   ·   ", meta.GetRange(hasRating ? 1 : 0, meta.Count - (hasRating ? 1 : 0)).ToArray()));
            WriteText(Path.Combine(work, "rating.txt"), rating ?? "");
            WriteText(Path.Combine(work, "genres.txt"), string.Join("   ·   ", genres.ToArray()));
            WriteText(Path.Combine(work, "overview.txt"), overview);
            WriteText(Path.Combine(work, "badge.txt"), badge);
            WriteText(Path.Combine(work, "sub.txt"), sub);

            // ---- ffmpeg ----
            var a = new StringBuilder();
            a.Append("-y -hide_banner -loglevel error ");
            int next = 0;
            Func<string, int> addImg = file =>
            {
                a.Append("-loop 1 -framerate 10 -t " + Seconds + " -i " + file + " ");
                return next++;
            };
            int bgIdx;
            bool bgIsImage = hasBackdrop || hasPoster;
            if (hasBackdrop) bgIdx = addImg("backdrop.jpg");
            else if (hasPoster) bgIdx = addImg("poster.jpg");
            else
            {
                a.Append("-f lavfi -t " + Seconds + " -i color=c=0x1B2540:s=" + W + "x" + H + ":r=10 ");
                bgIdx = next++;
            }
            int gradIdx = addImg("grad.png");
            int shadowIdx = -1, posterIdx = -1, maskIdx = -1, starIdx = -1;
            if (hasPoster) { shadowIdx = addImg("shadow.png"); posterIdx = addImg("poster.jpg"); maskIdx = addImg("mask.png"); }
            if (hasRating) starIdx = addImg("star.png");
            int pillIdx = addImg("pill.png");
            a.Append("-f lavfi -t " + Seconds + " -i anullsrc=r=44100:cl=stereo ");
            int audioIdx = next++;

            var f = new StringBuilder();
            if (bgIsImage)
            {
                // Rustige zoom (Ken Burns) op de achtergrond; zonder echte achtergrond (alleen poster) extra vaag.
                f.Append("[" + bgIdx + ":v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080," +
                         "zoompan=z='1+0.0005*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=" + W + "x" + H + ":fps=10," +
                         (hasBackdrop ? "boxblur=3:1" : "boxblur=28:3") + ",setsar=1,format=yuv420p[bg];");
            }
            else f.Append("[" + bgIdx + ":v]setsar=1,format=yuv420p[bg];");

            f.Append("[" + gradIdx + ":v]format=rgba[gr];[bg][gr]overlay=0:0:format=auto[b1];");
            string cur = "b1";
            if (hasPoster)
            {
                f.Append("[" + shadowIdx + ":v]format=rgba[sh];[" + cur + "][sh]overlay=" + (PX - PadShadow) + ":" + (PY - PadShadow + 14) + ":format=auto[b2];");
                f.Append("[" + posterIdx + ":v]scale=" + PW + ":" + PH + ":force_original_aspect_ratio=increase,crop=" + PW + ":" + PH + ",format=rgba[pp];");
                f.Append("[" + maskIdx + ":v]format=gray[mk];[pp][mk]alphamerge[pr];");
                f.Append("[b2][pr]overlay=" + PX + ":" + PY + ":format=auto[b3];");
                cur = "b3";
            }
            if (hasRating)
            {
                f.Append("[" + starIdx + ":v]format=rgba[sr];[" + cur + "][sr]overlay=" + textX + ":" + (metaY + 5) + ":format=auto[b4];");
                cur = "b4";
            }
            f.Append("[" + pillIdx + ":v]format=rgba[pl];[" + cur + "][pl]overlay=" + textX + ":" + pillY + ":format=auto[b5];");

            f.Append("[b5]");
            f.Append(DrawText("bold.ttf", "badge.txt", 26, "white", textX + 58, pillY + "+(56-text_h)/2", 0) + ",");
            f.Append(DrawText("bold.ttf", "title.txt", 54, "white", textX, titleY.ToString(), 4) + ",");
            int metaTextX = hasRating ? textX + 36 : textX;
            if (hasRating)
            {
                f.Append(DrawText("bold.ttf", "rating.txt", 28, "0xFFC24B", metaTextX, metaY.ToString(), 0) + ",");
                metaTextX += (int)Math.Round(Measure(rating, 28, true)) + 26;
            }
            f.Append(DrawText("regular.ttf", "meta.txt", 28, "0xE3E8F5", metaTextX, metaY.ToString(), 0) + ",");
            if (genres.Count > 0)
                f.Append(DrawText("regular.ttf", "genres.txt", 24, "0xFFD27A", textX, genreY.ToString(), 0) + ",");
            if (overview.Length > 0)
                f.Append(DrawText("regular.ttf", "overview.txt", 25, "white@0.92", textX, y.ToString(), 5) + ",");
            for (int i = 0; i < credits.Count; i++)
            {
                string lf = "clabel" + i + ".txt", vf = "cvalue" + i + ".txt";
                WriteText(Path.Combine(work, lf), credits[i].Key);
                WriteText(Path.Combine(work, vf), WrapPx(credits[i].Value, textW - 120, 22, false, 1));
                int cy = creditsY + i * 40;
                f.Append(DrawText("bold.ttf", lf, 18, "0xFFD27A", textX, (cy + 3).ToString(), 0) + ",");
                f.Append(DrawText("regular.ttf", vf, 22, "0xE3E8F5", textX + 120, cy.ToString(), 0) + ",");
            }
            f.Append(DrawText("regular.ttf", "sub.txt", 21, "0xAEB6CC", textX, subY.ToString(), 0) + ",");
            f.Append("fade=t=in:st=0:d=0.5,fade=t=out:st=" + (Seconds - 0.6).ToString("0.0", CultureInfo.InvariantCulture) + ":d=0.6,format=yuv420p");
            f.Append("[v]");

            a.Append("-filter_complex \"" + f + "\" ");
            a.Append("-map [v] -map " + audioIdx + ":a ");
            a.Append("-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 10 -g 20 ");
            a.Append("-c:a aac -b:a 32k -shortest -movflags +faststart out.mp4");

            var psi = new ProcessStartInfo
            {
                FileName = ffmpeg,
                Arguments = a.ToString(),
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
                bool done = await Task.Run(() => p.WaitForExit(90000)).ConfigureAwait(false);
                if (!done)
                {
                    try { p.Kill(); } catch { }
                    throw new TimeoutException("ffmpeg duurde langer dan 90 seconden");
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

        // x en y mogen een expressie zijn (bv. "96+(56-text_h)/2"). Geen komma's gebruiken in expressies.
        private static string DrawText(string font, string file, int size, string color, int x, string y, int spacing)
        {
            return "drawtext=fontfile=" + font + ":textfile=" + file + ":expansion=none:fontsize=" + size +
                   ":fontcolor=" + color + ":x=" + x + ":y=" + y + ":line_spacing=" + spacing;
        }

        // ---------- Hulpjes ----------

        private static string LengthOf(TmdbItem t, TmdbExtra x, bool tv)
        {
            if (x == null) return null;
            if (tv)
            {
                if (x.number_of_seasons > 0)
                    return x.number_of_seasons + (x.number_of_seasons == 1 ? " seizoen" : " seizoenen");
                return null;
            }
            if (x.runtime <= 0) return null;
            int h = x.runtime / 60, m = x.runtime % 60;
            return h > 0 ? h + " u " + m.ToString("00", CultureInfo.InvariantCulture) + " min" : m + " min";
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
