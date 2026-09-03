import * as db from './db.js';
import * as charts from './charts.js';
import * as stats from './stats.js';
import * as reihenfolge from './reihenfolge.js';
import * as backup from './backup.js';
import * as drive from './drive.js';
import { ICONS, iconFuerName } from './exercise-icons.js';
import { shrinkImage, readNumbersFromImage, ocrStatus } from './ocr.js';

// Quittung an den Hinweis in index.html: alle Module sind da. Bleibt sie aus –
// etwa weil die Seite per file:// geöffnet wurde und Chrome das Nachladen
// blockiert –, blendet index.html nach kurzer Zeit die Erklärung ein, statt
// ein leeres Fenster stehen zu lassen.
window.__pumpBooted = true;

/* ---------------- Helfer ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
};

const fmtNum = (n) =>
  Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

const fmtDateLong = (iso) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });

let toastTimer = null;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function haptic(ms = 12) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/** Fließkomma-Rundung auf das Raster – 4.5er-Schritte driften sonst weg. */
function snap(value, step) {
  if (!step || step <= 0) return Math.round(value * 10) / 10;
  return Math.round((Math.round(value / step) * step) * 10) / 10;
}

/* Objekt-URLs sammeln und beim Viewwechsel freigeben (sonst Speicherleck). */
let objectUrls = [];
function objectUrl(blob) {
  const u = URL.createObjectURL(blob);
  objectUrls.push(u);
  return u;
}
function revokeUrls() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}

/**
 * Modaler Dialog als Promise.
 *
 * Aufgeräumt wird ausdrücklich beim Schließen und nicht erst im `close`-Event:
 * dessen Zustellung ist nicht überall verlässlich, und ein Dialog, der per
 * Zurück-Geste verschwindet, ohne sein Promise aufzulösen, würde den
 * aufrufenden Ablauf für immer anhalten. `cancel`/`close` lösen deshalb
 * denselben Abschluss aus wie ein Knopfdruck – nur mit dem Abbruchwert.
 */
function showDialog(build, { onDismiss = null } = {}) {
  return new Promise((resolve) => {
    let dlg;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        if (dlg.open) dlg.close();
      } catch {
        /* schon zu */
      }
      dlg.remove();
      resolve(value);
    };

    dlg = el('dialog', {}, build(finish));
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(onDismiss);
    });
    dlg.addEventListener('close', () => finish(onDismiss));
    // Tippen auf den abgedunkelten Hintergrund schließt ebenfalls.
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) finish(onDismiss);
    });

    document.body.append(dlg);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');

    const field = dlg.querySelector('input, textarea');
    if (field) {
      field.focus();
      field.select?.();
    }
  });
}

function confirmDialog(title, message, okLabel = 'OK') {
  return showDialog(
    (finish) => [
      el('h2', { text: title }),
      el('p', { text: message, style: 'color:var(--muted);margin:0 0 8px' }),
      el('div', { class: 'dialog-actions' }, [
        el('button', { type: 'button', text: 'Abbrechen', onclick: () => finish(false) }),
        el('button', { type: 'button', class: 'ok', text: okLabel, onclick: () => finish(true) }),
      ]),
    ],
    { onDismiss: false }
  );
}

function promptDialog(title, { value = '', placeholder = '', type = 'text' } = {}) {
  return showDialog(
    (finish) => {
      const input = el('input', { type, value, placeholder });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(input.value);
        }
      });
      return [
        el('h2', { text: title }),
        input,
        el('div', { class: 'dialog-actions' }, [
          el('button', { type: 'button', text: 'Abbrechen', onclick: () => finish(null) }),
          el('button', {
            type: 'button',
            class: 'ok',
            text: 'Speichern',
            onclick: () => finish(input.value),
          }),
        ]),
      ];
    },
    { onDismiss: null }
  );
}

/* ---------------- Einfärbung der Übungsschaltflächen ---------------- */

/**
 * Zustände einer Übung in der Liste und ihre Standardfarben.
 *
 * „offen" fehlte in der ursprünglichen Anforderung, ist aber zu Beginn jeder
 * Einheit der Zustand fast aller Übungen: schon einmal trainiert, heute noch
 * nicht. Ohne eigenen Zustand hätte er mit „noch nie" zusammenfallen müssen,
 * und dann sähe eine seit Monaten genutzte Übung aus wie eine unbenutzte.
 * Standardmäßig bleibt er ungefärbt; einstellbar ist er trotzdem.
 */
export const ZUSTAENDE = [
  { id: 'nie', label: 'Noch nie eingetragen', standard: '#d8dce3' },
  { id: 'offen', label: 'Heute noch nicht dran', standard: null },
  { id: 'eins', label: 'Heute 1 Satz', standard: '#ffd7a3' },
  { id: 'zwei', label: 'Heute 2 Sätze', standard: '#fbeda1' },
  { id: 'drei', label: 'Heute 3 Sätze oder mehr', standard: '#b5e6ba' },
];

const FARBEN_KEY = 'liste.farben';

export async function farbenLaden() {
  const gespeichert = (await db.getMeta(FARBEN_KEY, null)) || {};
  const farben = {};
  for (const z of ZUSTAENDE) {
    farben[z.id] = z.id in gespeichert ? gespeichert[z.id] : z.standard;
  }
  return farben;
}

/** Welchen Zustand hat die Übung gerade? */
function zustandVon(ex, hatJemals, saetzeHeute) {
  if (saetzeHeute === undefined) return hatJemals ? 'offen' : 'nie';
  if (saetzeHeute >= 3) return 'drei';
  if (saetzeHeute === 2) return 'zwei';
  if (saetzeHeute >= 1) return 'eins';
  return 'offen';
}

/**
 * Lesbare Schriftfarbe zu einer Hintergrundfarbe.
 *
 * Nötig, weil die App standardmäßig dunkel ist: helle Pastelltöne mit der
 * hellen Standardschrift wären unlesbar. Statt die Farben vorzuschreiben,
 * wird die Helligkeit ausgerechnet und die Schrift danach gewählt – so
 * funktioniert auch jede selbst gewählte Farbe.
 */
function schriftFarbeFuer(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const kanal = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L =
    0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
  return L > 0.45 ? { ink: '#151922', muted: '#5c6577' } : { ink: '#eef1f6', muted: '#98a1b3' };
}

/** Färbt eine Übungskarte gemäß ihrem Zustand ein. */
function faerbeKarte(karte, ex, hatJemals, saetzeHeute, farben) {
  const zustand = zustandVon(ex, hatJemals, saetzeHeute);
  const farbe = farben[zustand];
  if (!farbe) return zustand;

  karte.style.background = farbe;
  karte.style.borderColor = farbe;
  const schrift = schriftFarbeFuer(farbe);
  if (schrift) {
    karte.style.color = schrift.ink;
    karte.querySelectorAll('.last, .big small').forEach((n) => (n.style.color = schrift.muted));
    karte.querySelectorAll('.big').forEach((n) => (n.style.color = schrift.ink));
  }
  return zustand;
}

/* ---------------- Übungsbild ---------------- */

/**
 * Bild einer Übung: eigenes Foto, sonst das schematische Symbol.
 *
 * Das Foto wird nachgeladen, weil es als Blob in der Datenbank liegt – bis es
 * da ist, steht schon das Symbol an seiner Stelle. Dadurch springt das Layout
 * nicht, und ohne Foto ist ohnehin sofort alles fertig.
 */
