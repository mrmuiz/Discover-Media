/* Emby Discover - minimale NativeShell voor tv-schillen (webOS/Tizen), zodat Emby's webclient in
 * "app-modus" draait: het afsluitmenu ("Ben je klaar om Emby af te sluiten?") en Server/Gebruiker
 * wisselen, net als de officiele app. Zo gedraagt een losse wrapper-app zich 1-op-1 als Emby.
 *
 * Belangrijk voor de veiligheid:
 *  - Alleen actief op een tv-schil die de webclient van de server laadt (webOS/Tizen, http(s)).
 *    Browsers, de ingepakte officiele app (file://) en andere clients raken we niet aan.
 *  - We claimen alleen schil-/menufuncties, en laten het AFSPELEN aan de browser: geen eigen
 *    device-profile, en 'nativevideoplayer' blijft uit. Zo blijft playback zoals het was (HTML5).
 *  - Alles defensief: faalt dit, dan blijft Emby gewoon in browsermodus werken.
 *
 * Dit script hoort VROEG in <head> te staan (voor Emby's eigen scripts), want Emby kiest de app- of
 * browsermodus op basis van window.NativeShell zodra het initialiseert.
 */
(function () {
    'use strict';
    try {
        if (window.NativeShell) { return; }                      // officiele app levert er al een
        var ua = navigator.userAgent || '';
        if (!/Web0S|webOS|Tizen/i.test(ua)) { return; }          // alleen tv-schillen
        if (location.protocol === 'file:') { return; }           // ingepakte app regelt dit zelf

        function deviceId() {
            try {
                var k = 'discover_ns_devid', v = localStorage.getItem(k);
                if (!v) { v = 'webos-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem(k, v); }
                return v;
            } catch (e) { return 'webos-discover'; }
        }

        // Alleen deze functies "ondersteunen" we; verder spiegelen we wat een browser normaal kan,
        // zodat afspelen/autoplay/ondertitels enz. blijven werken. Afspeel-native functies laten we UIT.
        var YES = {
            // schil / menu
            exit: 1, exitmenu: 1, multiserver: 1,
            // dingen die een gewone browser ook kan (zodat we die niet per ongeluk uitzetten)
            htmlaudioautoplay: 1, htmlvideoautoplay: 1, externallinks: 1, filedownload: 1,
            fileinput: 1, displaylanguage: 1, subtitleappearancesettings: 1, remotecontrol: 1,
            fullscreenchange: 1, screensaver: 1, targetblank: 1
        };

        var AppHost = {
            init: function () { try { return Promise.resolve(); } catch (e) { return null; } },
            appName: function () { return 'Emby Discover'; },
            appVersion: function () { return '1.0.1'; },
            deviceName: function () { return 'LG webOS'; },
            deviceId: deviceId,
            getDefaultLayout: function () { return 'tv'; },
            supports: function (cmd) { return !!YES[String(cmd || '').toLowerCase()]; },
            // Bewust GEEN getDeviceProfile/getSyncProfile: dan valt Emby terug op het browser-profiel
            // en blijft het afspelen identiek aan de huidige (werkende) situatie.
            exit: function () {
                try { if (window.webOS && window.webOS.platformBack) { window.webOS.platformBack(); return; } } catch (e) { }
                try { if (window.webOSSystem && window.webOSSystem.platformBack) { window.webOSSystem.platformBack(); return; } } catch (e) { }
                try { window.close(); } catch (e) { }
            }
        };

        window.NativeShell = {
            AppHost: AppHost,
            getPlugins: function () { return []; },              // geen native plugins
            openUrl: function (url, target) { try { window.open(url, target || '_blank'); } catch (e) { } },
            enableFullscreen: function () { },
            disableFullscreen: function () { },
            getExternalDataPath: function () { return ''; }
        };
        try { console.log('[Discover] NativeShell (webOS app-modus) actief'); } catch (e) { }
    } catch (e) {
        try { console.log('[Discover] NativeShell init mislukt; Emby blijft in browsermodus', e); } catch (x) { }
    }
})();
