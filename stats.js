/*
 * Auswertung der Historie.
 *
 * Trennung mit Absicht: hier wird nur gerechnet und Zahlen zurückgegeben,
 * gezeichnet wird in charts.js, zusammengesetzt in app.js. So lässt sich die
 * Rechnerei prüfen, ohne durch die Oberfläche zu klicken.
 */

/** Trainingsvolumen eines Eintrags: Gewicht × Wdh. × Sätze. */
export const volumen = (e) => (e.weight || 0) * (e.reps || 0) * (e.sets || 0);

/** Lokaler Kalendertag als YYYY-MM-DD – nicht per ISO, das kippt über UTC. */
export function tagesSchluessel(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Montag der Woche, in der das Datum liegt. */
export function wochenStart(datum) {
  const d = new Date(datum);
  d.setHours(0, 0, 0, 0);
  const versatz = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - versatz);
  return d;
}

/**
 * „Letzter Monat" = die vergangenen 30 Tage, nicht der Kalendermonat davor.
 * Am 2. eines Monats wäre der Kalendermonat sonst fast leer, und die Frage
 * „wie oft war ich zuletzt im Studio" meint das rollende Fenster.
 */
export const MONAT_TAGE = 30;

/** Fenster für die Besuchszählung – kurzfristiger als die Gewichtsentwicklung. */
export const BESUCHE_TAGE = 7;

export const ZEITRAEUME = [
  { id: '1m', label: 'Letzter Monat', tage: MONAT_TAGE },
  { id: '3m', label: '3 Monate', tage: 91 },
  { id: '12m', label: '12 Monate', tage: 365 },
  { id: 'all', label: 'Alles', tage: null },
];

/** Einträge auf den Zeitraum eingrenzen; gibt auch das Vergleichsfenster zurück. */
export function schneide(entries, zeitraumId, jetzt = Date.now()) {
  const z = ZEITRAEUME.find((x) => x.id === zeitraumId) || ZEITRAEUME[0];
  if (!z.tage) return { aktuell: entries.slice(), vorher: [], zeitraum: z };
  const grenze = jetzt - z.tage * 86400000;
  const grenzeDavor = grenze - z.tage * 86400000;
  const aktuell = [];
  const vorher = [];
  for (const e of entries) {
    const t = new Date(e.date).getTime();
    if (t >= grenze) aktuell.push(e);
    else if (t >= grenzeDavor) vorher.push(e);
  }
  return { aktuell, vorher, zeitraum: z };
}

/** Kennzahlen über eine Menge von Einträgen. */
export function kennzahlen(entries) {
  const tage = new Set(entries.map((e) => tagesSchluessel(e.date)));
  const gesamt = entries.reduce((s, e) => s + volumen(e), 0);
  return {
    einheiten: tage.size,
    eintraege: entries.length,
    volumen: gesamt,
    proEinheit: tage.size ? gesamt / tage.size : 0,
    uebungen: new Set(entries.map((e) => e.exerciseId)).size,
  };
}

/** Volumen je Trainingstag, aufsteigend nach Zeit. */
export function volumenJeEinheit(entries) {
  const proTag = new Map();
  for (const e of entries) {
    const k = tagesSchluessel(e.date);
    const bisher = proTag.get(k);
    const v = volumen(e);
    if (bisher) {
      bisher.v += v;
      bisher.n += 1;
    } else {
      const d = new Date(e.date);
      d.setHours(12, 0, 0, 0);
      proTag.set(k, { t: d.getTime(), v, n: 1 });
    }
  }
  return [...proTag.values()].sort((a, b) => a.t - b.t);
}

/** Wie viele Kalenderwochen die Einträge insgesamt überspannen. */
export function wochenImZeitraum(entries) {
  if (!entries.length) return 0;
  const zeiten = entries.map((e) => new Date(e.date).getTime());
  const von = wochenStart(new Date(Math.min(...zeiten)));
  const bis = wochenStart(new Date(Math.max(...zeiten)));
  let n = 1;
  for (const c = new Date(von); c.getTime() < bis.getTime(); c.setDate(c.getDate() + 7)) n++;
  return n;
}

/** Anzahl Trainingseinheiten je Kalenderwoche, lückenlos aufgefüllt. */
export function einheitenJeWoche(entries, maxWochen = 16) {
  if (!entries.length) return [];
  const tage = [...new Set(entries.map((e) => tagesSchluessel(e.date)))].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  });
  tage.sort((a, b) => a - b);

  const proWoche = new Map();
  for (const t of tage) {
    const k = wochenStart(t).getTime();
    proWoche.set(k, (proWoche.get(k) || 0) + 1);
  }

  // Wochen ohne Training sind eine Aussage – die dürfen nicht wegfallen.
  //
  // Weitergezählt wird über den Kalender (setDate + 7), nicht über
  // 7 × 86 400 000 ms: bei der Zeitumstellung ist eine Woche 23 bzw. 25 Stunden
  // lang, und mit fester Millisekundenrechnung wandert der Schlüssel von
  // Mitternacht weg – ab der Umstellung träfe er keinen Wocheneintrag mehr.
  const ende = wochenStart(tage[tage.length - 1]).getTime();
  const alle = [];
  for (const cursor = wochenStart(tage[0]); cursor.getTime() <= ende; cursor.setDate(cursor.getDate() + 7)) {
    const t = cursor.getTime();
    alle.push({ t, v: proWoche.get(t) || 0 });
  }

  const sichtbar = alle.slice(-maxWochen);
  return sichtbar.map((w) => ({
    label: new Date(w.t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    v: w.v,
    tip: `Woche ab ${new Date(w.t).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    })}: ${w.v} ${w.v === 1 ? 'Einheit' : 'Einheiten'}`,
  }));
}