function exerciseIcon(ex, { size = 40 } = {}) {
  const box = el('span', { class: 'ex-icon', style: `--ic-size:${size}px` });
  box.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${
    ICONS[ex.icon] || ICONS.standard
  }</svg>`;

  if (ex.iconPhotoId) {
    db.getPhoto(ex.iconPhotoId).then((blob) => {
      if (!blob) return;
      box.replaceChildren(el('img', { src: objectUrl(blob), alt: '', loading: 'lazy' }));
      box.classList.add('foto');
    });
  }
  return box;
}

/** Bild für eine Übung aufnehmen oder aus der Galerie wählen. */
function bildWaehlen() {
  return new Promise((resolve) => {
    const input = el('input', {
      type: 'file',
      accept: 'image/*',
      style: 'display:none',
    });
    let fertig = false;
    input.addEventListener('change', async () => {
      fertig = true;
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return resolve(null);
      try {
        // Klein halten: das Bild wird nie größer als 160 px dargestellt.
        resolve(await shrinkImage(f, 320, 0.7));
      } catch {
        toast('Bild konnte nicht gelesen werden.');
        resolve(null);
      }
    });
    // Bricht der Nutzer den Systemdialog ab, kommt kein change-Ereignis.
    window.addEventListener(
      'focus',
      () => setTimeout(() => {
        if (!fertig) {
          input.remove();
          resolve(null);
        }
      }, 800),
      { once: true }
    );
    document.body.append(input);
    input.click();
  });
}

/* ---------------- Stepper-Baustein ---------------- */

/**
 * Ein Wert mit −/+ Knöpfen. Der Wert selbst ist ein Eingabefeld, damit man
 * ihn bei Bedarf direkt tippen kann, statt 20-mal zu drücken.
 */
function makeStepper({ value, step, min = 0, max = 999, decimals = 1, unit = null, onChange }) {
  const input = el('input', {
    class: 'value',
    type: 'text',
    inputmode: 'decimal',
    value: fmtNum(value),
    'aria-label': 'Wert',
  });

  let current = value;

  const set = (v, notify = true) => {
    current = Math.max(min, Math.min(max, v));
    current = decimals === 0 ? Math.round(current) : Math.round(current * 10) / 10;
    input.value = fmtNum(current);
    if (notify && onChange) onChange(current);
  };

  const bump = (dir) => {
    haptic();
    // Vom Raster aus weiterzählen, nicht vom krummen Ist-Wert.
    const base = step >= 1 || decimals === 0 ? current : snap(current, step);
    set(snap(base + dir * step, step));
  };

  input.addEventListener('focus', () => input.select());
  input.addEventListener('blur', () => {
    const parsed = parseFloat(input.value.replace(',', '.'));
    if (Number.isFinite(parsed)) set(parsed);
    else input.value = fmtNum(current);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });

  const wrap = el('div', { class: 'stepper' }, [
    el('button', { type: 'button', text: '−', 'aria-label': 'weniger', onclick: () => bump(-1) }),
    input,
    unit ? el('span', { class: 'unit', text: unit }) : null,
    el('button', { type: 'button', text: '+', 'aria-label': 'mehr', onclick: () => bump(1) }),
  ]);

  return { node: wrap, get: () => current, set: (v) => set(v, false) };
}

/* ---------------- Verlaufs-Diagramm ---------------- */

function sparkline(entries) {
  if (entries.length < 2) return null;
  return charts.zeitreihe({
    titel: 'Gewicht über die Zeit',
    punkte: entries.map((e) => ({ t: new Date(e.date).getTime(), v: e.weight })),
    einheit: 'kg',
    formatWert: (v) => fmtNum(v),
  });
}

/* ---------------- Sicherungsleiste auf der Hauptseite ---------------- */

/**
 * Zeigt den Sicherungsstand und bietet „Training abschließen" an.
 *
 * Hintergrund: Eine installierte Web-App lässt sich auf Android nicht wirklich
 * schließen – das Wischen führt nur zurück. Die Sicherung beim Wegschalten
 * greift zwar, aber man sieht ihr Ergebnis nie. Dieser Knopf macht daraus
 * einen bewussten Abschluss: sichern, Rückmeldung abwarten, dann erst weg.
 *
 * Die App kann sich nicht selbst schließen: `window.close()` verweigert eine
 * Seite, die nicht per Skript geöffnet wurde, und für installierte Web-Apps
 * gibt es dafür keine Schnittstelle. Ein früherer Versuch damit blieb wirkungslos
 * und die frühere Beschriftung versprach entsprechend zu viel.
 * Der Knopf heißt deshalb jetzt nach dem, was er tatsächlich leistet.
 */
async function sicherungsLeiste() {
  const e = await backup.einstellungen();
  if (!backup.eingerichtet(e)) return document.createDocumentFragment();

  const arbeit = await backup.offeneArbeit();
  const gueltigBis = await drive.anmeldungGueltigBis();

  const box = el('div', { class: 'save-bar' + (arbeit.noetig ? ' offen' : '') });

  const wann = e.letzteSicherung
    ? new Date(e.letzteSicherung).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : 'noch nie';

  box.append(
    el('div', { class: 'save-info' }, [
      el('div', {
        class: 'save-status ' + (arbeit.noetig ? 'offen' : 'ok'),
        text: arbeit.noetig ? 'Noch nicht gesichert' : 'Gesichert',
      }),
      el('div', { class: 'save-sub', text: `zuletzt ${wann}` }),
    ])
  );

  const knopf = el('button', {
    class: 'save-btn',
    type: 'button',
    text: arbeit.noetig ? '☁ Training abschließen' : '☁ Erneut sichern',
  });
  knopf.addEventListener('click', async () => {
    knopf.disabled = true;
    knopf.textContent = '☁ Sichere …';
    const res = await backup.sichern({ interaktiv: true });
    if (res.ok) {
      haptic(30);
      toast('Gesichert – du kannst die App jetzt weglegen', 3500);
      viewList();
    } else {
      knopf.disabled = false;
      knopf.textContent = '☁ Nochmal versuchen';
      toast(`Sicherung fehlgeschlagen: ${res.grund}`, 5000);
    }
  });
  box.append(knopf);

  // Anmeldung läuft bald ab – lieber vorher sagen als beim Sichern scheitern.
  if (gueltigBis && gueltigBis < Date.now()) {
    box.append(
      el('div', {
        class: 'save-hint',
        text: 'Google-Anmeldung abgelaufen – beim nächsten Sichern einmal bestätigen.',
      })
    );
  }

  return box;
}

/* ---------------- Ansicht: Übungsliste ---------------- */

async function viewList() {
  setTop('Pump Tracker', {
    right: [
      iconBtn('⇅', 'Reihenfolge ändern', () => go('#/sortieren')),
      iconBtn('＋', 'Übung hinzufügen', addExerciseFlow),
    ],
  });

  const [exercises, lastMap] = await Promise.all([db.getExercises(), db.getLastEntryMap()]);
  const main = $('#main');
  main.replaceChildren();

  main.append(await sicherungsLeiste());

  if (!exercises.length) {
    main.append(el('p', { class: 'empty', text: 'Keine Übungen. Oben rechts auf ＋ tippen.' }));
    return;
  }

  const [farben, alleEintraege] = await Promise.all([farbenLaden(), db.getAllEntries()]);
  const saetzeHeute = stats.heutigeSaetze(alleEintraege);

  const list = el('div', { class: 'ex-list' });
  for (const ex of exercises) {
    const last = lastMap.get(ex.id);
    const detail = last
      ? `${fmtDate(last.date)} · ${last.sets}×${last.reps}${last.pos ? ` · Pos. ${last.pos}` : ''}`
      : 'noch kein Eintrag';

    const karte = el('button', { class: 'ex-card', onclick: () => go(`#/ex/${ex.id}`) }, [
      exerciseIcon(ex, { size: 40 }),
      el('span', { class: 'name' }, [
        document.createTextNode(ex.name),
        el('span', { class: 'last', text: detail }),
      ]),
      last
        ? el('span', { class: 'big' }, [
            document.createTextNode(fmtNum(last.weight)),
            el('small', { text: ' kg' }),
          ])
        : el('span', { class: 'big', style: 'color:var(--muted)', text: '–' }),
    ]);

    const zustand = faerbeKarte(karte, ex, Boolean(last), saetzeHeute.get(ex.id), farben);
    // Die Farbe allein trägt die Information nicht – für Screenreader und für
    // alle, die Farben schlecht unterscheiden, steht sie zusätzlich im Text.
    const zLabel = ZUSTAENDE.find((z) => z.id === zustand)?.label;
    if (zLabel) karte.setAttribute('aria-label', `${ex.name} – ${zLabel}`);

    list.append(karte);
  }
  main.append(list);
}

