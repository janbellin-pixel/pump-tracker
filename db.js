/* Datenschicht: IndexedDB. Kein Framework, keine Abhängigkeiten. */

import { ICON_FUER_NAME, iconFuerName } from './exercise-icons.js';

const DB_NAME = 'pump-tracker';
// 2: Store "meta" für Einstellungen (Drive-Anbindung)
// 3: Übungen bekommen ein Symbol (icon) und optional ein eigenes Bild
// 4: Symbole neu zuordnen – neu hinzugekommene wirken sonst nicht rückwirkend
const DB_VERSION = 4;

// Die 14 Geräte vom Trainingsplan. weightStep 4.5 = 10-lbs-Platten im Stapel.
const DEFAULT_EXERCISES = [
  'Beinpresse',
  'Beinbeuger',
  'Abduktoren',
  'Adduktoren',
  'Gluteus',
  'Latzug',
  'Rückenstrecker',
  'Rudern',
  'Rotationstrainer',
  'Butterfly',
  'Butterfly Reverse',
  'Brustpresse',
  'Schulterpresse',
  'Bizeps',
];

let dbPromise = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('exercises')) {
        const s = db.createObjectStore('exercises', { keyPath: 'id' });
        s.createIndex('sort', 'sort');
      }
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('exerciseId', 'exerciseId');
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (ev.oldVersion < 1) {
        const s = req.transaction.objectStore('exercises');
        DEFAULT_EXERCISES.forEach((name, i) => {
          s.put({
            id: uid(),
            name,
            sort: i,
            weightStep: 4.5,
            archived: false,
            icon: ICON_FUER_NAME[name] || 'standard',
            iconPhotoId: null,
          });
        });
      }

      if (ev.oldVersion >= 1 && ev.oldVersion < 3) {
        // Bestehende Übungen nachträglich mit einem Symbol versehen. Über den
        // Namen, weil die IDs zufällig vergeben wurden.
        const s = req.transaction.objectStore('exercises');
        s.openCursor().onsuccess = (e) => {
          const c = e.target.result;
          if (!c) return;
          const ex = c.value;
          if (!ex.icon) {
            ex.icon = ICON_FUER_NAME[ex.name] || 'standard';
            ex.iconPhotoId = ex.iconPhotoId || null;
            c.update(ex);
          }
          c.continue();
        };
      }

      if (ev.oldVersion >= 3 && ev.oldVersion < 4) {
        /*
         * Symbole erneut zuordnen.
         *
         * Das Symbol wird beim Anlegen einer Übung festgeschrieben. Kommen
         * später neue hinzu, behalten früher angelegte Übungen dauerhaft ihr
         * 'standard' – genau das ist bei „Trizeps Pulldowns" und
         * „Bauchmuskeln" passiert. Deshalb bei jeder Erweiterung der Sammlung
         * die Datenbankversion hochzählen: dann läuft diese Zuordnung erneut.
         *
         * Angefasst wird nur, was auf 'standard' steht – eine bewusst
         * gewählte Zuordnung oder ein eigenes Foto bleibt unangetastet.
         */
        const s = req.transaction.objectStore('exercises');
        s.openCursor().onsuccess = (e) => {
          const c = e.target.result;
          if (!c) return;
          const ex = c.value;
          if (!ex.icon || ex.icon === 'standard') {
            const passend = iconFuerName(ex.name);
            if (passend !== ex.icon) {
              ex.icon = passend;
              c.update(ex);
            }
          }
          c.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const box = fn(t.objectStore(store), t);
        t.oncomplete = () =>
          resolve(box && typeof box === 'object' && 'value' in box ? box.value : box);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqValue(request) {
  const box = { value: undefined };
  request.onsuccess = () => {
    box.value = request.result;
  };
  return box;
}

/* ---------- Einstellungen (meta) ---------- */

export async function getMeta(key, fallback = null) {
  const rec = await tx('meta', 'readonly', (s) => reqValue(s.get(key)));
  return rec === undefined || rec === null ? fallback : rec.value;
}

export async function setMeta(key, value) {
  await tx('meta', 'readwrite', (s) => s.put({ key, value }));
  return value;
}

/**
 * Zähler, der bei jeder Änderung an den Trainingsdaten hochgeht.
 *
 * Damit weiß die Sicherung, ob sich seit dem letzten Hochladen überhaupt etwas
 * getan hat – sonst würde beim Wegschalten jedes Mal dieselbe Datei erneut ins
 * Netz geschoben, auch wenn du nur kurz nachgeschaut hast.
 */
export async function bumpRevision() {
  const n = (await getMeta('revision', 0)) + 1;
  await setMeta('revision', n);
  return n;
}

export const getRevision = () => getMeta('revision', 0);

/* ---------- Übungen ---------- */

export async function getExercises({ includeArchived = false } = {}) {
  const all = await tx('exercises', 'readonly', (s) => reqValue(s.getAll()));
  return all.filter((e) => includeArchived || !e.archived).sort((a, b) => a.sort - b.sort);
}

export async function getExercise(id) {
  return tx('exercises', 'readonly', (s) => reqValue(s.get(id)));
}

export async function addExercise(name, { icon = null, iconPhotoId = null } = {}) {
  const all = await tx('exercises', 'readonly', (s) => reqValue(s.getAll()));
  const sort = all.reduce((m, e) => Math.max(m, e.sort), -1) + 1;
  const sauber = name.trim();
  const ex = {
    id: uid(),
    name: sauber,
    sort,
    weightStep: 4.5,
    archived: false,
    // Heißt die neue Übung wie ein bekanntes Gerät, gibt es das Symbol gratis.
    icon: icon || iconFuerName(sauber),
    iconPhotoId,
  };
  await tx('exercises', 'readwrite', (s) => s.put(ex));
  await bumpRevision();
  return ex;
}

export async function saveExercise(ex) {
  await tx('exercises', 'readwrite', (s) => s.put(ex));
  await bumpRevision();
  return ex;
}

/** Übung archivieren statt löschen – die Historie bleibt dadurch erhalten. */
export async function setArchived(id, archived) {
  const ex = await getExercise(id);
  if (!ex) return null;
  ex.archived = archived;
  return saveExercise(ex);
}

/* ---------- Einträge ---------- */

export async function getEntries(exerciseId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readonly');
    const idx = t.objectStore('entries').index('exerciseId');
    const req = idx.getAll(IDBKeyRange.only(exerciseId));
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.date.localeCompare(a.date)));
    req.onerror = () => reject(req.error);
  });
}

