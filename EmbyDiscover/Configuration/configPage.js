define(['emby-input', 'emby-button', 'emby-select', 'emby-checkbox'], function () {
    'use strict';

    var pluginId = "7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90";
    var configLanguage = 'nl';

    function languageText(dutch, english, german, norwegian) {
        return configLanguage === 'de' ? (german || english) : configLanguage === 'no' ? (norwegian || english) : configLanguage === 'en' ? english : dutch;
    }

    function languageCode(locale) {
        var culture = String(locale || '').toLowerCase();
        return culture.indexOf('nl') === 0 ? 'nl-NL' : culture.indexOf('de') === 0 ? 'de-DE' : 'en-US';
    }

    function selectedAutoTmdbLanguage(view, state) {
        var pluginLanguage = el(view, 'selPluginLanguage').value;
        return pluginLanguage === 'auto'
            ? (state.autoTmdbLanguage || languageCode(window.navigator && navigator.language))
            : languageCode(pluginLanguage);
    }

    // Themakleur: gewone <select> (emby-select rendert op sommige browsers/tv's leeg) + kleurblokje.
    function setAccent(view, hex) {
        var sel = el(view, 'selAccent');
        if (!sel.querySelector('option[value="' + hex + '"]')) { var o = document.createElement('option'); o.value = hex; o.textContent = '#' + hex; sel.appendChild(o); }
        sel.value = hex;
        var pv = el(view, 'accentPreview');
        if (pv) { pv.style.background = '#' + hex; }
    }

    function updateAutoTmdbOption(view, state) {
        var option = el(view, 'selTmdbLang').options[0];
        if (!option) { return; }
        var current = state
            ? selectedAutoTmdbLanguage(view, state)
            : languageCode(window.navigator && navigator.language);
        option.textContent = languageText(
            current + ' (automatisch volgen)',
            current + ' (automatic)',
            current + ' (automatisch)');
    }

    // Teksten van de tabbladen en de nieuwe instellingen: id -> [Nederlands, English, Deutsch]
    var TEXTS = {
        tab_general: ['Algemeen', 'General', 'Allgemein'],
        tab_look: ['Weergave', 'Appearance', 'Darstellung'],
        hdgLook: ['Kleur en posters', 'Colour and posters', 'Farbe und Poster'],
        lbl_selAccent: ['Themakleur (knoppen, focus en accenten)', 'Theme colour (buttons, focus and accents)', 'Themenfarbe (Schaltflächen, Fokus und Akzente)'],
        desc_selAccent: ['Geldt voor iedereen op deze server: de Discover-pagina, de popup en de rijen op Emby\'s eigen pagina\'s.', 'Applies to everyone on this server: the Discover page, the popup and the rows on Emby\'s own pages.', 'Gilt für alle auf diesem Server: die Discover-Seite, das Popup und die Reihen auf Embys eigenen Seiten.'],
        optAccent0: ['Geel (standaard)', 'Yellow (default)', 'Gelb (Standard)'],
        optAccent1: ['Emby-groen', 'Emby green', 'Emby-Grün'],
        optAccent2: ['Blauw', 'Blue', 'Blau'],
        optAccent3: ['Turquoise', 'Teal', 'Türkis'],
        optAccent4: ['Paars', 'Purple', 'Lila'],
        optAccent5: ['Roze', 'Pink', 'Rosa'],
        optAccent6: ['Rood', 'Red', 'Rot'],
        optAccent7: ['Oranje', 'Orange', 'Orange'],
        optAccent8: ['Wit', 'White', 'Weiß'],
        lbl_chkPosterYear: ['Jaar onder de posters', 'Year below the posters', 'Jahr unter den Postern'],
        lbl_chkShowSpecials: ['Specials tonen bij de seizoenkeuze', 'Show Specials in the season choice', 'Specials bei der Staffelauswahl anzeigen'],
        lbl_chkShowTitleLogo: ['Titellogo bovenaan de popup (anders de titel als tekst)', 'Title logo at the top of the popup (otherwise the title as text)', 'Titellogo oben im Popup (sonst der Titel als Text)'],
        lbl_selPosterScore: ['Score onder de posters', 'Score below the posters', 'Bewertung unter den Postern'],
        optScore0: ['TMDB-score', 'TMDB score', 'TMDB-Bewertung'],
        optScore1: ['IMDb-score', 'IMDb score', 'IMDb-Bewertung'],
        optScore2: ['Geen score', 'No score', 'Keine Bewertung'],
        desc_selPosterScore: ['IMDb-score komt uit de gratis IMDb-dataset (alleen voor niet-commercieel gebruik), geen API-sleutel nodig; de server downloadt die zelf en ververst wekelijks. Zonder IMDb-gegevens wordt de TMDB-score getoond.', 'The IMDb score comes from the free IMDb dataset (non-commercial use only), no API key needed; the server downloads it itself and refreshes it weekly. Without IMDb data the TMDB score is shown.', 'Die IMDb-Bewertung stammt aus dem kostenlosen IMDb-Datensatz (nur nicht-kommerzielle Nutzung), kein API-Schlüssel nötig; der Server lädt ihn selbst herunter und aktualisiert wöchentlich. Ohne IMDb-Daten wird die TMDB-Bewertung gezeigt.'],
        lbl_chkPosterScore: ['TMDB-score onder de posters', 'TMDB score below the posters', 'TMDB-Bewertung unter den Postern'],
        hdgOmdb: ['OMDb (IMDb, Rotten Tomatoes, Metacritic)', 'OMDb (IMDb, Rotten Tomatoes, Metacritic)', 'OMDb (IMDb, Rotten Tomatoes, Metacritic)'],
        lbl_txtOmdbKey: ['OMDb API-sleutel (optioneel)', 'OMDb API key (optional)', 'OMDb-API-Schlüssel (optional)'],
        desc_txtOmdbKey: ['Gratis aan te vragen op omdbapi.com (1000 opvragingen per dag). Daarmee toont de popup ook de scores van IMDb, Rotten Tomatoes en Metacritic. Leeg = alleen de TMDB-score.', 'Free from omdbapi.com (1000 requests per day). With it the popup also shows the IMDb, Rotten Tomatoes and Metacritic scores. Empty = TMDB score only.', 'Kostenlos bei omdbapi.com (1000 Abfragen pro Tag). Damit zeigt das Popup auch die Bewertungen von IMDb, Rotten Tomatoes und Metacritic. Leer = nur die TMDB-Bewertung.'],
        btnTestOmdbText: ['Test OMDb', 'Test OMDb', 'OMDb testen'],
        btnTestMdblistText: ['Test MDBList', 'Test MDBList', 'MDBList testen'],
        lbl_txtMdblistKey: ['MDBList API-sleutel (optioneel)', 'MDBList API key (optional)', 'MDBList-API-Schlüssel (optional)'],
        desc_txtMdblistKey: ['Gratis op mdblist.com (Preferences, API Access). Geeft in de popup de scores van IMDb, Rotten Tomatoes (critici en publiek), Metacritic, Letterboxd en Trakt. Staat hier een sleutel, dan gaat MDBList voor OMDb; OMDb blijft de reserve.', 'Free at mdblist.com (Preferences, API Access). Gives the popup the scores of IMDb, Rotten Tomatoes (critics and audience), Metacritic, Letterboxd and Trakt. With a key here MDBList comes before OMDb; OMDb stays the fallback.', 'Kostenlos auf mdblist.com (Preferences, API Access). Liefert im Popup die Bewertungen von IMDb, Rotten Tomatoes (Kritiker und Publikum), Metacritic, Letterboxd und Trakt. Mit einem Schlüssel hier geht MDBList vor OMDb; OMDb bleibt die Reserve.'],
        hdgUpdates: ['Updates', 'Updates', 'Updates'],
        lbl_chkUpdateCheck: ['Dagelijks kijken of er een nieuwe versie is', 'Check daily for a new version', 'Täglich nach einer neuen Version suchen'],
        lbl_chkUpdateBeta: ['Ook testversies (beta)', 'Include test versions (beta)', 'Auch Testversionen (Beta)'],
        desc_chkUpdateBeta: ['Testversies zijn nieuwer maar minder getest.', 'Test versions are newer but less tested.', 'Testversionen sind neuer, aber weniger getestet.'],
        lbl_chkUpdateAuto: ["Nieuwe versie 's nachts automatisch installeren", 'Install new versions automatically at night', 'Neue Versionen nachts automatisch installieren'],
        lbl_chkUpdateRestart: ['Daarna Emby automatisch herstarten als niemand iets kijkt', 'Then restart Emby automatically when nobody is watching', 'Danach Emby automatisch neu starten, wenn niemand schaut'],
        desc_chkUpdateRestart: ['Zonder dit vinkje wordt de update actief bij de volgende herstart van Emby.', 'Without this, the update becomes active the next time Emby restarts.', 'Ohne diese Option wird das Update beim nächsten Neustart von Emby aktiv.'],
        lbl_chkAllowInvalidCerts: ['Zelfondertekende certificaten accepteren (https)', 'Accept self-signed certificates (https)', 'Selbstsignierte Zertifikate akzeptieren (https)'],
        desc_chkAllowInvalidCerts: ["Voor Radarr, Sonarr, Seerr en de downloadprogramma's via https met een eigen certificaat of via een IP-adres. Alleen aanzetten voor je eigen netwerk.", 'For Radarr, Sonarr, Seerr and the download clients over https with their own certificate or by IP address. Only turn this on for your own network.', 'Für Radarr, Sonarr, Seerr und die Download-Programme über https mit eigenem Zertifikat oder per IP-Adresse. Nur im eigenen Netzwerk einschalten.'],
        lbl_chkShowNextEpisode: ['Volgende aflevering van lopende series in de popup (via TVmaze)', 'Next episode of running series in the popup (via TVmaze)', 'Nächste Folge laufender Serien im Popup (über TVmaze)'],
        lbl_chkShowOmdb: ['Scores van IMDb, Rotten Tomatoes en Metacritic in de popup tonen', 'Show IMDb, Rotten Tomatoes and Metacritic scores in the popup', 'Bewertungen von IMDb, Rotten Tomatoes und Metacritic im Popup zeigen'],
        lbl_txtFanartKey: ['fanart.tv API-sleutel (optioneel)', 'fanart.tv API key (optional)', 'fanart.tv-API-Schlüssel (optional)'],
        desc_txtFanartKey: ['Meestal niet nodig: het titellogo bovenaan de popup komt van TMDB. Alleen als TMDB voor een titel geen logo heeft en hier een sleutel staat, wordt fanart.tv gevraagd. Gratis sleutel: fanart.tv, accountpagina, Personal API Key. De sleutel blijft op de server.', 'Not needed normally: the title logo at the top of the popup comes from TMDB. Only when TMDB has no logo for a title and a key is set here, fanart.tv is asked. Free key: fanart.tv, account page, Personal API Key. The key stays on the server.', 'Normalerweise nicht nötig: Das Titellogo oben im Popup kommt von TMDB. Nur wenn TMDB für einen Titel kein Logo hat und hier ein Schlüssel steht, wird fanart.tv gefragt. Kostenloser Schlüssel: fanart.tv, Kontoseite, Personal API Key. Der Schlüssel bleibt auf dem Server.'],
        hdgTiles: ['Tegels', 'Tiles', 'Kacheln'],
        hdgOwnLists: ['Eigen lijsten als rij', 'Your own lists as a row', 'Eigene Listen als Reihe'],
        tab_tmdb: ['Bronnen', 'Sources', 'Quellen'],
        tab_arr: ['Aanvragen', 'Requests', 'Anfragen'],
        desc_requestService: [
            'Met Seerr gaan aanvragen naar Seerr, en Seerr stuurt ze door naar zijn eigen Radarr en Sonarr. Radarr en Sonarr hoef je hier dan niet in te stellen.',
            'With Seerr, requests go to Seerr, which passes them on to its own Radarr and Sonarr. You then do not need to set up Radarr and Sonarr here.',
            'Mit Seerr gehen Anfragen an Seerr, das sie an sein eigenes Radarr und Sonarr weitergibt. Radarr und Sonarr musst du hier dann nicht einrichten.'],
        desc_seerrKey: ['Te vinden in Seerr onder Instellingen > Algemeen.', 'Found in Seerr under Settings > General.', 'Zu finden in Seerr unter Einstellungen > Allgemein.'],
        desc_seerrAsUser: [
            'Wie in Emby is aangemeld en ook in Seerr bestaat, vraagt aan op zijn eigen Seerr-account (met de rechten, limieten en goedkeuring uit Seerr). Staat iemand niet in Seerr, dan gaat de aanvraag op naam van de eigenaar van de API key.',
            'Whoever is signed in to Emby and also exists in Seerr requests with their own Seerr account (with the permissions, limits and approval from Seerr). If someone is not in Seerr, the request is made as the owner of the API key.',
            'Wer in Emby angemeldet ist und auch in Seerr existiert, fordert mit dem eigenen Seerr-Konto an (mit den Rechten, Limits und Freigaben aus Seerr). Ist jemand nicht in Seerr, wird im Namen des Besitzers des API-Schlüssels angefordert.'],
        tab_users: ['Gebruikers', 'Users', 'Benutzer'],
        tab_storage: ['Opslag', 'Storage', 'Speicher'],
        tab_diag: ['Diagnose', 'Diagnostics', 'Diagnose'],
        desc_users: [
            'Vink aan wie mag aanvragen. Een gebruiker zonder vinkje kan wel bladeren en trailers bekijken, maar een aanvraag wordt niet doorgestuurd naar Radarr of Sonarr en de gebruiker krijgt een melding. Nieuwe gebruikers mogen standaard wel aanvragen.',
            'Tick who may make requests. A user without a tick can still browse and watch trailers, but a request is not sent to Radarr or Sonarr and the user gets a message. New users are allowed by default.',
            'Wähle aus, wer anfordern darf. Ein Benutzer ohne Haken kann weiter stöbern und Trailer ansehen, aber die Anfrage wird nicht an Radarr oder Sonarr gesendet und der Benutzer erhält eine Meldung. Neue Benutzer dürfen standardmäßig anfordern.'],
        hdgExtraRows: ['Extra rijen op de Discover-pagina', 'Extra rows on the Discover page', 'Zusätzliche Reihen auf der Discover-Seite'],
        lbl_chkShowMyRequests: ['Rij "Mijn aanvragen": wat de gebruiker zelf heeft aangevraagd, met de downloadvoortgang', 'Row "My requests": what the user requested, with download progress', 'Reihe „Meine Anfragen“: was der Benutzer angefragt hat, mit Download-Fortschritt'],
        lbl_chkShowNewSeasons: ['Rij "Nieuwe seizoenen": series in je bibliotheek waarvan een nieuw seizoen bestaat dat je nog niet hebt', 'Row "New seasons": series in your library that have a new season you don\'t have yet', 'Reihe „Neue Staffeln“: Serien in deiner Bibliothek mit einer neuen Staffel, die du noch nicht hast'],
        lbl_chkShowRecentlyAdded: ['Rij "Onlangs toegevoegd": wat het laatst in de bibliotheek is gekomen', 'Row "Recently added": what was added to the library most recently', 'Reihe „Kürzlich hinzugefügt“: was zuletzt in die Bibliothek kam'],
        lbl_chkShowRecentRequests: ['Rij "Recente aanvragen": wat iedereen op de server het laatst heeft aangevraagd', 'Row "Recent requests": what everyone on the server requested most recently', 'Reihe „Kürzlich angefragt“: was alle auf dem Server zuletzt angefragt haben'],
        lbl_txtTmdbList: ['TMDB-lijst (id of link, optioneel)', 'TMDB list (id or link, optional)', 'TMDB-Liste (ID oder Link, optional)'],
        desc_txtTmdbList: ['Een openbare lijst op TMDB, bijvoorbeeld je eigen watchlist-lijst. Leeg = geen rij.', 'A public list on TMDB, for example your own watchlist list. Empty = no row.', 'Eine öffentliche Liste auf TMDB, zum Beispiel deine eigene Merkliste. Leer = keine Reihe.'],
        btnTestTmdbListText: ['Test lijst', 'Test list', 'Liste testen'],
        lbl_txtTraktUser: ['Trakt-gebruikersnaam (optioneel)', 'Trakt username (optional)', 'Trakt-Benutzername (optional)'],
        lbl_txtTraktClient: ['Trakt Client ID', 'Trakt Client ID', 'Trakt Client-ID'],
        desc_trakt: [
            'Maak op trakt.tv onder Settings > Your API Apps een app aan (redirect: urn:ietf:wg:oauth:2.0:oob) en plak de Client ID hier. Je watchlist moet openbaar zijn. Leeg = geen rij.',
            'Create an app on trakt.tv under Settings > Your API Apps (redirect: urn:ietf:wg:oauth:2.0:oob) and paste the Client ID here. Your watchlist must be public. Empty = no row.',
            'Erstelle auf trakt.tv unter Settings > Your API Apps eine App (Redirect: urn:ietf:wg:oauth:2.0:oob) und füge die Client-ID hier ein. Deine Merkliste muss öffentlich sein. Leer = keine Reihe.'],
        btnTestTraktText: ['Test Trakt', 'Test Trakt', 'Trakt testen'],
        hdgSab: ['SABnzbd (optioneel)', 'SABnzbd (optional)', 'SABnzbd (optional)'],
        desc_sab: [
            'Met een downloader (SABnzbd, NZBGet, qBittorrent, Transmission) toont de voortgang ook de snelheid en de fases na 100% (verifiëren, repareren, uitpakken, verplaatsen, script); bij NZBGet en SABnzbd ook of de downloader gepauzeerd is of een limiet heeft, bij torrents ook seeders en ratio. Stel alleen in wat je gebruikt; leeg = alleen wat Radarr/Sonarr doorgeven.',
            'With a downloader (SABnzbd, NZBGet, qBittorrent, Transmission) the progress also shows the speed and the stages after 100% (verifying, repairing, unpacking, moving, script); with SABnzbd and NZBGet also whether it is paused or has a limit, with torrents also seeders and ratio. Only set up what you use; empty = only what Radarr/Sonarr report.',
            'Mit einem Downloader (SABnzbd, NZBGet, qBittorrent, Transmission) zeigt der Fortschritt auch Geschwindigkeit und die Phasen nach 100 % (Überprüfen, Reparieren, Entpacken, Verschieben, Skript); bei SABnzbd und NZBGet auch ob pausiert oder begrenzt, bei Torrents auch Seeder und Ratio. Nur einrichten, was du nutzt; leer = nur was Radarr/Sonarr melden.',
            'With SABnzbd the progress also shows the download speed and the stages after 100% (verifying, repairing, unpacking, moving, script), and whether SABnzbd is paused or has a speed limit. Leave empty = only what Radarr/Sonarr report.',
            'Mit SABnzbd zeigt der Fortschritt auch die Downloadgeschwindigkeit und die Phasen nach 100 % (Überprüfen, Reparieren, Entpacken, Verschieben, Skript) sowie ob SABnzbd pausiert ist oder ein Geschwindigkeitslimit hat. Leer lassen = nur was Radarr/Sonarr melden.'],
        desc_sabKey: ['Te vinden in SABnzbd onder Config > General > Security (de gewone API key, niet de NZB key).', 'Found in SABnzbd under Config > General > Security (the normal API key, not the NZB key).', 'Zu finden in SABnzbd unter Config > General > Security (der normale API-Schlüssel, nicht der NZB-Schlüssel).'],
        hdgQbit: ['qBittorrent (optioneel)', 'qBittorrent (optional)', 'qBittorrent (optional)'],
        desc_qbit: ['Gebruikersnaam en wachtwoord van de qBittorrent-webinterface. Staat in qBittorrent de toegang zonder wachtwoord aan voor dit adres, dan mogen ze leeg blijven.', 'Username and password of the qBittorrent web interface. If qBittorrent allows access without a password for this address, they can stay empty.', 'Benutzername und Passwort der qBittorrent-Weboberfläche. Erlaubt qBittorrent für diese Adresse den Zugriff ohne Passwort, können sie leer bleiben.'],
        hdgNzbget: ['NZBGet (optioneel)', 'NZBGet (optional)', 'NZBGet (optional)'],
        desc_nzbget: ['Gebruikersnaam en wachtwoord van NZBGet (Instellingen > Security, ControlUsername en ControlPassword).', 'Username and password of NZBGet (Settings > Security, ControlUsername and ControlPassword).', 'Benutzername und Passwort von NZBGet (Einstellungen > Security, ControlUsername und ControlPassword).'],
        hdgTrans: ['Transmission (optioneel)', 'Transmission (optional)', 'Transmission (optional)'],
        desc_trans: ['Gebruikersnaam en wachtwoord van Transmission; leeg laten als de webinterface geen wachtwoord vraagt.', 'Username and password of Transmission; leave empty if the web interface asks for none.', 'Benutzername und Passwort von Transmission; leer lassen, wenn die Weboberfläche keines verlangt.'],
        hdgLimit: ['Limiet per gebruiker', 'Limit per user', 'Limit pro Benutzer'],
        lbl_numRequestLimit: ['Maximaal aantal aanvragen (0 = geen limiet)', 'Maximum number of requests (0 = no limit)', 'Maximale Anzahl Anfragen (0 = kein Limit)'],
        lbl_numRequestLimitDays: ['Per aantal dagen', 'Per number of days', 'Pro Anzahl Tage'],
        desc_limit: [
            'Geldt voor aanvragen via Discover naar Radarr en Sonarr. Beheerders hebben geen limiet. Met Seerr gelden de limieten die je in Seerr per gebruiker instelt.',
            'Applies to requests through Discover to Radarr and Sonarr. Administrators have no limit. With Seerr, the limits you set per user in Seerr apply.',
            'Gilt für Anfragen über Discover an Radarr und Sonarr. Administratoren haben kein Limit. Mit Seerr gelten die Limits, die du in Seerr pro Benutzer einstellst.'],
        hdgAllRequests: ['Alle aanvragen', 'All requests', 'Alle Anfragen'],
        btnLoadRequestsText: ['Overzicht laden', 'Load overview', 'Übersicht laden'],
        btnAllowAllText: ['Iedereen toestaan', 'Allow everyone', 'Alle zulassen'],
        btnAllowNoneText: ['Niemand toestaan', 'Allow no one', 'Niemanden zulassen'],
        lbl_chkPrecreateCards: ['Kaarten en tegels per titel vooraf maken', 'Pre-create cards and tiles for every title', 'Karten und Kacheln für jeden Titel vorab erstellen'],
        desc_chkPrecreateCards: [
            'Uit (aanbevolen): een bevestigingskaart wordt pas gemaakt als iemand op Afspelen drukt. Aan: bij elke kanaalverversing wordt voor elke titel op de achtergrond een kaart en tegel gemaakt. Dat kost uren ffmpeg-werk en tientallen GB schijfruimte.',
            'Off (recommended): a confirmation card is only made when someone presses Play. On: every channel refresh makes a card and tile for every title in the background. That costs hours of ffmpeg work and tens of GB of disk space.',
            'Aus (empfohlen): Eine Bestätigungskarte wird erst erstellt, wenn jemand auf Wiedergabe drückt. Ein: Bei jeder Kanalaktualisierung werden im Hintergrund für jeden Titel Karte und Kachel erstellt. Das kostet Stunden an ffmpeg-Arbeit und Dutzende GB Speicher.'],
        lbl_numCardDays: ['Kaartclips bewaren (dagen, 0 = onbeperkt)', 'Keep card clips (days, 0 = unlimited)', 'Kartenclips aufbewahren (Tage, 0 = unbegrenzt)'],
        lbl_numTileDays: ['Tegelplaatjes bewaren (dagen, 0 = onbeperkt)', 'Keep tile images (days, 0 = unlimited)', 'Kachelbilder aufbewahren (Tage, 0 = unbegrenzt)'],
        lbl_numMaxCacheMb: ['Maximale grootte kaarten en tegels samen (MB, 0 = geen limiet)', 'Maximum size of cards and tiles together (MB, 0 = no limit)', 'Maximale Größe von Karten und Kacheln zusammen (MB, 0 = keine Grenze)'],
        desc_storage: [
            'De opruiming draait 2 minuten na het opstarten en daarna elke 24 uur. Is de map te groot, dan gaan de oudste bestanden eerst weg. Verwijderde bestanden worden bij gebruik vanzelf opnieuw gemaakt. Sla de instellingen eerst op voordat je opruimt.',
            'Cleanup runs 2 minutes after startup and then every 24 hours. If the folder is too large, the oldest files go first. Deleted files are recreated automatically when needed. Save the settings before you clean up.',
            'Die Bereinigung läuft 2 Minuten nach dem Start und danach alle 24 Stunden. Ist der Ordner zu groß, werden die ältesten Dateien zuerst gelöscht. Gelöschte Dateien werden bei Bedarf automatisch neu erstellt. Speichere die Einstellungen, bevor du bereinigst.'],
        btnCleanNowText: ['Nu opruimen', 'Clean up now', 'Jetzt bereinigen'],
        btnClearAllText: ['Alles verwijderen', 'Delete everything', 'Alles löschen']
    };

    function applyTexts(view) {
        Object.keys(TEXTS).forEach(function (id) {
            var target = el(view, id);
            if (target) { target.textContent = languageText(TEXTS[id][0], TEXTS[id][1], TEXTS[id][2]); }
        });
    }

    function applyLanguage(view, locale) {
        var culture = String(locale || '').toLowerCase();
        configLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : (culture.indexOf('nb') === 0 || culture.indexOf('nn') === 0 || culture.indexOf('no') === 0) ? 'no' : 'en';
        var hdgRadarr = el(view, 'hdgRadarr');
        if (hdgRadarr) { hdgRadarr.textContent = languageText('Radarr (films)', 'Radarr (movies)', 'Radarr (Filme)'); }
        var hdgSonarr = el(view, 'hdgSonarr');
        if (hdgSonarr) { hdgSonarr.textContent = languageText('Sonarr (series)', 'Sonarr (series)', 'Sonarr (Serien)'); }
        applyTexts(view);

        function label(id, dutch, english, german) {
            var target = view.querySelector('label[for="' + id + '"]');
            if (target) { target.textContent = languageText(dutch, english, german); }
        }

        label('txtTmdbKey', 'API key', 'API key', 'API-Schlüssel');
        label('selRequestService', 'Aanvragen via', 'Send requests to', 'Anfragen senden an');
        label('txtSeerrUrl', 'URL (bijv. http://192.168.1.10:5055)', 'URL (e.g. http://192.168.1.10:5055)', 'URL (z. B. http://192.168.1.10:5055)');
        label('txtSeerrKey', 'API key', 'API key', 'API-Schlüssel');
        label('txtSabUrl', 'URL (bijv. http://192.168.1.10:8080)', 'URL (e.g. http://192.168.1.10:8080)', 'URL (z. B. http://192.168.1.10:8080)');
        label('txtSabKey', 'API key', 'API key', 'API-Schlüssel');
        label('txtQbitUrl', 'URL (bijv. http://192.168.1.10:8080)', 'URL (e.g. http://192.168.1.10:8080)', 'URL (z. B. http://192.168.1.10:8080)');
        label('txtQbitUser', 'Gebruikersnaam', 'Username', 'Benutzername');
        label('txtQbitPass', 'Wachtwoord', 'Password', 'Passwort');
        var qbitTest = view.querySelector('.btnTestQbit span');
        if (qbitTest) { qbitTest.textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen'); }
        label('txtNzbgetUrl', 'URL (bijv. http://192.168.1.10:6789)', 'URL (e.g. http://192.168.1.10:6789)', 'URL (z. B. http://192.168.1.10:6789)');
        label('txtNzbgetUser', 'Gebruikersnaam', 'Username', 'Benutzername');
        label('txtNzbgetPass', 'Wachtwoord', 'Password', 'Passwort');
        var nzbgetTest = view.querySelector('.btnTestNzbget span');
        if (nzbgetTest) { nzbgetTest.textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen'); }
        label('txtTransUrl', 'URL (bijv. http://192.168.1.10:9091)', 'URL (e.g. http://192.168.1.10:9091)', 'URL (z. B. http://192.168.1.10:9091)');
        label('txtTransUser', 'Gebruikersnaam', 'Username', 'Benutzername');
        label('txtTransPass', 'Wachtwoord', 'Password', 'Passwort');
        var transTest = view.querySelector('.btnTestTrans span');
        if (transTest) { transTest.textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen'); }
        var sabTest = view.querySelector('.btnTestSab span');
        if (sabTest) { sabTest.textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen'); }
        var serviceSelect = el(view, 'selRequestService');
        if (serviceSelect && serviceSelect.options.length > 1) {
            serviceSelect.options[0].textContent = languageText('Radarr & Sonarr (rechtstreeks)', 'Radarr & Sonarr (directly)', 'Radarr & Sonarr (direkt)');
        }
        if (serviceSelect && serviceSelect.options.length > 2) {
            serviceSelect.options[2].textContent = languageText('Seerr + Radarr & Sonarr (voor de status)', 'Seerr + Radarr & Sonarr (for the status)', 'Seerr + Radarr & Sonarr (für den Status)');
        }
        var seerrTest = view.querySelector('.btnTestSeerr span');
        if (seerrTest) { seerrTest.textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen'); }
        label('selPluginLanguage', 'Plugin-taal', 'Plugin language', 'Plugin-Sprache');
        label('selTmdbLang', 'TMDB-taal', 'TMDB language', 'TMDB-Sprache');
        var diagLabel = el(view, 'lbl_chkShowDiagnostics');
        if (diagLabel) {
            diagLabel.textContent = languageText(
                'Toon het gele debugbericht en media-informatie op itempagina\'s',
                'Show the yellow debug message and media information on item pages',
                'Gelbe Diagnosemeldung und Medieninformationen auf Detailseiten anzeigen');
        }
        var exclLabel = view.querySelector('#lbl_txtExcludedLangs');
        if (exclLabel) {
            exclLabel.textContent = languageText('Talen uitsluiten (oorspronkelijke taal)', 'Exclude languages (original language)', 'Sprachen ausschlie\u00dfen (Originalsprache)');
            view.querySelector('#desc_txtExcludedLangs').textContent = languageText(
                'Titels met deze oorspronkelijke taal verschijnen niet in de rijen en mappen. Gebruik taalcodes, gescheiden door komma\'s, bijv. ja (Japans), ko (Koreaans), zh (Chinees), hi (Hindi), ta (Tamil), te (Telugu), th (Thai), tr (Turks). Zoeken toont ze nog wel.',
                'Titles with these original languages are hidden from rows and folders. Use language codes separated by commas, e.g. ja (Japanese), ko (Korean), zh (Chinese), hi (Hindi), ta (Tamil), te (Telugu), th (Thai), tr (Turkish). Search still shows them.',
                'Titel mit diesen Originalsprachen werden in Reihen und Ordnern ausgeblendet. Sprachcodes durch Kommas getrennt, z. B. ja (Japanisch), ko (Koreanisch), zh (Chinesisch), hi (Hindi), ta, te, th, tr. Die Suche zeigt sie weiterhin.');
        }
        var trailerLabel = view.querySelector('#lbl_chkShowTrailerTile');
        if (trailerLabel) {
            trailerLabel.textContent = languageText(
                'Toon de tegel Trailer naast Aanvragen (kanaal en Discover-pagina)',
                'Show the Trailer tile next to Request (channel and Discover page)',
                'Trailer-Kachel neben Anfragen anzeigen (Kanal und Discover-Seite)');
        }
        var injectLabel = view.querySelector('#lbl_chkInjectWebClientLoader');
        if (injectLabel) {
            injectLabel.textContent = languageText(
                'Tegel opent Discover-pagina',
                'Tile opens Discover page',
                'Kachel öffnet Discover-Seite');
        }
        var injectDesc = view.querySelector('#desc_chkInjectWebClientLoader');
        if (injectDesc) {
            injectDesc.textContent = languageText(
                'Alleen in de webclient (browser): de tegel "Discover Media" opent direct de Discover-pagina. Dit voegt een klein lader-script toe aan de index.html van de webclient. Na opslaan werkt het direct, zonder herstart. Uitgeschakeld opent de tegel gewoon de kanaaltegels (het script blijft staan maar doet dan niets). De Emby-apps (tv, mobiel) merken hier niets van; daar werkt Discover via het kanaal.',
                'Web client (browser) only: the "Discover Media" tile opens the Discover page directly. This adds a small loader script to the web client\'s index.html. It takes effect right after saving, no restart needed. When turned off, the tile simply opens the channel tiles (the script stays in place but does nothing). The Emby apps (TV, mobile) are not affected; there Discover works through the channel.',
                'Nur im Webclient (Browser): Die Kachel „Discover Media“ öffnet direkt die Discover-Seite. Dafür wird ein kleines Loader-Skript in die index.html des Webclients eingefügt. Nach dem Speichern wirkt es sofort, ohne Neustart. Ausgeschaltet öffnet die Kachel einfach die Kanal-Kacheln (das Skript bleibt, tut dann aber nichts). Die Emby-Apps (TV, Mobil) sind nicht betroffen; dort funktioniert Discover über den Kanal.');
        }
        label('txtRadarrUrl', 'URL (bijv. http://192.168.1.10:7878)', 'URL (e.g. http://192.168.1.10:7878)', 'URL (z. B. http://192.168.1.10:7878)');
        label('txtRadarrKey', 'API key', 'API key', 'API-Schlüssel');
        label('selRadarrProfile', 'Quality profile', 'Quality profile', 'Qualitätsprofil');
        label('selRadarrRoot', 'Root folder', 'Root folder', 'Stammordner');
        label('selRadarrAvail', 'Minimale beschikbaarheid', 'Minimum availability', 'Mindestverfügbarkeit');
        (function () {
            var d = view.querySelector('#descRadarrAvail');
            if (d) { d.textContent = languageText('Wanneer Radarr een nieuwe film gaat zoeken: al bij aankondiging, vanaf de bioscooprelease of pas als hij uit is (standaard). Beheerders kunnen dit per film kiezen in de popup.', 'When Radarr starts looking for a new movie: from the announcement, from the cinema release, or only once it is released (default). Administrators can choose this per movie in the popup.', 'Ab wann Radarr nach einem neuen Film sucht: ab der Ankündigung, ab dem Kinostart oder erst nach der Veröffentlichung (Standard). Administratoren können das im Popup pro Film wählen.'); }
        })();
        label('txtSonarrUrl', 'URL (bijv. http://192.168.1.10:8989)', 'URL (e.g. http://192.168.1.10:8989)', 'URL (z. B. http://192.168.1.10:8989)');
        label('txtSonarrKey', 'API key', 'API key', 'API-Schlüssel');
        label('selSonarrProfile', 'Quality profile', 'Quality profile', 'Qualitätsprofil');
        label('selSonarrRoot', 'Root folder', 'Root folder', 'Stammordner');

        var languageSelect = el(view, 'selPluginLanguage');
        languageSelect.options[0].textContent = languageText('Volg de taal van Emby Server', 'Follow Emby server language', 'Emby-Serversprache verwenden');
        updateAutoTmdbOption(view);
        view.querySelector('.btnTestTmdb span').textContent = languageText('Test TMDB-key', 'Test TMDB key', 'TMDB-Schlüssel testen');
        view.querySelector('.btnTestRadarr span').textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen');
        view.querySelector('.btnTestSonarr span').textContent = languageText('Test verbinding', 'Test connection', 'Verbindung testen');
        view.querySelector('.button-submit span').textContent = languageText('Opslaan', 'Save', 'Speichern');
        view.querySelector('.btnUpdCheck span').textContent = languageText('Nu kijken', 'Check now', 'Jetzt prüfen');
        view.querySelector('.btnUpdRestart span').textContent = languageText('Emby herstarten', 'Restart Emby', 'Emby neu starten');
        view.querySelector('.btnStatus span').textContent = languageText('Start diagnose', 'Run diagnostics', 'Diagnose starten');
        view.querySelector('.btnStatus').nextElementSibling.textContent = languageText(
            'Controleert plugin, kanaal, TMDB, Radarr, Sonarr en gebruikerstoegang. Handig om twee servers te vergelijken.',
            'Checks the plugin, channel, TMDB, Radarr, Sonarr and user access. Useful when comparing two servers.',
            'Prüft Plugin, Kanal, TMDB, Radarr, Sonarr und Benutzerzugriff. Nützlich zum Vergleichen zweier Server.');
        el(view, 'statusTmdbLanguages').textContent = languageText(
            'Voer een TMDB-key in en test deze om de volledige talenlijst te laden.',
            'Enter a TMDB key and test it to load the full language list.',
            'Gib einen TMDB-Schlüssel ein und teste ihn, um die vollständige Sprachliste zu laden.');
        Array.prototype.forEach.call(view.querySelectorAll('.btnToggleKey'), function (button) {
            var target = el(view, button.getAttribute('data-target'));
            var labelText = target && target.type === 'text'
                ? languageText('Verbergen', 'Hide', 'Ausblenden')
                : languageText('Tonen', 'Show', 'Anzeigen');
            button.setAttribute('title', labelText);
            button.setAttribute('aria-label', labelText);
        });
    }

    // ---- Updates (GitHub-releases) ----
    function updStatus(view, html, isHtml) {
        var st = view.querySelector('.dcUpdStatus');
        if (st) { if (isHtml) { st.innerHTML = html; } else { st.textContent = html; } }
    }
    function syncUpdateBoxes(view) {
        var auto = el(view, 'chkUpdateAuto').checked;
        var r = el(view, 'chkUpdateRestart');
        r.disabled = !auto;
        var box = r.closest('.checkboxContainer');
        if (box) { box.style.opacity = auto ? '' : '.5'; }
    }
    function showUpdate(view, u) {
        var btnI = view.querySelector('.btnUpdInstall'), btnR = view.querySelector('.btnUpdRestart');
        btnI.style.display = 'none'; btnR.style.display = 'none';
        if (!u) { return; }
        var cur = languageText('Geïnstalleerd: ', 'Installed: ', 'Installiert: ') + '<b>' + esc(u.Current || '?') + '</b>';
        var link = function (t) { return u.Url ? '<a href="' + esc(u.Url) + '" target="_blank" rel="noopener" style="color:#52b54b">' + esc(t) + '</a>' : esc(t); };
        var beta = u.IsBeta ? ' (beta)' : '';
        var html;
        if (u.PendingVersion) {
            html = cur + '<br>' + languageText('Versie ', 'Version ', 'Version ') + '<b>' + esc(u.PendingVersion) + '</b>' +
                languageText(' is geïnstalleerd. Herstart Emby om hem te activeren.', ' is installed. Restart Emby to activate it.', ' ist installiert. Emby neu starten, um sie zu aktivieren.');
            if (u.CanRestart) { btnR.style.display = ''; }
        } else if (u.Available) {
            html = cur + '<br>' + languageText('Nieuwe versie beschikbaar: ', 'New version available: ', 'Neue Version verfügbar: ') + '<b>' + link(u.Latest + beta) + '</b>';
            btnI.style.display = '';
            btnI.querySelector('span').textContent = languageText('Bijwerken naar ', 'Update to ', 'Aktualisieren auf ') + u.Latest;
        } else if (u.Latest) {
            html = cur + ' · ' + languageText('dit is de nieuwste versie', 'this is the latest version', 'das ist die neueste Version') + ' (' + link(u.Latest + beta) + ')';
        } else {
            html = cur;
        }
        if (u.Error) { html += '<br><span style="color:#ff6b6b">' + esc(u.Error) + '</span>'; }
        updStatus(view, html, true);
    }
    function checkUpdate(view, fresh) {
        updStatus(view, languageText('Kijken op GitHub...', 'Checking GitHub...', 'GitHub wird geprüft...'));
        ApiClient.getJSON(ApiClient.getUrl('Discover/Update', { Fresh: !!fresh })).then(function (u) { showUpdate(view, u); },
            function (err) { updStatus(view, ajaxErrorMessage(err)); });
    }
    function installUpdate(view) {
        updStatus(view, languageText('Downloaden en installeren...', 'Downloading and installing...', 'Herunterladen und installieren...'));
        view.querySelector('.btnUpdInstall').style.display = 'none';
        ApiClient.ajax({ type: 'POST', url: ApiClient.getUrl('Discover/Update/Install'), dataType: 'json' })
            .then(function (u) { showUpdate(view, u); }, function (err) { updStatus(view, ajaxErrorMessage(err)); });
    }
    function restartForUpdate(view) {
        if (!window.confirm(languageText('Emby nu herstarten? Wie iets kijkt, wordt even onderbroken.', 'Restart Emby now? Anyone watching will be interrupted briefly.', 'Emby jetzt neu starten? Laufende Wiedergaben werden kurz unterbrochen.'))) { return; }
        updStatus(view, languageText('Emby herstart. Ververs de pagina over een minuut.', 'Emby is restarting. Refresh the page in a minute.', 'Emby startet neu. Seite in einer Minute neu laden.'));
        view.querySelector('.btnUpdRestart').style.display = 'none';
        ApiClient.ajax({ type: 'POST', url: ApiClient.getUrl('Discover/Update/Restart') }).catch(function () { });
    }

    function showLoading() { if (window.Dashboard && Dashboard.showLoadingMsg) { Dashboard.showLoadingMsg(); } }
    function hideLoading() { if (window.Dashboard && Dashboard.hideLoadingMsg) { Dashboard.hideLoadingMsg(); } }

    function el(view, id) { return view.querySelector('#' + id); }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ajaxErrorMessage(err) {
        if (!err) { return 'onbekende fout'; }
        var payload = err.responseJSON;
        if (!payload && err.responseText) {
            try { payload = JSON.parse(err.responseText); } catch (ignored) { }
        }
        var status = err.status || err.statusCode || (err.response && err.response.status);
        var details = err.message || err.statusText || err.responseText ||
            (err.response && (err.response.statusText || err.response.responseText));
        if (typeof details === 'string' && details.length > 240) { details = details.slice(0, 240) + '...'; }
        return (payload && (payload.Message || payload.message || payload.Error || payload.error)) ||
            details || (status ? 'HTTP ' + status : 'Geen HTTP-status (response kon niet worden verwerkt)');
    }

    // items: [{value, label}] ; selected: huidige waarde
    function fillSelect(select, items, selected) {
        var html = '';
        items.forEach(function (i) {
            html += '<option value="' + esc(i.value) + '">' + esc(i.label) + '</option>';
        });
        select.innerHTML = html;
        select.value = String(selected);
        if (select.value !== String(selected)) { select.selectedIndex = 0; }
    }

    function fillSaved(view, kind, profileId, rootFolder) {
        var notConnected = languageText(
            'Verbind eerst met de app (Test verbinding)',
            'Connect to the app first (Test connection)',
            'Verbinde zuerst die App (Verbindung testen)');
        var saved = languageText('(opgeslagen)', '(saved)', '(gespeichert)');
        var profiles = profileId
            ? [{ value: profileId, label: languageText('Profiel ID ', 'Profile ID ', 'Profil-ID ') + profileId + ' ' + saved }]
            : [{ value: 0, label: notConnected }];
        fillSelect(el(view, 'sel' + kind + 'Profile'), profiles, profileId || 0);

        var roots = rootFolder
            ? [{ value: rootFolder, label: rootFolder + ' ' + saved }]
            : [{ value: '', label: notConnected }];
        fillSelect(el(view, 'sel' + kind + 'Root'), roots, rootFolder || '');
    }

    function loadTmdbLanguages(view, key, selected, state) {
        var select = el(view, 'selTmdbLang');
        var status = el(view, 'statusTmdbLanguages');
        var requestId = ++state.languageRequest;
        var options = [{ value: 'auto', label: languageText(
            'Volg de plugin-/Emby-taal (automatisch)', 'Follow plugin/Emby language (automatic)', 'Plugin-/Emby-Sprache automatisch verwenden') }];

        function render(languages) {
            if (requestId !== state.languageRequest) { return; }
            var current = selected || select.value || 'auto';
            languages.forEach(function (language) {
                var code = language.Code || language.code || language.iso_639_1;
                if (!code) { return; }
                var englishName = language.EnglishName || language.english_name || '';
                var name = language.Name || language.name || '';
                var label = englishName || name || code;
                if (name && name !== englishName) {
                    label += ' - ' + name;
                }
                options.push({ value: code, label: label + ' (' + code + ')' });
            });
            if (current !== 'auto' && !options.some(function (option) { return option.value === current; })) {
                options.push({ value: current, label: current + ' (' + languageText('opgeslagen', 'saved', 'gespeichert') + ')' });
            }
            fillSelect(select, options, current);
            updateAutoTmdbOption(view, state);
        }

        function asLanguageList(payload) {
            if (Array.isArray(payload)) { return payload; }
            var wrapped = payload && (payload.Items || payload.items || payload.Result || payload.results ||
                payload.Languages || payload.languages || payload.Data || payload.data);
            if (Array.isArray(wrapped)) { return wrapped; }
            throw new Error('Onverwachte TMDB-response: ' + (payload === null ? 'null' : typeof payload));
        }

        function showLanguageError(message) {
            render([]);
            if (requestId === state.languageRequest) {
                status.textContent = languageText(
                    'TMDB-talenlijst niet beschikbaar: ' + message + '. Automatische taalkeuze blijft beschikbaar.',
                    'TMDB language list unavailable: ' + message + '. Automatic language selection remains available.',
                    'TMDB-Sprachliste nicht verfügbar: ' + message + '. Die automatische Sprachauswahl bleibt verfügbar.');
            }
        }

        if (!key) {
            render([]);
            status.textContent = languageText(
                'Voer een TMDB-key in en test deze om de volledige talenlijst te laden.',
                'Enter and test a TMDB key to load the full language list.',
                'Gib einen TMDB-Schlüssel ein und teste ihn, um die vollständige Sprachliste zu laden.');
            return;
        }

        status.textContent = languageText('TMDB-talen laden...', 'Loading TMDB languages...', 'TMDB-Sprachen werden geladen...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'TmdbLanguages', ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (result) {
            try {
                if (!result || !result.Success) {
                    throw new Error((result && result.Error) || 'TMDB kon de talenlijst niet laden.');
                }
                var list = asLanguageList(result.Languages);
                if (!list.length) { throw new Error('TMDB gaf een lege talenlijst terug.'); }
                render(list);
                if (requestId === state.languageRequest) {
                    status.textContent = languageText(
                        'Volg automatisch de plugin-/Emby-taal of selecteer handmatig een TMDB-taal.',
                        'Follow the plugin/Emby language automatically or select a TMDB language manually.',
                        'Verwende automatisch die Plugin-/Emby-Sprache oder wähle manuell eine TMDB-Sprache aus.');
                }
            } catch (err) {
                console.error('Discover: onverwachte TMDB-talenresponse', result, err);
                showLanguageError(err.message || String(err));
            }
        }, function (err) {
            console.error('Discover: TMDB-talen laden mislukt', err);
            showLanguageError(ajaxErrorMessage(err));
        });
    }

    // ---- Aanvragen via Radarr & Sonarr of via Seerr ----
    function updateServiceView(view) {
        var mode = el(view, 'selRequestService').value;
        var seerr = mode === 'seerr' || mode === 'seerr-arr';
        el(view, 'seerrFields').style.display = seerr ? '' : 'none';
        el(view, 'arrFields').style.display = (!seerr || mode === 'seerr-arr') ? '' : 'none';
        var desc = el(view, 'desc_requestService');
        if (desc && mode !== 'seerr-arr' && TEXTS.desc_requestService) {
            desc.textContent = languageText(TEXTS.desc_requestService[0], TEXTS.desc_requestService[1], TEXTS.desc_requestService[2]);
        }
        if (desc && mode === 'seerr-arr') {
            desc.textContent = languageText(
                'Aanvragen gaan naar Seerr (met goedkeuring en limieten uit Seerr). Radarr en Sonarr worden alleen gelezen, voor de echte status in de wachtrij: wachten op import, importeren, een geblokkeerde import en de reden bij een probleem.',
                'Requests go to Seerr (with approval and limits from Seerr). Radarr and Sonarr are only read, for the real status in the queue: waiting to import, importing, a blocked import and the reason for a problem.',
                'Anfragen gehen an Seerr (mit Freigabe und Limits aus Seerr). Radarr und Sonarr werden nur gelesen, für den echten Status in der Warteschlange: wartet auf Import, wird importiert, blockierter Import und der Grund bei einem Problem.');
        }
    }

    function testSeerr(view) {
        var status = el(view, 'statusSeerr');
        var url = el(view, 'txtSeerrUrl').value.trim();
        var key = el(view, 'txtSeerrKey').value.trim();
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Verbindung wird getestet...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'Seerr', Url: url, ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                    ((r && r.Error) || languageText('onbekende fout', 'unknown error', 'unbekannter Fehler'));
                return;
            }
            // Version = "versie|Radarr-servers|Sonarr-servers"
            var parts = String(r.Version || '').split('|');
            var msg = languageText('Verbonden met Seerr', 'Connected to Seerr', 'Verbunden mit Seerr') + (parts[0] ? ' ' + parts[0] : '');
            if (parts.length >= 3) {
                msg += ' - ' + parts[1] + ' Radarr-, ' + parts[2] + ' Sonarr-' + languageText('server(s) ingesteld in Seerr.', 'server(s) set up in Seerr.', 'Server in Seerr eingerichtet.');
                if (parts[1] === '0' || parts[2] === '0') {
                    msg += ' ' + languageText('Zonder Radarr- of Sonarr-server kan Seerr die aanvragen niet uitvoeren.',
                        'Without a Radarr or Sonarr server Seerr cannot fulfil those requests.',
                        'Ohne Radarr- oder Sonarr-Server kann Seerr diese Anfragen nicht ausführen.');
                }
            } else {
                msg += '.';
            }
            status.style.color = '#43a047';
            status.textContent = msg;
        }, function (err) {
            console.error('Discover: Seerr-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ajaxErrorMessage(err);
        });
    }

    function testDownloader(view, type, name, urlId, userId, passId, statusId) {
        var status = el(view, statusId);
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Verbindung wird getestet...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: type, Url: el(view, urlId).value.trim(), Username: el(view, userId).value.trim(), Password: el(view, passId).value }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                    ((r && r.Error) || languageText('onbekende fout', 'unknown error', 'unbekannter Fehler'));
                return;
            }
            status.style.color = '#43a047';
            status.textContent = languageText('Verbonden met ', 'Connected to ', 'Verbunden mit ') + name + (r.Version ? ' ' + r.Version : '') + '.';
        }, function (err) {
            console.error('Discover: ' + name + '-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ajaxErrorMessage(err);
        });
    }
    function testQbit(view) { testDownloader(view, 'Qbittorrent', 'qBittorrent', 'txtQbitUrl', 'txtQbitUser', 'txtQbitPass', 'statusQbit'); }
    function testNzbget(view) { testDownloader(view, 'Nzbget', 'NZBGet', 'txtNzbgetUrl', 'txtNzbgetUser', 'txtNzbgetPass', 'statusNzbget'); }
    function testTrans(view) { testDownloader(view, 'Transmission', 'Transmission', 'txtTransUrl', 'txtTransUser', 'txtTransPass', 'statusTrans'); }

    function testSab(view) {
        var status = el(view, 'statusSab');
        var url = el(view, 'txtSabUrl').value.trim();
        var key = el(view, 'txtSabKey').value.trim();
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Verbindung wird getestet...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'Sabnzbd', Url: url, ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                    ((r && r.Error) || languageText('onbekende fout', 'unknown error', 'unbekannter Fehler'));
                return;
            }
            status.style.color = '#43a047';
            status.textContent = languageText('Verbonden met SABnzbd', 'Connected to SABnzbd', 'Verbunden mit SABnzbd') + (r.Version ? ' ' + r.Version : '') + '.';
        }, function (err) {
            console.error('Discover: SABnzbd-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') + ajaxErrorMessage(err);
        });
    }

    function intValue(view, id, fallback) {
        var v = parseInt(el(view, id).value, 10);
        return isNaN(v) || v < 0 ? fallback : v;
    }

    function normId(id) { return String(id || '').replace(/-/g, '').toLowerCase(); }

    // ---- Gebruikers: vinkje = mag aanvragen; bewaard wordt de lijst van wie NIET mag ----
    function loadUsers(view, state, blockedCsv) {
        var list = el(view, 'userList');
        var status = el(view, 'statusUsers');
        var blocked = {};
        String(blockedCsv || '').split(/[\s,;]+/).forEach(function (id) { if (id) { blocked[normId(id)] = true; } });
        state.usersLoaded = false;
        status.textContent = languageText('Gebruikers laden...', 'Loading users...', 'Benutzer werden geladen...');
        ApiClient.getJSON(ApiClient.getUrl('Users')).then(function (users) {
            users = users || [];
            users.sort(function (a, b) { return String(a.Name).toLowerCase() < String(b.Name).toLowerCase() ? -1 : 1; });
            var html = '';
            users.forEach(function (u) {
                var isAdmin = !!(u.Policy && u.Policy.IsAdministrator);
                var disabled = !!(u.Policy && u.Policy.IsDisabled);
                var tag = (isAdmin ? languageText('beheerder', 'administrator', 'Administrator') : '') +
                    (isAdmin && disabled ? ', ' : '') +
                    (disabled ? languageText('uitgeschakeld', 'disabled', 'deaktiviert') : '');
                html += '<div class="checkboxContainer"><label class="emby-checkbox-label">' +
                    '<input is="emby-checkbox" type="checkbox" class="chkUser" data-userid="' + esc(u.Id) + '"' +
                    (blocked[normId(u.Id)] ? '' : ' checked') + ' />' +
                    '<span class="checkboxLabel">' + esc(u.Name) + (tag ? ' <span class="dcUserTag">(' + esc(tag) + ')</span>' : '') + '</span>' +
                    '<span class="emby-checkbox-outline"><span class="emby-checkbox-on"><i class="md-icon">check</i></span><span class="emby-checkbox-off"></span></span>' +
                    '</label></div>';
            });
            list.innerHTML = html;
            setTimeout(function () { fixCheckboxes(view); }, 100);
            state.usersLoaded = true;
            status.textContent = '';
        }, function (err) {
            console.error('Discover: gebruikers laden mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText(
                'Gebruikers laden mislukt; de bestaande instelling blijft ongewijzigd.',
                'Loading users failed; the existing setting stays unchanged.',
                'Benutzer konnten nicht geladen werden; die bestehende Einstellung bleibt unverändert.');
        });
    }

    function blockedFromList(view) {
        var ids = [];
        Array.prototype.forEach.call(view.querySelectorAll('.chkUser'), function (box) {
            if (!box.checked) { ids.push(box.getAttribute('data-userid')); }
        });
        return ids.join(',');
    }

    function setAllUsers(view, state, value) {
        Array.prototype.forEach.call(view.querySelectorAll('.chkUser'), function (box) { box.checked = value; });
        state.dirty = true;
    }

    // ---- Test van de watchlist-bronnen ----
    function testWatch(view, kind) {
        var status = el(view, kind === 'trakt' ? 'statusTrakt' : 'statusTmdbList');
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Wird getestet...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestWatchlist'),
            data: JSON.stringify({
                Kind: kind,
                User: el(view, 'txtTraktUser').value.trim(),
                ClientId: el(view, 'txtTraktClient').value.trim(),
                ListId: el(view, 'txtTmdbList').value.trim()
            }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            status.style.color = r && r.Success ? '#43a047' : '#e53935';
            status.textContent = (r && r.Message) || '?';
        }, function (err) {
            status.style.color = '#e53935';
            status.textContent = ajaxErrorMessage(err);
        });
    }

    // ---- Test van de OMDb-sleutel ----
    function testMdblist(view) {
        var status = el(view, 'statusMdblist');
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Wird getestet...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestMdblist'),
            data: JSON.stringify({ Key: el(view, 'txtMdblistKey').value.trim() }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            status.style.color = r && r.Success ? '#43a047' : '#e53935';
            status.textContent = (r && r.Message) || '?';
        }, function (err) {
            status.style.color = '#e53935';
            status.textContent = ajaxErrorMessage(err);
        });
    }

    function testOmdb(view) {
        var status = el(view, 'statusOmdb');
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Wird getestet...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestOmdb'),
            data: JSON.stringify({ Key: el(view, 'txtOmdbKey').value.trim() }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            status.style.color = r && r.Success ? '#43a047' : '#e53935';
            status.textContent = (r && r.Message) || '?';
        }, function (err) {
            status.style.color = '#e53935';
            status.textContent = ajaxErrorMessage(err);
        });
    }

    // ---- Overzicht van alle aanvragen (beheerder) ----
    function fmtDate(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) { return ''; }
        try { return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
        catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
    }

    function loadAllRequests(view) {
        var box = el(view, 'allRequests');
        var status = el(view, 'statusAllRequests');
        status.style.color = '';
        status.textContent = languageText('Laden...', 'Loading...', 'Wird geladen...');
        var names = {};
        var usersP = ApiClient.getJSON(ApiClient.getUrl('Users')).then(function (users) {
            (users || []).forEach(function (u) { names[normId(u.Id)] = u.Name; });
        }, function () { });
        var reqP = ApiClient.getJSON(ApiClient.getUrl('Discover/AllRequests'));
        Promise.all([usersP, reqP]).then(function (res) {
            var r = res[1] || {};
            var items = r.Items || [];
            if (!items.length) {
                box.innerHTML = '';
                status.textContent = languageText('Nog geen aanvragen via Discover.', 'No requests through Discover yet.', 'Noch keine Anfragen über Discover.');
                return;
            }
            var perUser = {};
            items.forEach(function (i) { var n = names[normId(i.UserId)] || '?'; perUser[n] = (perUser[n] || 0) + 1; });
            var sum = Object.keys(perUser).sort(function (a, b) { return perUser[b] - perUser[a]; })
                .map(function (n) { return esc(n) + ': ' + perUser[n]; }).join(' \u00B7 ');
            var st = [languageText('Verwijderd', 'Removed', 'Entfernt'), languageText('Aangevraagd', 'Requested', 'Angefordert'), languageText('Beschikbaar', 'Available', 'Verfügbar')];
            var html = '<div class="dcReqSum">' + sum + '</div><table class="dcReqTable"><thead><tr><th></th><th>' +
                languageText('Titel', 'Title', 'Titel') + '</th><th>' + languageText('Gebruiker', 'User', 'Benutzer') + '</th><th>' +
                languageText('Datum', 'Date', 'Datum') + '</th><th>' + languageText('Status', 'Status', 'Status') + '</th></tr></thead><tbody>';
            items.forEach(function (i) {
                var poster = i.Poster ? '<img loading="lazy" src="' + esc(i.Poster) + '" alt="">' : '';
                html += '<tr><td>' + poster + '</td><td>' + esc(i.Title || '?') + (i.Year ? ' (' + i.Year + ')' : '') +
                    ' <span class="dcUserTag">' + (i.Type === 'tv' ? languageText('serie', 'series', 'Serie') : languageText('film', 'movie', 'Film')) + '</span></td><td>' +
                    esc(names[normId(i.UserId)] || '?') + '</td><td>' + esc(fmtDate(i.Added)) + '</td><td class="dcReqSt' + (i.Status | 0) + '">' + st[i.Status | 0] + '</td></tr>';
            });
            box.innerHTML = html + '</tbody></table>';
            status.textContent = items.length + languageText(' aanvragen', ' requests', ' Anfragen');
        }, function (err) {
            console.error('Discover: aanvragenoverzicht mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Overzicht laden mislukt: ', 'Loading the overview failed: ', 'Übersicht laden fehlgeschlagen: ') + ajaxErrorMessage(err);
        });
    }

    // ---- Opslag: grootte van de bewaarde kaarten en tegels, en opruimen ----
    function mb(bytes) { return (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1); }

    function showCache(view, r) {
        el(view, 'statusCache').textContent = languageText('Kaartclips: ', 'Card clips: ', 'Kartenclips: ') +
            r.CardFiles + languageText(' bestanden (', ' files (', ' Dateien (') + mb(r.CardBytes) + ' MB)  \u00B7  ' +
            languageText('Tegels: ', 'Tiles: ', 'Kacheln: ') +
            r.TileFiles + languageText(' bestanden (', ' files (', ' Dateien (') + mb(r.TileBytes) + ' MB)';
    }

    function loadCache(view) {
        ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl('Discover/Cache'), dataType: 'json' }).then(function (r) {
            if (r) { showCache(view, r); }
        }, function (err) {
            console.error('Discover: opslaggrootte ophalen mislukt', err);
            el(view, 'statusCache').textContent = languageText(
                'Grootte niet beschikbaar (alleen beheerders).', 'Size not available (administrators only).', 'Größe nicht verfügbar (nur Administratoren).');
        });
    }

    function cleanCache(view, all) {
        var status = el(view, 'statusClean');
        status.style.color = '';
        status.textContent = languageText('Bezig...', 'Working...', 'Bitte warten...');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/Cache/Clean'),
            data: JSON.stringify({ All: !!all }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            status.style.color = '#43a047';
            status.textContent = (r && r.Message) || languageText('Klaar.', 'Done.', 'Fertig.');
            if (r) { showCache(view, r); }
        }, function (err) {
            console.error('Discover: opruimen mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Opruimen mislukt: ', 'Cleanup failed: ', 'Bereinigung fehlgeschlagen: ') + ajaxErrorMessage(err);
        });
    }

    // ---- Tabbladen ----
    function showTab(view, name) {
        Array.prototype.forEach.call(view.querySelectorAll('.dcTab'), function (b) {
            var on = b.getAttribute('data-tab') === name;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        Array.prototype.forEach.call(view.querySelectorAll('.dcPanel'), function (p) {
            p.classList.toggle('active', p.getAttribute('data-panel') === name);
        });
        if (name === 'storage') { loadCache(view); }
    }

    // Emby 4.11 tekent het vinkje van emby-checkbox zelf en kent onze eigen omlijning (oude Emby-opmaak) niet meer:
    // die verscheen dan als los "✓" onder of naast de tekst. Ongestylede omlijningen weghalen.
    function fixCheckboxes(view) {
        Array.prototype.forEach.call(view.querySelectorAll('.emby-checkbox-outline'), function (o) {
            var pos = '';
            try { pos = getComputedStyle(o).position; } catch (e) { }
            if (pos === 'static' && o.parentNode) { o.parentNode.removeChild(o); }
        });
    }

    function load(view, state) {
        setTimeout(function () { fixCheckboxes(view); }, 300);
        // Nooit niet-opgeslagen invoer overschrijven
        if (state.dirty) { return; }
        showLoading();
        ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            if (c.DiagnosticsDefaultApplied) { return c; }
            c.ShowDiagnostics = false;
            c.DiagnosticsDefaultApplied = true;
            return ApiClient.updatePluginConfiguration(pluginId, c).then(function () {
                return ApiClient.getPluginConfiguration(pluginId);
            }).then(function (saved) {
                if (!saved.DiagnosticsDefaultApplied || saved.ShowDiagnostics) {
                    throw new Error('Emby heeft de diagnose-instelling niet als uitgeschakeld bevestigd.');
                }
                return saved;
            });
        }).then(function (c) {
            el(view, 'txtTmdbKey').value = c.TmdbApiKey || '';
            el(view, 'chkShowDiagnostics').checked = !!c.ShowDiagnostics;
            el(view, 'chkShowTrailerTile').checked = c.ShowTrailerTile !== false;
            el(view, 'txtExcludedLangs').value = c.ExcludedOriginalLanguages || '';
            el(view, 'chkInjectWebClientLoader').checked = !!c.InjectWebClientLoader;
            el(view, 'chkPrecreateCards').checked = !!c.PrecreateCards;
            el(view, 'numCardDays').value = c.CardRetentionDays != null ? c.CardRetentionDays : 14;
            el(view, 'numTileDays').value = c.TileRetentionDays != null ? c.TileRetentionDays : 30;
            el(view, 'numMaxCacheMb').value = c.MaxCacheMb != null ? c.MaxCacheMb : 2048;
            el(view, 'numRequestLimit').value = c.RequestLimit != null ? c.RequestLimit : 0;
            el(view, 'chkShowNewSeasons').checked = c.ShowNewSeasons !== false;
            el(view, 'chkShowMyRequests').checked = c.ShowMyRequests !== false;
            el(view, 'chkPosterYear').checked = c.PosterShowYear !== false;
            el(view, 'chkShowSpecials').checked = c.ShowSpecials !== false;
            el(view, 'chkShowTitleLogo').checked = c.ShowTitleLogo !== false;
            el(view, 'chkShowNextEpisode').checked = c.ShowNextEpisode !== false;
            el(view, 'chkAllowInvalidCerts').checked = c.AllowInvalidCertificates === true;
            el(view, 'chkUpdateCheck').checked = c.UpdateCheck !== false;
            el(view, 'chkUpdateBeta').checked = c.UpdateIncludeBeta === true;
            el(view, 'chkUpdateAuto').checked = c.UpdateAutoInstall === true;
            el(view, 'chkUpdateRestart').checked = c.UpdateAutoRestart === true;
            syncUpdateBoxes(view);
            if (c.UpdateCheck !== false) { checkUpdate(view, false); } else { updStatus(view, languageText('Niet automatisch gekeken. Klik op Nu kijken.', 'Not checked automatically. Click Check now.', 'Nicht automatisch geprüft. Auf Jetzt prüfen klicken.')); }
            el(view, 'txtMdblistKey').value = c.MdblistApiKey || '';
            el(view, 'txtFanartKey').value = c.FanartApiKey || '';
            var ps = String(c.PosterScoreSource || '').toLowerCase();
            if (ps !== 'tmdb' && ps !== 'imdb' && ps !== 'none') { ps = c.PosterShowScore === false ? 'none' : 'tmdb'; }
            el(view, 'selPosterScore').value = ps;
            el(view, 'chkShowOmdb').checked = c.ShowOmdbRatings !== false;
            el(view, 'txtOmdbKey').value = c.OmdbApiKey || '';
            // Waarden in de keuzelijst zonder # (Emby's keuzelijst op de tv kan niet met # overweg).
            var acc = String(c.AccentColor || '#ffb400').toLowerCase().replace('#', '');
            if (!/^[0-9a-f]{6}$/.test(acc)) { acc = 'ffb400'; }
            setAccent(view, acc);
            el(view, 'chkShowRecentlyAdded').checked = c.ShowRecentlyAdded !== false;
            el(view, 'chkShowRecentRequests').checked = c.ShowRecentRequests !== false;
            el(view, 'txtTmdbList').value = c.TmdbListId || '';
            el(view, 'txtTraktUser').value = c.TraktUser || '';
            el(view, 'txtTraktClient').value = c.TraktClientId || '';
            el(view, 'numRequestLimitDays').value = c.RequestLimitDays ? c.RequestLimitDays : 7;
            loadUsers(view, state, c.BlockedUserIds || '');
            loadCache(view);
            var browserLanguage = window.navigator && navigator.language;
            applyLanguage(view, c.PluginLanguage && c.PluginLanguage !== 'auto' ? c.PluginLanguage : browserLanguage);
            el(view, 'selPluginLanguage').value = c.PluginLanguage || 'auto';
            var tmdbLanguage = c.TmdbLanguageMode === 'manual' ? (c.TmdbLanguage || 'nl-NL') : 'auto';
            state.autoTmdbLanguage = languageCode(c.PluginLanguage && c.PluginLanguage !== 'auto'
                ? c.PluginLanguage
                : browserLanguage);
            updateAutoTmdbOption(view, state);
            loadTmdbLanguages(view, c.TmdbApiKey || '', tmdbLanguage, state);
            ApiClient.ajax({
                type: 'GET',
                url: ApiClient.getUrl('Discover/Status'),
                dataType: 'json'
            }).then(function (serverStatus) {
                state.autoTmdbLanguage = languageCode(serverStatus.PluginLanguage || browserLanguage);
                if (!state.dirty && el(view, 'selPluginLanguage').value === 'auto') {
                    applyLanguage(view, serverStatus.PluginLanguage || browserLanguage);
                }
                updateAutoTmdbOption(view, state);
            }, function (err) {
                console.error('Discover: Emby-taal ophalen mislukt', err);
            });
            el(view, 'selRequestService').value = c.RequestService === 'seerr' ? (c.SeerrArrStatus ? 'seerr-arr' : 'seerr') : 'arr';
            el(view, 'txtSeerrUrl').value = c.SeerrUrl || '';
            el(view, 'txtSeerrKey').value = c.SeerrApiKey || '';
            el(view, 'txtSabUrl').value = c.SabUrl || '';
            el(view, 'txtSabKey').value = c.SabApiKey || '';
            el(view, 'txtQbitUrl').value = c.QbitUrl || '';
            el(view, 'txtQbitUser').value = c.QbitUser || '';
            el(view, 'txtQbitPass').value = c.QbitPassword || '';
            el(view, 'txtNzbgetUrl').value = c.NzbgetUrl || '';
            el(view, 'txtNzbgetUser').value = c.NzbgetUser || '';
            el(view, 'txtNzbgetPass').value = c.NzbgetPassword || '';
            el(view, 'txtTransUrl').value = c.TransmissionUrl || '';
            el(view, 'txtTransUser').value = c.TransmissionUser || '';
            el(view, 'txtTransPass').value = c.TransmissionPassword || '';
            updateServiceView(view);
            el(view, 'txtRadarrUrl').value = c.RadarrUrl || '';
            el(view, 'txtRadarrKey').value = c.RadarrApiKey || '';
            el(view, 'txtSonarrUrl').value = c.SonarrUrl || '';
            el(view, 'txtSonarrKey').value = c.SonarrApiKey || '';
            fillSaved(view, 'Radarr', c.RadarrQualityProfileId || 0, c.RadarrRootFolder || '');
            el(view, 'selRadarrAvail').value = c.RadarrMinimumAvailability || 'released';
            fillSaved(view, 'Sonarr', c.SonarrQualityProfileId || 0, c.SonarrRootFolder || '');
            state.dirty = false;
            // Haal profielen/mappen automatisch op als URL en key bekend zijn
            if (c.RadarrUrl && c.RadarrApiKey) { testConnection(view, 'Radarr', state); }
            if (c.SonarrUrl && c.SonarrApiKey) { testConnection(view, 'Sonarr', state); }
            if (c.RequestService === 'seerr' && c.SeerrUrl && c.SeerrApiKey) { testSeerr(view); }
            hideLoading();
        }, function (err) {
            console.error('Discover: config laden mislukt', err);
            hideLoading();
        });
    }

    function save(view, state) {
        var status = el(view, 'statusSave');
        status.style.color = '';
        status.textContent = languageText('Opslaan...', 'Saving...', 'Wird gespeichert...');
        showLoading();
        ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            var apiKey = el(view, 'txtTmdbKey').value.trim();
            var tmdbLanguage = el(view, 'selTmdbLang').value || 'auto';
            c.TmdbApiKey = apiKey;
            c.PluginLanguage = el(view, 'selPluginLanguage').value || 'auto';
            c.ShowDiagnostics = el(view, 'chkShowDiagnostics').checked;
            c.ShowTrailerTile = el(view, 'chkShowTrailerTile').checked;
            c.ExcludedOriginalLanguages = (el(view, 'txtExcludedLangs').value || '').toLowerCase().split(/[\s,;]+/).filter(function (x) { return /^[a-z]{2,3}$/.test(x); }).join(',');
            c.InjectWebClientLoader = el(view, 'chkInjectWebClientLoader').checked;
            c.PrecreateCards = el(view, 'chkPrecreateCards').checked;
            c.CardRetentionDays = intValue(view, 'numCardDays', 14);
            c.TileRetentionDays = intValue(view, 'numTileDays', 30);
            c.MaxCacheMb = intValue(view, 'numMaxCacheMb', 2048);
            c.RequestLimit = intValue(view, 'numRequestLimit', 0);
            c.ShowNewSeasons = el(view, 'chkShowNewSeasons').checked;
            c.ShowMyRequests = el(view, 'chkShowMyRequests').checked;
            c.PosterShowYear = el(view, 'chkPosterYear').checked;
            c.ShowSpecials = el(view, 'chkShowSpecials').checked;
            c.ShowTitleLogo = el(view, 'chkShowTitleLogo').checked;
            c.ShowNextEpisode = el(view, 'chkShowNextEpisode').checked;
            c.AllowInvalidCertificates = el(view, 'chkAllowInvalidCerts').checked;
            c.UpdateCheck = el(view, 'chkUpdateCheck').checked;
            c.UpdateIncludeBeta = el(view, 'chkUpdateBeta').checked;
            c.UpdateAutoInstall = el(view, 'chkUpdateAuto').checked;
            c.UpdateAutoRestart = el(view, 'chkUpdateAuto').checked && el(view, 'chkUpdateRestart').checked;
            c.MdblistApiKey = el(view, 'txtMdblistKey').value.trim();
            c.FanartApiKey = el(view, 'txtFanartKey').value.trim();
            c.PosterScoreSource = el(view, 'selPosterScore').value || 'tmdb';
            c.PosterShowScore = c.PosterScoreSource !== 'none';
            c.ShowOmdbRatings = el(view, 'chkShowOmdb').checked;
            c.OmdbApiKey = el(view, 'txtOmdbKey').value.trim();
            c.AccentColor = '#' + String(el(view, 'selAccent').value || 'ffb400').replace('#', '');
            c.ShowRecentlyAdded = el(view, 'chkShowRecentlyAdded').checked;
            c.ShowRecentRequests = el(view, 'chkShowRecentRequests').checked;
            c.TmdbListId = el(view, 'txtTmdbList').value.trim();
            c.TraktUser = el(view, 'txtTraktUser').value.trim();
            c.TraktClientId = el(view, 'txtTraktClient').value.trim();
            c.RequestLimitDays = Math.max(1, intValue(view, 'numRequestLimitDays', 7));
            // Alleen overschrijven als de gebruikerslijst echt is geladen; anders blijft de bestaande lijst staan.
            if (state.usersLoaded) { c.BlockedUserIds = blockedFromList(view); }
            c.TmdbLanguageMode = tmdbLanguage === 'auto' ? 'auto' : 'manual';
            if (tmdbLanguage !== 'auto') { c.TmdbLanguage = tmdbLanguage; }
            var svc = el(view, 'selRequestService').value;
            c.RequestService = svc === 'seerr' || svc === 'seerr-arr' ? 'seerr' : 'arr';
            c.SeerrArrStatus = svc === 'seerr-arr';
            c.SeerrUrl = el(view, 'txtSeerrUrl').value.trim();
            c.SeerrApiKey = el(view, 'txtSeerrKey').value.trim();
            c.SabUrl = el(view, 'txtSabUrl').value.trim();
            c.SabApiKey = el(view, 'txtSabKey').value.trim();
            c.QbitUrl = el(view, 'txtQbitUrl').value.trim();
            c.QbitUser = el(view, 'txtQbitUser').value.trim();
            c.QbitPassword = el(view, 'txtQbitPass').value;
            c.NzbgetUrl = el(view, 'txtNzbgetUrl').value.trim();
            c.NzbgetUser = el(view, 'txtNzbgetUser').value.trim();
            c.NzbgetPassword = el(view, 'txtNzbgetPass').value;
            c.TransmissionUrl = el(view, 'txtTransUrl').value.trim();
            c.TransmissionUser = el(view, 'txtTransUser').value.trim();
            c.TransmissionPassword = el(view, 'txtTransPass').value;
            c.RadarrUrl = el(view, 'txtRadarrUrl').value.trim();
            c.RadarrApiKey = el(view, 'txtRadarrKey').value.trim();
            c.RadarrQualityProfileId = parseInt(el(view, 'selRadarrProfile').value, 10) || 0;
            c.RadarrRootFolder = el(view, 'selRadarrRoot').value || '';
            c.RadarrMinimumAvailability = el(view, 'selRadarrAvail').value || 'released';
            c.SonarrUrl = el(view, 'txtSonarrUrl').value.trim();
            c.SonarrApiKey = el(view, 'txtSonarrKey').value.trim();
            c.SonarrQualityProfileId = parseInt(el(view, 'selSonarrProfile').value, 10) || 0;
            c.SonarrRootFolder = el(view, 'selSonarrRoot').value || '';
            return ApiClient.updatePluginConfiguration(pluginId, c).then(function (result) {
                return ApiClient.getPluginConfiguration(pluginId).then(function (saved) {
                    if (saved.TmdbApiKey !== apiKey ||
                        saved.PluginLanguage !== c.PluginLanguage ||
                        !!saved.ShowDiagnostics !== c.ShowDiagnostics ||
                        (saved.ShowTrailerTile !== false) !== c.ShowTrailerTile ||
                        !!saved.InjectWebClientLoader !== c.InjectWebClientLoader ||
                        saved.TmdbLanguageMode !== c.TmdbLanguageMode ||
                        (c.TmdbLanguageMode === 'manual' && saved.TmdbLanguage !== c.TmdbLanguage)) {
                        throw new Error('Emby heeft de TMDB-key of taalinstelling niet bevestigd als opgeslagen.');
                    }
                    return result;
                });
            });
        }).then(function (r) {
            state.dirty = false;
            status.style.color = '#43a047';
            status.textContent = languageText(
                'Instellingen opgeslagen en door Emby bevestigd.',
                'Settings saved and confirmed by Emby.',
                'Einstellungen gespeichert und von Emby bestätigt.');
            hideLoading();
            if (window.Dashboard && Dashboard.processPluginConfigurationUpdateResult) {
                Dashboard.processPluginConfigurationUpdateResult(r);
            }
        }, function (err) {
            console.error('Discover: opslaan mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Opslaan mislukt: ', 'Saving failed: ', 'Speichern fehlgeschlagen: ') +
                ((err && (err.message || err.statusText)) || languageText('controleer Emby-logboek.', 'check the Emby log.', 'siehe Emby-Protokoll.'));
            hideLoading();
        });
    }

    function testConnection(view, kind, state) {
        var status = el(view, 'status' + kind);
        var url = el(view, 'txt' + kind + 'Url').value.trim();
        var key = el(view, 'txt' + kind + 'Key').value.trim();

        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Verbindung wird getestet...');

        // Huidige keuze (of opgeslagen waarde) onthouden zodat die na de test geselecteerd blijft
        var curProfile = el(view, 'sel' + kind + 'Profile').value;
        var curRoot = el(view, 'sel' + kind + 'Root').value;

        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: kind, Url: url, ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                    ((r && r.Error) || languageText('onbekende fout', 'unknown error', 'unbekannter Fehler'));
                return;
            }

            var profiles = [];
            (r.Profiles || []).forEach(function (p) {
                profiles.push({ value: p.Id, label: p.Name });
            });
            if (profiles.length === 0) { profiles.push({ value: 0, label: languageText('Geen profielen gevonden', 'No profiles found', 'Keine Profile gefunden') }); }
            fillSelect(el(view, 'sel' + kind + 'Profile'), profiles, curProfile);

            var roots = [];
            (r.RootFolders || []).forEach(function (f) {
                var gb = f.FreeSpace ? ' - ' + Math.round(f.FreeSpace / 1073741824) + ' ' + languageText('GB vrij', 'GB free', 'GB frei') : '';
                roots.push({ value: f.Path, label: f.Path + gb });
            });
            if (roots.length === 0) { roots.push({ value: '', label: languageText('Geen root folders gevonden', 'No root folders found', 'Keine Stammordner gefunden') }); }
            fillSelect(el(view, 'sel' + kind + 'Root'), roots, curRoot);

            status.style.color = '#43a047';
            status.textContent = languageText('Verbonden met ', 'Connected to ', 'Verbunden mit ') +
                (r.AppName || kind) + ' ' + (r.Version || '') +
                ' - ' + (r.Profiles || []).length + ' ' + languageText('profielen', 'profiles', 'Profilen') +
                ', ' + (r.RootFolders || []).length + ' ' + languageText('root folders gevonden.', 'root folders found.', 'Stammordner gefunden.');
        }, function (err) {
            console.error('Discover: test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText(
                'Mislukt: kon de testaanroep niet uitvoeren (is de plugin bijgewerkt en Emby herstart?).',
                'Failed: could not perform the test call (has the plugin been updated and Emby restarted?).',
                'Fehlgeschlagen: Testaufruf nicht möglich (wurde das Plugin aktualisiert und Emby neu gestartet?).');
        });
    }

    function testTmdb(view, state) {
        var status = el(view, 'statusTmdb');
        status.style.color = '';
        status.textContent = languageText('Testen...', 'Testing...', 'Verbindung wird getestet...');
        var key = el(view, 'txtTmdbKey').value.trim();
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'Tmdb', ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (r && r.Success) {
                status.style.color = '#43a047';
                status.textContent = languageText('TMDB-key werkt.', 'TMDB key works.', 'TMDB-Schlüssel funktioniert.');
                loadTmdbLanguages(view, key, el(view, 'selTmdbLang').value, state);
            } else {
                status.style.color = '#e53935';
                status.textContent = languageText('Mislukt: ', 'Failed: ', 'Fehlgeschlagen: ') +
                    ((r && r.Error) || languageText('onbekende fout', 'unknown error', 'unbekannter Fehler'));
            }
        }, function (err) {
            console.error('Discover: TMDB-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Mislukt: kon de testaanroep niet uitvoeren.',
                'Failed: could not perform the test call.',
                'Fehlgeschlagen: Testaufruf nicht möglich.');
        });
    }

    return function (view, params) {
        var state = { dirty: false, languageRequest: 0 };
        var form = view.querySelector('.discoverForm');

        // Zodra de gebruiker iets wijzigt, is de invoer 'dirty' tot het is opgeslagen
        form.addEventListener('input', function () { state.dirty = true; });
        form.addEventListener('change', function () { state.dirty = true; });
        el(view, 'selTmdbLang').addEventListener('change', function () {
            state.languageRequest++;
        });
        el(view, 'selPluginLanguage').addEventListener('change', function () {
            applyLanguage(view, this.value === 'auto'
                ? (window.navigator && navigator.language)
                : this.value);
            updateAutoTmdbOption(view, state);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            save(view, state);
            return false;
        });

        el(view, 'selAccent').addEventListener('change', function () { setAccent(view, this.value); });
        view.querySelector('.btnTestTmdb').addEventListener('click', function () {
            testTmdb(view, state);
        });
        view.querySelector('.btnTestRadarr').addEventListener('click', function () {
            testConnection(view, 'Radarr', state);
        });
        view.querySelector('.btnTestSonarr').addEventListener('click', function () {
            testConnection(view, 'Sonarr', state);
        });
        view.querySelector('.btnTestSeerr').addEventListener('click', function () {
            testSeerr(view);
        });
        view.querySelector('.btnTestSab').addEventListener('click', function () {
            testSab(view);
        });
        view.querySelector('.btnTestQbit').addEventListener('click', function () {
            testQbit(view);
        });
        view.querySelector('.btnTestNzbget').addEventListener('click', function () {
            testNzbget(view);
        });
        view.querySelector('.btnTestTrans').addEventListener('click', function () {
            testTrans(view);
        });
        el(view, 'selRequestService').addEventListener('change', function () {
            updateServiceView(view);
        });

        // Oogje bij de API keys: tonen of verbergen (standaard verborgen).
        Array.prototype.forEach.call(view.querySelectorAll('.btnToggleKey'), function (b) {
            b.addEventListener('click', function () {
                var input = el(view, b.getAttribute('data-target'));
                if (!input) { return; }
                var show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                var ico = b.querySelector('.md-icon');
                if (ico) { ico.textContent = show ? 'visibility_off' : 'visibility'; }
                        var toggleLabel = show
                            ? languageText('Verbergen', 'Hide', 'Ausblenden')
                            : languageText('Tonen', 'Show', 'Anzeigen');
                        b.setAttribute('title', toggleLabel);
                        b.setAttribute('aria-label', toggleLabel);
            });
        });

        Array.prototype.forEach.call(view.querySelectorAll('.dcTab'), function (b) {
            b.addEventListener('click', function () { showTab(view, b.getAttribute('data-tab')); });
        });
        // Altijd op Algemeen openen (de laatst gekozen tab onthouden liet de pagina op Diagnose openen).
        showTab(view, 'general');

        view.querySelector('.btnAllowAll').addEventListener('click', function () { setAllUsers(view, state, true); });
        view.querySelector('.btnAllowNone').addEventListener('click', function () { setAllUsers(view, state, false); });
        view.querySelector('.btnCleanNow').addEventListener('click', function () { cleanCache(view, false); });
        view.querySelector('.btnLoadRequests').addEventListener('click', function () { loadAllRequests(view); });
        view.querySelector('.btnTestTrakt').addEventListener('click', function () { testWatch(view, 'trakt'); });
        view.querySelector('.btnTestTmdbList').addEventListener('click', function () { testWatch(view, 'tmdb'); });
        view.querySelector('.btnTestOmdb').addEventListener('click', function () { testOmdb(view); });
        view.querySelector('.btnTestMdblist').addEventListener('click', function () { testMdblist(view); });
        view.querySelector('.btnClearAll').addEventListener('click', function () {
            var q = languageText(
                'Alle bewaarde kaartclips en tegelplaatjes verwijderen? Ze worden bij gebruik vanzelf opnieuw gemaakt.',
                'Delete all stored card clips and tile images? They are recreated automatically when needed.',
                'Alle gespeicherten Kartenclips und Kachelbilder löschen? Sie werden bei Bedarf automatisch neu erstellt.');
            if (window.confirm(q)) { cleanCache(view, true); }
        });

        view.querySelector('.btnUpdCheck').addEventListener('click', function () { checkUpdate(view, true); });
        view.querySelector('.btnUpdInstall').addEventListener('click', function () { installUpdate(view); });
        view.querySelector('.btnUpdRestart').addEventListener('click', function () { restartForUpdate(view); });
        el(view, 'chkUpdateAuto').addEventListener('change', function () { syncUpdateBoxes(view); });
        view.querySelector('.btnStatus').addEventListener('click', function () {
            if (window.Dashboard && Dashboard.navigate) { Dashboard.navigate('configurationpage?name=discoverstatus1079'); }
            else { window.location.hash = '#!/configurationpage?name=discoverstatus1079'; }
        });

        view.addEventListener('viewshow', function () {
            load(view, state);
        });
    };
});
