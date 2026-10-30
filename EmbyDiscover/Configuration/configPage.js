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

    function applyLanguage(view, locale) {
        var culture = String(locale || '').toLowerCase();
        configLanguage = culture.indexOf('nl') === 0 ? 'nl' : culture.indexOf('de') === 0 ? 'de' : (culture.indexOf('nb') === 0 || culture.indexOf('nn') === 0 || culture.indexOf('no') === 0) ? 'no' : 'en';
        var headings = view.querySelectorAll('.discoverForm h3');
        if (headings.length > 1) { headings[1].textContent = languageText('Radarr (films)', 'Radarr (movies)', 'Radarr (Filme)'); }
        if (headings.length > 2) { headings[2].textContent = languageText('Sonarr (series)', 'Sonarr (series)', 'Sonarr (Serien)'); }

        function label(id, dutch, english, german) {
            var target = view.querySelector('label[for="' + id + '"]');
            if (target) { target.textContent = languageText(dutch, english, german); }
        }

        label('txtTmdbKey', 'API key', 'API key', 'API-Schlüssel');
        label('selPluginLanguage', 'Plugin-taal', 'Plugin language', 'Plugin-Sprache');
        label('selTmdbLang', 'TMDB-taal', 'TMDB language', 'TMDB-Sprache');
        view.querySelector('.checkboxLabel').textContent = languageText(
            'Toon het gele debugbericht en media-informatie op itempagina\'s',
            'Show the yellow debug message and media information on item pages',
            'Gelbe Diagnosemeldung und Medieninformationen auf Detailseiten anzeigen');
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
                'Tegel "Discover Media" opent meteen de Discover-pagina (alleen in de browser; past de Emby-webclient aan)',
                'The "Discover Media" tile opens the Discover page directly (browser only; modifies the Emby web client)',
                'Kachel „Discover Media“ öffnet direkt die Discover-Seite (nur im Browser; ändert den Emby-Webclient)');
        }
        var injectDesc = view.querySelector('#desc_chkInjectWebClientLoader');
        if (injectDesc) {
            injectDesc.textContent = languageText(
                'Zet een klein lader-script in index.html van de webclient op de server. De officiele Emby-apps (tv, mobiel) hebben een eigen ingebouwde client en merken hier niets van; daar werkt Discover via het kanaal. Wordt bij elke serverstart opnieuw toegepast en netjes verwijderd als je dit weer uitzet. Staat de webclient op een andere plek, vul dan het pad in bij "Pad webclient" (leeg = automatisch zoeken).',
                'Adds a small loader script to the server web client index.html. The official Emby apps (TV, mobile) ship their own built-in client and are not affected; there Discover works through the channel. Re-applied on every server start and cleanly removed when you turn this off. If the web client lives elsewhere, set its path under "Web client path" (empty = search automatically).',
                'Fügt ein kleines Loader-Skript in die index.html des Server-Webclients ein. Die offiziellen Emby-Apps (TV, Mobil) haben einen eigenen eingebauten Client und sind nicht betroffen; dort funktioniert Discover über den Kanal. Wird bei jedem Serverstart erneut angewendet und sauber entfernt, wenn du dies wieder ausschaltest. Liegt der Webclient woanders, trage den Pfad unter „Webclient-Pfad“ ein (leer = automatisch suchen).');
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
            c.TmdbLanguageMode = tmdbLanguage === 'auto' ? 'auto' : 'manual';
            if (tmdbLanguage !== 'auto') { c.TmdbLanguage = tmdbLanguage; }
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

        view.querySelector('.btnStatus').addEventListener('click', function () {
            if (window.Dashboard && Dashboard.navigate) { Dashboard.navigate('configurationpage?name=discoverstatus1079'); }
            else { window.location.hash = '#!/configurationpage?name=discoverstatus1079'; }
        });

        view.addEventListener('viewshow', function () {
            load(view, state);
        });
    };
});
