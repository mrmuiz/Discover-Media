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
    var KNOWN_UI = ['discoverui1078', 'discoverui1077', 'discoverui1076', 'discoverui1075'];
    var KNOWN_BTN = ['discoverbuttonjs1371', 'discoverbuttonjs1370', 'discoverbuttonjs1360', 'discoverbuttonjs1354', 'discoverbuttonjs1353', 'discoverbuttonjs1352', 'discoverbuttonjs1351', 'discoverbuttonjs1350', 'discoverbuttonjs1340'];

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
            safe(a.getJSON(a.getUrl('Users/' + uid + '/Views')))
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
            var ui = newest(names, /^discoverui\d+$/i);
            var btn = newest(names, /^discoverbuttonjs\d+$/i);
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
    window.__discoverDebug = function () { return { redirectOn: redirectOn, configAgeMs: Date.now() - redirectAt, stay: !!window.__discoverStay, route: routeOf(location.href), channelIds: info && info.ids }; };

    // Decision: redirect only for a fresh open of the channel root (tile / menu), never when the setting is off,
    // when the user asked for the channel tiles, or when coming back (Back) from inside the channel.
    var prevRoute = '', initialChecked = false;
    function shouldRedirect(route, navType, fromRoute, ignoreCfg) {
        var why = null;
        if (!ignoreCfg && redirectOn !== true) { why = 'schakelaar uit'; }
        else if (!targetsChannel(route)) { why = 'geen kanaalroute'; }
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
    window.addEventListener('hashchange', function () {
        if (window.navigation && typeof navigation.addEventListener === 'function') { return; }
        var route = routeOf(location.href);
        var from = prevRoute;
        prevRoute = route;
        if (!inChannelRoutes(route)) { window.__discoverStay = false; }
        Promise.all([refreshConfig(true), loadInfo()]).then(function (r) {
            if (r[0] === true && routeOf(location.href) === route && shouldRedirect(route, 'traverse', from, true)) { redirect(); }
        });
    });

    log('lader actief (v' + 3 + '); controleer in de console met: __discoverDebug()');
    setInterval(function () {
        var a = api();
        if (!a) { return; }
        refreshConfig(false);
        loadInfo().then(function (i) {
            if (!initialChecked && i && redirectOn !== null) {
                initialChecked = true;
                var r0 = routeOf(location.href);
                if (!prevRoute) { prevRoute = r0; }
                if (shouldRedirect(r0, 'push', '')) { log('kanaal staat open, doorsturen'); redirect(); }
            }
            if (!buttonActive() && !buttonTried) { buttonTried = true; loadButton(a, (i && i.buttonPages) || KNOWN_BTN, 0); }
        });
    }, 1000);
})();