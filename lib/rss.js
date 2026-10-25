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
export function imagenesDe(bloque, descHTML = '') {
  const candidatas = [];
  const atributo = (attrs, n) => (attrs.match(new RegExp('(?:^|\\s)' + n + '\\s*=\\s*["\']([^"\']+)["\']', 'i')) || [])[1] || '';
  const agregar = (url, ancho = 0) => {
    url = decodificar(url);
    if (/^https:\/\//i.test(url)) candidatas.push({ url, ancho });
  };
  for (const m of bloque.matchAll(/<(media:thumbnail|media:content|enclosure|link)\b([^>]*)>/gi)) {
    const attrs = m[2], tag = m[1].toLowerCase();
    const tipo = atributo(attrs, 'type'), medio = atributo(attrs, 'medium');
    if (tag === 'link' && (atributo(attrs, 'rel') !== 'enclosure' || !/^image\//i.test(tipo))) continue;
    if (tag !== 'media:thumbnail' && tipo && !/^image\//i.test(tipo) && medio !== 'image') continue;
    const url = atributo(attrs, tag === 'link' ? 'href' : 'url');
    if (!tipo && !medio && tag === 'enclosure' && !/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) continue;
    agregar(url, Number(atributo(attrs, 'width')) || 0);
  }
  for (const m of decodificar(descHTML).matchAll(/<(img|source)\b([^>]*)>/gi)) {
    const attrs = m[2], ancho = Number(atributo(attrs, 'width')) || 0, alto = Number(atributo(attrs, 'height')) || 0;
    if ((ancho && ancho <= 2) || (alto && alto <= 2)) continue;
    const srcset = atributo(attrs, 'srcset') || atributo(attrs, 'data-srcset');
    for (const parte of srcset.split(',')) {
      const [url, medida = ''] = parte.trim().split(/\s+/);
      if (url) agregar(url, /w$/.test(medida) ? parseInt(medida) || 0 : ancho);
    }
    for (const attr of ['data-src', 'data-lazy-src', 'src']) agregar(atributo(attrs, attr), ancho);
  }
  return [...new Set(candidatas.sort((a, b) => b.ancho - a.ancho).map((c) => c.url))].slice(0, 5);
}

export function imagenDe(bloque, descHTML = '') {
  return imagenesDe(bloque, descHTML)[0] || null;
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
    const imagenes = imagenesDe(b, ['description', 'summary', 'content:encoded', 'content'].map((n) => etiqueta(b, [n])).join(' '));
    return { titulo, link: link.trim(), fecha, descripcion, imagenes, imagenCredito: textoPlano(etiqueta(b, ['media:credit', 'media:copyright'])), imagen: imagenes[0] || null };
  }).filter((i) => i.titulo && /^https?:\/\//.test(i.link));
}
