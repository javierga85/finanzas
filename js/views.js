// Vistas de análisis: Dashboard, Tabla (Gasto anual), Histórico, Préstamos, Extra
import { Store } from './store.js';
import * as C from './calc.js';
import { $, $$, esc, eur, eur0, pct, fecha, cls, css, SERIES, makeChart, axisEur, compactEur, donutCard, modal, toast, confirmDlg } from './ui.js';
import { leerHoja, parseCuadro } from './importer.js';

const D = () => Store.data;
const abs = (v) => Math.abs(v || 0);
const neg = (v) => -(v || 0); // gasto (negativo) -> magnitud positiva

function yearSelect(years, sel, id = 'yearSel') {
  return `<select id="${id}" aria-label="Año">${years.map(y => `<option ${y == sel ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
}
function sinDatos(main, txt = 'Aún no hay movimientos clasificados.') {
  main.innerHTML = `<div class="card empty"><p>${txt}</p><p class="small">Ve a <b>Movimientos</b> para importar tu extracto o a <b>Ajustes</b> para conectar tus datos.</p></div>`;
}

/* ======================= DASHBOARD ======================= */
export function renderDashboard(main, ctx) {
  const st = ctx.state; const years = C.aniosConMovs(D());
  if (!years.length) return sinDatos(main);
  if (!years.includes(st.year)) st.year = years[years.length - 1];
  const y = st.year; const cube = C.cubo(D()); const a = C.metricasAnio(cube, y);
  const ingreso = a.ingreso, gastos = neg(a.gastos), pre = neg(a.pre), ahorro = ingreso - gastos - pre;
  const pal = SERIES();

  main.innerHTML = `
  <div class="toolbar"><label class="ink2 small">Año</label>${yearSelect(years, y)}<span class="grow"></span><span class="small muted">Datos de ${Object.keys(cube[y] || {}).length} meses</span></div>
  <div class="kpis">
    ${kpi('Ingreso', ingreso, pal[0], 'Salario + Dinero extra')}
    ${kpi('Gastos', gastos, pal[1], 'Mensual fijo + Anual fijo + Extra')}
    ${kpi('Preahorro', pre, pal[2], ingreso ? pct(pre / ingreso) + ' del ingreso' : '')}
    ${kpi('Ahorro', ahorro, pal[3], ingreso ? pct(ahorro / ingreso) + ' del ingreso' : '', true)}
  </div>
  <div class="section-title">Reparto</div>
  <div class="grid c3" id="donuts"></div>
  <div class="section-title">Timeline</div>
  <div class="grid c2">
    <div class="card"><h2>Ingresos vs Gastos + Preahorro</h2><p class="sub">Por mes · la diferencia es el ahorro en cuenta</p>
      <div class="chips" style="margin-bottom:10px">${sw('Ingresos', pal[0])}${sw('Gastos', pal[1])}${sw('Preahorro', pal[2])}</div>
      <div class="chart-box"><canvas id="chBars"></canvas></div></div>
    <div class="card"><h2>Acumulados del año</h2><p class="sub">Toca para mostrar u ocultar</p>
      <div class="chips" id="lineChips" style="margin-bottom:10px"></div>
      <div class="chart-box"><canvas id="chLines"></canvas></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Total anual por grupo · ${y}</h2><p class="sub">Elige qué grupos ver</p>
    <div class="chips" id="grpChips" style="margin-bottom:10px"></div><div class="chart-box" style="height:240px"><canvas id="chGroups"></canvas></div></div>`;
  $('#yearSel', main).onchange = (e) => { st.year = +e.target.value; ctx.rerender(); };

  // Donuts
  const host = $('#donuts', main);
  donutCard(host, { title: 'Ingresos', items: [{ n: 'Salario neto', v: a.sal }, { n: 'Dinero extra ingresado', v: a.ext }], centerLabel: 'Ingreso total' });
  donutCard(host, {
    title: 'Balance', sub: 'Del total ingresado', centerLabel: 'Ingresado',
    items: [{ n: 'Gastos', v: gastos, color: pal[1] }, { n: 'Preahorro', v: pre, color: pal[2] }, { n: 'Ahorro', v: Math.max(0, ahorro), color: pal[3] }],
    foot: ahorro < 0 ? `⚠️ Este año gastas más de lo que ingresas: ahorro ${eur(ahorro)}` : ''
  });
  donutCard(host, { title: 'Gastos', centerLabel: 'Gasto total', items: [{ n: 'Gasto mensual fijo', v: neg(a.gmf) }, { n: 'Gasto anual fijo', v: neg(a.gaf) }, { n: 'Gasto Extra', v: neg(a.gex) }] });
  const subItems = (g) => {
    const its = D().catalogo[g].map(s => ({ n: s, v: neg(a.sub[s]) }));
    const posit = its.filter(i => i.v < -0.004);
    return { its, foot: posit.length ? `No se muestran (saldo a favor): ${posit.map(p => `${esc(p.n)} ${eur(-p.v)}`).join(', ')}` : '' };
  };
  const m1 = subItems('GMF'); donutCard(host, { title: 'Gasto mensual fijo', centerLabel: 'Total', items: m1.its, foot: m1.foot });
  const m2 = subItems('GAF'); donutCard(host, { title: 'Gasto anual fijo', centerLabel: 'Total', items: m2.its, foot: m2.foot });

  // Barras mensuales
  const meses = [...Array(12).keys()].map(i => i + 1);
  const mm = meses.map(m => C.metricasMes(cube, y, m));
  makeChart($('#chBars', main), {
    type: 'bar',
    data: {
      labels: C.MESES_C, datasets: [
        { label: 'Ingresos', data: mm.map(x => x.ingreso), backgroundColor: pal[0], stack: 'i', borderRadius: 4, borderSkipped: 'start' },
        { label: 'Gastos', data: mm.map(x => neg(x.gastos)), backgroundColor: pal[1], stack: 'g', borderRadius: 0 },
        { label: 'Preahorro', data: mm.map(x => neg(x.pre)), backgroundColor: pal[2], stack: 'g', borderRadius: 4, borderSkipped: 'start' }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false }, datasets: { bar: { categoryPercentage: .7, barPercentage: .9, borderColor: css('--surface'), borderWidth: { top: 2 } } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { ...axisEur, stacked: true } },
      plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${eur(c.raw)}`, footer: (it) => { const x = mm[it[0].dataIndex]; return 'Ahorro en cuenta: ' + eur(x.ahorroCuenta); } } } }
    }
  });

  // Líneas acumuladas
  const last = Math.max(0, ...Object.keys(cube[y] || {}).map(Number));
  const acc = (f) => { let s = 0; return meses.map(m => m > last ? null : (s += f(mm[m - 1]), s)); };
  const series = [
    { k: 'ing', n: 'Ingreso acumulado', c: pal[0], d: acc(x => x.ingreso) },
    { k: 'gas', n: 'Gasto acumulado', c: pal[1], d: acc(x => neg(x.gastos)) },
    { k: 'pre', n: 'Preahorro acumulado', c: pal[2], d: acc(x => neg(x.pre)) },
    { k: 'aho', n: 'Ahorro en cuenta acumulado', c: pal[3], d: acc(x => x.ahorroCuenta) },
    { k: 'gt', n: 'Gran total ahorro acumulado', c: pal[6], d: acc(x => x.granTotal) }
  ];
  const drawLines = () => {
    $('#lineChips', main).innerHTML = series.map(s => `<button class="chip ${st.lines[s.k] ? 'on' : ''}" data-k="${s.k}"><span class="sw" style="background:${s.c}"></span>${s.n.replace(' acumulado', '')}</button>`).join('');
    $$('#lineChips .chip', main).forEach(b => b.onclick = () => { st.lines[b.dataset.k] = !st.lines[b.dataset.k]; drawLines(); });
    makeChart($('#chLines', main), {
      type: 'line', data: { labels: C.MESES_C, datasets: series.filter(s => st.lines[s.k]).map(s => ({ label: s.n, data: s.d, borderColor: s.c, backgroundColor: s.c, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .25 })) },
      options: { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false } }, y: axisEur }, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${eur(c.raw)}` } } } }
    });
  };
  drawLines();

  // Barras por grupo
  const grupos = [
    { k: 'ING', n: 'Ingreso', v: a.ingreso, c: pal[0] }, { k: 'PRE', n: 'Preahorro', v: neg(a.pre), c: pal[2] },
    { k: 'GMF', n: 'Gasto mensual fijo', v: neg(a.gmf), c: pal[1] }, { k: 'GAF', n: 'Gasto anual fijo', v: neg(a.gaf), c: pal[4] }, { k: 'GEX', n: 'Gasto Extra', v: neg(a.gex), c: pal[7] }
  ];
  const drawGroups = () => {
    $('#grpChips', main).innerHTML = grupos.map(g => `<button class="chip ${st.groups[g.k] ? 'on' : ''}" data-k="${g.k}"><span class="sw" style="background:${g.c}"></span>${g.n}</button>`).join('');
    $$('#grpChips .chip', main).forEach(b => b.onclick = () => { st.groups[b.dataset.k] = !st.groups[b.dataset.k]; drawGroups(); });
    const sel = grupos.filter(g => st.groups[g.k]);
    makeChart($('#chGroups', main), {
      type: 'bar', data: { labels: sel.map(g => g.n), datasets: [{ data: sel.map(g => g.v), backgroundColor: sel.map(g => g.c), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 46 }] },
      options: { indexAxis: 'y', scales: { x: axisEur, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => ' ' + eur(c.raw) } } } }
    });
  };
  drawGroups();
}
function kpi(l, v, c, d, signed) {
  return `<div class="kpi"><div class="l"><i style="background:${c}"></i>${l}</div><div class="v num ${signed && v < 0 ? 'neg' : ''}">${eur0(v)}</div><div class="d">${d}</div></div>`;
}
const sw = (n, c) => `<span class="chip" style="cursor:default"><span class="sw" style="background:${c}"></span>${n}</span>`;

