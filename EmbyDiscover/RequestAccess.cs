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

        internal static string DeniedMessage()
        {
            return DiscoverLanguage.Text(
                "Je hebt geen toestemming om aan te vragen. Vraag het aan de beheerder.",
                "You are not allowed to make requests. Ask the administrator.",
                "Du darfst nichts anfordern. Frage den Administrator.");
        }
    }
}
