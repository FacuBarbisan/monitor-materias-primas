// Servidor opcional: sirve la web y actualiza los datos cada 10 minutos
// (cada fuente respeta su propia frecuencia). Úsalo en tu computadora o en un
// hosting que mantenga procesos encendidos. Con GitHub Pages + GitHub Actions no hace falta.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actualizar } from './scripts/update.js';

// Carga simple de un archivo .env (sin dependencias).
try {
  const env = await readFile(new URL('./.env', import.meta.url), 'utf8');
  for (const linea of env.split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* sin .env */ }

const PUBLICO = fileURLToPath(new URL('./public/', import.meta.url));
const PUERTO = Number(process.env.PORT || 3000);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

let actualizando = false;
let ultimaManual = 0;
async function correrActualizacion(forzar = false) {
  if (actualizando) return false;
  actualizando = true;
  try { await actualizar({ forzar }); } catch (e) { console.error('Error en la actualización:', e); } finally { actualizando = false; }
  return true;
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/actualizar' && req.method === 'POST') {
    // Límite: una actualización manual cada 5 minutos para no saturar a las fuentes.
    const espera = 5 * 60_000 - (Date.now() - ultimaManual);
    if (espera > 0) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: `Esperá ${Math.ceil(espera / 60000)} min antes de volver a actualizar.` })); }
    ultimaManual = Date.now();
    const ok = await correrActualizacion(true);
    res.writeHead(ok ? 200 : 409, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok }));
  }
  let ruta = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!ruta || ruta.endsWith('/')) ruta += 'index.html';
  const archivo = join(PUBLICO, ruta);
  if (!archivo.startsWith(PUBLICO)) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(archivo)).isFile()) throw new Error();
    const tipo = TIPOS[extname(archivo)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': tipo, 'cache-control': ruta.startsWith('data/') ? 'no-cache' : 'max-age=300' });
    res.end(await readFile(archivo));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Monitor de materias primas en http://localhost:${PUERTO}`);
  if (process.env.SIN_ACTUALIZAR !== '1') {
    correrActualizacion();
    setInterval(correrActualizacion, 10 * 60_000);
  }
});
