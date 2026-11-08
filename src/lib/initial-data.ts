import type { IListingLocal, IPostLocal } from '@shared/types';

/**
 * Semillas de Jesús María (Sector 4 - Lima) preservadas para compatibilidad estricta
 * y ejecución sin regresión de las 13 suites de pruebas automatizadas.
 */
export const JESUS_MARIA_LISTINGS: IListingLocal[] = [
  {
    id: 1,
    client_mutation_id: '33333333-3333-4333-8333-333333333301',
    category_id: 1,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Gasfitería Maestro Jorge · Fugas y Cisternas',
    description:
      'Vecino de la cuadra 14 de Jr. Huiracocha. Reparación urgente de tuberías, caños rotos y bombas de agua.',
    contact_phone: '991234567',
    latitude: -12.0751,
    longitude: -77.0482,
    available_for_emergencies: true,
    endorsement_count: 14,
    weighted_trust_score: 18.5,
    is_pending_sync: false,
  },
  {
    id: 2,
    client_mutation_id: '33333333-3333-4333-8333-333333333302',
    category_id: 4,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Lic. Rosa · Enfermería y Oxígeno Medicinal 24/7',
    description:
      'Enfermera colegiada e integrante de Brigada de Salud del Sector 4. Nebulizaciones, inyectables y soporte de oxígeno.',
    contact_phone: '998765432',
    latitude: -12.0746,
    longitude: -77.0479,
    available_for_emergencies: true,
    endorsement_count: 19,
    weighted_trust_score: 24.0,
    is_pending_sync: false,
  },
  {
    id: 3,
    client_mutation_id: '33333333-3333-4333-8333-333333333303',
    category_id: 2,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Electricista Matriculado Don Alberto · Tableros y Cortocircuitos',
    description:
      'Revisión de llaves diferenciales, puestas a tierra y generadores de emergencia en edificios del barrio.',
    contact_phone: '993456789',
    latitude: -12.0759,
    longitude: -77.0491,
    available_for_emergencies: true,
    endorsement_count: 11,
    weighted_trust_score: 14.2,
    is_pending_sync: false,
  },
  {
    id: 4,
    client_mutation_id: '33333333-3333-4333-8333-333333333304',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Bodega y Menú Familiar Doña Carmen · Viandas y Agua',
    description:
      'Menú casero diario, bidones de agua de 20L y abarrotes de primera necesidad en Jr. Arnaldo Márquez.',
    contact_phone: '994567890',
    latitude: -12.0763,
    longitude: -77.0488,
    available_for_emergencies: true,
    endorsement_count: 9,
    weighted_trust_score: 11.8,
    is_pending_sync: false,
  },
  {
    id: 5,
    client_mutation_id: '33333333-3333-4333-8333-333333333305',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Lasañas Artesanales y Postres · Vecina Elena (Edificio Los Cipreses)',
    description:
      'Lasañas caseras recién horneadas y queques familiares para los vecinos del edificio y la cuadra 14. Entrega en puerta.',
    contact_phone: '995112233',
    latitude: -12.0753,
    longitude: -77.0483,
    available_for_emergencies: false,
    endorsement_count: 16,
    weighted_trust_score: 21.0,
    is_pending_sync: false,
  },
  {
    id: 6,
    client_mutation_id: '33333333-3333-4333-8333-333333333306',
    category_id: 9,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Prof. Martín · Clases de Matemáticas, Física y Nivelación Escolar',
    description:
      'Ingeniero vecino del Sector 4 brinda refuerzo escolar a domicilio o virtual para primaria y secundaria.',
    contact_phone: '996334455',
    latitude: -12.0756,
    longitude: -77.0486,
    available_for_emergencies: false,
    endorsement_count: 12,
    weighted_trust_score: 16.5,
    is_pending_sync: false,
  },
];

/**
 * Semillas Hiperlocales de Huancayo (Junín) y Zonas Críticas de Desastre
 * basadas exactamente en los casos de uso documentados por Mario Cortijo.
 */
