/**
 * @file src/server/use-cases/create-community-post.ts
 * @description Capa 3 (MOD-06) — Caso de Uso Hexagonal: Creación de Publicaciones en Cadena de Favores y SOS.
 * Aplica:
 * - RN-01: Invariante Cero Dinero en Cadena de Favores.
 * - RN-04: Difuminación Espacial de 50 metros (Spatial Blurring) y Particionamiento 1:1 en `post_sensitive_pii`.
 * - Ley N° 29733: Sanitización y Cuarentena de PII domiciliaria y médica en vistas públicas.
 */

import { eq } from 'drizzle-orm';
import {
  CreateCommunityPostSchema,
  MONEY_REGEX,
  type CreateCommunityPostDto,
} from '@shared/schemas';
import { db } from '@/server/db/client';
import * as schema from '@/server/db/schema';

export interface CreateCommunityPostParams extends CreateCommunityPostDto {
  author_user_id: number;
}

const EXACT_ADDRESS_SANITIZE_REGEX =
  /\b(?:(?:Jr\.|Jir[oó]n|Calle|Av\.|Avenida|Psje\.|Pasaje|Pje\.|Prolongaci[oó]n)\s+[A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s\.\-]+?(?:\d{1,5}(?:\s*(?:Dpto|Depto|Interior|Int|Piso|Mz|Lote|Lt|Block|Bloque|Edificio)\.?\s*[A-Za-z0-9\-]+)*|\bMz\.?\s*[A-Za-z0-9\-]+\s*Lt\.?\s*[A-Za-z0-9\-]+))/gi;

const EXACT_MEDICAL_SANITIZE_REGEX =
  /\b(?:insuficiencia\s+card[ií]aca(?:\s+severa)?|fiebre(?:\s+de)?\s*\d{2}(?:\.?\d)?|convulsion(?:es)?|diabet(?:es|ico)|hipertensi[oó]n|marcapasos|c[aá]ncer|di[aá]lisis|paraplej[ií][ac]o|hemorragia|fractura\s+de\s+[a-záéíóúñ]+)\b/gi;

/**
 * Calcula coordenadas públicas con perturbación determinista o controlada en un anillo de [35m, 50m]
 * para proteger la ubicación exacta del vecino vulnerable (RN-04).
 */
export function applySpatialBlurring50m(
  exactLat: number,
  exactLng: number,
  seedString: string
): { public_lat: number; public_lng: number } {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) >>> 0;
  }
  const radiusMeters = 35 + (hash % 15); // Entre 35m y 49m
  const angleRad = ((hash % 360) * Math.PI) / 180;

  const deltaLat = (radiusMeters * Math.cos(angleRad)) / 111111;
  const cosLat = Math.max(0.1, Math.cos((exactLat * Math.PI) / 180));
  const deltaLng = (radiusMeters * Math.sin(angleRad)) / (111111 * cosLat);

  return {
    public_lat: Number((exactLat + deltaLat).toFixed(6)),
    public_lng: Number((exactLng + deltaLng).toFixed(6)),
  };
}

/**
 * Sanitiza texto público reemplazando direcciones exactas y diagnósticos médicos por etiquetas legales.
 */
export function sanitizePublicSosText(rawText: string): {
  sanitized: string;
  extractedAddresses: string[];
  extractedMedical: string[];
} {
  const extractedAddresses: string[] = [];
  const extractedMedical: string[] = [];

  let sanitized = rawText.replace(EXACT_ADDRESS_SANITIZE_REGEX, (match) => {
    extractedAddresses.push(match.trim());
    return '[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]';
  });

  sanitized = sanitized.replace(EXACT_MEDICAL_SANITIZE_REGEX, (match) => {
    extractedMedical.push(match.trim());
    return '[CONDICIÓN DE SALUD PROTEGIDA]';
  });

  return {
    sanitized,
    extractedAddresses,
    extractedMedical,
  };
}

