define(['emby-button'], function () {
    'use strict';

    var pluginId = '7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90';

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
        if (!e) { return 'onbekende fout'; }
        if (e.status) { return 'HTTP ' + e.status + (e.statusText ? ' ' + e.statusText : ''); }
        return String(e.message || e);
    }

    // Voert een stap uit en vangt elke fout af, zodat een mislukte stap de rest niet blokkeert.
    function step(lines, title, fn) {
        return Promise.resolve().then(fn).then(function (r) {
            return r;
        }, function (e) {
            lines.push('[FOUT] ' + title + ': ' + errText(e));
            return null;
        });
    }

    function ok(lines, text) { lines.push('[ OK ] ' + text); }
    function bad(lines, text) { lines.push('[FOUT] ' + text); }
    function info(lines, text) { lines.push('       ' + text); }

    function run(view, out) {
        var lines = [];
        out.textContent = 'Bezig met controleren...';
        var cfg = null, users = [], adminId = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();

        return step(lines, 'Emby-versie ophalen', function () {
            return getJson('System/Info').then(function (i) {
                lines.push('== Emby ==');
                ok(lines, 'Emby Server ' + i.Version + ' op ' + (i.OperatingSystemDisplayName || i.OperatingSystem || '?'));
                if (i.HasPendingRestart) { bad(lines, 'Emby wacht op een herstart (nieuwe plugin pas na herstart actief).'); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== Plugin ==');
            return step(lines, 'Pluginlijst ophalen', function () {
                return getJson('Plugins').then(function (list) {
                    var mine = (list || []).filter(function (p) { return String(p.Id || '').toLowerCase().replace(/-/g, '') === pluginId.replace(/-/g, ''); })[0];
                    if (!mine) { bad(lines, 'Discover staat niet in de lijst met geladen plugins. De DLL is niet geladen (verkeerde map, herstart vergeten, of niet compatibel met deze Emby-versie).'); return; }
                    var status = mine.Status || mine.PluginStatus || '';
                    if (/malfunction|disabled|restart|notsupported|superseded|deleted/i.test(status)) { bad(lines, 'Plugin ' + mine.Version + ' heeft status "' + status + '". Zie het Emby-logboek bij het opstarten.'); }
                    else { ok(lines, 'Plugin ' + mine.Version + ' geladen' + (status ? ' (status: ' + status + ')' : '')); }
                });
            });
        }).then(function () {
            return step(lines, 'Plugin-status ophalen', function () {
                return getJson('Discover/Status').then(function (r) {
                    window.__discoverStatus = r;
                    ok(lines, 'Discover-service bereikbaar, DLL-versie ' + r.PluginVersion + ', geladen om ' + r.LoadedAt);
                    (r.TmdbKeySet ? ok : bad)(lines, 'TMDB-key ingesteld: ' + (r.TmdbKeySet ? 'ja' : 'NEE'));
                    info(lines, 'Plugin-/Emby-taal: ' + r.PluginLanguage + '; TMDB-taal: ' + r.TmdbLanguage);
                    info(lines, 'Debuginformatie op Discover-/detailpagina\'s: ' + (r.ShowDiagnostics ? 'aan' : 'uit'));
                    (r.RadarrSet ? ok : bad)(lines, 'Radarr ingesteld: ' + (r.RadarrSet ? 'ja' : 'NEE'));
                    (r.SonarrSet ? ok : bad)(lines, 'Sonarr ingesteld: ' + (r.SonarrSet ? 'ja' : 'NEE'));
                    if (r.ClipError) { bad(lines, 'Bevestigingsclip kan niet worden weggeschreven: ' + r.ClipError); }
                    else { ok(lines, 'Bevestigingsclip staat klaar: ' + r.ClipPath); }
                    if (r.ButtonScript && /^OK/.test(r.ButtonScript)) { ok(lines, 'Aanvragen-knop in de webclient: ' + r.ButtonScript); }
                    else { bad(lines, 'Aanvragen-knop in de webclient: ' + (r.ButtonScript || 'onbekend')); }
                    info(lines, 'Kanaal opgevraagd door Emby: ' + r.ChannelCalls + 'x; aanvragen gelukt/mislukt: ' + (r.Requests - r.RequestErrors) + '/' + r.RequestErrors);
                });
            });
        }).then(function () {
            return step(lines, 'Instellingen lezen', function () {
                return ApiClient.getPluginConfiguration(pluginId).then(function (c) { cfg = c; });
            });
        }).then(function () {
            lines.push('');
            lines.push('== Verbindingen (vanaf de server, met de opgeslagen instellingen) ==');
            if (!cfg) { bad(lines, 'Geen opgeslagen instellingen gevonden.'); return; }
            var tests = [];
            tests.push(step(lines, 'TMDB testen', function () {
                if (!cfg.TmdbApiKey) { bad(lines, 'TMDB: geen key ingesteld'); return; }
                return postJson('Discover/TestConnection', { Type: 'Tmdb', ApiKey: cfg.TmdbApiKey }).then(function (r) {
                    if (r && r.Success) { ok(lines, 'TMDB werkt'); } else { bad(lines, 'TMDB: ' + ((r && r.Error) || 'onbekende fout')); }
                });
            }));
            ['Radarr', 'Sonarr'].forEach(function (kind) {
                tests.push(step(lines, kind + ' testen', function () {
                    var url = cfg[kind + 'Url'], key = cfg[kind + 'ApiKey'];
                    if (!url || !key) { bad(lines, kind + ': URL of key ontbreekt'); return; }
                    return postJson('Discover/TestConnection', { Type: kind, Url: url, ApiKey: key }).then(function (r) {
                        if (r && r.Success) {
                            ok(lines, kind + ' ' + (r.Version || '') + ' bereikbaar op ' + url + ' (' + (r.Profiles || []).length + ' profielen, ' + (r.RootFolders || []).length + ' root folders)');
                            var pid = cfg[kind + 'QualityProfileId'];
                            if (pid && !(r.Profiles || []).some(function (p) { return p.Id === pid; })) { bad(lines, kind + ': opgeslagen quality profile ' + pid + ' bestaat daar niet (andere server?)'); }
                            var root = cfg[kind + 'RootFolder'];
                            if (root && !(r.RootFolders || []).some(function (f) { return f.Path === root; })) { bad(lines, kind + ': opgeslagen root folder "' + root + '" bestaat daar niet (andere server?)'); }
                        } else {
                            bad(lines, kind + ' op ' + url + ': ' + ((r && r.Error) || 'onbekende fout'));
                        }
                    });
                }));
            });
            return Promise.all(tests);
        }).then(function () {
            lines.push('');
            lines.push('== Kanaal ==');
            return step(lines, 'Kanalen ophalen', function () {
                return getJson('Channels', { UserId: adminId }).then(function (r) {
                    var names = (r.Items || []).map(function (c) { return c.Name; });
                    var found = (r.Items || []).filter(function (c) { return /discover/i.test(c.Name || ''); })[0];
                    if (found) { ok(lines, 'Kanaal "' + found.Name + '" is bekend bij Emby en zichtbaar voor jou.'); }
                    else { bad(lines, 'Kanaal "Discover Media" ontbreekt in de kanalenlijst. Bekende kanalen: ' + (names.join(', ') || '(geen)')); }
                });
            });
        }).then(function () {
            return step(lines, 'Gebruikers ophalen', function () {
                return getJson('Users').then(function (list) { users = list || []; });
            });
        }).then(function () {
            if (!users.length) { return; }
            lines.push('');
            lines.push('== Wie ziet het kanaal? ==');
            return Promise.all(users.map(function (u) {
                return getJson('Channels', { UserId: u.Id }).then(function (r) {
                    var has = (r.Items || []).some(function (c) { return /discover/i.test(c.Name || ''); });
                    return { name: u.Name, has: has };
                }, function () { return { name: u.Name, has: null }; });
            })).then(function (res) {
                var without = res.filter(function (x) { return x.has === false; }).map(function (x) { return x.name; });
                var unknown = res.filter(function (x) { return x.has === null; }).map(function (x) { return x.name; });
                var withCount = res.filter(function (x) { return x.has; }).length;
                ok(lines, withCount + ' van ' + res.length + ' gebruikers zien het kanaal.');
                if (without.length) {
                    bad(lines, 'Geen toegang tot het kanaal: ' + without.join(', '));
                    info(lines, 'Oplossen: Gebruiker > Toegang > Kanalen: "Alle kanalen" aanzetten of Discover Media toevoegen.');
                }
                if (unknown.length) { info(lines, 'Niet te controleren: ' + unknown.join(', ')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== Recente activiteit van het kanaal ==');
            var r = window.__discoverStatus;
            if (!r || !r.Events || !r.Events.length) { info(lines, '(nog niets - open het kanaal Discover Media in Emby en controleer opnieuw)'); }
            else { r.Events.forEach(function (e) { info(lines, e); }); }
            out.textContent = lines.join('\n');
        });
    }

    return function (view, params) {
        var out = view.querySelector('.dsOut');

        function load() {
            run(view, out).catch(function (e) { out.textContent += '\n[FOUT] ' + errText(e); });
        }

        view.querySelector('.dsRefresh').addEventListener('click', load);
        view.querySelector('.dsCopy').addEventListener('click', function () {
            var text = out.textContent;
            var done = function () { var b = view.querySelector('.dsCopy span'); b.textContent = 'Gekopieerd'; setTimeout(function () { b.textContent = 'Rapport kopieren'; }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { }); return; }
            var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { } document.body.removeChild(ta);
        });
        view.addEventListener('viewshow', load);
    };
});
