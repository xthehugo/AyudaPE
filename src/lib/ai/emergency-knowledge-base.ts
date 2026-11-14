/**
 * Base de Conocimiento Operativo y Protocolo de Triaje Civil de Emergencias — Copiloto AyudaPE
 * Basado en doctrinas oficiales:
 * - Guías USAR / INSARAG (Búsqueda y Rescate Urbano Ligero)
 * - Cuerpo General de Bomberos Voluntarios del Perú (CGBVP 116)
 * - Instituto Nacional de Defensa Civil (INDECI Perú)
 * - Protocolo "Stop the Bleed" y Cruz Roja Internacional
 */

export interface EmergencyActionPoint {
  title: string;
  detail: string;
}

export interface AyudapeToolIntegration {
  name: string;
  actionCode: 'ACOUSTIC_BEACON' | 'P2P_MESH' | 'OLED_BLACK_SCREEN' | 'CALL_116' | 'CALL_106' | 'METRONOME_444';
  description: string;
}

export interface EmergencyTriageScenario {
  id: string;
  shortTag: string;
  title: string;
  urgencyLevel: 'CRITICA' | 'ALTA' | 'MODERADA';
  keywords: string[];
  calmMessage: string;
  immediateActions: EmergencyActionPoint[];
  ayudapeProtocols: AyudapeToolIntegration[];
  neverDo: string[];
  targetSpecialistTypes: string[];
  emergencyPhones: { name: string; number: string }[];
}