export class CreateCommunityPostUseCase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly database: any = db) {}

  async execute(input: CreateCommunityPostParams) {
    // 1. Validación estricta con Zod (incluye RN-01 Cero Dinero en OFERTA_FAVOR y SOLICITUD_FAVOR)
    const validated = CreateCommunityPostSchema.parse(input);

    if (
      (validated.post_type === 'OFERTA_FAVOR' || validated.post_type === 'SOLICITUD_FAVOR') &&
      MONEY_REGEX.test(`${validated.title} ${validated.description}`)
    ) {
      throw new Error(
        'VIOLACION_RN01_CERO_DINERO: No se permiten cobros ni referencias monetarias en la Cadena de Favores.'
      );
    }

    // 2. Verificar idempotencia por client_mutation_id (RN-07)
    const existingPost = await this.database
      .select()
      .from(schema.community_post)
      .where(eq(schema.community_post.client_mutation_id, validated.client_mutation_id))
      .limit(1);

    if (existingPost.length > 0) {
      const existingResources = await this.database
        .select()
        .from(schema.post_resource_item)
        .where(eq(schema.post_resource_item.post_id, existingPost[0]!.id));

      return {
        post: existingPost[0]!,
        resources: existingResources,
        pii_isolated: existingPost[0]!.post_type === 'SOS_VULNERABLE',
        idempotent_replay: true,
      };
    }

    // 3. Resolver sector_id y teléfono del autor si no se enviaron
    const [authorProfile] = await this.database
      .select()
      .from(schema.user_profile)
      .where(eq(schema.user_profile.id, input.author_user_id))
      .limit(1);

    if (!authorProfile) {
      throw new Error('ENTIDAD_NO_ENCONTRADA: El perfil del autor no existe.');
    }

    const sectorId = validated.sector_id ?? authorProfile.sector_id;

    // 4. Preparación de datos según tipo de publicación (SOS_VULNERABLE vs General)
    let publicTitle = validated.title;
    let publicDescription = validated.description;
    let publicLat = validated.public_lat;
    let publicLng = validated.public_lng;
    let privacyRadiusMeters = 0;

    const exactLat = validated.exact_lat ?? validated.public_lat;
    const exactLng = validated.exact_lng ?? validated.public_lng;

    let addressReferenceForVault = validated.extracted_pii?.exact_address_reference;
    let medicalNotesForVault = validated.extracted_pii?.medical_or_mobility_notes;
    const vulnerablePersonName = validated.extracted_pii?.vulnerable_person_name;
    const emergencyPhone =
      validated.extracted_pii?.emergency_contact_phone ?? authorProfile.phone_number;

    if (validated.post_type === 'SOS_VULNERABLE') {
      privacyRadiusMeters = 50;

      const titleSanitized = sanitizePublicSosText(publicTitle);
      const descSanitized = sanitizePublicSosText(publicDescription);

      publicTitle = titleSanitized.sanitized;
      publicDescription = descSanitized.sanitized;

      if (!addressReferenceForVault) {
        const allAddr = [
          ...titleSanitized.extractedAddresses,
          ...descSanitized.extractedAddresses,
        ];
        addressReferenceForVault =
          allAddr.length > 0
            ? allAddr.join(' / ')
            : `Coordenada exacta resguardada (${exactLat}, ${exactLng})`;
      }

      if (!medicalNotesForVault) {
        const allMed = [...titleSanitized.extractedMedical, ...descSanitized.extractedMedical];
        if (allMed.length > 0) {
          medicalNotesForVault = allMed.join(', ');
        }
      }

      // Aplicar Spatial Blurring de 50 metros sobre las coordenadas exactas
      const blurred = applySpatialBlurring50m(exactLat, exactLng, validated.client_mutation_id);
      publicLat = blurred.public_lat;
      publicLng = blurred.public_lng;
    }

    // 5. Ejecutar Transacción ACID: community_post + post_sensitive_pii (si SOS) + post_resource_item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await this.database.transaction(async (tx: any) => {
      const [insertedPost] = await tx
        .insert(schema.community_post)
        .values({
          client_mutation_id: validated.client_mutation_id,
          author_user_id: input.author_user_id,
          sector_id: sectorId,
          category_id: validated.category_id,
          operational_mode: validated.operational_mode,
          post_type: validated.post_type,
          title: publicTitle,
          description: publicDescription,
          urgency_level: validated.urgency_level,
          public_lat: publicLat,
          public_lng: publicLng,
          privacy_radius_meters: privacyRadiusMeters,
          status: 'ACTIVO',
          ai_triaged: true,
          has_monetary_intent: false,
          zero_money_compliant: true,
        })
        .returning();

      if (validated.post_type === 'SOS_VULNERABLE') {
        await tx.insert(schema.post_sensitive_pii).values({
          post_id: insertedPost!.id,
          exact_lat: exactLat,
          exact_lng: exactLng,
          exact_address_reference: addressReferenceForVault!,
          vulnerable_person_name: vulnerablePersonName ?? null,
          medical_or_mobility_notes: medicalNotesForVault ?? null,
          emergency_contact_phone: emergencyPhone,
        });
      }

      const insertedResources = [];
      if (validated.resources && validated.resources.length > 0) {
        for (const item of validated.resources) {
          const [resRow] = await tx
            .insert(schema.post_resource_item)
            .values({
              ...(item.client_mutation_id ? { client_mutation_id: item.client_mutation_id } : {}),
              post_id: insertedPost!.id,
              item_name: item.item_name,
              unit_measure: item.unit,
              quantity_needed: String(item.quantity_needed),
              quantity_committed: '0.00',
            })
            .returning();
          insertedResources.push(resRow!);
        }
      }

      return {
        post: insertedPost!,
        resources: insertedResources,
        pii_isolated: validated.post_type === 'SOS_VULNERABLE',
        idempotent_replay: false,
      };
    });
  }
}
