using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    [Route("/Discover/TestConnection", "POST", Summary = "Test Radarr/Sonarr and fetch profiles and root folders")]
    [Authenticated(Roles = "Admin")]
    public class TestConnectionRequest : IReturn<TestConnectionResult>
    {
        /// <summary>"Radarr" of "Sonarr"</summary>
        public string Type { get; set; }
        public string Url { get; set; }
        public string ApiKey { get; set; }
        /// <summary>Alleen voor qBittorrent, NZBGet en Transmission.</summary>
        public string Username { get; set; }
        public string Password { get; set; }
    }

    public class TmdbLanguageOption
    {
        public string Code { get; set; }
        public string EnglishName { get; set; }
        public string Name { get; set; }
    }

    public class TmdbLanguageResponse
    {
        public string iso_639_1 { get; set; }
        public string english_name { get; set; }
        public string name { get; set; }
    }

    public class TestConnectionResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
        public string AppName { get; set; }
        public string Version { get; set; }
        public List<TmdbLanguageOption> Languages { get; set; } = new List<TmdbLanguageOption>();
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

        private static readonly HttpClient Http = new HttpClient(LocalTls.Handler()) { Timeout = TimeSpan.FromSeconds(10) };

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
                if (string.Equals(request.Type, "TmdbLanguages", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(request.ApiKey))
                        throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een API key in.", "Enter an API key first.", "Bitte zuerst einen API-Schlüssel eingeben.", "Skriv inn en API-nøkkel først."));

                    result.Languages = await GetTmdbLanguages(request.ApiKey).ConfigureAwait(false);
                    result.Success = true;
                    result.AppName = "TMDB";
                    return result;
                }

                if (string.Equals(request.Type, "Tmdb", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(request.ApiKey))
                        throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een API key in.", "Enter an API key first.", "Bitte zuerst einen API-Schlüssel eingeben.", "Skriv inn en API-nøkkel først."));

                    using (var resp = await Http.GetAsync(
                        "https://api.themoviedb.org/3/configuration?api_key=" + Uri.EscapeDataString(request.ApiKey.Trim()))
                        .ConfigureAwait(false))
                    {
                        if ((int)resp.StatusCode == 401)
                            throw new InvalidOperationException(DiscoverLanguage.Text("TMDB weigert de key (401). Gebruik de 'API Key' (v3), niet het Read Access Token.", "TMDB rejects the key (401). Use the 'API Key' (v3), not the Read Access Token.", "TMDB lehnt den Schlüssel ab (401). Verwende den 'API Key' (v3), nicht das Read Access Token."));
                        resp.EnsureSuccessStatusCode();
                    }

                    result.Success = true;
                    result.AppName = "TMDB";
                    return result;
                }

                if (string.Equals(request.Type, "Qbittorrent", StringComparison.OrdinalIgnoreCase))
                {
                    result.Version = await QbitClient.Test(_json, request.Url, request.Username, request.Password, request.ApiKey, System.Threading.CancellationToken.None).ConfigureAwait(false);
                    result.AppName = "qBittorrent";
                    result.Success = true;
                    return result;
                }

                if (string.Equals(request.Type, "Nzbget", StringComparison.OrdinalIgnoreCase))
                {
                    result.Version = await NzbgetClient.Test(_json, request.Url, request.Username, request.Password, System.Threading.CancellationToken.None).ConfigureAwait(false);
                    result.AppName = "NZBGet";
                    result.Success = true;
                    return result;
                }

                if (string.Equals(request.Type, "Transmission", StringComparison.OrdinalIgnoreCase))
                {
                    result.Version = await TransmissionClient.Test(_json, request.Url, request.Username, request.Password, System.Threading.CancellationToken.None).ConfigureAwait(false);
                    result.AppName = "Transmission";
                    result.Success = true;
                    return result;
                }

                if (string.Equals(request.Type, "Sabnzbd", StringComparison.OrdinalIgnoreCase))
                {
                    result.Version = await SabClient.Test(_json, request.Url, request.ApiKey, System.Threading.CancellationToken.None).ConfigureAwait(false);
                    result.AppName = "SABnzbd";
                    result.Success = true;
                    return result;
                }

                if (string.Equals(request.Type, "Seerr", StringComparison.OrdinalIgnoreCase))
                {
                    // Version = "versie|aantal Radarr-servers|aantal Sonarr-servers" (aantallen alleen als Seerr ze geeft)
                    result.Version = await SeerrClient.Test(_json, request.Url, request.ApiKey, System.Threading.CancellationToken.None).ConfigureAwait(false);
                    result.AppName = "Seerr";
                    result.Success = true;
                    return result;
                }

                if (string.IsNullOrWhiteSpace(request.Url))
                    throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een URL in.", "Enter a URL first.", "Bitte zuerst eine URL eingeben.", "Skriv inn en URL først."));
                if (string.IsNullOrWhiteSpace(request.ApiKey))
                    throw new InvalidOperationException(DiscoverLanguage.Text("Vul eerst een API key in.", "Enter an API key first.", "Bitte zuerst einen API-Schlüssel eingeben.", "Skriv inn en API-nøkkel først."));

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
                result.Error = DiscoverLanguage.Text("Time-out: geen antwoord binnen 10 seconden. Controleer de URL en poort.", "Time-out: no answer within 10 seconds. Check the URL and port.", "Zeitüberschreitung: keine Antwort innerhalb von 10 Sekunden. URL und Port prüfen.", "Tidsavbrudd: ikke svar innen 10 sekunder. Sjekk URL og port.");
                LogTmdbLanguageFailure(request, result.Error);
            }
            catch (HttpRequestException ex)
            {
                var why = ex.InnerException?.Message ?? ex.Message;
                result.Error = DiscoverLanguage.Text("Kan geen verbinding maken: ", "Cannot connect: ", "Keine Verbindung möglich: ", "Kan ikke koble til: ") + why +
                    (why.IndexOf("certificate", StringComparison.OrdinalIgnoreCase) >= 0
                        ? DiscoverLanguage.Text(" (zelfondertekend certificaat? Zet 'Zelfondertekende certificaten accepteren' aan op het tabblad Aanvragen.)", " (self-signed certificate? Turn on 'Accept self-signed certificates' on the Requests tab.)", " (selbstsigniertes Zertifikat? 'Selbstsignierte Zertifikate akzeptieren' auf der Registerkarte Anfragen einschalten.)", " (selvsignert sertifikat? Slå på 'Godta selvsignerte sertifikater' på fanen Forespørsler.)")
                        : "");
                LogTmdbLanguageFailure(request, result.Error);
            }
            catch (Exception ex)
            {
                result.Error = ex.Message;
                LogTmdbLanguageFailure(request, result.Error);
            }

            return result;
        }

        private static void LogTmdbLanguageFailure(TestConnectionRequest request, string error)
        {
            if (request != null && string.Equals(request.Type, "TmdbLanguages", StringComparison.OrdinalIgnoreCase))
                DiscoverDiagnostics.Add("ERROR TMDB language list: " + error);
        }

        private async Task<List<TmdbLanguageOption>> GetTmdbLanguages(string apiKey)
        {
            using (var resp = await Http.GetAsync(
                "https://api.themoviedb.org/3/configuration/languages?api_key=" +
                Uri.EscapeDataString(apiKey.Trim())).ConfigureAwait(false))
            {
                if ((int)resp.StatusCode == 401)
                    throw new InvalidOperationException(DiscoverLanguage.Text("TMDB weigert de key voor de talenlijst (401).", "TMDB rejects the key for the language list (401).", "TMDB lehnt den Schlüssel für die Sprachliste ab (401)."));
                if (!resp.IsSuccessStatusCode)
                    throw new InvalidOperationException(
                        "TMDB-talenlijst gaf HTTP " + (int)resp.StatusCode + " " + resp.ReasonPhrase + ".");

                var languages = _json.DeserializeFromString<List<TmdbLanguageResponse>>(
                    await resp.Content.ReadAsStringAsync().ConfigureAwait(false));
                if (languages == null) throw new InvalidOperationException(DiscoverLanguage.Text("TMDB gaf geen geldige talenlijst terug.", "TMDB returned no valid language list.", "TMDB lieferte keine gültige Sprachliste."));

                var options = languages
                    .Where(x => !string.IsNullOrWhiteSpace(x.iso_639_1))
                    .Select(x => new TmdbLanguageOption
                    {
                        Code = string.Equals(x.iso_639_1, "nl", StringComparison.OrdinalIgnoreCase)
                            ? DiscoverLanguage.Dutch
                            : string.Equals(x.iso_639_1, "en", StringComparison.OrdinalIgnoreCase)
                                ? DiscoverLanguage.English
                                : x.iso_639_1,
                        EnglishName = x.english_name,
                        Name = x.name
                    })
                    .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
                    .Select(x => x.First())
                    .ToList();

                // TMDB's /configuration/languages geeft alleen basistalen (en, nl, ...). Regiovarianten
                // (en-GB, pt-BR, es-MX, ...) komen uit /configuration/primary_translations. Die voegen we toe,
                // met een nette naam uit de basistaal, zodat je ook bv. English (United Kingdom) kunt kiezen.
                try
                {
                    var baseNames = options.ToDictionary(
                        o => (o.Code.Split('-')[0]).ToLowerInvariant(),
                        o => o.EnglishName, StringComparer.OrdinalIgnoreCase);
                    using (var tr = await Http.GetAsync(
                        "https://api.themoviedb.org/3/configuration/primary_translations?api_key=" +
                        Uri.EscapeDataString(apiKey.Trim())).ConfigureAwait(false))
                    {
                        if (tr.IsSuccessStatusCode)
                        {
                            var codes = _json.DeserializeFromString<List<string>>(
                                await tr.Content.ReadAsStringAsync().ConfigureAwait(false)) ?? new List<string>();
                            var have = new HashSet<string>(options.Select(o => o.Code), StringComparer.OrdinalIgnoreCase);
                            foreach (var code in codes)
                            {
                                if (string.IsNullOrWhiteSpace(code) || code.IndexOf('-') < 0) continue;
                                if (have.Contains(code)) continue;
                                var baseCode = code.Split('-')[0].ToLowerInvariant();
                                var region = code.Split('-')[1].ToUpperInvariant();
                                string baseName; if (!baseNames.TryGetValue(baseCode, out baseName)) baseName = baseCode;
                                options.Add(new TmdbLanguageOption { Code = code, EnglishName = baseName + " (" + region + ")", Name = baseName + " (" + region + ")" });
                                have.Add(code);
                            }
                        }
                    }
                }
                catch { /* regiovarianten zijn optioneel; basislijst blijft werken */ }

                options = options
                    .OrderBy(x => x.EnglishName, StringComparer.CurrentCultureIgnoreCase)
                    .ToList();
                DiscoverDiagnostics.Add("TMDB-talenlijst geladen: " + options.Count + " talen");
                return options;
            }
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
                        throw new InvalidOperationException(DiscoverLanguage.Text("Niet gevonden (404). Klopt de URL en het type (Radarr/Sonarr)?", "Not found (404). Are the URL and the type (Radarr/Sonarr) correct?", "Nicht gefunden (404). Stimmen URL und Typ (Radarr/Sonarr)?", "Ikke funnet (404). Stemmer URL og type (Radarr/Sonarr)?"));
                    resp.EnsureSuccessStatusCode();

                    return await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                }
            }
        }
    }
}
