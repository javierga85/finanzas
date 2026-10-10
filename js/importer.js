// Lectura de ficheros Excel/CSV (extracto BBVA y cuadros de amortización) con SheetJS
const norm = (s) => (s ?? '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export async function leerHoja(file) {
  if (!window.XLSX) throw new Error('No se ha cargado el lector de Excel');
  const buf = await file.arrayBuffer();
  const wb = window.XLSX.read(buf, { type: 'array', cellDates: false, raw: false, codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
}

export function aFechaISO(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') { // serial Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = v.toString().trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function aNumero(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  let s = v.toString().replace(/[€\s]/g, '').replace(/EUR/i, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s);
}

function buscarCabecera(rows, requeridas) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const h = (rows[i] || []).map(norm);
    if (requeridas.every(r => h.some(c => r.some(x => c === x || c.startsWith(x))))) return i;
  }
  return -1;
}
const idx = (h, ...names) => { for (const n of names) { const i = h.findIndex(c => c === n); if (i >= 0) return i; } for (const n of names) { const i = h.findIndex(c => c.startsWith(n)); if (i >= 0) return i; } return -1; };

/** Extracto de movimientos BBVA (también vale cualquier Excel con columnas Fecha / F.Valor / Concepto / Movimiento / Importe / Divisa). */
export function parseExtracto(rows) {
  const hi = buscarCabecera(rows, [['concepto'], ['importe']]);
  if (hi < 0) throw new Error('No encuentro una fila de cabecera con las columnas "Concepto" e "Importe".');
  const h = rows[hi].map(norm);
  const c = {
    fecha: idx(h, 'fecha', 'fecha operacion', 'f. operacion'),
    fvalor: idx(h, 'f.valor', 'f. valor', 'fecha valor'),
    concepto: idx(h, 'concepto'), movimiento: idx(h, 'movimiento', 'descripcion'),
    importe: idx(h, 'importe'), divisa: idx(h, 'divisa', 'moneda'), obs: idx(h, 'observaciones')
  };
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const imp = aNumero(r[c.importe]);
    const f = aFechaISO(r[c.fecha >= 0 ? c.fecha : c.fvalor]);
    if (!f || !isFinite(imp)) continue;
    out.push({
      fecha: f, fvalor: aFechaISO(r[c.fvalor >= 0 ? c.fvalor : c.fecha]) || f,
      concepto: (r[c.concepto] ?? '').toString().trim(), movimiento: c.movimiento >= 0 ? (r[c.movimiento] ?? '').toString().trim() : '',
      importe: Math.round(imp * 100) / 100, divisa: c.divisa >= 0 ? (r[c.divisa] || 'EUR') : 'EUR',
      observaciones: c.obs >= 0 ? (r[c.obs] ?? '').toString().trim() : ''
    });
  }
  return out;
}

/** Cuadro de amortización: columnas Fecha + (Letra/Cuota) o (Intereses + Principal). */
export function parseCuadro(rows) {
  const hi = buscarCabecera(rows, [['fecha'], ['letra', 'cuota', 'intereses', 'principal']]);
  if (hi < 0) throw new Error('No encuentro cabecera con "Fecha" y "Letra"/"Cuota" o "Intereses"/"Principal".');
  const h = rows[hi].map(norm);
  const c = { anio: idx(h, 'ano', 'año'), fecha: idx(h, 'fecha'), int: idx(h, 'intereses', 'interes'), pr: idx(h, 'principal', 'capital', 'amortizacion'), am: idx(h, 'amortizado'), le: idx(h, 'letra', 'cuota', 'importe') };
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const f = aFechaISO(r[c.fecha]); if (!f) continue;
    const int = c.int >= 0 ? aNumero(r[c.int]) : NaN, pr = c.pr >= 0 ? aNumero(r[c.pr]) : NaN;
    let le = c.le >= 0 ? aNumero(r[c.le]) : NaN; if (!isFinite(le)) le = (int || 0) + (pr || 0);
    out.push({ n: out.length + 1, anio: c.anio >= 0 ? r[c.anio] : null, fecha: f, intereses: isFinite(int) ? int : null, principal: isFinite(pr) ? pr : null, amortizado: c.am >= 0 ? aNumero(r[c.am]) : null, letra: Math.round(le * 100) / 100 });
  }
  if (!out.length) throw new Error('El cuadro no tiene filas válidas.');
  return out;
}
