// Monitor de Materias Primas – interfaz (sin dependencias).
// Los datos de noticias y estado vienen de /data/*.json, generados por scripts/update.js.
// Las cotizaciones son widgets oficiales de TradingView: se muestran, nunca se leen ni se copian.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinAcentos = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Almacenamiento local (con protección si el navegador lo bloquea) ----------
const almacen = {
  leer(k, def) { try { const v = localStorage.getItem('mmp.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  escribir(k, v) { try { localStorage.setItem('mmp.' + k, JSON.stringify(v)); return true; } catch { aviso('No se pudo guardar en este navegador (almacenamiento bloqueado o lleno).', 'error'); return false; } },
};

// ---------- Instrumentos (símbolos verificados en widgets el 22/10/2026) ----------
const INSTRUMENTOS = [
  { id: 'oro', nombre: 'Oro', simbolo: 'OANDA:XAUUSD', unidad: 'USD por onza troy', tipo: 'Spot OTC', chip: 'spot',
    instrumento: 'XAU/USD al contado, mercado extrabursátil (OTC)', proveedor: 'OANDA vía TradingView', vencimiento: 'No aplica: es un precio al contado, no un futuro.' },
  { id: 'plata', nombre: 'Plata', simbolo: 'OANDA:XAGUSD', unidad: 'USD por onza troy', tipo: 'Spot OTC', chip: 'spot',
    instrumento: 'XAG/USD al contado, mercado extrabursátil (OTC)', proveedor: 'OANDA vía TradingView', vencimiento: 'No aplica: es un precio al contado, no un futuro.' },
  { id: 'wti', nombre: 'Petróleo WTI', simbolo: 'TVC:USOIL', unidad: 'USD por barril', tipo: 'CFD', chip: 'cfd',
    instrumento: 'CFD sobre crudo WTI (TradingView lo rotula así). Sigue al futuro NYMEX, pero no es el contrato oficial.', proveedor: 'TVC (TradingView)', vencimiento: 'No indica mes de vencimiento: serie continua de CFD.' },
  { id: 'brent', nombre: 'Petróleo Brent', simbolo: 'TVC:UKOIL', unidad: 'USD por barril', tipo: 'CFD', chip: 'cfd',
    instrumento: 'CFD sobre crudo Brent (TradingView lo rotula así). Sigue al futuro ICE, pero no es el contrato oficial.', proveedor: 'TVC (TradingView)', vencimiento: 'No indica mes de vencimiento: serie continua de CFD.' },
];
const DEMORA = 'La informa TradingView dentro del widget (una “D” indica dato diferido). Esta app no puede leerla.';

// Rangos del gráfico avanzado: [etiqueta, rango, intervalo]
const PERIODOS = [['1D', '1D', '5'], ['5D', '5D', '30'], ['1M', '1M', '60'], ['3M', '3M', '240'], ['6M', '6M', 'D'], ['1A', '12M', 'D'], ['5A', '60M', 'W'], ['Todo', 'ALL', 'M']];

const ZONAS = [
  ['America/Argentina/Buenos_Aires', 'Buenos Aires (ART)'], ['UTC', 'UTC'], ['America/New_York', 'Nueva York'], ['America/Sao_Paulo', 'São Paulo'],
  ['America/Mexico_City', 'Ciudad de México'], ['Europe/London', 'Londres'], ['Europe/Madrid', 'Madrid'], ['Europe/Moscow', 'Moscú'],
  ['Asia/Dubai', 'Dubái'], ['Asia/Shanghai', 'Shanghái'], ['Asia/Tokyo', 'Tokio'], ['Australia/Sydney', 'Sídney'],
];

// ---------- Estado ----------
const estado = {
  noticias: null, estadoFuentes: null, eia: null,
  errorCarga: null, cargadoEn: null,
  zona: almacen.leer('zona', 'America/Argentina/Buenos_Aires'),
  tema: almacen.leer('tema', 'auto'),
  favoritos: almacen.leer('favoritos', { paises: [], materias: [] }),
  guardadas: almacen.leer('guardadas', {}), // id -> { item, nota, guardada }
  visibles: 30,
  detalle: null, periodo: '12M',
  diasEIA: 90,
};

// ---------- Utilidades de fecha ----------
function fecha(iso, conHora = true) {
  if (!iso) return 's/f';
  const d = new Date(iso);
  if (isNaN(d)) return 's/f';
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: estado.zona, day: '2-digit', month: '2-digit', year: 'numeric', ...(conHora ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d);
  } catch { return d.toLocaleString('es-AR'); }
}
function hace(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!isFinite(min)) return '';
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
function claveDia(iso) {
  // Fecha (AAAA-MM-DD) en la zona horaria elegida, para filtrar por rango.
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: estado.zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)); } catch { return iso.slice(0, 10); }
}

// ---------- Avisos ----------
function aviso(texto, tipo = 'aviso', id) {
  const cont = $('#avisos');
  if (id) $(`[data-aviso="${id}"]`, cont)?.remove();
  const div = document.createElement('div');
  div.className = 'aviso' + (tipo === 'error' ? ' aviso--error' : '');
  if (id) div.dataset.aviso = id;
  div.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  div.innerHTML = texto;
  cont.appendChild(div);
  if (!id) setTimeout(() => div.remove(), 7000);
}
const quitarAviso = (id) => $(`[data-aviso="${id}"]`)?.remove();

