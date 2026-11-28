# Homebar Discover installeren op een LG-tv

[English](INSTALL.en.md) | **Nederlands**

Homebar Discover vervangt het startscherm van een geroote LG-tv door een Discover-scherm: grote achtergronden van films en series, alle rijen van de Discover-plugin onder elkaar, en onderaan de Homebar-balk met je apps en HDMI-ingangen. Getest op een LG uit 2021 met webOS 6.5.3; andere webOS-versies zijn nog niet getest.

> Dit is een tekstversie van `Homebar-Discover-installeren.pdf`. De PDF is de oudere uitgave (0.20.3-discover9) en toont die versienummers in de installatie-uitvoer; deze Markdown-handleiding is leidend (versie 1.0.0). De namen van menu's en opties volgen de tv-taal; staat de tv op Engels, dan heten ze zoals tussen haakjes vermeld.

## Wat je krijgt

- **Discover-scherm als Home:** speelt er niets, dan zie je de achtergrond van een titel, met naam, jaar, score en of hij al in de bibliotheek staat.
- **Alle Discover-rijen:** Onlangs toegevoegd, Recente aanvragen, Trending, Populaire en Aankomende films en series, zoals ze in de plugin aanstaan.
- **Poster openen:** OK op een poster start de Emby-app. Met de aangepaste Emby-app opent meteen de popup van die titel; met de gewone Emby-app opent Emby op het beginscherm.
- **Screensaver:** na een paar minuten zonder toets lopen de Discover-achtergronden als screensaver, of de screensaver van de tv zelf.
- **Geen Live TV meer:** de tv springt niet vanzelf naar Live TV met "Niet geprogrammeerd".

## Wat je nodig hebt

| Wat | Waarom |
| :--- | :--- |
| Een geroote LG-tv met de Homebrew Channel | Homebar draait als root; zonder root kan het niet |
| SSH-toegang als root (wachtwoord of sleutel) | om het pakket te installeren |
| Een pc met Windows PowerShell (of een Mac/Linux-terminal) | om het pakket naar de tv te kopiëren |
| Het pakket `homebar-discover.tar.gz` | dit is Homebar Discover |
| Een Emby-server met de plugin Discover Media (1.4 of nieuwer) | daar komen de rijen en posters vandaan |
| Een Emby-API-sleutel van die server | Emby-dashboard → Geavanceerd → API-sleutels → + |
| Een telefoon op hetzelfde wifi als de tv | om de server en sleutel in te vullen |
| Een Emby-app op de tv | om een poster te openen |

Gebruikt je vriend jouw Emby-server, dan maak jij als beheerder de API-sleutel voor hem aan. Het IP-adres van de tv vind je via SSH op de tv met `ip -4 addr | grep inet` (het adres vóór de `/`, niet `127.0.0.1`).

## Stap 1: het pakket naar de tv kopiëren

Dit doe je op de pc, in PowerShell. Zet het pakket eerst in je map Downloads. Vervang `IP-VAN-TV` door het adres van de tv, bijvoorbeeld `192.168.1.142`.

```powershell
cd $HOME\Downloads
scp -O homebar-discover.tar.gz root@IP-VAN-TV:/tmp/rawin-launcher.tar.gz
```

- Vul het root-wachtwoord van de tv in als erom gevraagd wordt.
- Vraagt hij of je de verbinding vertrouwt, typ dan `yes`.
- De `-O` is nodig: de tv kent de nieuwere manier van kopiëren niet.
- Goed gegaan? Dan zie je een regel als `rawin-launcher.tar.gz 100%`.

## Stap 2: installeren op de tv

Log op de tv in als root, bijvoorbeeld met `ssh root@IP-VAN-TV` in PowerShell, en typ daar:

```sh
cd /tmp
rm -rf rawin-launcher
tar xzf rawin-launcher.tar.gz
sh rawin-launcher/install.sh
```

Aan het eind hoort dit te staan:

```text
rawin-launcher: installing org.rawin.launcher_1.0.0_all.ipk
rawin-launcher: installing org.rawin.launcher.blank_1.0.0_all.ipk
rawin-launcher: done. Press HOME on the remote.
```

Druk daarna op HOME: de Homebar-balk verschijnt. Staat Homebar er al op, dan gaat de nieuwe versie er gewoon overheen; favorieten en instellingen blijven bewaard.

In de webOS Dev Manager zie je daarna twee apps: *Homebar Discover* en *Homebar Discover Screensaver*. Allebei laten staan.

## Stap 3: Discover instellen met je telefoon