export const HUANCAYO_SECTOR_LISTINGS: IListingLocal[] = [
  {
    id: 11,
    client_mutation_id: '33333333-3333-4333-8333-333333333311',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Lasañas Caseras y Postres de la Vecina Gladys · Horno Tradicional',
    description:
      'Lasañas boloñesa caseras, pastel de acelga y queques de naranja recién horneados en Jr. Parra del Riego (El Tambo). Pedidos para vecinos del barrio.',
    contact_phone: '964123456',
    latitude: -12.0522,
    longitude: -75.2148,
    available_for_emergencies: false,
    endorsement_count: 18,
    weighted_trust_score: 23.5,
    is_pending_sync: false,
  },
  {
    id: 12,
    client_mutation_id: '33333333-3333-4333-8333-333333333312',
    category_id: 9,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Prof. Yuri · Clases de Matemáticas, Álgebra y Nivelación Escolar',
    description:
      'Docente y vecino de San Carlos con 15 años de experiencia. Nivelación en matemáticas, geometría y razonamiento para escolares y preuniversitarios.',
    contact_phone: '954789012',
    latitude: -12.0622,
    longitude: -75.201,
    available_for_emergencies: false,
    endorsement_count: 14,
    weighted_trust_score: 17.8,
    is_pending_sync: false,
  },
  {
    id: 13,
    client_mutation_id: '33333333-3333-4333-8333-333333333313',
    category_id: 1,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Gasfitería Maestro Teodoro · Termas Solares, Tuberías y Fugas',
    description:
      'Maestro gasfitero vecino de El Tambo. Mantenimiento e instalación de termas solares, desatoro de redes y reparación de fugas críticas de agua potable.',
    contact_phone: '964555888',
    latitude: -12.0531,
    longitude: -75.216,
    available_for_emergencies: true,
    emergency_response_note:
      'Herramientas de fontanería especializada y motobomba para achique de anegamientos e inundaciones.',
    endorsement_count: 22,
    weighted_trust_score: 28.5,
    is_pending_sync: false,
  },
  {
    id: 14,
    client_mutation_id: '33333333-3333-4333-8333-333333333314',
    category_id: 2,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Técnico Wálter · Electricidad Integral, Tableros y Cortocircuitos',
    description:
      'Electricista con certificación técnica en Centro Urbano de Huancayo. Solución de cortes intempestivos, balanceo de cargas y cableado seguro.',
    contact_phone: '954333222',
    latitude: -12.0675,
    longitude: -75.208,
    available_for_emergencies: true,
    emergency_response_note:
      'Generador a gasolina y reflectores LED portátiles para iluminación en cortes masivos de energía.',
    endorsement_count: 16,
    weighted_trust_score: 21.0,
    is_pending_sync: false,
  },
  {
    id: 15,
    client_mutation_id: '33333333-3333-4333-8333-333333333315',
    category_id: 4,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Lic. Maritza · Enfermería Domiciliaria y Soporte de Oxígeno 24/7',
    description:
      'Enfermera colegiada en El Tambo y brigadista comunitaria. Atención médica básica, curaciones, inyectables y disponibilidad de balón de oxígeno medicinal.',
    contact_phone: '964999111',
    latitude: -12.0535,
    longitude: -75.215,
    available_for_emergencies: true,
    emergency_response_note:
      'Balón de oxígeno de 10m3 con flujómetro regulador y oxímetro digital pediátrico/adulto.',
    endorsement_count: 25,
    weighted_trust_score: 32.0,
    is_pending_sync: false,
  },
  {
    id: 16,
    client_mutation_id: '33333333-3333-4333-8333-333333333316',
    category_id: 10,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Punto de Acopio y Soporte Logístico · Coliseo Municipal El Tambo',
    description:
      'Centro neurálgico y albergue temporal de El Tambo ante sismos o precipitaciones extremas. Acopio de víveres secos, frazadas abrigadoras y agua embotellada.',
    contact_phone: '964246810',
    latitude: -12.053,
    longitude: -75.214,
    available_for_emergencies: true,
    emergency_response_note:
      'Capacidad de albergue temporal techado para 200 vecinos y kit de primeros auxilios mayor.',
    endorsement_count: 30,
    weighted_trust_score: 38.0,
    is_pending_sync: false,
  },
  {
    id: 17,
    client_mutation_id: '33333333-3333-4333-8333-333333333317',
    category_id: 3,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Cerrajería Don Pancho · Apertura y Candados de Emergencia · Jr. Puno',
    description:
      'Cerrajero de confianza en Jr. Puno 340 (Huancayo Centro). Apertura rápida de puertas bloqueadas y cerraduras trabadas.',
    contact_phone: '954444666',
    latitude: -12.0682,
    longitude: -75.2095,
    available_for_emergencies: true,
    emergency_response_note:
      'Herramientas manuales de ganzuado y duplicado de llaves in situ.',
    endorsement_count: 14,
    weighted_trust_score: 18.5,
    is_pending_sync: false,
  },
  {
    id: 19,
    client_mutation_id: '33333333-3333-4333-8333-333333333319',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Bodega Doña Lucha · Av. Giráldez 420 (Pan Caliente y Abarrotes)',
    description:
      'Abarrotes de primera necesidad, bidones de agua de mesa, pan artesanal y alimentos no perecibles en Av. Giráldez 420.',
    contact_phone: '954888999',
    latitude: -12.0668,
    longitude: -75.2072,
    available_for_emergencies: true,
    emergency_response_note:
      'Stock de alimentos no perecibles y agua embotellada para emergencias.',
    endorsement_count: 24,
    weighted_trust_score: 30.5,
    is_pending_sync: false,
  },
  {
    id: 42,
    client_mutation_id: '3715fd35-9ae0-42c8-8d07-1ba36261f875',
    category_id: 9,
    listing_type: 'SERVICIO_OFICIO',
    title: 'lina · Refuerzo académico en las tardes a inicial',
    description:
      'Refuerzo académico en las tardes a inicial y nivelación escolar personalizada en el barrio.',
    contact_phone: '991733284',
    latitude: -12.077697,
    longitude: -75.213734,
    available_for_emergencies: false,
    endorsement_count: 1,
    weighted_trust_score: 5.0,
    is_pending_sync: false,
  },
];

