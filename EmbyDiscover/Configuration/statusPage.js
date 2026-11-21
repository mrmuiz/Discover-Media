define(['emby-button'], function () {
    'use strict';

    var pluginId = '7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90';
    var language = 'nl';


    // Vertaling van de activiteitenregels (de server schrijft ze in het Nederlands). Elke regel: [patroon, Engels, Duits].
    // De tijd ("HH:mm:ss  ") blijft staan; foutmeldingen van Emby/TMDB/Radarr/Sonarr zelf blijven zoals ze zijn.
    // De logregels komen vertaald van de server (sleutel + waarden, zie Lang/*.json),
    // dus hier wordt niets meer omgezet.
    function translateEvent(e) { return e; }

    function setLanguage(locale) {
        var value = String(locale || '').toLowerCase();
        language = value.indexOf('de') === 0 ? 'de' : value.indexOf('nl') === 0 ? 'nl' : (value.indexOf('nb') === 0 || value.indexOf('nn') === 0 || value.indexOf('no') === 0) ? 'no' : 'en';
    }

    function translatePage(view) {
        view.querySelector('h2').textContent = t('status.discover_status');
        view.querySelector('.fieldDescription').textContent = t('status.checks_everything_discover_needs_the_plugin');
        view.querySelector('.dsRefresh span').textContent = t('status.check_again');
        view.querySelector('.dsCopy span').textContent = t('status.copy_report');
    }

    function getJson(path, query) {
        return ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl(path, query || {}), dataType: 'json' });
    }
    // Teksten komen van de server (Discover/Home of Discover/Status), op sleutel, in de taal van de kijker.
    // Zonder tabel valt t() terug op de sleutel zelf; dat is lelijk maar breekt niets.
    // <fallback-en> automatisch gevuld door tools/sync-js-fallback.py; niet met de hand aanpassen
    var STR_EN = {
        "status.at": "at ",
        "status.button_script_in_this_browser_build": "Button script in this browser: build ",
        "status.channel": "Channel",
        "status.channel_2": "Channel \"",
        "status.channel_requests_by_emby": "Channel requests by Emby: ",
        "status.check_again": "Check again",
        "status.check_the_emby_startup_log": "Check the Emby startup log.",
        "status.checking": "Checking...",
        "status.checks_everything_discover_needs_the_plugin": "Checks everything Discover needs: the plugin, channel, TMDB, Radarr, Sonarr, and clip file. Run this on each server and compare the results. API keys are never shown.",
        "status.configured": "configured: ",
        "status.confirmation_clip_could_not_be_written": "Confirmation clip could not be written: ",
        "status.confirmation_clip_is_ready": "Confirmation clip is ready: ",
        "status.connections_from_the_server_using_saved": "Connections (from the server, using saved settings)",
        "status.copied": "Copied",
        "status.copy_report": "Copy report",
        "status.could_not_check": "Could not check: ",
        "status.diagnostics_on_discover_item_pages": "Diagnostics on Discover/item pages: ",
        "status.differs_from_the_server_reload_the_page": "DIFFERS from the server: reload the page (Ctrl+F5)",
        "status.discover_channel_discover_media_or_films": "Discover channel (Discover Media or Films & Series Aanvragen) is missing from the channel list. Known channels: ",
        "status.discover_is_not_in_the_list_of_loaded_plugins": "Discover is not in the list of loaded plugins. The DLL was not loaded (wrong folder, restart required, or incompatible with this Emby version).",
        "status.discover_service_available_dll_version": "Discover service available, DLL version ",
        "status.discover_status": "Discover status",
        "status.dll_file_modified": "DLL file modified ",
        "status.does_not_exist_there_different_server": " does not exist there (different server?)",
        "status.does_not_exist_there_different_server_2": "\" does not exist there (different server?)",
        "status.emby": "Emby",
        "status.emby_is_waiting_for_a_restart_the_new_plugin": "Emby is waiting for a restart (the new plugin will only be active after restarting).",
        "status.error": "ERROR",
        "status.fix_channel_access": "Fix: User > Access > Channels: enable \"All channels\" or add \"{0}\".",
        "status.get_channels": "Get channels",
        "status.get_emby_version": "Get Emby version",
        "status.get_plugin_list": "Get plugin list",
        "status.get_plugin_status": "Get plugin status",
        "status.get_users": "Get users",
        "status.has_status": " has status \"",
        "status.is_listed_by_emby_and_visible_to_you": "\" is listed by Emby and visible to you.",
        "status.key_configured": "key configured: ",
        "status.loaded": "loaded",
        "status.loaded_at": "loaded at ",
        "status.loader_readonly_detail": "not possible: the web client folder is read-only, so the loader script is not in index.html. The Discover page and the buttons still work once you have opened Discover (the script is then loaded through the plugin). To make the tile go straight to Discover, make the folder writable (Docker: volume without :ro) or enter a writable \"Web client path\". Detail: {0}",
        "status.no_channel_access": "No channel access: ",
        "status.no_key_configured": "no key configured",
        "status.no_saved_settings_found": "No saved settings found.",
        "status.none": "(none)",
        "status.not_loaded_open_discover_or_a_discover_item": "not loaded (open Discover or a Discover item page first)",
        "status.nothing_yet_open_the_discover_channel_in": "(nothing yet - open the Discover channel in Emby and check again)",
        "status.on": "on",
        "status.on_2": "on",
        "status.plugin": "Plugin ",
        "status.plugin_emby_language": "Plugin/Emby language: ",
        "status.profiles": "profiles, ",
        "status.reachable_at": "reachable at ",
        "status.read_settings": "Read settings",
        "status.recent_channel_activity": "Recent channel activity",
        "status.request_button_in_web_client": "Request button in web client: ",
        "status.requests_go_through": "Requests go through: ",
        "status.requests_succeeded_failed": "requests succeeded/failed: ",
        "status.root_folders": "root folders",
        "status.saved_quality_profile": "saved quality profile ",
        "status.saved_root_folder": "saved root folder \"",
        "status.status": "status: ",
        "status.test_tmdb": "Test TMDB",
        "status.test_x": "Test {0}",
        "status.tile_discover_media_discover_page": "Tile \"Discover Media\" -> Discover page: ",
        "status.tmdb_is_working": "TMDB is working",
        "status.tmdb_language": "TMDB language: ",
        "status.url_or_key_missing": "URL or key missing",
        "status.users_can_see_the_channel": " users can see the channel.",
        "status.who_can_see_the_channel": "Who can see the channel?",
        "status.yes": "yes",
        "ui.no": "NO",
        "ui.of": " of ",
        "ui.unknown": "unknown",
        "ui.unknown_error": "unknown error",
        "web.off": "off"
    };
    // </fallback-en>
    var STR = {};
    function t(key) {
        var s = STR[key];
        if (s == null) { s = STR_EN[key]; }   // nog geen antwoord van de server: Engels in plaats van de sleutel
        if (s == null) { s = key; }
        for (var i = 1; i < arguments.length; i++) { s = s.split('{' + (i - 1) + '}').join(String(arguments[i])); }
        return s;
    }
    function viewerLang() {
        try { return (document.documentElement && document.documentElement.lang) || navigator.language || ''; } catch (e) { return ''; }
    }


    function postJson(path, data) {
        return ApiClient.ajax({
            type: 'POST', url: ApiClient.getUrl(path), data: JSON.stringify(data),
            contentType: 'application/json', dataType: 'json'
        });
    }

    var discoverChannelIdFromServer = null;
    var discoverChannelName = null;   // gevuld via Discover/ChannelInfo (werkt ook bij een hernoemd kanaal)
    function isDiscoverChannel(channel) {
        if (channel && discoverChannelIdFromServer && String(channel.Id) === String(discoverChannelIdFromServer)) { return true; }
        var name = String(channel && channel.Name || '').trim();
        return /discover/i.test(name) || /^films\s*&\s*series\s+aanvragen$/i.test(name);
    }

    function errText(e) {
        if (!e) { return t('ui.unknown_error'); }
        if (e.status) { return 'HTTP ' + e.status + (e.statusText ? ' ' + e.statusText : ''); }
        return String(e.message || e);
    }

    // Voert een stap uit en vangt elke fout af, zodat een mislukte stap de rest niet blokkeert.
    function step(lines, title, fn) {
        return Promise.resolve().then(fn).then(function (r) {
            return r;
        }, function (e) {
            lines.push('[' + t('status.error') + '] ' + title + ': ' + errText(e));
            return null;
        });
    }

    function ok(lines, message) { lines.push('[ OK ] ' + message); }
    function bad(lines, message) { lines.push('[' + t('status.error') + '] ' + message); }
    function info(lines, text) { lines.push('       ' + text); }
    function warn(lines, message) { lines.push('[ ! ]  ' + message); }

    // De server stuurt deze regel al in de taal van de kijker.
    function translateButtonScript(value) { return value; }

    function run(view, out) {
        var lines = [];
        out.textContent = t('status.checking');
        var cfg = null, users = [], adminId = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();

        return getJson('Discover/Status', { Lang: viewerLang() }).then(function (initialStatus) {
            if (initialStatus && initialStatus.Strings) { STR = initialStatus.Strings; }
            window.__discoverStatus = initialStatus;
            setLanguage(initialStatus.PluginLanguage);
            translatePage(view);
            return step(lines, t('status.get_emby_version'), function () {
            return getJson('System/Info').then(function (i) {
                lines.push('== ' + t('status.emby') + ' ==');
                ok(lines, 'Emby Server ' + i.Version + ' ' + t('status.on') + ' ' + (i.OperatingSystemDisplayName || i.OperatingSystem || '?'));
                if (i.HasPendingRestart) { bad(lines, t('status.emby_is_waiting_for_a_restart_the_new_plugin')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== Plugin ==');
            return step(lines, t('status.get_plugin_list'), function () {
                return getJson('Plugins').then(function (list) {
                    var mine = (list || []).filter(function (p) { return String(p.Id || '').toLowerCase().replace(/-/g, '') === pluginId.replace(/-/g, ''); })[0];
                    if (!mine) { bad(lines, t('status.discover_is_not_in_the_list_of_loaded_plugins')); return; }
                    var status = mine.Status || mine.PluginStatus || '';
                    if (/malfunction|disabled|restart|notsupported|superseded|deleted/i.test(status)) { bad(lines, t('status.plugin') + mine.Version + t('status.has_status') + status + '". ' + t('status.check_the_emby_startup_log')); }
                    else { ok(lines, t('status.plugin') + mine.Version + ' ' + t('status.loaded') + (status ? ' (' + t('status.status') + status + ')' : '')); }
                });
            });
        }).then(function () {
            return step(lines, t('status.get_plugin_status'), function () {
                return getJson('Discover/Status', { Lang: viewerLang() }).then(function (r) {
                if (r && r.Strings) { STR = r.Strings; }
                    window.__discoverStatus = r;
                    ok(lines, t('status.discover_service_available_dll_version') + r.PluginVersion + ' (build ' + (r.ScriptBuild || '?') + '), ' + t('status.loaded_at') + r.LoadedAt + '; ' + t('status.dll_file_modified') + (r.DllBuilt || '?'));
                    info(lines, t('status.button_script_in_this_browser_build') + (window.__discoverRequestButtonBuild || t('status.not_loaded_open_discover_or_a_discover_item')) +
                        (window.__discoverRequestButtonBuild && r.ScriptBuild && window.__discoverRequestButtonBuild !== r.ScriptBuild ? ' - ' + t('status.differs_from_the_server_reload_the_page') : ''));
                    (r.TmdbKeySet ? ok : bad)(lines, 'TMDB ' + t('status.key_configured') + (r.TmdbKeySet ? t('status.yes') : t('ui.no')));
                    info(lines, t('status.plugin_emby_language') + r.PluginLanguage + '; ' + t('status.tmdb_language') + r.TmdbLanguage);
                    info(lines, t('status.diagnostics_on_discover_item_pages') + (r.ShowDiagnostics ? t('status.on_2') : t('web.off')));
                    if (r.RequestService === 'Seerr' || r.RequestService === 'Ombi') {
                        info(lines, t('status.requests_go_through') + r.RequestService);
                        (r.RadarrSet ? ok : bad)(lines, r.RequestService + ' ' + t('status.configured') + (r.RadarrSet ? t('status.yes') : t('ui.no')));
                    } else {
                        (r.RadarrSet ? ok : bad)(lines, 'Radarr ' + t('status.configured') + (r.RadarrSet ? t('status.yes') : t('ui.no')));
                        (r.SonarrSet ? ok : bad)(lines, 'Sonarr ' + t('status.configured') + (r.SonarrSet ? t('status.yes') : t('ui.no')));
                    }
                    if (r.ClipError) { bad(lines, t('status.confirmation_clip_could_not_be_written') + r.ClipError); }
                    else { ok(lines, t('status.confirmation_clip_is_ready') + r.ClipPath); }
                    if (r.ButtonScript && /^OK/.test(r.ButtonScript)) { ok(lines, t('status.request_button_in_web_client') + translateButtonScript(r.ButtonScript)); }
                    else { bad(lines, t('status.request_button_in_web_client') + translateButtonScript(r.ButtonScript || t('ui.unknown'))); }
                    var wi = r.WebInject || t('ui.unknown');
                    var wiLabel = t('status.tile_discover_media_discover_page');
                    if (/^(actief|al actief)/.test(wi)) { ok(lines, wiLabel + wi); }
                    else if (/^alleen-lezen/.test(wi)) {
                        warn(lines, wiLabel + t('status.loader_readonly_detail', wi));
                    }
                    else if (/^(fout|webclient niet gevonden)/.test(wi)) { bad(lines, wiLabel + wi); }
                    else { info(lines, wiLabel + wi); }
                    info(lines, t('status.channel_requests_by_emby') + r.ChannelCalls + 'x; ' + t('status.requests_succeeded_failed') + (r.Requests - r.RequestErrors) + '/' + r.RequestErrors);
                });
            });
        }).then(function () {
            return step(lines, t('status.read_settings'), function () {
                return ApiClient.getPluginConfiguration(pluginId).then(function (c) { cfg = c; });
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + t('status.connections_from_the_server_using_saved') + ' ==');
            if (!cfg) { bad(lines, t('status.no_saved_settings_found')); return; }
            var tests = [];
            tests.push(step(lines, t('status.test_tmdb'), function () {
                if (!cfg.TmdbApiKey) { bad(lines, 'TMDB: ' + t('status.no_key_configured')); return; }
                return postJson('Discover/TestConnection', { Type: 'Tmdb', ApiKey: cfg.TmdbApiKey }).then(function (r) {
                    if (r && r.Success) { ok(lines, t('status.tmdb_is_working')); } else { bad(lines, 'TMDB: ' + ((r && r.Error) || t('ui.unknown_error'))); }
                });
            }));
            if (cfg.RequestService === 'seerr' || cfg.RequestService === 'ombi') {
                (function () {
                    var name = cfg.RequestService === 'ombi' ? 'Ombi' : 'Seerr';
                    var url = cfg.RequestService === 'ombi' ? cfg.OmbiUrl : cfg.SeerrUrl;
                    var key = cfg.RequestService === 'ombi' ? cfg.OmbiApiKey : cfg.SeerrApiKey;
                    tests.push(step(lines, t('status.test_x', name), function () {
                        if (!url || !key) { bad(lines, name + ': ' + t('status.url_or_key_missing')); return; }
                        return postJson('Discover/TestConnection', { Type: name, Url: url, ApiKey: key }).then(function (r) {
                            if (r && r.Success) { ok(lines, name + ' ' + String(r.Version || '').split('|')[0] + ' ' + t('status.reachable_at') + url); }
                            else { bad(lines, name + ' ' + t('status.at') + url + ': ' + ((r && r.Error) || t('ui.unknown_error'))); }
                        });
                    }));
                })();
            }
            // Radarr en Sonarr worden ook getest als ze naast Ombi/Seerr zijn ingevuld (voor status en voortgang).
            ((cfg.RequestService === 'seerr' || cfg.RequestService === 'ombi') && !cfg.SeerrArrStatus ? [] : ['Radarr', 'Sonarr']).forEach(function (kind) {
                tests.push(step(lines, t('status.test_x', kind), function () {
                    var url = cfg[kind + 'Url'], key = cfg[kind + 'ApiKey'];
                    if (!url || !key) { bad(lines, kind + ': ' + t('status.url_or_key_missing')); return; }
                    return postJson('Discover/TestConnection', { Type: kind, Url: url, ApiKey: key }).then(function (r) {
                        if (r && r.Success) {
                            ok(lines, kind + ' ' + (r.Version || '') + ' ' + t('status.reachable_at') + url + ' (' + (r.Profiles || []).length + ' ' + t('status.profiles') + (r.RootFolders || []).length + ' ' + t('status.root_folders') + ')');
                            var pid = cfg[kind + 'QualityProfileId'];
                            if (pid && !(r.Profiles || []).some(function (p) { return p.Id === pid; })) { bad(lines, kind + ': ' + t('status.saved_quality_profile') + pid + t('status.does_not_exist_there_different_server')); }
                            var root = cfg[kind + 'RootFolder'];
                            if (root && !(r.RootFolders || []).some(function (f) { return f.Path === root; })) { bad(lines, kind + ': ' + t('status.saved_root_folder') + root + t('status.does_not_exist_there_different_server_2')); }
                        } else {
                            bad(lines, kind + ' ' + t('status.at') + url + ': ' + ((r && r.Error) || t('ui.unknown_error')));
                        }
                    });
                }));
            });
            return Promise.all(tests);
        }).then(function () {
            lines.push('');
            lines.push('== ' + t('status.channel') + ' ==');
            return step(lines, t('status.get_channels'), function () {
                return getJson('Discover/ChannelInfo').then(function (ci) { discoverChannelIdFromServer = ci && ci.Id; discoverChannelName = ci && ci.Name; }, function () { })
                    .then(function () { return getJson('Channels', { UserId: adminId }); }).then(function (r) {
                    var names = (r.Items || []).map(function (c) { return c.Name; });
                    var found = (r.Items || []).filter(isDiscoverChannel)[0];
                    if (found) { ok(lines, t('status.channel_2') + found.Name + t('status.is_listed_by_emby_and_visible_to_you')); }
                    else { bad(lines, t('status.discover_channel_discover_media_or_films') + (names.join(', ') || t('status.none'))); }
                });
            });
        }).then(function () {
            return step(lines, t('status.get_users'), function () {
                return getJson('Users').then(function (list) { users = list || []; });
            });
        }).then(function () {
            if (!users.length) { return; }
            lines.push('');
            lines.push('== ' + t('status.who_can_see_the_channel') + ' ==');
            return Promise.all(users.map(function (u) {
                return getJson('Channels', { UserId: u.Id }).then(function (r) {
                    var has = (r.Items || []).some(isDiscoverChannel);
                    return { name: u.Name, has: has };
                }, function () { return { name: u.Name, has: null }; });
            })).then(function (res) {
                var without = res.filter(function (x) { return x.has === false; }).map(function (x) { return x.name; });
                var unknown = res.filter(function (x) { return x.has === null; }).map(function (x) { return x.name; });
                var withCount = res.filter(function (x) { return x.has; }).length;
                ok(lines, withCount + t('ui.of') + res.length + t('status.users_can_see_the_channel'));
                if (without.length) {
                    bad(lines, t('status.no_channel_access') + without.join(', '));
                    var chn = discoverChannelName || 'Discover Media';
                    info(lines, t('status.fix_channel_access', chn));
                }
                if (unknown.length) { info(lines, t('status.could_not_check') + unknown.join(', ')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + t('status.recent_channel_activity') + ' ==');
            var r = window.__discoverStatus;
            if (!r || !r.Events || !r.Events.length) { info(lines, t('status.nothing_yet_open_the_discover_channel_in')); }
            else {
                r.Events.forEach(function (e) {
                    e = translateEvent(e);
                    info(lines, e);
                });
            }
            out.textContent = lines.join('\n');
        });
        });
    }

    return function (view, params) {
        var out = view.querySelector('.dsOut');

        function load() {
            run(view, out)['catch'](function (e) { out.textContent += '\n[' + t('status.error') + '] ' + errText(e); });
        }

        view.querySelector('.dsRefresh').addEventListener('click', load);
        view.querySelector('.dsCopy').addEventListener('click', function () {
            var reportText = out.textContent;
            var done = function () { var b = view.querySelector('.dsCopy span'); b.textContent = t('status.copied'); setTimeout(function () { b.textContent = t('status.copy_report'); }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(reportText).then(done, function () { }); return; }
            var ta = document.createElement('textarea'); ta.value = reportText; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { } document.body.removeChild(ta);
        });
        view.addEventListener('viewshow', load);
    };
});
