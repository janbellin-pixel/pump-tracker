# Pump Tracker

Gewichte an Fitnessgeräten mitschreiben. Läuft als installierbare Web-App
(PWA) auf Android, offline, ohne Konto und ohne Server. Alle Daten bleiben auf
dem Handy.

## Was drin ist

- Die 14 Geräte vom Trainingsplan sind vorangelegt: Beinpresse, Beinbeuger,
  Abduktoren, Adduktoren, Gluteus, Latzug, Rückenstrecker, Rudern,
  Rotationstrainer, Butterfly, Butterfly Reverse, Brustpresse, Schulterpresse,
  Bizeps. Eigene Übungen lassen sich jederzeit ergänzen.
- Pro Eintrag: **Gewicht, Wiederholungen, Sätze, Sitzposition, Notiz, Datum**
  (Datum automatisch). Alles außer Gewicht ist optional zu ändern – die Felder
  sind mit den Werten vom letzten Mal vorbelegt.
- **Zwei Taps für den Normalfall:** Übung antippen → *Speichern*. Nur wenn sich
  etwas geändert hat, tippst du überhaupt an den Zahlen.
- Die **+/− Knöpfe springen im Raster des Gewichtsstapels** – voreingestellt
  4,5 kg (10-lbs-Platten, passend zu den Werten auf dem Trainingsplan). Pro
  Übung im Menü *⋯* umstellbar. Die Zahl lässt sich auch direkt eintippen.
- Jede Übung hat ein **schematisches Symbol**, über den Namen zugeordnet.
- Verlauf je Übung mit Diagramm.
- **Reiter „Statistik“** mit der Auswertung über die Zeit (siehe unten).
- Backup als JSON.

Unten sitzt eine Reiterleiste mit **Übungen · Statistik · Mehr**.

## Der Statistik-Reiter

Bewusst nur **drei Werte**. Der Zeitraum steht jeweils direkt am Wert – die
Besuchszählung läuft über ein kürzeres Fenster als die beiden anderen:

1. **Ø Steigerung der Gewichte in Prozent.** Gemittelt wird über die *Übungen*,
   nicht über die Einträge – sonst zöge ein Gerät, an dem du zehnmal warst, den
   Schnitt gegen eines, an dem du zweimal warst. Übungen mit nur einem Eintrag
   im Zeitraum haben keine Steigerung und bleiben draußen (statt als 0 % den
   Schnitt zu verwässern).
2. **Wie oft du im Studio warst – in den letzten 7 Tagen.** Bewusst ein
   kürzeres Fenster als bei den anderen beiden Werten: „war ich diese Woche
   oft genug da" ist eine Frage an die letzten Tage, während sich eine
   Steigerung erst über Wochen zeigt. Mehrere Geräte am selben Tag zählen als
   *ein* Besuch.
3. **Steigerung je Übung in Kilogramm.** Erster gegen letzten Eintrag im
   Zeitraum, größter Zuwachs oben. Antippen öffnet die Übung.

„Letzter Monat“ heißt die vergangenen 30 Tage, nicht der Kalendermonat davor –
am 2. eines Monats wäre der sonst fast leer.

Der Verlauf je Übung mit Diagramm und Tabelle steckt weiterhin auf der
jeweiligen Übungsseite unter „Verlauf“.

## Wichtig: Doppelklick auf index.html funktioniert nicht

Die App **muss über einen Webserver laufen**. Wird `index.html` direkt aus dem
Explorer geöffnet, läuft sie unter `file://` – und dort blockiert Chrome sowohl
das Nachladen der Programmteile (ES-Module, CORS) als auch den Datenspeicher
(IndexedDB). Es erscheint dann ein Hinweis mit dem Startbefehl statt eines
leeren Fensters.

Das ist eine Sicherheitsregel des Browsers und lässt sich in der App nicht
umgehen. Der kürzeste Weg auf diesem Rechner – eine PowerShell im Ordner der
App öffnen und:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Dann `http://localhost:8080/` aufrufen.

## Aufs Handy bringen

Die App braucht **HTTPS** (oder localhost), sonst lässt Chrome sie nicht
installieren und der Offline-Cache greift nicht. Drei Wege, vom einfachsten an:

### 1. GitHub Pages (dauerhaft, kostenlos)

