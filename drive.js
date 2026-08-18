/*
 * Google-Drive-Anbindung.
 *
 * Bewusst schmal gehalten: die App bekommt nur die Berechtigung `drive.file`,
 * also Zugriff ausschließlich auf Dateien und Ordner, die sie selbst anlegt
 * oder die du ihr über den Auswahldialog ausdrücklich zeigst. Den übrigen
 * Inhalt deines Drive sieht sie nie.
 *
 * Grenzen, die von Google kommen und sich hier nicht umgehen lassen:
 *  - Ein Browser-Programm erhält nur ein Zugangstoken mit etwa einer Stunde
 *    Gültigkeit, kein dauerhaftes Refresh-Token. Deshalb kann nicht gesichert
 *    werden, während die App geschlossen ist.
 *  - Nach der einmaligen Freigabe lässt sich das Token aber still erneuern,
 *    solange du in diesem Browser bei Google angemeldet bist. Du wirst also
 *    nicht bei jedem Start neu gefragt.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';
const DATEINAME = 'pump-tracker-backup.json';

/* Für Tests austauschbar: so lässt sich der ganze Ablauf ohne echte
   Zugangsdaten durchspielen. */
export const laufzeit = {
  fetch: (...a) => globalThis.fetch(...a),
  ladeSkript,
  jetzt: () => Date.now(),
};

function ladeSkript(src) {
  return new Promise((resolve, reject) => {
    const da = [...document.scripts].find((s) => s.src === src);
    if (da) {
      if (da.dataset.geladen === '1') return resolve();
      da.addEventListener('load', () => resolve());
      da.addEventListener('error', () => reject(new Error(`${src} nicht ladbar`)));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.addEventListener('load', () => {
      s.dataset.geladen = '1';
      resolve();
    });
    s.addEventListener('error', () => reject(new Error(`${src} nicht ladbar (offline?)`)));
    document.head.appendChild(s);
  });
}

/* ---------------- Anmeldung ---------------- */

let tokenClient = null;
let token = null; // { wert, laeuftAb }
let clientIdAktiv = null;

export function angemeldet() {
  return Boolean(token && token.laeuftAb > laufzeit.jetzt() + 30000);
}

async function tokenClientHolen(clientId) {
  if (tokenClient && clientIdAktiv === clientId) return tokenClient;
  await laufzeit.ladeSkript(GIS_SRC);
  if (!globalThis.google?.accounts?.oauth2) {
    throw new Error('Google-Anmeldedienst nicht verfügbar.');
  }
  tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {}, // wird je Anfrage überschrieben
  });
  clientIdAktiv = clientId;
  return tokenClient;
}

/**
 * Zugangstoken besorgen.
 *
 * `interaktiv: false` versucht die stille Erneuerung. Schlägt sie fehl, wird
 * *nicht* von selbst ein Anmeldefenster geöffnet – ein Popup ohne Zutun des
 * Nutzers würde der Browser ohnehin blockieren. Stattdessen meldet die
 * Funktion `null`, und die Oberfläche bietet einen Knopf an.
 */
export async function tokenBesorgen(clientId, { interaktiv = false } = {}) {
  if (angemeldet()) return token.wert;
  if (!clientId) throw new Error('Keine Client-ID hinterlegt.');

  const client = await tokenClientHolen(clientId);

  return new Promise((resolve, reject) => {
    let erledigt = false;
    const fertig = (fn, wert) => {
      if (erledigt) return;
      erledigt = true;
      fn(wert);
    };

    client.callback = (resp) => {
      if (resp && resp.access_token) {
        token = {
          wert: resp.access_token,
          laeuftAb: laufzeit.jetzt() + (Number(resp.expires_in) || 3600) * 1000,
        };
        fertig(resolve, token.wert);
      } else {
        fertig(interaktiv ? reject : resolve, interaktiv ? new Error(resp?.error || 'Anmeldung abgebrochen') : null);
      }
    };
    client.error_callback = (err) => {
      fertig(interaktiv ? reject : resolve, interaktiv ? new Error(err?.type || 'Anmeldung fehlgeschlagen') : null);
    };

    try {
      client.requestAccessToken({ prompt: interaktiv ? 'consent' : '' });
    } catch (err) {
      fertig(interaktiv ? reject : resolve, interaktiv ? err : null);
    }

    // Die stille Erneuerung meldet sich nicht immer zurück, wenn keine
    // Google-Sitzung besteht – nach 8 Sekunden gilt sie als gescheitert.
    if (!interaktiv) setTimeout(() => fertig(resolve, null), 8000);
  });
}

export function abmelden() {
  if (token && globalThis.google?.accounts?.oauth2?.revoke) {
    try {
      globalThis.google.accounts.oauth2.revoke(token.wert);
    } catch {
      /* egal – lokal vergessen reicht */
    }
  }
  token = null;
}

