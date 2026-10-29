define([], function () {
    'use strict';

    var uiLanguage = 'nl';
    function text(dutch, english, german) {
        return uiLanguage === 'de' ? (german || english) : uiLanguage === 'en' ? english : dutch;
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function api(type, path, query, data) {
        var url = ApiClient.getUrl(path, query || {});
        var opts = { type: type, url: url, dataType: 'json' };
        if (data) { opts.data = JSON.stringify(data); opts.contentType = 'application/json'; }
        return ApiClient.ajax(opts);
    }

    // Laadt het Aanvragen-knop-script ook vanaf deze pagina (Emby is een single-page app: het blijft actief
    // tot je de pagina volledig herlaadt). Zo werkt de knop ook als index.html door een andere plugin is overschreven.
    var diag = { load: text('nog niet geprobeerd', 'not tried yet', 'noch nicht versucht'), status: '' };
    var diagEl = null;

    function showDiag() {
        if (!diagEl) { return; }
        diagEl.textContent = text('Diagnose: knop-script actief in browser: ', 'Diagnostics: request script active in browser: ', 'Diagnose: Schaltflächenskript im Browser aktiv: ') +
            (window.__discoverRequestButton ? text('JA v', 'YES v', 'JA v') + (window.__discoverRequestButtonVersion || text('oud (<0.14.6)', 'old (<0.14.6)', 'alt (<0.14.6)')) : text('NEE', 'NO', 'NEIN')) +
            '\n' + text('laden vanaf Discover-pagina: ', 'loaded from Discover page: ', 'von der Discover-Seite geladen: ') + diag.load +
            '\n' + text('server: ', 'server: ', 'Server: ') + (diag.status || '...');
    }

    // Load as an external script so Emby's Content-Security-Policy does not block inline execution.
    function loadButtonScript() {
        if (window.__discoverRequestButtonVersion === '1.3.5.4') {
            diag.load = text('script is al actief v1.3.5.4', 'script already active v1.3.5.4', 'Skript bereits aktiv v1.3.5.4');
            showDiag();
            return;
        }
        var urls = [
            ApiClient.getUrl('web/ConfigurationPage', { name: 'discoverbuttonjs1354' }),
            ApiClient.getUrl('web/configurationpage', { name: 'discoverbuttonjs1354' }),
            ApiClient.getUrl('Plugins/Discover/Script')
        ];
        var n = 0;
        (function next() {
            if (n >= urls.length) { diag.load += text(' (alle adressen mislukt)', ' (all addresses failed)', ' (alle Adressen fehlgeschlagen)'); showDiag(); return; }
            var u = urls[n++];
            var script = document.createElement('script');
            script.id = 'discover-request-button-external';
            script.src = u + (u.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
            script.async = true;
            script.onload = function () {
                if (window.__discoverRequestButtonVersion === '1.3.5.4') {
                    diag.load = text('OK via extern script ', 'OK via external script ', 'OK über externes Skript ') + u;
                    showDiag();
                } else {
                    diag.load = text('verouderd script bleef actief (', 'outdated script stayed active (', 'veraltetes Skript blieb aktiv (') +
                        (window.__discoverRequestButtonVersion || text('geen versienummer', 'no version number', 'keine Versionsnummer')) + '): ' + u;
                    script.parentNode.removeChild(script);
                    next();
                }
            };
            script.onerror = function () {
                diag.load = text('script laden mislukt: ', 'loading script failed: ', 'Skript laden fehlgeschlagen: ') + u;
                if (script.parentNode) { script.parentNode.removeChild(script); }
                next();
            };
            document.head.appendChild(script);
        })();
    }

    return function (view, params) {
        diagEl = view.querySelector('.dcDiag');
        diagEl.style.display = 'none';
        loadButtonScript();
        api('GET', 'Discover/Status').then(function (r) {
            diagEl.style.display = r.ShowDiagnostics ? '' : 'none';
            showTrailer = r.ShowTrailerTile !== false;
            diag.status = 'v' + (r.PluginVersion || '?') + ' | ' + text('pluginresource: ', 'plugin resource: ', 'Pluginressource: ') + (r.ButtonScript || text('onbekend', 'unknown', 'unbekannt'));
            showDiag();
        }, function () { diag.status = text('status ophalen mislukt', 'could not fetch status', 'Status konnte nicht abgerufen werden'); showDiag(); });
        setTimeout(showDiag, 1500);
        var content = view.querySelector('.dcContent');
        var input = view.querySelector('.dcSearchInput');
        input.placeholder = text('Films en series zoeken', 'Search movies and series', 'Filme und Serien suchen');
        var overlay = view.querySelector('.dcOverlay');
        var toast = view.querySelector('.dcToast');
        var items = {};      // sleutel -> item (gedeeld door alle kaarten)
        var current = null;  // item in het detailvenster
        var searchTimer = null;
        var loaded = false;
        var isAdmin = false;
        var showTrailer = true;
        try {
            ApiClient.getCurrentUser().then(function (u) {
                isAdmin = !!(u && u.Policy && u.Policy.IsAdministrator);
                updateButton();
            }, function () { });
        } catch (e) { }

        function key(i) { return i.Type + ':' + i.TmdbId; }

        function statusIcon(st) { return st === 2 ? '&#10003;' : (st === 1 ? '&#9203;' : ''); }

        function cardHtml(i) {
            items[key(i)] = i;
            var poster = i.Poster
                ? '<img loading="lazy" src="' + esc(i.Poster) + '" alt="" />'
                : '<div class="dcNoPoster">' + esc(i.Title) + '</div>';
            var sub = [];
            if (typeof i.Rating === 'number' && i.Rating > 0) { sub.push('<span class="dcStar">&#9733; ' + i.Rating.toFixed(1) + '</span>'); }
            if (i.Year) { sub.push('<span>' + i.Year + '</span>'); }
            return '<div class="dcCard focusable" tabindex="0" role="button" data-key="' + key(i) + '">' +
                '<div class="dcPoster">' + poster +
                '<span class="dcBadge ' + i.Type + '">' + (i.Type === 'tv' ? text('SERIE', 'SERIES', 'SERIE') : text('FILM', 'MOVIE', 'FILM')) + '</span>' +
                '<span class="dcStatus s' + i.Status + '">' + statusIcon(i.Status) + '</span></div>' +
                '<div class="dcCap"><div class="dcCapT">' + esc(i.Title) + '</div>' +
                (sub.length ? '<div class="dcCapSub">' + sub.join('') + '</div>' : '') +
                '</div></div>';
        }

        // Skeleton tijdens het laden (voelt sneller dan "Laden...").
        function skelCards(n) {
            var cards = '';
            for (var c = 0; c < (n || 8); c++) { cards += '<div class="dcSkel"><div class="dcSkelP"></div><div class="dcSkelT"></div></div>'; }
            return cards;
        }
        function skeletonHtml(rows) {
            var out = '';
            for (var r = 0; r < (rows || 3); r++) { out += '<div class="dcRowTitle" style="opacity:.35"> </div><div class="dcSkelRow">' + skelCards(8) + '</div>'; }
            return out;
        }

        function tileHtml(r, t) {
            var inner = t.Image
                ? '<img class="dcTileLogo" loading="lazy" src="' + esc(t.Image) + '" alt="' + esc(t.Name) + '" />'
                : '<span>' + esc(t.Name) + '</span>';
            return '<div class="dcTile focusable' + (t.Image ? ' logo' : '') + '" tabindex="0" role="button" data-kind="' + esc(r.TileKind) + '" data-id="' + esc(t.Id) +
                '" data-name="' + esc(t.Name) + '" title="' + esc(t.Name) + '" style="background:' + esc(t.Color || '#1c2640') + '">' + inner + '</div>';
        }

        // ---- genre / studio / netwerk: alles in een raster met "Meer laden" ----
        var browse = null;

        function openBrowse(kind, id, name) {
            browse = { kind: kind, id: id, next: 1, loading: false, done: false, seen: {} };
            content.innerHTML = '<div class="dcBrowseHead"><button type="button" class="dcBack">&#10094; ' + text('Terug', 'Back', 'Zurück') + '</button>' +
                '<span class="dcBrowseTitle">' + esc(name) + '</span></div>' +
                '<div class="dcGrid dcBrowseGrid"></div>' +
                '<div class="dcMore"><button type="button" class="dcBtn dcMoreBtn">' + text('Meer laden', 'Load more', 'Mehr laden') + '</button></div>';
            var root = view.querySelector('.dcRoot');
            if (root) { root.scrollTop = 0; }
            loadBrowse();
        }

        function loadBrowse() {
            var b = browse;
            if (!b || b.loading || b.done) { return; }
            b.loading = true;
            var btn = content.querySelector('.dcMoreBtn');
            if (btn) { btn.disabled = true; btn.textContent = text('Laden...', 'Loading...', 'Wird geladen...'); }
            api('GET', 'Discover/Browse', { Kind: b.kind, Id: b.id, Page: b.next }).then(function (r) {
                if (browse !== b) { return; }
                var list = (r && r.Items) || [];
                var fresh = list.filter(function (i) {
                    if (b.seen[key(i)]) { return false; }
                    b.seen[key(i)] = true;
                    return true;
                });
                var grid = content.querySelector('.dcBrowseGrid');
                var firstPage = grid && !grid.children.length;
                if (grid && fresh.length) { grid.insertAdjacentHTML('beforeend', fresh.map(cardHtml).join('')); }
                if (isTvClient && firstPage && grid.firstElementChild && !overlay.classList.contains('open')) { focusEl(grid.firstElementChild); }
                b.next = (r && r.NextPage) || (b.next + 2);
                b.loading = false;
                if (!list.length) { b.done = true; }
                var more = content.querySelector('.dcMore');
                if (more) { more.style.display = b.done ? 'none' : 'block'; }
                if (btn) { btn.disabled = false; btn.textContent = text('Meer laden', 'Load more', 'Mehr laden'); }
                if (b.done && !b.seenAny && !fresh.length && grid && !grid.children.length) {
                    grid.innerHTML = '<div class="dcMsg">' + text('Geen resultaten.', 'No results.', 'Keine Ergebnisse.') + '</div>';
                }
            }, function () {
                b.loading = false;
                if (btn) { btn.disabled = false; btn.textContent = text('Opnieuw proberen', 'Try again', 'Erneut versuchen'); }
            });
        }

        var rowState = {};   // rij-sleutel -> { nextPage, loading, done, seen }

        function renderRows(rows) {
            var html = '';
            rowState = {};
            rows.forEach(function (r) {
                if (r.Kind === 'tiles') {
                    if (!r.Tiles || !r.Tiles.length) { return; }
                    html += '<div class="dcRowTitle">' + esc(r.Title) + '</div>' +
                        '<div class="dcRowWrap">' +
                        '<button type="button" class="dcArrow left" data-dir="-1">&#10094;</button>' +
                        '<div class="dcRow dcTileRow">' + r.Tiles.map(function (t) { return tileHtml(r, t); }).join('') + '</div>' +
                        '<button type="button" class="dcArrow right" data-dir="1">&#10095;</button>' +
                        '</div>';
                    return;
                }
                if (!r.Items || !r.Items.length) { return; }
                var seen = {};
                r.Items.forEach(function (i) { seen[key(i)] = true; });
                rowState[r.Key] = { nextPage: r.NextPage || 4, loading: false, done: false, seen: seen };
                html += '<div class="dcRowTitle">' + esc(r.Title) + '</div>' +
                    '<div class="dcRowWrap">' +
                    '<button type="button" class="dcArrow left" data-dir="-1">&#10094;</button>' +
                    '<div class="dcRow" data-row="' + esc(r.Key) + '">' + r.Items.map(cardHtml).join('') + '</div>' +
                    '<button type="button" class="dcArrow right" data-dir="1">&#10095;</button>' +
                    '</div>';
            });
            content.innerHTML = html || '<div class="dcMsg">' + text('Geen resultaten.', 'No results.', 'Keine Ergebnisse.') + '</div>';
        }

        // Laadt de volgende TMDB-pagina als je bijna aan het eind van een rij bent.
        function maybeLoadMore(el) {
            var rowKey = el.getAttribute('data-row');
            var st = rowState[rowKey];
            if (!st || st.loading || st.done) { return; }
            if (el.scrollLeft + el.clientWidth < el.scrollWidth - 700) { return; }
            st.loading = true;
            api('GET', 'Discover/List', { Key: rowKey, Page: st.nextPage }).then(function (r) {
                var list = (r && r.Items) || [];
                if (!list.length) { st.done = true; st.loading = false; return; }
                st.nextPage = (r && r.NextPage) || (st.nextPage + 1);
                var fresh = list.filter(function (i) {
                    if (st.seen[key(i)]) { return false; }
                    st.seen[key(i)] = true;
                    return true;
                });
                if (fresh.length) { el.insertAdjacentHTML('beforeend', fresh.map(cardHtml).join('')); }
                st.loading = false;
                maybeLoadMore(el); // nog steeds aan het eind (bijv. alles dubbel)? meteen verder
            }, function () { st.loading = false; st.done = true; });
        }

        function loadHome() {
            browse = null;
            content.innerHTML = skeletonHtml(3);
            api('GET', 'Discover/Home').then(function (r) {
                var culture = String(r.Language || '').toLowerCase();
                uiLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : 'en';
                input.placeholder = text('Films en series zoeken', 'Search movies and series', 'Filme und Serien suchen');
                if (r.Message) { content.innerHTML = '<div class="dcMsg">' + esc(r.Message) + '</div>'; return; }
                renderRows(r.Rows || []);
                loaded = true;
                // TV: meteen op de eerste kaart, behalve als je net in de zoekbalk aan het typen bent.
                if (isTvClient && document.activeElement !== input && !overlay.classList.contains('open')) { focusFirstItem(); }
            }, function () {
                content.innerHTML = '<div class="dcMsg">' + text(
                    'Laden mislukt. Controleer of de plugin is bijgewerkt en Emby opnieuw is gestart.',
                    'Loading failed. Check that the plugin is updated and Emby has been restarted.',
                    'Laden fehlgeschlagen. Prüfe, ob das Plugin aktualisiert und Emby neu gestartet wurde.') + '</div>';
            });
        }

        function doSearch(q) {
            browse = null;
            content.innerHTML = '<div class="dcRowTitle">' + text('Zoeken...', 'Searching...', 'Suchen...') + '</div><div class="dcSkelRow">' + skelCards(8) + '</div>';
            api('GET', 'Discover/Search', { Query: q }).then(function (r) {
                var list = r.Items || [];
                content.innerHTML = list.length
                    ? '<div class="dcRowTitle">' + text('Zoekresultaten', 'Search results', 'Suchergebnisse') + '</div><div class="dcGrid">' + list.map(cardHtml).join('') + '</div>'
                    : '<div class="dcMsg">' + text('Niets gevonden voor "', 'Nothing found for "', 'Keine Ergebnisse für "') + esc(q) + '".</div>';
            });
        }

        function showToast(text, isErr) {
            toast.textContent = text;
            toast.className = 'dcToast' + (isErr ? ' err' : '');
            toast.style.display = 'block';
            setTimeout(function () { toast.style.display = 'none'; }, 3500);
        }

        var delArmed = false, delArmTimer = null; // bevestiging in de knop zelf (window.confirm werkt niet in TV-apps)
        function updateButton() {
            var b = overlay.querySelector('.dcBtn');
            var d = overlay.querySelector('.dcBtnDel');
            if (!current) { return; }
            var tb = overlay.querySelector('.dcBtnTrailer');
            tb.textContent = text('Trailer', 'Trailer', 'Trailer');
            if (showTrailer) { tb.classList.add('show'); } else { tb.classList.remove('show'); }
            d.disabled = false;
            delArmed = false; clearTimeout(delArmTimer);
            if (isAdmin && current.Status === 1) { d.textContent = text('Aanvraag annuleren', 'Cancel request', 'Anfrage abbrechen'); d.classList.add('show'); }
            else if (isAdmin && current.Status === 2) { d.textContent = text('Verwijderen', 'Delete', 'Löschen'); d.classList.add('show'); }
            else { d.classList.remove('show'); }
            if (current.Status === 2) { b.textContent = text('Beschikbaar', 'Available', 'Verfügbar'); b.disabled = true; }
            else if (current.Status === 1) { b.textContent = text('Aangevraagd', 'Requested', 'Angefordert'); b.disabled = true; }
            else { b.textContent = text('Aanvragen', 'Request', 'Anfragen'); b.disabled = false; }
        }

        function refreshCards(i) {
            var nodes = view.querySelectorAll('.dcCard[data-key="' + key(i) + '"] .dcStatus');
            for (var n = 0; n < nodes.length; n++) {
                nodes[n].className = 'dcStatus s' + i.Status;
                nodes[n].innerHTML = statusIcon(i.Status);
            }
        }

        function openModal(i) {
            current = i;
            overlay.querySelector('.dcModalBack').style.backgroundImage = i.Backdrop ? 'url(' + i.Backdrop + ')' : 'none';
            var img = overlay.querySelector('.dcModalPoster');
            img.src = i.Poster || '';
            img.style.visibility = i.Poster ? 'visible' : 'hidden';
            overlay.querySelector('.dcModalTitle').textContent = i.Title + (i.Year ? ' (' + i.Year + ')' : '');
            overlay.querySelector('.dcMeta').textContent =
                text(i.Type === 'tv' ? 'Serie' : 'Film', i.Type === 'tv' ? 'Series' : 'Movie', i.Type === 'tv' ? 'Serie' : 'Film') +
                (i.Rating ? '  \u2022  \u2605 ' + i.Rating.toFixed(1) : '');
            overlay.querySelector('.dcOverview').textContent =
                i.Overview || text('Geen beschrijving beschikbaar.', 'No description available.', 'Keine Beschreibung verfügbar.');
            var infoEl = overlay.querySelector('.dcInfo');
            infoEl.textContent = '';
            api('GET', 'Discover/Info', { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                if (current === i && r && r.Lines && r.Lines.length) { infoEl.textContent = r.Lines.join('\n'); }
            }, function () { });
            var ob = overlay.querySelector('.dcBtnOpen');
            ob.classList.remove('show'); ob.removeAttribute('data-id');
            ob.textContent = text('Openen in Emby', 'Open in Emby', 'In Emby öffnen');
            updateButton();
            lastFocus = document.activeElement;
            overlay.classList.add('open');
            // Focus in de popup zetten, anders blijft de afstandsbediening op de kaarten erachter staan.
            setTimeout(function () {
                var t = firstModalButton(overlay);
                if (t && t.focus) { t.focus(); }
            }, 60);
        }

        // ---- Emby-item opzoeken (kanaal "Discover") zodat een klik naar de echte detailpagina gaat ----
        var embyMap = null;      // 'movie:123' / 'tv:123' -> Emby-item-id
        var mapPromise = null;

        function getJson(path, query) {
            return ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl(path, query || {}), dataType: 'json' });
        }

        var rootFolders = null;  // [{ id, name, tv }] van het kanaal, voor het zoeken in genremappen

        function norm(t) {
            return String(t || '').replace(/^[✓⏳]\s*/, '').trim().toLowerCase();
        }

        function mapItems(map, tv, list) {
            list.forEach(function (it) {
                var t = it.ProviderIds && (it.ProviderIds.Tmdb || it.ProviderIds.tmdb);
                if (t) { map[(tv ? 'tv:' : 'movie:') + t] = it.Id; }
                // Reserve: op titel (+ jaar), voor als Emby de provider-id's niet meegeeft.
                var n = norm(it.Name);
                if (n) {
                    map[(tv ? 'tv' : 'movie') + '#' + n + '#' + (it.ProductionYear || '')] = it.Id;
                }
            });
        }

        function buildEmbyMap() {
            if (mapPromise) { return mapPromise; }
            var uid = ApiClient.getCurrentUserId();
            mapPromise = getJson('Channels', { UserId: uid }).then(function (r) {
                var ch = ((r && r.Items) || []).filter(function (c) { return /discover/i.test(c.Name || ''); })[0];
                if (!ch) { throw new Error('kanaal niet gevonden'); }
                channelId = ch.Id;
                return getJson('Channels/' + ch.Id + '/Items', { UserId: uid, Limit: 50 }).then(function (root) {
                    var folders = (root && root.Items) || [];
                    rootFolders = folders.map(function (f) {
                        return { id: f.Id, name: f.Name || '', tv: /serie/i.test(f.Name || '') };
                    });
                    // Alleen de titellijsten; genre- en studiomappen bevatten weer mappen (die ophalen is traag).
                    var lists = rootFolders.filter(function (f) { return !/genre|studio/i.test(f.name); });
                    return Promise.all(lists.map(function (f) {
                        return getJson('Channels/' + ch.Id + '/Items', {
                            UserId: uid, FolderId: f.id, Fields: 'ProviderIds', Limit: 300
                        }).then(function (res) {
                            return { tv: f.tv, items: (res && res.Items) || [] };
                        }, function () { return { tv: f.tv, items: [] }; });
                    }));
                });
            }).then(function (lists) {
                var map = {};
                lists.forEach(function (l) { mapItems(map, l.tv, l.items); });
                embyMap = map;
                return map;
            });
            mapPromise.then(null, function () { mapPromise = null; });
            return mapPromise;
        }

        var channelId = null;

        function lookup(map, i) {
            return map[key(i)] ||
                map[i.Type + '#' + norm(i.Title) + '#' + (i.Year || '')] || null;
        }

        function goToEmbyItem(id) {
            var fallback = function () {
                window.location.hash = '#!/item?id=' + encodeURIComponent(id) + '&serverId=' + encodeURIComponent(ApiClient.serverId());
            };
            // Laat Emby zelf de juiste route kiezen (een kanaalmap opent anders als lege kanaalpagina).
            ApiClient.getItem(ApiClient.getCurrentUserId(), id).then(function (item) {
                try {
                    require(['appRouter'], function (router) {
                        try { router.showItem(item); } catch (e) { fallback(); }
                    }, fallback);
                } catch (e) { fallback(); }
            }, fallback);
        }

        // Staat de titel al in je eigen Emby-bibliotheek (film of serie), dan openen we die.
        function findLibraryItem(i) {
            var uid = ApiClient.getCurrentUserId();
            var tv = i.Type === 'tv';
            var base = {
                Recursive: true, IncludeItemTypes: tv ? 'Series' : 'Movie',
                Fields: 'ProviderIds', Limit: 20
            };
            function pick(res) {
                var list = (res && res.Items) || [];
                for (var k = 0; k < list.length; k++) {
                    var t = list[k].ProviderIds && (list[k].ProviderIds.Tmdb || list[k].ProviderIds.tmdb);
                    if (t && String(t) === String(i.TmdbId)) { return list[k].Id; }
                }
                return null;
            }
            var byId = {}; for (var a in base) { byId[a] = base[a]; }
            byId.AnyProviderIdEquals = 'tmdb.' + i.TmdbId;
            return getJson('Users/' + uid + '/Items', byId).then(function (res) {
                var id = pick(res);
                if (id) { return id; }
                var bySearch = {}; for (var b in base) { bySearch[b] = base[b]; }
                bySearch.SearchTerm = i.Title;
                return getJson('Users/' + uid + '/Items', bySearch).then(pick);
            }).then(null, function () { return null; });
        }

        // TV-apps: geen kanaalpagina's openen maar direct de popup met Aanvragen.
        // isWebTv = LG webOS / Samsung Tizen (trailer via de Emby-speler, de ingebedde YouTube-speler werkt daar niet).
        // isTvClient = elke TV, ook Android TV / Fire TV: Emby zet dan de klasse "layout-tv" op <html>.
        var ua = navigator.userAgent || '';
        var isWebTv = /Web0S|webOS|Tizen|SMART-?TV|NetCast|HbbTV/i.test(ua);
        var de = document.documentElement;
        var isTvClient = isWebTv || !!(de && de.classList && de.classList.contains('layout-tv')) ||
            /Android ?TV|GoogleTV|AFT[A-Z]|BRAVIA|SHIELD Android TV/i.test(ua);
        var lastFocus = null;
        if (isTvClient) { overlay.classList.add('dcTv'); view.classList.add('dcTvPage'); }

        function openItem(i) {
            if (isTvClient) {
                // TV: de popup meteen tonen. De controle of de titel al in je bibliotheek staat loopt op de
                // achtergrond; staat hij er al in, dan verschijnt in de popup een knop "Openen in Emby".
                try { openModal(i); }
                catch (err) { showToast('Popup: ' + (err && err.message ? err.message : err), true); return; }
                findLibraryItem(i).then(function (libId) {
                    if (!libId || current !== i) { return; }
                    var ob = overlay.querySelector('.dcBtnOpen');
                    ob.setAttribute('data-id', libId);
                    ob.classList.add('show');
                });
                return;
            }
            findLibraryItem(i).then(function (libId) {
                if (libId) { goToEmbyItem(libId); return; }
                openChannelItem(i);
            });
        }

        function openChannelItem(i) {
            buildEmbyMap().then(function (map) {
                var id = lookup(map, i);
                if (id) { goToEmbyItem(id); return; }
                openModal(i); // niet in bibliotheek of hoofdlijsten: kleine popup
            }, function () { openModal(i); });
        }

        function closeModal() {
            overlay.classList.remove('open'); current = null;
            if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
        }

        // ---- Trailer op de TV: rechtstreeks via de YouTube-speler van Emby (de ingebedde iframe werkt niet in de TV-app) ----
        // De YouTube-speler van Emby (canPlayUrl) herkent een item alleen via item.Url met youtube.com en leest de
        // sleutel uit ?v=KEY. Daarom: geen server-Id, geen PlayAccessState, wel Url (en Path met dezelfde link).
        function playTrailerOnTv(i, btn) {
            var noTrailer = text('Geen trailer beschikbaar voor deze titel.', 'No trailer available for this title.', 'Kein Trailer für diesen Titel verfügbar.');
            function finish() { btn.disabled = false; }
            function fail(msg) { finish(); showToast(msg, true); }
            function reason(e) { return (e && (e.message || e.statusText || e.name)) ? (e.message || e.statusText || e.name) : String(e); }
            function playRemote(key) {
                var link = 'https://www.youtube.com/watch?v=' + encodeURIComponent(key);
                require(['playbackManager'], function (pm) {
                    try {
                        // Controle vooraf: pm.play vangt afspeelfouten zelf op en toont dan alleen Embys eigen "Afspeelfout".
                        // Zo zie je hier wel waarom het niet lukt (welke spelers zijn er, en kan er een de link aan?).
                        var players = (pm.getPlayers && pm.getPlayers()) || [];
                        var canPlay = players.filter(function (p) {
                            try { return p.canPlayUrl && p.canPlayUrl(link) && (!p.canPlayMediaType || p.canPlayMediaType('Video')); } catch (e) { return false; }
                        });
                        if (!canPlay.length) {
                            fail(text('Geen YouTube-speler beschikbaar. Spelers: ', 'No YouTube player available. Players: ', 'Kein YouTube-Player verfügbar. Player: ') +
                                players.map(function (p) { return p.id || p.name; }).join(', '));
                            return;
                        }
                        setTimeout(finish, 15000); // knop weer vrijgeven als de speler nooit antwoordt
                        var res = pm.play({ items: [{
                            Name: i.Title + ' - Trailer', Type: 'Trailer', MediaType: 'Video',
                            Url: link, Path: link, ServerId: ApiClient.serverId()
                        }] });
                        if (res && typeof res.then === 'function') {
                            res.then(finish, function (e) {
                                fail(text('Trailer afspelen mislukt: ', 'Playing trailer failed: ', 'Trailer-Wiedergabe fehlgeschlagen: ') + reason(e));
                            });
                        } else { finish(); }
                    } catch (e) {
                        fail(text('Trailer afspelen mislukt: ', 'Playing trailer failed: ', 'Trailer-Wiedergabe fehlgeschlagen: ') + reason(e));
                    }
                }, function (e) {
                    fail(text('Emby-speler niet beschikbaar: ', 'Emby player not available: ', 'Emby-Player nicht verfügbar: ') + reason(e));
                });
            }
            showToast(text('Trailer laden...', 'Loading trailer...', 'Trailer wird geladen...'), false);
            api('GET', 'Discover/TrailerKey', { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                if (!r || !r.Key) { fail(noTrailer); return; }
                playRemote(r.Key);
            }, function (e) {
                fail(text('Trailer ophalen mislukt: ', 'Fetching trailer failed: ', 'Trailer abrufen fehlgeschlagen: ') + reason(e));
            });
        }

        // ---- events ----
        content.addEventListener('click', function (e) {
            var card = e.target.closest ? e.target.closest('.dcCard') : null;
            if (card && items[card.getAttribute('data-key')]) { openItem(items[card.getAttribute('data-key')]); }
        });

        content.addEventListener('click', function (e) {
            var t = e.target;
            var tile = t.closest ? t.closest('.dcTile') : null;
            if (tile) {
                openBrowse(tile.getAttribute('data-kind'), parseInt(tile.getAttribute('data-id'), 10), tile.getAttribute('data-name'));
                return;
            }
            if (t.closest && t.closest('.dcBack')) { loadHome(); return; }
            if (t.closest && t.closest('.dcMoreBtn')) { loadBrowse(); }
        });

        // TV / afstandsbediening: OK (Enter) op een kaart of tegel werkt als klik,
        // en het gefocuste item scrolt netjes in beeld.
        content.addEventListener('keydown', function (e) {
            var k = e.key || '';
            if (k !== 'Enter' && k !== ' ' && e.keyCode !== 13 && e.keyCode !== 32) { return; }
            var el = e.target;
            if (el && el.classList && (el.classList.contains('dcCard') || el.classList.contains('dcTile'))) {
                e.preventDefault();
                el.click();
            }
        });
        content.addEventListener('focusin', function (e) {
            var el = e.target;
            if (el && el.classList && (el.classList.contains('dcCard') || el.classList.contains('dcTile')) && el.scrollIntoView) {
                try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) { el.scrollIntoView(); }
            }
        });

        // scroll-events borrelen niet op, dus in de capture-fase luisteren
        content.addEventListener('scroll', function (e) {
            var el = e.target;
            if (el && el.classList && el.classList.contains('dcRow')) { maybeLoadMore(el); }
        }, true);

        content.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('.dcArrow') : null;
            if (!btn) { return; }
            var row = btn.parentNode.querySelector('.dcRow');
            if (!row) { return; }
            var dir = parseInt(btn.getAttribute('data-dir'), 10) || 1;
            var amount = Math.max(300, row.clientWidth * 0.85) * dir;
            if (row.scrollBy) { row.scrollBy({ left: amount, behavior: 'smooth' }); }
            else { row.scrollLeft += amount; }
            setTimeout(function () { maybeLoadMore(row); }, 400);
        });

        overlay.querySelector('.dcClose').addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeModal(); } });

        overlay.querySelector('.dcBtn').addEventListener('click', function () {
            var i = current;
            if (!i || i.Status !== 0) { return; }
            var b = this;
            b.disabled = true;
            b.textContent = text('Aanvragen...', 'Requesting...', 'Wird angefragt...');
            api('POST', 'Discover/RequestItem', null, { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                if (r && r.Success) {
                    i.Status = 1;
                    refreshCards(i);
                    showToast(i.Title + ': ' + r.Message, false);
                } else {
                    showToast(text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ((r && r.Message) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')), true);
                }
                updateButton();
            }, function () {
                showToast(text('Aanvraag mislukt.', 'Request failed.', 'Anfrage fehlgeschlagen.'), true);
                updateButton();
            });
        });

        overlay.querySelector('.dcBtnDel').addEventListener('click', function () {
            var i = current;
            if (!i || i.Status === 0) { return; }
            var arr = i.Type === 'tv' ? 'Sonarr' : 'Radarr';
            var withFiles = i.Status === 2;
            var q = withFiles
                ? text('"' + i.Title + '" verwijderen uit ' + arr + ' EN de bestanden van schijf verwijderen?',
                    'Delete "' + i.Title + '" from ' + arr + ' AND delete its files from disk?',
                    '"' + i.Title + '" aus ' + arr + ' entfernen UND die Dateien von der Festplatte löschen?')
                : text('De aanvraag voor "' + i.Title + '" annuleren en verwijderen uit ' + arr + '?',
                    'Cancel the request for "' + i.Title + '" and remove it from ' + arr + '?',
                    'Die Anfrage für "' + i.Title + '" abbrechen und aus ' + arr + ' entfernen?');
            var d = this;
            // Eerste klik: knop wordt 'bevestig' (6 s geldig). Tweede klik voert uit. Geen window.confirm: dat doet niets in TV-apps.
            if (!delArmed) {
                delArmed = true;
                d.textContent = withFiles
                    ? text('Bevestig: verwijderen + bestanden', 'Confirm: delete + files', 'Bestätigen: löschen + Dateien')
                    : text('Bevestig: aanvraag annuleren', 'Confirm: cancel request', 'Bestätigen: Anfrage abbrechen');
                showToast(q, false);
                clearTimeout(delArmTimer);
                delArmTimer = setTimeout(function () { if (delArmed) { updateButton(); } }, 6000);
                return;
            }
            delArmed = false; clearTimeout(delArmTimer);
            d.disabled = true;
            api('POST', 'Discover/RemoveItem', null, { Type: i.Type, TmdbId: i.TmdbId, DeleteFiles: withFiles }).then(function (r) {
                if (r && r.Success) {
                    i.Status = 0;
                    refreshCards(i);
                    showToast(i.Title + ': ' + r.Message, false);
                } else {
                    showToast(text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ((r && r.Message) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')), true);
                }
                updateButton();
            }, function () {
                showToast(text('Verwijderen mislukt (alleen beheerders mogen dit).',
                    'Delete failed (only administrators can do this).',
                    'Löschen fehlgeschlagen (nur Administratoren dürfen dies).'), true);
                updateButton();
            });
        });

        input.addEventListener('input', function () {
            clearTimeout(searchTimer);
            var q = input.value.trim();
            searchTimer = setTimeout(function () {
                if (q.length < 2) { if (loaded) { loadHome(); } return; }
                doSearch(q);
            }, 400);
        });

        overlay.querySelector('.dcBtnOpen').addEventListener('click', function () {
            var id = this.getAttribute('data-id');
            if (!id) { return; }
            closeModal();
            goToEmbyItem(id);
        });

        // ---- Trailer in de popup (YouTube-embed), alleen als de trailertegel in de instellingen aan staat ----
        var trailerOverlay = view.querySelector('.dcTrailerOverlay');
        var trailerFrame = trailerOverlay.querySelector('.dcTrailerFrame');
        var trailerLink = trailerOverlay.querySelector('.dcTrailerLink');
        function closeTrailer() { trailerOverlay.classList.remove('open'); trailerFrame.src = 'about:blank'; }
        trailerOverlay.querySelector('.dcTrailerClose').addEventListener('click', closeTrailer);
        trailerOverlay.addEventListener('click', function (e) { if (e.target === trailerOverlay) { closeTrailer(); } });
        overlay.querySelector('.dcBtnTrailer').addEventListener('click', function () {
            var i = current;
            if (!i) { return; }
            var b = this;
            b.disabled = true;
            // Keuze op herkomst, niet op "is het een tv":
            //  - file:// = ingepakte app (officiële LG/Tizen-app, Android-APK): de ingebedde YouTube-speler
            //    krijgt geen geldige herkomst, dus via de Emby-speler.
            //  - http(s):// = browser of een eigen schil-app die de webclient van de server laadt: de ingebedde
            //    speler werkt daar wel, en de Emby-speler kan in een kale webview (zonder native medialijm) hangen.
            if (location.protocol === 'file:') { playTrailerOnTv(i, b); return; }
            api('GET', 'Discover/TrailerKey', { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                b.disabled = false;
                if (!r || !r.Key) { showToast(text('Geen trailer beschikbaar voor deze titel.', 'No trailer available for this title.', 'Kein Trailer für diesen Titel verfügbar.'), true); return; }
                trailerFrame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(r.Key) + '?autoplay=1&rel=0&playsinline=1&origin=' + encodeURIComponent(window.location.origin);
                trailerLink.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(r.Key);
                trailerLink.textContent = text('Werkt de trailer niet? Open op YouTube', 'Trailer not playing? Open on YouTube', 'Trailer lädt nicht? Auf YouTube öffnen');
                trailerOverlay.classList.add('open');
                setTimeout(function () { trailerOverlay.querySelector('.dcTrailerClose').focus(); }, 60);
            }, function () {
                b.disabled = false;
                showToast(text('Trailer ophalen mislukt.', 'Fetching trailer failed.', 'Trailer abrufen fehlgeschlagen.'), true);
            });
        });

        // Focus blijft in de popup en de Terug-toets (webOS 461, Tizen 10009, Esc) sluit hem.
        view.addEventListener('focusin', function (e) {
            if (!overlay.classList.contains('open')) { return; }
            var host = trailerOverlay.classList.contains('open') ? trailerOverlay : overlay;
            if (!host.contains(e.target)) {
                // Terug naar de knoppenrij (Aanvragen eerst), niet naar het kruisje: anders is Aanvragen
                // met de afstandsbediening onbereikbaar zodra de focus even buiten de popup komt.
                var t = firstModalButton(host);
                if (t) { t.focus(); }
            }
        });
        view.addEventListener('keydown', function (e) {
            var c = e.keyCode;
            if (c !== 27 && c !== 461 && c !== 10009) { return; }
            if (trailerOverlay.classList.contains('open')) { e.preventDefault(); e.stopPropagation(); closeTrailer(); }
            else if (overlay.classList.contains('open')) { e.preventDefault(); e.stopPropagation(); closeModal(); }
        }, true);

        // ---- Afstandsbediening op TV (Android TV, Fire TV, webOS, Tizen) ----
        // Emby stuurt elke druk op de pijltjes, OK en Terug eerst als "command"-gebeurtenis rond. Wordt die
        // geannuleerd, dan doet Emby zelf niets. Zo regelt deze pagina de navigatie zelf: Emby's eigen
        // ruimtelijke navigatie kent de rijen en de popup van Discover niet, sprong achter de popup en opende
        // het zijmenu bij de eerste druk omlaag.
        function isShown(el) { return !!(el && el.offsetParent !== null); }
        function isUsable(el) { return isShown(el) && !el.disabled; }

        function modalButtons(host) {
            if (host === trailerOverlay) { return [trailerOverlay.querySelector('.dcTrailerClose')]; }
            return Array.prototype.filter.call(overlay.querySelectorAll('.dcBtnRow button'), isUsable);
        }
        function firstModalButton(host) {
            return modalButtons(host)[0] || host.querySelector('.dcClose');
        }

        function focusEl(el) {
            if (!el) { return; }
            try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
            if (el.scrollIntoView) {
                try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) { el.scrollIntoView(false); }
            }
        }

        // Regels van boven naar onder: zoekbalk, Terug, elke rij, rasterregels, "Meer laden".
        function navLines() {
            var lines = [];
            if (isShown(input)) { lines.push([input]); }
            var parts = content.querySelectorAll('.dcBack, .dcRow, .dcGrid, .dcMoreBtn');
            Array.prototype.forEach.call(parts, function (p) {
                if (!isShown(p)) { return; }
                if (p.classList.contains('dcBack') || p.classList.contains('dcMoreBtn')) {
                    if (isUsable(p)) { lines.push([p]); }
                    return;
                }
                var kids = Array.prototype.filter.call(p.children, function (c) {
                    return c.classList && (c.classList.contains('dcCard') || c.classList.contains('dcTile'));
                });
                if (!kids.length) { return; }
                if (p.classList.contains('dcRow')) { lines.push(kids); return; }
                // raster: per regel groeperen op hoogte
                var byTop = [], tops = [];
                kids.forEach(function (c) {
                    var t = Math.round(c.offsetTop / 10);
                    var k = tops.indexOf(t);
                    if (k === -1) { tops.push(t); byTop.push([c]); } else { byTop[k].push(c); }
                });
                byTop.forEach(function (l) { lines.push(l); });
            });
            return lines;
        }

        function findInLines(lines, el) {
            for (var a = 0; a < lines.length; a++) {
                var b = lines[a].indexOf(el);
                if (b !== -1) { return [a, b]; }
            }
            return null;
        }

        function closestInLine(line, x) {
            var best = null, bestD = Infinity, w = window.innerWidth || 1920;
            line.forEach(function (el) {
                var r = el.getBoundingClientRect();
                var inView = r.right > 0 && r.left < w;
                var d = Math.abs(r.left + r.width / 2 - x) + (inView ? 0 : 1e6);
                if (d < bestD) { bestD = d; best = el; }
            });
            return best;
        }

        function focusFirstItem() {
            var lines = navLines();
            var first = null;
            for (var a = 0; a < lines.length && !first; a++) {
                if (lines[a][0] !== input) { first = lines[a][0]; }
            }
            focusEl(first || input);
        }

        // true = afgehandeld (Emby moet niets doen)
        function navPage(dir, active) {
            var lines = navLines();
            var pos = findInLines(lines, active);
            if (!pos) { focusFirstItem(); return true; }
            var line = lines[pos[0]], i = pos[1];
            var r = active.getBoundingClientRect(), x = r.left + r.width / 2;
            if (dir === 'left') {
                if (i > 0) { focusEl(line[i - 1]); return true; }
                return false; // helemaal links: Emby mag het zijmenu openen
            }
            if (dir === 'right') {
                if (i < line.length - 1) {
                    focusEl(line[i + 1]);
                    var row = line[i + 1].parentNode;
                    if (row && row.classList.contains('dcRow')) { setTimeout(function () { maybeLoadMore(row); }, 50); }
                }
                return true;
            }
            if (dir === 'up') {
                if (pos[0] > 0) { focusEl(closestInLine(lines[pos[0] - 1], x)); return true; }
                return false; // bovenaan: naar de kopbalk van Emby (terug, start)
            }
            if (dir === 'down') {
                if (pos[0] < lines.length - 1) { focusEl(closestInLine(lines[pos[0] + 1], x)); }
                return true;
            }
            return false;
        }

        function navModal(dir, active) {
            if (trailerOverlay.classList.contains('open')) {
                focusEl(trailerOverlay.querySelector('.dcTrailerClose'));
                return;
            }
            var row = modalButtons(overlay);
            var close = overlay.querySelector('.dcClose');
            var i = row.indexOf(active);
            if (active === close) {
                if (dir === 'down' || dir === 'left') { focusEl(row[0] || close); }
                return;
            }
            if (i === -1) { focusEl(row[0] || close); return; }
            if (dir === 'left' && i > 0) { focusEl(row[i - 1]); }
            else if (dir === 'right' && i < row.length - 1) { focusEl(row[i + 1]); }
            else if (dir === 'up') { focusEl(close); }
        }

        var lastKeyClick = 0;
        content.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) { lastKeyClick = Date.now(); }
        }, true);

        // Alleen reageren als we daadwerkelijk op de Discover-pagina staan. Zo kan deze afvanger nooit de
        // afstandsbediening "opslokken" op Emby's eigen pagina's (bijv. Instellingen), ook niet als Emby bij
        // het verlaten geen viewhide stuurt en de command-listener blijft hangen.
        function onDiscoverRoute() {
            var h = (location.hash || '').toLowerCase();
            return h.indexOf('configurationpage') !== -1 && h.indexOf('discoverui') !== -1;
        }
        function onCommand(e) {
            if (!isTvClient || !onDiscoverRoute() || !document.body.contains(view) || !isShown(view.querySelector('.dcRoot'))) { return; }
            var cmd = e.detail && e.detail.command;
            var active = document.activeElement;
            var trailerOpen = trailerOverlay.classList.contains('open');
            var modalOpen = overlay.classList.contains('open') || trailerOpen;
            if (cmd === 'back') {
                if (trailerOpen) { e.preventDefault(); closeTrailer(); return; }
                if (overlay.classList.contains('open')) { e.preventDefault(); closeModal(); return; }
                if (browse) { e.preventDefault(); loadHome(); return; } // terug uit een genre-/studio-overzicht
                return; // anders: Emby verlaat de pagina
            }
            if (cmd === 'select') {
                // OK op een kaart of tegel is al als klik afgehandeld bij keydown; niet nog eens.
                if (active && active.classList && (active.classList.contains('dcCard') || active.classList.contains('dcTile')) &&
                    Date.now() - lastKeyClick < 1500) { e.preventDefault(); }
                return;
            }
            if (cmd !== 'up' && cmd !== 'down' && cmd !== 'left' && cmd !== 'right') { return; }
            if (modalOpen) { e.preventDefault(); navModal(cmd, active); return; }
            // Zijmenu open of focus in de kopbalk: Emby navigeert zelf; alleen omlaag vanuit de kopbalk naar de pagina.
            if (active && active.closest && active.closest('.mainDrawer, .navDrawer, .drawer')) { return; }
            if (active && active.closest && active.closest('.skinHeader')) {
                if (cmd === 'down') { e.preventDefault(); focusFirstItem(); }
                return;
            }
            if (!active || active === document.body || !view.contains(active)) {
                e.preventDefault(); focusFirstItem(); return;
            }
            if (navPage(cmd, active)) { e.preventDefault(); }
        }

        view.addEventListener('viewshow', function () { document.addEventListener('command', onCommand, true); });
        view.addEventListener('viewhide', function () { document.removeEventListener('command', onCommand, true); });

        // ---- Directe link vanaf een film-/seriepagina: #!/configurationpage?name=...&openType=movie&openId=123 ----
        function openFromLink() {
            var m = /[?&]openType=(movie|tv)&openId=(\d+)/.exec(window.location.hash || '');
            if (!m) { return; }
            // Parameters weghalen, anders brengt de terugknop je weer naar dezelfde titel.
            try { history.replaceState(null, '', window.location.href.replace(/&openType=[^&]*&openId=\d+/, '')); } catch (e) { }
            api('GET', 'Discover/Title', { Type: m[1], TmdbId: parseInt(m[2], 10) }).then(function (r) {
                if (!r || !r.Found || !r.Item) { showToast(text('Titel niet gevonden.', 'Title not found.', 'Titel nicht gefunden.'), true); return; }
                items[key(r.Item)] = r.Item;
                openItem(r.Item);
            }, function () {
                showToast(text('Titel laden mislukt.', 'Loading title failed.', 'Titel konnte nicht geladen werden.'), true);
            });
        }

        view.addEventListener('viewshow', function () {
            if (!loaded) { loadHome(); }
            openFromLink();
        });
    };
});
