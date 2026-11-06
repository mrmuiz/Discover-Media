/* Emby Discover: aparte knop "Aanvragen" naast Afspelen.
 * Afspelen = YouTube-trailer. Aanvragen = Radarr/Sonarr (series: seizoenskeuze).
 * Verbergt ook "Media informatie" op Discover/Trailers-detailpagina's. */
(function () {
    'use strict';
    if (window.__discoverRequestButtonVersion === '1.4.0.3') { return; }
    if (window.__discoverRequestButton) {
        console.warn('[Discover] oudere knopcode is nog actief; vernieuw de webclient om dubbele handlers te voorkomen.');
        return;
    }
    var DC_BUILD = '1.4.0.3 2026-11-06';
    window.__discoverRequestButton = true;
    window.__discoverRequestButtonVersion = '1.4.0.3';

    // Themakleur (instelling "Weergave"): CSS-variabelen op <html>, gebruikt door de Discover-pagina en de rijen en
    // knoppen op Emby's pagina's. Laatste waarde onthouden, zodat de kleur bij het openen niet eerst geel flitst.
    if (!window.__dcApplyAccent) {
        window.__dcApplyAccent = function (hex) {
            if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) { return; }
            var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
            var st = document.documentElement.style;
            st.setProperty('--dc-accent', hex);
            st.setProperty('--dc-accent-rgb', r + ',' + g + ',' + b);
            // tekst op de accentkleur: donker op lichte kleuren, wit op donkere
            st.setProperty('--dc-accent-text', (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff');
            try { localStorage.setItem('dcAccent', hex); } catch (e) { }
        };
        try { var savedAccent = localStorage.getItem('dcAccent'); if (savedAccent) { window.__dcApplyAccent(savedAccent); } } catch (e) { }
    }

    // Aanwijzer in gebruik? Klasse dcPointer op <html> zolang de muis / Magic Remote-aanwijzer beweegt; weg zodra de
    // pijltoetsen gebruikt worden (dan verdwijnt de aanwijzer op een LG-tv ook). Toont de scrollpijlen bij de rijen.
    if (!window.__dcPointerInit) {
        window.__dcPointerInit = true;
        (function () {
            var root = document.documentElement, lx = null, ly = null;
            document.addEventListener('mousemove', function (e) {
                if (lx !== null && Math.abs(e.screenX - lx) + Math.abs(e.screenY - ly) < 2) { return; }
                lx = e.screenX; ly = e.screenY;
                if (!root.classList.contains('dcPointer')) { root.classList.add('dcPointer'); }
            }, true);
            document.addEventListener('keydown', function (e) {
                var k = e.keyCode;
                if (k >= 37 && k <= 40) { root.classList.remove('dcPointer'); }
            }, true);
            // webOS meldt zelf of de aanwijzer zichtbaar is.
            document.addEventListener('cursorStateChange', function (e) {
                var vis = e && e.detail && e.detail.visibility;
                root.classList.toggle('dcPointer', !!vis);
            }, false);
        })();
    }
    window.__discoverRequestButtonBuild = DC_BUILD;
    console.log('[Discover] request-button script loaded v1.4.0.3 build ' + DC_BUILD);

    var uiLanguage = 'nl';
    function text(dutch, english, german, norwegian) {
        return uiLanguage === 'de' ? (german || english) : uiLanguage === 'no' ? (norwegian || english) : uiLanguage === 'en' ? english : dutch;
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
            el.textContent = 'Discover v1.4.0.3 | ' + msg;
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
            '.discover-season-request-card [class*="playedIndicator"], .discover-no-played [class*="playedIndicator"] { display: none !important; }',
            '.discover-channel-landscape-card .cardScalable { aspect-ratio: 16 / 9 !important; height: auto !important; padding: 0 !important; }',
            '.discover-season-request-card .cardScalable { aspect-ratio: 2 / 3 !important; height: auto !important; padding: 0 !important; }',
            '.discover-season-info { box-sizing: border-box; margin-top: 14px; max-width: 640px; overflow: hidden; border: 1px solid rgba(255,255,255,.14); border-radius: 10px; background: rgba(10,16,28,.72); color: #e8edf6; font-size: 13px; line-height: 1.35; }',
            '.discover-season-info-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px; font-weight: 700; font-size: 14px; }',
            '.discover-season-info-rating { color: var(--dc-accent,#ffb400); white-space: nowrap; }',
            '.discover-season-info-overview { padding: 0 14px 10px; color: #cfd8e6; white-space: pre-line; }',
            '.discover-season-info-row { display: flex; justify-content: space-between; gap: 10px; padding: 7px 14px; border-top: 1px solid rgba(255,255,255,.1); }',
            '.discover-season-info-label { font-weight: 700; }',
            '.discover-season-info-value { color: #b9c7dc; text-align: right; }',
            '.discover-season-info-providers { padding: 8px 14px 10px; border-top: 1px solid rgba(255,255,255,.1); }',
            '.discover-season-info-provider-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }',
            '.discover-season-info-provider { padding: 3px 7px; border-radius: 4px; background: #26364c; color: #dce7f5; }',
            'body.discover-folder-page .btnPlay, body.discover-folder-page .btnShuffle, body.discover-folder-page .btnQueue { display: none !important; }',
            /* De rijen nemen Emby's eigen maten over (zelfde postergrootte en uitlijning als "More Like This"):
               de sectie en titel krijgen Emby's klassen, de maten komen uit --dc-w/--dc-h (gemeten op de pagina). */
            '.discover-row-section { position: relative; }',
            /* Titelmap met alleen Request en Trailer: de twee tegels iets verder uit elkaar (niet bij lange seizoenslijsten). */
            'body.discover-folder-page .itemsContainer.virtualItemsContainer:not(:has(> .card:nth-child(4))) > .card .cardBox { margin-left: 1.4em !important; margin-right: 1.4em !important; }',
            /* Emby's afspeelknop midden op de poster: op Discover-pagina's betekent afspelen aanvragen of trailer; daar weg. */
            'body.discover-ask-page .detailImageContainer [class*="verlay"], body.discover-ask-page .detailImageContainer .cardOverlayContainer, body.discover-ask-page .itemDetailImage ~ [class*="verlay"] { display: none !important; }',
            'body.discover-folder-page .card [class*="cardOverlayButton"], body.discover-folder-page .card [class*="cardOverlayFab"], body.discover-folder-page .card .cardOverlayContainer { display: none !important; }',
            /* Cast onder kanaalpagina's ("Request: titel", titelmap, trailer): ronde foto's zoals in de Discover-popup. */
            '.discover-cast-section { margin-top: 1.5em; }',
            '.discover-cast-row { display: flex; gap: 14px; overflow-x: auto; padding-top: 6px; padding-bottom: 12px; scrollbar-width: none; }',
            '.discover-cast-row::-webkit-scrollbar { display: none; }',
            '.discover-cast-p { flex: 0 0 auto; width: 96px; display: flex; flex-direction: column; align-items: center; text-align: center; background: none; border: 0; color: inherit; cursor: pointer; padding: 4px; border-radius: 8px; font: inherit; }',
            '.discover-cast-ph { width: 80px; height: 80px; border-radius: 50%; background: #1c2640 center/cover no-repeat; border: 2px solid rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-weight: 600; margin-bottom: 6px; transition: border-color .15s, transform .15s; }',
            '.discover-cast-p:hover .discover-cast-ph, .discover-cast-p:focus .discover-cast-ph { border-color: var(--dc-accent,#ffb400); transform: scale(1.05); }',
            '.discover-cast-p:focus { outline: 0; }',
            '.discover-cast-n { font-size: .85em; font-weight: 600; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }',
            '.discover-info-block { margin: 4px 0 18px; max-width: 1100px; }',
            '.discover-ib-title { font-size: 1.5em; font-weight: 700; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }',
            '.discover-ib-meta { font-size: .6em; font-weight: 500; opacity: .75; }',
            '.discover-ib-tag { font-style: italic; opacity: .85; margin-top: 4px; }',
            '.discover-ib-lines { font-size: .9em; opacity: .75; margin-top: 4px; }',
            '.discover-ib-ov { margin-top: 8px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }',
            '.discover-info-block.open .discover-ib-ov { display: block; }',
            '.discover-ib-more { background: none; border: 0; color: #00a4dc; cursor: pointer; padding: 2px 0; font: inherit; }',
            '.discover-cast-row.compact { gap: 8px; padding-top: 10px; padding-bottom: 4px; }',
            '.discover-cast-p.small { width: 74px; }',
            '.discover-cast-p.small .discover-cast-ph { width: 54px; height: 54px; margin-bottom: 4px; }',
            '.discover-cast-p.small .discover-cast-n { font-size: .72em; }',
            '.discover-cast-r { font-size: .75em; opacity: .65; line-height: 1.2; margin-top: 2px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }',
            '.mainCreditsSection.discover-hidden-credits { display: none !important; }',
            '.discover-row-wrap { position: relative; }',
            '.discover-row-scroller { display: flex; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; -ms-overflow-style: none; }',
            '.discover-row-scroller::-webkit-scrollbar { display: none; }',
            '.discover-row-card { flex: 0 0 auto; width: var(--dc-w, 10.7em); margin-right: var(--dc-gap, 1.1em); scroll-snap-align: start; text-align: center; }',
            '.discover-row-card:last-child { margin-right: 0; }',
            '.discover-row-poster { position: relative; display: block; border-radius: .54em; overflow: hidden; background: #222; height: var(--dc-h, 16em); outline: 0; transition: transform .15s, box-shadow .15s; }',
            '.discover-row-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }',
            /* Geselecteerde poster: dunne gele rand, 5% groter, zachte schaduw. Muis: hover; toetsenbord: focus-visible; tv: focus. */
            '.discover-row-card:hover .discover-row-poster, .discover-row-poster:focus-visible { transform: scale(1.05); box-shadow: 0 0 0 3px var(--dc-accent,#ffb400), 0 .5em 1.2em rgba(0,0,0,.5); }',
            'html.layout-tv .discover-row-poster:focus, html.discover-tv .discover-row-poster:focus { transform: scale(1.05); box-shadow: 0 0 0 3px var(--dc-accent,#ffb400), 0 .5em 1.2em rgba(0,0,0,.5); }',
            /* De knop en titel lichten mee op met de geselecteerde poster (donker randje + gele ring, zodat de ring ook om een gele knop zichtbaar is). */
            '.discover-row-btn { transition: background .15s, box-shadow .15s, filter .15s, transform .15s; }',
            '.discover-row-btn:not(:disabled):hover { filter: brightness(1.18); transform: scale(1.04); }',
            '.discover-ib-more:hover { filter: brightness(1.3); text-decoration: underline; }',
            '.discover-row-card:hover .discover-row-btn, .discover-row-poster:focus-visible ~ .discover-row-btn { box-shadow: 0 0 0 2px #111, 0 0 0 4px var(--dc-accent,#ffb400); }',
            '.discover-row-card:hover .discover-row-btn:not(:disabled), .discover-row-poster:focus-visible ~ .discover-row-btn:not(:disabled) { filter: brightness(1.15); }',
            'html.layout-tv .discover-row-poster:focus ~ .discover-row-btn, html.discover-tv .discover-row-poster:focus ~ .discover-row-btn { box-shadow: 0 0 0 2px #111, 0 0 0 4px var(--dc-accent,#ffb400); }',
            'html.layout-tv .discover-row-poster:focus ~ .discover-row-btn:not(:disabled), html.discover-tv .discover-row-poster:focus ~ .discover-row-btn:not(:disabled) { filter: brightness(1.15); }',
            '.discover-row-card:hover .discover-row-name, .discover-row-poster:focus-visible ~ .discover-row-name, html.layout-tv .discover-row-poster:focus ~ .discover-row-name, html.discover-tv .discover-row-poster:focus ~ .discover-row-name { color: var(--dc-accent,#ffb400); }',
            /* Gele pijlknoppen links en rechts, zoals op de Discover-pagina. Niet op tv (afstandsbediening) en niet op touchscreens. */
            /* Pijlknoppen zoals Emby's eigen rijen: rond en wit, alleen zichtbaar als de muis boven de rij hangt,
               en weg aan het begin/eind. Niet op tv (afstandsbediening) en niet op touchscreens. */
            '.discover-row-arrowbox { position: absolute; top: 0; height: calc(var(--dc-h, 16em) + 1em); display: none; align-items: center; z-index: 5; }',
            '.discover-row-arrowbox.back { left: 0; }',
            '.discover-row-arrowbox.fwd { right: 0; }',
            '@media (pointer: fine) { .discover-row-section:hover .discover-row-arrowbox { display: flex; } }',
            '.discover-row-section .discover-row-arrowbox.is-hidden { display: none !important; }',
            'html.layout-tv .discover-row-arrowbox, html.discover-tv .discover-row-arrowbox { display: none !important; }',
            'html.dcNoYear .discover-row-year { display: none; }',
            // Aanwijzer in gebruik (muis, LG Magic Remote): pijlen bij het aanwijzen, ook op tv.
            'html.dcPointer .discover-row-section:hover .discover-row-arrowbox:not(.is-hidden) { display: flex !important; }',
            '.discover-row-arrow { display: inline-flex; align-items: center; justify-content: center; width: 3.55em; height: 3.55em; margin: 0 .4em; padding: 0; border: 0; border-radius: 100em; background: #fff; color: #000; cursor: pointer;',
            '  box-shadow: 0 4px 5px 0 rgba(0,0,0,.14), 0 1px 10px 0 rgba(0,0,0,.12), 0 2px 4px -1px rgba(0,0,0,.4); transition: transform 250ms cubic-bezier(.175,.885,.32,1.15); }',
            '.discover-row-arrow:hover { transform: scale(1.1); }',
            '.discover-row-arrow svg { width: 2.2em; height: 2.2em; fill: currentColor; }',
            /* Downloadvoortgang uit de Radarr/Sonarr-wachtrij */
            '.discover-row-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: rgba(0,0,0,.65); }',
            'html.layout-tv .discover-row-prog, html.discover-tv .discover-row-prog { height: 12px; }',
            '.discover-row-prog i { display: block; height: 100%; width: 0; background: var(--dc-accent,#ffb400); transition: width .6s; }',
            '.discover-row-prog.paused i, .discover-row-prog.stalled i { background: #9aa5b8; }',
            '.discover-row-name { margin-top: .5em; font-size: .9em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.discover-row-meta { font-size: .8em; opacity: .65; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.discover-row-btn { display: block; width: 100%; box-sizing: border-box; margin-top: .5em; padding: .45em .6em; border: none;',
            '  border-radius: 2em; font: inherit; font-size: .9em; font-weight: 600; cursor: pointer; background: var(--dc-accent,#ffb400); color: var(--dc-accent-text,#111); }',
            '.discover-row-btn:focus { outline: 0; }',
            '.discover-row-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }',
            'html.layout-tv .discover-row-btn:focus, html.discover-tv .discover-row-btn:focus { outline: 2px solid #fff; outline-offset: 2px; }',
            '.discover-row-btn:disabled { cursor: default; }',
            '.discover-row-btn.is-requested { background: #555; color: #fff; }',
            '.discover-row-btn.is-progress { background: #26304a; color: #ffd666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.discover-row-btn.is-progress.paused, .discover-row-btn.is-progress.stalled { color: #d0d6e4; }',
            '.discover-row-btn.is-available { background: #22a559; color: #fff; }',
            '.discover-film-req { cursor: pointer; }',
            '.discover-film-req .discover-film-badge { display:inline-block; margin-left:.6em; padding:0 .5em; border-radius:1em; background:var(--dc-accent,#ffb400); color:var(--dc-accent-text,#111); font-size:.8em; font-weight:700; vertical-align:middle; }',
            '.btnDiscoverRequest {',
            '  background: var(--dc-accent,#ffb400) !important; color: var(--dc-accent-text,#111) !important;',
            '  border: none !important; margin-left: .5em !important;',
            '}',
            '.btnDiscoverRequest:disabled { opacity: .55; cursor: default; }',
            '.btnDiscoverRequest .detailButton-icon,',
            '.btnDiscoverRequest .md-icon { color: #111 !important; }'
        ].join('\n');
        (document.head || document.documentElement).appendChild(s);
    })();

    // BEGIN bottom-clearance
    // Measures Emby's floating bottom navigation bar (any fixed/sticky element near the bottom edge) and exposes its
    // height as --dc-bottom-clear, so item pages, the floating button and the Discover page stay above it.
    // Without such a bar (desktop) nothing is changed.
    (function bottomClearance() {
        var CLS = 'dc-has-bottom-bar', SCROLLER = 'dc-clear-scroller', last = '';
        var css = document.createElement('style');
        css.id = 'discover-bottom-clearance-css';
        css.textContent = [
            'body.' + CLS + '.discover-item-page .itemDetailPage.dc-clear-page { padding-bottom: var(--dc-bottom-clear) !important; }',
            'body.' + CLS + '.discover-item-page .' + SCROLLER + ' { padding-bottom: var(--dc-bottom-clear) !important; box-sizing: border-box; }',
            'body.' + CLS + ' .dcRoot { padding-bottom: var(--dc-bottom-clear) !important; }'
        ].join('\n');
        (document.head || document.documentElement).appendChild(css);

        var lastBar = null, lastMode = '';
        function skip(el) {
            if (el.closest && el.closest('.btnDiscoverRequest, .btnDiscoverFloating, .discover-toast, #discover-dbg, #dc-debug-panel, .dialogContainer, .dialog')) { return true; }
            // A fixed button bar of the item page itself is not the navigation bar.
            return !!(el.querySelector && el.querySelector('.btnDiscoverRequest, .btnPlay'));
        }
        function mobile() {
            return window.innerWidth <= 900 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        }
        function barTop() {
            var vh = window.innerHeight, vw = window.innerWidth, top = vh;
            lastBar = null;
            var xs = [0.15, 0.35, 0.5, 0.65, 0.85], ys = [4, 16, 32, 48, 64, 80, 96, 112];
            for (var xi = 0; xi < xs.length; xi++) {
                for (var yi = 0; yi < ys.length; yi++) {
                    var els = document.elementsFromPoint(vw * xs[xi], vh - ys[yi]);
                    for (var i = 0; i < els.length; i++) {
                        var el = els[i];
                        while (el && el !== document.body && el !== document.documentElement) {
                            var pos = getComputedStyle(el).position;
                            if (pos === 'fixed' || pos === 'sticky') { break; }
                            el = el.parentElement;
                        }
                        if (!el || el === document.body || el === document.documentElement || skip(el)) { continue; }
                        var r = el.getBoundingClientRect();
                        if (r.height > 0 && r.height <= vh * 0.3 && r.width >= vw * 0.4 && r.bottom >= vh - 120 && r.top < top) {
                            top = r.top;
                            lastBar = el;
                        }
                    }
                }
            }
            return top;
        }
        function scroller(page) {
            for (var el = page; el && el !== document.body; el = el.parentElement) {
                var oy = getComputedStyle(el).overflowY;
                if (oy === 'auto' || oy === 'scroll') { return el; }
            }
            return null;
        }
        function describe(el) {
            if (!el) { return 'none'; }
            var c = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 2).join('.');
            return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : '');
        }
        function rectText(el) {
            if (!el) { return '-'; }
            var r = el.getBoundingClientRect();
            return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' b=' + Math.round(r.bottom);
        }
        function debugOn() {
            try {
                var href = String(location.href);
                if (/[?&#]dcdebug=1/.test(href)) { localStorage.setItem('dcDebug', '1'); }
                else if (/[?&#]dcdebug=0/.test(href)) { localStorage.removeItem('dcDebug'); }
                return localStorage.getItem('dcDebug') === '1';
            } catch (e) { return /dcdebug=1/.test(String(location.href)); }
        }
        function debugPanel(info) {
            var el = document.getElementById('dc-debug-panel');
            if (!debugOn()) { if (el && el.parentNode) { el.parentNode.removeChild(el); } return; }
            if (!el) {
                el = document.createElement('div');
                el.id = 'dc-debug-panel';
                el.style.cssText = 'position:fixed;left:4px;top:60px;z-index:2147483647;max-width:94vw;font:10px/1.25 monospace;color:#7CFC00;' +
                    'background:rgba(0,0,0,.82);padding:5px 7px;border-radius:5px;white-space:pre-wrap;word-break:break-all;';
                el.addEventListener('click', function () { el.style.display = 'none'; setTimeout(function () { el.style.display = ''; }, 4000); });
                document.body.appendChild(el);
            }
            var btn = document.querySelector('.btnDiscoverRequest');
            var chain = [];
            for (var a = btn ? btn.parentElement : null; a && a !== document.documentElement && chain.length < 8; a = a.parentElement) {
                var cs = getComputedStyle(a);
                chain.push(describe(a) + ' [' + cs.position + (cs.transform !== 'none' ? ' transform' : '') + (cs.overflowY !== 'visible' ? ' oy=' + cs.overflowY : '') + ' b=' + Math.round(a.getBoundingClientRect().bottom) + ']');
            }
            var bcs = btn ? getComputedStyle(btn) : null;
            var vv = window.visualViewport;
            el.textContent = [
                'Discover v1.4.0.3 build ' + DC_BUILD + ' (' + (window.__discoverRequestButtonBuild || '?') + ')',
                'item page: ' + (document.querySelector('.itemDetailPage') ? 'ja' : 'nee') + ' body=' + document.body.className.split(/\s+/).filter(function (c) { return /^(dc|discover)/.test(c); }).join(' '),
                'bar: ' + (info.bar ? describe(info.bar) + ' ' + rectText(info.bar) : 'niet gevonden') + ' h=' + info.measured,
                'mode=' + info.mode + ' --dc-bottom-clear=' + (document.documentElement.style.getPropertyValue('--dc-bottom-clear') || '(leeg)'),
                'scroller: ' + (info.scroller ? describe(info.scroller) + ' oy=' + getComputedStyle(info.scroller).overflowY : 'document'),
                'lift: ' + (info.lift ? describe(info.lift) : 'geen'),
                'knop: ' + (btn ? rectText(btn) + ' ' + bcs.position + ' bottom=' + bcs.bottom : 'niet aanwezig'),
                'ketting: ' + (chain.join(' < ') || '-'),
                'inner ' + window.innerWidth + 'x' + window.innerHeight + ' vv ' + (vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) : '?') + ' dpr ' + window.devicePixelRatio + ' mobiel=' + mobile()
            ].join('\n');
        }
        function liftButtonBar(active, clearPx) {
            var prev = document.querySelectorAll('[data-dc-lift]');
            if (!active) {
                for (var i = 0; i < prev.length; i++) { prev[i].style.removeProperty('bottom'); prev[i].removeAttribute('data-dc-lift'); }
                return null;
            }
            if (prev.length) { return prev[0]; }
            var btn = document.querySelector('.btnDiscoverRequest');
            if (!btn || btn.classList.contains('btnDiscoverFloating')) { return null; }
            // Emby's own fixed/sticky button bar: move the container itself, padding alone cannot help here.
            for (var el = btn.parentElement; el && el !== document.body; el = el.parentElement) {
                var pos = getComputedStyle(el).position;
                if (pos === 'fixed' || pos === 'sticky') {
                    var rr = el.getBoundingClientRect();
                    if (rr.height <= window.innerHeight * 0.3 && rr.bottom > window.innerHeight - clearPx + 4) {
                        el.setAttribute('data-dc-lift', '1');
                        el.style.setProperty('bottom', 'var(--dc-bottom-clear)', 'important');
                        return el;
                    }
                }
            }
            return null;
        }
        function update() {
            if (!document.body) { return; }
            var measured = Math.max(0, Math.ceil(window.innerHeight - barTop()));
            var bar = lastBar;
            var px = measured > 0 ? measured + 16 : 0;
            var mode = measured > 0 ? 'gemeten' : 'geen';
            var value = px + 'px';
            if (mobile() && px < 88) {
                px = 88;
                value = 'calc(88px + env(safe-area-inset-bottom, 0px))';
                mode = measured > 0 ? 'minimum' : 'fallback';
            }
            var old = document.querySelectorAll('.' + SCROLLER + ', .dc-clear-page');
            for (var o = 0; o < old.length; o++) { old[o].classList.remove(SCROLLER); old[o].classList.remove('dc-clear-page'); }
            var sc0 = null;
            if (px > 0) {
                var pages = document.querySelectorAll('.itemDetailPage');
                for (var p = 0; p < pages.length; p++) {
                    var sc = scroller(pages[p]);
                    if (sc) { sc.classList.add(SCROLLER); sc0 = sc; } else { pages[p].classList.add('dc-clear-page'); }
                }
            }
            var key = mode + value;
            if (key !== last) {
                last = key;
                document.body.classList.toggle(CLS, px > 0);
                if (px > 0) { document.documentElement.style.setProperty('--dc-bottom-clear', value); }
                else { document.documentElement.style.removeProperty('--dc-bottom-clear'); }
            }
            var lifted = liftButtonBar(px > 0, px);
            debugPanel({ bar: bar, measured: measured, mode: mode, scroller: sc0, lift: lifted });
        }
        window.__discoverBottomClear = update;
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        if (window.visualViewport) { window.visualViewport.addEventListener('resize', update); }
        setInterval(update, 1000);
        setTimeout(update, 50);
    })();
    // END bottom-clearance

    function api() { return window.ApiClient || null; }

    function clientLanguage() {
        try { return (document.documentElement && document.documentElement.lang) || navigator.language || ''; } catch (e) { return ''; }
    }

    function loadDiagnosticsSetting() {
        var client = api();
        if (!client || !client.ajax || !client.getUrl || diagnosticsRequest || Date.now() < diagnosticsRetryAfter) { return; }
        diagnosticsRequest = true;
        client.ajax({ type: 'GET', url: client.getUrl('Discover/Status'), dataType: 'json' }).then(function (status) {
            diagnosticsEnabled = !!(status && status.ShowDiagnostics);
            window.__discoverRequestService = (status && status.RequestService) || '';
            if (status && status.AccentColor && window.__dcApplyAccent) { window.__dcApplyAccent(status.AccentColor); }
            // Weergave: jaar / score onder de posters verbergen (klassen op <html>, ook voor de Discover-pagina).
            if (status) {
                document.documentElement.classList.toggle('dcNoYear', status.PosterShowYear === false);
                document.documentElement.classList.toggle('dcNoScore', status.PosterShowScore === false);
            }
            // Automatisch: de taal van deze Emby-app (html lang), niet die van de server.
            var culture = String((status && status.PluginLanguageAuto && clientLanguage()) || (status && status.PluginLanguage) || '').toLowerCase();
            uiLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : (culture.indexOf('nb') === 0 || culture.indexOf('nn') === 0 || culture.indexOf('no') === 0) ? 'no' : 'en';
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

    // Emby 4.11 opent een kanaalmap als lijst: #!/list/list.html?parentId=... (niet als /item?id=...).
    function listIdFromHash() {
        var h = window.location.hash || '';
        if (!/\/list(?:\/list\.html)?\?/i.test(h)) { return null; }
        var m = /[?&]parentId=([^&]+)/.exec(h);
        return m ? decodeURIComponent(m[1]) : null;
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
    var seasonCardSeason = {};   // item-id -> seizoensnummer
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
            // Het kanaalitem "Alle seizoenen" is een aanvraagitem zoals de seizoenen: geen eigen Aanvragen-knop.
            if (/^[\u2713\u23F3]?\s*(?:Alle seizoenen|All seasons|Alle Staffeln)\s*$/i.test(nm)) {
                askIds[id] = true;
                askStatus[id] = 0;
                dbg('alle-seizoenen-aanvraag herkend: ' + nm);
                schedule();
                return null;
            }
            var seasonAskName = /^[\u2713\u23F3]?\s*(?:Aanvragen Seizoen|Request Season|Staffel anfragen|Seizoen|Season|Staffel)\s+\d+/i.test(nm);
            if (seasonAskName) {
                askIds[id] = true;
                seasonAskIds[id] = true;
                askStatus[id] = 0;
                var seasonProviderIds = item.ProviderIds || {};
                var seriesTmdbId = parseInt(seasonProviderIds.Tmdb || seasonProviderIds.tmdb || String(seasonProviderIds.DiscoverSeasonTmdb || '').split('-')[0] || 0, 10) || 0;
                var seasonNo = parseInt(String(seasonProviderIds.DiscoverSeasonTmdb || '').split('-')[1] || 0, 10) ||
                    parseInt((/(?:Seizoen|Season|Staffel)\s+(\d+)/i.exec(nm) || [])[1] || 0, 10) || 0;
                if (seriesTmdbId > 0) {
                    seasonCardIds[id] = seriesTmdbId;
                    seasonCardSeason[id] = seasonNo;
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
        else { setLabel(btn, text('Aanvragen', 'Request', 'Anfragen', 'Forespør'), 'add'); btn.disabled = false; }
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

        var btnAll = mkBtn(text('Alles selecteren', 'Select all', 'Alle auswählen'), false);
        btnAll.onclick = function () { checks.forEach(function (c) { c.checked = true; }); };

        // Een klik: de hele serie aanvragen. Zonder seizoenslijst monitort Sonarr alles, ook seizoenen die later uitkomen.
        var btnEvery = mkBtn(text('Alle seizoenen aanvragen', 'Request all seasons', 'Alle Staffeln anfordern'), true);
        btnEvery.onclick = function () {
            closeModal(overlay);
            onConfirm(null);
        };

        var btnCancel = mkBtn(text('Annuleren', 'Cancel', 'Abbrechen'), false);
        btnCancel.onclick = function () { closeModal(overlay); };

        var btnOk = mkBtn(text('Geselecteerde aanvragen', 'Request selected', 'Auswahl anfordern'), false);
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
        actions.appendChild(btnEvery);
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
            'background': 'var(--dc-accent,#ffb400)', 'background-color': 'var(--dc-accent,#ffb400)', 'color': 'var(--dc-accent-text,#111)',
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
        btn.style.setProperty('bottom', 'max(1.5em, var(--dc-bottom-clear, 0px))', 'important');
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
            var arr = window.__discoverRequestService || (cur.Type === 'tv' ? 'Sonarr' : 'Radarr');
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
        var pages = document.querySelectorAll('.itemDetailPage, .itemView, .view-item-item');
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
        var pages = document.querySelectorAll('.itemDetailPage, .itemView, .view-item-item');
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
                // Eigen onderdelen van de plugin (cast, posterrijen, seizoensinfo) niet mee verbergen.
                for (var n = sec; n; n = n.nextElementSibling) {
                    if (n.classList.contains('discover-cast-section') || n.classList.contains('discover-row-section') || n.classList.contains('discover-season-info') || n.classList.contains('discover-info-block')) { continue; }
                    n.classList.add('discover-hide');
                }
            }
        }
    }

    function hideSeasonMetadata() {
        var page = detailPageEl();
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

    // Zichtbare detailpagina: Emby 4.10 (.itemDetailPage) of 4.11 (.itemView / .view-item-item).
    function detailPageEl() {
        var pages = document.querySelectorAll('.itemDetailPage, .itemView, .view-item-item');
        for (var i = 0; i < pages.length; i++) { if (visible(pages[i])) { return pages[i]; } }
        return null;
    }
    // Seizoensinfo rechts van de poster, onder de beschrijving (in plaats van het blok "Over").
    function renderSeasonCard(id) {
        var key = seasonCardKey(id);
        var info = key ? seasonCardCache[key] : null;
        if (!info || itemIdFromHash() !== id) { return; }
        var page = detailPageEl();
        if (!page) { return; }
        // Volgorde: knop Request, de tekst eronder ("Press ▶ ..."), dan dit kader. Emby 4.11 heeft ook boven de knoppen
        // elementen met "overview" in de naam; daarom de eerste beschrijving NA de knoppen.
        var anchor = null;
        var btns = null, bl = page.querySelectorAll('.mainDetailButtons, .detailButtons');
        for (var b = 0; b < bl.length; b++) { if (visible(bl[b])) { btns = bl[b]; break; } }
        var cands = page.querySelectorAll('.overview-text, .itemOverview, .overview, [class*="verview"]');
        for (var i = 0; i < cands.length; i++) {
            var cd = cands[i];
            if (!visible(cd) || (cd.closest && cd.closest('.discover-season-info'))) { continue; }
            if (btns && (btns.contains(cd) || cd.contains(btns) || !(btns.compareDocumentPosition(cd) & Node.DOCUMENT_POSITION_FOLLOWING))) { continue; }
            anchor = cd; break;
        }
        if (!anchor) { anchor = btns; }
        if (!anchor || !anchor.parentElement) { return; }

        var card = page.querySelector('.discover-season-info');
        if (!card) { card = document.createElement('div'); card.className = 'discover-season-info'; }
        if (card.getAttribute('data-key') !== key) {
            card.setAttribute('data-key', key);
            card.textContent = '';
            var head = document.createElement('div');
            head.className = 'discover-season-info-head';
            var hn = document.createElement('span');
            hn.textContent = info.SeasonName || '';
            head.appendChild(hn);
            var score = info.SeasonRating > 0 ? info.SeasonRating : info.TmdbRating;
            if (score > 0) {
                var rt = document.createElement('span');
                rt.className = 'discover-season-info-rating';
                rt.textContent = 'TMDB ' + score + '%';
                head.appendChild(rt);
            }
            if (head.textContent) { card.appendChild(head); }
            // De seizoensbeschrijving staat al in de tekst onder de knop Request; hier alleen de extra's.
            // Het aantal afleveringen staat al in de beschrijving erboven.
            if (info.SeasonAirDate) {
                appendSeasonInfoRow(card, text('Uitgezonden', 'Aired', 'Ausgestrahlt', 'Sendt'),
                    info.SeasonAirDate + (info.SeasonLastAirDate ? ' \u2013 ' + info.SeasonLastAirDate : ''));
            }
            appendSeasonInfoRow(card, seasonInfoLabel('status'), info.Status);
            if (!info.SeasonAirDate) { appendSeasonInfoRow(card, seasonInfoLabel('firstAirDate'), info.FirstAirDate); }
            appendSeasonInfoRow(card, seasonInfoLabel('network'), info.Network);
            appendSeasonInfoRow(card, seasonInfoLabel('originalLanguage'), info.OriginalLanguage);
            appendSeasonInfoRow(card, seasonInfoLabel('productionCountry'), info.ProductionCountry);
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
        }
        if (anchor.nextSibling !== card) { anchor.parentElement.insertBefore(card, anchor.nextSibling); }
    }
    function seasonCardKey(id) {
        var t = seasonCardIds[id];
        return t ? t + ':' + (seasonCardSeason[id] || 0) : null;
    }

    function loadSeasonCardInfo(itemId, tmdbId) {
        var key = seasonCardKey(itemId);
        if (seasonCardCache[key]) { renderSeasonCard(itemId); return; }
        if (seasonCardPending[key]) { return; }
        var c = api();
        if (!c) { return; }
        seasonCardPending[key] = true;
        c.ajax({
            type: 'GET',
            url: c.getUrl('Discover/SeriesCard', { TmdbId: tmdbId, Season: seasonCardSeason[itemId] || 0 }),
            dataType: 'json'
        }).then(function (info) {
            seasonCardCache[key] = info || {};
            delete seasonCardPending[key];
            renderSeasonCard(itemId);
        }, function (error) {
            delete seasonCardPending[key];
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
            if (el.closest && el.closest('.btnDiscoverRequest, button, .dcRoot, .discover-cast-section, .discover-season-info, .discover-info-block, .discover-row-section')) { continue; }
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
                // Al aangevraagd (⏳ in de titel): de knop vraagt dan opnieuw aan, dus zo heet hij ook.
                var h1 = document.querySelector('.itemDetailPage h1') || document.querySelector('h1');
                var already = /\u23f3/.test((h1 && h1.textContent) || document.title || '');
                var label = renamePlay === 'ask'
                    ? (already ? text('Opnieuw aanvragen', 'Request again', 'Erneut anfragen', 'Forespør igjen')
                               : text('Aanvragen', 'Request', 'Anfragen', 'Forespør'))
                    : text('Trailer', 'Trailer', 'Trailer', 'Trailer');
                if (span && span.textContent !== label) { span.textContent = label; }
                play.setAttribute('title', label);
                play.setAttribute('aria-label', label);
            }
        }
        if (preserveOverview) { hideSeasonMetadata(); }
        else { hideOverSection(); }
        hideMediaInfo(preserveOverview);
        hideExtraButtons();
        // Ook op seizoenspagina's: Over, Links (Trakt) en Media informatie weg; de seizoensinfo staat rechts van de poster.
        hideSectionsByLabel();
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
        // Eerst de server vragen (vindt het kanaal ook als het in Emby hernoemd is, bv. "Aanvragen"), anders op naam.
        chPromise = Promise.resolve(c.getJSON(c.getUrl('Discover/ChannelInfo'))).then(function (ci) {
            if (ci && ci.Id) { return String(ci.Id); }
            return Promise.resolve(c.getJSON(c.getUrl('Channels', { UserId: c.getCurrentUserId() }))).then(function (r) {
                var items = (r && r.Items) || [];
                for (var i = 0; i < items.length; i++) {
                    if (/^Discover(?: Media)?$/i.test(items[i].Name || '')) { return items[i].Id; }
                }
                return null;
            });
        }).then(null, function () { chPromise = null; return null; });
        return chPromise;
    }

    // Welke van deze Emby-id's horen bij Discover? Emby 4.11 geeft ChannelId niet meer mee, dus vraag het de server.
    function discoverIdsOf(ids) {
        var c = api();
        if (!c || !ids.length) { return Promise.resolve({}); }
        return Promise.resolve(c.getJSON(c.getUrl('Discover/IsDiscoverItem', { Ids: ids.join(',') }))).then(function (r) {
            var m = {};
            ((r && r.OurIds) || []).forEach(function (x) { m[x] = true; });
            return m;
        }, function () { return {}; });
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
            return Promise.all([
                Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items', { Ids: ids.join(','), Fields: 'ChannelInfo' }))),
                discoverIdsOf(ids)
            ]).then(function (res) {
                var r = res[0], ours = res[1];
                var mine = {};
                ((r && r.Items) || []).forEach(function (it) { if (it.ChannelId === chId || ours[it.Id]) { mine[it.Id] = true; } });
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
            card.classList.remove('discover-no-played');
            if (info && info.name && /^[\u2713\u23F3]?\s*(?:Alle seizoenen|All seasons|Alle Staffeln)\s*$/i.test(info.name)) {
                // Emby's eigen groene "gezien"-vinkje zegt hier niets over je bibliotheek: verbergen.
                card.classList.add('discover-no-played');
            }
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
            return Promise.all([Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items', {
                Ids: ids.join(','), Fields: 'ChannelInfo,ParentId,ProviderIds'
            }))), discoverIdsOf(ids)]).then(function (res2) {
                var r = res2[0], ours = res2[1];
                var found = {};
                ((r && r.Items) || []).forEach(function (item) {
                    if (item.ChannelId === chId || ours[item.Id]) {
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
            return Promise.all([Promise.resolve(c.getJSON(c.getUrl('Users/' + c.getCurrentUserId() + '/Items/' + id, { Fields: 'ChannelInfo' }))), discoverIdsOf([id])]).then(function (res) {
                var it = res[0], ours = res[1];
                // Emby 4.11 geeft ChannelId niet mee bij kanaalitems: dan geldt het antwoord van de server.
                if (it && it.IsFolder && (it.ChannelId === chId || ours[id])) { folderPage[id] = true; schedule(); }
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
            text('Aanvragen', 'Request', 'Anfragen', 'Forespør');
    }

    function rowRoleText(role) {
        if (!role) { return ''; }
        return role === 'Director' ? text('Regie', 'Director', 'Regie') : role;
    }

    // ---- Downloadvoortgang (Radarr/Sonarr-wachtrij) voor de rijen ----
    var rowQueue = {};           // 'movie:123' -> wachtrij-item
    var rowQueueTimer = null, rowQueueBusy = false, rowQueueUntil = 0;
    function rowStateLabel(st) {
        return st === 'downloading' ? text('Downloaden', 'Downloading', 'Lädt herunter', 'Laster ned') :
            st === 'paused' ? text('Gepauzeerd', 'Paused', 'Pausiert', 'Pauset') :
            st === 'importing' ? text('Wordt toegevoegd', 'Importing', 'Wird importiert', 'Importeres') :
            st === 'stalled' ? text('Wacht op download', 'Waiting for download', 'Wartet auf Download', 'Venter') :
            text('In wachtrij', 'Queued', 'In Warteschlange', 'I kø');
    }
    function rowQueueText(e) {
        if (e.State === 'downloading') { return '\u2193 ' + e.Progress + '%'; }
        if (e.State === 'paused') { return rowStateLabel(e.State) + ' \u00B7 ' + e.Progress + '%'; }
        return rowStateLabel(e.State);
    }
    function applyRowProgress(card, item) {
        var poster = card.querySelector('.discover-row-poster');
        if (!poster) { return; }
        var e = rowQueue[item.Type + ':' + item.TmdbId];
        var bar = poster.querySelector('.discover-row-prog');
        if (!e) { if (bar) { poster.removeChild(bar); } return; }
        if (!bar) { bar = document.createElement('div'); bar.appendChild(document.createElement('i')); poster.appendChild(bar); }
        bar.className = 'discover-row-prog ' + e.State;
        bar.firstChild.style.width = e.Progress + '%';
    }
    function loadRowQueue() {
        rowQueueTimer = null;
        if (rowQueueBusy || !api() || !document.querySelector('.discover-row-section')) { return; }
        if (document.hidden) { rowQueueTimer = setTimeout(loadRowQueue, 15000); return; }
        rowQueueBusy = true;
        var c = api();
        Promise.resolve(c.getJSON(c.getUrl('Discover/Queue'))).then(function (r) {
            rowQueueBusy = false;
            var next = {};
            ((r && r.Items) || []).forEach(function (e) { next[e.Type + ':' + e.TmdbId] = e; });
            rowQueue = next;
            var bs = document.querySelectorAll('.discover-row-btn');
            for (var i = 0; i < bs.length; i++) { if (bs[i]._item) { styleRowButton(bs[i], bs[i]._item); } }
            // Alleen blijven verversen zolang er iets van deze rijen in de wachtrij staat (of net is aangevraagd).
            var any = false;
            for (var j = 0; j < bs.length && !any; j++) { if (bs[j]._item && rowQueue[bs[j]._item.Type + ':' + bs[j]._item.TmdbId]) { any = true; } }
            if (any || Date.now() < rowQueueUntil) { rowQueueTimer = setTimeout(loadRowQueue, 15000); }
        }, function () {
            rowQueueBusy = false;
            if (Date.now() < rowQueueUntil) { rowQueueTimer = setTimeout(loadRowQueue, 30000); }
        });
    }
    function startRowQueue(delay) {
        if (rowQueueTimer) { clearTimeout(rowQueueTimer); }
        rowQueueTimer = setTimeout(loadRowQueue, delay || 0);
    }

    function styleRowButton(btn, item) {
        var e = item.Status === 1 ? rowQueue[item.Type + ':' + item.TmdbId] : null;
        btn.disabled = item.Status !== 0;
        btn.textContent = e ? rowQueueText(e) : rowStatusText(item.Status);
        btn.className = 'discover-row-btn' + (e ? ' is-progress ' + e.State : item.Status === 2 ? ' is-available' : item.Status === 1 ? ' is-requested' : '');
        var card = btn.parentNode;
        if (card && card.classList && card.classList.contains('discover-row-card')) { applyRowProgress(card, item); }
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
                    rowQueueUntil = Date.now() + 5 * 60 * 1000;
                    startRowQueue(5000);
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
        if (!host) {
            var credits = document.querySelector('.mainCreditsSection');
            return credits && visible(credits) && credits.parentNode ? credits.parentNode : null;
        }
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
        link.href = '#!/configurationpage?name=discoverui1112&openType=' + item.Type + '&openId=' + item.TmdbId;
        link.setAttribute('aria-label', item.Title);   // geen title: dat gaf een tooltip-vakje over de poster
        // Gewone klik: de popup hier op de pagina openen (Ctrl/middenklik volgt de link naar Discover).
        link.addEventListener('click', function (e) {
            if (e.button || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
            e.preventDefault(); e.stopPropagation();
            openPopupHere(item.Type, item.TmdbId);
        });
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
        var kind = item.Type === 'tv' ? text('Serie', 'Series', 'Serie', 'Serie') : text('Film', 'Movie', 'Film', 'Film');
        var role = rowRoleText(item.Role);
        meta.appendChild(document.createTextNode(kind));
        if (item.Year) { var ys = document.createElement('span'); ys.className = 'discover-row-year'; ys.textContent = ' · ' + item.Year; meta.appendChild(ys); }
        if (role) { meta.appendChild(document.createTextNode(' · ' + role)); }
        meta.title = meta.textContent;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn._item = item;
        btn.setAttribute('data-key', item.Type + ':' + item.TmdbId);
        btn.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            if (item.Status === 0) { requestRowItem(item, btn); }
        });
        card.appendChild(link); card.appendChild(name); card.appendChild(meta); card.appendChild(btn);
        styleRowButton(btn, item);
        return card;
    }

    // Pijlknop voor een rij: niet focusbaar (tabindex -1), zodat de afstandsbediening er niet op blijft hangen.
    function makeRowArrow(row, dir) {
        var box = document.createElement('div');
        box.className = 'discover-row-arrowbox ' + (dir < 0 ? 'back is-hidden' : 'fwd');
        var b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.className = 'discover-row-arrow';
        b.setAttribute('aria-label', dir < 0 ? text('Vorige', 'Previous', 'Zurück', 'Forrige') : text('Volgende', 'Next', 'Weiter', 'Neste'));
        b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (dir < 0 ? 'M14.7 6.3a1 1 0 0 1 0 1.4L10.4 12l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0z' : 'M9.3 6.3a1 1 0 0 0 0 1.4l4.3 4.3-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0z') + '"/></svg>';
        box.appendChild(b);
        b.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            var amount = Math.max(300, row.clientWidth * 0.85) * dir;
            if (row.scrollBy) { row.scrollBy({ left: amount, behavior: 'smooth' }); } else { row.scrollLeft += amount; }
        });
        return box;
    }
    // Links weg aan het begin, rechts weg aan het eind; geen pijlen als de hele rij al in beeld past.
    function updateRowArrows(wrap) {
        var row = wrap.querySelector('.discover-row-scroller');
        var l = wrap.querySelector('.discover-row-arrowbox.back'), r = wrap.querySelector('.discover-row-arrowbox.fwd');
        if (!row || !l || !r) { return; }
        var max = row.scrollWidth - row.clientWidth;
        l.classList.toggle('is-hidden', row.scrollLeft <= 12);
        r.classList.toggle('is-hidden', row.scrollLeft >= max - 12);
    }
    window.addEventListener('resize', function () {
        var ws = document.querySelectorAll('.discover-row-wrap');
        for (var i = 0; i < ws.length; i++) { updateRowArrows(ws[i]); }
    });

    // Postermaat van Emby's eigen staande kaarten op deze pagina (cast, "More Like This"), zodat onze rij even groot is.
    function embyCardSize(parent) {
        var imgs = (parent || document).querySelectorAll('.portraitCard .cardImageContainer');
        for (var i = 0; i < imgs.length; i++) {
            var r = imgs[i].getBoundingClientRect();
            if (r.width > 40 && r.height > 60) {
                var card = imgs[i].closest ? imgs[i].closest('.card') : null;
                var cw = card ? card.getBoundingClientRect().width : r.width;
                return { w: Math.round(r.width), h: Math.round(r.height), gap: Math.max(8, Math.round(cw - r.width)) };
            }
        }
        return null;
    }
    function embyAnchorSection(parent) {
        var similar = parent.querySelector('.similarSection');
        if (similar && similar.parentNode === parent) { return similar; }
        var secs = parent.querySelectorAll('.verticalSection-cards.emby-scrollbuttons-scroller');
        for (var i = secs.length - 1; i >= 0; i--) {
            if (secs[i].parentNode === parent && visible(secs[i]) && secs[i].querySelector('.card')) { return secs[i]; }
        }
        return null;
    }

    function renderRowSections(id, sections) {
        var parent = rowParent();
        if (!parent) { return false; }
        if (parent.querySelector('.discover-row-section[data-itemid="' + id + '"]')) { return true; }
        removeRowSections(null);
        var size = embyCardSize(parent);
        // Direct onder Emby's eigen "More Like This" (of op persoonspagina's na de laatste posterrij), niet onderaan.
        var after = embyAnchorSection(parent);
        sections.forEach(function (s) {
            var sec = document.createElement('div');
            sec.className = 'discover-row-section verticalSection verticalSection-cards';
            sec.setAttribute('data-itemid', id);
            sec.setAttribute('data-row', s.key);
            if (size) {
                sec.style.setProperty('--dc-w', size.w + 'px');
                sec.style.setProperty('--dc-h', size.h + 'px');
                sec.style.setProperty('--dc-gap', size.gap + 'px');
            }
            var h = document.createElement('h2');
            h.className = 'discover-row-title sectionTitle sectionTitle-cards padded-left padded-left-page padded-right';
            h.textContent = s.title;
            sec.appendChild(h);
            var wrap = document.createElement('div');
            wrap.className = 'discover-row-wrap';
            var row = document.createElement('div');
            row.className = 'discover-row-scroller padded-top-focusscale padded-bottom-focusscale padded-left padded-left-page padded-right';
            s.items.forEach(function (item) { row.appendChild(buildRowCard(item)); });
            wrap.appendChild(makeRowArrow(row, -1));
            wrap.appendChild(row);
            wrap.appendChild(makeRowArrow(row, 1));
            sec.appendChild(wrap);
            if (after && after.parentNode === parent) { parent.insertBefore(sec, after.nextSibling); after = sec; }
            else { parent.appendChild(sec); }
            row.addEventListener('scroll', function () { updateRowArrows(wrap); });
            // Opnieuw rekenen zodra de rij echt in beeld en op maat is (Emby schuift pagina's in: bij het maken kan de
            // rij nog 0 breed zijn, dan bleef de pijl naar rechts weg) en bij het aanwijzen met de muis.
            wrap.addEventListener('mouseenter', function () { updateRowArrows(wrap); });
            if (typeof ResizeObserver === 'function') {
                try { new ResizeObserver(function () { updateRowArrows(wrap); }).observe(row); } catch (x) { }
            }
            // Toetsenbord: de gefocuste poster netjes in beeld (op tv doet onRowCommand dat al).
            row.addEventListener('focusin', function (ev) {
                var card = ev.target && ev.target.closest ? ev.target.closest('.discover-row-card') : null;
                if (card && !rowIsTv()) { try { card.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) { } }
            });
            setTimeout(function () { updateRowArrows(wrap); }, 0);
            // Posters laden later in: dan verandert de breedte nog.
            setTimeout(function () { updateRowArrows(wrap); }, 800);
        });
        startRowQueue(0);
        return true;
    }

    // Emby's eigen filmografielijst op een acteurspagina aanvraagbaar maken: klik je op een titel die je nog
    // niet hebt, dan opent dezelfde Discover-popup (met Aanvragen). Titels die je al hebt, laten we met rust.
    function normTitle(t) {
        return String(t || '').toLowerCase().normalize ? String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
            : String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    function filmReqOpen(type, tmdbId) { openPopupHere(type, tmdbId); }

    // ---- Cast onder kanaalpagina's van Discover (titelmap, "Request: serie", aanvraag- en traileritem) ----
    var castData = {};   // Emby-item-id -> { Cast: [...] } | 'loading'
    function goEmbyItem(embyId) {
        var c = api();
        var fallback = function () { window.location.hash = '#!/item?id=' + encodeURIComponent(embyId) + '&serverId=' + encodeURIComponent(c.serverId()); };
        try {
            Promise.resolve(c.getItem(c.getCurrentUserId(), embyId)).then(function (item) {
                try { require(['appRouter'], function (router) { try { router.showItem(item); } catch (e) { fallback(); } }, fallback); }
                catch (e) { fallback(); }
            }, fallback);
        } catch (e) { fallback(); }
    }
    function findEmbyPersonRB(pid, name) {
        var c = api();
        return Promise.resolve(c.getJSON(c.getUrl('Persons', { SearchTerm: name || '', UserId: c.getCurrentUserId(), Fields: 'ProviderIds', Limit: 30 })))
            .then(function (r) {
                var list = (r && r.Items) || [], exact = null;
                for (var k = 0; k < list.length; k++) {
                    var t = list[k].ProviderIds && (list[k].ProviderIds.Tmdb || list[k].ProviderIds.tmdb);
                    if (t && String(t) === String(pid)) { return list[k]; }
                    if (!exact && String(list[k].Name || '').toLowerCase() === String(name || '').toLowerCase()) { exact = list[k]; }
                }
                return exact;
            }, function () { return null; });
    }
    // In je bibliotheek: Emby's acteurspagina; anders de persoonspagina van Discover.
    function openCastPerson(pid, name) {
        findEmbyPersonRB(pid, name).then(function (p) {
            if (p) { goEmbyItem(p.Id); return; }
            try { sessionStorage.setItem('dcOpenNext', JSON.stringify({ kind: 'person', id: pid, name: name || '', at: Date.now() })); } catch (e) { }
            // Zonder extra parameters: dan hergebruikt Emby de al geopende Discover-pagina (anders maakt 4.11 een tweede,
            // onzichtbare kopie). Wat er geopend moet worden staat in sessionStorage.
            window.location.hash = '#!/configurationpage?name=' + DC_UI_PAGE;
        });
    }
    function castHost(id) {
        // Mappagina (lijst met seizoenen of tegels): direct onder de lijst.
        if (folderPage[id] === true) {
            var conts = document.querySelectorAll('.itemsContainer');
            for (var i = conts.length - 1; i >= 0; i--) {
                if (visible(conts[i]) && conts[i].parentNode) { return { parent: conts[i].parentNode, after: conts[i] }; }
            }
            return null;
        }
        var p = rowParent();
        return p ? { parent: p, after: null } : null;
    }
    function castButton(p, small) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'discover-cast-p' + (small ? ' small' : '');
        b.title = p.Name + (p.Character ? ' \u2013 ' + p.Character : '');
        var ph = document.createElement('div');
        ph.className = 'discover-cast-ph';
        if (p.Photo) { ph.style.backgroundImage = 'url("' + p.Photo + '")'; }
        else { ph.textContent = String(p.Name || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join(''); }
        var n = document.createElement('div'); n.className = 'discover-cast-n'; n.textContent = p.Name;
        b.appendChild(ph); b.appendChild(n);
        if (p.Character && !small) { var r = document.createElement('div'); r.className = 'discover-cast-r'; r.textContent = p.Character; b.appendChild(r); }
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCastPerson(p.Id, p.Name); });
        return b;
    }
    // Compact infoblok boven de lijst van een Discover-map (seizoenen of Request/Trailer): ook bij 31 seizoenen meteen zichtbaar.
    function renderInfoBlock(id, d) {
        if (document.querySelector('.discover-info-block[data-itemid="' + id + '"]')) { return; }
        if (!d.Title && !(d.Cast && d.Cast.length)) { return; }
        var conts = document.querySelectorAll('.itemsContainer'), cont = null;
        for (var i = conts.length - 1; i >= 0; i--) { if (visible(conts[i]) && conts[i].parentNode) { cont = conts[i]; break; } }
        if (!cont) { return; }
        var box = document.createElement('div');
        box.className = 'discover-info-block padded-left padded-left-page padded-right';
        box.setAttribute('data-itemid', id);
        var head = document.createElement('div');
        head.className = 'discover-ib-title';
        head.textContent = d.Title || '';
        var meta = [];
        if (d.Rating > 0) { meta.push('\u2605 ' + (Math.round(d.Rating * 10) / 10).toFixed(1)); }
        if (d.Year) { meta.push(String(d.Year)); }
        if (meta.length) { var m = document.createElement('span'); m.className = 'discover-ib-meta'; m.textContent = meta.join(' \u00B7 '); head.appendChild(m); }
        box.appendChild(head);
        var lines = (d.Lines || []).slice();
        if (lines.length && /^\u201C/.test(lines[0])) {
            var tg = document.createElement('div'); tg.className = 'discover-ib-tag'; tg.textContent = lines.shift(); box.appendChild(tg);
        }
        if (lines.length) {
            var ln = document.createElement('div'); ln.className = 'discover-ib-lines'; ln.textContent = lines.join('  \u00B7  '); box.appendChild(ln);
        }
        if (d.Overview) {
            var ov = document.createElement('div'); ov.className = 'discover-ib-ov'; ov.textContent = d.Overview; box.appendChild(ov);
            var more = document.createElement('button'); more.type = 'button'; more.className = 'discover-ib-more';
            more.textContent = text('Meer', 'More', 'Mehr', 'Mer');
            more.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                var open = box.classList.toggle('open');
                more.textContent = open ? text('Minder', 'Less', 'Weniger', 'Mindre') : text('Meer', 'More', 'Mehr', 'Mer');
            });
            box.appendChild(more);
            setTimeout(function () { if (ov.scrollHeight <= ov.clientHeight + 2) { more.style.display = 'none'; } }, 0);
        }
        if (d.Cast && d.Cast.length) {
            var row = document.createElement('div');
            row.className = 'discover-cast-row compact';
            d.Cast.forEach(function (p) { row.appendChild(castButton(p, true)); });
            box.appendChild(row);
        }
        cont.parentNode.insertBefore(box, cont);
    }
    function syncItemCast(id) {
        var old = document.querySelectorAll('.discover-cast-section, .discover-info-block');
        for (var o = 0; o < old.length; o++) {
            if (old[o].getAttribute('data-itemid') !== id && old[o].parentNode) { old[o].parentNode.removeChild(old[o]); }
        }
        if (!id || !api() || !(folderPage[id] === true || askIds[id] || trailerIds[id])) { return; }
        if (folderPage[id] === true && castData[id] && castData[id] !== 'loading') {
            var ib = document.querySelector('.discover-info-block[data-itemid="' + id + '"]');
            if (ib && !visible(ib) && ib.parentNode) { ib.parentNode.removeChild(ib); }
            renderInfoBlock(id, castData[id]);
            return;
        }
        var mine = document.querySelector('.discover-cast-section[data-itemid="' + id + '"]');
        if (mine && visible(mine)) { return; }
        if (mine && mine.parentNode) { mine.parentNode.removeChild(mine); }
        if (castData[id] === undefined) {
            castData[id] = 'loading';
            var c = api();
            Promise.resolve(c.ajax({ type: 'GET', dataType: 'json', url: c.getUrl('Discover/ItemCast', { Id: id }) })).then(function (r) {
                castData[id] = r || { Cast: [] };
                schedule();
            }, function () { castData[id] = { Cast: [] }; });
            return;
        }
        var d = castData[id];
        if (!d || d === 'loading' || !d.Cast || !d.Cast.length) { return; }
        var host = castHost(id);
        if (!host) { return; }
        var sec = document.createElement('div');
        sec.className = 'discover-cast-section verticalSection';
        sec.setAttribute('data-itemid', id);
        var h = document.createElement('h2');
        h.className = 'sectionTitle sectionTitle-cards padded-left padded-left-page padded-right';
        h.textContent = text('Cast', 'Cast', 'Besetzung', 'Rolleliste');
        sec.appendChild(h);
        var row = document.createElement('div');
        row.className = 'discover-cast-row padded-left padded-left-page padded-right';
        d.Cast.forEach(function (p) { row.appendChild(castButton(p, false)); });
        sec.appendChild(row);
        if (host.after && host.after.parentNode === host.parent) { host.parent.insertBefore(sec, host.after.nextSibling); }
        else { host.parent.appendChild(sec); }
    }

    // ---- De Discover-popup boven de huidige pagina ----
    // Laadt de Discover-pagina één keer onzichtbaar (alleen de popup wordt gebruikt) met dezelfde controller
    // als de echte pagina, in "embedded"-modus. Zo is de popup overal gelijk: info, cast, seizoenen, trailer, aanvragen.
    var DC_UI_PAGE = 'discoverui1112', DC_UI_JS = 'discoveruijs1407';
    var embedPromise = null;
    function pageText(c, name) {
        var url = c.getUrl('web/ConfigurationPage', { name: name });
        return Promise.resolve(c.ajax({ type: 'GET', url: url, dataType: 'text' })).then(function (r) {
            if (r && typeof r.text === 'function') { return r.text(); }
            return typeof r === 'string' ? r : Promise.reject(new Error('geen tekst'));
        });
    }
    function loadEmbeddedPopup() {
        if (embedPromise) { return embedPromise; }
        var c = api();
        if (!c) { return Promise.reject(new Error('geen ApiClient')); }
        embedPromise = pageText(c, DC_UI_PAGE).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var page = doc.querySelector('[data-role="page"]');
            if (!page) { throw new Error('Discover-pagina niet gevonden'); }
            if (!document.getElementById('discover-embed-style')) {
                var st = document.createElement('style');
                st.id = 'discover-embed-style';
                st.textContent = '.dcEmbedded > .dcRoot { display:none !important; } .dcEmbedded { position:static; }';
                document.head.appendChild(st);
            }
            var host = document.createElement('div');
            host.className = 'discoverUiPage dcEmbedded';
            host.innerHTML = page.innerHTML;
            return new Promise(function (resolve, reject) {
                var prev = window.define, factory = null, taken = false;
                var shim = function (deps, f) {
                    if (!taken && typeof f === 'function') { taken = true; factory = f(); return; }
                    if (prev) { return prev.apply(this, arguments); }
                };
                if (prev && prev.amd) { shim.amd = prev.amd; }
                window.define = shim;
                var s = document.createElement('script');
                s.src = c.getUrl('web/ConfigurationPage', { name: DC_UI_JS });
                s.async = true;
                s.onload = function () {
                    window.define = prev;
                    if (typeof factory !== 'function') { reject(new Error('controller niet geladen')); return; }
                    document.body.appendChild(host);
                    try { factory(host, { embedded: true }); } catch (err) { reject(err); return; }
                    if (typeof host.__dcOpen !== 'function') { reject(new Error('oude Discover-pagina')); return; }
                    resolve(host);
                };
                s.onerror = function () { window.define = prev; reject(new Error('script laden mislukt')); };
                document.head.appendChild(s);
            });
        });
        embedPromise.then(null, function (err) {
            dbg('popup op de pagina mislukt: ' + (err && err.message ? err.message : err));
            embedPromise = null;
        });
        return embedPromise;
    }
    function openPopupHere(type, tmdbId) {
        loadEmbeddedPopup().then(function (host) {
            host.__dcOpen(type, parseInt(tmdbId, 10));
        }, function () {
            // Reserve: naar de Discover-pagina met de popup.
            try { sessionStorage.setItem('dcOpenNext', JSON.stringify({ kind: 'title', type: type, id: tmdbId, at: Date.now() })); } catch (e) { }
            try { window.location.hash = '#!/configurationpage?name=' + DC_UI_PAGE; } catch (e) { }
        });
    }
    // Persoonspagina: Emby's filmografielijst verbergen zolang onze posterrij "Niet in je bibliotheek" er staat
    // (wat je al hebt toont Emby als posterrijen, wat je nog niet hebt staat in onze rij). Geen rij = lijst blijft.
    function syncFilmographyList(id) {
        var section = document.querySelector('.mainCreditsSection');
        if (!section) { return; }
        var ours = document.querySelector('.discover-row-section[data-itemid="' + id + '"][data-row^="person"]');
        section.classList.toggle('discover-hidden-credits', !!ours);
    }
    // Emby bouwt zijn eigen "More Like This" soms pas na onze rij op: dan onze rij(en) er alsnog onder zetten.
    function keepRowOrder(id) {
        var mine = document.querySelectorAll('.discover-row-section[data-itemid="' + id + '"]');
        if (!mine.length) { return; }
        var parent = mine[0].parentNode;
        var similar = parent && parent.querySelector('.similarSection');
        if (!similar || similar.parentNode !== parent) { return; }
        if (similar.compareDocumentPosition(mine[0]) & Node.DOCUMENT_POSITION_PRECEDING) {
            var after = similar;
            for (var i = 0; i < mine.length; i++) { parent.insertBefore(mine[i], after.nextSibling); after = mine[i]; }
        }
    }

    function wireFilmography(id) {
        var data = rowData[id];
        if (!data || !data.length) { return; }
        var items = [];
        for (var i = 0; i < data.length; i++) { if (String(data[i].key).indexOf('person') === 0) { items = items.concat(data[i].items); } }
        if (!items.length) { return; }
        var section = document.querySelector('.mainCreditsSection');
        if (!section || !visible(section)) { return; }
        // index op genormaliseerde titel -> lijst van credits (kan meer jaren hebben)
        var byTitle = {};
        for (var j = 0; j < items.length; j++) {
            var it = items[j]; if (it.Status !== 0) { continue; }
            var k = normTitle(it.Title); if (!k) { continue; }
            (byTitle[k] = byTitle[k] || []).push(it);
        }
        var rows = section.querySelectorAll('.listItem');
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (row.getAttribute('data-discover-film')) { continue; }
            var bodyEl = row.querySelector('.listItemBodyText') || row;
            var bodyNorm = normTitle(bodyEl.textContent);
            var yearEl = row.querySelector('.secondaryText');
            var ym = (yearEl && yearEl.textContent || '').match(/\d{4}/);
            var year = ym ? parseInt(ym[0], 10) : 0;
            // zoek de credit waarvan de genormaliseerde titel vooraan in de regel staat (+ jaar als beide bekend)
            var match = null, keys = Object.keys(byTitle);
            for (var t = 0; t < keys.length; t++) {
                if (bodyNorm.indexOf(keys[t]) !== 0 && bodyNorm.indexOf(keys[t]) < 0) { continue; }
                var cands = byTitle[keys[t]];
                for (var cI = 0; cI < cands.length; cI++) {
                    if (!year || !cands[cI].Year || cands[cI].Year === year) { match = cands[cI]; break; }
                }
                if (match) { break; }
            }
            if (!match) { continue; }
            row.setAttribute('data-discover-film', '1');
            row.classList.add('discover-film-req');
            if (!row.querySelector('.discover-film-badge')) {
                var b = document.createElement('span');
                b.className = 'discover-film-badge';
                b.textContent = text('Aanvragen', 'Request', 'Anfragen', 'Forespør');
                (row.querySelector('.listItemBodyText') || row).appendChild(b);
            }
            (function (type, tmdb) {
                row.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); filmReqOpen(type, tmdb); }, true);
                row.addEventListener('keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); e.stopPropagation(); filmReqOpen(type, tmdb); } }, true);
            })(match.Type, match.TmdbId);
        }
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
                // Films en series apart: bij iemand met veel titels werd één rij erg lang.
                var all = (r && r.Items) || [];
                var nm = item.Name || '';
                return [
                    // Zelfde namen als op de persoonspagina in Discover: "Meer films met <naam>" (alleen wat je nog niet hebt).
                    { key: 'person_movie', title: text('Meer films met ' + nm, 'More movies with ' + nm, 'Weitere Filme mit ' + nm, 'Flere filmer med ' + nm),
                        items: all.filter(function (x) { return x.Type !== 'tv'; }) },
                    { key: 'person_tv', title: text('Meer series met ' + nm, 'More series with ' + nm, 'Weitere Serien mit ' + nm, 'Flere serier med ' + nm),
                        items: all.filter(function (x) { return x.Type === 'tv'; }) }
                ];
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
                out.push({ key: 'related', title: text('Meer zoals dit \u00B7 nog niet in je bibliotheek', 'More like this \u00B7 not in your library',
                    'Mehr wie dies \u00B7 nicht in deiner Bibliothek', 'Mer som dette \u00B7 ikke i biblioteket ditt'),
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
            if (rowData[id].length) { renderRowSections(id, rowData[id]); syncFilmographyList(id); keepRowOrder(id); }
            else { syncFilmographyList(id); }
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

    // Op Emby's instellingen-/dashboard-/pluginpagina's heeft dit script niets te doen. Daar laten we
    // alles rusten (observer uit), zodat de trage tv-remote er niet door gehinderd wordt.
    function isIdleRoute() {
        var h = (window.location.hash || '').toLowerCase().replace(/^#!?/, '');
        return /^\/(configurationpage|dashboard|settings|mypreferences|user(?:edit|new|profiles?|library|parental|password)|device|dlna|livetv(?:status|guide|tuner|setup|guideprovider)|metadata|library(?:display|setup)?|encoding|playback|streaming|notification|scheduledtask|serveractivity|log|apikey|networking|branding|plugin|repositor|about|quickconnect|wizard)/.test(h);
    }

    function removeOurUi() {
        try {
            var nodes = document.querySelectorAll('.btnDiscoverRequest, .btnDiscoverRemove, .discover-season-info');
            for (var i = 0; i < nodes.length; i++) { if (nodes[i].parentNode) { nodes[i].parentNode.removeChild(nodes[i]); } }
            if (document.body) {
                document.body.classList.remove('discover-item-page', 'discover-ask-page', 'discover-ask-play', 'discover-season-ask-page', 'discover-folder-page');
            }
            removeHero();
        } catch (e) { }
    }

    function tick() {
        if (isIdleRoute()) { return; }
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
        // Mappen: als detailpagina (/item?id=) of als lijst (/list?parentId=, Emby 4.11).
        var folderId = id || listIdFromHash();
        syncFolderPage(folderId);
        syncExtraRows(id);
        syncItemCast(folderId);
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

    var bodyObserver = null;
    function connectObserver() {
        if (bodyObserver || !document.body) { return; }
        try {
            // De YouTube-link (en de regel erbij) meteen bij elke wijziging verbergen, nog voordat de pagina getekend wordt.
            bodyObserver = new MutationObserver(function () {
                try { hideFilePathLines(false, true); } catch (e) { }
                schedule();
            });
            bodyObserver.observe(document.body, { childList: true, subtree: true });
        } catch (e) { bodyObserver = null; }
    }
    function disconnectObserver() {
        if (bodyObserver) { try { bodyObserver.disconnect(); } catch (e) { } bodyObserver = null; }
    }
    // Observer alleen op gewone pagina's; op instellingen/dashboard volledig uit (anders hapert de tv-remote).
    function applyRouteState() {
        if (isIdleRoute()) { disconnectObserver(); removeOurUi(); }
        else { connectObserver(); schedule(); }
    }

    // Op tv kun je met de afstandsbediening door de posterrijen ("Meer zoals dit" / "Niet in je bibliotheek").
    // Emby's eigen focusnavigatie scrolt deze losse rijen niet, dus doen we links/rechts (tussen posters) en
    // omhoog/omlaag (tussen poster en Aanvragen-knop) zelf, met de poster netjes in beeld.
    function rowIsTv() {
        var de = document.documentElement;
        return !!(de && de.classList && de.classList.contains('layout-tv')) ||
            /Web0S|webOS|Tizen|SmartTV|NetCast/i.test(navigator.userAgent || '');
    }
    function rowCardFocusables(card) {
        return { poster: card.querySelector('.discover-row-poster'), btn: card.querySelector('.discover-row-btn') };
    }
    function focusRowCard(card, preferBtn) {
        if (!card) { return false; }
        var f = rowCardFocusables(card);
        var target = (preferBtn && f.btn && !f.btn.disabled) ? f.btn : f.poster;
        if (!target) { return false; }
        try { target.focus(); } catch (e) { return false; }
        try { card.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { try { card.scrollIntoView(); } catch (x) { } }
        return true;
    }
    function onRowCommand(e) {
        if (!rowIsTv()) { return; }
        var cmd = e.detail && e.detail.command;
        if (cmd !== 'left' && cmd !== 'right' && cmd !== 'up' && cmd !== 'down') { return; }
        var active = document.activeElement;
        var card = active && active.closest ? active.closest('.discover-row-card') : null;
        if (!card) { return; }
        var scroller = card.parentNode;
        var cards = Array.prototype.slice.call(scroller.querySelectorAll('.discover-row-card'));
        var idx = cards.indexOf(card);
        var onBtn = active.classList && active.classList.contains('discover-row-btn');
        if (cmd === 'left') {
            if (idx > 0 && focusRowCard(cards[idx - 1], onBtn)) { e.preventDefault(); e.stopPropagation(); }
        } else if (cmd === 'right') {
            if (idx < cards.length - 1 && focusRowCard(cards[idx + 1], onBtn)) { e.preventDefault(); e.stopPropagation(); }
        } else if (cmd === 'down') {
            var f = rowCardFocusables(card);
            if (!onBtn && f.btn && !f.btn.disabled) { f.btn.focus(); e.preventDefault(); e.stopPropagation(); }
        } else if (cmd === 'up') {
            var f2 = rowCardFocusables(card);
            if (onBtn && f2.poster) { f2.poster.focus(); e.preventDefault(); e.stopPropagation(); }
        }
    }

    function start() {
        // webOS/Tizen zetten niet altijd "layout-tv": dan zelf een klasse, zodat de tv-stijlen (focusrand, geen pijlen) gelden.
        try { if (rowIsTv() && document.documentElement) { document.documentElement.classList.add('discover-tv'); } } catch (e) { }
        applyRouteState();
        window.addEventListener('hashchange', applyRouteState);
        // Na een klik op Afspelen/Aanvragen op de aanvraagpagina de status even later opnieuw ophalen.
        document.addEventListener('click', function (e) {
            var id = itemIdFromHash();
            if (!id || !askIds[id]) { return; }
            var t = e.target && e.target.closest ? e.target.closest('.btnPlay, button') : null;
            if (!t) { return; }
            setTimeout(function () { delete lookups[id]; delete askStatus[id]; schedule(); }, 5000);
        }, true);
        document.addEventListener('viewshow', applyRouteState, true);
        document.addEventListener('command', onRowCommand, true);
        document.addEventListener('click', function () { if (!isIdleRoute()) { schedule(); } }, true);
        setInterval(function () { if (!isIdleRoute()) { schedule(); } }, 2000);
    }

    // ---- Label "Achtergrond: titel" bij Emby's eigen achtergronden (startpagina, Films, Series ...) ----
    // Emby laadt de achtergrond als <img class="backdropImage"> met /Items/{id}/Images/Backdrop in het adres;
    // daaruit halen we het item. Klik op het label = de Emby-pagina van dat item.
    (function () {
        var label = null, curId = null, seq = 0, names = {};
        function ensureLabel() {
            if (label) { return label; }
            label = document.createElement('button');
            label.type = 'button';
            label.className = 'dcEmbyBdLabel focusable';
            label.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                if (!curId) { return; }
                var sid = '';
                try { sid = window.ApiClient && ApiClient.serverId ? ApiClient.serverId() : ''; } catch (x) { }
                location.hash = '#!/item?id=' + encodeURIComponent(curId) + (sid ? '&serverId=' + encodeURIComponent(sid) : '');
            });
            var st = document.createElement('style');
            st.textContent = '.dcEmbyBdLabel{position:fixed;right:1.2em;bottom:1em;z-index:999;display:none;align-items:center;gap:.35em;max-width:min(36em,70vw);padding:.4em .9em;border-radius:2em;border:1px solid rgba(255,255,255,.18);background:rgba(11,20,38,.72);color:rgba(255,255,255,.85);font:inherit;font-size:.8em;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s,color .15s,transform .15s,box-shadow .15s}' +
                '.dcEmbyBdLabel.show{display:inline-flex}.dcEmbyBdLabel .k{opacity:.6}.dcEmbyBdLabel .go{color:var(--dc-accent,#ffb400);font-weight:800;font-size:1.2em;line-height:1}' +
                '.dcEmbyBdLabel:hover,.dcEmbyBdLabel:focus{background:rgba(11,20,38,.92);color:#fff;outline:0;transform:scale(1.05);box-shadow:0 0 0 2px var(--dc-accent,#ffb400)}' +
                '.dialogContainer ~ .dcEmbyBdLabel, body.dcModalOpen .dcEmbyBdLabel{display:none !important}';
            document.head.appendChild(st);
            document.body.appendChild(label);
            return label;
        }
        function hide() { if (label) { label.classList.remove('show'); } }
        function routeAllows() {
            var h = location.hash || '';
            // Niet op Discover (heeft een eigen label), niet op een itempagina (daar is de achtergrond van dat item zelf),
            // niet tijdens afspelen en niet in het dashboard.
            return !/configurationpage|\/item\?|\/details\?|videoosd|\/dashboard|\/plugins/i.test(h);
        }
        function currentBackdropId() {
            var img = document.querySelector('.backdropContainer img.backdropImage.displayingBackdropImage') ||
                document.querySelector('.backdropContainer img.backdropImage');
            if (!img) { return null; }
            var m = /\/Items\/([^\/?]+)\/Images\/Backdrop/i.exec(img.currentSrc || img.src || img.getAttribute('data-id') || '');
            return m ? m[1] : null;
        }
        function show(id, item) {
            if (id !== curId) { return; }
            var l = ensureLabel();
            var name = item.SeriesName && item.Type === 'Episode' ? item.SeriesName : item.Name;
            var year = item.ProductionYear ? ' (' + item.ProductionYear + ')' : '';
            l.innerHTML = '<span class="k"></span> <span class="t"></span> <span class="go">\u203A</span>';
            l.querySelector('.k').textContent = text('Achtergrond', 'Background', 'Hintergrund', 'Bakgrunn');
            l.querySelector('.t').textContent = name + year;
            l.title = text('Open deze titel', 'Open this title', 'Diesen Titel öffnen', 'Åpne denne tittelen');
            l.classList.add('show');
        }
        function update() {
            if (!routeAllows() || !document.querySelector('.backgroundContainer.withBackdrop, .backdropContainer.withBackdrop')) { curId = null; hide(); return; }
            var id = currentBackdropId();
            if (!id) { curId = null; hide(); return; }
            if (id === curId && label && label.classList.contains('show')) { return; }
            curId = id;
            if (names[id]) { show(id, names[id]); return; }
            if (!window.ApiClient) { return; }
            var my = ++seq;
            try {
                ApiClient.getItem(ApiClient.getCurrentUserId(), id).then(function (item) {
                    if (my !== seq || !item) { return; }
                    names[id] = { Name: item.Name, SeriesName: item.SeriesName, Type: item.Type, ProductionYear: item.ProductionYear };
                    show(id, names[id]);
                }, function () { });
            } catch (e) { }
        }
        function startBdLabel() {
            try {
                var pending = null;
                var mo = new MutationObserver(function () { if (pending) { return; } pending = setTimeout(function () { pending = null; update(); }, 150); });
                mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'src'] });
            } catch (e) { setInterval(update, 1500); }
            window.addEventListener('hashchange', function () { setTimeout(update, 300); });
            update();
        }
        if (document.body) { startBdLabel(); } else { document.addEventListener('DOMContentLoaded', startBdLabel); }
    })();

    if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start); }
})();
