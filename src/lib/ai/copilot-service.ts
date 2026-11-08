import type { IListingLocal, IPostLocal, OperationalMode } from '@shared/types';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';

export interface CopilotSpecialistMatch {
  title: string;
  listing_type: IListingLocal['listing_type'];
  description: string;
  contact_phone: string;
  weighted_trust_score: number;
  endorsement_count: number;
  available_for_emergencies: boolean;
  emergency_response_note?: string;
  public_lat?: number;
  public_lng?: number;
}

export interface CopilotAlertMatch {
  title: string;
  post_type: IPostLocal['post_type'];
  urgency_level: IPostLocal['urgency_level'];
  description: string;
  status: IPostLocal['status'];
  contact_phone?: string;
  public_lat?: number;
  public_lng?: number;
}

export interface CopilotResponse {
  query: string;
  answer: string;
  recommended_specialists: CopilotSpecialistMatch[];
  related_alerts: CopilotAlertMatch[];
  used_cloud_llm: boolean;
  latency_ms: number;
}

export interface NeighborhoodCopilotOptions {
  db?: RedVecinaLocalDB;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Grupos de expansión semántica para jerga barrial de Lima, permitiendo que
 * "caño roto" o "fuga de agua" coincida con "Gasfitero matriculado", etc.
 */
const SEMANTIC_EXPANSION_GROUPS: string[][] = [
  [
    'gasfitero',
    'gasfiteria',
    'gasfitería',
    'fuga',
    'caño',
    'cano',
    'agua',
    'tuberia',
    'tubería',
    'desague',
    'desagüe',
    'atoro',
    'cisterna',
    'tanque',
  ],
  [
    'electricista',
    'electricidad',
    'luz',
    'tablero',
    'cortocircuito',
    'termomagnetico',
    'termomagnético',
    'diferencial',
    'enchufe',
    'apagon',
    'apagón',
    'generador',
  ],
  [
    'cerrajero',
    'cerrajeria',
    'cerrajería',
    'llave',
    'chapa',
    'cerradura',
    'puerta',
    'candado',
  ],
  [
    'enfermera',
    'enfermero',
    'salud',
    'oxigeno',
    'oxígeno',
    'insulina',
    'inyeccion',
    'inyección',
    'botica',
    'farmacia',
    'presion',
    'presión',
    'botiquin',
    'botiquín',
    'auxilio',
    'medico',
    'médico',
  ],
  [
    'comida',
    'almuerzo',
    'menu',
    'menú',
    'bodega',
    'panaderia',
    'panadería',
    'viveres',
    'víveres',
    'olla',
  ],
  [
    'rescate',
    'sismo',
    'terremoto',
    'derrumbe',
    'brigada',
    'camilla',
    'evacuacion',
    'evacuación',
    'abuelita',
    'adulto mayor',
    'silla de ruedas',
    'atrapado',
    'atrapada',
    'herido',
    'herida',
    'primeros auxilios',
    'inundacion',
    'inundación',
    'huaico',
    'mantaro',
  ],
  [
    'profesor',
    'profe',
    'profesora',
    'docente',
    'clases',
    'matematica',
    'matemática',
    'quimica',
    'química',
    'fisica',
    'física',
    'escolar',
    'nivelacion',
    'nivelación',
    'tareas',
    'reforzamiento',
    'ingles',
    'inglés',
  ],
  [
    'carpintero',
    'carpinteria',
    'carpintería',
    'mueble',
    'muebles',
    'madera',
    'mesa',
    'silla',
  ],
  [
    'pintor',
    'pintura',
    'albanil',
    'albañil',
    'albañileria',
    'albañilería',
    'cemento',
    'techo',
    'pared',
    'rajadura',
  ],
  [
    'mecanico',
    'mecánico',
    'mecanica',
    'mecánica',
    'taller',
    'moto',
    'mototaxi',
    'bicicleta',
    'llanta',
    'flete',
  ],
  [
    'cuidado',
    'cuidador',
    'cuidadora',
    'mascota',
    'veterinario',
    'perro',
    'gato',
  ],
  [
    'agua',
    'potable',
    'bidon',
    'bidones',
    'sedapal',
    'sedam',
    'corte',
    'cisterna',
    'tanque',
    'balde',
    'acopio',
    'sedam huancayo',
  ],
  [
    'muletas',
    'andador',
    'baston',
    'bastón',
    'silla de ruedas',
    'ferula',
    'férula',
    'ortopedico',
    'ortopédico',
    'movilidad',
    'anciano',
    'abuelo',
    'abuelita',
    'adulto mayor',
    'geriátrico',
    'geriatrico',
  ],
  [
    'torta',
    'tortas',
    'arroz',
    'dulce',
    'pastel',
    'postre',
    'queque',
    'pan',
    'panaderia',
    'panadería',
    'bocaditos',
    'casero',
  ],
  [
    'ferreteria',
    'ferretería',
    'herramienta',
    'herramientas',
    'martillo',
    'taladro',
    'alicate',
    'tornillo',
    'clavos',
    'alquiler',
    'materiales',
    'construccion',
    'construcción',
  ],
  [
    'posta',
    'salud',
    'medico',
    'médico',
    'brigada',
    'inyeccion',
    'inyección',
    'presion',
    'presión',
    'enfermera',
    'triaje',
    'urgencia',
    'auxilio',
    'curacion',
    'curación',
  ],
  [
    'acopio',
    'solidario',
    'donacion',
    'donación',
    'víveres',
    'viveres',
    'apoyo',
    'ayuda',
    'alimentos',
    'coliseo',
    'refugio',
    'comunitario',
  ],
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extrae términos clave expandidos con sinónimos barriales peruanos.
 */
export function expandQueryTerms(query: string): string[] {
  const normalized = normalizeText(query);
  const rawTokens = normalized
    .split(/[^a-z0-9ñ]+/)
    .filter((token) => token.length >= 3 && !['quien', 'puede', 'ayudar', 'con', 'una', 'para', 'del', 'los', 'las', 'por', 'favor', 'donde', 'hay', 'necesito', 'busco'].includes(token));

  const expanded = new Set<string>(rawTokens);

  for (const group of SEMANTIC_EXPANSION_GROUPS) {
    const normalizedGroup = group.map(normalizeText);
    if (normalizedGroup.some((term) => normalized.includes(term))) {
      for (const term of normalizedGroup) {
        expanded.add(term);
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Servicio del Copiloto Barrial RAG (MOD-09):
 * Consulta `localDb` (Dexie.js), construye un contexto RAG con los 5 especialistas
 * de mayor puntaje de confianza (`weighted_trust_score`) y alertas activas del sector,
 * y genera una respuesta empática con números telefónicos de contacto directo.
 */
export class NeighborhoodCopilotService {
  private readonly db: RedVecinaLocalDB;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NeighborhoodCopilotOptions = {}) {
    this.db = options.db ?? localDb;
    this.apiKey =
      options.apiKey ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
      process.env.GEMINI_API_KEY;
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  public async ask(
    query: string,
    mode: OperationalMode = 'HABITUAL'
  ): Promise<CopilotResponse> {
    const startTime = performance.now();
    const expandedTerms = expandQueryTerms(query);

    const allListings = await this.db.listings.toArray();
    const allPosts = await this.db.posts.toArray();

    // 1. Puntuar y filtrar los 5 mejores especialistas del catálogo local (RAG Retrieval)
    const scoredListings = allListings
      .map((item) => {
        const haystack = normalizeText(`${item.title} ${item.description} ${item.listing_type}`);
        let keywordHits = 0;
        for (const term of expandedTerms) {
          if (haystack.includes(term)) {
            keywordHits += 1;
          }
        }
        const emergencyBonus =
          mode === 'EMERGENCIA' && item.available_for_emergencies ? 2.5 : 0;

        const relevanceScore =
          keywordHits * 10 + item.weighted_trust_score + emergencyBonus;

        return {
          item,
          keywordHits,
          relevanceScore,
        };
      })
      .sort((a, b) => {
        if (b.keywordHits !== a.keywordHits) {
          return b.keywordHits - a.keywordHits;
        }
        return b.item.weighted_trust_score - a.item.weighted_trust_score;
      });

    // Si hay coincidencias por palabras clave, priorizarlas; de lo contrario, entregar el Top 5 general de confianza
    const matchedListings = scoredListings.filter((entry) => entry.keywordHits > 0);
    const topFiveSource = (matchedListings.length > 0 ? matchedListings : scoredListings).slice(
      0,
      5
    );

    const recommendedSpecialists: CopilotSpecialistMatch[] = topFiveSource.map(
      ({ item }) => ({
        title: item.title,
        listing_type: item.listing_type,
        description: item.description,
        contact_phone: item.contact_phone,
        weighted_trust_score: item.weighted_trust_score,
        endorsement_count: item.endorsement_count,
        available_for_emergencies: item.available_for_emergencies,
        emergency_response_note: item.emergency_response_note,
        public_lat: item.latitude,
        public_lng: item.longitude,
      })
    );

    // 2. Recuperar alertas o publicaciones solidarias activas relacionadas
    const activePosts = allPosts.filter(
      (p) => p.status === 'ACTIVO' || p.status === 'EN_COORDINACION'
    );

    const relatedAlerts: CopilotAlertMatch[] = activePosts
      .filter((post) => {
        const haystack = normalizeText(`${post.title} ${post.description}`);
        return (
          expandedTerms.some((term) => haystack.includes(term)) ||
          (mode === 'EMERGENCIA' && post.urgency_level === 'CRITICA')
        );
      })
      .slice(0, 3)
      .map((post) => ({
        title: post.title,
        post_type: post.post_type,
        urgency_level: post.urgency_level,
        description: post.description,
        status: post.status,
        contact_phone: (post as unknown as { contact_phone?: string }).contact_phone,
        public_lat: post.public_lat,
        public_lng: post.public_lng,
      }));

    // 3. Si hay API Key de Gemini y red disponible, intentar síntesis generativa con contexto RAG
    const isOnline =
      typeof navigator === 'undefined' ? true : navigator.onLine !== false;

    if (this.apiKey && isOnline) {
      try {
        const cloudAnswer = await this.generateCloudRagAnswer(
          query,
          mode,
          recommendedSpecialists,
          relatedAlerts
        );
        return {
          query,
          answer: cloudAnswer,
          recommended_specialists: recommendedSpecialists,
          related_alerts: relatedAlerts,
          used_cloud_llm: true,
          latency_ms: Math.max(0.1, Number((performance.now() - startTime).toFixed(2))),
        };
      } catch {
        // Degradar silenciosamente al motor determinista RAG local
      }
    }

    // 4. Síntesis determinista Offline-First empática con números telefónicos directos
    const deterministicAnswer = this.buildDeterministicAnswer(
      query,
      mode,
      recommendedSpecialists,
      relatedAlerts
    );

    return {
      query,
      answer: deterministicAnswer,
      recommended_specialists: recommendedSpecialists,
      related_alerts: relatedAlerts,
      used_cloud_llm: false,
      latency_ms: Math.max(0.1, Number((performance.now() - startTime).toFixed(2))),
    };
  }

  private buildDeterministicAnswer(
    query: string,
    mode: OperationalMode,
    specialists: CopilotSpecialistMatch[],
    alerts: CopilotAlertMatch[]
  ): string {
    if (specialists.length === 0 && alerts.length === 0) {
      return `Hola vecino(a). En este momento no encontré registros locales exactos para "${query}" en tu sector, pero puedes tocar el botón central "Publicar en mi Barrio" para enviar una alerta inmediata a tus vecinos cercanos.`;
    }

    const lines: string[] = [];
    if (mode === 'EMERGENCIA') {
      lines.push(
        '🚨 **Copiloto Barrial (Modo Emergencia Activo):** He revisado el padrón local guardado en tu teléfono y encontré estos contactos y recursos prioritarios:'
      );
    } else {
      lines.push(
        '💡 **Copiloto Barrial Comunitario:** Según las recomendaciones y vistos buenos de tus vecinos, aquí tienes los contactos más confiables en tu sector:'
      );
    }

    for (const [idx, spec] of specialists.slice(0, 3).entries()) {
      const emergencyBadge = spec.available_for_emergencies ? ' [Disponible SOS 24/7]' : '';
      const isSolidario = ['SOPORTE_EMERGENCIA'].includes(spec.listing_type ?? '');
      const scoreLine = isSolidario
        ? ''
        : ` — 🤝 ${spec.endorsement_count} vecinos lo recomiendan.`;
      lines.push(
        `${idx + 1}. **${spec.title}**${emergencyBadge}${scoreLine} Teléfono directo: **${spec.contact_phone}**.`
      );
    }

    if (alerts.length > 0) {
      lines.push(
        `\n📢 **Avisos activos relacionados en tu cuadra (${alerts.length}):** ${alerts
          .map((a) => `"${a.title}" [${a.urgency_level}]`)
          .join('; ')}.`
      );
    }

    return lines.join('\n');
  }

  private async generateCloudRagAnswer(
    query: string,
    mode: OperationalMode,
    specialists: CopilotSpecialistMatch[],
    alerts: CopilotAlertMatch[]
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error('COPILOT_GEMINI_TIMEOUT'));
    }, this.timeoutMs);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        this.apiKey!
      )}`;

      const ragContext = JSON.stringify(
        {
          operational_mode: mode,
          top_5_specialists: specialists,
          active_sector_alerts: alerts,
        },
        null,
        2
      );

      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'Eres el Copiloto Barrial de RedVecina en Lima, Perú. Responde de forma concisa, cálida y empática para adultos mayores. Incluye SIEMPRE los nombres y números telefónicos exactos del contexto RAG proporcionado. No inventes teléfonos fuera del contexto.',
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Contexto RAG Local del Barrio:\n${ragContext}\n\nConsulta del vecino: "${query}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`COPILOT_HTTP_${response.status}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        throw new Error('COPILOT_EMPTY_RESPONSE');
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }
}

const defaultCopilotService = new NeighborhoodCopilotService();

export async function askNeighborhoodCopilot(
  query: string,
  mode: OperationalMode = 'HABITUAL'
): Promise<CopilotResponse> {
  return defaultCopilotService.ask(query, mode);
}
