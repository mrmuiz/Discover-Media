using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Waar aanvragen heen gaan. "arr" = rechtstreeks naar Radarr en Sonarr, of via een aanvraagdienst:
    /// Seerr (Overseerr/Jellyseerr) of Ombi. Deze klasse kiest de juiste dienst, zodat de rest van de plugin
    /// maar één plek hoeft te kennen.
    /// </summary>
    internal static class RequestHub
    {
        /// <summary>Aanvragen lopen via een aanvraagdienst in plaats van rechtstreeks naar Radarr/Sonarr.</summary>
        internal static bool External => SeerrClient.Enabled || OmbiClient.Enabled;

        /// <summary>De gekozen dienst heeft een URL en een API key.</summary>
        internal static bool Configured => SeerrClient.Enabled ? SeerrClient.Configured : OmbiClient.Enabled && OmbiClient.Configured;

        /// <summary>Naam voor meldingen: "Seerr", "Ombi", of null als aanvragen rechtstreeks gaan.</summary>
        internal static string Name => SeerrClient.Enabled ? "Seerr" : OmbiClient.Enabled ? "Ombi" : null;

        /// <summary>De dienst regelt zelf de limieten per gebruiker. Ombi niet: daar komt alles binnen op naam van de API key.</summary>
        internal static bool HasOwnLimits => SeerrClient.Enabled;

        /// <summary>Beide diensten werken met TMDB-id's; alleen Sonarr zelf heeft een TVDB-id nodig.</summary>
        internal static bool NeedsTvdbId => !External;

        internal static void Invalidate() { SeerrClient.Invalidate(); OmbiClient.Invalidate(); }

        internal static bool WaitsForApproval(bool tv, int tmdbId) =>
            SeerrClient.WaitsForApproval(tv, tmdbId) || OmbiClient.WaitsForApproval(tv, tmdbId);

        internal static bool Has4k(IJsonSerializer json, bool tv) =>
            SeerrClient.Enabled ? SeerrClient.Has4k(json, tv) : OmbiClient.Enabled && OmbiClient.Has4k(json, tv);

        internal static Task<Dictionary<int, bool>> GetStates(IJsonSerializer json, bool tv, CancellationToken ct) =>
            SeerrClient.Enabled ? SeerrClient.GetStates(json, tv, ct) : OmbiClient.GetStates(json, tv, ct);

        internal static Task<HashSet<int>> GetPartial(IJsonSerializer json, CancellationToken ct) =>
            SeerrClient.Enabled ? SeerrClient.GetPartial(json, ct) : OmbiClient.GetPartial(json, ct);

        internal static Task<Dictionary<int, SonarrSeasonDto>> GetSeasonStates(IJsonSerializer json, int tmdbId, CancellationToken ct) =>
            SeerrClient.Enabled ? SeerrClient.GetSeasonStates(json, tmdbId, ct) : OmbiClient.GetSeasonStates(json, tmdbId, ct);

        internal static Task<List<RecentEntry>> GetRecent(IJsonSerializer json, bool tv, CancellationToken ct) =>
            SeerrClient.Enabled ? SeerrClient.GetRecent(json, tv, ct) : OmbiClient.GetRecent(json, tv, ct);

        /// <summary>
        /// Vraagt de titel aan bij de gekozen dienst.
        /// </summary>
        /// <param name="embyUserId">Voor Seerr: de koppeling met de Seerr-gebruiker.</param>
        /// <param name="alias">Voor Ombi: de naam die als aanvrager bij de aanvraag komt te staan.</param>
        /// <returns>true = aangevraagd, false = stond al aangevraagd.</returns>
        internal static Task<bool> Request(IJsonSerializer json, bool tv, int tmdbId, int tvdbId, int[] seasons,
            object embyUserId, string alias, CancellationToken ct, bool is4k = false, bool allowOwnerFallback = false) =>
            SeerrClient.Enabled
                ? SeerrClient.Request(json, tv, tmdbId, tvdbId, seasons, embyUserId, ct, is4k, allowOwnerFallback)
                : OmbiClient.Request(json, tv, tmdbId, seasons, alias, ct, is4k);

        /// <summary>Een mislukte aanvraag opnieuw laten versturen. Ombi kent dit niet.</summary>
        internal static Task<bool> RetryFailed(IJsonSerializer json, bool tv, int tmdbId, CancellationToken ct) =>
            SeerrClient.Enabled ? SeerrClient.RetryFailed(json, tv, tmdbId, ct) : Task.FromResult(false);

        internal static Task<bool> Remove(IJsonSerializer json, bool tv, int tmdbId, bool deleteFiles, CancellationToken ct) =>
            SeerrClient.Enabled ? SeerrClient.Remove(json, tv, tmdbId, deleteFiles, ct) : OmbiClient.Remove(json, tv, tmdbId, ct);
    }
}
