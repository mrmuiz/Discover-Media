using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// De "titel van het moment" voor de kanaaltegel: een trending titel die per uur wisselt (afwisselend film/serie).
    /// Kanaalachtergrond en kanaalbeschrijving komen hierdoor altijd van dezelfde titel.
    /// </summary>
    internal static class TileSpotlight
    {
        public class Pick
        {
            public bool Tv;
            public int Id;
            public string Title;
            public int? Year;
            public string BackdropPath;
            public long Slot;
        }

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        private static Pick _current;
        private static byte[] _image;
        private static long _imageSlot = -1;
        private static bool _busy;
        private static string _lang;

        private static long SlotNow() { return (long)(DateTime.UtcNow - new DateTime(2020, 1, 1)).TotalHours; }

        public static Pick Current { get { return _current; } }
        public static string LastChooseUtc = "", LastChooseResult = "";
        public static long CurrentSlot { get { var c = _current; return c == null ? -1 : c.Slot; } }

        public static string Label(Pick p)
        {
            if (p == null) return null;
            return p.Title + (p.Year.HasValue ? " (" + p.Year.Value + ")" : "") + " \u2013 " +
                (p.Tv ? DiscoverLanguage.Text("Serie", "Series", "Serie") : DiscoverLanguage.Text("Film", "Movie", "Film"));
        }

        /// <summary>Start (indien nodig) op de achtergrond een nieuwe keuze; blokkeert nooit.</summary>
        public static void Refresh(TmdbClient tmdb)
        {
            var slot = SlotNow();
            var lang = TmdbClient.Language();
            var cur = _current;
            if (cur != null && cur.Slot == slot && _lang == lang) return;
            lock (typeof(TileSpotlight)) { if (_busy) return; _busy = true; }
            Task.Run(async () =>
            {
                try { await Choose(tmdb, slot, lang).ConfigureAwait(false); }
                catch (Exception ex) { LastChooseUtc = DateTime.UtcNow.ToString("u"); LastChooseResult = "FOUT: " + ex.Message; DiscoverDiagnostics.Add("tegel-titel kiezen mislukt: " + ex.Message); }
                finally { lock (typeof(TileSpotlight)) { _busy = false; } }
            });
        }

        /// <summary>Wacht kort op de eerste keuze (voor de eerste aanroep na het starten).</summary>
        public static async Task<Pick> GetAsync(TmdbClient tmdb, TimeSpan max)
        {
            Refresh(tmdb);
            var until = DateTime.UtcNow + max;
            while (_current == null && DateTime.UtcNow < until) await Task.Delay(100).ConfigureAwait(false);
            return _current;
        }

        private static async Task Choose(TmdbClient tmdb, long slot, string lang)
        {
            bool tv = slot % 2 == 1;
            var page = await tmdb.GetList(tv ? "/trending/tv/week" : "/trending/movie/week", 1, CancellationToken.None).ConfigureAwait(false);
            var list = (page == null || page.results == null ? new List<TmdbItem>() : page.results)
                .Where(x => !x.adult && !string.IsNullOrEmpty(x.backdrop_path)).ToList();
            if (list.Count == 0) { LastChooseUtc = DateTime.UtcNow.ToString("u"); LastChooseResult = "FOUT: TMDB gaf geen trending titels met backdrop (API-sleutel/netwerk?)"; return; }
            var it = list[(int)(((slot / 2) * 7) % list.Count)];
            var date = tv ? it.first_air_date : it.release_date;
            int y;
            _current = new Pick
            {
                Tv = tv,
                Id = it.id,
                Title = tv ? (it.name ?? it.title) : (it.title ?? it.name),
                Year = (!string.IsNullOrEmpty(date) && date.Length >= 4 && int.TryParse(date.Substring(0, 4), out y)) ? (int?)y : null,
                BackdropPath = it.backdrop_path,
                Slot = slot
            };
            _lang = lang;
            _image = null; _imageSlot = -1;
            LastChooseUtc = DateTime.UtcNow.ToString("u"); LastChooseResult = "OK";
        }

        public static string BackdropUrl(Pick p) { return p == null ? null : "https://image.tmdb.org/t/p/w1280" + p.BackdropPath; }

        /// <summary>Liggende tegel (achtergrond + titeltekst) van de titel van het moment voor Primary/Thumb; null als dat niet lukt.</summary>
        public static async Task<string> TileFileAsync(TmdbClient tmdb)
        {
            var p = await GetAsync(tmdb, TimeSpan.FromSeconds(6)).ConfigureAwait(false);
            if (p == null) return null;
            return await FolderTile.Create("spot", DiscoverLanguage.Text("Nu: ", "Now: ", "Jetzt: ") + Label(p), BackdropUrl(p),
                CancellationToken.None, "202020", false).ConfigureAwait(false);
        }

        /// <summary>De bytes van de achtergrond van de huidige keuze (per keuze eenmaal opgehaald).</summary>
        public static async Task<byte[]> ImageAsync(TmdbClient tmdb)
        {
            var p = await GetAsync(tmdb, TimeSpan.FromSeconds(6)).ConfigureAwait(false);
            if (p == null) return null;
            if (_image != null && _imageSlot == p.Slot) return _image;
            var bytes = await Http.GetByteArrayAsync(BackdropUrl(p)).ConfigureAwait(false);
            _image = bytes; _imageSlot = p.Slot;
            return bytes;
        }
    }
}
