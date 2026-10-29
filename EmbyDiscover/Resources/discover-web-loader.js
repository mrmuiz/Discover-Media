/* Discover Media - lader voor de Emby-webclient (server-kant).
 *
 * De plugin zet dit script in de index.html van de webclient op de server, zodat het op ELKE
 * pagina draait (browser en eigen schil-apps zoals de LG-app). Het doet twee dingen:
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
    var KNOWN_UI = ['discoverui1076', 'discoverui1075'];
    var KNOWN_BTN = ['discoverbuttonjs1354', 'discoverbuttonjs1353', 'discoverbuttonjs1352', 'discoverbuttonjs1351', 'discoverbuttonjs1350', 'discoverbuttonjs1340'];

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
                if (!targetsChannel(route)) { return; }
                log('kanaal geopend, doorsturen naar Discover');
                if (!e.cancelable) { setTimeout(redirect, 0); return; }
                e.preventDefault();
                if (e.stopImmediatePropagation) { e.stopImmediatePropagation(); }
                setTimeout(redirect, 0);
            } catch (err) { }
        });
    }
    window.addEventListener('hashchange', function () {
        var route = routeOf(location.href);
        loadInfo().then(function () { if (routeOf(location.href) === route && targetsChannel(route)) { redirect(); } });
    });

    setInterval(function () {
        var a = api();
        if (!a) { return; }
        loadInfo().then(function (i) {
            if (i && targetsChannel(routeOf(location.href))) { log('kanaal staat open, doorsturen'); redirect(); }
            if (!buttonActive() && !buttonTried) { buttonTried = true; loadButton(a, (i && i.buttonPages) || KNOWN_BTN, 0); }
        });
    }, 1000);
})();
