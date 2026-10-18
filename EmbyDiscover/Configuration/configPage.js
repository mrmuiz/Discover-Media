define(['emby-input', 'emby-button', 'emby-select'], function () {
    'use strict';

    var pluginId = "7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90";

    function showLoading() { if (window.Dashboard && Dashboard.showLoadingMsg) { Dashboard.showLoadingMsg(); } }
    function hideLoading() { if (window.Dashboard && Dashboard.hideLoadingMsg) { Dashboard.hideLoadingMsg(); } }

    function el(view, id) { return view.querySelector('#' + id); }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    function load(view, state) {
        // Nooit niet-opgeslagen invoer overschrijven
        if (state.dirty) { return; }
        showLoading();
        ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            el(view, 'txtTmdbKey').value = c.TmdbApiKey || '';
            el(view, 'txtTmdbLang').value = c.TmdbLanguage || 'nl-NL';
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
        showLoading();
        ApiClient.getPluginConfiguration(pluginId).then(function (c) {
            c.TmdbApiKey = el(view, 'txtTmdbKey').value.trim();
            c.TmdbLanguage = el(view, 'txtTmdbLang').value.trim() || 'nl-NL';
            c.RadarrUrl = el(view, 'txtRadarrUrl').value.trim();
            c.RadarrApiKey = el(view, 'txtRadarrKey').value.trim();
            c.RadarrQualityProfileId = parseInt(el(view, 'selRadarrProfile').value, 10) || 0;
            c.RadarrRootFolder = el(view, 'selRadarrRoot').value || '';
            c.SonarrUrl = el(view, 'txtSonarrUrl').value.trim();
            c.SonarrApiKey = el(view, 'txtSonarrKey').value.trim();
            c.SonarrQualityProfileId = parseInt(el(view, 'selSonarrProfile').value, 10) || 0;
            c.SonarrRootFolder = el(view, 'selSonarrRoot').value || '';
            return ApiClient.updatePluginConfiguration(pluginId, c);
        }).then(function (r) {
            state.dirty = false;
            hideLoading();
            if (window.Dashboard && Dashboard.processPluginConfigurationUpdateResult) {
                Dashboard.processPluginConfigurationUpdateResult(r);
            }
        }, function (err) {
            console.error('Discover: opslaan mislukt', err);
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

    function testTmdb(view) {
        var status = el(view, 'statusTmdb');
        status.style.color = '';
        status.textContent = 'Testen...';
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'Tmdb', ApiKey: el(view, 'txtTmdbKey').value.trim() }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (r && r.Success) {
                status.style.color = '#43a047';
                status.textContent = 'TMDB-key werkt.';
            } else {
                status.style.color = '#e53935';
                status.textContent = 'Mislukt: ' + ((r && r.Error) || 'onbekende fout');
            }
        }, function (err) {
            console.error('Discover: TMDB-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = 'Mislukt: kon de testaanroep niet uitvoeren.';
        });
    }

    return function (view, params) {
        var state = { dirty: false };
        var form = view.querySelector('.discoverForm');

        // Zodra de gebruiker iets wijzigt, is de invoer 'dirty' tot het is opgeslagen
        form.addEventListener('input', function () { state.dirty = true; });
        form.addEventListener('change', function () { state.dirty = true; });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            save(view, state);
            return false;
        });

        view.querySelector('.btnTestTmdb').addEventListener('click', function () {
            testTmdb(view);
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
