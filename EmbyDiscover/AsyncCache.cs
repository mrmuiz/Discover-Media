using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// Hulpje om een geheugencache te begrenzen. Zonder dit blijven verlopen regels staan tot Emby herstart:
    /// de houdbaarheid wordt bij het lezen gecontroleerd, maar niets wordt ooit weggegooid. Bij één gebruiker
    /// valt dat niet op, bij dertig gebruikers die veel titels openen loopt het geheugen op.
    /// De aanroeper houdt zelf het slot vast.
    /// </summary>
    internal static class CacheLimit
    {
        /// <summary>Gooit de oudste regels weg tot er weer ruimte is (tot driekwart van het maximum).</summary>
        internal static void Trim<TKey, TValue>(Dictionary<TKey, TValue> map, int max, Func<TValue, DateTime> at)
        {
            if (map == null || max <= 0 || map.Count <= max) { return; }
            var keep = max * 3 / 4;
            var drop = map.OrderBy(kv => at(kv.Value)).Take(map.Count - keep).Select(kv => kv.Key).ToList();
            foreach (var key in drop) { map.Remove(key); }
        }
    }

    /// <summary>
    /// Een cache van lopende én afgeronde opvragingen, op sleutel. Twee dingen tegelijk:
    ///
    ///   - houdbaarheid en een maximum, zodat het geheugen niet ongemerkt volloopt;
    ///   - één opvraging per sleutel: vragen twintig gebruikers tegelijk dezelfde titel op, dan gaat er één
    ///     verzoek naar buiten in plaats van twintig. Dat laatste is bij OMDb het verschil tussen wel en niet
    ///     binnen de gratis duizend per dag blijven.
    ///
    /// Een mislukte opvraging wordt niet bewaard: de volgende keer wordt het gewoon opnieuw geprobeerd.
    /// </summary>
    internal sealed class AsyncCache<T>
    {
        private sealed class Entry
        {
            public DateTime At;
            public Task<T> Work;
        }

        private readonly object _gate = new object();
        private readonly Dictionary<string, Entry> _map = new Dictionary<string, Entry>(StringComparer.Ordinal);
        private readonly TimeSpan _ttl;
        private readonly int _max;

        internal AsyncCache(TimeSpan ttl, int max)
        {
            _ttl = ttl;
            _max = max;
        }

        internal Task<T> Get(string key, Func<Task<T>> start)
        {
            if (key == null) { return start(); }
            lock (_gate)
            {
                Entry entry;
                if (_map.TryGetValue(key, out entry))
                {
                    var running = !entry.Work.IsCompleted;
                    var usable = entry.Work.Status == TaskStatus.RanToCompletion;
                    if (running || (usable && DateTime.UtcNow - entry.At < _ttl)) { return entry.Work; }
                    _map.Remove(key);
                }

                Task<T> work;
                try { work = start(); }
                catch (Exception ex) { return Fail(ex); }
                if (work == null) { return Task.FromResult(default(T)); }

                _map[key] = new Entry { At = DateTime.UtcNow, Work = work };
                CacheLimit.Trim(_map, _max, e => e.At);
                return work;
            }
        }

        /// <summary>De bewaarde waarde als die er is en nog geldig is; anders false (zonder iets te starten).</summary>
        internal bool TryPeek(string key, out T value)
        {
            value = default(T);
            if (key == null) { return false; }
            lock (_gate)
            {
                Entry entry;
                if (!_map.TryGetValue(key, out entry)) { return false; }
                if (entry.Work.Status != TaskStatus.RanToCompletion) { return false; }
                if (DateTime.UtcNow - entry.At >= _ttl) { return false; }
                value = entry.Work.Result;
                return true;
            }
        }

        internal void Clear()
        {
            lock (_gate) { _map.Clear(); }
        }

        private static Task<T> Fail(Exception ex)
        {
            var source = new TaskCompletionSource<T>();
            source.SetException(ex);
            return source.Task;
        }
    }
}