async function addExerciseFlow() {
  const name = await promptDialog('Neue Übung', { placeholder: 'z. B. Wadenheben' });
  if (!name || !name.trim()) return;

  const ex = await db.addExercise(name);

  // Bild direkt anbieten – hinterher sucht es kaum jemand im Menü.
  const mitBild = await confirmDialog(
    `„${ex.name}“ angelegt`,
    'Möchtest du ein Bild dafür aufnehmen oder aus der Galerie wählen? Ohne Bild bekommt die Übung ein Hantelsymbol.',
    'Bild wählen'
  );
  if (mitBild) {
    const blob = await bildWaehlen();
    if (blob) {
      const photoId = await db.savePhoto(blob);
      await db.saveExercise({ ...ex, iconPhotoId: photoId });
    }
  }
  go(`#/ex/${ex.id}`);
}

/* ---------------- Ansicht: Eintrag ---------------- */

async function viewEntry(exId) {
  const ex = await db.getExercise(exId);
  if (!ex) return go('#/');

  const entries = await db.getEntries(exId);
  const last = entries[0] || null;
  const step = ex.weightStep || 4.5;

  setTop(ex.name, {
    left: iconBtn('←', 'Zurück', () => go('#/')),
    right: [iconBtn('⋯', 'Übung bearbeiten', () => exerciseMenu(ex))],
  });

  const main = $('#main');
  main.replaceChildren();

  /* --- Zustand des Formulars --- */
  /*
   * Ein Eintrag je Übung und Tag.
   *
   * Gibt es für heute schon einen, wird er beim Speichern überschrieben statt
   * verdoppelt – sonst stünden nach einem versehentlichen zweiten Tipp zwei
   * Zeilen für dieselbe Einheit da. Die Maske zeigt dann den heutigen Stand
   * und nicht den vom letzten Mal, denn was man vor sich sieht, ist genau das,
   * was gleich überschrieben wird.
   */
  const heuteSchluessel = stats.tagesSchluessel(new Date().toISOString());
  const heute = entries.find((e) => stats.tagesSchluessel(e.date) === heuteSchluessel) || null;
  const vorlage = heute || last;

  const draft = {
    weight: vorlage ? vorlage.weight : step * 4,
    reps: vorlage ? vorlage.reps : 12,
    sets: vorlage ? vorlage.sets : 3,
    pos: vorlage ? vorlage.pos : 0,
    note: heute ? heute.note || '' : '',
    photoBlob: null,
  };

  /* --- Gewicht --- */
  const weightStepper = makeStepper({
    value: draft.weight,
    step,
    min: 0,
    max: 500,
    unit: 'kg',
    onChange: (v) => (draft.weight = v),
  });

  const weightField = el('div', { class: 'field' }, [
    el('div', { class: 'ex-kopf' }, [
      exerciseIcon(ex, { size: 56 }),
      el('span', { class: 'ex-kopf-name', text: ex.name }),
    ]),
    el('div', { class: 'label' }, [
      el('span', { text: 'Gewicht' }),
      el('span', {
        class: 'hint' + (heute ? ' hint-heute' : ''),
        text: heute
          ? 'heute bereits eingetragen'
          : last
            ? `zuletzt ${fmtNum(last.weight)} kg`
            : `Schritt ${fmtNum(step)} kg`,
      }),
    ]),
    weightStepper.node,
  ]);

  /* --- Wdh. / Sätze / Pos. --- */
  const repsStepper = makeStepper({
    value: draft.reps,
    step: 1,
    min: 1,
    max: 100,
    decimals: 0,
    onChange: (v) => (draft.reps = v),
  });
  const setsStepper = makeStepper({
    value: draft.sets,
    step: 1,
    min: 1,
    max: 20,
    decimals: 0,
    onChange: (v) => (draft.sets = v),
  });
  const posStepper = makeStepper({
    value: draft.pos,
    step: 1,
    min: 0,
    max: 30,
    decimals: 0,
    onChange: (v) => (draft.pos = v),
  });

  const smallField = (label, stepper) =>
    el('div', { class: 'field' }, [
      el('div', { class: 'label' }, [el('span', { text: label })]),
      stepper.node,
    ]);

  const row = el('div', { class: 'row-3' }, [
    smallField('Wdh.', repsStepper),
    smallField('Sätze', setsStepper),
    smallField('Pos.', posStepper),
  ]);

  /* --- Foto + OCR --- */
  const fileInput = el('input', {
    type: 'file',
    accept: 'image/*',
    capture: 'environment',
    style: 'display:none',
  });

  const thumbSlot = el('span');
  const ocrSlot = el('div', { class: 'ocr', style: 'display:none' });

  const photoBtn = el('button', { class: 'photo-btn', type: 'button' }, [
    document.createTextNode('📷  Einstellung fotografieren'),
  ]);
  photoBtn.addEventListener('click', () => fileInput.click());

  let ocrTarget = 'weight';

  const applyNumber = (n) => {
    haptic(18);
    if (ocrTarget === 'weight') {
      weightStepper.set(n);
      draft.weight = n;
      toast(`Gewicht: ${fmtNum(n)} kg`);
    } else {
      posStepper.set(Math.round(n));
      draft.pos = Math.round(n);
      toast(`Position: ${Math.round(n)}`);
    }
  };

  const renderOcr = (result) => {
    ocrSlot.replaceChildren();
    ocrSlot.style.display = '';

    if (result.pending) {
      ocrSlot.append(
        el('div', { style: 'color:var(--muted);font-size:14px' }, [
          el('span', { class: 'spinner' }),
          document.createTextNode('  ' + (result.status || 'Zahlen werden gesucht …')),
        ])
      );
      return;
    }

    if (!result.all.length) {
      ocrSlot.append(
        el('div', {
          style: 'color:var(--muted);font-size:13px',
          text: result.error
            ? `Keine Erkennung möglich: ${result.error}`
            : 'Keine Zahlen erkannt – Werte bitte per +/− einstellen. Das Foto ist gespeichert.',
        })
      );
      return;
    }

    const targetRow = el('div', { class: 'ocr-target' });
    const mkTarget = (key, label) => {
      const b = el('button', {
        type: 'button',
        text: label,
        'aria-pressed': ocrTarget === key,
        onclick: () => {
          ocrTarget = key;
          [...targetRow.children].forEach((c) =>
            c.setAttribute('aria-pressed', c === b ? 'true' : 'false')
          );
        },
      });
      return b;
    };
    targetRow.append(mkTarget('weight', 'einsetzen als Gewicht'), mkTarget('pos', 'als Pos.'));

    const chips = el('div', { class: 'chips' });
    for (const n of result.all.slice(0, 8)) {
      chips.append(
        el('button', {
          type: 'button',
          class: 'chip' + (n === result.weight ? ' best' : ''),
          text: fmtNum(n),
          onclick: () => applyNumber(n),
        })
      );
    }

    ocrSlot.append(
      el('div', {
        style: 'font-size:12px;color:var(--muted);margin-bottom:8px',
        text: `Erkannte Zahlen (${result.engine}) – antippen zum Übernehmen:`,
      }),
      targetRow,
      chips
    );
  };

  const clearPhoto = () => {
    draft.photoBlob = null;
    thumbSlot.replaceChildren();
    ocrSlot.style.display = 'none';
    ocrSlot.replaceChildren();
    fileInput.value = '';
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const small = await shrinkImage(file);
      draft.photoBlob = small;

      thumbSlot.replaceChildren(
        el('span', { class: 'photo-thumb' }, [
          el('img', { src: objectUrl(small), alt: 'Foto der Einstellung' }),
          el('button', { class: 'x', type: 'button', text: '×', 'aria-label': 'Foto entfernen', onclick: clearPhoto }),
        ])
      );

      renderOcr({ pending: true, all: [] });
      const result = await readNumbersFromImage(file, {
        weightStep: step,
        onProgress: (status, progress) => {
          const label =
            status === 'recognizing text'
              ? `Zahlen werden gesucht … ${Math.round((progress || 0) * 100)} %`
              : 'Erkennung wird geladen …';
          renderOcr({ pending: true, all: [], status: label });
        },
      });
      renderOcr(result);
      if (result.weight != null) haptic(25);
    } catch (err) {
      toast('Foto konnte nicht verarbeitet werden.');
      console.error(err);
    }
  });

  const photoField = el('div', { class: 'field' }, [
    el('div', { class: 'photo-row' }, [photoBtn, thumbSlot]),
    ocrSlot,
    fileInput,
  ]);

  /* --- Notiz --- */
  const noteInput = el('textarea', {
    class: 'note',
    placeholder: 'Notiz (optional)',
    rows: 1,
    oninput: (e) => (draft.note = e.target.value),
  });
  // Muss über die Eigenschaft gesetzt werden – ein value-Attribut ignoriert
  // ein <textarea>. Ohne das stünde eine gespeicherte Notiz zwar in den Daten,
  // das Feld sähe aber leer aus und ließe sich nicht leeren.
  noteInput.value = draft.note;
  const noteField = el('div', { class: 'field' }, [
    el('div', { class: 'label' }, [el('span', { text: 'Notiz' })]),
    noteInput,
  ]);

  /* --- Speichern --- */
  const saveBtn = el('button', {
    class: 'primary',
    type: 'button',
    text: heute ? 'Heutigen Eintrag aktualisieren' : 'Speichern',
  });
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      // Foto: ein neues ersetzt das alte, sonst bleibt das vorhandene stehen.
      let photoId = heute ? heute.photoId || null : null;
      if (draft.photoBlob) {
        if (photoId) await db.deletePhoto(photoId);
        photoId = await db.savePhoto(draft.photoBlob);
      }

      await db.saveEntry({
        id: heute ? heute.id : undefined, // gleiche ID = überschreiben
        exerciseId: ex.id,
        date: new Date().toISOString(),
        weight: draft.weight,
        reps: draft.reps,
        sets: draft.sets,
        pos: draft.pos || 0,
        note: draft.note.trim(),
        photoId,
      });
      haptic(30);
      toast(`${ex.name}: ${fmtNum(draft.weight)} kg ${heute ? 'aktualisiert' : 'gespeichert'}`);
      go('#/');
    } catch (err) {
      console.error(err);
      toast('Speichern fehlgeschlagen.');
      saveBtn.disabled = false;
    }
  });

  main.append(weightField, row, photoField, noteField, saveBtn);

  /* Heutigen Eintrag verwerfen – ohne dass man dafür in die Verlaufsliste muss. */
  if (heute) {
    main.append(
      el('button', {
        class: 'secondary danger',
        type: 'button',
        text: '🗑  Heutigen Eintrag löschen',
        onclick: async () => {
          const ok = await confirmDialog(
            'Heutigen Eintrag löschen?',
            `${fmtNum(heute.weight)} kg · ${heute.sets}×${heute.reps}. Ältere Einträge dieser Übung bleiben erhalten.`,
            'Löschen'
          );
          if (!ok) return;
          await db.deleteEntry(heute.id);
          toast('Heutiger Eintrag gelöscht');
          viewEntry(exId);
        },
      })
    );
  }

  /* --- Historie --- */
  if (entries.length) {
    main.append(el('div', { class: 'section-title', text: `Verlauf (${entries.length})` }));
    const chart = sparkline(entries);
    if (chart) main.append(chart);

    const hist = el('div', { class: 'hist', style: 'margin-top:8px' });
    for (const e of entries.slice(0, 30)) {
      const row = el('div', { class: 'hist-row' }, [
        el('span', { class: 'date', text: fmtDateLong(e.date) }),
        el('span', { class: 'vals' }, [
          document.createTextNode(`${fmtNum(e.weight)} kg · ${e.sets}×${e.reps}`),
          e.pos || e.note
            ? el('em', {
                text: [e.pos ? `Pos. ${e.pos}` : null, e.note || null].filter(Boolean).join(' · '),
              })
            : null,
        ]),
        el('button', {
          class: 'icon-btn danger',
          type: 'button',
          text: '🗑',
          'aria-label': 'Eintrag löschen',
          onclick: async () => {
            if (await confirmDialog('Eintrag löschen?', `${fmtDate(e.date)} · ${fmtNum(e.weight)} kg`, 'Löschen')) {
              await db.deleteEntry(e.id);
              viewEntry(exId);
            }
          },
        }),
      ]);

      if (e.photoId) {
        db.getPhoto(e.photoId).then((blob) => {
          if (blob) row.insertBefore(el('img', { src: objectUrl(blob), alt: 'Einstellung', loading: 'lazy' }), row.lastChild);
        });
      }
      hist.append(row);
    }
    main.append(hist);
  }
}

