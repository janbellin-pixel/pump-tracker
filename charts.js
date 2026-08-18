/*
 * Diagramm-Bausteine.
 *
 * Alle Diagramme hier zeigen genau eine Reihe – deshalb eine Farbe, keine
 * Legende (der Titel sagt, was geplottet wird) und Beschriftungen nur an den
 * Stellen, die man wirklich abliest: Anfang, Ende, Höchstwert. Zahlen an jedem
 * Punkt werden nicht gelesen und machen das Bild unruhig.
 *
 * Die Farbe --chart-1 ist gegen die Kartenfläche geprüft (hell 3,40:1,
 * dunkel 5,12:1) und liegt in beiden Modi im zulässigen Helligkeitsband.
 */

const NS = 'http://www.w3.org/2000/svg';

const fmt = (n, digits = 1) =>
  Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits });

const fmtKompakt = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return fmt(n / 1e6, 1) + ' Mio.';
  if (a >= 1e4) return fmt(Math.round(n / 1000), 0) + ' Tsd.';
  return fmt(Math.round(n), 0);
};

const fmtDatum = (t) =>
  new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtDatumKurz = (t) =>
  new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  return n;
}

function htmlEl(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

/** Achsenteilung auf runde Zahlen – 0/20/40 statt 0/17,3/34,6. */
function niceTicks(min, max, count = 4) {
  if (!(max > min)) {
    const v = max || 0;
    return { lo: Math.min(0, v), hi: v || 1, ticks: [v] };
  }
  const roh = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(roh)));
  const norm = roh / mag;
  const schritt = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const lo = Math.floor(min / schritt) * schritt;
  const hi = Math.ceil(max / schritt) * schritt;
  const ticks = [];
  for (let v = lo; v <= hi + schritt / 2; v += schritt) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

/* ---------------- Tabellenansicht ---------------- */

/**
 * Jedes Diagramm bekommt eine Tabellen-Zwillingsansicht. Der Tooltip ist eine
 * Zugabe, nie der einzige Weg an einen Wert – auf dem Handy, mit Tastatur und
 * mit Screenreader muss man die Zahlen auch so erreichen können.
 */
function tabellenAnsicht(spalten, zeilen) {
  const tabelle = htmlEl('table', { class: 'ch-table' }, [
    htmlEl('thead', {}, [htmlEl('tr', {}, spalten.map((c) => htmlEl('th', { text: c })))]),
    htmlEl(
      'tbody',
      {},
      zeilen.map((r) => htmlEl('tr', {}, r.map((c) => htmlEl('td', { text: String(c) }))))
    ),
  ]);
  const box = htmlEl('div', { class: 'ch-table-wrap', hidden: true }, [tabelle]);
  const knopf = htmlEl('button', {
    class: 'ch-toggle',
    type: 'button',
    'aria-expanded': 'false',
    text: 'Zahlen anzeigen',
  });
  knopf.addEventListener('click', () => {
    const offen = box.hidden;
    box.hidden = !offen;
    knopf.setAttribute('aria-expanded', String(offen));
    knopf.textContent = offen ? 'Zahlen ausblenden' : 'Zahlen anzeigen';
  });
  return { knopf, box };
}

/* ---------------- Karte ---------------- */

function karte(titel, untertitel) {
  const kopf = htmlEl('div', { class: 'ch-head' }, [
    htmlEl('h3', { class: 'ch-title', text: titel }),
    untertitel ? htmlEl('p', { class: 'ch-sub', text: untertitel }) : null,
  ]);
  const wrap = htmlEl('div', { class: 'ch-card' }, [kopf]);
  return wrap;
}

/* ---------------- Zeitreihe (Fläche + Linie) ---------------- */

/**
 * punkte: [{ t: Millisekunden, v: Zahl }]
 * Nur Endpunkt und Höchstwert werden direkt beschriftet; alles Weitere holt
 * man sich per Antippen oder aus der Tabelle.
 */
