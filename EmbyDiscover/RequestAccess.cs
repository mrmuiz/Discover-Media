using System;
using System.Globalization;
using System.Linq;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Wie mag aanvragen? De instelling bewaart de gebruikers die NIET mogen (BlockedUserIds, komma-gescheiden),
    /// zodat een nieuwe gebruiker standaard wel mag. Een onbekende gebruiker (bv. geen gebruiker bij de sessie)
    /// wordt niet geblokkeerd.
    /// </summary>
    internal static class RequestAccess
    {
        internal static string Normalize(object id)
        {
            return (Convert.ToString(id, CultureInfo.InvariantCulture) ?? "").Replace("-", "").Trim().ToLowerInvariant();
        }

        internal static bool IsAllowed(object userId)
        {
            var key = Normalize(userId);
            if (key.Length == 0) return true;
            var blocked = Plugin.GetCurrentConfiguration().BlockedUserIds ?? "";
            if (blocked.Length == 0) return true;
            return !blocked.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Any(b => Normalize(b) == key);
        }

        /// <summary>
        /// Limiet per gebruiker (alleen rechtstreeks naar Radarr/Sonarr; Seerr heeft zijn eigen limieten).
        /// null = mag aanvragen, anders de melding voor de gebruiker.
        /// </summary>
        internal static string LimitMessage(MediaBrowser.Model.Serialization.IJsonSerializer json, object userId, bool isAdmin)
        {
            var cfg = Plugin.GetCurrentConfiguration();
            if (isAdmin || cfg.RequestLimit <= 0 || SeerrClient.Enabled) return null;
            int days = cfg.RequestLimitDays > 0 ? cfg.RequestLimitDays : 7;
            var since = DateTime.UtcNow.AddDays(-days);
            var dates = RequestStore.DatesSince(json, userId, since);
            if (dates.Count < cfg.RequestLimit) return null;
            var again = dates[dates.Count - cfg.RequestLimit].AddDays(days).ToLocalTime();
            return DiscoverLanguage.Text(
                "Je limiet is bereikt (" + cfg.RequestLimit + " per " + days + " dagen). Weer mogelijk vanaf " + again.ToString("d MMM HH:mm", new CultureInfo("nl-NL")) + ".",
                "You have reached your limit (" + cfg.RequestLimit + " per " + days + " days). Possible again from " + again.ToString("d MMM HH:mm", CultureInfo.InvariantCulture) + ".",
                "Dein Limit ist erreicht (" + cfg.RequestLimit + " pro " + days + " Tage). Wieder möglich ab " + again.ToString("d. MMM HH:mm", new CultureInfo("de-DE")) + ".");
        }

        internal static string DeniedMessage()
        {
            return DiscoverLanguage.Text(
                "Je hebt geen toestemming om aan te vragen. Vraag het aan de beheerder.",
                "You are not allowed to make requests. Ask the administrator.",
                "Du darfst nichts anfordern. Frage den Administrator.");
        }
    }
}
