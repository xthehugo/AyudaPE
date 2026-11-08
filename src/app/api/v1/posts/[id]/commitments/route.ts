import {
  checkRateLimit,
  extractActorFromRequest,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';
import { CommitResourceUseCase } from '@/server/use-cases/commit-resource';

export interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

/**
 * 12. POST /api/v1/posts/[id]/commitments
 * Registra un compromiso vecinal de ayuda o recurso cuantificable (RN-08).
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/posts/[id]/commitments',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const postId = Number(resolvedParams.id);
    const actor = extractActorFromRequest(request);
    const body = (await request.json()) as Record<string, unknown>;

    const database = getApiDatabaseInstance();
    const useCase = new CommitResourceUseCase(database);

    const result = await useCase.execute({
      client_mutation_id: String(body.client_mutation_id ?? ''),
      post_id: Number.isInteger(postId) && postId > 0 ? postId : undefined,
      post_client_mutation_id: body.post_client_mutation_id
        ? String(body.post_client_mutation_id)
        : undefined,
      resource_item_id: body.resource_item_id ? Number(body.resource_item_id) : undefined,
      resource_item_client_mutation_id: body.resource_item_client_mutation_id
        ? String(body.resource_item_client_mutation_id)
        : undefined,
      support_group_id: body.support_group_id ? Number(body.support_group_id) : undefined,
      helper_user_id: Number(body.helper_user_id ?? actor.userId),
      committed_quantity: Number(body.committed_quantity ?? 1),
      commitment_note: String(body.commitment_note ?? ''),
    });

    return jsonOk(
      result,
      { idempotent_replay: result.idempotent_replay },
      result.idempotent_replay ? 200 : 201
    );
  } catch (err) {
    return handleRouteException(err, '/api/v1/posts/[id]/commitments');
  }
}
