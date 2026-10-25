// FRED (Federal Reserve Bank of St. Louis). Sin clave usa la descarga CSV pública;
// con FRED_API_KEY (gratuita) usa la API oficial, más estable.
const UA = 'MonitorMateriasPrimas/1.0 (proyecto educativo personal)';

export function parsearCSVFred(texto, id) {
  const lineas = texto.trim().split(/\r?\n/);
  const cab = (lineas.shift() || '').split(',').map((x) => x.trim());
  if (cab.length < 2 || !/^(observation_date|DATE)$/i.test(cab[0])) {
    throw new Error(/<html/i.test(texto) ? 'FRED devolvió una página web en lugar de datos (¿mantenimiento?)' : `Formato inesperado de FRED para ${id}`);
  }
  const puntos = [];
  for (const l of lineas) {
    const [f, v] = l.split(',');
    const n = Number(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f) && v !== '.' && v !== '' && Number.isFinite(n)) puntos.push([f, n]);
  }
  return puntos;
}

export async function obtenerFRED(id, { desde } = {}) {
  const clave = process.env.FRED_API_KEY;
  if (clave) {
    const p = new URLSearchParams({ series_id: id, api_key: clave, file_type: 'json', ...(desde ? { observation_start: desde } : {}) });
    const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?${p}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`FRED API respondió HTTP ${r.status}`);
    const j = await r.json();
    return (j.observations || []).filter((o) => o.value !== '.').map((o) => [o.date, Number(o.value)]).filter(([, v]) => Number.isFinite(v));
  }
  const p = new URLSearchParams({ id, ...(desde ? { cosd: desde } : {}) });
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?${p}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`FRED respondió HTTP ${r.status}${r.status === 404 ? ' (la serie no existe)' : ''}`);
  return parsearCSVFred(await r.text(), id);
}
