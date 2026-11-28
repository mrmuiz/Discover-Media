# Homebar Discover (rooted LG TVs)

**English** | [Nederlands](#nederlands)

Homebar Discover is a build of [Homebar](https://github.com/rawinek/webos-homebar) (formerly *rawin-launcher*, by rawin, MIT) for **rooted LG webOS TVs**. It replaces the TV's home screen with the Discover rows of the Emby Discover plugin (large backdrops and posters, all rows as switched on in the plugin) and keeps the Homebar bar with your apps and HDMI inputs at the bottom. OK on a poster opens the title in the Emby app on the TV.

It is **not an Emby plugin**: nothing is installed on the Emby server. The TV reads the rows from `/emby/Discover/Home` with an Emby API key, entered on a phone through a QR code. It needs the Discover plugin 1.4 or newer.

- Needs a rooted TV with the Homebrew Channel and root SSH. It runs as root and replaces how the home screen works: use at your own risk. Not affiliated with LG.
- Tested on **webOS 6.5.3** (system HOME). Other webOS versions follow upstream Homebar's compatibility table but are untested with Discover.
- Updates from the original Homebar are switched off in this build (a `-discover` version), otherwise an update would remove Discover. Install a newer package by repeating the install.
- Uninstall on the TV, as root: `sh /var/lib/webosbrew/rawin-launcher-home/uninstall.sh` (the Home-panel variant on webOS 4/5 uses `/var/lib/webosbrew/rawin-launcher/uninstall.sh`).

## Install

The Dutch guide with every step is in [`docs/Homebar-Discover-installeren.pdf`](docs/Homebar-Discover-installeren.pdf). In short:

1. Pack the folder: `tar czf homebar-discover.tar.gz rawin-launcher` (from inside `lg-launcher/`).
2. Copy it to the TV: `scp -O homebar-discover.tar.gz root@TV-IP:/tmp/rawin-launcher.tar.gz`.
3. On the TV, as root: `cd /tmp && rm -rf rawin-launcher && tar xzf rawin-launcher.tar.gz && sh rawin-launcher/install.sh` (`--probe` first shows what would be installed and changes nothing).
4. Press HOME, open *System → Launcher settings → Discover-wallpaper*, scan the QR code with a phone on the same wifi and fill in the server address and an Emby API key.

## Contents

| Path | What |
| :--- | :--- |
| `rawin-launcher/` | The package: installers (`install.sh`, `webos4/`, `webos10/`), `ui/` (QML), `shared/` (setup server and `discover.js`), upstream `README.md` and `LICENSE`. |
| `rawin-launcher/webos10/*.ipk` | The prebuilt overlay app and black card. The root helper service (`service.js` and friends) exists only inside the IPK. |
| `docs/Homebar-Discover-installeren.pdf` | Dutch install guide. |
| `NOTICE.md` | Licenses and attribution. |

The upstream `rawin-launcher/README.md` describes plain Homebar; its links to `docs/` and screenshots are not part of this copy (see the upstream repository).

## Nederlands

Homebar Discover is een build van [Homebar](https://github.com/rawinek/webos-homebar) (voorheen *rawin-launcher*, van rawin, MIT) voor **geroote LG webOS-tv's**. Het vervangt het startscherm van de tv door de Discover-rijen van de Emby Discover-plugin (grote achtergronden en posters) en houdt onderaan de Homebar-balk met je apps en HDMI-ingangen. OK op een poster opent de titel in de Emby-app op de tv.

Het is **geen Emby-plugin**: er wordt niets op de Emby-server geïnstalleerd. De tv haalt de rijen op via `/emby/Discover/Home` met een Emby-API-sleutel, die je met een telefoon via een QR-code invult. De Discover-plugin moet 1.4 of nieuwer zijn.

- Vereist een geroote tv met Homebrew Channel en SSH als root. Gebruik op eigen risico; niet verbonden aan LG.
- Getest op **webOS 6.5.3**; andere versies zijn niet met Discover getest.
- Updates van de originele Homebar staan in deze build uit; een nieuwe versie installeer je opnieuw.
- Alle stappen staan in de [installatiehandleiding (PDF)](docs/Homebar-Discover-installeren.pdf).
