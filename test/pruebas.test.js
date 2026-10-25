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
  assert.ok(c.materias.includes('wti') && c.materias.includes('brent'));
  assert.ok(c.paises.includes('in') && c.paises.includes('ve') && c.paises.includes('us'));
  assert.ok(c.relevante);
  const p = clasificar({ titulo: 'Inundaciones en el Río de la Plata', descripcion: '' });
  assert.ok(!p.materias.includes('plata'), 'Río de la Plata no es el metal');
  const plata = clasificar({ titulo: 'El precio de la plata sube', descripcion: '' });
  assert.ok(plata.materias.includes('plata'));
  assert.deepEqual(clasificar({ titulo: 'Soy la prueba de que es posible', descripcion: '' }).materias, [], '"soy" en español no es soja');
  assert.ok(!clasificar({ titulo: 'Hong Kong gold hub signs refineries deal', descripcion: '' }).materias.includes('wti'), 'refinerías de oro no son petróleo');
  assert.ok(!clasificar({ titulo: 'Tank barrel production returns to UK', descripcion: '' }).materias.includes('brent'));
  assert.deepEqual(clasificar({ titulo: 'Cocoa prices hit record as Ivory Coast harvest shrinks', descripcion: '' }).materias, ['cacao']);
  const fert = clasificar({ titulo: 'EU tariffs on Russian fertilizers take effect', descripcion: '' });
  assert.deepEqual(fert.materias, [], 'la mención genérica no se asigna a cada fertilizante');
  assert.ok(fert.categorias.includes('fertilizantes'));
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

// ---------- v4: precios e imágenes ----------
import { readFileSync } from 'node:fs';
import { leerHoja } from '../lib/xlsx.js';
import { parsearPinkSheet } from '../lib/worldbank.js';
import { parsearCSVFred } from '../lib/fred.js';
import { imagenDe } from '../lib/rss.js';
import { COMMODITIES, CATEGORIAS } from '../config/commodities.js';

test('Excel del Banco Mundial (estructura de la hoja "Monthly Prices", datos sintéticos de prueba)', () => {
  const filas = leerHoja(readFileSync(new URL('./fixtures/pinksheet-prueba.xlsx', import.meta.url)), 'Monthly Prices');
  const r = parsearPinkSheet(filas, ['Urea', 'Gold', 'Potassium chloride', 'Cobalto inexistente']);
  assert.deepEqual(r.Urea.puntos, [['2026-07-01', 400.5], ['2026-08-01', 410]], 'ignora celdas no numéricas');
  assert.equal(r.Gold.unidad, '($/troy oz)');
  assert.equal(r['Potassium chloride'].puntos.length, 3, 'tolera asteriscos en el encabezado');
  assert.ok(r['Cobalto inexistente'].error);
});

test('CSV de FRED (formato nuevo y viejo, valores faltantes)', () => {
  assert.deepEqual(parsearCSVFred('observation_date,PCOPPUSDM\n2026-08-01,9800.5\n2026-09-01,.\n', 'X'), [['2026-08-01', 9800.5]]);
  assert.deepEqual(parsearCSVFred('DATE,DHHNGSP\r\n2026-10-20,3.10\r\n', 'X'), [['2026-10-20', 3.1]]);
  assert.throws(() => parsearCSVFred('<html>maintenance</html>', 'X'), /página web/);
});

test('imagen del RSS: solo https y la más grande', () => {
  assert.equal(imagenDe('<media:thumbnail width="240" url="https://a/1.jpg"/><media:thumbnail width="976" url="https://a/2.jpg"/>'), 'https://a/2.jpg');
  assert.equal(imagenDe('<enclosure url="http://a/1.jpg" type="image/jpeg"/>'), null);
  assert.equal(imagenDe('<enclosure url="https://a/1.mp3" type="audio/mpeg"/>'), null);
  assert.equal(imagenDe('', '&lt;img src="https://a/x.png"&gt;'), 'https://a/x.png');
});

test('catálogo: ids únicos, categorías válidas y cada materia con precio o motivo', () => {
  const ids = COMMODITIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of COMMODITIES) {
    assert.ok(CATEGORIAS[c.categoria], c.id);
    assert.ok(c.series.length || c.sinSerieMotivo, `${c.id} sin serie ni motivo`);
    assert.ok(c.claves.length, `${c.id} sin palabras clave`);
  }
  for (const k of Object.keys(CATEGORIAS)) assert.ok(COMMODITIES.some((c) => c.categoria === k), `categoría vacía ${k}`);
});
