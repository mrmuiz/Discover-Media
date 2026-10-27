using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Querying;
using MediaBrowser.Model.Serialization;
using MediaBrowser.Model.Services;

namespace Emby.Plugins.Discover
{
    // ---- Aanvragen bekijken en beheren: "Mijn aanvragen" voor iedereen, het beheerpaneel voor beheerders ----

    [Route("/Discover/MyRequests", "GET", Summary = "Aanvragen van de ingelogde gebruiker, met actuele status")]
    [Authenticated]
    public class DiscoverMyRequestsRequest : IReturn<DiscoverRequestList> { }

    [Route("/Discover/MyRequests/Cancel", "POST", Summary = "Eigen wachtende aanvraag intrekken")]
    [Authenticated]
    public class DiscoverCancelMyRequest : IReturn<DiscoverRequestResult>
    {
        public string Id { get; set; }
    }

    [Route("/Discover/Requests", "GET", Summary = "Alle aanvragen en gebruikersregels (alleen beheerders)")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverAllRequestsRequest : IReturn<DiscoverAdminData> { }

    [Route("/Discover/Requests/Approve", "POST", Summary = "Aanvraag goedkeuren (alleen beheerders)")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverApproveRequest : IReturn<DiscoverRequestResult>
    {
        public string Id { get; set; }
    }

    [Route("/Discover/Requests/Deny", "POST", Summary = "Aanvraag weigeren (alleen beheerders)")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverDenyRequest : IReturn<DiscoverRequestResult>
    {
        public string Id { get; set; }
        public string Reason { get; set; }
    }

    [Route("/Discover/Requests/Delete", "POST", Summary = "Aanvraag uit de lijst verwijderen (alleen beheerders; Radarr/Sonarr blijven ongemoeid)")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverDeleteRequest : IReturn<DiscoverRequestResult>
    {
        public string Id { get; set; }
    }

    [Route("/Discover/Requests/UserRule", "POST", Summary = "Goedkeuring en weeklimiet per gebruiker instellen (alleen beheerders)")]
    [Authenticated(Roles = "Admin")]
    public class DiscoverSetUserRule : IReturn<DiscoverRequestResult>
    {
        public long UserId { get; set; }
        public bool RequireApproval { get; set; }
        public int WeeklyLimit { get; set; }
    }

    public class DiscoverRequestView
    {
        public string Id { get; set; }
        public long UserId { get; set; }
        public string UserName { get; set; }
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        public int Year { get; set; }
        public string Poster { get; set; }
        public int[] Seasons { get; set; }
        public string Created { get; set; }
        /// <summary>pending, denied, failed, requested, downloading, partial, available</summary>
        public string Status { get; set; }
        /// <summary>Downloadvoortgang 0-100 bij status downloading.</summary>
        public int Progress { get; set; }
        public string Message { get; set; }
        public string DecidedBy { get; set; }
        public string DecidedAt { get; set; }
    }

    public class DiscoverRequestList
    {
        public List<DiscoverRequestView> Items { get; set; } = new List<DiscoverRequestView>();
    }

    public class DiscoverUserRuleView
    {
        public long UserId { get; set; }
        public string UserName { get; set; }
        public bool IsAdmin { get; set; }
        public bool RequireApproval { get; set; }
        public int WeeklyLimit { get; set; }
        public int UsedThisWeek { get; set; }
    }

    public class DiscoverAdminData
    {
        public List<DiscoverRequestView> Items { get; set; } = new List<DiscoverRequestView>();
        public List<DiscoverUserRuleView> Users { get; set; } = new List<DiscoverUserRuleView>();
        public int PendingCount { get; set; }
    }

    public class RequestsApiService : IService, IRequiresRequest
    {
        public IRequest Request { get; set; }

        private readonly IAuthorizationContext _auth;
        private readonly IUserManager _users;
        private readonly TmdbClient _tmdb;
        private readonly ArrClient _arr;
        private readonly ILogger _logger;

        public RequestsApiService(ILogManager logManager, IJsonSerializer json, IAuthorizationContext auth, IUserManager users)
        {
            _auth = auth;
            _users = users;
            _logger = logManager.GetLogger("Discover");
            _tmdb = new TmdbClient(json);
            _arr = new ArrClient(json);
            RequestStore.Init(json);
        }

        private Requester Me()
        {
            try { return Requester.From(_auth.GetAuthorizationInfo(Request)?.User); }
            catch { return null; }
        }

        public async Task<object> Get(DiscoverMyRequestsRequest request)
        {
            var res = new DiscoverRequestList();
            var me = Me();
            if (me == null) return res;
            res.Items = await Views(RequestStore.ForUser(me.Id)).ConfigureAwait(false);
            return res;
        }

        public object Post(DiscoverCancelMyRequest request)
        {
            var me = Me();
            var rec = RequestStore.Get(request.Id);
            if (me == null || rec == null || rec.UserId != me.Id || rec.State != RequestStates.Pending)
                return new DiscoverRequestResult { Message = DiscoverLanguage.Text("Kan deze aanvraag niet intrekken.", "Cannot cancel this request.", "Diese Anfrage kann nicht zurückgezogen werden.") };
            RequestStore.Delete(rec.Id);
            return new DiscoverRequestResult { Success = true, Message = DiscoverLanguage.Text("Ingetrokken", "Cancelled", "Zurückgezogen") };
        }

        public async Task<object> Get(DiscoverAllRequestsRequest request)
        {
            var res = new DiscoverAdminData();
            var all = RequestStore.All();
            res.Items = await Views(all).ConfigureAwait(false);
            res.PendingCount = all.Count(r => r.State == RequestStates.Pending);
            try
            {
                foreach (var u in _users.GetUserList(new UserQuery { IsDisabled = false }).OrderBy(u => u.Name))
                {
                    var who = Requester.From(u);
                    var rule = RequestStore.Rule(who.Id);
                    res.Users.Add(new DiscoverUserRuleView
                    {
                        UserId = who.Id, UserName = who.Name, IsAdmin = who.IsAdmin,
                        RequireApproval = rule.RequireApproval, WeeklyLimit = rule.WeeklyLimit,
                        UsedThisWeek = RequestStore.CountLastWeek(who.Id)
                    });
                }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT gebruikerslijst: " + ex.Message);
            }
            return res;
        }

        public async Task<object> Post(DiscoverApproveRequest request)
        {
            var me = Me();
            var o = await RequestFlow.Approve(_tmdb, _arr, request.Id, me?.Name ?? "admin", CancellationToken.None).ConfigureAwait(false);
            return new DiscoverRequestResult { Success = o.Success, Status = o.Status, Message = o.Message };
        }

        public object Post(DiscoverDenyRequest request)
        {
            var me = Me();
            var o = RequestFlow.Deny(request.Id, me?.Name ?? "admin", request.Reason);
            if (o.Success) DiscoverDiagnostics.Add("aanvraag geweigerd door " + (me?.Name ?? "admin") + ": " + request.Id);
            return new DiscoverRequestResult { Success = o.Success, Message = o.Message };
        }

        public object Post(DiscoverDeleteRequest request)
        {
            bool ok = RequestStore.Delete(request.Id);
            return new DiscoverRequestResult
            {
                Success = ok,
                Message = ok ? DiscoverLanguage.Text("Verwijderd uit de lijst", "Removed from the list", "Aus der Liste entfernt")
                             : DiscoverLanguage.Text("Aanvraag niet gevonden.", "Request not found.", "Anfrage nicht gefunden.")
            };
        }

        public object Post(DiscoverSetUserRule request)
        {
            string name = null;
            try { name = _users.GetUserById(request.UserId)?.Name; } catch { }
            RequestStore.SetRule(new UserRequestRule
            {
                UserId = request.UserId, UserName = name,
                RequireApproval = request.RequireApproval, WeeklyLimit = Math.Max(0, request.WeeklyLimit)
            });
            return new DiscoverRequestResult { Success = true, Message = DiscoverLanguage.Text("Opgeslagen", "Saved", "Gespeichert") };
        }

        // ---------- actuele status uit Radarr/Sonarr ----------
        private async Task<List<DiscoverRequestView>> Views(List<RequestRecord> records)
        {
            bool anyMovie = records.Any(r => r.State == RequestStates.Sent && r.Type == "movie");
            bool anyTv = records.Any(r => r.State == RequestStates.Sent && r.Type == "tv");
            var ms = anyMovie ? Safe(() => _arr.GetMovieStates(CancellationToken.None), new Dictionary<int, bool>()) : Task.FromResult(new Dictionary<int, bool>());
            var ts = anyTv ? Safe(() => _arr.GetSeriesStates(CancellationToken.None), new Dictionary<int, bool>()) : Task.FromResult(new Dictionary<int, bool>());
            var mq = anyMovie ? Safe(() => _arr.GetQueueProgress(false, CancellationToken.None), new Dictionary<int, int>()) : Task.FromResult(new Dictionary<int, int>());
            var tq = anyTv ? Safe(() => _arr.GetQueueProgress(true, CancellationToken.None), new Dictionary<int, int>()) : Task.FromResult(new Dictionary<int, int>());
            await Task.WhenAll(ms, ts, mq, tq).ConfigureAwait(false);

            return records.OrderByDescending(r => r.Created).Select(r =>
            {
                var v = new DiscoverRequestView
                {
                    Id = r.Id, UserId = r.UserId, UserName = r.UserName, Type = r.Type, TmdbId = r.TmdbId, Title = r.Title,
                    Year = r.Year, Poster = r.Poster, Seasons = r.Seasons, Created = r.Created, Message = r.Message,
                    DecidedBy = r.DecidedBy, DecidedAt = r.DecidedAt
                };
                v.Status = LiveStatus(r, r.Type == "tv" ? ts.Result : ms.Result, r.Type == "tv" ? tq.Result : mq.Result, out var progress);
                v.Progress = progress;
                return v;
            }).ToList();
        }

        internal static string LiveStatus(RequestRecord r, Dictionary<int, bool> states, Dictionary<int, int> queue, out int progress)
        {
            progress = 0;
            if (r.State == RequestStates.Pending) return "pending";
            if (r.State == RequestStates.Denied) return "denied";
            if (r.State == RequestStates.Failed) return "failed";
            int p;
            if (queue != null && queue.TryGetValue(r.TmdbId, out p)) { progress = p; return "downloading"; }
            bool hasFiles;
            if (states != null && states.TryGetValue(r.TmdbId, out hasFiles) && hasFiles)
                return r.Type == "tv" && ArrClient.IsPartial(r.TmdbId) ? "partial" : "available";
            return "requested";
        }

        private async Task<T> Safe<T>(Func<Task<T>> f, T fallback)
        {
            try { return await f().ConfigureAwait(false); }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT status aanvragen: " + ex.Message);
                return fallback;
            }
        }
    }
}
