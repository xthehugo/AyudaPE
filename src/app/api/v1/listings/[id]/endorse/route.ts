import {
  checkRateLimit,
  extractActorFromRequest,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { SubmitEndorsementUseCase } from '@/server/use-cases/submit-endorsement';

export interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * 7. POST /api/v1/listings/[id]/endorse
 * Emite un Visto Bueno Vecinal validando anti-autovoto (RN-03) y recalculando el score por distancia.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/listings/[id]/endorse',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const listingId = Number(resolvedParams.id);
    const actor = extractActorFromRequest(request);
    const body = (await request.json()) as Record<string, unknown>;

    const database = getApiDatabaseInstance();
    const useCase = new SubmitEndorsementUseCase(database);

    const result = await useCase.execute({
      client_mutation_id: String(body.client_mutation_id ?? ''),
      listing_id: listingId,
      endorser_user_id: Number(body.endorser_user_id ?? actor.userId),
      comment: String(body.comment ?? ''),
    });

    return jsonOk(
      {
        endorsement: result.endorsement,
        updated_listing: {
          id: result.updated_listing.id,
          endorsement_count: result.updated_listing.endorsement_count,
          weighted_trust_score: result.updated_listing.weighted_trust_score,
        },
      },
      { idempotent_replay: result.idempotent_replay },
      result.idempotent_replay ? 200 : 201
    );
  } catch (err) {
    return handleRouteException(err, '/api/v1/listings/[id]/endorse');
  }
}
