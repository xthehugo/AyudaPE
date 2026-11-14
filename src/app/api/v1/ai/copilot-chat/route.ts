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
import {
  findEmergencyTriageScenario,
  formatEmergencyTriageText,
  getGeminiSystemInstructionWithKnowledge,
} from '@/lib/ai/emergency-knowledge-base';

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
 * con mayor puntaje de Visto Bueno Vecinal, grupos de apoyo activos del sector y doctrina
 * de triaje y primeros auxilios de emergencia (USAR / INDECI / Bomberos CGBVP).
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

    const emergencyScenario = findEmergencyTriageScenario(prompt);
    let topSpecialists: Array<{
      id?: number;
      title: string;
      listing_type?: string;
      contact_phone: string;
      weighted_trust_score: string | number;
      available_for_emergencies?: boolean;
      emergency_response_note?: string;
    }> = [];
    let supportGroups: Array<{
      id?: number;
      name: string;
      contact_phone: string;
      meeting_point_address: string;
    }> = [];

    try {
      const database = getApiDatabaseInstance();
      if (database) {
        topSpecialists = await database
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

        supportGroups = await database
          .select({
            id: schema.support_group.id,
            name: schema.support_group.name,
            contact_phone: schema.support_group.contact_phone,
            meeting_point_address: schema.support_group.meeting_point_address,
          })
          .from(schema.support_group)
          .where(eq(schema.support_group.sector_id, sector_id))
          .limit(3);
      }
    } catch (dbErr) {
      console.warn('[Copilot Server DB Fallback Warning]', dbErr);
    }

    const specialistSummary = topSpecialists
      .map(
        (s: {
          title: string;
          contact_phone: string;
          weighted_trust_score: string | number;
        }) => `• ${s.title} (Visto Bueno: ${s.weighted_trust_score}) — Tel: ${s.contact_phone}`
      )
      .join('\n');

    const groupSummary = supportGroups
      .map(
        (g: { name: string; meeting_point_address: string; contact_phone: string }) =>
          `• ${g.name} en ${g.meeting_point_address} — Tel: ${g.contact_phone}`
      )
      .join('\n');

    let reply = '';
    let usedCloudLlm = false;
    let debugInfo = 'NO_KEY';

    const candidates = [
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    ]
      .map((k) => k?.trim().replace(/^["']|["']$/g, ''))
      .filter((k): k is string => Boolean(k && k.length > 5));

    // Desduplicar claves candidatas (vacio si Cloud AI esta pausada para consumo cero)
    const uniqueKeys =
      process.env.NEXT_PUBLIC_PAUSE_CLOUD_AI === 'true' ? [] : Array.from(new Set(candidates));

    if (uniqueKeys.length > 0) {
      const MODELS = [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      const ragContext = JSON.stringify({
        sector_id,
        mode: current_mode,
        emergency_scenario: emergencyScenario ?? null,
        top_specialists: topSpecialists,
        support_groups: supportGroups,
      });

      keyLoop: for (const serverApiKey of uniqueKeys) {
        debugInfo = `KEY_LEN_${serverApiKey.length}_PRE_${serverApiKey.substring(0, 4)}`;

        for (const model of MODELS) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
              serverApiKey
            )}`;

            const geminiRes = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': serverApiKey,
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: getGeminiSystemInstructionWithKnowledge() }],
                },
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `Contexto Territorial y Recursos del Barrio:\n${ragContext}\n\nConsulta del Vecino: "${prompt}"`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.2,
                },
              }),
            });

            if (geminiRes.ok) {
              const geminiData = (await geminiRes.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              };
              const cloudText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (cloudText) {
                reply = cloudText;
                usedCloudLlm = true;
                debugInfo += `_SUCCESS_${model}`;
                break keyLoop;
              }
            } else {
              const errText = await geminiRes.text();
              debugInfo += `_${model}_${geminiRes.status}`;
              console.warn(`[Gemini API ${model} Error]`, geminiRes.status, errText);
              // Si la clave no es válida (401 o 403), probar siguiente clave inmediatamente
              if (geminiRes.status === 401 || geminiRes.status === 403) {
                break;
              }
            }
          } catch (cloudErr) {
            debugInfo += `_${model}_ERR_${String(cloudErr)}`;
            console.warn(`[Gemini API ${model} Exception]`, cloudErr);
          }
        }
      }
    }

    if (!reply) {
      if (emergencyScenario) {
        reply = `${formatEmergencyTriageText(emergencyScenario)}\n\n[RECURSOS Y ESPECIALISTAS VERIFICADOS EN TU CUADRA]\n${specialistSummary}\n\n[PUNTOS DE ENCUENTRO Y BRIGADAS]\n${groupSummary}`;
      } else if (current_mode === 'EMERGENCIA') {
        reply = `[Modo Emergencia Activo — Sector ${sector_id}]\nPara tu consulta ("${prompt}"), estos son los recursos y especialistas de primera respuesta verificados en tu cuadra:\n${specialistSummary}\n\nBrigadas y Puntos de Encuentro:\n${groupSummary}`;
      } else {
        reply = `Hola vecino. Según el directorio verificado con Visto Bueno Vecinal en tu sector:\n${specialistSummary}\n\nSi necesitas apoyo comunitario adicional, cuentas con:\n${groupSummary}`;
      }
    }

    return jsonOk({
      reply,
      mode: current_mode,
      sector_id,
      emergency_scenario: emergencyScenario ?? null,
      recommended_specialists: topSpecialists,
      active_support_groups: supportGroups,
      used_cloud_llm: usedCloudLlm,
      debug_info: debugInfo,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/ai/copilot-chat');
  }
}
