/*
 * Muskelgruppen und Trainingsreihenfolge.
 *
 * Bewusst als Rechnung und nicht als KI-Anfrage: "gleiche Muskelgruppe
 * möglichst weit auseinander" ist eine klar definierte Aufgabe mit einer
 * überprüfbaren Antwort. Ein Algorithmus liefert sie offline, kostenlos und
 * jedes Mal gleich – eine Sprachmodell-Anfrage bräuchte Netz, kostet Geld und
 * käme bei jedem Aufruf anders heraus.
 */

export const GRUPPEN = {
  beine: 'Beine',
  ruecken: 'Rücken',
  brust: 'Brust',
  schultern: 'Schultern',
  arme: 'Arme',
  rumpf: 'Rumpf',
  ausdauer: 'Ausdauer',
};

/** Zuordnung über den Symbolschlüssel – der ist bereits über den Namen ermittelt. */
const GRUPPE_FUER_ICON = {
  beinpresse: 'beine',
  beinbeuger: 'beine',
  beinstrecker: 'beine',
  abduktoren: 'beine',
  adduktoren: 'beine',
  gluteus: 'beine',
  wadenheben: 'beine',
  latzug: 'ruecken',
  rudern: 'ruecken',
  klimmzug: 'ruecken',
  nackenheben: 'ruecken',
  rueckenstrecker: 'ruecken',
  butterfly: 'brust',
  'butterfly-reverse': 'ruecken',
  brustpresse: 'brust',
  dips: 'brust',
  schulterpresse: 'schultern',
  seitheben: 'schultern',
  bizeps: 'arme',
  trizeps: 'arme',
  bauchpresse: 'rumpf',
  beinheben: 'rumpf',
  rotationstrainer: 'rumpf',
  laufband: 'ausdauer',
  fahrrad: 'ausdauer',
  crosstrainer: 'ausdauer',
  rudergeraet: 'ausdauer',
  standard: 'rumpf',
};

export function gruppeFuerIcon(icon) {
  return GRUPPE_FUER_ICON[icon] || 'rumpf';
}

/** Gruppe einer Übung: ausdrücklich gesetzte schlägt die aus dem Symbol. */
export function gruppeVon(ex) {
  return ex.muskel || gruppeFuerIcon(ex.icon);
}

/**
 * Schlägt eine Reihenfolge vor, die gleiche Muskelgruppen möglichst weit
 * auseinanderzieht.
 *
 * Verfahren: wiederholt die Übung wählen, deren Gruppe am längsten nicht dran
 * war. Bei Gleichstand entscheidet, wie viele Übungen der Gruppe noch offen
 * sind – die große Gruppe kommt zuerst, sonst stauen sich ihre Reste am Ende
 * und stehen dann doch direkt hintereinander.
 *
 * Ausdauer wandert grundsätzlich ans Ende: Laufband vor dem Krafttraining
 * ermüdet die Beine für alles Folgende.
 */
export function vorschlagen(uebungen) {
  const kraft = uebungen.filter((e) => gruppeVon(e) !== 'ausdauer');
  const ausdauer = uebungen.filter((e) => gruppeVon(e) === 'ausdauer');

  const offen = new Map(); // Gruppe -> noch nicht platzierte Übungen
  for (const e of kraft) {
    const g = gruppeVon(e);
    if (!offen.has(g)) offen.set(g, []);
    offen.get(g).push(e);
  }

  const zuletzt = new Map(); // Gruppe -> Position der letzten Platzierung
  const ergebnis = [];

  while (ergebnis.length < kraft.length) {
    let beste = null;
    for (const [g, liste] of offen) {
      if (!liste.length) continue;
      // Abstand seit der letzten Übung dieser Gruppe; nie dran = unendlich
      const abstand = zuletzt.has(g) ? ergebnis.length - zuletzt.get(g) : Infinity;
      const kandidat = { g, abstand, rest: liste.length };
      if (
        !beste ||
        kandidat.abstand > beste.abstand ||
        (kandidat.abstand === beste.abstand && kandidat.rest > beste.rest)
      ) {
        beste = kandidat;
      }
    }
    if (!beste) break;
    ergebnis.push(offen.get(beste.g).shift());
    zuletzt.set(beste.g, ergebnis.length - 1);
  }

  // Ausdauer bleibt hinten und nimmt an der Optimierung nicht teil.
  return [...verbessern(ergebnis), ...ausdauer];
}

/**
 * Kleinster Abstand zwischen zwei Übungen derselben Gruppe.
 * Je größer, desto mehr Erholung – dient dem Vergleich zweier Reihenfolgen.
 */
export function engsterAbstand(uebungen) {
  const zuletzt = new Map();
  let min = Infinity;
  uebungen.forEach((e, i) => {
    const g = gruppeVon(e);
    if (zuletzt.has(g)) min = Math.min(min, i - zuletzt.get(g));
    zuletzt.set(g, i);
  });
  return min;
}

/**
 * Bewertet eine Reihenfolge: erst der engste Abstand (größer ist besser),
 * bei Gleichstand die Summe aller Abstände.
 */
function bewerte(liste) {
  const zuletzt = new Map();
  let min = Infinity;
  let summe = 0;
  liste.forEach((e, i) => {
    const g = gruppeVon(e);
    if (zuletzt.has(g)) {
      const d = i - zuletzt.get(g);
      min = Math.min(min, d);
      summe += d;
    }
    zuletzt.set(g, i);
  });
  return [min === Infinity ? 999 : min, summe];
}

const besser = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

/**
 * Verbessert eine Reihenfolge durch Vertauschen zweier Übungen, solange es
 * etwas bringt.
 *
 * Das gierige Verfahren allein bleibt hängen, wenn eine große Gruppe ihre
 * Reste ans Ende drängt. Ein paar Tauschrunden holen das auf. Der Aufwand ist
 * unkritisch – es geht um ein bis zwei Dutzend Übungen, nicht um Tausende.
 */
function verbessern(start) {
  let aktuell = start.slice();
  let wert = bewerte(aktuell);

  for (let runde = 0; runde < 40; runde++) {
    let getauscht = false;
    for (let i = 0; i < aktuell.length; i++) {
      for (let j = i + 1; j < aktuell.length; j++) {
        const probe = aktuell.slice();
        [probe[i], probe[j]] = [probe[j], probe[i]];
        const w = bewerte(probe);
        if (besser(w, wert)) {
          aktuell = probe;
          wert = w;
          getauscht = true;
        }
      }
    }
    if (!getauscht) break;
  }
  return aktuell;
}