export function zeitreihe({
  titel,
  untertitel,
  punkte,
  einheit = '',
  // formatWert steht an Achse und Direktbeschriftung – dort zählt Kürze.
  formatWert = (v) => fmt(v, 1),
  // formatGenau steht in Tooltip und Tabelle. Die Tabelle ist der Ort, an dem
  // man den exakten Wert holt; gerundete "15 Tsd." wären dort wertlos.
  formatGenau = null,
  formatTooltip = null,
}) {
  const genau = formatGenau || formatWert;
  const card = karte(titel, untertitel);
  const daten = punkte.slice().sort((a, b) => a.t - b.t);

  if (daten.length < 2) {
    card.append(
      htmlEl('p', {
        class: 'ch-empty',
        text:
          daten.length === 1
            ? 'Ab dem zweiten Eintrag entsteht hier eine Kurve.'
            : 'Noch keine Daten im gewählten Zeitraum.',
      })
    );
    return card;
  }

  const W = 360;
  const H = 200;
  const pad = { l: 44, r: 16, t: 14, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const werte = daten.map((d) => d.v);
  const { lo, hi, ticks } = niceTicks(Math.min(...werte), Math.max(...werte));
  const t0 = daten[0].t;
  const tSpan = daten[daten.length - 1].t - t0 || 1;
  const vSpan = hi - lo || 1;

  const X = (t) => pad.l + ((t - t0) / tSpan) * plotW;
  const Y = (v) => pad.t + (1 - (v - lo) / vSpan) * plotH;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    tabindex: '0',
    'aria-label': `${titel}: ${daten.length} Werte von ${formatWert(Math.min(...werte))} bis ${formatWert(
      Math.max(...werte)
    )} ${einheit}`.trim(),
  });

  // Raster: durchgezogene Haarlinien, eine Stufe von der Fläche abgesetzt
  for (const tv of ticks) {
    const y = Y(tv);
    if (y < pad.t - 0.5 || y > pad.t + plotH + 0.5) continue;
    svg.append(
      svgEl('line', {
        x1: pad.l, y1: y, x2: pad.l + plotW, y2: y,
        stroke: 'var(--line)', 'stroke-width': 1, 'shape-rendering': 'crispEdges',
      })
    );
    const tx = svgEl('text', {
      x: pad.l - 8, y: y + 3.5, 'text-anchor': 'end', class: 'ch-tick',
    });
    tx.textContent = fmtKompakt(tv);
    svg.append(tx);
  }

  const linie = daten.map((d, i) => `${i ? 'L' : 'M'}${X(d.t).toFixed(2)},${Y(d.v).toFixed(2)}`).join(' ');

  // Gefüllt wird nur, wenn die Achse die Null einschließt. Bei abgeschnittener
  // Achse würde die Fläche eine Größe behaupten, die sie nicht hat – ein Wert
  // von 15 000 sähe dreimal so "viel" aus wie 13 000. Dann trägt allein die
  // Linie die Aussage, und die Steigung stimmt weiterhin.
  if (lo <= 0) {
    const flaeche = `${linie} L${X(daten[daten.length - 1].t).toFixed(2)},${(pad.t + plotH).toFixed(2)} L${X(t0).toFixed(2)},${(pad.t + plotH).toFixed(2)} Z`;
    svg.append(svgEl('path', { d: flaeche, fill: 'var(--chart-1)', 'fill-opacity': 0.1 }));
  }
  svg.append(
    svgEl('path', {
      d: linie, fill: 'none', stroke: 'var(--chart-1)', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    })
  );

  // Endpunkt-Marker mit Ring in Flächenfarbe, damit er über der Linie steht
  const letzter = daten[daten.length - 1];
  svg.append(
    svgEl('circle', {
      cx: X(letzter.t), cy: Y(letzter.v), r: 4.5,
      fill: 'var(--chart-1)', stroke: 'var(--surface)', 'stroke-width': 2,
    })
  );

  // Sparsame Direktbeschriftung: Höchstwert und Endwert
  const maxPunkt = daten.reduce((a, b) => (b.v > a.v ? b : a), daten[0]);
  const beschrifte = (p, text, klasse) => {
    const rechts = X(p.t) > pad.l + plotW * 0.7;
    const t = svgEl('text', {
      x: rechts ? X(p.t) - 6 : X(p.t) + 6,
      y: Y(p.v) - 9,
      'text-anchor': rechts ? 'end' : 'start',
      class: klasse,
    });
    t.textContent = text;
    svg.append(t);
  };
  beschrifte(letzter, `${formatWert(letzter.v)}${einheit ? ' ' + einheit : ''}`, 'ch-label');
  if (maxPunkt !== letzter && maxPunkt.v > letzter.v) {
    beschrifte(maxPunkt, formatWert(maxPunkt.v), 'ch-label ch-label-muted');
  }

  // Zeitachse: nur erster und letzter Wert, sonst kollidiert es auf dem Handy
  const achse = (x, anchor, text) => {
    const t = svgEl('text', { x, y: H - 10, 'text-anchor': anchor, class: 'ch-tick' });
    t.textContent = text;
    svg.append(t);
  };
  achse(pad.l, 'start', fmtDatumKurz(t0));
  achse(pad.l + plotW, 'end', fmtDatumKurz(letzter.t));

  /* --- Fadenkreuz, Tooltip, Tastatur --- */
  const cursorLinie = svgEl('line', {
    y1: pad.t, y2: pad.t + plotH, stroke: 'var(--muted)', 'stroke-width': 1, opacity: 0,
  });
  const cursorPunkt = svgEl('circle', {
    r: 4.5, fill: 'var(--chart-1)', stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0,
  });
  svg.append(cursorLinie, cursorPunkt);

  const tooltip = htmlEl('div', { class: 'ch-tip', hidden: true });
  const plot = htmlEl('div', { class: 'ch-plot' }, [svg, tooltip]);

  let aktiv = -1;
  const zeige = (i) => {
    if (i < 0 || i >= daten.length) return;
    aktiv = i;
    const d = daten[i];
    const x = X(d.t);
    const y = Y(d.v);
    cursorLinie.setAttribute('x1', x);
    cursorLinie.setAttribute('x2', x);
    cursorLinie.setAttribute('opacity', 1);
    cursorPunkt.setAttribute('cx', x);
    cursorPunkt.setAttribute('cy', y);
    cursorPunkt.setAttribute('opacity', 1);
    tooltip.hidden = false;
    tooltip.textContent = formatTooltip
      ? formatTooltip(d)
      : `${fmtDatum(d.t)} · ${genau(d.v)}${einheit ? ' ' + einheit : ''}`;
    // in Prozent positionieren, damit es unabhängig von der Skalierung sitzt
    tooltip.style.left = `${(x / W) * 100}%`;
    tooltip.style.top = `${(y / H) * 100}%`;
  };
  const verstecke = () => {
    aktiv = -1;
    cursorLinie.setAttribute('opacity', 0);
    cursorPunkt.setAttribute('opacity', 0);
    tooltip.hidden = true;
  };

  const naechsterIndex = (clientX) => {
    const box = svg.getBoundingClientRect();
    const xView = ((clientX - box.left) / box.width) * W;
    let best = 0;
    let bestD = Infinity;
    daten.forEach((d, i) => {
      const dd = Math.abs(X(d.t) - xView);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    return best;
  };

  const onPointer = (e) => {
    e.preventDefault();
    zeige(naechsterIndex(e.clientX));
  };
  svg.addEventListener('pointerdown', onPointer);
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) onPointer(e);
  });
  svg.addEventListener('pointerleave', verstecke);
  svg.addEventListener('blur', verstecke);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      zeige(aktiv < 0 ? 0 : Math.min(daten.length - 1, aktiv + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      zeige(aktiv < 0 ? daten.length - 1 : Math.max(0, aktiv - 1));
    } else if (e.key === 'Escape') {
      verstecke();
    }
  });

  card.append(plot);
  const { knopf, box } = tabellenAnsicht(
    ['Datum', `Wert${einheit ? ' (' + einheit + ')' : ''}`],
    daten.slice().reverse().map((d) => [fmtDatum(d.t), genau(d.v)])
  );
  card.append(knopf, box);
  return card;
}

