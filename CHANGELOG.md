## Version 1.3.5.1

- Fix: **trailers in shell apps (LG webOS / Samsung Tizen / the Android Discover app) no longer hang.** The choice is now made on origin, not on "is this a TV". A shell app that loads the Emby web client over `http(s)` from the server (the LG app, a browser on a TV) uses the embedded YouTube player, because the Emby player can freeze in a bare webview without native media glue. Only a truly packaged app served from `file://` (the official LG/Tizen app, the Android APK) keeps using the Emby player, because the embedded YouTube player has no valid origin there.
- New (optional, off by default): **the "Discover Media" tile opens the Discover page directly.** When enabled under the plugin settings, the plugin injects a small loader script into the Emby web client's `index.html`, so a tap on the Discover Media tile or menu entry jumps straight to the Discover page — in the browser and in shell apps such as the LG app — instead of showing the channel's folders. The same loader also makes the Request button available on normal Emby detail pages without opening Discover first. The loader is re-applied on every server start (Emby updates overwrite the web client) and removed cleanly when the setting is turned off. If the web client lives in a non-standard location, its folder can be set under "Web client path"; otherwise it is found automatically. Everything is defensive: if the folder is not found or is not writable, the plugin logs it and keeps working. `/Discover/Status` reports the result as "Tile Discover Media -> Discover page".
- Technical: plugin version and request-button script version are both 1.3.5.1; script resource names changed (`discoveruijs1351`, `discoverbuttonjs1351`) to avoid cached scripts. New embedded resource `discover-web-loader.js`; new server entry point `WebClientInjector`; new setting `InjectWebClientLoader`.

## Version 1.3.5.0

- Fix: **Android TV / Fire TV remote control** on the Discover page. Emby's own focus navigation did not know the Discover rows and popup: the focus jumped behind the popup and was pulled back to the close button, so **Request** could not be reached, and the first press down opened the side menu. The page now handles the remote itself through Emby's `command` events: left/right within a row, up/down between the search bar and the rows, the focus starts on the first title, and in the popup you move between Request, Trailer, Delete and the close button. Left on the first title of a row still opens Emby's side menu; Back closes the trailer or popup first, then leaves a genre/studio overview, then the page.
- Fix: Android TV is now recognised as a TV (Emby's `layout-tv` class, besides LG webOS and Samsung Tizen), so it gets the TV flow: tapping a title opens the popup with Request directly.
- Fix: the popup on TV no longer falls outside the screen. Sizes are based on the screen (`vh`/`vw`) instead of fixed pixels and Emby's enlarged TV text, with margins against TV overscan; long texts are shortened so the buttons always stay visible. The scroll arrows next to the rows are hidden on TV and the confirmation appears at the top.
- Trailers on Android TV still use the embedded YouTube player; on webOS/Tizen they keep using the Emby player.
- Technical: plugin version and request-button script version are both 1.3.5.0; script resource names changed (`discoveruijs1350`, `discoverbuttonjs1350`) to avoid cached scripts.

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