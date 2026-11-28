# Installing Homebar Discover on an LG TV

**English** | [Nederlands](INSTALL.nl.md)

Homebar Discover replaces the home screen of a rooted LG TV with a Discover screen: large backdrops of movies and series, all rows of the Discover plugin one below the other, and at the bottom the Homebar bar with your apps and HDMI inputs. Tested on a 2021 LG with webOS 6.5.3; other webOS versions have not been tested yet.

> This is a translation of the Dutch guide `Homebar-Discover-installeren.pdf` (see also [INSTALL.nl.md](INSTALL.nl.md)). Menu and option names are shown as they appear with the TV set to English; the Dutch names are given in brackets where they differ.

## What you get

- **Discover screen as Home:** when nothing is playing you see the backdrop of a title, with its name, year, score and whether it is already in your library.
- **All Discover rows:** Recently added, Recent requests, Trending, Popular and Upcoming movies and series, as switched on in the plugin.
- **Open a poster:** OK on a poster starts the Emby app. With the patched Emby app the popup of that title opens straight away; with the regular Emby app, Emby opens on its start screen.
- **Screensaver:** after a few minutes without a key press the Discover backdrops run as a screensaver, or the TV's own screensaver.
- **No more Live TV:** the TV no longer jumps to Live TV with "Not programmed" by itself.

## What you need

| What | Why |
| :--- | :--- |
| A rooted LG TV with the Homebrew Channel | Homebar runs as root; it does not work without root |
| SSH access as root (password or key) | to install the package |
| A PC with Windows PowerShell (or a Mac/Linux terminal) | to copy the package to the TV |
| The package `homebar-discover.tar.gz` | this is Homebar Discover |
| An Emby server with the Discover Media plugin (1.4 or newer) | the rows and posters come from there |
| An Emby API key for that server | Emby dashboard → Advanced → API Keys → + |
| A phone on the same wifi as the TV | to enter the server and key |
| An Emby app on the TV | to open a poster |

If a friend uses your Emby server, you, as the administrator, create the API key for them. You can find the TV's IP address by connecting to the TV over SSH and running `ip -4 addr | grep inet` (the address before the `/`, not `127.0.0.1`).

## Step 1: copy the package to the TV

You do this on the PC, in PowerShell. First put the package in your Downloads folder. Replace `IP-VAN-TV` (Dutch for "IP of the TV") with the TV's address, for example `192.168.1.142`.

```powershell
cd $HOME\Downloads
scp -O homebar-discover.tar.gz root@IP-VAN-TV:/tmp/rawin-launcher.tar.gz
```

- Enter the TV's root password when asked.
- If it asks whether you trust the connection, type `yes`.
- The `-O` is needed: the TV does not support the newer way of copying.
- Did it work? Then you see a line like `rawin-launcher.tar.gz 100%`.

## Step 2: install on the TV

Log in to the TV as root, for example with `ssh root@IP-VAN-TV` in PowerShell, and type there:

```sh
cd /tmp
rm -rf rawin-launcher
tar xzf rawin-launcher.tar.gz
sh rawin-launcher/install.sh
```

At the end you should see:

```text
rawin-launcher: installing org.rawin.launcher_0.20.3-discover9_all.ipk
rawin-launcher: installing org.rawin.launcher.blank_0.20.3-discover9_all.ipk
rawin-launcher: done. Press HOME on the remote.
```

Then press HOME: the Homebar bar appears. If Homebar is already installed, the new version simply goes over it; favourites and settings are kept.

In the webOS Dev Manager you will then see two apps: *Homebar Discover* and *Homebar Discover Screensaver*. Leave both in place.

## Step 3: set up Discover with your phone

