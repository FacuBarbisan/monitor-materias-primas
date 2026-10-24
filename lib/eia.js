// Precios spot diarios oficiales de la EIA (U.S. Energy Information Administration).
// Serie RWTC: WTI en Cushing, Oklahoma, FOB, USD por barril.
// Serie RBRTE: Brent (Europa), FOB, USD por barril.
// Se publican con 1 a 2 días hábiles de rezago. Verificado el 22/10/2026.
// Sin clave propia se usa DEMO_KEY (límite bajo de consultas por hora y por día).

export const SERIES_EIA = {
  RWTC: { nombre: 'WTI – Cushing, Oklahoma (spot FOB)', unidad: 'USD por barril' },
  RBRTE: { nombre: 'Brent – Europa (spot FOB)', unidad: 'USD por barril' },
};

export async function obtenerEIA() {
  const clave = process.env.EIA_API_KEY || 'DEMO_KEY';
  const desde = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const params = new URLSearchParams({ frequency: 'daily', 'data[0]': 'value', start: desde, 'sort[0][column]': 'period', 'sort[0][direction]': 'desc', length: '1000', api_key: clave });
  params.append('facets[series][]', 'RWTC');
  params.append('facets[series][]', 'RBRTE');
  const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?${params}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`EIA respondió ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`EIA: ${j.error}`);
  const filas = j?.response?.data;
  if (!Array.isArray(filas) || !filas.length) throw new Error('EIA no devolvió datos');

  const series = {};
  for (const id of Object.keys(SERIES_EIA)) {
    const puntos = filas.filter((f) => f.series === id && f.value != null)
      .map((f) => [f.period, Number(f.value)])
      .filter(([, v]) => Number.isFinite(v))
      .sort((a, b) => a[0].localeCompare(b[0]));
    series[id] = { ...SERIES_EIA[id], puntos };
  }
  return { usaClaveDemo: !process.env.EIA_API_KEY, series };
}
