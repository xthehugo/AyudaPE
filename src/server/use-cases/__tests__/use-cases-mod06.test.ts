import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  CommitResourceUseCase,
  CreateCommunityPostUseCase,
  RegisterListingUseCase,
  SubmitEndorsementUseCase,
} from '../index';

describe('[MOD-06] Capa 3 — Repositorios Drizzle y Casos de Uso del Dominio Hexagonal', () => {
  let pg: PGlite;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    pg = new PGlite();
    testDb = drizzle(pg, { schema });

    const ddl001 = readFileSync(
      join(process.cwd(), 'src/database/migrations/001_initial_enterprise_schema.sql'),
      'utf-8'
    );
    const ddl002 = readFileSync(
      join(process.cwd(), 'src/database/migrations/002_functions_and_triggers.sql'),
      'utf-8'
    );
    const seed003 = readFileSync(
      join(process.cwd(), 'src/database/seeds/003_seed_lima_sector4.sql'),
      'utf-8'
    );

    await pg.exec(ddl001);
    await pg.exec(ddl002);
    await pg.exec(seed003);
  });

  afterAll(async () => {
    await pg.close();
  });

  it('1. RegisterListingUseCase debe registrar un oficio o producto de forma idempotente', async () => {
    const useCase = new RegisterListingUseCase(testDb);
    const mutationId = '88888888-8888-4888-8888-888888888801';

    const firstCall = await useCase.execute({
      client_mutation_id: mutationId,
      owner_user_id: 1,
      listing_type: 'PRODUCTO_LOCAL',
      category_id: 4,
      title: 'Dispensario de Suero Oral y Gasas',
      description: 'Atención a vecinos de Residencial San Felipe en horario extendido.',
      contact_phone: '+51991234501',
      latitude: -12.0842,
      longitude: -77.0512,
      available_for_emergencies: true,
      emergency_response_note: 'Reserva de emergencia disponible las 24h',
    });

    expect(firstCall.idempotent_replay).toBe(false);
    expect(firstCall.listing.id).toBeGreaterThan(0);

    // Reintento idempotente con el mismo client_mutation_id
    const secondCall = await useCase.execute({
      client_mutation_id: mutationId,
      owner_user_id: 1,
      listing_type: 'PRODUCTO_LOCAL',
      category_id: 4,
      title: 'Dispensario de Suero Oral y Gasas',
      description: 'Atención a vecinos de Residencial San Felipe en horario extendido.',
      contact_phone: '+51991234501',
      latitude: -12.0842,
      longitude: -77.0512,
      available_for_emergencies: true,
    });

    expect(secondCall.idempotent_replay).toBe(true);
    expect(secondCall.listing.id).toBe(firstCall.listing.id);
  });

  it('2. SubmitEndorsementUseCase debe bloquear autovotos (RN-03) y actualizar el score ponderado', async () => {
    const useCase = new SubmitEndorsementUseCase(testDb);

    // Intento de autovoto del propietario (owner_user_id = 1 sobre el listing creado arriba)
    const [listing] = await testDb
      .select()
      .from(schema.proximity_listing)
      .where(
        eq(
          schema.proximity_listing.client_mutation_id,
          '88888888-8888-4888-8888-888888888801'
        )
      );

    await expect(
      useCase.execute({
        client_mutation_id: '88888888-8888-4888-8888-888888888802',
        listing_id: listing!.id,
        endorser_user_id: 1,
        comment: 'Intento de autovoto no permitido por RN-03',
      })
    ).rejects.toThrow(/VIOLACION_RN03_AUTOVOTO/);

    // Voto legítimo de un vecino verificado cercano (user_id = 2)
    const endorsementResult = await useCase.execute({
      client_mutation_id: '88888888-8888-4888-8888-888888888803',
      listing_id: listing!.id,
      endorser_user_id: 2,
      comment: 'Excelente iniciativa barrial, cuentan con insumos bien conservados.',
    });

    expect(endorsementResult.endorsement.proximity_weight).toBe('1.50');
    expect(endorsementResult.updated_listing.endorsement_count).toBe(1);
    expect(endorsementResult.updated_listing.weighted_trust_score).toBe('1.50');
  });

  it('3. CreateCommunityPostUseCase debe sanitizar PII, aplicar Spatial Blurring (50m) y aislar datos en post_sensitive_pii', async () => {
    const useCase = new CreateCommunityPostUseCase(testDb);
    const sosMutationId = '88888888-8888-4888-8888-888888888804';
    const resourceMutationId = '88888888-8888-4888-8888-888888888805';

    const exactLat = -12.085;
    const exactLng = -77.0515;

    const result = await useCase.execute({
      client_mutation_id: sosMutationId,
      author_user_id: 1,
      operational_mode: 'EMERGENCIA',
      post_type: 'SOS_VULNERABLE',
      category_id: 4,
      title: 'Auxilio urgente en Jr. Huiracocha 1550 Dpto 301',
      description:
        'Mi abuelo en Jr. Huiracocha 1550 Dpto 301 sufre de insuficiencia cardíaca severa y necesita oxígeno.',
      urgency_level: 'CRITICA',
      public_lat: exactLat,
      public_lng: exactLng,
      exact_lat: exactLat,
      exact_lng: exactLng,
      resources: [
        {
          client_mutation_id: resourceMutationId,
          item_name: 'Oxígeno medicinal portátil',
          quantity_needed: 1,
          unit: 'UNIDAD',
        },
      ],
    });

    expect(result.pii_isolated).toBe(true);
    // La descripción pública NO debe exponer "Jr. Huiracocha 1550 Dpto 301" ni "insuficiencia cardíaca severa"
    expect(result.post.description).toContain('[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]');
    expect(result.post.description).toContain('[CONDICIÓN DE SALUD PROTEGIDA]');
    expect(result.post.description).not.toContain('1550');
    expect(result.post.privacy_radius_meters).toBe(50);

    // Las coordenadas públicas deben estar perturbadas respecto a las exactas (Spatial Blurring)
    expect(result.post.public_lat).not.toBe(exactLat);
    expect(result.post.public_lng).not.toBe(exactLng);

    // La bóveda post_sensitive_pii debe resguardar las coordenadas exactas y dirección real
    const [vaultRecord] = await testDb
      .select()
      .from(schema.post_sensitive_pii)
      .where(eq(schema.post_sensitive_pii.post_id, result.post.id));

    expect(vaultRecord).toBeDefined();
    expect(vaultRecord!.exact_lat).toBe(exactLat);
    expect(vaultRecord!.exact_lng).toBe(exactLng);
    expect(vaultRecord!.exact_address_reference).toContain('Jr. Huiracocha 1550 Dpto 301');
    expect(vaultRecord!.medical_or_mobility_notes).toContain('insuficiencia cardíaca severa');
  });

  it('4. CommitResourceUseCase debe resolver UUIDs offline, incrementar quantity_committed y pasar el post a EN_COORDINACION', async () => {
    const commitUseCase = new CommitResourceUseCase(testDb);
    const sosMutationId = '88888888-8888-4888-8888-888888888804';
    const resourceMutationId = '88888888-8888-4888-8888-888888888805';

    const commitResult = await commitUseCase.execute({
      client_mutation_id: '88888888-8888-4888-8888-888888888806',
      post_client_mutation_id: sosMutationId,
      resource_item_client_mutation_id: resourceMutationId,
      helper_user_id: 2,
      committed_quantity: 1,
      commitment_note: 'En camino con balón de oxígeno de la brigada.',
    });

    expect(commitResult.post_status).toBe('EN_COORDINACION');
    expect(commitResult.updated_resource_item?.quantity_committed).toBe('1.00');
  });
});