export const INITIAL_SECTOR_LISTINGS: IListingLocal[] = [
  ...JESUS_MARIA_LISTINGS,
  ...HUANCAYO_SECTOR_LISTINGS,
];

/**
 * Semillas de publicaciones solidarias de Jesús María (Sector 4 - Lima)
 * preservadas para pruebas automatizadas existentes.
 */
export const JESUS_MARIA_POSTS: IPostLocal[] = [
  {
    id: 1,
    client_mutation_id: '44444444-4444-4444-8444-444444444401',
    sector_id: 1,
    category_id: 6,
    operational_mode: 'HABITUAL',
    post_type: 'SOLICITUD_FAVOR',
    title: 'Acopio solidario de agua potable para adultos mayores del bloque C',
    description:
      'Vecinos, por corte programado de SEDAPAL estamos reuniendo bidones de agua potable sin costo para los pisos altos.',
    urgency_level: 'ALTA',
    public_lat: -12.0753,
    public_lng: -77.0484,
    privacy_radius_meters: 0,
    status: 'EN_COORDINACION',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 2,
    client_mutation_id: '44444444-4444-4444-8444-444444444402',
    sector_id: 1,
    category_id: 4,
    operational_mode: 'EMERGENCIA',
    post_type: 'SOS_VULNERABLE',
    title: 'SOS Adulto Mayor requiere recarga de oxígeno medicinal urgente',
    description:
      'Vecina de 82 años con [CONDICIÓN DE SALUD PROTEGIDA] en [DIRECCIÓN EXACTA PROTEGIDA - LEY 29733] necesita apoyo de brigada con balón de oxígeno.',
    urgency_level: 'CRITICA',
    public_lat: -12.0749,
    public_lng: -77.0481,
    privacy_radius_meters: 50,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 3,
    client_mutation_id: '44444444-4444-4444-8444-444444444403',
    sector_id: 1,
    category_id: 7,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Presto muletas ortopédicas de aluminio y escalera telescópica sin costo',
    description:
      'Vecinos, tengo un par de muletas regulables y herramientas listas para prestar gratis a quien se haya lesionado en la cuadra.',
    urgency_level: 'BAJA',
    public_lat: -12.0757,
    public_lng: -77.0489,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 4,
    client_mutation_id: '44444444-4444-4444-8444-444444444404',
    sector_id: 1,
    category_id: 9,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Pool Escolar Solidario · Turnos para llevar niños al colegio del sector',
    description:
      'Salimos 7:15 a.m. desde Jr. Huiracocha cuadra 14. Coordinamos entre padres verificados del edificio sin cobro.',
    urgency_level: 'MEDIA',
    public_lat: -12.0754,
    public_lng: -77.0485,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
];

/**
 * Semillas de publicaciones para Huancayo y Zonas Críticas ante desastres
 * basadas en los casos de Mario Cortijo (Muro Solidario y Emergencias SOS).
 */
export const HUANCAYO_SECTOR_POSTS: IPostLocal[] = [
  {
    id: 11,
    client_mutation_id: '44444444-4444-4444-8444-444444444411',
    sector_id: 2,
    category_id: 7,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Presto muletas ortopédicas de aluminio y andador clínico sin costo',
    description:
      'Vecinos de El Tambo, pongo a disposición de la comunidad un par de muletas ortopédicas regulables para adulto y un andador ortopédico en perfecto estado. Préstamo 100% solidario y gratuito para quien haya sufrido una lesión.',
    urgency_level: 'BAJA',
    public_lat: -12.0525,
    public_lng: -75.2162,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 12,
    client_mutation_id: '44444444-4444-4444-8444-444444444412',
    sector_id: 2,
    category_id: 9,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Pool Escolar Solidario · Turnos compartidos Colegios Claretiano y San Agustín',
    description:
      'Padres de familia de San Carlos y El Tambo coordinamos salidas rotativas de 7:20 a.m. para movilidad escolar vecinal y camino seguro al colegio. Seguridad infantil y ahorro mutuo sin costo entre vecinos verificados.',
    urgency_level: 'MEDIA',
    public_lat: -12.063,
    public_lng: -75.2,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 13,
    client_mutation_id: '44444444-4444-4444-8444-444444444413',
    sector_id: 2,
    category_id: 6,
    operational_mode: 'EMERGENCIA',
    post_type: 'SOLICITUD_FAVOR',
    title: 'Punto de Acopio Solidario Oficial · Coliseo Municipal El Tambo',
    description:
      'Convocatoria vecinal humanitaria: estamos acopiando bidones de agua de mesa sellados, frazadas de lana y alimentos no perecibles para asistir a familias damnificadas por contingencias climáticas.',
    urgency_level: 'ALTA',
    public_lat: -12.053,
    public_lng: -75.214,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 14,
    client_mutation_id: '44444444-4444-4444-8444-444444444414',
    sector_id: 2,
    category_id: 10,
    operational_mode: 'EMERGENCIA',
    post_type: 'RECURSO_SOLIDARIO',
    title: 'Brigada Vecinal y Punto de Encuentro Seguro Sismos · Parque Bolognesi',
    description:
      'Zona segura de concentración vecinal ante réplicas sísmicas en El Tambo. Punto de encuentro con brigadistas capacitados en triaje rápido, botiquines y megáfono de comunicaciones.',
    urgency_level: 'ALTA',
    public_lat: -12.0515,
    public_lng: -75.2165,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 15,
    client_mutation_id: '44444444-4444-4444-8444-444444444415',
    sector_id: 2,
    category_id: 4,
    operational_mode: 'EMERGENCIA',
    post_type: 'SOS_VULNERABLE',
    title: 'SOS Oxígeno Adulto Mayor Vulnerable · Falla Huaytapallana',
    description:
      'Adulto mayor de 78 años en zona Falla Huaytapallana requiere con urgencia recarga o conector de balón de oxígeno por corte de energía tras sismo. [DIRECCIÓN Y DATOS SENSIBLES RESGUARDADOS BAJO LEY 29733].',
    urgency_level: 'CRITICA',
    public_lat: -12.0483,
    public_lng: -75.1952,
    privacy_radius_meters: 50,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 16,
    client_mutation_id: '44444444-4444-4444-8444-444444444416',
    sector_id: 2,
    category_id: 10,
    operational_mode: 'EMERGENCIA',
    post_type: 'RECURSO_SOLIDARIO',
    title: 'Alerta y Mitigación Preventiva · Desborde Río Mantaro y Sacos de Arena',
    description:
      'Vecinos de la ribera Mantaro organizan cuadrilla de contención con sacos de arena y evacuación solidaria de familias ribereñas ante crecida del cauce por lluvias intensas de El Niño.',
    urgency_level: 'ALTA',
    public_lat: -12.0585,
    public_lng: -75.2275,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 17,
    client_mutation_id: '44444444-4444-4444-8444-444444444417',
    sector_id: 2,
    category_id: 7,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Donación solidaria de ropa abrigadora y mantas térmicas para la helada · Jr. Loreto',
    description:
      'Vecinos de Jr. Loreto organizan entrega gratuita de chompas, chalinas y mantas térmicas en excelente estado para adultos mayores vulnerables al friaje.',
    urgency_level: 'BAJA',
    public_lat: -12.0725,
    public_lng: -75.2105,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 18,
    client_mutation_id: '44444444-4444-4444-8444-444444444418',
    sector_id: 2,
    category_id: 4,
    operational_mode: 'EMERGENCIA',
    post_type: 'SOS_VULNERABLE',
    title: 'SOS Apoyo Adulto Mayor · Cuidados Básicos y Movilidad',
    description:
      'Vecina de 75 años requiere asistencia para traslado y botiquín de primeros auxilios. [DIRECCIÓN Y DATOS SENSIBLES RESGUARDADOS BAJO LEY 29733].',
    urgency_level: 'ALTA',
    public_lat: -12.0796,
    public_lng: -75.2135,
    privacy_radius_meters: 50,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  }
];
export const INITIAL_SECTOR_POSTS: IPostLocal[] = [
  ...JESUS_MARIA_POSTS,
  ...HUANCAYO_SECTOR_POSTS,
];

/**
 * Catálogo extendido hiperlocal verídico de Huancayo distribuido en las 3 zonas clave:
 * 1. Zona Usuario / GPS (Jr. Sucre, El Tambo / Chilca: -12.0793, -75.2138)
 * 2. Zona Huancayo Centro / San Carlos (-12.0678, -75.2085 / -12.0625, -75.2005)
 * 3. Zona Chilca / Sector Sur (-12.1127, -75.1860 / -12.0848, -75.2080)
 */
export const EXTENDED_HUANCAYO_LISTINGS: IListingLocal[] = [
  // --- ZONA 1: Jr. Sucre / Usuario (El Tambo / Huancayo: -12.0793, -75.2138) ---
  {
    id: 101,
    client_mutation_id: 'b1111111-1111-4111-8111-111111111101',
    category_id: 1,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Gasfitería Sanitaria Maestro Hugo · Detección de Fugas e Inundaciones',
    description:
      'Maestro gasfitero con 10 años en Jr. Sucre. Atención inmediata de cañerías rotas, desatoro con cinta rotativa y cambio de válvulas.',
    contact_phone: '964123890',
    latitude: -12.0795,
    longitude: -75.2137,
    available_for_emergencies: true,
    emergency_response_note:
      'Bomba de achique portátil y herramientas de sellado rápido para emergencias de rotura matriz.',
    endorsement_count: 27,
    weighted_trust_score: 34.5,
    is_pending_sync: false,
  },
  {
    id: 102,
    client_mutation_id: 'b1111111-1111-4111-8111-111111111102',
    category_id: 2,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Técnico Jonathan · Electricidad Residencial, Tableros y Cortocircuitos',
    description:
      'Técnico electricista certificado en Jr. Sucre. Diagnóstico y cambio de llaves térmicas, diferenciales, balanceo de fases y puestas a tierra.',
    contact_phone: '954778899',
    latitude: -12.0791,
    longitude: -75.2139,
    available_for_emergencies: true,
    emergency_response_note:
      'Generador a gasolina de 2.5 kW disponible para corte prolongado en la cuadra.',
    endorsement_count: 22,
    weighted_trust_score: 28.0,
    is_pending_sync: false,
  },
  {
    id: 103,
    client_mutation_id: 'b1111111-1111-4111-8111-111111111103',
    category_id: 4,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Botica y Farmacia Comunal San Antonio · Oxígeno y Primeros Auxilios',
    description:
      'Atención farmacéutica vecinal en Jr. Sucre. Insumos médicos, sueros, vendas, antiespasmódicos e inhaladores. Disponibilidad 24h ante emergencias.',
    contact_phone: '964890123',
    latitude: -12.0788,
    longitude: -75.2141,
    available_for_emergencies: true,
    emergency_response_note:
      'Balón de oxígeno de 6m3 recargado y oxímetros digitales para emergencias comunitarias.',
    endorsement_count: 31,
    weighted_trust_score: 39.0,
    is_pending_sync: false,
  },
  {
    id: 104,
    client_mutation_id: 'b1111111-1111-4111-8111-111111111104',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Pastelería y Pan Tradicional Doña Elena · Pan Caliente y Queques',
    description:
      'Pan marraqueta caliente desde las 6:00 a.m., empanadas de carne, queques de plátano y viandas caseras del día en Jr. Sucre.',
    contact_phone: '954112233',
    latitude: -12.0801,
    longitude: -75.2133,
    available_for_emergencies: false,
    endorsement_count: 19,
    weighted_trust_score: 24.5,
    is_pending_sync: false,
  },
  {
    id: 105,
    client_mutation_id: 'b1111111-1111-4111-8111-111111111105',
    category_id: 3,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Cerrajería Express Sucre · Aperturas y Duplicado de Llaves',
    description:
      'Cerrajería rápida en Jr. Sucre. Apertura de candados trabados, duplicado de llaves y mantenimiento de cerrojos de alta seguridad.',
    contact_phone: '954556677',
    latitude: -12.0793,
    longitude: -75.2144,
    available_for_emergencies: true,
    endorsement_count: 15,
    weighted_trust_score: 19.0,
    is_pending_sync: false,
  },

  // --- ZONA 2: Huancayo Centro / San Carlos (-12.0678, -75.2085 / -12.0625, -75.2005) ---
  {
    id: 106,
    client_mutation_id: 'b2222222-2222-4222-8222-222222222201',
    category_id: 3,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Cerrajería Don Pancho · Apertura Rápida de Puertas y Candados · Jr. Puno',
    description:
      'Cerrajero de tradición en Jr. Puno (Huancayo Centro). Apertura limpia de puertas bloqueadas, instalación de cerrojos y copias in situ.',
    contact_phone: '954444666',
    latitude: -12.0681,
    longitude: -75.2088,
    available_for_emergencies: true,
    emergency_response_note:
      'Atención nocturna urgente de cerraduras forzadas o llaves rotas en bombín.',
    endorsement_count: 26,
    weighted_trust_score: 32.0,
    is_pending_sync: false,
  },
  {
    id: 107,
    client_mutation_id: 'b2222222-2222-4222-8222-222222222202',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Menú Familiar Doña Carmen y Abarrotes · Jr. Giráldez 420',
    description:
      'Almuerzos nutritivos tradicionales huancaínos, menestras, guisos, bidones de agua de 20L y productos no perecibles de primera necesidad.',
    contact_phone: '954888999',
    latitude: -12.067,
    longitude: -75.2076,
    available_for_emergencies: true,
    endorsement_count: 25,
    weighted_trust_score: 31.5,
    is_pending_sync: false,
  },
  {
    id: 108,
    client_mutation_id: 'b2222222-2222-4222-8222-222222222203',
    category_id: 9,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Prof. Yuri · Clases Particulares de Matemáticas, Álgebra y Nivelación',
    description:
      'Docente y vecino de San Carlos con 15 años de trayectoria pedagógica. Refuerzo escolar personalizado para secundaria y preuniversitarios.',
    contact_phone: '954789012',
    latitude: -12.0622,
    longitude: -75.2008,
    available_for_emergencies: false,
    endorsement_count: 21,
    weighted_trust_score: 26.0,
    is_pending_sync: false,
  },
  {
    id: 109,
    client_mutation_id: 'b2222222-2222-4222-8222-222222222204',
    category_id: 4,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Botica Central 24 Horas · Oxígeno e Insumos Médicos · Plaza Huamanmarca',
    description:
      'Farmacia de turno continuo frente a Plaza Huamanmarca. Sueros, cánulas, analgésicos de urgencia y recarga de oxígeno.',
    contact_phone: '954991122',
    latitude: -12.0685,
    longitude: -75.2099,
    available_for_emergencies: true,
    emergency_response_note:
      'Atención 24/7 con botón de emergencia y despacho prioritario.',
    endorsement_count: 28,
    weighted_trust_score: 35.0,
    is_pending_sync: false,
  },

  // --- ZONA 3: Chilca / Sector Sur (-12.1127, -75.1860 / -12.0848, -75.2080) ---
  {
    id: 110,
    client_mutation_id: 'b3333333-3333-4333-8333-333333333301',
    category_id: 1,
    listing_type: 'SERVICIO_OFICIO',
    title: 'Taller Mecánico Comunal Los Andes · Soldadura y Reparaciones · Av. Castilla',
    description:
      'Soldadura eléctrica, cerrajería pesada y mecánica menor para vecinos de Chilca. Reparación de rejas, portones y carretas vecinales.',
    contact_phone: '964555777',
    latitude: -12.0846,
    longitude: -75.2079,
    available_for_emergencies: true,
    emergency_response_note:
      'Equipo de soldadura oxiacetilénica y generador portátil para apuntalamiento.',
    endorsement_count: 18,
    weighted_trust_score: 22.0,
    is_pending_sync: false,
  },
  {
    id: 111,
    client_mutation_id: 'b3333333-3333-4333-8333-333333333302',
    category_id: 5,
    listing_type: 'PRODUCTO_LOCAL',
    title: 'Bodega Doña Lucha · Abarrotes y Verduras Frescas · Parque Peñaloza',
    description:
      'Venta de verduras del valle, sacos de arroz, papas nativas, azúcar y abarrotes a precio de feria barrial en Chilca.',
    contact_phone: '964333111',
    latitude: -12.085,
    longitude: -75.2082,
    available_for_emergencies: true,
    endorsement_count: 23,
    weighted_trust_score: 29.0,
    is_pending_sync: false,
  },
  {
    id: 112,
    client_mutation_id: 'b3333333-3333-4333-8333-333333333303',
    category_id: 4,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Punto de Soporte y Triaje Vecinal Chilca Sur · Av. Real cuadra 18',
    description:
      'Punto de apoyo coordinado por brigadistas comunitarios con botiquines de primeros auxilios, férulas y toma de signos vitales para vecinos vulnerables.',
    contact_phone: '964777222',
    latitude: -12.1125,
    longitude: -75.1856,
    available_for_emergencies: true,
    emergency_response_note:
      'Kit de inmovilización espinal y férulas neumáticas para traslados de urgencia.',
    endorsement_count: 20,
    weighted_trust_score: 25.0,
    is_pending_sync: false,
  },
  {
    id: 113,
    client_mutation_id: 'b3333333-3333-4333-8333-333333333304',
    category_id: 4,
    listing_type: 'SOPORTE_EMERGENCIA',
    title: 'Veterinaria Comunitaria San Roque · Atención de Emergencia Menor',
    description:
      'Atención veterinaria barrial en Chilca. Curación de heridas, vacunas antirrábicas y primeros auxilios para mascotas comunitarias.',
    contact_phone: '964223344',
    latitude: -12.0856,
    longitude: -75.2074,
    available_for_emergencies: true,
    endorsement_count: 17,
    weighted_trust_score: 21.0,
    is_pending_sync: false,
  },
];

export const EXTENDED_HUANCAYO_POSTS: IPostLocal[] = [
  // --- ZONA 1: Jr. Sucre / Usuario (El Tambo / Huancayo: -12.0793, -75.2138) ---
  {
    id: 101,
    client_mutation_id: 'a1111111-1111-4111-8111-111111111101',
    sector_id: 2,
    category_id: 6,
    operational_mode: 'HABITUAL',
    post_type: 'SOLICITUD_FAVOR',
    title: 'Acopio Comunal de Frazadas Térmicas · Jr. Sucre cuadra 6',
    description:
      'Vecinos de Jr. Sucre estamos reuniendo frazadas y mantas abrigadoras para adultos mayores de la cuadra ante descenso brusco de temperatura nocturna.',
    urgency_level: 'MEDIA',
    public_lat: -12.0791,
    public_lng: -75.2136,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 102,
    client_mutation_id: 'a1111111-1111-4111-8111-111111111102',
    sector_id: 2,
    category_id: 7,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Préstamo de Balón de Gas Repuesto y Linternas Recargables · Jr. Sucre',
    description:
      'Tengo un balón de gas con regulador y 3 linternas LED recargables disponibles para prestar sin costo a familias vecinas que lo requieran.',
    urgency_level: 'BAJA',
    public_lat: -12.0798,
    public_lng: -75.2142,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 103,
    client_mutation_id: 'a1111111-1111-4111-8111-111111111103',
    sector_id: 2,
    category_id: 4,
    operational_mode: 'EMERGENCIA',
    post_type: 'SOS_VULNERABLE',
    title: 'SOS Salud Adulto Mayor · Asistencia de Primeros Auxilios e Inyectables',
    description:
      'Adulto mayor en Jr. Sucre requiere asistencia vecinal con toma de presión y soporte de brigada de salud de la zona. [DIRECCIÓN EXACTA PROTEGIDA - LEY 29733].',
    urgency_level: 'ALTA',
    public_lat: -12.0789,
    public_lng: -75.2145,
    privacy_radius_meters: 50,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },

  // --- ZONA 2: Huancayo Centro / San Carlos (-12.0678, -75.2085 / -12.0625, -75.2005) ---
  {
    id: 104,
    client_mutation_id: 'a2222222-2222-4222-8222-222222222201',
    sector_id: 2,
    category_id: 7,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Donación Solidaria de Ropa Abrigadora y Calzado Térmico · Jr. Loreto',
    description:
      'Entrega voluntaria y gratuita de chompas de lana gruesa y calzado térmico para niños y ancianos vulnerables en Jr. Loreto y Parque Constitución.',
    urgency_level: 'BAJA',
    public_lat: -12.0672,
    public_lng: -75.2081,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 105,
    client_mutation_id: 'a2222222-2222-4222-8222-222222222202',
    sector_id: 2,
    category_id: 9,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Pool Escolar Solidario · Colegios Claretiano, San Agustín y Salesiano',
    description:
      'Padres de familia de San Carlos coordinamos transporte rotativo matutino 7:15 a.m. para movilidad escolar y regreso seguro de los niños.',
    urgency_level: 'MEDIA',
    public_lat: -12.0628,
    public_lng: -75.2012,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 106,
    client_mutation_id: 'a2222222-2222-4222-8222-222222222203',
    sector_id: 2,
    category_id: 6,
    operational_mode: 'EMERGENCIA',
    post_type: 'RECURSO_SOLIDARIO',
    title: 'Punto de Encuentro y Acopio Oficial · Plaza Constitución Huancayo',
    description:
      'Punto estratégico de coordinación vecinal y primeros auxilios ante contingencias sísmicas o cortes prolongados de servicios básicos.',
    urgency_level: 'ALTA',
    public_lat: -12.0683,
    public_lng: -75.2092,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },

  // --- ZONA 3: Chilca / Sector Sur (-12.1127, -75.1860 / -12.0848, -75.2080) ---
  {
    id: 107,
    client_mutation_id: 'a3333333-3333-4333-8333-333333333301',
    sector_id: 2,
    category_id: 7,
    operational_mode: 'HABITUAL',
    post_type: 'OFERTA_FAVOR',
    title: 'Préstamo de Andador Ortopédico de Cuatro Ruedas y Muletas · Chilca',
    description:
      'Andador ortopédico de aluminio con frenos de mano y muletas canadienses regulables. Préstamo gratuito a vecinos en rehabilitación física.',
    urgency_level: 'BAJA',
    public_lat: -12.0845,
    public_lng: -75.2078,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 108,
    client_mutation_id: 'a3333333-3333-4333-8333-333333333302',
    sector_id: 2,
    category_id: 6,
    operational_mode: 'HABITUAL',
    post_type: 'SOLICITUD_FAVOR',
    title: 'Olla Común Solidaria "Virgen de Cocharcas" · Acopio de Víveres Secos',
    description:
      'Solicitamos apoyo solidario con arroz, menestras, avena y aceite para brindar 80 almuerzos calientes diarios a familias necesitadas de Chilca.',
    urgency_level: 'MEDIA',
    public_lat: -12.1124,
    public_lng: -75.1858,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
  {
    id: 109,
    client_mutation_id: 'a3333333-3333-4333-8333-333333333303',
    sector_id: 2,
    category_id: 10,
    operational_mode: 'EMERGENCIA',
    post_type: 'RECURSO_SOLIDARIO',
    title: 'Brigada Vecinal de Patrullaje y Seguridad Comunitaria · Parque Peñaloza',
    description:
      'Rondas vecinales nocturnas coordinadas entre vecinos y comerciantes de la Av. 9 de Diciembre y Parque Peñaloza con megáfonos y silbatos.',
    urgency_level: 'MEDIA',
    public_lat: -12.0852,
    public_lng: -75.2084,
    privacy_radius_meters: 0,
    status: 'ACTIVO',
    client_created_at: new Date().toISOString(),
    is_pending_sync: false,
  },
];

export const ALL_SEEDED_LISTINGS: IListingLocal[] = [
  ...INITIAL_SECTOR_LISTINGS,
  ...EXTENDED_HUANCAYO_LISTINGS,
];

export const ALL_SEEDED_POSTS: IPostLocal[] = [
  ...INITIAL_SECTOR_POSTS,
  ...EXTENDED_HUANCAYO_POSTS,
];

/**
 * Obtiene las publicaciones de oficios/servicios filtradas para un sector específico
 * o devuelve todas si no se especifica.
 */
export function getListingsForSector(sectorId?: string): IListingLocal[] {
  if (!sectorId || sectorId === 'all') {
    return INITIAL_SECTOR_LISTINGS;
  }
  if (sectorId === 'lima-jesus-maria-4') {
    return JESUS_MARIA_LISTINGS;
  }
  return HUANCAYO_SECTOR_LISTINGS;
}

/**
 * Obtiene las publicaciones del muro solidario/emergencias para un sector específico.
 */
export function getPostsForSector(sectorId?: string): IPostLocal[] {
  if (!sectorId || sectorId === 'all') {
    return INITIAL_SECTOR_POSTS;
  }
  if (sectorId === 'lima-jesus-maria-4') {
    return JESUS_MARIA_POSTS;
  }
  return HUANCAYO_SECTOR_POSTS;
}
