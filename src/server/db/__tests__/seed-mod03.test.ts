import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../schema';

describe('[MOD-03] Capa 1 — Dataset Semilla Hiperrealista (Jesús María - Sector 4)', () => {
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

  it('1. debe insertar las cantidades exactas de registros semilla sin violaciones de clave foránea', async () => {
    const districts = await testDb.select().from(schema.district);
    const sectors = await testDb.select().from(schema.neighborhood_sector);
    const categories = await testDb.select().from(schema.category_catalog);
    const profiles = await testDb.select().from(schema.user_profile);
    const groups = await testDb.select().from(schema.support_group);
    const listings = await testDb.select().from(schema.proximity_listing);
    const endorsements = await testDb.select().from(schema.neighbor_endorsement);
    const posts = await testDb.select().from(schema.community_post);
    const sensitivePii = await testDb.select().from(schema.post_sensitive_pii);
    const auditLogs = await testDb.select().from(schema.pii_access_audit_log);
    const resources = await testDb.select().from(schema.post_resource_item);
    const commitments = await testDb.select().from(schema.resource_commitment);

    expect(districts).toHaveLength(1);
    expect(districts[0]?.ubigeo_code).toBe('150113');
    expect(sectors).toHaveLength(1);
    expect(sectors[0]?.sector_code).toBe('JM-SEC-04');
    expect(categories).toHaveLength(10);
    expect(profiles).toHaveLength(8);
    expect(groups).toHaveLength(2);
    expect(listings).toHaveLength(12);
    expect(endorsements).toHaveLength(15);
    expect(posts).toHaveLength(10);
    expect(sensitivePii).toHaveLength(2);
    expect(auditLogs).toHaveLength(1);
    expect(resources).toHaveLength(5);
    expect(commitments).toHaveLength(5);
  });

  it('2. debe haber calculado automáticamente los puntajes ponderados del Visto Bueno Vecinal mediante los triggers PL/pgSQL', async () => {
    const topListings = await testDb
      .select()
      .from(schema.proximity_listing)
      .orderBy(desc(schema.proximity_listing.weighted_trust_score));

    // El Maestro Gasfitero y la Botica San Felipe tienen 3 endosos cada uno
    expect(topListings[0]?.endorsement_count).toBe(3);
    expect(Number(topListings[0]?.weighted_trust_score)).toBeGreaterThanOrEqual(3.5);
  });

  it('3. debe reflejar listas de recursos críticos cubiertas entre el 40% y el 60% y ser idempotente al re-ejecutar', async () => {
    const resources = await testDb.select().from(schema.post_resource_item);

    for (const item of resources) {
      const ratio = Number(item.quantity_committed) / Number(item.quantity_needed);
      expect(ratio).toBeGreaterThanOrEqual(0.4);
      expect(ratio).toBeLessThanOrEqual(0.6);
    }

    // Re-ejecutar el script semilla debe ser idempotente (ON CONFLICT DO NOTHING)
    const seed003 = readFileSync(
      join(process.cwd(), 'src/database/seeds/003_seed_lima_sector4.sql'),
      'utf-8'
    );
    await expect(pg.exec(seed003)).resolves.not.toThrow();
  });
});
