import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const sinAcentos = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decodificar(s = '') {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
}

export function textoPlano(html = '') {
  // Se decodifica dos veces porque algunos feeds escapan el HTML dentro del texto.
  let t = decodificar(html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  t = decodificar(t);
  return t.replace(/\s+/g, ' ').trim();
}

export function recortar(s, max) {
  if (!s || s.length <= max) return s || '';
  const corte = s.slice(0, max);
  const ultimo = corte.lastIndexOf(' ');
  return (ultimo > max * 0.6 ? corte.slice(0, ultimo) : corte) + '…';
}

export const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

export async function leerJSON(ruta, porDefecto) {
  try { return JSON.parse(await readFile(ruta, 'utf8')); } catch { return porDefecto; }
}

// Escritura atómica: si el proceso se corta a mitad, el archivo anterior queda intacto.
export async function escribirJSON(ruta, datos) {
  await mkdir(dirname(ruta), { recursive: true });
  const tmp = ruta + '.tmp';
  await writeFile(tmp, JSON.stringify(datos, null, 1));
  await rename(tmp, ruta);
}

// Fechas de RSS: algunos feeds (p. ej. EIA) usan dobles espacios o zonas como "EST".
const ZONAS = { EST: '-0500', EDT: '-0400', CST: '-0600', CDT: '-0500', MST: '-0700', MDT: '-0600', PST: '-0800', PDT: '-0700', GMT: '+0000', UT: '+0000', UTC: '+0000', CET: '+0100', CEST: '+0200', BST: '+0100' };
export function parsearFecha(s) {
  if (!s) return null;
  let t = s.replace(/\s+/g, ' ').trim();
  let d = new Date(t);
  if (isNaN(d)) {
    t = t.replace(/\b([A-Z]{2,4})$/, (m) => ZONAS[m] ?? m);
    d = new Date(t);
  }
  return isNaN(d) ? null : d.toISOString();
}
