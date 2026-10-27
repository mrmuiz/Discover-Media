using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    /// <summary>Eén aanvraag van een gebruiker.</summary>
    public class RequestRecord
    {
        public string Id { get; set; }
        public long UserId { get; set; }
        public string UserName { get; set; }
        /// <summary>"movie" of "tv"</summary>
        public string Type { get; set; }
        public int TmdbId { get; set; }
        public string Title { get; set; }
        public int Year { get; set; }
        public string Poster { get; set; }
        public int[] Seasons { get; set; }
        /// <summary>UTC, ISO 8601</summary>
        public string Created { get; set; }
        /// <summary>pending, denied, sent, failed</summary>
        public string State { get; set; }
        /// <summary>Telt mee voor de weeklimiet (false als de titel al in Radarr/Sonarr stond).</summary>
        public bool CountsTowardLimit { get; set; } = true;
        public string Message { get; set; }
        public string DecidedBy { get; set; }
        public string DecidedAt { get; set; }
        /// <summary>De gebruiker heeft de melding "nu beschikbaar" al gekregen.</summary>
        public bool Notified { get; set; }
        public string AvailableAt { get; set; }
    }

    /// <summary>Regels per gebruiker, ingesteld door de beheerder.</summary>
    public class UserRequestRule
    {
        public long UserId { get; set; }
        public string UserName { get; set; }
        public bool RequireApproval { get; set; }
        /// <summary>Maximaal aantal aanvragen per 7 dagen; 0 = onbeperkt.</summary>
        public int WeeklyLimit { get; set; }
    }

    public class RequestStoreData
    {
        public List<RequestRecord> Requests { get; set; } = new List<RequestRecord>();
        public List<UserRequestRule> Users { get; set; } = new List<UserRequestRule>();
    }

    public static class RequestStates
    {
        public const string Pending = "pending";
        public const string Denied = "denied";
        public const string Sent = "sent";
        public const string Failed = "failed";
    }

    /// <summary>
    /// Bewaart aanvragen en gebruikersregels in een JSON-bestand in de datamap van Emby.
    /// Alle toegang loopt via één lock; het bestand wordt na elke wijziging in zijn geheel weggeschreven.
    /// </summary>
    internal static class RequestStore
    {
        private const string FileName = "requests.json";
        private const int MaxRecords = 5000;
        private static readonly object Gate = new object();
        private static RequestStoreData _data;
        private static string _path;
        private static IJsonSerializer _json;

        public static void Init(IJsonSerializer json)
        {
            if (_json == null) _json = json;
        }

        private static RequestStoreData Data()
        {
            if (_data != null) return _data;
            try
            {
                _path = Path.Combine(Plugin.Instance.WorkDir("discover-data"), FileName);
                if (File.Exists(_path))
                    _data = _json.DeserializeFromString<RequestStoreData>(File.ReadAllText(_path));
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT aanvragenlijst laden: " + ex.Message);
            }
            if (_data == null) _data = new RequestStoreData();
            if (_data.Requests == null) _data.Requests = new List<RequestRecord>();
            if (_data.Users == null) _data.Users = new List<UserRequestRule>();
            return _data;
        }

        private static void Save()
        {
            try
            {
                if (_path == null) _path = Path.Combine(Plugin.Instance.WorkDir("discover-data"), FileName);
                if (_data.Requests.Count > MaxRecords)
                    _data.Requests = _data.Requests.OrderByDescending(r => r.Created).Take(MaxRecords).ToList();
                var tmp = _path + ".tmp";
                File.WriteAllText(tmp, _json.SerializeToString(_data));
                if (File.Exists(_path)) File.Delete(_path);
                File.Move(tmp, _path);
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT aanvragenlijst opslaan: " + ex.Message);
            }
        }

        private static RequestRecord Copy(RequestRecord r) => new RequestRecord
        {
            Id = r.Id, UserId = r.UserId, UserName = r.UserName, Type = r.Type, TmdbId = r.TmdbId, Title = r.Title,
            Year = r.Year, Poster = r.Poster, Seasons = r.Seasons == null ? null : (int[])r.Seasons.Clone(), Created = r.Created,
            State = r.State, CountsTowardLimit = r.CountsTowardLimit, Message = r.Message, DecidedBy = r.DecidedBy,
            DecidedAt = r.DecidedAt, Notified = r.Notified, AvailableAt = r.AvailableAt
        };

        public static string Now() => DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);

        public static DateTime ParseDate(string s)
        {
            DateTime d;
            return DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out d)
                ? d : DateTime.MinValue;
        }

        public static List<RequestRecord> All()
        {
            lock (Gate) { return Data().Requests.Select(Copy).ToList(); }
        }

        public static List<RequestRecord> ForUser(long userId)
        {
            lock (Gate) { return Data().Requests.Where(r => r.UserId == userId).Select(Copy).ToList(); }
        }

        public static RequestRecord Get(string id)
        {
            lock (Gate)
            {
                var r = Data().Requests.FirstOrDefault(x => x.Id == id);
                return r == null ? null : Copy(r);
            }
        }

        /// <summary>Een openstaande (wachtende) aanvraag van deze gebruiker voor dezelfde titel.</summary>
        public static RequestRecord FindPending(long userId, string type, int tmdbId)
        {
            lock (Gate)
            {
                var r = Data().Requests.FirstOrDefault(x => x.UserId == userId && x.Type == type && x.TmdbId == tmdbId &&
                                                            x.State == RequestStates.Pending);
                return r == null ? null : Copy(r);
            }
        }

        public static void Add(RequestRecord r)
        {
            lock (Gate)
            {
                if (string.IsNullOrEmpty(r.Id)) r.Id = Guid.NewGuid().ToString("N");
                if (string.IsNullOrEmpty(r.Created)) r.Created = Now();
                Data().Requests.Add(Copy(r));
                Save();
            }
        }

        /// <summary>Past een aanvraag aan; geeft false als hij niet (meer) bestaat.</summary>
        public static bool Update(string id, Action<RequestRecord> change)
        {
            lock (Gate)
            {
                var r = Data().Requests.FirstOrDefault(x => x.Id == id);
                if (r == null) return false;
                change(r);
                Save();
                return true;
            }
        }

        public static bool Delete(string id)
        {
            lock (Gate)
            {
                int n = Data().Requests.RemoveAll(x => x.Id == id);
                if (n > 0) Save();
                return n > 0;
            }
        }

        /// <summary>Aantal aanvragen in de afgelopen 7 dagen dat meetelt voor de limiet.</summary>
        public static int CountLastWeek(long userId)
        {
            var since = DateTime.UtcNow.AddDays(-7);
            lock (Gate)
            {
                return Data().Requests.Count(r => r.UserId == userId && r.CountsTowardLimit &&
                    r.State != RequestStates.Denied && r.State != RequestStates.Failed && ParseDate(r.Created) >= since);
            }
        }

        public static UserRequestRule Rule(long userId)
        {
            lock (Gate)
            {
                var u = Data().Users.FirstOrDefault(x => x.UserId == userId);
                return u == null
                    ? new UserRequestRule { UserId = userId }
                    : new UserRequestRule { UserId = u.UserId, UserName = u.UserName, RequireApproval = u.RequireApproval, WeeklyLimit = u.WeeklyLimit };
            }
        }

        public static void SetRule(UserRequestRule rule)
        {
            lock (Gate)
            {
                var users = Data().Users;
                users.RemoveAll(x => x.UserId == rule.UserId);
                if (rule.RequireApproval || rule.WeeklyLimit > 0)
                    users.Add(new UserRequestRule
                    {
                        UserId = rule.UserId, UserName = rule.UserName,
                        RequireApproval = rule.RequireApproval, WeeklyLimit = Math.Max(0, rule.WeeklyLimit)
                    });
                Save();
            }
        }
    }
}
