using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Entities;

namespace Emby.Plugins.Discover
{
    /// <summary>Wie een aanvraag doet. Zonder gebruiker (onbekend) gelden geen regels.</summary>
    internal class Requester
    {
        public long Id;
        public string Name;
        public bool IsAdmin;

        public static Requester From(User user)
        {
            if (user == null) return null;
            bool admin = false;
            try { admin = user.Policy != null && user.Policy.IsAdministrator; } catch { }
            return new Requester { Id = user.InternalId, Name = user.Name, IsAdmin = admin };
        }
    }

    internal class RequestOutcome
    {
        public bool Success;
        /// <summary>0 = niet aangevraagd, 1 = aangevraagd of wacht op goedkeuring</summary>
        public int Status;
        public bool Pending;
        public string Message;
    }

    /// <summary>
    /// Eén plek voor alle aanvragen (webknop, rijen, Afspelen in het kanaal en goedkeuren door de beheerder):
    /// past de weeklimiet en goedkeuring per gebruiker toe, stuurt door naar Radarr/Sonarr en houdt het bij.
    /// </summary>
    internal static class RequestFlow
    {
        public static async Task<RequestOutcome> Submit(TmdbClient tmdb, ArrClient arr, Requester who, bool tv, int tmdbId,
            int[] seasons, CancellationToken ct)
        {
            var type = tv ? "tv" : "movie";
            var rule = who == null || who.IsAdmin ? null : RequestStore.Rule(who.Id);

            if (rule != null && rule.WeeklyLimit > 0 && RequestStore.CountLastWeek(who.Id) >= rule.WeeklyLimit)
            {
                return new RequestOutcome
                {
                    Message = DiscoverLanguage.Text(
                        "Weeklimiet bereikt (" + rule.WeeklyLimit + " aanvragen per 7 dagen).",
                        "Weekly limit reached (" + rule.WeeklyLimit + " requests per 7 days).",
                        "Wochenlimit erreicht (" + rule.WeeklyLimit + " Anfragen pro 7 Tage).")
                };
            }

            var item = tv ? await tmdb.GetTv(tmdbId, ct).ConfigureAwait(false)
                          : await tmdb.GetMovie(tmdbId, ct).ConfigureAwait(false);
            if (item == null) throw new InvalidOperationException("TMDB-item " + type + "/" + tmdbId + " niet gevonden.");

            var record = new RequestRecord
            {
                UserId = who?.Id ?? 0,
                UserName = who?.Name,
                Type = type,
                TmdbId = tmdbId,
                Title = tv ? (item.name ?? item.title) : (item.title ?? item.name),
                Year = YearOf(tv ? item.first_air_date : item.release_date),
                Poster = string.IsNullOrEmpty(item.poster_path) ? null : "https://image.tmdb.org/t/p/w342" + item.poster_path,
                Seasons = seasons != null && seasons.Length > 0 ? seasons.OrderBy(x => x).ToArray() : null
            };

            if (rule != null && rule.RequireApproval)
            {
                var existing = RequestStore.FindPending(who.Id, type, tmdbId);
                if (existing != null)
                {
                    if (record.Seasons != null)
                    {
                        var merged = (existing.Seasons ?? new int[0]).Concat(record.Seasons).Distinct().OrderBy(x => x).ToArray();
                        RequestStore.Update(existing.Id, r => r.Seasons = existing.Seasons == null ? null : merged);
                    }
                    return new RequestOutcome
                    {
                        Success = true, Status = 1, Pending = true,
                        Message = DiscoverLanguage.Text("Wacht al op goedkeuring", "Already waiting for approval", "Wartet bereits auf Freigabe")
                    };
                }
                record.State = RequestStates.Pending;
                RequestStore.Add(record);
                DiscoverDiagnostics.Add("aanvraag wacht op goedkeuring: " + who.Name + " " + type + "/" + tmdbId);
                return new RequestOutcome
                {
                    Success = true, Status = 1, Pending = true,
                    Message = DiscoverLanguage.Text("Wacht op goedkeuring", "Waiting for approval", "Wartet auf Freigabe")
                };
            }

            bool added = await SendToArr(tmdb, arr, item, tv, tmdbId, record.Seasons, ct).ConfigureAwait(false);
            record.State = RequestStates.Sent;
            record.CountsTowardLimit = added;
            // Stond de titel er al, dan geen melding "nu beschikbaar" sturen.
            record.Notified = !added;
            if (who != null) RequestStore.Add(record);
            DiscoverDiagnostics.CountRequest(true);
            return new RequestOutcome { Success = true, Status = 1, Message = SentMessage(tv, added, record.Seasons) };
        }