// ---------- Carga de datos ----------
async function traerJSON(ruta) {
  const r = await fetch(ruta + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status}`);
  return r.json();
}

async function cargarDatos() {
  const [n, e, p] = await Promise.allSettled([traerJSON('data/noticias.json'), traerJSON('data/estado.json'), traerJSON('data/eia.json')]);
  const errores = [];
  if (n.status === 'fulfilled' && n.value) estado.noticias = n.value; else errores.push('noticias');
  if (e.status === 'fulfilled' && e.value) estado.estadoFuentes = e.value; else errores.push('estado de fuentes');
  if (p.status === 'fulfilled') estado.eia = p.value; else errores.push('precios EIA');
  estado.errorCarga = errores.length ? errores : null;
  estado.cargadoEn = new Date().toISOString();
  actualizarIndicador();
  revisarAvisosGlobales();
  poblarFiltros();
  // No se redibuja mientras el usuario escribe una nota.
  if (!(seccionActual() === 'guardadas' && document.activeElement?.tagName === 'TEXTAREA')) renderSeccion();
}

function actualizarIndicador() {
  const el = $('#indicador-datos');
  const gen = estado.estadoFuentes?.generado || estado.noticias?.generado;
  el.className = 'indicador';
  if (!gen) { el.textContent = 'Sin datos todavía'; el.classList.add('indicador--error'); return; }
  const horas = (Date.now() - Date.parse(gen)) / 36e5;
  el.textContent = `Datos: ${fecha(gen)} (${hace(gen)})`;
  el.title = 'Hora de la última actualización de noticias y estado de fuentes';
  if (horas > 3) el.classList.add('indicador--aviso');
}

function revisarAvisosGlobales() {
  const e = estado.estadoFuentes;
  if (estado.errorCarga) {
    aviso(`<strong>No se pudieron cargar:</strong> ${esc(estado.errorCarga.join(', '))}. Se muestran los últimos datos válidos que había en esta pestaña, si existen.`, 'error', 'carga');
  } else quitarAviso('carga');
  if (estado.noticias?.modoPrueba || e?.modoPrueba) {
    aviso('<strong>Datos de prueba:</strong> estas noticias se cargaron desde archivos locales para probar la app, no desde la actualización automática. Se reemplazan en la primera actualización real.', 'aviso', 'prueba');
  } else quitarAviso('prueba');
  if (e?.generado) {
    const horas = (Date.now() - Date.parse(e.generado)) / 36e5;
    if (horas > 3) aviso(`<strong>Los datos tienen ${Math.round(horas)} horas.</strong> La actualización automática podría estar detenida. Revisá “Fuentes y estado”.`, 'aviso', 'viejo');
    else quitarAviso('viejo');
    const caidas = (e.fuentes || []).filter((f) => f.ultimoError);
    if (caidas.length) {
      const nombres = caidas.slice(0, 3).map((f) => esc(f.nombre)).join(', ') + (caidas.length > 3 ? ` y ${caidas.length - 3} más` : '');
      aviso(`<strong>${caidas.length} de ${e.fuentes.length} fuentes con error en el último intento</strong> (${nombres}). Se conservan sus noticias anteriores. <a href="#fuentes">Ver detalle</a>`, 'aviso', 'fuentes');
    }
    else quitarAviso('fuentes');
  }
}

// ---------- Navegación ----------
const SECCIONES = ['cotizaciones', 'noticias', 'guardadas', 'fuentes'];
function seccionActual() { const h = location.hash.slice(1); return SECCIONES.includes(h) ? h : 'cotizaciones'; }
function renderSeccion() {
  const s = seccionActual();
  for (const sec of $$('.seccion')) sec.hidden = sec.dataset.seccion !== s;
  $$('.pestanas a').forEach((a) => a.dataset.seccion === s ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (s === 'cotizaciones') { renderPrecios(); renderEIA(); }
  if (s === 'noticias') renderNoticias();
  if (s === 'guardadas') renderGuardadas();
  if (s === 'fuentes') renderFuentes();
  actualizarContadorGuardadas();
}

// ---------- Tema ----------
function temaEfectivo() {
  if (estado.tema === 'claro') return 'light';
  if (estado.tema === 'oscuro') return 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function aplicarTema() {
  const t = estado.tema;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === 'claro' ? 'light' : 'dark';
  $('#btn-tema').title = `Tema: ${{ auto: 'automático (sistema)', claro: 'claro', oscuro: 'oscuro' }[t]}`;
}

// ---------- TradingView ----------
function montarWidget(contenedor, archivo, config) {
  contenedor.innerHTML = '';
  const caja = document.createElement('div');
  caja.className = 'tradingview-widget-container';
  caja.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const s = document.createElement('script');
  s.src = `https://s3.tradingview.com/external-embedding/${archivo}`;
  s.async = true;
  s.textContent = JSON.stringify(config);
  s.onerror = () => falloWidget(contenedor);
  caja.appendChild(s);
  contenedor.appendChild(caja);
  // Si a los 15 s no apareció el iframe, se informa (bloqueador, sin conexión, etc.).
  setTimeout(() => { if (contenedor.isConnected && !contenedor.querySelector('iframe')) falloWidget(contenedor); }, 15000);
}
function falloWidget(contenedor) {
  if (contenedor.querySelector('.widget-error')) return;
  const d = document.createElement('div');
  d.className = 'widget-error';
  d.innerHTML = 'No se pudo cargar el widget de TradingView.<br>Puede deberse a falta de conexión o a un bloqueador de contenido.';
  contenedor.appendChild(d);
  estado.tvFallo = true;
}

