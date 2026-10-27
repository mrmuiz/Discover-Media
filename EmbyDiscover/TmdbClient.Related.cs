using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Emby.Plugins.Discover
{
    // ---- TMDB-modellen voor acteurs, aanbevelingen en collecties (namen 1-op-1 met de TMDB JSON) ----

    public class TmdbCreditItem : TmdbItem
    {
        public string character { get; set; }
        public string job { get; set; }
        public string department { get; set; }
        public int episode_count { get; set; }
    }

    public class TmdbCombinedCredits
    {
        public List<TmdbCreditItem> cast { get; set; }
        public List<TmdbCreditItem> crew { get; set; }
    }

    public class TmdbPersonHit
    {
        public int id { get; set; }
        public string name { get; set; }
        public double popularity { get; set; }
        public string known_for_department { get; set; }
    }

    public class TmdbPersonSearchPage
    {
        public List<TmdbPersonHit> results { get; set; }
    }

    public class TmdbCollectionRef
    {
        public int id { get; set; }
        public string name { get; set; }
    }

    public class TmdbMovieCollectionInfo
    {
        public int id { get; set; }
        public TmdbCollectionRef belongs_to_collection { get; set; }
    }

    public class TmdbCollection
    {
        public int id { get; set; }
        public string name { get; set; }
        public List<TmdbItem> parts { get; set; }
    }

    public class TmdbFindResult
    {
        public List<TmdbItem> movie_results { get; set; }
        public List<TmdbItem> tv_results { get; set; }
    }

    /// <summary>Een titel uit de filmografie van een persoon, met de rol (personage of "Director").</summary>
    public class TmdbPersonCredit
    {
        public TmdbItem Item;
        public bool Tv;
        public string Role;
    }

    internal partial class TmdbClient
    {
        // TV-genres die op een acteurspagina alleen ruis geven (talkshows, nieuws, reality).
        private static readonly HashSet<int> NoiseTvGenres = new HashSet<int> { 10763, 10764, 10767 };

        /// <summary>Zoekt de TMDB-id van een persoon op naam (meest populaire treffer met exact dezelfde naam).</summary>
        public async Task<int> FindPersonId(string name, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(name)) return 0;
            var page = await Get<TmdbPersonSearchPage>("/search/person", "&query=" + Uri.EscapeDataString(name.Trim()),
                FallbackLanguage, ct).ConfigureAwait(false);
            var hits = page?.results ?? new List<TmdbPersonHit>();
            var exact = hits.Where(h => string.Equals((h.name ?? "").Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase))
                            .OrderByDescending(h => h.popularity).FirstOrDefault();
            return (exact ?? hits.OrderByDescending(h => h.popularity).FirstOrDefault())?.id ?? 0;
        }

        /// <summary>Films en series van een persoon: als acteur (niet als zichzelf) en als regisseur.</summary>
        public async Task<List<TmdbPersonCredit>> GetPersonCredits(int personId, CancellationToken ct)
        {
            var lang = Language();
            var credits = await Get<TmdbCombinedCredits>("/person/" + personId + "/combined_credits", "", lang, ct).ConfigureAwait(false);
            TmdbCombinedCredits fallback = null;
            if (!string.Equals(lang, FallbackLanguage, StringComparison.OrdinalIgnoreCase))
            {
                try { fallback = await Get<TmdbCombinedCredits>("/person/" + personId + "/combined_credits", "", FallbackLanguage, ct).ConfigureAwait(false); }
                catch { /* Engels is alleen een aanvulling */ }
            }
            var fbById = new Dictionary<string, TmdbItem>();
            if (fallback != null)
                foreach (var f in (fallback.cast ?? new List<TmdbCreditItem>()).Concat(fallback.crew ?? new List<TmdbCreditItem>()))
                    fbById[(f.media_type ?? "") + ":" + f.id] = f;

            var res = new List<TmdbPersonCredit>();
            var seen = new Dictionary<string, TmdbPersonCredit>();

            void Add(TmdbCreditItem c, string role)
            {
                if (c == null || c.adult) return;
                bool tv = string.Equals(c.media_type, "tv", StringComparison.OrdinalIgnoreCase);
                if (!tv && !string.Equals(c.media_type, "movie", StringComparison.OrdinalIgnoreCase)) return;
                var key = (tv ? "tv:" : "movie:") + c.id;
                TmdbItem fb;
                if (fbById.TryGetValue(key, out fb)) { Fill(c, fb); PreferLatin(c, fb); }
                if (string.IsNullOrEmpty(c.poster_path)) return;
                if (tv && c.genre_ids != null && c.genre_ids.Any(g => NoiseTvGenres.Contains(g))) return;
                TmdbPersonCredit existing;
                if (seen.TryGetValue(key, out existing))
                {
                    // Acteur én regisseur: de regierol erbij zetten.
                    if (role == "Director" && existing.Role != "Director")
                        existing.Role = string.IsNullOrEmpty(existing.Role) ? "Director" : existing.Role;
                    return;
                }
                var pc = new TmdbPersonCredit { Item = c, Tv = tv, Role = role };
                seen[key] = pc;
                res.Add(pc);
            }

            foreach (var c in credits?.cast ?? new List<TmdbCreditItem>())
            {
                var ch = (c.character ?? "").Trim();
                // Optredens als zichzelf (talkshows, documentaires over de cast, awards) overslaan.
                if (ch.Length > 0 && System.Text.RegularExpressions.Regex.IsMatch(ch,
                        @"^(self|himself|herself|themselves|zichzelf|sich selbst)\b|archive footage",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    continue;
                Add(c, ch);
            }
            foreach (var c in credits?.crew ?? new List<TmdbCreditItem>())
            {
                if (string.Equals(c.job, "Director", StringComparison.OrdinalIgnoreCase)) Add(c, "Director");
            }

            return res
                .OrderByDescending(x => x.Item.popularity * Math.Log10(10 + x.Item.vote_count))
                .ToList();
        }

        /// <summary>TMDB-aanbevelingen; valt terug op "vergelijkbaar" als er (nog) geen aanbevelingen zijn.</summary>
        public async Task<List<TmdbItem>> GetRecommendations(bool tv, int id, CancellationToken ct)
        {
            var basePath = (tv ? "/tv/" : "/movie/") + id;
            var list = new List<TmdbItem>();
            try
            {
                var rec = await GetMergedCached(basePath + "/recommendations", "&page=1", ct).ConfigureAwait(false);
                if (rec?.results != null) list.AddRange(rec.results);
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                DiscoverDiagnostics.Add("TMDB aanbevelingen " + basePath + " mislukt: " + ex.Message);
            }
            if (list.Count < 8)
            {
                try
                {
                    var sim = await GetMergedCached(basePath + "/similar", "&page=1", ct).ConfigureAwait(false);
                    if (sim?.results != null) list.AddRange(sim.results);
                }
                catch (Exception ex)
                {
                    if (ex is OperationCanceledException) throw;
                    DiscoverDiagnostics.Add("TMDB vergelijkbaar " + basePath + " mislukt: " + ex.Message);
                }
            }
            var seen = new HashSet<int>();
            var res = new List<TmdbItem>();
            foreach (var i in list)
            {
                if (i == null || i.id == id || !seen.Add(i.id)) continue;
                i.media_type = tv ? "tv" : "movie";
                res.Add(i);
            }
            return res;
        }

        /// <summary>De collectie (filmreeks) waar een film bij hoort, met alle delen; null als er geen is.</summary>
        public async Task<TmdbCollection> GetMovieCollection(int movieId, CancellationToken ct)
        {
            var info = await Get<TmdbMovieCollectionInfo>("/movie/" + movieId, "", FallbackLanguage, ct).ConfigureAwait(false);
            var cid = info?.belongs_to_collection?.id ?? 0;
            if (cid <= 0) return null;
            var lang = Language();
            var col = await Get<TmdbCollection>("/collection/" + cid, "", lang, ct).ConfigureAwait(false);
            if (col == null) return null;
            if (!string.Equals(lang, FallbackLanguage, StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var fb = await Get<TmdbCollection>("/collection/" + cid, "", FallbackLanguage, ct).ConfigureAwait(false);
                    if (string.IsNullOrWhiteSpace(col.name)) col.name = fb?.name;
                    var byId = (fb?.parts ?? new List<TmdbItem>()).GroupBy(p => p.id).ToDictionary(g => g.Key, g => g.First());
                    foreach (var p in col.parts ?? new List<TmdbItem>())
                    {
                        TmdbItem f;
                        if (byId.TryGetValue(p.id, out f)) { Fill(p, f); PreferLatin(p, f); }
                    }
                }
                catch { }
            }
            if (string.IsNullOrWhiteSpace(col.name)) col.name = info.belongs_to_collection.name;
            foreach (var p in col.parts ?? new List<TmdbItem>()) p.media_type = "movie";
            return col;
        }

        /// <summary>Zoekt een TMDB-id via een ander id (TVDB of IMDb), voor items zonder TMDB-id in Emby.</summary>
        public async Task<int> FindByExternalId(string externalId, string source, bool tv, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(externalId)) return 0;
            var r = await Get<TmdbFindResult>("/find/" + Uri.EscapeDataString(externalId.Trim()),
                "&external_source=" + source, FallbackLanguage, ct).ConfigureAwait(false);
            var list = tv ? r?.tv_results : r?.movie_results;
            return list != null && list.Count > 0 ? list[0].id : 0;
        }
    }
}