1. Auf github.com ein Repository anlegen, z. B. `pump-tracker`.
2. Die Dateien aus diesem Ordner hochladen (Drag & Drop im Browser reicht).
3. *Settings → Pages → Source: Branch `main`, Ordner `/root`* → *Save*.
4. Nach ein bis zwei Minuten liegt die App unter
   `https://<dein-name>.github.io/pump-tracker/`.
5. Auf dem Handy in Chrome öffnen → Menü *⋮* → **Zum Startbildschirm
   hinzufügen**.

Danach startet sie wie eine normale App im Vollbild und funktioniert ohne Netz.

### 2. Nur schnell ausprobieren, im eigenen WLAN

Auf dem PC im Ordner mit den Dateien:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Das Skript zeigt eine Adresse wie `http://192.168.1.23:8080/` an, die du am
Handy im selben WLAN öffnen kannst. Zum Ausprobieren gut – installieren und
offline nutzen geht so aber nicht, weil es kein HTTPS ist.

### 3. Jeder andere Static-Host

Netlify, Cloudflare Pages, Vercel, ein eigener Webspace: einfach den Ordner
hochladen. Es gibt keinen Build-Schritt, keine Abhängigkeiten.

## Sicherung in Google Drive

Einmal einrichten, danach sichert die App selbstständig – **solange sie offen
ist**. Konkret beim Wegschalten der App, also genau dann, wenn ein Training
fertig ist.

### Was nicht geht

Google gibt Browser-Programmen nur ein Zugangstoken mit rund einer Stunde
Gültigkeit und kein dauerhaftes Refresh-Token. Eine Sicherung, die läuft,
während die App geschlossen ist, ist damit **nicht möglich** – auch nicht über
Hintergrund-Synchronisierung, weil das Token dann längst abgelaufen wäre.

Das Zugangstoken wird gespeichert und übersteht Neustarts der App – innerhalb
seiner Gültigkeit (rund eine Stunde) ist gar keine Anmeldung nötig. Danach
erneuert die App es still im Hintergrund, solange du in Chrome bei Google
angemeldet bist.
Du wirst also nicht jedes Mal neu gefragt, solange du in Chrome bei Google
angemeldet bleibst.

### Einmalige Einrichtung (ca. 10 Minuten)

Das läuft über dein eigenes Google-Konto; ich kann es dir nicht abnehmen.

