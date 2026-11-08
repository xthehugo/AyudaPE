import { eq } from 'drizzle-orm';
import { UnlockSensitivePiiSchema } from '@shared/schemas';
import type { SystemRole } from '@shared/types';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  extractActorFromRequest,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

export interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

const AUTHORIZED_PII_ROLES = new Set<SystemRole>([
  'BRIGADISTA_CERTIFICADO',
  'LIDER_VECINAL',
  'OPERADOR_MUNICIPAL',
]);

/**
 * 10. POST /api/v1/posts/[id]/sensitive-pii
 * Desbloqueo auditado de Bóveda PII (Ley N° 29733 - RN-05).
 * Requiere RBAC estricto y registra acceso inmutable en `pii_access_audit_log`.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'SOS_PII');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes sobre Bóveda PII excedido.',
      '/api/v1/posts/[id]/sensitive-pii',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const postId = Number(resolvedParams.id);
    const actor = extractActorFromRequest(request);

    // 1. Verificación RBAC estricta (HTTP 403 Forbidden si es VECINO estándar o visitante)
    if (!AUTHORIZED_PII_ROLES.has(actor.role)) {
      return jsonError(
        403,
        'FORBIDDEN_PII_ACCESS',
        'Acceso denegado (Ley N° 29733): Solo Brigadistas Certificados, Líderes Vecinales u Operadores Municipales pueden desbloquear coordenadas exactas y datos médicos vulnerables.',
        `/api/v1/posts/${postId}/sensitive-pii`
      );
    }

    // 2. Validar justificación operativa obligatoria (>= 10 caracteres)
    const rawBody = await request.json();
    const validatedBody = UnlockSensitivePiiSchema.parse(rawBody);

    const database = getApiDatabaseInstance();

    // 3. Ejecutar transacción ACID: verificar existencia de PII, insertar auditoría inmutable y retornar datos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await database.transaction(async (tx: any) => {
      const [piiRow] = await tx
        .select()
        .from(schema.post_sensitive_pii)
        .where(eq(schema.post_sensitive_pii.post_id, postId))
        .limit(1);

      if (!piiRow) {
        return null;
      }

      const [auditEntry] = await tx
        .insert(schema.pii_access_audit_log)
        .values({
          post_id: postId,
          accessed_by_user_id: actor.userId,
          access_reason: validatedBody.access_reason,
        })
        .returning();

      return {
        exact_lat: piiRow.exact_lat,
        exact_lng: piiRow.exact_lng,
        exact_address: piiRow.exact_address_reference,
        vulnerable_person_name: piiRow.vulnerable_person_name,
        contact_phone: piiRow.emergency_contact_phone,
        medical_notes: piiRow.medical_or_mobility_notes,
        access_audit_id: String(auditEntry.id),
        accessed_at: auditEntry.accessed_at,
      };
    });

    if (!result) {
      return jsonError(
        404,
        'NOT_FOUND',
        'No existen datos sensibles registrados para esta publicación.',
        `/api/v1/posts/${postId}/sensitive-pii`
      );
    }

    return jsonOk(result);
  } catch (err) {
    return handleRouteException(err, '/api/v1/posts/[id]/sensitive-pii');
  }
}
