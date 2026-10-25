// Etiquetado por reglas (palabras clave). Es una interpretación automática:
// puede equivocarse y se muestra siempre como tal en la interfaz.
import { PAISES, REGION_KEYWORDS, MATERIAS, TEMAS, CANALES, CLAVES_CATEGORIA } from '../config/taxonomy.js';
import { sinAcentos } from './util.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "Palabra completa": letras/dígitos no pueden pegarse antes ni después.
const patron = (kws) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${kws.map((k) => esc(sinAcentos(k))).join('|')})(?![\\p{L}\\p{N}])`, 'u');

const P_PAISES = PAISES.map(([id, nombre, region, kws]) => ({ id, nombre, region, re: patron(kws) }));
const P_REGIONES = Object.entries(REGION_KEYWORDS).map(([id, kws]) => ({ id, re: patron(kws) }));
const P_MATERIAS = MATERIAS.map(([id, nombre, kws, excl, categoria]) => ({ id, nombre, categoria, re: patron(kws), excl: excl.map(sinAcentos) }));
const CAT_DE = Object.fromEntries(MATERIAS.map(([id, , , , cat]) => [id, cat]));
const P_CATEGORIAS = Object.entries(CLAVES_CATEGORIA).map(([id, kws]) => ({ id, re: patron(kws) }));
const P_TEMAS = TEMAS.map(([id, nombre, kws, canales]) => ({ id, nombre, re: patron(kws), canales }));
const TEMAS_DEBILES = new Set(['actividad', 'comercio', 'politica_fiscal']);

export function clasificar({ titulo, descripcion }, fuente = {}) {
  const texto = sinAcentos(`${titulo} . ${descripcion || ''}`);

  const paises = new Set(fuente.paisesFijos || []);
  for (const p of P_PAISES) if (p.re.test(texto)) paises.add(p.id);
  // Los títulos en inglés usan "US" en mayúsculas para Estados Unidos.
  if (/(?<![A-Za-z])US(?![A-Za-z])/.test(`${titulo} ${descripcion || ''}`)) paises.add('us');

  const regiones = new Set();
  for (const id of paises) {
    const p = P_PAISES.find((x) => x.id === id);
    if (p) regiones.add(p.region);
  }
  for (const r of P_REGIONES) if (r.re.test(texto)) regiones.add(r.id);

  const materias = new Set(fuente.materiasFijas || []);
  const coincidencias = {};
  for (const m of P_MATERIAS) {
    if (!m.re.test(texto)) continue;
    // Si el término solo aparece dentro de una frase excluida ("Río de la Plata"), se descarta.
    let limpio = texto;
    for (const e of m.excl) limpio = limpio.split(e).join(' ');
    const hallado = limpio.match(m.re);
    if (hallado) { materias.add(m.id); coincidencias[m.id] = hallado[0].trim(); }
  }

  const temas = new Set(fuente.temasFijos || []);
  for (const t of P_TEMAS) if (t.re.test(texto)) temas.add(t.id);

  // Categorías: las de cada materia detectada y las mencionadas en forma genérica ("fertilizantes", "granos").
  const categorias = new Set([...materias].map((m) => CAT_DE[m]).filter(Boolean));
  for (const c of P_CATEGORIAS) if (c.re.test(texto)) categorias.add(c.id);

  // Relevancia: basta una materia prima, un tema específico (inflación, sanciones, transporte…)
  // o dos temas genéricos (actividad, comercio, política fiscal).
  const fuertes = [...temas].filter((t) => !TEMAS_DEBILES.has(t)).length;
  const debiles = temas.size - fuertes;

  return {
    paises: [...paises],
    regiones: [...regiones],
    materias: [...materias],
    categorias: [...categorias],
    coincidencias,
    temas: [...temas],
    relevante: materias.size > 0 || categorias.size > 0 || fuertes > 0 || debiles >= 2,
    impacto: canalesDeImpacto([...temas], [...materias]),
  };
}

function grupoMateria(materias) {
  const g = new Set();
  for (const m of materias) {
    const c = CAT_DE[m];
    if (c === 'energia') g.add('energia');
    else if (c === 'preciosos' || c === 'industriales') g.add('metales');
    else if (c) g.add('granos');
  }
  return g.size ? [...g] : ['general'];
}

export function canalesDeImpacto(temas, materias) {
  const canales = [];
  for (const t of P_TEMAS) {
    if (!temas.includes(t.id)) continue;
    for (const c of t.canales) if (!canales.includes(c)) canales.push(c);
  }
  if (!canales.length) return null;
  const grupos = grupoMateria(materias);
  const detalle = canales.map((c) => {
    const def = CANALES[c];
    const textos = [...new Set(grupos.map((g) => def[g] || def.general))];
    return { canal: c, nombre: def.nombre, explicacion: textos.join(' ') };
  });
  const nota = canales.length > 1
    ? 'Hay más de un canal posible y pueden actuar en sentidos opuestos: el efecto neto sobre los precios es incierto.'
    : 'La dirección y la magnitud del efecto son inciertas y dependen de lo que el mercado ya esperaba.';
  return { canales: detalle, nota };
}
