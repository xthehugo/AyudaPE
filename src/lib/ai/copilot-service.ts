import type { IListingLocal, IPostLocal, OperationalMode } from '@shared/types';
import { localDb, type RedVecinaLocalDB } from '@/lib/offline/db';
import { syncManager } from '@/lib/offline/sync-manager';
import {
  findEmergencyTriageScenario,
  formatEmergencyTriageText,
  getGeminiSystemInstructionWithKnowledge,
  type EmergencyTriageScenario,
} from './emergency-knowledge-base';

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
  emergency_scenario?: EmergencyTriageScenario;
}

export interface NeighborhoodCopilotOptions {
  db?: RedVecinaLocalDB;
  apiKey?: string;
  timeoutMs?: number;
  isOnline?: boolean;
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
  private readonly forcedIsOnline: boolean | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NeighborhoodCopilotOptions = {}) {
    this.db = options.db ?? localDb;
    this.forcedIsOnline = options.isOnline;
    const candidates = [
      options.apiKey,
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GEMINI_API_KEY : undefined,
      typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined,
      typeof process !== 'undefined' ? process.env.GOOGLE_GENERATIVE_AI_API_KEY : undefined,
    ]
      .map((k) => k?.trim().replace(/^["']|["']$/g, ''))
      .filter((k): k is string => Boolean(k && k.length > 5));

    const pauseCloudAi =
      typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_PAUSE_CLOUD_AI === 'true' &&
      !options.apiKey &&
      !options.fetchImpl;

    this.apiKey = pauseCloudAi
      ? undefined
      : (candidates.find((k) => k.startsWith('AIzaSy') || k.startsWith('AQ.')) ?? candidates[0]);
    this.timeoutMs = options.timeoutMs ?? 5000;
    const rawFetch = options.fetchImpl ?? globalThis.fetch;
    this.fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => rawFetch(input, init);
  }

  public async ask(
    query: string,
    mode: OperationalMode = 'HABITUAL'
  ): Promise<CopilotResponse> {
    const startTime = performance.now();
    const emergencyScenario = findEmergencyTriageScenario(query);
    const expandedTerms = expandQueryTerms(query);

    if (emergencyScenario) {
      for (const kw of emergencyScenario.targetSpecialistTypes) {
        if (!expandedTerms.includes(kw)) {
          expandedTerms.push(kw);
        }
      }
    }

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
          (mode === 'EMERGENCIA' || Boolean(emergencyScenario)) && item.available_for_emergencies
            ? 15
            : 0;

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
          (mode === 'EMERGENCIA' && post.urgency_level === 'CRITICA') ||
          (Boolean(emergencyScenario) && post.urgency_level === 'CRITICA')
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

    // 3. Síntesis Cloud con Gemini: respetar corte manual offline, syncManager y estado real del navegador
    const isManualOffline =
      typeof window !== 'undefined' &&
      localStorage.getItem('redvecina_manual_offline') === 'true';
    const isSyncOnline = typeof syncManager !== 'undefined' ? syncManager.getState().isOnline : true;
    const isBrowserOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

    const isOnline = isManualOffline
      ? false
      : (this.forcedIsOnline !== undefined
          ? this.forcedIsOnline
          : (isSyncOnline && isBrowserOnline));

    if (!isOnline) {
      console.log('[Copilot Modo Offline Activo] Operando en RAG Determinista Local');
    }

    // 3.1. En el navegador (PWA), priorizar SIEMPRE el endpoint servidor /api/v1/ai/copilot-chat
    // Esto garantiza cero problemas de CORS con Google API, no expone la API key y usa los modelos en cascada.
    if (isOnline && typeof window !== 'undefined') {
      try {
        const serverRes = await this.fetchImpl('/api/v1/ai/copilot-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: query,
            current_mode: mode,
          }),
        });
        if (serverRes.ok) {
          const apiJson = (await serverRes.json()) as {
            data?: {
              reply?: string;
              used_cloud_llm?: boolean;
            };
          };
          if (apiJson.data?.reply && apiJson.data?.used_cloud_llm) {
            console.log('[Copilot Cloud Gemini Conectado]', apiJson.data.reply);
            return {
              query,
              answer: apiJson.data.reply,
              recommended_specialists: recommendedSpecialists,
              related_alerts: relatedAlerts,
              used_cloud_llm: true,
              latency_ms: Math.max(0.1, Number((performance.now() - startTime).toFixed(2))),
              emergency_scenario: emergencyScenario ?? undefined,
            };
          } else {
            console.warn('[Copilot Server Fallback - Respuesta no Cloud]', apiJson);
          }
        } else {
          console.warn('[Copilot Server Fallback - HTTP Error]', serverRes.status);
        }
      } catch (serverErr) {
        console.warn('[Copilot Server Endpoint Fallback Error]', serverErr);
      }
    }

    // 3.2. Si estamos en entorno Node/testing o la llamada al servidor no respondió, intentar Gemini directo si hay apiKey
    if (this.apiKey && isOnline) {
      try {
        const cloudAnswer = await this.generateCloudRagAnswer(
          query,
          mode,
          recommendedSpecialists,
          relatedAlerts,
          emergencyScenario
        );
        return {
          query,
          answer: cloudAnswer,
          recommended_specialists: recommendedSpecialists,
          related_alerts: relatedAlerts,
          used_cloud_llm: true,
          latency_ms: Math.max(0.1, Number((performance.now() - startTime).toFixed(2))),
          emergency_scenario: emergencyScenario ?? undefined,
        };
      } catch (directErr) {
        console.warn('[Copilot Direct Gemini Fallback]', directErr);
      }
    }

    // 4. Síntesis determinista Offline-First empática con números telefónicos directos
    const deterministicAnswer = this.buildDeterministicAnswer(
      query,
      mode,
      recommendedSpecialists,
      relatedAlerts,
      emergencyScenario
    );

    return {
      query,
      answer: deterministicAnswer,
      recommended_specialists: recommendedSpecialists,
      related_alerts: relatedAlerts,
      used_cloud_llm: false,
      latency_ms: Math.max(0.1, Number((performance.now() - startTime).toFixed(2))),
      emergency_scenario: emergencyScenario ?? undefined,
    };
  }

  private buildDeterministicAnswer(
    query: string,
    mode: OperationalMode,
    specialists: CopilotSpecialistMatch[],
    alerts: CopilotAlertMatch[],
    emergencyScenario: EmergencyTriageScenario | null = null
  ): string {
    const lines: string[] = [];

    if (emergencyScenario) {
      lines.push(formatEmergencyTriageText(emergencyScenario));
      if (specialists.length > 0) {
        lines.push('\n[ESPECIALISTAS Y RECURSOS EN TU CUADRA]');
      }
    } else if (specialists.length === 0 && alerts.length === 0) {
      const norm = normalizeText(query);
      if (['dolor', 'duele', 'cabeza', 'estomago', 'diente', 'muela', 'garganta', 'pecho', 'espalda', 'malestar'].some((k) => norm.includes(k))) {
        lines.push('[ORIENTACION DE PRIMEROS AUXILIOS Y SALUD]');
        lines.push(
          'Para dolores o malestares fisicos:\n1. Guarda reposo en una posicion comoda y evita la automedicacion.\n2. Si el dolor es intenso, continuo o se acompana de fiebre o dificultad respiratoria, acude a emergencias o llama gratis a la Linea 113 Salud (MINSA, 24 horas) o al SAMU 106.\n3. En la pestana "Oficios" puedes consultar enfermeras y boticas locales con Visto Bueno de tus vecinos.'
        );
      } else if (['agua', 'fuga', 'tuberia', 'cano', 'desague', 'cisterna', 'inundacion'].some((k) => norm.includes(k))) {
        lines.push('[ORIENTACION DE GASFITERIA Y EMERGENCIAS DOMICILIARIAS]');
        lines.push(
          '1. Cierra de inmediato la llave de paso general de agua para evitar danos estructurales e inundaciones.\n2. Evita manipular interruptores electricos cerca de zonas anegadas.\n3. En la pestana "Oficios" puedes contactar a gasfiteros locales con Visto Bueno barrial disponibles de guardia.'
        );
      } else if (['luz', 'cable', 'chispas', 'cortocircuito', 'apagon', 'enchufe', 'tablero'].some((k) => norm.includes(k))) {
        lines.push('[ORIENTACION DE SEGURIDAD ELECTRICA]');
        lines.push(
          '1. Baja inmediatamente la llave termomagnetica general en tu tablero electrico.\n2. NO toques cables expuestos ni enchufes con humedad.\n3. En la pestana "Oficios" puedes contactar electricistas de confianza en tu sector.'
        );
      } else if (['como funciona', 'que es', 'ayudape', 'solidario', 'muro', 'pin', 'guia'].some((k) => norm.includes(k))) {
        lines.push('[GUIA RAPIDA DE FUNCIONAMIENTO · AYUDAPE]');
        lines.push(
          '• Oficios Locales: Directorio hiperlocal sin comisiones con Visto Bueno de vecinos a menos de 200m.\n• Muro Solidario: Cooperacion vecinal con cero dinero y validacion por codigo PIN.\n• Rescate SOS: Baliza acustica Morse a 880 Hz, malla P2P offline y modo pantalla negra 72h.\n• Privacidad: Proteccion Ley N 29733 con radio difuminado de 50 metros.'
        );
      } else {
        lines.push('[COPILOTO BARRIAL OFFLINE]');
        lines.push(
          `He procesado tu consulta ("${query}") en la memoria local de tu telefono.\n\nPara coordinar un servicio o ayuda comunitaria con tus vecinos cercanos, puedes tocar el boton central "Publicar en mi Barrio" o explorar las pestanas "Oficios" y "Solidario".`
        );
      }
      return lines.join('\n');
    } else if (mode === 'EMERGENCIA') {
      lines.push(
        '[EMERGENCIA] **Copiloto Barrial (Modo Emergencia Activo):** He revisado el padrón local guardado en tu teléfono y encontré estos contactos y recursos prioritarios:'
      );
    } else {
      lines.push(
        '[COPILOTO] **Copiloto Barrial Comunitario:** Según las recomendaciones y vistos buenos de tus vecinos, aquí tienes los contactos más confiables en tu sector:'
      );
    }

    for (const [idx, spec] of specialists.slice(0, 3).entries()) {
      const emergencyBadge = spec.available_for_emergencies ? ' [Disponible SOS 24/7]' : '';
      const isSolidario = ['SOPORTE_EMERGENCIA'].includes(spec.listing_type ?? '');
      const scoreLine = isSolidario
        ? ''
        : ` — ${spec.endorsement_count} vecinos lo recomiendan.`;
      lines.push(
        `${idx + 1}. **${spec.title}**${emergencyBadge}${scoreLine} Teléfono directo: **${spec.contact_phone}**.`
      );
    }

    if (alerts.length > 0) {
      lines.push(
        `\n• **Avisos activos relacionados en tu cuadra (${alerts.length}):** ${alerts
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
    alerts: CopilotAlertMatch[],
    emergencyScenario: EmergencyTriageScenario | null = null
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error('COPILOT_GEMINI_TIMEOUT'));
    }, this.timeoutMs);

    try {
      const MODELS = [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];
      const ragContext = JSON.stringify(
        {
          operational_mode: mode,
          emergency_triage_scenario: emergencyScenario
            ? {
                title: emergencyScenario.title,
                urgency: emergencyScenario.urgencyLevel,
                immediate_actions: emergencyScenario.immediateActions,
                never_do: emergencyScenario.neverDo,
                calm_message: emergencyScenario.calmMessage,
                emergency_phones: emergencyScenario.emergencyPhones,
              }
            : null,
          top_5_specialists: specialists,
          active_sector_alerts: alerts,
        },
        null,
        2
      );

      for (const model of MODELS) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
            this.apiKey!
          )}`;

          const response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': this.apiKey!,
            },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: getGeminiSystemInstructionWithKnowledge(),
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

          if (response.ok) {
            const data = (await response.json()) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            };

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
              return text;
            }
          }
        } catch {
          // Probar siguiente modelo
        }
      }
      throw new Error('COPILOT_EMPTY_RESPONSE');
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
