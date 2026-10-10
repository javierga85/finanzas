// Lógica de negocio: clasificación, repetidos y agregaciones.
export const GRUPOS = {
  ING: 'Ingreso mensual', GMF: 'Gasto mensual fijo', GAF: 'Gasto anual fijo', GEX: 'Gasto Extra', OOC: 'Out of Context'
};
export const SUB = { SAL: 'Salario neto', EXT: 'Dinero extra ingresado', PRE: 'Preahorro', EFE: 'Gastos varios (efectivo)' };
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const r2 = (x) => Math.round(x * 100) / 100;
const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

export function grupoDeSubgrupo(data, sub) {
  for (const [g, l] of Object.entries(data.catalogo)) if (l.includes(sub)) return g;
  return null;
}

/** Aplica reglas (por orden) sobre Concepto o Movimiento. Devuelve la regla o null. */
export function matchRule(data, mov) {
  const c = norm(mov.concepto), m = norm(mov.movimiento);
  for (const r of data.reglas) {
    const p = norm(r.patron); if (!p) continue;
    if (r.tipo === 'contiene' ? (c.includes(p) || m.includes(p)) : (c === p || m === p)) return r;
  }
  return null;
}

/** Mes/año por defecto a partir de la fecha de operación (+1 mes si la regla lo indica). */
export function mesAnioPorDefecto(fecha, mesSiguiente) {
  if (!fecha) return { mes: null, anio: null };
  let [y, m] = fecha.split('-').map(Number);
  if (mesSiguiente) { m++; if (m > 12) { m = 1; y++; } }
  return { mes: m, anio: y };
}

export function clasificar(data, mov, { forzar = false } = {}) {
  const r = matchRule(data, mov);
  if (r && (forzar || !mov.subgrupo)) { mov.grupo = r.grupo; mov.subgrupo = r.subgrupo; }
  if (!mov.mes || !mov.anio || forzar) Object.assign(mov, mesAnioPorDefecto(mov.fecha, r?.mesSiguiente));
  return mov;
}

export const claveRepetido = (m) => [m.fvalor, norm(m.concepto), norm(m.movimiento), r2(m.importe)].join('|');

/** Set de ids marcados como repetidos (todas las apariciones salvo la primera). */
export function repetidos(movs) {
  const seen = new Map(), rep = new Set();
  for (const m of movs) {
    const k = claveRepetido(m);
    if (seen.has(k)) { if (!m.noRepetido) rep.add(m.id); }
    else seen.set(k, m.id);
  }
  return rep;
}

export const valido = (m) => m.subgrupo && m.grupo && m.mes && m.anio;

export function aniosConMovs(data) {
  const s = new Set(); data.movimientos.forEach(m => { if (valido(m) && m.grupo !== 'OOC') s.add(m.anio); });
  return [...s].sort((a, b) => a - b);
}

/** Cubo: cube[anio][mes][subgrupo] = suma (excluye Out of Context). */
export function cubo(data) {
  const c = {};
  for (const m of data.movimientos) {
    if (!valido(m) || m.grupo === 'OOC') continue;
    const y = (c[m.anio] ||= {}); const mm = (y[m.mes] ||= {});
    mm[m.subgrupo] = (mm[m.subgrupo] || 0) + m.importe;
    mm['§' + m.grupo] = (mm['§' + m.grupo] || 0) + m.importe;
  }
  return c;
}

/** Métricas de un mes (valores con signo, como en el banco). */
export function metricasMes(cube, anio, mes) {
  const d = cube[anio]?.[mes] || {};
  const g = (k) => d[k] || 0;
  const sal = g(SUB.SAL), ext = g(SUB.EXT), pre = g(SUB.PRE), efe = g(SUB.EFE);
  const gmf = g('§GMF'), gaf = g('§GAF'), gex = g('§GEX');
  const ingreso = sal + ext, gastos = gmf + gaf + gex;
  const ahorroCuenta = ingreso + gastos + pre;
  return { sal, ext, ingreso, pre, efe, gmf, gmfSinEfe: gmf - efe, gaf, gex, gastos, totalGasto: gmf + gaf, ahorroCuenta, granTotal: ahorroCuenta - pre, raw: d };
}

export function metricasAnio(cube, anio, meses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const acc = {}; const sub = {};
  for (const m of meses) {
    const x = metricasMes(cube, anio, m);
    for (const [k, v] of Object.entries(x)) if (k !== 'raw') acc[k] = (acc[k] || 0) + v;
    for (const [k, v] of Object.entries(x.raw)) sub[k] = (sub[k] || 0) + v;
  }
  acc.sub = sub; return acc;
}

