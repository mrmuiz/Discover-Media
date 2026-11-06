define([], function () {
    'use strict';

    var uiLanguage = 'nl';
    function text(dutch, english, german, norwegian) {
        return uiLanguage === 'de' ? (german || english) : uiLanguage === 'no' ? (norwegian || english) : uiLanguage === 'en' ? english : dutch;
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
            (window.__discoverRequestButton ? text('JA v', 'YES v', 'JA v') + (window.__discoverRequestButtonVersion || text('oud (<0.14.6)', 'old (<0.14.6)', 'alt (<0.14.6)')) + ' build ' + (window.__discoverRequestButtonBuild || '?') : text('NEE', 'NO', 'NEIN')) +
            '\n' + text('laden vanaf Discover-pagina: ', 'loaded from Discover page: ', 'von der Discover-Seite geladen: ') + diag.load +
            '\n' + text('server: ', 'server: ', 'Server: ') + (diag.status || '...');
    }

    // Load as an external script so Emby's Content-Security-Policy does not block inline execution.
    function loadButtonScript() {
        if (window.__discoverRequestButtonVersion === '1.4.0.3') {
            diag.load = text('script is al actief v1.4.0.3', 'script already active v1.4.0.3', 'Skript bereits aktiv v1.4.0.3');
            showDiag();
            return;
        }
        var urls = [
            ApiClient.getUrl('web/ConfigurationPage', { name: 'discoverbuttonjs1412' }),
            ApiClient.getUrl('web/configurationpage', { name: 'discoverbuttonjs1412' }),
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
                if (window.__discoverRequestButtonVersion === '1.4.0.3') {
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

    var UI_PAGE = 'discoverui1110';

    return function (view, params) {
        // embedded: alleen de popup, over een andere Emby-pagina heen (film-, serie- of acteurspagina).
        var embedded = !!(params && params.embedded);
        if (embedded) {
            var lc = String(document.documentElement.lang || '').toLowerCase();
            uiLanguage = lc.indexOf('nl') === 0 ? 'nl' : lc.indexOf('de') === 0 ? 'de' : (lc.indexOf('nb') === 0 || lc.indexOf('nn') === 0 || lc.indexOf('no') === 0) ? 'no' : 'en';
        }
        // Themakleur: dezelfde functie als het knop-script (dat misschien nog niet geladen is).
        function applyAccent(hex) {
            if (window.__dcApplyAccent) { window.__dcApplyAccent(hex); return; }
            if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) { return; }
            var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
            var st = document.documentElement.style;
            st.setProperty('--dc-accent', hex);
            st.setProperty('--dc-accent-rgb', r + ',' + g + ',' + b);
            st.setProperty('--dc-accent-text', (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff');
            try { localStorage.setItem('dcAccent', hex); } catch (e) { }
        }
        try { var savedAccent = localStorage.getItem('dcAccent'); if (savedAccent) { applyAccent(savedAccent); } } catch (e) { }
        var omdbOn = false;
        diagEl = view.querySelector('.dcDiag');
        diagEl.style.display = 'none';
        loadButtonScript();
        api('GET', 'Discover/Status').then(function (r) {
            diagEl.style.display = r.ShowDiagnostics ? '' : 'none';
            showTrailer = r.ShowTrailerTile !== false;
            // Weergave: themakleur en wat er onder de posters staat (klassen op <html>, zie de CSS).
            applyAccent(r.AccentColor);
            document.documentElement.classList.toggle('dcNoYear', r.PosterShowYear === false);
            document.documentElement.classList.toggle('dcNoScore', r.PosterShowScore === false);
            omdbOn = !!r.OmdbRatings;
            fourK = { movie: !!r.Seerr4kMovie, tv: !!r.Seerr4kTv };
            window.__discoverRequestService = r.RequestService || '';
            diag.status = 'v' + (r.PluginVersion || '?') + ' | ' + text('pluginresource: ', 'plugin resource: ', 'Pluginressource: ') + (r.ButtonScript || text('onbekend', 'unknown', 'unbekannt'));
            showDiag();
        }, function () { diag.status = text('status ophalen mislukt', 'could not fetch status', 'Status konnte nicht abgerufen werden'); showDiag(); });
        setTimeout(showDiag, 1500);
        var content = view.querySelector('.dcContent');
        var input = view.querySelector('.dcSearchInput');
        input.placeholder = text('Films en series zoeken', 'Search movies and series', 'Filme und Serien suchen', 'Søk filmer og serier');
        var overlay = view.querySelector('.dcOverlay');
        var toast = view.querySelector('.dcToast');
        var items = {};      // sleutel -> item (gedeeld door alle kaarten)
        var current = null;  // item in het detailvenster
        var searchTimer = null;
        var loaded = false;
        var isAdmin = false;
        var showTrailer = true;
        var fourK = { movie: false, tv: false };   // Seerr met 4K-server: knop "4K aanvragen"
        try {
            ApiClient.getCurrentUser().then(function (u) {
                isAdmin = !!(u && u.Policy && (u.Policy.IsAdministrator || u.Policy.EnableContentDeletion)); // mag verwijderen/annuleren
                updateButton();
            }, function () { });
        } catch (e) { }

        function key(i) { return i.Type + ':' + i.TmdbId; }

        function statusIcon(st) { return st === 2 ? '&#10003;' : (st === 1 ? '&#9203;' : ''); }

        // ---- Downloadvoortgang (Radarr/Sonarr-wachtrij) ----
        var queue = {};          // sleutel -> wachtrij-item van /Discover/Queue
        var queueTimer = null, queueBusy = false, pollUntil = 0;
        var QUEUE_POLL = 15000;

        function stateLabel(st) {
            return st === 'downloading' ? text('Downloaden', 'Downloading', 'Lädt herunter', 'Laster ned') :
                st === 'paused' ? text('Gepauzeerd', 'Paused', 'Pausiert', 'Pauset') :
                st === 'importing' ? text('Wordt toegevoegd', 'Importing', 'Wird importiert', 'Importeres') :
                st === 'stalled' ? text('Wacht op download', 'Waiting for download', 'Wartet auf Download', 'Venter') :
                text('In wachtrij', 'Queued', 'In Warteschlange', 'I kø');
        }
        function timeLeft(sec) {
            if (typeof sec !== 'number' || sec < 0) { return ''; }
            if (sec < 60) { return '<1 min'; }
            var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
            if (m === 60) { h++; m = 0; }
            // Lange downloads: dagen en uren in plaats van "243u 21m".
            if (h >= 24) { var d = Math.floor(h / 24); h = h % 24; return d + 'd' + (h ? ' ' + h + text('u', 'h', 'h', 't') : ''); }
            return h > 0 ? h + text('u ', 'h ', 'h ', 't ') + m + 'm' : m + ' min';
        }
        // Korte statusregel: "↓ 45% · 12 min", "⏸ Gepauzeerd · 32%", "5 afl. · ↓ 32% · 18 min".
        function queueLine(e) {
            var parts = [];
            if (e.Type === 'tv' && e.Count > 1) { parts.push(e.Count + ' ' + text('afl.', 'eps.', 'Folgen', 'ep.')); }
            if (e.State === 'downloading') {
                parts.push('\u2193 ' + e.Progress + '%');
                var t = timeLeft(e.TimeLeft); if (t) { parts.push(t); }
            } else if (e.State === 'paused') {
                parts.push(stateLabel(e.State)); parts.push(e.Progress + '%');
            } else {
                parts.push(stateLabel(e.State));
                if (e.Progress > 0 && e.State !== 'importing') { parts.push(e.Progress + '%'); }
            }
            return parts.join(' \u00B7 ');
        }
        function queueHtml(i) {
            var e = queue[key(i)];
            if (!e) { return ''; }
            return '<div class="dcProg ' + esc(e.State) + '"><i style="width:' + e.Progress + '%"></i></div>';
        }
        function capQueueHtml(i, mine) {
            var e = queue[key(i)];
            if (e) { return '<div class="dcCapQ ' + esc(e.State) + '">' + esc(queueLine(e)) + '</div>'; }
            if (!mine) { return ''; }
            return i.Status === 2
                ? '<div class="dcCapQ avail">\u2713 ' + text('Beschikbaar', 'Available', 'Verfügbar', 'Tilgjengelig') + '</div>'
                : '<div class="dcCapQ req">' + text('Aangevraagd', 'Requested', 'Angefordert', 'Forespurt') + '</div>';
        }
        // Bestaande kaarten bijwerken na een nieuwe wachtrij (zonder de rij opnieuw op te bouwen).
        function applyQueueToCards() {
            var cards = view.querySelectorAll('.dcCard[data-key]');
            for (var c = 0; c < cards.length; c++) {
                var card = cards[c], i = items[card.getAttribute('data-key')];
                if (!i) { continue; }
                var poster = card.querySelector('.dcPoster'), cap = card.querySelector('.dcCap');
                var oldP = poster && poster.querySelector('.dcProg'); if (oldP) { poster.removeChild(oldP); }
                var oldQ = cap && cap.querySelector('.dcCapQ'); if (oldQ) { cap.removeChild(oldQ); }
                if (poster) { poster.insertAdjacentHTML('beforeend', queueHtml(i)); }
                if (cap) { cap.insertAdjacentHTML('beforeend', capQueueHtml(i, card.hasAttribute('data-mine'))); }
            }
        }
        // Boven een Emby-pagina (embedded) alleen zolang de popup open is: dan ververst de voortgang daarin ook.
        function pageActive() {
            if (embedded) { return document.body.contains(view) && overlay.classList.contains('open'); }
            return onDiscoverRoute() && document.body.contains(view);
        }
        function scheduleQueue(ms) {
            clearTimeout(queueTimer);
            queueTimer = setTimeout(loadQueue, ms);
        }
        // Alleen verversen zolang er iets downloadt (of net iets is aangevraagd) en de pagina open is.
        function loadQueue() {
            queueTimer = null;
            if (queueBusy || !pageActive()) { return; }
            if (document.hidden) { scheduleQueue(QUEUE_POLL); return; }
            queueBusy = true;
            api('GET', 'Discover/Queue').then(function (r) {
                queueBusy = false;
                var next = {}, gone = false;
                ((r && r.Items) || []).forEach(function (e) { next[e.Type + ':' + e.TmdbId] = e; });
                for (var k in queue) { if (queue.hasOwnProperty(k) && !next[k]) { gone = true; } }
                queue = next;
                applyQueueToCards();
                if (current) { renderQueueInfo(current); if (!delArmed) { updateButton(); } }
                if (gone) { loadMyRequests(); }   // klaar met downloaden: status in "Mijn aanvragen" bijwerken
                if (Object.keys(queue).length || Date.now() < pollUntil) { scheduleQueue(QUEUE_POLL); }
            }, function () {
                queueBusy = false;
                if (Date.now() < pollUntil) { scheduleQueue(QUEUE_POLL * 2); }
            });
        }
        // Na een aanvraag een paar minuten blijven kijken: Radarr/Sonarr hebben even nodig voor de download start.
        function afterRequest() {
            pollUntil = Date.now() + 5 * 60 * 1000;
            scheduleQueue(5000);
            loadMyRequests();
        }

        // Voortgang per aflevering in de popup.
        function renderQueueInfo(i) {
            var box = overlay.querySelector('.dcQueue');
            if (!box) { return; }
            var e = queue[key(i)];
            if (!e) { box.classList.remove('show'); box.innerHTML = ''; return; }
            var max = isTvClient ? 3 : 8;
            var html = '<div class="dcQHead">' + esc(stateLabel(e.State)) + (e.Count > 1 ? ' \u00B7 ' + e.Count + ' ' + text('downloads', 'downloads', 'Downloads', 'nedlastinger') : '') + '</div>';
            e.Parts.slice(0, max).forEach(function (p) {
                var name = p.Label ? p.Label + (p.Name ? ' \u00B7 ' + p.Name : '') : i.Title;
                var right = p.State === 'downloading' ? p.Progress + '%' + (timeLeft(p.TimeLeft) ? ' \u00B7 ' + timeLeft(p.TimeLeft) : '')
                    : stateLabel(p.State) + (p.Progress > 0 && p.State !== 'importing' ? ' \u00B7 ' + p.Progress + '%' : '');
                html += '<div class="dcQRow"><span class="dcQName">' + esc(name) + '</span>' +
                    '<span class="dcQBar ' + esc(p.State) + '"><i style="width:' + p.Progress + '%"></i></span>' +
                    '<span class="dcQPct">' + esc(right) + '</span></div>';
                if (p.Release || p.Detail) {
                    html += '<div class="dcQRel">' + esc(p.Release || '') + (p.Release && p.Detail ? ' \u00B7 ' : '') + esc(p.Detail || '') + '</div>';
                }
            });
            if (e.Parts.length > max) {
                html += '<div class="dcQMore">' + text('en nog ', 'and ', 'und ', 'og ') + (e.Parts.length - max) + text(' meer', ' more', ' weitere', ' til') + '</div>';
            }
            box.innerHTML = html;
            box.classList.add('show');
        }

        // ---- Rij "Mijn aanvragen" bovenaan de startpagina ----
        var mineRow = null, homeShown = false;
        function loadMyRequests() {
            api('GET', 'Discover/MyRequests').then(function (r) {
                mineRow = r || null;
                renderMine();
            }, function () { });
        }
        function renderMine() {
            var top = content.querySelector('.dcTop');
            if (!homeShown || !top) { return; }
            var old = top.querySelector('.dcMine');
            var list = (mineRow && mineRow.Items) || [];
            if (!list.length) { if (old) { old.parentNode.removeChild(old); } return; }
            var scroll = old ? old.querySelector('.dcRow').scrollLeft : 0;
            var html = '<div class="dcMine"><div class="dcRowTitle">' + esc(text('Mijn aanvragen', 'My requests', 'Meine Anfragen', 'Mine forespørsler')) + '</div>' +
                rowWrapHtml('<div class="dcRow" data-row="my_requests">' + list.map(function (i) { return cardHtml(i, true, null, list.length <= WIDE_MAX); }).join('') + '</div>') + '</div>';
            var hadFocus = old && old.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
            if (old) { old.insertAdjacentHTML('afterend', html); old.parentNode.removeChild(old); }
            else { top.insertAdjacentHTML('afterbegin', html); }
            var box = top.querySelector('.dcMine');
            var row = box.querySelector('.dcRow');
            row.scrollLeft = scroll;
            if (hadFocus) { var f = row.querySelector('.dcCard[data-key="' + hadFocus + '"]'); if (f) { focusEl(f); } }
            updateArrows(box.querySelector('.dcRowWrap'));
        }

        // ---- Extra rijen onder "Mijn aanvragen": Nieuwe seizoenen, Trakt-watchlist, TMDB-lijst ----
        var extraRows = { cont: null, watch: [] };
        function loadExtras() {
            api('GET', 'Discover/ContinueSeries').then(function (r) { extraRows.cont = r || null; renderExtras(); }, function () { });
            api('GET', 'Discover/Watchlist').then(function (r) { extraRows.watch = (r && r.Rows) || []; renderExtras(); }, function () { });
        }
        function extraTitle(r) {
            if (r.Key === 'continue_series') { return text('Nieuwe seizoenen', 'New seasons', 'Neue Staffeln', 'Nye sesonger'); }
            if (r.Key === 'watch_trakt') { return text('Trakt-watchlist', 'Trakt watchlist', 'Trakt-Merkliste', 'Trakt-ønskeliste'); }
            return r.Title;
        }
        function renderExtras() {
            var top = content.querySelector('.dcTop');
            if (!homeShown || !top) { return; }
            var olds = top.querySelectorAll('.dcExtra');
            var rows = [];
            if (extraRows.cont && extraRows.cont.Items && extraRows.cont.Items.length) { rows.push(extraRows.cont); }
            extraRows.watch.forEach(function (r) { if (r.Items && r.Items.length) { rows.push(r); } });
            var scrolls = {};
            Array.prototype.forEach.call(olds, function (o) {
                Array.prototype.forEach.call(o.querySelectorAll('.dcRow'), function (rw) { scrolls[rw.getAttribute('data-row')] = rw.scrollLeft; });
                o.parentNode.removeChild(o);
            });
            if (!rows.length) { return; }
            // Elke rij een eigen blok in .dcTop: korte rijen staan zo naast elkaar, lange krijgen de hele breedte.
            var html = '';
            rows.forEach(function (r) {
                var open = r.Items.filter(function (i) { return i.Status === 0; }).length;
                var all = (r.Key.indexOf('watch_') === 0 && open > 0)
                    ? ' <button type="button" class="dcReqAll focusable" data-row="' + esc(r.Key) + '">' + esc(text('Alles aanvragen', 'Request all', 'Alle anfragen', 'Be om alle')) + ' (' + open + ')</button>'
                    : '';
                html += '<div class="dcExtra"><div class="dcRowTitle">' + esc(extraTitle(r)) + all + '</div>' +
                    rowWrapHtml('<div class="dcRow" data-row="' + esc(r.Key) + '">' + r.Items.map(function (i) { return cardHtml(i, false, null, r.Items.length <= WIDE_MAX); }).join('') + '</div>') + '</div>';
            });
            top.insertAdjacentHTML('beforeend', html);
            Array.prototype.forEach.call(top.querySelectorAll('.dcExtra .dcRow'), function (rw) {
                rw.scrollLeft = scrolls[rw.getAttribute('data-row')] || 0;
                updateArrows(rw.parentNode);
            });
        }
        function requestAll(rowKey, btn) {
            var row = null;
            extraRows.watch.forEach(function (r) { if (r.Key === rowKey) { row = r; } });
            if (!row) { return; }
            var todo = row.Items.filter(function (i) { return i.Status === 0; });
            if (!todo.length) { return; }
            if (!window.confirm(text(todo.length + ' titels aanvragen?', 'Request ' + todo.length + ' titles?', todo.length + ' Titel anfragen?', 'Be om ' + todo.length + ' titler?'))) { return; }
            btn.disabled = true;
            var ok = 0, fail = 0, lastErr = '';
            (function next(n) {
                if (n >= todo.length) {
                    showToast(text(ok + ' aangevraagd', ok + ' requested', ok + ' angefragt', ok + ' forespurt') + (fail ? ' \u00B7 ' + text(fail + ' mislukt: ', fail + ' failed: ', fail + ' fehlgeschlagen: ', fail + ' mislyktes: ') + lastErr : ''), fail > 0);
                    afterRequest();
                    renderExtras();
                    return;
                }
                var i = todo[n];
                btn.textContent = text('Aanvragen... ', 'Requesting... ', 'Wird angefragt... ', 'Ber om... ') + (n + 1) + '/' + todo.length;
                api('POST', 'Discover/RequestItem', null, { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                    if (r && r.Success) { ok++; i.Status = 1; refreshCards(i); }
                    else {
                        fail++; lastErr = (r && r.Message) || '?';
                        // Limiet bereikt of geen toegang: de rest heeft geen zin.
                        if (r && /limiet|limit|toegang|access|Zugriff/i.test(lastErr)) { fail += todo.length - n - 1; n = todo.length; }
                    }
                    next(n + 1);
                }, function () { fail++; lastErr = text('netwerkfout', 'network error', 'Netzwerkfehler', 'nettverksfeil'); next(n + 1); });
            })(0);
        }

        var CHEV_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 1 0 1.4L10.4 12l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0z"/></svg>';
        var CHEV_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 6.3a1 1 0 0 0 0 1.4l4.3 4.3-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0z"/></svg>';
        // Rijtitels in de taal van deze Emby-app (bij plugintaal Automatisch).
        function rowTitle(k) {
            switch (k) {
                case 'recent_added': return text('Onlangs toegevoegd', 'Recently added', 'Kürzlich hinzugefügt', 'Nylig lagt til');
                case 'recent_requests': return text('Recente aanvragen', 'Recent requests', 'Kürzlich angefragt', 'Nylige forespørsler');
                case 'trending': return 'Trending';
                case 'popular_movie': return text('Populaire films', 'Popular Movies', 'Beliebte Filme', 'Populære filmer');
                case 'genres_movie': return text('Filmgenres', 'Movie Genres', 'Filmgenres', 'Filmsjangre');
                case 'upcoming_movie': return text('Aankomende films', 'Upcoming Movies', 'Kommende Filme', 'Kommende filmer');
                case 'studios': return text("Studio's", 'Studios', 'Studios', 'Studioer');
                case 'popular_tv': return text('Populaire series', 'Popular Series', 'Beliebte Serien', 'Populære serier');
                case 'genres_tv': return text('Seriegenres', 'Series Genres', 'Seriengenres', 'Seriesjangre');
                case 'upcoming_tv': return text('Aankomende series', 'Upcoming Series', 'Kommende Serien', 'Kommende serier');
                case 'networks': return text('Netwerken', 'Networks', 'Sender', 'Nettverk');
                case 'my_requests': return text('Mijn aanvragen', 'My requests', 'Meine Anfragen', 'Mine forespørsler');
            }
            return null;
        }
        function rowWrapHtml(inner) {
            return '<div class="dcRowWrap">' +
                '<button type="button" class="dcArrow left dcHide" data-dir="-1" tabindex="-1" aria-label="' + esc(text('Vorige', 'Previous', 'Zurück', 'Forrige')) + '">' + CHEV_L + '</button>' +
                inner +
                '<button type="button" class="dcArrow right" data-dir="1" tabindex="-1" aria-label="' + esc(text('Volgende', 'Next', 'Weiter', 'Neste')) + '">' + CHEV_R + '</button>' +
                '</div>';
        }
        // Pijl links weg aan het begin, rechts weg aan het eind; geen pijlen als alles al in beeld past.
        // Pijlen opnieuw rekenen bij het aanwijzen van een rij (een rij die gemaakt werd terwijl de pagina nog niet in
        // beeld was, had 0 breedte en dus geen pijl naar rechts).
        content.addEventListener('mouseenter', function (e) {
            var w = e.target && e.target.classList && e.target.classList.contains('dcRowWrap') ? e.target : null;
            if (w) { updateArrows(w); }
        }, true);
        function updateArrows(wrap) {
            if (!wrap) { return; }
            var row = wrap.querySelector('.dcRow');
            var l = wrap.querySelector('.dcArrow.left'), r = wrap.querySelector('.dcArrow.right');
            if (!row || !l || !r) { return; }
            var max = row.scrollWidth - row.clientWidth;
            l.classList.toggle('dcHide', row.scrollLeft <= 12);
            r.classList.toggle('dcHide', row.scrollLeft >= max - 12);
        }
        function updateAllArrows() {
            var wraps = content.querySelectorAll('.dcRowWrap');
            for (var w = 0; w < wraps.length; w++) { updateArrows(wraps[w]); }
        }

        // Korte rijen bovenaan: tot en met WIDE_MAX titels brede kaarten (vult de ruimte), daarboven gewone posters.
        var WIDE_MAX = 3;
        // wide = brede kaart (achtergrond + kleine poster + status) voor de korte rijen bovenaan.
        function cardHtml(i, mine, embyId, wide) {
            items[key(i)] = i;
            var poster = i.Poster
                ? '<img loading="lazy" src="' + esc(i.Poster) + '" alt="" />'
                : '<div class="dcNoPoster">' + esc(i.Title) + '</div>';
            var sub = [];
            if (typeof i.Rating === 'number' && i.Rating > 0) { sub.push('<span class="dcStar">&#9733; ' + i.Rating.toFixed(1) + '</span>'); }
            if (i.Year) { sub.push('<span class="dcYear">' + i.Year + '</span>'); }
            // Persoonspagina: welke rol (personage of regie), op een eigen regel.
            var role = i.Role ? (i.Role === 'Director' ? text('Regie', 'Director', 'Regie', 'Regi') : i.Role) : '';
            var bgUrl = wide ? (i.Backdrop || i.Poster || '') : '';
            return '<div class="dcCard focusable' + (wide ? ' dcWide' : '') + '" tabindex="0" role="button" data-key="' + key(i) + '"' + (mine === true ? ' data-mine="1"' : '') +
                (embyId ? ' data-emby="' + esc(embyId) + '"' : '') + '>' +
                (wide ? '<div class="dcWideBg' + (i.Backdrop ? '' : ' blur') + '"' + (bgUrl ? ' style="background-image:url(&quot;' + esc(bgUrl) + '&quot;)"' : '') + '></div><div class="dcWideShade"></div>' : '') +
                '<div class="dcPoster">' + poster +
                (wide ? '' : '<span class="dcBadge ' + i.Type + '">' + (i.Type === 'tv' ? text('SERIE', 'SERIES', 'SERIE') : text('FILM', 'MOVIE', 'FILM')) + '</span>') +
                '<span class="dcStatus s' + i.Status + '">' + statusIcon(i.Status) + '</span>' + queueHtml(i) + '</div>' +
                '<div class="dcCap">' + (wide ? '<span class="dcBadge ' + i.Type + '">' + (i.Type === 'tv' ? text('SERIE', 'SERIES', 'SERIE') : text('FILM', 'MOVIE', 'FILM')) + '</span>' : '') +
                '<div class="dcCapT">' + esc(i.Title) + '</div>' +
                (sub.length ? '<div class="dcCapSub">' + sub.join('') + '</div>' : '') +
                (role ? '<div class="dcRole" title="' + esc(role) + '">' + esc(role) + '</div>' : '') +
                capQueueHtml(i, mine === true) +
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

        // Logo's worden standaard wit gemaakt (filter). Per tegel meet de pagina het standaardlogo en de andere versies
        // die TMDB heeft (Images), en toont de versie die op de donkere tegel het best zichtbaar is in eigen kleuren.
        // Meten gebeurt met een losse afbeelding (crossOrigin); lukt dat niet, dan blijft het logo wit zoals altijd.
        function logoStats(img) {
            var nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
            var w = 128, h = Math.max(1, Math.round(128 * nh / nw));
            if (h > 128) { h = 128; w = Math.max(1, Math.round(128 * nw / nh)); }
            var c = document.createElement('canvas'); c.width = w; c.height = h;
            var g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
            var d = g.getImageData(0, 0, w, h).data;
            var minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0, dark = 0, light = 0, lumSum = 0, colorful = 0, distSum = 0;
            for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                    var i = (y * w + x) * 4;
                    if (d[i + 3] < 128) { continue; }
                    opaque++;
                    if (x < minX) { minX = x; } if (x > maxX) { maxX = x; }
                    if (y < minY) { minY = y; } if (y > maxY) { maxY = y; }
                    var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
                    lumSum += lum; if (mx && (mx - mn) / mx > 0.35 && lum >= 60) { colorful++; }
                    if (lum < 90) { dark++; } else if (lum > 170) { light++; }
                    // afstand tot de tegelkleur (#1c2640): hoe goed steekt dit af tegen de donkerblauwe tegel
                    distSum += Math.sqrt((d[i] - 28) * (d[i] - 28) + (d[i + 1] - 38) * (d[i + 1] - 38) + (d[i + 2] - 64) * (d[i + 2] - 64));
                }
            }
            if (!opaque) { return null; }
            return {
                fill: opaque / ((maxX - minX + 1) * (maxY - minY + 1)),
                dark: dark / opaque, light: light / opaque, lum: lumSum / opaque, colorful: colorful / opaque, dist: distSum / opaque
            };
        }
        // Kan dit logo in zijn eigen kleuren op de donkere tegel?
        //  1) gevuld vlak met zowel donkere als lichte delen (letters in een vlak: ABC, Warner Bros., Marvel, Cinemax);
        //  2) grotendeels duidelijk gekleurd en licht genoeg (Netflix, Hulu, Prime Video, The CW);
        //  3) een lichte versie (bedoeld voor donkere achtergronden), eventueel met kleuraccenten (Peacock, Disney).
        // Score: lichte versie met kleur > gekleurd logo > lichte versie zonder kleur > letters in een vlak.
        function logoScore(st) {
            if (!st) { return 0; }
            var lightVersion = st.lum >= 120 && st.dark < 0.35;
            if (lightVersion && st.colorful >= 0.02) { return 4; }
            // gekleurd en genoeg contrast met de tegel (donkerblauw zoals het Disney-kasteel of DreamWorks valt weg)
            if (st.colorful > 0.55 && st.lum >= 85 && st.dist >= 150) { return 3; }
            if (lightVersion) { return 2; }
            if (st.fill > 0.6 && Math.min(st.dark, st.light) > 0.03) { return 1; }
            return 0;
        }
        function probeLogo(url) {
            return new Promise(function (resolve) {
                var probe = new Image();
                probe.crossOrigin = 'anonymous';
                probe.onload = function () { var st = null; try { st = logoStats(probe); } catch (e) { st = null; } resolve(st); };
                probe.onerror = function () { resolve(null); };
                // Eigen adres voor de meting: een logo dat al zonder CORS in de browsercache staat, kan anders niet gemeten worden.
                probe.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'dcprobe=1';
            });
        }
        // Beslissing per tegel (op het eerste logo-adres): { src: te tonen logo, orig: eigen kleuren }.
        var logoChoice = {};
        function applyLogoChoice(key, ch) {
            Array.prototype.forEach.call(view.querySelectorAll('img.dcTileLogo'), function (im) {
                if (im.getAttribute('data-logo0') !== key) { return; }
                if (ch.src && im.getAttribute('src') !== ch.src) { im.setAttribute('src', ch.src); }
                im.classList.toggle('dcOrig', !!ch.orig);
            });
        }
        function checkLogo(img) {
            var key = img.getAttribute('data-logo0') || img.getAttribute('src');
            if (!key) { return; }
            if (!img.getAttribute('data-logo0')) { img.setAttribute('data-logo0', key); }
            var known = logoChoice[key];
            if (known && known !== 'busy') { applyLogoChoice(key, known); return; }
            if (known === 'busy') { return; }
            logoChoice[key] = 'busy';
            var alts = (img.getAttribute('data-alts') || '').split('|').filter(function (u) { return u; });
            var urls = [key].concat(alts);
            Promise.all(urls.map(probeLogo)).then(function (stats) {
                var best = -1, bestScore = 0;
                for (var k = 0; k < stats.length; k++) {
                    var sc = logoScore(stats[k]);
                    if (sc > bestScore) { best = k; bestScore = sc; }   // gelijke score: de eerdere (eerste = standaardlogo) wint
                }
                var ch = best >= 0 ? { src: urls[best], orig: true } : { src: key, orig: false };
                logoChoice[key] = ch;
                applyLogoChoice(key, ch);
            });
        }
        content.addEventListener('load', function (e) {
            var t = e.target;
            if (t && t.classList && t.classList.contains('dcTileLogo')) { checkLogo(t); }
        }, true);

        function tileHtml(r, t) {
            var inner = t.Image
                ? '<img class="dcTileLogo" loading="lazy" src="' + esc(t.Image) + '" data-logo0="' + esc(t.Image) + '"' +
                    (t.Images && t.Images.length ? ' data-alts="' + esc(t.Images.join('|')) + '"' : '') + ' alt="' + esc(t.Name) + '" />'
                : '<span>' + esc(t.Name) + '</span>';
            // Genres: foto in de genrekleur (zoals Seerr) met de naam erop; anders de effen kleur.
            var bg = t.Backdrop
                ? 'background:' + esc(t.Color || '#1c2640') + ' url(&quot;' + esc(t.Backdrop) + '&quot;) center/cover no-repeat'
                : 'background:' + esc(t.Color || '#1c2640');
            return '<div class="dcTile focusable' + (t.Image ? ' logo' : '') + (t.Backdrop ? ' photo' : '') + '" tabindex="0" role="button" data-kind="' + esc(r.TileKind) + '" data-id="' + esc(t.Id) +
                (t.Backdrop ? '" data-bd="' + esc(t.Backdrop) : '') +
                '" data-name="' + esc(t.Name) + '" title="' + esc(t.Name) + '" style="' + bg + '">' + inner + '</div>';
        }

        // Rijen die per TMDB-pagina verder kunnen: de titel opent alles in een raster (zoals Seerr).
        var GRID_ROWS = { trending: 1, popular_movie: 1, upcoming_movie: 1, popular_tv: 1, upcoming_tv: 1 };
        var CIRCLE_ARROW = '<svg class="dcRowGo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.3 7.3a1 1 0 0 0 0 1.4l3.3 3.3-3.3 3.3a1 1 0 1 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" fill="currentColor"/></svg>';
        function rowTitleHtml(rowKey, title) {
            if (!GRID_ROWS[rowKey]) { return '<div class="dcRowTitle">' + esc(title) + '</div>'; }
            return '<div class="dcRowTitle dcRowLink focusable" tabindex="0" role="button" data-rowkey="' + esc(rowKey) + '" data-title="' + esc(title) + '">' +
                '<span>' + esc(title) + '</span>' + CIRCLE_ARROW + '</div>';
        }

        // ---- genre / studio / netwerk en hele rijen: alles in een raster met "Meer laden" ----
        var browse = null;

        // ---- filters in het raster (op wat al geladen is; te weinig over: automatisch meer laden) ----
        function langName(code) {
            try {
                if (window.Intl && Intl.DisplayNames) {
                    var dn = new Intl.DisplayNames([uiLanguage === 'nl' ? 'nl' : uiLanguage === 'de' ? 'de' : uiLanguage === 'no' ? 'nb' : 'en'], { type: 'language' });
                    return dn.of(code) || code;
                }
            } catch (e) { }
            return code;
        }
        function updateLangOptions(b) {
            var sel = content.querySelector('.dcFLang');
            if (!sel || browse !== b) { return; }
            var have = {};
            Array.prototype.forEach.call(sel.options, function (o) { have[o.value] = true; });
            Object.keys(b.langs).sort(function (x, y) { return b.langs[y] - b.langs[x]; }).forEach(function (code) {
                if (have[code]) { return; }
                var o = document.createElement('option');
                o.value = code;
                o.textContent = langName(code);
                sel.appendChild(o);
            });
        }
        function passes(i, f) {
            if (f.year && (!i.Year || i.Year < f.year)) { return false; }
            if (f.score && (!i.Rating || i.Rating < f.score)) { return false; }
            if (f.lang && i.Lang !== f.lang) { return false; }
            if (f.hideOwned && i.Status === 2) { return false; }
            return true;
        }
        function applyFilters(b) {
            if (!b || browse !== b) { return; }
            var grid = content.querySelector('.dcBrowseGrid');
            if (!grid) { return; }
            var shown = 0, total = 0;
            Array.prototype.forEach.call(grid.querySelectorAll('.dcCard'), function (card) {
                var i = items[card.getAttribute('data-key')];
                var ok = !i || passes(i, b.filter);
                card.style.display = ok ? '' : 'none';
                total++;
                if (ok) { shown++; }
            });
            var f = b.filter, active = f.year || f.score || f.lang || f.hideOwned;
            var cnt = content.querySelector('.dcFCount');
            if (cnt) { cnt.textContent = active ? shown + ' / ' + total : ''; }
            // Filter laat bijna niets over: nog een paar pagina's bijladen.
            if (active && shown < 12 && !b.done && !b.loading && b.auto < 6) { b.auto++; loadBrowse(); }
        }
        content.addEventListener('change', function (e) {
            var b = browse;
            if (!b || !e.target || !e.target.closest || !e.target.closest('.dcFilters')) { return; }
            var bar = content.querySelector('.dcFilters');
            // Genre of sortering gewijzigd: opnieuw ophalen vanaf pagina 1 (dit filtert de server, niet de pagina).
            var gSel = bar.querySelector('.dcFGenre'), sSel = bar.querySelector('.dcFSort');
            if (gSel && sSel && (parseInt(gSel.value, 10) !== (b.genre || 0) || sSel.value !== (b.sort || 'popular'))) {
                b.genre = parseInt(gSel.value, 10) || 0;
                b.sort = sSel.value || 'popular';
                b.next = 1; b.done = false; b.seen = {}; b.langs = {}; b.auto = 0; b.seenAny = false;
                var grid = content.querySelector('.dcBrowseGrid');
                if (grid) { grid.innerHTML = ''; }
                var more = content.querySelector('.dcMore');
                if (more) { more.style.display = 'block'; }
                if (b.loading) { b.loading = false; }   // een lopende oude aanvraag wordt genegeerd (zie b.req)
                b.req = (b.req || 0) + 1;
                loadBrowse();
            }
            b.filter = {
                year: parseInt(bar.querySelector('.dcFYear').value, 10) || 0,
                score: parseFloat(bar.querySelector('.dcFScore').value) || 0,
                lang: bar.querySelector('.dcFLang').value || '',
                hideOwned: !!bar.querySelector('.dcFOwned').checked
            };
            b.auto = 0;
            applyFilters(b);
        });

        // ---- personen: zoekresultaat en "Bekend van" ----
        function personHtml(p) {
            var dep = p.Department === 'Directing' ? text('Regisseur', 'Director', 'Regie') : p.Department === 'Acting' ? text('Acteur', 'Actor', 'Schauspiel') : (p.Department || '');
            return '<div class="dcPerson focusable" tabindex="0" role="button" data-pid="' + p.Id + '" data-name="' + esc(p.Name) + '">' +
                '<div class="dcPersonPhoto"' + (p.Photo ? ' style="background-image:url(&quot;' + esc(p.Photo) + '&quot;)"' : '') + '></div>' +
                '<div class="dcPersonName">' + esc(p.Name) + '</div>' +
                (dep ? '<div class="dcPersonDep">' + esc(dep) + '</div>' : '') + '</div>';
        }
        // ---- Persoonspagina in Discover: foto, gegevens, biografie en rijen (in je bibliotheek / films / series) ----
        // Zoekt de persoon ook in Emby op (op TMDB-id, anders op naam): wat je al hebt komt in "In je bibliotheek"
        // en opent in Emby; de rest staat per soort in "niet in je bibliotheek" en opent de popup.
        function findEmbyPerson(pid, name) {
            var uid = ApiClient.getCurrentUserId();
            return Promise.resolve(ApiClient.getJSON(ApiClient.getUrl('Persons', { SearchTerm: name || '', UserId: uid, Fields: 'ProviderIds', Limit: 30 })))
                .then(function (r) {
                    var list = (r && r.Items) || [];
                    var exact = null;
                    for (var k = 0; k < list.length; k++) {
                        var t = list[k].ProviderIds && (list[k].ProviderIds.Tmdb || list[k].ProviderIds.tmdb);
                        if (t && String(t) === String(pid)) { return list[k]; }
                        if (!exact && String(list[k].Name || '').toLowerCase() === String(name || '').toLowerCase()) { exact = list[k]; }
                    }
                    return exact;
                }, function () { return null; });
        }
        function ownedByPerson(person) {
            if (!person) { return Promise.resolve([]); }
            var uid = ApiClient.getCurrentUserId();
            return Promise.resolve(ApiClient.getJSON(ApiClient.getUrl('Users/' + uid + '/Items', {
                PersonIds: person.Id, Recursive: true, IncludeItemTypes: 'Movie,Series',
                Fields: 'ProviderIds,ProductionYear,CommunityRating', SortBy: 'PremiereDate,SortName', SortOrder: 'Descending', Limit: 200
            }))).then(function (r) { return (r && r.Items) || []; }, function () { return []; });
        }
        function fmtDay(d) {
            if (!d) { return ''; }
            var dt = new Date(d + 'T12:00:00');
            if (isNaN(dt.getTime())) { return d; }
            try { return dt.toLocaleDateString(uiLanguage === 'nl' ? 'nl-NL' : uiLanguage === 'de' ? 'de-DE' : uiLanguage === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
            catch (e) { return d; }
        }
        function ageOn(birth, end) {
            var b = new Date(birth + 'T12:00:00'), e2 = end ? new Date(end + 'T12:00:00') : new Date();
            if (isNaN(b.getTime()) || isNaN(e2.getTime())) { return null; }
            var a = e2.getFullYear() - b.getFullYear();
            if (e2.getMonth() < b.getMonth() || (e2.getMonth() === b.getMonth() && e2.getDate() < b.getDate())) { a--; }
            return a;
        }
        function personRow(title, keyName, list, embyIds) {
            if (!list.length) { return ''; }
            return '<div class="dcRowTitle">' + esc(title) + ' <span class="dcRowCount">' + list.length + '</span></div>' +
                rowWrapHtml('<div class="dcRow" data-row="' + esc(keyName) + '">' + list.map(function (i) {
                    return cardHtml(i, false, embyIds ? embyIds[key(i)] : null);
                }).join('') + '</div>');
        }
        // "Meer" alleen tonen als de biografie echt is afgekapt (ook na draaien of een ander venster).
        function updateBioMore() {
            var bio = content.querySelector('.dcPersonBio');
            if (!bio) { return; }
            var bt = bio.querySelector('.dcBioText'), more = bio.querySelector('.dcBioMore');
            if (!bt || !more) { return; }
            more.style.display = bio.classList.contains('open') || bt.scrollHeight > bt.clientHeight + 2 ? '' : 'none';
        }
        // Persoon geopend via een klik buiten Discover (film-/kanaalpagina): Terug gaat dan terug naar die pagina.
        var personFromLink = false;
        // Wat er vóór de persoon in beeld was (zoekresultaten, lijst, startpagina): Terug zet dat ongewijzigd terug.
        var personPrev = null;
        function scrollBox() { return view.querySelector('.scrollY') || document.scrollingElement || document.documentElement; }
        // Eén stap terug binnen Discover. fromHeader = Emby's pijl linksboven: die blijft altijd in Discover
        // (ook bij een persoon die via een film-/kanaalpagina is geopend) en doet op de Discover-start niets.
        // Geeft false terug als er niets terug te doen was (Discover-start zonder popup).
        function goBack(fromHeader) {
            if (trailerOverlay.classList.contains('open')) { closeTrailer(); return true; }
            if (overlay.classList.contains('open')) { closeModal(); return true; }
            var person = !!content.querySelector('.dcPersonHead');
            if (!fromHeader && personFromLink && person && window.history.length > 1) { personFromLink = false; window.history.back(); return true; }
            personFromLink = false;
            if (personPrev && person) {
                var prev = personPrev; personPrev = null;
                content.innerHTML = '';
                content.appendChild(prev.frag);
                browse = prev.browse; homeShown = prev.homeShown;
                try { scrollBox().scrollTop = prev.top; } catch (ignored) { }
                return true;
            }
            personPrev = null;
            if (homeShown && !browse && !person) { return false; }
            if (input.value) { input.value = ''; }
            loadHome();
            try { scrollBox().scrollTop = 0; } catch (ignored) { }
            return true;
        }
        function goHome() {
            if (trailerOverlay.classList.contains('open')) { closeTrailer(); }
            if (overlay.classList.contains('open')) { closeModal(); }
            personPrev = null; personFromLink = false;
            if (input.value) { input.value = ''; }
            clearTimeout(searchTimer);
            loadHome();
            try { scrollBox().scrollTop = 0; } catch (ignored) { }
        }
        function openPerson(pid, name, fromLink) {
            personFromLink = !!fromLink;
            personPrev = null;
            if (!fromLink && content.firstChild) {
                var frag = document.createDocumentFragment();
                while (content.firstChild) { frag.appendChild(content.firstChild); }
                personPrev = { frag: frag, browse: browse, homeShown: homeShown, top: scrollBox().scrollTop };
            }
            browse = null;
            homeShown = false;
            content.innerHTML = '<div class="dcBrowseHead"><button type="button" class="dcBack">&#10094; ' + text('Terug', 'Back', 'Zurück', 'Tilbake') + '</button></div>' +
                '<div class="dcPersonHead"><div class="dcPersonBig"></div><div class="dcPersonText"><h2 class="dcPersonTitle">' + esc(name || '') + '</h2>' +
                '<div class="dcPersonMeta"></div><div class="dcPersonBio"></div></div></div>' +
                '<div class="dcPersonRows">' + skeletonHtml(2) + '</div>';
            var root = view.querySelector('.dcRoot');
            if (root) { root.scrollTop = 0; }
            try { window.scrollTo(0, 0); } catch (e) { }

            var personInfo = api('GET', 'Discover/Person', { Id: pid });
            personInfo.then(function (p) {
                if (!p || !p.Found || !content.querySelector('.dcPersonHead')) { return; }
                content.querySelector('.dcPersonTitle').textContent = p.Name || name || '';
                if (p.Photo) { content.querySelector('.dcPersonBig').style.backgroundImage = 'url("' + p.Photo + '")'; }
                var meta = [];
                if (p.Birthday) {
                    var age = ageOn(p.Birthday, p.Deathday);
                    meta.push(text('Geboren: ', 'Born: ', 'Geboren: ', 'Født: ') + fmtDay(p.Birthday) + (age != null && !p.Deathday ? ' (' + text('leeftijd ', 'age ', 'Alter ', 'alder ') + age + ')' : ''));
                }
                if (p.Deathday) { meta.push(text('Overleden: ', 'Died: ', 'Gestorben: ', 'Død: ') + fmtDay(p.Deathday) + (ageOn(p.Birthday, p.Deathday) != null ? ' (' + ageOn(p.Birthday, p.Deathday) + ')' : '')); }
                if (p.PlaceOfBirth) { meta.push(p.PlaceOfBirth); }
                content.querySelector('.dcPersonMeta').innerHTML = meta.map(function (m) { return '<div>' + esc(m) + '</div>'; }).join('');
                var bio = content.querySelector('.dcPersonBio');
                if (p.Biography) {
                    bio.innerHTML = '<div class="dcBioText">' + esc(p.Biography) + '</div><button type="button" class="dcBioMore">' + text('Meer', 'More', 'Mehr', 'Mer') + '</button>';
                    var more = bio.querySelector('.dcBioMore');
                    setTimeout(updateBioMore, 0);
                    more.addEventListener('click', function () {
                        var open = bio.classList.toggle('open');
                        more.textContent = open ? text('Minder', 'Less', 'Weniger', 'Mindre') : text('Meer', 'More', 'Mehr', 'Mer');
                    });
                }
            }, function () { });

            var creditsP = api('GET', 'Discover/PersonCredits', { TmdbPersonId: pid, Name: name });
            var ownedP = findEmbyPerson(pid, name).then(ownedByPerson);
            Promise.all([creditsP, ownedP, personInfo.then(null, function () { return null; })]).then(function (res) {
                var who = res[2] || {};
                var box = content.querySelector('.dcPersonRows');
                if (!box) { return; }
                var list = (res[0] && res[0].Items) || [];
                var owned = res[1] || [];
                // Wat je hebt: koppelen aan de TMDB-titels (zelfde poster en info), Emby-id voor de klik.
                var ownedByTmdb = {}, embyIds = {}, mine = [];
                owned.forEach(function (o) {
                    var t = o.ProviderIds && (o.ProviderIds.Tmdb || o.ProviderIds.tmdb);
                    if (t) { ownedByTmdb[(o.Type === 'Series' ? 'tv:' : 'movie:') + t] = o; }
                });
                var films = [], series = [];
                list.forEach(function (i) {
                    var o = ownedByTmdb[key(i)];
                    if (o) { i.Status = 2; embyIds[key(i)] = o.Id; mine.push(i); delete ownedByTmdb[key(i)]; return; }
                    (i.Type === 'tv' ? series : films).push(i);
                });
                // Emby-titels zonder TMDB-match toch tonen (poster uit Emby).
                Object.keys(ownedByTmdb).forEach(function (k) {
                    var o = ownedByTmdb[k];
                    var tag = o.ImageTags && o.ImageTags.Primary;
                    var it = { TmdbId: parseInt(k.split(':')[1], 10), Type: o.Type === 'Series' ? 'tv' : 'movie', Title: o.Name, Year: o.ProductionYear || 0,
                        Poster: tag ? ApiClient.getScaledImageUrl(o.Id, { type: 'Primary', maxHeight: 360, tag: tag }) : null, Rating: o.CommunityRating || 0, Status: 2 };
                    embyIds[key(it)] = o.Id; mine.push(it);
                });
                function newest(a, b) { return (b.Year || 0) - (a.Year || 0); }
                films.sort(newest); series.sort(newest); mine.sort(newest);
                // "Meer films met <naam>" (regisseur: "van <naam>"): altijd de naam, dus geen gok naar man of vrouw.
                var nm = who.Name || name || '';
                var dir = who.Department === 'Directing';
                var withNl = dir ? ' van ' : ' met ', withEn = dir ? ' by ' : ' with ', withDe = dir ? ' von ' : ' mit ', withNo = dir ? ' av ' : ' med ';
                var html = personRow(text('In je bibliotheek', 'In your library', 'In deiner Bibliothek', 'I biblioteket ditt'), 'person_lib', mine, embyIds) +
                    personRow(text('Meer films' + withNl + nm, 'More movies' + withEn + nm, 'Weitere Filme' + withDe + nm, 'Flere filmer' + withNo + nm), 'person_movie', films) +
                    personRow(text('Meer series' + withNl + nm, 'More series' + withEn + nm, 'Weitere Serien' + withDe + nm, 'Flere serier' + withNo + nm), 'person_tv', series);
                box.innerHTML = html || '<div class="dcMsg">' + text('Geen titels gevonden.', 'No titles found.', 'Keine Titel gefunden.') + '</div>';
                setTimeout(updateAllArrows, 0);
                // Achtergrond: de bekendste titel (hoogste score met achtergrond).
                var withBd = list.filter(function (i) { return i.Backdrop; }).sort(function (a, b) { return (b.Rating || 0) - (a.Rating || 0); });
                if (withBd.length) { setPageBackdrop(withBd[0].Backdrop); }
                if (isTvClient) { var f = box.querySelector('.dcCard'); if (f) { focusEl(f); } }
            }, function () {
                var box = content.querySelector('.dcPersonRows');
                if (box) { box.innerHTML = '<div class="dcMsg">' + text('Laden mislukt.', 'Loading failed.', 'Laden fehlgeschlagen.') + '</div>'; }
            });
        }

        // Genres uit de startpagina (tegels "Filmgenres"/"Seriegenres"), voor het genrefilter in Populaire films/series.
        var homeRowsData = [];
        function genreTiles(tv) {
            var k = tv ? 'genres_tv' : 'genres_movie', out = [];
            homeRowsData.forEach(function (r) { if (r.Key === k) { out = r.Tiles || []; } });
            return out;
        }
        function openRowGrid(rowKey, title) {
            openBrowse(null, null, title, rowKey);
        }

        function openBrowse(kind, id, name, rowKey) {
            homeShown = false;
            browse = { kind: kind, id: id, row: rowKey || null, next: 1, loading: false, done: false, seen: {}, langs: {}, auto: 0,
                filter: { year: 0, score: 0, lang: '', hideOwned: false }, genre: 0, sort: 'popular' };
            var years = [0, 2025, 2020, 2015, 2010, 2000, 1990];
            // Populaire films/series: ook op genre filteren en anders sorteren (dat doet de server via TMDB).
            var popular = rowKey === 'popular_movie' || rowKey === 'popular_tv';
            var serverFilters = '';
            if (popular) {
                var gs = genreTiles(rowKey === 'popular_tv');
                serverFilters =
                    '<label>' + text('Genre', 'Genre', 'Genre') + ' <select class="dcFGenre"><option value="0">' + text('alle', 'all', 'alle') + '</option>' +
                    gs.map(function (g) { return '<option value="' + esc(g.Id) + '">' + esc(g.Name) + '</option>'; }).join('') + '</select></label>' +
                    '<label>' + text('Sorteren', 'Sort', 'Sortieren') + ' <select class="dcFSort">' +
                    '<option value="popular">' + text('Populair', 'Popular', 'Beliebt') + '</option>' +
                    '<option value="new">' + text('Nieuwste', 'Newest', 'Neueste') + '</option>' +
                    '<option value="top">' + text('Best beoordeeld', 'Top rated', 'Bestbewertet') + '</option></select></label>';
            }
            content.innerHTML = '<div class="dcBrowseHead"><button type="button" class="dcBack">&#10094; ' + text('Terug', 'Back', 'Zurück') + '</button>' +
                '<span class="dcBrowseTitle">' + esc(name) + '</span></div>' +
                '<div class="dcFilters">' + serverFilters +
                '<label>' + text('Jaar', 'Year', 'Jahr') + ' <select class="dcFYear">' + years.map(function (y) { return '<option value="' + y + '">' + (y ? y + '+' : text('alle', 'all', 'alle')) + '</option>'; }).join('') + '</select></label>' +
                '<label>' + text('Score', 'Score', 'Bewertung') + ' <select class="dcFScore"><option value="0">' + text('alle', 'all', 'alle') + '</option><option value="6">6+</option><option value="7">7+</option><option value="8">8+</option></select></label>' +
                '<label>' + text('Taal', 'Language', 'Sprache') + ' <select class="dcFLang"><option value="">' + text('alle', 'all', 'alle') + '</option></select></label>' +
                '<label class="dcFCheck"><input type="checkbox" class="dcFOwned" /> ' + text('Niet in mijn bibliotheek', 'Not in my library', 'Nicht in meiner Bibliothek') + '</label>' +
                '<span class="dcFCount"></span>' +
                '</div>' +
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
            var call = b.row
                ? api('GET', 'Discover/List', { Key: b.row, Page: b.next, Genre: b.genre || 0, Sort: b.sort || '' })
                : api('GET', 'Discover/Browse', { Kind: b.kind, Id: b.id, Page: b.next });
            var reqNo = b.req || 0;
            call.then(function (r) {
                if (browse !== b || (b.req || 0) !== reqNo) { return; }
                var list = (r && r.Items) || [];
                var fresh = list.filter(function (i) {
                    if (b.seen[key(i)]) { return false; }
                    b.seen[key(i)] = true;
                    return true;
                });
                var grid = content.querySelector('.dcBrowseGrid');
                var firstPage = grid && !grid.children.length;
                if (grid && fresh.length) { grid.insertAdjacentHTML('beforeend', fresh.map(function (i) { return cardHtml(i); }).join('')); }
                fresh.forEach(function (i) { if (i.Lang) { b.langs[i.Lang] = (b.langs[i.Lang] || 0) + 1; } });
                if (isTvClient && firstPage && grid.firstElementChild && !overlay.classList.contains('open')) { focusEl(grid.firstElementChild); }
                b.next = (r && r.NextPage) || (b.next + (b.row ? 1 : 2));
                b.loading = false;
                if (!list.length) { b.done = true; }
                var more = content.querySelector('.dcMore');
                if (more) { more.style.display = b.done ? 'none' : 'block'; }
                if (btn) { btn.disabled = false; btn.textContent = text('Meer laden', 'Load more', 'Mehr laden'); }
                updateLangOptions(b);
                applyFilters(b);
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
                        rowWrapHtml('<div class="dcRow dcTileRow">' + r.Tiles.map(function (t) { return tileHtml(r, t); }).join('') + '</div>');
                    return;
                }
                if (!r.Items || !r.Items.length) { return; }
                var seen = {};
                r.Items.forEach(function (i) { seen[key(i)] = true; });
                rowState[r.Key] = { nextPage: r.NextPage || 4, loading: false, done: false, seen: seen };
                html += rowTitleHtml(r.Key, r.Title) +
                    rowWrapHtml('<div class="dcRow" data-row="' + esc(r.Key) + '">' + r.Items.map(function (i) { return cardHtml(i); }).join('') + '</div>');
            });
            content.innerHTML = '<div class="dcTop"></div>' + (html || '<div class="dcMsg">' + text('Geen resultaten.', 'No results.', 'Keine Ergebnisse.') + '</div>');
            homeShown = true;
            renderMine();
            renderExtras();
            setTimeout(updateAllArrows, 0);
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
                if (fresh.length) { el.insertAdjacentHTML('beforeend', fresh.map(function (i) { return cardHtml(i); }).join('')); }
                updateArrows(el.parentNode);
                st.loading = false;
                maybeLoadMore(el); // nog steeds aan het eind (bijv. alles dubbel)? meteen verder
            }, function () { st.loading = false; st.done = true; });
        }

        function loadHome() {
            browse = null;
            homeShown = false;
            content.innerHTML = skeletonHtml(3);
            loadMyRequests();
            loadExtras();
            scheduleQueue(0);
            api('GET', 'Discover/Home').then(function (r) {
                var culture = String((r.LanguageAuto && document.documentElement.lang) || r.Language || '').toLowerCase();
                uiLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : (culture.indexOf('nb') === 0 || culture.indexOf('nn') === 0 || culture.indexOf('no') === 0) ? 'no' : 'en';
                input.placeholder = text('Films en series zoeken', 'Search movies and series', 'Filme und Serien suchen', 'Søk filmer og serier');
                if (r.Message) { content.innerHTML = '<div class="dcMsg">' + esc(r.Message) + '</div>'; return; }
                if (r.LanguageAuto) { (r.Rows || []).forEach(function (row) { row.Title = rowTitle(row.Key) || row.Title; }); }
                // Intussen een persoonspagina of overzicht geopend (directe link): die niet overschrijven.
                if (browse || content.querySelector('.dcPersonHead')) { loaded = true; return; }
                homeRowsData = r.Rows || [];
                renderRows(r.Rows || []);
                loaded = true;
                randomPageBackdrop();
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
            homeShown = false;
            content.innerHTML = '<div class="dcRowTitle">' + text('Zoeken...', 'Searching...', 'Suchen...') + '</div><div class="dcSkelRow">' + skelCards(8) + '</div>';
            api('GET', 'Discover/Search', { Query: q }).then(function (r) {
                var list = r.Items || [];
                var people = r.People || [];
                var html = '';
                if (people.length) {
                    html += '<div class="dcRowTitle">' + text('Personen', 'People', 'Personen') + '</div>' +
                        rowWrapHtml('<div class="dcRow dcPeopleRow">' + people.map(personHtml).join('') + '</div>');
                }
                if (list.length) {
                    html += '<div class="dcRowTitle">' + text('Zoekresultaten', 'Search results', 'Suchergebnisse') + '</div><div class="dcGrid">' + list.map(function (i) { return cardHtml(i); }).join('') + '</div>';
                }
                content.innerHTML = html || '<div class="dcMsg">' + text('Niets gevonden voor "', 'Nothing found for "', 'Keine Ergebnisse für "') + esc(q) + '".</div>';
                setTimeout(updateAllArrows, 0);
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
            var k4 = overlay.querySelector('.dcBtn4k');
            if (k4) {
                k4.textContent = current.Type === 'tv' ? text('Alle seizoenen in 4K', 'All seasons in 4K', 'Alle Staffeln in 4K') : text('4K aanvragen', 'Request in 4K', 'In 4K anfordern');
                k4.classList.toggle('show', !!fourK[current.Type === 'tv' ? 'tv' : 'movie']);
                k4.disabled = false;
            }
            var tb = overlay.querySelector('.dcBtnTrailer');
            tb.textContent = text('Trailer', 'Trailer', 'Trailer', 'Trailer');
            if (showTrailer) { tb.classList.add('show'); } else { tb.classList.remove('show'); }
            d.disabled = false;
            delArmed = false; clearTimeout(delArmTimer);
            if (isAdmin && current.Status === 1) { d.textContent = text('Aanvraag annuleren', 'Cancel request', 'Anfrage abbrechen'); d.classList.add('show'); }
            else if (isAdmin && current.Status === 2) { d.textContent = text('Verwijderen', 'Delete', 'Löschen'); d.classList.add('show'); }
            else { d.classList.remove('show'); }
            if (current.Status === 2) { b.textContent = text('Beschikbaar', 'Available', 'Verfügbar'); b.disabled = true; }
            else if (current.Status === 1 && queue[key(current)]) { b.textContent = queueLine(queue[key(current)]); b.disabled = true; }
            else if (current.Status === 1) { b.textContent = text('Aangevraagd', 'Requested', 'Angefordert'); b.disabled = true; }
            else { b.textContent = text('Aanvragen', 'Request', 'Anfragen', 'Forespør'); b.disabled = false; }
        }

        function refreshCards(i) {
            var nodes = view.querySelectorAll('.dcCard[data-key="' + key(i) + '"] .dcStatus');
            for (var n = 0; n < nodes.length; n++) {
                nodes[n].className = 'dcStatus s' + i.Status;
                nodes[n].innerHTML = statusIcon(i.Status);
            }
        }

        // ---- Seizoenknoppen in de popup (series): "Alle seizoenen" + een knop per seizoen ----
        var seasonCache = {};
        function requestSeasons(i, seasons, btn) {
            if (!i) { return; }
            var all = !seasons || !seasons.length;
            var body = { Type: i.Type, TmdbId: i.TmdbId };
            if (!all) { body.Seasons = seasons; }
            btn.disabled = true;
            api('POST', 'Discover/RequestItem', null, body).then(function (r) {
                if (r && r.Success) {
                    i.Status = 1;
                    refreshCards(i);
                    showToast(i.Title + ': ' + r.Message, false);
                    afterRequest();
                } else {
                    showToast(text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ((r && r.Message) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')), true);
                }
                btn.disabled = false;
                if (current === i) { updateButton(); applySeasonStates(i); }
            }, function () {
                showToast(text('Aanvraag mislukt.', 'Request failed.', 'Anfrage fehlgeschlagen.'), true);
                btn.disabled = false;
            });
        }

        // Trailer-knop: bij een serie in de rij met seizoenen, anders (en op telefoons) in de gewone knoppenrij.
        function placeTrailer(inSeasons) {
            var tb = overlay.querySelector('.dcBtnTrailer');
            var row = overlay.querySelector('.dcBtnRow');
            var box = overlay.querySelector('.dcSeasons');
            if (!tb || !row || !box) { return; }
            var phone = window.matchMedia && window.matchMedia('(max-width: 600px)').matches && !overlay.classList.contains('dcTv');
            if (inSeasons && !phone) {
                if (tb.parentNode !== box) { box.appendChild(tb); }
            } else if (tb.parentNode !== row) {
                var main = row.querySelector('.dcBtn');
                row.insertBefore(tb, main ? main.nextSibling : row.firstChild);
            }
        }

        function renderSeasonButtons(i, seasons) {
            var box = overlay.querySelector('.dcSeasons');
            placeTrailer(false);
            box.textContent = '';
            var list = (seasons || []).filter(function (s) { return s.Number > 0; });
            if (i.Type !== 'tv' || list.length === 0) { box.classList.remove('show'); return; }
            var label = document.createElement('div');
            label.className = 'dcSeasonLabel';
            label.textContent = text('Kies een seizoen om aan te vragen', 'Choose a season to request', 'Staffel zum Anfordern wählen');
            box.appendChild(label);
            var all = document.createElement('button');
            all.type = 'button';
            all.className = 'dcBtnSeason all';
            all.textContent = text('Alle seizoenen', 'All seasons', 'Alle Staffeln');
            all.addEventListener('click', function () { requestSeasons(current, null, all); });
            box.appendChild(all);
            list.forEach(function (s) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'dcBtnSeason';
                b.setAttribute('data-season', s.Number);
                b.textContent = text('Seizoen ', 'Season ', 'Staffel ') + s.Number;
                b.title = s.EpisodeCount ? s.EpisodeCount + ' ' + text('afl.', 'eps.', 'Folgen') : '';
                // Aangekondigd seizoen: klein label "binnenkort"; aanvragen kan al (Sonarr pakt het op zodra het uitkomt).
                if (s.Upcoming) {
                    b.classList.add('dcSoon');
                    b.insertAdjacentHTML('beforeend', '<span class="dcSoonTag">' + esc(text('binnenkort', 'coming soon', 'demnächst', 'snart')) + '</span>');
                    b.title = s.AirDate ? text('Start ', 'Starts ', 'Start ', 'Start ') + s.AirDate : text('Aangekondigd', 'Announced', 'Angekündigt', 'Annonsert');
                }
                b.addEventListener('click', function () { requestSeasons(current, [s.Number], b); });
                box.appendChild(b);
            });
            box.classList.add('show');
            placeTrailer(true);
            applySeasonStates(i);
            // De losse Aanvragen-knop is voor series overbodig: "Alle seizoenen" doet hetzelfde.
            overlay.querySelector('.dcBtn').style.display = 'none';
        }

        // Seizoenen die al in je Emby-bibliotheek staan (minstens een aflevering) krijgen een vinkje en
        // zijn niet meer aan te klikken.
        var libSeasons = {};
        function applySeasonStates(i) {
            var have = libSeasons[i.TmdbId] || {};
            var btns = overlay.querySelectorAll('.dcBtnSeason[data-season]');
            for (var k = 0; k < btns.length; k++) {
                var n = parseInt(btns[k].getAttribute('data-season'), 10);
                var base = text('Seizoen ', 'Season ', 'Staffel ') + n;
                if (have[n]) {
                    btns[k].textContent = '\u2713 ' + base;
                    btns[k].disabled = true;
                    btns[k].title = text('Al in je bibliotheek', 'Already in your library', 'Bereits in deiner Bibliothek');
                } else {
                    btns[k].textContent = base;
                    if (btns[k].classList.contains('dcSoon')) {
                        btns[k].insertAdjacentHTML('beforeend', '<span class="dcSoonTag">' + esc(text('binnenkort', 'coming soon', 'demnächst', 'snart')) + '</span>');
                    }
                    btns[k].disabled = false;
                }
            }
        }
        function loadLibrarySeasons(i) {
            if (i.Type !== 'tv') { return; }
            if (libSeasons[i.TmdbId]) { applySeasonStates(i); return; }
            findLibraryItem(i).then(function (libId) {
                if (!libId) { libSeasons[i.TmdbId] = {}; return; }
                var uid = ApiClient.getCurrentUserId();
                return getJson('Users/' + uid + '/Items', {
                    ParentId: libId, IncludeItemTypes: 'Episode', Recursive: true,
                    Fields: 'ParentIndexNumber', Limit: 5000
                }).then(function (r) {
                    var states = {};
                    ((r && r.Items) || []).forEach(function (it) {
                        var n = parseInt(it.ParentIndexNumber, 10);
                        if (n > 0) { states[n] = true; }
                    });
                    libSeasons[i.TmdbId] = states;
                });
            }).then(function () {
                if (current === i) { applySeasonStates(i); }
            }, function () { });
        }

        function loadSeasonButtons(i) {
            var box = overlay.querySelector('.dcSeasons');
            placeTrailer(false);   // eerst terug naar de knoppenrij, anders verdwijnt hij mee met de seizoenen
            box.textContent = '';
            box.classList.remove('show');
            overlay.querySelector('.dcBtn').style.display = '';
            if (i.Type !== 'tv') { return; }
            loadLibrarySeasons(i);
            if (seasonCache[i.TmdbId]) { renderSeasonButtons(i, seasonCache[i.TmdbId]); return; }
            api('GET', 'Discover/Seasons', { TmdbId: i.TmdbId }).then(function (r) {
                var s = (r && r.Seasons) || [];
                seasonCache[i.TmdbId] = s;
                if (current === i) { renderSeasonButtons(i, s); }
            }, function () { /* geen seizoenen: de gewone Aanvragen-knop blijft staan */ });
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
            var ovEl = overlay.querySelector('.dcOverview');
            ovEl.textContent =
                i.Overview || text('Geen beschrijving beschikbaar.', 'No description available.', 'Keine Beschreibung verfügbar.', 'Ingen beskrivelse tilgjengelig.');
            ovEl.scrollTop = 0;
            ovEl.onscroll = function () { updateOverviewHint(ovEl); };
            setTimeout(function () { updateOverviewHint(ovEl); }, 0);
            var infoEl = overlay.querySelector('.dcInfo');
            infoEl.textContent = '';
            var castEl = overlay.querySelector('.dcCast');
            castEl.innerHTML = '';
            var rateEl = overlay.querySelector('.dcRatings');
            rateEl.innerHTML = '';
            loadCollection(i);
            if (omdbOn) {
                api('GET', 'Discover/Ratings', { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                    if (current !== i || !r) { return; }
                    var h = '';
                    if (r.Imdb) { h += '<span class="dcRate imdb" title="IMDb' + (r.ImdbVotes ? ' \u00B7 ' + esc(r.ImdbVotes) + ' ' + esc(text('stemmen', 'votes', 'Stimmen', 'stemmer')) : '') + '"><b>IMDb</b>' + esc(r.Imdb) + '</span>'; }
                    if (r.RottenTomatoes) { h += '<span class="dcRate rt" title="Rotten Tomatoes"><b>RT</b>' + esc(r.RottenTomatoes) + '</span>'; }
                    if (r.Metacritic) {
                        var mc = parseInt(r.Metacritic, 10);
                        h += '<span class="dcRate mc' + (mc < 40 ? ' low' : mc < 61 ? ' mid' : '') + '" title="Metacritic"><b>MC</b>' + esc(r.Metacritic) + '</span>';
                    }
                    rateEl.innerHTML = h;
                }, function () { });
            }
            api('GET', 'Discover/Info', { Type: i.Type, TmdbId: i.TmdbId }).then(function (r) {
                if (current !== i || !r) { return; }
                if (r.Lines && r.Lines.length) { infoEl.textContent = r.Lines.join('\n'); }
                castEl.innerHTML = (r.Cast || []).map(function (p) {
                    var initials = String(p.Name || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('');
                    return '<button type="button" class="dcCastP" data-pid="' + p.Id + '" data-name="' + esc(p.Name) + '" title="' + esc(p.Name) + '">' +
                        '<div class="dcCastPh"' + (p.Photo ? ' style="background-image:url(&quot;' + esc(p.Photo) + '&quot;)">' : '>' + esc(initials)) + '</div>' +
                        '<div class="dcCastN">' + esc(p.Name) + '</div>' + (p.Character ? '<div class="dcCastR">' + esc(p.Character) + '</div>' : '') + '</button>';
                }).join('');
                castEl.scrollLeft = 0;
                updateCastArrows();
                setTimeout(updateCastArrows, 300);
            }, function () { });
            var ob = overlay.querySelector('.dcBtnOpen');
            ob.classList.remove('show'); ob.removeAttribute('data-id');
            ob.textContent = text('Openen in Emby', 'Open in Emby', 'In Emby öffnen');
            loadSeasonButtons(i);
            renderQueueInfo(i);
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
                if (libId && i.Type === 'tv') { openModalWithEmbyLink(i, libId); return; }
                if (libId) { goToEmbyItem(libId); return; }
                openChannelItem(i);
            });
        }

        // Series die je al (deels) hebt: toch de popup tonen, zodat je ontbrekende seizoenen kunt aanvragen.
        // Met de knop "Openen in Emby" kom je alsnog bij de serie zelf.
        function openModalWithEmbyLink(i, embyId) {
            openModal(i);
            var ob = overlay.querySelector('.dcBtnOpen');
            ob.setAttribute('data-id', embyId);
            ob.classList.add('show');
        }

        function openChannelItem(i) {
            buildEmbyMap().then(function (map) {
                var id = lookup(map, i);
                if (id && i.Type === 'tv') { openModalWithEmbyLink(i, id); return; }
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

        // ---- achtergrond van de titel onder de muis / met focus (zoals Emby's achtergronden) ----
        var pageBd = { layers: view.querySelectorAll('.dcPageBdImg'), idx: 0, cur: '', timer: null, seq: 0 };
        function pageBdAllowed() {
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && /enablebackdrops/i.test(k) && String(localStorage.getItem(k)) === 'false') { return false; }
                }
            } catch (e) { }
            return true;
        }
        function setPageBackdrop(url) {
            if (url) { url = String(url).replace('/t/p/w780/', '/t/p/w1280/'); }
            if (!url || url === pageBd.cur || !pageBd.layers.length || !pageBdAllowed()) { return; }
            var token = ++pageBd.seq;
            var img = new Image();
            img.onload = function () {
                if (token !== pageBd.seq) { return; }
                pageBd.cur = url;
                var next = pageBd.layers[pageBd.idx = 1 - pageBd.idx];
                var prev = pageBd.layers[1 - pageBd.idx];
                next.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
                next.classList.add('on');
                prev.classList.remove('on');
            };
            img.src = url;
        }
        function backdropOf(el) {
            if (!el || !el.closest) { return null; }
            var card = el.closest('.dcCard');
            if (card) { var it = items[card.getAttribute('data-key')]; return it && it.Backdrop; }
            var tile = el.closest('.dcTile');
            return tile ? tile.getAttribute('data-bd') : null;
        }
        function onBackdropHover(e) {
            var url = backdropOf(e.target);
            if (!url) { return; }
            clearTimeout(pageBd.timer);
            pageBd.timer = setTimeout(function () { setPageBackdrop(url); }, 120);
        }
        content.addEventListener('mouseover', onBackdropHover);
        content.addEventListener('focusin', onBackdropHover);
        // Na het laden van de startpagina: een willekeurige achtergrond uit wat er te zien is.
        function randomPageBackdrop() {
            var all = Object.keys(items).map(function (k) { return items[k] && items[k].Backdrop; }).filter(Boolean);
            if (all.length) { setPageBackdrop(all[Math.floor(Math.random() * all.length)]); }
        }

        // ---- snelmenu: rechtsklik of lang indrukken op een poster ----
        var quick = document.createElement('div');
        quick.className = 'dcQuick';
        view.appendChild(quick);
        var quickJustOpened = 0;
        function closeQuick() { quick.classList.remove('open'); }
        function openQuick(i, x, y) {
            var canRequest = i.Status === 0 || (i.Type === 'tv' && i.Status !== 1);
            quick.innerHTML = '<div class="dcQuickTitle">' + esc(i.Title) + (i.Year ? ' (' + i.Year + ')' : '') + '</div>' +
                '<button type="button" class="req"' + (canRequest ? '' : ' disabled') + '>' +
                (i.Type === 'tv' ? text('Alle seizoenen aanvragen', 'Request all seasons', 'Alle Staffeln anfordern') : text('Aanvragen', 'Request', 'Anfordern')) +
                (i.Status === 2 && i.Type !== 'tv' ? ' \u2713' : i.Status === 1 ? ' \u23F3' : '') + '</button>' +
                '<button type="button" class="det">' + text('Details en trailer', 'Details and trailer', 'Details und Trailer') + '</button>';
            quick.querySelector('.req').addEventListener('click', function () {
                closeQuick();
                requestSeasons(i, null, { disabled: false });
            });
            quick.querySelector('.det').addEventListener('click', function () { closeQuick(); openItem(i); });
            quick.classList.add('open');
            var w = quick.offsetWidth || 220, h = quick.offsetHeight || 120;
            quick.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
            quick.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
            quickJustOpened = Date.now();
            var first = quick.querySelector('button:not([disabled])');
            if (first && isTvClient) { first.focus(); }
        }
        content.addEventListener('contextmenu', function (e) {
            var card = e.target.closest ? e.target.closest('.dcCard') : null;
            var i = card && items[card.getAttribute('data-key')];
            if (!i) { return; }
            e.preventDefault();
            openQuick(i, e.clientX, e.clientY);
        });
        var pressTimer = null, pressStart = null;
        content.addEventListener('touchstart', function (e) {
            var card = e.target.closest ? e.target.closest('.dcCard') : null;
            var i = card && items[card.getAttribute('data-key')];
            if (!i || !e.touches || e.touches.length !== 1) { return; }
            pressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function () { pressTimer = null; openQuick(i, pressStart.x, pressStart.y); }, 550);
        }, { passive: true });
        content.addEventListener('touchmove', function (e) {
            if (!pressTimer || !pressStart || !e.touches || !e.touches.length) { return; }
            if (Math.abs(e.touches[0].clientX - pressStart.x) > 10 || Math.abs(e.touches[0].clientY - pressStart.y) > 10) { clearTimeout(pressTimer); pressTimer = null; }
        }, { passive: true });
        content.addEventListener('touchend', function () { clearTimeout(pressTimer); pressTimer = null; });
        document.addEventListener('click', function (e) {
            if (!quick.classList.contains('open')) { return; }
            if (quick.contains(e.target)) { return; }
            closeQuick();
        }, true);
        document.addEventListener('keydown', function (e) { if ((e.key === 'Escape' || e.keyCode === 27) && quick.classList.contains('open')) { closeQuick(); } });
        window.addEventListener('scroll', closeQuick, true);

        // ---- events ----
        content.addEventListener('click', function (e) {
            if (Date.now() - quickJustOpened < 700) { return; }   // de klik na lang indrukken opent geen popup
            var card = e.target.closest ? e.target.closest('.dcCard') : null;
            if (card && card.getAttribute('data-emby')) { goToEmbyItem(card.getAttribute('data-emby')); return; }   // al in je bibliotheek
            if (card && items[card.getAttribute('data-key')]) { openItem(items[card.getAttribute('data-key')]); }
        });

        content.addEventListener('click', function (e) {
            var t = e.target;
            var person = t.closest ? t.closest('.dcPerson') : null;
            if (person) {
                openPerson(parseInt(person.getAttribute('data-pid'), 10), person.getAttribute('data-name'));
                return;
            }
            var reqAll = t.closest ? t.closest('.dcReqAll') : null;
            if (reqAll) { requestAll(reqAll.getAttribute('data-row'), reqAll); return; }
            var rowLink = t.closest ? t.closest('.dcRowLink') : null;
            if (rowLink) {
                openRowGrid(rowLink.getAttribute('data-rowkey'), rowLink.getAttribute('data-title'));
                return;
            }
            var tile = t.closest ? t.closest('.dcTile') : null;
            if (tile) {
                openBrowse(tile.getAttribute('data-kind'), parseInt(tile.getAttribute('data-id'), 10), tile.getAttribute('data-name'));
                return;
            }
            if (t.closest && t.closest('.dcBack')) { goBack(false); return; }
            if (t.closest && t.closest('.dcMoreBtn')) { loadBrowse(); }
        });

        // TV / afstandsbediening: OK (Enter) op een kaart of tegel werkt als klik,
        // en het gefocuste item scrolt netjes in beeld.
        content.addEventListener('keydown', function (e) {
            var k = e.key || '';
            if (k !== 'Enter' && k !== ' ' && e.keyCode !== 13 && e.keyCode !== 32) { return; }
            var el = e.target;
            if (el && el.classList && (el.classList.contains('dcCard') || el.classList.contains('dcTile') || el.classList.contains('dcRowLink') || el.classList.contains('dcPerson'))) {
                e.preventDefault();
                el.click();
            }
        });
        content.addEventListener('focusin', function (e) {
            var el = e.target;
            if (el && el.classList && (el.classList.contains('dcCard') || el.classList.contains('dcTile') || el.classList.contains('dcPerson')) && el.scrollIntoView) {
                try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) { el.scrollIntoView(); }
            }
        });

        // scroll-events borrelen niet op, dus in de capture-fase luisteren
        content.addEventListener('scroll', function (e) {
            var el = e.target;
            if (el && el.classList && el.classList.contains('dcRow')) { maybeLoadMore(el); updateArrows(el.parentNode); }
        }, true);
        window.addEventListener('resize', function () { if (pageActive()) { updateAllArrows(); updateBioMore(); } });

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
        // Klik op een acteur in de popup: op de Discover-pagina de persoonspagina hier; boven een Emby-pagina
        // naar Emby's eigen acteurspagina als die persoon in je bibliotheek staat, anders naar die van Discover.
        // ---- Collectie (filmreeks) in de popup: zoals bij seizoenen alles in één keer of per film aanvragen ----
        var collectionCache = {};
        function loadCollection(i) {
            var box = overlay.querySelector('.dcCollection');
            box.innerHTML = '';
            if (!i || i.Type !== 'movie') { return; }
            var done = function (r) {
                collectionCache[i.TmdbId] = r || {};
                if (current === i) { renderCollection(i, collectionCache[i.TmdbId]); }
            };
            if (collectionCache[i.TmdbId]) { renderCollection(i, collectionCache[i.TmdbId]); return; }
            api('GET', 'Discover/Related', { Type: 'movie', TmdbId: i.TmdbId }).then(done, function () { });
        }
        // Status als klein bolletje in de hoek van de poster (geen losse knoppen meer).
        function colAllLabel(n) {
            return text('Collectie aanvragen (' + n + ' films)', 'Request collection (' + n + ' movies)', 'Sammlung anfragen (' + n + ' Filme)', 'Be om samlingen (' + n + ' filmer)');
        }
        function colBadgeHtml(f) {
            if (f.Status === 2) { return '<span class="dcColBadge have" title="' + esc(text('In bibliotheek', 'In library', 'In Bibliothek', 'I biblioteket')) + '">\u2713</span>'; }
            if (f.Status === 1) { return '<span class="dcColBadge req" title="' + esc(text('Aangevraagd', 'Requested', 'Angefragt', 'Forespurt')) + '">\u23F3</span>'; }
            return '';
        }
        // Losse film uit de collectie aanvragen: klein "+"-rondje op de poster (niet bij de film van deze popup: die heeft de grote knop).
        function colAddHtml(f, i) {
            if (f.Status !== 0 || f.TmdbId === i.TmdbId) { return ''; }
            var t = text('Aanvragen', 'Request', 'Anfragen', 'Forespør') + ': ' + f.Title;
            return '<button type="button" class="dcColAdd" data-req="' + f.TmdbId + '" title="' + esc(t) + '" aria-label="' + esc(t) + '">+</button>';
        }
        function renderCollection(i, r) {
            var box = overlay.querySelector('.dcCollection');
            var list = (r && r.Collection) || [];
            if (list.length < 2) { box.innerHTML = ''; return; }
            list.forEach(function (f) { f.Type = f.Type || 'movie'; items[key(f)] = items[key(f)] || f; });
            var open = list.filter(function (f) { return f.Status === 0; }).length;
            box.innerHTML = '<div class="dcColHead"><span class="dcColTitle">' + esc(r.CollectionName || text('Collectie', 'Collection', 'Sammlung', 'Samling')) +
                ' \u00B7 ' + list.length + ' ' + esc(text('films', 'movies', 'Filme', 'filmer')) + '</span>' +
                (open ? '<button type="button" class="dcColAll" data-n="' + open + '">' + esc(colAllLabel(open)) + '</button>' : '') +
                '</div>' + (open ? '<div class="dcColWarn">\u26A0 ' + esc(text(
                    'Hiermee vraag je in \u00E9\u00E9n keer alle ' + open + ' films uit deze collectie aan die je nog niet hebt. Telt mee voor je aanvraaglimiet.',
                    'This requests all ' + open + ' movies from this collection that you don\u2019t have yet, in one go. Counts towards your request limit.',
                    'Damit fragst du alle ' + open + ' Filme dieser Sammlung, die du noch nicht hast, auf einmal an. Z\u00E4hlt zu deinem Anfragelimit.',
                    'Dette ber om alle ' + open + ' filmer i denne samlingen som du ikke har enn\u00E5, p\u00E5 \u00E9n gang. Teller mot forespørselsgrensen.')) + '</div>' : '') +
                '<div class="dcColRow">' + list.map(function (f) {
                    return '<div class="dcColItem' + (f.TmdbId === i.TmdbId ? ' cur' : '') + '" data-tmdb="' + f.TmdbId + '">' +
                        '<button type="button" class="dcColPoster" data-open="' + f.TmdbId + '" title="' + esc(f.Title + (f.Year ? ' (' + f.Year + ')' : '')) + '"' +
                        (f.Poster ? ' style="background-image:url(&quot;' + esc(f.Poster) + '&quot;)"' : '') + '>' + colBadgeHtml(f) + '</button>' + colAddHtml(f, i) +
                        '<div class="dcColName">' + esc(f.Title) + (f.Year ? ' (' + f.Year + ')' : '') + '</div>' +
                        (f.TmdbId === i.TmdbId ? '<div class="dcColCur">' + esc(text('Deze film', 'This movie', 'Dieser Film', 'Denne filmen')) + '</div>' : '') + '</div>';
                }).join('') + '</div>';
        }
        function colFind(id) {
            var r = current && collectionCache[current.TmdbId];
            var list = (r && r.Collection) || [];
            for (var k = 0; k < list.length; k++) { if (list[k].TmdbId === id) { return list[k]; } }
            return null;
        }
        function requestColFilm(f) {
            return api('POST', 'Discover/RequestItem', null, { Type: 'movie', TmdbId: f.TmdbId }).then(function (r) {
                if (r && r.Success) { f.Status = 1; var it = items[key(f)]; if (it && it !== f) { it.Status = 1; } refreshCards(f); return { ok: true }; }
                return { ok: false, msg: (r && r.Message) || '?' };
            }, function (e) { return { ok: false, msg: (e && (e.statusText || e.message)) || '?' }; });
        }
        overlay.querySelector('.dcCollection').addEventListener('click', function (e) {
            var t = e.target && e.target.closest ? e.target : null;
            if (!t) { return; }
            var openBtn = t.closest('.dcColPoster');
            if (openBtn) {
                var f0 = colFind(parseInt(openBtn.getAttribute('data-open'), 10));
                if (f0 && current && f0.TmdbId !== current.TmdbId) { openModal(items[key(f0)] || f0); }
                return;
            }
            var reqBtn = t.closest('.dcColAdd[data-req]');
            if (reqBtn) {
                var f = colFind(parseInt(reqBtn.getAttribute('data-req'), 10));
                if (!f) { return; }
                reqBtn.disabled = true; reqBtn.textContent = '\u2026';
                var cur = current;
                requestColFilm(f).then(function (res) {
                    if (res.ok) { showToast(text('Aangevraagd: ', 'Requested: ', 'Angefragt: ', 'Forespurt: ') + f.Title, false); afterRequest(); }
                    else { showToast(res.msg, true); }
                    if (current === cur) { renderCollection(cur, collectionCache[cur.TmdbId]); }
                });
                return;
            }
            var all = t.closest('.dcColAll');
            if (all) {
                var curItem = current;
                var r = collectionCache[curItem.TmdbId];
                var todo = ((r && r.Collection) || []).filter(function (x) { return x.Status === 0; });
                if (!todo.length) { return; }
                // Twee stappen: eerste klik vraagt om bevestiging, tweede klik (binnen 5 s) vraagt alles aan.
                if (!all.classList.contains('confirm')) {
                    all.classList.add('confirm');
                    all.textContent = text('Zeker? ' + todo.length + ' films aanvragen', 'Sure? Request ' + todo.length + ' movies', 'Sicher? ' + todo.length + ' Filme anfragen', 'Sikker? Be om ' + todo.length + ' filmer');
                    clearTimeout(all._t);
                    all._t = setTimeout(function () {
                        if (!all.disabled) { all.classList.remove('confirm'); all.textContent = colAllLabel(todo.length); }
                    }, 5000);
                    return;
                }
                clearTimeout(all._t);
                all.disabled = true;
                var ok = 0, fail = 0, lastErr = '';
                (function next(n) {
                    if (n >= todo.length) {
                        showToast(text(ok + ' aangevraagd', ok + ' requested', ok + ' angefragt', ok + ' forespurt') + (fail ? ' \u00B7 ' + text(fail + ' mislukt: ', fail + ' failed: ', fail + ' fehlgeschlagen: ', fail + ' mislyktes: ') + lastErr : ''), fail > 0);
                        afterRequest();
                        if (current === curItem) { renderCollection(curItem, r); updateButton(); }
                        return;
                    }
                    all.textContent = text('Aanvragen... ', 'Requesting... ', 'Wird angefragt... ', 'Ber om... ') + (n + 1) + '/' + todo.length;
                    requestColFilm(todo[n]).then(function (res) {
                        if (res.ok) { ok++; } else { fail++; lastErr = res.msg; }
                        // Limiet bereikt: niet verder proberen.
                        if (!res.ok && /limi/i.test(res.msg || '')) { n = todo.length; }
                        next(n + 1);
                    });
                })(0);
            }
        });

        // Pijlen bij de cast: links weg aan het begin, rechts weg aan het eind (of als alles al past).
        function updateCastArrows() {
            var c = overlay.querySelector('.dcCast');
            var l = overlay.querySelector('.dcCastArr.left'), r = overlay.querySelector('.dcCastArr.right');
            if (!c || !l || !r) { return; }
            var max = c.scrollWidth - c.clientWidth;
            l.classList.toggle('dcHide', c.scrollLeft <= 8);
            r.classList.toggle('dcHide', c.scrollLeft >= max - 8);
        }
        (function () {
            var c = overlay.querySelector('.dcCast');
            var wrap = overlay.querySelector('.dcCastWrap');
            Array.prototype.forEach.call(overlay.querySelectorAll('.dcCastArr'), function (b) {
                b.innerHTML = b.classList.contains('left') ? CHEV_L : CHEV_R;
                b.addEventListener('click', function (e) {
                    e.preventDefault(); e.stopPropagation();
                    var amount = Math.max(160, c.clientWidth * 0.8) * parseInt(b.getAttribute('data-dir'), 10);
                    if (c.scrollBy) { c.scrollBy({ left: amount, behavior: 'smooth' }); } else { c.scrollLeft += amount; }
                });
            });
            c.addEventListener('scroll', updateCastArrows);
            wrap.addEventListener('mouseenter', updateCastArrows);
        })();
        overlay.querySelector('.dcCast').addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('.dcCastP') : null;
            if (!b) { return; }
            var pid = parseInt(b.getAttribute('data-pid'), 10), name = b.getAttribute('data-name');
            if (!embedded) { closeModal(); openPerson(pid, name); return; }
            findEmbyPerson(pid, name).then(function (p) {
                closeModal();
                if (p) { goToEmbyItem(p.Id); return; }
                try { sessionStorage.setItem('dcOpenNext', JSON.stringify({ kind: 'person', id: pid, name: name || '', at: Date.now() })); } catch (e) { }
                window.location.hash = '#!/configurationpage?name=' + UI_PAGE;
            });
        });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeModal(); } });

        overlay.querySelector('.dcBtn4k').addEventListener('click', function () {
            var i = current, b = this;
            if (!i || b.disabled) { return; }
            b.disabled = true;
            api('POST', 'Discover/RequestItem', null, { Type: i.Type, TmdbId: i.TmdbId, Is4k: true }).then(function (r) {
                showToast(r && r.Success ? i.Title + ': ' + r.Message : text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ((r && r.Message) || '?'), !(r && r.Success));
                b.disabled = false;
            }, function () { showToast(text('Aanvraag mislukt.', 'Request failed.', 'Anfrage fehlgeschlagen.'), true); b.disabled = false; });
        });

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
                    afterRequest();
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
            var arr = window.__discoverRequestService || (i.Type === 'tv' ? 'Sonarr' : 'Radarr');
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
                    delete queue[key(i)];
                    applyQueueToCards();
                    loadMyRequests();
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

        view.querySelector('.dcHomeBtn').addEventListener('click', goHome);
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

        // Zolang de popup of trailer open is: Emby's kopbalk onklikbaar en onzichtbaar. Die ligt anders boven de popup
        // (de popup zit in de pagina, de kopbalk erbuiten) en vangt dan de klik op het kruisje rechtsboven af.
        // Over alle Discover-pagina's heen: alleen een popup die echt in beeld is telt (een verborgen oude pagina niet).
        function syncModalBody() {
            var open = Array.prototype.some.call(document.querySelectorAll('.dcOverlay.open, .dcTrailerOverlay.open'), function (o) {
                return o.getClientRects().length > 0;
            });
            document.body.classList.toggle('dcModalOpen', open);
        }
        if (typeof MutationObserver === 'function') {
            var modalObs = new MutationObserver(syncModalBody);
            modalObs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
            modalObs.observe(trailerOverlay, { attributes: true, attributeFilter: ['class'] });
        }
        view.addEventListener('viewhide', function () { setTimeout(syncModalBody, 0); });
        window.addEventListener('hashchange', function () { setTimeout(syncModalBody, 0); });
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
            return Array.prototype.filter.call(overlay.querySelectorAll('.dcCollection button, .dcSeasons button, .dcBtnRow button'), isUsable);
        }
        function firstModalButton(host) {
            // Eerst de aanvraagknoppen (seizoenen / knoppenrij), pas daarna de collectie bovenin.
            if (host !== trailerOverlay) {
                var main = Array.prototype.filter.call(overlay.querySelectorAll('.dcSeasons button, .dcBtnRow button'), isUsable);
                if (main.length) { return main[0]; }
            }
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
                    return c.classList && (c.classList.contains('dcCard') || c.classList.contains('dcTile') || c.classList.contains('dcPerson'));
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

        // Op tv is de beschrijving scrollbaar i.p.v. afgekapt. Vanaf de knoppen scrollt omlaag/omhoog de tekst.
        function updateOverviewHint(el) {
            if (!el) { return; }
            var more = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
            el.classList.toggle('dcMoreBelow', more);
        }
        function scrollOverview(dir) {
            var el = overlay.querySelector('.dcOverview');
            if (!el || el.scrollHeight <= el.clientHeight + 2) { return false; }
            var step = Math.max(40, Math.round(el.clientHeight * 0.6));
            if (dir === 'down' && el.scrollTop + el.clientHeight < el.scrollHeight - 2) {
                el.scrollTop = Math.min(el.scrollHeight, el.scrollTop + step);
            } else if (dir === 'up' && el.scrollTop > 0) {
                el.scrollTop = Math.max(0, el.scrollTop - step);
            } else {
                return false;
            }
            setTimeout(function () { updateOverviewHint(el); }, 350);
            return true;
        }

        // Rijen in de popup, van boven naar onder: cast, collectie (alles / posters / per film), seizoenen, knoppen.
        function modalRows() {
            var q = function (sel) { return Array.prototype.filter.call(overlay.querySelectorAll(sel), isUsable); };
            return [q('.dcCast .dcCastP'), q('.dcCollection .dcColAll'), q('.dcCollection .dcColPoster'),
                q('.dcCollection .dcColAdd'), q('.dcSeasons button'), q('.dcBtnRow button')]
                .filter(function (r) { return r.length > 0; });
        }
        function centerX(el) { var r = el.getBoundingClientRect(); return r.left + r.width / 2; }
        function nearestIn(row, from) {
            var x = centerX(from), best = row[0], bd = Infinity;
            row.forEach(function (el) { var d = Math.abs(centerX(el) - x); if (d < bd) { bd = d; best = el; } });
            return best;
        }
        function navModal(dir, active) {
            if (trailerOverlay.classList.contains('open')) {
                focusEl(trailerOverlay.querySelector('.dcTrailerClose'));
                return;
            }
            var rows = modalRows();
            var close = overlay.querySelector('.dcClose');
            if (active === close) {
                if (dir === 'down') { focusEl((rows[0] && rows[0][0]) || firstModalButton(overlay)); }
                else if (dir === 'left') { focusEl(firstModalButton(overlay)); }
                return;
            }
            var r = -1, c = -1;
            for (var k = 0; k < rows.length && r === -1; k++) { c = rows[k].indexOf(active); if (c !== -1) { r = k; } }
            if (r === -1) { focusEl(firstModalButton(overlay)); return; }
            var row = rows[r];
            if (dir === 'left') { if (c > 0) { focusEl(row[c - 1]); } }
            else if (dir === 'right') { if (c < row.length - 1) { focusEl(row[c + 1]); } }
            else if (dir === 'down') { if (r < rows.length - 1) { focusEl(nearestIn(rows[r + 1], active)); } else { scrollOverview('down'); } }
            else if (dir === 'up') {
                if (r > 0) { focusEl(nearestIn(rows[r - 1], active)); }
                else if (!scrollOverview('up')) { focusEl(close); }
            }
            if (row[0] && row[0].classList.contains('dcCastP')) { setTimeout(updateCastArrows, 350); }
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
                // Popup, overzicht, persoon of zoekresultaten: één stap terug binnen Discover.
                if (goBack(true)) { e.preventDefault(); }
                return; // op de Discover-start: Emby verlaat de pagina
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

        // Header recoloring: body class only while this page is the active route (CSS in discoverPage.html is scoped to it).
        function syncHeader() {
            var on = onDiscoverRoute() && document.body.contains(view);
            document.body.classList.toggle('dcDiscoverActive', !!on);
        }
        // ---- Popup boven een andere Emby-pagina (aangeroepen vanuit het knop-script) ----
        function openByIds(type, tmdbId) {
            api('GET', 'Discover/Title', { Type: type, TmdbId: tmdbId }).then(function (r) {
                if (!r || !r.Found || !r.Item) { showToast(text('Titel niet gevonden.', 'Title not found.', 'Titel nicht gefunden.'), true); return; }
                items[key(r.Item)] = r.Item;
                openItem(r.Item);
                // Downloadvoortgang meteen ophalen en blijven verversen zolang de popup open is.
                setTimeout(function () { scheduleQueue(0); }, 300);
            }, function () {
                showToast(text('Titel laden mislukt.', 'Loading title failed.', 'Titel konnte nicht geladen werden.'), true);
            });
        }
        if (embedded) {
            view.__dcOpen = openByIds;
            view.__dcClose = function () { if (trailerOverlay.classList.contains('open')) { closeTrailer(); } closeModal(); };
            view.__dcIsOpen = function () { return overlay.classList.contains('open') || trailerOverlay.classList.contains('open'); };
            // TV-afstandsbediening: alleen zolang de popup open is; anders doet Emby alles zelf.
            document.addEventListener('command', function (e) {
                if (!document.body.contains(view) || !view.__dcIsOpen()) { return; }
                var cmd = e.detail && e.detail.command;
                if (cmd === 'back') {
                    e.preventDefault();
                    if (trailerOverlay.classList.contains('open')) { closeTrailer(); } else { closeModal(); }
                    return;
                }
                if (cmd === 'up' || cmd === 'down' || cmd === 'left' || cmd === 'right') { e.preventDefault(); navModal(cmd, document.activeElement); }
            }, true);
            document.addEventListener('keydown', function (e) {
                var c = e.keyCode;
                if (c !== 27 && c !== 461 && c !== 10009) { return; }
                if (!document.body.contains(view) || !view.__dcIsOpen()) { return; }
                e.preventDefault(); e.stopPropagation();
                if (trailerOverlay.classList.contains('open')) { closeTrailer(); } else { closeModal(); }
            }, true);
            // Weg van deze pagina (Emby navigeert): popup dicht.
            window.addEventListener('hashchange', function () { if (view.__dcIsOpen()) { view.__dcClose(); } });
            return;
        }

        if (window.__dcHeaderSync) { window.removeEventListener('hashchange', window.__dcHeaderSync); }
        window.__dcHeaderSync = syncHeader;
        window.addEventListener('hashchange', syncHeader);

        // Emby's terugpijl linksboven: op Discover blijft die altijd binnen Discover (één stap terug, popup dicht;
        // op de Discover-start doet hij niets in plaats van naar het Emby-menu te gaan).
        function onHeaderBack(e) {
            var b = e.target && e.target.closest && e.target.closest('.headerBackButton, .headerBackButton-back, [data-action="back"]');
            if (!b || !b.closest('.skinHeader')) { return; }
            if (!onDiscoverRoute() || !document.body.contains(view) || !isShown(view.querySelector('.dcRoot'))) { return; }
            // Iets om terug te doen binnen Discover (popup, overzicht, persoon, zoeken): dat, en Emby doet niets.
            // Op de Discover-start werkt de pijl gewoon als Emby's terugknop (net als de terugtoets op de tv).
            if (goBack(true)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
        }
        view.addEventListener('viewshow', function () { syncHeader(); document.addEventListener('command', onCommand, true); document.addEventListener('click', onHeaderBack, true); });
        view.addEventListener('viewhide', function () { document.body.classList.remove('dcDiscoverActive'); document.removeEventListener('command', onCommand, true); document.removeEventListener('click', onHeaderBack, true); });

        // ---- Directe link vanaf een film-/seriepagina: #!/configurationpage?name=...&openType=movie&openId=123 ----
        // Wat er geopend moet worden kan ook via sessionStorage komen: Emby laat soms de extra parameters in het adres
        // weg, of hergebruikt de al geopende Discover-pagina zonder opnieuw "viewshow" te sturen.
        // Emby 4.11 toont bij een bezoek eerst een oude kopie van deze pagina en vervangt die daarna door een nieuwe.
        // Daarom wordt de opdracht niet meteen weggegooid: elke Discover-pagina die binnen 30 seconden in beeld komt
        // (de eerste keer laden na een herstart kan langer dan 10 s duren)
        // pakt hem op (één keer per pagina); daarna vervalt hij vanzelf.
        function takePending() {
            try {
                var raw = sessionStorage.getItem('dcOpenNext');
                if (!raw) { return null; }
                var p = JSON.parse(raw);
                if (!p || Date.now() - (p.at || 0) > 30000) { sessionStorage.removeItem('dcOpenNext'); return null; }
                if (view.__dcTook === p.at) { return null; }
                view.__dcTook = p.at;
                setTimeout(function () {
                    try { var cur = sessionStorage.getItem('dcOpenNext'); if (cur === raw) { sessionStorage.removeItem('dcOpenNext'); } } catch (e) { }
                }, 10000);
                return p;
            } catch (e) { return null; }
        }
        function openFromLink() {
            var pend = takePending();
            if (pend && pend.kind === 'person' && pend.id) {
                try { history.replaceState(null, '', window.location.href.replace(/&openPerson=\d+(&openName=[^&]*)?/, '')); } catch (e) { }
                openPerson(parseInt(pend.id, 10), pend.name || '', true);
                return;
            }
            if (pend && pend.kind === 'title' && pend.id) {
                api('GET', 'Discover/Title', { Type: pend.type, TmdbId: parseInt(pend.id, 10) }).then(function (r) {
                    if (r && r.Found && r.Item) { items[key(r.Item)] = r.Item; openItem(r.Item); }
                }, function () { });
                try { history.replaceState(null, '', window.location.href.replace(/&openType=[^&]*&openId=\d+/, '').replace(/&openPerson=\d+(&openName=[^&]*)?/, '')); } catch (e) { }
                return;
            }
            var pm = /[?&]openPerson=(\d+)(?:&openName=([^&]*))?/.exec(window.location.hash || '');
            if (pm) {
                try { history.replaceState(null, '', window.location.href.replace(/&openPerson=\d+(&openName=[^&]*)?/, '')); } catch (e) { }
                var nm = ''; try { nm = decodeURIComponent(pm[2] || ''); } catch (e) { }
                openPerson(parseInt(pm[1], 10), nm, true);
                return;
            }
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
            else { scheduleQueue(0); loadMyRequests(); loadExtras(); } // extra rijen vers: een weggehaalde lijst verdwijnt meteen
            openFromLink();
        });
        // Geen hashchange-luisteraar: Emby 4.11 maakt bij elke navigatie een nieuwe Discover-pagina (met eigen viewshow);
        // een oude, verborgen kopie zou de opdracht anders "opeten" en de persoon tonen waar je hem niet ziet.
        view.addEventListener('viewhide', function () { clearTimeout(queueTimer); queueTimer = null; });
    };
});
