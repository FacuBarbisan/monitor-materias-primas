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
    const descripcion = textoPlano(etiqueta(b, ['description', 'summary', 'content:encoded', 'content']));
    return { titulo, link: link.trim(), fecha, descripcion };
  }).filter((i) => i.titulo && /^https?:\/\//.test(i.link));
}
