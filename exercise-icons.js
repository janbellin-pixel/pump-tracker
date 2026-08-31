/*
 * Schematische Symbole für die Geräte.
 *
 * Einheitliche Bildsprache, damit die Liste ruhig bleibt und man die Übung am
 * Umriss erkennt statt am Text:
 *   - 48×48, Strichzeichnung, keine Flächen
 *   - Körper in der Textfarbe (Strichstärke 2,2)
 *   - Gerät angedeutet und zurückgenommen (Strichstärke 1,6, halbtransparent)
 *   - ein Bewegungspfeil in der Akzentfarbe – der unterscheidet die Übungen
 *     stärker als jede Maschinenzeichnung, denn Butterfly und Butterfly
 *     Reverse sehen als Gerät fast gleich aus und nur die Richtung trennt sie
 *
 * Bei so kleinen Symbolen ist Detailtreue schädlich: auf 36 px läuft alles
 * zu, was feiner ist als diese Linien.
 */

const KOPF = (x, y) => `<circle cx="${x}" cy="${y}" r="3.1" class="ic-body"/>`;

/** Pfeil mit Spitze; dx/dy geben die Richtung an. */
function pfeil(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const s = 3.4;
  // zwei Schenkel der Spitze, um ±32° gedreht
  const dreh = (a) => {
    const c = Math.cos(a);
    const si = Math.sin(a);
    return [x2 - s * (ux * c - uy * si), y2 - s * (uy * c + ux * si)];
  };
  const [ax, ay] = dreh(0.56);
  const [bx, by] = dreh(-0.56);
  return (
    `<path d="M${x1} ${y1} L${x2} ${y2}" class="ic-arrow"/>` +
    `<path d="M${ax.toFixed(1)} ${ay.toFixed(1)} L${x2} ${y2} L${bx.toFixed(1)} ${by.toFixed(1)}" class="ic-arrow"/>`
  );
}

/** Gewichtsstapel als wiederkehrendes Erkennungsmerkmal. */
const STAPEL = (x, y) =>
  `<rect x="${x}" y="${y}" width="8" height="14" rx="1.5" class="ic-gear"/>` +
  `<path d="M${x} ${y + 4.5}h8M${x} ${y + 9}h8" class="ic-gear"/>`;

