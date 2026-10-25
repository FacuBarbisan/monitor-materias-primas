import { COMMODITIES, CATEGORIAS, CLAVES_CATEGORIA } from './commodities.js';
// Diccionarios para etiquetar noticias por reglas (sin IA).
// Las palabras clave se comparan sin acentos y en minúsculas, por palabra completa.

export const REGIONES = {
  na: 'América del Norte',
  latam: 'América Latina y el Caribe',
  eu: 'Europa',
  me: 'Medio Oriente y Norte de África',
  af: 'África subsahariana',
  as: 'Asia-Pacífico',
  eurasia: 'Rusia y Asia Central',
  global: 'Global / multilateral',
};

// [código, nombre en español, región, palabras clave]
export const PAISES = [
  ['us', 'Estados Unidos', 'na', ['estados unidos', 'ee. uu.', 'ee.uu.', 'eeuu', 'united states', 'u.s.', 'washington', 'federal reserve', 'reserva federal', 'wall street', 'estadounidense', 'trump', 'michigan', 'texas', 'california', 'cushing']],
  ['ca', 'Canadá', 'na', ['canada', 'canadian', 'canadiense', 'ottawa', 'alberta']],
  ['mx', 'México', 'latam', ['mexico', 'mexican', 'mexicano', 'mexicana', 'pemex', 'banxico']],
  ['ar', 'Argentina', 'latam', ['argentina', 'argentine', 'argentino', 'argentinos', 'buenos aires', 'milei', 'bcra', 'vaca muerta']],
  ['br', 'Brasil', 'latam', ['brasil', 'brazil', 'brazilian', 'brasileno', 'brasilena', 'lula', 'bolsonaro', 'petrobras']],
  ['cl', 'Chile', 'latam', ['chile', 'chilean', 'chileno', 'chilena', 'codelco']],
  ['pe', 'Perú', 'latam', ['peru', 'peruvian', 'peruano', 'peruana']],
  ['co', 'Colombia', 'latam', ['colombia', 'colombian', 'colombiano', 'colombiana', 'ecopetrol']],
  ['ve', 'Venezuela', 'latam', ['venezuela', 'venezuelan', 'venezolano', 'venezolana', 'pdvsa', 'caracas']],
  ['ec', 'Ecuador', 'latam', ['ecuador', 'ecuadorian', 'ecuatoriano']],
  ['bo', 'Bolivia', 'latam', ['bolivia', 'bolivian', 'boliviano']],
  ['uy', 'Uruguay', 'latam', ['uruguay', 'uruguayan', 'uruguayo', 'montevideo']],
  ['py', 'Paraguay', 'latam', ['paraguay', 'paraguayan', 'paraguayo']],
  ['cu', 'Cuba', 'latam', ['cuba', 'cuban', 'cubano', 'cubana', 'la habana', 'havana']],
  ['pa', 'Panamá', 'latam', ['panama', 'panameno', 'canal de panama', 'panama canal']],
  ['gy', 'Guyana', 'latam', ['guyana']],
  ['fk', 'Islas Malvinas / Falklands', 'latam', ['falklands', 'malvinas']],
  ['gb', 'Reino Unido', 'eu', ['reino unido', 'united kingdom', 'uk', 'britain', 'british', 'britanico', 'britanica', 'londres', 'london', 'bank of england', 'banco de inglaterra', 'north sea', 'mar del norte']],
  ['eu', 'Unión Europea / zona euro', 'eu', ['union europea', 'european union', 'eu', 'ue', 'eurozone', 'euro area', 'zona euro', 'eurozona', 'bruselas', 'brussels', 'european central bank', 'banco central europeo', 'bce', 'ecb', 'european commission', 'comision europea']],
  ['de', 'Alemania', 'eu', ['alemania', 'germany', 'german', 'aleman', 'alemana', 'berlin', 'bundesbank']],
  ['fr', 'Francia', 'eu', ['francia', 'france', 'french', 'frances', 'francesa', 'paris', 'macron']],
  ['it', 'Italia', 'eu', ['italia', 'italy', 'italian', 'italiano', 'italiana', 'roma', 'rome']],
  ['es', 'España', 'eu', ['espana', 'spain', 'spanish', 'madrid']],
  ['nl', 'Países Bajos', 'eu', ['paises bajos', 'netherlands', 'dutch', 'holanda', 'rotterdam', 'ttf']],
  ['no', 'Noruega', 'eu', ['noruega', 'norway', 'norwegian', 'equinor']],
  ['pl', 'Polonia', 'eu', ['polonia', 'poland', 'polish', 'varsovia', 'warsaw']],
  ['ua', 'Ucrania', 'eu', ['ucrania', 'ukraine', 'ukrainian', 'ucraniano', 'ucraniana', 'kyiv', 'kiev', 'zelensky']],
  ['tr', 'Turquía', 'me', ['turquia', 'turkiye', 'turkey', 'turkish', 'turco', 'turca', 'ankara', 'erdogan', 'estambul', 'istanbul', 'bosporus', 'bosforo']],
  ['ru', 'Rusia', 'eurasia', ['rusia', 'russia', 'russian', 'ruso', 'rusa', 'moscu', 'moscow', 'kremlin', 'kremlin', 'putin', 'gazprom', 'rosneft']],
  ['kz', 'Kazajistán', 'eurasia', ['kazajistan', 'kazakhstan', 'kazakh']],
  ['sa', 'Arabia Saudita', 'me', ['arabia saudita', 'arabia saudi', 'saudi arabia', 'saudi', 'saudita', 'riad', 'riyadh', 'aramco']],
  ['ae', 'Emiratos Árabes Unidos', 'me', ['emiratos', 'uae', 'united arab emirates', 'dubai', 'abu dhabi']],
  ['qa', 'Qatar', 'me', ['qatar', 'catar', 'doha']],
  ['ir', 'Irán', 'me', ['iran', 'iranian', 'irani', 'teheran', 'tehran', 'hormuz', 'ormuz']],
  ['iq', 'Irak', 'me', ['irak', 'iraq', 'iraqi', 'iraqui', 'bagdad', 'baghdad', 'kurdistan']],
  ['il', 'Israel', 'me', ['israel', 'israeli', 'israeli', 'israelies']],
  ['ps', 'Palestina', 'me', ['palestina', 'palestine', 'palestinian', 'palestino', 'gaza', 'cisjordania', 'west bank']],
  ['sy', 'Siria', 'me', ['siria', 'syria', 'syrian', 'sirio', 'damasco', 'damascus']],
  ['lb', 'Líbano', 'me', ['libano', 'lebanon', 'lebanese', 'beirut', 'hezbollah']],
  ['ye', 'Yemen', 'me', ['yemen', 'yemeni', 'huties', 'houthi', 'houthis', 'bab al-mandeb', 'bab el-mandeb']],
  ['eg', 'Egipto', 'me', ['egipto', 'egypt', 'egyptian', 'egipcio', 'el cairo', 'cairo', 'suez']],
  ['ly', 'Libia', 'me', ['libia', 'libya', 'libyan', 'libio', 'tripoli', 'bengasi', 'benghazi']],
  ['dz', 'Argelia', 'me', ['argelia', 'algeria', 'algerian', 'sonatrach']],
  ['ng', 'Nigeria', 'af', ['nigeria', 'nigerian', 'nigeriano', 'lagos', 'abuja']],
  ['ao', 'Angola', 'af', ['angola', 'angolan', 'angoleno']],
  ['za', 'Sudáfrica', 'af', ['sudafrica', 'south africa', 'south african', 'sudafricano', 'johannesburgo', 'johannesburg', 'pretoria']],
  ['gh', 'Ghana', 'af', ['ghana', 'ghanaian']],
  ['cd', 'R. D. del Congo', 'af', ['congo', 'drc', 'kinshasa']],
  ['et', 'Etiopía', 'af', ['etiopia', 'ethiopia', 'ethiopian']],
  ['ke', 'Kenia', 'af', ['kenia', 'kenya', 'kenyan', 'nairobi']],
  ['mg', 'Madagascar', 'af', ['madagascar']],
  ['cn', 'China', 'as', ['china', 'chinese', 'chino', 'china\'s', 'beijing', 'pekin', 'shanghai', 'xi jinping', 'pboc', 'yuan', 'renminbi']],
  ['hk', 'Hong Kong', 'as', ['hong kong']],
  ['tw', 'Taiwán', 'as', ['taiwan', 'taiwanese', 'taiwanes', 'taipei']],
  ['jp', 'Japón', 'as', ['japon', 'japan', 'japanese', 'japones', 'japonesa', 'tokio', 'tokyo', 'bank of japan', 'banco de japon', 'boj']],
  ['kr', 'Corea del Sur', 'as', ['corea del sur', 'south korea', 'south korean', 'surcoreano', 'seul', 'seoul']],
  ['kp', 'Corea del Norte', 'as', ['corea del norte', 'north korea', 'norcoreano', 'pyongyang']],
  ['in', 'India', 'as', ['india', 'indian', 'indio', 'india\'s', 'nueva delhi', 'new delhi', 'modi', 'mumbai', 'rbi']],
  ['pk', 'Pakistán', 'as', ['pakistan', 'pakistani', 'paquistani', 'islamabad']],
  ['id', 'Indonesia', 'as', ['indonesia', 'indonesian', 'indonesio', 'yakarta', 'jakarta']],
  ['my', 'Malasia', 'as', ['malasia', 'malaysia', 'malaysian']],
  ['ph', 'Filipinas', 'as', ['filipinas', 'philippines', 'philippine', 'filipino', 'manila']],
  ['vn', 'Vietnam', 'as', ['vietnam', 'vietnamese', 'vietnamita']],
  ['th', 'Tailandia', 'as', ['tailandia', 'thailand', 'thai']],
  ['sg', 'Singapur', 'as', ['singapur', 'singapore', 'malacca', 'malaca']],
  ['tl', 'Timor-Leste', 'as', ['timor-leste', 'timor oriental', 'east timor']],
  ['au', 'Australia', 'as', ['australia', 'australian', 'australiano', 'canberra', 'sydney']],
];

