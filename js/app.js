import { Store, emptyData } from './store.js?v=1.5.2';
import * as C from './calc.js?v=1.5.2';
import { $, $$, esc, eur, fecha, cls, toast, modal, confirmDlg, choiceDlg, download, destroyCharts, chartDefaults, MODOS } from './ui.js?v=1.5.2';
import { colorSub, familia, tint } from './colors.js?v=1.5.2';
import { renderDashboard, renderTabla, renderHistorico, renderPrestamos, renderExtra } from './views.js?v=1.5.2';
import { leerHoja, parseExtracto } from './importer.js?v=1.5.2';

const D = () => Store.data;
const ICON = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
  tabla: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>',
  hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  loan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  extra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.4 1.1-2 2.5-2s2.5.7 2.5 2-1.2 1.8-2.5 2.2-2.5.9-2.5 2.3 1.1 2 2.5 2 2.5-.6 2.5-2"/></svg>',
  movs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
};
const VIEWS = [
  { k: 'dash', n: 'Dashboard', t: 'Dashboard', r: renderDashboard },
  { k: 'tabla', n: 'Tabla', t: 'Gasto anual', r: renderTabla },
  { k: 'hist', n: 'Histórico', t: 'Histórico', r: renderHistorico },
  { k: 'loan', n: 'Préstamos', t: 'Hipoteca y préstamos', r: renderPrestamos },
  { k: 'extra', n: 'Extra', t: 'Out of Context', r: renderExtra },
  { k: 'movs', n: 'Movimientos', t: 'Extracciones', r: renderMovs }
];

const state = {
  view: 'dash', year: new Date().getFullYear(), tabla: 'anual', ocultarVacias: true, compMes: new Date().getMonth() + 1,
  lines: { ing: true, gas: true, pre: true, aho: true, gt: true }, groups: { ING: true, PRE: true, GMF: true, GAF: true, GEX: true },
  histCat: 'ahorro', histModo: 'total', loan: null, oocYear: null, disp: 'both', dispOv: {},
  mv: { q: '', anio: '', mes: '', grupo: '', estado: '', limit: 60 }
};
try { Object.assign(state, JSON.parse(localStorage.getItem('fz_ui') || '{}'), { mv: { ...state.mv, limit: 60 } }); } catch { }
const saveUi = () => { try { const { view, tabla, ocultarVacias, lines, groups, histCat, histModo, disp, dispOv } = state; localStorage.setItem('fz_ui', JSON.stringify({ view, tabla, ocultarVacias, lines, groups, histCat, histModo, disp, dispOv })); } catch { } };

const ctx = { state, saveUi: () => saveUi(), mode: (k) => state.dispOv[k] || state.disp, rerender: () => render(), openMov: (id) => editarMov(D().movimientos.find(m => m.id === id)), showMovList };

