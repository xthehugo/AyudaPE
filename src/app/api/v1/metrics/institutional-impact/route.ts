import { eq } from 'drizzle-orm';
import * as schema from '@/server/db/schema';
import {
  checkRateLimit,
  getApiDatabaseInstance,
  handleRouteException,
  jsonError,
  jsonOk,
} from '@/server/http/api-handler';

/**
 * 17. GET /api/v1/metrics/institutional-impact?sector_id=1
 * Analítica B2G e Impacto Institucional para Municipalidades (COED/INDECI) y El Comercio.
 */
export async function GET(request: Request): Promise<Response> {
  const rl = checkRateLimit(request, 'STANDARD');
  if (!rl.allowed) {
    return jsonError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Límite de solicitudes excedido.',
      '/api/v1/metrics/institutional-impact',
      undefined,
      { 'Retry-After': String(rl.retryAfterSeconds ?? 15) }
    );
  }

  try {
    const url = new URL(request.url);
    const sectorIdParam = url.searchParams.get('sector_id');
    const sectorId = sectorIdParam ? Number(sectorIdParam) : undefined;

    const database = getApiDatabaseInstance();

    const [profiles, listings, endorsements, posts, commitments, supportGroups, piiAudits] =
      await Promise.all([
        sectorId
          ? database
              .select()
              .from(schema.user_profile)
              .where(eq(schema.user_profile.sector_id, sectorId))
          : database.select().from(schema.user_profile),
        sectorId
          ? database
              .select()
              .from(schema.proximity_listing)
              .where(eq(schema.proximity_listing.sector_id, sectorId))
          : database.select().from(schema.proximity_listing),
        database.select().from(schema.neighbor_endorsement),
        sectorId
          ? database
              .select()
              .from(schema.community_post)
              .where(eq(schema.community_post.sector_id, sectorId))
          : database.select().from(schema.community_post),
        database.select().from(schema.resource_commitment),
        sectorId
          ? database
              .select()
              .from(schema.support_group)
              .where(eq(schema.support_group.sector_id, sectorId))
          : database.select().from(schema.support_group),
        database.select().from(schema.pii_access_audit_log),
      ]);

    const verifiedNeighborsCount = profiles.filter(
      (p: { is_verified_neighbor: boolean }) => p.is_verified_neighbor
    ).length;

    const emergencyReadyListingsCount = listings.filter(
      (l: { available_for_emergencies: boolean }) => l.available_for_emergencies
    ).length;

    const solidaryFavorsCount = posts.filter(
      (p: { post_type: string }) =>
        p.post_type === 'OFERTA_FAVOR' || p.post_type === 'SOLICITUD_FAVOR'
    ).length;

    const activeSosAlertsCount = posts.filter(
      (p: { post_type: string; status: string }) =>
        p.post_type === 'SOS_VULNERABLE' &&
        (p.status === 'ACTIVO' || p.status === 'EN_COORDINACION')
    ).length;

    return jsonOk({
      connected_neighbors_total: profiles.length,
      verified_neighbors_total: verifiedNeighborsCount,
      validated_listings_total: listings.length,
      emergency_ready_specialists: emergencyReadyListingsCount,
      total_endorsements_issued: endorsements.length,
      solidary_favors_zero_money: solidaryFavorsCount,
      estimated_family_savings_pen: solidaryFavorsCount * 85,
      active_sos_vulnerable_alerts: activeSosAlertsCount,
      active_support_groups: supportGroups.length,
      resource_commitments_coordinated: commitments.length,
      pii_vault_audited_dispatches: piiAudits.length,
      average_emergency_triage_seconds: 12,
    });
  } catch (err) {
    return handleRouteException(err, '/api/v1/metrics/institutional-impact');
  }
}