const ICONS = {
  /* Seitlich sitzend, Beine strecken die Platte nach rechts weg. */
  beinpresse:
    `<path d="M9 34 L9 20 L15 15" class="ic-gear"/>` +
    KOPF(16, 15) +
    `<path d="M15 19 L15 28" class="ic-body"/>` +
    `<path d="M15 28 L25 25 L33 30" class="ic-body"/>` +
    `<path d="M35 21 L35 37" class="ic-gear" stroke-width="2.6"/>` +
    pfeil(27, 40, 39, 40),

  /* Bäuchlings auf der Bank, Unterschenkel zieht nach oben an. */
  beinbeuger:
    `<path d="M7 30 L30 30" class="ic-gear" stroke-width="2.6"/>` +
    KOPF(11, 24) +
    `<path d="M14 26 L29 26" class="ic-body"/>` +
    `<path d="M29 26 L34 28 L34 16" class="ic-body"/>` +
    `<path d="M31 15 L38 15" class="ic-gear"/>` +
    pfeil(41, 28, 41, 16),

  /* Von vorn: Beine weit auseinander – der Umriss trägt die Aussage,
     nicht der Pfeil. Bei 28 px sind zwei Pfeile allein nicht zu trennen. */
  abduktoren:
    KOPF(24, 11) +
    `<path d="M24 14 L24 22" class="ic-body"/>` +
    `<path d="M24 22 L12 28 L9 38 M24 22 L36 28 L39 38" class="ic-body"/>` +
    `<path d="M6 25 L12 25 M36 25 L42 25" class="ic-gear" stroke-width="2.6"/>` +
    pfeil(19, 33, 10, 33) +
    pfeil(29, 33, 38, 33),

  /* Von vorn: Beine dicht beieinander – deutlich schmalerer Umriss. */
  adduktoren:
    KOPF(24, 11) +
    `<path d="M24 14 L24 22" class="ic-body"/>` +
    `<path d="M24 22 L21 30 L21 38 M24 22 L27 30 L27 38" class="ic-body"/>` +
    `<path d="M12 27 L18 27 M30 27 L36 27" class="ic-gear" stroke-width="2.6"/>` +
    pfeil(8, 34, 17, 34) +
    pfeil(40, 34, 31, 34),

  /* Stehend am Gestell, ein Bein drückt nach hinten. */
  gluteus:
    `<path d="M11 10 L11 38" class="ic-gear"/>` +
    KOPF(18, 13) +
    `<path d="M18 16 L19 27 L19 38" class="ic-body"/>` +
    `<path d="M19 27 L29 30 L36 27" class="ic-body"/>` +
    `<path d="M36 24 L36 30" class="ic-gear" stroke-width="2.6"/>` +
    pfeil(28, 36, 39, 33),

  /* Sitzend unter der Stange, Zug nach unten. */
  latzug:
    `<path d="M10 9h28" class="ic-gear"/>` +
    `<path d="M24 9v4" class="ic-gear"/>` +
    `<path d="M17 14h14" class="ic-body"/>` +
    KOPF(24, 22) +
    `<path d="M19 15 L24 25 L29 15" class="ic-body"/>` +
    `<path d="M24 25v7" class="ic-body"/>` +
    `<path d="M16 34h16" class="ic-gear"/>` +
    pfeil(24, 36, 24, 43),

  /* Sitzend, Oberkörper streckt sich nach hinten. */
  rueckenstrecker:
    `<path d="M14 38h20" class="ic-gear"/>` +
    KOPF(28, 14) +
    `<path d="M26 17 L22 28 L22 34" class="ic-body"/>` +
    `<path d="M22 34 L32 34" class="ic-body"/>` +
    `<path d="M13 16v20" class="ic-gear"/>` +
    pfeil(33, 16, 39, 22),

  /* Sitzend, Griffe waagerecht zum Körper ziehen. */
  rudern:
    `<path d="M38 12v24" class="ic-gear"/>` +
    KOPF(19, 15) +
    `<path d="M19 18 L20 28 L30 30" class="ic-body"/>` +
    `<path d="M20 21 L31 22" class="ic-body"/>` +
    `<path d="M31 22 L36 22" class="ic-gear"/>` +
    `<path d="M14 30h8" class="ic-gear"/>` +
    pfeil(30, 38, 20, 38),

  /* Oberkörper dreht sich – als Drehpfeil dargestellt. */
  rotationstrainer:
    KOPF(24, 13) +
    `<path d="M24 16v10" class="ic-body"/>` +
    `<path d="M17 20h14" class="ic-body"/>` +
    `<path d="M24 26 L20 36 M24 26 L28 36" class="ic-body"/>` +
    `<path d="M12 30a12 8 0 0 0 24 0" class="ic-arrow" fill="none"/>` +
    `<path d="M33 26 L36.5 30.5 L31 31.5" class="ic-arrow"/>`,

  /* Von vorn: Arme vorn geschlossen, Hände treffen sich – enger Umriss. */
  butterfly:
    KOPF(24, 11) +
    `<path d="M24 14 L24 30" class="ic-body"/>` +
    `<path d="M24 17 L16 21 L22 27 M24 17 L32 21 L26 27" class="ic-body"/>` +
    STAPEL(4, 15) +
    STAPEL(36, 15) +
    pfeil(13, 35, 21, 35) +
    pfeil(35, 35, 27, 35),

  /* Von vorn: Arme weit geöffnet – breiter Umriss, klar das Gegenteil. */
  'butterfly-reverse':
    KOPF(24, 11) +
    `<path d="M24 14 L24 30" class="ic-body"/>` +
    `<path d="M24 18 L14 16 L9 20 M24 18 L34 16 L39 20" class="ic-body"/>` +
    STAPEL(4, 25) +
    STAPEL(36, 25) +
    pfeil(20, 35, 10, 35) +
    pfeil(28, 35, 38, 35),

  /* Sitzend, Arme drücken nach vorn. */
  brustpresse:
    `<path d="M12 12v24" class="ic-gear"/>` +
    KOPF(18, 15) +
    `<path d="M18 18 L18 30" class="ic-body"/>` +
    `<path d="M18 21 L27 21 L31 24" class="ic-body"/>` +
    `<path d="M32 14v16" class="ic-gear"/>` +
    `<path d="M14 32h8" class="ic-gear"/>` +
    pfeil(26, 38, 38, 38),

  /* Sitzend, Arme drücken nach oben. */
  schulterpresse:
    KOPF(24, 20) +
    `<path d="M24 23v9" class="ic-body"/>` +
    `<path d="M24 25 L17 21 L16 14 M24 25 L31 21 L32 14" class="ic-body"/>` +
    `<path d="M12 12h10M26 12h10" class="ic-gear"/>` +
    `<path d="M17 34h14" class="ic-gear"/>` +
    pfeil(24, 12, 24, 5),

  /* Oberarm liegt auf dem Polster, Unterarm klappt nach oben. */
  bizeps:
    `<path d="M8 32 L24 32" class="ic-gear" stroke-width="2.6"/>` +
    `<circle cx="12" cy="27" r="2.4" class="ic-body"/>` +
    `<path d="M13 29 L23 31" class="ic-body"/>` +
    `<path d="M23 31 L31 19" class="ic-body"/>` +
    `<path d="M28 16 L35 21" class="ic-body"/>` +
    pfeil(39, 31, 39, 17),

  /* Rückfall für alles ohne eigenes Bild: eine Hantel. */
  /* --- Weitere gängige Geräte, damit neue Übungen nicht beim Hantelsymbol landen --- */

  /* Sitzend, Unterschenkel streckt nach oben. Gegenstück zum Beinbeuger. */
  beinstrecker:
    `<path d="M10 34 L10 20 L16 16" class="ic-gear"/>` +
    KOPF(17, 15) +
    `<path d="M16 19 L16 28 L26 28" class="ic-body"/>` +
    `<path d="M26 28 L33 18" class="ic-body"/>` +
    `<path d="M30 15 L37 20" class="ic-gear"/>` +
    pfeil(40, 30, 40, 16),

  /* Stehend auf Trittfläche, Fersen heben. */
  wadenheben:
    KOPF(24, 11) +
    `<path d="M24 14 L24 26" class="ic-body"/>` +
    `<path d="M24 26 L20 34 M24 26 L28 34" class="ic-body"/>` +
    `<path d="M14 36 L34 36" class="ic-gear" stroke-width="2.6"/>` +
    `<path d="M13 17 L18 17 M30 17 L35 17" class="ic-gear"/>` +
    pfeil(39, 34, 39, 22),

  /* Sitzend, Oberkörper rollt nach vorn ein. */
  bauchpresse:
    `<path d="M12 14 L12 36" class="ic-gear"/>` +
    KOPF(22, 14) +
    `<path d="M22 17 L24 26 L24 32" class="ic-body"/>` +
    `<path d="M24 26 L33 28" class="ic-body"/>` +
    `<path d="M16 34 L30 34" class="ic-gear"/>` +
    pfeil(32, 16, 36, 25),

  /* Stehend am Kabelzug, Unterarme drücken nach unten. */
  trizeps:
    `<path d="M14 8 L34 8" class="ic-gear"/>` +
    `<path d="M24 8 L24 14" class="ic-gear"/>` +
    KOPF(24, 18) +
    `<path d="M24 21 L24 30" class="ic-body"/>` +
    `<path d="M24 23 L18 27 L20 33 M24 23 L30 27 L28 33" class="ic-body"/>` +
    pfeil(38, 22, 38, 34),

  /* Von vorn: Arme heben seitlich bis zur Waagerechten. */
  seitheben:
    KOPF(24, 12) +
    `<path d="M24 15 L24 30" class="ic-body"/>` +
    `<path d="M24 18 L13 18 M24 18 L35 18" class="ic-body"/>` +
    `<path d="M10 16 L10 21 M38 16 L38 21" class="ic-gear" stroke-width="2.6"/>` +
    pfeil(13, 30, 9, 22) +
    pfeil(35, 30, 39, 22),

  /* Hängend an der Stange, Körper zieht nach oben. */
  klimmzug:
    `<path d="M9 10 L39 10" class="ic-gear" stroke-width="2.6"/>` +
    `<path d="M18 10 L20 17 M30 10 L28 17" class="ic-body"/>` +
    KOPF(24, 19) +
    `<path d="M24 22 L24 33" class="ic-body"/>` +
    `<path d="M24 33 L20 39 M24 33 L28 39" class="ic-body"/>` +
    pfeil(38, 32, 38, 20),

  /* Zwischen zwei Holmen, Körper drückt sich nach oben. */
  dips:
    `<path d="M10 14 L10 34 M38 14 L38 34" class="ic-gear"/>` +
    `<path d="M10 16 L18 16 M30 16 L38 16" class="ic-gear" stroke-width="2.6"/>` +
    KOPF(24, 17) +
    `<path d="M24 20 L24 31" class="ic-body"/>` +
    `<path d="M24 21 L18 17 M24 21 L30 17" class="ic-body"/>` +
    `<path d="M24 31 L21 38 M24 31 L27 38" class="ic-body"/>` +
    pfeil(33, 34, 33, 24),

  /* Hängend oder liegend, Beine heben an. */
  beinheben:
    `<path d="M10 10 L10 36" class="ic-gear"/>` +
    KOPF(17, 14) +
    `<path d="M17 17 L17 27" class="ic-body"/>` +
    `<path d="M17 27 L27 27 L34 21" class="ic-body"/>` +
    `<path d="M12 20 L20 20" class="ic-gear"/>` +
    pfeil(31, 34, 37, 24),

  /* Schultern ziehen nach oben (Shrugs). */
  nackenheben:
    KOPF(24, 12) +
    `<path d="M16 19 L32 19" class="ic-body"/>` +
    `<path d="M24 15 L24 19" class="ic-body"/>` +
    `<path d="M17 19 L17 31 M31 19 L31 31" class="ic-body"/>` +
    `<path d="M13 31 L21 31 M27 31 L35 31" class="ic-gear" stroke-width="2.6"/>` +
    pfeil(9, 26, 9, 15) +
    pfeil(39, 26, 39, 15),

  /* Laufband. */
  laufband:
    KOPF(21, 12) +
    `<path d="M21 15 L20 24" class="ic-body"/>` +
    `<path d="M20 18 L26 21 M20 18 L15 22" class="ic-body"/>` +
    `<path d="M20 24 L26 30 M20 24 L14 30" class="ic-body"/>` +
    `<path d="M8 36 L40 36" class="ic-gear" stroke-width="2.6"/>` +
    `<path d="M33 36 L33 14 L27 12" class="ic-gear"/>` +
    pfeil(12, 41, 34, 41),

  /* Fahrrad-Ergometer. */
  fahrrad:
    KOPF(22, 11) +
    `<path d="M22 14 L23 23" class="ic-body"/>` +
    `<path d="M23 17 L31 15" class="ic-body"/>` +
    `<path d="M23 23 L18 28 L22 33" class="ic-body"/>` +
    `<circle cx="22" cy="34" r="6" class="ic-gear"/>` +
    `<path d="M31 13 L31 20" class="ic-gear"/>` +
    `<path d="M14 38 L34 38" class="ic-gear"/>` +
    `<path d="M27 31 a7 7 0 0 1 -3 8" class="ic-arrow" fill="none"/>`,

  /* Crosstrainer / Ellipsentrainer. */
  crosstrainer:
    KOPF(23, 11) +
    `<path d="M23 14 L23 25" class="ic-body"/>` +
    `<path d="M23 17 L15 13 M23 17 L31 21" class="ic-body"/>` +
    `<path d="M23 25 L16 33 M23 25 L30 31" class="ic-body"/>` +
    `<path d="M11 35 L35 35" class="ic-gear" stroke-width="2.6"/>` +
    `<circle cx="36" cy="27" r="5" class="ic-gear"/>` +
    pfeil(15, 40, 31, 40),

  /* Rudergerät als Ausdauergerät (nicht die Rudermaschine mit Stapel). */
  rudergeraet:
    `<path d="M8 34 L40 34" class="ic-gear" stroke-width="2.6"/>` +
    KOPF(20, 16) +
    `<path d="M20 19 L22 27" class="ic-body"/>` +
    `<path d="M21 22 L31 24" class="ic-body"/>` +
    `<path d="M22 27 L30 30" class="ic-body"/>` +
    `<circle cx="10" cy="26" r="4" class="ic-gear"/>` +
    `<path d="M14 26 L31 24" class="ic-gear"/>` +
    pfeil(34, 39, 20, 39),

  standard:
    `<path d="M14 24h20" class="ic-body"/>` +
    `<path d="M11 17v14M17 14v20M31 14v20M37 17v14" class="ic-body"/>`,
};

