/*
 * Sicherungssteuerung: wann wird hochgeladen, was passiert bei Fehlern.
 *
 * Getrennt von drive.js, weil hier nichts Google-Spezifisches steht – nur die
 * Entscheidung, ob sich das Hochladen lohnt und wie mit einem abgebrochenen
 * Versuch umgegangen wird. Dadurch lässt sich das Verhalten prüfen, ohne
 * echte Zugangsdaten zu haben.
 */

import * as db from './db.js';
import * as drive from './drive.js';

export const SCHLUESSEL = {
  clientId: 'drive.clientId',
  apiKey: 'drive.apiKey',
  ordnerId: 'drive.ordnerId',
  ordnerName: 'drive.ordnerName',
  dateiId: 'drive.dateiId',
  auto: 'drive.auto',
  letzteSicherung: 'drive.letzteSicherung',
  gesicherteRevision: 'drive.gesicherteRevision',
  offen: 'drive.offen', // ein Versuch wurde angefangen, aber nicht bestätigt
  erinnerungAb: 'backup.erinnerungAb',
  erinnerungZuletzt: 'backup.erinnerungZuletzt',
};

export async function einstellungen() {
  const [clientId, apiKey, ordnerId, ordnerName, dateiId, auto, letzteSicherung, gesicherteRevision, offen] =
    await Promise.all([
      db.getMeta(SCHLUESSEL.clientId, ''),
      db.getMeta(SCHLUESSEL.apiKey, ''),
      db.getMeta(SCHLUESSEL.ordnerId, ''),
      db.getMeta(SCHLUESSEL.ordnerName, ''),
      db.getMeta(SCHLUESSEL.dateiId, ''),
      db.getMeta(SCHLUESSEL.auto, true),
      db.getMeta(SCHLUESSEL.letzteSicherung, null),
      db.getMeta(SCHLUESSEL.gesicherteRevision, -1),
      db.getMeta(SCHLUESSEL.offen, false),
    ]);
  return { clientId, apiKey, ordnerId, ordnerName, dateiId, auto, letzteSicherung, gesicherteRevision, offen };
}

export const eingerichtet = (e) => Boolean(e.clientId && e.ordnerId);

/** Steht etwas an? Entweder gab es Änderungen oder ein Versuch blieb offen. */
export async function offeneArbeit() {
  const e = await einstellungen();
  if (!eingerichtet(e)) return { noetig: false, grund: 'nicht eingerichtet' };
  const rev = await db.getRevision();
  if (e.offen) return { noetig: true, grund: 'letzter Versuch unbestätigt', revision: rev };
  if (rev !== e.gesicherteRevision) return { noetig: true, grund: 'Änderungen vorhanden', revision: rev };
  return { noetig: false, grund: 'aktuell', revision: rev };
}

/**
 * Einmal sichern.
 *
 * `interaktiv` entscheidet, ob bei fehlendem Token ein Anmeldefenster geöffnet
 * werden darf. Beim automatischen Lauf im Hintergrund ist das nicht erlaubt:
 * ein Popup, das niemand angefordert hat, blockiert der Browser ohnehin.
 */
export async function sichern({ interaktiv = false } = {}) {
  const e = await einstellungen();
  if (!eingerichtet(e)) return { ok: false, grund: 'nicht eingerichtet' };

  const revisionVorher = await db.getRevision();

  const zugang = await drive.tokenBesorgen(e.clientId, { interaktiv });
  if (!zugang) return { ok: false, grund: 'keine gültige Anmeldung' };

  // Merken, dass ein Versuch läuft. Wird die App mitten im Hochladen
  // eingefroren, steht der Merker beim nächsten Start noch – dann wird
  // nachgeholt, statt eine Lücke zu hinterlassen.
  await db.setMeta(SCHLUESSEL.offen, true);

  try {
    const daten = await db.exportAll();
    const inhalt = JSON.stringify(daten);

    let dateiId = e.dateiId;
    if (!dateiId) {
      const vorhanden = await drive.dateiSuchen({ zugang, ordnerId: e.ordnerId });
      if (vorhanden) dateiId = vorhanden.id;
    }

    const res = await drive.hochladen({ zugang, ordnerId: e.ordnerId, dateiId, inhalt });

    await db.setMeta(SCHLUESSEL.dateiId, res.id);
    await db.setMeta(SCHLUESSEL.letzteSicherung, new Date().toISOString());
    await db.setMeta(SCHLUESSEL.gesicherteRevision, revisionVorher);
    await db.setMeta(SCHLUESSEL.offen, false);

    return { ok: true, bytes: inhalt.length, neu: res.neu, dateiId: res.id, revision: revisionVorher };
  } catch (err) {
    // Merker bleibt absichtlich stehen: beim nächsten Start wird es erneut
    // versucht.
    return { ok: false, grund: err.message, fehler: err };
  }
}

