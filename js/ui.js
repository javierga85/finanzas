// Utilidades de interfaz y gráficos
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fEur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fEur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fNum = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur = (v) => fEur.format(v || 0);
export const eur0 = (v) => fEur0.format(v || 0);
export const num = (v) => fNum.format(v || 0);
export const pct = (v) => isFinite(v) ? (v * 100).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %' : '–';
export const fecha = (iso) => iso ? iso.split('-').reverse().join('/') : '';
export const cls = (v) => v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : '';

export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export const SERIES = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => css('--s' + i));

export function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

/** Hoja modal. render(sheetEl, close) ; devuelve promesa resuelta con el valor de close(v) */
export function modal(html, setup) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    const close = (v) => { ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(undefined); });
    setup && setup(ov.firstElementChild, close);
  });
}
export function confirmDlg(title, text, okText = 'Aceptar', danger = false) {
  return modal(`<h2>${esc(title)}</h2><p class="ink2">${text}</p><div class="actions"><button class="btn ghost" data-v="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(okText)}</button></div>`,
    (s, close) => s.querySelectorAll('[data-v]').forEach(b => b.onclick = () => close(b.dataset.v === '1')));
}
export function choiceDlg(title, text, options) {
  return modal(`<h2>${esc(title)}</h2><p class="ink2">${text}</p><div class="actions">${options.map((o, i) => `<button class="btn ${o.primary ? 'primary' : 'ghost'}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`,
    (s, close) => s.querySelectorAll('[data-i]').forEach(b => b.onclick = () => close(options[+b.dataset.i].value)));
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------------- Gráficos (Chart.js) ---------------- */
const charts = new Map();
export function destroyCharts() { charts.forEach(c => c.destroy()); charts.clear(); }

export function chartDefaults() {
  const C = window.Chart; if (!C) return;
  C.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  C.defaults.font.size = 12;
  C.defaults.color = css('--muted');
  C.defaults.borderColor = css('--grid');
  C.defaults.plugins.legend.display = false;
  C.defaults.plugins.tooltip.backgroundColor = css('--ink');
  C.defaults.plugins.tooltip.titleColor = css('--page');
  C.defaults.plugins.tooltip.bodyColor = css('--page');
  C.defaults.plugins.tooltip.footerColor = css('--page');
  C.defaults.plugins.tooltip.padding = 10;
  C.defaults.plugins.tooltip.cornerRadius = 8;
  C.defaults.plugins.tooltip.boxPadding = 4;
  C.defaults.maintainAspectRatio = false;
}

export function makeChart(canvas, cfg) {
  if (!window.Chart) return null;
  const old = charts.get(canvas.id); if (old) old.destroy();
  const c = new window.Chart(canvas, cfg); charts.set(canvas.id || Math.random().toString(36), c); return c;
}

export const axisEur = { ticks: { callback: (v) => compactEur(v) }, grid: { color: () => css('--grid') }, border: { display: false } };
export function compactEur(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' M€';
  if (a >= 1e3) return (v / 1e3).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' k€';
  return Math.round(v) + ' €';
}

let uid = 0;
/** Tarjeta de donut con leyenda (valor y %). items: [{n, v}] valores positivos. */
export function donutCard(host, { title, sub = '', items, centerLabel = 'Total', foot = '', mode = 'both', onMode }) {
  const pal = SERIES(); const other = css('--other');
  let list = items.filter(i => i.v > 0.004).sort((a, b) => b.v - a.v);
  if (list.length > 8) { const rest = list.slice(7); list = list.slice(0, 7); list.push({ n: `Otros (${rest.length})`, v: rest.reduce((s, x) => s + x.v, 0), otros: rest }); }
  list.forEach((it, i) => it.c = it.otros ? other : (it.color || pal[i % 8]));
  const total = list.reduce((s, x) => s + x.v, 0);
  const id = 'dn' + (++uid);
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<div class="card-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="sub" style="margin:0">${sub}</p>` : ''}</div>
    ${onMode ? `<div class="seg"><button data-m="eur" class="${mode !== 'pct' ? 'on' : ''}">€</button><button data-m="pct" class="${mode === 'pct' ? 'on' : ''}">%</button></div>` : ''}</div>
    ${total > 0 ? `<div class="donut-wrap"><div class="donut-box"><canvas id="${id}"></canvas><div class="donut-center"><b class="num">${mode === 'pct' ? '100 %' : eur0(total)}</b><span>${esc(centerLabel)}</span></div></div>
    <ul class="legend">${list.map(it => `<li title="${esc(it.otros ? it.otros.map(o => o.n + ': ' + eur(o.v)).join('\n') : it.n)}"><span class="sw" style="background:${it.c}"></span><span class="n">${esc(it.n)}</span>
      ${mode === 'pct' ? '' : `<span class="num">${eur(it.v)}</span>`}<span class="p num">${pct(it.v / total)}</span></li>`).join('')}</ul></div>`
      : `<div class="empty">Sin datos para este periodo</div>`}
    ${foot ? `<p class="sub" style="margin:10px 0 0">${foot}</p>` : ''}`;
  host.appendChild(card);
  if (onMode) card.querySelectorAll('[data-m]').forEach(b => b.onclick = () => onMode(b.dataset.m));
  if (total > 0) makeChart(card.querySelector('canvas'), {
    type: 'doughnut',
    data: { labels: list.map(i => i.n), datasets: [{ data: list.map(i => i.v), backgroundColor: list.map(i => i.c), borderColor: css('--surface'), borderWidth: 2, hoverOffset: 4 }] },
    options: { cutout: '68%', plugins: { tooltip: { callbacks: { label: (c) => ` ${eur(c.raw)} · ${pct(c.raw / total)}` } } } }
  });
  return card;
}
