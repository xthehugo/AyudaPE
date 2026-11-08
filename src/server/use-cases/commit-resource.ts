/**
 * @file src/server/use-cases/commit-resource.ts
 * @description Capa 3 (MOD-06) — Caso de Uso Hexagonal: Compromiso Transaccional de Recursos y Ayuda (RN-08).
 * Soporta resolución híbrida de claves primarias BIGINT y UUIDs creados en modo Offline (`client_mutation_id`).
 */

import { eq, sql } from 'drizzle-orm';
import { CommitResourceSchema, type CommitResourceDto } from '@shared/schemas';
import { db } from '@/server/db/client';
import * as schema from '@/server/db/schema';

export interface CommitResourceParams extends CommitResourceDto {
  helper_user_id: number;
}

export class CommitResourceUseCase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly database: any = db) {}

  async execute(input: CommitResourceParams) {
    const validated = CommitResourceSchema.parse(input);

    // 1. Verificar idempotencia por client_mutation_id (RN-07)
    const existingCommitment = await this.database
      .select()
      .from(schema.resource_commitment)
      .where(eq(schema.resource_commitment.client_mutation_id, validated.client_mutation_id))
      .limit(1);

    if (existingCommitment.length > 0) {
      return {
        commitment: existingCommitment[0]!,
        post_status: 'EN_COORDINACION' as const,
        idempotent_replay: true,
      };
    }

    // 2. Transacción ACID: resolver IDs (BIGINT o UUID offline), insertar compromiso y actualizar cantidades
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.database.transaction(async (tx: any) => {
      // 2.1 Resolver la publicación objetivo
      const [targetPost] = validated.post_id
        ? await tx
            .select()
            .from(schema.community_post)
            .where(eq(schema.community_post.id, validated.post_id))
            .limit(1)
        : await tx
            .select()
            .from(schema.community_post)
            .where(
              eq(schema.community_post.client_mutation_id, validated.post_client_mutation_id!)
            )
            .limit(1);

      if (!targetPost) {
        throw new Error('ENTIDAD_NO_ENCONTRADA: La publicación solidaria o SOS no existe.');
      }

      // 2.2 Resolver el ítem de recurso específico si fue provisto
      let resolvedResourceItemId: number | null = validated.resource_item_id ?? null;
      let resolvedResourceItemMutationId: string | null =
        validated.resource_item_client_mutation_id ?? null;

      if (!resolvedResourceItemId && resolvedResourceItemMutationId) {
        const [itemByUuid] = await tx
          .select()
          .from(schema.post_resource_item)
          .where(
            eq(schema.post_resource_item.client_mutation_id, resolvedResourceItemMutationId)
          )
          .limit(1);

        if (itemByUuid) {
          resolvedResourceItemId = itemByUuid.id;
        }
      } else if (resolvedResourceItemId && !resolvedResourceItemMutationId) {
        const [itemById] = await tx
          .select()
          .from(schema.post_resource_item)
          .where(eq(schema.post_resource_item.id, resolvedResourceItemId))
          .limit(1);

        if (itemById) {
          resolvedResourceItemMutationId = itemById.client_mutation_id;
        }
      }

      // 2.3 Insertar el compromiso en resource_commitment
      const [insertedCommitment] = await tx
        .insert(schema.resource_commitment)
        .values({
          client_mutation_id: validated.client_mutation_id,
          post_id: targetPost.id,
          resource_item_id: resolvedResourceItemId,
          post_client_mutation_id: targetPost.client_mutation_id,
          resource_item_client_mutation_id: resolvedResourceItemMutationId,
          helper_user_id: input.helper_user_id,
          support_group_id: validated.support_group_id ?? null,
          committed_quantity: String(validated.committed_quantity),
          commitment_note: validated.commitment_note,
          status: 'EN_CAMINO',
        })
        .returning();

      // 2.4 Incrementar atómicamente quantity_committed si se asoció un ítem cuantificable
      let updatedItem = null;
      if (resolvedResourceItemId !== null) {
        const [updated] = await tx
          .update(schema.post_resource_item)
          .set({
            quantity_committed: sql`${schema.post_resource_item.quantity_committed} + ${validated.committed_quantity}`,
          })
          .where(eq(schema.post_resource_item.id, resolvedResourceItemId))
          .returning();
        updatedItem = updated ?? null;
      }

      // 2.5 Actualizar el estado de la publicación a EN_COORDINACION
      const [updatedPost] = await tx
        .update(schema.community_post)
        .set({
          status: 'EN_COORDINACION',
          updated_at: new Date(),
        })
        .where(eq(schema.community_post.id, targetPost.id))
        .returning();

      return {
        commitment: insertedCommitment!,
        updated_resource_item: updatedItem,
        post_status: updatedPost!.status,
        idempotent_replay: false,
      };
    });
  }
}