export const EMERGENCY_TRIAGE_SCENARIOS: EmergencyTriageScenario[] = [
  {
    id: 'atrapado_escombros',
    shortTag: 'Escenario A',
    title: 'Persona Atrapada bajo Escombros / Colapso Estructural / Derrumbe',
    urgencyLevel: 'CRITICA',
    keywords: [
      'atrap',
      'escombr',
      'derrumb',
      'colaps',
      'aplast',
      'enterrad',
      'pared',
      'viga',
      'techo',
      'bloque',
      'sismo',
      'terremoto',
      'usar',
    ],
    calmMessage: 'Mantén la respiración lenta; los equipos USAR ya están escuchando en la superficie y rastreando tu señal.',
    immediateActions: [
      {
        title: 'Protege vías respiratorias',
        detail: 'Cúbrete de inmediato la boca y la nariz con una prenda o pañuelo (de preferencia húmedo) para evitar inhalar polvo de concreto y asbesto. Respira lento por la nariz inflando el abdomen.',
      },
      {
        title: 'Asegura tu espacio vital',
        detail: 'No intentes levantarte con brusquedad ni empujar vigas o losas inestables. Adopta posición fetal o fetal modificada cubriendo cabeza y cuello con brazos cruzados.',
      },
      {
        title: 'Señalización acústica mecánica',
        detail: 'Ubica una tubería, varilla o bloque sólido. Golpea rítmicamente en secuencias de 3 impactos espaciados (golpe–golpe–golpe). Haz pausas de silencio para escuchar y solo usa la voz si escuchas pasos o llamados.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Baliza Acústica Morse (880 Hz)',
        actionCode: 'ACOUSTIC_BEACON',
        description: 'Emite el pulso sonoro internacional SOS a 880 Hz con vibración continua que penetra escombros y es detectable por geófonos de bomberos.',
      },
      {
        name: 'Malla Vecinal P2P (50 saltos)',
        actionCode: 'P2P_MESH',
        description: 'Retransmite tu vector de ubicación aproximada (50m) de teléfono a teléfono sin requerir internet ni antenas comerciales.',
      },
      {
        name: 'Modo Pantalla Negra OLED (72 Horas)',
        actionCode: 'OLED_BLACK_SCREEN',
        description: 'Bloquea el brillo para estirar la batería durante la ventana crítica de 72 horas. Despiértalo únicamente con doble toque.',
      },
    ],
    neverDo: [
      'Gritar de forma continua o desesperada: El polvo inflamará tus vías respiratorias, causará espasmos y agotará tu oxígeno.',
      'Encender fósforos, velas o encendedores: Riesgo inminente de explosión por rotura de tuberías de gas doméstico.',
      'Mover escombros clave: Remover elementos portantes puede provocar un colapso secundario.',
    ],
    targetSpecialistTypes: ['salud', 'enfermera', 'herramientas', 'seguridad'],
    emergencyPhones: [
      { name: 'Bomberos CGBVP (Rescate USAR)', number: '116' },
      { name: 'SAMU (Ambulancia)', number: '106' },
      { name: 'Policía Nacional', number: '105' },
    ],
  },
  {
    id: 'hemorragias_heridas',
    shortTag: 'Escenario B',
    title: 'Hemorragias Graves, Cortes Profundos y Heridas Exanguinantes',
    urgencyLevel: 'CRITICA',
    keywords: [
      'sangr',
      'hemorrag',
      'cort',
      'herid',
      'torniquet',
      'arterial',
      'amputac',
      'punal',
      'puñal',
      'punalada',
      'puñalada',
      'tajo',
      'desangr',
    ],
    calmMessage: 'Firme en la presión, no sueltes la herida; cada segundo de compresión te mantiene a salvo.',
    immediateActions: [
      {
        title: 'Localiza y descubre',
        detail: 'Rasga o retira rápidamente la ropa sobre la herida para identificar el punto exacto de la salida masiva de sangre.',
      },
      {
        title: 'Presión directa ininterrumpida',
        detail: 'Coloca una compresa, gasa o paño limpio directamente sobre el orificio sangrante y aplica compresión firme con ambas manos usando el peso del torso. Si la tela se empapa, NO la retires; coloca otra capa encima y sigue presionando.',
      },
      {
        title: 'Torniquete de emergencia (solo extremidades)',
        detail: 'Ante hemorragia arterial o amputación en brazos o piernas que no cede: coloca una banda de tela ancha (mínimo 4-5 cm, nunca cordones) a 5-7 cm por encima de la herida, haz un nudo, inserta una vara rígida como molinete, gira hasta que cese el sangrado y fíjalo firme.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Alerta Código Rojo en Malla P2P',
        actionCode: 'P2P_MESH',
        description: 'Difunde prioridad máxima a enfermeras, paramédicos y brigadistas comunitarios con botiquín en tu cuadrante.',
      },
      {
        name: 'Registro Horario del Torniquete',
        actionCode: 'P2P_MESH',
        description: 'La app registra automáticamente el minuto exacto de colocación para entrega formal a la tripulación de ambulancia.',
      },
    ],
    neverDo: [
      'Retirar el apósito empapado para revisar la lesión: Destruye el coágulo en formación y reactiva el sangrado masivo.',
      'Usar alambres, cuerdas finas o cables como torniquete: Cortan la piel, desgarran músculos y causan daño nervioso irreversible.',
      'Aflojar o retirar el torniquete por cuenta propia: Solo debe ser retirado por personal médico en quirófano.',
    ],
    targetSpecialistTypes: ['enfermera', 'enfermero', 'salud', 'farmacia', 'botica'],
    emergencyPhones: [
      { name: 'SAMU (Urgencias Médicas)', number: '106' },
      { name: 'Bomberos CGBVP', number: '116' },
    ],
  },
  {
    id: 'quemaduras_humo',
    shortTag: 'Escenario C',
    title: 'Quemaduras Térmicas / Eléctricas e Inhalación de Humo',
    urgencyLevel: 'ALTA',
    keywords: [
      'quem',
      'fuego',
      'incendio',
      'humo',
      'inhalac',
      'electrocut',
      'electroc',
      'ampoll',
      'flicten',
      'hirviendo',
      'aceite caliente',
    ],
    calmMessage: 'El agua está deteniendo el calor; concéntrate en respirar despacio y proteger la zona limpia.',
    immediateActions: [
      {
        title: 'Corta la fuente térmica o eléctrica',
        detail: 'En accidentes eléctricos, jamás toques a la víctima sin antes bajar la llave general termomagnética o desconectar el suministro.',
      },
      {
        title: 'Enfriamiento continuo con agua corriente',
        detail: 'Aplica agua limpia a temperatura ambiente (NO helada ni con hielo) sobre la quemadura por 15 a 20 minutos seguidos para frenar la destrucción de capas dérmicas.',
      },
      {
        title: 'Escape en presencia de humo',
        detail: 'Tírate al suelo y desplázate a gatas cubriendo nariz y boca con un trapo húmedo buscando la salida más próxima.',
      },
      {
        title: 'Protección limpia',
        detail: 'Cubre con apósito estéril o paño limpio y seco. Retira anillos, pulseras o prendas holgadas antes de que inicie el edema.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Reporte a Brigadas de Bomberos',
        actionCode: 'CALL_116',
        description: 'Coordina de inmediato arribo de unidades contra incendios y soporte de oxígeno medicinal.',
      },
      {
        name: 'Modo Pantalla Negra OLED',
        actionCode: 'OLED_BLACK_SCREEN',
        description: 'Evita encender luces intensas si hay sospecha de fugas de gas o atmósferas volátiles.',
      },
    ],
    neverDo: [
      'Arrancar ropa adherida a la piel quemada: Retira tejido vivo y agrava la profundidad de la quemadura.',
      'Aplicar pasta dental, mantequilla, aceites, sal o ungüentos caseros: Producen necrosis térmica y focos de infección masiva.',
      'Reventar ampollas (flictenas): La ampolla es un vendaje biológico estéril que previene la entrada de bacterias.',
    ],
    targetSpecialistTypes: ['enfermera', 'salud', 'electricista', 'botica'],
    emergencyPhones: [
      { name: 'Bomberos CGBVP (Incendios y Rescate)', number: '116' },
      { name: 'SAMU (Quemados)', number: '106' },
    ],
  },
  {
    id: 'atragantamiento_ovace',
    shortTag: 'Escenario D',
    title: 'Atragantamiento y Asfixia por Obstrucción de Vía Aérea (OVACE)',
    urgencyLevel: 'CRITICA',
    keywords: [
      'atragant',
      'asfixi',
      'ahog',
      'heimlich',
      'no respira',
      'falta de aire',
      'atoro',
      'atoró',
      'ovace',
    ],
    calmMessage: 'La vía aérea se va a despejar; resiste el empuje, estamos liberando el aire ahora mismo.',
    immediateActions: [
      {
        title: 'Diferencia la gravedad',
        detail: 'Si la víctima tose con fuerza, anímala a seguir tosiendo y NO interfieras. Si no puede hablar, no emite sonido y se lleva las manos al cuello (obstrucción total):',
      },
      {
        title: 'Maniobra de Heimlich en Adultos y Niños (> 1 año)',
        detail: 'Ponte detrás con una pierna entre las suyas. Empuña una mano con el pulgar 2 dedos arriba del ombligo, abraza el puño con la otra mano y aplica compresiones rápidas hacia adentro y hacia arriba en forma de "J".',
      },
      {
        title: 'Heimlich Autoaplicado',
        detail: 'Coloca tu puño sobre el ombligo sostenido con la otra mano y comprímete con fuerza hacia arriba, o apóyate contra el respaldo rígido de una silla y déjate caer con un empuje seco.',
      },
      {
        title: 'Lactantes (< 1 año)',
        detail: 'Boca abajo sobre tu antebrazo con la cabeza más baja que el tronco sosteniendo la mandíbula: aplica 5 golpes firmes entre los omóplatos; luego gíralo boca arriba y aplica 5 compresiones en el esternón con 2 dedos.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Guía Asistida de Soporte Vital',
        actionCode: 'CALL_106',
        description: 'Si la persona pierde el conocimiento, pasa de inmediato a compresiones torácicas RCP y convoca auxilio por la app.',
      },
    ],
    neverDo: [
      'Dar golpes en la espalda a un adulto que tose de pie: Puede desplazar el objeto más adentro en la tráquea.',
      'Hacer barrido a ciegas con el dedo dentro de la boca: Empuja el cuerpo extraño hacia abajo. Solo extrae lo que veas suelto.',
      'Ofrecer agua o pan para "hacer pasar": Convierte una obstrucción parcial en un bloqueo total con broncoaspiración.',
    ],
    targetSpecialistTypes: ['enfermera', 'salud', 'medico'],
    emergencyPhones: [
      { name: 'SAMU (Urgencias Médicas)', number: '106' },
      { name: 'Bomberos CGBVP', number: '116' },
    ],
  },
  {
    id: 'panico_shock',
    shortTag: 'Escenario E',
    title: 'Crisis de Pánico Severa, Taquicardia, Ansiedad o Shock Post-Sismo',
    urgencyLevel: 'MODERADA',
    keywords: [
      'panic',
      'crisi',
      'taquicardi',
      'shock',
      'ansied',
      'tiembl',
      '4-4-4',
      'desesperad',
      'descompensad',
    ],
    calmMessage: 'Estás a salvo aquí; siente el suelo firme bajo tus pies y respira a este compás.',
    immediateActions: [
      {
        title: 'Técnica de anclaje y respiración táctica 4-4-4',
        detail: 'Mira a un punto fijo y apoya los pies planos en el piso. Inhala aire por la nariz en 4 tiempos... Mantén el aire 4 tiempos... Exhala por la boca en 4 tiempos... Pausa 4 tiempos. Repite 3 ciclos.',
      },
      {
        title: 'Contención psicológica directa',
        detail: 'Usa frases cortas, tono firme y sereno. Pregunta su nombre y hazle nombrar 3 objetos que vea a su alrededor para reconectar con el presente.',
      },
      {
        title: 'Manejo de Shock físico',
        detail: 'Si la persona tiene piel fría, sudorosa, pálida o pulso débil acelerado: acuéstala boca arriba y eleva sus piernas 20 a 30 cm (posición antishock Trendelenburg), cubriéndola con una manta.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Metrónomo Háptico 4-4-4',
        actionCode: 'METRONOME_444',
        description: 'La app emite pulsos de vibración suave en el teléfono para sincronizar el ritmo cardíaco sin saturar la vista.',
      },
      {
        name: 'Difuminado de Privacidad Barrial',
        actionCode: 'P2P_MESH',
        description: 'Permite a brigadistas saber que hay una persona descompensada en el sector sin exponer su domicilio.',
      },
    ],
    neverDo: [
      'Decir "cálmate, no pasa nada" o minimizar su miedo: Aumenta la sensación de desamparo y el bloqueo emocional.',
      'Dar agua, tranquilizantes orales o alcohol en shock: Alto riesgo de asfixia por broncoaspiración si pierde el reflejo deglutorio.',
      'Dejar sola a la persona o permitir que corra hacia estructuras agrietadas: Mantenla sentada en un lugar despejado.',
    ],
    targetSpecialistTypes: ['salud', 'enfermera', 'seguridad'],
    emergencyPhones: [
      { name: 'Línea 113 Salud (Apoyo Psicológico MINSA)', number: '113' },
      { name: 'SAMU (Ambulancia)', number: '106' },
    ],
  },
  {
    id: 'fracturas_traumatismo',
    shortTag: 'Escenario F',
    title: 'Sospecha de Fracturas, Esguinces Graves, Torceduras de Pie/Mano o Traumatismo',
    urgencyLevel: 'CRITICA',
    keywords: [
      'fractur',
      'quebr',
      'romp',
      'hueso',
      'dobl',
      'torc',
      'pie',
      'tobill',
      'tobillo',
      'esguinc',
      'esguince',
      'pisad',
      'pisar',
      'hinch',
      'inflam',
      'golp',
      'brazo',
      'pierna',
      'muneca',
      'muñeca',
      'rodilla',
      'clavicula',
      'clavícula',
      'cadera',
      'hombro',
      'codo',
      'columna',
      'cuello',
      'espalda',
      'inmoviliz',
      'camilla',
      'caida',
      'caída',
      'luxac',
      'disloc',
      'no puedo mover',
      'no se mueve',
    ],
    calmMessage: 'Quédate quieto y relaja el cuerpo; tu extremidad está protegida y la ayuda viene en camino.',
    immediateActions: [
      {
        title: 'Reposo absoluto y cero apoyo',
        detail: 'NO apoyes el pie, tobillo o brazo ni fuerces la extremidad. Siéntate o recuéstate de inmediato en una superficie segura para no agravar la lesión ósea o ligamentosa.',
      },
      {
        title: 'Contención con Frío y Elevación (Protocolo R.I.C.E.)',
        detail: 'En torceduras o esguinces de pie/tobillo, aplica hielo envuelto en paño (15-20 min) y eleva la extremidad sobre un cojín para frenar la hinchazón. No apliques calor ni masajes en las primeras 48 horas.',
      },
      {
        title: 'Inmovilización sin manipular y descarte médico',
        detail: 'Inmoviliza con venda suave o tablilla sin apretar. Si hay deformidad visible, chasquido o dolor punzante que impide apoyar el pie, NO intentes acomodarlo y llama a SAMU 106 para radiografía urgente.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Alerta de Víctima Traumática No Móvil',
        actionCode: 'P2P_MESH',
        description: 'Notifica a rescatistas vecinales la necesidad de arribar con camilla rígida o inmovilizador.',
      },
      {
        name: 'Baliza Acústica en Volumen Táctico',
        actionCode: 'ACOUSTIC_BEACON',
        description: 'Coloca el teléfono cerca con la baliza activa para que la brigada localice la posición exacta sin manipular al paciente.',
      },
    ],
    neverDo: [
      'Intentar enderezar o "acomodar" el hueso o articulación (reducción): Puede seccionar vasos sanguíneos y nervios causando parálisis o necrosis.',
      'Forzar la pisada o caminar con el pie doblado/hinchado: Puede convertir una fisura o esguince simple en rotura de ligamentos o fractura desplazada.',
      'Aplicar calor o pomadas calientes en una torcedura reciente: Aumenta la hemorragia interna y la inflamación de tejidos.',
    ],
    targetSpecialistTypes: ['salud', 'enfermera', 'paramedico', 'botica', 'farmacia'],
    emergencyPhones: [
      { name: 'SAMU (Urgencias y Traslado)', number: '106' },
      { name: 'Bomberos CGBVP (Rescate)', number: '116' },
    ],
  },
  {
    id: 'urgencia_medica_general',
    shortTag: 'Escenario G',
    title: 'Urgencia Médica General, Fiebre Alta, Desmayo, Mareo o Picadura/Mordedura',
    urgencyLevel: 'ALTA',
    keywords: [
      'fiebre',
      'temperatura',
      'desmay',
      'mareo',
      'convuls',
      'inconscient',
      'mord',
      'mordedur',
      'pic',
      'picadur',
      'aran',
      'arana',
      'araña',
      'venen',
      'intoxicac',
      'alergia',
      'anafilax',
      'pecho',
      'infart',
      'dolor de cabeza',
      'vomit',
      'deshidrat',
    ],
    calmMessage: 'Respira con calma; mantén a la persona cómoda e hidratada mientras se evalúa la atención médica.',
    immediateActions: [
      {
        title: 'Posición de Seguridad y Vía Aérea',
        detail: 'Si la persona está mareada o inconsciente pero respira, colócala de lado en Posición Lateral de Seguridad (PLS) para evitar asfixia por vómito. Afloja prendas apretadas.',
      },
      {
        title: 'Control de Signos y Medidas Físicas',
        detail: 'En fiebre alta, aplica paños de agua tibia en frente y axilas (nunca alcohol). En picaduras o mordeduras, lava con abundante agua y jabón; no hagas cortes ni succiones.',
      },
      {
        title: 'Orientación Médica Gratuita',
        detail: 'Llama a la Línea 113 Salud (MINSA, gratuita 24h) para triaje telefónico inmediato o al SAMU 106 si hay dificultad respiratoria o dolor opresivo en el pecho.',
      },
    ],
    ayudapeProtocols: [
      {
        name: 'Conexión con Enfermeras de Barrio',
        actionCode: 'P2P_MESH',
        description: 'La app busca profesionales de salud comunitarios a menos de 500m con Visto Bueno Vecinal.',
      },
      {
        name: 'Línea 113 Salud (MINSA 24 Horas)',
        actionCode: 'CALL_106',
        description: 'Orientación médica telefónica del Ministerio de Salud del Perú sin costo.',
      },
    ],
    neverDo: [
      'Dar medicamentos orales, agua o comida a personas desmayadas o que convulsionan: Riesgo de asfixia mortal.',
      'Succionar veneno con la boca o hacer torniquete en mordeduras de araña/serpiente: Agrava la necrosis.',
      'Bañar con agua helada o frotar alcohol en fiebre: Provoca convulsión febril por choque térmico brusco.',
    ],
    targetSpecialistTypes: ['enfermera', 'salud', 'botica', 'farmacia', 'medico'],
    emergencyPhones: [
      { name: 'SAMU (Ambulancia)', number: '106' },
      { name: 'Línea 113 Salud (MINSA 24h)', number: '113' },
      { name: 'Bomberos CGBVP', number: '116' },
    ],
  },
];