async function exerciseMenu(ex) {
  const action = await showDialog(
    (finish) => [
      el('h2', { text: ex.name }),
      el('div', { class: 'settings-list' }, [
        el('button', {
          class: 'secondary',
          type: 'button',
          text: 'Umbenennen',
          onclick: () => finish('rename'),
        }),
        el('button', {
          class: 'secondary',
          type: 'button',
          text: `Gewichtsschritt: ${fmtNum(ex.weightStep || 4.5)} kg`,
          onclick: () => finish('step'),
        }),
        el('button', {
          class: 'secondary',
          type: 'button',
          text: `Muskelgruppe: ${reihenfolge.GRUPPEN[reihenfolge.gruppeVon(ex)]}`,
          onclick: () => finish('muskel'),
        }),
        el('button', {
          class: 'secondary',
          type: 'button',
          text: ex.iconPhotoId ? '🖼  Bild ersetzen' : '🖼  Eigenes Bild wählen',
          onclick: () => finish('bild'),
        }),
        ex.iconPhotoId
          ? el('button', {
              class: 'secondary',
              type: 'button',
              text: '↩  Zurück zum Symbol',
              onclick: () => finish('bild-weg'),
            })
          : null,
        el('button', {
          class: 'secondary danger',
          type: 'button',
          text: 'Übung ausblenden',
          onclick: () => finish('archive'),
        }),
        el('button', {
          class: 'secondary danger',
          type: 'button',
          text: '⚠  Übung endgültig löschen',
          onclick: () => finish('delete'),
        }),
      ]),
      el('div', { class: 'dialog-actions' }, [
        el('button', { type: 'button', text: 'Schließen', onclick: () => finish(null) }),
      ]),
    ],
    { onDismiss: null }
  );

  if (action === 'rename') {
    const name = await promptDialog('Übung umbenennen', { value: ex.name });
    if (name && name.trim()) {
      // Hatte die Übung noch kein passendes Symbol, unter dem neuen Namen
      // vielleicht schon – etwa wenn aus „Gerät 3" ein „Trizeps" wird.
      const icon = ex.icon === 'standard' ? iconFuerName(name.trim()) : ex.icon;
      await db.saveExercise({ ...ex, name: name.trim(), icon });
      viewEntry(ex.id);
    }
  } else if (action === 'step') {
    const v = await promptDialog('Gewichtsschritt in kg', {
      value: String(ex.weightStep || 4.5).replace('.', ','),
    });
    const parsed = parseFloat(String(v).replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      await db.saveExercise({ ...ex, weightStep: parsed });
      viewEntry(ex.id);
    }
  } else if (action === 'muskel') {
    // Nötig für Übungen, deren Name kein Symbol trifft: die bekämen sonst
    // dauerhaft die Ersatzgruppe und würden den Reihenfolge-Vorschlag verzerren.
    const gewaehlt = await showDialog(
      (finish) => [
        el('h2', { text: 'Muskelgruppe' }),
        el('p', {
          style: 'color:var(--muted);font-size:13px;margin:0 0 10px',
          text: 'Danach richtet sich der Reihenfolge-Vorschlag: gleiche Gruppen werden auseinandergezogen.',
        }),
        el(
          'div',
          { class: 'settings-list' },
          Object.entries(reihenfolge.GRUPPEN).map(([id, label]) =>
            el('button', {
              class: 'secondary',
              type: 'button',
              text: label + (reihenfolge.gruppeVon(ex) === id ? '  ✓' : ''),
              onclick: () => finish(id),
            })
          )
        ),
        el('div', { class: 'dialog-actions' }, [
          el('button', { type: 'button', text: 'Abbrechen', onclick: () => finish(null) }),
        ]),
      ],
      { onDismiss: null }
    );
    if (gewaehlt) {
      await db.saveExercise({ ...ex, muskel: gewaehlt });
      toast(`Muskelgruppe: ${reihenfolge.GRUPPEN[gewaehlt]}`);
      viewEntry(ex.id);
    }
  } else if (action === 'bild') {
    const blob = await bildWaehlen();
    if (blob) {
      // Altes Bild löschen, sonst bleibt es als Waise in der Datenbank liegen.
      if (ex.iconPhotoId) await db.deletePhoto(ex.iconPhotoId);
      const photoId = await db.savePhoto(blob);
      await db.saveExercise({ ...ex, iconPhotoId: photoId });
      toast('Bild gesetzt');
      viewEntry(ex.id);
    }
  } else if (action === 'bild-weg') {
    if (ex.iconPhotoId) await db.deletePhoto(ex.iconPhotoId);
    await db.saveExercise({ ...ex, iconPhotoId: null });
    toast('Wieder das Symbol');
    viewEntry(ex.id);
  } else if (action === 'archive') {
    const ok = await confirmDialog(
      'Übung ausblenden?',
      'Sie verschwindet aus der Liste. Die Einträge bleiben erhalten und lassen sich in den Einstellungen wieder einblenden.',
      'Ausblenden'
    );
    if (ok) {
      await db.setArchived(ex.id, true);
      go('#/');
    }
  } else if (action === 'delete') {
    // Vor der Warnung zählen, damit dort steht, was tatsächlich verloren geht –
    // „alle Daten" ist als Warnung zu vage, um eine Entscheidung zu tragen.
    const anzahl = await db.zaehleEintraege(ex.id);
    const ok = await confirmDialog(
      `„${ex.name}“ endgültig löschen?`,
      anzahl
        ? `${anzahl} ${anzahl === 1 ? 'Eintrag' : 'Einträge'} samt Fotos werden mitgelöscht. Das lässt sich nicht rückgängig machen – nur über ein Backup. Zum bloßen Aufräumen der Liste reicht „Ausblenden“.`
        : 'Die Übung hat keine Einträge, es geht also nichts verloren.',
      'Endgültig löschen'
    );
    if (ok) {
      const res = await db.deleteExercise(ex.id);
      toast(
        res.eintraege
          ? `„${ex.name}“ und ${res.eintraege} ${res.eintraege === 1 ? 'Eintrag' : 'Einträge'} gelöscht`
          : `„${ex.name}“ gelöscht`,
        3500
      );
      go('#/');
    }
  }
}

