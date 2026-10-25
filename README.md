# Monitor de Materias Primas (v4)

Página web personal y educativa: catálogo de materias primas con precios de referencia verificables, ficha por producto con gráfico y noticias relacionadas, y noticias internacionales con imágenes de sus fuentes.

Todo lo externo lo consulta el **actualizador de GitHub Actions** (sin problemas de CORS). La página publicada en GitHub Pages solo lee los archivos que ese actualizador genera. La única excepción son los widgets oficiales de TradingView, que se cargan al abrir una ficha.

## Qué hay de nuevo

- **Catálogo** de 55 materias primas en 8 categorías: energía, metales preciosos, metales industriales, granos, aceites y derivados, ganadería y pesca, otros agrícolas y fertilizantes. Tiene buscador y filtros por categoría. Al abrir la página se muestra **solo la tabla**; la historia de precios y el widget se descargan recién al abrir una ficha.
- **Ficha** de cada materia prima:
  - Precio de referencia con variación, moneda, unidad, proveedor, fecha del dato, tipo de precio y demora.
  - Gráfico interactivo con elección de período.
  - Widget de TradingView cuando existe.
  - Noticias que mencionan específicamente ese producto, con la palabra que las vinculó y una interpretación rotulada como tal.
- **Noticias con imagen:** foto que publica la propia fuente en su RSS, con crédito. Si la fuente no publica imagen, o si la imagen no carga, se muestra un bloque visual con el nombre del medio, sin inventar una foto.

## De dónde salen los precios (sin costo)

| Proveedor | Qué aporta | Tipo de dato | Demora |
|---|---|---|---|
| **EIA** (API v2) | WTI y Brent | Spot diario oficial | 1 a 2 días hábiles |
| **FRED** (Fed de St. Louis) | Gas Henry Hub, gasolina, gasóleo, jet fuel y propano | Spot diario | Algunos días |
| **FRED** (series del FMI) | La mayoría de los metales, granos, aceites, carnes y agrícolas | Promedio mensual | 1 a 3 meses |
| **Banco Mundial** (Pink Sheet, CC BY 4.0) | Oro, plata, platino, sorgo y fertilizantes (urea, DAP, TSP, cloruro de potasio, roca fosfórica) | Promedio mensual | Aproximadamente 1 mes |
| **TradingView** (widget) | Gráfico en vivo para 12 productos | Contado OTC o CFD; nunca futuros oficiales | La indica el propio widget |

**No son cotizaciones en tiempo real**, salvo los widgets. Cada precio muestra la fecha del dato. En cada corrida el actualizador comprueba cada serie: si una fuente no responde o un código no existe, la ficha lo dice y no muestra ningún precio. Todo queda en **Fuentes → Verificación de cada serie de precios**.

**Sin precio gratuito verificable:** paladio (tiene widget), litio y tierras raras. Esas fichas muestran solo noticias.

## Archivos que tenés que reemplazar o agregar en GitHub

Subí el contenido de la carpeta `actualizar-en-github` del ZIP (en el repositorio: **Add file → Upload files**, arrastrá las carpetas y tocá **Commit changes**). Los archivos con la misma ruta se reemplazan.

| Archivo | Acción |
|---|---|
| `public/index.html`, `public/app.js`, `public/styles.css` | Reemplazar |
| `scripts/update.js` | Reemplazar |
| `scripts/precios.js` | **Nuevo** |
| `config/commodities.js` | **Nuevo** |
| `config/taxonomy.js` | Reemplazar |
| `lib/classify.js`, `lib/rss.js`, `lib/eia.js` | Reemplazar |
| `lib/fred.js`, `lib/xlsx.js`, `lib/worldbank.js` | **Nuevos** |
| `test/pruebas.test.js` | Reemplazar |
| `test/fixtures/pinksheet-prueba.xlsx` | **Nuevo** (datos sintéticos, solo para las pruebas) |
| `package.json`, `README.md` | Reemplazar |
| `.github/workflows/actualizar.yml` | Reemplazar (agrega la clave opcional de FRED) |

**No toques** `public/data/` ni `state/`: los mantiene el actualizador. Después de subir, en **Actions** ejecutá **Run workflow** una vez. La primera corrida tarda 1 o 2 minutos más porque descarga la historia de precios.

## Claves opcionales (gratuitas)

No son obligatorias. Mejoran la estabilidad:

- **`EIA_API_KEY`**: se pide en <https://www.eia.gov/opendata/register.php>.
- **`FRED_API_KEY`**: se pide en <https://fredaccount.stlouisfed.org/apikeys>. Sin esta clave se usa la descarga pública de FRED, que a veces está en mantenimiento.

Para cargarlas: **Settings → Secrets and variables → Actions → New repository secret**, con exactamente esos nombres.

## Costo

Nada. GitHub Actions y GitHub Pages son gratuitos en repositorios públicos. Las fuentes de precios y noticias son públicas. No hay servicios pagos.

## Lo que se conserva

Favoritos, notas y noticias guardadas (mismo almacenamiento del navegador; los favoritos de materias primas genéricas se convierten solos, por ejemplo “petróleo” pasa a WTI y Brent), filtros, modo claro/oscuro, zona horaria y la actualización automática cada 30 minutos.