/**
 * Gewichtsentwicklung je Übung.
 *
 * Verglichen wird der erste mit dem letzten Eintrag im Zeitraum. Bei nur einem
 * Eintrag gibt es keine Entwicklung – das wird als solches gekennzeichnet und
 * nicht als Nullfortschritt ausgegeben.
 */
export function fortschrittJeUebung(entries, exercises) {
  const nachId = new Map();
  for (const e of entries) {
    if (!nachId.has(e.exerciseId)) nachId.set(e.exerciseId, []);
    nachId.get(e.exerciseId).push(e);
  }

  const namen = new Map(exercises.map((x) => [x.id, x.name]));
  const zeilen = [];

  for (const [id, liste] of nachId) {
    liste.sort((a, b) => new Date(a.date) - new Date(b.date));
    const erst = liste[0];
    const letzt = liste[liste.length - 1];
    const werte = liste.map((e) => e.weight);
    zeilen.push({
      id,
      name: namen.get(id) || 'Gelöschte Übung',
      punkte: liste.map((e) => ({ t: new Date(e.date).getTime(), v: e.weight })),
      werte,
      von: erst.weight,
      bis: letzt.weight,
      delta: liste.length > 1 ? letzt.weight - erst.weight : null,
      best: Math.max(...werte),
      anzahl: liste.length,
      zuletzt: new Date(letzt.date).getTime(),
    });
  }

  // Größter Zuwachs zuerst; Übungen ohne Vergleichswert ans Ende.
  zeilen.sort((a, b) => {
    if (a.delta === null && b.delta === null) return b.zuletzt - a.zuletzt;
    if (a.delta === null) return 1;
    if (b.delta === null) return -1;
    return b.delta - a.delta;
  });
  return zeilen;
}

/** Prozentuale Veränderung, null wenn es keine sinnvolle Basis gibt. */
export function veraenderung(neu, alt) {
  if (!alt) return null;
  return ((neu - alt) / alt) * 100;
}

/**
 * Die drei Kennzahlen des letzten Monats.
 *
 * Zur mittleren Steigerung: gemittelt wird über die *Übungen*, nicht über die
 * Einträge. Sonst zöge eine Übung, an der man zehnmal war, den Schnitt gegen
 * eine, an der man zweimal war – gefragt ist aber „wie stark bin ich im Mittel
 * pro Gerät vorangekommen".
 *
 * Übungen mit nur einem Eintrag im Zeitraum haben keine Steigerung (nicht
 * null Prozent) und bleiben deshalb aus dem Mittel heraus.
 */
export function monatsbilanz(entries, exercises, jetzt = Date.now()) {
  const { aktuell } = schneide(entries, '1m', jetzt);

  const proUebung = fortschrittJeUebung(aktuell, exercises);
  const mitVergleich = proUebung.filter((f) => f.delta !== null && f.von > 0);

  const prozente = mitVergleich.map((f) => ((f.bis - f.von) / f.von) * 100);
  const mittel = prozente.length ? prozente.reduce((a, b) => a + b, 0) / prozente.length : null;

  // Die Besuche zählen über ein kürzeres Fenster als die Gewichtsentwicklung:
  // „war ich diese Woche oft genug da" ist eine Frage an die letzten Tage,
  // während sich eine Steigerung erst über Wochen zeigt.
  const grenze7 = jetzt - BESUCHE_TAGE * 86400000;
  const letzte7 = entries.filter((e) => new Date(e.date).getTime() >= grenze7);
  const besuche = new Set(letzte7.map((e) => tagesSchluessel(e.date))).size;

  return {
    tage: MONAT_TAGE,
    besucheTage: BESUCHE_TAGE,
    mittlereSteigerungProzent: mittel,
    bewerteteUebungen: mitVergleich.length,
    besuche,
    besucheEintraege: letzte7.length,
    proUebung,
    eintraege: aktuell.length,
  };
}

/**
 * Wie viele Sätze heute je Übung eingetragen sind – Grundlage der Einfärbung
 * in der Übungsliste. Übungen ohne heutigen Eintrag fehlen in der Map.
 */
export function heutigeSaetze(entries, jetzt = Date.now()) {
  const heute = tagesSchluessel(new Date(jetzt).toISOString());
  const map = new Map();
  for (const e of entries) {
    if (tagesSchluessel(e.date) === heute) map.set(e.exerciseId, e.sets || 0);
  }
  return map;
}
