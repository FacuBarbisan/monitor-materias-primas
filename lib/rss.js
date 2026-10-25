// Lector mínimo de RSS 2.0, RDF (RSS 1.0) y Atom, sin dependencias externas.
import { decodificar, textoPlano, parsearFecha } from './util.js';

function etiqueta(bloque, nombres) {
  for (const n of nombres) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i');
    const m = bloque.match(re);
    if (m) return m[1];
  }
  return '';
}

function enlaceAtom(bloque) {
  const links = [...bloque.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  const alt = links.find((a) => /rel=["']alternate["']/i.test(a)) || links.find((a) => !/rel=/i.test(a)) || links[0];
  const href = alt && alt.match(/href=["']([^"']+)["']/i);
  return href ? decodificar(href[1]) : '';
}

// Imagen que la propia fuente incluye en su RSS (media:thumbnail, media:content, enclosure o <img> del extracto).
// Solo se aceptan direcciones https. Se elige la más ancha cuando hay varias.
export function imagenDe(bloque, descHTML = '') {
  const candidatas = [];
  for (const m of bloque.matchAll(/<(media:thumbnail|media:content|enclosure)\b([^>]*)>/gi)) {
    const attrs = m[2];
    const url = (attrs.match(/\burl=["']([^"']+)["']/i) || [])[1];
    if (!url) continue;
    const tipo = (attrs.match(/\btype=["']([^"']+)["']/i) || [])[1] || '';
    const medio = (attrs.match(/\bmedium=["']([^"']+)["']/i) || [])[1] || '';
    if (m[1].toLowerCase() !== 'media:thumbnail' && tipo && !/^image\//i.test(tipo) && medio !== 'image') continue;
    if (!tipo && !medio && m[1].toLowerCase() === 'enclosure' && !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) continue;
    const ancho = Number((attrs.match(/\bwidth=["'](\d+)["']/i) || [])[1] || 0);
    candidatas.push({ url: decodificar(url), ancho });
  }
  for (const img of decodificar(descHTML).matchAll(/<img\b[^>]*\b(?:src|data-src)=["']([^"']+)["']/gi)) {
    candidatas.push({ url: decodificar(img[1]), ancho: 0 });
  }
  const valida = candidatas.filter((c) => /^https:\/\//i.test(c.url)).sort((a, b) => b.ancho - a.ancho)[0];
  return valida ? valida.url : null;
}

export function parsearFeed(xml) {
  if (typeof xml !== 'string' || !/<(rss|feed|rdf:RDF)\b/i.test(xml)) {
    throw new Error('La respuesta no es un feed RSS/Atom válido');
  }
  const esAtom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml);
  const bloques = [...xml.matchAll(esAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);

  return bloques.map((b) => {
    const titulo = textoPlano(etiqueta(b, ['title']));
    let link = esAtom ? enlaceAtom(b) : textoPlano(etiqueta(b, ['link']));
    if (!link) link = textoPlano(etiqueta(b, ['guid']));
    const fecha = parsearFecha(textoPlano(etiqueta(b, ['pubDate', 'dc:date', 'published', 'updated'])));
    const descHTML = etiqueta(b, ['description', 'summary', 'content:encoded', 'content']);
    const descripcion = textoPlano(descHTML);
    return { titulo, link: link.trim(), fecha, descripcion, imagenCredito: textoPlano(etiqueta(b, ['media:credit', 'media:copyright'])), imagen: imagenDe(b, ['description', 'summary', 'content:encoded', 'content'].map((n) => etiqueta(b, [n])).join(' ')) };
  }).filter((i) => i.titulo && /^https?:\/\//.test(i.link));
}
