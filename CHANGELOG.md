## Version 1.4.0.0

- New: **request management** in the plugin settings (Dashboard > Plugins > Discover). Administrators see all requests with who requested what and when, and can approve, deny or remove them. Tabs: waiting for approval, in progress, all.
- New: **approval per user**. In the same settings page, tick "Needs approval" for a user: their requests then wait for an administrator before they go to Radarr or Sonarr. Administrators never need approval.
- New: **weekly limit per user**: the maximum number of requests per 7 days (0 = unlimited). Titles that were already in Radarr or Sonarr do not count.
- New: **My requests** row at the top of the Discover page, with the live status of each request: waiting for approval, requested, downloading with a percentage, available or denied.
- New: **download progress** from the Radarr and Sonarr queue, in My requests and in the administrator list.
- New: **notification when a request is available**. Every 5 minutes the plugin checks whether requested titles have arrived in Radarr or Sonarr. The person who requested it gets a pop-up in the Emby apps where they are signed in, and an Emby notification ("Requested title is available", category Discover) that can be sent by e-mail, push or webhook through Emby's notification settings.
- Requests are stored in `discover-data/requests.json` in Emby's data folder.
- New routes: `/Discover/MyRequests`, `/Discover/MyRequests/Cancel`, `/Discover/Requests`, `/Discover/Requests/Approve`, `/Discover/Requests/Deny`, `/Discover/Requests/Delete` and `/Discover/Requests/UserRule`.
- Technical: script resource names changed (`discoveruijs1400`, `discoverbuttonjs1400`, `discoverconfigjs1400`) to avoid cached browser scripts.

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