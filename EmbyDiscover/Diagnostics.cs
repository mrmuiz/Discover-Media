using System;
using System.Collections.Generic;
using System.Globalization;

namespace Emby.Plugins.Discover
{
    /// <summary>Houdt in het geheugen bij wat het kanaal doet, voor de statuspagina.</summary>
    public static class DiscoverDiagnostics
    {
        private static readonly object Gate = new object();
        private static readonly List<Entry> Events = new List<Entry>();

        public static readonly DateTime LoadedUtc = DateTime.UtcNow;
        public static int ChannelCalls;
        public static string ClipPath = "";
        public static int Requests;
        public static int RequestErrors;
        /// <summary>Resultaat van het installeren van het knop-script in de Emby-webclient.</summary>
        public static string ButtonScript = "OK Emby plugin resource; open Discover to load the script in this browser.";
        /// <summary>Resultaat van het (optioneel) in de webclient-index.html zetten van de lader (tegel -> Discover).</summary>
        // Leeg = de lader is nog niet gelopen; de statusregel wordt pas bij het opvragen vertaald.
        public static string WebInject = "";

        /// <summary>
        /// Een los woord in een logregel dat ook vertaald moet worden ("serie" / "film"). Zonder dit zou
        /// zo'n woord al bij het opschrijven vastliggen, terwijl de regel pas bij het tonen wordt vertaald.
        /// </summary>
        public struct Word
        {
            public readonly string Key;
            public Word(string key) { Key = key; }
            public override string ToString() { return Key; }
        }

        public static Word W(string key) { return new Word(key); }

        private struct Entry
        {
            public DateTime When;
            public string Key;
            public object[] Args;
        }

        /// <summary>
        /// Schrijft een regel op als sleutel plus waarden. De tekst wordt pas gemaakt als iemand de
        /// statuspagina opvraagt, in de taal van die kijker; het Emby-logboek blijft Engels.
        /// </summary>
        public static void Add(string key, params object[] args)
        {
            lock (Gate)
            {
                Events.Add(new Entry { When = DateTime.Now, Key = key, Args = args });
                while (Events.Count > 30) Events.RemoveAt(0);
            }
        }

        public static void CountRequest(bool ok)
        {
            lock (Gate) { Requests++; if (!ok) RequestErrors++; }
        }

        public static void CountCall()
        {
            lock (Gate) { ChannelCalls++; }
        }

        /// <summary>De regels in het Engels (voor het logboek en als terugval).</summary>
        public static List<string> Snapshot() { return Snapshot("en"); }

        /// <summary>De regels in de gevraagde taal, met tijdstip ervoor.</summary>
        public static List<string> Snapshot(string code)
        {
            var copy = new List<Entry>();
            lock (Gate) { copy.AddRange(Events); }

            var result = new List<string>(copy.Count);
            foreach (var e in copy)
            {
                result.Add(e.When.ToString("HH:mm:ss") + "  " + Render(code, e.Key, e.Args));
            }
            return result;
        }

        /// <summary>Een regel samenstellen: sleutel opzoeken en de waarden invullen.</summary>
        public static string Render(string code, string key, object[] args)
        {
            var format = DiscoverStrings.Get(code, key);
            if (args == null || args.Length == 0) { return format; }

            var values = new object[args.Length];
            for (var i = 0; i < args.Length; i++)
            {
                var word = args[i] as Word?;
                values[i] = word.HasValue ? DiscoverStrings.Get(code, word.Value.Key) : args[i];
            }
            try { return string.Format(CultureInfo.InvariantCulture, format, values); }
            catch { return format; }
        }
    }
}