1. Press HOME, go to **System** (right side of the bar) and choose **Launcher settings** (Dutch UI: *Launcher-instellingen*).
2. At the top choose **Discover wallpaper** (Dutch UI: *Discover-wallpaper*) and press OK. A QR code appears on the right.
3. Scan the code with your phone's camera. The phone must be on the same wifi as the TV.
4. Under Discover, fill in:
   - **Address of the Emby server**, for example `http://192.168.1.236:8096`
   - **Emby API key**, the key you created in the Emby dashboard
   - **Row for the backdrop**, for example Trending
   - **App to open**, the Emby app on the TV
   - **Also about Live TV**, leave this on
5. Press **Save**. "Saved. Discover ... found" means it worked.

After about a minute the posters are in. In *Launcher settings → Discover wallpaper* you then see, for example, "7 rows" (Dutch UI: "7 rijen").

The QR code only works until the TV or Homebar restarts. If the page stops working, scan the code again.

## Step 4: settings on the TV

In *Launcher settings*, set four more things:

| Setting | Choose | Why |
| :--- | :--- | :--- |
| Launch method (Dutch UI: *Startmethode*) | System HOME (native) (*Systeem-HOME (native)*) | then Homebar is the TV's home screen |
| After holding BACK (*Na lang TERUG indrukken*) | Do nothing (*Niets doen*) | after an app you end up on Discover, not on an HDMI input |
| Screensaver | Discover backdrops (*Discover-achtergronden*) or The TV's screensaver (*Screensaver van de tv*) | what shows when you do nothing for a while |
| Screensaver after (*Screensaver na*) | for example 2 min | only with Discover backdrops |

If you choose the Discover backdrops, Homebar holds off the TV's screensaver (for example Aerial) while Discover is on screen. There is deliberately no option without a screensaver: a static image can burn in on an OLED TV.

## Controls

On the posters you see MOVIE or SERIES (FILM or SERIE in a Dutch UI) at the top left, a green tick at the top right if the title is in the library and an orange dot if it has been requested.

| Key | What happens |
| :--- | :--- |
| HOME | Homebar with the Discover screen; on Discover itself, back to the start |
| ▲ from the bar | into the Discover rows |
| ▲ ▼ in the rows | to the row above or below; ▼ on the bottom row goes back to the bar |
| ◀ ▶ in a row | to the previous or next title; the backdrop changes with it |
| OK on a poster | opens the title in the Emby app |
| BACK in the rows | back to the bar |
| BACK in Emby, after a poster | back to the Discover screen (only with the patched Emby app) |
| Any key during the screensaver | Homebar comes back |

## Troubleshooting

| Problem | Solution |
| :--- | :--- |
| `scp`: "No such file or directory" | the package is not in Downloads, or has a different name; check with `dir *.tar.gz` |
| `scp`: "Could not resolve hostname" | `IP-VAN-TV` is still in the command; enter the TV's real address |
| `scp: not found` | you are typing it on the TV; `scp` belongs in PowerShell on the PC |
| Save: "The API key is not accepted" (Dutch UI: "De API-sleutel wordt niet geaccepteerd") | copy the key again from the Emby dashboard |
| Save: "The TV cannot reach the server" (Dutch UI: "De tv kan de server niet bereiken") | are the address and port correct (usually 8096)? Is the TV on the same network? |
| No posters after a few minutes | go to *Launcher settings → Discover wallpaper*; if it says "Fetching posters…", wait a bit |
| Something else goes wrong | on the TV run `tail -30 /tmp/rawin-launcher-panel.log` and send those lines |

## Updating

Updates from the original Homebar are switched off in this version, otherwise an update would remove Discover again. Install a new version with the same steps 1 and 2.

## Uninstalling

On the TV, as root:

```sh
sh /var/lib/webosbrew/rawin-launcher-home/uninstall.sh
```

Both apps are then gone, and LG's regular home screen comes back.

## Credits

Homebar is made by rawin ([webos-homebar](https://github.com/rawinek/webos-homebar), MIT license); Discover Media is by mrmuiz. See [`../NOTICE.md`](../NOTICE.md).
