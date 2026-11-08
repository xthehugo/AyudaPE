import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema';

describe('[MOD-02] Capa 1 — DDL 3FN/BCNF, Triggers Geodésicos PL/pgSQL, RLS y Esquema Drizzle ORM', () => {
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

    await pg.exec(ddl001);
    await pg.exec(ddl002);
  });

  afterAll(async () => {
    await pg.close();
  });

  it('1. debe crear las 13 tablas normalizadas con RLS habilitado', async () => {
    const res = await pg.query<{ tablename: string; rowsecurity: boolean }>(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);

    const expectedTables = [
      'category_catalog',
      'community_post',
      'district',
      'neighbor_endorsement',
      'neighborhood_sector',
      'pii_access_audit_log',
      'post_resource_item',
      'post_sensitive_pii',
      'proximity_listing',
      'resource_commitment',
      'support_group',
      'support_group_member',
      'user_profile',
    ];

    expect(res.rows.map((r) => r.tablename)).toEqual(expectedTables);
    for (const row of res.rows) {
      expect(row.rowsecurity).toBe(true);
    }
  });

  it('2. debe ejecutar la función geodésica Haversine (fn_calculate_distance_meters) con precisión en metros', async () => {
    // Distancia aproximada dentro de Residencial San Felipe (Jesús María) ~250 metros
    const res = await pg.query<{ dist: number }>(`
      SELECT fn_calculate_distance_meters(-12.0850, -77.0515, -12.0830, -77.0515) AS dist;
    `);
    const dist = res.rows[0]?.dist ?? 0;
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(250);
  });

  it('3. debe calcular automáticamente el Visto Bueno Vecinal (w=1.50, 1.00, 0.30), bloquear auto-recomendación y revertir al eliminar', async () => {
    // Insertar Distrito y Sector con Drizzle ORM
    const [jmDistrict] = await testDb
      .insert(schema.district)
      .values({
        ubigeo_code: '150113',
        name: 'Jesús María',
      })
      .returning();

    const [sec4] = await testDb
      .insert(schema.neighborhood_sector)
      .values({
        district_id: jmDistrict!.id,
        sector_code: 'JM-SEC-04',
        name: 'Sector 4 - Residencial San Felipe / Huiracocha',
        center_lat: -12.085,
        center_lng: -77.0515,
        radius_meters: 1200,
      })
      .returning();

    const [catGasfiteria] = await testDb
      .insert(schema.category_catalog)
      .values({
        code: 'GASFITERIA',
        name: 'Gasfitería',
        module_scope: 'ECONOMIA_LOCAL',
        is_emergency_critical: true,
        priority_weight: 9,
      })
      .returning();

    // Propietario del oficio
    const [owner] = await testDb
      .insert(schema.user_profile)
      .values({
        sector_id: sec4!.id,
        full_name: 'Maestro Jorge Quispe',
        phone_number: '+51999111222',
        home_lat: -12.085,
        home_lng: -77.0515,
        is_verified_neighbor: true,
      })
      .returning();

    // Vecino verificado a ~220m (peso esperado: 1.50)
    const [closeVerifiedNeighbor] = await testDb
      .insert(schema.user_profile)
      .values({
        sector_id: sec4!.id,
        full_name: 'Sra. Carmen Rosa',
        phone_number: '+51999333444',
        home_lat: -12.083,
        home_lng: -77.0515,
        is_verified_neighbor: true,
      })
      .returning();

    // Vecino a ~900m (peso esperado: 1.00)
    const [midNeighbor] = await testDb
      .insert(schema.user_profile)
      .values({
        sector_id: sec4!.id,
        full_name: 'Carlos Mendoza',
        phone_number: '+51999555666',
        home_lat: -12.077,
        home_lng: -77.0515,
        is_verified_neighbor: false,
      })
      .returning();

    // Crear servicio en proximity_listing
    const [listing] = await testDb
      .insert(schema.proximity_listing)
      .values({
        owner_user_id: owner!.id,
        sector_id: sec4!.id,
        category_id: catGasfiteria!.id,
        listing_type: 'SERVICIO_OFICIO',
        title: 'Gasfitería de Emergencia 24h',
        description: 'Reparación de tuberías matrices y llaves de paso.',
        contact_phone: '+51999111222',
        latitude: -12.085,
        longitude: -77.0515,
        available_for_emergencies: true,
      })
      .returning();

    // 3.1 RN-03: Bloquear auto-voto del propietario
    await expect(
      testDb.insert(schema.neighbor_endorsement).values({
        listing_id: listing!.id,
        endorser_user_id: owner!.id,
        comment: 'Me recomiendo a mí mismo',
      })
    ).rejects.toThrow(/VIOLACION_INTEGRIDAD/);

    // 3.2 Visto Bueno de vecino verificado a <= 500m (peso 1.50)
    const [endorsement1] = await testDb
      .insert(schema.neighbor_endorsement)
      .values({
        listing_id: listing!.id,
        endorser_user_id: closeVerifiedNeighbor!.id,
        comment: 'Atendió una fuga en mi departamento en 15 minutos.',
      })
      .returning();

    expect(endorsement1!.proximity_weight).toBe('1.50');
    expect(endorsement1!.distance_meters).toBeLessThanOrEqual(500);

    // 3.3 Visto Bueno de vecino a ~900m (peso 1.00)
    const [endorsement2] = await testDb
      .insert(schema.neighbor_endorsement)
      .values({
        listing_id: listing!.id,
        endorser_user_id: midNeighbor!.id,
        comment: 'Muy puntual y limpio en su trabajo.',
      })
      .returning();

    expect(endorsement2!.proximity_weight).toBe('1.00');

    // Verificar proyección acumulada en proximity_listing (1.50 + 1.00 = 2.50, count = 2)
    const [updatedListing] = await testDb
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.id, listing!.id));

    expect(updatedListing!.endorsement_count).toBe(2);
    expect(updatedListing!.weighted_trust_score).toBe('2.50');

    // 3.4 Idempotencia ante ON CONFLICT DO NOTHING (No debe duplicar el score)
    await pg.query(
      `
      INSERT INTO neighbor_endorsement (client_mutation_id, listing_id, endorser_user_id, comment)
      VALUES ($1, $2, $3, 'Reintento offline duplicado')
      ON CONFLICT (client_mutation_id) DO NOTHING;
    `,
      [endorsement1!.client_mutation_id, listing!.id, closeVerifiedNeighbor!.id]
    );

    const [afterConflictListing] = await testDb
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.id, listing!.id));

    expect(afterConflictListing!.endorsement_count).toBe(2);
    expect(afterConflictListing!.weighted_trust_score).toBe('2.50');

    // 3.5 Reversión atómica AFTER DELETE (2.50 - 1.00 = 1.50, count = 1)
    await testDb
      .delete(schema.neighbor_endorsement)
      .where(eq(schema.neighbor_endorsement.id, endorsement2!.id));

    const [revertedListing] = await testDb
      .select()
      .from(schema.proximity_listing)
      .where(eq(schema.proximity_listing.id, listing!.id));

    expect(revertedListing!.endorsement_count).toBe(1);
    expect(revertedListing!.weighted_trust_score).toBe('1.50');
  });

  it('4. debe hacer cumplir el invariante SQL Cero Dinero (chk_cero_dinero_favores y chk_no_monetary_terms_in_favors)', async () => {
    const [author] = await testDb.select().from(schema.user_profile).limit(1);
    const [sector] = await testDb.select().from(schema.neighborhood_sector).limit(1);
    const [category] = await testDb.select().from(schema.category_catalog).limit(1);

    // Intento de insertar un favor mencionando "yape" o "lucas" directamente en SQL
    await expect(
      testDb.insert(schema.community_post).values({
        author_user_id: author!.id,
        sector_id: sector!.id,
        category_id: category!.id,
        operational_mode: 'HABITUAL',
        post_type: 'OFERTA_FAVOR',
        title: 'Presto taladro',
        description: 'Lo presto pero me dejan 20 lucas por yape',
        public_lat: -12.085,
        public_lng: -77.0515,
      })
    ).rejects.toThrow();

    // Favor legítimo sin dinero se inserta correctamente
    const [validFavor] = await testDb
      .insert(schema.community_post)
      .values({
        author_user_id: author!.id,
        sector_id: sector!.id,
        category_id: category!.id,
        operational_mode: 'HABITUAL',
        post_type: 'OFERTA_FAVOR',
        title: 'Presto escalera de aluminio',
        description: 'Vecinos, presto mi escalera sin costo para arreglos en casa.',
        public_lat: -12.085,
        public_lng: -77.0515,
      })
      .returning();

    expect(validFavor!.id).toBeGreaterThan(0);
  });
});