let temaPrecios = null;
function renderPrecios() {
  const tema = temaEfectivo();
  const grilla = $('#tarjetas-precios');
  if (temaPrecios === tema && grilla.children.length) return; // ya montados
  temaPrecios = tema;
  grilla.innerHTML = INSTRUMENTOS.map((i) => `
    <article class="tarjeta-precio" data-id="${i.id}">
      <div class="tarjeta-precio__cab">
        <div><div class="tarjeta-precio__nombre">${esc(i.nombre)}</div><div class="tarjeta-precio__unidad">${esc(i.unidad)}</div></div>
        <span class="chip chip--${i.chip}" title="Tipo de instrumento">${esc(i.tipo)}</span>
      </div>
      <div class="widget-tv" id="tv-${i.id}"></div>
      <dl class="ficha">
        <dt>Instrumento</dt><dd>${esc(i.instrumento)} <code>${esc(i.simbolo)}</code></dd>
        <dt>Vencimiento</dt><dd>${esc(i.vencimiento)}</dd>
        <dt>Proveedor</dt><dd>${esc(i.proveedor)}</dd>
        <dt>Demora</dt><dd>${esc(DEMORA)}</dd>
      </dl>
      <div class="tarjeta-precio__pie"><button type="button" class="btn" data-accion="detalle" data-id="${i.id}">Gráfico avanzado (períodos e intervalos)</button></div>
    </article>`).join('');
  for (const i of INSTRUMENTOS) {
    montarWidget($('#tv-' + i.id), 'embed-widget-symbol-overview.js', {
      symbols: [[i.nombre, i.simbolo + '|1M']], chartOnly: false, width: '100%', height: '100%', locale: 'es',
      colorTheme: tema, autosize: true, showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: false,
      hideSymbolLogo: false, scalePosition: 'right', scaleMode: 'Normal', chartType: 'area', lineWidth: 2,
      dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'], isTransparent: true,
    });
  }
  if (estado.detalle) renderDetalle();
}

function renderDetalle() {
  const i = INSTRUMENTOS.find((x) => x.id === estado.detalle);
  const panel = $('#detalle-grafico');
  if (!i) { panel.hidden = true; return; }
  panel.hidden = false;
  $('#detalle-titulo').textContent = `${i.nombre} — ${i.simbolo}`;
  $('#detalle-sub').textContent = `${i.tipo} · ${i.unidad} · ${i.proveedor}. Horario del gráfico: ${nombreZona(estado.zona)}.`;
  $('#periodos').innerHTML = PERIODOS.map(([et, rango]) => `<button type="button" data-rango="${rango}" aria-pressed="${rango === estado.periodo}">${et}</button>`).join('');
  const [, rango, intervalo] = PERIODOS.find((p) => p[1] === estado.periodo) || PERIODOS[5];
  montarWidget($('#contenedor-avanzado'), 'embed-widget-advanced-chart.js', {
    symbol: i.simbolo, interval: intervalo, range: rango, timezone: estado.zona, theme: temaEfectivo(), style: '1', locale: 'es',
    allow_symbol_change: false, hide_side_toolbar: true, withdateranges: true, details: true, calendar: false, autosize: true, support_host: 'https://www.tradingview.com',
  });
}
const nombreZona = (z) => (ZONAS.find((x) => x[0] === z) || [z, z])[1];