/* ---------------- Ansicht: Reihenfolge ---------------- */

/**
 * Reihenfolge ändern – mit ↑/↓ statt Ziehen.
 *
 * Ziehen-und-Ablegen ist auf dem Handy heikel: es kollidiert mit dem Scrollen
 * und trifft bei 14 Zeilen selten auf Anhieb. Zwei große Knöpfe je Zeile sind
 * langweiliger, aber im Studio mit einer Hand zuverlässig bedienbar.
 */
async function viewSortieren() {
  setTop('Reihenfolge', { left: iconBtn('←', 'Zurück', () => go('#/')) });
  const main = $('#main');
  main.replaceChildren();

  let liste = await db.getExercises();
  if (liste.length < 2) {
    main.append(el('p', { class: 'empty', text: 'Dafür braucht es mindestens zwei Übungen.' }));
    return;
  }

  const inhalt = el('div');

  const zeichne = () => {
    inhalt.replaceChildren();

    const abstand = reihenfolge.engsterAbstand(liste);
    inhalt.append(
      el('div', { class: 'field', style: 'margin-bottom:12px' }, [
        el('div', {
          style: 'font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:10px',
          html:
            `Engster Abstand zwischen zwei Übungen derselben Muskelgruppe: <strong>${
              abstand === Infinity ? '–' : abstand
            }</strong>. ` + 'Je größer, desto mehr Erholung liegt dazwischen.',
        }),
        el('button', {
          class: 'secondary',
          type: 'button',
          text: '✨  Sinnvolle Reihenfolge vorschlagen',
          onclick: () => {
            const neu = reihenfolge.vorschlagen(liste);
            const vorher = reihenfolge.engsterAbstand(liste);
            const nachher = reihenfolge.engsterAbstand(neu);
            liste = neu;
            zeichne();
            toast(
              nachher > vorher
                ? `Abstand von ${vorher} auf ${nachher} verbessert`
                : 'Deine Reihenfolge war schon so gut wie möglich',
              3500
            );
          },
        }),
      ])
    );

    const rows = el('div', { class: 'sort-list' });
    liste.forEach((ex, i) => {
      const tausche = (von, nach) => {
        [liste[von], liste[nach]] = [liste[nach], liste[von]];
        haptic();
        zeichne();
      };
      rows.append(
        el('div', { class: 'sort-row' }, [
          el('span', { class: 'sort-nr', text: String(i + 1) }),
          exerciseIcon(ex, { size: 30 }),
          el('span', { class: 'sort-main' }, [
            el('span', { class: 'sort-name', text: ex.name }),
            el('span', {
              class: 'sort-gruppe',
              text: reihenfolge.GRUPPEN[reihenfolge.gruppeVon(ex)],
            }),
          ]),
          el('button', {
            class: 'sort-btn',
            type: 'button',
            text: '↑',
            'aria-label': `${ex.name} nach oben`,
            disabled: i === 0 ? true : null,
            onclick: () => tausche(i, i - 1),
          }),
          el('button', {
            class: 'sort-btn',
            type: 'button',
            text: '↓',
            'aria-label': `${ex.name} nach unten`,
            disabled: i === liste.length - 1 ? true : null,
            onclick: () => tausche(i, i + 1),
          }),
        ])
      );
    });
    inhalt.append(rows);

    inhalt.append(
      el('button', {
        class: 'primary',
        type: 'button',
        style: 'margin-top:14px',
        text: 'Reihenfolge übernehmen',
        onclick: async () => {
          await db.setReihenfolge(liste.map((e) => e.id));
          toast('Reihenfolge gespeichert');
          go('#/');
        },
      })
    );
  };

  zeichne();
  main.append(inhalt);
}

/* ---------------- Ansicht: Statistik ---------------- */