/** Series anuales para el histórico: totales manuales + años calculados desde movimientos. */
export const CATS_HIST = [
  { k: 'ingreso', n: 'Ingreso total' }, { k: 'preahorro', n: 'Preahorro' }, { k: 'gmf', n: 'Gasto mensual fijo' },
  { k: 'efectivo', n: 'Efectivo (gastos varios)' }, { k: 'gaf', n: 'Gasto anual fijo' }, { k: 'gex', n: 'Gastos Extra' },
  { k: 'ahorro', n: 'Ahorro total (cuenta + preahorro)' }, { k: 'ahorroCuenta', n: 'Ahorro en cuenta' }
];
export function historico(data) {
  const cube = cubo(data); const out = new Map();
  for (const h of data.historico || []) {
    const ahorro = (h.ingreso || 0) + (h.gmf || 0) + (h.efectivo || 0) + (h.gaf || 0) + (h.gex || 0);
    out.set(h.anio, { anio: h.anio, fuente: 'manual', meses: 12, ...h, ahorro, ahorroCuenta: ahorro + (h.preahorro || 0) });
  }
  for (const y of aniosConMovs(data)) {
    const a = metricasAnio(cube, y);
    const mesesConDatos = Object.keys(cube[y] || {}).length || 12;
    out.set(y, { anio: y, fuente: 'movimientos', meses: mesesConDatos, ingreso: a.ingreso, preahorro: a.pre, gmf: a.gmfSinEfe, efectivo: a.efe, gaf: a.gaf, gex: a.gex, ahorro: a.granTotal, ahorroCuenta: a.ahorroCuenta });
  }
  return [...out.values()].sort((a, b) => a.anio - b.anio);
}

/** Importe más repetido (moda) entre los valores mensuales no nulos; si no hay repetidos, mediana. */
export function modaOMediana(vals) {
  const v = vals.filter(x => Math.abs(x) > 0.004).map(r2);
  if (!v.length) return { valor: null, tipo: null };
  const f = new Map(); v.forEach(x => f.set(x, (f.get(x) || 0) + 1));
  let best = null, bc = 1;
  for (const [x, c] of f) if (c > bc || (c === bc && c > 1 && Math.abs(x) > Math.abs(best))) { best = x; bc = c; }
  if (bc > 1) return { valor: best, tipo: 'moda', veces: bc };
  const s = [...v].sort((a, b) => a - b); const n = s.length;
  return { valor: n % 2 ? s[(n - 1) / 2] : r2((s[n / 2 - 1] + s[n / 2]) / 2), tipo: 'mediana' };
}

/** Préstamo: estado a partir del cuadro y de los movimientos del subgrupo vinculado. */
export function estadoPrestamo(data, p) {
  const desde = p.inicioMovs || '0000-00';
  const pagos = data.movimientos.filter(m => m.subgrupo === p.subgrupo && m.importe < 0 && m.anio && `${m.anio}-${String(m.mes).padStart(2, '0')}` >= desde);
  const pagadoMovs = -pagos.reduce((s, m) => s + m.importe, 0);
  const cuotasPagadas = (p.cuotasPrevias || 0) + pagos.length;
  const cuadro = p.cuadro || [];
  const restantes = cuadro.slice(Math.min(cuotasPagadas, cuadro.length));
  const pendiente = restantes.reduce((s, c) => s + (c.letra || 0), 0);
  const pagado = (p.pagadoPrevio || 0) + pagadoMovs;
  const ultima = cuadro[cuadro.length - 1];
  const proxima = restantes[0];
  const interesesPendientes = restantes.reduce((s, c) => s + (c.intereses || 0), 0);
  const capitalPendiente = restantes.reduce((s, c) => s + (c.principal || 0), 0);
  return {
    pagos, pagadoMovs, cuotasPagadas, cuotasTotales: cuadro.length, cuotasFaltantes: Math.max(0, cuadro.length - cuotasPagadas),
    pendiente, pagado, total: pagado + pendiente, fin: ultima?.fecha || null, proxima, interesesPendientes, capitalPendiente
  };
}

/** Cuadro de amortización (sistema francés). */
export function cuadroFrances(capital, tinAnual, nCuotas, primeraFecha) {
  const i = tinAnual / 100 / 12; const cuota = i ? capital * i / (1 - Math.pow(1 + i, -nCuotas)) : capital / nCuotas;
  let pend = capital, amort = 0; const out = [];
  let [y, m, d] = primeraFecha.split('-').map(Number);
  for (let n = 1; n <= nCuotas; n++) {
    const int = r2(pend * i); let pr = r2(cuota - int); if (n === nCuotas) pr = r2(pend);
    pend = r2(pend - pr); amort = r2(amort + pr);
    const last = new Date(y, m, 0).getDate();
    out.push({ n, anio: Math.ceil(n / 12), fecha: `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`, intereses: int, principal: pr, amortizado: amort, letra: r2(int + pr) });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
