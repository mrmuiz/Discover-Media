## Version 1.3.5.6

- New: **requests through Seerr** as an alternative to Radarr & Sonarr. The settings tab *Radarr & Sonarr* is now called **Requests** and starts with **Send requests to**: *Radarr & Sonarr (directly)* (default, unchanged) or *Seerr*. With Seerr you only fill in the Seerr URL and API key (Seerr > Settings > General); Seerr passes requests on to its own Radarr and Sonarr, so Radarr and Sonarr do not have to be set up in the plugin. **Test connection** shows the Seerr version and how many Radarr/Sonarr servers Seerr has.
- In Seerr mode everything goes through the Seerr API (`/api/v1`): requesting a movie, a whole series (`seasons: "all"`) or single seasons; the ✓/⏳ status, partially available series and the season checkmarks (from Seerr's media and season status); the "recently added" order; download progress (from Seerr's `downloadStatus`, which Seerr reads from its Radarr/Sonarr queues); and **Delete / Cancel request** (removes the title from Radarr/Sonarr through Seerr and clears the request in Seerr; deleting an available title without files keeps Radarr/Sonarr untouched).
- Requests are made by the Seerr account of whoever is signed in to Emby. Seerr users imported from Emby are matched on their Emby user id and the request is sent with `X-Api-User`, so that user's permissions, quotas and approval rules in Seerr apply. Without a match the request is made as the owner of the API key (Diagnostics shows a line). If Seerr needs approval, the message says "Requested (awaiting approval)". Seerr errors such as quota or permission messages are shown as they are.
- Change: messages and confirmations name the service that is actually used ("Already in Seerr", "Delete … from Seerr"), and the status page shows "Requests go through: Seerr" and tests the Seerr connection instead of Radarr/Sonarr.
- Fix: the **genre tiles on the Discover page** (Movie Genres, Series Genres) show a photo in the genre colour again, like the channel tiles and Seerr (backdrop of a popular title in that genre with a duotone filter, cached 12 hours). If no photo can be fetched, the plain colour stays.
- New: the titles of the rows **Trending, Popular movies, Upcoming movies, Popular series and Upcoming series** are clickable (round arrow icon) and open the whole list in a grid with **Load more**, like Seerr. Back returns to the Discover page.
- Change: coloured buttons in the Discover popup: **Trailer** blue, **Open in Emby** Emby green, **Delete / Cancel request** red; on hover they get slightly brighter instead of turning yellow.
- Change: for series the **Trailer** button sits in the row with the season buttons (on phones it stays in the button bar pinned to the bottom of the popup, so it is always visible).
- Change: the **Channel tiles** button on the Discover page is gone. The channel folders are still reachable through Emby's own channel view.
- New: **backdrop for the "Discover Media" tile on the Emby home screen**, like Emby does for the other libraries: hovering or selecting the tile shows a random backdrop of a currently trending movie or series full screen (TMDB trending, `GET /Discover/Backdrops`, cached 6 hours). Only when *Enable backdrops* is on in the user's Emby display settings; the image goes into Emby's own backdrop layer so Emby's dimming applies. Web client only (browser and apps that load the server's web client); needs the web loader in index.html.
- Change: page names bumped (`discoverui1082`, `discoveruijs1376`, `discoverbuttonjs1375`, `discoverconfigjs1358`, `discoverstatusjs1101`) so browsers load the new scripts.
- After updating, restart Emby once and hard-refresh the browser (Ctrl+F5).

## Version 1.3.5.5

