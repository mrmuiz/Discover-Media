using System.Net;
using System.Net.Http;
using System.Net.Security;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// HTTP handler for the user's own services (Radarr, Sonarr, Seerr, download clients). With the setting
    /// "Accept self-signed certificates" on, https certificates that do not validate (self-signed, issued for
    /// another name, reached by IP address) are accepted. Off by default; TMDB and other internet services
    /// never use this handler.
    /// </summary>
    internal static class LocalTls
    {
        public static HttpClientHandler Handler(bool decompress = false)
        {
            var h = new HttpClientHandler();
            if (decompress) h.AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
            h.ServerCertificateCustomValidationCallback = (msg, cert, chain, errors) =>
                errors == SslPolicyErrors.None || Plugin.GetCurrentConfiguration()?.AllowInvalidCertificates == true;
            return h;
        }
    }
}
