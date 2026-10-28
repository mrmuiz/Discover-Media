/* Emby Discover: aparte knop "Aanvragen" naast Afspelen.
 * Afspelen = YouTube-trailer. Aanvragen = Radarr/Sonarr (series: seizoenskeuze).
 * Verbergt ook "Media informatie" op Discover/Trailers-detailpagina's. */
(function () {
    'use strict';
    if (window.__discoverRequestButtonVersion === '1.3.5.1') { return; }
    if (window.__discoverRequestButton) {
        console.warn('[Discover] oudere knopcode is nog actief; vernieuw de webclient om dubbele handlers te voorkomen.');
        return;
    }
    window.__discoverRequestButton = true;
    window.__discoverRequestButtonVersion = '1.3.5.1';
    console.log('[Discover] request-button script loaded v1.3.5.1');

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
            el.textContent = 'Discover v1.3.5.1 | ' + msg;
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
            'body.discover-season-ask-page .itemDetailPage [class*="overview" i], body.discover-season-ask-page .itemDetailPage [class*="clamp" i] {',
            '  display: block !important; -webkit-line-clamp: unset !important; line-clamp: unset !important;',
            '  max-height: none !important; height: auto !important; overflow: visible !important; white-space: pre-line !important; }',
            'body.discover-ask-page .discover-ask-hidden { display: none !important; }',
            '.discover-web-ask-hidden { display: none !important; }',
            'body.discover-ask-play .itemDetailPage .btnPlay { background: #22a559 !important; color: #fff !important; border-radius: 2em !important; }',
            '.discover-folder-card [class*="cardOverlayFab"], .discover-folder-card [class*="cardOverlayButton"],',
            '.discover-folder-card .itemSelectionPanel { display: none !important; }',
            '.discover-channel-landscape-card [class*="cardOverlayFab"], .discover-channel-landscape-card [class*="cardOverlayButton"],',
            '.discover-channel-landscape-card .itemSelectionPanel { display: none !important; }',
            '.discover-season-request-card [class*="cardOverlayFab"], .discover-season-request-card [class*="cardOverlayButton"],',
            '.discover-season-request-card .itemSelectionPanel { display: none !important; }',
            '.discover-channel-landscape-card .cardScalable { aspect-ratio: 16 / 9 !important; height: auto !important; padding: 0 !important; }',
            '.discover-season-request-card .cardScalable { aspect-ratio: 2 / 3 !important; height: auto !important; padding: 0 !important; }',
            '.discover-season-info { box-sizing: border-box; margin-top: 12px; overflow: hidden; border: 1px solid #344154; border-radius: 8px; background: #111a2a; color: #e8edf6; font-size: 12px; line-height: 1.3; }',
            '.discover-season-info-rating { display: flex; justify-content: flex-end; padding: 9px 12px; color: #eef3fb; font-weight: 700; }',
            '.discover-season-info-row { display: flex; justify-content: space-between; gap: 10px; padding: 7px 12px; border-top: 1px solid #344154; }',
            '.discover-season-info-label { font-weight: 700; }',
            '.discover-season-info-value { color: #b9c7dc; text-align: right; }',
            '.discover-season-info-providers { padding: 8px 12px; border-top: 1px solid #344154; }',
            '.discover-season-info-provider-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }',
            '.discover-season-info-provider { padding: 3px 7px; border-radius: 4px; background: #26364c; color: #dce7f5; }',
            'body.discover-folder-page .btnPlay, body.discover-folder-page .btnShuffle, body.discover-folder-page .btnQueue { display: none !important; }',
            '.discover-row-section { margin: 1.5em 0 .5em; }',
            '.discover-row-title { margin: 0 0 .7em !important; font-size: 1.35em !important; font-weight: 600 !important; }',
            '.discover-row-scroller { display: flex; gap: 1em; overflow-x: auto; padding: 0 0 1em; scroll-snap-type: x proximity; }',
            '.discover-row-card { flex: 0 0 auto; width: 9.5em; scroll-snap-align: start; }',
            '.discover-row-poster { display: block; border-radius: .6em; overflow: hidden; background: #222; aspect-ratio: 2 / 3; }',
            '.discover-row-poster img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .2s; }',
            '.discover-row-poster:hover img, .discover-row-poster:focus img { transform: scale(1.04); }',
            '.discover-row-name { margin-top: .5em; font-size: .95em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.discover-row-meta { font-size: .8em; opacity: .65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.discover-row-btn { display: block; width: 100%; box-sizing: border-box; margin-top: .5em; padding: .45em .6em; border: none;',
            '  border-radius: 2em; font: inherit; font-size: .9em; font-weight: 600; cursor: pointer; background: #ffb400; color: #111; }',
            '.discover-row-btn:focus { outline: 2px solid #fff; outline-offset: 2px; }',
            '.discover-row-btn:disabled { cursor: default; }',
            '.discover-row-btn.is-requested { background: #555; color: #fff; }',
            '.discover-row-btn.is-available { background: #22a559; color: #fff; }',
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
            if (diagnosticsEnabled) { dbg(lastDiagnostic || 'request-button script actief'); }
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
    var seasonAskIds = {};
    var askStatus = {};      // id -> 0 niet aangevraagd, 1 aangevraagd, 2 beschikbaar (live uit Resolve)
    var seasonCardIds = {};
    var seasonCardCache = {};
    var seasonCardPending = {};
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
                || /discover|trailer|youtube\.com|youtu\.be|ask\d+season:/i.test(ch)
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
            var seasonAskName = /^[\u2713\u23F3]?\s*(?:Aanvragen Seizoen|Request Season|Staffel anfragen|Seizoen|Season|Staffel)\s+\d+/i.test(nm);
            if (seasonAskName) {
                askIds[id] = true;
                seasonAskIds[id] = true;
                askStatus[id] = 0;
                var seasonProviderIds = item.ProviderIds || {};
                var seriesTmdbId = parseInt(seasonProviderIds.Tmdb || seasonProviderIds.tmdb || String(seasonProviderIds.DiscoverSeasonTmdb || '').split('-')[0] || 0, 10) || 0;
                if (seriesTmdbId > 0) {
                    seasonCardIds[id] = seriesTmdbId;
                    loadSeasonCardInfo(id, seriesTmdbId);
                }
                dbg('seizoensaanvraag herkend: ' + nm);
                schedule();
                return null;
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
            // Seizoentrailer: de sleutel is "<serie-id>-s<seizoen>"; de knop Aanvragen vraagt dan alleen dat seizoen aan.
            var seasonTrailer = /^(\d+)-s(\d+)$/.exec(String(pid.DiscoverTrailerTmdb || ''));
            if (seasonTrailer && trailerIds[id]) {
                var stSeries = parseInt(seasonTrailer[1], 10), stSeason = parseInt(seasonTrailer[2], 10);
                return c.ajax({
                    type: 'GET',
                    url: c.getUrl('Discover/Resolve', { Name: name, Year: 0, Overview: '', TmdbId: stSeries, Season: stSeason }),
                    dataType: 'json'
                }).then(function (r) {
                    if (r && r.Found) { r.PresetSeason = stSeason; return r; }
                    return { Found: false };
                });
            }
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
            toast(text('Seizoensgegevens niet beschikbaar; er is niets aangevraagd.',
                'Season data is unavailable; nothing was requested.',
                'Staffeldaten nicht verfügbar; es wurde nichts angefordert.'), true);
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
            cb.checked = false;
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

            if (info.Type === 'tv' && info.PresetSeason > 0) {
                doRequest(btn, info, [info.PresetSeason]);
            } else if (info.Type === 'tv') {
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
    function hideMediaInfo(force) {
        if (diagnosticsEnabled && !force) { return; }
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

    function hideSeasonMetadata() {
        var page = document.querySelector('.itemDetailPage');
        if (!page) { return; }
        var labels = page.querySelectorAll('h1, h2, h3, h4, h5, div, span, label, p');
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];
            var name = (label.textContent || '').replace(/\s+/g, ' ').trim();
            if (/^(over|about)$/i.test(name)) {
                label.style.setProperty('display', 'none', 'important');
                continue;
            }
            if (!/^(links?|externe links|external links|media informatie|media information)$/i.test(name)) { continue; }

            var section = label.closest ? label.closest('.detailVerticalSection, .verticalSection, section') : null;
            if (!section || section === page || section.querySelector('[class*="overview" i]')) {
                section = label.parentElement;
            }
            if (section && section !== page && !section.querySelector('[class*="overview" i]')) {
                section.style.setProperty('display', 'none', 'important');
            } else {
                label.style.setProperty('display', 'none', 'important');
            }
        }
    }

    function seasonInfoLabel(key) {
        var labels = {
            status: text('Status', 'Status', 'Status'),
            firstAirDate: text('Eerste uitzenddatum', 'First Air Date', 'Erstausstrahlung'),
            originalLanguage: text('Oorspronkelijke taal', 'Original Language', 'Originalsprache'),
            productionCountry: text('Productieland', 'Production Country', 'Produktionsland'),
            network: text('Netwerk', 'Network', 'Sender'),
            streamingOn: text('Nu te streamen', 'Currently Streaming On', 'Derzeit im Stream')
        };
        return labels[key];
    }

    function appendSeasonInfoRow(card, label, value) {
        if (!value) { return; }
        var row = document.createElement('div');
        row.className = 'discover-season-info-row';
        var title = document.createElement('span');
        title.className = 'discover-season-info-label';
        title.textContent = label;
        var content = document.createElement('span');
        content.className = 'discover-season-info-value';
        content.textContent = value;
        row.appendChild(title);
        row.appendChild(content);
        card.appendChild(row);
    }

    function renderSeasonCard(id) {
        var tmdbId = seasonCardIds[id];
        var info = seasonCardCache[tmdbId];
        if (!tmdbId || !info || itemIdFromHash() !== id) { return; }
        var page = document.querySelector('.itemDetailPage');
        if (!page || !visible(page)) { return; }
        var poster = page.querySelector('.detailImageContainer');
        if (!poster) {
            var image = page.querySelector('.itemDetailImage img, .cardImageContainer img');
            poster = image && image.closest ? image.closest('.card') || image.parentElement : null;
        }
        if (!poster || !poster.parentElement) { return; }

        var card = page.querySelector('.discover-season-info');
        if (!card) {
            card = document.createElement('div');
            card.className = 'discover-season-info';
        }
        card.setAttribute('data-series-id', String(tmdbId));
        card.textContent = '';
        var width = poster.getBoundingClientRect().width;
        card.style.width = width > 0 ? Math.round(width) + 'px' : 'min(100%, 340px)';

        if (info.TmdbRating > 0) {
            var rating = document.createElement('div');
            rating.className = 'discover-season-info-rating';
            rating.textContent = 'TMDB  ' + info.TmdbRating + '%';
            card.appendChild(rating);
        }
        appendSeasonInfoRow(card, seasonInfoLabel('status'), info.Status);
        appendSeasonInfoRow(card, seasonInfoLabel('firstAirDate'), info.FirstAirDate);
        appendSeasonInfoRow(card, seasonInfoLabel('originalLanguage'), info.OriginalLanguage);
        appendSeasonInfoRow(card, seasonInfoLabel('productionCountry'), info.ProductionCountry);
        appendSeasonInfoRow(card, seasonInfoLabel('network'), info.Network);
        if (info.StreamingOn && info.StreamingOn.length) {
            var providers = document.createElement('div');
            providers.className = 'discover-season-info-providers';
            var title = document.createElement('div');
            title.className = 'discover-season-info-label';
            title.textContent = seasonInfoLabel('streamingOn');
            var list = document.createElement('div');
            list.className = 'discover-season-info-provider-list';
            info.StreamingOn.forEach(function (provider) {
                var chip = document.createElement('span');
                chip.className = 'discover-season-info-provider';
                chip.textContent = provider;
                list.appendChild(chip);
            });
            providers.appendChild(title);
            providers.appendChild(list);
            card.appendChild(providers);
        }
        if (poster.nextSibling !== card) { poster.parentElement.insertBefore(card, poster.nextSibling); }
    }

    function loadSeasonCardInfo(itemId, tmdbId) {
        if (seasonCardCache[tmdbId]) { renderSeasonCard(itemId); return; }
        if (seasonCardPending[tmdbId]) { return; }
        var c = api();
        if (!c) { return; }
        seasonCardPending[tmdbId] = true;
        c.ajax({
            type: 'GET',
            url: c.getUrl('Discover/SeriesCard', { TmdbId: tmdbId }),
            dataType: 'json'
        }).then(function (info) {
            seasonCardCache[tmdbId] = info || {};
            delete seasonCardPending[tmdbId];
            renderSeasonCard(itemId);
        }, function (error) {
            delete seasonCardPending[tmdbId];
            console.warn('[Discover] seriegegevens laden mislukt voor TMDB ' + tmdbId, error);
        });
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

    // Seizoensbeschrijvingen worden uitgeklapt en de link "Meer" wordt verborgen, zonder de detailpopup te openen.
    function expandOverview() {
        var page = document.querySelector('.itemDetailPage');
        if (page && document.body.classList.contains('discover-season-ask-page')) {
            var blocks = page.querySelectorAll('[class]');
            for (var i = 0; i < blocks.length; i++) {
                var className = typeof blocks[i].className === 'string' ? blocks[i].className.toLowerCase() : '';
                if (className.indexOf('overview') < 0 && className.indexOf('clamp') < 0) { continue; }
                blocks[i].style.setProperty('display', 'block', 'important');
                blocks[i].style.setProperty('-webkit-line-clamp', 'unset', 'important');
                blocks[i].style.setProperty('line-clamp', 'unset', 'important');
                blocks[i].style.setProperty('max-height', 'none', 'important');
                blocks[i].style.setProperty('height', 'auto', 'important');
                blocks[i].style.setProperty('overflow', 'visible', 'important');
                blocks[i].style.setProperty('white-space', 'pre-line', 'important');
            }
        }
        var controls = document.querySelectorAll('button, a, [role="button"]');
        for (var j = 0; j < controls.length; j++) {
            var control = controls[j];
            if (!visible(control) || (control.closest && control.closest('.dcRoot, .btnDiscoverRequest'))) { continue; }
            var label = [control.textContent, control.getAttribute('aria-label'), control.getAttribute('title')]
                .join(' ').replace(/\s+/g, ' ').trim();
            if (/^(meer|more|minder|less)$/i.test(label)) { control.classList.add('discover-hide'); }
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

    function hideFilePathLines(withMeta, onlyPages, force) {
        if (diagnosticsEnabled && !force) { return; }
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

    // Op aanvraag- en trailerdetails wordt Afspelen duidelijk benoemd; overige knoppen en secties verdwijnen.
    function applyAskPage(renamePlay, preserveOverview) {
        if (renamePlay) {
            var play = findPlayButton(document.body);
            if (play) {
                var span = play.querySelector('.detailButton-text') || play.querySelector('span');
                var label = renamePlay === 'ask'
                    ? text('Aanvragen', 'Request', 'Anfragen')
                    : text('Trailer', 'Trailer', 'Trailer');
                if (span && span.textContent !== label) { span.textContent = label; }
                play.setAttribute('title', label);
                play.setAttribute('aria-label', label);
            }
        }
        if (preserveOverview) { hideSeasonMetadata(); }
        else { hideOverSection(); }
        hideMediaInfo(preserveOverview);
        hideExtraButtons();
        if (!preserveOverview) { hideSectionsByLabel(); }
        hideFilePathLines(true, false, preserveOverview);
        expandOverview();
    }


    // ---------- mappen van het Discover-kanaal: geen afspeelknop, vinkje en puntjes op de tegels ----------
    // Een map afspelen start alle titels erin en doet dus aanvragen. De knoppen op de tegels (en Afspelen/Willekeurig bovenaan
    // een Discover-map) worden daarom verborgen; je opent een map alleen nog door erop te klikken.
    var chPromise = null;
    var cardSeen = {};      // id -> true (Discover-map), false (andere), 'p' (wordt opgezocht)
    var requestTileInfo = {}; // id -> request/trailer metadata, null when not a Discover channel item
    var requestTilePending = {};
    var requestTileRetry = {};
    var seasonLibraryStates = {};
    var seasonLibraryCacheAt = {};
    var seasonLibraryPending = {};
    var seasonLibraryRetry = {};
    var folderPage = {};    // id van de huidige pagina -> true/false

    function discoverChannelId() {
        if (chPromise) { return chPromise; }
        var c = api();
        if (!c) { return Promise.resolve(null); }
        chPromise = Promise.resolve(c.getJSON(c.getUrl('Channels', { UserId: c.getCurrentUserId() }))).then(function (r) {
            var items = (r && r.Items) || [];
            for (var i = 0; i < items.length; i++) {
                if (/^Discover(?: Media)?$/i.test(items[i].Name || '')) { return items[i].Id; }
            }
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

    function requestTileName(name) {
        var value = String(name || '').replace(/^[\u2713\u23F3]\s*/, '');
        var season = /^(?:Aanvragen Seizoen|Request Season|Staffel anfragen|Seizoen|Season|Staffel)\s+(\d+)/i.exec(value);
        if (season) { return { kind: 'season', title: value, number: parseInt(season[1], 10) }; }
        var trailer = /^Trailer:\s*(.+)$/i.exec(value);
        if (trailer) {
            var seasonTrailer = /^(?:Seizoen|Season|Staffel)\s+(\d+)\s*$/i.exec(trailer[1].trim());
            if (seasonTrailer) { return { kind: 'seasontrailer', title: trailer[1].trim(), number: parseInt(seasonTrailer[1], 10) }; }
            return { kind: 'trailer', title: trailer[1].trim() };
        }
        var ask = /^(?:Aanvragen|Anfragen|Request):\s*(.+)$/i.exec(value);
        return ask ? { kind: 'ask', title: ask[1].trim() } : null;
    }

    function restoreRequestTileLabel(card) {
        var node = card.__discoverTileLabelNode;
        if (node && card.contains(node) && card.__discoverOriginalTileLabel !== undefined) {
            node.nodeValue = card.__discoverOriginalTileLabel;
        }
        card.__discoverTileLabelNode = null;
        card.__discoverOriginalTileLabel = undefined;
    }

    function restoreSeasonTileLabel(card) {
        var node = card.__discoverSeasonLabelNode;
        if (node && card.contains(node) && card.__discoverOriginalSeasonLabel !== undefined) {
            node.nodeValue = card.__discoverOriginalSeasonLabel;
        }
        card.__discoverSeasonLabelNode = null;
        card.__discoverOriginalSeasonLabel = undefined;
    }

    function setSeasonTileStatus(card, info, seasonNumber) {
        var node = card.__discoverSeasonLabelNode;
        if (!node || !card.contains(node)) {
            card.__discoverSeasonLabelNode = null;
            card.__discoverOriginalSeasonLabel = undefined;
            var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
            while ((node = walker.nextNode())) {
                if (/^\s*(?:[\u2713\u23F3]\s*)?(?:Aanvragen Seizoen|Request Season|Staffel anfragen|Seizoen|Season|Staffel)\s+\d+/i.test(node.nodeValue || '')) { break; }
            }
            if (!node) { return; }
            card.__discoverSeasonLabelNode = node;
            card.__discoverOriginalSeasonLabel = node.nodeValue;
        }
        var states = seasonLibraryStates[info.tmdbId];
        var availableInEmby = !!(states && states[seasonNumber]);
        var requestedInSonarr = /^\s*\u23F3|\u23F3\s*$/.test(info.name || '');
        var prefix = availableInEmby ? '\u2713 ' : requestedInSonarr ? '\u23F3 ' : '';
        var leadingWhitespace = /^\s*/.exec(card.__discoverOriginalSeasonLabel)[0];
        node.nodeValue = leadingWhitespace + prefix + text('Seizoen ', 'Season ', 'Staffel ') + seasonNumber;
    }

    function syncSeasonLibraryStatus(tmdbId) {
        var c = api();
        if (!c || !tmdbId ||
            (seasonLibraryStates[tmdbId] && Date.now() - (seasonLibraryCacheAt[tmdbId] || 0) < 60000) ||
            seasonLibraryPending[tmdbId] ||
            Date.now() < (seasonLibraryRetry[tmdbId] || 0)) { return; }
        seasonLibraryPending[tmdbId] = true;
        var uid = c.getCurrentUserId();
        c.getJSON(c.getUrl('Users/' + uid + '/Items', {
            AnyProviderIdEquals: 'Tmdb.' + tmdbId,
            IncludeItemTypes: 'Series',
            Recursive: true,
            Fields: 'ProviderIds',
            Limit: 20
        })).then(function (r) {
            var seriesItems = ((r && r.Items) || []).filter(function (item) {
                var ids = item.ProviderIds || {};
                return String(ids.Tmdb || ids.tmdb || '') === String(tmdbId);
            });
            if (!seriesItems.length) {
                seasonLibraryStates[tmdbId] = {};
                return null;
            }
            return Promise.all(seriesItems.map(function (series) {
                return c.getJSON(c.getUrl('Users/' + uid + '/Items', {
                    ParentId: series.Id,
                    IncludeItemTypes: 'Episode',
                    Recursive: true,
                    Fields: 'ParentIndexNumber',
                    Limit: 5000
                }));
            })).then(function (episodeLists) {
                var states = {};
                episodeLists.forEach(function (episodes) {
                    ((episodes && episodes.Items) || []).forEach(function (item) {
                        var number = parseInt(item.ParentIndexNumber, 10);
                        if (number > 0) { states[number] = true; }
                    });
                });
                seasonLibraryStates[tmdbId] = states;
            });
        }).then(function () {
            delete seasonLibraryPending[tmdbId];
            delete seasonLibraryRetry[tmdbId];
            seasonLibraryCacheAt[tmdbId] = Date.now();
            applyRequestTilePresentation();
        }, function (error) {
            delete seasonLibraryPending[tmdbId];
            seasonLibraryRetry[tmdbId] = Date.now() + 30000;
            console.warn('[Discover] Emby-seizoensstatus ophalen mislukt voor TMDB ' + tmdbId, error);
        });
    }

    function setRequestTileLabel(card) {
        var node = card.__discoverTileLabelNode;
        if (!node || !card.contains(node)) {
            card.__discoverTileLabelNode = null;
            card.__discoverOriginalTileLabel = undefined;
            var walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
            while ((node = walker.nextNode())) {
                if (/^\s*Trailer:/i.test(node.nodeValue || '')) { break; }
            }
            if (!node) { return; }
            card.__discoverTileLabelNode = node;
            card.__discoverOriginalTileLabel = node.nodeValue;
        }
        var prefix = text('Aanvragen: ', 'Request: ', 'Anfragen: ');
        node.nodeValue = card.__discoverOriginalTileLabel.replace(/^(\s*)Trailer:\s*/i, '$1' + prefix);
    }

    function applyRequestTilePresentation() {
        var cards = document.querySelectorAll('.card[data-id]');
        var candidates = [];
        var groups = Object.create(null);
        var seasonCardsByParent = [];
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var id = card.getAttribute('data-id');
            var info = requestTileInfo[id];
            card.classList.remove('discover-web-ask-hidden');
            card.classList.remove('discover-channel-landscape-card');
            card.classList.remove('discover-season-request-card');
            if (!info || !info.name || !info.parentId) {
                restoreRequestTileLabel(card);
                restoreSeasonTileLabel(card);
                continue;
            }
            var parsed = requestTileName(info.name);
            if (!parsed) {
                restoreRequestTileLabel(card);
                restoreSeasonTileLabel(card);
                continue;
            }
            if (parsed.kind === 'season') {
                card.classList.add('discover-season-request-card');
                restoreRequestTileLabel(card);
                setSeasonTileStatus(card, info, parsed.number);
                syncSeasonLibraryStatus(info.tmdbId);
                if (card.parentNode) {
                    var parentEntry = null;
                    for (var parentIndex = 0; parentIndex < seasonCardsByParent.length; parentIndex++) {
                        if (seasonCardsByParent[parentIndex].parent === card.parentNode) {
                            parentEntry = seasonCardsByParent[parentIndex];
                            break;
                        }
                    }
                    if (!parentEntry) {
                        parentEntry = { parent: card.parentNode, cards: [] };
                        seasonCardsByParent.push(parentEntry);
                    }
                    parentEntry.cards.push({ card: card, number: parsed.number, order: i });
                }
                continue;
            }
            if (parsed.kind === 'seasontrailer') {
                card.classList.add('discover-season-request-card');
                restoreRequestTileLabel(card);
                restoreSeasonTileLabel(card);
                if (card.parentNode) {
                    var stEntry = null;
                    for (var stIndex = 0; stIndex < seasonCardsByParent.length; stIndex++) {
                        if (seasonCardsByParent[stIndex].parent === card.parentNode) { stEntry = seasonCardsByParent[stIndex]; break; }
                    }
                    if (!stEntry) { seasonCardsByParent.push({ parent: card.parentNode, cards: [] }); }
                }
                continue;
            }
            restoreSeasonTileLabel(card);
            var key = info.parentId + '\n' + parsed.title.toLocaleLowerCase();
            var entry = groups[key] || (groups[key] = { ask: [], trailer: [] });
            entry[parsed.kind].push({ card: card });
            candidates.push({ card: card, kind: parsed.kind, key: key });
        }
        for (var j = 0; j < candidates.length; j++) {
            var candidate = candidates[j];
            var pair = groups[candidate.key];
            if (pair.ask.length !== 1 || pair.trailer.length !== 1) {
                restoreRequestTileLabel(candidate.card);
                continue;
            }
            candidate.card.classList.add('discover-channel-landscape-card');
            if (candidate.kind === 'ask') {
                candidate.card.classList.add('discover-web-ask-hidden');
            } else {
                setRequestTileLabel(candidate.card);
            }
        }
        seasonCardsByParent.forEach(function (entry) {
            var siblingCards = [];
            for (var k = 0; k < cards.length; k++) {
                if (cards[k].parentNode !== entry.parent) { continue; }
                var siblingId = cards[k].getAttribute('data-id');
                var siblingInfo = requestTileInfo[siblingId];
                var siblingSeason = siblingInfo && requestTileName(siblingInfo.name);
                if (!siblingSeason || (siblingSeason.kind !== 'season' && siblingSeason.kind !== 'seasontrailer')) { return; }
                siblingCards.push({ card: cards[k], number: siblingSeason.number * 2 + (siblingSeason.kind === 'season' ? 1 : 0) });
            }
            if (siblingCards.length < 2) { return; }
            siblingCards.sort(function (a, b) { return a.number - b.number; });
            siblingCards.forEach(function (item) { entry.parent.appendChild(item.card); });
        });
    }

    function syncRequestTileCards() {
        var c = api();
        if (!c) { return; }
        var cards = document.querySelectorAll('.card[data-id]');
        var ids = [];
        for (var i = 0; i < cards.length; i++) {
            var id = cards[i].getAttribute('data-id');
            if (!id || !/(?:Trailer|Aanvragen|Anfragen|Request):\s*\S+|(?:Aanvragen Seizoen|Request Season|Staffel anfragen|Seizoen|Season|Staffel)\s+\d+/i.test(cards[i].textContent || '')) { continue; }
            if (requestTileInfo[id] === undefined && !requestTilePending[id] &&
                Date.now() >= (requestTileRetry[id] || 0)) {
                requestTilePending[id] = true;
                ids.push(id);
            }
        }
        applyRequestTilePresentation();
        if (!ids.length) { return; }
        discoverChannelId().then(function (chId) {
            if (!chId) {
                ids.forEach(function (id) {
                    delete requestTilePending[id];
                    requestTileRetry[id] = Date.now() + 5000;
                });
                return null;
            }
            return Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items', {
                Ids: ids.join(','), Fields: 'ChannelInfo,ParentId,ProviderIds'
            }))).then(function (r) {
                var found = {};
                ((r && r.Items) || []).forEach(function (item) {
                    if (item.ChannelId === chId) {
                        var providerIds = item.ProviderIds || {};
                        found[item.Id] = {
                            name: item.Name || '',
                            parentId: item.ParentId || '',
                            tmdbId: parseInt(providerIds.Tmdb || providerIds.tmdb || String(providerIds.DiscoverSeasonTmdb || '').split('-')[0] || 0, 10) || 0
                        };
                    }
                });
                ids.forEach(function (id) {
                    requestTileInfo[id] = found[id] || null;
                    delete requestTilePending[id];
                    delete requestTileRetry[id];
                });
                applyRequestTilePresentation();
            });
        }).then(null, function () {
            ids.forEach(function (id) {
                delete requestTilePending[id];
                requestTileRetry[id] = Date.now() + 5000;
            });
        });
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

    // ---- Extra rijen op gewone Emby-pagina's (webclient) ----
    // Film/serie: "Meer zoals dit" (TMDB-aanbevelingen) en voor films de collectie (filmreeks).
    // Acteur/regisseur: "Niet in je bibliotheek" (filmografie uit TMDB).
    // Alles wat al in de Emby-bibliotheek staat wordt weggelaten; elke kaart heeft een Aanvragen-knop.
    var rowItemChecks = {};  // itemId -> Promise<item|null>
    var rowData = {};        // itemId -> [{ key, title, items }]
    var rowLoading = {};
    var libIndexPromise = null;
    var libIndexAt = 0;
    var LIB_INDEX_TTL = 5 * 60 * 1000;

    function titleKey(name, year) {
        return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '|' + (year || 0);
    }

    // Eén keer (per 5 minuten) alle films en series uit de bibliotheek ophalen, alleen de id's.
    function loadLibraryIndex() {
        var now = Date.now();
        if (libIndexPromise && now - libIndexAt < LIB_INDEX_TTL) { return libIndexPromise; }
        var c = api();
        libIndexAt = now;
        libIndexPromise = Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items', {
            Recursive: true, IncludeItemTypes: 'Movie,Series', Fields: 'ProviderIds,ProductionYear',
            EnableImages: false, EnableUserData: false
        }))).then(function (r) {
            var idx = {};
            ((r && r.Items) || []).forEach(function (it) {
                var type = it.Type === 'Series' ? 'tv' : 'movie';
                var p = it.ProviderIds || {};
                var t = p.Tmdb || p.tmdb;
                if (t) { idx[type + ':' + t] = true; }
                idx[type + ':t:' + titleKey(it.Name, it.ProductionYear)] = true;
            });
            return idx;
        }, function (e) {
            libIndexPromise = null;
            throw e;
        });
        return libIndexPromise;
    }

    function inLibrary(idx, x) {
        return !!(idx[x.Type + ':' + x.TmdbId] || idx[x.Type + ':t:' + titleKey(x.Title, x.Year)]);
    }

    function rowStatusText(st) {
        return st === 2 ? text('Beschikbaar', 'Available', 'Verfügbar') :
            st === 1 ? text('Aangevraagd', 'Requested', 'Angefordert') :
            text('Aanvragen', 'Request', 'Anfragen');
    }

    function rowRoleText(role) {
        if (!role) { return ''; }
        return role === 'Director' ? text('Regie', 'Director', 'Regie') : role;
    }

    function styleRowButton(btn, item) {
        btn.disabled = item.Status !== 0;
        btn.textContent = rowStatusText(item.Status);
        btn.className = 'discover-row-btn' + (item.Status === 2 ? ' is-available' : item.Status === 1 ? ' is-requested' : '');
    }

    // Dezelfde titel kan in meer rijen staan: alle knoppen bijwerken.
    function refreshRowButtons(item) {
        var bs = document.querySelectorAll('.discover-row-btn[data-key="' + item.Type + ':' + item.TmdbId + '"]');
        for (var i = 0; i < bs.length; i++) {
            if (bs[i]._item && bs[i]._item !== item) { bs[i]._item.Status = item.Status; }
            styleRowButton(bs[i], bs[i]._item || item);
        }
    }

    function requestRowItem(item, btn) {
        var c = api();
        function send(seasons) {
            btn.disabled = true;
            btn.textContent = text('Aanvragen...', 'Requesting...', 'Wird angefragt...');
            var body = { Type: item.Type, TmdbId: item.TmdbId };
            if (seasons && seasons.length) { body.Seasons = seasons; }
            c.ajax({
                type: 'POST', url: c.getUrl('Discover/RequestItem'),
                data: JSON.stringify(body), contentType: 'application/json', dataType: 'json'
            }).then(function (r) {
                if (r && r.Success) {
                    item.Status = 1;
                    toast(item.Title + ': ' + r.Message, false);
                } else {
                    toast(text('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                        ((r && r.Message) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')), true);
                }
                refreshRowButtons(item);
            }, function () {
                toast(text('Aanvraag mislukt.', 'Request failed.', 'Anfrage fehlgeschlagen.'), true);
                refreshRowButtons(item);
            });
        }
        if (item.Type !== 'tv') { send(null); return; }
        // Series: eerst de seizoenen ophalen, dan de bestaande seizoenskeuze tonen.
        btn.disabled = true;
        c.ajax({ type: 'GET', url: c.getUrl('Discover/Seasons', { TmdbId: item.TmdbId }), dataType: 'json' }).then(function (info) {
            styleRowButton(btn, item);
            showSeasonPicker({ Seasons: (info && info.Seasons) || [] }, send);
        }, function () {
            styleRowButton(btn, item);
            toast(text('Seizoenen ophalen mislukt.', 'Could not load seasons.', 'Staffeln konnten nicht geladen werden.'), true);
        });
    }

    function removeRowSections(keepId) {
        var secs = document.querySelectorAll('.discover-row-section');
        for (var i = 0; i < secs.length; i++) {
            if (secs[i].getAttribute('data-itemid') !== keepId && secs[i].parentNode) { secs[i].parentNode.removeChild(secs[i]); }
        }
    }

    // Webclient-indeling verschilt per Emby-versie (4.11 beta: .itemView + .details-additionalContent;
    // 4.10: .itemDetailPage + .detailPageContent). We proberen ze op volgorde.
    function rowParent() {
        var host = null;
        var pages = document.querySelectorAll('.itemView, .itemDetailPage, .view-item-item, [data-type="item"]');
        for (var i = 0; i < pages.length; i++) { if (visible(pages[i])) { host = pages[i]; break; } }
        if (!host) { return null; }
        var parent = host.querySelector('.details-additionalContent') || host.querySelector('.itemMainScrollSlider') ||
            host.querySelector('.detailPageContent');
        if (!parent) {
            var secs = host.querySelectorAll('.verticalSection, .detailSection, .itemsContainer');
            if (secs.length) { parent = secs[secs.length - 1].parentNode; }
        }
        return parent || host;
    }

    function buildRowCard(item) {
        var card = document.createElement('div');
        card.className = 'discover-row-card';
        var link = document.createElement('a');
        link.className = 'discover-row-poster';
        // Klik op de poster: de Discover-popup met info en trailer.
        link.href = '#!/configurationpage?name=discoverui1075&openType=' + item.Type + '&openId=' + item.TmdbId;
        link.title = item.Title;
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.src = item.Poster || '';
        img.alt = '';
        link.appendChild(img);
        var name = document.createElement('div');
        name.className = 'discover-row-name';
        name.textContent = item.Title;
        name.title = item.Title;
        var meta = document.createElement('div');
        meta.className = 'discover-row-meta';
        var kind = item.Type === 'tv' ? text('Serie', 'Series', 'Serie') : text('Film', 'Movie', 'Film');
        var role = rowRoleText(item.Role);
        meta.textContent = kind + (item.Year ? ' · ' + item.Year : '') + (role ? ' · ' + role : '');
        meta.title = meta.textContent;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn._item = item;
        btn.setAttribute('data-key', item.Type + ':' + item.TmdbId);
        styleRowButton(btn, item);
        btn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (item.Status === 0) { requestRowItem(item, btn); }
        });
        card.appendChild(link); card.appendChild(name); card.appendChild(meta); card.appendChild(btn);
        return card;
    }

    function renderRowSections(id, sections) {
        var parent = rowParent();
        if (!parent) { return false; }
        if (parent.querySelector('.discover-row-section[data-itemid="' + id + '"]')) { return true; }
        removeRowSections(null);
        sections.forEach(function (s) {
            var sec = document.createElement('div');
            sec.className = 'discover-row-section verticalSection';
            sec.setAttribute('data-itemid', id);
            sec.setAttribute('data-row', s.key);
            var h = document.createElement('h2');
            h.className = 'discover-row-title sectionTitle';
            h.textContent = s.title;
            sec.appendChild(h);
            var row = document.createElement('div');
            row.className = 'discover-row-scroller';
            s.items.forEach(function (item) { row.appendChild(buildRowCard(item)); });
            sec.appendChild(row);
            parent.appendChild(sec);
        });
        return true;
    }

    function loadRowsFor(id, item) {
        var c = api();
        var p = item.ProviderIds || {};
        var tmdb = parseInt(p.Tmdb || p.tmdb || '0', 10) || 0;
        var req;
        if (item.Type === 'Person') {
            req = Promise.resolve(c.ajax({
                type: 'GET', dataType: 'json',
                url: c.getUrl('Discover/PersonCredits', { Name: item.Name, TmdbPersonId: tmdb })
            })).then(function (r) {
                return [{ key: 'person', title: text('Niet in je bibliotheek', 'Not in your library', 'Nicht in deiner Bibliothek'),
                    items: (r && r.Items) || [] }];
            });
        } else {
            var type = item.Type === 'Series' ? 'tv' : 'movie';
            req = Promise.resolve(c.ajax({
                type: 'GET', dataType: 'json',
                url: c.getUrl('Discover/Related', {
                    Type: type, TmdbId: tmdb, TvdbId: p.Tvdb || p.tvdb || '', ImdbId: p.Imdb || p.imdb || ''
                })
            })).then(function (r) {
                var out = [];
                var self = (r && r.TmdbId) || tmdb;
                if (r && r.Collection) { r.Collection = r.Collection.filter(function (x) { return x.TmdbId !== self; }); }
                if (r && r.Collection && r.Collection.length) {
                    out.push({ key: 'collection', title: r.CollectionName || text('Collectie', 'Collection', 'Sammlung'), items: r.Collection });
                }
                out.push({ key: 'related', title: text('Meer zoals dit', 'More like this', 'Mehr wie dies'),
                    items: (r && r.Recommendations) || [] });
                return out;
            });
        }
        return Promise.all([req, loadLibraryIndex()]).then(function (res) {
            var idx = res[1];
            var sections = res[0].map(function (s) {
                return { key: s.key, title: s.title, items: s.items.filter(function (x) { return !inLibrary(idx, x); }) };
            }).filter(function (s) { return s.items.length > 0; });
            rowData[id] = sections;
        });
    }

    function syncExtraRows(id) {
        // Niet op Discover-kanaalitems: die hebben hun eigen aanvraag- en trailerpagina.
        if (!id || !api() || askIds[id] || seasonAskIds[id] || trailerIds[id]) { removeRowSections(null); return; }
        removeRowSections(id);
        if (rowData[id]) {
            if (rowData[id].length) { renderRowSections(id, rowData[id]); }
            return;
        }
        if (rowLoading[id]) { return; }
        var c = api();
        if (!rowItemChecks[id]) {
            rowItemChecks[id] = Promise.resolve(c.getItem(c.getCurrentUserId(), id)).then(function (it) {
                if (!it || it.ChannelId) { return null; }
                return it.Type === 'Person' || it.Type === 'Movie' || it.Type === 'Series' ? it : null;
            }, function () { return null; });
        }
        rowLoading[id] = true;
        rowItemChecks[id].then(function (item) {
            if (!item) { rowData[id] = []; return null; }
            return loadRowsFor(id, item);
        }).then(function () {
            rowLoading[id] = false;
            schedule();
        }, function (e) {
            rowLoading[id] = false;
            rowData[id] = [];
            console.log('[Discover] extra rijen mislukt', e);
        });
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
        syncRequestTileCards();
        syncFolderPage(id);
        syncExtraRows(id);
        syncBodyClass(id);
        var ask = !!(id && askIds[id]);
        var seasonAsk = !!(id && seasonAskIds[id]);
        var trl = !!(id && trailerIds[id]);
        if (document.body) {
            document.body.classList.toggle('discover-ask-page', ask || trl);
            document.body.classList.toggle('discover-ask-play', ask);
            document.body.classList.toggle('discover-season-ask-page', seasonAsk);
        }
        if (seasonAsk) { renderSeasonCard(id); }
        else {
            var oldSeasonCards = document.querySelectorAll('.discover-season-info');
            for (var sc = 0; sc < oldSeasonCards.length; sc++) {
                if (oldSeasonCards[sc].parentNode) { oldSeasonCards[sc].parentNode.removeChild(oldSeasonCards[sc]); }
            }
        }
        if (id !== askLast) {
            // Nieuwe pagina: status opnieuw ophalen (Emby hergebruikt de pagina en de status kan veranderd zijn).
            askLast = id;
            if (id && askIds[id]) { delete lookups[id]; delete askStatus[id]; }
        }
        if (ask || trl) {
            applyAskPage(ask ? 'ask' : 'trailer', seasonAsk);
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
