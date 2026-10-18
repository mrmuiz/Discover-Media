<p align="center">
  <img src="docs/logo.png" alt="Discover for Emby" width="420">
</p>

<h1 align="center">Emby Discover</h1>

<p align="center">
  A Seerr-style <em>Discover</em> experience inside Emby: browse trending, popular and upcoming movies and series
  (TMDB), watch trailers and request titles through Radarr and Sonarr, from the web client, the TV apps and mobile.
</p>

> **Status: 1.0 beta.** It works for the author's setup, but expect rough edges. Please report problems through
> [issues](../../issues) and include the diagnostics report (see [Troubleshooting](#troubleshooting)).

## Features

- **Discover channel** in Emby ("Discover Media"): Trending, Popular and Upcoming movies and series, movie and series
  genres, and studios and networks, each as a coloured tile.
- **Trailer and request per title**: *Play* shows the YouTube trailer, *Request* adds the title to Radarr (movies) or
  Sonarr (series, with season selection).
- **Works on TV and mobile apps**: apps that cannot show an extra button get an *Aanvragen* item where pressing ▶
  requests the title; a short confirmation card is shown.
- **Status at a glance**: already requested (⏳) or available (✓) titles are recognised from Radarr and Sonarr.
- **Own Discover page** in the Emby web UI with search, in the style of Seerr.
- **Diagnostics page** that checks the plugin, channel, TMDB, Radarr, Sonarr and user access.

## Requirements

- Emby Server 4.9 or newer (built against `MediaBrowser.Server.Core` 4.9.1.90).
- A free [TMDB API key](https://www.themoviedb.org/settings/api).
- Optional: Radarr and/or Sonarr for requests.
- `ffmpeg` (included with Emby) is used to create tile images and confirmation cards.

## Installation

1. Download `Emby.Plugins.Discover.dll` from the [latest release](../../releases/latest)
   (or build it yourself, see below).
2. Copy it into the `plugins` folder of your Emby data directory (Docker: `/config/plugins`).
3. Restart Emby Server.
4. Open **Dashboard > Plugins > Discover** and fill in your TMDB key, the Radarr and Sonarr URL and API key, then press
   *Test connection*. The *Quality profile* and *Root folder* lists fill themselves; pick the ones you want and save.
5. Give users access to the channel: **User > Access > Channels**.

When Emby runs in Docker, `localhost` does not point to the host: use the IP address or container name of Radarr and
Sonarr.

## Usage

- Open the **Discover Media** channel, pick a list, then a title.
- **Web client**: use the *Request* button on the title page. For series with several seasons you can choose which
  seasons to request.
- **TV and mobile apps**: open *Aanvragen: <title>* and press ▶.
- Folders (the coloured tiles) are only opened, never played: playing a folder would request every title in it.

## Configuration

| Setting | Description |
|---|---|
| TMDB API key, language | Source of lists and metadata (default language `nl-NL`). |
| Radarr / Sonarr URL and API key | Where requests are sent. API keys are hidden in the form (use the eye icon to show). |
| Quality profile, root folder | Used for every request; the lists are filled from Radarr/Sonarr. |

## Building

```bash
dotnet build EmbyDiscover/EmbyDiscover.csproj -c Release
```

The plugin is `EmbyDiscover/bin/Release/netstandard2.0/Emby.Plugins.Discover.dll`. GitHub Actions builds it on every
push (artifact *Emby.Plugins.Discover*) and attaches it to a release when you push a tag such as `v1.0.0-beta.1`.

## Troubleshooting

Open **Dashboard > Plugins > Discover > Status and diagnostics**. The report shows the Emby version, whether the plugin
is loaded, TMDB/Radarr/Sonarr connectivity, channel access per user and the most recent plugin events (including why a
tile image could not be created). Attach it (without URLs or API keys) to an issue.

Common causes:

- The DLL is not in the `plugins` folder, or Emby was not restarted.
- The user has no access to the channel (*User > Access > Channels*).
- Radarr/Sonarr is not reachable from the Emby server at that URL.
- Old tiles remain after an update: Emby stores channel items per id. The plugin changes its ids when images or names
  change; restart Emby and reopen the channel.

## Contributing

Issues and pull requests are welcome. Please describe the Emby version and client you tested with.

## License

[MIT](LICENSE). The embedded Poppins font is licensed under the SIL Open Font License; see
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with Emby, Radarr or Sonarr.
