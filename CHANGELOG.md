# Changelog

Release notes per version (in Dutch; the project started as a private build). Newest first.

## Version 1.1.1
- Fix: bij het aanvragen van een seizoen dat nog nooit is aangevraagd kreeg je soms de vaste, liggende clip zonder poster en info, terwijl een seizoen dat al in Sonarr stond wel de nette staande kaart kreeg. Oorzaak: de kaart van zo'n seizoen werd pas op het moment van Afspelen gemaakt (seizoenkaarten werden nooit vooraf gemaakt) en moest dan wachten achter een rij vooraf gemaakte kaarten; duurde het langer dan 30 seconden, dan werd de vaste clip gespeeld. Bovendien werd ook een door Emby afgebroken verzoek als "te lang" gezien.
- De kaarten van alle seizoenen worden nu al op de achtergrond gemaakt zodra de seizoenlijst opent.
- Een kaart die je nu nodig hebt hoeft niet meer te wachten op vooraf gemaakte kaarten (aparte wachtrij voor de achtergrond; hooguit twee ffmpeg's tegelijk, een kaart wordt nooit dubbel gemaakt).
- Het maken van een kaart is ongeveer 4x sneller: ffmpeg maakt eerst één stilstaand beeld en zet dat daarna om naar de clip (de langzame zoom en blur op elk beeldje is vervallen). De wachttijd voor een kaart is 60 seconden.
- Bij het afspelen van een aanvraag worden de status, de extra info en de seizoensposter nu tegelijk opgehaald (eerst na elkaar), en de poster en achtergrond van de kaart worden tegelijk gedownload. Dat scheelt wachttijd bij een koude kaart.
- Na het aanvragen van een serie of seizoen wordt de bewaarde Sonarr-lijst niet meer weggegooid: alleen die ene serie wordt eraan toegevoegd. De eerstvolgende klik hoeft dus niet de hele serielijst opnieuw op te halen. Lukt het bijwerken niet, dan wordt de cache gewist zoals voorheen.
- Technisch: CardVersion 6, dus bewaarde kaarten worden eenmalig opnieuw gemaakt.

## Version 1.1.0
- Eerste stabiele release: de plugin is niet langer een beta (versie 1.1.0, geen `-beta`-achtervoegsel meer).
- Sonarr v4 of v5 voor serie-aanvragen (getest met v4 en v5; oudere versies worden niet ondersteund). De plugin probeert `/api/v5` en valt terug op `/api/v3`.
- Series die per seizoen worden aangevraagd worden nu direct na de aanvraag gemonitord en gezocht in Sonarr: de plugin stuurt alle seizoenen mee (gekozen = gemonitord, rest = niet) met `monitorNewItems: none`, zet daarna precies de gekozen seizoenen en hun afleveringen op gemonitord (rest uit) en start een zoekopdracht (`SeriesSearch`, zoekt alleen de gemonitorde afleveringen).
- De bevestigingsclip toont alleen nog een grote poster met daaronder groot de status (Aangevraagd / Staat al in Radarr of Sonarr) en wat is aangevraagd (Film, Serie · alle seizoenen of Seizoen N), zodat het ook op een tv of telefoon leesbaar is. Bij een seizoen staat de poster van dat seizoen erop. Titel, beschrijving, cast, regie en genres zijn weggelaten.
- De aanvraag- en trailertegel (en bij series de seizoenmap) hebben nu de tekst "Aanvragen" resp. "Trailer" op de afbeelding, zodat je ze direct uit elkaar houdt. Lukt het maken van de afbeelding niet, dan blijft de gewone achtergrond staan.
- Seizoenitems die al in Sonarr staan zeggen dat nu in de beschrijving: "al aangevraagd" (⏳), "gedeeltelijk beschikbaar" of "staat al in je bibliotheek" (✓, ook achter de seizoensnaam als alle afleveringen er zijn). Opnieuw aanvragen kan nog steeds.
- De diagnoseregel op de Discover-pagina en de lijst "Recente activiteit van het kanaal" op de statuspagina volgen nu volledig de pluginstaal (Nederlands, Engels of Duits); een deel stond nog vast in het Nederlands en "totaal=" werd ten onrechte "tolanguage=".
- Technisch: seizoenitems en de seizoenmap hebben nieuwe id's (`ask22season`, `ask22seasons`) en de kanaal-DataVersion is 70, zodat Emby geen oude seizoenplaatjes meer hergebruikt. De scripts van de Discover- en statuspagina hebben nieuwe resourcenamen (`discoveruijs1100`, `discoverstatusjs1100`), zodat de browser geen oude scripts uit de cache gebruikt.

## Version 1.0.40.0-beta
- Trailer-afspelen speelt nooit meer de "Aangevraagd"-bevestigingsclip af. Is er geen trailer of lukt het ophalen niet, dan meldt Emby een eerlijke fout en wordt er niets aangevraagd of gecachet.
- Trailer zoeken is robuuster: ook Engelse en taalloze TMDB-video's, bij series ook de video's van seizoen 1, met een nieuwe poging bij een tijdelijke TMDB-fout. Fouten staan in de diagnose.
- Series die per seizoen worden aangevraagd worden nu echt gemonitord in Sonarr: de plugin stuurt niet langer `monitor: none` mee (dat zette alle seizoenen weer uit).
- Heeft de seizoenslijst van een serie geen poster voor een seizoen, dan vraagt de plugin het seizoen (en zijn afbeeldingen) rechtstreeks bij TMDB op. Is er echt geen poster, dan wordt de staande serieposter getoond in plaats van de liggende achtergrond.
- Het driepuntjesmenu (en de hover-knoppen) verdwijnt van de aanvraag-/trailertegels in de kanaallijst.

## Version 1.0.38.0-beta
- Bevestigingsclip heeft nu een staand posterformaat; tekst, poster, status en overige informatie blijven behouden.
- Seizoensdetailpagina toont onder de poster een donkerblauwe serie-informatiekaart met beschikbare TMDB-gegevens.
- Studio- en netwerklogo's zijn wit in plaats van paars; versiegebonden afbeeldingscache en kanaalcache vernieuwd.
- Aanvraag-/trailertegels krijgen direct hun vaste verhouding zonder handmatig verversen. Ontbrekende hoofdcategorie- en genreafbeeldingen krijgen een kleurfallback.

## Version 1.0.37.111-beta
- Forceer een vaste 16:9-verhouding voor herkende aanvraag-/trailertegels en 2:3 voor seizoenposters, zodat de verhouding ook klopt bij navigeren zonder volledige browserverversing.

## Version 1.0.37.110-beta
- Ontbrekende seizoenbeschrijvingen worden waar mogelijk aangevuld vanuit TMDB in het Engels, zonder bestaande vertaalde beschrijvingen te overschrijven.
- Hoofdcategorieën krijgen een effen kleurtegel als TMDB geen achtergrond heeft; achtergrondtegels worden opnieuw opgehaald als ze eerder leeg zijn gecachet.
- DataVersion 66 ververst eenmalig de gecachete kanaalitems zodat de bijgewerkte tegelafbeeldingen zichtbaar worden.

## Version 1.0.37.109-beta
- De statuscontrole herkent het kanaal ook onder de bestaande Emby-naam "Films & Series Aanvragen" en gebruikt die herkenning ook voor de gebruikertoegang.

## Version 1.0.37.108-beta
- Genrenamen op tegels en in de Discover-pagina volgen nu de ingestelde plugin-taal (Nederlands, Engels of Duits), ook als TMDB de genrelabels in een andere taal terugstuurt.
- De genretegels worden bij het openen vernieuwd, zodat vertaalde namen en afbeeldingen niet op oude cache-inhoud blijven hangen.

## Version 1.0.37.107-beta
- De Sonarr-zandloper staat na de seizoentitel, zodat het sorteren op titel met "Seizoen N" begint en seizoen 14 niet voor seizoen 1 komt.
- De webclient behoudt de zandloper vóór het zichtbare seizoennummer.

## Version 1.0.37.106-beta
- Seizoentegels heten nu kort "Seizoen N" en worden in de webclient op seizoenummer gesorteerd, ongeacht de statusicoontjes.
- De seizoenselectormap heeft een nieuwe cache-ID; overige kanaallijsten worden niet onnodig ververst.

## Version 1.0.37.105-beta
- Seizoentegels worden herkend aan "Aanvragen Seizoen N", zodat de afspeelknop en het driepuntjesmenu echt verdwijnen.
- Een vinkje verschijnt zodra Emby minstens één aflevering van het seizoen bevat; een zandloper verschijnt als Sonarr het seizoen volgt of er al afleveringen van heeft geïmporteerd.

## Version 1.0.37.104-beta
- Afspeelknop en driepuntjesmenu verdwijnen van de seizoensaanvraagposters; de poster blijft aanklikbaar om de seizoenpagina te openen.

## Version 1.0.37.103-beta
- Seizoenpagina's verbergen metadata-kopjes ook wanneer Emby de tekst in geneste elementen plaatst; de seizoensbeschrijving blijft behouden.

## Version 1.0.37.102-beta
- Seizoenaanvraagpagina's herkennen de seizoenitems ook zonder kanaalmetadata: de knop toont "Aanvragen".
- Seizoensbeschrijvingen worden volledig getoond; "Over", "Links" en "Media informatie" worden op die pagina verborgen.
- De gele diagnose-overlay toont een startmelding wanneer diagnose is ingeschakeld.

## Version 1.0.37.101-beta
- De webclient forceert nu ook beschrijvingsblokken met hoofdlettergevoelige Emby-klassen open en verbergt de knop "Meer" zonder die te openen.

## Version 1.0.37.100-beta
- Seizoensbeschrijvingen blijven zichtbaar: de algemene aanvraagpagina-verwerking verborg eerder het volledige blok "Over" op seizoenitems.
- De webclient toont op seizoenaanvraagpagina's de volledige tekst en verbergt alleen de knop "Meer".

## Version 1.0.37.99-beta
- Seizoenaanvraagpagina's in de Emby-webclient herkennen nu de titel "Aanvragen Seizoen N", zodat de volledige beschrijving standaard zichtbaar is zonder op "Meer" te klikken.

## Version 1.0.37.98-beta
- Seizoenaanvragen gebruiken de staande TMDB-seizoensposter rechtstreeks, zonder extra tekst over de afbeelding heen.
- Bijgewerkt naar de nieuwste gepubliceerde Emby-SDK-package: `MediaBrowser.Server.Core` 4.11.0.5-beta6.

## Version 1.0.37.97-beta
- TMDB-serielijsten tonen alleen series waarvan het land van oorsprong Nederland of de Verenigde Staten is; toegepast op de aanvraaglijst, genres/netwerken en Discover-overzichten.

## Version 1.0.37.96-beta
- Seizoenitems gebruiken weer de rechtstreekse TMDB-poster-URL; lokale gerenderde bestandspaden werden door Emby niet als afbeelding getoond op media-items.
- Seizoenitem-ID's vernieuwd zodat Emby de oude lege postergegevens niet hergebruikt.

## Version 1.0.37.95-beta
- Seizoenposters worden volledig en zonder uitsnijden in de liggende Emby-tegel geplaatst, met een onscherpe vulling aan de zijkanten; `Seizoen N` blijft als tekst zichtbaar.
- Als de poster of ffmpeg niet beschikbaar is, valt de tegel terug op de oorspronkelijke seizoensposter.

## Version 1.0.37.94-beta
- Ververst de ID van alleen de aanvraagmappen voor series, zodat Emby de nieuwe directe seizoenaanvraagitems ophaalt uit zijn cache; film- en rootlijst-ID's en DataVersion blijven gelijk.

## Version 1.0.37.93-beta
- Seizoenstegels zijn directe aanvraagitems met de naam **Aanvragen Seizoen N** en `Seizoen N` op de afbeelding; de extra aanvraagtegel blijft weg.
- Nieuwe seizoens-ID's verversen alleen deze seizoenitems. De algemene kanaal-ID's en DataVersion blijven ongewijzigd.

## Version 1.0.37.92-beta
- Seizoentegels zijn nu direct aanvraagitems (`Aanvragen seizoen N`); de extra aanvraagtegel/map is verwijderd.
- Tegelafbeeldingen tonen `Seizoen N` over TMDB-seizoensartwork; detailuitleg bevat het aantal afleveringen en TMDB-seizoensbeschrijving waar beschikbaar.
- Alleen de seizoensroute-ID's zijn vernieuwd; overige kanaal-ID's en DataVersion blijven ongewijzigd.

## Version 1.0.37.91-beta
- De seriecategorieën staan nu vóór de filmcategorieën in de kanaalroot, zodat Emby ze eerst ophaalt bij een kanaalverversing.
- Bestaande kanaal-ID's en DataVersion blijven ongewijzigd om onnodige cache-invalidatie te vermijden.

## Version 1.0.37.90-beta
- Correcte opvolgende versietag voor de directe seizoenindeling: **Aanvragen: <serie>** toont direct seizoenmappen; **Trailer: <serie>** blijft staan. Elke seizoenmap bevat één aanvraagitem voor dat seizoen.
- Nieuwe browser-scriptversie; seizoenmappen tonen in deze build de serieachtergrond zonder tekst-overlay.

## Version 1.0.37.88-beta
- De map **Aanvragen: <serie>** opent direct de seizoenmappen; er is geen tussenmap **Per seizoen** of aanvraagitem voor de hele serie. Seizoentegels gebruiken de serieachtergrond zonder tekst-overlay; elke map bevat één aanvraagitem voor alleen dat seizoen.
- Kanaal-ID's zijn `ask16...` en DataVersion is 65 om eerder bewaarde kanaalitems te verversen.

## Version 1.0.37.87-beta
- Per-serieaanvraagmap blijft de enige aanvraagmap naast Trailer; daarbinnen staan directe mappen `Seizoen 1`, `Seizoen 2`, enzovoort. Seizoentegels gebruiken dezelfde achtergrond als de serie met `Seizoen N` als tekstoverlay; bestaande FolderTile-cache en fallback blijven van toepassing. Elke seizoenmap bevat één `Aanvragen`-item voor dat seizoen.
- Nieuwe `ask14`-ID's en DataVersion 63 zorgen voor verse kanaalitems na de structuur- en afbeeldingwijziging.

## Version 1.0.37.86-beta
- Seizoentegels heten kort **Seizoen 1**, **Seizoen 2**, enzovoort; geen serie- of afleveringsnamen op de tegels.
- Nieuwe `ask13`-ID's en DataVersion 62 zorgen dat de gewijzigde tegelbenamingen niet onder de eerder gebruikte cache-identiteit blijven staan.

## Version 1.0.37.85-beta
- In de serie-aanvraagmap is de aparte volledige-serie-aanvraagtegel vervangen door de map **Aanvragen: <titel>**. Deze bevat rechtstreeks één genummerde map per regulier seizoen (`1`, `2`, `3`, ...); elke map bevat precies één item **Aanvragen** voor dat seizoen.
- Nieuwe `ask12`-map- en seizoens-ID's plus DataVersion 61 voorkomen dat Emby de eerder gecachte reeks-/afleveringsinhoud onder dezelfde mapidentiteit blijft tonen.

## Version 1.0.37.84-beta
- De seizoenskeuze in de webclient selecteert standaard geen seizoenen; je moet expliciet minimaal één seizoen aanvinken voordat er een aanvraag wordt verzonden.

## Version 1.0.37.83-beta
- In de browser wordt, wanneer beide kanaalitems met dezelfde titel en bovenliggende map zijn bevestigd, de losse **Aanvragen**-tegel verborgen en de **Trailer**-tegel hernoemd naar **Aanvragen**. Op de detailpagina heet Afspelen **Trailer**; de bestaande gele knop biedt de seizoenskeuze.
- Dit verandert geen kanaalitems of native apps: daar blijven Trailer, volledige Aanvragen en de map Per seizoen beschikbaar. De Trailer wordt afgespeeld via de Emby-speler, niet als iframe.

## Version 1.0.37.82-beta
- In de serie-aanvraagmap staat nu **Per seizoen**. Daarin staat één map per seizoen, met daarin één afspeelbaar item dat alleen dat seizoen aanvraagt.
- De bestaande items **Trailer** en **Aanvragen** (alle seizoenen) blijven ongewijzigd. Kanaalmappen hebben nieuwe ID's gekregen om oude bewaarde inhoud niet te hergebruiken.

## Version 1.0.37.80-beta
- Bij de bevestigingsclip worden TMDB-extra-info en Radarr/Sonarr-status nu tegelijk opgehaald; de wachttijd is niet meer de optelsom van beide onafhankelijke verzoeken.
- De clip blijft liggend voor alle clients: Emby's media-info-callback geeft geen client- of apparaatgegevens door om veilig alleen mobiele browsers een staande versie te tonen.

## Snelheid (zonder zichtbare wijzigingen)
- TMDB-pagina's worden gedeeld tussen kanaal en Discover-pagina, gelijktijdige aanvragen wachten op dezelfde download, en een verlopen pagina wordt direct getoond terwijl hij op de achtergrond ververst wordt (15 min vers, daarna tot 6 uur direct tonen).
- Lijst en Radarr/Sonarr-status worden tegelijk opgehaald; de status wordt 5 minuten bewaard (direct vernieuwd na een aanvraag) en wordt bij gelijktijdige aanvragen maar één keer opgehaald.
- Mapplaatjes en logo's: een bestaand plaatje wordt direct getoond terwijl het nieuwe op de achtergrond gemaakt wordt; downloads gebeuren buiten de ffmpeg-wachtrij.
- gzip aan voor TMDB, Radarr en Sonarr; 12 gelijktijdige TMDB-calls i.p.v. 8.

## Version 1.0 beta
- **Studio- en netwerklogo's**: elk logo staat nu volledig (niets afgesneden) midden in een liggende tegel, in één kleur: paars, of zwart voor logo's die als kaal paars vlak zouden eindigen (ABC, AMC, 20th Century, Cartoon Network, Paramount, Marvel, DreamWorks). Zonder ffmpeg valt het terug op het logo zoals het was.
- **Mappen** van het Discover-kanaal: geen ▶, vinkje, puntjes of selectiecirkel meer op de tegels, en geen Afspelen/Willekeurig bovenaan een map. Een map afspelen startte alle titels erin en deed daardoor aanvragen.
- **Popup bij Aanvragen** is weg: de plugin klikte zelf op "Meer" bij de beschrijving, waardoor Emby een venster opende. De knop wordt nu alleen verborgen en de beschrijving volledig getoond.
- Tekst op het aanvraagitem: "DRUK OP DE ▶ KNOP OM AAN TE VRAGEN."; bij trailers: "Druk op de ▶ knop om de trailer te bekijken." Kanaal-DataVersion 39. Alle id-voorvoegsels zijn `ask9...` (was `ask7...`): Emby bewaart kanaalitems per id en vernieuwde namen en plaatjes niet (je zag nog "Aankomende films" en posters op de mappen). Met nieuwe id's maakt Emby alle mappen en titels opnieuw aan.
- **Instellingen**: de regels "Eerste root folder" en "Eerste profiel" zijn weg; alleen de echte mappen en profielen staan in de lijst. API keys zijn verborgen (wachtwoordveld) met een oogje om ze te tonen.
- **Hoofdtegels**: elk een eigen kleur (Trending films oranje, series geel, Populair rood en roze, Verwacht paars en blauw, Filmgenres groen, Seriegenres turkoois, Studio's grijs). Het tekstplaatje probeert eerst de volledige opmaak en daarna een eenvoudiger ffmpeg-opdracht; de statuspagina toont per tegel "gemaakt" of de reden van mislukken.
- Nieuw plugin-logo en versie 1.0.0.0 (beta).


## Version 0.8
- Discover-pagina: 3 TMDB-pagina's (60 items) per rij i.p.v. 1, ontdubbeld; items zonder poster of volwassen-titels vallen weg.
- Ontbrekende beschrijving/poster/titel in de ingestelde taal wordt aangevuld uit en-US.
- Zoeken per type (film/serie), 2 pagina's, exacte titel eerst.
- Sonarr: bij aanvragen wordt ook op tvdbId gecontroleerd (geen dubbele serie); series zonder tmdbId in Sonarr worden gelogd.
- Max. 8 gelijktijdige TMDB-calls en een retry bij 429.

## Version 0.8.1
- "Binnenkort in de bioscoop" gebruikt nu /discover/movie op populariteit (zoals Seerr), i.p.v. /movie/upcoming met regio (maar ~30 titels, veel concertfilms en heruitgaven).
- Titels in niet-Latijns schrift (Koreaans, Japans, ...) worden vervangen door de Engelse titel als die er is.
- Kanaal: totaal per lijst max. 200 (Emby sorteert op naam en haalt dan alles op).

## Version 0.9
- De Discover-pagina staat nu in het Emby-menu (linkermenu, "Discover"), ook voor gewone gebruikers (EnableInUserMenu). De URL `/web/index.html#!/configurationpage?name=discoverui` blijft werken.
- Rijen laden door: pijltjes links/rechts en automatisch de volgende TMDB-pagina bij scrollen (nieuwe route /Discover/List).
- Nieuwe rij "Binnenkort series".

## Version 0.9.1
- Kanaal-DataVersion 6 -> 7, zodat Emby de oude bewaarde (korte) lijsten van eerdere versies weggooit. Verhoog dit getal bij elke wijziging aan wat het kanaal teruggeeft.

## Version 0.10 (kanaal naar voorbeeld van het Emby Trailers-kanaal)
- Het kanaal pagineert niet meer naar Emby (StartIndex/Limit genegeerd): de hele lijst (tot 200 titels per lijst) gaat in een keer terug, met TotalRecordCount = aantal. Eerder viel het zonder Limit terug op 40.
- Het kanaal houdt zich aan de sortering die Emby vraagt (Naam, Premièredatum, Beoordeling, Datum toegevoegd). "Datum toegevoegd" geeft de TMDB-volgorde (populairste eerst). Naam sorteert op de titel zonder status-icoon.
- Lijsten worden 30 minuten in het geheugen bewaard (anders 20 TMDB-calls per keer).
- Extra map "Binnenkort series". DataVersion 8.

## Version 0.11 (titels zijn items, knop "Aanvragen")
- Titels in de lijsten zijn nu zelf items (zoals bij het Trailers-kanaal), geen map met een "Aanvragen"-item erin. Met genres uit TMDB.
- De knop **Aanvragen** op de detailpagina komt van een klein script (`discover-request-button.js`). Emby heeft geen officiele
  manier om een plugin een knop op die pagina te laten zetten; daarom zet de plugin bij het opstarten (`ScriptInstaller`) dat script
  naast `index.html` van de webclient en voegt een `<script>`-regel toe aan `index.html` (back-up: `index.html.discover-backup`).
- Dit werkt alleen in de **webbrowser** (en de desktop-app als die de serverwebclient laadt), niet in de native apps.
- Na de eerste keer opstarten: ververs de browser met Ctrl+F5. De statuspagina toont of het installeren gelukt is.
- Een Emby-update overschrijft `index.html`; herstart Emby dan een keer, dan zet de plugin de regel terug.
- Lukt het schrijven niet (Docker/rechten): zet `discover-request-button.js` (uit `Resources/`) zelf in de map `system/web (Emby 4.11+) of system/dashboard-ui (ouder)`
  en voeg voor `</body>` in `index.html` toe: `<script src="discover-request-button.js"></script>`. Staat de map ergens anders,
  zet dan `DashboardUiPath` in `Emby.Plugins.Discover.xml`.
- Nieuwe route `/Discover/Resolve` (het script zoekt hiermee het TMDB-id en de status bij het geopende item).
- DataVersion 9. Mogelijke compilefout: `ChannelItemInfo.Genres` (meld het, dan pas ik het aan).

## Version 0.12 (knop "Aanvragen" ook op het Trailers-kanaal)
- Het knop-script zet de knop **Aanvragen** nu ook op de detailpagina van items uit het **Trailers-kanaal** (Afspelen blijft de trailer spelen).
  De knop zoekt de film op in TMDB (via het TMDB-id uit de metadata als Emby dat heeft, anders op titel + jaar, ook de originele titel)
  en stuurt hem naar Radarr. Is er geen zekere match, dan staat er een uitgeschakelde knop "Niet gevonden" (er wordt nooit op goed geluk aangevraagd).
- Werkt in de webclient (browser). In de native apps komt deze knop niet; daar zit alleen wat Emby zelf toont.
- `/Discover/Resolve` accepteert nu ook `TmdbId`.

## Version 0.12.2
- Geen "Media informatie" (pad van de clip) meer op de detailpagina (`IDisableMediaSourceDisplay`, zoals het Trailers-kanaal). DataVersion 11.

## Version 0.13 (Afspelen = trailer, Aanvragen = aparte knop)
- **Afspelen** speelt nu de YouTube-trailer van TMDB (officiële trailer in de ingestelde taal, anders Engelse, anders teaser). Niet meer de aanvraag.
- **Aanvragen** blijft de aparte knop naast Afspelen (webclient). De Afspelen-knop wordt niet meer aangepast.
- Bij **series**: seizoenskeuze zoals in Seerr (modal met checkboxes) voordat de aanvraag naar Sonarr gaat. Leeg = alle seizoenen.
- Bevestigingsclip (`request-ok.mp4`) vernieuwd: donkere Emby-stijl met groen OK-badge en tekst "Aangevraagd".
- Items krijgen ProviderIds.Tmdb en ContentType Trailer. DataVersion 12.
- Fallback: als er geen YouTube-trailer is, speelt Afspelen de korte clip i.p.v. een fout.

## Version 0.13.4 (knop werkt ook zonder eigen thema-CSS)
- De knop **Aanvragen** gebruikt nu inline `!important`-stijlen en is niet meer afhankelijk van thema-CSS.
- Het script zoekt eerst het item (Resolve) en zoekt daarna de knoppenbalk. Vindt hij die niet (ander thema/layout), dan komt er een zwevende knop rechtsonder.
- De installer zet het script in **alle** gevonden webclient-mappen (`web` én `dashboard-ui`), niet alleen de eerste.
- Debug: open de browserconsole (F12) en zoek op `[Discover]`.

## Version 0.14
- Discover-pagina: kop "Discover" valt niet meer over de zoekbalk (extra ruimte bovenaan).
- Detailvenster: bij een aangevraagde titel staat nu **Aanvraag annuleren**, bij een beschikbare titel **Verwijderen** (zoals in Seerr).
  Dit verwijdert de titel uit Radarr/Sonarr (bij "Beschikbaar" ook de bestanden, na een bevestiging). Alleen voor Emby-beheerders (route `/Discover/RemoveItem`).

## Version 0.14.1
- Een klik op een kaart op de Discover-pagina opent nu de echte Emby-detailpagina (met Afspelen = trailer en Aanvragen). Alleen als het item niet in het kanaal staat (bijv. zoekresultaat) komt de popup.
- Op die detailpagina is het drie-puntjes-menu verborgen en staat naast Aanvragen voor beheerders een knop **Annuleren** (aangevraagd) of **Verwijderen** (beschikbaar, incl. bestanden na bevestiging).

## Version 0.14.2
- De installer controleert elke 90 seconden of de script-regel nog in `index.html` staat en zet hem terug als een andere plugin of update hem heeft weggegooid. Op de statuspagina staat dan "HERSTELD". Ververs daarna de browser met Ctrl+F5.

## Version 0.14.3
- Het knop-script wordt ook geladen zodra je de Discover-pagina opent (pluginpagina `discoverbuttonjs`), onafhankelijk van `index.html`. Open dus eerst Discover en klik dan op een titel; zonder volledige paginaverversing blijft de knop werken.

## Version 0.14.4
- Onderaan de Discover-pagina staat een kleine diagnoseregel: of het knop-script actief is, hoe het geladen is en wat de server over `index.html` meldt.

## Version 0.14.6
- Discover-pagina scrolt weer omhoog/omlaag (eigen scrollgebied).
- Tijdelijke diagnoseregel (geel, linksonder) op detailpagina's: toont of het item herkend wordt, wat Resolve teruggeeft en of de knoppenbalk is gevonden.

## Version 0.14.7
- Herkenning van Discover-items op de detailpagina: het item wordt nu opgevraagd met `Fields=ChannelInfo,Path,...`, want Emby geeft ChannelId/Path anders niet mee. Daarnaast herkent het script items aan een YouTube-pad of de clip `discover-request-ok.mp4`.

## Version 0.14.8
- Herkenning ook via de pagina zelf: toont "Media informatie" een YouTube-link of `discover-request-ok.mp4`, dan is het een Discover-item (Emby geeft dat pad in sommige versies niet via de API). Mislukte herkenning wordt een paar keer opnieuw geprobeerd tot de pagina is opgebouwd.

## Version 0.14.9
- Het blok "Media informatie" wordt op Discover-detailpagina's verborgen (ook in Emby-versies waar de klasse anders heet) en de gele diagnoseregel verdwijnt zodra de knop staat.

## Version 0.15.0 (Seerr-achtige detailpagina)
- Op de Emby-detailpagina van een Discover-titel staat bovenaan een grote TMDB-achtergrondafbeelding die naar onderen vervaagt (`Resolve` geeft nu `Backdrop` terug), met ronde posterhoeken, ronde knoppen en de knop Aanvragen in amber zoals in de Discover-pagina.

## Version 0.16 (Discover-pagina zoals Seerr)
- Rijen in Seerr-volgorde: Onlangs toegevoegd, Recente aanvragen (uit Radarr/Sonarr, nieuwste eerst), Trending (films en series gemengd), Populaire films, Filmgenres, Verwachte films, Studio's, Populaire series, Seriegenres, Verwachte series, Netwerken.
- Genre-, studio- en netwerktegels: een klik opent een raster met alle titels (populairste eerst) en een knop Meer laden, met Terug-knop (route `/Discover/Browse`).
- Studio- en netwerklogo's komen uit TMDB (wit weergegeven) en worden in het geheugen bewaard. Mislukt een rij, dan blijven de andere werken.

## Version 0.16.1 (aanvragen vanuit de Android/TV-app)
- Nieuwe map **Aanvragen (voor apps en TV)** in het kanaal Discover, met dezelfde zes lijsten. Daar vraagt **Afspelen** de titel aan bij Radarr/Sonarr (series: alle seizoenen) en speelt de korte bevestigingsclip. Het ✓ / ⏳ voor de titel toont de status. Mislukt de aanvraag, dan krijg je een foutmelding en staat de oorzaak op de statuspagina.
- De gewone mappen (Afspelen = trailer, knop Aanvragen in de webbrowser) blijven zoals ze waren. DataVersion 16.

## Version 0.16.2
- In de map Aanvragen is elke titel nu een map met één item **Aanvragen** erin (Afspelen = aanvragen). De losse titels openden in de TV-app en webclient als fotoviewer en waren niet af te spelen. DataVersion 17.

## Version 0.16.3
- Het item in de aanvraagmap heet nu "Aanvragen: <titel>" en toont de poster, zodat je op de TV ziet waarvoor je op Afspelen drukt. DataVersion 18.

## Version 0.17.0
- Nieuwe bevestigingsclip (donker, groen vinkje dat getekend wordt, "Aangevraagd" met uitleg, 3,3 s). De plugin vervangt de oude clip in `/config/data` zelf als de grootte verschilt.
- Detailpagina van het aanvraagitem (TV en browser): titel, poster, jaar, beoordeling en de beschrijving van de film/serie, plus een regel of de titel al is aangevraagd (⏳) of beschikbaar (✓). DataVersion 19.
- Let op: de tekst op de knop ("Afspelen") komt van de Emby-app en kan een plugin niet wijzigen.

## Version 0.18.0 (leesbare bevestiging per titel)
- Na **Afspelen** in de map "Aanvragen (voor apps en TV)" speelt nu een clip van 12 seconden die **per titel** wordt gemaakt: poster, titel, jaar, beoordeling,
  beschrijving en een groen label "Aangevraagd" (of "Staat al in Radarr/Sonarr"), met de TMDB-achtergrond vaag erachter. Pauzeren kan, dus je kunt hem rustig lezen.
- De clip wordt met ffmpeg op de server gemaakt (ongeveer 2 à 3 seconden de eerste keer) en bewaard in `<data>/discover-cards`; daarna is hij direct klaar.
  Het lettertype (Poppins, SIL Open Font License 1.1) zit in de DLL, er is geen systeemlettertype nodig.
- ffmpeg wordt gezocht naast Emby, in `/opt/emby-server/bin`, `/usr/bin`, `/bin`, `/usr/local/bin` en in PATH. Staat hij ergens anders, zet dan
  `FfmpegPath` in `Emby.Plugins.Discover.xml`.
- Lukt het maken niet (geen ffmpeg, geen schrijfrechten), dan speelt de vaste clip zoals voorheen en staat de oorzaak onder "FOUT kaartclip" op de statuspagina. De aanvraag zelf is dan wel gedaan.
- De vaste clip en de variant zonder afbeeldingen zijn niet meer zwart.
- Niet gewijzigd: de zwarte achtergrond boven op de detailpagina in de TV-app. Het kanaal kan alleen een posterafbeelding per item meegeven.
- Niet getest op een echte Emby-server en niet gecompileerd; de ffmpeg-opdracht en de opmaak zijn wel getest met dezelfde lettertypes en parameters.

## Version 0.18.1 (aanvraagitem toont poster en info)
- Het item "Aanvragen: <titel>" kreeg soms geen poster en geen info (alleen "Aanvragen"): bij een mislukte TMDB-call werd een leeg item teruggegeven, en Emby bewaarde dat. Nu komen de gegevens eerst uit de al geladen lijst (geen extra call), daarna uit TMDB; lukt beide niet, dan krijg je een fout in plaats van een leeg item, zodat Emby niets verkeerds bewaart.
- Bovenaan de beschrijving staat nu de film-info (Film/Serie, jaar, beoordeling, genres), daarna de aanvraagregel en de inhoud. Item heeft ook genres en TMDB-id. DataVersion 21.
- Niet te wijzigen vanuit de plugin: de tekst op de knop ("Afspelen") en de achtergrond van de TV-app; die komen van de Emby-app.

## Version 0.19.0 (nieuw ontwerp aanvraagpagina en bevestigingskaart)
- **Verse id's:** de aanvraagitems heten nu `ask:`/`askitem:`/`asklist:`/`askroot` (waren `req...`). Emby bewaarde oude items met dezelfde id (met de oude tekst en zonder poster) en ververste ze niet; met nieuwe id's maakt Emby ze opnieuw aan. DataVersion 22.
- **Aanvraagpagina:** het item krijgt de liggende TMDB-achtergrond als afbeelding (een staande poster werd in het 16:9-vlak afgesneden), en bovenaan de beschrijving staat Film/Serie, jaar, beoordeling en genres.
- **Bevestigingskaart (12 s, ffmpeg):** achtergrond met rustige zoom, afgeronde poster met schaduw, groene statuspil met vinkje, titel, beoordeling met ster, jaar, soort, speelduur of aantal seizoenen, genres, beschrijving, regie/maker en cast. Zonder beschrijving wordt de tagline gebruikt en blijven regie en cast staan. Tekst wordt op echte lettertypebreedte afgebroken.
- Nieuw bij TMDB: `append_to_response=credits` (een extra call per aanvraag; mislukt die, dan blijft de kaart zonder genres/cast werken). CardVersion 2: oude kaarten worden niet hergebruikt.
- Niet te wijzigen vanuit de plugin: de knoptekst "Afspelen" en de achtergrond van de TV-app.

## Version 0.19.1
- Aanvraagitem: jaar, beoordeling en genres stonden dubbel (de app toont ze zelf al). De beschrijving bevat nu alleen de aanvraagstatus en de inhoud van de titel. Geen ⏳/✓ meer in de naam (de status staat in de beschrijving). Id's `ask3...` en DataVersion 23, zodat Emby de items opnieuw aanmaakt.
- Webclient (knop-script 0.19.1): op de aanvraagpagina heet **Afspelen** nu **Aanvragen** (groen), en de knoppen afgevinkt/favoriet/meer en het kopje "Over" zijn verborgen. Ververs de browser met Ctrl+F5.
- TV-app: de knoptekst "Afspelen", de drie ronde knoppen, "Over" en de lege achtergrond komen uit de Emby-app en zijn niet te wijzigen via het kanaal.

## Version 0.19.2 (trailer + aanvragen op de TV)
- In "Aanvragen (voor apps en TV)" staan per titel nu twee items: **Trailer: <titel>** (Afspelen = YouTube-trailer, zoals in de gewone lijsten) en **Aanvragen: <titel>** (Afspelen = aanvragen, daarna de bevestigingskaart). DataVersion 24.
- Fout uit 0.19.1 hersteld: de nieuwe id-voorvoegsels (`ask3...`) waren langer dan de lengte waarmee ze werden afgeknipt, waardoor mappen en Afspelen faalden. De voorvoegsels staan nu als constanten en de lengte komt uit de constante.

## Version 0.19.3
- Het kanaal toont nog maar **één** map, **Discover** (met een TMDB-afbeelding van de populairste film van dit moment). De losse lijsten (Trending/Populaire/Binnenkort) staan daarin, elk met per titel Trailer + Aanvragen. De oude zes mappen op het hoofdniveau zijn weg. "Binnenkort in de bioscoop" heet nu "Binnenkort films" (paste niet op de tegel).
- Het trailer-item heeft nu hetzelfde itemtype als het aanvraagitem (Clip), omdat het eerdere type (Trailer) in de webclient de fotoviewer opende i.p.v. de detailpagina. Afspelen speelt nog steeds de YouTube-trailer.
- Nieuwe id-voorvoegsels `ask4...`, DataVersion 25 (Emby ververst bewaarde items met dezelfde id niet).

## Version 0.19.4
- De tussenmap "Discover" is weg: het kanaal toont direct de zes lijsten (Trending films, Populaire films, Binnenkort films, Trending series, Populaire series, Binnenkort series). Elke titel daarin heeft Trailer + Aanvragen. DataVersion 26.

## Version 0.19.5
- Namen: "Aankomende films" en "Aankomende series" (kanaal en Discover-pagina; was Binnenkort/Verwachte).
- Aanvraagitem: de beschrijving begint nu met **DRUK OP AFSPELEN (▶) OM AAN TE VRAGEN.** (of de status als de titel al aangevraagd/beschikbaar is). Id-voorvoegsels `ask5...`, DataVersion 27.
- Webclient (script 0.19.5): op de aanvraag- en trailerpagina verdwijnt het hele blok "Over" (genres, links, media-informatie, video/geluid). Aanvraagpagina: Afspelen heet Aanvragen. Trailerpagina: Afspelen = trailer + knop Aanvragen.
- TV-app: de knoptekst "Afspelen" is niet te wijzigen vanuit een kanaal.

## Version 0.20.0 (meer Seerr-tekst)
- Nieuw `InfoText.cs`: Nederlandse infoteksten uit TMDB (`append_to_response=credits`, 6 uur in het geheugen bewaard).
- **Aanvraag- en trailerItem** (kanaal): onder de aanvraagregel staan nu tagline, releasedatum ("Verschijnt op 14 november 2026" / "Eerste aflevering op ..."), status (Lopend, Beëindigd, Geannuleerd, In productie, ...), seizoenen/afleveringen of speelduur, volgende aflevering (SxxExx + datum), genres, netwerk (series) of studio (films), bedenker of regie.
- **Lijsten** (alle zes): de beschrijving begint met de releasedatum (uit de lijstdata, geen extra call), vooral handig bij Aankomende films/series.
- **Gedeeltelijk beschikbaar** bij series die in Sonarr staan met minder bestanden dan uitgezonden afleveringen.
- **Popup op de Discover-pagina**: toont dezelfde info (plus TMDB-percentage met aantal stemmen) via nieuwe route `/Discover/Info`.
- Id-voorvoegsels `ask6...`, DataVersion 28 (Emby ververst bewaarde items met dezelfde id niet).
- Niet gecompileerd (geen dotnet hier); meld compilefouten, dan pas ik ze aan.

## Version 0.20.1
- Webclient-script: op de aanvraag- en trailerpagina verdwijnen nu **alle** knoppen naast Afspelen/Aanvragen (afgevinkt, favoriet, drie puntjes) en de blokken **Links** en **Media informatie** (pad van de clip). Dit werkt nu op de knoppenbalk en de kopjes zelf, dus niet meer afhankelijk van de paginaklasse `.itemDetailPage` (die bleek in jouw Emby-versie niet te kloppen).
- De beschrijving behoudt regeleinden (de infoblokken stonden eerder op een regel achter elkaar).
- Ververs de browser met Ctrl+F5; de plugin zet het nieuwe script zelf in de webmap bij het opstarten van Emby.

## Version 0.25.0
- **Hoofdmappen met tekst:** elk van de negen plaatjes heeft nu de Engelse naam in wit erop (Trending Movies, Trending Series, Popular Movies, Popular Series, Upcoming Movies, Upcoming Series, Movie Genres, Series Genres, Studios). De kleuren blijven zoals ze waren. De naam onder de tegel blijft Nederlands (door Emby getoond). Het plaatje wordt door de plugin zelf gemaakt met ffmpeg (nieuw `FolderTile.cs`, lettertype Poppins uit de DLL), bewaard in de map `discover-tiles` naast de bevestigingskaarten en doorgegeven als bestandspad. Lukt het niet (geen ffmpeg, geen schrijfrechten, TMDB niet bereikbaar), dan komt de map met de achtergrond zonder tekst, en de reden staat op de statuspagina. Zet `TileTextImages` op `false` in `Emby.Plugins.Discover.xml` om de tekst uit te zetten.
- **Studio-logo's in een kleur:** alle logo's zijn nu hetzelfde paars (was wit en paars door elkaar). Logo's met een vlak en letters erin (20th Century Studios, Paramount, Marvel Studios, DreamWorks, ABC, AMC, Cartoon Network) krijgen donkere letters, anders werd het een kaal paars vlak. Staat er nog een logo als kaal vlak tussen, meld het dan: het staat in `TwoToneStudios` / `TwoToneNetworks` in `DiscoverMediaChannel.cs`.
- Kanaal-DataVersion 36. Versie 0.23.1: tekst op het aanvraagitem is "DRUK OP DE (▶) KNOP OM AAN TE VRAGEN." en de waarschuwing CS4014 is weg.

## Version 0.23.1
- De tekst op het aanvraagitem is nu **DRUK OP DE (▶) KNOP OM AAN TE VRAGEN.** (was "DRUK OP AFSPELEN"): in de webclient heet die knop "Aanvragen", in de TV-app "Afspelen", dus de tekst noemt nu alleen het ▶-symbool. Kanaal-DataVersion 34.

## Version 0.23.0
- Elke hoofdmap (Trending, Populair, Verwachte, Filmgenres, Seriegenres, Studio's) heeft een eigen liggend plaatje: een achtergrond uit de bovenste titels van die lijst met een kleurfilter (zelfde stijl als de genretegels). Geen tekst in het plaatje, de naam komt van Emby.
- Kanaal-DataVersion 33.

## Version 0.22.1
- Herstel: EmbyDiscover.csproj was per ongeluk leeg geraakt (build gaf "Root element is missing").

## Version 0.22.0
- Kanaal: "Aankomende films/series" heet nu "Verwachte films/series".
- Nieuwe mappen "Filmgenres" en "Seriegenres": een tegel per genre (zoals Seerr: duotone-kleur per genre op een achtergrond van een populaire titel). Open je een genre, dan zie je de populairste titels daarvan, elk met Trailer + Aanvragen.
- Nieuwe map "Studio's": studio's (Disney, Warner, Universal, ...) en netwerken (Netflix, Hulu, ...) met logo; open je er een, dan zie je de titels van die studio of dat netwerk.
- Kanaal-DataVersion 32.

## Version 0.21.2
- De tegel "Aanvragen: titel" is terug naast "Trailer: titel" (nodig om op Android TV aan te vragen).
- OMDb/IMDb-score weer verwijderd (de API is niet gratis); de lijsten gebruiken weer de TMDB-score.

## Version 0.21.1
- De YouTube-link linksonder op de trailerpagina wordt direct verborgen (bij elke paginawijziging), zodat er geen flits meer is.

## Version 0.20.4
- Info linksonder (YouTube-link en "MP4 ... Toegevoegd") wordt nu op tekst gezocht en met inline stijl verborgen; werkte in 0.20.3 niet.

## Version 0.20.3
- De losse tegel "Aanvragen: titel" is weggelaten; alleen de tegel "Trailer: titel" blijft (met de knop Aanvragen).
- Op de trailerpagina zijn de YouTube-link en de regel "MP4 ... Toegevoegd" verborgen.

## Version 0.20.2
- **Belangrijke fout hersteld:** het openen van de detailpagina van "Aanvragen: titel" deed de aanvraag al. Emby vraagt de mediabron van een kanaalitem ook op om "Media informatie" te tonen, en `GetChannelItemMediaInfo` voerde toen de aanvraag uit (en maakte de kaart met ffmpeg, vandaar de traagheid). Nu doet die methode niets meer aan Radarr/Sonarr. De aanvraag gebeurt pas bij het starten van het afspelen, via de nieuwe `RequestOnPlay` (luistert naar `ISessionManager.PlaybackStart`, herkent het item aan `ExternalId`). **Controleer in Radarr/Sonarr of er titels staan die je nooit hebt aangevraagd.**
- De bevestigingskaart wordt op de achtergrond vooraf gemaakt zodra je een titel opent (geen wachten op ffmpeg); duurt het toch langer dan 2,5 s, dan speelt de vaste clip en is de kaart bij de volgende keer klaar.
- Status en extra info worden tegelijk opgehaald (sneller openen).
- Webclient: de knop Aanvragen is alleen zichtbaar als de titel nog niet is aangevraagd/beschikbaar; de beschrijving wordt zonder klik op "Meer" volledig getoond; het bestandspad en de regel "MP4 ... Toegevoegd" zijn verborgen; de verbergregels gebruiken klassen onder `body.discover-ask-page` zodat andere Emby-pagina's niet meer worden aangetast.
- Tagline zonder dubbele aanhalingstekens. Id-voorvoegsels `ask7...`, DataVersion 29.
- Niet gecompileerd: let op `PlaybackProgressEventArgs`, `BaseItem.ExternalId` en `ISessionManager.PlaybackStart` in jouw SDK.