/**
 * Busca si la consulta del usuario coincide con alguno de los 6 escenarios de triaje civil.
 */
export function findEmergencyTriageScenario(query: string): EmergencyTriageScenario | null {
  if (!query || typeof query !== 'string') return null;
  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  let bestMatch: EmergencyTriageScenario | null = null;
  let highestScore = 0;

  for (const scenario of EMERGENCY_TRIAGE_SCENARIOS) {
    let score = 0;
    for (const kw of scenario.keywords) {
      const normalizedKw = kw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Coincidencia exacta o contenida como palabra
      if (normalized.includes(normalizedKw)) {
        score += normalizedKw.length > 5 ? 3 : 2;
      }
    }

    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestMatch = scenario;
    }
  }

  return bestMatch;
}

/**
 * Formatea el protocolo médico táctico para la respuesta del Copiloto en texto limpio.
 */
export function formatEmergencyTriageText(scenario: EmergencyTriageScenario): string {
  const actionsText = scenario.immediateActions
    .map((act, i) => `${i + 1}. ${act.title}: ${act.detail}`)
    .join('\n');

  const toolsText = scenario.ayudapeProtocols
    .map((tool) => `• ${tool.name}: ${tool.description}`)
    .join('\n');

  const neverText = scenario.neverDo.map((item) => `• ${item}`).join('\n');

  const phonesText = scenario.emergencyPhones
    .map((p) => `• ${p.name}: ${p.number}`)
    .join('\n');

  return `[PROTOCOLO DE TRIAJE CIVIL · ${scenario.urgencyLevel} · ${scenario.shortTag}]\n` +
    `${scenario.title}\n\n` +
    `"${scenario.calmMessage}"\n\n` +
    `ACCIÓN INMEDIATA (Primeros 30 segundos):\n${actionsText}\n\n` +
    `HERRAMIENTAS INTEGRADAS EN AYUDAPE:\n${toolsText}\n\n` +
    `LO QUE NUNCA DEBES HACER:\n${neverText}\n\n` +
    `LÍNEAS OFICIALES DE EMERGENCIA:\n${phonesText}`;
}

