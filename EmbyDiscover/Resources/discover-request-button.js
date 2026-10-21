/* Emby Discover: aparte knop "Aanvragen" naast Afspelen.
 * Afspelen = YouTube-trailer. Aanvragen = Radarr/Sonarr (series: seizoenskeuze).
 * Verbergt ook "Media informatie" op Discover/Trailers-detailpagina's. */
(function () {
    'use strict';
    if (window.__discoverRequestButtonVersion === '1.0.37.75-beta') { return; }
    if (window.__discoverRequestButton) {
        console.warn('[Discover] oudere knopcode is nog actief; vernieuw de webclient om dubbele handlers te voorkomen.');
        return;
    }
    window.__discoverRequestButton = true;
    window.__discoverRequestButtonVersion = '1.0.37.75-beta';
    console.log('[Discover] request-button script geladen v1.0.37.75-beta');

    var uiLanguage = 'nl';
    function text(dutch, english, german) {
        return uiLanguage === 'de' ? (german || english) : uiLanguage === 'en' ? english : dutch;
    }
    var diagnosticsEnabled = false;
    var lastDiagnostic = null;
    var diagnosticsLoaded = false;
    var diagnosticsRequest = false;
    var diagnosticsRetryAfter = 0;
    var diagnosticsItemId;
    var lookups = {};

    // Diagnostics are opt-in because the detail pages can contain user-visible debug text.
    function dbg(msg) {
        try {
            if (msg === null) { lastDiagnostic = null; }
            else { lastDiagnostic = msg; }
            var el = document.getElementById('discover-dbg');
            if (!diagnosticsEnabled || msg === null) {
                if (el && el.parentNode) { el.parentNode.removeChild(el); }
                return;
            }
            if (!el) {
                el = document.createElement('div');
                el.id = 'discover-dbg';
                el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:100002;max-width:60vw;font:11px/1.3 monospace;' +
                    'color:#ffd666;background:rgba(0,0,0,.7);padding:4px 8px;border-radius:4px;pointer-events:none;white-space:pre-wrap;';
                document.body.appendChild(el);
            }
            el.textContent = 'Discover v1.0.37.75-beta | ' + msg;
        } catch (e) { }
    }
    var isAdmin = false;
    var adminChecked = false;
    var timer = null;

    // CSS: media-info verbergen + Aanvragen-knop herkenbaar maken
    (function injectCss() {
        if (document.getElementById('discover-request-css')) return;
        var s = document.createElement('style');
        s.id = 'discover-request-css';
        s.textContent = [
            'body.discover-item-page .btnMoreCommands { display: none !important; }',
            'body.discover-item-page .itemDetailPage.discover-seerr { position: relative; isolation: isolate; }',
            '.discover-hero { position: absolute; top: 0; left: 0; right: 0; height: 480px; z-index: -1; pointer-events: none;',
            '  background-size: cover; background-position: center top; opacity: .55;',
            '  -webkit-mask-image: linear-gradient(#000 35%, transparent); mask-image: linear-gradient(#000 35%, transparent); }',
            'body.discover-item-page .itemDetailPage .btnPlay, body.discover-item-page .itemDetailPage .detailButton { border-radius: 2em !important; }',
            'body.discover-item-page .itemDetailPage .detailImageContainer img, body.discover-item-page .itemDetailPage .cardImageContainer, body.discover-item-page .itemDetailPage .itemDetailImage {',
            '  border-radius: .9em !important; box-shadow: 0 14px 40px rgba(0,0,0,.55) !important; }',
            'body.discover-item-page .itemDetailPage .nameContainer h1, body.discover-item-page .itemDetailPage h1.itemName { font-size: 2.2em !important; font-weight: 700 !important; }',
            'body.discover-ask-page .itemDetailPage .btnPlaystate, body.discover-ask-page .itemDetailPage .btnUserRating,',
            'body.discover-ask-page .itemDetailPage .btnMoreCommands, body.discover-ask-page .itemDetailPage .btnShuffle,',
            'body.discover-ask-page .itemDetailPage .btnPlaylist, body.discover-ask-page .itemDetailPage .btnSplitVersions,',
            'body.discover-ask-page .itemDetailPage .btnEditItemMetadata, body.discover-ask-page .itemDetailPage .btnEditImages,',
            'body.discover-ask-page .itemDetailPage .discover-hide { display: none !important; }',
            'body.discover-ask-page .btnPlaystate, body.discover-ask-page .btnUserRating, body.discover-ask-page .btnMoreCommands,',
            'body.discover-ask-page .btnShuffle, body.discover-ask-page .btnPlaylist, body.discover-ask-page .btnSplitVersions,',
            'body.discover-ask-page .btnEditItemMetadata, body.discover-ask-page .btnEditImages, body.discover-ask-page .discover-hide { display: none !important; }',
            'body.discover-ask-page [class*="verview"] { white-space: pre-line !important; line-height: 1.55 !important; }',
            'body.discover-ask-page [class*="verview"], body.discover-ask-page [class*="clamp"] {',
            '  -webkit-line-clamp: unset !important; line-clamp: unset !important; max-height: none !important; overflow: visible !important; }',
            'body.discover-ask-page .discover-ask-hidden { display: none !important; }',
            'body.discover-ask-play .itemDetailPage .btnPlay { background: #22a559 !important; color: #fff !important; border-radius: 2em !important; }',
            '.discover-folder-card [class*="cardOverlayFab"], .discover-folder-card [class*="cardOverlayButton"],',
            '.discover-folder-card .itemSelectionPanel { display: none !important; }',
            'body.discover-folder-page .btnPlay, body.discover-folder-page .btnShuffle, body.discover-folder-page .btnQueue { display: none !important; }',
            '.btnDiscoverRequest {',
            '  background: #ffb400 !important; color: #111 !important;',
            '  border: none !important; margin-left: .5em !important;',
            '}',
            '.btnDiscoverRequest:disabled { opacity: .55; cursor: default; }',
            '.btnDiscoverRequest .detailButton-icon,',
            '.btnDiscoverRequest .md-icon { color: #111 !important; }'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    })();

    function api() { return window.ApiClient || null; }

    function loadDiagnosticsSetting() {
        var client = api();
        if (!client || !client.ajax || !client.getUrl || diagnosticsRequest || Date.now() < diagnosticsRetryAfter) { return; }
        diagnosticsRequest = true;
        client.ajax({ type: 'GET', url: client.getUrl('Discover/Status'), dataType: 'json' }).then(function (status) {
            diagnosticsEnabled = !!(status && status.ShowDiagnostics);
            var culture = String(status && status.PluginLanguage || '').toLowerCase();
            uiLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : 'en';
            diagnosticsLoaded = true;
            diagnosticsRequest = false;
            diagnosticsRetryAfter = 0;
            if (diagnosticsEnabled && lastDiagnostic) { dbg(lastDiagnostic); }
            else if (!diagnosticsEnabled) { dbg(null); }
            Array.prototype.forEach.call(document.querySelectorAll('.btnDiscoverRequest'), function (btn) {
                if (btn._info) { render(btn, btn._info); }
            });
        }, function (error) {
            diagnosticsRequest = false;
            diagnosticsRetryAfter = Date.now() + 5000;
            console.error('[Discover] debuginstelling laden mislukt', error);
        });
    }

    function itemIdFromHash() {
        var h = window.location.hash || '';
        if (!/\/item\?/.test(h)) { return null; }
        var m = /[?&]id=([^&]+)/.exec(h);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function visible(el) {
        if (!el) { return false; }
        if (!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length))) { return false; }
        for (var n = el; n && n !== document.body; n = n.parentElement) {
            if (n.classList && n.classList.contains('hide')) { return false; }
        }
        return true;
    }

    function findButtonBox() {
        var play = findPlayButton(document.body);
        if (play && play.parentElement && visible(play.parentElement)) {
            return play.parentElement;
        }
        var selectors = [
            '.mainDetailButtons',
            '.detailButtons',
            '.itemDetailButtons',
            '.detailPagePrimaryContent .detailButtons',
            '[class*="DetailButtons"]'
        ];
        for (var s = 0; s < selectors.length; s++) {
            var list = document.querySelectorAll(selectors[s]);
            for (var i = 0; i < list.length; i++) {
                if (visible(list[i])) { return list[i]; }
            }
        }
        return null;
    }

    function findPlayButton(root) {
        if (!root) return null;
        if (root === document.body) {
            var pages = root.querySelectorAll('.itemDetailPage');
            for (var p = 0; p < pages.length; p++) {
                if (visible(pages[p])) {
                    var pagePlay = findPlayButton(pages[p]);
                    if (pagePlay) { return pagePlay; }
                }
            }
        }
        var candidates = root.querySelectorAll(
            '.btnPlay, .btnResume, button[data-action="play"], button[title*="Play"], button[title*="Afspelen"], .raised.detailButton'
        );
        for (var i = 0; i < candidates.length; i++) {
            if (!visible(candidates[i])) continue;
            if (candidates[i].classList.contains('btnDiscoverRequest')) continue;
            var t = (candidates[i].textContent || '') + ' ' + (candidates[i].getAttribute('title') || '');
            if (/afspelen|play|resume|hervatten/i.test(t) || candidates[i].classList.contains('btnPlay') || candidates[i].classList.contains('btnResume')) {
                return candidates[i];
            }
        }
        var all = root.querySelectorAll('button.detailButton, button.raised');
        for (var j = 0; j < all.length; j++) {
            if (!visible(all[j]) || all[j].classList.contains('btnDiscoverRequest')) continue;
            var txt = (all[j].textContent || '').trim();
            if (/afspelen|play|resume|hervatten/i.test(txt)) return all[j];
        }
        return null;
    }

    function positionRequestButton(id) {
        var btn = document.querySelector('.btnDiscoverRequest[data-itemid="' + id + '"]');
        var play = findPlayButton(document.body);
        if (!btn || !play || !play.parentNode) { return false; }
        if (btn.classList.contains('btnDiscoverFloating')) {
            btn.classList.remove('btnDiscoverFloating');
            ['position', 'right', 'bottom', 'z-index', 'margin-left', 'box-shadow'].forEach(function (name) {
                btn.style.removeProperty(name);
            });
        }
        if (btn.parentNode !== play.parentNode || btn.previousElementSibling !== play) {
            play.parentNode.insertBefore(btn, play.nextSibling);
        }
        if (btn._rm && btn.parentNode) { btn.parentNode.insertBefore(btn._rm, btn.nextSibling); }
        return true;
    }

    function buttonDiagnostic(id) {
        if (askIds[id]) {
            var nativeButton = findPlayButton(document.body);
            if (!nativeButton) { return 'native Aanvragen-knop ontbreekt of is nog niet zichtbaar'; }
            var nativeLabel = (nativeButton.textContent || '').replace(/\s+/g, ' ').trim();
            return 'native Aanvragen-knop ' + (visible(nativeButton) ? 'zichtbaar' : 'verborgen') +
                (nativeLabel ? ' [' + nativeLabel + ']' : '') +
                '; extra plugin-aanvraagknop is hier niet van toepassing';
        }
        var button = document.querySelector('.btnDiscoverRequest[data-itemid="' + id + '"]');
        if (!button) { return 'aanvraagknop ontbreekt'; }
        var play = findPlayButton(document.body);
        var position = button.classList.contains('btnDiscoverFloating') ? 'zwevend' :
            (play && button.parentNode === play.parentNode && button.previousElementSibling === play ?
                'naast Afspelen' : 'niet naast Afspelen');
        var label = (button.textContent || '').replace(/\s+/g, ' ').trim();
        return 'aanvraagknop ' + (visible(button) ? 'zichtbaar' : 'verborgen') +
            (label ? ' [' + label + ']' : '') + '; positie=' + position;
    }

    var negCount = {};
    var askIds = {};
    var askStatus = {};      // id -> 0 niet aangevraagd, 1 aangevraagd, 2 beschikbaar (live uit Resolve)
    var askLast = null;
    var trailerIds = {};

    // Emby geeft in sommige versies geen Path/ChannelId in de API terug, maar de pagina toont het pad wel
    // onder "Media informatie" (YouTube-link of de clip). Dat gebruiken we als herkenning.
    function domLooksLikeDiscover() {
        var els = document.querySelectorAll('.audioVideoMediaInfo, .mediaInfoItem, .itemMiscInfo');
        for (var i = 0; i < els.length; i++) {
            var page = els[i].closest ? els[i].closest('.itemDetailPage') : null;
            if (page && !visible(page)) { continue; }
            if (/discover-request-ok|youtube\.com\/watch|youtu\.be\//i.test(els[i].textContent || '')) { return true; }
        }
        return false;
    }

    function resolveItem(id) {
        if (lookups[id]) { return lookups[id]; }
        var c = api();
        if (!c) { return Promise.resolve(null); }
        // Emby geeft ChannelId/Path alleen mee als je de velden expliciet vraagt.
        var uid = c.getCurrentUserId();
        var fetchItem = c.ajax({
            type: 'GET',
            url: c.getUrl('Users/' + uid + '/Items/' + id, { Fields: 'ChannelInfo,Path,ProviderIds,Overview,MediaSources' }),
            dataType: 'json'
        }).then(null, function () { return c.getItem(uid, id); });
        var p = fetchItem.then(function (item) {
            if (!item) { dbg('getItem gaf niets'); return null; }
            var paths = [item.Path || ''];
            (item.MediaSources || []).forEach(function (ms) { paths.push(ms.Path || ''); });
            var pathStr = paths.join(' ');
            var ch = (item.ChannelName || '') + ' ' + pathStr + ' ' + (item.Id || '');
            var mine = !!(item.ChannelId)
                || /discover|trailer|youtube\.com|youtu\.be/i.test(ch)
                || item.Type === 'Trailer'
                || item.ExtraType === 'Trailer'
                || (item.Id && /^(m|t):/.test(String(item.Id)));
            // Aanvraagitem ("Aanvragen: titel"): Afspelen = aanvragen. Hier geen extra knop, maar Afspelen hernoemen.
            // Trailer-item ("Trailer: titel"): Afspelen = trailer, de knop Aanvragen wordt wel toegevoegd.
            // Op beide pagina's verdwijnen de overbodige knoppen en het blok "Over".
            var nm = String(item.Name || '');
            if (/^[\u2713\u23F3]?\s*Trailer:/.test(nm)) { trailerIds[id] = true; }
            if (/^[\u2713\u23F3]?\s*(?:Aanvragen|Anfragen|Request):/i.test(nm)) {
                askIds[id] = true;
                var askName = nm.replace(/^[\u2713\u23F3]?\s*(?:Aanvragen|Anfragen|Request):\s*/i, '');
                var askPid = item.ProviderIds || {};
                return c.ajax({
                    type: 'GET',
                    url: c.getUrl('Discover/Resolve', {
                        Name: askName,
                        Year: item.ProductionYear || 0,
                        Overview: '',
                        TmdbId: parseInt(askPid.Tmdb || askPid.tmdb || 0, 10) || 0
                    }),
                    dataType: 'json'
                }).then(function (r) {
                    if (r && r.Found) { askStatus[id] = r.Status; }
                    schedule();
                    return null;
                }, function () { schedule(); return null; });
            }
            var domMine = domLooksLikeDiscover();
            mine = mine || domMine;
            dbg('item: ' + item.Name + ' | type=' + item.Type + ' | channelId=' + item.ChannelId + ' | path=' + pathStr.slice(0, 60) + ' | dom=' + domMine + ' | mine=' + mine);
            if (!mine) {
                negCount[id] = (negCount[id] || 0) + 1;
                if (negCount[id] < 5) { delete lookups[id]; }   // pagina nog niet opgebouwd: later opnieuw proberen
                return null;
            }
            var name = String(item.Name || '').replace(/^[\u2713\u23F3]\s+/, '');
            var pid = item.ProviderIds || {};
            var tmdb = parseInt(pid.Tmdb || pid.tmdb || 0, 10) || 0;
            if (!tmdb && item.Id) {
                var mm = /^(?:m|t):(\d+)$/.exec(String(item.Id));
                if (mm) tmdb = parseInt(mm[1], 10);
            }
            return c.ajax({
                type: 'GET',
                url: c.getUrl('Discover/Resolve', {
                    Name: name,
                    Year: item.ProductionYear || 0,
                    Overview: item.Overview || '',
                    TmdbId: tmdb
                }),
                dataType: 'json'
            }).then(function (r) {
                dbg('resolve: Found=' + (r && r.Found) + ' Type=' + (r && r.Type) + ' Status=' + (r && r.Status) + ' Tmdb=' + (r && r.TmdbId));
                return r && r.Found ? r : { Found: false };
            });
        });
        lookups[id] = p;
        p.then(null, function (e) { dbg('FOUT bij ophalen: ' + (e && (e.status || e.message) || e)); delete lookups[id]; });
        return p;
    }

    function toast(text, isError) {
        var t = document.createElement('div');
        t.textContent = text;
        t.style.cssText = 'position:fixed;left:50%;bottom:3em;transform:translateX(-50%);z-index:100000;padding:.8em 1.6em;' +
            'border-radius:2em;color:#fff;font-size:1.1em;background:' + (isError ? '#d32f2f' : '#22a559') +
            ';box-shadow:0 4px 20px rgba(0,0,0,.4);font-family:inherit;';
        document.body.appendChild(t);
        setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 3500);
    }

    function setLabel(btn, text, icon) {
        var span = btn.querySelector('.detailButton-text') || btn.querySelector('span');
        var ico = btn.querySelector('.detailButton-icon') || btn.querySelector('i.md-icon') || btn.querySelector('i');
        if (span) { span.textContent = text; }
        else if (!ico) { btn.textContent = text; }
        if (ico) { ico.textContent = icon; }
        btn.setAttribute('title', text);
        btn.setAttribute('aria-label', text);
    }

    function updateRm(btn, info) {
        var rm = btn._rm;
        if (!rm) { return; }
        var show = isAdmin && info.Found && info.Status > 0;
        rm.style.setProperty('display', show ? 'inline-flex' : 'none', 'important');
        rm.disabled = false;
        var t = info.Status === 2
            ? text('Verwijderen', 'Delete', 'Löschen')
            : text('Annuleren', 'Cancel request', 'Anfrage abbrechen');
        var span = rm.querySelector('.detailButton-text');
        if (span) { span.textContent = t; }
        rm.setAttribute('title', t);
    }

    function render(btn, info) {
        btn._info = info;
        updateRm(btn, info);
        if (!info.Found) { setLabel(btn, text('Niet gevonden', 'Not found', 'Nicht gefunden'), 'help_outline'); btn.disabled = true; }
        else if (info.Status === 2) { setLabel(btn, text('Beschikbaar', 'Available', 'Verfügbar'), 'check'); btn.disabled = true; }
        else if (info.Status === 1) { setLabel(btn, text('Aangevraagd', 'Requested', 'Angefordert'), 'check'); btn.disabled = true; }
        else { setLabel(btn, text('Aanvragen', 'Request', 'Anfragen'), 'add'); btn.disabled = false; }
    }

    function closeModal(overlay) {
        if (overlay && overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
    }

    function showSeasonPicker(info, onConfirm) {
        var seasons = (info.Seasons || []).filter(function (s) { return s.Number > 0 || s.EpisodeCount > 0; });
        if (seasons.length === 0) {
            onConfirm(null);
            return;
        }

        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:1em;';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeModal(overlay); } });

        var card = document.createElement('div');
        card.style.cssText = 'background:#1c1c1e;color:#fff;border-radius:12px;max-width:420px;width:100%;max-height:80vh;overflow:auto;' +
            'box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:inherit;';
        card.addEventListener('click', function (e) { e.stopPropagation(); });

        var header = document.createElement('div');
        header.style.cssText = 'padding:1.2em 1.4em .6em;font-size:1.15em;font-weight:600;';
        header.textContent = text('Seizoenen: ', 'Seasons: ', 'Staffeln: ') + (info.Title || '');
        card.appendChild(header);

        var sub = document.createElement('div');
        sub.style.cssText = 'padding:0 1.4em .8em;opacity:.7;font-size:.9em;';
        sub.textContent = text('Kies welke seizoenen je wilt aanvragen.',
            'Choose which seasons to request.',
            'Wähle aus, welche Staffeln angefordert werden sollen.');
        card.appendChild(sub);

        var list = document.createElement('div');
        list.style.cssText = 'padding:0 1em .5em;';

        var checks = [];
        seasons.forEach(function (s) {
            var row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:.7em;padding:.55em .4em;border-radius:8px;cursor:pointer;';
            row.onmouseenter = function () { row.style.background = 'rgba(255,255,255,.06)'; };
            row.onmouseleave = function () { row.style.background = 'transparent'; };

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = s.Number > 0;
            cb.value = String(s.Number);
            cb.style.cssText = 'width:1.15em;height:1.15em;accent-color:#22a559;';
            checks.push(cb);

            var label = document.createElement('span');
            label.style.cssText = 'flex:1;';
            var name = s.Name || (text('Seizoen ', 'Season ', 'Staffel ') + s.Number);
            if (s.Number === 0 && name.toLowerCase().indexOf('special') < 0) { name = 'Specials'; }
            label.textContent = name + (s.EpisodeCount ? ' (' + s.EpisodeCount + ' ' + text('afl.', 'eps.', 'Folgen') + ')' : '');

            row.appendChild(cb);
            row.appendChild(label);
            list.appendChild(row);
        });
        card.appendChild(list);

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:.6em;padding:1em 1.2em 1.2em;justify-content:flex-end;flex-wrap:wrap;';

        function mkBtn(text, primary) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.style.cssText = 'border:none;border-radius:8px;padding:.55em 1.1em;font-size:.95em;cursor:pointer;font-family:inherit;' +
                (primary ? 'background:#22a559;color:#fff;' : 'background:rgba(255,255,255,.1);color:#fff;');
            return b;
        }

        var btnAll = mkBtn(text('Alles', 'All', 'Alle'), false);
        btnAll.onclick = function () { checks.forEach(function (c) { c.checked = true; }); };

        var btnCancel = mkBtn(text('Annuleren', 'Cancel', 'Abbrechen'), false);
        btnCancel.onclick = function () { closeModal(overlay); };

        var btnOk = mkBtn(text('Aanvragen', 'Request', 'Anfragen'), true);
        btnOk.onclick = function () {
            var selected = [];
            checks.forEach(function (c) { if (c.checked) { selected.push(parseInt(c.value, 10)); } });
            if (selected.length === 0) {
                toast(text('Kies minstens één seizoen.', 'Select at least one season.', 'Wähle mindestens eine Staffel aus.'), true);
                return;
            }
            closeModal(overlay);
            onConfirm(selected);
        };

        actions.appendChild(btnAll);
        actions.appendChild(btnCancel);
        actions.appendChild(btnOk);
        card.appendChild(actions);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function doRequest(btn, info, seasons) {
        btn.disabled = true;
        setLabel(btn, text('Aanvragen...', 'Requesting...', 'Wird angefragt...'), 'add');
        var c = api();
        var body = { Type: info.Type, TmdbId: info.TmdbId };
        if (seasons && seasons.length) { body.Seasons = seasons; }
        c.ajax({
            type: 'POST', url: c.getUrl('Discover/RequestItem'),
            data: JSON.stringify(body),
            contentType: 'application/json', dataType: 'json'
        }).then(function (r) {
            if (r && r.Success) {
                info.Status = 1;
                toast((info.Title || text('Titel', 'Title', 'Titel')) + ': ' + r.Message, false);
            } else {
                toast(text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                    ((r && r.Message) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')), true);
            }
            render(btn, info);
        }, function () {
            toast(text('Aanvraag mislukt.', 'Request failed.', 'Anfrage fehlgeschlagen.'), true);
            render(btn, info);
        });
    }

    // Inline !important-stijlen: werkt met elk thema (ook zonder eigen CSS) en wint van thema-regels.
    function styleButton(btn) {
        var st = {
            'display': 'inline-flex', 'align-items': 'center', 'justify-content': 'center',
            'background': '#ffb400', 'background-color': '#ffb400', 'color': '#111',
            'border': 'none', 'border-radius': '2em', 'padding': '.6em 1.4em', 'margin-left': '.5em',
            'cursor': 'pointer', 'font-family': 'inherit', 'font-size': 'inherit', 'font-weight': '700',
            'visibility': 'visible', 'opacity': '1', 'transform': 'none', 'box-shadow': 'none'
        };
        for (var k in st) { btn.style.setProperty(k, st[k], 'important'); }
    }

    function buildButton(id, info) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('is', 'emby-button');
        btn.className = 'raised detailButton emby-button btnDiscoverRequest';
        btn.setAttribute('data-itemid', id);
        btn.innerHTML = '<i class="md-icon detailButton-icon material-icons">add</i><span class="detailButton-text">Aanvragen</span>';
        styleButton(btn);
        render(btn, info);

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (!info.Found || info.Status > 0 || btn.disabled) { return; }

            if (info.Type === 'tv' && info.Seasons && info.Seasons.length > 1) {
                showSeasonPicker(info, function (selected) {
                    doRequest(btn, info, selected);
                });
            } else {
                doRequest(btn, info, null);
            }
        }, true);

        return btn;
    }

    function addFloating(id, info) {
        if (document.querySelector('.btnDiscoverRequest')) { return; }
        var btn = buildButton(id, info);
        btn.classList.add('btnDiscoverFloating');
        btn.style.setProperty('position', 'fixed', 'important');
        btn.style.setProperty('right', '1.5em', 'important');
        btn.style.setProperty('bottom', '1.5em', 'important');
        btn.style.setProperty('z-index', '99999', 'important');
        btn.style.setProperty('margin-left', '0', 'important');
        btn.style.setProperty('box-shadow', '0 4px 16px rgba(0,0,0,.5)', 'important');
        document.body.appendChild(btn);
        syncBodyClass(id);
        console.log('[Discover] geen knoppenbalk gevonden, zwevende knop gebruikt');
    }

    function buildRemoveButton(btn, id, info) {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.setAttribute('is', 'emby-button');
        rm.className = 'raised detailButton emby-button btnDiscoverRemove';
        rm.setAttribute('data-itemid', id);
        rm.innerHTML = '<i class="md-icon detailButton-icon material-icons">delete</i><span class="detailButton-text">Annuleren</span>';
        var st = {
            'display': 'none', 'align-items': 'center', 'justify-content': 'center',
            'background': '#c62828', 'background-color': '#c62828', 'color': '#fff',
            'border': 'none', 'border-radius': '2em', 'padding': '.6em 1.4em', 'margin-left': '.5em',
            'cursor': 'pointer', 'font-family': 'inherit', 'font-size': 'inherit', 'font-weight': '700',
            'visibility': 'visible', 'opacity': '1', 'transform': 'none', 'box-shadow': 'none'
        };
        for (var k in st) { rm.style.setProperty(k, st[k], 'important'); }

        rm.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            var cur = btn._info || info;
            if (!cur || cur.Status === 0 || rm.disabled) { return; }
            var arr = cur.Type === 'tv' ? 'Sonarr' : 'Radarr';
            var withFiles = cur.Status === 2;
            var q = withFiles
                ? text('"' + (cur.Title || 'Titel') + '" verwijderen uit ' + arr + ' EN de bestanden van schijf verwijderen?',
                    'Delete "' + (cur.Title || 'Title') + '" from ' + arr + ' AND delete its files from disk?',
                    '"' + (cur.Title || 'Titel') + '" aus ' + arr + ' entfernen UND die Dateien von der Festplatte löschen?')
                : text('De aanvraag voor "' + (cur.Title || 'titel') + '" annuleren en verwijderen uit ' + arr + '?',
                    'Cancel the request for "' + (cur.Title || 'title') + '" and remove it from ' + arr + '?',
                    'Die Anfrage für "' + (cur.Title || 'Titel') + '" abbrechen und aus ' + arr + ' entfernen?');
            if (!window.confirm(q)) { return; }
            rm.disabled = true;
            var c = api();
            c.ajax({
                type: 'POST', url: c.getUrl('Discover/RemoveItem'),
                data: JSON.stringify({ Type: cur.Type, TmdbId: cur.TmdbId, DeleteFiles: withFiles }),
                contentType: 'application/json', dataType: 'json'
            }).then(function (r) {
                if (r && r.Success) {
                    cur.Status = 0;
                    toast((cur.Title || text('Titel', 'Title', 'Titel')) + ': ' + r.Message, false);
                } else {
                    toast(text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                        ((r && r.Message) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')), true);
                }
                render(btn, cur);
            }, function () {
                toast(text('Verwijderen mislukt (alleen beheerders mogen dit).',
                    'Delete failed (only administrators can do this).',
                    'Löschen fehlgeschlagen (nur Administratoren dürfen dies).'), true);
                render(btn, cur);
            });
        }, true);
        return rm;
    }

    function addButton(box, id, info) {
        var current = document.querySelector('.btnDiscoverRequest[data-itemid="' + id + '"]');
        if (current) {
            current._info = info;
            render(current, info);
            positionRequestButton(id);
            return;
        }
        if (box.querySelector('.btnDiscoverRequest')) { return; }

        var btn = buildButton(id, info);
        btn._rm = buildRemoveButton(btn, id, info);
        btn._info = info;
        var play = findPlayButton(box);

        if (play && play.parentNode) {
            if (play.nextSibling) {
                play.parentNode.insertBefore(btn, play.nextSibling);
            } else {
                play.parentNode.appendChild(btn);
            }
        } else {
            box.appendChild(btn);
        }
        if (btn.parentNode) { btn.parentNode.insertBefore(btn._rm, btn.nextSibling); }
        render(btn, info);
        syncBodyClass(id);
    }

    var misses = 0;

    // Verbergt het blok "Media informatie" (pad van de clip/YouTube-link) op Discover-pagina's.
    function hideMediaInfo() {
        if (diagnosticsEnabled) { return; }
        var pages = document.querySelectorAll('.itemDetailPage');
        for (var p = 0; p < pages.length; p++) {
            if (!visible(pages[p])) { continue; }
            var els = pages[p].querySelectorAll('div, h1, h2, h3, h4, span, label');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.children.length !== 0) { continue; }
                if (!/^media\s*info(rmatie|rmation)?$/i.test((el.textContent || '').trim())) { continue; }
                var par = el.parentElement;
                if (!par) { continue; }
                if (/genres?|regisseur|director/i.test(par.textContent.replace(el.textContent, ''))) {
                    // label zit in een groep met andere velden: alleen label + de twee regels erna verbergen
                    var n = el, c = 0;
                    while (n && c < 3) { n.style.setProperty('display', 'none', 'important'); n = n.nextElementSibling; c++; }
                } else {
                    par.style.setProperty('display', 'none', 'important');
                }
            }
        }
    }

    // Seerr-achtige uitstraling: grote achtergrondafbeelding (TMDB) bovenaan de detailpagina.
    function applyHero(info) {
        var pages = document.querySelectorAll('.itemDetailPage');
        for (var i = 0; i < pages.length; i++) {
            var pg = pages[i];
            if (!visible(pg)) { continue; }
            pg.classList.add('discover-seerr');
            var h = pg.querySelector('.discover-hero');
            if (!h) {
                h = document.createElement('div');
                h.className = 'discover-hero';
                pg.insertBefore(h, pg.firstChild);
            }
            if (info && info.Backdrop && h.getAttribute('data-src') !== info.Backdrop) {
                h.setAttribute('data-src', info.Backdrop);
                h.style.backgroundImage = 'url("' + info.Backdrop + '")';
            }
        }
    }

    function removeHero() {
        var hs = document.querySelectorAll('.discover-hero');
        for (var i = 0; i < hs.length; i++) { if (hs[i].parentNode) { hs[i].parentNode.removeChild(hs[i]); } }
        var ps = document.querySelectorAll('.itemDetailPage.discover-seerr');
        for (var j = 0; j < ps.length; j++) { ps[j].classList.remove('discover-seerr'); }
    }

    function syncBodyClass(id) {
        var btn = id ? document.querySelector('.btnDiscoverRequest[data-itemid="' + id + '"]') : null;
        var on = !!btn;
        if (document.body) { document.body.classList.toggle('discover-item-page', on); }
        if (on) { hideMediaInfo(); applyHero(btn._info); } else { removeHero(); }
    }

    // Verbergt het hele blok "Over" (genres, links, media-informatie, video/geluid) en alles daaronder.
    function hideOverSection() {
        if (diagnosticsEnabled) { return; }
        var pages = document.querySelectorAll('.itemDetailPage');
        for (var p = 0; p < pages.length; p++) {
            if (!visible(pages[p])) { continue; }
            var els = pages[p].querySelectorAll('h1, h2, h3, h4, div, span');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.children.length !== 0) { continue; }
                if (!/^(over|about)$/i.test((el.textContent || '').trim())) { continue; }
                var sec = el.closest ? el.closest('.detailVerticalSection, .verticalSection, section') : null;
                var guard = '.btnPlay, .mainDetailButtons, .detailButtons, .btnDiscoverRequest';
                if (!sec || sec === pages[p] || sec.querySelector(guard)) { sec = el.parentElement; }
                if (!sec || sec === pages[p] || sec.querySelector(guard)) { continue; }
                for (var n = sec; n; n = n.nextElementSibling) { n.classList.add('discover-hide'); }
            }
        }
    }

    // Afspelen/Aanvragen alleen tonen als de titel nog niet is aangevraagd of beschikbaar.
    function syncAskPlay(id) {
        var hidden = document.querySelectorAll('.discover-ask-hidden');
        var st = askStatus[id];
        if (st === undefined || st === 0) {
            for (var i = 0; i < hidden.length; i++) { hidden[i].classList.remove('discover-ask-hidden'); }
            return;
        }
        var play = findPlayButton(document.body);
        if (play) { play.classList.add('discover-ask-hidden'); }
    }

    // De beschrijving staat standaard ingeklapt met een knop "Meer". Die knop opent een venster van Emby (de popup);
    // vroeger klikte de plugin zelf op "Meer", waardoor het venster ongevraagd opende. Nu wordt de knop alleen verborgen
    // en de tekst met CSS (zie injectCss) volledig getoond.
    function expandOverview() {
        var els = document.querySelectorAll('button, a, span, div');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.children.length !== 0 || !visible(el)) { continue; }
            var t = (el.textContent || '').trim();
            if (!/^(meer|more|minder|less)$/i.test(t)) { continue; }
            if (el.closest && el.closest('.dcRoot, .btnDiscoverRequest')) { continue; }
            var target = el.closest ? (el.closest('button, a') || el) : el;
            target.classList.add('discover-hide');
        }
    }

    // Het bestandspad / de YouTube-link en de regel "MP4 ... Toegevoegd" (Media informatie zonder kopje).
    // We zoeken op tekstknopen (ook als de tekst naast andere elementen in dezelfde div staat) en verbergen
    // het kleinste omhullende blok dat geen knoppen, titel, beschrijving of afbeelding bevat.
    function hideBlockOf(node) {
        var sec = node.nodeType === 3 ? node.parentElement : node;
        if (!sec) { return; }
        while (sec.parentElement && sec.parentElement !== document.body) {
            var par = sec.parentElement;
            if (par.querySelector('button, h1, [class*="verview"], .btnPlay, img, video, .btnDiscoverRequest')) { break; }
            if ((par.textContent || '').length > 300) { break; }
            sec = par;
        }
        sec.classList.add('discover-hide');
        sec.style.setProperty('display', 'none', 'important');
    }

    function hideFilePathLines(withMeta, onlyPages) {
        if (diagnosticsEnabled) { return; }
        var pages = document.querySelectorAll('.itemDetailPage');
        var roots = [];
        for (var p = 0; p < pages.length; p++) { if (visible(pages[p])) { roots.push(pages[p]); } }
        if (!roots.length) { if (onlyPages) { return; } roots.push(document.body); }
        for (var r = 0; r < roots.length; r++) {
            var walker = document.createTreeWalker(roots[r], NodeFilter.SHOW_TEXT, null, false);
            var hits = [];
            var n;
            while ((n = walker.nextNode())) {
                var t = (n.nodeValue || '').trim();
                if (!t || t.length > 200) { continue; }
                var par = n.parentElement;
                if (!par || !visible(par)) { continue; }
                if (par.closest && par.closest('button, h1, .btnDiscoverRequest, [class*="verview"], script, style')) { continue; }
                var isPath = /discover-cards|discover-request-ok|\/config\/data\//i.test(t)
                    || /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(t);
                var isMeta = false;
                if (withMeta) {
                    isMeta = /^(mp4|mkv|avi|m4v)\b.*\d{2}-\d{2}-\d{4}/i.test(t)
                        || /^(mp4|mkv|avi|m4v)$/i.test(t)
                        || (/\d{2}-\d{2}-\d{4}/.test(t) && /(toegevoegd|added)\s*$/i.test(t));
                }
                if (isPath || isMeta) { hits.push(n); }
            }
            for (var i = 0; i < hits.length; i++) { hideBlockOf(hits[i]); }
        }
    }

    // Verbergt alle knoppen naast Afspelen/Aanvragen (afgevinkt, favoriet, drie puntjes, enz.), ook als de
    // pagina niet de klasse .itemDetailPage heeft (verschilt per Emby-versie).
    function hideExtraButtons() {
        var play = findPlayButton(document.body);
        var box = play && play.parentElement ? play.parentElement : null;
        if (!box) { return; }
        var btns = box.querySelectorAll('button, a.detailButton');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            if (b === play || b.contains(play) || play.contains(b)) { continue; }
            if (b.classList.contains('btnDiscoverRequest') || b.classList.contains('btnDiscoverRemove')) { continue; }
            b.classList.add('discover-hide');
        }
    }

    // Verbergt de blokken Over/Links/Media informatie/Genres op de aanvraag- en trailerpagina, ook zonder .itemDetailPage.
    // Per kopje gaat het om de hoogste omhullende groep die klein is en geen knoppen, titel of beschrijving bevat.
    var SECTION_LABELS = /^(over|about|links|externe links|external links|media informatie|media information|genres?|studio'?s|studios)$/i;
    function hideSectionsByLabel() {
        var leaves = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, label, p');
        for (var i = 0; i < leaves.length; i++) {
            var el = leaves[i];
            if (el.children.length !== 0 || !visible(el)) { continue; }
            var label = (el.textContent || '').trim();
            if (!SECTION_LABELS.test(label) || (diagnosticsEnabled && /media\s*(information|informatie)/i.test(label))) { continue; }
            if (el.closest && el.closest('.btnDiscoverRequest, button, .dcRoot')) { continue; }
            var sec = el;
            while (sec.parentElement && sec.parentElement !== document.body) {
                var par = sec.parentElement;
                if (par.querySelector('button, h1, [class*="verview"], .btnPlay, img, video')) { break; }
                if ((par.textContent || '').length > 600) { break; }
                sec = par;
            }
            if (sec === el && el.parentElement && !el.parentElement.querySelector('button, h1, [class*="verview"]')) { sec = el.parentElement; }
            sec.classList.add('discover-hide');
        }
    }

    // Aanvraag- en trailerpagina: overbodige knoppen en het blok "Over" verdwijnen.
    // Alleen op de aanvraagpagina heet Afspelen ook echt Aanvragen.
    function applyAskPage(renamePlay) {
        if (renamePlay) {
            var play = findPlayButton(document.body);
            if (play) {
                var span = play.querySelector('.detailButton-text') || play.querySelector('span');
                if (span && span.textContent !== 'Aanvragen') { span.textContent = 'Aanvragen'; }
                play.setAttribute('title', 'Aanvragen');
                play.setAttribute('aria-label', 'Aanvragen');
            }
        }
        hideOverSection();
        hideMediaInfo();
        hideExtraButtons();
        hideSectionsByLabel();
        hideFilePathLines(true);
        expandOverview();
    }


    // ---------- mappen van het Discover-kanaal: geen afspeelknop, vinkje en puntjes op de tegels ----------
    // Een map afspelen start alle titels erin en doet dus aanvragen. De knoppen op de tegels (en Afspelen/Willekeurig bovenaan
    // een Discover-map) worden daarom verborgen; je opent een map alleen nog door erop te klikken.
    var chPromise = null;
    var cardSeen = {};      // id -> true (Discover-map), false (andere), 'p' (wordt opgezocht)
    var folderPage = {};    // id van de huidige pagina -> true/false

    function discoverChannelId() {
        if (chPromise) { return chPromise; }
        var c = api();
        if (!c) { return Promise.resolve(null); }
        chPromise = Promise.resolve(c.getJSON(c.getUrl('Channels', { UserId: c.getCurrentUserId() }))).then(function (r) {
            var items = (r && r.Items) || [];
            for (var i = 0; i < items.length; i++) { if (items[i].Name === 'Discover') { return items[i].Id; } }
            return null;
        }, function () { chPromise = null; return null; });
        return chPromise;
    }

    function markFolderCards() {
        var c = api();
        if (!c) { return; }
        var cards = document.querySelectorAll('.card[data-type="ChannelFolderItem"], .card[data-isfolder="true"]');
        var ids = [];
        for (var i = 0; i < cards.length; i++) {
            var cid = cards[i].getAttribute('data-id');
            if (!cid) { continue; }
            if (cardSeen[cid] === true) { cards[i].classList.add('discover-folder-card'); }
            else if (cardSeen[cid] === undefined) { cardSeen[cid] = 'p'; ids.push(cid); }
        }
        if (!ids.length) { return; }
        discoverChannelId().then(function (chId) {
            if (!chId) { ids.forEach(function (x) { delete cardSeen[x]; }); return null; }
            return Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items', { Ids: ids.join(','), Fields: 'ChannelInfo' }))).then(function (r) {
                var mine = {};
                ((r && r.Items) || []).forEach(function (it) { if (it.ChannelId === chId) { mine[it.Id] = true; } });
                ids.forEach(function (x) { cardSeen[x] = !!mine[x]; });
                schedule();
            });
        }).then(null, function () { ids.forEach(function (x) { delete cardSeen[x]; }); });
    }

    function syncFolderPage(id) {
        var on = !!(id && folderPage[id] === true);
        if (document.body) { document.body.classList.toggle('discover-folder-page', on); }
        if (!id || folderPage[id] !== undefined || !api()) { return; }
        folderPage[id] = false;
        var c = api();
        discoverChannelId().then(function (chId) {
            if (!chId) { delete folderPage[id]; return null; }
            if (id === chId) { folderPage[id] = true; schedule(); return null; }
            return Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items/' + id, { Fields: 'ChannelInfo' }))).then(function (it) {
                if (it && it.ChannelId === chId && it.IsFolder) { folderPage[id] = true; schedule(); }
            });
        }).then(null, function () { delete folderPage[id]; });
    }

    function checkAdmin() {
        if (adminChecked || !api()) { return; }
        adminChecked = true;
        try {
            api().getCurrentUser().then(function (u) {
                isAdmin = !!(u && u.Policy && u.Policy.IsAdministrator);
                var bs = document.querySelectorAll('.btnDiscoverRequest');
                for (var i = 0; i < bs.length; i++) { if (bs[i]._info) { updateRm(bs[i], bs[i]._info); } }
            }, function () { });
        } catch (e) { }
    }

    function tick() {
        var id = itemIdFromHash();
        if (!diagnosticsLoaded || id !== diagnosticsItemId) {
            diagnosticsItemId = id;
            loadDiagnosticsSetting();
        }

        var old = document.querySelectorAll('.btnDiscoverRequest');
        for (var i = 0; i < old.length; i++) {
            if (old[i].getAttribute('data-itemid') !== id && old[i].parentNode) {
                old[i].parentNode.removeChild(old[i]);
            }
        }
        var rms = document.querySelectorAll('.btnDiscoverRemove');
        for (var m = 0; m < rms.length; m++) {
            if (rms[m].getAttribute('data-itemid') !== id && rms[m].parentNode) { rms[m].parentNode.removeChild(rms[m]); }
        }
        checkAdmin();
        markFolderCards();
        syncFolderPage(id);
        syncBodyClass(id);
        var ask = !!(id && askIds[id]);
        var trl = !!(id && trailerIds[id]);
        if (document.body) {
            document.body.classList.toggle('discover-ask-page', ask || trl);
            document.body.classList.toggle('discover-ask-play', ask);
        }
        if (id !== askLast) {
            // Nieuwe pagina: status opnieuw ophalen (Emby hergebruikt de pagina en de status kan veranderd zijn).
            askLast = id;
            if (id && askIds[id]) { delete lookups[id]; delete askStatus[id]; }
        }
        if (ask || trl) {
            applyAskPage(ask);
            dbg((ask ? 'aanvraagdetailpagina herkend' : 'trailerdetailpagina herkend') +
                '; ' + buttonDiagnostic(id));
        }
        if (ask) { syncAskPlay(id); } else { syncAskPlay(null); }
        if (!id) { dbg(null); }
        if (!id || !api()) { return; }
        var buttonPositioned = positionRequestButton(id);
        if (buttonPositioned && (askIds[id] || trailerIds[id])) {
            dbg((ask ? 'aanvraagdetailpagina' : 'trailerdetailpagina') + ' herkend; ' + buttonDiagnostic(id));
            return;
        }

        resolveItem(id).then(function (info) {
            if (!info || itemIdFromHash() !== id) { return; }
            if (positionRequestButton(id)) {
                dbg((ask ? 'aanvraagdetailpagina' : 'trailerdetailpagina') + ' herkend; ' + buttonDiagnostic(id));
                return;
            }
            var b = findButtonBox();
            if (b) {
                misses = 0;
                addButton(b, id, info);
                dbg((ask ? 'aanvraagdetailpagina' : 'trailerdetailpagina') + ' herkend; ' + buttonDiagnostic(id));
                return;
            }
            dbg('geen knoppenbalk gevonden (poging ' + (misses + 1) + ')');
            // Pagina nog niet opgebouwd: even wachten, daarna zwevende knop als noodgreep.
            misses++;
            if (misses >= 6) { addFloating(id, info); }
        }, function (e) { console.log('[Discover] resolve mislukt', e); });
    }

    function schedule() {
        if (timer) { return; }
        timer = setTimeout(function () { timer = null; try { tick(); } catch (e) { dbg('SCRIPTFOUT: ' + e.message); console.log('[Discover] fout', e); } }, 120);
    }

    function start() {
        try {
            // De YouTube-link (en de regel erbij) meteen bij elke wijziging verbergen, nog voordat de pagina getekend wordt;
            // wachten op schedule() (120 ms + opzoeken van het item) gaf een flits.
            new MutationObserver(function () {
                try { hideFilePathLines(false, true); } catch (e) { }
                schedule();
            }).observe(document.body, { childList: true, subtree: true });
        } catch (e) { }
        window.addEventListener('hashchange', schedule);
        // Na een klik op Afspelen/Aanvragen op de aanvraagpagina de status even later opnieuw ophalen.
        document.addEventListener('click', function (e) {
            var id = itemIdFromHash();
            if (!id || !askIds[id]) { return; }
            var t = e.target && e.target.closest ? e.target.closest('.btnPlay, button') : null;
            if (!t) { return; }
            setTimeout(function () { delete lookups[id]; delete askStatus[id]; schedule(); }, 5000);
        }, true);
        document.addEventListener('viewshow', schedule, true);
        document.addEventListener('click', function () { schedule(); }, true);
        setInterval(schedule, 2000);
        schedule();
    }

    if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start); }
})();