// Palabras que indican una región sin un país concreto.
export const REGION_KEYWORDS = {
  eu: ['europe', 'europa', 'european', 'europeo', 'europea', 'europeos'],
  latam: ['latin america', 'america latina', 'latinoamerica', 'sudamerica', 'south america', 'mercosur', 'caribe', 'caribbean'],
  me: ['middle east', 'medio oriente', 'oriente medio', 'oriente proximo', 'gulf', 'golfo persico', 'persian gulf', 'red sea', 'mar rojo'],
  af: ['africa', 'african', 'africano', 'africana', 'sahel'],
  as: ['asia', 'asian', 'asiatico', 'asean', 'southeast asia', 'sudeste asiatico', 'pacific', 'pacifico'],
  global: ['wto', 'omc', 'imf', 'fmi', 'world bank', 'banco mundial', 'g20', 'g7', 'opec', 'opep', 'onu', 'united nations', 'naciones unidas', 'global', 'mundial', 'worldwide'],
};

// Materias primas: se generan desde el catálogo (config/commodities.js).
// [id, nombre, palabras clave, exclusiones, categoría]
export const MATERIAS = COMMODITIES.map((c) => [c.id, c.nombre, c.claves, c.excluir || [], c.categoria]);
export { CATEGORIAS, CLAVES_CATEGORIA };
export const VERSION_TAXONOMIA = 5;

