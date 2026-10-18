define([], function () {
    'use strict';

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
    var diag = { load: 'nog niet geprobeerd', status: '' };
    var diagEl = null;

    function showDiag() {
        if (!diagEl) { return; }
        diagEl.textContent = 'Diagnose: knop-script actief in browser: ' + (window.__discoverRequestButton ? 'JA v' + (window.__discoverRequestButtonVersion || 'oud (<0.14.6)') : 'NEE') +
            '\nladen vanaf Discover-pagina: ' + diag.load +
            '\nserver: ' + (diag.status || '...');
    }

    function injectCode(code, from) {
        if (window.__discoverRequestButton) { diag.load = 'script was al actief'; return true; }
        if (!code || code.length < 200) { diag.load = 'leeg antwoord van ' + from; return false; }
        try {
            var sc = document.createElement('script');
            sc.id = 'discover-request-button-inline';
            sc.textContent = code;
            document.head.appendChild(sc);
            diag.load = window.__discoverRequestButton ? 'OK via ' + from : 'uitgevoerd maar niet gestart (' + from + ')';
            return !!window.__discoverRequestButton;
        } catch (e) { diag.load = 'uitvoeren mislukt: ' + e; return false; }
    }

    // Laadt het Aanvragen-knop-script ook vanaf deze pagina (Emby is een single-page app: het blijft actief
    // tot je de pagina volledig herlaadt). Zo werkt de knop ook als index.html door een andere plugin is overschreven.
    function loadButtonScript() {
        if (window.__discoverRequestButton) { diag.load = 'script was al actief'; showDiag(); return; }
        var urls = [
            ApiClient.getUrl('web/ConfigurationPage', { name: 'discoverbuttonjs' }),
            ApiClient.getUrl('web/configurationpage', { name: 'discoverbuttonjs' }),
            ApiClient.getUrl('Plugins/Discover/Script')
        ];
        var n = 0;
        (function next() {
            if (n >= urls.length) { diag.load += ' (alle adressen mislukt)'; showDiag(); return; }
            var u = urls[n++];
            ApiClient.ajax({ type: 'GET', url: u, dataType: 'text' }).then(function (code) {
                if (!injectCode(code, u)) { next(); } else { showDiag(); }
                showDiag();
            }, function (e) {
                diag.load = 'mislukt ' + u + ' -> ' + (e && (e.status || e.statusText) || e);
                next();
            });
        })();
    }

    return function (view, params) {
        diagEl = view.querySelector('.dcDiag');
        loadButtonScript();
        api('GET', 'Discover/Status').then(function (r) {
            diag.status = 'v' + (r.PluginVersion || '?') + ' | index.html: ' + (r.ButtonScript || 'onbekend');
            showDiag();
        }, function () { diag.status = 'status ophalen mislukt'; showDiag(); });
        setTimeout(showDiag, 1500);
        var content = view.querySelector('.dcContent');
        var input = view.querySelector('.dcSearchInput');
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
            content.innerHTML = '<div class="dcBrowseHead"><button type="button" class="dcBack">&#10094; Terug</button>' +
                '<span class="dcBrowseTitle">' + esc(name) + '</span></div>' +
                '<div class="dcGrid dcBrowseGrid"></div>' +
                '<div class="dcMore"><button type="button" class="dcBtn dcMoreBtn">Meer laden</button></div>';
            var root = view.querySelector('.dcRoot');
            if (root) { root.scrollTop = 0; }
            loadBrowse();
        }

        function loadBrowse() {
            var b = browse;
            if (!b || b.loading || b.done) { return; }
            b.loading = true;
            var btn = content.querySelector('.dcMoreBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Laden...'; }
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
                if (btn) { btn.disabled = false; btn.textContent = 'Meer laden'; }
                if (b.done && !b.seenAny && !fresh.length && grid && !grid.children.length) {
                    grid.innerHTML = '<div class="dcMsg">Geen resultaten.</div>';
                }
            }, function () {
                b.loading = false;
                if (btn) { btn.disabled = false; btn.textContent = 'Opnieuw proberen'; }
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
            content.innerHTML = html || '<div class="dcMsg">Geen resultaten.</div>';
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
            content.innerHTML = '<div class="dcMsg">Laden...</div>';
            api('GET', 'Discover/Home').then(function (r) {
                if (r.Message) { content.innerHTML = '<div class="dcMsg">' + esc(r.Message) + '</div>'; return; }
                renderRows(r.Rows || []);
                loaded = true;
            }, function () {
                content.innerHTML = '<div class="dcMsg">Laden mislukt. Controleer of de plugin is bijgewerkt en Emby opnieuw is gestart.</div>';
            });
        }

        function doSearch(q) {
            browse = null;
            api('GET', 'Discover/Search', { Query: q }).then(function (r) {
                var list = r.Items || [];
                content.innerHTML = list.length
                    ? '<div class="dcRowTitle">Zoekresultaten</div><div class="dcGrid">' + list.map(cardHtml).join('') + '</div>'
                    : '<div class="dcMsg">Niets gevonden voor "' + esc(q) + '".</div>';
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
            if (isAdmin && current.Status === 1) { d.textContent = 'Aanvraag annuleren'; d.classList.add('show'); }
            else if (isAdmin && current.Status === 2) { d.textContent = 'Verwijderen'; d.classList.add('show'); }
            else { d.classList.remove('show'); }
            if (current.Status === 2) { b.textContent = 'Beschikbaar'; b.disabled = true; }
            else if (current.Status === 1) { b.textContent = 'Aangevraagd'; b.disabled = true; }
            else { b.textContent = 'Aanvragen'; b.disabled = false; }
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
                (i.Type === 'tv' ? 'Serie' : 'Film') + (i.Rating ? '  \u2022  \u2605 ' + i.Rating.toFixed(1) : '');
            overlay.querySelector('.dcOverview').textContent = i.Overview || 'Geen beschrijving beschikbaar.';
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
            b.textContent = 'Aanvragen...';
            api('POST', 'Discover/RequestItem', null, { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                if (r && r.Success) {
                    i.Status = 1;
                    refreshCards(i);
                    showToast(i.Title + ': ' + r.Message, false);
                } else {
                    showToast('Mislukt: ' + ((r && r.Message) || 'onbekende fout'), true);
                }
                updateButton();
            }, function () {
                showToast('Aanvraag mislukt.', true);
                updateButton();
            });
        });

        overlay.querySelector('.dcBtnDel').addEventListener('click', function () {
            var i = current;
            if (!i || i.Status === 0) { return; }
            var arr = i.Type === 'tv' ? 'Sonarr' : 'Radarr';
            var withFiles = i.Status === 2;
            var q = withFiles
                ? '"' + i.Title + '" verwijderen uit ' + arr + ' EN de bestanden van schijf verwijderen?'
                : 'De aanvraag voor "' + i.Title + '" annuleren en verwijderen uit ' + arr + '?';
            if (!window.confirm(q)) { return; }
            var d = this;
            d.disabled = true;
            api('POST', 'Discover/RemoveItem', null, { Type: i.Type, TmdbId: i.TmdbId, DeleteFiles: withFiles }).then(function (r) {
                if (r && r.Success) {
                    i.Status = 0;
                    refreshCards(i);
                    showToast(i.Title + ': ' + r.Message, false);
                } else {
                    showToast('Mislukt: ' + ((r && r.Message) || 'onbekende fout'), true);
                }
                updateButton();
            }, function () {
                showToast('Verwijderen mislukt (alleen beheerders mogen dit).', true);
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
