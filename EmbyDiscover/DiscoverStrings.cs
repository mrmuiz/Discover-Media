using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Emby.Plugins.Discover
{
    /// <summary>
    /// De teksten van de plugin, per taal, op sleutel. Engels is de bron: elke sleutel staat in en.json,
    /// de andere talen mogen gaten hebben en vallen dan terug op Engels (en als laatste op de sleutel zelf).
    ///
    /// De bestanden zitten als embedded resource in de DLL (Lang/en.json, nl.json, ...). Daarnaast kan een
    /// gebruiker eigen bestanden neerzetten in de map 'languages' naast de plugin-config: die overschrijven
    /// losse sleutels en kunnen ook een hele nieuwe taal toevoegen, zonder nieuwe build.
    /// </summary>
    internal static class DiscoverStrings
    {
        private const string ResourceMarker = ".Lang.";
        private static readonly object Gate = new object();

        // taalcode (klein, bv. "en", "nl", "pt-br") -> sleutel -> tekst
        private static Dictionary<string, Dictionary<string, string>> _tables;
        private static List<string> _codes = new List<string>();
        private static string _loadNote = "";

        /// <summary>De talen die er zijn, Engels eerst. Leeg zolang er niets geladen is.</summary>
        internal static IReadOnlyList<string> Codes { get { Ensure(); return _codes; } }

        /// <summary>Korte melding voor de statuspagina: hoeveel talen en wat er misging.</summary>
        internal static string LoadNote { get { Ensure(); return _loadNote; } }

        internal static void Reload()
        {
            lock (Gate) { _tables = null; }
        }

        internal static bool Has(string code)
        {
            Ensure();
            return code != null && _tables.ContainsKey(code.ToLowerInvariant());
        }

        /// <summary>Hoeveel van de Engelse sleutels deze taal heeft (voor de statuspagina).</summary>
        internal static void Coverage(string code, out int translated, out int total)
        {
            Ensure();
            Dictionary<string, string> en, t;
            _tables.TryGetValue("en", out en);
            total = en == null ? 0 : en.Count;
            translated = 0;
            if (code == null || !_tables.TryGetValue(code.ToLowerInvariant(), out t) || en == null) { return; }
            foreach (var k in en.Keys) { if (t.ContainsKey(k)) { translated++; } }
        }

        /// <summary>De waarde van een sleutel in precies deze taal, zonder terugval op Engels.</summary>
        internal static string Own(string code, string key)
        {
            Ensure();
            Dictionary<string, string> table;
            string value;
            if (code != null && _tables.TryGetValue(code.ToLowerInvariant(), out table) && table.TryGetValue(key, out value)) { return value; }
            return null;
        }

        /// <summary>De tekst bij een sleutel in de gevraagde taal, met terugval op Engels en op de sleutel.</summary>
        internal static string Get(string code, string key)
        {
            if (string.IsNullOrEmpty(key)) { return ""; }
            Ensure();
            Dictionary<string, string> table;
            string value;
            if (code != null && _tables.TryGetValue(code.ToLowerInvariant(), out table) && table.TryGetValue(key, out value) && value != null)
            {
                return value;
            }
            if (_tables.TryGetValue("en", out table) && table.TryGetValue(key, out value) && value != null)
            {
                return value;
            }
            return key;
        }

        /// <summary>Alle teksten van een taal (Engels aangevuld), voor de browserscripts.</summary>
        internal static Dictionary<string, string> Table(string code)
        {
            Ensure();
            var result = new Dictionary<string, string>(StringComparer.Ordinal);
            Dictionary<string, string> table;
            if (_tables.TryGetValue("en", out table)) { foreach (var kv in table) { result[kv.Key] = kv.Value; } }
            if (code != null && _tables.TryGetValue(code.ToLowerInvariant(), out table))
            {
                foreach (var kv in table) { if (kv.Value != null) { result[kv.Key] = kv.Value; } }
            }
            return result;
        }

        private static void Ensure()
        {
            if (_tables != null) { return; }
            lock (Gate)
            {
                if (_tables != null) { return; }
                var tables = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
                var problems = new List<string>();

                // 1. de meegeleverde bestanden in de DLL
                try
                {
                    var asm = typeof(DiscoverStrings).Assembly;
                    foreach (var name in asm.GetManifestResourceNames())
                    {
                        var at = name.IndexOf(ResourceMarker, StringComparison.OrdinalIgnoreCase);
                        if (at < 0 || !name.EndsWith(".json", StringComparison.OrdinalIgnoreCase)) { continue; }
                        var code = name.Substring(at + ResourceMarker.Length);
                        code = code.Substring(0, code.Length - 5).ToLowerInvariant();
                        try
                        {
                            using (var stream = asm.GetManifestResourceStream(name))
                            using (var reader = new StreamReader(stream, Encoding.UTF8))
                            {
                                Merge(tables, code, Parse(reader.ReadToEnd()));
                            }
                        }
                        catch (Exception ex) { problems.Add(code + ": " + ex.Message); }
                    }
                }
                catch (Exception ex) { problems.Add(ex.Message); }

                // 2. eigen bestanden van de gebruiker; die winnen van de meegeleverde
                foreach (var file in UserFiles())
                {
                    var code = Path.GetFileNameWithoutExtension(file).ToLowerInvariant();
                    try { Merge(tables, code, Parse(File.ReadAllText(file, Encoding.UTF8))); }
                    catch (Exception ex) { problems.Add(Path.GetFileName(file) + ": " + ex.Message); }
                }

                var codes = tables.Keys.OrderBy(c => c == "en" ? 0 : 1).ThenBy(c => c, StringComparer.Ordinal).ToList();
                _tables = tables;
                _codes = codes;
                _loadNote = codes.Count + " language(s): " + string.Join(", ", codes.ToArray()) +
                    (problems.Count == 0 ? "" : "; problems: " + string.Join("; ", problems.ToArray()));
            }
        }

        private static IEnumerable<string> UserFiles()
        {
            try
            {
                var dir = UserFolder();
                if (dir == null || !Directory.Exists(dir)) { return new string[0]; }
                return Directory.GetFiles(dir, "*.json");
            }
            catch { return new string[0]; }
        }

        /// <summary>De map waarin eigen taalbestanden mogen staan; wordt niet aangemaakt als hij niet bestaat.</summary>
        internal static string UserFolder()
        {
            try
            {
                var plugin = Plugin.Instance;
                if (plugin == null) { return null; }
                var dir = plugin.LanguageFolder;
                return string.IsNullOrWhiteSpace(dir) ? null : dir;
            }
            catch { return null; }
        }

        private static void Merge(Dictionary<string, Dictionary<string, string>> tables, string code, Dictionary<string, string> add)
        {
            if (string.IsNullOrWhiteSpace(code) || add == null) { return; }
            Dictionary<string, string> table;
            if (!tables.TryGetValue(code, out table))
            {
                table = new Dictionary<string, string>(StringComparer.Ordinal);
                tables[code] = table;
            }
            foreach (var kv in add)
            {
                if (!string.IsNullOrEmpty(kv.Key) && kv.Value != null) { table[kv.Key] = kv.Value; }
            }
        }

        /// <summary>
        /// Leest een plat JSON-object ({"sleutel": "tekst", ...}). Genest JSON komt in deze bestanden niet
        /// voor; een eigen bestand van een gebruiker mag dus niet nesten. Een fout geeft een uitzondering,
        /// die hierboven op de statuspagina belandt in plaats van de plugin te breken.
        /// </summary>
        private static Dictionary<string, string> Parse(string text)
        {
            var result = new Dictionary<string, string>(StringComparer.Ordinal);
            if (string.IsNullOrWhiteSpace(text)) { return result; }
            var i = 0;
            SkipWhite(text, ref i);
            if (i >= text.Length || text[i] != '{') { throw new FormatException("expected '{'"); }
            i++;
            while (true)
            {
                SkipWhite(text, ref i);
                if (i >= text.Length) { throw new FormatException("unexpected end"); }
                if (text[i] == '}') { i++; break; }
                if (text[i] == ',') { i++; continue; }
                if (text[i] != '"') { throw new FormatException("expected '\"' at " + i); }
                var key = ReadString(text, ref i);
                SkipWhite(text, ref i);
                if (i >= text.Length || text[i] != ':') { throw new FormatException("expected ':' at " + i); }
                i++;
                SkipWhite(text, ref i);
                if (i < text.Length && text[i] == 'n' && string.CompareOrdinal(text, i, "null", 0, 4) == 0) { i += 4; continue; }
                if (i >= text.Length || text[i] != '"') { throw new FormatException("expected a text value at " + i); }
                result[key] = ReadString(text, ref i);
            }
            return result;
        }

        private static void SkipWhite(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n' || s[i] == '﻿')) { i++; }
        }

        private static string ReadString(string s, ref int i)
        {
            i++; // openend aanhalingsteken
            var sb = new StringBuilder();
            while (i < s.Length)
            {
                var c = s[i++];
                if (c == '"') { return sb.ToString(); }
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) { break; }
                var e = s[i++];
                switch (e)
                {
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case '/': sb.Append('/'); break;
                    case '\\': sb.Append('\\'); break;
                    case '"': sb.Append('"'); break;
                    case 'u':
                        if (i + 4 > s.Length) { throw new FormatException("bad \\u escape"); }
                        sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16));
                        i += 4;
                        break;
                    default: throw new FormatException("bad escape \\" + e);
                }
            }
            throw new FormatException("unterminated text");
        }
    }
}