/* ======================= TABLA (GASTO ANUAL) ======================= */
function filasTabla() {
  const cat = D().catalogo; const rows = [];
  rows.push({ t: 'group', n: 'Ingreso mensual' });
  rows.push({ n: C.SUB.SAL, f: x => x.sal, sub: C.SUB.SAL });
  rows.push({ n: C.SUB.EXT, f: x => x.ext, sub: C.SUB.EXT });
  rows.push({ t: 'total', n: 'Total ingreso', f: x => x.ingreso });
  rows.push({ t: 'group', n: 'Gasto mensual fijo' });
  cat.GMF.filter(s => s !== C.SUB.EFE).forEach(s => rows.push({ n: s, f: x => x.raw[s] || 0, sub: s }));
  rows.push({ t: 'total', n: 'Total fijos', f: x => x.gmfSinEfe });
  rows.push({ n: 'Gastos varios (efectivo)', f: x => x.efe, sub: C.SUB.EFE, sep: true });
  rows.push({ t: 'group', n: 'Gasto anual fijo' });
  cat.GAF.forEach(s => rows.push({ n: s, f: x => x.raw[s] || 0, sub: s }));
  rows.push({ t: 'total', n: 'Total anual', f: x => x.gaf });
  rows.push({ t: 'grand', n: 'TOTAL gasto', f: x => x.totalGasto });
  rows.push({ n: 'Gastos Extra', f: x => x.gex, grp: 'GEX', sep: true });
  rows.push({ n: 'Preahorro', f: x => x.pre, sub: C.SUB.PRE, pctOf: true, sep: true });
  rows.push({ t: 'grand', n: 'Ahorro en cuenta', f: x => x.ahorroCuenta, pctOf: true });
  return rows;
}

