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
  if (!C.registry.plugins.get('fzLabels')) C.register(labelPlugin);
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

/* ---------------- Modo de visualización: valores / % / ambos / ninguno ---------------- */
export const MODOS = [
  { k: 'both', n: 'Valores y %', s: '€ %' }, { k: 'eur', n: 'Solo valores', s: '€' },
  { k: 'pct', n: 'Solo %', s: '%' }, { k: 'none', n: 'Ninguno (ocultar importes)', s: '—' }
];
export const showEur = (m) => m === 'both' || m === 'eur';
export const showPct = (m) => m === 'both' || m === 'pct';
export const MASK = '•••';
/** Texto de un importe según el modo (base = total para el %). */
export function fmtMode(m, v, base, { compact = false, sep = ' · ' } = {}) {
  const parts = [];
  if (showEur(m)) parts.push(compact ? compactEur(v) : eur(v));
  if (showPct(m) && base) parts.push(pct(Math.abs(v) / Math.abs(base)));
  return parts.join(sep);
}
/** Selector compacto de modo para una tarjeta (permite volver al global). */
export function dispPicker(key, ctx) {
  const ov = ctx.state.dispOv[key]; const g = MODOS.find(x => x.k === ctx.state.disp);
  return `<select class="disp-pick" data-disp="${key}" aria-label="Mostrar valores o porcentajes" title="Valores / %">
    <option value="">Global (${g.s})</option>${MODOS.map(x => `<option value="${x.k}" ${ov === x.k ? 'selected' : ''}>${x.s} ${x.n.replace(' (ocultar importes)', '')}</option>`).join('')}</select>`;
}
export function bindPickers(root, ctx) {
  root.querySelectorAll('select[data-disp]').forEach(sel => sel.onchange = () => {
    if (sel.value) ctx.state.dispOv[sel.dataset.disp] = sel.value; else delete ctx.state.dispOv[sel.dataset.disp];
    ctx.saveUi(); ctx.rerender();
  });
}

/* Plugin de etiquetas de datos para Chart.js.
   options.plugins.fzLabels = { text:(dsIndex, i, value) => string|string[]|null, pos:'top'|'end'|'last' } */
export const labelPlugin = {
  id: 'fzLabels',
  afterDatasetsDraw(chart, _a, opts) {
    if (!opts || !opts.text) return;
    const { ctx } = chart; ctx.save();
    ctx.font = '600 10.5px system-ui,-apple-system,"Segoe UI",sans-serif'; ctx.fillStyle = css('--ink-2');
    const narrow = chart.width < 560; const lh = 12; const lastLabels = [];
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di); if (meta.hidden) return;
      let idxs = meta.data.map((_, i) => i);
      if (opts.pos === 'last') { const li = ds.data.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop(); idxs = li == null ? [] : [li]; }
      idxs.forEach(i => {
        const v = ds.data[i]; if (v == null) return;
        let t = opts.text(di, i, v); if (!t) return; if (!Array.isArray(t)) t = [t];
        const el = meta.data[i];
        if (opts.pos === 'end') { // barra horizontal: positivos a la derecha de la barra; negativos junto al eje 0, lado derecho
          const x0 = chart.scales.x.getPixelForValue(0);
          const x = v < 0 ? x0 + 6 : el.x + 6; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(t.join(' · '), x, el.y);
        } else if (opts.pos === 'last') {
          lastLabels.push({ x: el.x + 6, y: el.y, t, c: ds.borderColor });
        } else if (narrow) { // pantallas estrechas: texto vertical en una línea
          ctx.save(); ctx.translate(el.x, el.y - 4); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(t.join(' · '), 0, 0); ctx.restore();
        } else { // encima de la barra / punto
          const neg = v < 0; ctx.textAlign = 'center'; ctx.textBaseline = neg ? 'top' : 'bottom';
          t.forEach((s, k) => ctx.fillText(s, el.x, neg ? el.y + 4 + k * lh : el.y - 4 - (t.length - 1 - k) * lh));
        }
      });
    });
    if (lastLabels.length) { // evitar solapes entre etiquetas finales de líneas
      lastLabels.sort((a, b) => a.y - b.y);
      const h = (l) => l.t.length * lh;
      for (let k = 1; k < lastLabels.length; k++) {
        const p = lastLabels[k - 1], q = lastLabels[k]; const min = (h(p) + h(q)) / 2 + 1;
        if (q.y - p.y < min) q.y = p.y + min;
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      lastLabels.forEach(l => { ctx.fillStyle = l.c; l.t.forEach((s, k) => ctx.fillText(s, l.x, l.y + (k - (l.t.length - 1) / 2) * lh)); });
    }
    ctx.restore();
  }
};