**Reihenfolge beachten:** Google will wissen, unter welcher Adresse die App
läuft. Deshalb zuerst auf GitHub Pages veröffentlichen (siehe „Aufs Handy
bringen"), damit die Adresse feststeht. Sonst musst du den Schritt später
wiederholen.

1. [console.cloud.google.com](https://console.cloud.google.com/) öffnen und ein
   Projekt anlegen, z. B. „Pump Tracker".
2. Unter *APIs & Dienste → Bibliothek* **zwei** Schnittstellen aktivieren:
   - **Google Drive API** – zum Lesen und Schreiben der Sicherungsdatei
   - **Google Picker API** – für den Ordner-Auswahldialog

   Die zweite wird gern übersehen. Fehlt sie, funktioniert das Sichern, aber
   die Ordnerauswahl bricht ab.
3. *OAuth-Zustimmungsbildschirm* (in neueren Fassungen der Konsole heißt der
   Bereich **Google Auth Platform**, aufgeteilt in *Branding*, *Zielgruppe*
   und *Datenzugriff*):
   - Nutzertyp **Extern**
   - Name der App und deine Mailadresse eintragen
   - Unter *Datenzugriff* den Bereich
     `https://www.googleapis.com/auth/drive.file` hinzufügen
   - Unter *Zielgruppe* dich selbst als **Testnutzer** eintragen. Damit
     brauchst du keine Google-Überprüfung. Der Warnhinweis „nicht bestätigte
     App" bei der ersten Anmeldung ist dann normal – über *Erweitert →
     Weiter zu …* kommst du durch.
4. Unter *APIs & Dienste → Anmeldedaten*:
   - **OAuth-Client-ID** erstellen, Typ *Webanwendung*. Bei *Autorisierte
     JavaScript-Quellen* die Adresse deiner App eintragen, z. B.
     `https://dein-name.github.io` – nur die Domain, **ohne** Pfad und **ohne**
     Schrägstrich am Ende. Zum Testen am PC kannst du zusätzlich
     `http://localhost:8220` eintragen; mehrere Quellen sind erlaubt.
     *Autorisierte Weiterleitungs-URIs* bleiben leer – die braucht dieses
     Verfahren nicht.
   - Zusätzlich einen **API-Schlüssel** erstellen. Den braucht der
     Ordner-Auswahldialog. Empfehlenswert: unter *Anwendungseinschränkungen*
     auf *Websites* stellen und dieselbe Adresse eintragen.
5. In der App: *Mehr → Zugangsdaten eintragen*, beides einfügen.
6. *Ordner in Drive wählen* – es öffnet sich Googles Auswahldialog. Der
   gewählte Ordner wird gemerkt, das musst du nicht wiederholen.

Danach steht in den Einstellungen der Ordnername, der Zeitpunkt der letzten
Sicherung und ob etwas offen ist.

**Wenn etwas klemmt**, ist es fast immer eine dieser drei Ursachen:

| Meldung | Ursache |
| --- | --- |
| `redirect_uri_mismatch` / `origin mismatch` | Die Adresse unter *Autorisierte JavaScript-Quellen* passt nicht exakt zu der, unter der die App läuft |
| Auswahldialog öffnet sich nicht | Google Picker API nicht aktiviert oder API-Schlüssel fehlt |
| `access_denied` | Du bist nicht als Testnutzer eingetragen |

Danach steht in den Einstellungen der Ordnername, der Zeitpunkt der letzten
Sicherung und ob etwas offen ist.

### Wie gesichert wird

- Geschrieben wird **eine** Datei `pump-tracker-backup.json`, die immer wieder
  aktualisiert wird. Dadurch bleibt die Versionshistorie von Drive erhalten –
  du kommst über Drive also auch an ältere Stände.
- Hochgeladen wird nur, wenn sich seit der letzten Sicherung wirklich etwas
  geändert hat. Bloßes Nachschauen kostet kein Datenvolumen.
- Bricht der Upload ab (Funkloch, App eingefroren), bleibt ein Merker stehen
  und der nächste Start holt es nach.

### Auf einem zweiten Gerät

Dort dieselben Zugangsdaten eintragen, denselben Ordner wählen, dann
*Aus Drive wiederherstellen*. Das ist **Sicherung und Wiederherstellung**, kein
Live-Abgleich: wenn du auf zwei Geräten parallel trainierst, gewinnt der
jeweils zuletzt hochgeladene Stand. Der Import führt zusammen statt zu
verdoppeln, aber einen echten Konfliktabgleich gibt es nicht.

### Ohne Einrichtung

Geht auch: die App erinnert dich nach ein paar Trainings ans Sichern und öffnet
das Android-Teilen-Menü mit der Backup-Datei – ein Tipp auf Drive genügt.

## Backups

Alles liegt in der IndexedDB des Browsers. Wenn du in Chrome die Browserdaten
löschst oder das Handy wechselst, ist es weg. Deshalb ab und zu unter
*Einstellungen → Backup exportieren* eine Datei ziehen (Android bietet dabei
das Teilen-Menü an, also z. B. direkt nach Google Drive).

Der Import führt zusammen statt zu verdoppeln: Übungen mit gleichem Namen
werden mit den vorhandenen verschmolzen, auch wenn ihre internen IDs
unterschiedlich sind. Ein Backup zweimal einzuspielen ändert deshalb nichts.

## Dateien

| Datei | Zweck |
| --- | --- |
| `index.html` | Gerüst |
| `app.js` | Oberfläche, Router, Reiter, Eingabelogik |
| `db.js` | IndexedDB: Übungen, Einträge, Export/Import |
| `stats.js` | Auswertung: Volumen, Einheiten, Wochen, Fortschritt (nur Rechnen) |
| `charts.js` | Diagramm-Bausteine: Kurve, Säulen, Mini-Kurve, Tabellenansicht |
| `drive.js` | Google: Anmeldung, Ordnerauswahl, Datei lesen und schreiben |
| `backup.js` | Wann gesichert wird, Nachholen abgebrochener Versuche |
| `exercise-icons.js` | Die schematischen Gerätesymbole |
| `styles.css` | Gestaltung, hell und dunkel |
| `sw.js` | Offline-Cache |
| `manifest.webmanifest` | Name, Farben, Icons fürs Installieren |
| `serve.ps1` | kleiner Testserver für den PC |

Nach jeder Änderung an den Dateien in `sw.js` die Zeile `const CACHE =
'pump-tracker-v1'` hochzählen, sonst behält das Handy die alte Fassung.

## Änderungen veröffentlichen

Der Projektordner ist ein Git-Repository und mit
`github.com/janbellin-pixel/pump-tracker` verbunden. Änderungen gehen damit
direkt raus, ohne Dateien von Hand hochzuladen:

```bash
git add -A && git commit -m "Beschreibung" && git push
```

Danach dauert es ein bis zwei Minuten, bis GitHub Pages den neuen Stand
ausliefert.

**Bei jeder Änderung an den App-Dateien die Zeile `const CACHE` in `sw.js`
hochzählen.** Sonst behalten bereits installierte Handys die alte Fassung aus
ihrem Offline-Cache, und die Änderung kommt nie an.

Prüfen, ob der neue Stand wirklich online ist:

```bash
curl -s "https://janbellin-pixel.github.io/pump-tracker/sw.js" | grep CACHE
```

## Wo das Projekt liegt

```
C:\Users\jbell\Projekte\Pump-Tracker
```

Bewusst **außerhalb von OneDrive**: OneDrive synchronisiert die vielen kleinen
Dateien in `.git` mit und kann sie mitten in einer Git-Operation sperren – eine
bekannte Ursache für beschädigte Repositories. Die Sicherung übernimmt jetzt
GitHub, eine zusätzliche Cloud-Synchronisierung des Ordners bringt nichts.

Der Ordner `OneDrive\Dokumente\Claude-Projekte` ist zudem für Programme
schreibgeschützt: Windows Defender hat den *Überwachten Ordnerzugriff* aktiv,
und OneDrive hat den Systemordner *Dokumente* dorthin umgeleitet. Schreibfehler
melden sich dort irreführend als „Datei nicht gefunden".

## Reihenfolge der Übungen

Über das **⇅** oben rechts in der Übungsliste. Zwei Wege:

- **Von Hand:** ↑/↓ je Zeile. Bewusst keine Zieh-Geste – die kollidiert auf dem
  Handy mit dem Scrollen und trifft bei vielen Zeilen selten auf Anhieb.
- **Vorschlagen lassen:** Der Knopf ordnet so um, dass gleiche Muskelgruppen
  möglichst weit auseinanderliegen. Oben steht der *engste Abstand* – bei den
  14 Standardgeräten verbessert der Vorschlag ihn von 1 auf 2. Mehr ist dort
  nicht drin, weil fünf der vierzehn Übungen Beine sind.

Das ist ein Algorithmus, keine KI-Anfrage: die Aufgabe ist klar definiert, also
rechnet die App sie offline aus – kostenlos, ohne Netz und jedes Mal gleich.

Ausdauergeräte (Laufband, Fahrrad, Crosstrainer, Rudergerät) wandern immer ans
Ende; vor dem Krafttraining würden sie die Beine vorermüden.

Die Muskelgruppe wird aus dem Symbol abgeleitet und lässt sich pro Übung im
Menü *⋯* ändern – nötig bei Übungen, deren Name kein Symbol trifft.

## Training abschließen

Eine installierte Web-App **lässt sich nicht schließen** – weder durch dich
noch durch die App selbst. Das Wegwischen führt auf Android nur zurück, und
`window.close()` verweigert eine Seite, die nicht per Skript geöffnet wurde;
eine Schnittstelle zum Beenden gibt es für installierte Web-Apps nicht.

Was stattdessen geht: oben auf der Übungsliste sitzt eine Leiste mit dem
Sicherungsstand und dem Knopf **„Training abschließen"**. Einmal antippen, die
Bestätigung abwarten, Handy weglegen. Der Knopf sichert – er schließt nicht,
und verspricht das auch nicht mehr.

## Wenn Symbole fehlen

Das Symbol wird beim **Anlegen** einer Übung festgeschrieben. Kommen später
neue Symbole dazu, wirken sie nicht rückwirkend – früher angelegte Übungen
behalten ihr Hantelsymbol.

Deshalb bei jeder Erweiterung der Sammlung `DB_VERSION` in `db.js` hochzählen.
Dann läuft beim nächsten Start die Zuordnung erneut über alle Übungen, die auf
`standard` stehen. Bereits zugeordnete Symbole bleiben dabei
unangetastet.

## Übungen löschen

Zwei Stufen im Menü *⋯*:

- **Ausblenden** – verschwindet aus der Liste, Einträge bleiben, jederzeit in
  den Einstellungen wieder einblendbar.
- **Endgültig löschen** – entfernt die Übung samt aller Einträge. Die
  Rückfrage nennt vorher die genaue Zahl der betroffenen Einträge.

## Farben der Übungsliste

Die Übungen färben sich danach, was du heute schon geschafft hast:

| Zustand | Standardfarbe |
| --- | --- |
| Noch nie eingetragen | hellgrau |
| Heute noch nicht dran | keine Färbung |
| Heute 1 Satz | hellorange |
| Heute 2 Sätze | hellgelb |
| Heute 3 Sätze oder mehr | hellgrün |

Alle fünf sind unter *Mehr → Farben der Übungsliste* frei wählbar, einzeln
abschaltbar und über einen Knopf auf die Standardwerte zurückzusetzen.

Der Zustand **„heute noch nicht dran"** war ursprünglich nicht vorgesehen, ist
aber zu Beginn jeder Einheit der Zustand fast aller Übungen. Ohne ihn hätte
eine seit Monaten genutzte Übung aussehen müssen wie eine nie benutzte.

Zwei Dinge passieren dabei automatisch:

- **Die Schriftfarbe wird aus der Helligkeit der Hintergrundfarbe berechnet.**
  Nötig, weil die App standardmäßig dunkel ist – helle Pastelltöne mit heller
  Schrift wären unlesbar. Das gilt auch für selbst gewählte Farben: ein dunkles
  Pink bekommt helle Schrift, ein helles Gelb dunkle.
- **Der Zustand steht zusätzlich im Vorlesetext** der Schaltfläche, damit die
  Information nicht allein an der Farbe hängt.

## Ablauf im Studio

Pro Übung gibt es zwei Knöpfe:

- **＋ Satz speichern** – der Knopf für das Training. Er zählt die Sätze um eins
  hoch, speichert und schließt die Übung. Die Karte in der Liste wandert damit
  von orange (1 Satz) über gelb (2) nach grün (3 oder mehr).
- **Werte korrigieren** – speichert genau die Zahl, die im Feld *Sätze* steht.
  Für den Fall, dass man sich verzählt hat.

Zu Beginn eines Tages steht die Satzzählung jeder Übung auf **0**. Gewicht und
Wiederholungen kommen weiterhin vom letzten Mal.

Am Ende: **✓ Speichern & schließen** oben auf der Übungsliste.

## Anmeldung bei Google

Das Zugangstoken gilt rund eine Stunde und wird gespeichert – innerhalb dieser
Zeit ist keine Anmeldung nötig, auch nicht nach einem Neustart der App.

Beim Start lädt die App den Google-Anmeldedienst vor und versucht eine stille
Erneuerung. **Das ist der Grund, warum das Speichern vorher oft scheiterte:**
Ein Anmeldefenster darf nur direkt aus einem Fingertipp heraus geöffnet werden,
und diese Erlaubnis verfällt nach wenigen Sekunden. Wurde erst beim Tippen das
Google-Skript aus dem Netz geladen, war sie abgelaufen und der Browser
blockierte das Fenster – ohne erkennbaren Grund.

Ist keine gültige Anmeldung da, heißt der Knopf **„🔑 Anmelden & speichern"**
und öffnet das Anmeldefenster als allererstes, ohne vorherige Datenbankzugriffe.

Ein dauerhaftes Anmelden „über Tage" gibt Google Browser-Apps nicht: das
Refresh-Token, das das ermöglichen würde, bekommen nur Server. Solange du in
Chrome bei Google angemeldet bleibst, sollte die stille Erneuerung aber greifen.

## Schließen

**✓ Speichern & schließen** sichert und versucht danach, die App zu beenden.
Ob das gelingt, entscheidet der Browser: `window.close()` verweigert eine
Seite, die nicht per Skript geöffnet wurde. Im Test hier funktionierte es, auf
einer installierten Web-App unter Android häufig nicht.

Bleibt das Fenster offen, tritt ein Abschlussbildschirm an die Stelle der App –
grüner Haken, „Gesichert", und der Hinweis, dass man jetzt gefahrlos gehen
kann. Ein Knopf führt zurück ins Training.

Das automatische Sichern beim Wegschalten ist entfallen: es lief unzuverlässig
und der zugehörige Schalter versprach mehr, als er hielt.
