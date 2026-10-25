// Monitor de Materias Primas – interfaz v4 (sin dependencias).
// Lee los datos que publica el actualizador (GitHub Actions) en data/*.json. No consulta fuentes externas
// desde el navegador, salvo los widgets oficiales de TradingView, que se cargan solo al abrir una ficha.
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlSegura = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '#');
const imgSegura = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : null);
const normal = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Almacenamiento local (mismas claves que la versión anterior: se conservan favoritos y notas) ----------
const almacen = {
  leer(k, d) { try { const v = localStorage.getItem('mmp.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  escribir(k, v) { try { localStorage.setItem('mmp.' + k, JSON.stringify(v)); return true; } catch { aviso('No se pudo guardar en este navegador (almacenamiento bloqueado o lleno). Exportá una copia.', 'error', 'almacen'); return false; } },
};

const ZONAS = [['America/Argentina/Buenos_Aires', 'Buenos Aires'], ['UTC', 'UTC'], ['America/New_York', 'Nueva York'], ['America/Sao_Paulo', 'São Paulo'], ['Europe/London', 'Londres'], ['Europe/Madrid', 'Madrid'], ['Asia/Dubai', 'Dubái'], ['Asia/Shanghai', 'Shanghái'], ['Asia/Tokyo', 'Tokio']];
const GRADIENTES = { energia: ['#1D5FA8', '#0F1E33'], preciosos: ['#5B5FA8', '#1B1D3A'], industriales: ['#3D5873', '#152231'], granos: ['#2E7D7A', '#0F2B2A'], aceites: ['#4F7A5A', '#16261B'], ganaderia: ['#5A6B8C', '#1A2233'], agricolas: ['#3E7C8F', '#122A31'], fertilizantes: ['#4B6E9E', '#141F33'], general: ['#3D5873', '#0F1E33'] };

const E = {
  noticias: null, estado: null, cat: null, errorCarga: null, cargando: false,
  zona: almacen.leer('zona', 'America/Argentina/Buenos_Aires'),
  tema: almacen.leer('tema', 'auto'),
  favoritos: migrarFavoritos(almacen.leer('favoritos', { paises: [], materias: [] })),
  guardadas: almacen.leer('guardadas', {}),
  visibles: 24, catCategoria: '', series: {}, fichaSerie: {}, fichaPeriodo: {}, fichaTema: '',
};

// Las versiones anteriores usaban ids genéricos de materias primas.
function migrarFavoritos(f) {
  const mapa = { petroleo: ['wti', 'brent'], gas: ['gas_natural'], granos: ['trigo', 'maiz', 'soja'] };
  const materias = [...new Set((f.materias || []).flatMap((m) => mapa[m] || [m]))];
  const r = { paises: Array.isArray(f.paises) ? f.paises : [], materias };
  if (JSON.stringify(r) !== JSON.stringify(f)) { try { localStorage.setItem('mmp.favoritos', JSON.stringify(r)); } catch { /* sin almacenamiento */ } }
  return r;
}

// ---------- Fechas y números ----------
function fecha(iso, hora = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  try { return new Intl.DateTimeFormat('es-AR', { timeZone: E.zona, day: '2-digit', month: '2-digit', year: 'numeric', ...(hora ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d); } catch { return d.toLocaleString('es-AR'); }
}
function fechaDato(dia, frecuencia) {
  if (!dia) return '—';
  const d = new Date(dia + 'T12:00:00Z');
  if (frecuencia === 'mensual') return new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d);
}
function hace(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!isFinite(min)) return '';
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}
const diaLocal = (iso) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: E.zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };
const num = (x, dec) => {
  const d = dec ?? (Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 10 ? 2 : 3);
  return Number(x).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

// ---------- Avisos ----------
function aviso(html, tipo = 'aviso', id, accion) {
  const cont = $('#avisos');
  if (id) $(`[data-id="${id}"]`, cont)?.remove();
  const d = document.createElement('div');
  d.className = 'aviso' + (tipo === 'error' ? ' aviso--error' : tipo === 'info' ? ' aviso--info' : '');
  if (id) d.dataset.id = id;
  d.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  d.innerHTML = `<div>${html}</div>`;
  if (accion) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = accion.texto; b.addEventListener('click', accion.fn); d.appendChild(b); }
  cont.appendChild(d);
  if (!id) setTimeout(() => d.remove(), 7000);
}
const quitarAviso = (id) => $(`#avisos [data-id="${id}"]`)?.remove();

// ---------- Carga de datos publicados ----------
async function traerJSON(ruta) {
  const r = await fetch(`${ruta}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status}`);
  return r.json();
}
async function cargar() {
  if (E.cargando) return;
  E.cargando = true; pintarEstado();
  const [n, e, c] = await Promise.allSettled([traerJSON('data/noticias.json'), traerJSON('data/estado.json'), traerJSON('data/catalogo.json')]);
  const fallas = [];
  if (n.status === 'fulfilled' && n.value?.items) E.noticias = n.value; else fallas.push('noticias');
  if (e.status === 'fulfilled' && e.value) E.estado = e.value; else fallas.push('estado de fuentes');
  if (c.status === 'fulfilled' && c.value?.items) E.cat = c.value; else fallas.push('catálogo de precios');
  E.errorCarga = fallas.length ? fallas : null;
  E.cargando = false;
  pintarEstado(); revisarAvisos();
  if (!(seccion().s === 'guardadas' && document.activeElement?.tagName === 'TEXTAREA')) pintar();
}

function pintarEstado() {
  const b = $('#estado-barra');
  const gen = E.estado?.generado || E.noticias?.generado;
  const horas = gen ? (Date.now() - Date.parse(gen)) / 36e5 : null;
  const punto = E.cargando ? '<span class="girando" aria-hidden="true"></span>' : `<span class="punto ${!gen ? 'punto--error' : horas > 3 ? 'punto--aviso' : 'punto--ok'}"></span>`;
  b.innerHTML = `${punto}
    <span>Noticias publicadas: <strong>${gen ? `${fecha(gen)} (${hace(gen)})` : '—'}</strong></span>
    <span>Precios consultados: <strong>${E.cat?.ultimoCiclo ? `${fecha(E.cat.ultimoCiclo)} (${hace(E.cat.ultimoCiclo)})` : '—'}</strong></span>
    <span class="chica">El actualizador de GitHub busca noticias cada 30 min y precios cada 6 h, aunque esta página esté cerrada.</span>`;
}

function revisarAvisos() {
  if (E.errorCarga) aviso(`<strong>No se pudieron leer:</strong> ${esc(E.errorCarga.join(', '))}. ${E.noticias || E.cat ? 'Se muestran los últimos datos leídos; pueden estar desactualizados.' : ''}`, 'error', 'carga', { texto: 'Reintentar', fn: cargar });
  else quitarAviso('carga');
  const gen = E.estado?.generado;
  if (gen && (Date.now() - Date.parse(gen)) / 36e5 > 3) aviso(`<strong>Las noticias tienen ${Math.round((Date.now() - Date.parse(gen)) / 36e5)} horas.</strong> Puede que la tarea programada de GitHub esté demorada o pausada (revisá la pestaña Actions del repositorio).`, 'aviso', 'viejo');
  else quitarAviso('viejo');
  const caidas = (E.estado?.fuentes || []).filter((f) => f.ultimoError);
  if (caidas.length) aviso(`<strong>${caidas.length} de ${E.estado.fuentes.length} fuentes de noticias fallaron en el último intento</strong> (${caidas.slice(0, 3).map((f) => esc(f.nombre)).join(', ')}${caidas.length > 3 ? '…' : ''}). Se conservan sus noticias anteriores. <a href="#fuentes">Ver detalle</a>`, 'aviso', 'fuentes');
  else quitarAviso('fuentes');
  const prov = Object.values(E.cat?.proveedores || {}).filter((p) => p.ultimoError);
  if (prov.length) aviso(`<strong>Precios:</strong> ${prov.map((p) => `${esc(p.nombre)}: ${esc(p.ultimoError)}`).join(' · ')}. Se muestra el último dato válido de cada serie con su fecha. <a href="#fuentes">Ver detalle</a>`, 'aviso', 'precios');
  else quitarAviso('precios');
}

// ---------- Navegación ----------
function seccion() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('materia/')) return { s: 'materia', id: h.slice(8) };
  return { s: ['materias', 'noticias', 'guardadas', 'fuentes'].includes(h) ? h : 'materias' };
}
function pintar() {
  const { s, id } = seccion();
  document.body.dataset.seccion = s === 'materia' ? 'materias' : s;
  $$('main > section').forEach((x) => { x.hidden = x.dataset.s !== s; });
  $$('.pestanas a').forEach((a) => ((a.dataset.s === s || (s === 'materia' && a.dataset.s === 'materias')) ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (s === 'materias') pintarCatalogo();
  if (s === 'materia') pintarFicha(id);
  if (s === 'noticias') pintarNoticias();
  if (s === 'guardadas') pintarGuardadas();
  if (s === 'fuentes') pintarFuentes();
  $('#n-guardadas').textContent = Object.keys(E.guardadas).length;
}

// ---------- Tema ----------
const temaReal = () => (E.tema === 'claro' ? 'light' : E.tema === 'oscuro' ? 'dark' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function aplicarTema() {
  if (E.tema === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = E.tema === 'claro' ? 'light' : 'dark';
  $('#btn-tema').title = `Tema: ${{ auto: 'automático', claro: 'claro', oscuro: 'oscuro' }[E.tema]} (tocar para cambiar)`;
}

// ---------- Catálogo ----------
const catItems = () => E.cat?.items || [];
const categorias = () => E.cat?.categorias || E.noticias?.catalogo?.categorias || {};
const principal = (c) => c.series.find((s) => s.ultimo) || null;
const ICO_EST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

function noticiasDe(id, dias = 7) {
  const lim = Date.now() - dias * 864e5;
  return (E.noticias?.items || []).filter((i) => (i.materias || []).includes(id) && Date.parse(i.fecha) >= lim);
}
function tipoSerie(s) {
  if (s.proveedor === 'eia') return 'Spot diario oficial';
  if (s.frecuencia === 'diaria') return 'Spot diario';
  return 'Referencia mensual';
}
const nombreProveedor = (p) => ({ fred: 'FMI vía FRED', eia: 'EIA', wb: 'Banco Mundial' }[p] || p);
function variacion(s) {
  if (!s?.ultimo || !s?.anterior) return null;
  const d = s.ultimo[1] - s.anterior[1];
  return { d, pct: s.anterior[1] ? (d / s.anterior[1]) * 100 : null };
}
function htmlVar(v) {
  if (!v) return '<span class="sin-dato">—</span>';
  const cls = v.d > 0 ? 'sube' : v.d < 0 ? 'baja' : '';
  return `<span class="${cls}">${v.d >= 0 ? '+' : ''}${num(v.d, Math.abs(v.d) >= 1000 ? 0 : 2)}${v.pct != null ? ` (${v.pct >= 0 ? '+' : ''}${num(v.pct, 2)} %)` : ''}</span>`;
}

function pintarCatalogo() {
  const tbody = $('#tabla-catalogo tbody');
  if (!E.cat) { tbody.innerHTML = `<tr><td colspan="8" class="vacio">${E.errorCarga ? 'No se pudo leer el catálogo de precios.' : 'Cargando catálogo…'}</td></tr>`; return; }
  const cats = categorias();
  const texto = normal($('#c-texto').value.trim());
  const soloFav = $('#c-favoritas').checked;
  const cuenta = {};
  for (const c of catItems()) cuenta[c.categoria] = (cuenta[c.categoria] || 0) + 1;
  $('#c-categorias').innerHTML = `<button type="button" class="chip-btn" data-cat="" aria-pressed="${!E.catCategoria}">Todas<span>${catItems().length}</span></button>` +
    Object.entries(cats).map(([id, n]) => `<button type="button" class="chip-btn" data-cat="${id}" aria-pressed="${E.catCategoria === id}">${esc(n)}<span>${cuenta[id] || 0}</span></button>`).join('');
  const lista = catItems().filter((c) => (!E.catCategoria || c.categoria === E.catCategoria)
    && (!soloFav || E.favoritos.materias.includes(c.id))
    && (!texto || normal(`${c.nombre} ${cats[c.categoria]} ${c.series.map((s) => s.nombre).join(' ')}`).includes(texto)));
  $('#c-conteo').textContent = `${lista.length} de ${catItems().length} materias primas`;
  if (!lista.length) { tbody.innerHTML = '<tr><td colspan="8" class="vacio">Ninguna materia prima coincide con la búsqueda.</td></tr>'; return; }
  let html = '', ultimaCat = null;
  for (const c of lista) {
    if (c.categoria !== ultimaCat) { ultimaCat = c.categoria; html += `<tr class="cat-fila"><td colspan="8">${esc(cats[c.categoria] || c.categoria)}</td></tr>`; }
    const s = principal(c);
    const fav = E.favoritos.materias.includes(c.id);
    const nN = noticiasDe(c.id).length;
    html += `<tr data-ir="${esc(c.id)}">
      <td><button type="button" class="estrella" data-fav-materia="${esc(c.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Quitar de' : 'Agregar a'} favoritas: ${esc(c.nombre)}">${ICO_EST}</button></td>
      <td><a class="nombre" href="#materia/${esc(c.id)}">${esc(c.nombre)}</a>${c.series.length > 1 ? `<div class="chica">${c.series.length} series de referencia</div>` : ''}</td>
      <td class="num">${s ? `<strong>${num(s.ultimo[1])}</strong><div class="chica">${esc(s.unidad)}</div>` : `<span class="sin-dato">${c.sinSerieMotivo ? 'Sin precio gratuito' : 'Sin dato verificado'}</span>`}</td>
      <td class="num">${s ? htmlVar(variacion(s)) : '<span class="sin-dato">—</span>'}${s ? `<div class="chica">vs. ${s.frecuencia === 'mensual' ? 'mes' : 'día'} anterior</div>` : ''}</td>
      <td>${s ? `${fechaDato(s.ultimo[0], s.frecuencia)}${s.estado?.ultimoError ? '<div class="chica" style="color:var(--error-texto)">Última consulta falló</div>' : ''}` : '<span class="sin-dato">—</span>'}</td>
      <td class="col-opc">${s ? `${esc(tipoSerie(s))}<div class="chica">${esc(nombreProveedor(s.proveedor))}</div>` : '<span class="sin-dato">—</span>'}</td>
      <td class="col-opc">${c.widget ? `<span class="etiqueta etiqueta--${c.widget.tipo === 'CFD' ? 'cfd' : 'spot'}">${esc(c.widget.tipo)}</span>${c.widget.verificado ? '' : '<div class="chica">sin verificar</div>'}` : '<span class="sin-dato">—</span>'}</td>
      <td class="num col-opc">${nN || '<span class="sin-dato">0</span>'}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

// ---------- Ficha ----------
const nCat = (id) => categorias()[id] || id;
async function serie(clave) {
  if (E.series[clave]) return E.series[clave];
  const d = await traerJSON(`data/series/${clave}.json`);
  E.series[clave] = d;
  return d;
}
const PERIODOS = { diaria: [['1M', 31], ['3M', 92], ['1A', 366], ['5A', 1830]], mensual: [['1A', 366], ['5A', 1830], ['10A', 3653], ['Todo', 0]] };

function pintarFicha(id) {
  const c = catItems().find((x) => x.id === id);
  const cont = $('#ficha');
  if (!E.cat) { cont.innerHTML = '<p class="vacio"><span class="girando"></span> Cargando…</p>'; return; }
  if (!c) { cont.innerHTML = '<a class="volver" href="#materias">← Volver al catálogo</a><p class="vacio">No se encontró esa materia prima.</p>'; return; }
  if (cont.dataset.id === id && cont.dataset.tema === temaReal()) { pintarNoticiasFicha(c); return; } // ya está abierta
  cont.dataset.id = id; cont.dataset.tema = temaReal();
  const fav = E.favoritos.materias.includes(c.id);
  const conSerie = c.series.filter((s) => s.ultimo || s.estado?.ultimoError || s.estado?.ultimoIntento);
  const sel = E.fichaSerie[id] && c.series.some((s) => s.clave === E.fichaSerie[id]) ? E.fichaSerie[id] : (principal(c) || c.series[0])?.clave;
  cont.innerHTML = `
    <a class="volver" href="#materias">← Catálogo</a>
    <div class="seccion__cab ficha-cab" style="align-items:center">
      <div><span class="etiqueta etiqueta--neutra">${esc(nCat(c.categoria))}</span><h2 style="margin-top:6px">${esc(c.nombre)}</h2><p class="ayuda">Moneda: ${esc(c.moneda)} · Unidad de referencia: ${esc(c.unidad)}</p></div>
      <button type="button" class="btn" data-fav-materia="${esc(c.id)}" aria-pressed="${fav}">${ICO_EST}${fav ? 'En favoritas' : 'Agregar a favoritas'}</button>
    </div>
    <div class="ficha-grid">
      <div class="panel" id="ficha-precio">
        ${c.series.length ? `<div class="panel__cab"><h3>Precio de referencia</h3>${c.series.length > 1 ? `<div class="segmentado" role="group" aria-label="Serie">${c.series.map((s) => `<button type="button" data-serie="${esc(s.clave)}" aria-pressed="${s.clave === sel}">${esc(s.nombre.split('(')[0].split(',')[0].trim())}</button>`).join('')}</div>` : ''}</div><div id="ficha-serie"></div>`
          : `<h3>Precio de referencia</h3><p class="vacio">${esc(c.sinSerieMotivo || 'No hay una serie de precios gratuita y verificable.')}</p>`}
      </div>
      <div class="panel">
        <h3>Gráfico en vivo</h3>
        ${c.widget ? `<p class="ayuda" style="margin-bottom:8px"><span class="etiqueta etiqueta--${c.widget.tipo === 'CFD' ? 'cfd' : 'spot'}">${esc(c.widget.tipo)}</span> ${esc(c.widget.simbolo)} · ${esc(c.widget.proveedor)}<br>${esc(c.widget.nota)} ${c.widget.verificado ? 'Símbolo comprobado en widget.' : '<strong>Símbolo sin verificar en widget:</strong> si no carga o dice “solo disponible en TradingView”, usá el enlace.'} TradingView indica dentro del gráfico si el dato es diferido.</p>
          <div class="widget" style="height:330px" id="ficha-widget"></div>
          <div class="acciones"><a class="btn btn--chico" href="https://www.tradingview.com/symbols/${esc(c.widget.simbolo.replace(':', '-'))}/" target="_blank" rel="noopener">Abrir en TradingView ↗</a></div>`
          : `<p class="vacio">No hay un widget gratuito disponible para esta materia prima. Los futuros de bolsa (CME, ICE) no se pueden mostrar en widgets gratuitos de TradingView.</p>`}
      </div>
    </div>
    <div class="panel" id="ficha-noticias"></div>`;
  if (c.series.length) pintarSerieFicha(c, sel);
  if (c.widget) widgetTV($('#ficha-widget'), c);
  pintarNoticiasFicha(c);
  void conSerie;
}

async function pintarSerieFicha(c, clave) {
  E.fichaSerie[c.id] = clave;
  $$('#ficha-precio [data-serie]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.serie === clave)));
  const s = c.series.find((x) => x.clave === clave);
  const box = $('#ficha-serie');
  const v = variacion(s);
  const est = s.estado || {};
  box.innerHTML = `
    ${s.ultimo ? `<div class="cotiz"><div class="cotiz__valor">${num(s.ultimo[1])} <span class="chica">${esc(s.unidad)}</span></div><div class="cotiz__var">${htmlVar(v)} <span class="chica">vs. ${s.frecuencia === 'mensual' ? 'mes' : 'día'} anterior${s.anterior ? ` (${fechaDato(s.anterior[0], s.frecuencia)})` : ''}</span></div></div>`
      : `<p class="vacio">${est.ultimoError ? `Sin datos: ${esc(est.ultimoError)}` : 'La serie todavía no se consultó.'}</p>`}
    ${est.ultimoError && s.ultimo ? `<div class="aviso" style="margin-top:8px">La última consulta falló (${fecha(est.ultimoIntento)}): ${esc(est.ultimoError)}. Se muestra el último dato válido.</div>` : ''}
    <dl class="datos-ficha">
      <dt>Serie</dt><dd>${esc(s.nombre)}</dd>
      <dt>Tipo de precio</dt><dd>${esc(tipoSerie(s))}. ${s.frecuencia === 'mensual' ? 'Promedio del mes: no es una cotización del día.' : 'Precio físico de cierre diario: no es un futuro ni un CFD.'}</dd>
      <dt>Fecha del dato</dt><dd>${s.ultimo ? fechaDato(s.ultimo[0], s.frecuencia) : '—'}</dd>
      <dt>Demora</dt><dd>${esc(s.nota || '')}</dd>
      <dt>Moneda y unidad</dt><dd>${esc(s.unidad)}</dd>
      <dt>Proveedor</dt><dd><a href="${esc(urlSegura(s.fuenteUrl))}" target="_blank" rel="noopener">${esc(nombreProveedor(s.proveedor))} ↗</a> · código ${esc(s.id)}</dd>
      <dt>Última consulta exitosa</dt><dd>${est.ultimoExito ? `${fecha(est.ultimoExito)} (${hace(est.ultimoExito)})` : '—'}</dd>
    </dl>
    ${s.ultimo ? `<div class="panel__cab" style="margin:14px 0 0"><strong>Historia</strong><div class="segmentado" role="group" aria-label="Período">${PERIODOS[s.frecuencia === 'diaria' ? 'diaria' : 'mensual'].map(([et, d]) => `<button type="button" data-periodo="${d}" aria-pressed="${(E.fichaPeriodo[s.clave] ?? (s.frecuencia === 'diaria' ? 366 : 1830)) === d}">${et}</button>`).join('')}</div></div>
      <div id="ficha-grafico"><p class="chica"><span class="girando"></span> Cargando historia…</p></div><div class="lectura" id="ficha-lectura" aria-live="polite"></div>` : ''}`;
  if (!s.ultimo) return;
  try {
    const d = await serie(s.clave);
    if (E.fichaSerie[c.id] !== clave || !$('#ficha-grafico')) return;
    dibujarGrafico(d, s);
  } catch (e) {
    $('#ficha-grafico').innerHTML = `<p class="vacio">No se pudo cargar la historia: ${esc(e.message)}.</p>`;
  }
}

function dibujarGrafico(d, s) {
  const dias = E.fichaPeriodo[s.clave] ?? (s.frecuencia === 'diaria' ? 366 : 1830);
  const desde = dias ? new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10) : '0000';
  const p = d.puntos.filter((x) => x[0] >= desde);
  const g = $('#ficha-grafico');
  if (p.length < 2) { g.innerHTML = '<p class="vacio">Datos insuficientes para este período.</p>'; return; }
  const W = 700, H = 260, L = 52, R = 10, T = 10, B = 24;
  const vs = p.map((x) => x[1]);
  let mn = Math.min(...vs), mx = Math.max(...vs); if (mn === mx) { mn -= 1; mx += 1; }
  const x = (k) => L + (k / (p.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  const linea = p.map((q, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(q[1]).toFixed(1)}`).join('');
  const marcas = [mn, mn + (mx - mn) / 2, mx];
  g.innerHTML = `<svg class="grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(s.nombre)}: de ${num(vs[0])} a ${num(vs.at(-1))} ${esc(s.unidad)} entre ${fechaDato(p[0][0], s.frecuencia)} y ${fechaDato(p.at(-1)[0], s.frecuencia)}">
    ${marcas.map((m) => `<line class="guia" x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}"/><text x="4" y="${y(m) + 4}">${num(m, m >= 100 ? 0 : 2)}</text>`).join('')}
    <path class="area" d="${linea}L${x(p.length - 1)},${H - B}L${L},${H - B}Z"/><path class="linea" d="${linea}"/>
    <text x="${L}" y="${H - 6}">${fechaDato(p[0][0], s.frecuencia)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fechaDato(p.at(-1)[0], s.frecuencia)}</text>
    <line class="cursor" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><circle class="punto-cursor" r="4" cx="0" cy="0" visibility="hidden"/>
  </svg>`;
  const svg = $('svg', g);
  const lect = $('#ficha-lectura');
  lect.textContent = `Último: ${fechaDato(p.at(-1)[0], s.frecuencia)} — ${num(p.at(-1)[1])} ${s.unidad}. Pasá el cursor o tocá el gráfico para ver cada dato.`;
  const mover = (ev) => {
    const r = svg.getBoundingClientRect();
    const k = Math.max(0, Math.min(p.length - 1, Math.round((((ev.clientX - r.left) / r.width) * W - L) / (W - L - R) * (p.length - 1))));
    const cur = $('.cursor', svg), pt = $('.punto-cursor', svg);
    cur.setAttribute('x1', x(k)); cur.setAttribute('x2', x(k)); cur.setAttribute('visibility', 'visible');
    pt.setAttribute('cx', x(k)); pt.setAttribute('cy', y(p[k][1])); pt.setAttribute('visibility', 'visible');
    const prev = p[k - 1];
    const dif = prev ? p[k][1] - prev[1] : null;
    lect.textContent = `${fechaDato(p[k][0], s.frecuencia)}: ${num(p[k][1])} ${s.unidad}${dif != null ? ` (${dif >= 0 ? '+' : ''}${num(dif, Math.abs(dif) >= 1000 ? 0 : 2)} vs. dato anterior)` : ''}`;
  };
  svg.addEventListener('pointermove', mover);
  svg.addEventListener('pointerdown', mover);
}

// TradingView: el script del widget se pide solo al abrir la ficha.
function widgetTV(cont, c) {
  cont.innerHTML = '<div class="widget__estado"><span><span class="girando"></span> Cargando gráfico de TradingView…</span></div>';
  const caja = document.createElement('div');
  caja.className = 'tradingview-widget-container';
  caja.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const sc = document.createElement('script');
  sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
  sc.async = true;
  sc.textContent = JSON.stringify({ symbols: [[c.nombre, c.widget.simbolo + '|1M']], chartOnly: false, width: '100%', height: '100%', autosize: true, locale: 'es', colorTheme: temaReal(), isTransparent: true, showVolume: false, hideDateRanges: false, hideMarketStatus: false, scalePosition: 'right', scaleMode: 'Normal', chartType: 'area', lineWidth: 2, dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'] });
  const fallo = () => {
    if (!cont.isConnected) return;
    const e = $('.widget__estado', cont) || cont.appendChild(document.createElement('div'));
    e.className = 'widget__estado widget__estado--error';
    e.innerHTML = `<span>No se pudo cargar el widget (sin conexión o bloqueado por una extensión).<br><a href="https://www.tradingview.com/symbols/${esc(c.widget.simbolo.replace(':', '-'))}/" target="_blank" rel="noopener">Ver ${esc(c.nombre)} en TradingView ↗</a></span>`;
  };
  sc.onerror = fallo;
  caja.appendChild(sc);
  cont.appendChild(caja);
  const espera = setInterval(() => {
    if (!cont.isConnected) return clearInterval(espera);
    if ($('iframe', cont)) { clearInterval(espera); setTimeout(() => $('.widget__estado', cont)?.remove(), 1200); }
  }, 500);
  setTimeout(() => { clearInterval(espera); if (!$('iframe', cont)) fallo(); }, 15000);
}

function pintarNoticiasFicha(c) {
  const box = $('#ficha-noticias');
  if (!box) return;
  const todas = (E.noticias?.items || []).filter((i) => (i.materias || []).includes(c.id));
  const temasDisp = [...new Set(todas.flatMap((i) => i.temas || []))];
  if (E.fichaTema && !temasDisp.includes(E.fichaTema)) E.fichaTema = '';
  const lista = todas.filter((i) => !E.fichaTema || (i.temas || []).includes(E.fichaTema));
  const grupos = agruparLista(lista).slice(0, 12);
  const generales = agruparLista((E.noticias?.items || []).filter((i) => (i.categorias || []).includes(c.categoria) && !(i.materias || []).includes(c.id) && !(i.materias || []).length)).slice(0, 6);
  box.innerHTML = `
    <div class="panel__cab"><div><h3>Noticias relacionadas con ${esc(c.nombre)}</h3><p class="ayuda">Solo notas que mencionan esta materia prima de forma específica (últimos ${E.noticias?.diasRetencion ?? 10} días).</p></div>
      ${todas.length ? `<a class="btn btn--chico" href="#noticias" data-ver-materia="${esc(c.id)}">Ver en Noticias</a>` : ''}</div>
    ${temasDisp.length ? `<div class="chips-filtro" role="group" aria-label="Filtrar por tipo de evento" style="margin:0 0 12px"><button type="button" class="chip-btn" data-ficha-tema="" aria-pressed="${!E.fichaTema}">Todos</button>${temasDisp.map((t) => `<button type="button" class="chip-btn" data-ficha-tema="${esc(t)}" aria-pressed="${E.fichaTema === t}">${esc(nTema(t))}</button>`).join('')}</div>` : ''}
    <div class="grilla-fotos">${grupos.length ? grupos.map((g) => tarjetaFoto(g, { relacion: c })).join('') : `<p class="vacio" style="grid-column:1/-1">No hay noticias recientes que mencionen específicamente ${esc(c.nombre.toLowerCase())}.</p>`}</div>
    ${generales.length ? `<details class="explica" style="margin-top:14px"><summary>Menciones generales de ${esc(nCat(c.categoria).toLowerCase())} (${generales.length})</summary><p class="ayuda">Estas notas hablan de la categoría en general, sin nombrar ${esc(c.nombre.toLowerCase())}: pueden no afectarla.</p><div class="grilla-fotos" style="margin-top:10px">${generales.map((g) => tarjetaFoto(g)).join('')}</div></details>` : ''}`;
}

// ---------- Noticias ----------
const catN = () => E.noticias?.catalogo || { regiones: {}, paises: [], materias: [], temas: [], fuentes: [] };
const nPais = (id) => catN().paises.find((p) => p.id === id)?.nombre || id;
const nMat = (id) => catItems().find((p) => p.id === id)?.nombre || catN().materias.find((p) => p.id === id)?.nombre || id;
const nTema = (id) => catN().temas.find((p) => p.id === id)?.nombre || id;
const nReg = (id) => catN().regiones[id] || id;
const IDIOMA = { en: 'inglés', es: 'español', pt: 'portugués', fr: 'francés' };

function filtros() {
  return { texto: normal($('#f-texto').value.trim()), region: $('#f-region').value, pais: $('#f-pais').value, categoria: $('#f-categoria').value, materia: $('#f-materia').value,
    tema: $('#f-tema').value, fuente: $('#f-fuente').value, tipo: $('#f-tipo').value, periodo: $('#f-periodo').value, desde: $('#f-desde').value, hasta: $('#f-hasta').value, fav: $('#f-favoritos').checked };
}
function pasa(i, f, ign = '') {
  if (f.texto) { const t = normal(`${i.titulo} ${i.tituloEs || ''} ${i.extracto || ''} ${i.fuenteNombre}`); if (!f.texto.split(/\s+/).every((w) => t.includes(w))) return false; }
  if (ign !== 'region' && f.region && !(i.regiones || []).includes(f.region)) return false;
  if (ign !== 'pais' && f.pais && !(i.paises || []).includes(f.pais)) return false;
  if (ign !== 'categoria' && f.categoria && !(i.categorias || []).includes(f.categoria)) return false;
  if (ign !== 'materia' && f.materia && !(i.materias || []).includes(f.materia)) return false;
  if (ign !== 'tema' && f.tema && !(i.temas || []).includes(f.tema)) return false;
  if (ign !== 'fuente' && f.fuente && i.fuente !== f.fuente) return false;
  if (f.tipo && i.tipoFuente !== f.tipo) return false;
  if (f.periodo === 'rango') { const d = diaLocal(i.fecha); if ((f.desde && d < f.desde) || (f.hasta && d > f.hasta)) return false; }
  else if (f.periodo && Date.now() - Date.parse(i.fecha) > Number(f.periodo) * 864e5) return false;
  if (f.fav) { const { paises, materias } = E.favoritos; if ((paises.length || materias.length) && !(i.paises || []).some((p) => paises.includes(p)) && !(i.materias || []).some((m) => materias.includes(m))) return false; }
  return true;
}
function llenarFiltros() {
  const items = E.noticias?.items || [];
  const f = filtros();
  const contar = (campo, ign) => { const c = {}; for (const i of items) if (pasa(i, f, ign)) for (const v of [].concat(i[campo] || [])) c[v] = (c[v] || 0) + 1; return c; };
  const llenar = (sel, ops, c, todos) => {
    const v = sel.value;
    sel.innerHTML = `<option value="">${todos}</option>` + ops.filter((o) => c[o.id] || o.id === v).sort((a, b) => (c[b.id] || 0) - (c[a.id] || 0) || a.nombre.localeCompare(b.nombre, 'es'))
      .map((o) => `<option value="${esc(o.id)}">${esc(o.nombre)} (${c[o.id] || 0})</option>`).join('');
    sel.value = v;
  };
  const k = catN();
  llenar($('#f-region'), Object.entries(k.regiones).map(([id, nombre]) => ({ id, nombre })), contar('regiones', 'region'), 'Todas');
  llenar($('#f-pais'), k.paises, contar('paises', 'pais'), 'Todos');
  llenar($('#f-categoria'), Object.entries(categorias()).map(([id, nombre]) => ({ id, nombre })), contar('categorias', 'categoria'), 'Todas');
  // Materias agrupadas por categoría
  const cm = contar('materias', 'materia'), vm = $('#f-materia').value;
  const mats = (catItems().length ? catItems() : k.materias).filter((m) => cm[m.id] || m.id === vm);
  $('#f-materia').innerHTML = '<option value="">Todas</option>' + Object.entries(categorias()).map(([cid, cn]) => {
    const ms = mats.filter((m) => m.categoria === cid);
    return ms.length ? `<optgroup label="${esc(cn)}">${ms.map((m) => `<option value="${esc(m.id)}">${esc(m.nombre)} (${cm[m.id] || 0})</option>`).join('')}</optgroup>` : '';
  }).join('');
  $('#f-materia').value = vm;
  llenar($('#f-tema'), k.temas, contar('temas', 'tema'), 'Todos');
  llenar($('#f-fuente'), k.fuentes, contar('fuente', 'fuente'), 'Todas');
}
function agruparLista(items) {
  const m = new Map();
  for (const i of items) { const k = i.grupo || i.id; if (!m.has(k)) m.set(k, []); m.get(k).push(i); }
  return [...m.values()].map((g) => g.sort((a, b) => (b.imagen ? 1 : 0) - (a.imagen ? 1 : 0) || b.fecha.localeCompare(a.fecha))).sort((a, b) => maxF(b).localeCompare(maxF(a)));
}
const maxF = (g) => g.reduce((m, i) => (i.fecha > m ? i.fecha : m), '');

const ICO_DIARIO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M7 9h10M7 13h6M7 17h8"/></svg>';
function media(i) {
  const cat = (i.categorias || [])[0] || 'general';
  const [g1, g2] = GRADIENTES[cat] || GRADIENTES.general;
  const alt = `<div class="sin-imagen" style="--g1:${g1};--g2:${g2}">${ICO_DIARIO}<strong>${esc(i.fuenteNombre)}</strong><span>La fuente no publicó una imagen para esta nota</span></div>`;
  const src = imgSegura(i.imagen);
  if (!src) return `<div class="nota-foto__media">${alt}</div>`;
  return `<div class="nota-foto__media" data-alt="${esc(alt)}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="nota-foto__credito">Imagen: ${esc(i.fuenteNombre)}</span></div>`;
}

function relacionHTML(i, c) {
  const palabra = i.coincidencias?.[c.id];
  const imp = i.impacto;
  return `<div class="relacion">
    <p><span class="rotulo">Por qué aparece</span>La nota menciona ${palabra ? `«${esc(palabra)}»` : esc(c.nombre.toLowerCase())}${(i.temas || []).length ? ` en un contexto de ${esc((i.temas || []).map(nTema).join(', ').toLowerCase())}` : ''}.</p>
    ${imp ? `<p><span class="rotulo">Interpretación (no comprobada)</span>Posible canal: ${imp.canales.map((x) => esc(x.nombre.toLowerCase())).join(', ')}. ${esc(imp.canales[0].explicacion)} ${esc(imp.nota)}</p>` : '<p class="chica">No se identificó un canal de impacto específico.</p>'}
  </div>`;
}

function tarjetaFoto(g, { relacion = null, nota = false } = {}) {
  const i = g[0];
  const unir = (k) => [...new Set(g.flatMap((x) => x[k] || []))];
  const paises = unir('paises'), materias = unir('materias'), regiones = unir('regiones');
  const guardada = Boolean(E.guardadas[i.id]);
  const titulo = i.tituloEs || i.titulo;
  const lugar = paises.length ? paises.slice(0, 3).map(nPais).join(' · ') : regiones.length ? regiones.slice(0, 2).map(nReg).join(' · ') : '';
  const extracto = i.resumenEs || i.extracto || '';
  return `<article class="nota-foto">
    ${media(i)}
    <div class="nota-foto__cuerpo">
      <div class="nota-foto__meta"><strong>${esc(i.fuenteNombre)}</strong>${i.tipoFuente === 'oficial' ? '<span class="etiqueta etiqueta--oficial">Oficial</span>' : ''}<time datetime="${esc(i.fecha)}">${fecha(i.fecha)}</time>${i.idioma && i.idioma !== 'es' && !i.tituloEs ? `<span class="etiqueta etiqueta--neutra">En ${esc(IDIOMA[i.idioma] || i.idioma)}</span>` : ''}${i.tituloEs ? '<span class="etiqueta etiqueta--neutra">Traducido con IA</span>' : ''}</div>
      <h3 class="nota-foto__titulo"><a href="${esc(urlSegura(i.link))}" target="_blank" rel="noopener">${esc(titulo)}</a></h3>
      ${extracto ? `<p class="nota-foto__extracto">${i.resumenEs ? '<span class="rotulo">Resumen IA</span>' : ''}${esc(extracto)}</p>` : ''}
      <div class="tags">${lugar ? `<span class="tag">${esc(lugar)}</span>` : ''}${materias.slice(0, 4).map((m) => `<a class="tag tag--materia" href="#materia/${esc(m)}">${esc(nMat(m))}</a>`).join('')}${(i.temas || []).slice(0, 2).map((t) => `<span class="tag tag--tema">${esc(nTema(t))}</span>`).join('')}</div>
      ${relacion ? relacionHTML(i, relacion) : ''}
      ${g.length > 1 ? `<details class="impacto"><summary>${g.length - 1} cobertura(s) más del mismo hecho</summary><ul>${g.slice(1).map((o) => `<li><a href="${esc(urlSegura(o.link))}" target="_blank" rel="noopener">${esc(o.tituloEs || o.titulo)}</a> <span class="chica">${esc(o.fuenteNombre)} · ${fecha(o.fecha)}</span></li>`).join('')}</ul></details>` : ''}
      <div class="nota-foto__acciones">
        <button type="button" class="btn btn--chico" data-guardar="${esc(i.id)}" aria-pressed="${guardada}">${ICO_EST}${guardada ? 'Guardada' : 'Guardar'}</button>
        <a class="btn btn--chico" href="${esc(urlSegura(i.link))}" target="_blank" rel="noopener">Abrir original ↗</a>
        ${i.idioma && i.idioma !== 'es' && !i.tituloEs ? `<a class="btn btn--chico" href="https://translate.google.com/?sl=auto&tl=es&op=translate&text=${encodeURIComponent(i.titulo + (i.extracto ? '\n\n' + i.extracto : ''))}" target="_blank" rel="noopener">Traducir ↗</a>` : ''}
      </div>
      ${nota ? `<div class="nota"><label for="nota-${esc(i.id)}">Mi nota</label><textarea id="nota-${esc(i.id)}" data-nota="${esc(i.id)}" placeholder="Ej.: Esta interrupción podría reducir la oferta disponible, pero necesito comprobar su duración y si existen rutas alternativas.">${esc(E.guardadas[i.id]?.nota || '')}</textarea><p class="chica">Guardada el ${fecha(E.guardadas[i.id]?.guardada || E.guardadas[i.id]?.fecha)}. La nota se guarda sola.</p></div>` : ''}
    </div>
  </article>`;
}

function pintarNoticias() {
  if (!E.noticias) { $('#lista-noticias').innerHTML = `<p class="vacio" style="grid-column:1/-1">${E.errorCarga ? 'No se pudieron leer las noticias.' : 'Cargando noticias…'}</p>`; return; }
  llenarFiltros();
  const f = filtros();
  $$('.rango').forEach((l) => { l.hidden = f.periodo !== 'rango'; });
  const items = E.noticias.items.filter((i) => pasa(i, f));
  const grupos = agruparLista(items);
  $('#conteo').textContent = `${grupos.length} acontecimientos · ${items.length} notas`;
  if (!grupos.length) { $('#lista-noticias').innerHTML = '<p class="vacio" style="grid-column:1/-1">Ninguna noticia coincide con los filtros. Probá ampliar la fecha o limpiar filtros.</p>'; $('#mas').hidden = true; return; }
  $('#lista-noticias').innerHTML = grupos.slice(0, E.visibles).map((g) => tarjetaFoto(g)).join('');
  $('#mas').hidden = grupos.length <= E.visibles;
}

// ---------- Guardadas ----------
function alternarGuardada(id) {
  if (E.guardadas[id]) delete E.guardadas[id];
  else {
    const item = (E.noticias?.items || []).find((i) => i.id === id);
    if (!item) return;
    E.guardadas[id] = { item, nota: '', guardada: new Date().toISOString() };
  }
  almacen.escribir('guardadas', E.guardadas);
  $('#n-guardadas').textContent = Object.keys(E.guardadas).length;
}
function pintarGuardadas() {
  const g = Object.values(E.guardadas).sort((a, b) => String(b.guardada || b.fecha).localeCompare(String(a.guardada || a.fecha)));
  $('#lista-guardadas').innerHTML = g.length ? g.map((x) => tarjetaFoto([{ paises: [], regiones: [], materias: [], temas: [], ...x.item }], { nota: true })).join('')
    : '<p class="vacio" style="grid-column:1/-1">Todavía no guardaste noticias. Usá “Guardar” en cualquier noticia: se conserva aunque deje de aparecer en las fuentes.</p>';
}
function exportar() {
  const datos = { app: 'monitor-materias-primas', version: 4, exportado: new Date().toISOString(), favoritos: E.favoritos, guardadas: E.guardadas };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' }));
  a.download = `monitor-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importar(archivo) {
  try {
    const d = JSON.parse(await archivo.text());
    if (d.app !== 'monitor-materias-primas' || typeof d.guardadas !== 'object') throw new Error('el archivo no es una copia de esta app');
    let n = 0;
    for (const [id, g] of Object.entries(d.guardadas || {})) {
      if (!g?.item?.titulo || !/^https?:\/\//i.test(g.item.link || '')) continue;
      E.guardadas[id] = { item: g.item, nota: String(g.nota || ''), guardada: g.guardada || g.fecha || new Date().toISOString() }; n++;
    }
    if (d.favoritos && Array.isArray(d.favoritos.paises) && Array.isArray(d.favoritos.materias)) { E.favoritos = migrarFavoritos(d.favoritos); almacen.escribir('favoritos', E.favoritos); }
    almacen.escribir('guardadas', E.guardadas);
    aviso(`Copia importada: ${n} noticias guardadas.`, 'info');
    pintar();
  } catch (e) { aviso(`No se pudo importar: ${esc(e.message)}.`, 'error'); }
}

// ---------- Fuentes ----------
const frec = (m) => (m >= 60 ? `cada ${m / 60} h` : `cada ${m} min`);
function celda(s) {
  if (!s?.ultimoIntento) return '<span class="etiqueta etiqueta--neutra">Sin consultar</span>';
  if (s.ultimoError) return `<span class="etiqueta etiqueta--${s.ultimoExito ? 'aviso' : 'error'}">${s.ultimoExito ? 'Falló (se conserva lo anterior)' : 'Error'}</span><div class="chica" style="margin-top:4px">${esc(s.ultimoError)}</div>`;
  return '<span class="etiqueta etiqueta--ok">Funcionando</span>';
}
function pintarFuentes() {
  const e = E.estado, c = E.cat;
  $('#info-actualizacion').innerHTML = `Todas las consultas las hace el <strong>actualizador de GitHub Actions</strong> (no tu navegador), por eso no hay bloqueos CORS. Noticias: ${e?.generado ? `${fecha(e.generado)} (${hace(e.generado)})` : '—'}. Precios: ${c?.ultimoCiclo ? `${fecha(c.ultimoCiclo)} (${hace(c.ultimoCiclo)})` : '—'}.`;
  const series = catItems().flatMap((x) => x.series.map((s) => ({ ...s, materia: x.nombre })));
  const ok = series.filter((s) => s.ultimo && !s.estado?.ultimoError).length;
  $('#resumen-fuentes').innerHTML = `<div><strong>${(e?.fuentes || []).filter((f) => f.ultimoExito && !f.ultimoError).length}/${(e?.fuentes || []).length}</strong><span>fuentes de noticias funcionando</span></div>
    <div><strong>${ok}/${series.length}</strong><span>series de precios con dato verificado</span></div>
    <div><strong>${catItems().filter((x) => principal(x)).length}/${catItems().length}</strong><span>materias primas con precio</span></div>
    <div><strong>${(E.noticias?.items || []).filter((i) => i.imagen).length}/${(E.noticias?.items || []).length}</strong><span>noticias con imagen de la fuente</span></div>`;
  $('#tabla-fuentes').innerHTML = `<thead><tr><th>Fuente</th><th>Tipo</th><th>Frecuencia</th><th>Último intento</th><th>Última actualización exitosa</th><th>Estado</th><th>Último feed</th></tr></thead><tbody>${(e?.fuentes || []).map((f) => `<tr>
    <td><strong>${esc(f.nombre)}</strong><div class="chica"><a href="${esc(urlSegura(f.url))}" target="_blank" rel="noopener">RSS ↗</a> · ${esc(f.region || '')}</div></td><td>${f.tipo === 'oficial' ? 'Oficial' : 'Periodística'}</td><td>${frec(f.cadaMin)}</td>
    <td>${f.ultimoIntento ? fecha(f.ultimoIntento) : '—'}</td><td>${f.ultimoExito ? `${fecha(f.ultimoExito)}<div class="chica">${hace(f.ultimoExito)}</div>` : '—'}</td><td>${celda(f)}</td>
    <td>${f.itemsEnFeed != null ? `${f.itemsEnFeed} notas · ${f.itemsRelevantes} relevantes` : '—'}</td></tr>`).join('')}</tbody>`;
  $('#tabla-proveedores').innerHTML = `<thead><tr><th>Proveedor</th><th>Licencia y origen</th><th>Último intento</th><th>Última consulta exitosa</th><th>Estado</th></tr></thead><tbody>${Object.values(c?.proveedores || {}).map((p) => `<tr>
    <td><strong>${esc(p.nombre)}</strong><div class="chica"><a href="${esc(urlSegura(p.url))}" target="_blank" rel="noopener">Sitio ↗</a></div></td><td class="chica">${esc(p.licencia || '')}${p.usaClaveDemo ? ' Usa la clave de demostración (DEMO_KEY).' : ''}</td>
    <td>${p.ultimoIntento ? fecha(p.ultimoIntento) : '—'}</td><td>${p.ultimoExito ? `${fecha(p.ultimoExito)}<div class="chica">${hace(p.ultimoExito)}</div>` : '—'}${p.seriesOk != null ? `<div class="chica">${p.seriesOk} series ok · ${p.seriesError} con error</div>` : ''}</td><td>${celda(p)}</td></tr>`).join('')}</tbody>`;
  $('#tabla-series').innerHTML = `<thead><tr><th>Materia prima</th><th>Serie</th><th>Proveedor y código</th><th>Último dato</th><th>Estado</th></tr></thead><tbody>${series.map((s) => `<tr>
    <td>${esc(s.materia)}</td><td>${esc(s.nombre)}<div class="chica">${esc(s.unidad)} · ${esc(s.frecuencia)}</div></td><td><a href="${esc(urlSegura(s.fuenteUrl))}" target="_blank" rel="noopener">${esc(nombreProveedor(s.proveedor))}</a> · ${esc(s.id)}</td>
    <td>${s.ultimo ? `${fechaDato(s.ultimo[0], s.frecuencia)}: ${num(s.ultimo[1])}` : '—'}</td><td>${s.ultimo && !s.estado?.ultimoError ? '<span class="etiqueta etiqueta--ok">Verificada</span>' : celda(s.estado)}</td></tr>`).join('')}</tbody>`;
  $('#tabla-widgets').innerHTML = `<thead><tr><th>Materia prima</th><th>Símbolo</th><th>Tipo</th><th>Verificación</th></tr></thead><tbody>${catItems().filter((x) => x.widget).map((x) => `<tr>
    <td>${esc(x.nombre)}</td><td><a href="https://www.tradingview.com/symbols/${esc(x.widget.simbolo.replace(':', '-'))}/" target="_blank" rel="noopener">${esc(x.widget.simbolo)}</a></td><td>${esc(x.widget.tipo)} · ${esc(x.widget.proveedor)}</td>
    <td>${x.widget.verificado ? '<span class="etiqueta etiqueta--ok">Comprobado en widget (22/10/2026)</span>' : '<span class="etiqueta etiqueta--aviso">Sin verificar</span><div class="chica">Abrí la ficha: si el widget dice “solo disponible en TradingView”, no está habilitado.</div>'}</td></tr>`).join('')}</tbody>`;
  $('#tabla-no-disponibles').innerHTML = `<thead><tr><th>Qué</th><th>Motivo</th></tr></thead><tbody>
    ${catItems().filter((x) => !x.series.length).map((x) => `<tr><td>Precio de ${esc(x.nombre.toLowerCase())}</td><td>${esc(x.sinSerieMotivo || '')}</td></tr>`).join('')}
    <tr><td>Futuros oficiales (CME, ICE) con vencimiento</td><td>TradingView no los habilita en widgets gratuitos; requieren licencia de datos de bolsa (paga).</td></tr>
    <tr><td>Cotizaciones en tiempo real de la mayoría de los productos</td><td>No hay una fuente gratuita y autorizada; se usan referencias oficiales diarias o mensuales con su fecha.</td></tr>
    <tr><td>Reuters, AP, OPEP</td><td>Requieren licencia o bloquean el acceso automático.</td></tr>
  </tbody>`;
}

// ---------- Favoritos ----------
function abrirFavoritos() {
  const f = E.favoritos;
  const cats = categorias();
  $('#fav-materias').innerHTML = Object.entries(cats).map(([cid, cn]) => `<div class="grupo">${esc(cn)}</div>` + catItems().filter((m) => m.categoria === cid).map((m) => `<label><input type="checkbox" value="${esc(m.id)}" ${f.materias.includes(m.id) ? 'checked' : ''}> ${esc(m.nombre)}</label>`).join('')).join('');
  const por = {};
  for (const p of catN().paises) (por[p.region] ||= []).push(p);
  $('#fav-paises').innerHTML = Object.entries(por).map(([r, ps]) => `<div class="grupo">${esc(nReg(r))}</div>` + ps.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((p) => `<label><input type="checkbox" value="${esc(p.id)}" ${f.paises.includes(p.id) ? 'checked' : ''}> ${esc(p.nombre)}</label>`).join('')).join('');
  $('#dlg-favoritos').showModal();
}
function alternarMateriaFav(id) {
  const m = E.favoritos.materias;
  E.favoritos.materias = m.includes(id) ? m.filter((x) => x !== id) : [...m, id];
  almacen.escribir('favoritos', E.favoritos);
  const si = E.favoritos.materias.includes(id);
  $$(`[data-fav-materia="${CSS.escape(id)}"]`).forEach((b) => {
    b.setAttribute('aria-pressed', String(si));
    if (b.classList.contains('btn')) b.innerHTML = ICO_EST + (si ? 'En favoritas' : 'Agregar a favoritas');
    else b.setAttribute('aria-label', `${si ? 'Quitar de' : 'Agregar a'} favoritas`);
  });
}

// ---------- Inicio ----------
function iniciar() {
  const z = $('#zona'), local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zonas = ZONAS.some((x) => x[0] === local) ? [...ZONAS] : [...ZONAS, [local, 'Este equipo']];
  if (!zonas.some((x) => x[0] === E.zona)) zonas.push([E.zona, E.zona]);
  z.innerHTML = zonas.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join('');
  z.value = E.zona;
  z.addEventListener('change', () => { E.zona = z.value; almacen.escribir('zona', E.zona); $('#ficha').dataset.id = ''; pintarEstado(); pintar(); });

  aplicarTema();
  $('#btn-tema').addEventListener('click', () => { E.tema = { auto: 'claro', claro: 'oscuro', oscuro: 'auto' }[E.tema]; almacen.escribir('tema', E.tema); aplicarTema(); pintar(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => E.tema === 'auto' && pintar());
  $('#btn-recargar').addEventListener('click', cargar);
  $('#btn-favoritos').addEventListener('click', abrirFavoritos);
  $('#dlg-favoritos').addEventListener('close', () => {
    E.favoritos = { materias: $$('#fav-materias input:checked').map((x) => x.value), paises: $$('#fav-paises input:checked').map((x) => x.value) };
    almacen.escribir('favoritos', E.favoritos); $('#ficha').dataset.id = ''; pintar();
  });
  window.addEventListener('hashchange', () => { pintar(); scrollTo(0, 0); });

  let t;
  $('#c-texto').addEventListener('input', () => { clearTimeout(t); t = setTimeout(pintarCatalogo, 150); });
  $('#c-favoritas').addEventListener('change', pintarCatalogo);
  $('#filtros').addEventListener('input', (ev) => { clearTimeout(t); t = setTimeout(() => { E.visibles = 24; pintarNoticias(); }, ev.target.id === 'f-texto' ? 250 : 0); });
  $('#limpiar').addEventListener('click', () => { $('#filtros').reset(); E.visibles = 24; pintarNoticias(); });
  $('#mas').addEventListener('click', () => { E.visibles += 24; pintarNoticias(); });

  document.addEventListener('click', (ev) => {
    const fm = ev.target.closest('[data-fav-materia]');
    if (fm) { ev.stopPropagation(); alternarMateriaFav(fm.dataset.favMateria); if (seccion().s === 'materias' && $('#c-favoritas').checked) pintarCatalogo(); return; }
    const cb = ev.target.closest('[data-cat]');
    if (cb) { E.catCategoria = cb.dataset.cat; pintarCatalogo(); return; }
    const fila = ev.target.closest('tr[data-ir]');
    if (fila && !ev.target.closest('a,button')) { location.hash = `materia/${fila.dataset.ir}`; return; }
    const g = ev.target.closest('[data-guardar]');
    if (g) {
      alternarGuardada(g.dataset.guardar);
      const si = Boolean(E.guardadas[g.dataset.guardar]);
      $$(`[data-guardar="${CSS.escape(g.dataset.guardar)}"]`).forEach((b) => { b.setAttribute('aria-pressed', String(si)); b.innerHTML = ICO_EST + (si ? 'Guardada' : 'Guardar'); });
      if (seccion().s === 'guardadas') pintarGuardadas();
      return;
    }
    const sb = ev.target.closest('#ficha-precio [data-serie]');
    if (sb) { const c = catItems().find((x) => x.id === seccion().id); if (c) pintarSerieFicha(c, sb.dataset.serie); return; }
    const pb = ev.target.closest('#ficha-precio [data-periodo]');
    if (pb) { const c = catItems().find((x) => x.id === seccion().id); const s = c?.series.find((x) => x.clave === E.fichaSerie[c.id]); if (s) { E.fichaPeriodo[s.clave] = Number(pb.dataset.periodo); $$('#ficha-precio [data-periodo]').forEach((b) => b.setAttribute('aria-pressed', String(b === pb))); dibujarGrafico(E.series[s.clave], s); } return; }
    const tb = ev.target.closest('[data-ficha-tema]');
    if (tb) { E.fichaTema = tb.dataset.fichaTema; const c = catItems().find((x) => x.id === seccion().id); if (c) pintarNoticiasFicha(c); return; }
    const vm = ev.target.closest('[data-ver-materia]');
    if (vm) { $('#filtros').reset(); $('#f-periodo').value = ''; setTimeout(() => { llenarFiltros(); $('#f-materia').value = vm.dataset.verMateria; pintarNoticias(); }, 0); }
  });
  document.addEventListener('keydown', (ev) => {
    const fila = ev.target.closest?.('tr[data-ir]');
    if (fila && ev.key === 'Enter' && !ev.target.closest('a,button')) location.hash = `materia/${fila.dataset.ir}`;
  });
  // Si una imagen de la fuente no carga, se reemplaza por la alternativa visual (sin inventar una foto).
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (img.tagName !== 'IMG') return;
    const m = img.closest('.nota-foto__media');
    if (m?.dataset.alt) m.innerHTML = m.dataset.alt;
  }, true);

  let tn;
  $('#lista-guardadas').addEventListener('input', (ev) => {
    const id = ev.target.dataset.nota; if (!id || !E.guardadas[id]) return;
    E.guardadas[id].nota = ev.target.value; clearTimeout(tn); tn = setTimeout(() => almacen.escribir('guardadas', E.guardadas), 400);
  });
  $('#exportar').addEventListener('click', exportar);
  $('#importar').addEventListener('change', (ev) => { if (ev.target.files[0]) importar(ev.target.files[0]); ev.target.value = ''; });

  pintarEstado(); pintar();
  cargar();
  setInterval(cargar, 5 * 60_000); // relee lo que publicó el actualizador
}
iniciar();
