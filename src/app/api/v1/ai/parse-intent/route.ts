import { z } from 'zod';
import {
  ExtractedPiiSchema,
  MONEY_REGEX,
  NeighborIntentSchema,
  type ExtractedPii,
  type NeighborIntent,
} from '@shared/schemas';
import {
  checkRateLimit,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { parseNeighborIntentWithMeta } from '@/lib/ai/ai-orchestrator';

const ParseIntentRequestSchema = z.object({
  text: z
    .string({ required_error: 'El texto a analizar es obligatorio.' })
    .min(3, 'El texto debe tener al menos 3 caracteres.')
    .max(1000, 'El texto no debe superar los 1000 caracteres.'),
  current_mode: z.enum(['HABITUAL', 'EMERGENCIA']).default('HABITUAL'),
  user_lat: z.number().optional(),
  user_lng: z.number().optional(),
});

const CRITICAL_SOS_REGEX =
  /(?:urgente|auxilio|grave|insulina|ox[ií]geno|atrapad[oa]|abuelit[oa]|herid[oa]|ambulancia|sismo|derrumbe|infarto|asfixia|electrodependiente)/i;

const ADDRESS_EXTRACT_REGEX =
  /\b(?:(?:Jr\.|Jir[oó]n|Calle|Av\.|Avenida|Psje\.|Pasaje|Pje\.|Prolongaci[oó]n)\s+[A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s\.\-]+?(?:\d{1,5}(?:\s*(?:Dpto|Depto|Interior|Int|Piso|Mz|Lote|Lt)\.?\s*[A-Za-z0-9\-]+)*|\bMz\.?\s*[A-Za-z0-9\-]+\s*Lt\.?\s*[A-Za-z0-9\-]+))/gi;

const PHONE_EXTRACT_REGEX = /\b(?:(?:\+?51\s*)?9\d{2}[-\s]?\d{3}[-\s]?\d{3})\b/g;

const MEDICAL_EXTRACT_REGEX =
  /\b(?:insuficiencia\s+card[ií]aca(?:\s+severa)?|ox[ií]geno(?:\s+medicinal)?|diabet(?:es|ico)|hipertensi[oó]n|electrodependiente|postrad[oa]|silla\s+de\s+ruedas|insulina)\b/gi;

/**
 * Clasificador determinista instantáneo (<15ms) con redacción de PII y detección Cero Dinero.
 * En MOD-08 se conecta con la cadena Strategy completa (Gemini 2.5 Flash -> Local LLM -> Heurístico).
 */
function deterministicParseNeighborIntent(
  text: string,
  currentMode: 'HABITUAL' | 'EMERGENCIA'
): NeighborIntent {
  const hasMonetary = MONEY_REGEX.test(text);
  const isCritical = CRITICAL_SOS_REGEX.test(text);
  const lower = text.toLowerCase();

  let module: NeighborIntent['module'] = 'CADENA_FAVORES';
  let post_type: NeighborIntent['post_type'] = 'SOLICITUD_FAVOR';
  let urgency: NeighborIntent['urgency'] = 'MEDIA';
  let category = 'Herramientas Barriales';

  if (currentMode === 'EMERGENCIA' || isCritical) {
    module = 'EMERGENCIA_SOS';
    const isResourceOffer =
      (lower.includes('tengo') || lower.includes('ofrezco') || lower.includes('comparto')) &&
      (lower.includes('agua') || lower.includes('generador') || lower.includes('botiqu'));

    post_type = isResourceOffer ? 'RECURSO_CRITICO' : 'SOS_VULNERABLE';
    urgency = isCritical ? 'CRITICA' : 'ALTA';
    category =
      lower.includes('insulina') || lower.includes('oxígeno') || lower.includes('oxigeno')
        ? 'Botica e Insumos Médicos'
        : 'Brigada de Rescate';
  } else if (hasMonetary) {
    module = 'OFICIOS_PRODUCTOS';
    post_type =
      lower.includes('vendo') || lower.includes('botica') || lower.includes('bodega')
        ? 'PRODUCTO_LOCAL'
        : 'SERVICIO_OFICIO';
    urgency = 'BAJA';
    category = lower.includes('gasfiter')
      ? 'Gasfitería'
      : lower.includes('electric')
        ? 'Electricidad'
        : 'Servicios Generales';
  } else {
    module = 'CADENA_FAVORES';
    post_type =
      lower.includes('presto') || lower.includes('ofrezco') || lower.includes('dono')
        ? 'OFERTA_FAVOR'
        : 'SOLICITUD_FAVOR';
    urgency = 'BAJA';
    category =
      lower.includes('taladro') || lower.includes('escalera')
        ? 'Herramientas Barriales'
        : 'Apoyo Vecinal';
  }

  let publicDescription = text.trim();
  let isPiiRedacted = false;
  let extractedPii: ExtractedPii | undefined;

  if (post_type === 'SOS_VULNERABLE') {
    const addresses = publicDescription.match(ADDRESS_EXTRACT_REGEX) ?? [];
    const phones = publicDescription.match(PHONE_EXTRACT_REGEX) ?? [];
    const medicals = publicDescription.match(MEDICAL_EXTRACT_REGEX) ?? [];

    if (addresses.length > 0) {
      publicDescription = publicDescription.replace(
        ADDRESS_EXTRACT_REGEX,
        '[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]'
      );
      isPiiRedacted = true;
    }
    if (phones.length > 0) {
      publicDescription = publicDescription.replace(
        PHONE_EXTRACT_REGEX,
        '[TELÉFONO EN BÓVEDA PII]'
      );
      isPiiRedacted = true;
    }
    if (medicals.length > 0) {
      publicDescription = publicDescription.replace(
        MEDICAL_EXTRACT_REGEX,
        '[CONDICIÓN DE SALUD PROTEGIDA]'
      );
      isPiiRedacted = true;
    }

    const candidatePii = {
      exact_address_reference:
        addresses.join(' / ') || 'Dirección reportada por GPS del vecino solicitante',
      medical_or_mobility_notes: medicals.length > 0 ? medicals.join(', ') : undefined,
      emergency_contact_phone: phones[0]?.trim(),
    };

    const parsedPii = ExtractedPiiSchema.safeParse(candidatePii);
    if (parsedPii.success) {
      extractedPii = parsedPii.data;
    }
  }

  const rawTitle = publicDescription.length > 65
    ? `${publicDescription.slice(0, 62)}...`
    : publicDescription;

  return NeighborIntentSchema.parse({
    module,
    post_type,
    category,
    title: rawTitle,
    description: publicDescription,
    urgency,
    zero_money_compliant: !hasMonetary,
    has_monetary_intent: hasMonetary,
    is_pii_redacted: isPiiRedacted,
    extracted_pii: extractedPii,
  });
}

/**
 * 13. POST /api/v1/ai/parse-intent
 * Procesa texto dictado o escrito y retorna `NeighborIntentDto` validado con Zod.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes de IA excedido.',
      '/api/v1/ai/parse-intent',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const rawBody = await request.json();
    const { text, current_mode } = ParseIntentRequestSchema.parse(rawBody);
    let execution;
    try {
      execution = await parseNeighborIntentWithMeta(text, current_mode);
    } catch {
      const fallbackIntent = deterministicParseNeighborIntent(text, current_mode);
      execution = {
        intent: fallbackIntent,
        tier_used: 'TIER_3_DETERMINISTIC_HEURISTIC' as const,
        strategy_name: 'LocalHeuristicFallback',
        latency_ms: 1,
      };
    }

    return jsonOk(execution.intent, {
      tier_used: execution.tier_used,
      strategy_name: execution.strategy_name,
      latency_ms: execution.latency_ms,
      fallback_reason: execution.fallback_reason ?? null,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/ai/parse-intent');
  }
}