// Temas: [id, nombre, palabras clave, canales de impacto]
// Canales: oferta, demanda, transporte, dolar, tasas, riesgo
export const TEMAS = [
  ['inflacion', 'Inflación', ['inflation', 'inflacion', 'inflationary', 'inflacionario', 'inflacionarias', 'deflation', 'deflacion', 'deflacionarias', 'deflationary', 'cpi', 'ipc', 'consumer prices', 'precios al consumidor', 'cost of living', 'costo de vida', 'coste de la vida'], ['tasas', 'dolar']],
  ['politica_monetaria', 'Tasas y bancos centrales', ['interest rate', 'interest rates', 'tasa de interes', 'tasas de interes', 'tipos de interes', 'rate cut', 'rate cuts', 'rate hike', 'rate hikes', 'recorte de tasas', 'suba de tasas', 'monetary policy', 'politica monetaria', 'central bank', 'banco central', 'federal reserve', 'reserva federal', 'fomc', 'ecb', 'bce', 'bank of england', 'bank of japan', 'pboc', 'bond yields', 'borrowing costs', 'rendimiento de los bonos', 'discount rate', 'prima de riesgo', 'liquidity', 'liquidez'], ['tasas', 'dolar']],
  ['empleo', 'Empleo', ['jobs', 'employment', 'unemployment', 'payrolls', 'jobless', 'labour market', 'labor market', 'empleo', 'empleos', 'desempleo', 'paro', 'mercado laboral', 'workforce', 'despidos', 'layoffs'], ['demanda']],
  ['actividad', 'Actividad económica', ['gdp', 'pib', 'economic growth', 'crecimiento economico', 'recession', 'recesion', 'pmi', 'industrial output', 'industrial production', 'produccion industrial', 'economia', 'economy', 'economic', 'economico', 'economica', 'stimulus', 'estimulo', 'estimulos', 'growth', 'crecimiento'], ['demanda']],
  ['politica_fiscal', 'Gobierno y política fiscal', ['budget', 'presupuesto', 'fiscal', 'tax', 'taxes', 'impuesto', 'impuestos', 'subsidy', 'subsidies', 'subsidio', 'subsidios', 'debt', 'deuda', 'decree', 'decreto', 'government spending', 'gasto publico'], ['demanda']],
  ['conflicto', 'Conflictos y seguridad', ['war', 'guerra', 'conflict', 'conflicto', 'attack', 'attacks', 'ataque', 'ataques', 'missile', 'missiles', 'misil', 'misiles', 'drone', 'drones', 'military', 'militar', 'militares', 'invasion', 'ceasefire', 'alto el fuego', 'troops', 'tropas', 'raid', 'bombing', 'bombardeo', 'coup', 'golpe de estado', 'peace talks', 'conversaciones de paz'], ['riesgo']],
  ['sanciones', 'Sanciones', ['sanction', 'sanctions', 'sancion', 'sanciones', 'embargo', 'price cap', 'tope de precio', 'blacklist', 'lista negra'], ['riesgo', 'oferta']],
  ['aranceles', 'Aranceles y medidas comerciales', ['tariff', 'tariffs', 'arancel', 'aranceles', 'trade war', 'guerra comercial', 'duties', 'anti-dumping', 'antidumping', 'safeguard', 'safeguards', 'salvaguardia', 'salvaguardias', 'import ban', 'export ban', 'quota', 'quotas', 'cuota', 'cuotas', 'import licensing', 'export controls', 'controles a la exportacion'], ['demanda', 'dolar']],
  ['comercio', 'Comercio y acuerdos', ['trade deal', 'trade agreement', 'acuerdo comercial', 'free trade', 'libre comercio', 'tratado', 'wto', 'omc', 'exports', 'export', 'exportaciones', 'exportacion', 'imports', 'importaciones', 'trade surplus', 'trade deficit', 'balanza comercial', 'superavit comercial', 'deficit comercial', 'market access', 'acceso a mercados', 'mercosur', 'trade talks', 'trade tensions', 'trade truce', 'trade peace', 'trade ties', 'trade policy', 'global trade', 'world trade', 'trade flows', 'trade data', 'comercio exterior', 'comercio internacional', 'comercio mundial', 'guerra comercial', 'tensiones comerciales', 'negociaciones comerciales'], ['demanda']],
  ['energia', 'Energía (producción y demanda)', ['energy', 'energia', 'power grid', 'electricity', 'electricidad', 'nuclear', 'renewable', 'renovable', 'renovables', 'solar', 'wind power', 'eolica', 'coal', 'carbon', 'opec', 'opep', 'oil output', 'oil production', 'produccion de petroleo', 'drilling', 'perforacion'], ['oferta', 'demanda']],
  ['mineria', 'Minería y metales', ['mining', 'mineria', 'mines', 'mina', 'minas', 'miner', 'miners', 'minera', 'mineras', 'smelter', 'fundicion', 'metals', 'metales', 'rare earths', 'tierras raras', 'critical minerals', 'minerales criticos'], ['oferta']],
  ['inventarios', 'Inventarios y reservas', ['inventories', 'inventory', 'inventarios', 'stockpile', 'stockpiles', 'reservas estrategicas', 'strategic petroleum reserve', 'spr', 'crude stocks', 'existencias', 'storage', 'almacenamiento'], ['oferta', 'demanda']],
  ['transporte', 'Transporte marítimo y rutas', ['shipping', 'freight', 'flete', 'fletes', 'port', 'ports', 'puerto', 'puertos', 'strait', 'estrecho', 'suez', 'panama canal', 'canal de panama', 'hormuz', 'ormuz', 'bab al-mandeb', 'bab el-mandeb', 'red sea', 'mar rojo', 'container', 'containers', 'contenedor', 'contenedores', 'vessel', 'vessels', 'buque', 'buques', 'tanker', 'tankers', 'maritime', 'maritimo', 'maritima', 'logistics', 'logistica', 'supply chain', 'supply chains', 'cadena de suministro', 'cadenas de suministro', 'sea border', 'frontera maritima'], ['transporte']],
  ['clima', 'Clima y desastres', ['hurricane', 'huracan', 'typhoon', 'tifon', 'cyclone', 'ciclon', 'drought', 'sequia', 'flood', 'floods', 'flooding', 'inundacion', 'inundaciones', 'earthquake', 'terremoto', 'sismo', 'el nino', 'la nina', 'tropical storm', 'winter storm', 'storm surge', 'tormenta tropical', 'tormenta', 'wildfire', 'wildfires', 'incendio forestal', 'incendios forestales', 'heatwave', 'ola de calor', 'frost', 'helada', 'heladas', 'haze'], ['oferta', 'transporte']],
];

