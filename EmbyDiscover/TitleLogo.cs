using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    public class FanartImageDto { public string url { get; set; } public string lang { get; set; } public string likes { get; set; } }

    public class FanartResultDto
    {
        public List<FanartImageDto> hdmovielogo { get; set; }
        public List<FanartImageDto> movielogo { get; set; }
        public List<FanartImageDto> hdtvlogo { get; set; }
        public List<FanartImageDto> clearlogo { get; set; }
    }

    /// <summary>
    /// Titellogo voor de kop van de popup: eerst TMDB (taal van de plugin, dan Engels, dan zonder taal),
    /// heeft TMDB er geen en is er een fanart.tv-sleutel, dan fanart.tv (HD-logo eerst). Null = geen logo,
    /// de popup toont dan de titel als tekst. Antwoorden (ook "geen logo") worden een dag bewaard.
    /// </summary>
    internal static class TitleLogo
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        private static readonly TimeSpan Keep = TimeSpan.FromDays(1);
        private static readonly ConcurrentDictionary<string, Tuple<DateTime, string>> Cache = new ConcurrentDictionary<string, Tuple<DateTime, string>>();

        internal static async Task<string> Get(IJsonSerializer json, TmdbClient tmdb, bool tv, int tmdbId, CancellationToken ct)
        {
            var key = (tv ? "t" : "m") + tmdbId + "|" + DiscoverLanguage.PluginLanguage;
            Tuple<DateTime, string> hit;
            if (Cache.TryGetValue(key, out hit) && DateTime.UtcNow - hit.Item1 < Keep) return hit.Item2;

            string url = null;
            try
            {
                var path = await tmdb.GetTitleLogo(tv, tmdbId, ct).ConfigureAwait(false);
                if (!string.IsNullOrEmpty(path)) url = "https://image.tmdb.org/t/p/w500" + path;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
            }

            if (url == null)
            {
                var fanartKey = (Plugin.GetCurrentConfiguration().FanartApiKey ?? "").Trim();
                if (fanartKey.Length > 0)
                {
                    try { url = await FromFanart(json, tmdb, fanartKey, tv, tmdbId, ct).ConfigureAwait(false); }
                    catch (Exception ex)
                    {
                        if (ex is OperationCanceledException) throw;
                        DiscoverDiagnostics.Add("fanart.tv logo " + (tv ? "t" : "m") + tmdbId + " failed: " + ex.Message);
                    }
                }
            }

            Cache[key] = Tuple.Create(DateTime.UtcNow, url);
            return url;
        }

        private static async Task<string> FromFanart(IJsonSerializer json, TmdbClient tmdb, string apiKey, bool tv, int tmdbId, CancellationToken ct)
        {
            string id;
            if (tv)
            {
                var ext = await tmdb.GetTvExternalIds(tmdbId, ct).ConfigureAwait(false);
                if (ext == null || !ext.tvdb_id.HasValue || ext.tvdb_id.Value <= 0) return null;   // fanart.tv kent series op TVDB-id
                id = ext.tvdb_id.Value.ToString();
            }
            else id = tmdbId.ToString();

            var u = "https://webservice.fanart.tv/v3/" + (tv ? "tv/" : "movies/") + id + "?api_key=" + Uri.EscapeDataString(apiKey);
            using (var resp = await Http.GetAsync(u, ct).ConfigureAwait(false))
            {
                if ((int)resp.StatusCode == 404) return null;   // fanart.tv heeft niets voor deze titel
                if (!resp.IsSuccessStatusCode) throw new HttpRequestException("HTTP " + (int)resp.StatusCode);
                var text = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                var r = json.DeserializeFromString<FanartResultDto>(text);
                if (r == null) return null;
                var lists = tv ? new[] { r.hdtvlogo, r.clearlogo } : new[] { r.hdmovielogo, r.movielogo };
                var lang = (DiscoverLanguage.PluginLanguage ?? "en").Split('-')[0].ToLowerInvariant();
                foreach (var list in lists)
                {
                    var ok = (list ?? new List<FanartImageDto>()).Where(x => x != null && !string.IsNullOrEmpty(x.url)).ToList();
                    if (ok.Count == 0) continue;
                    Func<string, FanartImageDto> pick = code => ok
                        .Where(x => string.Equals(x.lang ?? "", code, StringComparison.OrdinalIgnoreCase))
                        .OrderByDescending(x => Likes(x.likes)).FirstOrDefault();
                    var best = pick(lang) ?? pick("en") ?? pick("00") ?? pick("");
                    if (best != null) return best.url;
                }
                return null;
            }
        }

        private static int Likes(string s) { int n; return int.TryParse(s, out n) ? n : 0; }
    }
}
