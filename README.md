# Monitor de Materias Primas — versión 1

Aplicación web personal, en español, para seguir **oro, plata, WTI y Brent**, noticias económicas internacionales y acontecimientos geopolíticos, con filtros por país, región, materia prima, tema, fuente y fecha.

> Proyecto educativo. No es asesoramiento financiero.

---

## 1. Qué está conectado de verdad (verificado el 22/10/2026)

| Parte | Fuente | Tipo de dato | Costo |
|---|---|---|---|
| Oro y plata | Widget oficial de TradingView, símbolos `OANDA:XAUUSD` y `OANDA:XAGUSD` | Spot OTC (contado extrabursátil), USD por onza troy | Gratis |
| WTI y Brent | Widget oficial de TradingView, símbolos `TVC:USOIL` y `TVC:UKOIL` | **CFD** (TradingView los rotula así). No son el futuro oficial y no tienen vencimiento. USD por barril | Gratis |
| Petróleo oficial | API v2 de la EIA, series `RWTC` (WTI Cushing) y `RBRTE` (Brent Europa) | Spot FOB diario oficial, 1–2 días hábiles de rezago | Gratis (clave gratuita recomendada) |
| Noticias | 15 feeds RSS públicos: BBC Business, BBC Mundo, DW Español, France 24 Español (Economía y América Latina), Al Jazeera, SCMP (Business y China), MercoPress, EIA (2), Reserva Federal, BCE, OMC y Noticias ONU | Título, fecha, extracto y enlace al original | Gratis |
| Traducción/resumen con IA | API de Anthropic (Claude Haiku 4.5) | Opcional. Siempre aparece rotulado “Traducido con IA” | Pago por uso (ver sección 6) |

**Futuros de bolsa:** COMEX, NYMEX e ICE **no** están disponibles en los widgets gratuitos de TradingView. Al probarlos, el widget muestra “Este símbolo solo está disponible en TradingView”. Para usarlos hace falta una licencia de datos de bolsa.

**No conectado:** Reuters y AP (requieren licencia paga), OPEP (bloquea el acceso automático), FMI (no se encontró un RSS que funcione), AIE, LBMA y GDELT. El detalle está en la sección *Fuentes y estado* de la app.

### Cómo se protegen los datos

- Las cotizaciones de TradingView se **muestran** dentro de su widget. La app no las lee ni las guarda.
- De cada medio se usan solo el título, el extracto que publica en su RSS y el enlace. No se copian artículos ni se eluden suscripciones.
- Las etiquetas (país, materia prima, tema) y los “canales de impacto” son **interpretaciones automáticas por palabras clave**. La app las rotula así y advierte que no prueban que una noticia haya movido un precio.
- Si una fuente falla, se conservan sus noticias anteriores y la app muestra una advertencia con la hora del último dato válido.

## 2. Arquitectura (y por qué)

- **`scripts/update.js`** descarga los feeds y la EIA, etiqueta, agrupa las coberturas del mismo hecho y guarda JSON en `public/data/`. Es el “backend”: corre en un servidor, nunca en tu navegador, y es el único que usa las claves.
- **`public/`** es la web (HTML, CSS y JS sin librerías). Lee esos JSON y muestra los widgets de TradingView.
- **GitHub Actions** ejecuta la actualización **cada 30 minutos aunque la página esté cerrada**, y **GitHub Pages** publica la web. Para un repositorio público, las dos cosas son gratis.
- No usa dependencias externas, así que no hay nada que instalar ni actualizar.

Elegí esta arquitectura porque es la más simple y gratuita que cumple todo lo pedido: actualización programada, claves protegidas (quedan en *Secrets* de GitHub), caché (ETag/Last-Modified), límite de consultas por fuente, reintentos y registro de errores.

**Dónde se guardan tus favoritos, noticias guardadas y notas:** en el almacenamiento local de tu navegador. No se envían a ningún servidor. Si cambiás de navegador o borrás sus datos, se pierden. Por eso la app tiene **Exportar / Importar copia**. Una base de datos en la nube, para sincronizar entre dispositivos, queda para la etapa 2.

## 3. Publicarla gratis con GitHub (paso a paso, sin programar)

