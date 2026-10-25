// Banco Mundial – "Pink Sheet" (Commodity Price Data), precios mensuales. Licencia CC BY 4.0.
// La dirección del Excel cambia con cada publicación: se busca en la página oficial.
import { leerHoja } from './xlsx.js';
const PAGINA = 'https://www.worldbank.org/en/research/commodity-markets';
const UA = 'MonitorMateriasPrimas/1.0 (proyecto educativo personal)';

export async function urlPinkSheet() {
  if (process.env.WB_PINK_SHEET_URL) return process.env.WB_PINK_SHEET_URL;
  const r = await fetch(PAGINA, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`Banco Mundial respondió HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/href="([^"]*CMO-Historical-Data-Monthly\.xlsx)"/i);
  if (!m) throw new Error('No se encontró el enlace al Excel "CMO-Historical-Data-Monthly.xlsx" en la página del Banco Mundial');
  return new URL(m[1], PAGINA).toString();
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();

// Convierte la hoja "Monthly Prices" en { columna: { nombre, unidad, puntos: [[AAAA-MM-01, valor]] } }.
export function parsearPinkSheet(filas, columnasBuscadas) {
  const iCab = filas.findIndex((f) => f && f.some((c) => norm(c) === 'urea' || norm(c).startsWith('crude oil')));
  if (iCab < 0) throw new Error('No se encontró la fila de encabezados en la hoja del Banco Mundial');
  const cab = filas[iCab], unidades = filas[iCab + 1] || [];
  const res = {};
  for (const col of columnasBuscadas) {
    const j = cab.findIndex((c) => norm(c) === norm(col)) >= 0 ? cab.findIndex((c) => norm(c) === norm(col)) : cab.findIndex((c) => norm(c).startsWith(norm(col)));
    if (j < 0) { res[col] = { error: `La columna "${col}" no está en el Excel` }; continue; }
    const puntos = [];
    for (let i = iCab + 2; i < filas.length; i++) {
      const f = filas[i]; if (!f) continue;
      const m = /^(\d{4})M(\d{2})$/.exec(String(f[0] ?? '').trim());
      const v = f[j];
      if (m && typeof v === 'number' && Number.isFinite(v)) puntos.push([`${m[1]}-${m[2]}-01`, v]);
    }
    res[col] = { nombre: String(cab[j]).trim(), unidad: String(unidades[j] ?? '').trim(), puntos };
  }
  return res;
}

export async function obtenerPinkSheet(columnas) {
  const url = await urlPinkSheet();
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Descarga del Excel del Banco Mundial: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { url, columnas: parsearPinkSheet(leerHoja(buf, 'Monthly Prices'), columnas) };
}
