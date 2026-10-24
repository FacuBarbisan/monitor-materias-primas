// Actualización de datos: descarga feeds, etiqueta, agrupa y guarda JSON para la web.
// Uso: node scripts/update.js            (respeta la frecuencia de cada fuente)
//      node scripts/update.js --forzar   (consulta todas las fuentes ahora)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SOURCES, PENDING } from '../config/sources.js';
import { PAISES, REGIONES, MATERIAS, TEMAS } from '../config/taxonomy.js';
import { parsearFeed } from '../lib/rss.js';
import { clasificar } from '../lib/classify.js';
import { agrupar } from '../lib/cluster.js';
import { iaConfigurada, traducirLote } from '../lib/ai.js';
import { obtenerEIA } from '../lib/eia.js';
import { hash, recortar, leerJSON, escribirJSON } from '../lib/util.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = join(RAIZ, 'public', 'data');
const ESTADO_INTERNO = join(RAIZ, 'state', 'interno.json'); // ETags y caché (no se publica)
const TRADUCCIONES = join(RAIZ, 'state', 'traducciones.json');

const DIAS_RETENCION = Number(process.env.DIAS_RETENCION || 10);
const MAX_ITEMS = 2000;
const EIA_CADA_MIN = 360;
const UA = 'MonitorMateriasPrimas/1.0 (proyecto educativo personal; lector RSS)';
// Solo para pruebas: lee los feeds desde una carpeta local en vez de internet.
const FUENTES_LOCALES = process.env.FUENTES_LOCALES || '';

const ahora = () => new Date().toISOString();
function mensajeError(e) {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'Tiempo de espera agotado';
  const codigo = e?.cause?.code || e?.code;
  const base = e?.message === 'fetch failed' ? 'No se pudo conectar' : String(e?.message || e);
  return codigo ? `${base} (${codigo})` : base;
}
const vencida = (ultimo, min) => !ultimo || Date.now() - Date.parse(ultimo) >= min * 60_000 - 60_000;

function normalizarLink(link) {
  try {
    const u = new URL(link);
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|at_|traffic_source|ref$|cmp)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch { return link; }
}

async function descargar(fuente, cache) {
  if (FUENTES_LOCALES) {
    return { status: 200, texto: await readFile(join(FUENTES_LOCALES, `${fuente.id}.xml`), 'utf8') };
  }
  const headers = { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5' };
  if (cache?.etag) headers['if-none-match'] = cache.etag;
  if (cache?.modificado) headers['if-modified-since'] = cache.modificado;
  let ultimoError;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const r = await fetch(fuente.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      if (r.status === 304) return { status: 304 };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { status: r.status, texto: await r.text(), etag: r.headers.get('etag'), modificado: r.headers.get('last-modified') };
    } catch (e) {
      ultimoError = e;
      if (intento === 1) await new Promise((res) => setTimeout(res, 3000));
    }
  }
  throw ultimoError;
}

async function enParalelo(lista, n, fn) {
  const cola = [...lista];
  await Promise.all(Array.from({ length: n }, async () => { while (cola.length) await fn(cola.shift()); }));
}

