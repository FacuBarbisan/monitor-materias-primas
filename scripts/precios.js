// Descarga los precios de referencia del catálogo (FRED, EIA, Banco Mundial) desde el actualizador.
// Escribe public/data/catalogo.json (tabla liviana) y public/data/series/*.json (historia, se carga al abrir una ficha).
import { join } from 'node:path';
import { COMMODITIES, CATEGORIAS } from '../config/commodities.js';
import { obtenerFRED } from '../lib/fred.js';
import { obtenerEIA } from '../lib/eia.js';
import { obtenerPinkSheet } from '../lib/worldbank.js';
import { leerJSON, escribirJSON } from '../lib/util.js';

const CADA_MIN = Number(process.env.PRECIOS_CADA_MIN || 360);
const ahora = () => new Date().toISOString();
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const claveSerie = (s) => `${s.proveedor}-${s.id.replace(/[^A-Za-z0-9]+/g, '_')}`;

export const PROVEEDORES = {
  fred: { nombre: 'FRED (Fed de St. Louis)', url: 'https://fred.stlouisfed.org/', licencia: 'Datos públicos; las series P…USDM provienen del FMI (Primary Commodity Prices).' },
  eia: { nombre: 'EIA (Administración de Información Energética de EE. UU.)', url: 'https://www.eia.gov/opendata/', licencia: 'Datos públicos del gobierno de EE. UU.' },
  wb: { nombre: 'Banco Mundial – Pink Sheet', url: 'https://www.worldbank.org/en/research/commodity-markets', licencia: 'CC BY 4.0. Fuente: World Bank Commodity Price Data (The Pink Sheet).' },
};
const urlFuente = (s) => (s.proveedor === 'fred' ? `https://fred.stlouisfed.org/series/${s.id}`
  : s.proveedor === 'eia' ? 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm' : PROVEEDORES.wb.url);

function recortarHistoria(puntos, frecuencia) {
  const desde = new Date();
  desde.setFullYear(desde.getFullYear() - (frecuencia === 'diaria' ? 5 : 30));
  const lim = desde.toISOString().slice(0, 10);
  return puntos.filter(([f]) => f >= lim);
}

export async function actualizarPrecios({ raiz, forzar = false }) {
  const DATOS = join(raiz, 'public', 'data');
  const previo = await leerJSON(join(DATOS, 'catalogo.json'), null);
  const estadoPrevio = Object.fromEntries((previo?.items || []).flatMap((c) => c.series.map((s) => [claveSerie(s), s])));
  const proveedores = { ...(previo?.proveedores || {}) };
  for (const [k, v] of Object.entries(PROVEEDORES)) proveedores[k] = { ...v, ...(proveedores[k] || {}), nombre: v.nombre, url: v.url, licencia: v.licencia };

  // Se consulta cada CADA_MIN minutos; si en la corrida anterior falló algún proveedor, se reintenta en la siguiente.
  const huboFallas = Object.values(previo?.proveedores || {}).some((p) => p.ultimoError);
  const toca = forzar || huboFallas || !previo?.ultimoCiclo || Date.now() - Date.parse(previo.ultimoCiclo) >= CADA_MIN * 60_000 - 60_000;
  const resultados = {}; // claveSerie -> { puntos } | { error }

  if (toca) {
    // EIA (WTI y Brent en una sola consulta)
    proveedores.eia.ultimoIntento = ahora();
    try {
      const e = await obtenerEIA();
      for (const [id, s] of Object.entries(e.series)) resultados[`eia-${id}`] = { puntos: s.puntos };
      Object.assign(proveedores.eia, { ultimoExito: ahora(), ultimoError: null, usaClaveDemo: e.usaClaveDemo });
    } catch (err) {
      proveedores.eia.ultimoError = String(err.message || err);
      for (const id of ['RWTC', 'RBRTE']) resultados[`eia-${id}`] = { error: proveedores.eia.ultimoError };
    }

    // Banco Mundial (un solo Excel con todas las columnas)
    const columnasWB = COMMODITIES.flatMap((c) => c.series.filter((s) => s.proveedor === 'wb').map((s) => s.id));
    proveedores.wb.ultimoIntento = ahora();
    try {
      const { url, columnas } = await obtenerPinkSheet(columnasWB);
      for (const col of columnasWB) resultados[`wb-${col.replace(/[^A-Za-z0-9]+/g, '_')}`] = columnas[col];
      Object.assign(proveedores.wb, { ultimoExito: ahora(), ultimoError: null, archivo: url });
    } catch (err) {
      proveedores.wb.ultimoError = String(err.message || err);
      for (const col of columnasWB) resultados[`wb-${col.replace(/[^A-Za-z0-9]+/g, '_')}`] = { error: proveedores.wb.ultimoError };
    }

    // FRED (una consulta por serie, con pausa corta para no saturar)
    proveedores.fred.ultimoIntento = ahora();
    let okFred = 0, errFred = 0, ultimoErr = null;
    for (const c of COMMODITIES) for (const s of c.series.filter((x) => x.proveedor === 'fred')) {
      const desde = new Date(); desde.setFullYear(desde.getFullYear() - (s.frecuencia === 'diaria' ? 5 : 30));
      try {
        resultados[claveSerie(s)] = { puntos: await obtenerFRED(s.id, { desde: desde.toISOString().slice(0, 10) }) };
        okFred++;
      } catch (err) {
        resultados[claveSerie(s)] = { error: String(err.message || err) }; errFred++; ultimoErr = String(err.message || err);
      }
      await esperar(400);
    }
    Object.assign(proveedores.fred, okFred ? { ultimoExito: ahora() } : {}, { ultimoError: errFred ? `${errFred} serie(s) con error. Último: ${ultimoErr}` : null, seriesOk: okFred, seriesError: errFred });
  }

  const items = [];
  for (const c of COMMODITIES) {
    const series = [];
    for (const s of c.series) {
      const k = claveSerie(s);
      const prev = estadoPrevio[k] || {};
      const r = resultados[k];
      const est = { ...(prev.estado || {}) };
      let resumen = { ultimo: prev.ultimo || null, anterior: prev.anterior || null, n: prev.n || 0, unidadFuente: prev.unidadFuente || null };
      if (r) {
        est.ultimoIntento = ahora();
        const puntos = r.puntos ? recortarHistoria(r.puntos, s.frecuencia) : null;
        if (puntos && puntos.length) {
          await escribirJSON(join(DATOS, 'series', `${k}.json`), { clave: k, proveedor: s.proveedor, id: s.id, nombre: s.nombre, unidad: s.unidad, frecuencia: s.frecuencia, fuenteUrl: urlFuente(s), obtenido: ahora(), puntos });
          resumen = { ultimo: puntos.at(-1), anterior: puntos.at(-2) || null, n: puntos.length, unidadFuente: r.unidad || null };
          Object.assign(est, { ultimoExito: ahora(), ultimoError: null, verificada: true });
        } else {
          est.ultimoError = r.error || 'La fuente no devolvió datos para esta serie';
        }
      }
      series.push({ ...s, clave: k, fuenteUrl: urlFuente(s), ...resumen, estado: est });
    }
    items.push({ id: c.id, nombre: c.nombre, categoria: c.categoria, moneda: c.moneda, unidad: c.unidad, widget: c.widget || null, sinSerieMotivo: c.sinSerieMotivo || null, series });
  }

  const salida = { generado: ahora(), ultimoCiclo: toca ? ahora() : previo?.ultimoCiclo || null, cadaMin: CADA_MIN, categorias: CATEGORIAS, proveedores, items };
  await escribirJSON(join(DATOS, 'catalogo.json'), salida);
  const conDatos = items.filter((i) => i.series.some((s) => s.ultimo)).length;
  console.log(`Precios: ${toca ? 'consultados' : 'sin consultar (aún no toca)'}; ${conDatos}/${items.length} materias primas con precio de referencia.`);
  return salida;
}
