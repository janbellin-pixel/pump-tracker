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
- **Foto der Geräteeinstellung** pro Eintrag, mit Zahlenerkennung: erkannte
  Zahlen erscheinen als Knöpfe, ein Tap setzt sie als Gewicht oder Position ein.
- Verlauf je Übung mit Diagramm.
- **Reiter „Statistik“** mit der Auswertung über die Zeit (siehe unten).
- Backup als JSON, mit oder ohne Fotos.

Unten sitzt eine Reiterleiste mit **Übungen · Statistik · Mehr**.

## Bilder für die Übungen

Jede Übung hat links ein Bild:

- Die 14 Geräte vom Trainingsplan haben ein **schematisches Symbol** –
  Körperhaltung plus Bewegungspfeil. Die Richtung trägt dabei die Aussage,
  nicht die Maschine: Butterfly und Butterfly Reverse sehen als Gerät fast
  gleich aus, deshalb unterscheiden sich Armhaltung und Pfeilrichtung deutlich.
  Dasselbe gilt für Abduktoren (Beine weit) und Adduktoren (Beine eng).
- **Eigene Bilder** gehen für jede Übung: *⋯ → Eigenes Bild wählen*, entweder
  frisch fotografiert oder aus der Galerie. Beim Anlegen einer neuen Übung
  fragt die App direkt danach. Über *Zurück zum Symbol* kommt das Piktogramm
  wieder.
- Neue Übungen, die wie ein bekanntes Gerät heißen, bekommen dessen Symbol
  automatisch. Alle anderen ein Hantelsymbol.

Bilder werden auf 320 px verkleinert gespeichert und landen mit im Backup.

## Der Statistik-Reiter

Bewusst nur **drei Werte**, alle bezogen auf die **letzten 30 Tage**:

1. **Ø Steigerung der Gewichte in Prozent.** Gemittelt wird über die *Übungen*,
   nicht über die Einträge – sonst zöge ein Gerät, an dem du zehnmal warst, den
   Schnitt gegen eines, an dem du zweimal warst. Übungen mit nur einem Eintrag
   im Zeitraum haben keine Steigerung und bleiben draußen (statt als 0 % den
   Schnitt zu verwässern).
2. **Wie oft du im Studio warst.** Mehrere Geräte am selben Tag zählen als
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

## Die Zahlenerkennung im Foto

Zwei Wege, automatisch gewählt:

1. **Im Browser eingebaut** (`TextDetector`). Chrome für Android bringt das in
   der Regel mit; es läuft offline und braucht ein bis zwei Sekunden.
2. **Tesseract.js**, wird bei Bedarf aus dem Netz nachgeladen (~2 MB, danach
   gecacht). Nur als Rückfall, wenn Weg 1 fehlt – und **deutlich langsamer**:
   im Test rund 50 Sekunden für ein Foto. Nach 60 Sekunden bricht die App ab.

Welcher Weg auf deinem Handy aktiv ist, steht unten in den *Einstellungen*.
Wenn dort der Rückfall angezeigt wird, lohnt sich das Fotografieren nur als
Gedächtnisstütze – auf die Erkennung willst du dann nicht warten.

Realistisch bleibt das eine Abkürzung, keine Automatik: Zahlen an
Gewichtsstapeln sind klein, oft schräg fotografiert, gestanzt statt gedruckt
und schlecht beleuchtet. Die App rät deshalb nie still vor sich hin, sondern
zeigt die gefundenen Zahlen als Knöpfe an – du tippst die richtige an. Wird
nichts erkannt, stellst du das Gewicht mit +/− ein; **das Foto wird in jedem
Fall gespeichert** und beim nächsten Mal im Verlauf angezeigt. Genau dafür ist
es vor allem gut: die Sitzposition wiederzufinden.

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
- „Fotos mitsichern“ lässt sich abschalten, wenn dir die Datei zu groß wird.

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
| `db.js` | IndexedDB: Übungen, Einträge, Fotos, Export/Import |
| `stats.js` | Auswertung: Volumen, Einheiten, Wochen, Fortschritt (nur Rechnen) |
| `charts.js` | Diagramm-Bausteine: Kurve, Säulen, Mini-Kurve, Tabellenansicht |
| `drive.js` | Google: Anmeldung, Ordnerauswahl, Datei lesen und schreiben |
| `backup.js` | Wann gesichert wird, Nachholen abgebrochener Versuche |
| `exercise-icons.js` | Die schematischen Gerätesymbole |
| `ocr.js` | Foto verkleinern, Zahlen erkennen und bewerten |
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

## Sichern & schließen

Eine installierte Web-App lässt sich auf Android nicht wirklich schließen; das
Wischen führt nur zurück. Deshalb sitzt oben auf der Übungsliste eine Leiste
mit dem Sicherungsstand und dem Knopf **„Sichern & schließen"**. Nach dem
Training einmal antippen, die Bestätigung abwarten, fertig.

`window.close()` wird versucht, funktioniert bei einer nicht per Skript
geöffneten Seite aber meist nicht. Der Knopf ist nicht darauf angewiesen – das
Ergebnis ist die Sicherung, nicht das Schließen.

## Übungen löschen

Zwei Stufen im Menü *⋯*:

- **Ausblenden** – verschwindet aus der Liste, Einträge bleiben, jederzeit in
  den Einstellungen wieder einblendbar.
- **Endgültig löschen** – entfernt die Übung samt aller Einträge und Fotos. Die
  Rückfrage nennt vorher die genaue Zahl der betroffenen Einträge.