/* ---------------- Ordnerauswahl (Picker) ---------------- */

/**
 * Öffnet Googles Auswahldialog und gibt den gewählten Ordner zurück.
 * Über den Picker ausgewählte Ordner werden für `drive.file` freigeschaltet –
 * nur deshalb darf die App später überhaupt hineinschreiben.
 */
export async function ordnerWaehlen({ clientId, apiKey }) {
  const zugang = await tokenBesorgen(clientId, { interaktiv: !angemeldet() });
  if (!zugang) throw new Error('Nicht angemeldet.');
  if (!apiKey) throw new Error('Kein API-Schlüssel hinterlegt – der Auswahldialog braucht ihn.');

  // Die Projektnummer steckt vorn in der Client-ID ("123456789-abc.apps...").
  // Der Picker muss sie kennen, sonst ordnet Drive den ausgewählten Ordner der
  // App nicht zu – und unter `drive.file` dürfte sie dann nicht hineinschreiben.
  const appId = String(clientId).split('-')[0];

  await laufzeit.ladeSkript(GAPI_SRC);
  await new Promise((resolve, reject) => {
    if (globalThis.google?.picker) return resolve();
    globalThis.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('Picker nicht ladbar')) });
  });

  return new Promise((resolve) => {
    const ansicht = new globalThis.google.picker.DocsView(globalThis.google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true)
      .setMimeTypes('application/vnd.google-apps.folder');

    const picker = new globalThis.google.picker.PickerBuilder()
      .addView(ansicht)
      .setOAuthToken(zugang)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setTitle('Ordner für die Sicherung wählen')
      .setCallback((daten) => {
        const a = daten[globalThis.google.picker.Response.ACTION];
        if (a === globalThis.google.picker.Action.PICKED) {
          const d = daten[globalThis.google.picker.Response.DOCUMENTS][0];
          resolve({ id: d.id, name: d.name });
        } else if (a === globalThis.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

/* ---------------- Drive-Zugriffe ---------------- */

async function api(pfad, { zugang, method = 'GET', headers = {}, body = null, roh = false } = {}) {
  const res = await laufzeit.fetch(pfad, {
    method,
    headers: { Authorization: `Bearer ${zugang}`, ...headers },
    body,
  });
  if (!res.ok) {
    let text = await res.text().catch(() => '');
    let grund = text;
    try {
      grund = JSON.parse(text)?.error?.message || text;
    } catch {
      /* kein JSON */
    }
    const err = new Error(`Drive ${res.status}: ${grund || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return roh ? res : res.json();
}

/** Sucht die Sicherungsdatei im Ordner; gibt null zurück, wenn es keine gibt. */
export async function dateiSuchen({ zugang, ordnerId }) {
  const q = encodeURIComponent(
    `name = '${DATEINAME}' and '${ordnerId}' in parents and trashed = false`
  );
  const daten = await api(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=1`,
    { zugang }
  );
  return daten.files && daten.files[0] ? daten.files[0] : null;
}

/**
 * Sicherung schreiben. Existiert die Datei schon, wird sie aktualisiert –
 * dadurch behält sie ihre Freigaben und ihre Versionshistorie in Drive.
 */
export async function hochladen({ zugang, ordnerId, dateiId, inhalt }) {
  const koerper = new Blob([inhalt], { type: 'application/json' });

  if (dateiId) {
    try {
      const res = await api(
        `https://www.googleapis.com/upload/drive/v3/files/${dateiId}?uploadType=media&fields=id,modifiedTime`,
        { zugang, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: koerper }
      );
      return { id: res.id, modifiedTime: res.modifiedTime, neu: false };
    } catch (err) {
      // Datei wurde in Drive gelöscht o. Ä. – dann unten neu anlegen.
      if (err.status !== 404) throw err;
    }
  }

  const grenze = 'pumptracker' + Math.random().toString(36).slice(2);
  const metadaten = JSON.stringify({ name: DATEINAME, parents: [ordnerId], mimeType: 'application/json' });
  const mehrteilig = new Blob([
    `--${grenze}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadaten}\r\n`,
    `--${grenze}\r\nContent-Type: application/json\r\n\r\n`,
    koerper,
    `\r\n--${grenze}--`,
  ]);

  const res = await api(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime',
    {
      zugang,
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${grenze}` },
      body: mehrteilig,
    }
  );
  return { id: res.id, modifiedTime: res.modifiedTime, neu: true };
}

export async function herunterladen({ zugang, dateiId }) {
  const res = await api(`https://www.googleapis.com/drive/v3/files/${dateiId}?alt=media`, {
    zugang,
    roh: true,
  });
  return res.text();
}

export { DATEINAME, SCOPE };
