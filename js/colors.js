// Código de colores por familia (grupo) y subgrupo — se usa en toda la app.
//  Ingresos (incl. Preahorro y Ahorro) → verdes · Gasto mensual fijo → naranjas · Efectivo → amarillo claro
//  Gasto anual fijo → azules · Gasto Extra → granates · Out of Context → grises
import { SUB } from './calc.js?v=1.6.0';

const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

// Rampa por familia: tono, saturación, luminosidad mín–máx
const RAMP = {
  ING: { h: 140, s: 52, l: [26, 62] },
  GMF: { h: 24, s: 85, l: [34, 68] },
  GAF: { h: 212, s: 66, l: [28, 70] },
  GEX: { h: 350, s: 58, l: [24, 58] },
  OOC: { h: 40, s: 4, l: [34, 72] },
  SE: { h: 260, s: 6, l: [45, 70] }
};
// Colores fijos de conceptos clave
const FIX = {
  ING: { light: '#2e9d4a', dark: '#3fb35c' },          // Ingreso (grupo)
  [SUB.SAL]: { light: '#1e7a37', dark: '#35a552' },
  [SUB.EXT]: { light: '#7cc576', dark: '#8fd18a' },
  [SUB.PRE]: { light: '#0f8f6e', dark: '#22b08a' },     // verde azulado
  AHORRO: { light: '#9ccf5a', dark: '#a7d86a' },        // verde lima (ahorro en cuenta)
  GRAN: { light: '#145a32', dark: '#5fcf86' },          // gran total ahorro
  GMF: { light: '#e46f12', dark: '#ef8233' },
  [SUB.EFE]: { light: '#f3d75e', dark: '#e9cd55' },     // amarillo claro
  GAF: { light: '#2a6fc9', dark: '#4a8de0' },
  GEX: { light: '#8e2436', dark: '#c0485d' },
  OOC: { light: '#8a8984', dark: '#9b9a95' },
  SE: { light: '#b9b6c2', dark: '#6f6c78' },
  'Sin efecto': { light: '#b9b6c2', dark: '#6f6c78' },
  GASTOS: { light: '#c8501a', dark: '#e0703a' }         // gasto total (mezcla de familias)
};

export function fixed(k) { const f = FIX[k]; return f ? (isDark() ? f.dark : f.light) : null; }

function rampColor(g, i, n) {
  const r = RAMP[g] || RAMP.OOC; const dl = isDark() ? 8 : 0;
  // intercalado: elementos consecutivos reciben tonos alejados
  const half = Math.ceil(n / 2); const k = i % 2 === 0 ? i / 2 : half + (i - 1) / 2;
  const t = n <= 1 ? 0.35 : k / (n - 1);
  const l = r.l[0] + (r.l[1] - r.l[0]) * t + dl;
  return `hsl(${r.h} ${r.s}% ${Math.min(l, 80).toFixed(0)}%)`;
}

/** Color de un grupo (ING, GMF, GAF, GEX, OOC) o claves especiales (PRE, AHORRO, GRAN, GASTOS, EFE). */
export function colorGrupo(k) {
  if (k === 'PRE') return fixed(SUB.PRE);
  if (k === 'EFE') return fixed(SUB.EFE);
  return fixed(k) || fixed('OOC');
}

/** Color de un subgrupo según su familia y su posición en el catálogo. */
export function colorSub(data, sub) {
  if (FIX[sub]) return fixed(sub);
  for (const [g, list] of Object.entries(data.catalogo)) {
    const l = list.filter(s => !FIX[s]);
    const i = l.indexOf(sub);
    if (i >= 0) return rampColor(g, i, l.length);
  }
  return fixed('OOC');
}

/** Familia de un subgrupo (para franjas y tintes). Efectivo tiene la suya propia. */
export function familia(data, sub, grupo) {
  if (sub === SUB.EFE) return 'EFE';
  if (sub === SUB.PRE) return 'PRE';
  return grupo || Object.entries(data.catalogo).find(([, l]) => l.includes(sub))?.[0] || 'OOC';
}

/** Color "Otros" dentro de una familia (más apagado). */
export function colorOtros(g) {
  const r = RAMP[g] || RAMP.OOC; return `hsl(${r.h} ${Math.round(r.s * 0.3)}% ${isDark() ? 45 : 78}%)`;
}

export function tint(color, pct = 14) { return `color-mix(in srgb, ${color} ${pct}%, var(--surface))`; }

/** Color con transparencia, válido dentro de los gráficos (canvas no entiende variables CSS). */
export function alpha(c, a) {
  if (c.startsWith('#')) { const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7); const n = parseInt(h, 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  if (c.startsWith('hsl(')) return c.replace(')', ` / ${a})`);
  return c;
}