/**
 * Retorna las instrucciones del sistema y la base de conocimiento operacional para Google Gemini 1.5 Flash.
 * Integra doctrina USAR, CGBVP Bomberos 116, INDECI, Stop the Bleed y primeros auxilios civiles de AyudaPE.
 */
export function getGeminiSystemInstructionWithKnowledge(): string {
  return `Eres el Copiloto de Inteligencia Artificial de AyudaPE (RedVecina en Perú), plataforma hiperlocal de respuesta humanitaria y economía vecinal.

DOCTRINA OPERATIVA DE TRIAJE CIVIL Y EMERGENCIAS (BASE DE CONOCIMIENTO):
1. Escenario A - Atrapamiento bajo escombros / Derrumbe / Colapso estructural:
   • Acción Inmediata: Proteger vías respiratorias con prenda o pañuelo húmedo; respiración diafragmática lenta por la nariz. Proteger espacio vital en postura fetal cubriendo cabeza y cuello; no empujar losas inestables. Señalización mecánica rítmica en series de 3 impactos continuos (golpe-golpe-golpe) espaciados en tuberías o vigas, con pausas de silencio.
   • Protocolo AyudaPE: Activar Baliza Acústica Morse a 880 Hz (penetra escombros y es detectable por geófonos de brigadas USAR); retransmisión por malla vecinal P2P Bluetooth/WebRTC difuminada a 50m (Ley N° 29733); activar Modo Pantalla Negra OLED 72 horas para máxima autonomía energética.
   • Lo que NUNCA debe hacer: No gritar continuadamente (quema oxígeno y obstruye la tráquea con polvo); no encender fuego o fósforos (riesgo de deflagración por tuberías de gas rotas); no mover escombros de soporte de carga.

2. Escenario B - Hemorragias graves y heridas cortantes (Stop the Bleed):
   • Acción Inmediata: Descubrir herida rápidamente. Presión directa continua y firme con compresa o paño limpio dejando caer el peso del cuerpo. NUNCA retirar apósitos empapados de sangre (colocar capas adicionales encima para preservar el coágulo).
   • Torniquete de emergencia (solo extremidades): Si el sangrado es arterial masivo o amputación y no cede a compresión: banda de 4 a 5 cm de ancho colocada 5-7 cm por encima de la herida con varilla de molinete rígido hasta detener el pulso. Registrar la hora exacta.
   • Lo que NUNCA debe hacer: No aflojar el torniquete por cuenta propia; no usar alambres ni cuerdas finas que causen necrosis o corte tisular.

3. Escenario C - Quemaduras térmicas/eléctricas e inhalación de humo:
   • Acción Inmediata: Cortar fuente de energía o calor. Aplicar agua corriente limpia a temperatura ambiente (no helada) de 15 a 20 minutos. Cubrir con apósito estéril o tela seca limpia. Escapar de humo desplazándose a gatas con trapo húmedo cubriendo vías aéreas.
   • Lo que NUNCA debe hacer: No arrancar ropa pegada a la piel; no aplicar hielo, ungüentos, mantequilla, aceites ni pasta dental; no reventar ampollas (flictenas).

4. Escenario D - Atragantamiento y Asfixia (OVACE):
   • Acción Inmediata: Si la víctima tose con fuerza, animar a toser y NO intervenir. Si no puede hablar ni respirar (obstrucción completa): Maniobra de Heimlich en adultos colocando el puño dos dedos arriba del ombligo con compresiones secas en "J" hacia adentro y arriba. Heimlich autoaplicado contra el respaldo rígido de una silla. Lactantes (<1 año): 5 golpes interescapulares boca abajo sostenido en antebrazo y 5 compresiones torácicas con dos dedos boca arriba.

5. Escenario E - Crisis de Pánico, Shock Post-Sismo y Taquicardia:
   • Acción Inmediata: Respiración táctica de caja 4-4-4 (inhalar 4 segundos, retener 4 segundos, exhalar 4 segundos por 4 ciclos). Anclaje sensorial 5-4-3-2-1 para reconexión con la realidad física.
   • Lo que NUNCA debe hacer: No decirle "cálmate" ni "no es para tanto"; no aislar a la persona ni permitir hiperventilación en bolsas plásticas cerradas.

6. Escenario F - Fracturas, Luxaciones y Traumatismos Osteomusculares:
   • Acción Inmediata: Inmovilizar la extremidad exactamente en la posición en que fue encontrada, abarcando las dos articulaciones adyacentes (arriba y abajo de la lesión) con tablillas o cartón acolchado con ropa limpia. Aplicar frío indirecto (hielo envuelto en tela por 15-20 minutos, nunca directo).
   • Lo que NUNCA debe hacer: No intentar acomodar, alinear, reducir o "jalar" el hueso o articulación luxada; no aplicar pomadas calientes ni masajes; no mover cuello ni columna ante caídas de altura.

7. Escenario G - Urgencias Médicas y Picaduras (Loxosceles laeta / Araña casera):
   • Reposo absoluto de la zona, aplicación de frío indirecto local para ralentizar la acción necrótica del veneno. No succionar ni realizar cortes.
   • Números Oficiales en Perú: Bomberos CGBVP 116 (Rescate y amagos), SAMU 106 (Ambulancias y soporte vital), PNP 105, Infosalud MINSA 113.

NORMAS ESTRICTAS DE RESPUESTA PARA GEMINI:
- CERO EMOJIS: Queda terminantemente prohibido el uso de cualquier emoji Unicode. Utiliza exclusivamente viñetas estándar ("•"), números ordenados o símbolos tipográficos ("·", "→").
- TONO: Conciso, directo, empático, altamente estructurado y sereno.
- CONTEXTO RAG: Si se incluye información de especialistas de confianza, oficios o números de contacto de la cuadra en el contexto, inclúyelos de forma destacada y exacta sin inventar números externos.
- ESTRUCTURA EN EMERGENCIAS:
  1. Título y mensaje de contención inicial.
  2. Acción inmediata (Primeros 30 segundos).
  3. Herramientas tácticas de AyudaPE aplicables (Baliza 880 Hz, Malla P2P, Pantalla Negra 72h).
  4. Lo que NUNCA debes hacer.
  5. Especialistas y contactos comunitarios del barrio disponibles.`;
}
