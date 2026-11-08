import { createHash, randomBytes } from 'node:crypto';
import { jsonError, jsonOk } from '@/server/http/api-handler';

export interface StoredBrigadistaCode {
  code_hash: string;
  sector_id: string;
  is_used: boolean;
  used_by_device_id?: string;
  expires_at: string;
  created_at: string;
}

// Memoria de respaldo para códigos generados por el administrador de zona
const globalCodesStore = globalThis as unknown as {
  __brigadistaCodes?: Map<string, StoredBrigadistaCode>;
};
if (!globalCodesStore.__brigadistaCodes) {
  globalCodesStore.__brigadistaCodes = new Map<string, StoredBrigadistaCode>();
  
  // Código de prueba inicial para presentación (expira en 7 días)
  // Código en texto plano: "BRIGADA-2026"
  const testPlainCode = 'BRIGADA-2026';
  const testHash = createHash('sha256').update(testPlainCode.trim().toUpperCase()).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  globalCodesStore.__brigadistaCodes.set(testHash, {
    code_hash: testHash,
    sector_id: 'huancayo-el-tambo',
    is_used: false,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });
}

function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/**
 * POST /api/v1/brigadista/code
 * Valida un código emitido por el administrador de zona, o permite canje demo si DEMO_ROLES=true.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      action?: 'VERIFY_CODE' | 'GENERATE_CODE' | 'DEMO_STATUS';
      code?: string;
      device_id?: string;
      sector_id?: string;
      brigadista_name?: string;
    };

    const action = body.action || 'VERIFY_CODE';
    const isDemoEnabled = process.env.DEMO_ROLES === 'true';

    if (action === 'DEMO_STATUS') {
      return jsonOk({ demo_roles_enabled: isDemoEnabled });
    }

    // Generar un código nuevo por el administrador de zona (vence a los 7 días, solo guarda hash)
    if (action === 'GENERATE_CODE') {
      const sectorId = body.sector_id || 'huancayo-el-tambo';
      const plainCode = `BRIG-${randomBytes(3).toString('hex').toUpperCase()}`;
      const codeHash = hashCode(plainCode);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      globalCodesStore.__brigadistaCodes!.set(codeHash, {
        code_hash: codeHash,
        sector_id: sectorId,
        is_used: false,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

      return jsonOk({
        generated: true,
        plain_code: plainCode, // Solo se entrega una vez al administrador
        sector_id: sectorId,
        expires_at: expiresAt,
        notice: 'El código vence en 7 días y es de un solo uso.',
      });
    }

    // Verificar y canjear código
    const deviceId = (body.device_id || '').trim();
    const rawCode = (body.code || '').trim();

    if (!deviceId) {
      return jsonError(400, 'MISSING_DEVICE_ID', 'Se requiere el identificador de dispositivo.');
    }

    // Si el modo demostración está activo por variable de entorno
    if (isDemoEnabled && (!rawCode || rawCode.toUpperCase() === 'DEMO')) {
      const demoToken = `DEMO-TOKEN-${Date.now()}-${randomBytes(4).toString('hex')}`;
      return jsonOk({
        verified: true,
        is_demo: true,
        sector_id: body.sector_id || 'huancayo-el-tambo',
        brigadista_token: demoToken,
        message: 'Rol Brigadista activado en Modo Demostración (DEMO_ROLES=true).',
      });
    }

    if (!rawCode) {
      return jsonError(400, 'MISSING_CODE', 'Ingresa el código proporcionado por tu administrador de zona.');
    }

    const inputHash = hashCode(rawCode);
    const stored = globalCodesStore.__brigadistaCodes!.get(inputHash);

    if (!stored) {
      return jsonError(403, 'INVALID_CODE', 'El código de brigadista ingresado no es válido.');
    }

    if (stored.is_used) {
      return jsonError(403, 'CODE_ALREADY_USED', 'Este código de brigadista ya fue utilizado.');
    }

    if (new Date(stored.expires_at).getTime() < Date.now()) {
      return jsonError(403, 'CODE_EXPIRED', 'El código de brigadista ha vencido (validez máxima de 7 días).');
    }

    // Marcar como usado y guardar únicamente el hash
    stored.is_used = true;
    stored.used_by_device_id = deviceId;
    globalCodesStore.__brigadistaCodes!.set(inputHash, stored);

    const brigadistaToken = `BRIG-TOKEN-${createHash('sha256').update(`${deviceId}:${stored.code_hash}:${Date.now()}`).digest('hex')}`;

    return jsonOk({
      verified: true,
      sector_id: stored.sector_id,
      brigadista_token: brigadistaToken,
      message: '¡Código verificado exitosamente! Rol Brigadista activado.',
    });
  } catch (err) {
    return jsonError(500, 'CODE_VERIFICATION_ERROR', err instanceof Error ? err.message : 'Error al verificar código.');
  }
}