/* ---------------- Säulen ---------------- */

/** balken: [{ label, v, tip }] */
export function saeulen({ titel, untertitel, balken, einheit = '', formatWert = (v) => fmt(v, 0) }) {
  const card = karte(titel, untertitel);
  if (!balken.length) {
    card.append(htmlEl('p', { class: 'ch-empty', text: 'Noch keine Daten im gewählten Zeitraum.' }));
    return card;
  }

  const W = 360;
  const H = 180;
  const pad = { l: 30, r: 12, t: 14, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const { hi, ticks } = niceTicks(0, Math.max(...balken.map((b) => b.v)), 3);
  const slot = plotW / balken.length;
  // Die Säule füllt ihren Slot nie aus – der Rest ist Luft. 16 Einheiten sind
  // hier die Obergrenze, weil das SVG hochskaliert wird: bei der maximalen
  // Breite der App landet das bei rund 22 gerenderten Pixeln und bleibt damit
  // unter der 24-px-Grenze, auf dem Handy entsprechend darunter.
  const breite = Math.min(16, Math.max(3, slot * 0.6));
  const Y = (v) => pad.t + (1 - v / (hi || 1)) * plotH;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    tabindex: '0',
    'aria-label': `${titel}: ${balken.length} Werte, Höchstwert ${formatWert(Math.max(...balken.map((b) => b.v)))}`,
  });

  for (const tv of ticks) {
    const y = Y(tv);
    svg.append(
      svgEl('line', {
        x1: pad.l, y1: y, x2: pad.l + plotW, y2: y,
        stroke: 'var(--line)', 'stroke-width': 1, 'shape-rendering': 'crispEdges',
      })
    );
    const t = svgEl('text', { x: pad.l - 6, y: y + 3.5, 'text-anchor': 'end', class: 'ch-tick' });
    t.textContent = fmtKompakt(tv);
    svg.append(t);
  }

  const basis = pad.t + plotH;
  balken.forEach((b, i) => {
    const x = pad.l + i * slot + (slot - breite) / 2;
    const h = Math.max(0, basis - Y(b.v));
    // Kappe 4px gerundet, Fuß eckig auf der Grundlinie
    const r = Math.min(4, breite / 2, h);
    const d = h <= 0
      ? ''
      : `M${x},${basis} L${x},${basis - h + r} Q${x},${basis - h} ${x + r},${basis - h}
         L${x + breite - r},${basis - h} Q${x + breite},${basis - h} ${x + breite},${basis - h + r}
         L${x + breite},${basis} Z`;
    if (d) svg.append(svgEl('path', { d, fill: 'var(--chart-1)' }));
  });

  // Grundlinie
  svg.append(
    svgEl('line', {
      x1: pad.l, y1: basis, x2: pad.l + plotW, y2: basis,
      stroke: 'var(--line)', 'stroke-width': 1, 'shape-rendering': 'crispEdges',
    })
  );

  const achse = (x, anchor, text) => {
    const t = svgEl('text', { x, y: H - 10, 'text-anchor': anchor, class: 'ch-tick' });
    t.textContent = text;
    svg.append(t);
  };
  achse(pad.l, 'start', balken[0].label);
  if (balken.length > 1) achse(pad.l + plotW, 'end', balken[balken.length - 1].label);

  const tooltip = htmlEl('div', { class: 'ch-tip', hidden: true });
  const plot = htmlEl('div', { class: 'ch-plot' }, [svg, tooltip]);

  let aktiv = -1;
  const zeige = (i) => {
    if (i < 0 || i >= balken.length) return;
    aktiv = i;
    const b = balken[i];
    tooltip.hidden = false;
    tooltip.textContent = b.tip || `${b.label}: ${formatWert(b.v)}${einheit ? ' ' + einheit : ''}`;
    tooltip.style.left = `${((pad.l + i * slot + slot / 2) / W) * 100}%`;
    tooltip.style.top = `${(Y(b.v) / H) * 100}%`;
  };
  const verstecke = () => {
    aktiv = -1;
    tooltip.hidden = true;
  };

  // Trefferfläche über den ganzen Slot, nicht nur über der schmalen Säule
  const trefferIndex = (clientX) => {
    const box = svg.getBoundingClientRect();
    const xView = ((clientX - box.left) / box.width) * W;
    return Math.max(0, Math.min(balken.length - 1, Math.floor((xView - pad.l) / slot)));
  };
  const onPointer = (e) => {
    e.preventDefault();
    zeige(trefferIndex(e.clientX));
  };
  svg.addEventListener('pointerdown', onPointer);
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) onPointer(e);
  });
  svg.addEventListener('pointerleave', verstecke);
  svg.addEventListener('blur', verstecke);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      zeige(aktiv < 0 ? 0 : Math.min(balken.length - 1, aktiv + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      zeige(aktiv < 0 ? balken.length - 1 : Math.max(0, aktiv - 1));
    } else if (e.key === 'Escape') verstecke();
  });

  card.append(plot);
  const { knopf, box } = tabellenAnsicht(
    ['Zeitraum', `Wert${einheit ? ' (' + einheit + ')' : ''}`],
    balken.slice().reverse().map((b) => [b.label, formatWert(b.v)])
  );
  card.append(knopf, box);
  return card;
}

