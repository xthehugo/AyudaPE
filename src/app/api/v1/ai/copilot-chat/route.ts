import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

const CopilotChatRequestSchema = z.object({
  prompt: z
    .string({ required_error: 'La consulta al Copiloto Barrial es obligatoria.' })
    .min(2, 'La consulta debe tener al menos 2 caracteres.')
    .max(500, 'La consulta no puede superar los 500 caracteres.'),
  sector_id: z.number().int().positive().default(1),
  current_mode: z.enum(['HABITUAL', 'EMERGENCIA']).default('HABITUAL'),
});

/**
 * 14. POST /api/v1/ai/copilot-chat
 * Recibe consulta vecinal y responde asistido por RAG territorial sobre los 5 especialistas
 * con mayor puntaje de Visto Bueno Vecinal y grupos de apoyo activos del sector.
 */
export async function POST(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de consultas al Copiloto excedido.',
      '/api/v1/ai/copilot-chat',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const rawBody = await request.json();
    const { prompt, sector_id, current_mode } = CopilotChatRequestSchema.parse(rawBody);

    const database = getApiDatabaseInstance();

    const topSpecialists = await database
      .select({
        id: schema.proximity_listing.id,
        title: schema.proximity_listing.title,
        listing_type: schema.proximity_listing.listing_type,
        contact_phone: schema.proximity_listing.contact_phone,
        weighted_trust_score: schema.proximity_listing.weighted_trust_score,
        available_for_emergencies: schema.proximity_listing.available_for_emergencies,
        emergency_response_note: schema.proximity_listing.emergency_response_note,
      })
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.sector_id, sector_id))
      .orderBy(desc(schema.proximity_listing.weighted_trust_score))
      .limit(5);

    const supportGroups = await database
      .select({
        id: schema.support_group.id,
        name: schema.support_group.name,
        contact_phone: schema.support_group.contact_phone,
        meeting_point_address: schema.support_group.meeting_point_address,
      })
      .from(schema.support_group)
      .where(eq(schema.support_group.sector_id, sector_id))
      .limit(3);

    const specialistSummary = topSpecialists
      .map(
        (s: {
          title: string;
          contact_phone: string;
          weighted_trust_score: string;
        }) => `• ${s.title} (Puntaje Visto Bueno: ${s.weighted_trust_score}) — Tel: ${s.contact_phone}`
      )
      .join('\n');

    const groupSummary = supportGroups
      .map(
        (g: { name: string; meeting_point_address: string; contact_phone: string }) =>
          `• ${g.name} en ${g.meeting_point_address} — Tel: ${g.contact_phone}`
      )
      .join('\n');

    const reply =
      current_mode === 'EMERGENCIA'
        ? `🚨 [Modo Emergencia Activo — Sector ${sector_id}]\nPara tu consulta ("${prompt}"), estos son los recursos y especialistas de primera respuesta verificados en tu cuadra:\n${specialistSummary}\n\nBrigadas y Puntos de Encuentro:\n${groupSummary}`
        : `👋 ¡Hola vecino! Según el directorio verificado con Visto Bueno Vecinal en tu sector:\n${specialistSummary}\n\nSi necesitas apoyo comunitario adicional, cuentas con:\n${groupSummary}`;

    return jsonOk({
      reply,
      mode: current_mode,
      sector_id,
      recommended_specialists: topSpecialists,
      active_support_groups: supportGroups,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/ai/copilot-chat');
  }
}
