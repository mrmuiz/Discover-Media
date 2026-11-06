## Version 1.4.0.3

- Fix: the **theme colour** could not be chosen on LG TVs (the list showed no text and did not change). The colours are now buttons with a coloured dot and their name; the chosen colour has a ✓. Works with mouse, Magic Remote and arrow keys.
- Page names bumped (`discoverconfig1090`, `discoverconfigjs1370`, `discoverui1110`, `discoveruijs1405`, `discoverbuttonjs1412`).

## Version 1.4.0.2

- Fix: **scroll arrows on TV with a pointer** (LG Magic Remote). The arrows only appeared when the device reported a "fine pointer"; LG webOS 24 does not, so rows could not be scrolled with the pointer there. Arrows now appear on hover as soon as the pointer is used (also on Emby's own pages), and hide again when the arrow keys are used.
- Fix: the scroll arrow to the right was sometimes missing on rows (e.g. "More like this · not in your library"): a row made while the page was still sliding in measured 0 wide. Arrows are now recalculated when the row gets its size and when you hover it.
- New: **theme colour** (Appearance tab): choose the colour of buttons, focus and accents (yellow, Emby green, blue, turquoise, purple, pink, red, orange, white). Applies to the Discover page, the popup and the rows on Emby's own pages, for everyone on the server.
- New: **poster captions** (Appearance tab): show or hide the year and the TMDB score under the posters.
- New: **IMDb, Rotten Tomatoes and Metacritic scores** in the popup via your own (free) OMDb API key, with a test button and an on/off switch. Cached 24 hours per title (`GET /Discover/Ratings`, `POST /Discover/TestOmdb`).
- New: **collections** in the popup of a movie that belongs to a series of films (e.g. Saw): all films in order, with a small status badge on the poster (✓ in library, ⏳ requested) and "This movie" under the film you are looking at. Request a single film with the **+** on its poster (e.g. parts 1–4 and 7, not 5 and 6), click a poster to open that film, or use **Request collection (N movies)**: a warning under the button says how many films that is, and the button asks for confirmation first (stops when the request limit is reached).
- New: **genre and sort** in Popular movies / Popular series: popular within a genre, newest or top rated (TMDB discover).
- New: **scroll arrows** on the cast row in the popup, large and centred on the photos like the row arrows.
- New: **TV remote navigation in the popup**: up/down moves between the rows (cast, collection, seasons, buttons) and left/right within a row; from the top row Up goes to the close button.
- Fix: in an app with its own (bundled) copy of the loader, e.g. the LG app, item and person pages could run a very old request-button script (no person rows, Emby's long filmography list, "More like this"). The server now tells the loader the current page names (`/Discover/LoaderConfig`: `UiPage`, `ButtonPage`), so the newest script is always loaded.
- Change: **all buttons light up on mouse-over** (Request, 4K, Trailer, seasons, collection, Request all, close); the Request buttons in the rows on Emby's pages now light up in the chosen theme colour instead of always yellow.
- Change: Emby's **back arrow on the Discover start** now does Emby's normal back (it did nothing there); inside Discover it still goes one step back.
- Fix: the **theme colour** could not be chosen on TV (empty selection, stayed yellow): the option values no longer contain `#`.
- Change: version strings in the scripts updated.
- Change: page names bumped (`discoverconfig1089`, `discoverconfigjs1369`, `discoverui1109`, `discoveruijs1404`, `discoverbuttonjs1411`).

## Version 1.4.0.1

- New: **Appearance** tab in the settings with everything that changes what you see: the tiles (tile opens Discover, Trailer tile), the rows on the Discover page and your own lists (TMDB list, Trakt watchlist). TMDB now only holds the key and languages.
- New: every row at the top of the Discover page can be switched on or off: **Recently added**, **Recent requests**, **My requests** and **New seasons** (clearer description: series in your library that have a new season you don't have yet).
- New: **wide cards** for the short rows at the top (up to 3 titles): backdrop, small poster, title and status, with the download progress across the card. With 4 or more titles the row falls back to posters.
- New: **Discover home button** (compass) in the search bar: back to the Discover start from anywhere, popup closed and search cleared.
- New: studio and network tiles are slightly larger and show the **logo in its own colours** when possible. Discover checks all logo versions TMDB has and picks the one that is best visible on the dark tile (e.g. Netflix, Hulu, HBO, FOX, NBC, Peacock); logos without a suitable version stay white.
- Change: **Emby's back arrow** at the top always stays within Discover (one step back, closes the popup; does nothing on the Discover start). On TV the remote's Back key does the same. The in-page "Back" button is gone.
- Change: the diagnostics button is called **Run diagnostics**.
- Fix: the **trailer** played behind the popup.
- Fix: the **close button** of the popup was hard to hit: Emby's header lay on top of it. While a popup or trailer is open the header is now hidden and not clickable, so the close button and clicking next to the popup always work.
- Fix: a removed TMDB list (or another extra row) stayed on the Discover page until a full reload; extra rows are now fetched again on every visit.
- Fix: the tile → Discover redirect did not work in browsers without the Navigation API (e.g. LG webOS 6 / Chrome 79, Firefox), because Emby navigates with pushState. The loader now also checks the route every second there.
- Change: own apps can set `window.__discoverAlwaysTile = true` before the loader so the tile always opens Discover, regardless of the browser setting.
- Change: page names bumped (`discoverconfig1087`, `discoverconfigjs1367`, `discoverui1101`, `discoveruijs1396`, `discoverbuttonjs1405`).

## Version 1.4.0.0

- New: **request limit per user** (Users tab): at most N requests per X days through Discover to Radarr/Sonarr, also when pressing Play in the channel. Administrators are exempt; in Seerr mode Seerr's own quotas apply.
- New: **overview of all requests** for administrators (Users tab, `GET /Discover/AllRequests`): title, user, date and status (requested / available / removed), with a count per user.
- New: **"… is available to watch" notification** in Emby for the requester once a requested title has files (Radarr/Sonarr or Seerr). Checked every 10 minutes; if the user is not active, the message follows on a later check (up to 30 days). No messages for old requests.
- New: **New seasons** row on the Discover page (`GET /Discover/ContinueSeries`): series in your library where TMDB already has a later aired season. Per user (only libraries they can see), cached 3 hours; can be turned off.
- New: optional **Trakt watchlist** (username + Client ID, public watchlist) and **TMDB list** (id or link) rows, each with a test button, and **Request all** on those rows (stops when the limit is reached). `GET /Discover/Watchlist`, `POST /Discover/TestWatchlist`.
- New: quick menu (right-click / long press), filters in the grid (year, score, language, not in library), people results in search, 4K request button (Seerr with a 4K server), and a backdrop behind the Discover page.
- New: the short rows at the top of the Discover page (My requests, New seasons, watchlists) sit **side by side** while they fit; a row with many titles gets the full width.
- New: clicking a poster in the "More like this / not in your library" rows (and a title in the filmography list on a person page) opens the **Discover popup on the page you are on**, instead of jumping to the Discover page. Closing it returns you to the same spot. The popup is the same as on the Discover page (embedded controller, loaded once).
- New: **cast with round photos** in the popup (name and role, up to 15). On the Discover page a click opens the Discover person page; above an Emby page it opens Emby's own person page when that person is in your library, otherwise the Discover person page.
- New: **person page in Discover** (`GET /Discover/Person`): photo, born/died with age, place of birth, biography (English fallback, "More"), a backdrop of their best-known title, and rows **In your library** (opens the title in Emby), **Movies · not in your library** and **Series · not in your library**, newest first. Up to 150 credits.
- Change: the person page rows are called **More movies with <name>** and **More series with <name>** ("by <name>" for directors), each card shows the **role** (character or "Director") under the year, and duplicate TMDB entries of the same title (same type and year with nearly the same title, or the same poster) are shown once (also in the rows on Emby's person pages).
- Change: on Emby's person pages the plugin row is split into **More movies with <name>** and **More series with <name>** (titles not in your library), the same names as on the Discover person page.
- New: **Cast row with round photos** under Discover channel pages in the web client: a title folder, the "Request: <series>" season list, request items and the trailer item (`GET /Discover/ItemCast?Id=<Emby item id>`, up to 20). A click opens Emby's person page when that person is in your library, otherwise the Discover person page.
- Fix: the Discover popup above an Emby page now loads the **download progress** right away and keeps refreshing it (every 15 s while something downloads) as long as it is open.
- Change: on a season request page ("Season 1") the season info now sits **to the right of the poster**, under the description: season name, TMDB score, aired from–to, status, network, original language, country and streaming services (`GET /Discover/SeriesCard?TmdbId=&Season=`). The blocks **About**, **Links (Trakt)** and **Media information** are hidden there; this also works on the Emby 4.11 detail page layout (`.itemView`).
- Fix: the bar at the top of a Discover channel page could flicker now and then: Emby and the plugin kept replacing each other's backdrop. On a channel page where Emby shows its own backdrop, the plugin now leaves it to Emby.
- New: **"All seasons" tile** made from a backdrop of the series (centre cut to a portrait tile, darker towards the bottom) with the **series logo** from TMDB (or the name as text), a yellow line, "All seasons" and the number of seasons. Without a backdrop the series poster is used; without ffmpeg the series poster as before.
- New: the **"All seasons" description** shows series info like the trailer page (tagline, start, status, seasons/episodes, genres, network, creators, summary), also in the TV/mobile apps. Season items show "Aired from …".
- New: **announced seasons** are marked **"Coming soon"** in the channel ("Season 3 · Coming soon", "Coming soon: from 12 March 2027") and with a small "coming soon" tag on the season buttons in the Discover popup. They can be requested already: if Sonarr does not know that season yet, the series is set to monitor new seasons, so Sonarr picks it up as soon as it appears. "All seasons" on a series already in Sonarr now also sets "monitor new seasons". In Seerr mode Seerr decides and its message is shown.
- New: compact **info block above the list of a Discover folder** (season list, title folder) in the web client: title, score, year, tagline, status/seasons/network, a 3-line description with "More" and the cast as small round photos. Visible right away, also with 31 seasons.
- Fix: the **Cast row** now also shows on trailer and movie request pages (hiding the "About" block hid everything after it, including the plugin's own sections).
- Change: Emby's **play button in the middle of the poster** (and the tile buttons on Discover folder tiles) is hidden on Discover pages, where playing means requesting or the trailer. The season info card is placed after the Request button and the text below it.
- Change: channel DataVersion 74 so Emby picks up the new descriptions and tiles.
- Fix: Emby 4.11 opens a channel folder as a list (`#!/list/list.html?parentId=…`) instead of `#!/item?id=…`. The plugin now recognises those pages as Discover folders too: the info block and cast appear, and Play/Shuffle are hidden.
- Fix: no backdrop on Discover channel pages since the previous build: an empty backdrop element of Emby already counted as "Emby has its own backdrop". Now only a real, visible image counts.
- Fix: stray "✓" next to the checkboxes on the settings page in Emby 4.11 (old checkbox outline markup that 4.11 no longer styles).
- Fix: the "Request"/"Trailer" text on the tiles of a title folder disappeared after a channel refresh without a user (scheduled refresh, DataVersion change): the refresh used the plain backdrop. It now reuses the tiles that were already made, without starting ffmpeg.
- Fix: a **renamed channel** (e.g. "Aanvragen" instead of "Discover Media") was not recognised by the web scripts and the status page, so the info block, cast and hidden Play/Shuffle buttons did not appear on Discover folders. New `GET /Discover/ChannelInfo` finds the Discover channel by its content (folder ids "ask…"/"tr…"), whatever its name. The status page uses it too, so "who can see the channel" is correct again and the hint names the channel as it is called in Emby.
- Fix: Emby 4.11 often shows channel folders from its own database without asking the plugin, so the "Request"/"Trailer" text tiles were never made "on open". Missing tiles are now made in the background (one at a time) during a channel refresh; when that queue is done the plugin starts "Refresh Internet Channels" itself (at most once every 3 hours, not while it is already running), so the tiles with text appear without doing anything. Channel DataVersion 75.
- Fix: the "All seasons" tile failed for series whose TMDB logo is an SVG (ffmpeg cannot read SVG). PNG logos are preferred, an SVG logo is fetched as PNG, and if the logo still cannot be used the series name is drawn as text.
- Fix: Emby only sets the image of a channel item when it creates the item, so a text tile made later never showed up. Once the "Request"/"Trailer" tile (or the new "All seasons" tile) is ready, the item now gets a slightly different id (suffix `:x`), so Emby creates it again with the tile. The same goes for the "Request: <series>" season folder. The suffix is stripped wherever the plugin reads these ids (play, request on play, season list, item lookups).
- Fix: **Emby 4.11 no longer returns `ChannelId`** for channel items, so the web script did not recognise Discover folders and tiles (no info block, cast, hidden Play/Shuffle or tile buttons). New `GET /Discover/IsDiscoverItem?Id=` / `?Ids=a,b,c` answers from the item's ExternalId; the script uses it wherever it used `ChannelId`.
- Change: in a title folder with only the Request and Trailer tiles, the two tiles have a little more space between them (web client).
- Fix: clicking an actor (or a poster that falls back to the Discover page) sometimes only opened the Discover home page: Emby can drop the extra parameters or reuse the open Discover page without a new `viewshow`. Emby 4.11 even creates a second, hidden copy of the Discover page when the address has extra parameters. The plugin now opens the plain Discover address (so Emby reuses its page) and passes the person or title via sessionStorage. (Emby 4.11 creates a new Discover page on every visit; it first shows an old copy and then replaces it, so every Discover page that appears within 10 seconds opens the target once; then it expires.)
- Note: backdrops for channel items in the native TV/mobile apps are not possible (Emby has no backdrop field for channel items); they work in the web client.
- Fix: the settings page always opens on the **General** tab (it remembered the last tab, so it could open straight on Diagnostics).
- Fix: an actor click from a channel page now waits up to 30 seconds for the Discover page (the first load after a restart can take longer than 10 seconds).
- Fix: **Back** on a person page goes back to where you came from: the Emby or channel page you clicked the actor on, or, inside Discover, the search results, list or home page exactly as you left them.
- Fix: text in the Discover popup no longer runs off the right edge for titles with a long cast row.
- Change: on a request page of something that is already requested (⏳) the button says **Request again**.
- Change: channel DataVersion 76.
- Change: page names bumped (`discoverconfig1083`, `discoverconfigjs1363`, `discoverui1092`, `discoveruijs1389`, `discoverbuttonjs1393`, `discoverstatusjs1103`).

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
- New: **backdrops inside the Discover channel** (same setting and web-client conditions): the channel root and the row/genre folders show a random trending backdrop; a title folder ("Request" / "Trailer"), the "Request: <series>" season list, a season item and the trailer item show the backdrop of that title. Hovering a title in a channel list switches to its backdrop, like in an Emby library. New endpoint `GET /Discover/ItemBackdrop?Id=<Emby item id>` (recognises channel items by their external id, cached).
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