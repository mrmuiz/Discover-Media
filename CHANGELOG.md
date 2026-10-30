## Version 1.3.4.5

- Fix: the status marker (checkmark / hourglass) is now placed after the title instead of before it, so it no longer affects title sorting in the channel lists. Channel DataVersion bumped so Emby refreshes cached names.
- Change: **Tile opens the Discover page** is now on by default, and enabled once for existing installs (you can still turn it off in the settings; it is then not re-enabled). The Discover Media entry under My Media now opens the Discover page in the web client, and the extra rows load on every detail page.
- Change: the switch takes effect immediately, no server restart needed. The web loader stays injected and reads the setting at runtime from `GET /emby/Discover/LoaderConfig` (needs the logged-in web client's token; check it in the browser console, filter "Discover web", or run `__discoverDebug()`). If the setting cannot be read, there is no redirect.
- New: a **Channel tiles** button on the Discover page opens the channel folders (Genres, Popular Movies, ...) even when the tile redirect is on; Back from inside the channel no longer bounces to Discover.
- Fix: on actor/person pages the "Not in your library" row also appears when Emby's page layout has no standard container. Web client only: the official Emby apps cannot run plugin scripts and cannot show this row.
- After updating, restart Emby once and hard-refresh the browser (Ctrl+F5).
## Version 1.3.4.4

- New: **Exclude languages** setting. Titles whose original language is in this list (e.g. `ja, ko, hi`) are hidden from the Discover rows and channel folders; search still shows them. Changes apply immediately, no cache wait.
- Fix: on TVs the popup cut the description off after four lines. It is now scrollable: with the focus on Request/Trailer, press **down** to read further and **up** to go back (up at the top still moves to the close button). A soft fade shows there is more text; the buttons always stay on screen.
- Fix: on TVs Emby's page title ("Discover Media") overlapped the Discover search bar; the page now leaves room for Emby's taller TV header.
- New: **Norwegian** (Norsk) as a selectable plugin language. The most visible parts (channel folders, buttons, the Discover page) are translated; anything not yet translated falls back to English.
- New: **regional TMDB languages** (en-GB, pt-BR, es-MX, zh-TW, ...) in the TMDB language list, in addition to the base languages.
- Fix: on TVs you can now scroll the **More like this** / actor rows with the remote (left/right between posters, up/down to the Request button); posters use a fixed height so they render on webOS.
- New: the actor page's **Filmography** entries are now requestable: clicking a title you do not have opens the Discover popup with Request (titles already in your library open as before). A small Request badge marks the requestable entries.
- Fix: the poster links in the extra rows pointed at an old Discover page name; they now open the current page.
- Technical: plugin and request-button script version 1.3.4.4; resource names `discoveruijs1371`, `discoverbuttonjs1371` and page `discoverui1078`; settings page `discoverconfig1080` / `discoverconfigjs1301`.

## Version 1.3.4.2

Everything below works the same for every Emby client. The **Discover Media channel** (browse, Request and Trailer tiles, requesting through Radarr/Sonarr) works in all Emby apps, including the official TV and mobile apps. The **Discover page**, the tile shortcut and the Request button / extra rows on normal detail pages run in the Emby **web client** (browser); the official Emby apps ship their own built-in client, which a plugin cannot extend, so there Discover works through the channel.

**Discover page**
- New: **poster captions** with title, year and TMDB rating under every poster.
- New: **clearer focus on TVs**: the selected poster grows, gets a bright amber outline and its title is highlighted.
- New: **skeleton loading** (animated placeholder posters) instead of "Loading...", on the start page and while searching.
- Fix: posters and captions did not render on LG webOS TVs (Chromium 79): `aspect-ratio` and flex `gap` are not supported there and were replaced by fixed heights and margins. The page name was bumped so TVs load the fresh page instead of a cached one.

**Remote control on TVs**
- Fix: **Android TV / Fire TV remote** on the Discover page. The page now handles the remote itself through Emby's `command` events: left/right within a row, up/down between the search bar and the rows, focus starts on the first title, and in the popup you move between Request, Trailer, Delete and Close. Left on the first title still opens Emby's side menu; Back closes the trailer or popup first, then a genre/studio overview, then the page.
- Fix: Android TV is now recognised as a TV (Emby's `layout-tv`), so it gets the TV flow: tapping a title opens the popup with Request directly.
- Fix: the popup on TV no longer falls outside the screen (sizes based on the screen, overscan margins, long texts shortened so the buttons stay visible).
- Fix: on TVs the remote could stop responding in **Emby's own Settings/Dashboard** after visiting Discover. Two causes, both fixed: the global request-button script now stays completely idle on settings, dashboard and plugin pages, and the Discover page's remote handler only acts when the Discover page is really the current route.

**Trailers**
- Fix: trailers no longer hang in apps that load the web client from the server. The choice is made on origin: over `http(s)` the embedded YouTube player is used; only a packaged client served from `file://` uses the Emby player.

**Optional: tile opens the Discover page (off by default)**
- New setting: a tap on the **Discover Media** tile or menu entry jumps straight to the Discover page instead of showing the channel folders, and the Request button works on normal detail pages without opening Discover first. The plugin adds a small loader script to the web client's `index.html`; it is re-applied on every server start (Emby updates overwrite the web client) and removed cleanly when the setting is turned off. If the web client is in a non-standard location, set **Web client path**; otherwise it is found automatically. If the folder is missing or not writable, the plugin logs it and keeps working. Docker: Emby's web client folder may be read-only for the Emby user; see Troubleshooting. `/Discover/Status` reports the result.
- This only affects the web client (browser and apps that load the web client from the server). The official Emby apps are not affected.

**Technical**
- Plugin and request-button script version 1.3.4.2; resource names `discoveruijs1370`, `discoverbuttonjs1370` and page `discoverui1077` (avoid cached scripts). New embedded resource `discover-web-loader.js`, new server entry point `WebClientInjector`, new settings `InjectWebClientLoader` and `DashboardUiPath`.
- An experimental "webOS app mode" from a development build was removed; if it was ever enabled, its leftover snippet is removed from `index.html` on server start.

## Version 1.3.4.1

- Fix: the setting to turn the Trailer tile on or off was missing from the plugin settings. It is back as a checkbox ("Show the Trailer tile next to Request", on by default). With it off, the channel shows only the Request tile per title (series: only the season folder) and the Discover popup hides the Trailer button. The channel DataVersion changes with the setting, so Emby refreshes the title folders. `/Discover/Status` reports `ShowTrailerTile` again.
- Technical: plugin version and request-button script version are both 1.3.4.1.

## Version 1.3.4.0

- New: **More like this** on movie and series pages in the web client: TMDB recommendations (or similar titles) that are not in your library yet, each with a Request button. Clicking a poster opens the title in the Discover popup.
- New: **collection row** on movie pages: the other parts of the film series (TMDB collection) that you do not have yet, in the same layout.
- New: **Not in your library** on actor and director pages: their other movies and series from TMDB. Appearances as themselves, talk shows, news and reality series are skipped. Series open the season picker.
- Requesting from a row turns the button into the status (Requested / Available) and shows a confirmation.
- New routes: `/Discover/Related`, `/Discover/PersonCredits` and `/Discover/Seasons`.
- Titles that are already in Emby are filtered by TMDB id, with title + year as fallback. Series without a TMDB id in Emby are matched through their TVDB or IMDb id.
- Technical: script resource names changed (`discoveruijs1340`, `discoverbuttonjs1340`) to avoid cached browser scripts.

## Version 1.3.3.2

- Fix: LG webOS and Samsung Tizen TV apps. The Discover page detects TV clients and opens the title popup with the Request button directly instead of channel pages. Focus stays inside the popup and the Back key closes it.
- Fix: the Discover settings page could not load ("Load failed: configurationpage?name=discoverconfigjs...") because `configPage.html` pointed to a script name that `Plugin.cs` no longer registered. Both now use `discoverconfigjs1300`.
- Fix: the "Status" button on the settings page opened `discoverstatus1078`; the page is registered as `discoverstatus1079`.
- New: cancelling a request also removes its running downloads from the Radarr/Sonarr queue and the download client.
- New: routes `/Discover/TrailerKey` and `/Discover/Title`.
- Fix: the plugin version and the request-button script version are now both 1.3.3.2 (the script reported 1.1.3 while the Discover page expected 1.3.3.1).
- Technical: script resource names changed (`discoveruijs1336`, `discoverbuttonjs1331`, `discoverconfigjs1300`) to avoid cached browser scripts.

## Version 1.1.3

- Fix: the diagnostics on the Discover page still showed the request-button script as v1.1.0 while the plugin was newer. The plugin version and the script version are now the same everywhere (1.1.3), so the yellow diagnostics lines match.
- Compatibility: the plugin is now built against the Emby SDK package `MediaBrowser.Server.Core` 4.10.0.1-beta (was 4.11.0.5-beta6), so the same dll loads on Emby Server 4.10.2 and on the 4.11 beta. Before, Emby Server 4.10.2 could not load the plugin ("Could not load file or assembly MediaBrowser.Model, Version=4.11.0.5"). Installing was seen on both versions; not every function has been tested extensively on both.
- Technical: no functional changes, channel version and resource names stay the same.