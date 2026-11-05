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
        tab_tmdb: ['TMDB', 'TMDB', 'TMDB'],
        tab_arr: ['Aanvragen', 'Requests', 'Anfragen'],
        desc_requestService: [
            'Met Seerr gaan aanvragen naar Seerr, en Seerr stuurt ze door naar zijn eigen Radarr en Sonarr. Radarr en Sonarr hoef je hier dan niet in te stellen.',
            'With Seerr, requests go to Seerr, which passes them on to its own Radarr and Sonarr. You then do not need to set up Radarr and Sonarr here.',
            'Mit Seerr gehen Anfragen an Seerr, das sie an sein eigenes Radarr und Sonarr weitergibt. Radarr und Sonarr musst du hier dann nicht einrichten.'],
        desc_seerrKey: ['Te vinden in Seerr onder Instellingen > Algemeen.', 'Found in Seerr under Settings > General.', 'Zu finden in Seerr unter Einstellungen > Allgemein.'],
        lbl_chkSeerrRequestAsUser: [
            'Aanvragen op naam van de Seerr-gebruiker die bij de Emby-gebruiker hoort',
            'Request as the Seerr user that belongs to the Emby user',
            'Im Namen des Seerr-Benutzers anfordern, der zum Emby-Benutzer gehört'],
        desc_seerrAsUser: [
            'Seerr-gebruikers die uit Emby zijn geïmporteerd worden herkend. Dan gelden hun rechten, limieten en goedkeuring in Seerr. Zonder koppeling (of met dit vinkje uit) gaat de aanvraag op naam van de eigenaar van de API key.',
            'Seerr users imported from Emby are recognised, so their permissions, limits and approval in Seerr apply. Without a match (or with this box unticked) the request is made as the owner of the API key.',
            'Aus Emby importierte Seerr-Benutzer werden erkannt; dann gelten ihre Rechte, Limits und Freigaben in Seerr. Ohne Zuordnung (oder ohne diesen Haken) wird im Namen des Besitzers des API-Schlüssels angefordert.'],
        tab_users: ['Gebruikers', 'Users', 'Benutzer'],
        tab_storage: ['Opslag', 'Storage', 'Speicher'],
        tab_diag: ['Diagnose', 'Diagnostics', 'Diagnose'],
        desc_users: [
            'Vink aan wie mag aanvragen. Een gebruiker zonder vinkje kan wel bladeren en trailers bekijken, maar een aanvraag wordt niet doorgestuurd naar Radarr of Sonarr en de gebruiker krijgt een melding. Nieuwe gebruikers mogen standaard wel aanvragen.',
            'Tick who may make requests. A user without a tick can still browse and watch trailers, but a request is not sent to Radarr or Sonarr and the user gets a message. New users are allowed by default.',
            'Wähle aus, wer anfordern darf. Ein Benutzer ohne Haken kann weiter stöbern und Trailer ansehen, aber die Anfrage wird nicht an Radarr oder Sonarr gesendet und der Benutzer erhält eine Meldung. Neue Benutzer dürfen standardmäßig anfordern.'],
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
        var serviceSelect = el(view, 'selRequestService');
        if (serviceSelect && serviceSelect.options.length > 1) {
            serviceSelect.options[0].textContent = languageText('Radarr & Sonarr (rechtstreeks)', 'Radarr & Sonarr (directly)', 'Radarr & Sonarr (direkt)');
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
        view.querySelector('.btnStatus span').textContent = languageText('Status en diagnose', 'Status and diagnostics', 'Status und Diagnose');
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
        var seerr = el(view, 'selRequestService').value === 'seerr';
        el(view, 'seerrFields').style.display = seerr ? '' : 'none';
        el(view, 'arrFields').style.display = seerr ? 'none' : '';
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
        try { window.localStorage.setItem('discoverConfigTab', name); } catch (ignored) { }
        if (name === 'storage') { loadCache(view); }
    }

    function load(view, state) {
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
            el(view, 'selRequestService').value = c.RequestService === 'seerr' ? 'seerr' : 'arr';
            el(view, 'txtSeerrUrl').value = c.SeerrUrl || '';
            el(view, 'txtSeerrKey').value = c.SeerrApiKey || '';
            el(view, 'chkSeerrRequestAsUser').checked = c.SeerrRequestAsUser !== false;
            updateServiceView(view);
            el(view, 'txtRadarrUrl').value = c.RadarrUrl || '';
            el(view, 'txtRadarrKey').value = c.RadarrApiKey || '';
            el(view, 'txtSonarrUrl').value = c.SonarrUrl || '';
            el(view, 'txtSonarrKey').value = c.SonarrApiKey || '';
            fillSaved(view, 'Radarr', c.RadarrQualityProfileId || 0, c.RadarrRootFolder || '');
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
            // Alleen overschrijven als de gebruikerslijst echt is geladen; anders blijft de bestaande lijst staan.
            if (state.usersLoaded) { c.BlockedUserIds = blockedFromList(view); }
            c.TmdbLanguageMode = tmdbLanguage === 'auto' ? 'auto' : 'manual';
            if (tmdbLanguage !== 'auto') { c.TmdbLanguage = tmdbLanguage; }
            c.RequestService = el(view, 'selRequestService').value === 'seerr' ? 'seerr' : 'arr';
            c.SeerrUrl = el(view, 'txtSeerrUrl').value.trim();
            c.SeerrApiKey = el(view, 'txtSeerrKey').value.trim();
            c.SeerrRequestAsUser = el(view, 'chkSeerrRequestAsUser').checked;
            c.RadarrUrl = el(view, 'txtRadarrUrl').value.trim();
            c.RadarrApiKey = el(view, 'txtRadarrKey').value.trim();
            c.RadarrQualityProfileId = parseInt(el(view, 'selRadarrProfile').value, 10) || 0;
            c.RadarrRootFolder = el(view, 'selRadarrRoot').value || '';
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
        var savedTab = 'general';
        try { savedTab = window.localStorage.getItem('discoverConfigTab') || 'general'; } catch (ignored) { }
        if (!view.querySelector('.dcPanel[data-panel="' + savedTab + '"]')) { savedTab = 'general'; }
        showTab(view, savedTab);

        view.querySelector('.btnAllowAll').addEventListener('click', function () { setAllUsers(view, state, true); });
        view.querySelector('.btnAllowNone').addEventListener('click', function () { setAllUsers(view, state, false); });
        view.querySelector('.btnCleanNow').addEventListener('click', function () { cleanCache(view, false); });
        view.querySelector('.btnClearAll').addEventListener('click', function () {
            var q = languageText(
                'Alle bewaarde kaartclips en tegelplaatjes verwijderen? Ze worden bij gebruik vanzelf opnieuw gemaakt.',
                'Delete all stored card clips and tile images? They are recreated automatically when needed.',
                'Alle gespeicherten Kartenclips und Kachelbilder löschen? Sie werden bei Bedarf automatisch neu erstellt.');
            if (window.confirm(q)) { cleanCache(view, true); }
        });

        view.querySelector('.btnStatus').addEventListener('click', function () {
            if (window.Dashboard && Dashboard.navigate) { Dashboard.navigate('configurationpage?name=discoverstatus1079'); }
            else { window.location.hash = '#!/configurationpage?name=discoverstatus1079'; }
        });

        view.addEventListener('viewshow', function () {
            load(view, state);
        });
    };
});
