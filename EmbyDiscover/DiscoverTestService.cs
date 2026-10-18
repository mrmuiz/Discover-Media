using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    [Route("/Discover/TestConnection", "POST", Summary = "Test Radarr/Sonarr en haal profielen en root folders op")]
    [Authenticated(Roles = "Admin")]
    public class TestConnectionRequest : IReturn<TestConnectionResult>
    {
        /// <summary>"Radarr" of "Sonarr"</summary>
        public string Type { get; set; }
        public string Url { get; set; }
        public string ApiKey { get; set; }
    }

    public class TestConnectionResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
        public string AppName { get; set; }
        public string Version { get; set; }
        public List<ArrProfile> Profiles { get; set; } = new List<ArrProfile>();
        public List<ArrRootFolder> RootFolders { get; set; } = new List<ArrRootFolder>();
    }

    public class ArrProfile
    {
        public int Id { get; set; }
        public string Name { get; set; }
    }

    public class ArrRootFolder
    {
        public string Path { get; set; }
        public long FreeSpace { get; set; }
    }

    public class ArrStatus
    {
        public string AppName { get; set; }
        public string Version { get; set; }
    }

    public class DiscoverTestService : IService
    {
        private const string ApiBase = "/api/v3"; // Radarr 6.x en Sonarr 5.x

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

        private readonly IJsonSerializer _json;

        public DiscoverTestService(IJsonSerializer json)
        {
            _json = json;
        }

        public async Task<object> Post(TestConnectionRequest request)
        {
            var result = new TestConnectionResult();

            try
            {
                if (string.Equals(request.Type, "Tmdb", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(request.ApiKey))
                        throw new InvalidOperationException("Vul eerst een API key in.");

                    using (var resp = await Http.GetAsync(
                        "https://api.themoviedb.org/3/configuration?api_key=" + Uri.EscapeDataString(request.ApiKey.Trim()))
                        .ConfigureAwait(false))
                    {
                        if ((int)resp.StatusCode == 401)
                            throw new InvalidOperationException("TMDB weigert de key (401). Gebruik de 'API Key' (v3), niet het Read Access Token.");
                        resp.EnsureSuccessStatusCode();
                    }

                    result.Success = true;
                    result.AppName = "TMDB";
                    return result;
                }

                if (string.IsNullOrWhiteSpace(request.Url))
                    throw new InvalidOperationException("Vul eerst een URL in.");
                if (string.IsNullOrWhiteSpace(request.ApiKey))
                    throw new InvalidOperationException("Vul eerst een API key in.");

                var baseUrl = request.Url.Trim().TrimEnd('/');
                if (!baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                    !baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    baseUrl = "http://" + baseUrl;
                }

                var apiKey = request.ApiKey.Trim();

                var status = _json.DeserializeFromString<ArrStatus>(
                    await GetAsync(baseUrl, apiKey, "/system/status").ConfigureAwait(false));
                result.AppName = status?.AppName;
                result.Version = status?.Version;

                var profiles = _json.DeserializeFromString<List<ArrProfile>>(
                    await GetAsync(baseUrl, apiKey, "/qualityprofile").ConfigureAwait(false));
                if (profiles != null) result.Profiles = profiles;

                var folders = _json.DeserializeFromString<List<ArrRootFolder>>(
                    await GetAsync(baseUrl, apiKey, "/rootfolder").ConfigureAwait(false));
                if (folders != null) result.RootFolders = folders;

                result.Success = true;
            }
            catch (TaskCanceledException)
            {
                result.Error = "Time-out: geen antwoord binnen 10 seconden. Controleer de URL en poort.";
            }
            catch (HttpRequestException ex)
            {
                result.Error = "Kan geen verbinding maken: " + (ex.InnerException?.Message ?? ex.Message);
            }
            catch (Exception ex)
            {
                result.Error = ex.Message;
            }

            return result;
        }

        private static async Task<string> GetAsync(string baseUrl, string apiKey, string path)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Get, baseUrl + ApiBase + path))
            {
                req.Headers.Add("X-Api-Key", apiKey);

                using (var resp = await Http.SendAsync(req).ConfigureAwait(false))
                {
                    var code = (int)resp.StatusCode;
                    if (code == 401)
                        throw new InvalidOperationException("API key geweigerd (401).");
                    if (code == 404)
                        throw new InvalidOperationException("Niet gevonden (404). Klopt de URL en het type (Radarr/Sonarr)?");
                    resp.EnsureSuccessStatusCode();

                    return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                }
            }
        }
    }
}