        /// <summary>Beheerder keurt een wachtende aanvraag goed: nu pas naar Radarr/Sonarr.</summary>
        public static async Task<RequestOutcome> Approve(TmdbClient tmdb, ArrClient arr, string id, string adminName, CancellationToken ct)
        {
            var rec = RequestStore.Get(id);
            if (rec == null) return new RequestOutcome { Message = DiscoverLanguage.Text("Aanvraag niet gevonden.", "Request not found.", "Anfrage nicht gefunden.") };
            if (rec.State != RequestStates.Pending && rec.State != RequestStates.Failed && rec.State != RequestStates.Denied)
                return new RequestOutcome { Success = true, Status = 1, Message = DiscoverLanguage.Text("Al goedgekeurd.", "Already approved.", "Bereits freigegeben.") };

            bool tv = rec.Type == "tv";
            try
            {
                var item = tv ? await tmdb.GetTv(rec.TmdbId, ct).ConfigureAwait(false)
                              : await tmdb.GetMovie(rec.TmdbId, ct).ConfigureAwait(false);
                bool added = await SendToArr(tmdb, arr, item, tv, rec.TmdbId, rec.Seasons, ct).ConfigureAwait(false);
                var msg = SentMessage(tv, added, rec.Seasons);
                RequestStore.Update(id, r =>
                {
                    r.State = RequestStates.Sent; r.CountsTowardLimit = true; r.Message = msg;
                    r.DecidedBy = adminName; r.DecidedAt = RequestStore.Now();
                });
                DiscoverDiagnostics.CountRequest(true);
                DiscoverDiagnostics.Add("aanvraag goedgekeurd door " + adminName + ": " + rec.Type + "/" + rec.TmdbId + " -> " + msg);
                return new RequestOutcome { Success = true, Status = 1, Message = msg };
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                RequestStore.Update(id, r => { r.State = RequestStates.Failed; r.Message = ex.Message; r.DecidedBy = adminName; r.DecidedAt = RequestStore.Now(); });
                DiscoverDiagnostics.CountRequest(false);
                DiscoverDiagnostics.Add("FOUT goedkeuren " + rec.Type + "/" + rec.TmdbId + ": " + ex.Message);
                return new RequestOutcome { Message = ex.Message };
            }
        }

        public static RequestOutcome Deny(string id, string adminName, string reason)
        {
            var ok = RequestStore.Update(id, r =>
            {
                if (r.State != RequestStates.Pending) return;
                r.State = RequestStates.Denied; r.Message = reason; r.DecidedBy = adminName; r.DecidedAt = RequestStore.Now();
            });
            return ok
                ? new RequestOutcome { Success = true, Message = DiscoverLanguage.Text("Geweigerd", "Denied", "Abgelehnt") }
                : new RequestOutcome { Message = DiscoverLanguage.Text("Aanvraag niet gevonden.", "Request not found.", "Anfrage nicht gefunden.") };
        }

        private static async Task<bool> SendToArr(TmdbClient tmdb, ArrClient arr, TmdbItem item, bool tv, int tmdbId, int[] seasons, CancellationToken ct)
        {
            if (tv)
            {
                var ext = await tmdb.GetTvExternalIds(tmdbId, ct).ConfigureAwait(false);
                if (ext?.tvdb_id == null)
                    throw new InvalidOperationException("Geen TVDB-id bij deze serie; Sonarr kan hem niet toevoegen.");
                return await arr.AddSeries(tmdbId, ext.tvdb_id.Value, item.name ?? item.title, seasons, ct).ConfigureAwait(false);
            }
            return await arr.AddMovie(tmdbId, item.title ?? item.name, YearOf(item.release_date), ct).ConfigureAwait(false);
        }

        private static string SentMessage(bool tv, bool added, int[] seasons)
        {
            string seasonNote = "";
            if (tv && seasons != null && seasons.Length > 0)
                seasonNote = " (" + DiscoverLanguage.Text("seizoen ", "season ", "Staffel ") + string.Join(", ", seasons) + ")";
            return added
                ? DiscoverLanguage.Text("Aangevraagd", "Requested", "Angefordert") + seasonNote
                : DiscoverLanguage.Text("Stond al in ", "Already in ", "Bereits in ") + (tv ? "Sonarr" : "Radarr");
        }

        private static int YearOf(string date) =>
            !string.IsNullOrEmpty(date) && date.Length >= 4 && int.TryParse(date.Substring(0, 4), out var y) ? y : 0;
    }
}