/**
 * Bewusst nur drei Werte, alle auf den letzten Monat bezogen:
 *   1. mittlere prozentuale Steigerung der Gewichte
 *   2. Anzahl der Studiobesuche
 *   3. Steigerung je Übung in Kilogramm
 */
async function viewStats() {
  setTop('Statistik');

  const main = $('#main');
  main.replaceChildren();

  const [alleEintraege, uebungen] = await Promise.all([
    db.getAllEntries(),
    db.getExercises({ includeArchived: true }),
  ]);

  if (!alleEintraege.length) {
    main.append(
      el('p', {
        class: 'empty',
        text: 'Noch keine Einträge. Sobald du im Reiter „Übungen“ etwas speicherst, entsteht hier die Auswertung.',
      })
    );
    return;
  }

  const b = stats.monatsbilanz(alleEintraege, uebungen);



  /* 1) Mittlere prozentuale Steigerung */
  const proz = b.mittlereSteigerungProzent;
  main.append(
    el('div', { class: 'hero' }, [
      el('div', { class: 'hero-label', text: `Ø Steigerung – letzte ${b.tage} Tage` }),
      proz === null
        ? el('div', { class: 'hero-value muted-value', text: '–' })
        : el('div', { class: 'hero-value' }, [
            document.createTextNode(`${proz >= 0 ? '+' : '−'}${charts.fmt(Math.abs(proz), 1)}`),
            el('span', { class: 'hero-unit', text: ' %' }),
          ]),
      el('div', {
        class: 'hero-delta muted',
        text:
          proz === null
            ? 'Dafür braucht es mindestens zwei Einträge bei derselben Übung.'
            : `Mittel über ${b.bewerteteUebungen} ${b.bewerteteUebungen === 1 ? 'Übung' : 'Übungen'} mit mindestens zwei Einträgen`,
      }),
    ])
  );

  /* 2) Studiobesuche der letzten Woche */
  main.append(
    el('div', { class: 'stat-wide' }, [
      el('div', {}, [
        el('div', { class: 'stat-label', text: `Im Studio – letzte ${b.besucheTage} Tage` }),
        el('div', {
          class: 'stat-sub',
          text: `${b.besucheEintraege} ${b.besucheEintraege === 1 ? 'Eintrag' : 'Einträge'} · mehrere Geräte am selben Tag zählen als ein Besuch`,
        }),
      ]),
      el('div', { class: 'stat-wide-value' }, [
        document.createTextNode(String(b.besuche)),
        el('span', { class: 'stat-wide-unit', text: ' Mal' }),
      ]),
    ])
  );

  /* 3) Steigerung je Übung in kg */
  const liste = el('div', { class: 'sm-list' });
  for (const f of b.proUebung) {
    const ex = uebungen.find((u) => u.id === f.id) || { icon: 'standard', name: f.name };
    const deltaText =
      f.delta === null
        ? 'nur 1×'
        : f.delta === 0
          ? '±0 kg'
          : `${f.delta > 0 ? '+' : '−'}${fmtNum(Math.abs(f.delta))} kg`;

    liste.append(
      el(
        'button',
        {
          class: 'sm-row',
          type: 'button',
          onclick: () => go(`#/ex/${f.id}`),
          'aria-label': `${f.name}: ${
            f.delta === null ? 'nur ein Eintrag' : `${fmtNum(f.von)} auf ${fmtNum(f.bis)} Kilogramm`
          }`,
        },
        [
          exerciseIcon(ex, { size: 34 }),
          el('span', { class: 'sm-main' }, [
            el('span', { class: 'sm-name', text: f.name }),
            el('span', {
              class: 'sm-range',
              text:
                f.delta === null
                  ? `${fmtNum(f.bis)} kg`
                  : `${fmtNum(f.von)} → ${fmtNum(f.bis)} kg`,
            }),
          ]),
          el('span', {
            class:
              'sm-delta ' +
              (f.delta === null ? 'muted' : f.delta > 0 ? 'up' : f.delta < 0 ? 'down' : 'flat'),
            text: deltaText,
          }),
        ]
      )
    );
  }

  main.append(
    el('div', { class: 'ch-card' }, [
      el('div', { class: 'ch-head' }, [
        el('h3', { class: 'ch-title', text: 'Steigerung je Übung' }),
        el('p', {
          class: 'ch-sub',
          text: b.proUebung.length
            ? 'Erster gegen letzten Eintrag im letzten Monat, größter Zuwachs oben. Tippen öffnet die Übung.'
            : 'Im letzten Monat wurde noch nichts eingetragen.',
        }),
      ]),
      liste,
    ])
  );
}

/* ---------------- Einstellungen: Farben ---------------- */

async function farbEinstellungen() {
  const farben = await farbenLaden();
  const karte = el('div', { class: 'field' });

  karte.append(
    el('div', {
      style: 'font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.5',
      text: 'Die Übungen in der Liste färben sich nach dem, was du heute schon geschafft hast. Die Schriftfarbe passt sich automatisch an die Helligkeit an.',
    })
  );

  const speichern = async () => {
    await db.setMeta(FARBEN_KEY, farben);
  };

  for (const z of ZUSTAENDE) {
    const aktiv = farben[z.id] !== null && farben[z.id] !== undefined;

    const probe = el('span', { class: 'farb-probe', text: 'Aa' });
    const setzeProbe = () => {
      const f = farben[z.id];
      if (f) {
        probe.style.background = f;
        const s = schriftFarbeFuer(f);
        probe.style.color = s ? s.ink : 'var(--text)';
        probe.style.borderColor = f;
      } else {
        probe.style.background = 'var(--surface-2)';
        probe.style.color = 'var(--muted)';
        probe.style.borderColor = 'var(--line)';
      }
    };
    setzeProbe();

    const waehler = el('input', {
      type: 'color',
      value: farben[z.id] || '#cccccc',
      'aria-label': `Farbe für ${z.label}`,
    });
    waehler.addEventListener('input', async () => {
      farben[z.id] = waehler.value;
      setzeProbe();
      an.checked = true;
      await speichern();
    });

    // Ohne Häkchen bleibt der Zustand ungefärbt – nötig für „heute noch nicht
    // dran", wo die normale Kartenfarbe die ruhigste Wahl ist.
    const an = el('input', { type: 'checkbox', ...(aktiv ? { checked: true } : {}) });
    an.addEventListener('change', async () => {
      farben[z.id] = an.checked ? waehler.value : null;
      setzeProbe();
      await speichern();
    });

    karte.append(
      el('div', { class: 'farb-zeile' }, [
        probe,
        el('span', { class: 'farb-label', text: z.label }),
        waehler,
        el('label', { class: 'farb-an', title: 'Einfärben' }, [an]),
      ])
    );
  }

  karte.append(
    el('button', {
      class: 'secondary',
      type: 'button',
      text: '↩  Standardfarben wiederherstellen',
      onclick: async () => {
        await db.setMeta(FARBEN_KEY, null);
        toast('Farben zurückgesetzt');
        viewSettings();
      },
    })
  );

  return karte;
}

/* ---------------- Einstellungen: Speicher & Drive ---------------- */

/** Zeigt, ob der Browser die Daten dauerhaft hält und wie viel belegt ist. */
async function speicherZeile() {
  let text = 'Speicherstatus nicht abfragbar.';
  try {
    const dauerhaft = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    const schaetzung = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const belegt = schaetzung?.usage ? `${charts.fmt(schaetzung.usage / 1048576, 1)} MB belegt` : 'Größe unbekannt';
    text = dauerhaft
      ? `Dauerhaft geschützt · ${belegt}. Chrome räumt die Daten bei knappem Speicher nicht weg.`
      : `Nicht dauerhaft geschützt · ${belegt}. Bei sehr knappem Gerätespeicher darf Chrome die Daten löschen – umso wichtiger ist die Sicherung.`;
  } catch {
    /* Anzeige ist Beiwerk, kein Grund für einen Fehler */
  }
  return el('div', {
    style: 'font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.45',
    text,
  });
}

