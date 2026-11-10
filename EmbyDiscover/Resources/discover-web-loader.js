/* Discover Media - lader voor de Emby-webclient (server-kant).
 *
 * De plugin zet dit script in de index.html van de webclient op de server, zodat het op ELKE
 * pagina draait (de browser en apps die de webclient van de server laden). Het doet twee dingen:
 *   1. Een tik op de tegel/menu-ingang "Discover Media" (het kanaal) opent meteen de Discover-pagina.
 *   2. Het Aanvragen-knop-script wordt globaal geladen, zodat de knop ook op gewone Emby-detailpagina's
 *      werkt zonder dat je eerst Discover hoeft te openen.
 *
 * Geen app-specifieke trucs: werkt met de Navigation API (nieuwe engines) en met hashchange (oudere,
 * zoals webOS 6 / Chromium 79).
 */
(function () {
    'use strict';
    if (window.__discoverWebLoader) { return; }
    window.__discoverWebLoader = 1;

    var CHANNEL_NAME = 'Discover Media';
    var KNOWN_UI = ['discoverui1147', 'discoverui1146', 'discoverui1145', 'discoverui1144', 'discoverui1143', 'discoverui1142', 'discoverui1141', 'discoverui1140', 'discoverui1139', 'discoverui1138', 'discoverui1137', 'discoverui1136', 'discoverui1135', 'discoverui1134', 'discoverui1133', 'discoverui1132', 'discoverui1131', 'discoverui1130', 'discoverui1129', 'discoverui1128', 'discoverui1127', 'discoverui1126', 'discoverui1125', 'discoverui1124', 'discoverui1123', 'discoverui1122', 'discoverui1121', 'discoverui1120', 'discoverui1119', 'discoverui1118', 'discoverui1117', 'discoverui1116', 'discoverui1115', 'discoverui1114', 'discoverui1113', 'discoverui1109', 'discoverui1108', 'discoverui1107', 'discoverui1106', 'discoverui1105', 'discoverui1104', 'discoverui1103', 'discoverui1102', 'discoverui1101', 'discoverui1100', 'discoverui1099', 'discoverui1098', 'discoverui1097', 'discoverui1096', 'discoverui1095', 'discoverui1094', 'discoverui1093', 'discoverui1092', 'discoverui1091', 'discoverui1090', 'discoverui1089', 'discoverui1088', 'discoverui1087', 'discoverui1086', 'discoverui1085', 'discoverui1084', 'discoverui1083', 'discoverui1082', 'discoverui1081', 'discoverui1080', 'discoverui1079', 'discoverui1078', 'discoverui1077', 'discoverui1076', 'discoverui1075'];
    var KNOWN_BTN = ['discoverbuttonjs1431', 'discoverbuttonjs1430', 'discoverbuttonjs1429', 'discoverbuttonjs1428', 'discoverbuttonjs1427', 'discoverbuttonjs1426', 'discoverbuttonjs1425', 'discoverbuttonjs1424', 'discoverbuttonjs1423', 'discoverbuttonjs1422', 'discoverbuttonjs1421', 'discoverbuttonjs1420', 'discoverbuttonjs1419', 'discoverbuttonjs1418', 'discoverbuttonjs1417', 'discoverbuttonjs1416', 'discoverbuttonjs1415', 'discoverbuttonjs1414', 'discoverbuttonjs1413', 'discoverbuttonjs1412', 'discoverbuttonjs1411', 'discoverbuttonjs1410', 'discoverbuttonjs1409', 'discoverbuttonjs1408', 'discoverbuttonjs1407', 'discoverbuttonjs1406', 'discoverbuttonjs1405', 'discoverbuttonjs1404', 'discoverbuttonjs1403', 'discoverbuttonjs1402', 'discoverbuttonjs1401', 'discoverbuttonjs1400', 'discoverbuttonjs1399', 'discoverbuttonjs1398', 'discoverbuttonjs1397', 'discoverbuttonjs1396', 'discoverbuttonjs1395', 'discoverbuttonjs1394', 'discoverbuttonjs1393', 'discoverbuttonjs1392', 'discoverbuttonjs1391', 'discoverbuttonjs1390', 'discoverbuttonjs1389', 'discoverbuttonjs1388', 'discoverbuttonjs1387', 'discoverbuttonjs1386', 'discoverbuttonjs1385', 'discoverbuttonjs1384', 'discoverbuttonjs1383', 'discoverbuttonjs1382', 'discoverbuttonjs1381', 'discoverbuttonjs1380', 'discoverbuttonjs1379', 'discoverbuttonjs1378', 'discoverbuttonjs1377', 'discoverbuttonjs1376', 'discoverbuttonjs1375', 'discoverbuttonjs1374', 'discoverbuttonjs1373', 'discoverbuttonjs1372', 'discoverbuttonjs1371', 'discoverbuttonjs1370', 'discoverbuttonjs1360', 'discoverbuttonjs1354', 'discoverbuttonjs1353', 'discoverbuttonjs1352', 'discoverbuttonjs1351', 'discoverbuttonjs1350', 'discoverbuttonjs1340'];

    function log(m) { try { console.log('[Discover web] ' + m); } catch (e) { } }
    function api() {
        var a = window.ApiClient;
        if (!a || typeof a.getUrl !== 'function') { return null; }
        if (typeof a.accessToken === 'function' && !a.accessToken()) { return null; }
        return a;
    }

    var info = null, infoLoading = null;
    function serverKey(a) { try { return (a.serverId && a.serverId()) + '|' + (a.getCurrentUserId && a.getCurrentUserId()); } catch (e) { return ''; } }
    function items(r) { return (r && (r.Items || (r.length ? r : null))) || []; }
    function newest(names, re) {
        return names.filter(function (n) { return re.test(n); })
            .sort(function (x, y) { return parseInt(y.replace(/\D/g, ''), 10) - parseInt(x.replace(/\D/g, ''), 10); });
    }

    function loadInfo() {
        var a = api();
        if (!a) { return Promise.resolve(null); }
        var key = serverKey(a);
        if (info && info.key === key) { return Promise.resolve(info); }
        if (infoLoading && infoLoading.key === key) { return infoLoading.p; }
        var uid = a.getCurrentUserId();
        var safe = function (p) { return Promise.resolve(p).catch(function () { return null; }); };
        var p = Promise.all([
            safe(a.getJSON(a.getUrl('web/configurationpages', { PageType: 'PluginConfiguration', UserId: uid }))),
            safe(a.getJSON(a.getUrl('Channels', { UserId: uid }))),
            safe(a.getJSON(a.getUrl('Users/' + uid + '/Views'))),
            safe(a.getJSON(a.getUrl('Discover/ChannelInfo'))),
            // De server noemt zelf de actuele paginanamen (het knop-script staat niet in de lijst hierboven);
            // zo laadt ook een oude, ingebakken kopie van dit script in een eigen app altijd de nieuwste versie.
            safe(a.getJSON(a.getUrl('Discover/LoaderConfig', { _: Date.now() })))
        ]).then(function (r) {
            var names = [];
            items(r[0]).forEach(function (pg) { var n = pg && (pg.Name || pg.name); if (n && names.indexOf(n) === -1) { names.push(n); } });
            var ids = [];
            items(r[1]).concat(items(r[2])).forEach(function (it) {
                if (it && it.Name === CHANNEL_NAME && it.Id) {
                    var id = String(it.Id).toLowerCase();
                    if (ids.indexOf(id) === -1) { ids.push(id); }
                }
            });
            // Hernoemd kanaal (bv. "Aanvragen"): de server weet welk kanaal van Discover is.
            if (r[3] && r[3].Id) { var cid = String(r[3].Id).toLowerCase(); if (ids.indexOf(cid) === -1) { ids.push(cid); } }
            var ui = newest(names, /^discoverui\d+$/i);
            var btn = newest(names, /^discoverbuttonjs\d+$/i);
            if (r[4] && r[4].UiPage) { ui = [r[4].UiPage].concat(ui.filter(function (n) { return n !== r[4].UiPage; })); }
            if (r[4] && r[4].ButtonPage) { btn = [r[4].ButtonPage].concat(btn.filter(function (n) { return n !== r[4].ButtonPage; })); }
            KNOWN_UI.forEach(function (n) { if (ui.indexOf(n) === -1) { ui.push(n); } });
            KNOWN_BTN.forEach(function (n) { if (btn.indexOf(n) === -1) { btn.push(n); } });
            info = { key: key, ids: ids, uiPage: ui[0], buttonPages: btn };
            log('kanaal-id\'s ' + (ids.join(',') || 'niet gevonden') + ', pagina ' + info.uiPage);
            return info;
        }, function () { infoLoading = null; return null; });
        infoLoading = { key: key, p: p };
        return p;
    }

    // ---- Aanvragen-knop globaal laden ----
    var buttonTried = false;
    function buttonActive() { return !!window.__discoverRequestButtonVersion; }
    function loadButton(a, names, i) {
        if (buttonActive() || !names) { return; }
        if (i >= names.length) { return; }
        var s = document.createElement('script');
        s.src = a.getUrl('web/ConfigurationPage', { name: names[i] }) + '&_=' + Date.now();
        s.async = true;
        s.onload = function () { if (buttonActive()) { log('knop actief: ' + names[i]); } else { loadButton(a, names, i + 1); } };
        s.onerror = function () { if (s.parentNode) { s.parentNode.removeChild(s); } loadButton(a, names, i + 1); };
        document.head.appendChild(s);
    }

    // ---- tegel/kanaal -> Discover ----
    function routeOf(url) { if (!url) { return ''; } var i = url.indexOf('#!'); return i !== -1 ? url.substr(i + 2).toLowerCase() : ''; }
    function targetsChannel(route) {
        if (!info || !info.ids.length || !route) { return false; }
        for (var k = 0; k < info.ids.length; k++) {
            var id = info.ids[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (/^\/(list|videos)\b/.test(route) && new RegExp('[?&]parentid=' + id + '(&|$)').test(route)) { return true; }
            if (/^\/(item|channel)\b/.test(route) && new RegExp('[?&]id=' + id + '(&|$)').test(route)) { return true; }
        }
        return false;
    }
    // window.__discoverStay: set by the Discover page's channel button so the channel root opens normally
    // (also when coming back from a folder). Cleared as soon as the user leaves channel routes.
    function inChannelRoutes(route) { return /^\/(list|videos|item|channel)\b/.test(route); }
    function stayActive() {
        if (window.__discoverStay && !inChannelRoutes(routeOf(location.href))) { window.__discoverStay = false; }
        return !!window.__discoverStay;
    }

    // Setting "Tile opens the Discover page", read from the server (never cached): null = not known yet.
    var redirectOn = null, redirectAt = 0, redirectLoading = null;
    function refreshConfig(force) {
        // Eigen app (bijv. de LG-app) kan vastleggen dat de tegel daar altijd Discover opent, los van de
        // instelling (die is bedoeld voor de browser): window.__discoverAlwaysTile = true vóór dit script.
        if (window.__discoverAlwaysTile === true) {
            if (redirectOn !== true) { log('app: tegel opent altijd Discover'); }
            redirectOn = true; redirectAt = Date.now();
            return Promise.resolve(true);
        }
        var a = api();
        if (!a) { return Promise.resolve(redirectOn); }
        if (redirectLoading) { return redirectLoading; }
        if (!force && Date.now() - redirectAt < 3000) { return Promise.resolve(redirectOn); }
        redirectLoading = Promise.resolve(a.getJSON(a.getUrl('Discover/LoaderConfig', { _: Date.now() }))).then(function (r) {
            var v = !!(r && r.RedirectTile);
            if (v !== redirectOn) { log('config RedirectTile = ' + v + ' (was ' + redirectOn + ')'); }
            redirectOn = v; redirectAt = Date.now(); redirectLoading = null;
            return v;
        }, function (err) {
            log('config ophalen mislukt (' + ((err && (err.status || err.message)) || err) + '): geen redirect');
            redirectLoading = null; redirectOn = false; redirectAt = Date.now();
            return false;
        });
        return redirectLoading;
    }
    window.__discoverDebug = function () { return { backdrop: { allowed: (typeof bdAllowed === 'function') ? bdAllowed() : null, on: bd && bd.on, urls: bd && bd.urls ? bd.urls.length : 0 }, redirectOn: redirectOn, configAgeMs: Date.now() - redirectAt, stay: !!window.__discoverStay, route: routeOf(location.href), channelIds: info && info.ids }; };

    // Decision: redirect only for a fresh open of the channel root (tile / menu), never when the setting is off,
    // when the user asked for the channel tiles, or when coming back (Back) from inside the channel.
    var prevRoute = '', initialChecked = false;
    function shouldRedirect(route, navType, fromRoute, ignoreCfg) {
        var why = null;
        if (!ignoreCfg && redirectOn !== true) { why = 'schakelaar uit'; }
        else if (!targetsChannel(route)) { why = 'geen kanaalroute'; }
        else if (window.__discoverAlwaysTile === true) { why = null; }   // eigen app: altijd Discover, nooit de tegels
        else if (window.__discoverStay) { why = 'Kanaaltegels-knop actief'; }
        else if (navType === 'traverse' && inChannelRoutes(fromRoute || '')) { why = 'terug vanuit kanaal'; }
        if (why && targetsChannel(route)) { log('beslissing: NIET doorsturen (' + why + '), config=' + redirectOn); }
        else if (!why) { log('beslissing: doorsturen, config=' + redirectOn); }
        return !why;
    }
    function discoverHash() { return '#!/configurationpage?name=' + encodeURIComponent((info && info.uiPage) || KNOWN_UI[0]); }
    function redirect() {
        var url = location.href.split('#')[0] + discoverHash();
        if (window.navigation && typeof navigation.navigate === 'function') { navigation.navigate(url, { history: 'replace' }); }
        else { location.replace(url); }
    }

    if (window.navigation && typeof navigation.addEventListener === 'function') {
        navigation.addEventListener('navigate', function (e) {
            try {
                var route = routeOf(e.destination && e.destination.url);
                var from = prevRoute;
                prevRoute = route;
                if (!inChannelRoutes(route)) { window.__discoverStay = false; }
                if (!targetsChannel(route)) { refreshConfig(false); return; }
                // Channel open: always use a fresh value of the setting (never the one cached in memory).
                refreshConfig(true).then(function (on) {
                    if (on !== true || routeOf(location.href) !== route) { log('config=' + on + ' -> kanaaltegels blijven'); return; }
                    if (shouldRedirect(route, e.navigationType, from, true)) { redirect(); }
                });
            } catch (err) { }
        });
    }
    // Without the Navigation API (older engines) hashchange is the only signal; it also cannot tell Back apart,
    // so we only redirect when the previous route was outside the channel.
    // Emby wisselt van pagina met history.pushState; dat geeft geen hashchange. Zonder Navigation API
    // (bv. LG webOS 6 / Chrome 79, Firefox) kijkt de timer onderaan daarom elke seconde of de route veranderde.
    var hasNavApi = !!(window.navigation && typeof navigation.addEventListener === 'function');
    window.addEventListener('hashchange', function () { if (!hasNavApi) { onRouteChange(); } });
    function onRouteChange() {
        var route = routeOf(location.href);
        if (route === prevRoute) { return; }
        var from = prevRoute;
        prevRoute = route;
        if (!inChannelRoutes(route)) { window.__discoverStay = false; }
        Promise.all([refreshConfig(true), loadInfo()]).then(function (r) {
            if (r[0] === true && routeOf(location.href) === route && shouldRedirect(route, 'traverse', from, true)) { redirect(); }
        });
    }

    // ---- Achtergrond bij de tegel "Discover Media" (zoals Emby dat bij andere bibliotheken doet) ----
    // Alleen als de gebruiker in Emby "Achtergronden inschakelen" aan heeft. De foto komt in Emby's eigen
    // achtergrondlaag (.backdropContainer), zodat Emby's verduistering er gewoon overheen valt.
    var bd = { urls: null, loading: null, on: false, timer: null, layer: null, addedClass: false, seenEmby: false, pref: null, prefAsked: false, last: '', seq: 0, page: null, items: {} };
    function bdPrefFromStorage() {
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && /enablebackdrops/i.test(k)) {
                    var v = String(localStorage.getItem(k));
                    if (v === 'true') { return true; }
                    if (v === 'false') { return false; }
                }
            }
        } catch (e) { }
        return null;
    }
    function bdAskServerPref() {
        var a = api();
        if (!a || bd.prefAsked) { return; }
        bd.prefAsked = true;
        try {
            Promise.resolve(a.getJSON(a.getUrl('DisplayPreferences/usersettings', { userId: a.getCurrentUserId(), client: 'emby' }))).then(function (p) {
                var v = p && p.CustomPrefs ? p.CustomPrefs.enableBackdrops : undefined;
                if (v === 'true' || v === true) { bd.pref = true; } else if (v === 'false' || v === false) { bd.pref = false; }
            }, function () { });
        } catch (e) { }
    }
    function bdAllowed() {
        var s = bdPrefFromStorage();
        if (s !== null) { return s; }
        if (bd.pref !== null) { return bd.pref; }
        return bd.seenEmby;   // onbekend: alleen als Emby zelf al achtergronden laat zien
    }
    function bdLoadUrls() {
        if (bd.urls) { return Promise.resolve(bd.urls); }
        if (bd.loading) { return bd.loading; }
        var a = api();
        if (!a) { return Promise.resolve([]); }
        bd.loading = Promise.resolve(a.getJSON(a.getUrl('Discover/Backdrops'))).then(function (r) {
            bd.urls = (r && r.Urls) || [];
            bd.loading = null;
            return bd.urls;
        }, function () { bd.loading = null; return []; });
        return bd.loading;
    }
    function bdStyle() {
        if (document.getElementById('dcHomeBackdropStyle')) { return; }
        var st = document.createElement('style');
        st.id = 'dcHomeBackdropStyle';
        st.textContent = '.dcHomeBackdrop{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center center;background-repeat:no-repeat;opacity:0;transition:opacity .6s ease;pointer-events:none;}.dcHomeBackdrop.on{opacity:1;}';
        document.head.appendChild(st);
    }
    var bdObserved = null;
    function bdWatch(container) {
        if (!container || bdObserved === container || typeof MutationObserver !== 'function') { return; }
        bdObserved = container;
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                for (var j = 0; j < muts[i].addedNodes.length; j++) {
                    var n = muts[i].addedNodes[j];
                    if (n !== bd.layer && n.nodeType === 1) { bd.seenEmby = true; }
                }
            }
            // Op een kanaalpagina met een eigen achtergrond van Emby: Emby laten winnen. Anders vechten Emby en wij
            // om de laag en de klasse withBackdrop, en knippert de balk bovenin af en toe.
            if (bd.page && embyHasImage(container)) {
                if (bd.layer && bd.layer.parentNode === container) { container.removeChild(bd.layer); }
                bd.yielded = true;
                return;
            }
            if (bd.yielded && bd.page) { return; }   // deze pagina is van Emby: niet terugzetten
            // Emby ruimt zijn achtergrond op bij een tegel zonder eigen foto: dan zetten we de onze terug.
            if (bd.on && bd.layer && bd.layer.parentNode !== container) { container.appendChild(bd.layer); }
        }).observe(container, { childList: true });
        var bg = document.querySelector('.backgroundContainer');
        if (bg) {
            new MutationObserver(function () {
                if (bd.on && bd.layer && bd.layer.parentNode && !bg.classList.contains('withBackdrop')) { bg.classList.add('withBackdrop'); bd.addedClass = true; }
            }).observe(bg, { attributes: true, attributeFilter: ['class'] });
        }
    }
    // Toont Emby zelf een echte achtergrondfoto? (Een leeg of uitfadend element telt niet: dat liet de onze ten onrechte weg.)
    function embyHasImage(container) {
        for (var k = 0; k < container.children.length; k++) {
            var ch = container.children[k];
            if (ch === bd.layer) { continue; }
            var bg = (ch.style && ch.style.backgroundImage) || '';
            if (!bg || bg === 'none') { try { bg = getComputedStyle(ch).backgroundImage || ''; } catch (e) { bg = ''; } }
            var hasImg = (bg && bg !== 'none' && bg.indexOf('url(') !== -1) || !!(ch.querySelector && ch.querySelector('img[src]'));
            if (!hasImg) { continue; }
            var op = 1;
            try { op = parseFloat(getComputedStyle(ch).opacity); } catch (e) { }
            if (isNaN(op) || op > 0.05) { return true; }
        }
        return false;
    }
    function bdShow(fixedUrl) {
        var container = document.querySelector('.backdropContainer');
        if (!container) { return; }
        bdWatch(container);
        if (!bdAllowed()) { return; }
        // Kanaalpagina waar Emby al een eigen achtergrond toont: niets doen.
        if (bd.page) {
            if (embyHasImage(container)) { return; }
        }
        bd.on = true;
        var token = ++bd.seq;
        (fixedUrl ? Promise.resolve([fixedUrl]) : bdLoadUrls()).then(function (urls) {
            if (!bd.on || token !== bd.seq || !urls.length) { return; }
            var pick = urls[Math.floor(Math.random() * urls.length)];
            if (urls.length > 1 && pick === bd.last) { pick = urls[(urls.indexOf(pick) + 1) % urls.length]; }
            if (fixedUrl && pick === bd.last && bd.layer && bd.layer.parentNode && bd.layer.classList.contains('on')) { return; }
            bd.last = pick;
            var img = new Image();
            img.onload = function () {
                if (!bd.on || token !== bd.seq) { return; }
                bdStyle();
                if (!bd.layer) { bd.layer = document.createElement('div'); bd.layer.className = 'dcHomeBackdrop'; }
                bd.layer.classList.remove('on');
                bd.layer.style.backgroundImage = 'url("' + pick + '")';
                if (bd.layer.parentNode !== container) { container.appendChild(bd.layer); }
                var bg = document.querySelector('.backgroundContainer');
                if (bg && !bg.classList.contains('withBackdrop')) { bg.classList.add('withBackdrop'); bd.addedClass = true; }
                requestAnimationFrame(function () { if (bd.on && bd.layer) { bd.layer.classList.add('on'); } });
            };
            img.src = pick;
        });
    }
    function bdHide() {
        clearTimeout(bd.timer);
        if (!bd.on) { return; }
        bd.on = false;
        bd.seq++;
        var layer = bd.layer;
        if (layer) { layer.classList.remove('on'); }
        setTimeout(function () {
            if (bd.on) { return; }
            if (layer && layer.parentNode) { layer.parentNode.removeChild(layer); }
            if (bd.addedClass) {
                var container = document.querySelector('.backdropContainer');
                var bg = document.querySelector('.backgroundContainer');
                if (bg && (!container || !container.children.length)) { bg.classList.remove('withBackdrop'); }
                bd.addedClass = false;
            }
        }, 650);
    }
    function bdCardId(el) {
        var card = el && el.closest ? el.closest('.card, [data-id]') : null;
        if (!card) { return null; }
        var id = card.getAttribute('data-id');
        if (!id) {
            var link = card.querySelector('a[href*="id="]') || (card.tagName === 'A' ? card : null);
            var m = link && /[?&](?:parent)?id=([0-9a-z]+)/i.exec(link.getAttribute('href') || '');
            id = m ? m[1] : '';
        }
        return String(id || '').toLowerCase();
    }
    // Achtergrond bij een Emby-item-id uit het kanaal: { InChannel, Url } (bewaard per id).
    function bdItem(id) {
        var a = api();
        if (!a || !id) { return Promise.resolve(null); }
        if (bd.items[id]) { return bd.items[id]; }
        var p = Promise.resolve(a.getJSON(a.getUrl('Discover/ItemBackdrop', { Id: id }))).then(function (r) { return r || null; }, function () { delete bd.items[id]; return null; });
        bd.items[id] = p;
        return p;
    }
    function bdOnPointer(e) {
        var id = bdCardId(e.target);
        if (id === null) { return; }             // geen kaart: niets veranderen
        if (bd.page) {
            // In het kanaal: de achtergrond volgt de titel onder de muis (zoals in een Emby-bibliotheek).
            if (id === bd.hoverId) { return; }
            bd.hoverId = id;
            var page = bd.page;
            clearTimeout(bd.timer);
            bd.timer = setTimeout(function () {
                bdItem(id).then(function (r) {
                    if (bd.page !== page || bd.hoverId !== id) { return; }
                    if (r && r.InChannel && r.Url) { bdShow(r.Url); }
                });
            }, 150);
            return;
        }
        if (info && info.ids.indexOf(id) !== -1) {
            if (bd.on) { return; }                // al zichtbaar: niet bij elk kind-element een nieuwe foto
            bdAskServerPref();
            clearTimeout(bd.timer);
            bd.timer = setTimeout(bdShow, 120);
        } else {
            bdHide();                             // een andere tegel: Emby toont zijn eigen achtergrond
        }
    }
    // Pagina's in het kanaal (hoofdmap, rijen, titelmap, aanvraagmap, seizoen, trailer) krijgen een achtergrond:
    // de titel zelf als die er is, anders een willekeurige uit wat trending is.
    function bdRouteId(route) {
        var m = /^\/(?:list|videos|tv|movies)\b.*[?&]parentid=([^&]+)/.exec(route) || /^\/(?:item|details|channel)\b.*[?&]id=([^&]+)/.exec(route);
        return m ? decodeURIComponent(m[1]).toLowerCase() : null;
    }
    function bdCheckPage() {
        var route = routeOf(location.href);
        var id = bdRouteId(route);
        if (bd.page && bd.page.route === route) { return; }
        if (!id) {
            if (bd.page) { bd.page = null; bd.hoverId = null; bdHide(); }
            return;
        }
        var page = { route: route };
        bd.page = page;
        bd.hoverId = null;
        if (info && info.ids.indexOf(id) !== -1) { bdAskServerPref(); setTimeout(function () { if (bd.page === page) { bdShow(); } }, 250); return; }
        bdItem(id).then(function (r) {
            if (bd.page !== page) { return; }
            if (!r || !r.InChannel) { bd.page = null; bdHide(); return; }
            bdAskServerPref();
            setTimeout(function () { if (bd.page === page) { bdShow(r.Url || null); } }, 250);
        });
    }
    function bdOnNavigate() {
        bd.yielded = false;
        bdHide();
        bd.page = null;
        bd.hoverId = null;
        setTimeout(bdCheckPage, 0);
    }
    document.addEventListener('mouseover', bdOnPointer, true);
    document.addEventListener('focusin', bdOnPointer, true);
    if (window.navigation && typeof navigation.addEventListener === 'function') { navigation.addEventListener('navigatesuccess', bdOnNavigate); }
    else { window.addEventListener('hashchange', bdOnNavigate); }

    log('lader actief (v' + 3 + '); controleer in de console met: __discoverDebug()');
    setInterval(function () {
        var a = api();
        if (!a) { return; }
        refreshConfig(false);
        if (!hasNavApi && initialChecked) { onRouteChange(); }
        loadInfo().then(function (i) {
            if (!initialChecked && i && redirectOn !== null) {
                initialChecked = true;
                var r0 = routeOf(location.href);
                if (!prevRoute) { prevRoute = r0; }
                if (shouldRedirect(r0, 'push', '')) { log('kanaal staat open, doorsturen'); redirect(); }
            }
            if (!buttonActive() && !buttonTried) { buttonTried = true; loadButton(a, (i && i.buttonPages) || KNOWN_BTN, 0); }
            if (i && !bd.pageChecked) { bd.pageChecked = true; bdCheckPage(); }
        });
    }, 1000);
})();