/** Ordnet den Standardübungen ihr Symbol zu. */
export const ICON_FUER_NAME = {
  Beinpresse: 'beinpresse',
  Beinbeuger: 'beinbeuger',
  Abduktoren: 'abduktoren',
  Adduktoren: 'adduktoren',
  Gluteus: 'gluteus',
  Latzug: 'latzug',
  Rückenstrecker: 'rueckenstrecker',
  Rudern: 'rudern',
  Rotationstrainer: 'rotationstrainer',
  Butterfly: 'butterfly',
  'Butterfly Reverse': 'butterfly-reverse',
  Brustpresse: 'brustpresse',
  Schulterpresse: 'schulterpresse',
  Bizeps: 'bizeps',
};

/**
 * Stichwörter je Symbol, damit auch selbst angelegte Übungen eines bekommen.
 *
 * Gesucht wird im normalisierten Namen (klein, ohne Umlaute und Leerzeichen),
 * damit „Wadenheben stehend", „Beinstrecker links" oder „BAUCH-PRESSE"
 * genauso treffen. Längere Stichwörter werden zuerst geprüft: sonst würde
 * „rudern" schon in „rudergeraet" anschlagen.
 */
const STICHWORTE = {
  beinpresse: ['beinpresse', 'legpress'],
  beinbeuger: ['beinbeuger', 'beincurl', 'legcurl'],
  beinstrecker: ['beinstrecker', 'legextension', 'quadrizeps'],
  abduktoren: ['abduktor', 'abduction'],
  adduktoren: ['adduktor', 'adduction'],
  gluteus: ['gluteus', 'glute', 'gesaess'],
  latzug: ['latzug', 'latpulldown', 'latziehen'],
  // 'ruecken' fehlt hier bewusst: 'druecken' enthaelt es, damit landete
  // 'Trizepsdruecken' beim Rueckenstrecker.
  rueckenstrecker: ['rueckenstrecker', 'hyperextension'],
  rudern: ['rudernmaschine', 'rudern', 'rowing', 'ruderzug'],
  rudergeraet: ['rudergeraet', 'ruderergometer', 'concept2'],
  rotationstrainer: ['rotation', 'torso', 'drehen'],
  butterfly: ['butterfly', 'flies'],
  'butterfly-reverse': ['butterflyreverse', 'reversebutterfly', 'reversefly'],
  brustpresse: ['brustpresse', 'chestpress', 'bankdruecken', 'brust'],
  schulterpresse: ['schulterpresse', 'shoulderpress', 'schulterdruecken'],
  seitheben: ['seitheben', 'lateralraise', 'seitliches'],
  nackenheben: ['nackenheben', 'shrug', 'nacken', 'trapez'],
  bizeps: ['bizeps', 'biceps', 'curl', 'armbeuger'],
  trizeps: ['trizeps', 'triceps', 'pushdown', 'armstrecker'],
  bauchpresse: ['bauchpresse', 'bauch', 'crunch', 'abdominal', 'situp'],
  beinheben: ['beinheben', 'legraise', 'knieheben'],
  wadenheben: ['wadenheben', 'waden', 'calf'],
  klimmzug: ['klimmzug', 'pullup', 'chinup', 'assisted'],
  dips: ['dips'],
  laufband: ['laufband', 'treadmill', 'laufen'],
  fahrrad: ['fahrrad', 'ergometer', 'bike', 'radfahren', 'spinning'],
  crosstrainer: ['crosstrainer', 'ellipsen', 'elliptical', 'stepper'],
};