export async function actualizar({ forzar = false } = {}) {
  const interno = await leerJSON(ESTADO_INTERNO, { fuentes: {}, eia: {} });
  const previo = await leerJSON(join(DATOS, 'noticias.json'), { items: [] });
  const estadoPrevio = await leerJSON(join(DATOS, 'estado.json'), { fuentes: [] });
  const traducciones = await leerJSON(TRADUCCIONES, {});
  const mapa = new Map(previo.items.map((i) => [i.id, i]));
  const estadoFuentes = Object.fromEntries((estadoPrevio.fuentes || []).map((f) => [f.id, f]));

  await enParalelo(SOURCES, 4, async (fuente) => {
    const est = estadoFuentes[fuente.id] || {};
    const cache = interno.fuentes[fuente.id] || {};
    if (!forzar && !FUENTES_LOCALES && !vencida(est.ultimoIntento, fuente.cadaMin)) return;
    est.ultimoIntento = ahora();
    try {
      const res = await descargar(fuente, cache);
      if (res.status !== 304) {
        const crudos = parsearFeed(res.texto);
        let relevantes = 0;
        for (const c of crudos) {
          const link = normalizarLink(c.link);
          const id = hash(link);
          if (mapa.has(id)) { relevantes++; continue; }
          const extracto = recortar(c.descripcion && c.descripcion !== c.titulo ? c.descripcion : '', 320);
          const etiquetas = clasificar({ titulo: c.titulo, descripcion: extracto }, fuente);
          if (fuente.filtrar && !etiquetas.relevante) continue;
          relevantes++;
          mapa.set(id, {
            id, fuente: fuente.id, fuenteNombre: fuente.nombre, tipoFuente: fuente.tipo, idioma: fuente.idioma,
            titulo: c.titulo, link: c.link, fecha: c.fecha, obtenido: ahora(), fechaEstimada: !c.fecha,
            extracto, ...etiquetas, ...(FUENTES_LOCALES ? { prueba: true } : {}),
          });
        }
        est.itemsEnFeed = crudos.length;
        est.itemsRelevantes = relevantes;
        interno.fuentes[fuente.id] = { etag: res.etag || null, modificado: res.modificado || null };
      }
      est.ultimoExito = ahora();
      est.ultimoError = null;
      est.fallosSeguidos = 0;
      est.http = res.status;
    } catch (e) {
      est.ultimoError = mensajeError(e);
      est.fallosSeguidos = (est.fallosSeguidos || 0) + 1;
      console.error(`[${fuente.id}] ${est.ultimoError}`);
    }
    estadoFuentes[fuente.id] = est;
  });

  // Retención: se descartan noticias viejas.
  const limite = Date.now() - DIAS_RETENCION * 864e5;
  let items = [...mapa.values()]
    .map((i) => ({ ...i, fecha: i.fecha || i.obtenido }))
    .filter((i) => Date.parse(i.fecha) >= limite && Date.parse(i.fecha) <= Date.now() + 36e5)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, MAX_ITEMS);

  // Traducción con IA (opcional).
  const ia = { configurada: iaConfigurada(), modelo: process.env.AI_MODEL || 'claude-haiku-4-5', ultimoError: null, traducidasEstaVez: 0 };
  for (const i of items) {
    const t = traducciones[i.id];
    if (t) { i.tituloEs = t.titulo_es; i.resumenEs = t.resumen_es || ''; i.ia = { modelo: t.modelo }; }
  }
  if (ia.configurada && !FUENTES_LOCALES) {
    const pendientes = items.filter((i) => i.idioma !== 'es' && !traducciones[i.id]).slice(0, Number(process.env.AI_MAX_POR_CORRIDA || 120));
    for (let k = 0; k < pendientes.length; k += 20) {
      const lote = pendientes.slice(k, k + 20);
      try {
        const { modelo, resultados } = await traducirLote(lote);
        for (const r of resultados) {
          if (!r?.id || !r.titulo_es) continue;
          traducciones[r.id] = { titulo_es: r.titulo_es, resumen_es: r.resumen_es || '', modelo, fecha: ahora() };
          const it = items.find((x) => x.id === r.id);
          if (it) { it.tituloEs = r.titulo_es; it.resumenEs = r.resumen_es || ''; it.ia = { modelo }; ia.traducidasEstaVez++; }
        }
      } catch (e) {
        ia.ultimoError = String(e.message || e);
        console.error('[IA]', ia.ultimoError);
        break;
      }
    }
    for (const id of Object.keys(traducciones)) if (!mapa.has(id)) delete traducciones[id];
  }

  agrupar(items);

  // Precios oficiales EIA.
  const eiaPrevio = await leerJSON(join(DATOS, 'eia.json'), null);
  const eiaEstado = { ...(estadoPrevio.eia || {}) };
  if (!FUENTES_LOCALES && (forzar || vencida(eiaEstado.ultimoIntento, EIA_CADA_MIN))) {
    eiaEstado.ultimoIntento = ahora();
    try {
      const eia = await obtenerEIA();
      await escribirJSON(join(DATOS, 'eia.json'), { obtenido: ahora(), ...eia });
      Object.assign(eiaEstado, { ultimoExito: ahora(), ultimoError: null, fallosSeguidos: 0, usaClaveDemo: eia.usaClaveDemo });
    } catch (e) {
      Object.assign(eiaEstado, { ultimoError: mensajeError(e), fallosSeguidos: (eiaEstado.fallosSeguidos || 0) + 1 });
      console.error('[EIA]', eiaEstado.ultimoError);
      if (!eiaPrevio) await escribirJSON(join(DATOS, 'eia.json'), null);
    }
  }

  const generado = ahora();
  const hayPrueba = Boolean(FUENTES_LOCALES) || items.some((i) => i.prueba);
  const catalogo = {
    regiones: REGIONES,
    paises: PAISES.map(([id, nombre, region]) => ({ id, nombre, region })),
    materias: MATERIAS.map(([id, nombre]) => ({ id, nombre })),
    temas: TEMAS.map(([id, nombre]) => ({ id, nombre })),
    fuentes: SOURCES.map((f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo })),
  };
  await escribirJSON(join(DATOS, 'noticias.json'), { generado, diasRetencion: DIAS_RETENCION, modoPrueba: hayPrueba, catalogo, items });
  await escribirJSON(join(DATOS, 'estado.json'), {
    generado,
    modoPrueba: hayPrueba,
    fuentes: SOURCES.map((f) => ({
      id: f.id, nombre: f.nombre, tipo: f.tipo, idioma: f.idioma, region: f.region, url: f.url, cadaMin: f.cadaMin,
      filtraRelevancia: f.filtrar, ...(estadoFuentes[f.id] || {}),
    })),
    eia: { nombre: 'EIA – API v2 (precios spot diarios WTI y Brent)', url: 'https://www.eia.gov/opendata/', cadaMin: EIA_CADA_MIN, ...eiaEstado },
    ia,
    pendientes: PENDING,
  });
  await escribirJSON(ESTADO_INTERNO, interno);
  await escribirJSON(TRADUCCIONES, traducciones);
  const ok = Object.values(estadoFuentes).filter((f) => !f.ultimoError).length;
  console.log(`Listo: ${items.length} noticias guardadas. Fuentes sin error: ${ok}/${SOURCES.length}.`);
  return { items: items.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  actualizar({ forzar: process.argv.includes('--forzar') }).catch((e) => { console.error(e); process.exit(1); });
}