// ---------- Serie oficial EIA ----------
function renderEIA() {
  const cont = $('#eia');
  const datos = estado.eia;
  const st = estado.estadoFuentes?.eia;
  $$('#periodos-eia button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.dias) === estado.diasEIA)));
  if (!datos?.series) {
    cont.innerHTML = `<p class="vacio">Todavía no hay datos de la EIA${st?.ultimoError ? `: último error «${esc(st.ultimoError)}»` : ''}.</p>`;
    return;
  }
  let html = '';
  if (st?.ultimoError) html += `<div class="aviso aviso--error" style="grid-column:1/-1">La última consulta a la EIA falló (${esc(st.ultimoError)}, ${fecha(st.ultimoIntento)}). Se muestra el último dato válido, obtenido el ${fecha(datos.obtenido)}.</div>`;
  if (datos.usaClaveDemo) html += `<p class="ayuda" style="grid-column:1/-1">Se usa la clave de demostración pública de la EIA (DEMO_KEY), con límite bajo de consultas. Podés crear una clave gratuita propia; ver README.</p>`;
  for (const [id, s] of Object.entries(datos.series)) {
    const pts = s.puntos || [];
    if (!pts.length) { html += `<div class="eia-serie"><h4>${esc(s.nombre)}</h4><p class="vacio">Sin datos.</p></div>`; continue; }
    const [ult, val] = pts[pts.length - 1];
    const prev = pts[pts.length - 2]?.[1];
    const dif = prev != null ? val - prev : null;
    const pct = prev ? (dif / prev) * 100 : null;
    const cls = dif > 0 ? 'sube' : dif < 0 ? 'baja' : '';
    const desde = new Date(Date.now() - estado.diasEIA * 864e5).toISOString().slice(0, 10);
    const tramo = pts.filter((p) => p[0] >= desde);
    const diasRezago = Math.round((Date.now() - Date.parse(ult + 'T00:00:00Z')) / 864e5);
    html += `<div class="eia-serie" data-serie="${id}">
      <div><strong>${esc(s.nombre)}</strong> <span class="chip chip--oficial">Oficial · cierre diario</span></div>
      <div class="ayuda">Serie ${esc(id)} · ${esc(s.unidad)}</div>
      <div style="margin-top:6px"><span class="eia-serie__valor">${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      ${dif != null ? `<span class="eia-serie__var ${cls}"> ${dif >= 0 ? '+' : ''}${dif.toLocaleString('es-AR', { maximumFractionDigits: 2 })} (${pct >= 0 ? '+' : ''}${pct.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %)</span>` : ''}</div>
      <div class="ayuda">Fecha del dato: <strong>${fecha(ult + 'T12:00:00Z', false)}</strong> · variación respecto del cierre anterior (${prev != null ? fecha(pts[pts.length - 2][0] + 'T12:00:00Z', false) : '—'})${diasRezago > 5 ? ` · <span class="estado-error">dato con ${diasRezago} días de antigüedad</span>` : ''}</div>
      ${graficoSVG(tramo, id)}
      <div class="eia-tooltip" id="tt-${id}">Pasá el cursor o tocá el gráfico para ver cada dato.</div>
    </div>`;
  }
  html += `<p class="ayuda" style="grid-column:1/-1">Obtenido de la API de la EIA el ${fecha(datos.obtenido)}. Fuente: <a href="https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm" target="_blank" rel="noopener">EIA – Spot Prices</a>.</p>`;
  cont.innerHTML = html;
}

function graficoSVG(pts, id) {
  if (pts.length < 2) return '<p class="vacio">Datos insuficientes para el gráfico.</p>';
  const W = 600, H = 160, pad = { l: 40, r: 8, t: 8, b: 20 };
  const vals = pts.map((p) => p[1]);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (k) => pad.l + (k / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const area = `${d}L${x(pts.length - 1).toFixed(1)},${H - pad.b}L${pad.l},${H - pad.b}Z`;
  const marcas = [min, (min + max) / 2, max];
  return `<svg class="eia-grafico" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Serie ${id}: de ${vals[0]} a ${vals[vals.length - 1]} USD por barril" data-pts='${JSON.stringify(pts)}' data-id="${id}">
    ${marcas.map((m) => `<line class="guia" x1="${pad.l}" x2="${W - pad.r}" y1="${y(m)}" y2="${y(m)}"/><text x="4" y="${y(m) + 4}">${m.toFixed(0)}</text>`).join('')}
    <path class="area" d="${area}" opacity=".6"/><path class="linea" d="${d}"/>
    <text x="${pad.l}" y="${H - 4}">${fecha(pts[0][0] + 'T12:00:00Z', false)}</text>
    <text x="${W - pad.r}" y="${H - 4}" text-anchor="end">${fecha(pts[pts.length - 1][0] + 'T12:00:00Z', false)}</text>
    <line class="cursor" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
  </svg>`;
}

function cursorEIA(ev) {
  const svg = ev.target.closest('.eia-grafico');
  if (!svg) return;
  const pts = JSON.parse(svg.dataset.pts);
  const r = svg.getBoundingClientRect();
  const W = 600, l = 40, rr = 8;
  const px = ((ev.clientX - r.left) / r.width) * W;
  const k = Math.max(0, Math.min(pts.length - 1, Math.round(((px - l) / (W - l - rr)) * (pts.length - 1))));
  const cx = l + (k / (pts.length - 1)) * (W - l - rr);
  const c = svg.querySelector('.cursor');
  c.setAttribute('x1', cx); c.setAttribute('x2', cx); c.setAttribute('visibility', 'visible');
  $('#tt-' + svg.dataset.id).textContent = `${fecha(pts[k][0] + 'T12:00:00Z', false)}: ${pts[k][1].toLocaleString('es-AR', { minimumFractionDigits: 2 })} USD/bbl`;
}

// ---------- Noticias ----------
const catalogo = () => estado.noticias?.catalogo || { regiones: {}, paises: [], materias: [], temas: [], fuentes: [] };
const nombrePais = (id) => catalogo().paises.find((p) => p.id === id)?.nombre || id;
const nombreMateria = (id) => catalogo().materias.find((p) => p.id === id)?.nombre || id;
const nombreTema = (id) => catalogo().temas.find((p) => p.id === id)?.nombre || id;
const nombreRegion = (id) => catalogo().regiones[id] || id;

function leerFiltros() {
  return {
    texto: sinAcentos($('#f-texto').value.trim()),
    region: $('#f-region').value, pais: $('#f-pais').value, materia: $('#f-materia').value, tema: $('#f-tema').value,
    fuente: $('#f-fuente').value, tipo: $('#f-tipo').value, periodo: $('#f-periodo').value,
    desde: $('#f-desde').value, hasta: $('#f-hasta').value, favoritos: $('#f-favoritos').checked,
  };
}

function pasaFiltros(i, f, ignorar = '') {
  if (f.texto) {
    const hay = sinAcentos(`${i.titulo} ${i.tituloEs || ''} ${i.extracto || ''} ${i.resumenEs || ''} ${i.fuenteNombre}`);
    if (!f.texto.split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  if (ignorar !== 'region' && f.region && !i.regiones.includes(f.region)) return false;
  if (ignorar !== 'pais' && f.pais && !i.paises.includes(f.pais)) return false;
  if (ignorar !== 'materia' && f.materia && !i.materias.includes(f.materia)) return false;
  if (ignorar !== 'tema' && f.tema && !i.temas.includes(f.tema)) return false;
  if (ignorar !== 'fuente' && f.fuente && i.fuente !== f.fuente) return false;
  if (f.tipo && i.tipoFuente !== f.tipo) return false;
  if (f.periodo === 'rango') {
    const d = claveDia(i.fecha);
    if (f.desde && d < f.desde) return false;
    if (f.hasta && d > f.hasta) return false;
  } else if (f.periodo) {
    if (Date.now() - Date.parse(i.fecha) > Number(f.periodo) * 864e5) return false;
  }
  if (f.favoritos) {
    const { paises, materias } = estado.favoritos;
    if (!paises.length && !materias.length) return true;
    if (!i.paises.some((p) => paises.includes(p)) && !i.materias.some((m) => materias.includes(m))) return false;
  }
  return true;
}

function poblarFiltros() {
  if (!estado.noticias) return;
  const items = estado.noticias.items;
  const f = leerFiltros();
  const contar = (campo, ign) => {
    const c = {};
    for (const i of items) if (pasaFiltros(i, f, ign)) for (const v of [].concat(i[campo])) c[v] = (c[v] || 0) + 1;
    return c;
  };
  const llenar = (sel, opciones, conteo, todos) => {
    const actual = sel.value;
    sel.innerHTML = `<option value="">${todos}</option>` + opciones
      .filter((o) => conteo[o.id] || o.id === actual)
      .sort((a, b) => (conteo[b.id] || 0) - (conteo[a.id] || 0) || a.nombre.localeCompare(b.nombre, 'es'))
      .map((o) => `<option value="${esc(o.id)}">${esc(o.nombre)} (${conteo[o.id] || 0})</option>`).join('');
    sel.value = actual;
  };
  const cat = catalogo();
  llenar($('#f-region'), Object.entries(cat.regiones).map(([id, nombre]) => ({ id, nombre })), contar('regiones', 'region'), 'Todas las regiones');
  llenar($('#f-pais'), cat.paises, contar('paises', 'pais'), 'Todos los países');
  llenar($('#f-materia'), cat.materias, contar('materias', 'materia'), 'Todas las materias');
  llenar($('#f-tema'), cat.temas, contar('temas', 'tema'), 'Todos los temas');
  llenar($('#f-fuente'), cat.fuentes, contar('fuente', 'fuente'), 'Todas las fuentes');
}

function agruparItems(items) {
  const grupos = new Map();
  for (const i of items) {
    const k = i.grupo || i.id;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  }
  // Principal: preferimos fuentes oficiales y luego la más reciente.
  return [...grupos.values()].map((g) => {
    g.sort((a, b) => (a.tipoFuente === 'oficial' ? -1 : 0) - (b.tipoFuente === 'oficial' ? -1 : 0) || b.fecha.localeCompare(a.fecha));
    return g;
  }).sort((a, b) => maxFecha(b).localeCompare(maxFecha(a)));
}
const maxFecha = (g) => g.reduce((m, i) => (i.fecha > m ? i.fecha : m), '');

const ICONO_ESTRELLA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
const ICONO_EXTERNO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const IDIOMAS = { en: 'inglés', es: 'español', fr: 'francés', pt: 'portugués' };

function tarjetaNoticia(grupo, { conNota = false } = {}) {
  const i = grupo[0];
  const guardada = Boolean(estado.guardadas[i.id]);
  const titulo = i.tituloEs || i.titulo;
  const otras = grupo.slice(1);
  const unir = (campo) => [...new Set(grupo.flatMap((x) => x[campo] || []))];
  const paises = unir('paises'), materias = unir('materias'), temas = unir('temas');
  const resumen = i.resumenEs
    ? `<p class="noticia__extracto"><span class="etiqueta-origen">Resumen IA del extracto</span>${esc(i.resumenEs)}</p>`
    : i.extracto ? `<p class="noticia__extracto"><span class="etiqueta-origen">Extracto de la fuente${i.idioma !== 'es' ? ` (en ${IDIOMAS[i.idioma] || i.idioma})` : ''}</span>${esc(i.extracto)}</p>` : '';
  const impacto = i.impacto ? `
    <details class="impacto">
      <summary>Posible canal de impacto: ${i.impacto.canales.map((c) => `<span class="chip">${esc(c.nombre)}</span>`).join('')}</summary>
      <ul>${i.impacto.canales.map((c) => `<li><strong>${esc(c.nombre)}:</strong> ${esc(c.explicacion)}</li>`).join('')}</ul>
      <p class="nota">${esc(i.impacto.nota)}</p>
      <p class="descargo">Interpretación automática basada en palabras clave del título y el extracto. No es información publicada por la fuente ni prueba que la noticia haya movido algún precio.</p>
    </details>` : '';
  const traducir = i.idioma !== 'es' && !i.tituloEs
    ? `<a class="btn" target="_blank" rel="noopener" href="https://translate.google.com/?sl=auto&tl=es&op=translate&text=${encodeURIComponent(i.titulo + '\n\n' + (i.extracto || ''))}">Traducir (Google) ${ICONO_EXTERNO}</a>` : '';
  return `<article class="noticia" data-id="${esc(i.id)}">
    <div class="noticia__meta">
      <span class="noticia__fuente">${esc(i.fuenteNombre)}</span>
      ${i.tipoFuente === 'oficial' ? '<span class="chip chip--oficial">Fuente oficial</span>' : ''}
      <time datetime="${esc(i.fecha)}" title="${i.fechaEstimada ? 'La fuente no informó hora: se usa la hora en que se obtuvo' : 'Fecha de publicación según la fuente'}">${fecha(i.fecha)}${i.fechaEstimada ? ' (aprox.)' : ''}</time>
      ${otras.length ? `<span class="chip">${grupo.length} coberturas</span>` : ''}
      ${i.tituloEs ? '<span class="chip chip--ia" title="Título y resumen traducidos automáticamente con IA">Traducido con IA</span>' : i.idioma !== 'es' ? `<span class="chip" title="Sin traducción automática configurada">Original en ${IDIOMAS[i.idioma] || i.idioma}</span>` : ''}
    </div>
    <h3 class="noticia__titulo"><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(titulo)}</a></h3>
    ${i.tituloEs ? `<p class="noticia__original">Título original: ${esc(i.titulo)}</p>` : ''}
    ${resumen}
    <div class="chips">
      ${materias.map((m) => `<span class="chip chip--materia">${esc(nombreMateria(m))}</span>`).join('')}
      ${paises.slice(0, 8).map((p) => `<span class="chip chip--pais">${esc(nombrePais(p))}</span>`).join('')}
      ${!paises.length && i.regiones?.length ? i.regiones.map((r) => `<span class="chip chip--pais">${esc(nombreRegion(r))}</span>`).join('') : ''}
      ${temas.map((t) => `<span class="chip chip--tema">${esc(nombreTema(t))}</span>`).join('')}
    </div>
    ${otras.length ? `<div class="coberturas"><strong>Otras coberturas del mismo hecho (agrupadas automáticamente):</strong><ul>${otras.map((o) => `<li><a href="${esc(o.link)}" target="_blank" rel="noopener">${esc(o.tituloEs || o.titulo)}</a><span class="ayuda" style="margin:0">${esc(o.fuenteNombre)} · ${fecha(o.fecha)}</span></li>`).join('')}</ul></div>` : ''}
    ${impacto}
    <div class="noticia__acciones">
      <button type="button" class="btn" data-accion="guardar" data-id="${esc(i.id)}" aria-pressed="${guardada}">${ICONO_ESTRELLA}${guardada ? 'Guardada' : 'Guardar'}</button>
      <a class="btn" href="${esc(i.link)}" target="_blank" rel="noopener">Abrir original ${ICONO_EXTERNO}</a>
      ${traducir}
    </div>
    ${conNota ? `<div class="nota-personal"><label for="nota-${esc(i.id)}">Mi nota</label><textarea id="nota-${esc(i.id)}" data-nota="${esc(i.id)}" placeholder="Ej.: Esta interrupción podría reducir la oferta disponible, pero necesito comprobar su duración y si existen rutas alternativas.">${esc(estado.guardadas[i.id]?.nota || '')}</textarea><p class="ayuda">Guardada el ${fecha(estado.guardadas[i.id]?.guardada)}. La nota se guarda automáticamente.</p></div>` : ''}
  </article>`;
}

function renderNoticias() {
  const lista = $('#lista-noticias');
  if (!estado.noticias) {
    lista.innerHTML = `<p class="vacio">${estado.errorCarga ? 'No se pudieron cargar las noticias.' : 'Cargando noticias…'}</p>`;
    return;
  }
  const f = leerFiltros();
  $$('.rango').forEach((l) => { l.hidden = f.periodo !== 'rango'; });
  const filtradas = estado.noticias.items.filter((i) => pasaFiltros(i, f));
  const grupos = agruparItems(filtradas);
  $('#resultado-conteo').textContent = `${grupos.length} acontecimientos · ${filtradas.length} notas`;
  if (!grupos.length) {
    const total = estado.noticias.items.length;
    lista.innerHTML = `<p class="vacio">${total ? 'No hay noticias con estos filtros. Probá ampliar el período o limpiar filtros.' : 'Todavía no hay noticias guardadas. Se cargarán en la próxima actualización automática.'}</p>`;
    $('#mas-noticias').hidden = true;
    return;
  }
  lista.innerHTML = grupos.slice(0, estado.visibles).map((g) => tarjetaNoticia(g)).join('');
  $('#mas-noticias').hidden = grupos.length <= estado.visibles;
}

// ---------- Guardadas ----------
function alternarGuardada(id) {
  if (estado.guardadas[id]) {
    delete estado.guardadas[id];
  } else {
    const item = estado.noticias?.items.find((i) => i.id === id);
    if (!item) return;
    estado.guardadas[id] = { item, nota: '', guardada: new Date().toISOString() };
  }
  almacen.escribir('guardadas', estado.guardadas);
  actualizarContadorGuardadas();
}
function actualizarContadorGuardadas() { $('#contador-guardadas').textContent = Object.keys(estado.guardadas).length; }

function renderGuardadas() {
  const lista = $('#lista-guardadas');
  const g = Object.values(estado.guardadas).sort((a, b) => b.guardada.localeCompare(a.guardada));
  lista.innerHTML = g.length ? g.map((x) => tarjetaNoticia([x.item], { conNota: true })).join('')
    : '<p class="vacio">Todavía no guardaste noticias. Usá el botón “Guardar” en la sección Noticias. Se conservan aunque la noticia ya no aparezca en los feeds.</p>';
}

function exportar() {
  const datos = { app: 'monitor-materias-primas', version: 1, exportado: new Date().toISOString(), favoritos: estado.favoritos, guardadas: estado.guardadas };
  const blob = new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `monitor-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importar(archivo) {
  try {
    const d = JSON.parse(await archivo.text());
    if (d.app !== 'monitor-materias-primas') throw new Error('El archivo no es una copia de esta app.');
    estado.guardadas = { ...estado.guardadas, ...(d.guardadas || {}) };
    if (d.favoritos) estado.favoritos = d.favoritos;
    almacen.escribir('guardadas', estado.guardadas);
    almacen.escribir('favoritos', estado.favoritos);
    aviso(`Copia importada: ${Object.keys(d.guardadas || {}).length} noticias guardadas.`);
    renderSeccion();
  } catch (e) { aviso('No se pudo importar: ' + esc(e.message), 'error'); }
}

// ---------- Fuentes y estado ----------
function celdaEstado(f) {
  if (!f.ultimoIntento) return '<span class="estado-pendiente">Sin consultar todavía</span>';
  if (f.ultimoError) return `<span class="estado-error">Error</span><br><span class="ayuda" style="margin:0">${esc(f.ultimoError)}${f.fallosSeguidos > 1 ? ` · ${f.fallosSeguidos} fallos seguidos` : ''}</span>`;
  return '<span class="estado-ok">Funcionando</span>';
}
const frecuencia = (min) => (min >= 60 ? `cada ${min / 60} h` : `cada ${min} min`);

function renderFuentes() {
  const e = estado.estadoFuentes;
  if (!e) { $('#tabla-fuentes').innerHTML = '<tr><td>Sin información de estado todavía.</td></tr>'; return; }
  $('#info-actualizacion').innerHTML = `Última actualización de datos: <strong>${fecha(e.generado)}</strong> (${hace(e.generado)}). Las fuentes se consultan automáticamente desde el servidor según la frecuencia de cada una, aunque esta página esté cerrada. Esta página vuelve a leer los datos cada 5 minutos mientras está abierta.`;
  const ok = e.fuentes.filter((f) => f.ultimoExito && !f.ultimoError).length;
  const err = e.fuentes.filter((f) => f.ultimoError).length;
  $('#resumen-fuentes').innerHTML = `
    <div><strong>${ok}/${e.fuentes.length}</strong><span>fuentes de noticias funcionando</span></div>
    <div><strong>${err}</strong><span>con error en el último intento</span></div>
    <div><strong>${estado.noticias?.items.length ?? 0}</strong><span>notas guardadas (últimos ${estado.noticias?.diasRetencion ?? '—'} días)</span></div>
    <div><strong>${e.ia?.configurada ? 'Activa' : 'No configurada'}</strong><span>traducción con IA</span></div>`;
  $('#tabla-fuentes').innerHTML = `<thead><tr><th>Fuente</th><th>Tipo</th><th>Aporta</th><th>Última sincronización exitosa</th><th>Frecuencia</th><th>Estado</th><th>Último feed</th></tr></thead><tbody>
    ${e.fuentes.map((f) => `<tr>
      <td><strong>${esc(f.nombre)}</strong><br><a href="${esc(f.url)}" target="_blank" rel="noopener">Feed RSS</a> · ${esc(IDIOMAS[f.idioma] || f.idioma)}</td>
      <td>${f.tipo === 'oficial' ? 'Oficial' : 'Periodística'}</td>
      <td>${esc(f.region)}${f.filtraRelevancia ? '<br><span class="ayuda" style="margin:0">Solo notas sobre economía, comercio o materias primas</span>' : ''}</td>
      <td>${f.ultimoExito ? `${fecha(f.ultimoExito)}<br><span class="ayuda" style="margin:0">${hace(f.ultimoExito)}</span>` : '—'}</td>
      <td>${frecuencia(f.cadaMin)}</td>
      <td>${celdaEstado(f)}</td>
      <td>${f.itemsEnFeed != null ? `${f.itemsEnFeed} notas en el feed · ${f.itemsRelevantes} relevantes` : '—'}</td>
    </tr>`).join('')}</tbody>`;
  const eia = e.eia || {};
  $('#tabla-otros').innerHTML = `<thead><tr><th>Servicio</th><th>Qué aporta</th><th>Tipo de dato</th><th>Última sincronización</th><th>Estado</th></tr></thead><tbody>
    <tr><td><strong>TradingView</strong> (widgets oficiales)</td><td>Oro y plata spot OTC (OANDA); WTI y Brent como CFD (TVC). Gráficos.</td><td>Tiempo real o diferido según TradingView (lo indica el widget). Se carga en tu navegador.</td><td>Directo desde TradingView</td><td>${estado.tvFallo ? '<span class="estado-error">Algún widget no cargó en este navegador</span>' : '<span class="estado-ok">Sin errores detectados en este navegador</span>'}</td></tr>
    <tr><td><strong>${esc(eia.nombre || 'EIA')}</strong><br><a href="https://www.eia.gov/opendata/" target="_blank" rel="noopener">Documentación</a></td><td>Spot oficial diario WTI (Cushing) y Brent (Europa), USD/barril</td><td>Cierre diario oficial, 1–2 días hábiles de rezago</td><td>${eia.ultimoExito ? fecha(eia.ultimoExito) : '—'} · ${frecuencia(eia.cadaMin || 360)}</td><td>${celdaEstado(eia)}${eia.usaClaveDemo ? '<br><span class="ayuda" style="margin:0">Usa DEMO_KEY: conviene configurar una clave gratuita propia</span>' : ''}</td></tr>
    <tr><td><strong>Traducción y resumen con IA</strong> (Anthropic, opcional)</td><td>Títulos en español y resumen del extracto</td><td>Contenido generado por IA, siempre rotulado</td><td>${e.ia?.configurada ? `${e.ia.traducidasEstaVez} traducidas en la última corrida` : '—'}</td><td>${e.ia?.configurada ? (e.ia.ultimoError ? `<span class="estado-error">Error</span><br><span class="ayuda" style="margin:0">${esc(e.ia.ultimoError)}</span>` : `<span class="estado-ok">Activa</span> (${esc(e.ia.modelo)})`) : '<span class="estado-pendiente">No configurada</span><br><span class="ayuda" style="margin:0">Requiere ANTHROPIC_API_KEY (pago por uso). Sin ella se muestran títulos originales.</span>'}</td></tr>
  </tbody>`;
  $('#tabla-pendientes').innerHTML = `<thead><tr><th>Fuente</th><th>Situación verificada</th><th>Qué haría falta</th></tr></thead><tbody>
    ${(e.pendientes || []).map((p) => `<tr><td><strong>${esc(p.nombre)}</strong></td><td>${esc(p.motivo)}</td><td>${esc(p.requisito)}</td></tr>`).join('')}</tbody>`;
}

// ---------- Preferencias ----------
function abrirPreferencias() {
  const cat = catalogo();
  const fav = estado.favoritos;
  $('#pref-materias').innerHTML = cat.materias.map((m) => `<label><input type="checkbox" name="materia" value="${m.id}" ${fav.materias.includes(m.id) ? 'checked' : ''}> ${esc(m.nombre)}</label>`).join('') || '<p class="vacio">Disponible cuando carguen los datos.</p>';
  const porRegion = {};
  for (const p of cat.paises) (porRegion[p.region] ||= []).push(p);
  $('#pref-paises').innerHTML = Object.entries(porRegion).map(([r, ps]) => `<div class="grupo">${esc(nombreRegion(r))}</div>` +
    ps.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((p) => `<label><input type="checkbox" name="pais" value="${p.id}" ${fav.paises.includes(p.id) ? 'checked' : ''}> ${esc(p.nombre)}</label>`).join('')).join('');
  $('#dlg-preferencias').showModal();
}
function guardarPreferencias() {
  estado.favoritos = {
    materias: $$('#pref-materias input:checked').map((i) => i.value),
    paises: $$('#pref-paises input:checked').map((i) => i.value),
  };
  almacen.escribir('favoritos', estado.favoritos);
  poblarFiltros();
  renderSeccion();
}

// ---------- Eventos ----------
function iniciar() {
  const sel = $('#zona-horaria');
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zonas = ZONAS.some((z) => z[0] === local) ? ZONAS : [...ZONAS, [local, `Este dispositivo (${local})`]];
  if (!zonas.some((z) => z[0] === estado.zona)) zonas.push([estado.zona, estado.zona]);
  sel.innerHTML = zonas.map(([z, n]) => `<option value="${esc(z)}">${esc(n)}</option>`).join('');
  sel.value = estado.zona;
  sel.addEventListener('change', () => {
    estado.zona = sel.value; almacen.escribir('zona', estado.zona);
    actualizarIndicador(); renderSeccion(); if (estado.detalle) renderDetalle();
  });

  aplicarTema();
  $('#btn-tema').addEventListener('click', () => {
    estado.tema = { auto: 'claro', claro: 'oscuro', oscuro: 'auto' }[estado.tema];
    almacen.escribir('tema', estado.tema);
    aplicarTema(); renderSeccion();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (estado.tema === 'auto') renderSeccion(); });

  $('#btn-preferencias').addEventListener('click', abrirPreferencias);
  $('#dlg-preferencias').addEventListener('close', guardarPreferencias);

  window.addEventListener('hashchange', () => { renderSeccion(); window.scrollTo(0, 0); });

  let demora;
  $('#filtros').addEventListener('input', (ev) => {
    clearTimeout(demora);
    demora = setTimeout(() => { estado.visibles = 30; poblarFiltros(); renderNoticias(); }, ev.target.id === 'f-texto' ? 250 : 0);
  });
  $('#limpiar-filtros').addEventListener('click', () => {
    $('#filtros').reset(); $('#f-periodo').value = '7'; estado.visibles = 30; poblarFiltros(); renderNoticias();
  });
  $('#mas-noticias').addEventListener('click', () => { estado.visibles += 30; renderNoticias(); });

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]');
    if (b?.dataset.accion === 'guardar') {
      alternarGuardada(b.dataset.id);
      const g = Boolean(estado.guardadas[b.dataset.id]);
      for (const btn of $$(`[data-accion="guardar"][data-id="${CSS.escape(b.dataset.id)}"]`)) {
        btn.setAttribute('aria-pressed', String(g));
        btn.innerHTML = ICONO_ESTRELLA + (g ? 'Guardada' : 'Guardar');
      }
      if (seccionActual() === 'guardadas') renderGuardadas();
    }
    if (b?.dataset.accion === 'detalle') {
      estado.detalle = b.dataset.id; renderDetalle();
      $('#detalle-grafico').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const p = ev.target.closest('#periodos button');
    if (p) { estado.periodo = p.dataset.rango; renderDetalle(); }
    const pe = ev.target.closest('#periodos-eia button');
    if (pe) { estado.diasEIA = Number(pe.dataset.dias); renderEIA(); }
  });
  $('#cerrar-detalle').addEventListener('click', () => { estado.detalle = null; $('#detalle-grafico').hidden = true; $('#contenedor-avanzado').innerHTML = ''; });

  $('#eia').addEventListener('pointermove', cursorEIA);
  $('#eia').addEventListener('pointerdown', cursorEIA);

  let notaDemora;
  $('#lista-guardadas').addEventListener('input', (ev) => {
    const id = ev.target.dataset.nota;
    if (!id || !estado.guardadas[id]) return;
    estado.guardadas[id].nota = ev.target.value;
    clearTimeout(notaDemora);
    notaDemora = setTimeout(() => almacen.escribir('guardadas', estado.guardadas), 400);
  });
  $('#exportar').addEventListener('click', exportar);
  $('#importar').addEventListener('change', (ev) => { if (ev.target.files[0]) importar(ev.target.files[0]); ev.target.value = ''; });

  renderSeccion();
  cargarDatos();
  // Relee los JSON cada 5 minutos (no simula precios: solo trae lo que generó el servidor).
  setInterval(cargarDatos, 5 * 60_000);
}

iniciar();