// Textos explicativos por canal. Se combinan según la materia prima detectada.
export const CANALES = {
  oferta: {
    nombre: 'Oferta',
    energia: 'Podría alterar la cantidad de crudo, gas o combustibles disponible (producción, exportaciones, refinación o instalaciones afectadas).',
    metales: 'Podría afectar la producción minera o la cantidad de metal disponible para el mercado.',
    granos: 'Podría modificar la producción o los saldos exportables de granos y alimentos.',
    general: 'Podría alterar la producción o las exportaciones de bienes primarios.',
  },
  demanda: {
    nombre: 'Demanda',
    energia: 'Podría cambiar el consumo esperado de energía: más actividad económica suele implicar más demanda de petróleo y gas; menos actividad, lo contrario.',
    metales: 'En la plata y los metales industriales, la actividad industrial pesa en la demanda; en el oro, la demanda de inversión y de bancos centrales suele pesar más.',
    granos: 'Podría cambiar las compras de importadores o el consumo de alimentos.',
    general: 'Podría cambiar el consumo o las compras de materias primas por parte de empresas y países.',
  },
  transporte: {
    nombre: 'Transporte',
    general: 'Podría encarecer o demorar fletes y seguros, o desviar rutas. Suele afectar el costo y el plazo de entrega más que la producción.',
  },
  dolar: {
    nombre: 'Dólar',
    general: 'Estas materias primas cotizan en dólares: un dólar más fuerte tiende a encarecerlas para compradores de otros países y puede presionar a la baja su precio en USD, aunque esa relación no se cumple siempre.',
  },
  tasas: {
    nombre: 'Tasas de interés',
    general: 'Tasas más altas aumentan el costo de oportunidad de mantener oro y plata (no pagan interés) y pueden enfriar la actividad; tasas más bajas, lo contrario. Importa la diferencia con lo que el mercado ya esperaba.',
  },
  riesgo: {
    nombre: 'Riesgo geopolítico',
    general: 'Aumenta la incertidumbre: suele elevar la demanda de activos refugio como el oro y puede sumar una prima de riesgo al petróleo si involucra zonas productoras o rutas clave.',
  },
};