1. Druk op HOME, ga naar **System** (rechts in de balk) en kies **Launcher-instellingen** (Engels: *Launcher settings*).
2. Kies bovenaan **Discover-wallpaper** (Engels: *Discover wallpaper*) en druk op OK. Rechts verschijnt een QR-code.
3. Scan de code met de camera van je telefoon. De telefoon moet op hetzelfde wifi zitten als de tv.
4. Vul bij Discover op de tv in:
   - **Adres van de Emby-server**, bijvoorbeeld `http://192.168.1.236:8096`
   - **Emby-API-sleutel**, de sleutel die je in het Emby-dashboard hebt gemaakt
   - **Rij voor de achtergrond**, bijvoorbeeld Trending
   - **App om te openen**, de Emby-app op de tv
   - **Ook over Live TV**, laat dit aanstaan
5. Druk op **Opslaan**. Bij "Opgeslagen. Discover ... gevonden" is het gelukt.

Na ongeveer een minuut zijn de posters binnen. In *Launcher-instellingen → Discover-wallpaper* zie je dan bijvoorbeeld "7 rijen" (Engels: "7 rows").

De QR-code werkt alleen tot de tv of Homebar herstart. Werkt de pagina niet meer, scan de code dan opnieuw.

## Stap 4: instellingen op de tv

In *Launcher-instellingen* zet je nog vier dingen goed:

| Instelling | Kies | Waarom |
| :--- | :--- | :--- |
| Startmethode (*Launch method*) | Systeem-HOME (*System HOME (native)*) | dan is Homebar het startscherm van de tv |
| Na lang TERUG indrukken (*After holding BACK*) | Niets doen (*Do nothing*) | na een app kom je op Discover uit, niet op een HDMI-ingang |
| Screensaver | Discover-achtergronden (*Discover backdrops*) of Screensaver van de tv (*The TV's screensaver*) | wat er komt als je een tijdje niets doet |
| Screensaver na (*Screensaver after*) | bijvoorbeeld 2 min | alleen bij Discover-achtergronden |

Kies je Discover-achtergronden, dan houdt Homebar de screensaver van de tv (bijvoorbeeld Aerial) tegen zolang Discover in beeld is. Een optie zonder screensaver is er bewust niet: een stilstaand beeld kan op een OLED-tv inbranden.

## Bediening

Op de posters zie je linksboven FILM of SERIE, rechtsboven een groen vinkje als de titel in de bibliotheek staat en een oranje bolletje als hij is aangevraagd.

| Toets | Wat er gebeurt |
| :--- | :--- |
| HOME | Homebar met het Discover-scherm; op Discover zelf terug naar het begin |
| ▲ vanaf de balk | de Discover-rijen in |
| ▲ ▼ in de rijen | naar de rij erboven of eronder; ▼ op de onderste rij gaat terug naar de balk |
| ◀ ▶ in een rij | naar de vorige of volgende titel; de achtergrond wisselt mee |
| OK op een poster | opent de titel in de Emby-app |
| TERUG in de rijen | terug naar de balk |
| TERUG in Emby, na een poster | terug naar het Discover-scherm (alleen met de aangepaste Emby-app) |
| Een toets tijdens de screensaver | Homebar komt terug |

## Problemen oplossen

| Probleem | Oplossing |
| :--- | :--- |
| `scp`: "No such file or directory" | het pakket staat niet in Downloads, of heet anders; kijk met `dir *.tar.gz` |
| `scp`: "Could not resolve hostname" | er staat nog `IP-VAN-TV`; vul het echte adres van de tv in |
| `scp: not found` | je typt het op de tv; `scp` hoort in PowerShell op de pc |
| Opslaan: "De API-sleutel wordt niet geaccepteerd" | sleutel opnieuw kopiëren uit het Emby-dashboard |
| Opslaan: "De tv kan de server niet bereiken" | klopt het adres en de poort (meestal 8096)? Zit de tv in hetzelfde netwerk? |
| Geen posters na een paar minuten | *Launcher-instellingen → Discover-wallpaper*; staat er "Posters ophalen...", even wachten |
| Iets anders gaat mis | op de tv `tail -30 /tmp/rawin-launcher-panel.log` en die regels doorsturen |

## Updaten

Updates van de originele Homebar staan in deze versie uit, anders zou een update Discover weer weghalen. Een nieuwe versie installeer je met dezelfde stappen 1 en 2.

## Verwijderen

Op de tv, als root:

```sh
sh /var/lib/webosbrew/rawin-launcher-home/uninstall.sh
```

Dan zijn beide apps weg, en komt het gewone startscherm van LG terug.

## Credits

Homebar is gemaakt door rawin ([webos-homebar](https://github.com/rawinek/webos-homebar), MIT-licentie); Discover Media is van mrmuiz. Zie [`../NOTICE.md`](../NOTICE.md).