/**
 * Mini-Kurve für die Small Multiples. Bewusst ohne Achsen und Beschriftung –
 * die Zahlen stehen daneben; hier zählt nur die Form des Verlaufs.
 */
export function miniKurve(werte, { width = 96, height = 30 } = {}) {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`, class: 'ch-mini', 'aria-hidden': 'true', focusable: 'false',
  });
  if (werte.length < 2) return svg;

  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const span = max - min || 1;
  // Muss Radius (3) plus Ring (2) fassen, sonst wird der Endpunkt beschnitten.
  const pad = 6;
  const X = (i) => (i / (werte.length - 1)) * (width - 2 * pad) + pad;
  const Y = (v) => pad + (1 - (v - min) / span) * (height - 2 * pad);

  // Bewusst ohne Füllung: die Kurve ist auf ihren eigenen Wertebereich
  // gespreizt, eine Fläche darunter würde eine Größe behaupten, die es hier
  // nicht gibt. Die genauen Zahlen stehen ohnehin daneben.
  const d = werte.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  svg.append(
    svgEl('path', {
      d, fill: 'none', stroke: 'var(--chart-1)', 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    })
  );
  svg.append(
    svgEl('circle', {
      cx: X(werte.length - 1), cy: Y(werte[werte.length - 1]), r: 3,
      fill: 'var(--chart-1)', stroke: 'var(--surface)', 'stroke-width': 2,
    })
  );
  return svg;
}

export { fmt, fmtKompakt, fmtDatum, htmlEl as chEl };
