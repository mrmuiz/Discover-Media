define(['emby-button'], function () {
    'use strict';

    var pluginId = '7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90';
    var language = 'nl';

    function text(dutch, english, german) {
        return language === 'de' ? (german || english) : language === 'en' ? english : dutch;
    }

    function setLanguage(locale) {
        var value = String(locale || '').toLowerCase();
        language = value.indexOf('de') === 0 ? 'de' : value.indexOf('nl') === 0 ? 'nl' : 'en';
    }

    function translatePage(view) {
        view.querySelector('h2').textContent = text('Discover status', 'Discover status', 'Discover-Status');
        view.querySelector('.fieldDescription').textContent = text(
            'Controleert alles wat Discover nodig heeft: de plugin, het kanaal, TMDB, Radarr, Sonarr en het clipbestand. Draai dit op elke server en vergelijk de uitkomst. Er worden geen API keys getoond.',
            'Checks everything Discover needs: the plugin, channel, TMDB, Radarr, Sonarr, and clip file. Run this on each server and compare the results. API keys are never shown.',
            'Prüft alle Voraussetzungen von Discover: Plugin, Kanal, TMDB, Radarr, Sonarr und Clipdatei. Führe dies auf jedem Server aus und vergleiche die Ergebnisse. API-Schlüssel werden nicht angezeigt.');
        view.querySelector('.dsRefresh span').textContent = text('Opnieuw controleren', 'Check again', 'Erneut prüfen');
        view.querySelector('.dsCopy span').textContent = text('Rapport kopiëren', 'Copy report', 'Bericht kopieren');
    }

    function getJson(path, query) {
        return ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl(path, query || {}), dataType: 'json' });
    }

    function postJson(path, data) {
        return ApiClient.ajax({
            type: 'POST', url: ApiClient.getUrl(path), data: JSON.stringify(data),
            contentType: 'application/json', dataType: 'json'
        });
    }

    function errText(e) {
        if (!e) { return text('onbekende fout', 'unknown error', 'unbekannter Fehler'); }
        if (e.status) { return 'HTTP ' + e.status + (e.statusText ? ' ' + e.statusText : ''); }
        return String(e.message || e);
    }

    // Voert een stap uit en vangt elke fout af, zodat een mislukte stap de rest niet blokkeert.
    function step(lines, title, fn) {
        return Promise.resolve().then(fn).then(function (r) {
            return r;
        }, function (e) {
            lines.push('[' + text('FOUT', 'ERROR', 'FEHLER') + '] ' + title + ': ' + errText(e));
            return null;
        });
    }

    function ok(lines, message) { lines.push('[ OK ] ' + message); }
    function bad(lines, message) { lines.push('[' + text('FOUT', 'ERROR', 'FEHLER') + '] ' + message); }
    function info(lines, text) { lines.push('       ' + text); }

    function translateButtonScript(value) {
        if (value === 'OK Emby-pluginresource; open Discover om het script in deze browser te laden.') {
            return text(
                value,
                'OK Emby plugin resource; open Discover to load the script in this browser.',
                'OK Emby-Pluginressource; öffne Discover, um das Skript in diesem Browser zu laden.');
        }
        return value;
    }

    function run(view, out) {
        var lines = [];
        out.textContent = text('Bezig met controleren...', 'Checking...', 'Prüfung läuft...');
        var cfg = null, users = [], adminId = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();

        return getJson('Discover/Status').then(function (initialStatus) {
            window.__discoverStatus = initialStatus;
            setLanguage(initialStatus.PluginLanguage);
            translatePage(view);
            return step(lines, text('Emby-versie ophalen', 'Get Emby version', 'Emby-Version abrufen'), function () {
            return getJson('System/Info').then(function (i) {
                lines.push('== ' + text('Emby', 'Emby', 'Emby') + ' ==');
                ok(lines, 'Emby Server ' + i.Version + ' ' + text('op', 'on', 'auf') + ' ' + (i.OperatingSystemDisplayName || i.OperatingSystem || '?'));
                if (i.HasPendingRestart) { bad(lines, text('Emby wacht op een herstart (nieuwe plugin pas na herstart actief).', 'Emby is waiting for a restart (the new plugin will only be active after restarting).', 'Emby wartet auf einen Neustart (das neue Plugin wird erst danach aktiv).')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== Plugin ==');
            return step(lines, text('Pluginlijst ophalen', 'Get plugin list', 'Pluginliste abrufen'), function () {
                return getJson('Plugins').then(function (list) {
                    var mine = (list || []).filter(function (p) { return String(p.Id || '').toLowerCase().replace(/-/g, '') === pluginId.replace(/-/g, ''); })[0];
                    if (!mine) { bad(lines, text('Discover staat niet in de lijst met geladen plugins. De DLL is niet geladen (verkeerde map, herstart vergeten, of niet compatibel met deze Emby-versie).', 'Discover is not in the list of loaded plugins. The DLL was not loaded (wrong folder, restart required, or incompatible with this Emby version).', 'Discover ist nicht in der Liste der geladenen Plugins. Die DLL wurde nicht geladen (falscher Ordner, Neustart erforderlich oder inkompatibel mit dieser Emby-Version).')); return; }
                    var status = mine.Status || mine.PluginStatus || '';
                    if (/malfunction|disabled|restart|notsupported|superseded|deleted/i.test(status)) { bad(lines, text('Plugin ', 'Plugin ', 'Plugin ') + mine.Version + text(' heeft status "', ' has status "', ' hat den Status "') + status + '". ' + text('Zie het Emby-logboek bij het opstarten.', 'Check the Emby startup log.', 'Siehe das Emby-Startprotokoll.')); }
                    else { ok(lines, text('Plugin ', 'Plugin ', 'Plugin ') + mine.Version + ' ' + text('geladen', 'loaded', 'geladen') + (status ? ' (' + text('status: ', 'status: ', 'Status: ') + status + ')' : '')); }
                });
            });
        }).then(function () {
            return step(lines, text('Plugin-status ophalen', 'Get plugin status', 'Pluginstatus abrufen'), function () {
                return getJson('Discover/Status').then(function (r) {
                    window.__discoverStatus = r;
                    ok(lines, text('Discover-service bereikbaar, DLL-versie ', 'Discover service available, DLL version ', 'Discover-Dienst erreichbar, DLL-Version ') + r.PluginVersion + ', ' + text('geladen om ', 'loaded at ', 'geladen um ') + r.LoadedAt);
                    (r.TmdbKeySet ? ok : bad)(lines, 'TMDB ' + text('key ingesteld: ', 'key configured: ', 'Schlüssel eingerichtet: ') + (r.TmdbKeySet ? text('ja', 'yes', 'ja') : text('NEE', 'NO', 'NEIN')));
                    info(lines, text('Plugin-/Emby-taal: ', 'Plugin/Emby language: ', 'Plugin-/Emby-Sprache: ') + r.PluginLanguage + '; ' + text('TMDB-taal: ', 'TMDB language: ', 'TMDB-Sprache: ') + r.TmdbLanguage);
                    info(lines, text('Debuginformatie op Discover-/detailpagina\'s: ', 'Diagnostics on Discover/item pages: ', 'Diagnoseinformationen auf Discover-/Detailseiten: ') + (r.ShowDiagnostics ? text('aan', 'on', 'ein') : text('uit', 'off', 'aus')));
                    (r.RadarrSet ? ok : bad)(lines, 'Radarr ' + text('ingesteld: ', 'configured: ', 'eingerichtet: ') + (r.RadarrSet ? text('ja', 'yes', 'ja') : text('NEE', 'NO', 'NEIN')));
                    (r.SonarrSet ? ok : bad)(lines, 'Sonarr ' + text('ingesteld: ', 'configured: ', 'eingerichtet: ') + (r.SonarrSet ? text('ja', 'yes', 'ja') : text('NEE', 'NO', 'NEIN')));
                    if (r.ClipError) { bad(lines, text('Bevestigingsclip kan niet worden weggeschreven: ', 'Confirmation clip could not be written: ', 'Bestätigungsclip konnte nicht geschrieben werden: ') + r.ClipError); }
                    else { ok(lines, text('Bevestigingsclip staat klaar: ', 'Confirmation clip is ready: ', 'Bestätigungsclip ist bereit: ') + r.ClipPath); }
                    if (r.ButtonScript && /^OK/.test(r.ButtonScript)) { ok(lines, text('Aanvragen-knop in de webclient: ', 'Request button in web client: ', 'Anfragen-Schaltfläche im Webclient: ') + translateButtonScript(r.ButtonScript)); }
                    else { bad(lines, text('Aanvragen-knop in de webclient: ', 'Request button in web client: ', 'Anfragen-Schaltfläche im Webclient: ') + translateButtonScript(r.ButtonScript || text('onbekend', 'unknown', 'unbekannt'))); }
                    info(lines, text('Kanaal opgevraagd door Emby: ', 'Channel requests by Emby: ', 'Kanalaufrufe durch Emby: ') + r.ChannelCalls + 'x; ' + text('aanvragen gelukt/mislukt: ', 'requests succeeded/failed: ', 'Anfragen erfolgreich/fehlgeschlagen: ') + (r.Requests - r.RequestErrors) + '/' + r.RequestErrors);
                });
            });
        }).then(function () {
            return step(lines, text('Instellingen lezen', 'Read settings', 'Einstellungen lesen'), function () {
                return ApiClient.getPluginConfiguration(pluginId).then(function (c) { cfg = c; });
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + text('Verbindingen (vanaf de server, met de opgeslagen instellingen)', 'Connections (from the server, using saved settings)', 'Verbindungen (vom Server mit den gespeicherten Einstellungen)') + ' ==');
            if (!cfg) { bad(lines, text('Geen opgeslagen instellingen gevonden.', 'No saved settings found.', 'Keine gespeicherten Einstellungen gefunden.')); return; }
            var tests = [];
            tests.push(step(lines, text('TMDB testen', 'Test TMDB', 'TMDB testen'), function () {
                if (!cfg.TmdbApiKey) { bad(lines, 'TMDB: ' + text('geen key ingesteld', 'no key configured', 'kein Schlüssel eingerichtet')); return; }
                return postJson('Discover/TestConnection', { Type: 'Tmdb', ApiKey: cfg.TmdbApiKey }).then(function (r) {
                    if (r && r.Success) { ok(lines, text('TMDB werkt', 'TMDB is working', 'TMDB funktioniert')); } else { bad(lines, 'TMDB: ' + ((r && r.Error) || text('onbekende fout', 'unknown error', 'unbekannter Fehler'))); }
                });
            }));
            ['Radarr', 'Sonarr'].forEach(function (kind) {
                tests.push(step(lines, text(kind + ' testen', 'Test ' + kind, kind + ' testen'), function () {
                    var url = cfg[kind + 'Url'], key = cfg[kind + 'ApiKey'];
                    if (!url || !key) { bad(lines, kind + ': ' + text('URL of key ontbreekt', 'URL or key missing', 'URL oder Schlüssel fehlt')); return; }
                    return postJson('Discover/TestConnection', { Type: kind, Url: url, ApiKey: key }).then(function (r) {
                        if (r && r.Success) {
                            ok(lines, kind + ' ' + (r.Version || '') + ' ' + text('bereikbaar op ', 'reachable at ', 'erreichbar unter ') + url + ' (' + (r.Profiles || []).length + ' ' + text('profielen, ', 'profiles, ', 'Profile, ') + (r.RootFolders || []).length + ' ' + text('root folders', 'root folders', 'Stammordner') + ')');
                            var pid = cfg[kind + 'QualityProfileId'];
                            if (pid && !(r.Profiles || []).some(function (p) { return p.Id === pid; })) { bad(lines, kind + ': ' + text('opgeslagen quality profile ', 'saved quality profile ', 'gespeichertes Qualitätsprofil ') + pid + text(' bestaat daar niet (andere server?)', ' does not exist there (different server?)', ' ist dort nicht vorhanden (anderer Server?)')); }
                            var root = cfg[kind + 'RootFolder'];
                            if (root && !(r.RootFolders || []).some(function (f) { return f.Path === root; })) { bad(lines, kind + ': ' + text('opgeslagen root folder "', 'saved root folder "', 'gespeicherter Stammordner "') + root + text('" bestaat daar niet (andere server?)', '" does not exist there (different server?)', '" ist dort nicht vorhanden (anderer Server?)')); }
                        } else {
                            bad(lines, kind + ' ' + text('op ', 'at ', 'unter ') + url + ': ' + ((r && r.Error) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')));
                        }
                    });
                }));
            });
            return Promise.all(tests);
        }).then(function () {
            lines.push('');
            lines.push('== ' + text('Kanaal', 'Channel', 'Kanal') + ' ==');
            return step(lines, text('Kanalen ophalen', 'Get channels', 'Kanäle abrufen'), function () {
                return getJson('Channels', { UserId: adminId }).then(function (r) {
                    var names = (r.Items || []).map(function (c) { return c.Name; });
                    var found = (r.Items || []).filter(function (c) { return /discover/i.test(c.Name || ''); })[0];
                    if (found) { ok(lines, text('Kanaal "', 'Channel "', 'Kanal "') + found.Name + text('" is bekend bij Emby en zichtbaar voor jou.', '" is listed by Emby and visible to you.', '" ist bei Emby bekannt und für dich sichtbar.')); }
                    else { bad(lines, text('Kanaal "Discover Media" ontbreekt in de kanalenlijst. Bekende kanalen: ', 'Channel "Discover Media" is missing from the channel list. Known channels: ', 'Kanal "Discover Media" fehlt in der Kanalliste. Bekannte Kanäle: ') + (names.join(', ') || text('(geen)', '(none)', '(keine)'))); }
                });
            });
        }).then(function () {
            return step(lines, text('Gebruikers ophalen', 'Get users', 'Benutzer abrufen'), function () {
                return getJson('Users').then(function (list) { users = list || []; });
            });
        }).then(function () {
            if (!users.length) { return; }
            lines.push('');
            lines.push('== ' + text('Wie ziet het kanaal?', 'Who can see the channel?', 'Wer kann den Kanal sehen?') + ' ==');
            return Promise.all(users.map(function (u) {
                return getJson('Channels', { UserId: u.Id }).then(function (r) {
                    var has = (r.Items || []).some(function (c) { return /discover/i.test(c.Name || ''); });
                    return { name: u.Name, has: has };
                }, function () { return { name: u.Name, has: null }; });
            })).then(function (res) {
                var without = res.filter(function (x) { return x.has === false; }).map(function (x) { return x.name; });
                var unknown = res.filter(function (x) { return x.has === null; }).map(function (x) { return x.name; });
                var withCount = res.filter(function (x) { return x.has; }).length;
                ok(lines, withCount + text(' van ', ' of ', ' von ') + res.length + text(' gebruikers zien het kanaal.', ' users can see the channel.', ' Benutzern kann den Kanal sehen.'));
                if (without.length) {
                    bad(lines, text('Geen toegang tot het kanaal: ', 'No channel access: ', 'Kein Zugriff auf den Kanal: ') + without.join(', '));
                    info(lines, text('Oplossen: Gebruiker > Toegang > Kanalen: "Alle kanalen" aanzetten of Discover Media toevoegen.', 'Fix: User > Access > Channels: enable "All channels" or add Discover Media.', 'Lösung: Benutzer > Zugriff > Kanäle: "Alle Kanäle" aktivieren oder Discover Media hinzufügen.'));
                }
                if (unknown.length) { info(lines, text('Niet te controleren: ', 'Could not check: ', 'Nicht überprüfbar: ') + unknown.join(', ')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + text('Recente activiteit van het kanaal', 'Recent channel activity', 'Letzte Kanalaktivität') + ' ==');
            var r = window.__discoverStatus;
            if (!r || !r.Events || !r.Events.length) { info(lines, text('(nog niets - open het kanaal Discover Media in Emby en controleer opnieuw)', '(nothing yet - open the Discover Media channel in Emby and check again)', '(noch nichts - öffne den Kanal Discover Media in Emby und prüfe erneut)')); }
            else {
                r.Events.forEach(function (e) {
                    if (language !== 'nl') {
                        e = e.replace('teruggegeven:', text('teruggegeven:', 'returned:', 'zurückgegeben:'))
                            .replace('opgevraagd:', text('opgevraagd:', 'requested:', 'abgerufen:'))
                            .replace('mislukt:', text('mislukt:', 'failed:', 'fehlgeschlagen:'))
                            .replace('FOUT ', text('FOUT ', 'ERROR ', 'FEHLER '))
                            .replace('taal=', text('taal=', 'language=', 'Sprache='))
                            .replace('TMDB-talenlijst geladen: ', text('TMDB-talenlijst geladen: ', 'TMDB language list loaded: ', 'TMDB-Sprachliste geladen: '))
                            .replace(' talen', text(' talen', ' languages', ' Sprachen'));
                    }
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
            run(view, out)['catch'](function (e) { out.textContent += '\n[' + text('FOUT', 'ERROR', 'FEHLER') + '] ' + errText(e); });
        }

        view.querySelector('.dsRefresh').addEventListener('click', load);
        view.querySelector('.dsCopy').addEventListener('click', function () {
            var reportText = out.textContent;
            var done = function () { var b = view.querySelector('.dsCopy span'); b.textContent = text('Gekopieerd', 'Copied', 'Kopiert'); setTimeout(function () { b.textContent = text('Rapport kopiëren', 'Copy report', 'Bericht kopieren'); }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(reportText).then(done, function () { }); return; }
            var ta = document.createElement('textarea'); ta.value = reportText; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { } document.body.removeChild(ta);
        });
        view.addEventListener('viewshow', load);
    };
});
