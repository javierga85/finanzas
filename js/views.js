// Vistas de análisis: Dashboard, Tabla (Gasto anual), Histórico, Préstamos, Extra
import { Store } from './store.js?v=1.6.0';
import * as C from './calc.js?v=1.6.0';
import { $, $$, esc, eur, eur0, pct, fecha, cls, css, makeChart, axisEur, compactEur, donutCard, modal, toast, confirmDlg,
  showEur, showPct, fmtMode, dispPicker, bindPickers, MASK } from './ui.js?v=1.6.0';
import { colorGrupo, colorSub, colorOtros, familia, tint, fixed, alpha } from './colors.js?v=1.6.0';
import { leerHoja, parseCuadro } from './importer.js?v=1.6.0';

const D = () => Store.data;
const neg = (v) => -(v || 0);

function yearSelect(years, sel, id = 'yearSel') {
  return `<select id="${id}" aria-label="Año">${years.map(y => `<option ${y == sel ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
}
function sinDatos(main, txt = 'Aún no hay movimientos clasificados.') {
  main.innerHTML = `<div class="card empty"><p>${txt}</p><p class="small">Ve a <b>Movimientos</b> para importar tu extracto o a <b>Ajustes</b> para conectar tus datos.</p></div>`;
}
/** Importe principal de un KPI según el modo. */
function kpi(l, v, color, base, desc, m) {
  const main = showEur(m) ? eur0(v) : showPct(m) && base ? pct(Math.abs(v) / Math.abs(base)) : MASK;
  const extra = showEur(m) && showPct(m) && base ? pct(Math.abs(v) / Math.abs(base)) + ' del ingreso' : '';
  return `<div class="kpi" style="box-shadow:inset 0 3px 0 ${color},var(--shadow)"><div class="l"><i style="background:${color}"></i>${l}</div>
    <div class="v num ${v < -0.004 ? 'neg' : ''}">${main}</div><div class="d">${[extra, desc].filter(Boolean).join(' · ')}</div></div>`;
}
const head = (title, sub, key, ctx) => `<div class="card-head"><div><h2>${title}</h2>${sub ? `<p class="sub" style="margin:0">${sub}</p>` : ''}</div>${dispPicker(key, ctx)}</div>`;

/* ======================= DASHBOARD ======================= */
export function renderDashboard(main, ctx) {
  const st = ctx.state; const years = C.aniosConMovs(D());
  if (!years.length) return sinDatos(main);
  if (!years.includes(st.year)) st.year = years[years.length - 1];
  const y = st.year; const cube = C.cubo(D());
  const sm = st.dashMes || 0;                       // 0 = Full (año completo); 1-12 = un mes concreto
  const a = sm ? C.metricasAnio(cube, y, [sm]) : C.metricasAnio(cube, y);
  const per = sm ? `${y} ${C.MESES_C[sm - 1]}` : `${y}`;
  // Signos: ingresos, preahorro y ahorro en positivo; gastos en negativo
  const ingreso = a.ingreso, gastos = a.gastos, pre = neg(a.pre), ahorro = a.ahorroCuenta;
  const col = { ING: colorGrupo('ING'), GAS: fixed('GASTOS'), PRE: colorGrupo('PRE'), AHO: fixed('AHORRO'), GT: fixed('GRAN'), GMF: colorGrupo('GMF'), GAF: colorGrupo('GAF'), GEX: colorGrupo('GEX') };
  const mk = ctx.mode('kpi');

  main.innerHTML = `
  <div class="toolbar"><label class="ink2 small">Año</label>${yearSelect(years, y)}<label class="ink2 small">Mes</label><select id="dashMes" aria-label="Mes"><option value="0">Full</option>${C.MESES.map((n, i) => `<option value="${i + 1}" ${sm === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="grow"></span>${dispPicker('kpi', ctx)}</div>
  <div class="kpis">
    ${kpi('Ingreso', ingreso, col.ING, null, 'Salario + Dinero extra', mk)}
    ${kpi('Gastos', gastos, col.GAS, ingreso, 'Mensual fijo + Anual fijo + Extra', mk)}
    ${kpi('Preahorro', pre, col.PRE, ingreso, '', mk)}
    ${kpi('Ahorro', ahorro, col.AHO, ingreso, ahorro < 0 ? 'déficit' : '', mk)}
  </div>
  <div class="section-title">Reparto · ${per}</div>
  <div class="grid c3" id="donuts"></div>
  <div class="section-title">Timeline · ${y}${sm ? ` <span class="tag acc" style="text-transform:none;letter-spacing:0">resaltado: ${C.MESES[sm - 1]}</span>` : ''}</div>
  <div class="grid c2">
    <div class="card">${head('Ingresos vs Gastos + Preahorro', 'Por mes · la diferencia es el ahorro en cuenta', 'bars', ctx)}
      <div class="chips" style="margin-bottom:10px">${sw('Ingresos', col.ING)}${sw('Gastos', col.GAS)}${sw('Preahorro', col.PRE)}</div>
      <div class="chart-box"><canvas id="chBars"></canvas></div></div>
    <div class="card">${head('Acumulados del año', 'Toca para mostrar u ocultar', 'lines', ctx)}
      <div class="chips" id="lineChips" style="margin-bottom:10px"></div>
      <div class="chart-box"><canvas id="chLines"></canvas></div></div>
  </div>
  <div class="card" style="margin-top:14px">${head(`${sm ? 'Total del mes por grupo' : 'Total anual por grupo'} · ${per}`, 'Elige qué grupos ver · % sobre el ingreso', 'groups', ctx)}
    <div class="chips" id="grpChips" style="margin-bottom:10px"></div><div class="chart-box" style="height:240px"><canvas id="chGroups"></canvas></div></div>`;
  $('#yearSel', main).onchange = (e) => { st.year = +e.target.value; ctx.rerender(); };
  $('#dashMes', main).onchange = (e) => { st.dashMes = +e.target.value; ctx.saveUi(); ctx.rerender(); };

  // Donuts — orden: Balance, Ingresos, Gastos, Gasto mensual fijo, Gasto anual fijo
  const host = $('#donuts', main);
  donutCard(host, {
    title: 'Balance', sub: 'Del total ingresado', centerLabel: 'Ingresado', mode: ctx.mode('dBal'), picker: dispPicker('dBal', ctx),
    items: [{ n: 'Gastos', v: neg(gastos), color: col.GAS, sign: -1 }, { n: 'Preahorro', v: pre, color: col.PRE }, { n: 'Ahorro', v: Math.max(0, ahorro), color: col.AHO }],
    foot: ahorro < 0 ? `⚠️ ${sm ? "Este mes" : "Este año"} gastas más de lo que ingresas: ahorro ${eur(ahorro)}` : ''
  });
  // el centro del Balance debe ser el ingreso, no la suma con signo
  fixCenter(host.lastElementChild, ingreso, ctx.mode('dBal'));
  donutCard(host, {
    title: 'Ingresos', centerLabel: 'Ingreso total', mode: ctx.mode('dIng'), picker: dispPicker('dIng', ctx),
    items: [{ n: C.SUB.SAL, v: a.sal, color: colorSub(D(), C.SUB.SAL) }, { n: C.SUB.EXT, v: a.ext, color: colorSub(D(), C.SUB.EXT) }]
  });
  donutCard(host, {
    title: 'Gastos', centerLabel: 'Gasto total', mode: ctx.mode('dGas'), picker: dispPicker('dGas', ctx), sign: -1, ingreso, pctLabel: 'del gasto total', pctShort: 'del gasto',
    items: [{ n: 'Gasto mensual fijo', v: neg(a.gmf), color: col.GMF }, { n: 'Gasto anual fijo', v: neg(a.gaf), color: col.GAF }, { n: 'Gasto Extra', v: neg(a.gex), color: col.GEX }]
  });
  const subItems = (g) => {
    const its = D().catalogo[g].map(s => ({ n: s, v: neg(a.sub[s]), color: colorSub(D(), s) }));
    const posit = its.filter(i => i.v < -0.004);
    return { its, foot: posit.length ? `No se muestran (saldo a favor): ${posit.map(p => `${esc(p.n)}${showEur(ctx.mode('d' + g)) ? ' ' + eur(-p.v) : ''}`).join(', ')}` : '' };
  };
  const m1 = subItems('GMF'); donutCard(host, { title: 'Gasto mensual fijo', centerLabel: 'Total', items: m1.its, foot: m1.foot, mode: ctx.mode('dGMF'), picker: dispPicker('dGMF', ctx), sign: -1, ingreso, pctLabel: 'del G. mensual fijo', pctShort: 'del grupo', otrosColor: colorOtros('GMF') });
  const m2 = subItems('GAF'); donutCard(host, { title: 'Gasto anual fijo', centerLabel: 'Total', items: m2.its, foot: m2.foot, mode: ctx.mode('dGAF'), picker: dispPicker('dGAF', ctx), sign: -1, ingreso, pctLabel: 'del G. anual fijo', pctShort: 'del grupo', otrosColor: colorOtros('GAF') });

  // Barras mensuales (alturas en magnitud para comparar; etiquetas con signo)
  const meses = [...Array(12).keys()].map(i => i + 1);
  const mm = meses.map(m => C.metricasMes(cube, y, m));
  const hl = (c) => sm ? meses.map(m => m === sm ? c : alpha(c, 0.28)) : c;   // con un mes elegido, el resto se atenúa
  const mb = ctx.mode('bars');
  makeChart($('#chBars', main), {
    type: 'bar',
    data: {
      labels: C.MESES_C, datasets: [
        { label: 'Ingresos', data: mm.map(x => x.ingreso), backgroundColor: hl(col.ING), stack: 'i', borderRadius: 4, borderSkipped: 'start' },
        { label: 'Gastos', data: mm.map(x => neg(x.gastos)), backgroundColor: hl(col.GAS), stack: 'g', borderRadius: 0, sign: -1 },
        { label: 'Preahorro', data: mm.map(x => neg(x.pre)), backgroundColor: hl(col.PRE), stack: 'g', borderRadius: 4, borderSkipped: 'start' }
      ]
    },
    options: {
      layout: { padding: { top: mb === 'none' ? 6 : (main.clientWidth < 600 ? (showEur(mb) && showPct(mb) ? 92 : 48) : (showEur(mb) && showPct(mb) ? 26 : 14)) } },
      interaction: { mode: 'index', intersect: false }, datasets: { bar: { categoryPercentage: .7, barPercentage: .9, borderColor: css('--surface'), borderWidth: { top: 2 } } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { ...axisEur, stacked: true, display: showEur(mb) } },
      plugins: {
        fzLabels: {
          pos: 'top', text: (di, i) => {
            const x = mm[i]; if (!x.ingreso && !x.gastos) return null;
            if (sm && i + 1 !== sm) return null;   // con un mes elegido, solo se etiqueta ese mes
            if (di === 0) return showEur(mb) && x.ingreso ? compactEur(x.ingreso) : null;
            if (di === 2) { const g = x.gastos + x.pre; const out = []; if (showEur(mb)) out.push(compactEur(g)); if (showPct(mb) && x.ingreso) out.push(pct(Math.abs(g) / x.ingreso).replace(',0', '')); return out.length ? out : null; }
            return null;
          }
        },
        tooltip: { callbacks: { label: (c) => { const t = fmtMode(mb, c.datasetIndex === 1 ? -c.raw : c.raw, c.datasetIndex ? mm[c.dataIndex].ingreso : 0); return ` ${c.dataset.label}${t ? ': ' + t : ''}`; }, footer: (it) => { const x = mm[it[0].dataIndex]; const t = fmtMode(mb, x.ahorroCuenta, x.ingreso); return t ? 'Ahorro en cuenta: ' + t : ''; } } }
      }
    }
  });

  // Líneas acumuladas (gasto acumulado en negativo)
  const last = sm || Math.max(0, ...Object.keys(cube[y] || {}).map(Number));
  const acc = (f) => { let s = 0; return meses.map(m => m > last ? null : (s += f(mm[m - 1]), s)); };
  const ingAcc = acc(x => x.ingreso);
  const series = [
    { k: 'ing', n: 'Ingreso acumulado', c: col.ING, d: ingAcc },
    { k: 'gas', n: 'Gasto acumulado', c: col.GAS, d: acc(x => x.gastos) },
    { k: 'pre', n: 'Preahorro acumulado', c: col.PRE, d: acc(x => neg(x.pre)), dash: [6, 4] },
    { k: 'aho', n: 'Ahorro en cuenta acumulado', c: col.AHO, d: acc(x => x.ahorroCuenta), dash: [2, 3] },
    { k: 'gt', n: 'Gran total ahorro acumulado', c: col.GT, d: acc(x => x.granTotal), w: 3 }
  ];
  const ml = ctx.mode('lines');
  const drawLines = () => {
    $('#lineChips', main).innerHTML = series.map(s => `<button class="chip ${st.lines[s.k] ? 'on' : ''}" data-k="${s.k}"><span class="sw" style="background:${s.c}"></span>${s.n.replace(' acumulado', '')}</button>`).join('');
    $$('#lineChips .chip', main).forEach(b => b.onclick = () => { st.lines[b.dataset.k] = !st.lines[b.dataset.k]; drawLines(); });
    const vis = series.filter(s => st.lines[s.k]);
    makeChart($('#chLines', main), {
      type: 'line', data: { labels: C.MESES_C, datasets: vis.map(s => ({ label: s.n, data: s.d, borderColor: s.c, backgroundColor: s.c, borderWidth: s.w || 2, borderDash: s.dash || [], pointRadius: 2.5, pointHoverRadius: 5, tension: .25 })) },
      options: {
        layout: { padding: { right: ml === 'none' ? 4 : showEur(ml) && showPct(ml) ? 58 : 46 } },
        interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false } }, y: { ...axisEur, display: showEur(ml) } },
        plugins: {
          fzLabels: { pos: 'last', text: (di, i, v) => { const out = []; if (showEur(ml)) out.push(compactEur(v)); if (showPct(ml) && vis[di].k !== 'ing' && ingAcc[i]) out.push(pct(Math.abs(v) / ingAcc[i]).replace(',0', '')); return out.length ? out : null; } },
          tooltip: { callbacks: { label: (c) => { const t = fmtMode(ml, c.raw, vis[c.datasetIndex].k === 'ing' ? 0 : ingAcc[c.dataIndex]); return ` ${c.dataset.label}${t ? ': ' + t : ''}`; } } }
        }
      }
    });
  };
  drawLines();

  // Barras por grupo (divergente: ingresos a la derecha, gastos a la izquierda)
  const grupos = [
    { k: 'ING', n: 'Ingreso', v: a.ingreso, c: col.ING }, { k: 'PRE', n: 'Preahorro', v: neg(a.pre), c: col.PRE },
    { k: 'GMF', n: 'Gasto mensual fijo', v: a.gmf, c: col.GMF }, { k: 'GAF', n: 'Gasto anual fijo', v: a.gaf, c: col.GAF }, { k: 'GEX', n: 'Gasto Extra', v: a.gex, c: col.GEX }
  ];
  const mg = ctx.mode('groups');
  const drawGroups = () => {
    $('#grpChips', main).innerHTML = grupos.map(g => `<button class="chip ${st.groups[g.k] ? 'on' : ''}" data-k="${g.k}"><span class="sw" style="background:${g.c}"></span>${g.n}</button>`).join('');
    $$('#grpChips .chip', main).forEach(b => b.onclick = () => { st.groups[b.dataset.k] = !st.groups[b.dataset.k]; drawGroups(); });
    const sel = grupos.filter(g => st.groups[g.k]);
    const maxAbs = Math.max(1, ...sel.map(g => Math.abs(g.v)));
    makeChart($('#chGroups', main), {
      type: 'bar', data: { labels: sel.map(g => g.n), datasets: [{ data: sel.map(g => g.v), backgroundColor: sel.map(g => g.c), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 46 }] },
      options: {
        indexAxis: 'y', layout: { padding: { left: 0, right: 8 } },
        scales: { x: { ...axisEur, display: showEur(mg), suggestedMin: sel.some(g => g.v < 0) ? -maxAbs * 1.05 : 0, suggestedMax: maxAbs * (mg === 'none' ? 1.05 : showEur(mg) && showPct(mg) ? 1.9 : 1.45) }, y: { grid: { display: false } } },
        plugins: {
          fzLabels: { pos: 'end', text: (di, i, v) => { const t = fmtMode(mg, v, sel[i].k === 'ING' ? 0 : a.ingreso, { compact: true }); return t || null; } },
          tooltip: { callbacks: { label: (c) => { const t = fmtMode(mg, c.raw, sel[c.dataIndex].k === 'ING' ? 0 : a.ingreso); return t ? ' ' + t : ''; } } }
        }
      }
    });
  };
  drawGroups();
  bindPickers(main, ctx);
}
function fixCenter(card, ingreso, m) {
  const b = card.querySelector('.donut-center b'); if (b) b.textContent = showEur(m) ? eur0(ingreso) : showPct(m) ? '100 %' : MASK;
}
const sw = (n, c) => `<span class="chip" style="cursor:default"><span class="sw" style="background:${c}"></span>${n}</span>`;

/* ======================= TABLA (GASTO ANUAL) ======================= */
function filasTabla() {
  const cat = D().catalogo; const rows = [];
  rows.push({ t: 'group', n: 'Ingreso mensual', fam: 'ING' });
  rows.push({ n: C.SUB.SAL, f: x => x.sal, sub: C.SUB.SAL, fam: 'ING' });
  rows.push({ n: C.SUB.EXT, f: x => x.ext, sub: C.SUB.EXT, fam: 'ING' });
  rows.push({ t: 'total', n: 'Total ingreso', f: x => x.ingreso, fam: 'ING' });
  rows.push({ t: 'group', n: 'Gasto mensual fijo', fam: 'GMF' });
  cat.GMF.filter(s => s !== C.SUB.EFE).forEach(s => rows.push({ n: s, f: x => x.raw[s] || 0, sub: s, fam: 'GMF' }));
  rows.push({ t: 'total', n: 'Total fijos', f: x => x.gmfSinEfe, fam: 'GMF' });
  rows.push({ n: 'Gastos varios (efectivo)', f: x => x.efe, sub: C.SUB.EFE, fam: 'EFE' });
  rows.push({ t: 'group', n: 'Gasto anual fijo', fam: 'GAF' });
  cat.GAF.forEach(s => rows.push({ n: s, f: x => x.raw[s] || 0, sub: s, fam: 'GAF' }));
  rows.push({ t: 'total', n: 'Total anual', f: x => x.gaf, fam: 'GAF' });
  rows.push({ t: 'grand', n: 'TOTAL gasto', f: x => x.totalGasto, fam: 'GASTOS' });
  rows.push({ n: 'Gastos Extra', f: x => x.gex, grp: 'GEX', fam: 'GEX', sep: true });
  rows.push({ n: 'Preahorro', f: x => -x.pre, sub: C.SUB.PRE, fam: 'PRE', sep: true });
  rows.push({ t: 'grand', n: 'Ahorro en cuenta', f: x => x.ahorroCuenta, fam: 'AHORRO' });
  return rows;
}
const famColor = (r) => r.sub ? colorSub(D(), r.sub) : r.fam === 'GASTOS' || r.fam === 'AHORRO' ? fixed(r.fam) : colorGrupo(r.fam);

function colorProm(prom, ref) {
  if (prom == null || ref == null || Math.abs(prom - ref) < 0.005) return '';
  // Ingresos, preahorro y ahorro: más es mejor. Gastos (negativos): promedio > moda = gastas menos.
  return prom > ref ? 'good' : 'bad';
}

export function renderTabla(main, ctx) {
  const st = ctx.state; const years = C.aniosConMovs(D());
  if (!years.length) return sinDatos(main);
  if (!years.includes(st.year)) st.year = years[years.length - 1];
  const cube = C.cubo(D());
  main.innerHTML = `<div class="toolbar"><div class="seg"><button data-v="anual" class="${st.tabla === 'anual' ? 'on' : ''}">Visualización anual</button><button data-v="comp" class="${st.tabla === 'comp' ? 'on' : ''}">Comparativa</button></div>
    <span class="grow"></span><label class="chip ${st.ocultarVacias ? 'on' : ''}" id="tgVac">Ocultar filas vacías</label>${dispPicker('tabla', ctx)}</div><div id="tblCtl"></div><div id="tblHost"></div>`;
  $$('.seg [data-v]', main).forEach(b => b.onclick = () => { st.tabla = b.dataset.v; ctx.rerender(); });
  $('#tgVac', main).onclick = () => { st.ocultarVacias = !st.ocultarVacias; ctx.rerender(); };
  bindPickers(main, ctx);
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
  const rows = filasTabla(); const st = ctx.state; const m = ctx.mode('tabla');
  const isZero = (v) => Math.abs(v) < 0.005;
  // contenido de una celda: valor y/o % sobre el ingreso de esa columna
  const body = (v, base, isIng) => {
    if (isZero(v)) return '–';
    if (m === 'none') return '<span class="muted">•</span>';
    const e = showEur(m) ? eur(v) : ''; const p = showPct(m) && base && !isIng ? pct(Math.abs(v) / base) : '';
    if (e && p) return `${e}<span class="pct">${p}</span>`;
    return e || p || (isIng ? '100 %' : '–');
  };
  const ingCols = cols.map(c => c.x.ingreso); const ingTot = ingCols.reduce((s, v) => s + v, 0);
  let html = `<div class="table-wrap"><table class="fin num"><thead><tr><th>Concepto</th>${cols.map(c => `<th>${c.h}</th>`).join('')}
    ${total ? '<th class="c-total">Total</th>' : ''}${prom ? '<th title="Promedio de meses con valor">Promedio</th>' : ''}${diff ? '<th class="c-total">Δ último vs primero</th>' : ''}</tr></thead><tbody>`;
  for (const r of rows) {
    const ncol = cols.length + (total ? 1 : 0) + (prom ? 1 : 0) + (diff ? 1 : 0) + 1;
    const fc = famColor(r);
    if (r.t === 'group') { html += `<tr class="group"><td colspan="${ncol}" style="background:${tint(fc, 18)};box-shadow:inset 4px 0 0 ${fc}">${esc(r.n)}</td></tr>`; continue; }
    const vals = cols.map(c => r.f(c.x));
    if (st.ocultarVacias && !r.t && vals.every(isZero) && !(all12 && all12.some(x => !isZero(r.f(x))))) continue;
    const isIng = r.fam === 'ING' && r.t === 'total';
    const clickable = (i) => r.sub || r.grp ? ` data-cell="${i}"` : '';
    html += `<tr class="${r.t || ''}" data-row="${esc(r.n)}"><td class="${r.t ? '' : 'indent'}" style="box-shadow:inset 4px 0 0 ${fc}${r.t === 'grand' ? `;background:${tint(fc, 16)}` : ''}">${esc(r.n)}</td>`
      + vals.map((v, i) => `<td class="${isZero(v) ? 'zero' : ''}"${clickable(i)}>${body(v, ingCols[i], isIng)}</td>`).join('');
    if (total) { const t = vals.reduce((s, v) => s + v, 0); html += `<td class="c-total ${isZero(t) ? 'zero' : ''}">${body(t, ingTot, isIng)}</td>`; }
    if (prom) {
      const nz = vals.filter(v => !isZero(v)); const pv = nz.length ? nz.reduce((s, v) => s + v, 0) / nz.length : null;
      const ingNz = ingCols.filter(v => !isZero(v)); const ingAvg = ingNz.length ? ingNz.reduce((s, v) => s + v, 0) / ingNz.length : 0;
      const ref = C.modaOMediana(all12.map(x => r.f(x)));
      const color = colorProm(pv, ref.valor);
      const tip = ref.valor == null ? '' : `${ref.tipo === 'moda' ? `Importe más repetido (${ref.veces} meses)` : 'Sin repetidos → mediana'}${showEur(m) ? ': ' + eur(ref.valor) : ''}`;
      const refTxt = ref.valor != null && pv != null ? `<span class="pct">${ref.tipo === 'moda' ? 'moda' : 'med.'}${showEur(m) ? ' ' + eur0(ref.valor) : ''}</span>` : '';
      html += `<td class="${color} ${pv == null ? 'zero' : ''}" title="${esc(tip)}">${pv == null ? '–' : body(pv, ingAvg, isIng)}${refTxt}</td>`;
    }
    if (diff) {
      const d = vals[vals.length - 1] - vals[0];
      const de = showEur(m) ? (d > 0 ? '+' : '') + eur(d) : ''; const dp = showPct(m) && !isZero(vals[0]) ? (d > 0 ? '+' : '') + pct(d / Math.abs(vals[0])) : '';
      const txt = isZero(d) ? '–' : m === 'none' ? '•' : de && dp ? `${de}<span class="pct">${dp}</span>` : de || dp || '–';
      html += `<td class="c-total ${cls(d)}">${txt}</td>`;
    }
    html += '</tr>';
  }
  html += `</tbody></table></div><p class="small muted" style="margin:8px 4px">Ingresos, preahorro y ahorro en positivo; gastos en negativo. % = sobre el ingreso (Salario + Dinero extra) de cada columna. ${prom ? 'Promedio: media de los meses seleccionados con valor; color comparando con el importe más repetido del año (si no hay repetidos, la mediana). ' : ''}Toca una celda para ver sus movimientos.</p>`;
  host.innerHTML = html;
  $$('td[data-cell]', host).forEach(td => td.onclick = () => {
    const r = rows.find(x => x.n === td.parentElement.dataset.row); const c = cols[+td.dataset.cell];
    const movs = D().movimientos.filter(mv => C.valido(mv) && mv.anio === c.y && (c.m ? mv.mes === c.m : true) && (r.sub ? mv.subgrupo === r.sub : mv.grupo === r.grp));
    ctx.showMovList(`${r.n} · ${c.h}`, movs);
  });
}

/* ======================= HISTÓRICO ======================= */
const HIST_COL = { ingreso: () => colorGrupo('ING'), preahorro: () => colorGrupo('PRE'), gmf: () => colorGrupo('GMF'), efectivo: () => colorGrupo('EFE'), gaf: () => colorGrupo('GAF'), gex: () => colorGrupo('GEX'), ahorro: () => fixed('GRAN'), ahorroCuenta: () => fixed('AHORRO') };
const histVal = (h, k) => k === 'preahorro' ? -(h[k] || 0) : (h[k] || 0); // preahorro en positivo

export function renderHistorico(main, ctx) {
  const st = ctx.state; const H = C.historico(D());
  if (!H.length) return sinDatos(main, 'No hay datos históricos. Puedes añadir totales anuales en Ajustes → Histórico.');
  const cat = C.CATS_HIST.find(c => c.k === st.histCat) || C.CATS_HIST[0];
  const mb = ctx.mode('hBar'), ma = ctx.mode('hAcc'), mt = ctx.mode('hTbl');
  main.innerHTML = `
  <div class="card"><div class="card-head"><div><h2>Total anual por grupo</h2><p class="sub" style="margin:0">Elige un grupo · % sobre el ingreso del año</p></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><select id="histCat">${C.CATS_HIST.map(c => `<option value="${c.k}" ${c.k === cat.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select>${dispPicker('hBar', ctx)}</div></div>
    <div class="chart-box"><canvas id="chHist"></canvas></div></div>
  <div class="card" style="margin-top:14px">${head('Ahorro total acumulado', 'Suma año tras año del ahorro total (cuenta + preahorro)', 'hAcc', ctx)}
    <div class="chart-box"><canvas id="chHistAcc"></canvas></div></div>
  <div class="section-title">Tabla histórica</div>
  <div class="toolbar"><div class="seg"><button data-v="total" class="${st.histModo !== 'prom' ? 'on' : ''}">Total anual</button><button data-v="prom" class="${st.histModo === 'prom' ? 'on' : ''}">Promedio mensual</button></div><span class="grow"></span>${dispPicker('hTbl', ctx)}</div>
  <div class="table-wrap"><table class="fin num"><thead><tr><th>Año</th>${C.CATS_HIST.map(c => `<th style="box-shadow:inset 0 -3px 0 ${HIST_COL[c.k]()}">${c.n}</th>`).join('')}</tr></thead><tbody>
    ${H.map(h => `<tr><td>${h.anio}${h.fuente === 'manual' ? '' : ' <span class="tag acc">detalle</span>'}</td>${C.CATS_HIST.map(c => {
      const div = st.histModo === 'prom' ? h.meses : 1; const v = histVal(h, c.k) / div; const base = (h.ingreso || 0) / div;
      const e = showEur(mt) ? eur(v) : ''; const p = showPct(mt) && c.k !== 'ingreso' && base ? pct(Math.abs(v) / base) : '';
      return `<td class="${cls(v)}">${mt === 'none' ? '•' : e && p ? `${e}<span class="pct">${p}</span>` : e || p || (c.k === 'ingreso' ? '100 %' : '–')}</td>`;
    }).join('')}</tr>`).join('')}
  </tbody></table></div>
  <p class="small muted" style="margin:8px 4px">Ingresos, preahorro y ahorro en positivo; gastos en negativo. Años sin etiqueta: totales introducidos a mano (Ajustes → Histórico). "detalle": calculado desde tus movimientos. Promedio mensual = total / 12 (o / meses con datos en el año en curso).</p>`;
  $('#histCat', main).onchange = (e) => { st.histCat = e.target.value; ctx.rerender(); };
  $$('.seg [data-v]', main).forEach(b => b.onclick = () => { st.histModo = b.dataset.v; ctx.rerender(); });
  bindPickers(main, ctx);
  const vals = H.map(h => histVal(h, cat.k)); const c0 = HIST_COL[cat.k]();
  const esAhorro = cat.k === 'ahorro' || cat.k === 'ahorroCuenta';
  makeChart($('#chHist', main), {
    type: 'bar', data: { labels: H.map(h => h.anio), datasets: [{ label: cat.n, data: vals, backgroundColor: vals.map(v => esAhorro && v < 0 ? css('--bad') : c0), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 48 }] },
    options: {
      layout: { padding: { top: mb === 'none' ? 6 : (main.clientWidth < 600 ? (showEur(mb) && showPct(mb) ? 92 : 48) : (showEur(mb) && showPct(mb) ? 26 : 14)) } },
      scales: { x: { grid: { display: false } }, y: { ...axisEur, display: showEur(mb) } },
      plugins: {
        fzLabels: { pos: 'top', text: (di, i, v) => { const out = []; if (showEur(mb)) out.push(compactEur(v)); if (showPct(mb) && cat.k !== 'ingreso' && H[i].ingreso) out.push(pct(Math.abs(v) / H[i].ingreso).replace(',0', '')); return out.length ? out : null; } },
        tooltip: { callbacks: { label: (c) => { const t = fmtMode(mb, c.raw, cat.k === 'ingreso' ? 0 : H[c.dataIndex].ingreso); return ` ${cat.n}${t ? ': ' + t : ''}`; }, afterLabel: (c) => showEur(mb) ? `Promedio mensual: ${eur(c.raw / H[c.dataIndex].meses)}` : '' } }
      }
    }
  });
  let s = 0, si = 0; const accd = H.map(h => (s += h.ahorro || 0)); const accI = H.map(h => (si += h.ingreso || 0));
  const cg = fixed('GRAN');
  makeChart($('#chHistAcc', main), {
    type: 'line', data: { labels: H.map(h => h.anio), datasets: [{ label: 'Ahorro acumulado', data: accd, borderColor: cg, backgroundColor: alpha(cg, 0.15), fill: true, borderWidth: 2, pointRadius: 3.5, tension: .25 }] },
    options: {
      layout: { padding: { right: ma === 'none' ? 4 : 56 } },
      interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false } }, y: { ...axisEur, display: showEur(ma) } },
      plugins: {
        fzLabels: { pos: 'last', text: (di, i, v) => { const out = []; if (showEur(ma)) out.push(compactEur(v)); if (showPct(ma) && accI[i]) out.push(pct(v / accI[i]).replace(',0', '')); return out.length ? out : null; } },
        tooltip: { callbacks: { label: (c) => { const t = fmtMode(ma, c.raw, accI[c.dataIndex]); return t ? ` Acumulado: ${t}` : ' Acumulado'; }, afterLabel: (c) => { const t = fmtMode(ma, H[c.dataIndex].ahorro, H[c.dataIndex].ingreso); return t ? `Ahorro del año: ${t}` : ''; } } }
      }
    }
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
  const e = C.estadoPrestamo(D(), p); const m = ctx.mode('loan');
  // Colores de la familia del subgrupo vinculado (Hipoteca → naranjas)
  const fam = familia(D(), p.subgrupo); const cPag = colorSub(D(), p.subgrupo) || colorGrupo(fam); const cPen = colorOtros(fam === 'EFE' || fam === 'PRE' ? 'GMF' : fam);
  const v = (x) => showEur(m) ? eur0(x) : showPct(m) ? pct(x / e.total) : MASK;
  const [fy, fm] = (e.fin || '').split('-');
  const host = $('#loanHost', main);
  host.innerHTML = `
  <div class="kpis">
    <div class="kpi" style="box-shadow:inset 0 3px 0 ${cPag},var(--shadow)"><div class="l">Cuotas faltantes</div><div class="v num">${e.cuotasFaltantes}</div><div class="d">de ${e.cuotasTotales} · pagadas ${e.cuotasPagadas}</div></div>
    <div class="kpi" style="box-shadow:inset 0 3px 0 ${cPag},var(--shadow)"><div class="l">Finalización</div><div class="v">${fm ? C.MESES[+fm - 1] : '–'}</div><div class="d">${fy || ''}${e.cuotasFaltantes ? ` · faltan ${Math.floor(e.cuotasFaltantes / 12)} años y ${e.cuotasFaltantes % 12} meses` : ''}</div></div>
    <div class="kpi" style="box-shadow:inset 0 3px 0 ${cPag},var(--shadow)"><div class="l"><i style="background:${cPag}"></i>Pagado</div><div class="v num">${v(e.pagado)}</div><div class="d">${showEur(m) && showPct(m) ? pct(e.pagado / e.total) + ' del total' : ''}</div></div>
    <div class="kpi" style="box-shadow:inset 0 3px 0 ${cPen},var(--shadow)"><div class="l"><i style="background:${cPen}"></i>Pendiente</div><div class="v num">${v(e.pendiente)}</div><div class="d">${e.proxima ? (showEur(m) ? 'Próxima letra ' + eur(e.proxima.letra) : 'Próxima letra ' + fecha(e.proxima.fecha)) : 'Sin cuotas pendientes'}</div></div>
  </div>
  <div class="grid c2" style="margin-top:14px"><div id="loanDonut"></div>
    <div class="card"><h2>${esc(p.nombre)}</h2><p class="sub">Vinculado al subgrupo <b>${esc(p.subgrupo)}</b></p>
      <div class="progress" aria-label="Progreso"><i style="width:${Math.min(100, e.pagado / e.total * 100).toFixed(1)}%;background:${cPag}"></i></div>
      <div class="list" style="margin-top:10px">
        <div class="it"><span class="grow ink2">Total (pagado + pendiente)</span><b class="num">${v(e.total)}</b></div>
        ${p.capital ? `<div class="it"><span class="grow ink2">Capital prestado</span><b class="num">${showEur(m) ? eur(p.capital) : MASK}</b></div>` : ''}
        <div class="it"><span class="grow ink2">Pagado antes de los movimientos</span><span class="num">${v(p.pagadoPrevio || 0)}</span></div>
        <div class="it"><span class="grow ink2">Pagado según movimientos (${e.pagos.length})</span><span class="num">${v(e.pagadoMovs)}</span></div>
        <div class="it"><span class="grow ink2">Capital pendiente</span><span class="num">${v(e.capitalPendiente)}</span></div>
        <div class="it"><span class="grow ink2">Intereses pendientes</span><span class="num">${v(e.interesesPendientes)}</span></div>
      </div>
      <div class="actions"><button class="btn ghost" id="editLoan">Editar préstamo</button></div></div></div>
  <details class="card" style="margin-top:14px"><summary>Cuadro de amortización (${e.cuotasTotales} cuotas)</summary>
    <div class="table-wrap" style="max-height:420px"><table class="fin num"><thead><tr><th>Nº</th><th>Fecha</th><th>Intereses</th><th>Principal</th><th>Amortizado</th><th>Letra</th></tr></thead><tbody>
    ${(p.cuadro || []).map((c, i) => `<tr style="${i < e.cuotasPagadas ? 'opacity:.55' : ''}"><td style="box-shadow:inset 4px 0 0 ${i < e.cuotasPagadas ? cPag : cPen}">${c.n}${i < e.cuotasPagadas ? ' ✓' : ''}</td><td>${fecha(c.fecha)}</td><td>${c.intereses != null ? eur(c.intereses) : '–'}</td><td>${c.principal != null ? eur(c.principal) : '–'}</td><td>${c.amortizado != null ? eur(c.amortizado) : '–'}</td><td>${eur(c.letra)}</td></tr>`).join('')}
    </tbody></table></div></details>`;
  donutCard($('#loanDonut', host), {
    title: `${p.nombre} total: pagado vs pendiente`, centerLabel: 'Total', mode: m, picker: dispPicker('loan', ctx),
    items: [{ n: 'Pagado', v: e.pagado, color: cPag }, { n: 'Pendiente', v: e.pendiente, color: cPen }]
  }).style.height = '100%';
  $('#editLoan', host).onclick = () => editarPrestamo(p, ctx);
  bindPickers(main, ctx);
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
  const m = ctx.mode('ooc'); const g1 = colorSub(D(), 'Out of Context'), gD = 'hsl(40 4% 38%)', gL = 'hsl(40 4% 66%)';
  const val = (v, base) => showEur(m) ? eur(v) : showPct(m) && base ? pct(Math.abs(v) / base) : MASK;
  const cell = (v) => { if (m === 'none') return '•'; const e = showEur(m) ? eur(v) : ''; const p = showPct(m) && ing ? pct(Math.abs(v) / ing) : ''; return e && p ? `${e}<span class="pct">${p}</span>` : e || p; };
  main.innerHTML = `<div class="toolbar"><label class="ink2 small">Periodo</label><select id="oocY"><option value="">Todo</option>${years.map(y => `<option ${y === st.oocYear ? 'selected' : ''}>${y}</option>`).join('')}</select><span class="grow"></span>${dispPicker('ooc', ctx)}</div>
  <div class="kpis"><div class="kpi" style="grid-column:1/-1;box-shadow:inset 0 3px 0 ${gD},var(--shadow)"><div class="l"><i style="background:${gD}"></i>Dinero disponible (Out of Context)</div><div class="v num ${cls(ing + gas)}">${val(ing + gas, ing)}</div><div class="d">Ingresado − gastado${showPct(m) && showEur(m) && ing ? ' · ' + pct((ing + gas) / ing) + ' de lo ingresado' : ''}</div></div>
    <div class="kpi" style="box-shadow:inset 0 3px 0 ${g1},var(--shadow)"><div class="l"><i style="background:${g1}"></i>Ingresado</div><div class="v num">${showEur(m) ? eur0(ing) : showPct(m) ? '100 %' : MASK}</div></div>
    <div class="kpi" style="box-shadow:inset 0 3px 0 ${gL},var(--shadow)"><div class="l"><i style="background:${gL}"></i>Gastado</div><div class="v num ${gas ? 'neg' : ''}">${showEur(m) ? eur0(gas) : showPct(m) && ing ? pct(-gas / ing) : MASK}</div></div></div>
  <div class="section-title">Movimientos (${list.length})</div>
  ${list.length ? `<div class="table-wrap"><table class="fin num"><thead><tr><th>Fecha</th><th>Importe</th><th>Divisa</th><th style="text-align:left">Concepto 2</th></tr></thead><tbody>
    ${list.map(x => `<tr data-id="${x.id}" style="cursor:pointer"><td style="box-shadow:inset 4px 0 0 ${x.importe < 0 ? gL : gD}">${fecha(x.fecha)}</td><td class="${cls(x.importe)}">${cell(x.importe)}</td><td>${esc(x.divisa)}</td><td style="text-align:left">${esc(x.concepto2 || x.concepto)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card empty">Aún no hay movimientos en el grupo <b>Out of Context</b>.<br><span class="small">Clasifica un movimiento como "Out of Context" en Movimientos y aparecerá aquí (no cuenta en el resto de la app).</span></div>`}
  <p class="small muted" style="margin:8px 4px">% = sobre el total ingresado como Out of Context en el periodo.</p>`;
  $('#oocY', main).onchange = (e) => { st.oocYear = e.target.value ? +e.target.value : null; ctx.rerender(); };
  $$('tr[data-id]', main).forEach(tr => tr.onclick = () => ctx.openMov(tr.dataset.id));
  bindPickers(main, ctx);
}
