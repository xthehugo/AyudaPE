/**
 * @file src/server/db/client.ts
 * @description Capa 1 (MOD-02) — Cliente Singleton Drizzle ORM con Connection Pooling (`postgres.js`).
 * Compatible con PostgreSQL 16/17 Local y Supabase Cloud (vía PgBouncer o conexión directa).
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/redvecina';

declare global {
  // Evita múltiples pools de conexiones durante Hot Module Replacement (HMR) en desarrollo
  // eslint-disable-next-line no-var
  var __redVecinaPgClient: Sql | undefined;
  // eslint-disable-next-line no-var
  var __redVecinaDrizzleDb: PostgresJsDatabase<typeof schema> | undefined;
}

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_LOCAL_DATABASE_URL;
}

export function createPostgresConnection(connectionString: string = getDatabaseUrl()): Sql {
  return postgres(connectionString, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Requerido para compatibilidad con PgBouncer en modo Transaction (Supabase/PlanetScale)
  });
}

const pgClient: Sql = globalThis.__redVecinaPgClient ?? createPostgresConnection();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redVecinaPgClient = pgClient;
}

export const db: PostgresJsDatabase<typeof schema> =
  globalThis.__redVecinaDrizzleDb ?? drizzle(pgClient, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redVecinaDrizzleDb = db;
}

export type RedVecinaDatabase = typeof db;
export { pgClient, schema };
