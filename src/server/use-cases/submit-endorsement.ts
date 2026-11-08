/**
 * @file src/server/use-cases/submit-endorsement.ts
 * @description Capa 3 (MOD-06) — Caso de Uso Hexagonal: Emisión de "Visto Bueno Vecinal" (RN-02 / RN-03).
 */

import { and, eq } from 'drizzle-orm';
import { CreateEndorsementSchema, type CreateEndorsementDto } from '@shared/schemas';
import { db } from '@/server/db/client';
import * as schema from '@/server/db/schema';

export interface SubmitEndorsementParams extends CreateEndorsementDto {
  endorser_user_id: number;
}

export class SubmitEndorsementUseCase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly database: any = db) {}

  async execute(input: SubmitEndorsementParams) {
    const validated = CreateEndorsementSchema.parse(input);

    // 1. Verificar idempotencia por client_mutation_id (RN-07)
    const existingByMutation = await this.database
      .select()
      .from(schema.neighbor_endorsement)
      .where(eq(schema.neighbor_endorsement.client_mutation_id, validated.client_mutation_id))
      .limit(1);

    if (existingByMutation.length > 0) {
      const [listingSnapshot] = await this.database
        .select()
        .from(schema.proximity_listing)
        .where(eq(schema.proximity_listing.id, validated.listing_id))
        .limit(1);

      return {
        endorsement: existingByMutation[0]!,
        updated_listing: listingSnapshot!,
        idempotent_replay: true,
      };
    }

    // 2. Obtener el oficio/producto y validar regla anti-fraude RN-03 en capa de dominio
    const [listing] = await this.database
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.id, validated.listing_id))
      .limit(1);

    if (!listing) {
      throw new Error('ENTIDAD_NO_ENCONTRADA: El servicio o producto indicado no existe.');
    }

    if (listing.owner_user_id === input.endorser_user_id) {
      throw new Error(
        'VIOLACION_RN03_AUTOVOTO: Un usuario no puede emitir Visto Bueno a su propia publicación.'
      );
    }

    // 3. Verificar que el vecino no haya votado previamente por el mismo listing
    const duplicateVote = await this.database
      .select()
      .from(schema.neighbor_endorsement)
      .where(
        and(
          eq(schema.neighbor_endorsement.listing_id, validated.listing_id),
          eq(schema.neighbor_endorsement.endorser_user_id, input.endorser_user_id)
        )
      )
      .limit(1);

    if (duplicateVote.length > 0) {
      throw new Error(
        'VIOLACION_RN03_VOTO_DUPLICADO: Ya emitiste un Visto Bueno Vecinal para este servicio o producto.'
      );
    }

    // 4. Insertar en neighbor_endorsement (el trigger PL/pgSQL calcula distance_meters y proximity_weight
    //    y acumula atómicamente endorsement_count y weighted_trust_score en proximity_listing)
    const [insertedEndorsement] = await this.database
      .insert(schema.neighbor_endorsement)
      .values({
        client_mutation_id: validated.client_mutation_id,
        listing_id: validated.listing_id,
        endorser_user_id: input.endorser_user_id,
        comment: validated.comment,
      })
      .returning();

    const [updatedListing] = await this.database
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.id, validated.listing_id))
      .limit(1);

    return {
      endorsement: insertedEndorsement!,
      updated_listing: updatedListing!,
      idempotent_replay: false,
    };
  }
}