async function driveKarte() {
  const e = await backup.einstellungen();
  const karte = el('div', { class: 'field' });
  const neu = () => viewSettings();

  const status = el('div', { style: 'font-size:13px;line-height:1.5;margin-bottom:12px' });
  if (!e.clientId) {
    status.append(
      el('div', {
        style: 'color:var(--muted)',
        html:
          'Noch nicht eingerichtet. Dafür brauchst du eine <strong>Client-ID</strong> und einen ' +
          '<strong>API-Schlüssel</strong> aus der Google Cloud Console – die Schritte stehen in der README ' +
          'unter „Sicherung in Google Drive“.',
      })
    );
  } else if (!e.ordnerId) {
    status.append(el('div', { style: 'color:var(--muted)', text: 'Zugangsdaten hinterlegt. Jetzt noch den Zielordner wählen.' }));
  } else {
    const wann = e.letzteSicherung
      ? new Date(e.letzteSicherung).toLocaleString('de-DE', {
          day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
        })
      : 'noch nie';
    const arbeit = await backup.offeneArbeit();
    status.append(
      el('div', {}, [
        document.createTextNode('Ordner: '),
        el('strong', { text: e.ordnerName || e.ordnerId }),
      ]),
      el('div', { style: 'color:var(--muted)', text: `Letzte Sicherung: ${wann}` }),
      el('div', {
        style: `color:${arbeit.noetig ? 'var(--danger)' : 'var(--good)'};font-weight:600`,
        text: arbeit.noetig ? `Offen: ${arbeit.grund}` : 'Auf dem neuesten Stand',
      })
    );
  }
  karte.append(status);

  /* Zugangsdaten */
  karte.append(
    el('button', {
      class: 'secondary',
      type: 'button',
      text: e.clientId ? '🔑  Zugangsdaten ändern' : '🔑  Zugangsdaten eintragen',
      onclick: async () => {
        const cid = await promptDialog('OAuth-Client-ID', {
          value: e.clientId,
          placeholder: '…apps.googleusercontent.com',
        });
        if (cid === null) return;
        const key = await promptDialog('API-Schlüssel (für die Ordnerauswahl)', { value: e.apiKey });
        if (key === null) return;
        await db.setMeta(backup.SCHLUESSEL.clientId, cid.trim());
        await db.setMeta(backup.SCHLUESSEL.apiKey, key.trim());
        toast('Zugangsdaten gespeichert');
        neu();
      },
    })
  );

  if (e.clientId) {
    karte.append(
      el('button', {
        class: 'secondary',
        type: 'button',
        text: e.ordnerId ? '📁  Anderen Ordner wählen' : '📁  Ordner in Drive wählen',
        onclick: async () => {
          try {
            toast('Google wird geöffnet …');
            const ordner = await drive.ordnerWaehlen({ clientId: e.clientId, apiKey: e.apiKey });
            if (!ordner) return toast('Abgebrochen');
            await db.setMeta(backup.SCHLUESSEL.ordnerId, ordner.id);
            await db.setMeta(backup.SCHLUESSEL.ordnerName, ordner.name);
            await db.setMeta(backup.SCHLUESSEL.dateiId, ''); // im neuen Ordner neu suchen
            toast(`Ordner „${ordner.name}“ gewählt`);
            neu();
          } catch (err) {
            toast(`Ordnerauswahl fehlgeschlagen: ${err.message}`, 5000);
          }
        },
      })
    );
  }

  if (backup.eingerichtet(e)) {
    karte.append(
      el('button', {
        class: 'secondary',
        type: 'button',
        text: '☁  Jetzt sichern',
        onclick: async (ev) => {
          const b = ev.currentTarget;
          b.disabled = true;
          b.textContent = '☁  Sichere …';
          const res = await backup.sichern({ interaktiv: true });
          b.disabled = false;
          if (res.ok) {
            toast(`Gesichert: ${charts.fmt(Math.round(res.bytes / 1024), 0)} KB`);
            neu();
          } else {
            b.textContent = '☁  Jetzt sichern';
            toast(`Fehlgeschlagen: ${res.grund}`, 5000);
          }
        },
      }),
      el('button', {
        class: 'secondary',
        type: 'button',
        text: '⤓  Aus Drive wiederherstellen',
        onclick: async () => {
          const ok = await confirmDialog(
            'Aus Drive wiederherstellen?',
            'Die Sicherung wird mit den Daten auf diesem Gerät zusammengeführt. Einträge, die es hier schon gibt, bleiben erhalten.',
            'Holen'
          );
          if (!ok) return;
          try {
            toast('Wird geholt …');
            const c = await backup.wiederherstellen({ interaktiv: true });
            toast(importMeldung(c), 4000);
            neu();
          } catch (err) {
            toast(`Fehlgeschlagen: ${err.message}`, 5000);
          }
        },
      }),
      schalter('Automatisch beim Verlassen der App sichern', e.auto, async (an) => {
        await db.setMeta(backup.SCHLUESSEL.auto, an);
      }),
      schalter('Fotos mitsichern (größer, aber vollständig)', e.mitFotos, async (an) => {
        await db.setMeta(backup.SCHLUESSEL.mitFotos, an);
      }),
      el('button', {
        class: 'secondary danger',
        type: 'button',
        text: 'Verbindung zu Drive lösen',
        onclick: async () => {
          const ok = await confirmDialog(
            'Verbindung lösen?',
            'Die Zugangsdaten werden von diesem Gerät entfernt. Die Sicherungsdatei in deinem Drive bleibt bestehen.',
            'Lösen'
          );
          if (!ok) return;
          drive.abmelden();
          for (const k of ['clientId', 'apiKey', 'ordnerId', 'ordnerName', 'dateiId', 'letzteSicherung'])
            await db.setMeta(backup.SCHLUESSEL[k], k === 'letzteSicherung' ? null : '');
          toast('Verbindung gelöst');
          neu();
        },
      })
    );
  }

  return karte;
}

/** Schalter-Zeile mit Beschriftung. */
function schalter(label, an, onChange) {
  const box = el('input', { type: 'checkbox', ...(an ? { checked: true } : {}) });
  box.addEventListener('change', async () => {
    await onChange(box.checked);
    toast(box.checked ? `${label}: an` : `${label}: aus`);
  });
  return el('label', { class: 'schalter' }, [box, el('span', { text: label })]);
}

/* ---------------- Ansicht: Einstellungen ---------------- */

