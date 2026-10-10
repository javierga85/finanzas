// Almacenamiento local cifrado con PIN + sincronización con un repositorio privado de GitHub.
const LS_SALT = 'fz_salt', LS_CHECK = 'fz_check', LS_VAULT = 'fz_vault';
const enc = new TextEncoder(), dec = new TextDecoder();

const b64 = {
  from(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); },
  to(str) { const s = atob(str); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
};
const utf8ToB64 = (txt) => b64.from(enc.encode(txt));
const b64ToUtf8 = (s) => dec.decode(b64.to(s.replace(/\n/g, '')));

async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptStr(key, txt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(txt));
  return b64.from(iv) + '.' + b64.from(ct);
}
async function decryptStr(key, payload) {
  const [iv, ct] = payload.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.to(iv) }, key, b64.to(ct));
  return dec.decode(pt);
}

export function emptyData() {
  return {
    version: 1, actualizado: new Date().toISOString(),
    catalogo: {
      ING: ['Salario neto', 'Preahorro', 'Dinero extra ingresado'],
      GMF: ['Hipoteca', 'Comunidad + Agua', 'Internet+Teléfono', 'Luz', 'Gas', 'Compra', 'Garaje', 'Gasolina', 'Gastos varios (efectivo)'],
      GAF: ['Amazon Premium/Netflix/Spotify', 'Caza', 'Cuero', 'Declaración de la renta', 'Entrenamiento', 'IBI casa', 'ITV moto', 'IVTM moto', 'Piscina Tiedra', 'Revisión moto', 'Seguro casa', 'Seguro Moto', 'SWING/Armo/Balboa', 'Wikiloc'],
      GEX: ['Gasto Extra'], OOC: ['Out of Context']
    },
    reglas: [], movimientos: [], historico: [], prestamos: []
  };
}