/* ===================== Bloqueo con PIN ===================== */
function lockScreen() {
  document.querySelector('.imp-panel')?.remove(); document.body.classList.remove('with-panel', 'panel-min');
  destroyCharts(); $('#app').classList.add('hidden');
  const lock = $('#lock'); lock.classList.remove('hidden');
  const creating = !Store.hasPin();
  let pin = '', first = null, fails = 0;
  lock.innerHTML = `<div class="lock-card"><div class="lock-logo"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#000"/><g fill="none" stroke="#fff" stroke-width="10"><path d="M67.32 40.00A20 20 0 1 1 45.84 30.44"/><path d="M53.92 26.00A20 20 0 0 1 66.69 32.51"/></g></svg></div><h1>Mis Finanzas</h1>
    <p id="lkMsg">${creating ? 'Crea un PIN de 4 a 6 dígitos' : 'Introduce tu PIN'}</p>
    <div class="pin-dots" id="dots"></div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button class="ghost" data-k="del">Borrar</button><button data-k="0">0</button><button class="ghost" data-k="ok"><b>OK</b></button></div>
    <div class="lock-err" id="lkErr"></div>
    ${creating ? '' : '<button class="btn ghost small" id="lkForgot" style="margin-top:14px">¿Olvidaste el PIN?</button>'}</div>`;
  const dots = () => $('#dots').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<span class="${i < pin.length ? 'on' : ''}"></span>`).join('');
  dots();
  const submit = async () => {
    if (pin.length < 4) { $('#lkErr').textContent = 'Mínimo 4 dígitos'; return; }
    if (creating) {
      if (!first) { first = pin; pin = ''; dots(); $('#lkMsg').textContent = 'Repite el PIN'; $('#lkErr').textContent = ''; return; }
      if (first !== pin) { first = null; pin = ''; dots(); $('#lkMsg').textContent = 'Crea un PIN de 4 a 6 dígitos'; $('#lkErr').textContent = 'No coinciden, vuelve a empezar'; return; }
      $('#lkErr').textContent = 'Creando…'; await Store.createPin(pin); return start();
    }
    $('#lkErr').textContent = 'Comprobando…';
    if (await Store.unlock(pin)) return start();
    fails++; pin = ''; dots();
    $('#lkErr').textContent = fails >= 5 ? 'Demasiados intentos. Espera 30 s' : 'PIN incorrecto';
    if (fails >= 5) { lock.querySelectorAll('.keypad button').forEach(b => b.disabled = true); setTimeout(() => { fails = 0; lockScreen(); }, 30000); }
  };
  const press = (k) => {
    if (k === 'del') pin = pin.slice(0, -1); else if (k === 'ok') return submit(); else if (pin.length < 6) pin += k;
    dots(); if (!creating && pin.length === 6) submit();
  };
  lock.querySelectorAll('[data-k]').forEach(b => b.onclick = () => press(b.dataset.k));
  document.onkeydown = (e) => { if ($('#lock').classList.contains('hidden')) return; if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('ok'); };
  $('#lkForgot')?.addEventListener('click', async () => {
    if (await confirmDlg('Restablecer la app', 'Se borrarán los datos guardados <b>en este dispositivo</b> y podrás crear un PIN nuevo. Si tienes la sincronización con GitHub, tus datos siguen a salvo en tu repositorio y podrás volver a conectarlo.', 'Borrar y empezar', true)) { Store.wipe(); lockScreen(); }
  });
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!Store.key) return;
  if (document.hidden) hiddenAt = Date.now();
  else {
    const mins = D()?.ajustes?.autoLock ?? 5;
    if (mins > 0 && hiddenAt && Date.now() - hiddenAt > mins * 60000) { Store.lock(); lockScreen(); }
    else if (Store.syncConfigured()) Store.pull(resolverConflicto);
  }
});
window.addEventListener('online', () => { if (Store.key && Store.syncConfigured()) Store.push('Reconexión'); });

async function resolverConflicto(remote) {
  const n = remote?.movimientos?.length ?? 0;
  return choiceDlg('Cambios en otro dispositivo', `Los datos de la nube han cambiado (${n} movimientos, actualizado ${new Date(remote?.actualizado).toLocaleString('es-ES')}) y en este dispositivo también hay cambios sin subir. ¿Qué versión quieres conservar?`,
    [{ label: 'Mantener los de este dispositivo', value: 'local' }, { label: 'Usar los de la nube', value: 'remote', primary: true }]);
}

/* ===================== Shell ===================== */
async function start() {
  $('#lock').classList.add('hidden'); $('#app').classList.remove('hidden');
  applyTheme(); chartDefaults();
  D().ajustes ||= { autoLock: 5, tema: 'auto' };
  buildShell(); render();
  if (Store.syncConfigured()) { Store.setStatus('pending', 'Comprobando la nube…'); await Store.pull(resolverConflicto); }
  else updateSync();
}

function applyTheme() {
  const t = D()?.ajustes?.tema || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}

function buildShell() {
  $('#app').innerHTML = `
  <header class="topbar"><h1 id="title"></h1>
    <button class="sync" id="syncBtn" title=""><i></i><span id="syncTxt"></span></button>
    <button class="dispbtn" id="dispBtn" title="Mostrar valores / % en toda la app" aria-label="Valores o porcentajes"></button>
    <button class="iconbtn" id="lockBtn" aria-label="Bloquear">${ICON.lock}</button>
    <button class="iconbtn" id="setBtn" aria-label="Ajustes">${ICON.gear}</button></header>
  <main id="main"></main>
  <nav class="bottomnav">${VIEWS.map(v => `<button data-v="${v.k}"><span class="badge-dot" ${v.k === 'movs' ? 'id="movBadge"' : ''}>${ICON[v.k]}</span>${v.n}</button>`).join('')}</nav>`;
  $$('.bottomnav [data-v]').forEach(b => b.onclick = () => { state.view = b.dataset.v; saveUi(); render(); window.scrollTo(0, 0); });
  $('#setBtn').onclick = () => { state.view = 'ajustes'; render(); window.scrollTo(0, 0); };
  $('#lockBtn').onclick = () => { Store.lock(); lockScreen(); };
  $('#dispBtn').onclick = async () => {
    const v = await choiceDlg('Mostrar en toda la app', 'Elige qué ver en gráficos, KPIs y tablas. Cada gráfico puede tener además su propio ajuste (desplegable de su esquina); "Restablecer" los devuelve todos al global.',
      [...MODOS.map(x => ({ label: `${x.s}  ${x.n}`, value: x.k, primary: x.k === state.disp })), { label: 'Restablecer ajustes por gráfico', value: '__reset' }]);
    if (!v) return; if (v === '__reset') state.dispOv = {}; else state.disp = v;
    saveUi(); updateDispBtn(); render();
  };
  updateDispBtn();
  $('#syncBtn').onclick = async () => { if (!Store.syncConfigured()) { state.view = 'ajustes'; render(); return; } Store.vault.sync.dirty ? await Store.push('Manual') : await Store.pull(resolverConflicto); toast(Store.statusMsg || 'Sincronizado'); };
}

Store.on((what) => {
  if (!Store.key) return;
  if (what === 'status') updateSync();
  if (what === 'data') { applyTheme(); render(); }
  if (what === 'conflict') Store.pull(resolverConflicto);
});
function updateDispBtn() { const b = $('#dispBtn'); if (b) b.textContent = MODOS.find(x => x.k === state.disp).s; }
function updateSync() {
  const b = $('#syncBtn'); if (!b) return;
  const st = Store.syncConfigured() ? Store.status : 'off';
  b.className = 'sync ' + ({ ok: 'ok', pending: 'pending', err: 'err', offline: 'pending' }[st] || '');
  $('#syncTxt').textContent = { ok: 'Sincronizado', pending: 'Pendiente', err: 'Error', offline: 'Sin conexión', off: 'Solo local' }[st] || '';
  b.title = Store.statusMsg || (st === 'off' ? 'Configura GitHub en Ajustes para sincronizar' : '');
}

/** Ajustes de datos de versiones anteriores. Devuelve true si cambió algo que haya que guardar. */
function migrar() {
  const d = D(); let cambio = false;
  if (!d.catalogo.SE) { d.catalogo.SE = ['Sin efecto']; cambio = true; }
  d.migr ||= {};
  if (!d.migr.fechas14) {
    // v1.0–1.4 importaban Fecha y F.Valor al revés que tu Excel: se corrigen los movimientos importados desde la app
    d.movimientos.forEach(m => { if (!/^m\d{4}$/.test(m.id) && !m.manual && m.fvalor && m.fecha > m.fvalor) { [m.fecha, m.fvalor] = [m.fvalor, m.fecha]; } });
    d.migr.fechas14 = true; cambio = true;
  }
  return cambio;
}

function render() {
  if (!Store.key) return;
  D().ajustes = { autoLock: 5, tema: 'auto', ...(D().ajustes || {}) }; delete D().ajustes.ingresosMayorVerde;
  if (migrar()) { Store.commit('Actualización de datos v1.5'); return; }
  destroyCharts();
  const v = VIEWS.find(x => x.k === state.view);
  $('#title').textContent = v ? v.t : 'Ajustes';
  $$('.bottomnav [data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === state.view));
  const main = $('#main'); main.innerHTML = '';
  if (!D().movimientos.length && !D().historico?.length && state.view !== 'ajustes' && !state.started) return renderBienvenida(main);
  (v ? v.r : renderAjustes)(main, ctx);
  const rep = C.repetidos(D().movimientos).size, pend = D().movimientos.filter(m => !C.valido(m)).length;
  $('#movBadge')?.setAttribute('data-n', rep + pend);
}

function renderBienvenida(main) {
  main.innerHTML = `<div class="card" style="max-width:560px;margin:10px auto"><h2 style="font-size:20px">¡Bienvenido! 👋</h2><p class="ink2">Tu app está vacía en este dispositivo. Elige cómo empezar:</p>
  <div class="list">
    <div class="it"><div class="grow"><b>1 · Conectar con GitHub</b><div class="small muted">Recomendado. Carga tus datos desde tu repositorio privado y mantiene móvil y PC sincronizados.</div></div><button class="btn primary" id="wGh">Conectar</button></div>
    <div class="it"><div class="grow"><b>2 · Importar copia (data.json)</b><div class="small muted">Si tienes el fichero de datos (por ejemplo, el que generé desde tu Excel).</div></div><label class="btn ghost">Elegir<input type="file" id="wJs" accept=".json,application/json" hidden></label></div>
    <div class="it"><div class="grow"><b>3 · Empezar de cero</b><div class="small muted">Importa directamente tu extracto del banco.</div></div><button class="btn ghost" id="wNew">Empezar</button></div>
  </div></div>`;
  $('#wGh').onclick = () => { state.view = 'ajustes'; render(); setTimeout(() => $('#ghOwner')?.focus(), 50); };
  $('#wJs').onchange = (e) => importarCopia(e.target.files[0]);
  $('#wNew').onclick = () => { state.view = 'movs'; state.started = true; render(); };
}

async function importarCopia(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.movimientos || !data.catalogo) throw new Error('El fichero no parece una copia de esta app.');
    if (D().movimientos.length && !(await confirmDlg('Reemplazar datos', `Se sustituirán los datos actuales por los de la copia (${data.movimientos.length} movimientos).`, 'Reemplazar', true))) return;
    Store.replaceData(data); await Store.commit('Importar copia'); toast(`Copia importada: ${data.movimientos.length} movimientos`); state.view = 'dash'; render();
  } catch (e) { alert('No se pudo importar: ' + e.message); }
}

/* ===================== Movimientos ===================== */
function subgrupoSelect(id, sel, allowEmpty = true) {
  const cat = D().catalogo;
  return `<select id="${id}">${allowEmpty ? `<option value="">— Sin clasificar —</option>` : ''}${Object.entries(C.GRUPOS).map(([g, n]) => `<optgroup label="${n}">${(cat[g] || []).map(s => `<option value="${esc(s)}" ${s === sel ? 'selected' : ''}>${esc(s)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}
/** Formato de mes asignado: "2026 Oct". */
const mesCorto = (anio, mes) => anio && mes ? `${anio} ${C.MESES_C[mes - 1]}` : 'Sin mes';
/** Desplegable Año-Mes ("2026 Oct"). value = "AAAA-MM". Ofrece desde 2 años antes hasta 1 después de la referencia. */
function mesSelect(attrs, value, refAnio) {
  const y0 = (value ? +value.slice(0, 4) : refAnio || new Date().getFullYear());
  let opts = '<option value="">— Sin mes —</option>';
  for (let y = y0 + 1; y >= y0 - 2; y--) for (let m = 12; m >= 1; m--) {
    const v = `${y}-${String(m).padStart(2, '0')}`; opts += `<option value="${v}" ${v === value ? 'selected' : ''}>${mesCorto(y, m)}</option>`;
  }
  return `<select ${attrs}>${opts}</select>`;
}
const impDiv = (m) => `${(m.importe || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${esc(m.divisa || 'EUR')}`;
function movCard(m, rep, extra = '') {
  const fc = m.subgrupo ? colorSub(D(), m.subgrupo) : 'var(--warn)';
  const se = m.grupo === 'SE';
  return `<div class="mov mv3 ${se ? 'se' : ''}" data-id="${m.id}" style="box-shadow:inset 4px 0 0 ${fc}">${extra}
    <div class="r1"><span class="imp num ${se ? '' : cls(m.importe)}">${impDiv(m)}</span><span class="c2 ${m.concepto2 ? '' : 'muted'}">${esc(m.concepto2 || 'Sin concepto 2')}</span></div>
    <div class="r2">${m.mes && m.anio ? `<span class="tag">${mesCorto(m.anio, m.mes)}</span>` : '<span class="tag warn">Sin mes</span>'}
      ${m.subgrupo ? `<span class="tag" style="background:${tint(fc, 22)}"><span class="sw" style="background:${fc}"></span>${esc(C.GRUPOS[m.grupo] || '')} › ${esc(m.subgrupo)}</span>` : '<span class="tag warn">Sin clasificar</span>'}
      ${rep.has(m.id) ? '<span class="tag bad">R · posible repetido</span>' : ''}</div>
    <div class="r3">${fecha(m.fecha)} · ${esc(m.concepto)}${m.movimiento ? ' · ' + esc(m.movimiento) : ''}</div></div>`;
}

function renderMovs(main) {
  const f = state.mv; const all = D().movimientos; const rep = C.repetidos(all);
  const years = [...new Set(all.map(m => m.anio).filter(Boolean))].sort();
  const nPend = all.filter(m => !C.valido(m)).length;
  let list = all.filter(m => {
    if (f.estado === 'pend' && C.valido(m)) return false;
    if (f.estado === 'rep' && !rep.has(m.id)) return false;
    if (f.anio && m.anio !== +f.anio) return false;
    if (f.mes && m.mes !== +f.mes) return false;
    if (f.grupo && m.grupo !== f.grupo) return false;
    if (f.q) { const q = f.q.toLowerCase(); if (![m.concepto, m.movimiento, m.concepto2, m.subgrupo, m.observaciones, m.importe].some(x => String(x ?? '').toLowerCase().includes(q))) return false; }
    return true;
  }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const total = list.reduce((s, m) => s + m.importe, 0);
  main.innerHTML = `
  <div class="toolbar"><label class="btn primary">⬆︎ Importar extracto<input type="file" id="impF" accept=".xlsx,.xls,.csv" hidden></label>
    <button class="btn ghost" id="newMov">＋ Manual</button><span class="grow"></span>
    <button class="chip ${f.estado === 'pend' ? 'on' : ''}" data-e="pend">Sin clasificar · ${nPend}</button><button class="chip ${f.estado === 'rep' ? 'on' : ''}" data-e="rep">Repetidos · ${rep.size}</button></div>
  <div class="toolbar"><input type="text" id="mvQ" placeholder="Buscar…" value="${esc(f.q)}" style="flex:1;min-width:140px">
    <select id="mvA"><option value="">Año</option>${years.map(y => `<option ${+f.anio === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
    <select id="mvM"><option value="">Mes</option>${C.MESES.map((n, i) => `<option value="${i + 1}" ${+f.mes === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select id="mvG"><option value="">Grupo</option>${Object.entries(C.GRUPOS).map(([k, n]) => `<option value="${k}" ${f.grupo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <p class="small muted" style="margin:0 2px 10px">${list.length} movimientos · suma <b class="${cls(total)}">${eur(total)}</b>${nPend ? ' · <a href="#" id="reapp">Reaplicar reglas a los sin clasificar</a>' : ''}</p>
  <div class="mov-list">${list.slice(0, f.limit).map(m => movCard(m, rep)).join('') || '<div class="card empty">No hay movimientos con estos filtros.</div>'}</div>
  ${list.length > f.limit ? `<div style="text-align:center;margin:14px"><button class="btn ghost" id="more">Ver más (${list.length - f.limit})</button></div>` : ''}`;
  $('#impF', main).onchange = (e) => importarExtracto(e.target.files[0]);
  $('#newMov', main).onclick = () => editarMov(null);
  $$('[data-e]', main).forEach(b => b.onclick = () => { f.estado = f.estado === b.dataset.e ? '' : b.dataset.e; f.limit = 60; render(); });
  let qt; $('#mvQ', main).oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; f.limit = 60; render(); const i = $('#mvQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
  $('#mvA', main).onchange = (e) => { f.anio = e.target.value; render(); };
  $('#mvM', main).onchange = (e) => { f.mes = e.target.value; render(); };
  $('#mvG', main).onchange = (e) => { f.grupo = e.target.value; render(); };
  $('#more', main) && ($('#more', main).onclick = () => { f.limit += 100; render(); });
  $('#reapp', main) && ($('#reapp', main).onclick = async (e) => { e.preventDefault(); let n = 0; D().movimientos.forEach(m => { if (!C.valido(m)) { const was = m.subgrupo; C.clasificar(D(), m); if (m.subgrupo && !was) n++; } }); await Store.commit('Reaplicar reglas'); toast(`${n} movimientos clasificados`); });
  $$('.mov[data-id]', main).forEach(el => el.onclick = () => editarMov(all.find(m => m.id === el.dataset.id)));
}

function showMovList(title, movs) {
  const rep = C.repetidos(D().movimientos); const t = movs.reduce((s, m) => s + m.importe, 0);
  modal(`<h2>${esc(title)}</h2><p class="small muted">${movs.length} movimientos · ${eur(t)}</p><div class="mov-list">${movs.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(m => movCard(m, rep)).join('') || '<div class="empty">Sin movimientos</div>'}</div><div class="actions"><button class="btn ghost" id="x">Cerrar</button></div>`,
    (s, close) => { $('#x', s).onclick = () => close(); $$('.mov', s).forEach(el => el.onclick = () => { close(); editarMov(D().movimientos.find(m => m.id === el.dataset.id)); }); });
}

const newId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function editarMov(m) {
  const nuevo = !m; const rep = C.repetidos(D().movimientos);
  m = m ? { ...m } : { id: newId(), fecha: new Date().toISOString().slice(0, 10), fvalor: '', concepto: '', movimiento: '', importe: 0, divisa: 'EUR', concepto2: '', grupo: null, subgrupo: null, mes: null, anio: null, manual: true };
  await modal(`<h2>${nuevo ? 'Nuevo movimiento' : 'Movimiento'}</h2>
  ${rep.has(m.id) ? `<div class="note" style="background:var(--bad-bg);margin-bottom:10px">⚠️ Coincide en F.Valor, Concepto, Movimiento e Importe con otro movimiento. Si es un duplicado, elimínalo; si es casualidad, marca "No es repetido".<label style="display:flex;gap:8px;margin-top:8px"><input type="checkbox" id="eNR"> No es repetido</label></div>` : ''}
  <div class="form">
    <div class="row"><label>Fecha<input type="date" id="eF" value="${m.fecha || ''}"></label><label>F. Valor<input type="date" id="eFV" value="${m.fvalor || ''}"></label></div>
    <label>Concepto<input type="text" id="eC" value="${esc(m.concepto)}"></label>
    <label>Movimiento<input type="text" id="eM" value="${esc(m.movimiento)}"></label>
    <div class="row"><label>Importe (gasto en negativo)<input type="number" step="0.01" id="eI" value="${m.importe}"></label><label>Divisa<input type="text" id="eD" value="${esc(m.divisa)}"></label></div>
    <label>Concepto 2 (tu descripción)<input type="text" id="eC2" value="${esc(m.concepto2)}" placeholder="¿De dónde viene?"></label>
    <label>Grupo › Subgrupo${subgrupoSelect('eS', m.subgrupo)}</label>
    <label>Año Mes asignado${mesSelect('id="eMM"', m.anio && m.mes ? `${m.anio}-${String(m.mes).padStart(2, '0')}` : '', +(m.fecha || '').slice(0, 4))}</label>
  </div>
  <div class="actions">${nuevo ? '' : '<button class="btn danger left" id="eDel">Eliminar</button><button class="btn ghost" id="eRule" title="Guarda el movimiento y crea una regla con su concepto">Guardar y crear regla</button>'}<button class="btn ghost" id="eX">Cancelar</button><button class="btn primary" id="eOk">Guardar</button></div>`,
    (s, close) => {
      $('#eS', s).onchange = () => { if (!$('#eMM', s).value && $('#eF', s).value) { const r = C.matchRule(D(), { concepto: $('#eC', s).value, movimiento: $('#eM', s).value }); const d = C.mesAnioPorDefecto($('#eF', s).value, r?.mesSiguiente); $('#eMM', s).value = `${d.anio}-${String(d.mes).padStart(2, '0')}`; } };
      $('#eX', s).onclick = () => close();
      const read = () => {
        const sub = $('#eS', s).value || null;
        return { ...m, fecha: $('#eF', s).value, fvalor: $('#eFV', s).value || $('#eF', s).value, concepto: $('#eC', s).value.trim(), movimiento: $('#eM', s).value.trim(), importe: Math.round(parseFloat($('#eI', s).value || 0) * 100) / 100, divisa: $('#eD', s).value || 'EUR', concepto2: $('#eC2', s).value.trim(), subgrupo: sub, grupo: sub ? C.grupoDeSubgrupo(D(), sub) : null, mes: $('#eMM', s).value ? +$('#eMM', s).value.slice(5) : null, anio: $('#eMM', s).value ? +$('#eMM', s).value.slice(0, 4) : null, ...($('#eNR', s)?.checked ? { noRepetido: true } : {}) };
      };
      $('#eOk', s).onclick = async () => {
        const v = read(); if (!v.fecha) return alert('Indica la fecha');
        const L = D().movimientos; const i = L.findIndex(x => x.id === v.id); if (i >= 0) L[i] = v; else L.push(v);
        await Store.commit(nuevo ? 'Nuevo movimiento' : 'Editar movimiento'); close(); toast('Guardado');
      };
      if (!nuevo) {
        $('#eDel', s).onclick = async () => { if (await confirmDlg('Eliminar movimiento', `${esc(m.concepto)} · ${eur(m.importe)}`, 'Eliminar', true)) { D().movimientos = D().movimientos.filter(x => x.id !== m.id); await Store.commit('Eliminar movimiento'); close(); toast('Eliminado'); } };
        $('#eRule', s).onclick = async () => {
          const v = read(); if (!v.fecha) return alert('Indica la fecha');
          const L = D().movimientos; const i = L.findIndex(x => x.id === v.id); if (i >= 0) L[i] = v; else L.push(v);
          await Store.commit('Editar movimiento'); close(); toast('Movimiento guardado');
          editarRegla(null, { patron: v.concepto || v.movimiento, tipo: 'exacto', grupo: v.grupo, subgrupo: v.subgrupo, mesSiguiente: false });
        };
      }
    });
}

/* ---------- Importación de extracto (panel lateral, no bloquea la lista para poder comparar) ---------- */
let impPanel = null;
function cerrarPanel() { impPanel?.remove(); impPanel = null; document.body.classList.remove('with-panel', 'panel-min'); }

async function importarExtracto(file) {
  if (!file) return;
  if (impPanel && !(await confirmDlg('Importación en curso', 'Ya tienes una importación abierta sin guardar. ¿Descartarla y abrir el nuevo fichero?', 'Descartar', true))) return;
  cerrarPanel();
  let filas;
  try { filas = parseExtracto(await leerHoja(file)); } catch (e) { return alert('No se pudo leer el fichero: ' + e.message); }
  if (!filas.length) return alert('No he encontrado movimientos en el fichero.');
  const nuevos = filas.map(r => C.clasificar(D(), { id: newId(), ...r, concepto2: '', grupo: null, subgrupo: null, mes: null, anio: null }));
  const match = C.emparejarImportacion(D().movimientos, nuevos);
  nuevos.forEach((m, i) => { m._repId = match[i] && match[i] !== 'lote' ? match[i] : null; m._rep = !!match[i]; m._inc = !m._rep; });
  const nRep = nuevos.filter(m => m._rep).length, nCl = nuevos.filter(m => m.subgrupo).length;
  impPanel = document.createElement('aside'); impPanel.className = 'imp-panel'; impPanel.setAttribute('aria-label', 'Revisar importación');
  impPanel.innerHTML = `<div class="imp-head"><div><h2>Revisar importación</h2>
      <p class="small ink2">${nuevos.length} leídos · ${nCl} clasificados · <b>${nRep} posibles repetidos</b> (desmarcados). Toca <b>R</b> para ver el original en la lista.</p></div>
      <button class="iconbtn" id="iMin" title="Minimizar">▁</button></div>
    <div class="toolbar"><button class="chip" id="selAll">Marcar todos</button><button class="chip" id="selNone">Desmarcar todos</button><span class="grow"></span><span class="small muted" id="iCnt"></span></div>
    <div class="mov-list" id="impList">${nuevos.map((m, i) => { const mm = m.anio ? `${m.anio}-${String(m.mes).padStart(2, '0')}` : ''; return `<div class="mov imp4 ${m._rep ? 'is-rep' : ''}" data-i="${i}">
      <div class="r1"><input type="checkbox" class="inc" ${m._inc ? 'checked' : ''} aria-label="Importar"><span class="imp num ${cls(m.importe)}">${impDiv(m)}</span><span class="t">${esc(m.concepto)}</span><span class="mv muted">${esc(m.movimiento)}</span></div>
      <div class="r2">${m._rep ? `<button class="tag bad rflag" title="${m._repId ? 'Ver el movimiento que ya existe' : 'Repetido dentro de este mismo fichero'}">R · ${m._repId ? 'ya existe' : 'repetido en el fichero'}</button>` : '<span class="tag ok">Nuevo</span>'}<span class="tag ftag" title="Fecha del movimiento">${fecha(m.fecha)}</span><span class="obs muted">${esc(m.observaciones || '')}</span></div>
      <input type="text" class="c2" placeholder="Concepto 2 (de dónde viene)">
      <div class="r4">${subgrupoSelect('s' + i, m.subgrupo).replace('<select', '<select class="sg"')}${mesSelect('class="mm" aria-label="Año Mes"', mm, +m.fecha.slice(0, 4))}</div></div>`; }).join('')}</div>
    <div class="actions"><button class="btn ghost" id="iX">Cancelar</button><button class="btn primary" id="iOk">Importar seleccionados</button></div>
    <button class="imp-min-bar" id="iMax">⬆︎ Importación en curso · ${nuevos.length} movimientos · Abrir</button>`;
  document.body.appendChild(impPanel); document.body.classList.add('with-panel');
  const s = impPanel;
  const count = () => { $('#iCnt', s).textContent = `${$$('.inc:checked', s).length} seleccionados`; };
  count();
  $('#selAll', s).onclick = () => { $$('.inc', s).forEach(c => c.checked = true); count(); };
  $('#selNone', s).onclick = () => { $$('.inc', s).forEach(c => c.checked = false); count(); };
  $$('.inc', s).forEach(c => c.onchange = count);
  $('#iMin', s).onclick = () => document.body.classList.add('panel-min');
  $('#iMax', s).onclick = () => document.body.classList.remove('panel-min');
  $$('#impList .mov', s).forEach(el => {
    const m = nuevos[+el.dataset.i];
    $('.sg', el).onchange = (e) => {
      el.classList.toggle('se', C.grupoDeSubgrupo(D(), e.target.value) === 'SE');
      if (!$('.mm', el).value) { const r = C.matchRule(D(), m); const d = C.mesAnioPorDefecto(m.fecha, r?.mesSiguiente); $('.mm', el).value = `${d.anio}-${String(d.mes).padStart(2, '0')}`; }
    };
    const rf = $('.rflag', el);
    if (rf) rf.onclick = () => {
      // Mostrar en la lista de la izquierda el movimiento que ya existe
      const orig = D().movimientos.find(x => x.id === m._repId);
      Object.assign(state.mv, { q: (orig || m).concepto, anio: '', mes: '', grupo: '', estado: '', limit: 200 });
      if (state.view !== 'movs') state.view = 'movs';
      render();
      const card = orig && document.querySelector(`#main .mov[data-id="${orig.id}"]`);
      if (card) { card.classList.add('sel'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      if (window.innerWidth < 900) document.body.classList.add('panel-min');
    };
  });
  $('#iX', s).onclick = async () => { if (await confirmDlg('Cancelar importación', 'No se guardará ningún movimiento de este fichero.', 'Descartar', true)) cerrarPanel(); };
  $('#iOk', s).onclick = async () => {
    let n = 0;
    $$('#impList .mov', s).forEach(el => {
      const m = nuevos[+el.dataset.i]; if (!$('.inc', el).checked) return;
      const sub = $('.sg', el).value || null; const mm = $('.mm', el).value;
      D().movimientos.push({ id: m.id, fecha: m.fecha, fvalor: m.fvalor, concepto: m.concepto, movimiento: m.movimiento, importe: m.importe, divisa: m.divisa, observaciones: m.observaciones || '', concepto2: $('.c2', el).value.trim(), subgrupo: sub, grupo: sub ? C.grupoDeSubgrupo(D(), sub) : null, mes: mm ? +mm.slice(5) : null, anio: mm ? +mm.slice(0, 4) : null });
      n++;
    });
    cerrarPanel(); state.mv = { ...state.mv, q: '', estado: '', limit: 60 };
    await Store.commit(`Importar ${n} movimientos`); toast(`${n} movimientos importados`); render();
  };
}

/* ===================== Ajustes ===================== */
async function editarRegla(idx, preset) {
  const r = idx != null ? { ...D().reglas[idx] } : { patron: '', tipo: 'exacto', grupo: null, subgrupo: null, mesSiguiente: false, ...preset };
  await modal(`<h2>${idx != null ? 'Editar regla' : 'Nueva regla'}</h2><div class="form">
    <label>Texto a buscar en Concepto o Movimiento<input type="text" id="rP" value="${esc(r.patron)}"></label>
    <label>Tipo de coincidencia<select id="rT"><option value="exacto" ${r.tipo !== 'contiene' ? 'selected' : ''}>Exacta (como en tu Excel)</option><option value="contiene" ${r.tipo === 'contiene' ? 'selected' : ''}>Contiene el texto</option></select></label>
    <label>Asignar a${subgrupoSelect('rS', r.subgrupo, false)}</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rN" ${r.mesSiguiente ? 'checked' : ''}> Asignar al mes siguiente (p. ej. nómina o hipoteca cobradas a fin de mes)</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rApply" checked> Aplicar ahora a los movimientos sin clasificar que coincidan</label></div>
    <div class="actions">${idx != null ? '<button class="btn danger left" id="rDel">Eliminar</button>' : ''}<button class="btn ghost" id="rX">Cancelar</button><button class="btn primary" id="rOk">Guardar</button></div>`,
    (s, close) => {
      $('#rX', s).onclick = () => close();
      $('#rDel', s) && ($('#rDel', s).onclick = async () => { D().reglas.splice(idx, 1); await Store.commit('Eliminar regla'); close(); });
      $('#rOk', s).onclick = async () => {
        const sub = $('#rS', s).value; const v = { patron: $('#rP', s).value.trim(), tipo: $('#rT', s).value, subgrupo: sub, grupo: C.grupoDeSubgrupo(D(), sub), mesSiguiente: $('#rN', s).checked };
        if (!v.patron) return alert('Indica el texto');
        if (idx != null) D().reglas[idx] = v; else D().reglas.unshift(v);
        let n = 0; if ($('#rApply', s).checked) D().movimientos.forEach(m => { if (!m.subgrupo && C.matchRule(D(), m) === v) { C.clasificar(D(), m); n++; } });
        await Store.commit('Regla ' + v.patron); close(); toast(n ? `Regla guardada · ${n} movimientos clasificados` : 'Regla guardada');
      };
    });
}

function renderAjustes(main) {
  const s = Store.sync || {}; const aj = D().ajustes;
  main.innerHTML = `
  <div class="card"><h2>☁️ Sincronización con GitHub</h2><p class="sub">Tus datos se guardan como <code>data.json</code> en un repositorio <b>privado</b> tuyo. El token se guarda cifrado con tu PIN.</p>
    <div class="form">
      <div class="row"><label>Usuario de GitHub<input type="text" id="ghOwner" value="${esc(s.owner || '')}" autocapitalize="off" placeholder="tu-usuario"></label>
        <label>Repositorio privado<input type="text" id="ghRepo" value="${esc(s.repo || 'finanzas-datos')}" autocapitalize="off"></label></div>
      <div class="row"><label>Fichero<input type="text" id="ghPath" value="${esc(s.path || 'data.json')}" autocapitalize="off"></label>
        <label>Rama (opcional)<input type="text" id="ghBranch" value="${esc(s.branch || '')}" placeholder="main" autocapitalize="off"></label></div>
      <label>Token personal (fine-grained, permiso Contents: Read and write)<input type="password" id="ghToken" value="${esc(s.token || '')}" placeholder="github_pat_…" autocomplete="off"></label>
    </div>
    <p class="small muted" id="ghInfo">${Store.syncConfigured() ? `Estado: <b>${esc(Store.statusMsg || Store.status)}</b>${s.lastSync ? ` · última sincronización ${new Date(s.lastSync).toLocaleString('es-ES')}` : ''}` : 'No configurado: los datos solo están en este dispositivo.'}</p>
    <div class="actions">${Store.syncConfigured() ? '<button class="btn danger left" id="ghOff">Desconectar</button><button class="btn ghost" id="ghNow">Sincronizar ahora</button>' : ''}<button class="btn primary" id="ghSave">Probar y guardar</button></div></div>

  <details class="card" style="margin-top:14px"><summary>🏷️ Reglas de clasificación (${D().reglas.length})</summary>
    <p class="sub">Se aplican en orden; la primera que coincide gana. Equivalen a tu hoja SideTables.</p>
    <div class="toolbar"><input type="text" id="rq" placeholder="Filtrar reglas…" style="flex:1"><button class="btn primary" id="rNew">＋ Regla</button></div>
    <div class="list" id="rList"></div></details>

  <details class="card" style="margin-top:14px"><summary>🗂️ Grupos y subgrupos</summary>
    ${Object.entries(C.GRUPOS).map(([g, n]) => `<h3 style="margin-top:12px">${n}</h3><div class="chips">${(D().catalogo[g] || []).map(sb => `<button class="chip" data-g="${g}" data-s="${esc(sb)}"><span class="sw" style="background:${colorSub(D(), sb)}"></span>${esc(sb)} ✎</button>`).join('')}<button class="chip on" data-add="${g}">＋ Añadir</button></div>`).join('')}
    <p class="small muted" style="margin-top:10px">Renombrar un subgrupo actualiza también tus movimientos, reglas y préstamos.</p></details>

  <details class="card" style="margin-top:14px"><summary>📚 Histórico manual (años sin movimientos)</summary>
    <p class="sub">Totales anuales con signo (gastos en negativo), como en tu hoja Gasto Anual (W:Y).</p>
    <div class="table-wrap"><table class="fin num" id="hTbl"><thead><tr><th>Año</th><th>Ingreso</th><th>Preahorro</th><th>G. mensual fijo</th><th>Efectivo</th><th>G. anual fijo</th><th>G. extra</th><th></th></tr></thead><tbody>
    ${(D().historico || []).map((h, i) => `<tr data-i="${i}"><td><input type="number" data-k="anio" value="${h.anio}" style="width:76px"></td>${['ingreso', 'preahorro', 'gmf', 'efectivo', 'gaf', 'gex'].map(k => `<td><input type="number" step="0.01" data-k="${k}" value="${h[k] ?? 0}" style="width:110px;text-align:right"></td>`).join('')}<td><button class="btn danger" data-del="${i}">✕</button></td></tr>`).join('')}
    </tbody></table></div><div class="actions"><button class="btn ghost" id="hAdd">＋ Año</button><button class="btn primary" id="hSave">Guardar histórico</button></div></details>

  <div class="card" style="margin-top:14px"><h2>🎨 Visualización</h2><div class="form">
    <label>Tema<select id="aTema"><option value="auto">Automático (según el sistema)</option><option value="light" ${aj.tema === 'light' ? 'selected' : ''}>Claro</option><option value="dark" ${aj.tema === 'dark' ? 'selected' : ''}>Oscuro</option></select></label></div></div>

  <div class="card" style="margin-top:14px"><h2>🔒 Seguridad y copias</h2><div class="form">
    <label>Bloqueo automático tras estar en segundo plano<select id="aLock">${[[1, '1 minuto'], [5, '5 minutos'], [15, '15 minutos'], [60, '1 hora'], [0, 'Nunca']].map(([v, n]) => `<option value="${v}" ${aj.autoLock == v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <div class="actions" style="justify-content:flex-start"><button class="btn ghost" id="aPin">Cambiar PIN</button><button class="btn ghost" id="aExp">Exportar copia (.json)</button><label class="btn ghost">Importar copia<input type="file" id="aImp" accept=".json" hidden></label></div>
    <div class="actions" style="justify-content:flex-start"><button class="btn danger" id="aWipe">Borrar datos de este dispositivo</button></div></div>
  <p class="small muted" style="text-align:center;margin:18px">Mis Finanzas · v<span id="ver"></span> · ${D().movimientos.length} movimientos</p>`;
  $('#ver', main).textContent = window.APP_VERSION || '';

  // GitHub
  $('#ghSave', main).onclick = async () => {
    const cfg = { owner: $('#ghOwner').value.trim(), repo: $('#ghRepo').value.trim(), path: $('#ghPath').value.trim() || 'data.json', branch: $('#ghBranch').value.trim(), token: $('#ghToken').value.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) return alert('Rellena usuario, repositorio y token.');
    $('#ghInfo').textContent = 'Probando conexión…';
    try {
      const t = await Store.testConnection(cfg);
      if (!t.private && !(await confirmDlg('⚠️ Repositorio público', 'Ese repositorio es <b>público</b>: cualquiera podría ver tus finanzas. Te recomiendo hacerlo privado (Settings → Danger Zone → Change visibility). ¿Continuar igualmente?', 'Continuar', true))) return;
      let usarRemoto = false;
      if (t.remote.exists) {
        const n = t.remote.data.movimientos?.length || 0;
        usarRemoto = !D().movimientos.length || await choiceDlg('Datos encontrados en GitHub', `El repositorio ya tiene datos (${n} movimientos). En este dispositivo hay ${D().movimientos.length}.`, [{ label: 'Subir los de este dispositivo', value: false }, { label: 'Usar los de GitHub', value: true, primary: true }]);
      }
      Store.vault.sync = { ...cfg, sha: t.remote.exists ? t.remote.sha : null, dirty: false };
      if (usarRemoto) { Store.replaceData(t.remote.data); Store.vault.sync.lastSync = new Date().toISOString(); await Store.saveLocal(); Store.setStatus('ok', 'Sincronizado'); toast('Datos cargados desde GitHub'); state.view = 'dash'; render(); }
      else { Store.vault.sync.dirty = true; await Store.saveLocal(); await Store.push('Subida inicial'); toast(Store.status === 'ok' ? 'Conectado y datos subidos' : Store.statusMsg); render(); }
    } catch (e) { $('#ghInfo').textContent = '❌ ' + e.message; }
  };
  $('#ghNow', main) && ($('#ghNow', main).onclick = async () => { await Store.pull(resolverConflicto); if (Store.vault.sync.dirty) await Store.push('Manual'); toast(Store.statusMsg); render(); });
  $('#ghOff', main) && ($('#ghOff', main).onclick = async () => { if (await confirmDlg('Desconectar GitHub', 'Los datos se quedan en este dispositivo y en tu repositorio, pero dejarán de sincronizarse.', 'Desconectar')) { Store.vault.sync = {}; await Store.saveLocal(); Store.setStatus('off'); render(); } });

  // Reglas
  const drawRules = () => {
    const q = ($('#rq', main).value || '').toLowerCase();
    $('#rList', main).innerHTML = D().reglas.map((r, i) => ({ r, i })).filter(({ r }) => !q || (r.patron + r.subgrupo).toLowerCase().includes(q)).map(({ r, i }) =>
      `<div class="it" data-i="${i}" style="cursor:pointer"><div class="grow"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${esc(r.patron)}</b></div><div class="small muted">${r.tipo === 'contiene' ? 'contiene' : 'exacto'} → ${esc(C.GRUPOS[r.grupo] || '?')} › ${esc(r.subgrupo)}${r.mesSiguiente ? ' · mes siguiente' : ''}</div></div><span class="muted">✎</span></div>`).join('') || '<div class="empty">Sin reglas</div>';
    $$('#rList .it', main).forEach(el => el.onclick = () => editarRegla(+el.dataset.i));
  };
  $('#rq', main).oninput = drawRules; drawRules();
  $('#rNew', main).onclick = () => editarRegla(null);

  // Catálogo
  $$('[data-add]', main).forEach(b => b.onclick = async () => { const n = prompt('Nombre del nuevo subgrupo'); if (n && n.trim()) { D().catalogo[b.dataset.add].push(n.trim()); await Store.commit('Nuevo subgrupo'); } });
  $$('[data-s]', main).forEach(b => b.onclick = async () => {
    const g = b.dataset.g, old = b.dataset.s; const usados = D().movimientos.filter(m => m.subgrupo === old).length;
    const n = prompt(`Renombrar "${old}" (${usados} movimientos).\nDeja vacío para eliminarlo (solo si no se usa).`, old);
    if (n === null || n === old) return;
    if (!n.trim()) { if (usados) return alert('No se puede eliminar: tiene movimientos.'); D().catalogo[g] = D().catalogo[g].filter(x => x !== old); }
    else { const nn = n.trim(); D().catalogo[g] = D().catalogo[g].map(x => x === old ? nn : x); D().movimientos.forEach(m => { if (m.subgrupo === old) m.subgrupo = nn; }); D().reglas.forEach(r => { if (r.subgrupo === old) r.subgrupo = nn; }); (D().prestamos || []).forEach(p => { if (p.subgrupo === old) p.subgrupo = nn; }); }
    await Store.commit('Catálogo');
  });

  // Histórico
  $('#hAdd', main).onclick = () => { const ys = (D().historico || []).map(h => h.anio); (D().historico ||= []).push({ anio: ys.length ? Math.max(...ys) + 1 : new Date().getFullYear() - 1, ingreso: 0, preahorro: 0, gmf: 0, efectivo: 0, gaf: 0, gex: 0 }); render(); };
  $$('#hTbl [data-del]', main).forEach(b => b.onclick = async () => { D().historico.splice(+b.dataset.del, 1); await Store.commit('Histórico'); });
  $('#hSave', main).onclick = async () => { D().historico = $$('#hTbl tbody tr', main).map(tr => Object.fromEntries($$('input', tr).map(i => [i.dataset.k, +i.value || 0]))).sort((a, b) => a.anio - b.anio); await Store.commit('Histórico'); toast('Histórico guardado'); };

  // Visual / seguridad
  $('#aTema', main).onchange = async (e) => { aj.tema = e.target.value; applyTheme(); chartDefaults(); await Store.commit('Ajustes'); };
  $('#aLock', main).onchange = async (e) => { aj.autoLock = +e.target.value; await Store.commit('Ajustes'); };
  $('#aPin', main).onclick = async () => {
    const p1 = prompt('Nuevo PIN (4-6 dígitos)'); if (!p1) return; if (!/^\d{4,6}$/.test(p1)) return alert('El PIN debe tener entre 4 y 6 dígitos');
    if (prompt('Repite el nuevo PIN') !== p1) return alert('No coinciden'); await Store.changePin(p1); toast('PIN cambiado');
  };
  $('#aExp', main).onclick = () => download(`finanzas-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(D(), null, 1));
  $('#aImp', main).onchange = (e) => importarCopia(e.target.files[0]);
  $('#aWipe', main).onclick = async () => { if (await confirmDlg('Borrar este dispositivo', 'Se eliminan los datos, el PIN y el token guardados en este dispositivo. Tu repositorio de GitHub no se toca.', 'Borrar todo', true)) { Store.wipe(); localStorage.removeItem('fz_ui'); lockScreen(); } };
}

/* ===================== Arranque ===================== */
// Cualquier error inesperado se muestra en pantalla (antes fallaba en silencio)
window.addEventListener('error', (e) => toast('⚠️ Error: ' + (e.message || e.error), 6000));
window.addEventListener('unhandledrejection', (e) => toast('⚠️ Error: ' + (e.reason?.message || e.reason), 6000));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(console.warn);
lockScreen();