async function viewSettings() {
  setTop('Einstellungen');

  const main = $('#main');
  main.replaceChildren();

  const all = await db.getExercises({ includeArchived: true });
  const entries = await db.getAllEntries();
  const archived = all.filter((e) => e.archived);

  /* Farben der Übungsliste */
  main.append(el('div', { class: 'section-title', text: 'Farben der Übungsliste' }));
  main.append(await farbEinstellungen());

  /* Google Drive */
  main.append(el('div', { class: 'section-title', text: 'Sicherung in Google Drive' }));
  main.append(await driveKarte());

  /* Backup */
  main.append(
    el('div', { class: 'section-title', text: 'Daten auf diesem Gerät' }),
    el('div', { class: 'field' }, [
      el('div', {
        style: 'font-size:13px;color:var(--muted);margin-bottom:10px',
        text: `${entries.length} Einträge, ${all.length - archived.length} aktive Übungen.`,
      }),
      await speicherZeile(),
      el('button', {
        class: 'secondary',
        type: 'button',
        text: '⬇  Backup exportieren (mit Fotos)',
        onclick: () => doExport(true),
      }),
      el('button', {
        class: 'secondary',
        type: 'button',
        text: '⬇  Nur Zahlen exportieren (klein)',
        onclick: () => doExport(false),
      }),
      el('button', {
        class: 'secondary',
        type: 'button',
        text: '⬆  Backup importieren',
        onclick: doImport,
      }),
    ])
  );

  /* Ausgeblendete Übungen */
  if (archived.length) {
    main.append(el('div', { class: 'section-title', text: 'Ausgeblendete Übungen' }));
    const list = el('div', { class: 'settings-list' });
    for (const ex of archived) {
      list.append(
        el('div', { class: 'row' }, [
          el('div', { class: 'grow' }, [
            document.createTextNode(ex.name),
            el('div', { class: 'sub', text: `${entries.filter((e) => e.exerciseId === ex.id).length} Einträge` }),
          ]),
          el('button', {
            class: 'pill',
            type: 'button',
            text: 'Einblenden',
            onclick: async () => {
              await db.setArchived(ex.id, false);
              viewSettings();
            },
          }),
        ])
      );
    }
    main.append(list);
  }

  /* Info */
  main.append(
    el('div', { class: 'section-title', text: 'Über' }),
    el('div', { class: 'field' }, [
      el('div', {
        style: 'font-size:13px;color:var(--muted)',
        html: `Texterkennung: <strong>${ocrStatus.native ? 'im Browser eingebaut (offline)' : 'nicht eingebaut – lädt bei Bedarf Tesseract aus dem Netz'}</strong>.<br>
               Version 1.0 · alle Daten lokal, keine Konten, kein Server.`,
      }),
    ])
  );
}

async function doExport(withPhotos) {
  toast('Export wird erstellt …');
  const data = await db.exportAll({ includePhotos: withPhotos });
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `pump-tracker-${stamp}${withPhotos ? '' : '-ohne-fotos'}.json`;

  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Pump Tracker Backup' });
      return;
    } catch {
      /* abgebrochen – dann eben als Download */
    }
  }
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast(`${name} gespeichert`);
}

/** Meldung nach einem Import – nur nennen, was tatsächlich passiert ist. */
function importMeldung(c) {
  const teile = [`${c.entries} Einträge`];
  if (c.photos) teile.push(`${c.photos} Fotos`);
  if (c.neu) teile.push(`${c.neu} neue Übungen`);
  if (c.merged) teile.push(`${c.merged} Übungen zusammengeführt`);
  return `Eingespielt: ${teile.join(', ')}`;
}

function doImport() {
  const input = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const counts = await db.importAll(data);
      toast(importMeldung(counts), 4000);
      viewSettings();
    } catch (err) {
      toast(`Import fehlgeschlagen: ${err.message}`);
    } finally {
      input.remove();
    }
  });
  document.body.append(input);
  input.click();
}

/* ---------------- Rahmen & Router ---------------- */

function iconBtn(glyph, label, onclick) {
  return el('button', { class: 'icon-btn', type: 'button', text: glyph, 'aria-label': label, onclick });
}

function setTop(title, { left = null, right = [] } = {}) {
  const bar = $('#topbar');
  bar.replaceChildren();
  if (left) bar.append(left);
  bar.append(el('h1', { text: title }));
  [].concat(right).forEach((b) => b && bar.append(b));
  document.title = title === 'Pump Tracker' ? title : `${title} · Pump Tracker`;
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

/* ---------------- Reiterleiste ---------------- */

const REITER = [
  { hash: '#/', glyph: '🏋', label: 'Übungen' },
  { hash: '#/stats', glyph: '📈', label: 'Statistik' },
  { hash: '#/settings', glyph: '⚙', label: 'Mehr' },
];

/** Welcher Reiter zu einem Pfad gehört – die Übungsseite zählt zu „Übungen“. */
function aktiverReiter(hash) {
  if (hash === '#/stats') return '#/stats';
  if (hash === '#/sortieren') return '#/';
  if (hash === '#/settings') return '#/settings';
  return '#/';
}

function renderTabs(hash) {
  const bar = $('#tabbar');
  const aktiv = aktiverReiter(hash);
  bar.replaceChildren();
  for (const r of REITER) {
    bar.append(
      el(
        'button',
        {
          class: 'tab' + (r.hash === aktiv ? ' active' : ''),
          type: 'button',
          'aria-current': r.hash === aktiv ? 'page' : null,
          onclick: () => go(r.hash),
        },
        [
          el('span', { class: 'tab-glyph', text: r.glyph, 'aria-hidden': 'true' }),
          el('span', { class: 'tab-label', text: r.label }),
        ]
      )
    );
  }
}

async function route() {
  revokeUrls();
  const hash = location.hash || '#/';
  renderTabs(hash);
  try {
    if (hash.startsWith('#/ex/')) await viewEntry(hash.slice(5));
    else if (hash === '#/stats') await viewStats();
    else if (hash === '#/sortieren') await viewSortieren();
    else if (hash === '#/settings') await viewSettings();
    else await viewList();
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    $('#main').replaceChildren(
      el('p', { class: 'empty', text: `Fehler: ${err.message}` })
    );
  }
}

window.addEventListener('hashchange', route);

/* ---------------- Sicherung: Automatik ---------------- */

let sicherungLaeuft = false;

async function autoSichern(anlass) {
  if (sicherungLaeuft) return;
  sicherungLaeuft = true;
  try {
    const res = await backup.sichernFallsNoetig({ interaktiv: false });
    if (res.ok) {
      console.info(`[Sicherung] ${anlass}: ${res.bytes} Bytes nach Drive`);
      // Beim Wegschalten sieht das ohnehin niemand – nur beim Start melden.
      if (anlass === 'Start') toast('Sicherung in Drive nachgeholt');
    } else if (res.grund && !['nichts zu tun', 'Automatik aus', 'nicht eingerichtet'].includes(res.grund)) {
      console.warn(`[Sicherung] ${anlass} fehlgeschlagen: ${res.grund}`);
      if (anlass === 'Start') toast(`Sicherung nicht möglich: ${res.grund}`, 4000);
    }
  } finally {
    sicherungLaeuft = false;
  }
}

/*
 * Beim Wegschalten sichern. Bewusst `visibilitychange` und nicht `beforeunload`:
 * Android feuert `beforeunload` beim Wechseln der App oft gar nicht.
 *
 * Kommt der Upload nicht mehr durch, weil das System die Seite einfriert,
 * bleibt in der Datenbank ein Merker stehen – der nächste Start holt es nach.
 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autoSichern('Wegschalten');
});

window.addEventListener('pagehide', () => autoSichern('Verlassen'));

/** Beim Start: Offenes nachholen und ggf. ans Sichern erinnern. */
async function starthilfe() {
  // Dauerhaften Speicher anfordern, damit Chrome die Daten bei knappem
  // Platz nicht wegräumen darf. Fragt auf Android nicht nach, sondern
  // entscheidet nach Nutzungsverhalten – ein Versuch kostet nichts.
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* nicht überall vorhanden */
  }

  await autoSichern('Start');

  if (await backup.erinnerungFaellig()) {
    const ok = await confirmDialog(
      'Sicherung fällig',
      `Seit der letzten Sicherung hat sich einiges angesammelt. Jetzt eine Backup-Datei erzeugen und teilen – z. B. nach Google Drive?`,
      'Sichern'
    );
    await backup.erinnerungVerschieben();
    if (ok) await doExport(true);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* z. B. beim Öffnen über file:// – die App läuft trotzdem, nur ohne Offline-Cache */
    });
  });
}

route();

// Erst zeichnen, dann im Hintergrund um die Sicherung kümmern – die App soll
// nie auf das Netz warten, bevor sie bedienbar ist.
starthilfe();
