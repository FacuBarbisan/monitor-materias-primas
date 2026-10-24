// Agrupa coberturas del mismo acontecimiento comparando las palabras de los títulos.
// Funciona mejor cuando todos los títulos están en el mismo idioma (con traducción activa).
import { sinAcentos } from './util.js';

const VACIAS = new Set(('the a an of to in on for and or but with from by at as is are was were be been has have had will would says said say after over amid into its it this that than more new why how what who '
  + 'el la los las un una unos unas de del al a en y o pero con por para sin sobre tras entre que se su sus es son fue han ha lo como mas mientras ante hasta desde segun este esta estos estas porque cuando donde').split(/\s+/));

export function fichas(texto) {
  return new Set(sinAcentos(texto).replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length >= 3 && !VACIAS.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(es|s)$/, '') : w))); // plural simple
}

export function similitud(a, b) {
  let comunes = 0;
  for (const x of a) if (b.has(x)) comunes++;
  if (comunes < 3) return 0;
  const jaccard = comunes / (a.size + b.size - comunes);
  const solapamiento = comunes / Math.min(a.size, b.size);
  return Math.max(jaccard, solapamiento * 0.8);
}

const VENTANA_MS = 72 * 3600 * 1000;
const UMBRAL = 0.5;

export function agrupar(items) {
  const ordenados = [...items].sort((x, y) => (x.fecha || '').localeCompare(y.fecha || ''));
  const grupos = [];
  for (const it of ordenados) {
    const f = fichas(it.tituloEs || it.titulo);
    const t = Date.parse(it.fecha || 0) || 0;
    let mejor = null, mejorSim = 0;
    for (const g of grupos) {
      if (Math.abs(t - g.ultimo) > VENTANA_MS) continue;
      for (const m of g.fichas) {
        const s = similitud(f, m);
        if (s > mejorSim) { mejorSim = s; mejor = g; }
      }
    }
    if (mejor && mejorSim >= UMBRAL) {
      mejor.fichas.push(f); mejor.ultimo = Math.max(mejor.ultimo, t); it.grupo = mejor.id;
    } else {
      const g = { id: 'g' + it.id, fichas: [f], ultimo: t };
      grupos.push(g); it.grupo = g.id;
    }
  }
  return items;
}
