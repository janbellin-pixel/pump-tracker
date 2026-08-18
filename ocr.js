/*
 * Zahlenerkennung im Foto der Geräteeinstellung.
 *
 * Zwei Wege, in dieser Reihenfolge:
 *  1. TextDetector – in Chrome für Android eingebaut (nutzt ML Kit). Offline,
 *     kostenlos, schnell. Das ist der Normalfall auf deinem Handy.
 *  2. Tesseract.js vom CDN – nur wenn TextDetector fehlt UND Internet da ist.
 *     Wird erst beim ersten Bedarf geladen (~2 MB), danach vom Browser gecacht.
 *
 * Wenn beides nicht geht, gibt es einfach keinen Vorschlag – das Foto wird
 * trotzdem gespeichert. Die Erkennung ist eine Abkürzung, keine Voraussetzung.
 */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

export const ocrStatus = {
  native: typeof window !== 'undefined' && 'TextDetector' in window,
};

/** Foto fürs Speichern verkleinern – volle Handy-Auflösung sprengt sonst die DB. */
export async function shrinkImage(file, maxSide = 1000, quality = 0.72) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Kontrastverstärkte Graustufen-Version fürs OCR. Gravierte oder gedruckte
 * Zahlen an Geräten sind oft flau; ohne diesen Schritt findet die Erkennung
 * deutlich weniger.
 */
async function prepareForOCR(blob, maxSide = 1400) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Graustufen + Histogramm
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // 5-%- und 95-%-Perzentil als Streckungsgrenzen
  const total = w * h;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.05) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.05) {
      hi = v;
      break;
    }
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function detectNative(canvas) {
  const detector = new window.TextDetector();
  const results = await detector.detect(canvas);
  return results.map((r) => r.rawValue).join('\n');
}

let tesseractLoading = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoading) return tesseractLoading;
  tesseractLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_CDN;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => {
      tesseractLoading = null;
      reject(new Error('Tesseract konnte nicht geladen werden (offline?).'));
    };
    document.head.appendChild(s);
  });
  return tesseractLoading;
}

async function detectTesseract(canvas, onProgress) {
  const T = await loadTesseract();
  const { data } = await T.recognize(canvas, 'eng', {
    logger: (m) => {
      if (onProgress) onProgress(m.status, m.progress);
    },
    tessedit_char_whitelist: '0123456789.,kgKG',
  });
  return data.text || '';
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

/**
 * Zahlen aus dem Text ziehen und bewerten.
 *
 * `weightStep` ist der Stapel-Raster der Übung (bei dir 4,5 kg). Zahlen, die
 * ein Vielfaches davon sind, sind mit hoher Wahrscheinlichkeit das Gewicht –
 * das ist das stärkste Signal, das wir haben.
 */
export function parseNumbers(text, { weightStep = 4.5 } = {}) {
  const found = [];
  const seen = new Set();
  // Ganze Zahl-Tokens matchen, nicht Teilstücke: sonst wird aus der
  // Seriennummer "88213" eine "13" und aus "2026" eine "202".
  const re = /(\d+)(?:[.,](\d+))?\s*(kg)?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1].length > 3) continue; // Serien-/Modellnummern
    if (m[2] && m[2].length > 2) continue; // keine echte Nachkommastelle
    const raw = m[2] ? Number(`${m[1]}.${m[2]}`) : Number(m[1]);
    if (!Number.isFinite(raw) || raw <= 0 || raw > 400) continue;
    const value = Math.round(raw * 10) / 10;
    const key = value.toFixed(1);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ value, hasKgSuffix: Boolean(m[3]) });
  }

  const scored = found.map((f) => {
    let score = 0;
    if (f.hasKgSuffix) score += 100;
    if (weightStep > 0) {
      const rest = Math.abs(f.value / weightStep - Math.round(f.value / weightStep));
      if (rest < 0.12) score += 60; // liegt auf dem Stapel-Raster
    }
    if (f.value >= 5 && f.value <= 200) score += 30; // plausibles Gerätegewicht
    if (f.value % 5 === 0 || f.value % 2.5 === 0) score += 10;
    if (f.value < 5) score -= 20; // eher Sitzposition als Gewicht
    return { ...f, score };
  });

  scored.sort((a, b) => b.score - a.score || b.value - a.value);

  return {
    all: scored.map((s) => s.value),
    weight: scored.length && scored[0].score > 0 ? scored[0].value : null,
    // Kleine Ganzzahlen sind die typischen Sitz-/Hebelpositionen.
    positions: scored
      .filter((s) => Number.isInteger(s.value) && s.value >= 1 && s.value <= 20)
      .map((s) => s.value),
  };
}

/**
 * Liest ein Foto und gibt Zahlvorschläge zurück.
 * Wirft nie – bei Fehlern kommt ein leeres Ergebnis mit `error`.
 */
export async function readNumbersFromImage(blob, { weightStep = 4.5, onProgress } = {}) {
  try {
    let text = '';
    let engine = null;

    if (ocrStatus.native) {
      try {
        const canvas = await prepareForOCR(blob, 1400);
        text = await withTimeout(detectNative(canvas), 15000, 'Zeitüberschreitung');
        engine = 'Handy-Erkennung';
      } catch {
        text = '';
      }
    }

    if (!text.trim()) {
      // Der Tesseract-Weg rechnet auf der CPU und ist deutlich langsamer –
      // deshalb kleineres Bild und eine harte Obergrenze, damit die App nicht
      // ewig auf ein Ergebnis wartet, das nie kommt.
      const canvas = await prepareForOCR(blob, 900);
      text = await withTimeout(
        detectTesseract(canvas, onProgress),
        60000,
        'Erkennung hat zu lange gedauert'
      );
      engine = 'Tesseract';
    }

    const parsed = parseNumbers(text, { weightStep });
    return { ...parsed, text, engine, error: null };
  } catch (err) {
    return { all: [], weight: null, positions: [], text: '', engine: null, error: err.message };
  }
}
