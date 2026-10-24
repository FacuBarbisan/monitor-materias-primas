// Genera archivos XML de prueba (RSS y uno Atom) a partir de test/fixtures/capturados.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const dir = new URL('./fixtures/xml/', import.meta.url);
await mkdir(dir, { recursive: true });
const datos = JSON.parse(await readFile(new URL('./fixtures/capturados.json', import.meta.url), 'utf8'));
const x = (s) => s.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
for (const [id, items] of Object.entries(datos)) {
  if (id.startsWith('_')) continue;
  let xml;
  if (id === 'ecb') {
    xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Prueba Atom</title>${items.map(([t, l, d, s]) => `<entry><title type="html"><![CDATA[${t}]]></title><link rel="alternate" href="${x(l)}"/><updated>${new Date(d).toISOString()}</updated><summary>${x(s)}</summary></entry>`).join('')}</feed>`;
  } else {
    xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Prueba</title>${items.map(([t, l, d, s]) => `<item><title><![CDATA[${t}]]></title><link>${x(l)}</link><pubDate>${d}</pubDate><description><![CDATA[${s}]]></description></item>`).join('')}</channel></rss>`;
  }
  await writeFile(new URL(`${id}.xml`, dir), xml);
}
console.log('Fixtures XML generados en test/fixtures/xml/ (f24_latam se omite a propósito para probar errores).');
