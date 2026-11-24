define(['emby-input', 'emby-button', 'emby-select', 'emby-checkbox'], function () {
    'use strict';

    var pluginId = "7b0f3a52-4c1e-4a7b-9d2e-5f6c8a1b3d90";

    // <fallback-en> automatisch gevuld door tools/sync-js-fallback.py; niet met de hand aanpassen
    var STR_EN = {
        "api.cleanup_failed": "Cleanup failed: ",
        "btn.available": "Available",
        "btn.status": "Status",
        "btn.title_fallback": "Title",
        "cfg.admin_only": "These settings are only for the server owner. Sign in as an administrator to see them.",
        "cfg.administrator": "administrator",
        "cfg.auto_follow_language": "{0} (automatic)",
        "cfg.cancel": "Cancel",
        "cfg.card_clips": "Card clips: ",
        "cfg.change_time": "Change time",
        "cfg.check_now": "Check now",
        "cfg.check_the_emby_log": "check the Emby log.",
        "cfg.checks_the_plugin_channel_tmdb_radarr_sonarr": "Checks the plugin, channel, TMDB, Radarr, Sonarr and user access. Useful when comparing two servers.",
        "cfg.connect_to_the_app_first_test_connection": "Connect to the app first (Test connection)",
        "cfg.connected_to": "Connected to ",
        "cfg.connected_to_sabnzbd": "Connected to SABnzbd",
        "cfg.date": "Date",
        "cfg.delete_all_stored_card_clips_and_tile_images": "Delete all stored card clips and tile images? They are recreated automatically when needed.",
        "cfg.desc_requestService": "With Seerr, requests go to Seerr, which passes them on to its own Radarr and Sonarr. You then do not need to set up Radarr and Sonarr here.",
        "cfg.disabled": "disabled",
        "cfg.done": "Done.",
        "cfg.downloading_and_installing": "Downloading and installing...",
        "cfg.emby_is_restarting_refresh_the_page_in_a": "Emby is restarting. Refresh the page in a minute.",
        "cfg.enter_a_tmdb_key_and_test_it_to_load_the": "Enter a TMDB key and test it to load the full language list.",
        "cfg.enter_and_test_a_tmdb_key_to_load_the_full": "Enter and test a TMDB key to load the full language list.",
        "cfg.exclude_languages_original_language": "Exclude languages (original language)",
        "cfg.failed_could_not_perform_the_test_call": "Failed: could not perform the test call.",
        "cfg.failed_could_not_perform_the_test_call_has": "Failed: could not perform the test call (has the plugin been updated and Emby restarted?).",
        "cfg.files": " files (",
        "cfg.follow_emby_server_language": "Follow Emby server language",
        "cfg.follow_plugin_emby_language_automatic": "Follow plugin/Emby language (automatic)",
        "cfg.follow_the_plugin_emby_language_automatically": "Follow the plugin/Emby language automatically or select a TMDB language manually.",
        "cfg.gb_free": "GB free",
        "cfg.hide": "Hide",
        "cfg.install_this_version": "Install this version",
        "cfg.install_version_confirm": "Install version {0}? Then restart Emby.",
        "cfg.installed": "Installed: ",
        "cfg.installed_2": " – installed",
        "cfg.is_installed_restart_emby_to_activate_it": " is installed. Restart Emby to activate it.",
        "cfg.loading_the_overview_failed": "Loading the overview failed: ",
        "cfg.loading_tmdb_languages": "Loading TMDB languages...",
        "cfg.loading_users": "Loading users...",
        "cfg.loading_users_failed_the_existing_setting": "Loading users failed; the existing setting stays unchanged.",
        "cfg.looking_for_updates": "Looking for updates…",
        "cfg.movie": "movie",
        "cfg.n_of_m_may_request": "{0} of {1} may request",
        "cfg.new_version_available": "New version available: ",
        "cfg.newer_than_the_latest_release": "newer than the latest release",
        "cfg.no_profiles_found": "No profiles found",
        "cfg.no_requests_through_discover_yet": "No requests through Discover yet.",
        "cfg.no_root_folders_found": "No root folders found",
        "cfg.no_updater": " – no updater",
        "cfg.not_checked_automatically_click_check_now": "Not checked automatically. Click Check now.",
        "cfg.note_this_version_has_no_updates_tab_yet": "Note: this version has no Updates tab yet. Going back to a newer version is then manual only.",
        "cfg.ok": "OK",
        "cfg.ombi_radarr_sonarr_for_the_status": "Ombi + Radarr & Sonarr (for the status)",
        "cfg.previous_versions": "Previous versions",
        "cfg.profile_id": "Profile ID ",
        "cfg.profiles": "profiles",
        "cfg.radarr_movies": "Radarr (movies)",
        "cfg.radarr_sonarr_directly": "Radarr & Sonarr (directly)",
        "cfg.removed": "Removed",
        "cfg.requests": " requests",
        "cfg.requests_go_to_ombi_radarr_and_sonarr_are": "Requests go to Ombi. Radarr and Sonarr are read alongside it for the titles already in your library, the progress of downloads and cancelling a request. Ombi itself has no queue the plugin can read.",
        "cfg.requests_go_to_seerr_with_approval_and_limits": "Requests go to Seerr (with approval and limits from Seerr). Radarr and Sonarr are only read, for the real status in the queue: waiting to import, importing, a blocked import and the reason for a problem.",
        "cfg.restart_emby": "Restart Emby",
        "cfg.restart_emby_now_anyone_watching_will_be": "Restart Emby now? Anyone watching will be interrupted briefly.",
        "cfg.root_folders_found": "root folders found.",
        "cfg.run_diagnostics": "Run diagnostics",
        "cfg.save": "Save",
        "cfg.saved": "(saved)",
        "cfg.saved_2": "saved",
        "cfg.saving": "Saving...",
        "cfg.saving_failed": "Saving failed: ",
        "cfg.search_users": "Search users",
        "cfg.seerr_radarr_sonarr_for_the_status": "Seerr + Radarr & Sonarr (for the status)",
        "cfg.series": "series",
        "cfg.server_s_set_up_in": "server(s) set up in ",
        "cfg.settings_saved_and_confirmed_by_emby": "Settings saved and confirmed by Emby.",
        "cfg.show": "Show",
        "cfg.show_the_trailer_tile_next_to_request_channel": "Show the Trailer tile next to Request (channel and Discover page)",
        "cfg.show_the_yellow_debug_message_and_media": "Show the yellow debug message and media information on item pages",
        "cfg.size_not_available_administrators_only": "Size not available (administrators only).",
        "cfg.sonarr_series": "Sonarr (series)",
        "cfg.test_connection": "Test connection",
        "cfg.test_tmdb_key": "Test TMDB key",
        "cfg.testing": "Testing...",
        "cfg.this_is_the_latest_version": "this is the latest version",
        "cfg.tile_opens_discover_page": "Tile opens Discover page",
        "cfg.tiles": "Tiles: ",
        "cfg.titles_with_these_original_languages_are": "Titles with these original languages are hidden from rows and folders. Use language codes separated by commas, e.g. ja (Japanese), ko (Korean), zh (Chinese), hi (Hindi), ta (Tamil), te (Telugu), th (Thai), tr (Turkish). Search still shows them.",
        "cfg.tmdb_key_works": "TMDB key works.",
        "cfg.tmdb_language_list_unavailable": "TMDB language list unavailable: {0}. Automatic language selection remains available.",
        "cfg.update_to": "Update to ",
        "cfg.user": "User",
        "cfg.version": "Version ",
        "cfg.web_client_browser_only_the_discover_media": "Web client (browser) only: the \"Discover Media\" tile opens the Discover page directly. This adds a small loader script to the web client's index.html. It takes effect right after saving, no restart needed. When turned off, the tile simply opens the channel tiles (the script stays in place but does nothing). The Emby apps (TV, mobile) are not affected; there Discover works through the channel.",
        "cfg.what_s_new_in": "What's new in ",
        "cfg.when_radarr_starts_looking_for_a_new_movie": "When Radarr starts looking for a new movie: from the announcement, from the cinema release, or only once it is released (default). Administrators can choose this per movie in the popup.",
        "cfg.with_ombi_requests_go_to_ombi_which_passes": "With Ombi, requests go to Ombi, which passes them on to its own Radarr and Sonarr. Add Radarr and Sonarr below as well if you also want to see what is already in your library and how far a download has got.",
        "cfg.without_arr_server": "Without a Radarr or Sonarr server {0} cannot fulfil those requests.",
        "cfg.working": "Working...",
        "channel.requested_2": "Requested",
        "ui.failed": "Failed: ",
        "ui.loading": "Loading...",
        "ui.unknown_error": "unknown error"
    };
    // </fallback-en>
    // De teksten komen van de server (Discover/Status), op sleutel, in de taal van de kijker.
    var STR = {};
    function t(key) {
        var s = STR[key];
        if (s == null) { s = STR_EN[key]; }
        if (s == null) { s = key; }
        for (var i = 1; i < arguments.length; i++) { s = s.split('{' + (i - 1) + '}').join(String(arguments[i])); }
        return s;
    }

    // Eigen bevestiging in de pagina, in plaats van window.confirm(): dat laatste zet op sommige apps
    // (Emby voor Android laadt de webclient via file://) een lelijke "De pagina op 'file://' meldt..."-kop
    // boven het venster. Geeft een belofte terug die true/false oplevert.
    function dcConfirm(message) {
        return new Promise(function (resolve) {
            if (!document.getElementById('dcConfirmCss')) {
                var st = document.createElement('style');
                st.id = 'dcConfirmCss';
                st.textContent = '.dcConfirmOverlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.6);' +
                    'display:flex;align-items:center;justify-content:center;padding:16px}' +
                    '.dcConfirmBox{background:#1f1f1f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:14px;' +
                    'max-width:380px;width:100%;padding:20px 20px 16px;box-shadow:0 12px 40px rgba(0,0,0,.5)}' +
                    '.dcConfirmMsg{font-size:1rem;line-height:1.5;margin-bottom:18px}' +
                    '.dcConfirmBtns{display:flex;gap:10px;justify-content:flex-end}' +
                    '.dcConfirmBtns button{border:0;border-radius:999px;padding:9px 20px;font-size:.95rem;cursor:pointer}' +
                    '.dcConfirmNo{background:rgba(255,255,255,.12);color:#fff}' +
                    '.dcConfirmYes{background:#4caf50;color:#0b2a12;font-weight:600}';
                document.head.appendChild(st);
            }
            var ov = document.createElement('div');
            ov.className = 'dcConfirmOverlay';
            ov.innerHTML = '<div class="dcConfirmBox" role="dialog" aria-modal="true"><div class="dcConfirmMsg"></div>' +
                '<div class="dcConfirmBtns"><button type="button" class="dcConfirmNo"></button>' +
                '<button type="button" class="dcConfirmYes"></button></div></div>';
            ov.querySelector('.dcConfirmMsg').textContent = message;
            ov.querySelector('.dcConfirmNo').textContent = t('cfg.cancel');
            ov.querySelector('.dcConfirmYes').textContent = t('cfg.ok');
            function done(val) { try { ov.parentNode.removeChild(ov); } catch (e) { } resolve(val); }
            ov.querySelector('.dcConfirmNo').addEventListener('click', function () { done(false); });
            ov.querySelector('.dcConfirmYes').addEventListener('click', function () { done(true); });
            ov.addEventListener('click', function (e) { if (e.target === ov) { done(false); } });
            document.body.appendChild(ov);
            var yes = ov.querySelector('.dcConfirmYes');
            if (yes.focus) { try { yes.focus(); } catch (e) { } }
        });
    }

    // Cultuurcode bij een taalkeuze. De lijst met talen komt van de server (status.Languages), dus daar staat
    // de juiste cultuurcode al bij; eerder gaf dit voor alles behalve nl en de "en-US" terug, waardoor bij
    // "automatisch" de verkeerde TMDB-taal in beeld stond.
    var serverLanguages = [];
    function languageCode(locale) {
        var culture = String(locale || '').trim();
        if (!culture) { return 'en-US'; }
        var low = culture.toLowerCase();
        for (var i = 0; i < serverLanguages.length; i++) {
            var lang = serverLanguages[i];
            var code = String(lang.Code || '').toLowerCase();
            var cult = String(lang.Culture || '').toLowerCase();
            if (low === cult || low === code) { return lang.Culture || culture; }
        }
        for (var j = 0; j < serverLanguages.length; j++) {
            var base = String(serverLanguages[j].Code || '').toLowerCase().split('-')[0];
            if (base && low.split(/[-_]/)[0] === base) { return serverLanguages[j].Culture || culture; }
        }
        return culture.indexOf('-') > 0 ? culture : 'en-US';
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
        option.textContent = t('cfg.auto_follow_language', current);
    }

    // Teksten van de tabbladen en de nieuwe instellingen: id -> [Nederlands, English, Deutsch]
    // De teksten staan in Lang/*.json; dit zijn de id's van de elementen die ze krijgen.
    var TEXT_IDS = [
        'tab_general',
        'tab_look',
        'hdgLook',
        'lbl_selAccent',
        'desc_selAccent',
        'optAccent0',
        'optAccent1',
        'optAccent2',
        'optAccent3',
        'optAccent4',
        'optAccent5',
        'optAccent6',
        'optAccent7',
        'optAccent8',
        'lbl_chkPageBackdrops',
        'desc_chkPageBackdrops',
        'lbl_chkPosterYear',
        'lbl_chkShowSpecials',
        'lbl_chkShowTitleLogo',
        'lbl_selPosterScore',
        'optScore0',
        'optScore1',
        'optScore2',
        'desc_selPosterScore',
        'lbl_chkPosterScore',
        'hdgOmdb',
        'lbl_txtOmdbKey',
        'desc_txtOmdbKey',
        'btnTestOmdbText',
        'btnTestMdblistText',
        'lbl_txtMdblistKey',
        'desc_txtMdblistKey',
        'tab_updates',
        'lbl_chkUpdateCheck',
        'lbl_chkUpdateBeta',
        'desc_chkUpdateBeta',
        'lbl_chkUpdateAuto',
        'lbl_chkUpdateRestart',
        'desc_chkUpdateRestart',
        'lbl_chkAllowInvalidCerts',
        'desc_chkAllowInvalidCerts',
        'lbl_chkShowNextEpisode',
        'lbl_chkShowOmdb',
        'lbl_txtFanartKey',
        'desc_txtFanartKey',
        'hdgTiles',
        'hdgOwnLists',
        'tab_tmdb',
        'tab_arr',
        'desc_requestService',
        'desc_seerrKey',
        'desc_ombiKey',
        'desc_ombiAsUser',
        'desc_seerrAsUser',
        'tab_users',
        'tab_storage',
        'tab_diag',
        'desc_users',
        'hdgExtraRows',
        'lbl_chkShowMyRequests',
        'lbl_chkShowNewSeasons',
        'lbl_chkShowRecentlyAdded',
        'lbl_chkShowRecentRequests',
        'lbl_txtTmdbList',
        'desc_txtTmdbList',
        'btnTestTmdbListText',
        'lbl_txtTraktUser',
        'lbl_txtTraktClient',
        'desc_trakt',
        'btnTestTraktText',
        'hdgSab',
        'desc_sab',
        'desc_sabKey',
        'hdgQbit',
        'desc_qbit',
        'hdgNzbget',
        'desc_nzbget',
        'hdgTrans',
        'desc_trans',
        'hdgLimit',
        'lbl_numRequestLimit',
        'lbl_numRequestLimitDays',
        'desc_limit',
        'hdgAllRequests',
        'btnLoadRequestsText',
        'btnAllowAllText',
        'btnAllowNoneText',
        'lbl_chkPrecreateCards',
        'desc_chkPrecreateCards',
        'lbl_numCardDays',
        'lbl_numTileDays',
        'lbl_numMaxCacheMb',
        'desc_storage',
        'btnCleanNowText',
        'btnClearAllText'
    ];

    // Kleine vlaggen als inline SVG; geen externe bestanden en geen emoji (die tekent Windows niet).
var FLAGS = {
        "auto": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"6.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\"/><path d=\"M12 1.8v12.4M5.8 8h12.4M12 1.8c2.6 2.8 2.6 9.6 0 12.4M12 1.8c-2.6 2.8-2.6 9.6 0 12.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.1\"/></svg>",
        "cs": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"8\" fill=\"#fff\"/><rect y=\"8\" width=\"24\" height=\"8\" fill=\"#d7141a\"/><path d=\"M0 0l10 8-10 8z\" fill=\"#11457e\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "da": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#c8102e\"/><rect x=\"7\" width=\"3\" height=\"16\" fill=\"#fff\"/><rect y=\"6.5\" width=\"24\" height=\"3\" fill=\"#fff\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "de": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#000\"/><rect y=\"5.33\" width=\"24\" height=\"5.34\" fill=\"#dd0000\"/><rect y=\"10.67\" width=\"24\" height=\"5.33\" fill=\"#ffce00\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "en": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#012169\"/><path d=\"M0 0l24 16M24 0L0 16\" stroke=\"#fff\" stroke-width=\"3.2\"/><path d=\"M0 0l24 16M24 0L0 16\" stroke=\"#c8102e\" stroke-width=\"1.9\"/><path d=\"M12 0v16M0 8h24\" stroke=\"#fff\" stroke-width=\"5.3\"/><path d=\"M12 0v16M0 8h24\" stroke=\"#c8102e\" stroke-width=\"3.2\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "es": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#c60b1e\"/><rect y=\"4\" width=\"24\" height=\"8\" fill=\"#ffc400\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "fr": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"8\" height=\"16\" fill=\"#002395\"/><rect x=\"8\" width=\"8\" height=\"16\" fill=\"#fff\"/><rect x=\"16\" width=\"8\" height=\"16\" fill=\"#ed2939\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "it": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"8\" height=\"16\" fill=\"#009246\"/><rect x=\"8\" width=\"8\" height=\"16\" fill=\"#fff\"/><rect x=\"16\" width=\"8\" height=\"16\" fill=\"#ce2b37\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "ja": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#fff\"/><circle cx=\"12\" cy=\"8\" r=\"4.6\" fill=\"#bc002d\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "nb": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#ba0c2f\"/><rect x=\"7\" width=\"3\" height=\"16\" fill=\"#fff\"/><rect y=\"6.5\" width=\"24\" height=\"3\" fill=\"#fff\"/><rect x=\"7.8\" width=\"1.4\" height=\"16\" fill=\"#00205b\"/><rect y=\"7.3\" width=\"24\" height=\"1.4\" fill=\"#00205b\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "nl": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#ae1c28\"/><rect y=\"5.33\" width=\"24\" height=\"5.34\" fill=\"#fff\"/><rect y=\"10.67\" width=\"24\" height=\"5.33\" fill=\"#21468b\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "pl": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"8\" fill=\"#fff\"/><rect y=\"8\" width=\"24\" height=\"8\" fill=\"#dc143c\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "pt-br": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#009b3a\"/><path d=\"M12 1.6L22.4 8 12 14.4 1.6 8z\" fill=\"#fedf00\"/><circle cx=\"12\" cy=\"8\" r=\"3.4\" fill=\"#002776\"/><path d=\"M8.9 6.9a7 7 0 016.2 1.5\" stroke=\"#fff\" stroke-width=\".9\" fill=\"none\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "ru": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#fff\"/><rect y=\"5.33\" width=\"24\" height=\"5.34\" fill=\"#0039a6\"/><rect y=\"10.67\" width=\"24\" height=\"5.33\" fill=\"#d52b1e\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "sv": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#006aa7\"/><rect x=\"7\" width=\"3\" height=\"16\" fill=\"#fecc00\"/><rect y=\"6.5\" width=\"24\" height=\"3\" fill=\"#fecc00\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "zh-cn": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#de2910\"/><path d=\"M4 2.3l.86 2.64-2.25-1.63h2.78L3.14 4.94z\" fill=\"#ffde00\"/><circle cx=\"8.4\" cy=\"2\" r=\".8\" fill=\"#ffde00\"/><circle cx=\"10.2\" cy=\"3.9\" r=\".8\" fill=\"#ffde00\"/><circle cx=\"10.2\" cy=\"6.4\" r=\".8\" fill=\"#ffde00\"/><circle cx=\"8.4\" cy=\"8.2\" r=\".8\" fill=\"#ffde00\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>",
        "zh-tw": "<svg viewBox=\"0 0 24 16\" width=\"24\" height=\"16\" aria-hidden=\"true\"><rect width=\"24\" height=\"16\" fill=\"#fe0000\"/><rect width=\"12\" height=\"8\" fill=\"#000095\"/><circle cx=\"6\" cy=\"4\" r=\"2.6\" fill=\"#fff\"/><circle cx=\"6\" cy=\"4\" r=\"1.7\" fill=\"#000095\"/><circle cx=\"6\" cy=\"4\" r=\"1.2\" fill=\"#fff\"/><rect width=\"24\" height=\"16\" fill=\"none\" stroke=\"rgba(0,0,0,.35)\"/></svg>"
    };

    // Emby heeft een licht en een donker thema. Meet de achtergrond van de pagina en pas de lijst aan,
    // anders staat er donkere tekst op een donkere lijst (of andersom).
    // Emby heeft een licht en een donker thema, en dat staat niet in een media query. Meet dus de
    // achtergrond van de pagina: alles wat de plugin zelf tekent, richt zich daarnaar.
    function pageBackground(from) {
        var node = from || document.body;
        while (node && node.nodeType === 1) {
            var c = window.getComputedStyle(node).backgroundColor;
            if (c && c !== 'transparent' && c.replace(/\s/g, '') !== 'rgba(0,0,0,0)') { return c; }
            node = node.parentNode;
        }
        return window.getComputedStyle(document.body).backgroundColor || '#1b1f24';
    }

    function isLight(color) {
        var rgb = (String(color).match(/\d+/g) || [27, 31, 36]).map(Number);
        return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.55;
    }

    // De gewone <select> voor de themakleur heeft geen Emby-opmaak, dus die kleuren we zelf.
    function paintPlainSelects(view) {
        var bg = pageBackground(view);
        var light = isLight(bg);
        Array.prototype.forEach.call(view.querySelectorAll('.dcPlainSelect'), function (sel) {
            sel.style.backgroundColor = light ? '#ffffff' : '#2b2b2b';
            sel.style.color = light ? 'rgba(0,0,0,.87)' : '#ffffff';
            sel.style.borderColor = light ? 'rgba(0,0,0,.35)' : '#888888';
        });
    }

    function paintTheme(picker, list, button) {
        var bg = pageBackground(picker.parentNode);
        picker.classList.toggle('dcLightUi', isLight(bg));
        list.style.backgroundColor = bg;
        if (button) { button.style.backgroundColor = ''; button.style.color = ''; button.style.borderColor = ''; }
    }

    function flagFor(code) {
        if (!code) { return FLAGS.auto; }
        var key = String(code).toLowerCase().replace('_', '-');
        if (FLAGS[key]) { return FLAGS[key]; }
        var base = key.split('-')[0];
        if (base === 'nn' || base === 'no') { base = 'nb'; }
        if (base === 'pt') { base = 'pt-br'; }
        if (base === 'zh') { base = 'zh-cn'; }
        return FLAGS[base] || '<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"></svg>';
    }

    // De talen komen van de server: wie een eigen taalbestand neerzet, ziet die taal hier vanzelf staan.
    function fillLanguageSelect(view, languages, current) {
        var select = el(view, 'selPluginLanguage');
        if (!select || !languages || !languages.length) { return; }
        var html = '<option value="auto"></option>';
        for (var i = 0; i < languages.length; i++) {
            var lang = languages[i];
            html += '<option value="' + lang.Culture + '">' + (lang.Name || lang.Culture) + '</option>';
        }
        select.innerHTML = html;
        select.options[0].textContent = t('cfg.follow_emby_server_language');
        select.value = current || 'auto';
        if (!select.value) { select.value = 'auto'; }
        try { buildLanguagePicker(view, select, languages); } catch (e) { /* dan blijft de gewone lijst staan */ }
    }

    // Een eigen lijstje met vlaggen. De echte <select> blijft bestaan (verborgen) en houdt de waarde vast,
    // zodat opslaan en de rest van de pagina niets merken. Mislukt dit, dan blijft de <select> gewoon zichtbaar.
    function buildLanguagePicker(view, select, languages) {
        var container = select.parentNode;
        if (!container) { return; }

        var picker = container.querySelector('.dcLangPick');
        if (!picker) {
            picker = document.createElement('div');
            picker.className = 'dcLangPick';
            picker.innerHTML = '<button type="button" class="dcLangBtn"></button><div class="dcLangList" hidden></div>';
            select.parentNode.insertBefore(picker, select.nextSibling);
        }

        var button = picker.querySelector('.dcLangBtn');
        var list = picker.querySelector('.dcLangList');
        var rows = [{ Culture: 'auto', Name: t('cfg.follow_emby_server_language'), Code: 'auto' }].concat(languages);

        function label(culture) {
            var name = t('cfg.follow_emby_server_language');
            for (var i = 0; i < languages.length; i++) {
                if (languages[i].Culture === culture) { name = languages[i].Name || languages[i].Culture; }
            }
            var code = culture === 'auto' ? 'auto' : culture;
            return '<span class="dcFlag">' + flagFor(code) + '</span><span class="dcLangName">' + esc(name) + '</span>';
        }

        function paint() {
            button.innerHTML = label(select.value || 'auto') + '<span class="dcLangCaret">\u25be</span>';
            var html = '';
            for (var i = 0; i < rows.length; i++) {
                var value = rows[i].Culture;
                var on = (select.value || 'auto') === value;
                html += '<button type="button" class="dcLangOpt' + (on ? ' dcOn' : '') + '" data-value="' + esc(value) + '">' +
                    '<span class="dcFlag">' + flagFor(rows[i].Code || value) + '</span>' +
                    '<span class="dcLangName">' + esc(rows[i].Name || value) + '</span></button>';
            }
            list.innerHTML = html;
        }

        function open(yes) {
            list.hidden = !yes;
            picker.classList.toggle('dcOpen', !!yes);
            if (yes) {
                var on = list.querySelector('.dcOn') || list.querySelector('.dcLangOpt');
                if (on) { on.focus(); }
            }
        }

        if (!picker.dataset.wired) {
            picker.dataset.wired = '1';
            button.addEventListener('click', function () { open(list.hidden); });
            list.addEventListener('click', function (e) {
                var option = e.target.closest ? e.target.closest('.dcLangOpt') : null;
                if (!option) { return; }
                select.value = option.getAttribute('data-value');
                select.dispatchEvent(new Event('change', { bubbles: true }));
                paint();
                open(false);
                button.focus();
            });
            list.addEventListener('keydown', function (e) {
                var options = Array.prototype.slice.call(list.querySelectorAll('.dcLangOpt'));
                var at = options.indexOf(document.activeElement);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    var next = options[at + (e.key === 'ArrowDown' ? 1 : -1)];
                    if (next) { next.focus(); }
                } else if (e.key === 'Escape') {
                    open(false); button.focus();
                }
            });
            document.addEventListener('click', function (e) {
                if (!picker.contains(e.target) && !list.hidden) { open(false); }
            }, true);
        }

        paintTheme(picker, list, button);
        view.__repaintLanguages = paint;
        paint();
        open(false);
        select.classList.add('dcHiddenSelect');
        if (select.parentNode && select.parentNode.classList) { select.parentNode.classList.add('dcHasPicker'); }
    }

    function applyTexts(view) {
        TEXT_IDS.forEach(function (id) {
            var target = el(view, id);
            if (target) { target.textContent = t('cfg.' + id); }
        });
    }

    function applyLanguage(view, locale) {
        var hdgRadarr = el(view, 'hdgRadarr');
        if (hdgRadarr) { hdgRadarr.textContent = t('cfg.radarr_movies'); }
        var hdgSonarr = el(view, 'hdgSonarr');
        if (hdgSonarr) { hdgSonarr.textContent = t('cfg.sonarr_series'); }
        applyTexts(view);

        function label(id, key) {
            var target = view.querySelector('label[for="' + id + '"]');
            if (target) { target.textContent = t(key); }
        }

        label('txtTmdbKey', 'cfg.label_txttmdbkey');
        label('selRequestService', 'cfg.label_selrequestservice');
        label('txtSeerrUrl', 'cfg.label_txtseerrurl');
        label('txtSeerrKey', 'cfg.label_txttmdbkey');
        label('txtOmbiUrl', 'cfg.label_txtombiurl');
        label('txtOmbiKey', 'cfg.label_txttmdbkey');
        label('txtSabUrl', 'cfg.label_txtsaburl');
        label('txtSabKey', 'cfg.label_txttmdbkey');
        label('txtQbitUrl', 'cfg.label_txtsaburl');
        label('txtQbitUser', 'cfg.label_txtqbituser');
        label('txtQbitPass', 'cfg.label_txtqbitpass');
        label('txtQbitKey', 'cfg.label_txtqbitkey');
        var qbitTest = view.querySelector('.btnTestQbit span');
        if (qbitTest) { qbitTest.textContent = t('cfg.test_connection'); }
        label('txtNzbgetUrl', 'cfg.label_txtnzbgeturl');
        label('txtNzbgetUser', 'cfg.label_txtqbituser');
        label('txtNzbgetPass', 'cfg.label_txtqbitpass');
        var nzbgetTest = view.querySelector('.btnTestNzbget span');
        if (nzbgetTest) { nzbgetTest.textContent = t('cfg.test_connection'); }
        label('txtTransUrl', 'cfg.label_txttransurl');
        label('txtTransUser', 'cfg.label_txtqbituser');
        label('txtTransPass', 'cfg.label_txtqbitpass');
        var transTest = view.querySelector('.btnTestTrans span');
        if (transTest) { transTest.textContent = t('cfg.test_connection'); }
        var sabTest = view.querySelector('.btnTestSab span');
        if (sabTest) { sabTest.textContent = t('cfg.test_connection'); }
        var serviceSelect = el(view, 'selRequestService');
        if (serviceSelect && serviceSelect.options.length > 1) {
            serviceSelect.options[0].textContent = t('cfg.radarr_sonarr_directly');
        }
        if (serviceSelect && serviceSelect.options.length > 2) {
            serviceSelect.options[2].textContent = t('cfg.seerr_radarr_sonarr_for_the_status');
        }
        if (serviceSelect && serviceSelect.options.length > 4) {
            serviceSelect.options[4].textContent = t('cfg.ombi_radarr_sonarr_for_the_status');
        }
        ['.btnTestSeerr span', '.btnTestOmbi span'].forEach(function (sel) {
            var b = view.querySelector(sel);
            if (b) { b.textContent = t('cfg.test_connection'); }
        });
        label('selPluginLanguage', 'cfg.label_selpluginlanguage');
        label('selTmdbLang', 'cfg.label_seltmdblang');
        var diagLabel = el(view, 'lbl_chkShowDiagnostics');
        if (diagLabel) {
            diagLabel.textContent = t('cfg.show_the_yellow_debug_message_and_media');
        }
        var exclLabel = view.querySelector('#lbl_txtExcludedLangs');
        if (exclLabel) {
            exclLabel.textContent = t('cfg.exclude_languages_original_language');
            view.querySelector('#desc_txtExcludedLangs').textContent = t('cfg.titles_with_these_original_languages_are');
        }
        var trailerLabel = view.querySelector('#lbl_chkShowTrailerTile');
        if (trailerLabel) {
            trailerLabel.textContent = t('cfg.show_the_trailer_tile_next_to_request_channel');
        }
        var injectLabel = view.querySelector('#lbl_chkInjectWebClientLoader');
        if (injectLabel) {
            injectLabel.textContent = t('cfg.tile_opens_discover_page');
        }
        var injectDesc = view.querySelector('#desc_chkInjectWebClientLoader');
        if (injectDesc) {
            injectDesc.textContent = t('cfg.web_client_browser_only_the_discover_media');
        }
        label('txtRadarrUrl', 'cfg.label_txtradarrurl');
        label('txtRadarrKey', 'cfg.label_txttmdbkey');
        label('selRadarrProfile', 'cfg.label_selradarrprofile');
        label('selRadarrRoot', 'cfg.label_selradarrroot');
        label('selRadarrAvail', 'cfg.label_selradarravail');
        (function () {
            var d = view.querySelector('#descRadarrAvail');
            if (d) { d.textContent = t('cfg.when_radarr_starts_looking_for_a_new_movie'); }
        })();
        label('txtSonarrUrl', 'cfg.label_txtsonarrurl');
        label('txtSonarrKey', 'cfg.label_txttmdbkey');
        label('selSonarrProfile', 'cfg.label_selradarrprofile');
        label('selSonarrRoot', 'cfg.label_selradarrroot');

        var languageSelect = el(view, 'selPluginLanguage');
        languageSelect.options[0].textContent = t('cfg.follow_emby_server_language');
        updateAutoTmdbOption(view);
        view.querySelector('.btnTestTmdb span').textContent = t('cfg.test_tmdb_key');
        view.querySelector('.btnTestRadarr span').textContent = t('cfg.test_connection');
        view.querySelector('.btnTestSonarr span').textContent = t('cfg.test_connection');
        view.querySelector('.button-submit span').textContent = t('cfg.save');
        view.querySelector('.btnUpdCheck span').textContent = t('cfg.check_now');
        view.querySelector('.btnUpdRestart span').textContent = t('cfg.restart_emby');
        view.querySelector('.btnUpdTime span').textContent = t('cfg.change_time');
        view.querySelector('.btnUpdPick span').textContent = t('cfg.install_this_version');
        el(view, 'lblUpdVersion').textContent = t('cfg.previous_versions');
        view.querySelector('.btnStatus span').textContent = t('cfg.run_diagnostics');
        view.querySelector('.btnStatus').nextElementSibling.textContent = t('cfg.checks_the_plugin_channel_tmdb_radarr_sonarr');
        el(view, 'statusTmdbLanguages').textContent = t('cfg.enter_a_tmdb_key_and_test_it_to_load_the');
        Array.prototype.forEach.call(view.querySelectorAll('.btnToggleKey'), function (button) {
            var target = el(view, button.getAttribute('data-target'));
            var labelText = target && target.type === 'text'
                ? t('cfg.hide')
                : t('cfg.show');
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
    function verCmp(a, b) {
        var x = String(a || '').split('.'), y = String(b || '').split('.');
        for (var i = 0; i < Math.max(x.length, y.length); i++) {
            var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
            if (d) { return d; }
        }
        return 0;
    }
    function showUpdate(view, u) {
        var btnI = view.querySelector('.btnUpdInstall'), btnR = view.querySelector('.btnUpdRestart');
        btnI.style.display = 'none'; btnR.style.display = 'none';
        if (!u) { return; }
        if (u.TaskId) { view.__updTaskId = u.TaskId; }
        var tab = el(view, 'tab_updates');
        if (tab) { tab.textContent = 'Updates' + (u.Available ? ' \u25cf' : ''); tab.style.color = u.Available ? '#52b54b' : ''; }
        var cur = t('cfg.installed') + '<b>' + esc(u.Current || '?') + '</b>';
        var link = function (t) { return u.Url ? '<a href="' + esc(u.Url) + '" target="_blank" rel="noopener" style="color:#52b54b">' + esc(t) + '</a>' : esc(t); };
        var beta = u.IsBeta ? ' (beta)' : '';
        var html;
        if (u.PendingVersion) {
            html = cur + '<br>' + t('cfg.version') + '<b>' + esc(u.PendingVersion) + '</b>' +
                t('cfg.is_installed_restart_emby_to_activate_it');
            if (u.CanRestart) { btnR.style.display = ''; }
        } else if (u.Available) {
            html = cur + '<br>' + t('cfg.new_version_available') + '<b>' + link(u.Latest + beta) + '</b>';
            btnI.style.display = '';
            btnI.querySelector('span').textContent = t('cfg.update_to') + u.Latest;
        } else if (u.Latest && verCmp(u.Current, u.Latest) > 0) {
            html = cur + ' · ' + t('cfg.newer_than_the_latest_release') + ' (' + link(u.Latest + beta) + ')';
        } else if (u.Latest) {
            html = cur + ' · ' + t('cfg.this_is_the_latest_version');
        } else {
            html = cur;
        }
        if (u.Error) { html += '<br><span style="color:#ff6b6b">' + esc(u.Error) + '</span>'; }
        updStatus(view, html, true);
        fillVersions(view, u);
    }
    // Keuzelijst met alle versies op GitHub (ook oudere en beta's), om een andere versie te installeren.
    function fillVersions(view, u) {
        var row = view.querySelector('.dcUpdPick'), sel = el(view, 'selUpdVersion');
        var list = (u && u.Versions) || [];
        if (!list.length || u.PendingVersion) { row.style.display = 'none'; view.querySelector('.dcUpdNotesWrap').style.display = 'none'; return; }
        row.style.display = '';
        var html = '';
        list.forEach(function (v) {
            var d = v.Date ? ' · ' + String(v.Date).slice(0, 10) : '';
            var extra = (v.IsBeta ? ' (beta)' : '') + (v.Version === u.Current ? t('cfg.installed_2') : '') +
                (!v.HasUpdater ? t('cfg.no_updater') : '');
            var pick = u.Available ? v.Tag === u.Tag : v.Version === u.Current;
            html += '<option value="' + esc(v.Tag) + '"' + (pick ? ' selected' : '') + '>' + esc(v.Version + extra + d) + '</option>';
        });
        sel.innerHTML = html;
        var want = list.filter(function (v) { return u.Available ? v.Tag === u.Tag : v.Version === u.Current; })[0];
        if (want) { sel.value = want.Tag; }
        syncPick(view, u);
        sel.onchange = function () { syncPick(view, u); };
    }
    // Heel kleine markdown-weergave voor de release-tekst (koppen, vet, code, lijstjes, links).
    function miniMarkdown(md) {
        var out = [], inList = false;
        String(md || '').replace(/\r/g, '').split('\n').forEach(function (line) {
            var t = esc(line.trim())
                .replace(/\[!\[([^\]]*)\]\((https:[^)\s]+)\)\]\((https:[^)\s]+)\)/g, '<a href="$3" target="_blank" rel="noopener"><img src="$2" alt="$1" style="height:2em;vertical-align:middle"></a>')
                .replace(/!\[([^\]]*)\]\((https:[^)\s]+)\)/g, '<img src="$2" alt="$1" style="max-height:2em;vertical-align:middle">')
                .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#52b54b">$1</a>')
                .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
            var li = /^[-*] /.test(line.trim());
            if (li && !inList) { out.push('<ul style="margin:.2em 0 .6em;padding-left:1.3em">'); inList = true; }
            if (!li && inList) { out.push('</ul>'); inList = false; }
            if (li) { out.push('<li>' + t.replace(/^[-*] /, '') + '</li>'); }
            else if (/^#{1,6} /.test(line.trim())) { out.push('<div style="font-weight:600;margin:.7em 0 .2em">' + t.replace(/^#+ /, '') + '</div>'); }
            else if (t) { out.push('<div style="margin:.2em 0">' + t + '</div>'); }
        });
        if (inList) { out.push('</ul>'); }
        return out.join('');
    }
    function syncPick(view, u) {
        var sel = el(view, 'selUpdVersion'), btn = view.querySelector('.btnUpdPick');
        var v = ((u && u.Versions) || []).filter(function (x) { return x.Tag === sel.value; })[0];
        var wrap = view.querySelector('.dcUpdNotesWrap');
        if (v && v.Notes) {
            wrap.style.display = '';
            view.querySelector('.dcUpdNotesTitle').textContent = t('cfg.what_s_new_in') + v.Version + (v.IsBeta ? ' (beta)' : '');
            view.querySelector('.dcUpdNotes').innerHTML = miniMarkdown(v.Notes);
        } else { wrap.style.display = 'none'; view.querySelector('.dcUpdNotes').innerHTML = ''; }
        btn.disabled = !v || v.Version === u.Current;
        var note = view.querySelector('.dcUpdPickNote');
        note.textContent = v && !v.HasUpdater
            ? t('cfg.note_this_version_has_no_updates_tab_yet')
            : '';
    }
    function pickVersion(view) {
        var sel = el(view, 'selUpdVersion');
        var label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : sel.value;
        dcConfirm(t('cfg.install_version_confirm', label)).then(function (ok) {
            if (ok) { installUpdate(view, sel.value); }
        });
    }

    function checkUpdate(view, fresh) {
        // Bij openen van de pagina stil laden (meestal uit het geheugen, dus direct). Bij "Nu kijken" laat de knop zien dat hij bezig is.
        var btn = view.querySelector('.btnUpdCheck'), span = btn.querySelector('span');
        var started = Date.now();
        if (fresh) { btn.disabled = true; span.textContent = t('cfg.looking_for_updates'); }
        var done = function (fn) {
            setTimeout(function () { btn.disabled = false; span.textContent = t('cfg.check_now'); fn(); }, fresh ? Math.max(0, 700 - (Date.now() - started)) : 0);
        };
        ApiClient.getJSON(ApiClient.getUrl('Discover/Update', { Fresh: !!fresh })).then(
            function (u) { done(function () { showUpdate(view, u); }); },
            function (err) { done(function () { updStatus(view, ajaxErrorMessage(err)); }); });
    }
    function installUpdate(view, tag) {
        updStatus(view, t('cfg.downloading_and_installing'));
        view.querySelector('.btnUpdInstall').style.display = 'none';
        ApiClient.ajax({ type: 'POST', url: ApiClient.getUrl('Discover/Update/Install', tag ? { Tag: tag } : {}), dataType: 'json' })
            .then(function (u) { showUpdate(view, u); }, function (err) { updStatus(view, ajaxErrorMessage(err)); });
    }
    function restartForUpdate(view) {
        dcConfirm(t('cfg.restart_emby_now_anyone_watching_will_be')).then(function (ok) {
            if (!ok) { return; }
            updStatus(view, t('cfg.emby_is_restarting_refresh_the_page_in_a'));
            view.querySelector('.btnUpdRestart').style.display = 'none';
            ApiClient.ajax({ type: 'POST', url: ApiClient.getUrl('Discover/Update/Restart') }).catch(function () { });
        });
    }

    function showLoading() { if (window.Dashboard && Dashboard.showLoadingMsg) { Dashboard.showLoadingMsg(); } }
    function hideLoading() { if (window.Dashboard && Dashboard.hideLoadingMsg) { Dashboard.hideLoadingMsg(); } }

    function el(view, id) { return view.querySelector('#' + id); }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ajaxErrorMessage(err) {
        if (!err) { return t('ui.unknown_error'); }
        var payload = err.responseJSON;
        if (!payload && err.responseText) {
            try { payload = JSON.parse(err.responseText); } catch (ignored) { }
        }
        var status = err.status || err.statusCode || (err.response && err.response.status);
        var details = err.message || err.statusText || err.responseText ||
            (err.response && (err.response.statusText || err.response.responseText));
        if (typeof details === 'string' && details.length > 240) { details = details.slice(0, 240) + '...'; }
        return (payload && (payload.Message || payload.message || payload.Error || payload.error)) ||
            details || (status ? 'HTTP ' + status : t('ui.unknown_error'));
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
        var notConnected = t('cfg.connect_to_the_app_first_test_connection');
        var saved = t('cfg.saved');
        var profiles = profileId
            ? [{ value: profileId, label: t('cfg.profile_id') + profileId + ' ' + saved }]
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
        var options = [{ value: 'auto', label: t('cfg.follow_plugin_emby_language_automatic') }];

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
                options.push({ value: current, label: current + ' (' + t('cfg.saved_2') + ')' });
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
                status.textContent = t('cfg.tmdb_language_list_unavailable', message);
            }
        }

        if (!key) {
            render([]);
            status.textContent = t('cfg.enter_and_test_a_tmdb_key_to_load_the_full');
            return;
        }

        status.textContent = t('cfg.loading_tmdb_languages');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'TmdbLanguages', ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (result) {
            try {
                if (!result || !result.Success) {
                    throw new Error((result && result.Error) || t('ui.unknown_error'));
                }
                var list = asLanguageList(result.Languages);
                if (!list.length) { throw new Error(t('ui.unknown_error')); }
                render(list);
                if (requestId === state.languageRequest) {
                    status.textContent = t('cfg.follow_the_plugin_emby_language_automatically');
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
        var ombi = mode === 'ombi' || mode === 'ombi-arr';
        var plusArr = mode === 'seerr-arr' || mode === 'ombi-arr';
        el(view, 'seerrFields').style.display = seerr ? '' : 'none';
        el(view, 'ombiFields').style.display = ombi ? '' : 'none';
        el(view, 'arrFields').style.display = ((!seerr && !ombi) || plusArr) ? '' : 'none';
        var desc = el(view, 'desc_requestService');
        if (desc && mode === 'ombi') {
            desc.textContent = t('cfg.with_ombi_requests_go_to_ombi_which_passes');
            return;
        }
        if (desc && mode === 'ombi-arr') {
            desc.textContent = t('cfg.requests_go_to_ombi_radarr_and_sonarr_are');
            return;
        }
        if (desc && mode !== 'seerr-arr') {
            desc.textContent = t('cfg.desc_requestService');
        }
        if (desc && mode === 'seerr-arr') {
            desc.textContent = t('cfg.requests_go_to_seerr_with_approval_and_limits');
        }
    }

    function testSeerr(view) { testRequestService(view, 'Seerr'); }
    function testOmbi(view) { testRequestService(view, 'Ombi'); }

    // name = 'Seerr' of 'Ombi'; de velden heten statusSeerr/txtSeerrUrl/txtSeerrKey, en zo ook voor Ombi.
    function testRequestService(view, name) {
        var status = el(view, 'status' + name);
        var url = el(view, 'txt' + name + 'Url').value.trim();
        var key = el(view, 'txt' + name + 'Key').value.trim();
        status.style.color = '';
        status.textContent = t('cfg.testing');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: name, Url: url, ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = t('ui.failed') +
                    ((r && r.Error) || t('ui.unknown_error'));
                return;
            }
            // Version = "versie|Radarr-servers|Sonarr-servers"
            var parts = String(r.Version || '').split('|');
            var msg = t('cfg.connected_to') + name + (parts[0] ? ' ' + parts[0] : '');
            if (parts.length >= 3) {
                msg += ' - ' + parts[1] + ' Radarr-, ' + parts[2] + ' Sonarr-' + t('cfg.server_s_set_up_in') + name + '.';
                if (parts[1] === '0' || parts[2] === '0') {
                    msg += ' ' + t('cfg.without_arr_server', name);
                }
            } else {
                msg += '.';
            }
            status.style.color = '#43a047';
            status.textContent = msg;
        }, function (err) {
            console.error('Discover: ' + name + '-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('ui.failed') + ajaxErrorMessage(err);
        });
    }

    function testDownloader(view, type, name, urlId, userId, passId, statusId, keyId) {
        var status = el(view, statusId);
        status.style.color = '';
        status.textContent = t('cfg.testing');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: type, Url: el(view, urlId).value.trim(), Username: el(view, userId).value.trim(), Password: el(view, passId).value, ApiKey: keyId ? el(view, keyId).value.trim() : '' }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = t('ui.failed') +
                    ((r && r.Error) || t('ui.unknown_error'));
                return;
            }
            status.style.color = '#43a047';
            status.textContent = t('cfg.connected_to') + name + (r.Version ? ' ' + r.Version : '') + '.';
        }, function (err) {
            console.error('Discover: ' + name + '-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('ui.failed') + ajaxErrorMessage(err);
        });
    }
    function testQbit(view) { testDownloader(view, 'Qbittorrent', 'qBittorrent', 'txtQbitUrl', 'txtQbitUser', 'txtQbitPass', 'statusQbit', 'txtQbitKey'); }
    function testNzbget(view) { testDownloader(view, 'Nzbget', 'NZBGet', 'txtNzbgetUrl', 'txtNzbgetUser', 'txtNzbgetPass', 'statusNzbget'); }
    function testTrans(view) { testDownloader(view, 'Transmission', 'Transmission', 'txtTransUrl', 'txtTransUser', 'txtTransPass', 'statusTrans'); }

    function testSab(view) {
        var status = el(view, 'statusSab');
        var url = el(view, 'txtSabUrl').value.trim();
        var key = el(view, 'txtSabKey').value.trim();
        status.style.color = '';
        status.textContent = t('cfg.testing');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/TestConnection'),
            data: JSON.stringify({ Type: 'Sabnzbd', Url: url, ApiKey: key }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            if (!r || !r.Success) {
                status.style.color = '#e53935';
                status.textContent = t('ui.failed') +
                    ((r && r.Error) || t('ui.unknown_error'));
                return;
            }
            status.style.color = '#43a047';
            status.textContent = t('cfg.connected_to_sabnzbd') + (r.Version ? ' ' + r.Version : '') + '.';
        }, function (err) {
            console.error('Discover: SABnzbd-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('ui.failed') + ajaxErrorMessage(err);
        });
    }

    function intValue(view, id, fallback) {
        var v = parseInt(el(view, id).value, 10);
        return isNaN(v) || v < 0 ? fallback : v;
    }

    function normId(id) { return String(id || '').replace(/-/g, '').toLowerCase(); }

    // ---- Gebruikers: vinkje = mag aanvragen; bewaard wordt de lijst van wie NIET mag ----
    // Met veel gebruikers wordt een platte lijst onwerkbaar: zoekveld, teller en kolommen erbij.
    function setupUserTools(view, list, total) {
        var box = view.querySelector('.dcUserTools');
        if (!box) {
            box = document.createElement('div');
            box.className = 'dcUserTools';
            box.innerHTML = '<input type="text" class="dcUserFilter emby-input" /><span class="dcUserCount"></span>';
            list.parentNode.insertBefore(box, list);
        }
        var filter = box.querySelector('.dcUserFilter');
        var count = box.querySelector('.dcUserCount');
        filter.placeholder = t('cfg.search_users');

        function refresh() {
            var term = (filter.value || '').trim().toLowerCase();
            var shown = 0, on = 0;
            [].forEach.call(list.children, function (row) {
                var box2 = row.querySelector('.chkUser');
                var name = (row.textContent || '').toLowerCase();
                var hit = !term || name.indexOf(term) !== -1;
                row.style.display = hit ? '' : 'none';
                if (hit) { shown++; }
                if (box2 && box2.checked) { on++; }
            });
            count.textContent = t('cfg.n_of_m_may_request', on, total) + (term ? ' \u00b7 ' + shown : '');
        }

        if (!box.dataset.wired) {
            box.dataset.wired = '1';
            filter.addEventListener('input', refresh);
            list.addEventListener('change', refresh);
            list.addEventListener('click', function () { setTimeout(refresh, 0); });
        }
        view.__refreshUserCount = refresh;
        refresh();
    }

    function loadUsers(view, state, blockedCsv) {
        var list = el(view, 'userList');
        var status = el(view, 'statusUsers');
        var blocked = {};
        String(blockedCsv || '').split(/[\s,;]+/).forEach(function (id) { if (id) { blocked[normId(id)] = true; } });
        state.usersLoaded = false;
        status.textContent = t('cfg.loading_users');
        ApiClient.getJSON(ApiClient.getUrl('Users')).then(function (users) {
            users = users || [];
            users.sort(function (a, b) { return String(a.Name).toLowerCase() < String(b.Name).toLowerCase() ? -1 : 1; });
            var html = '';
            users.forEach(function (u) {
                var isAdmin = !!(u.Policy && u.Policy.IsAdministrator);
                var disabled = !!(u.Policy && u.Policy.IsDisabled);
                var tag = (isAdmin ? t('cfg.administrator') : '') +
                    (isAdmin && disabled ? ', ' : '') +
                    (disabled ? t('cfg.disabled') : '');
                html += '<div class="checkboxContainer"><label class="emby-checkbox-label">' +
                    '<input is="emby-checkbox" type="checkbox" class="chkUser" data-userid="' + esc(u.Id) + '"' +
                    (blocked[normId(u.Id)] ? '' : ' checked') + ' />' +
                    '<span class="checkboxLabel">' + esc(u.Name) + (tag ? ' <span class="dcUserTag">(' + esc(tag) + ')</span>' : '') + '</span>' +
                    '<span class="emby-checkbox-outline"><span class="emby-checkbox-on"><i class="md-icon">check</i></span><span class="emby-checkbox-off"></span></span>' +
                    '</label></div>';
            });
            list.innerHTML = html;
            list.classList.add('dcUserGrid');
            setupUserTools(view, list, users.length);
            setTimeout(function () { fixCheckboxes(view); }, 100);
            state.usersLoaded = true;
            status.textContent = '';
        }, function (err) {
            console.error('Discover: gebruikers laden mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('cfg.loading_users_failed_the_existing_setting');
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
        // Met een zoekterm geldt de knop alleen voor wat er nu staat; anders voor iedereen.
        Array.prototype.forEach.call(view.querySelectorAll('.chkUser'), function (box) {
            var row = box.closest ? box.closest('.checkboxContainer') : null;
            if (row && row.style.display === 'none') { return; }
            box.checked = value;
        });
        state.dirty = true;
        if (view.__refreshUserCount) { view.__refreshUserCount(); }
    }

    // ---- Test van de watchlist-bronnen ----
    function testWatch(view, kind) {
        var status = el(view, kind === 'trakt' ? 'statusTrakt' : 'statusTmdbList');
        status.style.color = '';
        status.textContent = t('cfg.testing');
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
        status.textContent = t('cfg.testing');
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
        status.textContent = t('cfg.testing');
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
        status.textContent = t('ui.loading');
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
                status.textContent = t('cfg.no_requests_through_discover_yet');
                return;
            }
            var perUser = {};
            items.forEach(function (i) { var n = names[normId(i.UserId)] || '?'; perUser[n] = (perUser[n] || 0) + 1; });
            var sum = Object.keys(perUser).sort(function (a, b) { return perUser[b] - perUser[a]; })
                .map(function (n) { return esc(n) + ': ' + perUser[n]; }).join(' \u00B7 ');
            var st = [t('cfg.removed'), t('channel.requested_2'), t('btn.available')];
            var html = '<div class="dcReqSum">' + sum + '</div><table class="dcReqTable"><thead><tr><th></th><th>' +
                t('btn.title_fallback') + '</th><th>' + t('cfg.user') + '</th><th>' +
                t('cfg.date') + '</th><th>' + t('btn.status') + '</th></tr></thead><tbody>';
            items.forEach(function (i) {
                var poster = i.Poster ? '<img loading="lazy" src="' + esc(i.Poster) + '" alt="">' : '';
                html += '<tr><td>' + poster + '</td><td>' + esc(i.Title || '?') + (i.Year ? ' (' + i.Year + ')' : '') +
                    ' <span class="dcUserTag">' + (i.Type === 'tv' ? t('cfg.series') : t('cfg.movie')) + '</span></td><td>' +
                    esc(names[normId(i.UserId)] || '?') + '</td><td>' + esc(fmtDate(i.Added)) + '</td><td class="dcReqSt' + (i.Status | 0) + '">' + st[i.Status | 0] + '</td></tr>';
            });
            box.innerHTML = html + '</tbody></table>';
            status.textContent = items.length + t('cfg.requests');
        }, function (err) {
            console.error('Discover: aanvragenoverzicht mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('cfg.loading_the_overview_failed') + ajaxErrorMessage(err);
        });
    }

    // ---- Opslag: grootte van de bewaarde kaarten en tegels, en opruimen ----
    function mb(bytes) { return (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1); }

    function showCache(view, r) {
        el(view, 'statusCache').textContent = t('cfg.card_clips') +
            r.CardFiles + t('cfg.files') + mb(r.CardBytes) + ' MB)  \u00B7  ' +
            t('cfg.tiles') +
            r.TileFiles + t('cfg.files') + mb(r.TileBytes) + ' MB)';
    }

    function loadCache(view) {
        ApiClient.ajax({ type: 'GET', url: ApiClient.getUrl('Discover/Cache'), dataType: 'json' }).then(function (r) {
            if (r) { showCache(view, r); }
        }, function (err) {
            console.error('Discover: opslaggrootte ophalen mislukt', err);
            el(view, 'statusCache').textContent = t('cfg.size_not_available_administrators_only');
        });
    }

    function cleanCache(view, all) {
        var status = el(view, 'statusClean');
        status.style.color = '';
        status.textContent = t('cfg.working');
        ApiClient.ajax({
            type: 'POST',
            url: ApiClient.getUrl('Discover/Cache/Clean'),
            data: JSON.stringify({ All: !!all }),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (r) {
            status.style.color = '#43a047';
            status.textContent = (r && r.Message) || t('cfg.done');
            if (r) { showCache(view, r); }
        }, function (err) {
            console.error('Discover: opruimen mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('api.cleanup_failed') + ajaxErrorMessage(err);
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
        paintPlainSelects(view);
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
            el(view, 'chkPageBackdrops').checked = c.PageBackdrops !== false;
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
            if (c.UpdateCheck !== false) { checkUpdate(view, false); } else { updStatus(view, t('cfg.not_checked_automatically_click_check_now')); }
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
                url: ApiClient.getUrl('Discover/Status', { Lang: (window.navigator && navigator.language) || '' }),
                dataType: 'json'
            }).then(function (serverStatus) {
                if (serverStatus && serverStatus.Strings) { STR = serverStatus.Strings; }
                fillLanguageSelect(view, serverStatus && serverStatus.Languages, el(view, 'selPluginLanguage').value);
                applyLanguage(view, c.PluginLanguage && c.PluginLanguage !== 'auto' ? c.PluginLanguage : (serverStatus && serverStatus.PluginLanguage) || browserLanguage);
                state.autoTmdbLanguage = languageCode(serverStatus.PluginLanguage || browserLanguage);
                if (!state.dirty && el(view, 'selPluginLanguage').value === 'auto') {
                    applyLanguage(view, serverStatus.PluginLanguage || browserLanguage);
                }
                updateAutoTmdbOption(view, state);
            }, function (err) {
                console.error('Discover: Emby-taal ophalen mislukt', err);
            });
            el(view, 'selRequestService').value =
                c.RequestService === 'seerr' ? (c.SeerrArrStatus ? 'seerr-arr' : 'seerr')
                : c.RequestService === 'ombi' ? (c.SeerrArrStatus ? 'ombi-arr' : 'ombi')
                : 'arr';
            el(view, 'txtSeerrUrl').value = c.SeerrUrl || '';
            el(view, 'txtSeerrKey').value = c.SeerrApiKey || '';
            el(view, 'txtOmbiUrl').value = c.OmbiUrl || '';
            el(view, 'txtOmbiKey').value = c.OmbiApiKey || '';
            el(view, 'txtSabUrl').value = c.SabUrl || '';
            el(view, 'txtSabKey').value = c.SabApiKey || '';
            el(view, 'txtQbitUrl').value = c.QbitUrl || '';
            el(view, 'txtQbitUser').value = c.QbitUser || '';
            el(view, 'txtQbitPass').value = c.QbitPassword || '';
            el(view, 'txtQbitKey').value = c.QbitApiKey || '';
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
            if (c.RequestService === 'ombi' && c.OmbiUrl && c.OmbiApiKey) { testOmbi(view); }
            hideLoading();
        }, function (err) {
            console.error('Discover: config laden mislukt', err);
            hideLoading();
        });
    }

    function save(view, state) {
        var status = el(view, 'statusSave');
        status.style.color = '';
        status.textContent = t('cfg.saving');
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
            // Boven de 500 bewaart de server de aanvragen niet meer die nodig zijn om te tellen.
            c.RequestLimit = Math.min(500, intValue(view, 'numRequestLimit', 0));
            c.ShowNewSeasons = el(view, 'chkShowNewSeasons').checked;
            c.ShowMyRequests = el(view, 'chkShowMyRequests').checked;
            c.PageBackdrops = el(view, 'chkPageBackdrops').checked;
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
            c.RequestService = svc === 'seerr' || svc === 'seerr-arr' ? 'seerr'
                : svc === 'ombi' || svc === 'ombi-arr' ? 'ombi'
                : 'arr';
            c.SeerrArrStatus = svc === 'seerr-arr' || svc === 'ombi-arr';
            c.SeerrUrl = el(view, 'txtSeerrUrl').value.trim();
            c.SeerrApiKey = el(view, 'txtSeerrKey').value.trim();
            c.OmbiUrl = el(view, 'txtOmbiUrl').value.trim();
            c.OmbiApiKey = el(view, 'txtOmbiKey').value.trim();
            c.SabUrl = el(view, 'txtSabUrl').value.trim();
            c.SabApiKey = el(view, 'txtSabKey').value.trim();
            c.QbitUrl = el(view, 'txtQbitUrl').value.trim();
            c.QbitUser = el(view, 'txtQbitUser').value.trim();
            c.QbitPassword = el(view, 'txtQbitPass').value;
            c.QbitApiKey = el(view, 'txtQbitKey').value.trim();
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
            status.textContent = t('cfg.settings_saved_and_confirmed_by_emby');
            hideLoading();
            if (window.Dashboard && Dashboard.processPluginConfigurationUpdateResult) {
                Dashboard.processPluginConfigurationUpdateResult(r);
            }
        }, function (err) {
            console.error('Discover: opslaan mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('cfg.saving_failed') +
                ((err && (err.message || err.statusText)) || t('cfg.check_the_emby_log'));
            hideLoading();
        });
    }

    function testConnection(view, kind, state) {
        var status = el(view, 'status' + kind);
        var url = el(view, 'txt' + kind + 'Url').value.trim();
        var key = el(view, 'txt' + kind + 'Key').value.trim();

        status.style.color = '';
        status.textContent = t('cfg.testing');

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
                status.textContent = t('ui.failed') +
                    ((r && r.Error) || t('ui.unknown_error'));
                return;
            }

            var profiles = [];
            (r.Profiles || []).forEach(function (p) {
                profiles.push({ value: p.Id, label: p.Name });
            });
            if (profiles.length === 0) { profiles.push({ value: 0, label: t('cfg.no_profiles_found') }); }
            fillSelect(el(view, 'sel' + kind + 'Profile'), profiles, curProfile);

            var roots = [];
            (r.RootFolders || []).forEach(function (f) {
                var gb = f.FreeSpace ? ' - ' + Math.round(f.FreeSpace / 1073741824) + ' ' + t('cfg.gb_free') : '';
                roots.push({ value: f.Path, label: f.Path + gb });
            });
            if (roots.length === 0) { roots.push({ value: '', label: t('cfg.no_root_folders_found') }); }
            fillSelect(el(view, 'sel' + kind + 'Root'), roots, curRoot);

            status.style.color = '#43a047';
            status.textContent = t('cfg.connected_to') +
                (r.AppName || kind) + ' ' + (r.Version || '') +
                ' - ' + (r.Profiles || []).length + ' ' + t('cfg.profiles') +
                ', ' + (r.RootFolders || []).length + ' ' + t('cfg.root_folders_found');
        }, function (err) {
            console.error('Discover: test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('cfg.failed_could_not_perform_the_test_call_has');
        });
    }

    function testTmdb(view, state) {
        var status = el(view, 'statusTmdb');
        status.style.color = '';
        status.textContent = t('cfg.testing');
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
                status.textContent = t('cfg.tmdb_key_works');
                loadTmdbLanguages(view, key, el(view, 'selTmdbLang').value, state);
            } else {
                status.style.color = '#e53935';
                status.textContent = t('ui.failed') +
                    ((r && r.Error) || t('ui.unknown_error'));
            }
        }, function (err) {
            console.error('Discover: TMDB-test mislukt', err);
            status.style.color = '#e53935';
            status.textContent = t('cfg.failed_could_not_perform_the_test_call');
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
            var wanted = this.value === 'auto' ? ((window.navigator && navigator.language) || 'en-US') : this.value;
            // De teksten komen van de server, dus die moeten opnieuw opgehaald worden; anders blijft het
            // scherm in de oude taal staan tot je opslaat en de pagina herlaadt.
            ApiClient.ajax({
                type: 'GET',
                url: ApiClient.getUrl('Discover/Status', { Lang: wanted, Force: true }),
                dataType: 'json'
            }).then(function (r) {
                if (r && r.Strings) { STR = r.Strings; }
                applyLanguage(view, wanted);
                updateAutoTmdbOption(view, state);
                if (view.__repaintLanguages) { view.__repaintLanguages(); }
            }, function () {
                applyLanguage(view, wanted);
                updateAutoTmdbOption(view, state);
            });
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
        view.querySelector('.btnTestOmbi').addEventListener('click', function () {
            testOmbi(view);
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
                            ? t('cfg.hide')
                            : t('cfg.show');
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
            var q = t('cfg.delete_all_stored_card_clips_and_tile_images');
            dcConfirm(q).then(function (ok) { if (ok) { cleanCache(view, true); } });
        });

        view.querySelector('.btnUpdCheck').addEventListener('click', function () { checkUpdate(view, true); });
        view.querySelector('.btnUpdInstall').addEventListener('click', function () { installUpdate(view); });
        view.querySelector('.btnUpdPick').addEventListener('click', function () { pickVersion(view); });
        view.querySelector('.btnUpdRestart').addEventListener('click', function () { restartForUpdate(view); });
        view.querySelector('.btnUpdTime').addEventListener('click', function () {
            var page = view.__updTaskId ? 'scheduledtask?id=' + encodeURIComponent(view.__updTaskId) : 'scheduledtasks';
            if (window.Dashboard && Dashboard.navigate) { Dashboard.navigate(page); } else { window.location.hash = '#!/' + page; }
        });
        el(view, 'chkUpdateAuto').addEventListener('change', function () { syncUpdateBoxes(view); });
        view.querySelector('.btnStatus').addEventListener('click', function () {
            if (window.Dashboard && Dashboard.navigate) { Dashboard.navigate('configurationpage?name=discoverstatus1081'); }
            else { window.location.hash = '#!/configurationpage?name=discoverstatus1081'; }
        });

        view.addEventListener('viewshow', function () {
            // De instellingen zijn alleen voor de eigenaar: hier staan de API-sleutels van TMDB, Radarr,
            // Sonarr en Seerr in, en de lijst met gebruikers. Een plugin-pagina is op te vragen door iedereen
            // die is ingelogd, dus eerst controleren of dat een beheerder is en anders niets laten zien.
            Promise.resolve(ApiClient.getCurrentUser()).then(function (u) {
                if (u && u.Policy && u.Policy.IsAdministrator) { load(view, state); return; }
                adminOnly(view);
            }, function () { adminOnly(view); });
        });

        function adminOnly(target) {
            var form = target.querySelector('form') || target;
            form.innerHTML = '';
            var p = document.createElement('p');
            p.style.padding = '2em 1em';
            p.textContent = t('cfg.admin_only');
            form.appendChild(p);
        }
    };
});