export const Store = {
  key: null,
  vault: null, // { data, sync:{owner,repo,branch,path,token,sha,dirty,lastSync} }
  listeners: new Set(),
  status: 'off', // off | ok | pending | err | offline
  statusMsg: '',
  pushTimer: null,

  hasPin() { return !!localStorage.getItem(LS_SALT); },

  async createPin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    this.key = await deriveKey(pin, salt);
    localStorage.setItem(LS_SALT, b64.from(salt));
    localStorage.setItem(LS_CHECK, await encryptStr(this.key, 'ok'));
    this.vault = this.vault || { data: emptyData(), sync: {} };
    await this.saveLocal();
  },

  async unlock(pin) {
    const salt = b64.to(localStorage.getItem(LS_SALT));
    const key = await deriveKey(pin, salt);
    try { if (await decryptStr(key, localStorage.getItem(LS_CHECK)) !== 'ok') return false; } catch { return false; }
    this.key = key;
    const raw = localStorage.getItem(LS_VAULT);
    this.vault = raw ? JSON.parse(await decryptStr(key, raw)) : { data: emptyData(), sync: {} };
    this.vault.sync = this.vault.sync || {};
    return true;
  },

  async changePin(newPin) {
    const v = this.vault; await this.createPin(newPin); this.vault = v; await this.saveLocal();
  },

  lock() { this.key = null; this.vault = null; },

  wipe() { [LS_SALT, LS_CHECK, LS_VAULT].forEach(k => localStorage.removeItem(k)); this.lock(); },

  get data() { return this.vault?.data; },
  get sync() { return this.vault?.sync; },

  async saveLocal() {
    if (!this.key) return;
    try { localStorage.setItem(LS_VAULT, await encryptStr(this.key, JSON.stringify(this.vault))); }
    catch (e) { console.error(e); alert('No se pudo guardar en este dispositivo (¿almacenamiento lleno?). ' + e.message); }
  },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(what) { this.listeners.forEach(fn => fn(what)); },

  setStatus(s, msg = '') { this.status = s; this.statusMsg = msg; this.emit('status'); },

  // Llamar tras cualquier cambio de datos
  async commit(reason = 'Actualización') {
    this.vault.data.actualizado = new Date().toISOString();
    if (this.syncConfigured()) { this.vault.sync.dirty = true; this.setStatus('pending', 'Cambios pendientes de subir'); }
    await this.saveLocal();
    this.emit('data');
    this.schedulePush(reason);
  },

  replaceData(data) { this.vault.data = data; },

  /* ------------------ GitHub ------------------ */
  syncConfigured() { const s = this.sync; return !!(s && s.owner && s.repo && s.token); },

  apiUrl() {
    const s = this.sync; const path = (s.path || 'data.json').split('/').map(encodeURIComponent).join('/');
    return `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${path}`;
  },
  headers(accept = 'application/vnd.github+json') {
    return { 'Authorization': 'Bearer ' + this.sync.token, 'Accept': accept, 'X-GitHub-Api-Version': '2022-11-28' };
  },

  async fetchRemote() {
    const s = this.sync; const ref = s.branch ? `?ref=${encodeURIComponent(s.branch)}` : '';
    const r = await fetch(this.apiUrl() + ref, { headers: this.headers(), cache: 'no-store' });
    if (r.status === 404) return { exists: false };
    if (!r.ok) throw new Error(await errText(r));
    const meta = await r.json();
    let txt;
    if (meta.content && meta.encoding === 'base64') txt = b64ToUtf8(meta.content);
    else {
      const r2 = await fetch(this.apiUrl() + ref, { headers: this.headers('application/vnd.github.raw+json'), cache: 'no-store' });
      if (!r2.ok) throw new Error(await errText(r2));
      txt = await r2.text();
    }
    return { exists: true, sha: meta.sha, data: JSON.parse(txt) };
  },

  async testConnection(cfg) {
    const old = this.vault.sync; this.vault.sync = { ...old, ...cfg };
    try {
      const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, { headers: this.headers() });
      if (!r.ok) throw new Error(await errText(r));
      const repo = await r.json();
      const remote = await this.fetchRemote();
      return { ok: true, private: repo.private, defaultBranch: repo.default_branch, remote };
    } finally { this.vault.sync = old; }
  },

  /** Descarga de la nube. onConflict(remoteData) => 'remote' | 'local' */
  async pull(onConflict) {
    if (!this.syncConfigured()) return;
    if (!navigator.onLine) { this.setStatus('offline', 'Sin conexión'); return; }
    try {
      const rem = await this.fetchRemote();
      const s = this.sync;
      if (!rem.exists) { s.dirty = true; await this.saveLocal(); return this.push('Primera subida'); }
      if (rem.sha === s.sha) { if (s.dirty) return this.push(); this.setStatus('ok', 'Sincronizado'); return; }
      // La nube ha cambiado
      let choice = 'remote';
      if (s.dirty && onConflict) choice = await onConflict(rem.data);
      if (choice === 'remote') {
        this.vault.data = rem.data; s.sha = rem.sha; s.dirty = false; s.lastSync = new Date().toISOString();
        await this.saveLocal(); this.emit('data'); this.setStatus('ok', 'Sincronizado');
      } else {
        s.sha = rem.sha; s.dirty = true; await this.saveLocal(); return this.push('Sobrescribir con datos locales');
      }
    } catch (e) { console.error(e); this.setStatus('err', e.message); }
  },

  schedulePush(reason) {
    if (!this.syncConfigured()) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(reason), 1500);
  },

  async push(reason = 'Actualización', onConflict) {
    if (!this.syncConfigured() || !this.sync.dirty) return;
    if (!navigator.onLine) { this.setStatus('offline', 'Sin conexión: se subirá al reconectar'); return; }
    const s = this.sync;
    try {
      this.setStatus('pending', 'Subiendo…');
      const body = { message: `${reason} (${new Date().toLocaleString('es-ES')})`, content: utf8ToB64(JSON.stringify(this.vault.data)) };
      if (s.sha) body.sha = s.sha;
      if (s.branch) body.branch = s.branch;
      const r = await fetch(this.apiUrl(), { method: 'PUT', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 422) { this.setStatus('err', 'Conflicto: hay cambios desde otro dispositivo'); this.emit('conflict'); return; }
      if (!r.ok) throw new Error(await errText(r));
      const out = await r.json();
      s.sha = out.content.sha; s.dirty = false; s.lastSync = new Date().toISOString();
      await this.saveLocal(); this.setStatus('ok', 'Sincronizado');
    } catch (e) { console.error(e); this.setStatus('err', e.message); }
  }
};

async function errText(r) {
  let m = `${r.status} ${r.statusText}`;
  try { const j = await r.json(); if (j.message) m += ' – ' + j.message; } catch { }
  if (r.status === 401) m = 'Token inválido o caducado (401)';
  if (r.status === 403) m = 'El token no tiene permiso sobre ese repositorio (403)';
  if (r.status === 404) m = 'No encuentro el repositorio/fichero (404). Revisa usuario, repo y permisos del token';
  return m;
}
