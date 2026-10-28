define(['emby-button'], function () {
    'use strict';

    var pluginId = '7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90';
    var language = 'nl';

    function text(dutch, english, german) {
        return language === 'de' ? (german || english) : language === 'en' ? english : dutch;
    }

    // Vertaling van de activiteitenregels (de server schrijft ze in het Nederlands). Elke regel: [patroon, Engels, Duits].
    // De tijd ("HH:mm:ss  ") blijft staan; foutmeldingen van Emby/TMDB/Radarr/Sonarr zelf blijven zoals ze zijn.
    var EVENT_MAP = [
        [/^opgevraagd: map=(.*) start=(.*) limit=(.*) key=(.*) taal=(.*)$/, 'requested: map=$1 start=$2 limit=$3 key=$4 language=$5', 'abgerufen: map=$1 start=$2 limit=$3 key=$4 Sprache=$5'],
        [/^teruggegeven: map=(.*) items=(.*) totaal=(.*)$/, 'returned: map=$1 items=$2 total=$3', 'zurückgegeben: map=$1 items=$2 gesamt=$3'],
        [/^onbekende map, leeg teruggegeven: /, 'unknown folder, returned empty: ', 'unbekannter Ordner, leer zurückgegeben: '],
        [/^FOUT: geen TMDB-key ingesteld/, 'ERROR: no TMDB key set', 'FEHLER: kein TMDB-Schlüssel eingestellt'],
        [/^FOUT bij map /, 'ERROR in folder ', 'FEHLER im Ordner '],
        [/^titel voor aanvraag-item (.*) mislukt: /, 'title for request item $1 failed: ', 'Titel für Anfrage-Element $1 fehlgeschlagen: '],
        [/^seizoensstatus uit Sonarr ophalen mislukt voor /, 'fetching season status from Sonarr failed for ', 'Staffelstatus von Sonarr abrufen fehlgeschlagen für '],
        [/^seizoensbeschrijving ophalen mislukt voor (.*)\/seizoen (.*): /, 'fetching season description failed for $1/season $2: ', 'Staffelbeschreibung abrufen fehlgeschlagen für $1/Staffel $2: '],
        [/^geen seizoensposter bij TMDB voor (.*)\/seizoen (.*) \(serieposter gebruikt\)/, 'no season poster at TMDB for $1/season $2 (series poster used)', 'kein Staffelposter bei TMDB für $1/Staffel $2 (Serienposter verwendet)'],
        [/^seizoensposter ophalen mislukt voor (.*)\/seizoen (.*): /, 'fetching season poster failed for $1/season $2: ', 'Staffelposter abrufen fehlgeschlagen für $1/Staffel $2: '],
        [/^extra info (.*) mislukt: /, 'extra info $1 failed: ', 'Zusatzinfo $1 fehlgeschlagen: '],
        [/^kaart vooraf maken mislukt: /, 'preparing card failed: ', 'Karte vorab erstellen fehlgeschlagen: '],
        [/^achtergrondlijst ophalen mislukt: /, 'fetching backdrop list failed: ', 'Hintergrundliste abrufen fehlgeschlagen: '],
        [/^root-artwork na 5 seconden uitgesteld; kanaal wordt direct teruggegeven/, 'root artwork postponed after 5 seconds; channel returned immediately', 'Root-Artwork nach 5 Sekunden zurückgestellt; Kanal wird sofort zurückgegeben'],
        [/^tegelafbeelding aanvraag\/trailer mislukt: /, 'request/trailer tile image failed: ', 'Kachelbild Anfrage/Trailer fehlgeschlagen: '],
        [/^tegelafbeelding '(.*)' mislukt: /, "tile image '$1' failed: ", "Kachelbild '$1' fehlgeschlagen: "],
        [/^achtergronden (.*) mislukt: /, 'backdrops $1 failed: ', 'Hintergründe $1 fehlgeschlagen: '],
        [/^genre-achtergrond (.*) mislukt: /, 'genre backdrop $1 failed: ', 'Genre-Hintergrund $1 fehlgeschlagen: '],
        [/^genretegel '(.*)' mislukt: /, "genre tile '$1' failed: ", "Genre-Kachel '$1' fehlgeschlagen: "],
        [/^trailer afspelen: /, 'playing trailer: ', 'Trailer wird abgespielt: '],
        [/^seizoensaanvraagclip voor seizoen (.*)$/, 'season request clip for season $1', 'Staffel-Anfrageclip für Staffel $1'],
        [/^aanvraagclip voor alle seizoenen/, 'request clip for all seasons', 'Anfrageclip für alle Staffeln'],
        [/^seizoensposter voor kaart (.*)\/seizoen (.*): /, 'season poster for card $1/season $2: ', 'Staffelposter für Karte $1/Staffel $2: '],
        [/^kaartclip: /, 'card clip: ', 'Kartenclip: '],
        [/^kaartclip (.*): (.*) \(vaste clip gebruikt\)$/, 'card clip $1: $2 (fixed clip used)', 'Kartenclip $1: $2 (feste Clip verwendet)'],
        [/^FOUT trailer /, 'ERROR trailer ', 'FEHLER Trailer '],
        [/^geen YouTube-trailer voor /, 'no YouTube trailer for ', 'kein YouTube-Trailer für '],
        [/^FOUT clip: /, 'ERROR clip: ', 'FEHLER Clip: '],
        [/^FOUT TMDB-talenlijst: /, 'ERROR TMDB language list: ', 'FEHLER TMDB-Sprachliste: '],
        [/^TMDB-talenlijst geladen: (.*) talen/, 'TMDB language list loaded: $1 languages', 'TMDB-Sprachliste geladen: $1 Sprachen'],
        [/^plaatje op de achtergrond vernieuwen mislukt: /, 'refreshing image in the background failed: ', 'Bild im Hintergrund aktualisieren fehlgeschlagen: '],
        [/^mapplaatje '(.*)': ffmpeg niet gevonden \(plaatje zonder tekst gebruikt\)/, "folder image '$1': ffmpeg not found (image without text used)", "Ordnerbild '$1': ffmpeg nicht gefunden (Bild ohne Text verwendet)"],
        [/^mapplaatje '(.*)': effen achtergrond gebruikt/, "folder image '$1': plain background used", "Ordnerbild '$1': einfarbiger Hintergrund verwendet"],
        [/^mapplaatje '(.*)': achtergrond niet opgehaald \(plaatje zonder tekst gebruikt\)/, "folder image '$1': background not fetched (image without text used)", "Ordnerbild '$1': Hintergrund nicht abgerufen (Bild ohne Text verwendet)"],
        [/^mapplaatje '(.*)': opmaak (\d+) mislukt: /, "folder image '$1': layout $2 failed: ", "Ordnerbild '$1': Layout $2 fehlgeschlagen: "],
        [/^mapplaatje '(.*)' gemaakt: /, "folder image '$1' created: ", "Ordnerbild '$1' erstellt: "],
        [/^mapplaatje '(.*)' mislukt: (.*) \(plaatje zonder tekst gebruikt\)$/, "folder image '$1' failed: $2 (image without text used)", "Ordnerbild '$1' fehlgeschlagen: $2 (Bild ohne Text verwendet)"],
        [/^logotegel '(.*)' mislukt: (.*) \(logo zonder opmaak gebruikt\)$/, "logo tile '$1' failed: $2 (logo without layout used)", "Logo-Kachel '$1' fehlgeschlagen: $2 (Logo ohne Layout verwendet)"],
        [/^achtergrond voor mapplaatje niet opgehaald: /, 'background for folder image not fetched: ', 'Hintergrund für Ordnerbild nicht abgerufen: '],
        [/^afbeelding voor kaartclip niet opgehaald: /, 'image for card clip not fetched: ', 'Bild für Kartenclip nicht abgerufen: '],
        [/^FOUT opgeslagen plugininstellingen laden: /, 'ERROR loading saved plugin settings: ', 'FEHLER beim Laden der gespeicherten Plugin-Einstellungen: '],
        [/^map '(.*)' niet beschrijfbaar: /, "folder '$1' not writable: ", "Ordner '$1' nicht beschreibbar: "],
        [/^clip schrijven mislukt in '(.*)': /, "writing clip failed in '$1': ", "Clip schreiben fehlgeschlagen in '$1': "],
        [/^aanvraag bij afspelen: onbekend seizoen-id /, 'request on play: unknown season id ', 'Anfrage beim Abspielen: unbekannte Staffel-ID '],
        [/^aanvraag bij afspelen: onbekend id /, 'request on play: unknown id ', 'Anfrage beim Abspielen: unbekannte ID '],
        [/^aanvraag via Afspelen: /, 'request via Play: ', 'Anfrage über Abspielen: '],
        [/^FOUT aanvraag \(Afspelen\) /, 'ERROR request (Play) ', 'FEHLER Anfrage (Abspielen) '],
        [/^FOUT PlaybackStart: /, 'ERROR PlaybackStart: ', 'FEHLER PlaybackStart: '],
        [/^TMDB (.*) verversen op de achtergrond mislukt: /, 'TMDB $1 refresh in the background failed: ', 'TMDB $1 Aktualisierung im Hintergrund fehlgeschlagen: '],
        [/^TMDB (.*) \(extra pagina\) mislukt: /, 'TMDB $1 (extra page) failed: ', 'TMDB $1 (zusätzliche Seite) fehlgeschlagen: '],
        [/^TMDB logo (.*) mislukt: /, 'TMDB logo $1 failed: ', 'TMDB-Logo $1 fehlgeschlagen: '],
        [/^TMDB extra's (.*) mislukt: /, 'TMDB extras $1 failed: ', 'TMDB-Extras $1 fehlgeschlagen: '],
        [/^TMDB Engelse seizoensbeschrijving (.*) mislukt: /, 'TMDB English season description $1 failed: ', 'TMDB englische Staffelbeschreibung $1 fehlgeschlagen: '],
        [/^TMDB seizoensbeschrijving (.*) \((.*)\) mislukt: /, 'TMDB season description $1 ($2) failed: ', 'TMDB-Staffelbeschreibung $1 ($2) fehlgeschlagen: '],
        [/^TMDB seizoensposter (.*) \(seizoen\) mislukt: /, 'TMDB season poster $1 (season) failed: ', 'TMDB-Staffelposter $1 (Staffel) fehlgeschlagen: '],
        [/^TMDB seizoensposter (.*) \(afbeeldingen\) mislukt: /, 'TMDB season poster $1 (images) failed: ', 'TMDB-Staffelposter $1 (Bilder) fehlgeschlagen: '],
        [/^TMDB video's (.*) \((.*)\) poging (\d+) mislukt: /, 'TMDB videos $1 ($2) attempt $3 failed: ', 'TMDB-Videos $1 ($2) Versuch $3 fehlgeschlagen: '],
        [/^TMDB detail (.*) mislukt: /, 'TMDB detail $1 failed: ', 'TMDB-Details $1 fehlgeschlagen: '],
        [/^TMDB streamingdiensten (.*) mislukt: /, 'TMDB streaming services $1 failed: ', 'TMDB-Streamingdienste $1 fehlgeschlagen: '],
        [/^Sonarr: (\d+) serie\(s\) zonder tmdbId, die krijgen geen status op de Discover-pagina \(ververs ze in Sonarr\)\./, 'Sonarr: $1 series without a tmdbId; they get no status on the Discover page (refresh them in Sonarr).', 'Sonarr: $1 Serie(n) ohne tmdbId; sie erhalten keinen Status auf der Discover-Seite (in Sonarr aktualisieren).'],
        [/^Sonarr seizoenen opzoeken mislukt \(alleen gekozen seizoenen meegestuurd\): /, 'looking up Sonarr seasons failed (only the chosen seasons were sent): ', 'Sonarr-Staffeln nachschlagen fehlgeschlagen (nur gewählte Staffeln gesendet): '],
        [/^Sonarr gaf geen serie-id terug voor (.*); seizoenen niet extra gecontroleerd$/, 'Sonarr returned no series id for $1; seasons not checked further', 'Sonarr gab keine Serien-ID zurück für $1; Staffeln nicht weiter geprüft'],
        [/^Sonarr afleveringen ophalen \(/, 'fetching Sonarr episodes failed (', 'Sonarr-Folgen abrufen fehlgeschlagen ('],
        [/^Sonarr kent de afleveringen van (.*) nog niet; monitoring niet gecontroleerd$/, 'Sonarr does not know the episodes of $1 yet; monitoring not checked', 'Sonarr kennt die Folgen von $1 noch nicht; Überwachung nicht geprüft'],
        [/^Sonarr seizoen (\d+) monitoren \(/, 'monitoring Sonarr season $1 failed (', 'Überwachung von Sonarr-Staffel $1 fehlgeschlagen ('],
        [/^Sonarr afleveringen monitoren \(/, 'monitoring Sonarr episodes failed (', 'Überwachung der Sonarr-Folgen fehlgeschlagen ('],
        [/^Sonarr zoeken \(/, 'Sonarr search failed (', 'Sonarr-Suche fehlgeschlagen ('],
        [/^Sonarr (.*): seizoen (.*) gemonitord \((\d+) afleveringen aangezet, (\d+) uitgezet\) en zoekopdracht \(SeriesSearch\) gestart$/, 'Sonarr $1: season $2 monitored ($3 episodes turned on, $4 turned off) and search (SeriesSearch) started', 'Sonarr $1: Staffel $2 überwacht ($3 Folgen aktiviert, $4 deaktiviert) und Suche (SeriesSearch) gestartet'],
        [/^FOUT seizoensmonitoring /, 'ERROR season monitoring ', 'FEHLER Staffelüberwachung '],
        [/^FOUT home laden: /, 'ERROR loading home: ', 'FEHLER beim Laden der Startseite: '],
        [/^FOUT rij /, 'ERROR row ', 'FEHLER Zeile '],
        [/^rij (.*) pagina (\d+): /, 'row $1 page $2: ', 'Zeile $1 Seite $2: '],
        [/^browse (.*) pagina (\d+): /, 'browse $1 page $2: ', 'Durchsuchen $1 Seite $2: '],
        [/^FOUT recent /, 'ERROR recent ', 'FEHLER zuletzt '],
        [/^FOUT zoeken: /, 'ERROR searching: ', 'FEHLER bei der Suche: '],
        [/^FOUT info /, 'ERROR info ', 'FEHLER Info '],
        [/^FOUT seriekaart /, 'ERROR series card ', 'FEHLER Serienkarte '],
        [/^knop: TMDB film /, 'button: TMDB movie ', 'Schaltfläche: TMDB-Film '],
        [/^knop: TMDB serie /, 'button: TMDB series ', 'Schaltfläche: TMDB-Serie '],
        [/^knop: geen TMDB-item gevonden voor /, 'button: no TMDB item found for ', 'Schaltfläche: kein TMDB-Eintrag gefunden für '],
        [/^knop: seizoenen ophalen mislukt: /, 'button: fetching seasons failed: ', 'Schaltfläche: Staffeln abrufen fehlgeschlagen: '],
        [/^FOUT knop \(resolve\): /, 'ERROR button (resolve): ', 'FEHLER Schaltfläche (resolve): '],
        [/^FOUT aanvraag \(webpagina\): /, 'ERROR request (web page): ', 'FEHLER Anfrage (Webseite): '],
        [/^FOUT verwijderen: /, 'ERROR removing: ', 'FEHLER beim Entfernen: '],
        [/^serie (\d+): /, 'series $1: ', 'Serie $1: '],
        [/^film (\d+): /, 'movie $1: ', 'Film $1: '],
        [/^FOUT status /, 'ERROR status ', 'FEHLER Status '],
        [/^FOUT TMDB /, 'ERROR TMDB ', 'FEHLER TMDB ']
    ];

    function translateEvent(e) {
        if (language === 'nl') { return e; }
        var m = /^(\d\d:\d\d:\d\d {2})([\s\S]*)$/.exec(e);
        var prefix = m ? m[1] : '';
        var msg = m ? m[2] : e;
        for (var i = 0; i < EVENT_MAP.length; i++) {
            if (EVENT_MAP[i][0].test(msg)) {
                return prefix + msg.replace(EVENT_MAP[i][0], language === 'de' ? EVENT_MAP[i][2] : EVENT_MAP[i][1]);
            }
        }
        return e;
    }

    function setLanguage(locale) {
        var value = String(locale || '').toLowerCase();
        language = value.indexOf('de') === 0 ? 'de' : value.indexOf('nl') === 0 ? 'nl' : 'en';
    }

    function translatePage(view) {
        view.querySelector('h2').textContent = text('Discover status', 'Discover status', 'Discover-Status');
        view.querySelector('.fieldDescription').textContent = text(
            'Controleert alles wat Discover nodig heeft: de plugin, het kanaal, TMDB, Radarr, Sonarr en het clipbestand. Draai dit op elke server en vergelijk de uitkomst. Er worden geen API keys getoond.',
            'Checks everything Discover needs: the plugin, channel, TMDB, Radarr, Sonarr, and clip file. Run this on each server and compare the results. API keys are never shown.',
            'Prüft alle Voraussetzungen von Discover: Plugin, Kanal, TMDB, Radarr, Sonarr und Clipdatei. Führe dies auf jedem Server aus und vergleiche die Ergebnisse. API-Schlüssel werden nicht angezeigt.');
        view.querySelector('.dsRefresh span').textContent = text('Opnieuw controleren', 'Check again', 'Erneut prüfen');
        view.querySelector('.dsCopy span').textContent = text('Rapport kopiëren', 'Copy report', 'Bericht kopieren');
    }

    function getJson(path, query) {
        return ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl(path, query || {}), dataType: 'json' });
    }

    function postJson(path, data) {
        return ApiClient.ajax({
            type: 'POST', url: ApiClient.getUrl(path), data: JSON.stringify(data),
            contentType: 'application/json', dataType: 'json'
        });
    }

    function isDiscoverChannel(channel) {
        var name = String(channel && channel.Name || '').trim();
        return /discover/i.test(name) || /^films\s*&\s*series\s+aanvragen$/i.test(name);
    }

    function errText(e) {
        if (!e) { return text('onbekende fout', 'unknown error', 'unbekannter Fehler'); }
        if (e.status) { return 'HTTP ' + e.status + (e.statusText ? ' ' + e.statusText : ''); }
        return String(e.message || e);
    }

    // Voert een stap uit en vangt elke fout af, zodat een mislukte stap de rest niet blokkeert.
    function step(lines, title, fn) {
        return Promise.resolve().then(fn).then(function (r) {
            return r;
        }, function (e) {
            lines.push('[' + text('FOUT', 'ERROR', 'FEHLER') + '] ' + title + ': ' + errText(e));
            return null;
        });
    }

    function ok(lines, message) { lines.push('[ OK ] ' + message); }
    function bad(lines, message) { lines.push('[' + text('FOUT', 'ERROR', 'FEHLER') + '] ' + message); }
    function info(lines, text) { lines.push('       ' + text); }

    function translateButtonScript(value) {
        if (value === 'OK Emby-pluginresource; open Discover om het script in deze browser te laden.') {
            return text(
                value,
                'OK Emby plugin resource; open Discover to load the script in this browser.',
                'OK Emby-Pluginressource; öffne Discover, um das Skript in diesem Browser zu laden.');
        }
        return value;
    }

    function run(view, out) {
        var lines = [];
        out.textContent = text('Bezig met controleren...', 'Checking...', 'Prüfung läuft...');
        var cfg = null, users = [], adminId = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();

        return getJson('Discover/Status').then(function (initialStatus) {
            window.__discoverStatus = initialStatus;
            setLanguage(initialStatus.PluginLanguage);
            translatePage(view);
            return step(lines, text('Emby-versie ophalen', 'Get Emby version', 'Emby-Version abrufen'), function () {
            return getJson('System/Info').then(function (i) {
                lines.push('== ' + text('Emby', 'Emby', 'Emby') + ' ==');
                ok(lines, 'Emby Server ' + i.Version + ' ' + text('op', 'on', 'auf') + ' ' + (i.OperatingSystemDisplayName || i.OperatingSystem || '?'));
                if (i.HasPendingRestart) { bad(lines, text('Emby wacht op een herstart (nieuwe plugin pas na herstart actief).', 'Emby is waiting for a restart (the new plugin will only be active after restarting).', 'Emby wartet auf einen Neustart (das neue Plugin wird erst danach aktiv).')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== Plugin ==');
            return step(lines, text('Pluginlijst ophalen', 'Get plugin list', 'Pluginliste abrufen'), function () {
                return getJson('Plugins').then(function (list) {
                    var mine = (list || []).filter(function (p) { return String(p.Id || '').toLowerCase().replace(/-/g, '') === pluginId.replace(/-/g, ''); })[0];
                    if (!mine) { bad(lines, text('Discover staat niet in de lijst met geladen plugins. De DLL is niet geladen (verkeerde map, herstart vergeten, of niet compatibel met deze Emby-versie).', 'Discover is not in the list of loaded plugins. The DLL was not loaded (wrong folder, restart required, or incompatible with this Emby version).', 'Discover ist nicht in der Liste der geladenen Plugins. Die DLL wurde nicht geladen (falscher Ordner, Neustart erforderlich oder inkompatibel mit dieser Emby-Version).')); return; }
                    var status = mine.Status || mine.PluginStatus || '';
                    if (/malfunction|disabled|restart|notsupported|superseded|deleted/i.test(status)) { bad(lines, text('Plugin ', 'Plugin ', 'Plugin ') + mine.Version + text(' heeft status "', ' has status "', ' hat den Status "') + status + '". ' + text('Zie het Emby-logboek bij het opstarten.', 'Check the Emby startup log.', 'Siehe das Emby-Startprotokoll.')); }
                    else { ok(lines, text('Plugin ', 'Plugin ', 'Plugin ') + mine.Version + ' ' + text('geladen', 'loaded', 'geladen') + (status ? ' (' + text('status: ', 'status: ', 'Status: ') + status + ')' : '')); }
                });
            });
        }).then(function () {
            return step(lines, text('Plugin-status ophalen', 'Get plugin status', 'Pluginstatus abrufen'), function () {
                return getJson('Discover/Status').then(function (r) {
                    window.__discoverStatus = r;
                    ok(lines, text('Discover-service bereikbaar, DLL-versie ', 'Discover service available, DLL version ', 'Discover-Dienst erreichbar, DLL-Version ') + r.PluginVersion + ', ' + text('geladen om ', 'loaded at ', 'geladen um ') + r.LoadedAt);
                    (r.TmdbKeySet ? ok : bad)(lines, 'TMDB ' + text('key ingesteld: ', 'key configured: ', 'Schlüssel eingerichtet: ') + (r.TmdbKeySet ? text('ja', 'yes', 'ja') : text('NEE', 'NO', 'NEIN')));
                    info(lines, text('Plugin-/Emby-taal: ', 'Plugin/Emby language: ', 'Plugin-/Emby-Sprache: ') + r.PluginLanguage + '; ' + text('TMDB-taal: ', 'TMDB language: ', 'TMDB-Sprache: ') + r.TmdbLanguage);
                    info(lines, text('Debuginformatie op Discover-/detailpagina\'s: ', 'Diagnostics on Discover/item pages: ', 'Diagnoseinformationen auf Discover-/Detailseiten: ') + (r.ShowDiagnostics ? text('aan', 'on', 'ein') : text('uit', 'off', 'aus')));
                    (r.RadarrSet ? ok : bad)(lines, 'Radarr ' + text('ingesteld: ', 'configured: ', 'eingerichtet: ') + (r.RadarrSet ? text('ja', 'yes', 'ja') : text('NEE', 'NO', 'NEIN')));
                    (r.SonarrSet ? ok : bad)(lines, 'Sonarr ' + text('ingesteld: ', 'configured: ', 'eingerichtet: ') + (r.SonarrSet ? text('ja', 'yes', 'ja') : text('NEE', 'NO', 'NEIN')));
                    if (r.ClipError) { bad(lines, text('Bevestigingsclip kan niet worden weggeschreven: ', 'Confirmation clip could not be written: ', 'Bestätigungsclip konnte nicht geschrieben werden: ') + r.ClipError); }
                    else { ok(lines, text('Bevestigingsclip staat klaar: ', 'Confirmation clip is ready: ', 'Bestätigungsclip ist bereit: ') + r.ClipPath); }
                    if (r.ButtonScript && /^OK/.test(r.ButtonScript)) { ok(lines, text('Aanvragen-knop in de webclient: ', 'Request button in web client: ', 'Anfragen-Schaltfläche im Webclient: ') + translateButtonScript(r.ButtonScript)); }
                    else { bad(lines, text('Aanvragen-knop in de webclient: ', 'Request button in web client: ', 'Anfragen-Schaltfläche im Webclient: ') + translateButtonScript(r.ButtonScript || text('onbekend', 'unknown', 'unbekannt'))); }
                    var wi = r.WebInject || text('onbekend', 'unknown', 'unbekannt');
                    var wiLabel = text('Tegel "Discover Media" -> Discover-pagina: ', 'Tile "Discover Media" -> Discover page: ', 'Kachel „Discover Media“ -> Discover-Seite: ');
                    if (/^(actief|al actief)/.test(wi)) { ok(lines, wiLabel + wi); }
                    else if (/^(fout|webclient niet gevonden)/.test(wi)) { bad(lines, wiLabel + wi); }
                    else { info(lines, wiLabel + wi); }
                    info(lines, text('Kanaal opgevraagd door Emby: ', 'Channel requests by Emby: ', 'Kanalaufrufe durch Emby: ') + r.ChannelCalls + 'x; ' + text('aanvragen gelukt/mislukt: ', 'requests succeeded/failed: ', 'Anfragen erfolgreich/fehlgeschlagen: ') + (r.Requests - r.RequestErrors) + '/' + r.RequestErrors);
                });
            });
        }).then(function () {
            return step(lines, text('Instellingen lezen', 'Read settings', 'Einstellungen lesen'), function () {
                return ApiClient.getPluginConfiguration(pluginId).then(function (c) { cfg = c; });
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + text('Verbindingen (vanaf de server, met de opgeslagen instellingen)', 'Connections (from the server, using saved settings)', 'Verbindungen (vom Server mit den gespeicherten Einstellungen)') + ' ==');
            if (!cfg) { bad(lines, text('Geen opgeslagen instellingen gevonden.', 'No saved settings found.', 'Keine gespeicherten Einstellungen gefunden.')); return; }
            var tests = [];
            tests.push(step(lines, text('TMDB testen', 'Test TMDB', 'TMDB testen'), function () {
                if (!cfg.TmdbApiKey) { bad(lines, 'TMDB: ' + text('geen key ingesteld', 'no key configured', 'kein Schlüssel eingerichtet')); return; }
                return postJson('Discover/TestConnection', { Type: 'Tmdb', ApiKey: cfg.TmdbApiKey }).then(function (r) {
                    if (r && r.Success) { ok(lines, text('TMDB werkt', 'TMDB is working', 'TMDB funktioniert')); } else { bad(lines, 'TMDB: ' + ((r && r.Error) || text('onbekende fout', 'unknown error', 'unbekannter Fehler'))); }
                });
            }));
            ['Radarr', 'Sonarr'].forEach(function (kind) {
                tests.push(step(lines, text(kind + ' testen', 'Test ' + kind, kind + ' testen'), function () {
                    var url = cfg[kind + 'Url'], key = cfg[kind + 'ApiKey'];
                    if (!url || !key) { bad(lines, kind + ': ' + text('URL of key ontbreekt', 'URL or key missing', 'URL oder Schlüssel fehlt')); return; }
                    return postJson('Discover/TestConnection', { Type: kind, Url: url, ApiKey: key }).then(function (r) {
                        if (r && r.Success) {
                            ok(lines, kind + ' ' + (r.Version || '') + ' ' + text('bereikbaar op ', 'reachable at ', 'erreichbar unter ') + url + ' (' + (r.Profiles || []).length + ' ' + text('profielen, ', 'profiles, ', 'Profile, ') + (r.RootFolders || []).length + ' ' + text('root folders', 'root folders', 'Stammordner') + ')');
                            var pid = cfg[kind + 'QualityProfileId'];
                            if (pid && !(r.Profiles || []).some(function (p) { return p.Id === pid; })) { bad(lines, kind + ': ' + text('opgeslagen quality profile ', 'saved quality profile ', 'gespeichertes Qualitätsprofil ') + pid + text(' bestaat daar niet (andere server?)', ' does not exist there (different server?)', ' ist dort nicht vorhanden (anderer Server?)')); }
                            var root = cfg[kind + 'RootFolder'];
                            if (root && !(r.RootFolders || []).some(function (f) { return f.Path === root; })) { bad(lines, kind + ': ' + text('opgeslagen root folder "', 'saved root folder "', 'gespeicherter Stammordner "') + root + text('" bestaat daar niet (andere server?)', '" does not exist there (different server?)', '" ist dort nicht vorhanden (anderer Server?)')); }
                        } else {
                            bad(lines, kind + ' ' + text('op ', 'at ', 'unter ') + url + ': ' + ((r && r.Error) || text('onbekende fout', 'unknown error', 'unbekannter Fehler')));
                        }
                    });
                }));
            });
            return Promise.all(tests);
        }).then(function () {
            lines.push('');
            lines.push('== ' + text('Kanaal', 'Channel', 'Kanal') + ' ==');
            return step(lines, text('Kanalen ophalen', 'Get channels', 'Kanäle abrufen'), function () {
                return getJson('Channels', { UserId: adminId }).then(function (r) {
                    var names = (r.Items || []).map(function (c) { return c.Name; });
                    var found = (r.Items || []).filter(isDiscoverChannel)[0];
                    if (found) { ok(lines, text('Kanaal "', 'Channel "', 'Kanal "') + found.Name + text('" is bekend bij Emby en zichtbaar voor jou.', '" is listed by Emby and visible to you.', '" ist bei Emby bekannt und für dich sichtbar.')); }
                    else { bad(lines, text('Discover-kanaal (Discover Media of Films & Series Aanvragen) ontbreekt in de kanalenlijst. Bekende kanalen: ', 'Discover channel (Discover Media or Films & Series Aanvragen) is missing from the channel list. Known channels: ', 'Discover-Kanal (Discover Media oder Films & Series Aanvragen) fehlt in der Kanalliste. Bekannte Kanäle: ') + (names.join(', ') || text('(geen)', '(none)', '(keine)'))); }
                });
            });
        }).then(function () {
            return step(lines, text('Gebruikers ophalen', 'Get users', 'Benutzer abrufen'), function () {
                return getJson('Users').then(function (list) { users = list || []; });
            });
        }).then(function () {
            if (!users.length) { return; }
            lines.push('');
            lines.push('== ' + text('Wie ziet het kanaal?', 'Who can see the channel?', 'Wer kann den Kanal sehen?') + ' ==');
            return Promise.all(users.map(function (u) {
                return getJson('Channels', { UserId: u.Id }).then(function (r) {
                    var has = (r.Items || []).some(isDiscoverChannel);
                    return { name: u.Name, has: has };
                }, function () { return { name: u.Name, has: null }; });
            })).then(function (res) {
                var without = res.filter(function (x) { return x.has === false; }).map(function (x) { return x.name; });
                var unknown = res.filter(function (x) { return x.has === null; }).map(function (x) { return x.name; });
                var withCount = res.filter(function (x) { return x.has; }).length;
                ok(lines, withCount + text(' van ', ' of ', ' von ') + res.length + text(' gebruikers zien het kanaal.', ' users can see the channel.', ' Benutzern kann den Kanal sehen.'));
                if (without.length) {
                    bad(lines, text('Geen toegang tot het kanaal: ', 'No channel access: ', 'Kein Zugriff auf den Kanal: ') + without.join(', '));
                    info(lines, text('Oplossen: Gebruiker > Toegang > Kanalen: "Alle kanalen" aanzetten of Discover Media / Films & Series Aanvragen toevoegen.', 'Fix: User > Access > Channels: enable "All channels" or add Discover Media / Films & Series Aanvragen.', 'Lösung: Benutzer > Zugriff > Kanäle: "Alle Kanäle" aktivieren oder Discover Media / Films & Series Aanvragen hinzufügen.'));
                }
                if (unknown.length) { info(lines, text('Niet te controleren: ', 'Could not check: ', 'Nicht überprüfbar: ') + unknown.join(', ')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + text('Recente activiteit van het kanaal', 'Recent channel activity', 'Letzte Kanalaktivität') + ' ==');
            var r = window.__discoverStatus;
            if (!r || !r.Events || !r.Events.length) { info(lines, text('(nog niets - open het Discover-kanaal in Emby en controleer opnieuw)', '(nothing yet - open the Discover channel in Emby and check again)', '(noch nichts - öffne den Discover-Kanal in Emby und prüfe erneut)')); }
            else {
                r.Events.forEach(function (e) {
                    e = translateEvent(e);
                    info(lines, e);
                });
            }
            out.textContent = lines.join('\n');
        });
        });
    }

    return function (view, params) {
        var out = view.querySelector('.dsOut');

        function load() {
            run(view, out)['catch'](function (e) { out.textContent += '\n[' + text('FOUT', 'ERROR', 'FEHLER') + '] ' + errText(e); });
        }

        view.querySelector('.dsRefresh').addEventListener('click', load);
        view.querySelector('.dsCopy').addEventListener('click', function () {
            var reportText = out.textContent;
            var done = function () { var b = view.querySelector('.dsCopy span'); b.textContent = text('Gekopieerd', 'Copied', 'Kopiert'); setTimeout(function () { b.textContent = text('Rapport kopiëren', 'Copy report', 'Bericht kopieren'); }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(reportText).then(done, function () { }); return; }
            var ta = document.createElement('textarea'); ta.value = reportText; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { } document.body.removeChild(ta);
        });
        view.addEventListener('viewshow', load);
    };
});
