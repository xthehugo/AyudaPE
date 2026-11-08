import type { OperationalMode } from '@shared/types';
import {
  ExtractedPiiSchema,
  MONEY_REGEX,
  NeighborIntentSchema,
  type ExtractedPii,
  type NeighborIntent,
  type ResourceItemInput,
} from '@shared/schemas';
import type { IIntentParserStrategy } from '../types';

interface CategoryLexiconRule {
  category: string;
  keywords: string[];
  defaultPostType?: NeighborIntent['post_type'];
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }
  return matrix[b.length]![a.length]!;
}

function fuzzyContains(textLower: string, keyword: string): boolean {
  if (textLower.includes(keyword)) return true;
  if (keyword.length >= 5) {
    const tokens = textLower.split(/[\s,.\-;:!?()]+/);
    for (const t of tokens) {
      if (t.length >= 4 && Math.abs(t.length - keyword.length) <= 1) {
        if (levenshteinDistance(t, keyword) <= 1) return true;
      }
    }
  }
  return false;
}

const PERUVIAN_TRADES_LEXICON: CategoryLexiconRule[] = [
  {
    category: 'Gasfitería y Saneamiento',
    keywords: [
      'gasfitero',
      'gasfiter',
      'gasfiteria',
      'gasfitería',
      'caño',
      'cano',
      'fuga',
      'tuberia',
      'tubería',
      'desague',
      'desagüe',
      'atoro',
      'inodoro',
      'tanque',
      'cisterna',
      'motobomba',
      'bomba de agua',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Electricidad e Iluminación',
    keywords: [
      'electricista',
      'electricidad',
      'luz',
      'tablero',
      'cortocircuito',
      'termomagnetico',
      'termomagnético',
      'diferencial',
      'enchufe',
      'cableado',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Cerrajería y Seguridad',
    keywords: ['cerrajero', 'cerrajeria', 'cerrajería', 'chapa', 'cerradura', 'candado', 'llave'],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Salud y Primeros Auxilios',
    keywords: [
      'enfermera',
      'enfermero',
      'inyeccion',
      'inyección',
      'suero',
      'curacion',
      'curación',
      'presion arterial',
      'presión arterial',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Ortopedia y Movilidad Asistida',
    keywords: [
      'muleta',
      'muletas',
      'ortopedica',
      'ortopédica',
      'ortopedico',
      'ortopédico',
      'silla de ruedas',
      'andador',
      'camilla',
      'baston',
      'bastón',
    ],
    defaultPostType: 'OFERTA_FAVOR',
  },
  {
    category: 'Educación y Clases Particulares',
    keywords: [
      'profe',
      'profesor',
      'profesora',
      'docente',
      'enseña',
      'enseño',
      'enseñanza',
      'quimica',
      'química',
      'matematica',
      'matemática',
      'fisica',
      'física',
      'clases',
      'nivelacion',
      'nivelación',
      'ingles',
      'inglés',
      'tareas',
      'reforzamiento',
      'biologia',
      'biología',
      'lenguaje',
      'comunicacion',
      'comunicación',
      'preuniversitario',
      'escolar',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Alimentación y Olla Común',
    keywords: [
      'bodega',
      'menu',
      'menú',
      'almuerzo',
      'desayuno',
      'cena',
      'panaderia',
      'panadería',
      'abarrotes',
      'verduras',
      'frutas',
      'vianda',
      'lasaña',
      'lasañas',
      'lasana',
      'lasanas',
      'postre',
      'postres',
      'queque',
      'queques',
      'torta',
      'pollada',
      'trucha',
      'pachamanca',
      'caldo',
      'pan',
      'olla comun',
      'olla común',
      'comedor popular',
      'viveres',
      'víveres',
    ],
    defaultPostType: 'PRODUCTO_LOCAL',
  },
  {
    category: 'Botica e Insumos Médicos',
    keywords: [
      'botica',
      'farmacia',
      'insulina',
      'oxigeno',
      'oxígeno',
      'medicamento',
      'pastilla',
      'jarabe',
      'ampolla',
      'pañales',
      'botiquin',
      'botiquín',
      'alcohol',
      'gasas',
      'vendas',
      'mascarilla',
      'oximetro',
      'oxímetro',
      'tensiometro',
      'tensiómetro',
    ],
  },
  {
    category: 'Carpintería y Mueblería',
    keywords: [
      'carpintero',
      'carpinteria',
      'carpintería',
      'mueble',
      'muebles',
      'madera',
      'mesa',
      'silla',
      'estante',
      'puerta de madera',
      'reparacion de muebles',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Pintura y Albañilería',
    keywords: [
      'pintor',
      'pintura',
      'brocha',
      'rodillo',
      'albanil',
      'albañil',
      'albañileria',
      'albañilería',
      'cemento',
      'estuco',
      'pared',
      'techo',
      'rajadura',
      'grieta',
      'resane',
      'mayolica',
      'mayólica',
      'porcelanato',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Mecánica y Transporte Barrial',
    keywords: [
      'mecanico',
      'mecánico',
      'mecanica',
      'mecánica',
      'taller',
      'moto',
      'mototaxi',
      'bicicleta',
      'bici',
      'llanta',
      'parche',
      'bateria de auto',
      'batería de auto',
      'remolque',
      'flete',
      'mudanza',
      'traslado',
    ],
    defaultPostType: 'SERVICIO_OFICIO',
  },
  {
    category: 'Cuidado y Acompañamiento',
    keywords: [
      'cuidado',
      'cuidador',
      'cuidadora',
      'adulto mayor',
      'ninos',
      'niños',
      'bebe',
      'bebé',
      'mascota',
      'mascotas',
      'perro',
      'gato',
      'veterinario',
      'veterinaria',
      'paseador',
      'acompanamiento',
      'acompañamiento',
    ],
    defaultPostType: 'OFERTA_FAVOR',
  },
  {
    category: 'Agua y Energía de Respaldo',
    keywords: [
      'agua potable',
      'bidon',
      'bidón',
      'bidones',
      'generador',
      'grupo electrogeno',
      'grupo electrógeno',
      'bateria',
      'batería',
      'linterna',
      'frazada',
      'frazadas',
      'manta',
      'mantas',
      'ropa abrigadora',
    ],
  },
  {
    category: 'Herramientas Barriales',
    keywords: ['taladro', 'escalera', 'martillo', 'desarmador', 'llave inglesa', 'herramienta'],
  },
];

const CRITICAL_EMERGENCY_REGEX =
  /\b(?:urgente|auxilio|socorro|grave|insulina|ox[ií]geno|atrapad[oa]s?|abuelit[oa]|ancian[oa]|adulto\s+mayor|herid[oa]s?|ambulancia|sismo|terremoto|derrumbe|incendio|infarto|asfixia|electrodependiente|postrad[oa]|silla\s+de\s+ruedas|botiqu[ií]n)\b/i;

const HIGH_URGENCY_REGEX =
  /\b(?:fuga\s+de\s+(?:agua|gas)|cortocircuito|sin\s+agua|inundaci[oó]n|bloquead[oa]|emergencia|ayuda\s+r[aá]pida)\b/i;

const ADDRESS_EXTRACT_REGEX =
  /\b(?:(?:Jr\.|Jir[oó]n|Calle|Av\.|Avenida|Psje\.|Pasaje|Pje\.|Prolongaci[oó]n)\s+[A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s\.\-]+?(?:\d{1,5}(?:\s*(?:Dpto|Depto|Interior|Int|Piso|Mz|Lote|Lt)\.?\s*[A-Za-z0-9\-]+)*|\bMz\.?\s*[A-Za-z0-9\-]+\s*Lt\.?\s*[A-Za-z0-9\-]+))/gi;

const PHONE_EXTRACT_REGEX = /\b(?:(?:\+?51\s*)?9\d{2}[-\s]?\d{3}[-\s]?\d{3})\b/g;

const MEDICAL_EXTRACT_REGEX =
  /\b(?:insuficiencia\s+card[ií]aca(?:\s+severa)?|ox[ií]geno(?:\s+medicinal)?|diabet(?:es|ic[oa])|hipertensi[oó]n|electrodependiente|postrad[oa](?:\s+en\s+(?:cama|silla\s+de\s+ruedas))?|silla\s+de\s+ruedas|insulina(?:\s+NPH)?)\b/gi;

const RESOURCE_QUANTITY_REGEX =
  /\b(\d{1,4})\s+(bidones?|litros?|botellas?|frazadas?|mantas?|balones?|cajas?|paquetes?|raciones?|unidades?|kilos?|kg|sacos?|linternas?|bater[ií]as?)(?:\s+de\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?))?\b/gi;

/**
 * Estrategia Nivel 3 (Fallback Determinista Local <15ms):
 * Opera 100% en TypeScript sin conexión a internet ni librerías externas.
 */
export class LocalHeuristicStrategy implements IIntentParserStrategy {
  public readonly tier = 'TIER_3_DETERMINISTIC_HEURISTIC' as const;
  public readonly name = 'LocalHeuristicStrategy (Motor NLP Determinista es-PE)';

  public async parseIntent(text: string, mode: OperationalMode): Promise<NeighborIntent> {
    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();

    const hasMonetary = MONEY_REGEX.test(cleanText);
    const isCritical = CRITICAL_EMERGENCY_REGEX.test(cleanText);
    const isHighUrgency = HIGH_URGENCY_REGEX.test(cleanText);

    // 1. Detectar categoría barrial según diccionario peruano
    let matchedCategory = 'Apoyo Vecinal';
    let lexiconPostType: NeighborIntent['post_type'] | undefined;

    for (const rule of PERUVIAN_TRADES_LEXICON) {
      if (rule.keywords.some((kw) => fuzzyContains(lower, kw))) {
        matchedCategory = rule.category;
        lexiconPostType = rule.defaultPostType;
        break;
      }
    }

    // 2. Extraer recursos cuantificables si el texto menciona cantidades ("3 bidones de agua", "2 frazadas")
    const extractedResources: ResourceItemInput[] = [];
    for (const match of cleanText.matchAll(RESOURCE_QUANTITY_REGEX)) {
      const qty = Number(match[1]);
      const unitRaw = (match[2] ?? 'unidades').toLowerCase();
      const complement = match[3] ? ` de ${match[3].trim()}` : '';
      if (qty > 0 && qty <= 10000) {
        extractedResources.push({
          item_name: `${unitRaw.charAt(0).toUpperCase() + unitRaw.slice(1)}${complement}`,
          unit: unitRaw,
          quantity_needed: qty,
        });
      }
    }

    // 3. Determinar módulo, tipo de publicación y urgencia
    let module: NeighborIntent['module'] = 'CADENA_FAVORES';
    let post_type: NeighborIntent['post_type'] = 'SOLICITUD_FAVOR';
    let urgency: NeighborIntent['urgency'] = 'BAJA';

    const isOfferVerb =
      /\b(?:ofrezco|presto|comparto|dono|tengo\s+disponible|brindo|soy\s+gasfiter|soy\s+electricist|soy\s+enfermer|atendemos|vendo)\b/i.test(
        cleanText
      );

    if (mode === 'EMERGENCIA' || isCritical) {
      module = 'EMERGENCIA_SOS';
      const isResourceCoordination =
        (isOfferVerb || extractedResources.length > 0) &&
        !lower.includes('atrapad') &&
        !lower.includes('herid') &&
        !lower.includes('infarto');

      post_type = isResourceCoordination && !isCritical ? 'RECURSO_CRITICO' : 'SOS_VULNERABLE';
      urgency = isCritical ? 'CRITICA' : 'ALTA';
      if (matchedCategory === 'Apoyo Vecinal') {
        matchedCategory = 'Brigada de Rescate';
      }
    } else if (
      hasMonetary ||
      lexiconPostType === 'SERVICIO_OFICIO' ||
      lexiconPostType === 'PRODUCTO_LOCAL' ||
      /\b(?:profe|profesor|profesora|gasfitero|electricista|cerrajero|clases|enseña|soy\s+(?:gasfiter[oa]|electricista|cerrajer[oa]|enfermer[oa]|carpinter[oa])|servicio\s+de|vendo|bodega|men[uú]\s+familiar)\b/i.test(
        cleanText
      )
    ) {
      module = 'OFICIOS_PRODUCTOS';
      post_type =
        lexiconPostType ??
        (/\b(?:vendo|bodega|men[uú]|almuerzo|panader[ií]a|abarrotes)\b/i.test(cleanText)
          ? 'PRODUCTO_LOCAL'
          : 'SERVICIO_OFICIO');
      urgency = isHighUrgency ? 'ALTA' : 'BAJA';
    } else {
      module = 'CADENA_FAVORES';
      post_type = isOfferVerb ? 'OFERTA_FAVOR' : 'SOLICITUD_FAVOR';
      urgency = isHighUrgency ? 'ALTA' : 'MEDIA';
    }

    // 4. Sanitización y extracción de PII (Ley N° 29733) en alertas SOS o vulnerables
    let publicDescription = cleanText;
    let isPiiRedacted = false;
    let extractedPii: ExtractedPii | undefined;

    const addresses = publicDescription.match(ADDRESS_EXTRACT_REGEX) ?? [];
    const phones = publicDescription.match(PHONE_EXTRACT_REGEX) ?? [];
    const medicals = publicDescription.match(MEDICAL_EXTRACT_REGEX) ?? [];

    if (phones.length > 0) {
      const candidatePii = {
        exact_address_reference: addresses.join(' / ') || undefined,
        medical_or_mobility_notes: medicals.length > 0 ? medicals.join(', ') : undefined,
        emergency_contact_phone: phones[0]?.trim(),
      };
      const parsedPii = ExtractedPiiSchema.safeParse(candidatePii);
      if (parsedPii.success) {
        extractedPii = parsedPii.data;
      }
    }

    if (post_type === 'SOS_VULNERABLE' || addresses.length > 0 || medicals.length > 0) {
      if (addresses.length > 0) {
        publicDescription = publicDescription.replace(
          ADDRESS_EXTRACT_REGEX,
          '[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]'
        );
        isPiiRedacted = true;
      }
      if (phones.length > 0 && post_type === 'SOS_VULNERABLE') {
        publicDescription = publicDescription.replace(
          PHONE_EXTRACT_REGEX,
          '[TELÉFONO EN BÓVEDA PII]'
        );
        isPiiRedacted = true;
      }
      if (medicals.length > 0 && post_type === 'SOS_VULNERABLE') {
        publicDescription = publicDescription.replace(
          MEDICAL_EXTRACT_REGEX,
          '[CONDICIÓN DE SALUD PROTEGIDA]'
        );
        isPiiRedacted = true;
      }

      if (isPiiRedacted || post_type === 'SOS_VULNERABLE') {
        const candidatePii = {
          exact_address_reference:
            addresses.join(' / ') || 'Ubicación exacta resguardada por GPS del vecino solicitante',
          medical_or_mobility_notes: medicals.length > 0 ? medicals.join(', ') : undefined,
          emergency_contact_phone: phones[0]?.trim() || extractedPii?.emergency_contact_phone,
        };
        const parsedPii = ExtractedPiiSchema.safeParse(candidatePii);
        if (parsedPii.success) {
          extractedPii = parsedPii.data;
        }
      }
    }

    // 5. Formateo inteligente de Título y Autor para Oficios / Docencia / Comercio
    let derivedTitle = '';
    let extractedAuthor = '';

    // Detección explícita de nombre del usuario: "Mi nombre es Hugo", "Me llamo Hugo", "Soy Hugo"
    const explicitNameMatch = cleanText.match(/\b(?:mi\s+nombre\s+es|me\s+llamo)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i);
    if (explicitNameMatch && explicitNameMatch[1]) {
      const candidate = explicitNameMatch[1].toLowerCase();
      extractedAuthor = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    } else {
      const soyMatch = cleanText.match(/\bsoy\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i);
      if (soyMatch && soyMatch[1]) {
        const candidate = soyMatch[1].toLowerCase();
        const isOccupation = /^(?:gasfiter[oa]|electricista|cerrajer[oa]|carpinter[oa]|enfermer[oa]|m[eé]dic[oa]|pintor|albañil|albanil|mec[aá]nic[oa]|t[eé]cnic[oa]|profesor[a]?|docente)$/i.test(candidate);
        if (!isOccupation) {
          extractedAuthor = candidate.charAt(0).toUpperCase() + candidate.slice(1);
        }
      }
    }

    const teacherMatch = cleanText.match(/\b(?:profe|profesor|profesora|docente)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(?:\s+(?:que\s+)?enseña\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+))?/i);
    const tradesmanMatch = cleanText.match(/\b(gasfitero|electricista|cerrajero|carpintero|enfermer[oa]|médico|pintor|albañil|albanil|mecánico|mecanico|técnico|tecnico)(?:\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+))?/i);
    const sellerMatch = cleanText.match(/\b(?:vendo|ofrezco|preparo)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+?)(?:\s+(?:en|de|por)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ\s]+))?$/i);

    if (teacherMatch) {
      const name = teacherMatch[1] ? teacherMatch[1].charAt(0).toUpperCase() + teacherMatch[1].slice(1).toLowerCase() : (extractedAuthor || 'Docente');
      const rawSubject = teacherMatch[2] ? teacherMatch[2].trim() : 'Química y Ciencias';
      const cleanSubject = rawSubject.replace(/^(?:de|en|las|los|la|el)\s+/i, '');
      derivedTitle = `Prof. ${name} · Clases de ${cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1)}`;
    } else if (tradesmanMatch) {
      const rawTrade = tradesmanMatch[1]!.toLowerCase();
      const tradeNormalized =
        rawTrade.startsWith('gasfit') ? 'Gasfitería' :
        rawTrade.startsWith('electr') ? 'Electricidad' :
        rawTrade.startsWith('cerraj') ? 'Cerrajería' :
        rawTrade.startsWith('carpint') ? 'Carpintería' :
        rawTrade.startsWith('enferm') ? 'Enfermería' :
        rawTrade.startsWith('méd') || rawTrade.startsWith('med') ? 'Atención Médica' :
        rawTrade.startsWith('pint') ? 'Pintura' :
        rawTrade.startsWith('albañ') || rawTrade.startsWith('alban') ? 'Albañilería' :
        rawTrade.startsWith('mecan') || rawTrade.startsWith('mecán') ? 'Mecánica' :
        tradesmanMatch[1]!.charAt(0).toUpperCase() + tradesmanMatch[1]!.slice(1);

      // Si tradesmanMatch tiene una palabra siguiente, descartar palabras vacías / verbos como "estoy", "para", "de", "en", "con", "a"
      const rawFollowing = tradesmanMatch[2] ? tradesmanMatch[2].toLowerCase() : '';
      const isNoiseWord = /^(?:estoy|disponible|diponible|atiendo|hago|trabajo|para|de|en|con|a|por|mi|tu|su|un|una)$/i.test(rawFollowing);
      
      const tradeName = extractedAuthor || (!isNoiseWord && tradesmanMatch[2] ? tradesmanMatch[2].charAt(0).toUpperCase() + tradesmanMatch[2].slice(1).toLowerCase() : 'Especialista');
      derivedTitle = `${tradeName} · ${tradeNormalized} y Servicios para el Hogar`;
    } else if (sellerMatch && (lexiconPostType === 'PRODUCTO_LOCAL' || matchedCategory.includes('Alimentación'))) {
      const product = sellerMatch[1]!.trim();
      derivedTitle = `${product.charAt(0).toUpperCase() + product.slice(1)} Caseros · Venta Local`;
    }

    const title =
      derivedTitle ||
      (publicDescription.length > 65
        ? `${publicDescription.slice(0, 62).trim()}...`
        : publicDescription.length >= 5
          ? publicDescription
          : `Aviso vecinal: ${matchedCategory}`);

    const safeDescription =
      publicDescription.length >= 10
        ? publicDescription
        : `${publicDescription} — Reportado en el sector barrial.`;

    return NeighborIntentSchema.parse({
      module,
      post_type,
      category: matchedCategory,
      title,
      description: safeDescription,
      urgency,
      zero_money_compliant: !hasMonetary,
      has_monetary_intent: hasMonetary,
      is_pii_redacted: isPiiRedacted,
      extracted_pii: extractedPii,
      resources: extractedResources.length > 0 ? extractedResources : undefined,
    });
  }
}