let uid = 0;
/** Tarjeta de donut. items: [{n, v, color, sign}] con v > 0 (magnitud); sign=-1 para mostrarlo como gasto. */
export function donutCard(host, { title, sub = '', items, centerLabel = 'Total', foot = '', mode = 'both', picker = '', otrosColor, sign = 1, ingreso = 0, pctLabel = 'del total', pctShort = 'del total' }) {
  let list = items.filter(i => i.v > 0.004).sort((a, b) => b.v - a.v);
  if (list.length > 8) { const rest = list.slice(7); list = list.slice(0, 7); list.push({ n: `Otros (${rest.length})`, v: rest.reduce((s, x) => s + x.v, 0), otros: rest, color: otrosColor || css('--other'), sign: rest[0].sign }); }
  list.forEach((it) => { it.c = it.color || css('--other'); it.sg = it.sign ?? sign; });
  const total = list.reduce((s, x) => s + x.v, 0);
  const totalSigned = list.reduce((s, x) => s + x.v * x.sg, 0);
  const id = 'dn' + (++uid);
  const center = showEur(mode) ? eur0(totalSigned) : showPct(mode) ? (ingreso ? pct(total / ingreso) : '100 %') : MASK;
  const ingTxt = ingreso && showPct(mode) ? `<span class="ing">${pct(total / ingreso)} del ingreso</span>` : '';
  // Con ingreso: % principal = sobre el ingreso; secundario (gris) = sobre el total del gráfico
  const pctCell = (v) => ingreso ? `<b title="Sobre tu ingreso total">${pct(v / ingreso)}</b><small title="Sobre el total del gráfico">${pct(v / total)} ${esc(pctShort)}</small>` : pct(v / total);
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<div class="card-head"><div><h2>${esc(title)}</h2>${sub ? `<p class="sub" style="margin:0">${sub}</p>` : ''}</div>${picker}</div>
    ${total > 0 ? `<div class="donut-wrap"><div class="donut-box"><canvas id="${id}"></canvas><div class="donut-center"><b class="num">${center}</b><span>${esc(showEur(mode) || !ingreso ? centerLabel : 'del ingreso')}</span>${showEur(mode) ? ingTxt : ''}</div></div>
    <ul class="legend${ingreso && showPct(mode) ? ' two' : ''}">${list.map(it => `<li title="${esc(it.otros ? it.otros.map(o => o.n + (showEur(mode) ? ': ' + eur(o.v * o.sg) : '')).join('\n') : it.n)}"><span class="sw" style="background:${it.c}"></span><span class="n">${esc(it.n)}</span>
      <span class="num">${showEur(mode) ? eur(it.v * it.sg) : ''}</span><span class="p num">${showPct(mode) ? pctCell(it.v) : ''}</span></li>`).join('')}</ul></div>`
      : `<div class="empty">Sin datos para este periodo</div>`}
    ${ingreso && showPct(mode) && total > 0 ? `<p class="sub" style="margin:8px 0 0"><b>% principal</b>: sobre tu ingreso total (${showEur(mode) ? eur0(ingreso) : 'Salario + Extra'}) · % gris: ${esc(pctLabel)}</p>` : ''}
    ${foot ? `<p class="sub" style="margin:10px 0 0">${foot}</p>` : ''}`;
  host.appendChild(card);
  if (total > 0) makeChart(card.querySelector('canvas'), {
    type: 'doughnut',
    data: { labels: list.map(i => i.n), datasets: [{ data: list.map(i => i.v), backgroundColor: list.map(i => i.c), borderColor: css('--surface'), borderWidth: 2, hoverOffset: 4 }] },
    options: { cutout: '68%', plugins: { tooltip: { callbacks: { label: (c) => { const it = list[c.dataIndex]; const t = fmtMode(mode, it.v * it.sg, total ? total * it.sg : 0); if (ingreso && showPct(mode)) return ' ' + [showEur(mode) ? eur(it.v * it.sg) : '', `${pct(it.v / ingreso)} del ingreso`, `${pct(it.v / total)} ${pctLabel}`].filter(Boolean).join(' · ');
          return t ? ' ' + t : ''; } } } } }
  });
  return card;
}