function colorProm(prom, ref) {
  if (prom == null || ref == null || Math.abs(prom - ref) < 0.005) return '';
  const ingresoMayorVerde = !!D().ajustes?.ingresosMayorVerde;
  if (prom < 0) return prom > ref ? 'good' : 'bad';             // gastos: promedio > moda = gastas menos
  return (ingresoMayorVerde ? prom > ref : prom < ref) ? 'good' : 'bad';
}

export function renderTabla(main, ctx) {
  const st = ctx.state; const years = C.aniosConMovs(D());
  if (!years.length) return sinDatos(main);
  if (!years.includes(st.year)) st.year = years[years.length - 1];
  const cube = C.cubo(D());
  main.innerHTML = `<div class="toolbar"><div class="seg"><button data-v="anual" class="${st.tabla === 'anual' ? 'on' : ''}">Visualización anual</button><button data-v="comp" class="${st.tabla === 'comp' ? 'on' : ''}">Comparativa</button></div>
    <span class="grow"></span><label class="chip ${st.ocultarVacias ? 'on' : ''}" id="tgVac">Ocultar filas vacías</label></div><div id="tblCtl"></div><div id="tblHost"></div>`;
  $$('.seg [data-v]', main).forEach(b => b.onclick = () => { st.tabla = b.dataset.v; ctx.rerender(); });
  $('#tgVac', main).onclick = () => { st.ocultarVacias = !st.ocultarVacias; ctx.rerender(); };
  const ctl = $('#tblCtl', main);

  if (st.tabla === 'anual') {
    const y = st.year; const conDatos = Object.keys(cube[y] || {}).map(Number);
    if (!st.meses || st.mesesYear !== y) { st.meses = conDatos.length ? [...conDatos].sort((a, b) => a - b) : [1]; st.mesesYear = y; }
    ctl.innerHTML = `<div class="toolbar"><label class="ink2 small">Año</label>${yearSelect(years, y)}<button class="btn ghost" id="mAll">Todos</button><button class="btn ghost" id="mData">Con datos</button></div>
      <div class="chips" style="margin-bottom:12px">${C.MESES_C.map((n, i) => `<button class="chip ${st.meses.includes(i + 1) ? 'on' : ''}" data-m="${i + 1}">${n}</button>`).join('')}</div>`;
    $('#yearSel', ctl).onchange = (e) => { st.year = +e.target.value; ctx.rerender(); };
    $('#mAll', ctl).onclick = () => { st.meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; ctx.rerender(); };
    $('#mData', ctl).onclick = () => { st.meses = conDatos.sort((a, b) => a - b); ctx.rerender(); };
    $$('[data-m]', ctl).forEach(b => b.onclick = () => { const m = +b.dataset.m; st.meses = st.meses.includes(m) ? st.meses.filter(x => x !== m) : [...st.meses, m].sort((a, b) => a - b); ctx.rerender(); });
    const cols = st.meses.map(m => ({ h: `${C.MESES_C[m - 1]} ${String(y).slice(2)}`, x: C.metricasMes(cube, y, m), y, m }));
    const all12 = [...Array(12).keys()].map(i => C.metricasMes(cube, y, i + 1));
    tabla($('#tblHost', main), cols, { total: true, prom: true, all12, ctx });
  } else {
    if (!st.compYears) st.compYears = years.slice(-2);
    ctl.innerHTML = `<div class="toolbar"><label class="ink2 small">Mes</label><select id="compMes"><option value="0">Año completo</option>${C.MESES.map((n, i) => `<option value="${i + 1}" ${st.compMes === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="chips" style="margin-bottom:12px">${years.map(yy => `<button class="chip ${st.compYears.includes(yy) ? 'on' : ''}" data-y="${yy}">${yy}</button>`).join('')}</div>`;
    $('#compMes', ctl).onchange = (e) => { st.compMes = +e.target.value; ctx.rerender(); };
    $$('[data-y]', ctl).forEach(b => b.onclick = () => { const v = +b.dataset.y; st.compYears = st.compYears.includes(v) ? st.compYears.filter(x => x !== v) : [...st.compYears, v].sort(); ctx.rerender(); });
    const ys = [...st.compYears].sort();
    const cols = ys.map(yy => ({ h: st.compMes ? `${C.MESES_C[st.compMes - 1]} ${yy}` : `${yy}`, x: st.compMes ? C.metricasMes(cube, yy, st.compMes) : agregadoComoMes(cube, yy), y: yy, m: st.compMes || null }));
    tabla($('#tblHost', main), cols, { diff: cols.length >= 2, ctx });
  }
}
function agregadoComoMes(cube, y) { const a = C.metricasAnio(cube, y); return { ...a, raw: a.sub }; }

function tabla(host, cols, { total, prom, all12, diff, ctx }) {
  if (!cols.length) { host.innerHTML = `<div class="card empty">Selecciona al menos un ${diff === undefined ? 'mes' : 'año'}.</div>`; return; }
  const rows = filasTabla(); const st = ctx.state;
  let html = `<div class="table-wrap"><table class="fin num"><thead><tr><th>Concepto</th>${cols.map(c => `<th>${c.h}</th>`).join('')}
    ${total ? '<th class="c-total">Total</th>' : ''}${prom ? '<th title="Promedio de meses con valor">Promedio</th>' : ''}${diff ? '<th class="c-total">Δ último vs primero</th>' : ''}</tr></thead><tbody>`;
  for (const r of rows) {
    const ncol = cols.length + (total ? 1 : 0) + (prom ? 1 : 0) + (diff ? 1 : 0) + 1;
    if (r.t === 'group') { html += `<tr class="group"><td colspan="${ncol}">${esc(r.n)}</td></tr>`; continue; }
    const vals = cols.map(c => r.f(c.x));
    if (st.ocultarVacias && !r.t && vals.every(v => Math.abs(v) < 0.005) && !(all12 && all12.some(x => Math.abs(r.f(x)) > 0.004))) continue;
    const ingCols = cols.map(c => c.x.ingreso);
    const cell = (v, i, extra = '') => {
      const p = r.pctOf && i != null && ingCols[i] ? `<span class="pct">${pct(Math.abs(v) / ingCols[i])}</span>` : '';
      const clickable = r.sub || r.grp ? ` data-cell="${i}"` : '';
      return `<td class="${Math.abs(v) < 0.005 ? 'zero' : ''} ${extra}"${clickable}>${Math.abs(v) < 0.005 ? '–' : eur(v)}${p}</td>`;
    };
    html += `<tr class="${r.t || ''}" data-row="${esc(r.n)}"><td class="${r.t ? '' : 'indent'}">${esc(r.n)}</td>${vals.map((v, i) => cell(v, i)).join('')}`;
    if (total) {
      const t = vals.reduce((s, v) => s + v, 0); const ti = ingCols.reduce((s, v) => s + v, 0);
      html += `<td class="c-total ${Math.abs(t) < 0.005 ? 'zero' : ''}">${Math.abs(t) < 0.005 ? '–' : eur(t)}${r.pctOf && ti ? `<span class="pct">${pct(Math.abs(t) / ti)}</span>` : ''}</td>`;
    }
    if (prom) {
      const nz = vals.filter(v => Math.abs(v) > 0.004); const pv = nz.length ? nz.reduce((s, v) => s + v, 0) / nz.length : null;
      const ref = C.modaOMediana(all12.map(x => r.f(x)));
      const color = colorProm(pv, ref.valor);
      const tip = ref.valor == null ? '' : `${ref.tipo === 'moda' ? `Importe más repetido (${ref.veces} meses)` : 'Sin repetidos → mediana'}: ${eur(ref.valor)}`;
      html += `<td class="${color} ${pv == null ? 'zero' : ''}" title="${esc(tip)}">${pv == null ? '–' : eur(pv)}${ref.valor != null && pv != null ? `<span class="pct">${ref.tipo === 'moda' ? 'moda' : 'med.'} ${eur0(ref.valor)}</span>` : ''}</td>`;
    }
    if (diff) { const d = vals[vals.length - 1] - vals[0]; html += `<td class="c-total ${cls(d)}">${Math.abs(d) < 0.005 ? '–' : (d > 0 ? '+' : '') + eur(d)}</td>`; }
    html += '</tr>';
  }
  html += `</tbody></table></div><p class="small muted" style="margin:8px 4px">Gastos en negativo (como en el banco). ${prom ? 'Promedio: media de los meses seleccionados con valor; color comparando con el importe más repetido del año (si no hay repetidos, la mediana). ' : ''}Toca una celda para ver sus movimientos.</p>`;
  host.innerHTML = html;
  $$('td[data-cell]', host).forEach(td => td.onclick = () => {
    const r = rows.find(x => x.n === td.parentElement.dataset.row); const c = cols[+td.dataset.cell];
    const movs = D().movimientos.filter(m => C.valido(m) && m.anio === c.y && (c.m ? m.mes === c.m : true) && (r.sub ? m.subgrupo === r.sub : m.grupo === r.grp));
    ctx.showMovList(`${r.n} · ${c.h}`, movs);
  });
}

/* ======================= HISTÓRICO ======================= */
export function renderHistorico(main, ctx) {
  const st = ctx.state; const H = C.historico(D());
  if (!H.length) return sinDatos(main, 'No hay datos históricos. Puedes añadir totales anuales en Ajustes → Histórico.');
  const pal = SERIES(); const cat = C.CATS_HIST.find(c => c.k === st.histCat) || C.CATS_HIST[0];
  const isGasto = ['preahorro', 'gmf', 'efectivo', 'gaf', 'gex'].includes(cat.k);
  main.innerHTML = `
  <div class="card"><div class="card-head"><div><h2>Total anual por grupo</h2><p class="sub" style="margin:0">Elige un grupo</p></div>
    <select id="histCat">${C.CATS_HIST.map(c => `<option value="${c.k}" ${c.k === cat.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select></div>
    <div class="chart-box"><canvas id="chHist"></canvas></div></div>
  <div class="card" style="margin-top:14px"><h2>Ahorro total acumulado</h2><p class="sub">Suma año tras año del ahorro total (cuenta + preahorro)</p>
    <div class="chart-box"><canvas id="chHistAcc"></canvas></div></div>
  <div class="section-title">Tabla histórica</div>
  <div class="toolbar"><div class="seg"><button data-v="total" class="${st.histModo !== 'prom' ? 'on' : ''}">Total anual</button><button data-v="prom" class="${st.histModo === 'prom' ? 'on' : ''}">Promedio mensual</button></div></div>
  <div class="table-wrap"><table class="fin num"><thead><tr><th>Año</th>${C.CATS_HIST.map(c => `<th>${c.n}</th>`).join('')}</tr></thead><tbody>
    ${H.map(h => `<tr><td>${h.anio}${h.fuente === 'manual' ? '' : ' <span class="tag acc">detalle</span>'}</td>${C.CATS_HIST.map(c => { const v = (h[c.k] || 0) / (st.histModo === 'prom' ? h.meses : 1); return `<td class="${cls(v)}">${eur(v)}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>
  <p class="small muted" style="margin:8px 4px">Años sin etiqueta: totales introducidos a mano (Ajustes → Histórico). "detalle": calculado desde tus movimientos. Promedio mensual = total / 12 (o / meses con datos en el año en curso).</p>`;
  $('#histCat', main).onchange = (e) => { st.histCat = e.target.value; ctx.rerender(); };
  $$('.seg [data-v]', main).forEach(b => b.onclick = () => { st.histModo = b.dataset.v; ctx.rerender(); });
  const vals = H.map(h => isGasto ? neg(h[cat.k]) : (h[cat.k] || 0));
  makeChart($('#chHist', main), {
    type: 'bar', data: { labels: H.map(h => h.anio), datasets: [{ label: cat.n, data: vals, backgroundColor: vals.map(v => v < 0 ? css('--s8') : pal[0]), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 48 }] },
    options: { scales: { x: { grid: { display: false } }, y: axisEur }, plugins: { tooltip: { callbacks: { label: (c) => ` ${cat.n}: ${eur(c.raw)}` + (isGasto ? ' (gasto)' : ''), afterLabel: (c) => `Promedio mensual: ${eur(c.raw / H[c.dataIndex].meses)}` } } } }
  });
  let s = 0; const accd = H.map(h => (s += h.ahorro || 0));
  makeChart($('#chHistAcc', main), {
    type: 'line', data: { labels: H.map(h => h.anio), datasets: [{ label: 'Ahorro acumulado', data: accd, borderColor: pal[0], backgroundColor: pal[0] + '22', fill: true, borderWidth: 2, pointRadius: 4, tension: .25 },] },
    options: { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false } }, y: axisEur }, plugins: { tooltip: { callbacks: { label: (c) => ` Acumulado: ${eur(c.raw)}`, afterLabel: (c) => `Ahorro del año: ${eur(H[c.dataIndex].ahorro)}` } } } }
  });
}

/* ======================= PRÉSTAMOS ======================= */
export function renderPrestamos(main, ctx) {
  const st = ctx.state; const P = D().prestamos || [];
  if (P.length && !P.some(x => x.id === st.loan)) st.loan = P[0].id;
  main.innerHTML = `<div class="toolbar">${P.length ? `<div class="chips">${P.map(p => `<button class="chip ${p.id === st.loan ? 'on' : ''}" data-id="${p.id}">${esc(p.nombre)}</button>`).join('')}</div>` : ''}<span class="grow"></span>
    <button class="btn primary" id="addLoan">＋ Préstamo</button></div><div id="loanHost"></div>`;
  $('#addLoan', main).onclick = () => editarPrestamo(null, ctx);
  $$('[data-id]', main).forEach(b => b.onclick = () => { st.loan = b.dataset.id; ctx.rerender(); });
  if (!P.length) { $('#loanHost', main).innerHTML = `<div class="card empty">No hay préstamos. Pulsa <b>＋ Préstamo</b> para añadir uno.</div>`; return; }
  const p = P.find(x => x.id === st.loan) || P[0]; st.loan = p.id;
  const e = C.estadoPrestamo(D(), p); const pal = SERIES();
  const [fy, fm] = (e.fin || '').split('-');
  const host = $('#loanHost', main);
  host.innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="l">Cuotas faltantes</div><div class="v num">${e.cuotasFaltantes}</div><div class="d">de ${e.cuotasTotales} · pagadas ${e.cuotasPagadas}</div></div>
    <div class="kpi"><div class="l">Finalización</div><div class="v">${fm ? C.MESES[+fm - 1] : '–'}</div><div class="d">${fy || ''}${e.cuotasFaltantes ? ` · faltan ${Math.floor(e.cuotasFaltantes / 12)} años y ${e.cuotasFaltantes % 12} meses` : ''}</div></div>
    <div class="kpi"><div class="l"><i style="background:${pal[0]}"></i>Pagado</div><div class="v num">${eur0(e.pagado)}</div><div class="d">${pct(e.pagado / e.total)} del total</div></div>
    <div class="kpi"><div class="l"><i style="background:${pal[1]}"></i>Pendiente</div><div class="v num">${eur0(e.pendiente)}</div><div class="d">${e.proxima ? 'Próxima letra ' + eur(e.proxima.letra) : 'Sin cuotas pendientes'}</div></div>
  </div>
  <div class="grid c2" style="margin-top:14px"><div id="loanDonut"></div>
    <div class="card"><h2>${esc(p.nombre)}</h2><p class="sub">Vinculado al subgrupo <b>${esc(p.subgrupo)}</b></p>
      <div class="progress" aria-label="Progreso"><i style="width:${Math.min(100, e.pagado / e.total * 100).toFixed(1)}%"></i></div>
      <div class="list" style="margin-top:10px">
        <div class="it"><span class="grow ink2">Total (pagado + pendiente)</span><b class="num">${eur(e.total)}</b></div>
        ${p.capital ? `<div class="it"><span class="grow ink2">Capital prestado</span><b class="num">${eur(p.capital)}</b></div>` : ''}
        <div class="it"><span class="grow ink2">Pagado antes de los movimientos</span><span class="num">${eur(p.pagadoPrevio || 0)}</span></div>
        <div class="it"><span class="grow ink2">Pagado según movimientos (${e.pagos.length})</span><span class="num">${eur(e.pagadoMovs)}</span></div>
        <div class="it"><span class="grow ink2">Capital pendiente</span><span class="num">${eur(e.capitalPendiente)}</span></div>
        <div class="it"><span class="grow ink2">Intereses pendientes</span><span class="num">${eur(e.interesesPendientes)}</span></div>
      </div>
      <div class="actions"><button class="btn ghost" id="editLoan">Editar préstamo</button></div></div></div>
  <details class="card" style="margin-top:14px"><summary>Cuadro de amortización (${e.cuotasTotales} cuotas)</summary>
    <div class="table-wrap" style="max-height:420px"><table class="fin num"><thead><tr><th>Nº</th><th>Fecha</th><th>Intereses</th><th>Principal</th><th>Amortizado</th><th>Letra</th></tr></thead><tbody>
    ${(p.cuadro || []).map((c, i) => `<tr style="${i < e.cuotasPagadas ? 'opacity:.55' : ''}"><td>${c.n}${i < e.cuotasPagadas ? ' ✓' : ''}</td><td>${fecha(c.fecha)}</td><td>${c.intereses != null ? eur(c.intereses) : '–'}</td><td>${c.principal != null ? eur(c.principal) : '–'}</td><td>${c.amortizado != null ? eur(c.amortizado) : '–'}</td><td>${eur(c.letra)}</td></tr>`).join('')}
    </tbody></table></div></details>`;
  donutCard($('#loanDonut', host), {
    title: 'Hipoteca total: pagado vs pendiente'.replace('Hipoteca', p.nombre), centerLabel: 'Total', mode: st.loanMode,
    items: [{ n: 'Pagado', v: e.pagado, color: pal[0] }, { n: 'Pendiente', v: e.pendiente, color: pal[1] }],
    onMode: (m) => { st.loanMode = m; ctx.rerender(); }
  }).style.height = '100%';
  $('#editLoan', host).onclick = () => editarPrestamo(p, ctx);
}

function todosSubgrupos() { const c = D().catalogo; return Object.entries(c).flatMap(([g, l]) => l.map(s => ({ g, s }))); }

async function editarPrestamo(p, ctx) {
  const nuevo = !p; p = p ? structuredClone(p) : { id: 'p' + Date.now().toString(36), nombre: '', subgrupo: '', capital: null, pagadoPrevio: 0, cuotasPrevias: 0, inicioMovs: '', cuadro: [] };
  const subs = todosSubgrupos();
  await modal(`<h2>${nuevo ? 'Nuevo préstamo' : 'Editar préstamo'}</h2>
  <div class="form">
    <label>Nombre<input type="text" id="lpN" value="${esc(p.nombre)}" placeholder="Ej. Préstamo coche"></label>
    <label>Subgrupo donde se registran las cuotas pagadas
      <select id="lpS"><option value="">— Elegir —</option>${Object.entries(C.GRUPOS).map(([g, n]) => `<optgroup label="${n}">${subs.filter(x => x.g === g).map(x => `<option ${x.s === p.subgrupo ? 'selected' : ''}>${esc(x.s)}</option>`).join('')}</optgroup>`).join('')}<option value="__new">＋ Crear subgrupo nuevo en Gasto mensual fijo…</option></select></label>
    <label id="lpNewL" class="hidden">Nombre del nuevo subgrupo<input type="text" id="lpNew"></label>
    <div class="row"><label>Capital prestado (€)<input type="number" step="0.01" id="lpC" value="${p.capital ?? ''}"></label>
      <label>Movimientos a contar desde (mes)<input type="month" id="lpI" value="${p.inicioMovs || ''}"></label></div>
    <div class="row"><label>Pagado antes de esa fecha (€)<input type="number" step="0.01" id="lpPP" value="${p.pagadoPrevio || 0}"></label>
      <label>Cuotas pagadas antes de esa fecha<input type="number" id="lpCP" value="${p.cuotasPrevias || 0}"></label></div>
    <div class="note">Cuadro actual: <b id="lpCnt">${p.cuadro.length}</b> cuotas. Puedes sustituirlo:</div>
    <div class="row"><label class="btn ghost" style="justify-content:center">📄 Importar Excel/CSV<input type="file" id="lpF" accept=".xlsx,.xls,.csv" hidden></label>
      <button class="btn ghost" id="lpGen" type="button">🧮 Generar (sistema francés)</button></div>
    <div id="lpGenBox" class="hidden form"><div class="row3"><label>TIN anual %<input type="number" step="0.01" id="gT"></label><label>Nº cuotas<input type="number" id="gN"></label><label>1ª cuota<input type="date" id="gF"></label></div>
      <button class="btn" id="gGo" type="button">Generar cuadro</button></div>
  </div>
  <div class="actions">${nuevo ? '' : '<button class="btn danger left" id="lpDel">Eliminar</button>'}<button class="btn ghost" id="lpX">Cancelar</button><button class="btn primary" id="lpOk">Guardar</button></div>`,
    (s, close) => {
      $('#lpS', s).onchange = (e) => $('#lpNewL', s).classList.toggle('hidden', e.target.value !== '__new');
      $('#lpF', s).onchange = async (e) => { try { p.cuadro = parseCuadro(await leerHoja(e.target.files[0])); $('#lpCnt', s).textContent = p.cuadro.length; toast(`Cuadro importado: ${p.cuadro.length} cuotas`); } catch (err) { alert(err.message); } };
      $('#lpGen', s).onclick = () => $('#lpGenBox', s).classList.toggle('hidden');
      $('#gGo', s).onclick = () => {
        const cap = +$('#lpC', s).value, t = +$('#gT', s).value, n = +$('#gN', s).value, f = $('#gF', s).value;
        if (!cap || !n || !f) return alert('Indica capital, nº de cuotas y fecha de la 1ª cuota.');
        p.cuadro = C.cuadroFrances(cap, t, n, f); $('#lpCnt', s).textContent = p.cuadro.length; toast(`Generadas ${n} cuotas de ${eur(p.cuadro[0].letra)}`);
      };
      $('#lpX', s).onclick = () => close();
      if (!nuevo) $('#lpDel', s).onclick = async () => { if (await confirmDlg('Eliminar préstamo', `¿Eliminar "${esc(p.nombre)}"? Los movimientos no se borran.`, 'Eliminar', true)) { D().prestamos = D().prestamos.filter(x => x.id !== p.id); await Store.commit('Eliminar préstamo'); close(); ctx.rerender(); } };
      $('#lpOk', s).onclick = async () => {
        p.nombre = $('#lpN', s).value.trim(); let sub = $('#lpS', s).value;
        if (sub === '__new') { sub = $('#lpNew', s).value.trim(); if (sub && !todosSubgrupos().some(x => x.s === sub)) D().catalogo.GMF.push(sub); }
        p.subgrupo = sub; p.capital = $('#lpC', s).value ? +$('#lpC', s).value : null; p.inicioMovs = $('#lpI', s).value;
        p.pagadoPrevio = +$('#lpPP', s).value || 0; p.cuotasPrevias = +$('#lpCP', s).value || 0;
        if (!p.nombre || !p.subgrupo) return alert('Indica nombre y subgrupo.');
        if (!p.cuadro.length) return alert('Añade un cuadro de amortización (importado o generado).');
        const L = (D().prestamos ||= []); const i = L.findIndex(x => x.id === p.id); if (i >= 0) L[i] = p; else L.push(p);
        ctx.state.loan = p.id; await Store.commit('Préstamo ' + p.nombre); close(); ctx.rerender();
      };
    });
}

/* ======================= EXTRA (OUT OF CONTEXT) ======================= */
export function renderExtra(main, ctx) {
  const st = ctx.state; const all = D().movimientos.filter(m => m.grupo === 'OOC');
  const years = [...new Set(all.map(m => m.anio || +m.fecha.slice(0, 4)))].sort();
  const list = all.filter(m => !st.oocYear || (m.anio || +m.fecha.slice(0, 4)) === st.oocYear).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ing = list.filter(m => m.importe > 0).reduce((s, m) => s + m.importe, 0), gas = list.filter(m => m.importe < 0).reduce((s, m) => s + m.importe, 0);
  const pal = SERIES();
  main.innerHTML = `<div class="toolbar"><label class="ink2 small">Periodo</label><select id="oocY"><option value="">Todo</option>${years.map(y => `<option ${y === st.oocYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
  <div class="kpis"><div class="kpi" style="grid-column:1/-1"><div class="l">Dinero disponible (Out of Context)</div><div class="v num ${cls(ing + gas)}">${eur(ing + gas)}</div><div class="d">Ingresado − gastado</div></div>
    <div class="kpi"><div class="l"><i style="background:${pal[0]}"></i>Ingresado</div><div class="v num">${eur0(ing)}</div></div>
    <div class="kpi"><div class="l"><i style="background:${pal[1]}"></i>Gastado</div><div class="v num">${eur0(-gas)}</div></div></div>
  <div class="section-title">Movimientos (${list.length})</div>
  ${list.length ? `<div class="table-wrap"><table class="fin num"><thead><tr><th>Fecha</th><th>Importe</th><th>Divisa</th><th style="text-align:left">Concepto 2</th></tr></thead><tbody>
    ${list.map(m => `<tr data-id="${m.id}" style="cursor:pointer"><td>${fecha(m.fecha)}</td><td class="${cls(m.importe)}">${eur(m.importe)}</td><td>${esc(m.divisa)}</td><td style="text-align:left">${esc(m.concepto2 || m.concepto)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card empty">Aún no hay movimientos en el grupo <b>Out of Context</b>.<br><span class="small">Clasifica un movimiento como "Out of Context" en Movimientos y aparecerá aquí (no cuenta en el resto de la app).</span></div>`}`;
  $('#oocY', main).onchange = (e) => { st.oocYear = e.target.value ? +e.target.value : null; ctx.rerender(); };
  $$('tr[data-id]', main).forEach(tr => tr.onclick = () => ctx.openMov(tr.dataset.id));
}