export async function getAllEntries() {
  const all = await tx('entries', 'readonly', (s) => reqValue(s.getAll()));
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

/** Letzter Eintrag je Übung – für die Startseite, in einem Rutsch. */
export async function getLastEntryMap() {
  const all = await getAllEntries(); // bereits absteigend nach Datum
  const map = new Map();
  for (const e of all) if (!map.has(e.exerciseId)) map.set(e.exerciseId, e);
  return map;
}

export async function saveEntry(entry) {
  const e = { ...entry };
  if (!e.id) e.id = uid();
  if (!e.date) e.date = new Date().toISOString();
  await tx('entries', 'readwrite', (s) => s.put(e));
  await bumpRevision();
  return e;
}

export async function deleteEntry(id) {
  const entry = await tx('entries', 'readonly', (s) => reqValue(s.get(id)));
  if (entry && entry.photoId) await deletePhoto(entry.photoId);
  await tx('entries', 'readwrite', (s) => s.delete(id));
  await bumpRevision();
}

/* ---------- Fotos ---------- */

export async function savePhoto(blob) {
  const id = uid();
  await tx('photos', 'readwrite', (s) => s.put({ id, blob }));
  return id;
}

export async function getPhoto(id) {
  if (!id) return null;
  const rec = await tx('photos', 'readonly', (s) => reqValue(s.get(id)));
  return rec ? rec.blob : null;
}

export async function deletePhoto(id) {
  if (!id) return;
  await tx('photos', 'readwrite', (s) => s.delete(id));
}

/* ---------- Backup ---------- */

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

export async function exportAll({ includePhotos = true } = {}) {
  const exercises = await tx('exercises', 'readonly', (s) => reqValue(s.getAll()));
  const entries = await tx('entries', 'readonly', (s) => reqValue(s.getAll()));
  const out = {
    format: 'pump-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    entries,
    photos: [],
  };
  if (includePhotos) {
    const photos = await tx('photos', 'readonly', (s) => reqValue(s.getAll()));
    out.photos = await Promise.all(
      photos.map(async (p) => ({ id: p.id, dataUrl: await blobToDataURL(p.blob) }))
    );
  } else {
    // Ohne Fotos: Verweise kappen, damit der Import keine toten IDs anlegt.
    out.entries = entries.map((e) => ({ ...e, photoId: null }));
  }
  return out;
}

const normName = (s) => String(s || '').trim().toLowerCase();

/**
 * Import per Merge.
 *
 * Der wichtigste Fall ist die Wiederherstellung auf einem frischen Gerät: dort
 * hat die App die 14 Standardübungen schon angelegt – mit anderen IDs als im
 * Backup. Stumpf nach ID einzuspielen würde jede Übung verdoppeln. Deshalb
 * werden Übungen zusätzlich über den Namen zusammengeführt und die Einträge
 * auf die bereits vorhandene ID umgebogen.
 */
export async function importAll(data) {
  if (!data || data.format !== 'pump-tracker')
    throw new Error('Kein gültiges Pump-Tracker-Backup.');
  // neu = kannte die App nicht · aktualisiert = gleiche ID, überschrieben
  // · merged = gleicher Name, andere ID, zusammengeführt
  const counts = { neu: 0, aktualisiert: 0, merged: 0, entries: 0, photos: 0 };

  for (const p of data.photos || []) {
    const blob = await dataURLToBlob(p.dataUrl);
    await tx('photos', 'readwrite', (s) => s.put({ id: p.id, blob }));
    counts.photos++;
  }

  const existing = await tx('exercises', 'readonly', (s) => reqValue(s.getAll()));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const byName = new Map(existing.map((e) => [normName(e.name), e]));

  const idMap = new Map(); // Backup-ID -> ID in dieser Datenbank

  for (const ex of data.exercises || []) {
    if (!ex || !ex.id) continue;
    const twin = byId.has(ex.id) ? null : byName.get(normName(ex.name));

    if (twin) {
      // Gleiche Übung, andere ID: vorhandene ID behalten, Werte übernehmen.
      idMap.set(ex.id, twin.id);
      const merged = { ...twin, ...ex, id: twin.id, sort: twin.sort };
      await tx('exercises', 'readwrite', (s) => s.put(merged));
      byName.set(normName(merged.name), merged);
      counts.merged++;
    } else {
      const kannteIch = byId.has(ex.id);
      await tx('exercises', 'readwrite', (s) => s.put(ex));
      byId.set(ex.id, ex);
      byName.set(normName(ex.name), ex);
      if (kannteIch) counts.aktualisiert++;
      else counts.neu++;
    }
  }

  for (const en of data.entries || []) {
    if (!en || !en.id) continue;
    const mapped = idMap.has(en.exerciseId)
      ? { ...en, exerciseId: idMap.get(en.exerciseId) }
      : en;
    await tx('entries', 'readwrite', (s) => s.put(mapped));
    counts.entries++;
  }

  await bumpRevision(); // einmal für den ganzen Import, nicht je Datensatz
  return counts;
}

export { uid, DEFAULT_EXERCISES };

/**
 * Übung endgültig entfernen – samt aller ihrer Einträge und Fotos.
 *
 * Getrennt vom Ausblenden, weil hier wirklich Daten verschwinden. Die Zählung
 * wird zurückgegeben, damit die Oberfläche vorher sagen kann, was verloren geht.
 */
export async function zaehleEintraege(exerciseId) {
  return (await getEntries(exerciseId)).length;
}

export async function deleteExercise(id) {
  const eintraege = await getEntries(id);
  for (const e of eintraege) {
    if (e.photoId) await deletePhoto(e.photoId);
    await tx('entries', 'readwrite', (s) => s.delete(e.id));
  }
  const ex = await getExercise(id);
  if (ex && ex.iconPhotoId) await deletePhoto(ex.iconPhotoId);
  await tx('exercises', 'readwrite', (s) => s.delete(id));
  await bumpRevision();
  return { eintraege: eintraege.length };
}

/** Neue Reihenfolge festschreiben: die Liste gibt die Sortierung vor. */
export async function setReihenfolge(ids) {
  for (let i = 0; i < ids.length; i++) {
    const ex = await getExercise(ids[i]);
    if (ex && ex.sort !== i) {
      ex.sort = i;
      await tx('exercises', 'readwrite', (s) => s.put(ex));
    }
  }
  await bumpRevision();
}
