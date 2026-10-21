<p align="center">
  <img src="docs/logo.png" alt="Discover for Emby" width="420">
</p>

<h1 align="center">Emby Discover</h1>

<p align="center">
  Browse movies and series from TMDB in Emby, watch trailers, and send requests to Radarr or Sonarr.
</p>

> **Status: beta.** The current test build is **1.0.37.74-beta**, built against Emby SDK 4.9.1.90. It is intended for testing with Emby Server 4.11.0.9; other Emby versions may work but have not been individually tested. Please report problems through [Issues](../../issues) and include the relevant diagnostics (see [Troubleshooting](#troubleshooting)).

## Screenshots

**Discover home** — recently added titles, recent requests and recommendations.

<p align="center">
  <img src="docs/screenshots/discover-home.png" alt="Emby Discover home page showing recently added titles, recent requests and trending movies and series" width="100%">
</p>

**Discover Media channel** — browse the available lists and collections.

<p align="center">
  <img src="docs/screenshots/discover-categories.png" alt="Discover Media channel with movie and series genres, popular and trending lists, studios and upcoming titles" width="100%">
</p>

**Movie genres** — open a genre to browse matching titles.

<p align="center">
  <img src="docs/screenshots/discover-movie-genres.png" alt="Movie Genres page with illustrated genre tiles" width="100%">
</p>

## What it does

- Adds a **Discover Media** channel with trending, popular and upcoming movies and series, genre lists, studios and networks.
- Provides a **Discover** page in the Emby web client with browsing and search.
- Lets users request movies through Radarr and series through Sonarr.
- Shows a trailer and a separate **Request** button on supported web-client detail pages. On a Request item, the Emby **Play** button is used to submit the request.
- Provides a Play-based request flow for Android, TV and other clients that cannot run the web button script.
- Shows whether a title is already requested or available when that status can be matched in Radarr or Sonarr.

## Requirements

- Emby Server. The plugin is built against `MediaBrowser.Server.Core` 4.9.1.90; testing has used Emby Server 4.11.0.9.
- A [TMDB API key](https://www.themoviedb.org/settings/api).
- Radarr for movie requests and/or Sonarr for series requests.
- Emby's bundled `ffmpeg` is used to create some channel artwork and the request confirmation clip.

## Install

1. Download `Emby.Plugins.Discover.dll` from the [latest release](../../releases/latest).
2. Stop Emby, then copy the DLL into the Emby data directory's `plugins` folder. For Docker installations, this is usually `<Emby config folder>/plugins` (inside the container: `/config/plugins`).
3. Remove older copies of the Discover DLL from that folder so only one version remains.
4. Start Emby.
5. Open **Dashboard > Plugins > Discover**, configure the TMDB key and Radarr/Sonarr connection details, test the connections, select the quality profile and root folder, and save.
6. Give the intended users access to channels in their Emby user settings.
7. **For the first channel load, run the Internet Channels refresh once:** open **Dashboard > Scheduled Tasks > Internet Channels** and start **Refresh Internet Channels**. The initial refresh can take several minutes or longer. Leave it running until it finishes; be patient and do not repeatedly start the task.

The request-button script is embedded in the plugin DLL and is loaded by the browser when **Discover** is opened. The plugin does **not** edit `index.html` or other Emby web-client files, require write access to Emby's installation folders, or install a separate JavaScript file. After a browser hard refresh (`Ctrl+F5`), open **Discover** again to load the button script in that browser. Native Emby apps do not run browser scripts and use the Play-based request flow in the **Discover Media** channel.

For Docker, do not use `localhost` for Radarr or Sonarr unless those services share the Emby container's network namespace. Use an address that Emby can reach, such as a service/container name on the same Docker network or the host's LAN address.

## Use

- Open **Discover Media** and browse a list, genre, studio or network.
- In the web client, open a title and choose **Request** where the separate web button is available. On a series, choose the seasons to monitor when prompted.
- To request from a Request item—including on TV/Android clients—open the item and press **Play** (shown as **Aanvragen** on the detail page).
- To watch a trailer, open its **Trailer** item and press **Play**.
- Open folders and tiles to browse them; do not press Play on a folder.

## Configuration

| Setting | Purpose |
|---|---|
| TMDB API key | Provides titles, artwork and metadata. |
| Plugin language | Defaults to following Emby's server UI language; Dutch and English can also be selected manually. |
| TMDB language | Defaults to following Emby's server UI language (`nl-NL` for Dutch and `en-US` otherwise); a TMDB language can also be selected manually. |
| Radarr URL and API key | Sends movie requests to Radarr. |
| Sonarr URL and API key | Sends series requests to Sonarr. |
| Quality profile and root folder | Selects the destination settings used for requests. Choose values returned by **Test connection**. |
| Show Diagnostics | Optional yellow debug message and technical media information on item pages. **Off by default.** |

API keys are stored in the plugin configuration and masked in the settings form by default.

## Troubleshooting

Open **Dashboard > Plugins > Discover > Status and diagnostics**. It reports the plugin and Emby versions, service connectivity, channel visibility, request counts and recent plugin events. Do not post API keys or other secrets in an issue.

For the first channel refresh, run **Refresh Internet Channels** from **Dashboard > Scheduled Tasks > Internet Channels** and wait for it to complete. The initial run may take several minutes or longer; avoid starting duplicate refreshes while it is still running.

For web-client button problems:

1. Open **Discover** in that browser to load the embedded button script. After installing or updating the plugin, hard-refresh (`Ctrl+F5`) and then open **Discover** again.
2. Enable **Show Diagnostics** in the plugin settings if you want the yellow item-page diagnostic. It is off by default.
3. Confirm that only one Discover DLL is installed and that Emby was restarted after replacing it.
4. If the script is still inactive, open the browser developer console, copy the relevant error, and include it with the diagnostics report. Android/TV apps do not support the browser button; use the channel's Request item and press Play instead.

Other common causes:

- The user cannot see the channel: grant channel access in that user's Emby settings.
- Radarr or Sonarr cannot be reached from Emby: verify the URL from the server/container, not just from a desktop browser.
- Old channel artwork or entries remain cached: run **Refresh Internet Channels** and wait for completion; Emby may retain channel items between requests.

## Build

Use the source ZIP attached to the same release to build that exact version:

```bash
dotnet build EmbyDiscover/EmbyDiscover.csproj -c Release
