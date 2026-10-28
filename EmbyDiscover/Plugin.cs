using System;
using System.Collections.Generic;
using System.IO;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugins.Discover
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages, IHasThumbImage
    {
        private readonly IApplicationPaths _paths;
        private readonly IXmlSerializer _xmlSerializer;
        private readonly IServerConfigurationManager _serverConfigurationManager;
        private readonly object _configurationGate = new object();
        private PluginConfiguration _savedConfiguration;
        private long _configurationFileTicks;
        private long _configurationFileLength;

        public static Plugin Instance { get; private set; }

        public Plugin(
            IApplicationPaths applicationPaths,
            IXmlSerializer xmlSerializer,
            IServerConfigurationManager serverConfigurationManager)
            : base(applicationPaths, xmlSerializer)
        {
            _paths = applicationPaths;
            _xmlSerializer = xmlSerializer;
            _serverConfigurationManager = serverConfigurationManager;
            Instance = this;
        }

        public string ServerUiCulture => _serverConfigurationManager.Configuration.UICulture;

        public static PluginConfiguration GetCurrentConfiguration()
        {
            var plugin = Instance;
            if (plugin == null) throw new InvalidOperationException("Discover plugin configuration is unavailable.");
            return plugin.ReadCurrentConfiguration();
        }

        private PluginConfiguration ReadCurrentConfiguration()
        {
            try
            {
                if (File.Exists(ConfigurationFilePath))
                {
                    var file = new FileInfo(ConfigurationFilePath);
                    lock (_configurationGate)
                    {
                        if (_savedConfiguration != null &&
                            _configurationFileTicks == file.LastWriteTimeUtc.Ticks &&
                            _configurationFileLength == file.Length)
                        {
                            return _savedConfiguration;
                        }

                        var saved = _xmlSerializer.DeserializeFromFile(typeof(PluginConfiguration), ConfigurationFilePath)
                            as PluginConfiguration;
                        if (saved != null)
                        {
                            _savedConfiguration = saved;
                            _configurationFileTicks = file.LastWriteTimeUtc.Ticks;
                            _configurationFileLength = file.Length;
                            return saved;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                DiscoverDiagnostics.Add("FOUT opgeslagen plugininstellingen laden: " + ex.Message);
            }

            return Configuration;
        }

        public override string Name => "Discover";

        public override string Description =>
            "Discover movies and series (TMDB) in Emby and request them through Radarr and Sonarr.";

        // Emby stores plugin settings by this ID. Never change it between DLL versions.
        public override Guid Id => new Guid("7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90");

        // Logo van de plugin (Dashboard > Plugins). Zelfde plaatje als het kanaal.
        public Stream GetThumbImage()
        {
            return GetType().Assembly.GetManifestResourceStream(
                GetType().Namespace + ".Resources.discover.png");
        }

        public ImageFormat ThumbImageFormat => ImageFormat.Png;

        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "discoverconfig1079",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.configPage.html",
                    EnableInMainMenu = true,
                    IsMainConfigPage = true
                },
                new PluginPageInfo
                {
                    Name = "discoverui1075",
                    DisplayName = "Discover",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.discoverPage.html",
                    EnableInMainMenu = true,
                    EnableInUserMenu = true,
                    MenuIcon = "explore"
                },
                new PluginPageInfo
                {
                    Name = "discoveruijs1350",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.discoverPage.js"
                },
                new PluginPageInfo
                {
                    Name = "discoverbuttonjs1350",
                    EmbeddedResourcePath = GetType().Namespace + ".Resources.discover-request-button.js"
                },
                new PluginPageInfo
                {
                    Name = "discoverstatus1079",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.statusPage.html"
                },
                new PluginPageInfo
                {
                    Name = "discoverstatusjs1100",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.statusPage.js"
                },
                new PluginPageInfo
                {
                    Name = "discoverconfigjs1300",
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.configPage.js"
                }
            };
        }

        /// <summary>Eerste map (data, cache, temp) waarin Emby een submap mag aanmaken en schrijven.</summary>
        internal string WorkDir(string sub)
        {
            var dirs = new List<string>();
            try { dirs.Add(_paths.DataPath); } catch { }
            try { dirs.Add(_paths.CachePath); } catch { }
            try { dirs.Add(_paths.TempDirectory); } catch { }
            try { dirs.Add(Path.GetTempPath()); } catch { }

            Exception last = null;
            foreach (var dir in dirs)
            {
                if (string.IsNullOrWhiteSpace(dir)) continue;
                try
                {
                    var target = Path.Combine(dir, sub);
                    Directory.CreateDirectory(target);
                    var probe = Path.Combine(target, ".w" + Guid.NewGuid().ToString("N"));
                    File.WriteAllText(probe, "x");
                    File.Delete(probe);
                    return target;
                }
                catch (Exception ex)
                {
                    last = ex;
                    DiscoverDiagnostics.Add("map '" + dir + "' niet beschrijfbaar: " + ex.Message);
                }
            }
            throw new InvalidOperationException("Geen beschrijfbare map voor de kaartclips: " + (last == null ? "geen map beschikbaar" : last.Message));
        }

        /// <summary>
        /// Schrijft de bevestigingsclip naar schijf (eenmalig) en geeft het pad terug.
        /// Probeert meerdere mappen, want niet elke Emby-installatie (Docker, Linux-gebruiker,
        /// Windows-service) mag overal schrijven. Elke mislukte poging staat op de statuspagina.
        /// </summary>
        public string EnsureClip()
        {
            var dirs = new List<string>();
            try { dirs.Add(_paths.DataPath); } catch { }
            try { dirs.Add(_paths.CachePath); } catch { }
            try { dirs.Add(_paths.TempDirectory); } catch { }
            try { dirs.Add(Path.GetTempPath()); } catch { }

            Exception last = null;
            foreach (var dir in dirs)
            {
                if (string.IsNullOrWhiteSpace(dir)) continue;
                try
                {
                    Directory.CreateDirectory(dir);
                    var target = Path.Combine(dir, "discover-request-ok.mp4");
                    long embeddedLen = -1;
                    try
                    {
                        using (var probe = GetType().Assembly.GetManifestResourceStream(GetType().Namespace + ".Resources.request-ok.mp4"))
                            if (probe != null) embeddedLen = probe.Length;
                    }
                    catch { }
                    // Ook vervangen als de ingebouwde clip een andere grootte heeft (nieuwe versie van de plugin).
                    if (!File.Exists(target) || new FileInfo(target).Length == 0 ||
                        (embeddedLen > 0 && new FileInfo(target).Length != embeddedLen))
                    {
                        var tmp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
                        using (var src = GetType().Assembly.GetManifestResourceStream(
                            GetType().Namespace + ".Resources.request-ok.mp4"))
                        {
                            if (src == null) throw new InvalidOperationException("Clip ontbreekt in de DLL.");
                            using (var dst = File.Create(tmp)) { src.CopyTo(dst); }
                        }
                        if (File.Exists(target)) File.Delete(target);
                        File.Move(tmp, target);
                    }
                    DiscoverDiagnostics.ClipPath = target;
                    return target;
                }
                catch (Exception ex)
                {
                    last = ex;
                    DiscoverDiagnostics.Add("clip schrijven mislukt in '" + dir + "': " + ex.Message);
                }
            }
            throw new InvalidOperationException(
                "De bevestigingsclip kon nergens worden weggeschreven: " + (last == null ? "geen map beschikbaar" : last.Message));
        }
    }
}