1. Creá una cuenta gratuita en <https://github.com>.
2. Arriba a la derecha: **+ → New repository**. Nombre: `monitor-materias-primas`. Elegí **Public** (en el plan gratuito, Pages y Actions son gratis solo en repositorios públicos). Tocá **Create repository**.
3. En el repositorio vacío: **uploading an existing file**. Descomprimí el ZIP en tu computadora y arrastrá **todo el contenido** de la carpeta `monitor` (no la carpeta en sí). Tocá **Commit changes**.
4. **Importante:** las carpetas que empiezan con punto (`.github`) a veces no se suben al arrastrar. Revisá si aparece la carpeta `.github`. Si no aparece: **Add file → Create new file**, escribí como nombre `.github/workflows/actualizar.yml`, pegá el contenido de ese archivo del ZIP y tocá **Commit changes**.
5. **Settings → Pages →** en *Build and deployment / Source* elegí **GitHub Actions**.
6. (Recomendado) Pedí tu clave gratuita de la EIA en <https://www.eia.gov/opendata/register.php>. Llega por correo. Después: **Settings → Secrets and variables → Actions → New repository secret**, nombre `EIA_API_KEY`, valor: tu clave.
7. Pestaña **Actions → “Actualizar datos y publicar” → Run workflow**. En 1 o 2 minutos debería quedar en verde.
8. La dirección de tu app aparece en **Settings → Pages** (algo como `https://TU-USUARIO.github.io/monitor-materias-primas/`). Abrila en la compu o en el celular.

A partir de ahí se actualiza sola cada 30 minutos. GitHub puede demorar algunos minutos los procesos programados. En repositorios públicos, GitHub desactiva los procesos programados si el repositorio pasa 60 días sin actividad. Si eso ocurre, la app avisa que los datos están viejos; se reactiva desde la pestaña **Actions**.

**Privacidad:** al ser público, el código y las noticias recolectadas son visibles para cualquiera. Tus notas y favoritos **no**, porque quedan en tu navegador.

## 4. Conservar el código

- Guardá el ZIP en tu computadora o en tu nube (Drive, OneDrive, etc.).
- Una vez subido a GitHub, el repositorio es tu copia principal, con historial de cambios. Desde **Code → Download ZIP** podés bajarlo cuando quieras.

## 5. Usarla en tu computadora (opcional)

1. Instalá Node.js 20 o superior desde <https://nodejs.org> (versión LTS).
2. Abrí una terminal en la carpeta del proyecto.
3. Copiá `.env.example` como `.env` y completá las claves que tengas.
4. Ejecutá `npm start` y abrí <http://localhost:3000>. Mientras esté encendido, actualiza cada 10 minutos (cada fuente respeta su propia frecuencia).

Otros comandos: `npm run actualizar` (una actualización), `npm test` (pruebas) y `npm run datos-prueba` (carga datos de prueba rotulados como tales; no lo uses en el repositorio publicado).

## 6. Servicios pagos (no contratados; pedime confirmación antes)

| Servicio | Para qué | Costo aproximado (oct. 2026) |
|---|---|---|
| API de Anthropic (Claude Haiku 4.5) | Traducir títulos y resumir extractos | USD 1 por millón de tokens de entrada y USD 5 por millón de salida. Con ~150 noticias nuevas por día: **unos USD 4–5 por mes**. Se limita con `AI_MAX_POR_CORRIDA`. |
| Railway (u otro hosting con servidor siempre encendido) | Alternativa a GitHub si querés un servidor propio | Plan Hobby: USD 5 por mes, con USD 5 de uso incluido. No tiene plan gratuito permanente. |
| Licencia de datos de bolsa / Reuters / AP / LBMA | Futuros oficiales con vencimiento, agencias de noticias y precios de referencia oficiales | Contratos comerciales: cotización a pedido |

Para activar la IA: creá una clave en <https://console.anthropic.com>, cargale crédito y agregala como secret `ANTHROPIC_API_KEY`. Si no la configurás, la app funciona igual con los títulos originales y un botón “Traducir (Google)” que abre la traducción en otra pestaña.

## 7. Estructura

```
config/sources.js      fuentes conectadas y pendientes
config/taxonomy.js     países, regiones, materias primas, temas y canales de impacto
lib/                   lector RSS/Atom, clasificador, agrupador, EIA, IA
scripts/update.js      actualización (la que corre GitHub Actions)
server.js              servidor opcional para uso local
public/                la web
test/                  pruebas automáticas y datos reales capturados para pruebas
.github/workflows/     actualización programada y publicación
```

## 8. Próxima etapa

Calendario económico, hipótesis con seguimiento, simulador de operaciones (Incoterms, flete, seguro, financiamiento), indicadores del Banco Mundial y del FMI, y base de datos para sincronizar notas entre dispositivos.
