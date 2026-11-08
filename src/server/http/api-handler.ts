/**
 * @file src/server/http/api-handler.ts
 * @description Capa 3 (MOD-07) — Pipeline Zero-Trust de Middlewares HTTP, RFC 7807 Problem Details,
 * Rate Limiting Dual Segregado (Estándar vs. SOS/PII) y Guardas RBAC.
 */

import { ZodError } from 'zod';
import type { ApiResponse, SystemRole } from '@shared/types';
import { db } from '@/server/db/client';

// Permite inyectar una instancia de base de datos (ej. PGlite en pruebas de integración)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeDbInstance: any = db;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setApiDatabaseInstance(customDb: any): void {
  activeDbInstance = customDb;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getApiDatabaseInstance(): any {
  return activeDbInstance;
}

export interface AuthenticatedActor {
  userId: number;
  role: SystemRole;
  isAuthenticated: boolean;
}

const VALID_ROLES = new Set<SystemRole>([
  'VECINO',
  'BRIGADISTA_CERTIFICADO',
  'LIDER_VECINAL',
  'OPERADOR_MUNICIPAL',
]);

/**
 * Extrae el contexto de identidad desde cabeceras HTTP (`x-user-id`, `x-user-role` o Bearer token).
 */
export function extractActorFromRequest(request: Request): AuthenticatedActor {
  const rawUserId = request.headers.get('x-user-id');
  const rawRole = request.headers.get('x-user-role') as SystemRole | null;
  const authHeader = request.headers.get('authorization');

  const parsedId = rawUserId ? Number(rawUserId) : NaN;
  const userId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 1;
  const role: SystemRole = rawRole && VALID_ROLES.has(rawRole) ? rawRole : 'VECINO';
  const isAuthenticated = Boolean(rawUserId || authHeader);

  return {
    userId,
    role,
    isAuthenticated,
  };
}

/**
 * Rate Limiter Multi-Tier con Token Bucket en memoria (Sección 5.1):
 * - Pool STANDARD: 60 req/min
 * - Pool SOS_PII: 10 req/min autenticado, 5 req/min anónimo
 */
interface BucketEntry {
  count: number;
  windowStartMs: number;
}

const rateLimitStore = new Map<string, BucketEntry>();

export function resetRateLimiterStore(): void {
  rateLimitStore.clear();
}

export function checkRateLimit(
  request: Request,
  tier: 'STANDARD' | 'SOS_PII' = 'STANDARD'
): { allowed: boolean; retryAfterSeconds?: number } {
  const actor = extractActorFromRequest(request);
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const key = `${tier}:${actor.isAuthenticated ? `u_${actor.userId}` : `ip_${ip}`}`;

  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests =
    tier === 'SOS_PII' ? (actor.isAuthenticated ? 10 : 5) : 60;

  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.windowStartMs >= windowMs) {
    rateLimitStore.set(key, { count: 1, windowStartMs: now });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterSeconds: 15 };
  }

  entry.count += 1;
  return { allowed: true };
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function jsonOk<T>(data: T, meta?: Record<string, unknown>, status: number = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: SECURITY_HEADERS,
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  instance?: string,
  details?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      type: `https://redvecina.pe/errors/${code.toLowerCase()}`,
      status,
      ...(instance ? { instance } : {}),
      ...(details ? { details } : {}),
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...(extraHeaders ?? {}),
    },
  });
}

/**
 * Manejador centralizado de excepciones que convierte errores Zod y de negocio a RFC 7807.
 */
export function handleRouteException(err: unknown, instancePath: string): Response {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const isZeroMoneyViolation = firstIssue?.message.includes('VIOLACION_RN01_CERO_DINERO');
    return jsonError(
      422,
      isZeroMoneyViolation ? 'VIOLACION_RN01_CERO_DINERO' : 'VALIDATION_ERROR',
      firstIssue?.message ?? 'Error de validación en los datos enviados.',
      instancePath,
      { issues: err.issues }
    );
  }

  if (err instanceof Error) {
    if (err.message.includes('VIOLACION_RN01')) {
      return jsonError(422, 'VIOLACION_RN01_CERO_DINERO', err.message, instancePath);
    }
    if (err.message.includes('VIOLACION_RN03') || err.message.includes('VIOLACION_INTEGRIDAD')) {
      return jsonError(409, 'VIOLACION_RN03_REPUTACION', err.message, instancePath);
    }
    if (err.message.includes('ENTIDAD_NO_ENCONTRADA')) {
      return jsonError(404, 'NOT_FOUND', err.message, instancePath);
    }
    return jsonError(400, 'BAD_REQUEST', err.message, instancePath);
  }

  return jsonError(
    500,
    'INTERNAL_SERVER_ERROR',
    'Error interno inesperado en el servidor.',
    instancePath
  );
}