- New: **download progress**, read from the Radarr and Sonarr queue (`GET /Discover/Queue`, the same source Seerr uses). Posters on the Discover page get a thin yellow progress bar and a status line ("↓ 45% · 12 min", "Paused · 32%", "Queued", "Importing"); for series the episodes are added up ("5 eps. · ↓ 32% · 18 min"). The popup lists every download with its own bar and time left, with a clean name ("S03E05 · Chapter 5") instead of the release name. In the "More like this" / "Not in your library" rows the Request button turns into the status. Everyone sees the progress; release name, download client, indexer and error messages are shown to administrators only. The queue is cached for 8 seconds on the server and the browser only refreshes (every 15 s) while something is downloading or was just requested.
- New: **My requests** row at the top of the Discover page, only when you requested something yourself. Shows your requests with their progress and "Available" once they are in Radarr/Sonarr with files (kept for 14 days). Requests are remembered per user in `discover-requests.json` in Emby's data folder (user, TMDB id, title, date; the last 50 per user), both from the Discover page/rows and from pressing Play on a request item in the channel. Requests made directly in Radarr, Sonarr or Seerr have no requester and do not appear there (their progress does show on the posters). New route `GET /Discover/MyRequests`.
- New: yellow **left/right arrow buttons** in the "More like this", collection and "Not in your library" rows on item and person pages, the same style as the Discover page. The Discover page arrows are now yellow too. Arrows hide at the start/end of a row and when everything fits; they are not focusable and are hidden on TV and touch screens. The grey scrollbar under the rows is gone (swiping and mouse-wheel scrolling still work).
- New: **clearer highlight** on the selected poster in those rows: 3px yellow border, 5% larger and a soft shadow (150 ms transition), on hover, keyboard focus and TV remote focus. The focused poster scrolls into view.
- Change: the arrow buttons (rows on item/person pages and the Discover page) look and behave like Emby's own rows: round and white, shown while the mouse is over the row, hidden at the start/end.
- Change: the "More like this" / collection / "Not in your library" rows now use Emby's own section and title classes and take the poster size and spacing from Emby's cards on the same page, so they line up with Emby's rows. They are placed directly under Emby's own "More Like This" (on person pages after the last poster row) instead of at the bottom of the page.
- New: in those rows the Request button and the title light up together with the selected poster (hover, keyboard and TV focus). The browser tooltip with the title over the poster is gone.
- Change: thicker progress bar (10px, 12px on TV), slightly larger status line, and long times shown in days ("10d 3h" instead of "243h 21m").
- Fix: the yellow focus ring on buttons (e.g. **Trailer** in the popup) no longer stays visible after a mouse click. It now uses `:focus-visible`, so it only shows when navigating with keyboard or remote; on TV (`layout-tv`, webOS, Tizen) it always shows, because older TV browsers do not support `:focus-visible`.
- Change: on person pages Emby's own filmography list is hidden while the "Not in your library" poster row is shown (what you own is already in Emby's poster rows, what you don't own is in the plugin row). Without the plugin row the list stays. The yellow "Request" labels in that list are no longer needed.
- Change: the plugin row on movie/series pages is called "More like this · not in your library", so it is not confused with Emby's own "More Like This", and it always stays below Emby's row (also when Emby builds its row later).
- Change: with plugin language "Automatic" the rows and the Discover page follow the language of the Emby app (`html lang`) instead of the server language.
- Fix: **broken images on the channel tiles** (Movie Genres, Studios, Popular Movies, …), e.g. in the Windows app. The cleanup removed tile images older than the retention period even while Emby still pointed to them ("The file '/data/discover-tiles/…jpg' could not be found"); browsers often still showed them from their own cache. Folder tiles (lists, genres, studios, networks) are no longer cleaned up, a tile that is still used keeps a fresh date, and when the cleanup does remove tiles the channel DataVersion changes so Emby asks for the folders again and the plugin recreates the images. DataVersion bumped to 73 so missing images are recreated right after updating.
- Fix: the **"Request" and "Trailer" text** on the two tiles of a title is back. Since 1.3.5.0 it was only made with "Pre-create cards and tiles" on; now it is made when a user opens the title (not during "Refresh Internet Channels").
- Change: page names bumped (`discoverui1081`, `discoveruijs1373`, `discoverbuttonjs1373`) so browsers load the new scripts.
- After updating, restart Emby once and hard-refresh the browser (Ctrl+F5).

## Version 1.3.5.4

- Fix: on phones the **Trailer** button in the Discover popup was partly hidden behind Emby's bottom navigation bar. The mobile height limit of the popup was overridden by the general `max-height: 92vh` rule (wrong CSS order), so the popup was taller than the free space. The mobile rule now wins, so the popup always ends above the bottom bar.
- Change: on phones (max 600px wide) the buttons below the seasons (Request, Trailer, Open in Emby, Delete) are full width and pinned to the bottom of the popup, so Trailer stays visible even for a series with many seasons. TV and desktop are unchanged.
- After updating, rebuild the plugin, restart Emby once and hard-refresh the browser (on the phone: clear the site cache or reload).

## Version 1.3.4.6

- Add: season buttons in the Discover popup for series. Next to Request there is now an **All seasons** button and one button per season (Season 1, Season 2, ...). A season button requests only that season; All seasons requests the whole series, including seasons released later. For series the single Request button is hidden while the season buttons are shown; if the seasons cannot be loaded, the normal Request button stays.
- Change: a series that is already in your Emby library no longer jumps straight to its Emby page. The Discover popup opens first, so missing seasons can still be requested, and an **Open in Emby** button takes you to the series. Movies still open directly in Emby.
- Add: seasons that are already in your Emby library (at least one episode) show a checkmark in the popup and cannot be clicked again. **All seasons** stays clickable.
- Change: **Delete** and **Cancel request** are now available to administrators and to users who have Emby's *Allow media deletion* permission (before: administrators only). `/Discover/RemoveItem` checks this on the server too, so a user without the permission gets "You are not allowed to delete." even when calling the endpoint directly.
- Fix: the green checkmarks on the **Season N** and **All seasons** request tiles are hidden. They were Emby's own "played" marker (set when you press Play to request) and did not mean the season is in your library. The checkmark in the tile label ("Season 1 ✓") is the real availability indicator.
- After updating, rebuild the plugin, restart Emby once and hard-refresh the browser (Ctrl+F5).

## Version 1.3.5.1

