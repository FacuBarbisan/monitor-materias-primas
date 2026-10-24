import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearFeed } from '../lib/rss.js';
import { parsearFecha, textoPlano } from '../lib/util.js';
import { clasificar } from '../lib/classify.js';
import { agrupar, fichas, similitud } from '../lib/cluster.js';

test('fechas con doble espacio y zona EST (formato real de la EIA)', () => {
  assert.equal(parsearFecha('Mon, 19 Oct 2026  09:00:00 EST'), '2026-10-19T14:00:00.000Z');
  assert.equal(parsearFecha('Wed, 21 Oct 2026 06:15:00 +0200'), '2026-10-21T04:15:00.000Z');
  assert.equal(parsearFecha('cualquier cosa'), null);
});

test('entidades y HTML en extractos', () => {
  assert.equal(textoPlano('ASEAN&#039;s <b>approach</b> &amp; more'), "ASEAN's approach & more");
  assert.equal(textoPlano('<p><img src="x.jpg"/></p>'), '');
});

test('RSS 2.0 y Atom', () => {
  const rss = '<rss><channel><item><title><![CDATA[Oil & gas]]></title><link>https://a.com/1</link><pubDate>Thu, 22 Oct 2026 09:37:58 GMT</pubDate><description>Hola</description></item></channel></rss>';
  const r = parsearFeed(rss);
  assert.equal(r.length, 1); assert.equal(r[0].titulo, 'Oil & gas'); assert.equal(r[0].fecha, '2026-10-22T09:37:58.000Z');
  const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>T</title><link rel="alternate" href="https://b.com/2"/><updated>2026-10-21T04:15:00Z</updated></entry></feed>';
  assert.equal(parsearFeed(atom)[0].link, 'https://b.com/2');
  assert.throws(() => parsearFeed('<html>error</html>'));
});

test('clasificación de países, materias y temas', () => {
  const c = clasificar({ titulo: 'El petróleo sube su precio mientras Trump apunta a India para refinar crudo venezolano', descripcion: 'El barril del crudo Brent rozó los 112 dólares' });
  assert.ok(c.materias.includes('petroleo'));
  assert.ok(c.paises.includes('in') && c.paises.includes('ve') && c.paises.includes('us'));
  assert.ok(c.relevante);
  const p = clasificar({ titulo: 'Inundaciones en el Río de la Plata', descripcion: '' });
  assert.ok(!p.materias.includes('plata'), 'Río de la Plata no es el metal');
  const plata = clasificar({ titulo: 'El precio de la plata sube', descripcion: '' });
  assert.ok(plata.materias.includes('plata'));
  const nada = clasificar({ titulo: 'Meta fined $25bn for lies over user data privacy', descripcion: '' });
  assert.equal(nada.relevante, false);
  const us = clasificar({ titulo: 'US-China ties need more dialogue', descripcion: '' });
  assert.ok(us.paises.includes('us') && us.paises.includes('cn'));
});

test('canales de impacto: varios canales advierten efectos opuestos', () => {
  const c = clasificar({ titulo: 'New sanctions on Russian oil exports amid war', descripcion: '' });
  const canales = c.impacto.canales.map((x) => x.canal);
  assert.ok(canales.includes('riesgo') && canales.includes('oferta'));
  assert.match(c.impacto.nota, /incierto/);
});

test('agrupación de coberturas del mismo hecho', () => {
  const items = [
    { id: 'a', titulo: 'Francia: el costo de endeudamiento alcanza máximo de 24 años por disturbios', fecha: '2026-10-22T08:00:00Z' },
    { id: 'b', titulo: 'Disturbios en Francia llevan el costo de endeudamiento a máximo de 24 años', fecha: '2026-10-22T10:00:00Z' },
    { id: 'c', titulo: 'China expande su plantilla de recaudadores de impuestos', fecha: '2026-10-22T09:00:00Z' },
  ];
  agrupar(items);
  assert.equal(items[0].grupo, items[1].grupo);
  assert.notEqual(items[0].grupo, items[2].grupo);
  assert.equal(similitud(fichas('Oro sube'), fichas('Petróleo baja')), 0);
});
