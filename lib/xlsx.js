// Lector mínimo de .xlsx (sin dependencias): descomprime el ZIP y lee las celdas de una hoja.
import { inflateRawSync } from 'node:zlib';
import { decodificar } from './util.js';

export function descomprimirZip(buf) {
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('El archivo no es un ZIP/XLSX válido');
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const archivos = {};
  for (let k = 0; k < total; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio ZIP dañado');
    const metodo = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + ln);
    const dat = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    archivos[nombre] = () => { const raw = buf.subarray(dat, dat + comp); return (metodo === 8 ? inflateRawSync(raw) : raw).toString('utf8'); };
    p += 46 + ln + le + lc;
  }
  return archivos;
}

const textoNodo = (xml) => decodificar([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
const columnaANumero = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// Devuelve las filas de la hoja como arreglos (índice 0 = columna A).
export function leerHoja(buf, nombreHoja) {
  const z = descomprimirZip(buf);
  const wb = z['xl/workbook.xml']?.();
  const rels = z['xl/_rels/workbook.xml.rels']?.();
  if (!wb || !rels) throw new Error('XLSX sin libro de trabajo');
  const hojas = [...wb.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ nombre: decodificar(m[1]), rid: m[2] }));
  const hoja = hojas.find((h) => h.nombre.trim().toLowerCase() === nombreHoja.toLowerCase());
  if (!hoja) throw new Error(`No se encontró la hoja "${nombreHoja}" (hay: ${hojas.map((h) => h.nombre).join(', ')})`);
  const destino = (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${hoja.rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${hoja.rid}"`)) || [])[1];
  const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`;
  const compartidas = z['xl/sharedStrings.xml'] ? [...z['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoNodo(m[1])) : [];
  const xml = z[ruta]?.();
  if (!xml) throw new Error('No se pudo leer la hoja');
  const filas = [];
  for (const f of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila = [];
    for (const c of f[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], cuerpo = c[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      if (!ref) continue;
      const t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      const v = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let valor = null;
      if (t === 's') valor = compartidas[Number(v)] ?? null;
      else if (t === 'inlineStr') valor = textoNodo(cuerpo);
      else if (t === 'str') valor = v != null ? decodificar(v) : null;
      else if (v != null) valor = Number(v);
      fila[columnaANumero(ref)] = valor;
    }
    filas[Number(f[1]) - 1] = fila;
  }
  return filas;
}
