define(['emby-input', 'emby-button', 'emby-select', 'emby-checkbox'], function () {
    'use strict';

    var pluginId = "7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90";
    var configEnglish = false;

    function languageText(dutch, english) { return configEnglish ? english : dutch; }

    function applyLanguage(view, locale) {
        configEnglish = String(locale || '').toLowerCase().indexOf('nl') !== 0;
        var headings = view.querySelectorAll('.discoverForm h3');
        if (headings.length > 1) { headings[1].textContent = configEnglish ? 'Radarr (movies)' : 'Radarr (films)'; }
        if (headings.length > 2) { headings[2].textContent = configEnglish ? 'Sonarr (series)' : 'Sonarr (series)'; }

        function label(id, dutch, english) {
            var target = view.querySelector('label[for="' + id + '"]');
            if (target) { target.textContent = languageText(dutch, english); }
        }

        label('txtTmdbKey', 'API key', 'API key');
        label('selPluginLanguage', 'Plugin-taal', 'Plugin language');
        label('selTmdbLang', 'TMDB-taal', 'TMDB language');
        label('txtTmdbLanguage', 'Handmatige TMDB-taalcode (bijv. nl-NL of en-US)', 'Manual TMDB language code (e.g. nl-NL or en-US)');
        view.querySelector('.checkboxLabel').textContent = languageText(
            'Toon het gele debugbericht en media-informatie op itempagina\'s',
            'Show the yellow debug message and media information on item pages');
        label('txtRadarrUrl', 'URL (bijv. http://192.168.1.10:7878)', 'URL (e.g. http://192.168.1.10:7878)');
        label('txtRadarrKey', 'API key', 'API key');
        label('selRadarrProfile', 'Quality profile', 'Quality profile');
        label('selRadarrRoot', 'Root folder', 'Root folder');
        label('txtSonarrUrl', 'URL (bijv. http://192.168.1.10:8989)', 'URL (e.g. http://192.168.1.10:8989)');
        label('txtSonarrKey', 'API key', 'API key');
        label('selSonarrProfile', 'Quality profile', 'Quality profile');
        label('selSonarrRoot', 'Root folder', 'Root folder');

        var languageSelect = el(view, 'selPluginLanguage');
        languageSelect.options[0].textContent = languageText('Volg de taal van Emby Server', 'Follow Emby server language');
        languageSelect.options[1].textContent = 'Nederlands';
        languageSelect.options[2].textContent = 'English';
        el(view, 'selTmdbLang').options[0].textContent = languageText(
            'Volg de taal van Emby Server (automatisch)', 'Follow Emby server language (automatic)');
        view.querySelector('.btnTestTmdb span').textContent = languageText('Test TMDB-key', 'Test TMDB key');
        view.querySelector('.btnTestRadarr span').textContent = languageText('Test verbinding', 'Test connection');
        view.querySelector('.btnTestSonarr span').textContent = languageText('Test verbinding', 'Test connection');
        view.querySelector('.button-submit span').textContent = languageText('Opslaan', 'Save');
        view.querySelector('.btnStatus span').textContent = languageText('Status en diagnose', 'Status and diagnostics');
        view.querySelector('.btnStatus').nextElementSibling.textContent = languageText(
            'Controleert plugin, kanaal, TMDB, Radarr, Sonarr en gebruikerstoegang. Handig om twee servers te vergelijken.',
            'Checks the plugin, channel, TMDB, Radarr, Sonarr and user access. Useful when comparing two servers.');
        el(view, 'statusTmdbLanguages').textContent = languageText(
            'Voer een TMDB-key in en test deze om de volledige talenlijst te laden.',
            'Enter a TMDB key and test it to load the full language list.');
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

    // Voor het geval er nog niet getest is: toon de opgeslagen waarde zodat die niet verdwijnt
    var NO_PROFILE = 'Verbind eerst met de app (Test verbinding)';
    var NO_ROOT = 'Verbind eerst met de app (Test verbinding)';

    function fillSaved(view, kind, profileId, rootFolder) {
        var profiles = profileId
            ? [{ value: profileId, label: 'Profiel ID ' + profileId + ' (opgeslagen)' }]
            : [{ value: 0, label: NO_PROFILE }];
        fillSelect(el(view, 'sel' + kind + 'Profile'), profiles, profileId || 0);

        var roots = rootFolder
            ? [{ value: rootFolder, label: rootFolder + ' (opgeslagen)' }]
            : [{ value: '', label: NO_ROOT }];
        fillSelect(el(view, 'sel' + kind + 'Root'), roots, rootFolder || '');
    }

    function loadTmdbLanguages(view, key, selected, state) {
        var select = el(view, 'selTmdbLang');
        var status = el(view, 'statusTmdbLanguages');
        var fallback = el(view, 'tmdbLanguageFallback');
        var fallbackInput = el(view, 'txtTmdbLanguage');
        var requestId = ++state.languageRequest;
        var options = [{ value: 'auto', label: languageText(
            'Volg de taal van Emby Server (automatisch)', 'Follow Emby server language (automatic)') }];

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
                options.push({ value: current, label: current + ' (opgeslagen)' });
            }
            fillSelect(select, options, current);
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
            if (selected !== 'auto' && !fallbackInput.value) { fallbackInput.value = selected; }
            if (requestId === state.languageRequest) {
                status.textContent = languageText(
                    'TMDB-talenlijst niet beschikbaar: ' + message + '. Automatisch volgen en handmatige taalcode blijven bruikbaar.',
                    'TMDB language list unavailable: ' + message + '. Automatic selection and manual language codes remain available.');
            }
        }

        if (!key) {
            render([]);
            status.textContent = languageText(
                'Voer een TMDB-key in en test deze om de volledige talenlijst te laden. Je kunt hieronder ook handmatig een taalcode invullen.',
                'Enter and test a TMDB key to load the full language list. You can also enter a language code below.');
            return;
        }

        status.textContent = languageText('TMDB-talen laden...', 'Loading TMDB languages...');
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
                        'Volg automatisch de Emby-taal of selecteer handmatig een TMDB-taal.',
                        'Follow the Emby language automatically or select a TMDB language manually.');
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
            el(view, 'txtTmdbKey').value = c.TmdbApiKey || '';
            el(view, 'chkShowDiagnostics').checked = !!c.ShowDiagnostics;
            var browserLanguage = window.navigator && navigator.language;
            applyLanguage(view, c.PluginLanguage && c.PluginLanguage !== 'auto' ? c.PluginLanguage : browserLanguage);
            el(view, 'selPluginLanguage').value = c.PluginLanguage || 'auto';
            var tmdbLanguage = c.TmdbLanguageMode === 'manual' ? (c.TmdbLanguage || 'nl-NL') : 'auto';
            loadTmdbLanguages(view, c.TmdbApiKey || '', tmdbLanguage, state);
            if (!c.PluginLanguage || c.PluginLanguage === 'auto') {
                ApiClient.ajax({
                    type: 'GET',
                    url: ApiClient.getUrl('Discover/Status'),
                    dataType: 'json'
                }).then(function (serverStatus) {
                    if (!state.dirty && el(view, 'selPluginLanguage').value === 'auto') {
                        applyLanguage(view, serverStatus.PluginLanguage || browserLanguage);
                    }
                }, function (err) {
                    console.error('Discover: Emby-taal ophalen mislukt', err);
                });
            }
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
        status.textContent = languageText('Opslaan...', 'Saving...');
        showLoading();
        ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            var apiKey = el(view, 'txtTmdbKey').value.trim();
            var tmdbLanguage = el(view, 'selTmdbLang').value || 'auto';
            var fallbackLanguage = el(view, 'txtTmdbLanguage').value.trim();
            if (tmdbLanguage === 'auto' && fallbackLanguage) {
                if (!/^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*$/.test(fallbackLanguage)) {
                    throw new Error(languageText(
                        'Ongeldige TMDB-taalcode. Gebruik bijvoorbeeld nl-NL of en-US.',
                        'Invalid TMDB language code. For example, use nl-NL or en-US.'));
                }
                tmdbLanguage = fallbackLanguage.replace(/_/g, '-');
            }
            c.TmdbApiKey = apiKey;
            c.PluginLanguage = el(view, 'selPluginLanguage').value || 'auto';
            c.ShowDiagnostics = el(view, 'chkShowDiagnostics').checked;
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
                'Settings saved and confirmed by Emby.');
            hideLoading();
            if (window.Dashboard && Dashboard.processPluginConfigurationUpdateResult) {
                Dashboard.processPluginConfigurationUpdateResult(r);
            }
        }, function (err) {
            console.error('Discover: opslaan mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Opslaan mislukt: ', 'Saving failed: ') +
                ((err && (err.message || err.statusText)) || languageText('controleer Emby-logboek.', 'check the Emby log.'));
            hideLoading();
        });
    }

    function testConnection(view, kind, state) {
        var status = el(view, 'status' + kind);
        var url = el(view, 'txt' + kind + 'Url').value.trim();
        var key = el(view, 'txt' + kind + 'Key').value.trim();

        status.style.color = '';
        status.textContent = 'Testen...';

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
                status.textContent = 'Mislukt: ' + ((r && r.Error) || 'onbekende fout');
                return;
            }

            var profiles = [];
            (r.Profiles || []).forEach(function (p) {
                profiles.push({ value: p.Id, label: p.Name });
            });
            if (profiles.length === 0) { profiles.push({ value: 0, label: 'Geen profielen gevonden' }); }
            fillSelect(el(view, 'sel' + kind + 'Profile'), profiles, curProfile);

            var roots = [];
            (r.RootFolders || []).forEach(function (f) {
                var gb = f.FreeSpace ? ' - ' + Math.round(f.FreeSpace / 1073741824) + ' GB vrij' : '';
                roots.push({ value: f.Path, label: f.Path + gb });
            });
            if (roots.length === 0) { roots.push({ value: '', label: 'Geen root folders gevonden' }); }
            fillSelect(el(view, 'sel' + kind + 'Root'), roots, curRoot);

            status.style.color = '#43a047';
            status.textContent = 'Verbonden met ' + (r.AppName || kind) + ' ' + (r.Version || '') +
                ' - ' + (r.Profiles || []).length + ' profielen, ' + (r.RootFolders || []).length + ' root folders gevonden.';
        }, function (err) {
            console.error('Discover: test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = 'Mislukt: kon de testaanroep niet uitvoeren (is de plugin bijgewerkt en Emby herstart?).';
        });
    }

    function testTmdb(view, state) {
        var status = el(view, 'statusTmdb');
        status.style.color = '';
        status.textContent = 'Testen...';
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
                status.textContent = languageText('TMDB-key werkt.', 'TMDB key works.');
                loadTmdbLanguages(view, key, el(view, 'selTmdbLang').value, state);
            } else {
                status.style.color = '#e53935';
                status.textContent = languageText('Mislukt: ', 'Failed: ') +
                    ((r && r.Error) || languageText('onbekende fout', 'unknown error'));
            }
        }, function (err) {
            console.error('Discover: TMDB-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = languageText('Mislukt: kon de testaanroep niet uitvoeren.',
                'Failed: could not perform the test call.');
        });
    }

    return function (view, params) {
        var state = { dirty: false, languageRequest: 0 };
        var form = view.querySelector('.discoverForm');

        // Zodra de gebruiker iets wijzigt, is de invoer 'dirty' tot het is opgeslagen
        form.addEventListener('input', function () { state.dirty = true; });
        form.addEventListener('change', function () { state.dirty = true; });
        el(view, 'selTmdbLang').addEventListener('change', function () { state.languageRequest++; });
        el(view, 'txtTmdbLanguage').addEventListener('input', function () { state.languageRequest++; });
        el(view, 'selPluginLanguage').addEventListener('change', function () {
            applyLanguage(view, this.value === 'auto'
                ? (window.navigator && navigator.language)
                : this.value);
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
                b.setAttribute('title', show ? 'Verbergen' : 'Tonen');
                b.setAttribute('aria-label', show ? 'Verbergen' : 'Tonen');
            });
        });

        view.querySelector('.btnStatus').addEventListener('click', function () {
            if (window.Dashboard && Dashboard.navigate) { Dashboard.navigate('configurationpage?name=discoverstatus'); }
            else { window.location.hash = '#!/configurationpage?name=discoverstatus'; }
        });

        view.addEventListener('viewshow', function () {
            load(view, state);
        });
    };
});
