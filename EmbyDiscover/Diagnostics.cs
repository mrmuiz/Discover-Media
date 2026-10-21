using System;
using System.Collections.Generic;

namespace Emby.Plugins.Discover
{
    /// <summary>Houdt in het geheugen bij wat het kanaal doet, voor de statuspagina.</summary>
    public static class DiscoverDiagnostics
    {
        private static readonly object Gate = new object();
        private static readonly List<string> Events = new List<string>();

        public static readonly DateTime LoadedUtc = DateTime.UtcNow;
        public static int ChannelCalls;
        public static string ClipPath = "";
        public static int Requests;
        public static int RequestErrors;
        /// <summary>Resultaat van het installeren van het knop-script in de Emby-webclient.</summary>
        public static string ButtonScript = "OK Emby-pluginresource; open Discover om het script in deze browser te laden.";

        public static void Add(string text)
        {
            lock (Gate)
            {
                Events.Add(DateTime.Now.ToString("HH:mm:ss") + "  " + text);
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

        public static List<string> Snapshot()
        {
            lock (Gate) { return new List<string>(Events); }
        }
    }
}
