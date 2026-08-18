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