const normalisiere = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

// Einmal nach Stichwortlänge sortieren, damit "rudergeraet" vor "rudern" prüft.
const STICHWORT_LISTE = Object.entries(STICHWORTE)
  .flatMap(([key, worte]) => worte.map((w) => [normalisiere(w), key]))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Sucht ein passendes Symbol zu einem Übungsnamen.
 * Gibt 'standard' zurück, wenn nichts passt – nie null, damit der Aufrufer
 * sich nicht darum kümmern muss.
 */
export function iconFuerName(name) {
  if (ICON_FUER_NAME[name]) return ICON_FUER_NAME[name];
  const n = normalisiere(name);
  if (!n) return 'standard';
  // Laengster Treffer gewinnt, nicht der erstbeste: 'Beincurl' enthaelt
  // sowohl 'curl' als auch 'beincurl', und nur das laengere ist gemeint.
  let best = null;
  for (const [wort, key] of STICHWORT_LISTE) {
    if (n.includes(wort) && (!best || wort.length > best[0].length)) best = [wort, key];
  }
  return best ? best[1] : 'standard';
}

export const ICON_SCHLUESSEL = Object.keys(ICONS);

export function hatIcon(schluessel) {
  return Boolean(schluessel && ICONS[schluessel]);
}

/**
 * Liefert ein fertiges <svg>-Element.
 * Rein dekorativ – der Übungsname steht immer daneben, deshalb aria-hidden.
 */
export function iconElement(schluessel, { size = 40 } = {}) {
  const inhalt = ICONS[schluessel] || ICONS.standard;
  const wrap = document.createElement('span');
  wrap.className = 'ex-icon';
  wrap.innerHTML =
    `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">${inhalt}</svg>`;
  return wrap.firstChild ? wrap : wrap;
}

export { ICONS };
