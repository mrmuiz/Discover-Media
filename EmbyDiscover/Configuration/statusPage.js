define(['emby-button'], function () {
    'use strict';

    var pluginId = '7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90';
    var language = 'nl';


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
        [/^FOUT TMDB /, 'ERROR TMDB ', 'FEHLER TMDB '],
        [/^Sonarr-cache bijwerken mislukt, cache gewist: /, 'updating the Sonarr cache failed, cache cleared: ', 'Sonarr-Cache aktualisieren fehlgeschlagen, Cache geleert: '],
        [/^Sonarr kent seizoen (.*) van (.*) nog niet: nieuwe seizoenen worden gemonitord$/, 'Sonarr does not know season $1 of $2 yet: new seasons are being monitored', 'Sonarr kennt Staffel $1 von $2 noch nicht: neue Staffeln werden überwacht'],
        [/^Sonarr: nieuwe seizoenen van (.*) worden gemonitord$/, 'Sonarr: new seasons of $1 are being monitored', 'Sonarr: neue Staffeln von $1 werden überwacht'],
        [/^Sonarr serie monitoren \(/, 'monitoring Sonarr series failed (', 'Überwachung der Sonarr-Serie fehlgeschlagen ('],
        [/^Sonarr nieuwe seizoenen monitoren \(/, 'monitoring new Sonarr seasons failed (', 'Überwachung neuer Sonarr-Staffeln fehlgeschlagen ('],
        [/^Sonarr kent de afleveringen van (.*) niet; alleen de seizoensvlaggen zijn bijgewerkt$/, 'Sonarr does not know the episodes of $1; only the season flags were updated', 'Sonarr kennt die Folgen von $1 nicht; nur die Staffel-Markierungen wurden aktualisiert'],
        [/^Sonarr (.*) \(stond al in Sonarr\): seizoen (.*) gemonitord \((\d+) afleveringen aangezet\), zoekopdracht voor niets \(geen ontbrekende uitgezonden afleveringen\)$/, 'Sonarr $1 (was already in Sonarr): season $2 monitored ($3 episodes turned on), search for nothing (no missing aired episodes)', 'Sonarr $1 (war bereits in Sonarr): Staffel $2 überwacht ($3 Folgen aktiviert), Suche nach nichts (keine fehlenden gesendeten Folgen)'],
        [/^Sonarr (.*) \(stond al in Sonarr\): seizoen (.*) gemonitord \((\d+) afleveringen aangezet\), zoekopdracht voor de hele serie$/, 'Sonarr $1 (was already in Sonarr): season $2 monitored ($3 episodes turned on), search for the whole series', 'Sonarr $1 (war bereits in Sonarr): Staffel $2 überwacht ($3 Folgen aktiviert), Suche nach der ganzen Serie'],
        [/^Sonarr (.*) \(stond al in Sonarr\): seizoen (.*) gemonitord \((\d+) afleveringen aangezet\), zoekopdracht voor seizoen (.*)$/, 'Sonarr $1 (was already in Sonarr): season $2 monitored ($3 episodes turned on), search for season $4', 'Sonarr $1 (war bereits in Sonarr): Staffel $2 überwacht ($3 Folgen aktiviert), Suche nach Staffel $4'],
        [/^Radarr film opzoeken \(/, 'Radarr movie lookup failed (', 'Radarr-Filmsuche fehlgeschlagen ('],
        [/^Radarr film monitoren \(/, 'monitoring Radarr movie failed (', 'Überwachung des Radarr-Films fehlgeschlagen ('],
        [/^Radarr zoeken \(/, 'Radarr search failed (', 'Radarr-Suche fehlgeschlagen ('],
        [/^Radarr (.*) \(stond al in Radarr, geen bestand\): al gemonitord, zoekopdracht gestart$/, 'Radarr $1 (was already in Radarr, no file): already monitored, search started', 'Radarr $1 (war bereits in Radarr, keine Datei): bereits überwacht, Suche gestartet'],
        [/^Radarr (.*) \(stond al in Radarr, geen bestand\): nu gemonitord, zoekopdracht gestart$/, 'Radarr $1 (was already in Radarr, no file): now monitored, search started', 'Radarr $1 (war bereits in Radarr, keine Datei): jetzt überwacht, Suche gestartet'],
        [/^FOUT wachtrij-item (.*) verwijderen in /, 'ERROR removing queue item $1 in ', 'FEHLER beim Entfernen des Warteschlangen-Eintrags $1 in '],
        [/^FOUT wachtrij opruimen in /, 'ERROR cleaning the queue in ', 'FEHLER beim Aufräumen der Warteschlange in '],
        [/^FOUT wachtrij Radarr\/Sonarr naast Seerr: /, 'ERROR Radarr/Sonarr queue next to Seerr: ', 'FEHLER Radarr/Sonarr-Warteschlange neben Seerr: '],
        [/^FOUT wachtrij verversen: /, 'ERROR refreshing the queue: ', 'FEHLER beim Aktualisieren der Warteschlange: '],
        [/^FOUT wachtrij Seerr lezen: /, 'ERROR reading the Seerr queue: ', 'FEHLER beim Lesen der Seerr-Warteschlange: '],
        [/^FOUT wachtrij (.*) lezen: /, 'ERROR reading the $1 queue: ', 'FEHLER beim Lesen der $1-Warteschlange: '],
        [/^FOUT wachtrij: /, 'ERROR queue: ', 'FEHLER Warteschlange: '],
        [/^FOUT recente aanvragen lezen: /, 'ERROR reading recent requests: ', 'FEHLER beim Lesen der letzten Anfragen: '],
        [/^(.*): (\d+) download\(s\) uit de wachtrij en downloadclient gehaald$/, '$1: $2 download(s) removed from the queue and the download client', '$1: $2 Download(s) aus der Warteschlange und dem Download-Client entfernt'],
        [/^aanvragenlijst lezen mislukt: /, 'reading the request list failed: ', 'Anfrageliste lesen fehlgeschlagen: '],
        [/^aanvragenlijst opslaan mislukt: /, 'saving the request list failed: ', 'Anfrageliste speichern fehlgeschlagen: '],
        [/^aanvraag onthouden mislukt: /, 'remembering the request failed: ', 'Anfrage merken fehlgeschlagen: '],
        [/^aanvraag \(Afspelen\) onthouden mislukt: /, 'remembering the request (Play) failed: ', 'Anfrage (Abspielen) merken fehlgeschlagen: '],
        [/^aanvraag \(Afspelen\) boven de limiet voor /, 'request (Play) over the limit for ', 'Anfrage (Abspielen) über dem Limit für '],
        [/^aanvraag \(webpagina\) boven de limiet voor /, 'request (web page) over the limit for ', 'Anfrage (Webseite) über dem Limit für '],
        [/^aanvraag \(webpagina\) geblokkeerd voor gebruiker /, 'request (web page) blocked for user ', 'Anfrage (Webseite) für Benutzer gesperrt: '],
        [/^aanvraag geblokkeerd voor gebruiker /, 'request blocked for user ', 'Anfrage für Benutzer gesperrt: '],
        [/^aanvraag bij afspelen: onbekend seizoens-id /, 'request on play: unknown season id ', 'Anfrage beim Abspielen: unbekannte Staffel-ID '],
        [/^melding geblokkeerde aanvraag mislukt: /, 'notification about the blocked request failed: ', 'Meldung über die gesperrte Anfrage fehlgeschlagen: '],
        [/^melding beschikbaar mislukt: /, 'notification "available" failed: ', 'Meldung „verfügbar“ fehlgeschlagen: '],
        [/^melding beschikbaar verstuurd: /, 'notification "available" sent: ', 'Meldung „verfügbar“ gesendet: '],
        [/^melding beschikbaar deels verstuurd; resterende sessies worden opnieuw geprobeerd: /, 'notification "available" partly sent; the remaining sessions will be retried: ', 'Meldung „verfügbar“ teilweise gesendet; die übrigen Sitzungen werden erneut versucht: '],
        [/^FOUT controle beschikbare aanvragen: /, 'ERROR checking available requests: ', 'FEHLER bei der Prüfung verfügbarer Anfragen: '],
        [/^gebruiker bij aanvraag niet te bepalen: /, 'the user of the request could not be determined: ', 'Benutzer der Anfrage nicht feststellbar: '],
        [/^kanaalverversing: taak 'Refresh Internet Channels' niet gevonden$/, "channel refresh: task 'Refresh Internet Channels' not found", "Kanalaktualisierung: Aufgabe 'Refresh Internet Channels' nicht gefunden"],
        [/^kanaalverversing zelf gestart \(/, 'channel refresh started by Discover (', 'Kanalaktualisierung von Discover gestartet ('],
        [/^kanaalverversing starten mislukt: /, 'starting the channel refresh failed: ', 'Start der Kanalaktualisierung fehlgeschlagen: '],
        [/^kanaal opzoeken mislukt: /, 'looking up the channel failed: ', 'Kanal nachschlagen fehlgeschlagen: '],
        [/^item controleren mislukt: /, 'checking the item failed: ', 'Element prüfen fehlgeschlagen: '],
        [/^cast item /, 'cast item ', 'Cast-Element '],
        [/^achtergrond item /, 'backdrop item ', 'Hintergrund-Element '],
        [/^FOUT persoonscredits /, 'ERROR person credits ', 'FEHLER Personen-Credits '],
        [/^FOUT persoon /, 'ERROR person ', 'FEHLER Person '],
        [/^persoon: geen TMDB-id gevonden voor /, 'person: no TMDB id found for ', 'Person: keine TMDB-ID gefunden für '],
        [/^FOUT aanbevelingen /, 'ERROR recommendations ', 'FEHLER Empfehlungen '],
        [/^FOUT seizoenen /, 'ERROR seasons ', 'FEHLER Staffeln '],
        [/^FOUT seizoensmonitoring /, 'ERROR season monitoring ', 'FEHLER Staffelüberwachung '],
        [/^FOUT titel /, 'ERROR title ', 'FEHLER Titel '],
        [/^FOUT opruimen: /, 'ERROR cleaning up: ', 'FEHLER beim Aufräumen: '],
        [/^FOUT Trakt-watchlist: /, 'ERROR Trakt watchlist: ', 'FEHLER Trakt-Watchlist: '],
        [/^FOUT TMDB-lijst /, 'ERROR TMDB list ', 'FEHLER TMDB-Liste '],
        [/^FOUT MDBList /, 'ERROR MDBList ', 'FEHLER MDBList '],
        [/^FOUT OMDb /, 'ERROR OMDb ', 'FEHLER OMDb '],
        [/^FOUT SABnzbd-geschiedenis lezen: /, 'ERROR reading the SABnzbd history: ', 'FEHLER beim Lesen der SABnzbd-Historie: '],
        [/^FOUT (.*) lezen: /, 'ERROR reading $1: ', 'FEHLER beim Lesen von $1: '],
        [/^FOUT Sonarr RefreshMonitoredDownloads: /, 'ERROR Sonarr RefreshMonitoredDownloads: ', 'FEHLER Sonarr RefreshMonitoredDownloads: '],
        [/^OMDb (.*): geen resultaat$/, 'OMDb $1: no result', 'OMDb $1: kein Ergebnis'],
        [/^TMDB collectie bij film /, 'TMDB collection of movie ', 'TMDB-Sammlung des Films '],
        [/^TMDB aanbevelingen /, 'TMDB recommendations ', 'TMDB-Empfehlungen '],
        [/^TMDB vergelijkbaar /, 'TMDB similar ', 'TMDB ähnlich '],
        [/^TMDB titellogo /, 'TMDB title logo ', 'TMDB-Titellogo '],
        [/^TMDB logo-versies /, 'TMDB logo versions ', 'TMDB-Logoversionen '],
        [/^TMDB streamingdiensten /, 'TMDB streaming services ', 'TMDB-Streamingdienste '],
        [/^TMDB detail /, 'TMDB detail ', 'TMDB-Details '],
        [/^TMDB-talenlijst geladen: /, 'TMDB language list loaded: ', 'TMDB-Sprachliste geladen: '],
        [/^TVmaze volgende aflevering /, 'TVmaze next episode ', 'TVmaze nächste Folge '],
        [/^fanart.tv logo /, 'fanart.tv logo ', 'fanart.tv-Logo '],
        [/^Nieuwe seizoenen: /, 'New seasons: ', 'Neue Staffeln: '],
        [/^rij Nieuwe seizoenen: (\d+) van (\d+) series$/, 'row New seasons: $1 of $2 series', 'Zeile Neue Staffeln: $1 von $2 Serien'],
        [/^genrefoto's ophalen mislukt: /, 'fetching the genre pictures failed: ', 'Genre-Bilder abrufen fehlgeschlagen: '],
        [/^logo-versies ophalen mislukt: /, 'fetching the logo versions failed: ', 'Logoversionen abrufen fehlgeschlagen: '],
        [/^personen zoeken mislukt: /, 'searching people failed: ', 'Personensuche fehlgeschlagen: '],
        [/^infotabel /, 'info table ', 'Infotabelle '],
        [/^titel voor aanvraag-item /, 'title for request item ', 'Titel für Anfrage-Element '],
        [/^seizoensbeschrijving ophalen mislukt voor /, 'fetching the season description failed for ', 'Staffelbeschreibung abrufen fehlgeschlagen für '],
        [/^geen seizoensposter bij TMDB voor /, 'no season poster at TMDB for ', 'kein Staffelposter bei TMDB für '],
        [/^seizoensposter ophalen mislukt voor /, 'fetching the season poster failed for ', 'Staffelposter abrufen fehlgeschlagen für '],
        [/^seizoensposter voor kaart /, 'season poster for card ', 'Staffelposter für Karte '],
        [/^extra info /, 'extra info ', 'Zusatzinfo '],
        [/^tegelafbeelding /, 'tile image ', 'Kachelbild '],
        [/^achtergronden /, 'backdrops ', 'Hintergründe '],
        [/^genre-achtergrond /, 'genre backdrop ', 'Genre-Hintergrund '],
        [/^genretegel /, 'genre tile ', 'Genre-Kachel '],
        [/^kaartclip /, 'card clip ', 'Kartenclip '],
        [/^seizoensaanvraagclip voor seizoen /, 'season request clip for season ', 'Staffel-Anfrageclip für Staffel '],
        [/^aanvraagclip voor alle seizoenen/, 'request clip for all seasons', 'Anfrageclip für alle Staffeln'],
        [/^tegel op de achtergrond mislukt: /, 'the tile in the background failed: ', 'Kachel im Hintergrund fehlgeschlagen: '],
        [/^mapplaatje /, 'folder image ', 'Ordnerbild '],
        [/^logotegel /, 'logo tile ', 'Logo-Kachel '],
        [/^logo voor 'alle seizoenen' onbruikbaar, naam als tekst: /, "logo for 'all seasons' unusable, name as text: ", "Logo für 'alle Staffeln' unbrauchbar, Name als Text: "],
        [/^tegel 'alle seizoenen' gemaakt: /, "tile 'all seasons' created: ", "Kachel 'alle Staffeln' erstellt: "],
        [/^tegel 'alle seizoenen' mislukt: /, "tile 'all seasons' failed: ", "Kachel 'alle Staffeln' fehlgeschlagen: "],
        [/^map '(.*)' niet schrijfbaar/, "folder '$1' not writable", "Ordner '$1' nicht beschreibbar"],
        [/^map /, 'folder ', 'Ordner '],
        [/^clip schrijven mislukt in /, 'writing the clip failed in ', 'Clip schreiben fehlgeschlagen in '],
        [/^IMDb-dataset downloaden mislukt: /, 'downloading the IMDb dataset failed: ', 'IMDb-Datensatz herunterladen fehlgeschlagen: '],
        [/^IMDb-dataset laden mislukt: /, 'loading the IMDb dataset failed: ', 'IMDb-Datensatz laden fehlgeschlagen: '],
        [/^IMDb-dataset ververst$/, 'IMDb dataset refreshed', 'IMDb-Datensatz aktualisiert'],
        [/^IMDb-dataset geladen: /, 'IMDb dataset loaded: ', 'IMDb-Datensatz geladen: '],
        [/^IMDb-id /, 'IMDb id ', 'IMDb-ID '],
        [/^trailer: /, 'trailer: ', 'Trailer: '],
        [/^update: kijken mislukt: /, 'update: checking failed: ', 'Update: Prüfung fehlgeschlagen: '],
        [/^update: (.*) geïnstalleerd in (.*), herstart nodig$/, 'update: $1 installed in $2, restart needed', 'Update: $1 in $2 installiert, Neustart erforderlich'],
        [/^update: Emby herstart$/, 'update: Emby is restarting', 'Update: Emby startet neu'],
        [/^update: herstart mislukt: /, 'update: restart failed: ', 'Update: Neustart fehlgeschlagen: '],
        [/^update: automatisch installeren mislukt: /, 'update: installing automatically failed: ', 'Update: automatische Installation fehlgeschlagen: '],
        [/^Ombi 4K-server opvragen mislukt: /, 'requesting the Ombi 4K server failed: ', 'Abfrage des Ombi-4K-Servers fehlgeschlagen: '],
        [/^Ombi serie (\d+) aangevraagd/, 'Ombi series $1 requested', 'Ombi-Serie $1 angefragt'],
        [/^Ombi film (\d+) aangevraagd/, 'Ombi movie $1 requested', 'Ombi-Film $1 angefragt'],
        [/^Ombi serie /, 'Ombi series ', 'Ombi-Serie '],
        [/^Ombi film /, 'Ombi movie ', 'Ombi-Film '],
        [/^Seerr 4K-servers opvragen mislukt: /, 'requesting the Seerr 4K servers failed: ', 'Abfrage der Seerr-4K-Server fehlgeschlagen: '],
        [/^Seerr-gebruikers ophalen mislukt \(aanvraag gaat op naam van de API-key\): /, 'fetching the Seerr users failed (the request is made in the name of the API key): ', 'Seerr-Benutzer abrufen fehlgeschlagen (die Anfrage läuft im Namen des API-Schlüssels): '],
        [/^Seerr: geen Seerr-gebruiker gekoppeld aan Emby-gebruiker (.*); aanvraag op naam van de API-key$/, 'Seerr: no Seerr user linked to Emby user $1; the request is made in the name of the API key', 'Seerr: kein Seerr-Benutzer mit Emby-Benutzer $1 verknüpft; die Anfrage läuft im Namen des API-Schlüssels'],
        [/^Seerr: 4K-aanvraag voor /, 'Seerr: 4K request for ', 'Seerr: 4K-Anfrage für '],
        [/^Seerr: uit Sonarr halen mislukt voor /, 'Seerr: removing from Sonarr failed for ', 'Seerr: Entfernen aus Sonarr fehlgeschlagen für '],
        [/^Seerr aanvraag opzoeken \(/, 'looking up the Seerr request failed (', 'Seerr-Anfrage nachschlagen fehlgeschlagen ('],
        [/^Seerr aanvraag (.*) opnieuw proberen: gelukt$/, 'retrying Seerr request $1: succeeded', 'Seerr-Anfrage $1 erneut versucht: erfolgreich'],
        [/^Seerr aanvraag (.*) opnieuw proberen: mislukt /, 'retrying Seerr request $1: failed ', 'Seerr-Anfrage $1 erneut versucht: fehlgeschlagen '],
        [/^Seerr serie (\d+) aangevraagd/, 'Seerr series $1 requested', 'Seerr-Serie $1 angefragt'],
        [/^Seerr film (\d+) aangevraagd/, 'Seerr movie $1 requested', 'Seerr-Film $1 angefragt'],
        [/^Seerr serie /, 'Seerr series ', 'Seerr-Serie '],
        [/^Seerr film /, 'Seerr movie ', 'Seerr-Film '],
        [/^serie (\d+) aangevraagd/, 'series $1 requested', 'Serie $1 angefragt'],
        [/^opgevraagd: map=/, 'requested: folder=', 'abgefragt: Ordner='],
        [/^teruggegeven: map=/, 'returned: folder=', 'zurückgegeben: Ordner=']
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
        language = value.indexOf('de') === 0 ? 'de' : value.indexOf('nl') === 0 ? 'nl' : (value.indexOf('nb') === 0 || value.indexOf('nn') === 0 || value.indexOf('no') === 0) ? 'no' : 'en';
    }

    function translatePage(view) {
        view.querySelector('h2').textContent = t('status.discover_status');
        view.querySelector('.fieldDescription').textContent = t('status.checks_everything_discover_needs_the_plugin');
        view.querySelector('.dsRefresh span').textContent = t('status.check_again');
        view.querySelector('.dsCopy span').textContent = t('status.copy_report');
    }

    function getJson(path, query) {
        return ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl(path, query || {}), dataType: 'json' });
    }
    // Teksten komen van de server (Discover/Home of Discover/Status), op sleutel, in de taal van de kijker.
    // Zonder tabel valt t() terug op de sleutel zelf; dat is lelijk maar breekt niets.
    // <fallback-en> automatisch gevuld door tools/sync-js-fallback.py; niet met de hand aanpassen
    var STR_EN = {
        "status.at": "at ",
        "status.button_script_in_this_browser_build": "Button script in this browser: build ",
        "status.channel": "Channel",
        "status.channel_2": "Channel \"",
        "status.channel_requests_by_emby": "Channel requests by Emby: ",
        "status.check_again": "Check again",
        "status.check_the_emby_startup_log": "Check the Emby startup log.",
        "status.checking": "Checking...",
        "status.checks_everything_discover_needs_the_plugin": "Checks everything Discover needs: the plugin, channel, TMDB, Radarr, Sonarr, and clip file. Run this on each server and compare the results. API keys are never shown.",
        "status.configured": "configured: ",
        "status.confirmation_clip_could_not_be_written": "Confirmation clip could not be written: ",
        "status.confirmation_clip_is_ready": "Confirmation clip is ready: ",
        "status.connections_from_the_server_using_saved": "Connections (from the server, using saved settings)",
        "status.copied": "Copied",
        "status.copy_report": "Copy report",
        "status.could_not_check": "Could not check: ",
        "status.diagnostics_on_discover_item_pages": "Diagnostics on Discover/item pages: ",
        "status.differs_from_the_server_reload_the_page": "DIFFERS from the server: reload the page (Ctrl+F5)",
        "status.discover_channel_discover_media_or_films": "Discover channel (Discover Media or Films & Series Aanvragen) is missing from the channel list. Known channels: ",
        "status.discover_is_not_in_the_list_of_loaded_plugins": "Discover is not in the list of loaded plugins. The DLL was not loaded (wrong folder, restart required, or incompatible with this Emby version).",
        "status.discover_service_available_dll_version": "Discover service available, DLL version ",
        "status.discover_status": "Discover status",
        "status.dll_file_modified": "DLL file modified ",
        "status.does_not_exist_there_different_server": " does not exist there (different server?)",
        "status.does_not_exist_there_different_server_2": "\" does not exist there (different server?)",
        "status.emby": "Emby",
        "status.emby_is_waiting_for_a_restart_the_new_plugin": "Emby is waiting for a restart (the new plugin will only be active after restarting).",
        "status.error": "ERROR",
        "status.fix_channel_access": "Fix: User > Access > Channels: enable \"All channels\" or add \"{0}\".",
        "status.get_channels": "Get channels",
        "status.get_emby_version": "Get Emby version",
        "status.get_plugin_list": "Get plugin list",
        "status.get_plugin_status": "Get plugin status",
        "status.get_users": "Get users",
        "status.has_status": " has status \"",
        "status.is_listed_by_emby_and_visible_to_you": "\" is listed by Emby and visible to you.",
        "status.key_configured": "key configured: ",
        "status.loaded": "loaded",
        "status.loaded_at": "loaded at ",
        "status.loader_readonly_detail": "not possible: the web client folder is read-only, so the loader script is not in index.html. The Discover page and the buttons still work once you have opened Discover (the script is then loaded through the plugin). To make the tile go straight to Discover, make the folder writable (Docker: volume without :ro) or enter a writable \"Web client path\". Detail: {0}",
        "status.no_channel_access": "No channel access: ",
        "status.no_key_configured": "no key configured",
        "status.no_saved_settings_found": "No saved settings found.",
        "status.none": "(none)",
        "status.not_loaded_open_discover_or_a_discover_item": "not loaded (open Discover or a Discover item page first)",
        "status.nothing_yet_open_the_discover_channel_in": "(nothing yet - open the Discover channel in Emby and check again)",
        "status.on": "on",
        "status.on_2": "on",
        "status.plugin": "Plugin ",
        "status.plugin_emby_language": "Plugin/Emby language: ",
        "status.profiles": "profiles, ",
        "status.reachable_at": "reachable at ",
        "status.read_settings": "Read settings",
        "status.recent_channel_activity": "Recent channel activity",
        "status.request_button_in_web_client": "Request button in web client: ",
        "status.requests_go_through": "Requests go through: ",
        "status.requests_succeeded_failed": "requests succeeded/failed: ",
        "status.root_folders": "root folders",
        "status.saved_quality_profile": "saved quality profile ",
        "status.saved_root_folder": "saved root folder \"",
        "status.status": "status: ",
        "status.test_tmdb": "Test TMDB",
        "status.test_x": "Test {0}",
        "status.tile_discover_media_discover_page": "Tile \"Discover Media\" -> Discover page: ",
        "status.tmdb_is_working": "TMDB is working",
        "status.tmdb_language": "TMDB language: ",
        "status.url_or_key_missing": "URL or key missing",
        "status.users_can_see_the_channel": " users can see the channel.",
        "status.who_can_see_the_channel": "Who can see the channel?",
        "status.yes": "yes",
        "ui.no": "NO",
        "ui.of": " of ",
        "ui.unknown": "unknown",
        "ui.unknown_error": "unknown error",
        "web.off": "off"
    };
    // </fallback-en>
    var STR = {};
    function t(key) {
        var s = STR[key];
        if (s == null) { s = STR_EN[key]; }   // nog geen antwoord van de server: Engels in plaats van de sleutel
        if (s == null) { s = key; }
        for (var i = 1; i < arguments.length; i++) { s = s.split('{' + (i - 1) + '}').join(String(arguments[i])); }
        return s;
    }
    function viewerLang() {
        try { return (document.documentElement && document.documentElement.lang) || navigator.language || ''; } catch (e) { return ''; }
    }


    function postJson(path, data) {
        return ApiClient.ajax({
            type: 'POST', url: ApiClient.getUrl(path), data: JSON.stringify(data),
            contentType: 'application/json', dataType: 'json'
        });
    }

    var discoverChannelIdFromServer = null;
    var discoverChannelName = null;   // gevuld via Discover/ChannelInfo (werkt ook bij een hernoemd kanaal)
    function isDiscoverChannel(channel) {
        if (channel && discoverChannelIdFromServer && String(channel.Id) === String(discoverChannelIdFromServer)) { return true; }
        var name = String(channel && channel.Name || '').trim();
        return /discover/i.test(name) || /^films\s*&\s*series\s+aanvragen$/i.test(name);
    }

    function errText(e) {
        if (!e) { return t('ui.unknown_error'); }
        if (e.status) { return 'HTTP ' + e.status + (e.statusText ? ' ' + e.statusText : ''); }
        return String(e.message || e);
    }

    // Voert een stap uit en vangt elke fout af, zodat een mislukte stap de rest niet blokkeert.
    function step(lines, title, fn) {
        return Promise.resolve().then(fn).then(function (r) {
            return r;
        }, function (e) {
            lines.push('[' + t('status.error') + '] ' + title + ': ' + errText(e));
            return null;
        });
    }

    function ok(lines, message) { lines.push('[ OK ] ' + message); }
    function bad(lines, message) { lines.push('[' + t('status.error') + '] ' + message); }
    function info(lines, text) { lines.push('       ' + text); }
    function warn(lines, message) { lines.push('[ ! ]  ' + message); }

    // De server stuurt deze regel al in de taal van de kijker.
    function translateButtonScript(value) { return value; }

    function run(view, out) {
        var lines = [];
        out.textContent = t('status.checking');
        var cfg = null, users = [], adminId = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();

        return getJson('Discover/Status', { Lang: viewerLang() }).then(function (initialStatus) {
            if (initialStatus && initialStatus.Strings) { STR = initialStatus.Strings; }
            window.__discoverStatus = initialStatus;
            setLanguage(initialStatus.PluginLanguage);
            translatePage(view);
            return step(lines, t('status.get_emby_version'), function () {
            return getJson('System/Info').then(function (i) {
                lines.push('== ' + t('status.emby') + ' ==');
                ok(lines, 'Emby Server ' + i.Version + ' ' + t('status.on') + ' ' + (i.OperatingSystemDisplayName || i.OperatingSystem || '?'));
                if (i.HasPendingRestart) { bad(lines, t('status.emby_is_waiting_for_a_restart_the_new_plugin')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== Plugin ==');
            return step(lines, t('status.get_plugin_list'), function () {
                return getJson('Plugins').then(function (list) {
                    var mine = (list || []).filter(function (p) { return String(p.Id || '').toLowerCase().replace(/-/g, '') === pluginId.replace(/-/g, ''); })[0];
                    if (!mine) { bad(lines, t('status.discover_is_not_in_the_list_of_loaded_plugins')); return; }
                    var status = mine.Status || mine.PluginStatus || '';
                    if (/malfunction|disabled|restart|notsupported|superseded|deleted/i.test(status)) { bad(lines, t('status.plugin') + mine.Version + t('status.has_status') + status + '". ' + t('status.check_the_emby_startup_log')); }
                    else { ok(lines, t('status.plugin') + mine.Version + ' ' + t('status.loaded') + (status ? ' (' + t('status.status') + status + ')' : '')); }
                });
            });
        }).then(function () {
            return step(lines, t('status.get_plugin_status'), function () {
                return getJson('Discover/Status', { Lang: viewerLang() }).then(function (r) {
                if (r && r.Strings) { STR = r.Strings; }
                    window.__discoverStatus = r;
                    ok(lines, t('status.discover_service_available_dll_version') + r.PluginVersion + ' (build ' + (r.ScriptBuild || '?') + '), ' + t('status.loaded_at') + r.LoadedAt + '; ' + t('status.dll_file_modified') + (r.DllBuilt || '?'));
                    info(lines, t('status.button_script_in_this_browser_build') + (window.__discoverRequestButtonBuild || t('status.not_loaded_open_discover_or_a_discover_item')) +
                        (window.__discoverRequestButtonBuild && r.ScriptBuild && window.__discoverRequestButtonBuild !== r.ScriptBuild ? ' - ' + t('status.differs_from_the_server_reload_the_page') : ''));
                    (r.TmdbKeySet ? ok : bad)(lines, 'TMDB ' + t('status.key_configured') + (r.TmdbKeySet ? t('status.yes') : t('ui.no')));
                    info(lines, t('status.plugin_emby_language') + r.PluginLanguage + '; ' + t('status.tmdb_language') + r.TmdbLanguage);
                    info(lines, t('status.diagnostics_on_discover_item_pages') + (r.ShowDiagnostics ? t('status.on_2') : t('web.off')));
                    if (r.RequestService === 'Seerr' || r.RequestService === 'Ombi') {
                        info(lines, t('status.requests_go_through') + r.RequestService);
                        (r.RadarrSet ? ok : bad)(lines, r.RequestService + ' ' + t('status.configured') + (r.RadarrSet ? t('status.yes') : t('ui.no')));
                    } else {
                        (r.RadarrSet ? ok : bad)(lines, 'Radarr ' + t('status.configured') + (r.RadarrSet ? t('status.yes') : t('ui.no')));
                        (r.SonarrSet ? ok : bad)(lines, 'Sonarr ' + t('status.configured') + (r.SonarrSet ? t('status.yes') : t('ui.no')));
                    }
                    if (r.ClipError) { bad(lines, t('status.confirmation_clip_could_not_be_written') + r.ClipError); }
                    else { ok(lines, t('status.confirmation_clip_is_ready') + r.ClipPath); }
                    if (r.ButtonScript && /^OK/.test(r.ButtonScript)) { ok(lines, t('status.request_button_in_web_client') + translateButtonScript(r.ButtonScript)); }
                    else { bad(lines, t('status.request_button_in_web_client') + translateButtonScript(r.ButtonScript || t('ui.unknown'))); }
                    var wi = r.WebInject || t('ui.unknown');
                    var wiLabel = t('status.tile_discover_media_discover_page');
                    if (/^(actief|al actief)/.test(wi)) { ok(lines, wiLabel + wi); }
                    else if (/^alleen-lezen/.test(wi)) {
                        warn(lines, wiLabel + t('status.loader_readonly_detail', wi));
                    }
                    else if (/^(fout|webclient niet gevonden)/.test(wi)) { bad(lines, wiLabel + wi); }
                    else { info(lines, wiLabel + wi); }
                    info(lines, t('status.channel_requests_by_emby') + r.ChannelCalls + 'x; ' + t('status.requests_succeeded_failed') + (r.Requests - r.RequestErrors) + '/' + r.RequestErrors);
                });
            });
        }).then(function () {
            return step(lines, t('status.read_settings'), function () {
                return ApiClient.getPluginConfiguration(pluginId).then(function (c) { cfg = c; });
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + t('status.connections_from_the_server_using_saved') + ' ==');
            if (!cfg) { bad(lines, t('status.no_saved_settings_found')); return; }
            var tests = [];
            tests.push(step(lines, t('status.test_tmdb'), function () {
                if (!cfg.TmdbApiKey) { bad(lines, 'TMDB: ' + t('status.no_key_configured')); return; }
                return postJson('Discover/TestConnection', { Type: 'Tmdb', ApiKey: cfg.TmdbApiKey }).then(function (r) {
                    if (r && r.Success) { ok(lines, t('status.tmdb_is_working')); } else { bad(lines, 'TMDB: ' + ((r && r.Error) || t('ui.unknown_error'))); }
                });
            }));
            if (cfg.RequestService === 'seerr' || cfg.RequestService === 'ombi') {
                (function () {
                    var name = cfg.RequestService === 'ombi' ? 'Ombi' : 'Seerr';
                    var url = cfg.RequestService === 'ombi' ? cfg.OmbiUrl : cfg.SeerrUrl;
                    var key = cfg.RequestService === 'ombi' ? cfg.OmbiApiKey : cfg.SeerrApiKey;
                    tests.push(step(lines, t('status.test_x', name), function () {
                        if (!url || !key) { bad(lines, name + ': ' + t('status.url_or_key_missing')); return; }
                        return postJson('Discover/TestConnection', { Type: name, Url: url, ApiKey: key }).then(function (r) {
                            if (r && r.Success) { ok(lines, name + ' ' + String(r.Version || '').split('|')[0] + ' ' + t('status.reachable_at') + url); }
                            else { bad(lines, name + ' ' + t('status.at') + url + ': ' + ((r && r.Error) || t('ui.unknown_error'))); }
                        });
                    }));
                })();
            }
            // Radarr en Sonarr worden ook getest als ze naast Ombi/Seerr zijn ingevuld (voor status en voortgang).
            ((cfg.RequestService === 'seerr' || cfg.RequestService === 'ombi') && !cfg.SeerrArrStatus ? [] : ['Radarr', 'Sonarr']).forEach(function (kind) {
                tests.push(step(lines, t('status.test_x', kind), function () {
                    var url = cfg[kind + 'Url'], key = cfg[kind + 'ApiKey'];
                    if (!url || !key) { bad(lines, kind + ': ' + t('status.url_or_key_missing')); return; }
                    return postJson('Discover/TestConnection', { Type: kind, Url: url, ApiKey: key }).then(function (r) {
                        if (r && r.Success) {
                            ok(lines, kind + ' ' + (r.Version || '') + ' ' + t('status.reachable_at') + url + ' (' + (r.Profiles || []).length + ' ' + t('status.profiles') + (r.RootFolders || []).length + ' ' + t('status.root_folders') + ')');
                            var pid = cfg[kind + 'QualityProfileId'];
                            if (pid && !(r.Profiles || []).some(function (p) { return p.Id === pid; })) { bad(lines, kind + ': ' + t('status.saved_quality_profile') + pid + t('status.does_not_exist_there_different_server')); }
                            var root = cfg[kind + 'RootFolder'];
                            if (root && !(r.RootFolders || []).some(function (f) { return f.Path === root; })) { bad(lines, kind + ': ' + t('status.saved_root_folder') + root + t('status.does_not_exist_there_different_server_2')); }
                        } else {
                            bad(lines, kind + ' ' + t('status.at') + url + ': ' + ((r && r.Error) || t('ui.unknown_error')));
                        }
                    });
                }));
            });
            return Promise.all(tests);
        }).then(function () {
            lines.push('');
            lines.push('== ' + t('status.channel') + ' ==');
            return step(lines, t('status.get_channels'), function () {
                return getJson('Discover/ChannelInfo').then(function (ci) { discoverChannelIdFromServer = ci && ci.Id; discoverChannelName = ci && ci.Name; }, function () { })
                    .then(function () { return getJson('Channels', { UserId: adminId }); }).then(function (r) {
                    var names = (r.Items || []).map(function (c) { return c.Name; });
                    var found = (r.Items || []).filter(isDiscoverChannel)[0];
                    if (found) { ok(lines, t('status.channel_2') + found.Name + t('status.is_listed_by_emby_and_visible_to_you')); }
                    else { bad(lines, t('status.discover_channel_discover_media_or_films') + (names.join(', ') || t('status.none'))); }
                });
            });
        }).then(function () {
            return step(lines, t('status.get_users'), function () {
                return getJson('Users').then(function (list) { users = list || []; });
            });
        }).then(function () {
            if (!users.length) { return; }
            lines.push('');
            lines.push('== ' + t('status.who_can_see_the_channel') + ' ==');
            return Promise.all(users.map(function (u) {
                return getJson('Channels', { UserId: u.Id }).then(function (r) {
                    var has = (r.Items || []).some(isDiscoverChannel);
                    return { name: u.Name, has: has };
                }, function () { return { name: u.Name, has: null }; });
            })).then(function (res) {
                var without = res.filter(function (x) { return x.has === false; }).map(function (x) { return x.name; });
                var unknown = res.filter(function (x) { return x.has === null; }).map(function (x) { return x.name; });
                var withCount = res.filter(function (x) { return x.has; }).length;
                ok(lines, withCount + t('ui.of') + res.length + t('status.users_can_see_the_channel'));
                if (without.length) {
                    bad(lines, t('status.no_channel_access') + without.join(', '));
                    var chn = discoverChannelName || 'Discover Media';
                    info(lines, t('status.fix_channel_access', chn));
                }
                if (unknown.length) { info(lines, t('status.could_not_check') + unknown.join(', ')); }
            });
        }).then(function () {
            lines.push('');
            lines.push('== ' + t('status.recent_channel_activity') + ' ==');
            var r = window.__discoverStatus;
            if (!r || !r.Events || !r.Events.length) { info(lines, t('status.nothing_yet_open_the_discover_channel_in')); }
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
            run(view, out)['catch'](function (e) { out.textContent += '\n[' + t('status.error') + '] ' + errText(e); });
        }

        view.querySelector('.dsRefresh').addEventListener('click', load);
        view.querySelector('.dsCopy').addEventListener('click', function () {
            var reportText = out.textContent;
            var done = function () { var b = view.querySelector('.dsCopy span'); b.textContent = t('status.copied'); setTimeout(function () { b.textContent = t('status.copy_report'); }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(reportText).then(done, function () { }); return; }
            var ta = document.createElement('textarea'); ta.value = reportText; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { } document.body.removeChild(ta);
        });
        view.addEventListener('viewshow', load);
    };
});