- New: requesting a series that is **already in Sonarr** no longer does nothing. The requested seasons (All seasons: every season except specials) are set to monitored, the series itself is set to monitored if needed, and a search starts for aired episodes without a file (`SeriesSearch` for All seasons, `SeasonSearch` per season otherwise). Seasons that were already monitored are never switched off. If there was nothing to do, the message stays "Already in Sonarr". The season flag uses the same endpoint as for new series (Sonarr v5); on v4 only the episodes are updated and Diagnostics shows a line.
- Change: the **All seasons** item now has a neutral grey-blue portrait tile with the text "All seasons" (in the plugin language) instead of a series poster. If the tile cannot be made (no ffmpeg, tile text images off), the series poster is used. Its description was updated. Season folder ID bumped to `ask25seasons:` so Emby re-reads the list.

## Version 1.3.5.0

- Fix: **Refresh Internet Channels no longer creates a card and tile for every title.** Until now the refresh opened every title folder, which started a background ffmpeg job per title (and per season). The scheduled task finished, but the queue kept running for hours and wrote tens of GB (e.g. 23,860 cards = 22 GB and 13,248 tile images). Cards and per-title tiles are now only created when someone actually plays or requests a title. The old behaviour is available as **Pre-create cards and tiles for every title** (Storage tab, off by default).
- New: **automatic cleanup** of `discover-cards` and `discover-tiles`, independent of creating files. It runs 2 minutes after startup and every 24 hours: first files older than the retention (cards 14 days, tiles 30 days, configurable), then the oldest files until the total is under the maximum size (2048 MB, configurable; 0 = unlimited). A card that is still being used keeps its date. The old cleanup that scanned the whole folder after every new file is removed.
- New: **Users tab**: tick which Emby users may make requests. Users without a tick can still browse and watch trailers, but pressing Play on Request does nothing in Radarr/Sonarr (playback is stopped and a message is shown), and the Request button on the Discover page returns a message. New users are allowed by default. Stored as `BlockedUserIds`.
- New: **Storage tab** with the size of the stored cards and tiles, the retention settings, and the buttons **Clean up now** and **Delete everything** (admins only; `GET /Discover/Cache`, `POST /Discover/Cache/Clean`).
- Change: the settings page is split into tabs: General, TMDB, Radarr & Sonarr, Users, Storage and Diagnostics. One Save button for all tabs; the last used tab is remembered. Settings page `discoverconfig1080` / `discoverconfigjs1350`.
- New: **Request all seasons** button in the season picker (Discover page, item pages and the rows). One click requests the whole series and, unlike ticking every season, Sonarr also monitors seasons that are released later. The old *All* button is now *Select all*, and the confirm button is *Request selected*.
- New: the channel's season folder ("Request: <series>") now starts with an **All seasons** item. Press ▶ on it to request the whole series at once, including seasons released later; the individual season items still request only that season. The season folder ID and the channel DataVersion were bumped so Emby drops its cached folder contents and shows the new item.
- After updating, restart Emby once and hard-refresh the browser (Ctrl+F5). Existing card and tile files are cleaned up by the new retention rules; use **Delete everything** on the Storage tab to free the space at once.

## Version 1.3.4.5

- Add: on-phone debug panel for the item-page buttons. Open any Discover item page with `?dcdebug=1` appended (or set `localStorage.dcDebug='1'`; `?dcdebug=0` turns it off). It shows the script build, the detected bottom bar, `--dc-bottom-clear`, the scroller, the Request button rect and its ancestor chain, and the viewport sizes. Tap the panel to hide it for 4 seconds.
- Fix: Emby's own fixed/sticky button bar is lifted above the bottom bar, and on mobile (narrow or touch) a minimum clearance of 88px + safe-area is always applied, even if detection fails.
- Add: the status page shows the DLL build, the DLL file time and the script build loaded in this browser. The Discover page diagnostic line shows the script build too.
- Fix: a read-only web client folder (e.g. Docker `:ro`) is reported as a warning (not an error), leaves no `.tmp` files and explains that the Discover page and buttons still work after opening Discover.
- Fix: on phones (mobile browser, narrow screens) the Request/Trailer buttons on item pages and the bottom of the Discover page are no longer hidden behind Emby's floating bottom navigation bar: the height of the bar is now measured in the browser (any fixed element at the bottom edge) and used as bottom padding of the scrolling item page, the Discover page and the floating button, so it works without relying on Emby class names or breakpoints. Desktop is unchanged.
- Change: the settings text for **Tile opens Discover page** is shorter and no longer wraps in a narrow column (Dutch, English, German), and now describes how it actually works: the loader stays in `index.html`, the switch takes effect right after saving, and when off the tile opens the channel tiles.

- Fix: on the Discover page (web client) the header text "Discover", the back arrow and the icons top right (cast, user, settings) are now white, also on hover/focus, instead of dark on the dark page. Scoped to the Discover page only (a body class that is set while that page is active); other pages and the side drawer are untouched.

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