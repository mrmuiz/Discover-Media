## Version 1.1.2

- Fix: the green checkmark (watched) now works per season. Each season item has its own key (`DiscoverSeasonTmdb` = `<series-id>-s<season>`) instead of the shared Tmdb id, so playing (requesting) one season no longer marks all seasons as watched. The trailer tile and the request tile are unchanged.
- Trailer tile: it can be switched on or off in the plugin settings ("Show the Trailer tile next to Request in the channel", added in 1.1.1, default on). Preparation for a trailer tile per season (`ShowSeasonTrailerTile`, default off, no checkbox in the settings yet).
- Fix: the diagnostics on the Discover page showed the request-button script as v1.1.0 while the server was v1.1.2.0, which looked like an outdated script. The script version is now 1.1.2, so both match.
- Technical: channel version 72, the scripts keep the same resource names.