/** Sichern, aber nur wenn es etwas zu sichern gibt. */
export async function sichernFallsNoetig({ interaktiv = false } = {}) {
  const e = await einstellungen();
  if (!eingerichtet(e) || !e.auto) return { ok: false, grund: 'Automatik aus' };
  const arbeit = await offeneArbeit();
  if (!arbeit.noetig) return { ok: false, grund: 'nichts zu tun' };

  // Schutz vor dem Überschreiben einer guten Sicherung mit einer leeren.
  //
  // Auf einem Zweitgerät – oder nachdem die Browserdaten gelöscht wurden –
  // steht die Datenbank leer da, während in Drive die echten Daten liegen.
  // Ohne diese Sperre würde die Automatik beim nächsten Wegschalten die
  // Sicherung des Hauptgeräts durch eine Datei ohne Einträge ersetzen.
  // Von Hand ausgelöst bleibt das möglich, dort sieht man ja, was passiert.
  const anzahl = (await db.getAllEntries()).length;
  if (anzahl === 0) return { ok: false, grund: 'keine Einträge – Automatik übersprungen' };

  return sichern({ interaktiv });
}

/** Sicherung aus Drive holen und einspielen. */
export async function wiederherstellen({ interaktiv = true } = {}) {
  const e = await einstellungen();
  if (!eingerichtet(e)) throw new Error('Drive ist noch nicht eingerichtet.');

  const zugang = await drive.tokenBesorgen(e.clientId, { interaktiv });
  if (!zugang) throw new Error('Nicht bei Google angemeldet.');

  let dateiId = e.dateiId;
  if (!dateiId) {
    const vorhanden = await drive.dateiSuchen({ zugang, ordnerId: e.ordnerId });
    if (!vorhanden) throw new Error('Im gewählten Ordner liegt keine Sicherung.');
    dateiId = vorhanden.id;
    await db.setMeta(SCHLUESSEL.dateiId, dateiId);
  }

  const text = await drive.herunterladen({ zugang, dateiId });
  const counts = await db.importAll(JSON.parse(text));
  // Nach dem Import steht die Revision höher – sonst hielte die Automatik den
  // frisch geholten Stand für eine ungesicherte Änderung.
  await db.setMeta(SCHLUESSEL.gesicherteRevision, await db.getRevision());
  return counts;
}

/* ---------------- Erinnerung für den Weg ohne Google ---------------- */

/*
 * Erinnerung fürs Sichern von Hand.
 *
 * Beide Bedingungen müssen erfüllt sein, und zwar mit Absicht: eine
 * Trainingseinheit erzeugt schon sechs bis neun Änderungen, eine reine
 * Mengenschwelle würde also nach jedem Studiobesuch aufpoppen. Zusammen mit
 * dem Zeitabstand meldet sie sich etwa alle ein bis zwei Wochen – oft genug,
 * um nichts zu verlieren, selten genug, um nicht abgeschaltet zu werden.
 */
const ERINNERUNG_NACH = 20; // Änderungen seit der letzten Erinnerung
const ERINNERUNG_ABSTAND_TAGE = 7;

export async function erinnerungFaellig(jetzt = Date.now()) {
  const e = await einstellungen();
  if (eingerichtet(e) && e.auto) return false;

  const rev = await db.getRevision();
  const ab = await db.getMeta(SCHLUESSEL.erinnerungAb, 0);
  if (rev < ab + ERINNERUNG_NACH) return false;

  const zuletzt = await db.getMeta(SCHLUESSEL.erinnerungZuletzt, 0);
  if (!zuletzt) {
    // Erste Erinnerung: Zeitstempel setzen und noch nicht stören, damit sie
    // nicht direkt nach der ersten Einheit kommt.
    await db.setMeta(SCHLUESSEL.erinnerungZuletzt, jetzt);
    await db.setMeta(SCHLUESSEL.erinnerungAb, rev);
    return false;
  }
  return jetzt - zuletzt >= ERINNERUNG_ABSTAND_TAGE * 86400000;
}

export async function erinnerungVerschieben(jetzt = Date.now()) {
  await db.setMeta(SCHLUESSEL.erinnerungAb, await db.getRevision());
  await db.setMeta(SCHLUESSEL.erinnerungZuletzt, jetzt);
}

export { ERINNERUNG_NACH, ERINNERUNG_ABSTAND_TAGE };
