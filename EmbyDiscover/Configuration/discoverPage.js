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
        if (window.__discoverRequestButtonVersion === '1.1.0') {
            diag.load = text('script is al actief v1.1.0', 'script already active v1.1.0', 'Skript bereits aktiv v1.1.0');
            showDiag();
            return;
        }
        var urls = [
            ApiClient.getUrl('web/ConfigurationPage', { name: 'discoverbuttonjs1081' }),
            ApiClient.getUrl('web/configurationpage', { name: 'discoverbuttonjs1081' }),
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
                if (window.__discoverRequestButtonVersion === '1.1.0') {
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
            return '<div class="dcCard" data-key="' + key(i) + '">' + poster +
                '<span class="dcBadge ' + i.Type + '">' + (i.Type === 'tv' ? 'SERIE' : 'FILM') + '</span>' +
                '<span class="dcStatus s' + i.Status + '">' + statusIcon(i.Status) + '</span></div>';
        }

        function tileHtml(r, t) {
            var inner = t.Image
                ? '<img class="dcTileLogo" loading="lazy" src="' + esc(t.Image) + '" alt="' + esc(t.Name) + '" />'
                : '<span>' + esc(t.Name) + '</span>';
            return '<div class="dcTile' + (t.Image ? ' logo' : '') + '" data-kind="' + esc(r.TileKind) + '" data-id="' + esc(t.Id) +
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
                if (grid && fresh.length) { grid.insertAdjacentHTML('beforeend', fresh.map(cardHtml).join('')); }
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
            content.innerHTML = '<div class="dcMsg">' + text('Laden...', 'Loading...', 'Wird geladen...') + '</div>';
            api('GET', 'Discover/Home').then(function (r) {
                var culture = String(r.Language || '').toLowerCase();
                uiLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : 'en';
                input.placeholder = text('Films en series zoeken', 'Search movies and series', 'Filme und Serien suchen');
                if (r.Message) { content.innerHTML = '<div class="dcMsg">' + esc(r.Message) + '</div>'; return; }
                renderRows(r.Rows || []);
                loaded = true;
            }, function () {
                content.innerHTML = '<div class="dcMsg">' + text(
                    'Laden mislukt. Controleer of de plugin is bijgewerkt en Emby opnieuw is gestart.',
                    'Loading failed. Check that the plugin is updated and Emby has been restarted.',
                    'Laden fehlgeschlagen. Prüfe, ob das Plugin aktualisiert und Emby neu gestartet wurde.') + '</div>';
            });
        }

        function doSearch(q) {
            browse = null;
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

        function updateButton() {
            var b = overlay.querySelector('.dcBtn');
            var d = overlay.querySelector('.dcBtnDel');
            if (!current) { return; }
            d.disabled = false;
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
            updateButton();
            overlay.classList.add('open');
        }

        // ---- Emby-item opzoeken (kanaal "Discover") zodat een klik naar de echte detailpagina gaat ----
        var embyMap = null;      // 'movie:123' / 'tv:123' -> Emby-item-id
        var mapPromise = null;

        function getJson(path, query) {
            return ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl(path, query || {}), dataType: 'json' });
        }

        function buildEmbyMap() {
            if (mapPromise) { return mapPromise; }
            var uid = ApiClient.getCurrentUserId();
            mapPromise = getJson('Channels', { UserId: uid }).then(function (r) {
                var ch = ((r && r.Items) || []).filter(function (c) { return /discover/i.test(c.Name || ''); })[0];
                if (!ch) { throw new Error('kanaal niet gevonden'); }
                return getJson('Channels/' + ch.Id + '/Items', { UserId: uid, Limit: 50 }).then(function (root) {
                    var folders = (root && root.Items) || [];
                    return Promise.all(folders.map(function (f) {
                        var tv = /serie/i.test(f.Name || '');
                        return getJson('Channels/' + ch.Id + '/Items', {
                            UserId: uid, FolderId: f.Id, Fields: 'ProviderIds', Limit: 300
                        }).then(function (res) {
                            return { tv: tv, items: (res && res.Items) || [] };
                        }, function () { return { tv: tv, items: [] }; });
                    }));
                });
            }).then(function (lists) {
                var map = {};
                lists.forEach(function (l) {
                    l.items.forEach(function (it) {
                        var t = it.ProviderIds && (it.ProviderIds.Tmdb || it.ProviderIds.tmdb);
                        if (t) { map[(l.tv ? 'tv:' : 'movie:') + t] = it.Id; }
                    });
                });
                embyMap = map;
                return map;
            });
            mapPromise.then(null, function () { mapPromise = null; });
            return mapPromise;
        }

        function openItem(i) {
            buildEmbyMap().then(function (map) {
                var id = map[key(i)];
                if (id) {
                    window.location.hash = '#!/item?id=' + encodeURIComponent(id) + '&serverId=' + encodeURIComponent(ApiClient.serverId());
                } else {
                    openModal(i); // niet in het kanaal (bijv. zoekresultaat): kleine popup
                }
            }, function () { openModal(i); });
        }

        function closeModal() { overlay.classList.remove('open'); current = null; }

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
            if (!window.confirm(q)) { return; }
            var d = this;
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

        view.addEventListener('viewshow', function () {
            if (!loaded) { loadHome(); }
        });
    };
});
