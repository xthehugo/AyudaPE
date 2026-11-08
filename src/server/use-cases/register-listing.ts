/**
 * @file src/server/use-cases/register-listing.ts
 * @description Capa 3 (MOD-06) — Caso de Uso Hexagonal: Registro de Oficios, Productos Locales y Soporte.
 */

import { eq } from 'drizzle-orm';
import { CreateListingSchema, type CreateListingDto } from '@shared/schemas';
import { db } from '@/server/db/client';
import * as schema from '@/server/db/schema';

export interface RegisterListingParams extends CreateListingDto {
  owner_user_id: number;
  sector_id?: number;
}

export class RegisterListingUseCase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly database: any = db) {}

  async execute(input: RegisterListingParams) {
    const validated = CreateListingSchema.parse(input);

    // 1. Verificar idempotencia por client_mutation_id (RN-07)
    const existing = await this.database
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.client_mutation_id, validated.client_mutation_id))
      .limit(1);

    if (existing.length > 0) {
      return {
        listing: existing[0]!,
        idempotent_replay: true,
      };
    }

    // 2. Resolver sector_id desde el perfil del propietario si no se envió explícitamente
    let resolvedSectorId = input.sector_id;
    if (!resolvedSectorId) {
      const ownerRows = await this.database
        .select({ sector_id: schema.user_profile.sector_id })
        .from(schema.user_profile)
        .where(eq(schema.user_profile.id, input.owner_user_id))
        .limit(1);

      if (ownerRows.length === 0) {
        throw new Error('ENTIDAD_NO_ENCONTRADA: El usuario propietario no existe.');
      }
      resolvedSectorId = ownerRows[0]!.sector_id;
    }

    // 3. Insertar registro en proximity_listing
    const [inserted] = await this.database
      .insert(schema.proximity_listing)
      .values({
        client_mutation_id: validated.client_mutation_id,
        owner_user_id: input.owner_user_id,
        support_group_id: validated.support_group_id ?? null,
        sector_id: resolvedSectorId!,
        category_id: validated.category_id,
        listing_type: validated.listing_type,
        title: validated.title,
        description: validated.description,
        contact_phone: validated.contact_phone,
        latitude: validated.latitude,
        longitude: validated.longitude,
        available_for_emergencies: validated.available_for_emergencies,
        emergency_response_note: validated.emergency_response_note ?? null,
      })
      .returning();

    return {
      listing: inserted!,
      idempotent_replay: false,
    };
  }
}
