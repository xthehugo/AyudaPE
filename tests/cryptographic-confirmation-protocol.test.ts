import { describe, expect, it } from 'vitest';
import {
  deriveHmac4DigitCode,
  generateSharedSecret,
  getVerificationAttemptState,
  recordFailedAttempt,
  resetVerificationAttempts,
  verifyCommitmentCode,
} from '@/lib/crypto/confirmation-protocol';
import {
  ApisNetPeDniProvider,
  compareNames,
  hashDniWithSalt,
} from '@/server/dni/dni-provider.interface';

describe('Criptografía P2P, Protocolo de Confirmación y Verificación DNI', () => {
  it('1. Genera código determinista HMAC de 4 dígitos (1000-9999) y rota a las 24 horas', async () => {
    const secret = generateSharedSecret();
    const commitmentId = 'comm-12345';
    const t0 = 1770000000000; // Día 1
    const tSameDay = t0 + 2 * 3600 * 1000; // 2 horas después (mismo día)
    const tNextDay = t0 + 25 * 3600 * 1000; // 25 horas después (día siguiente)

    const code1 = await deriveHmac4DigitCode(secret, commitmentId, t0);
    const codeSameDay = await deriveHmac4DigitCode(secret, commitmentId, tSameDay);
    const codeNextDay = await deriveHmac4DigitCode(secret, commitmentId, tNextDay);

    expect(code1).toMatch(/^\d{4}$/);
    expect(Number(code1)).toBeGreaterThanOrEqual(1000);
    expect(Number(code1)).toBeLessThanOrEqual(9999);

    // Mismo día -> código idéntico
    expect(codeSameDay).toBe(code1);

    // Día siguiente -> código renovado determinista
    expect(codeNextDay).not.toBe(code1);
    expect(codeNextDay).toMatch(/^\d{4}$/);
  });

  it('2. Confirmación válida: acepta código correcto entre dos dispositivos distintos', async () => {
    const secret = generateSharedSecret();
    const commitmentId = 'comm-valid-01';
    const devRequester = 'dev-requester-aaa';
    const devVolunteer = 'dev-volunteer-bbb';

    const validCode = await deriveHmac4DigitCode(secret, commitmentId);

    const res = await verifyCommitmentCode({
      sharedSecret: secret,
      commitmentId,
      enteredCode: validCode,
      requesterDeviceId: devRequester,
      helperDeviceId: devVolunteer,
      currentDeviceId: devVolunteer,
    });

    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('3. Regla anti-abuso: Rechaza autoconfirmación si el mismo dispositivo intenta confirmarse', async () => {
    const secret = generateSharedSecret();
    const commitmentId = 'comm-self-01';
    const sameDevice = 'dev-attacker-xxx';

    const validCode = await deriveHmac4DigitCode(secret, commitmentId);

    const res = await verifyCommitmentCode({
      sharedSecret: secret,
      commitmentId,
      enteredCode: validCode,
      requesterDeviceId: sameDevice,
      helperDeviceId: sameDevice,
      currentDeviceId: sameDevice,
    });

    expect(res.valid).toBe(false);
    expect(res.isSelfConfirmation).toBe(true);
    expect(res.error).toContain('propio compromiso');
  });

  it('4. Regla anti-abuso: Bloqueo de 15 minutos tras 5 intentos erróneos de código', async () => {
    const secret = generateSharedSecret();
    const commitmentId = 'comm-attempts-01';
    resetVerificationAttempts(commitmentId);

    // 4 intentos fallidos
    for (let i = 0; i < 4; i++) {
      const res = await verifyCommitmentCode({
        sharedSecret: secret,
        commitmentId,
        enteredCode: '0000',
        requesterDeviceId: 'req-1',
        helperDeviceId: 'help-2',
        currentDeviceId: 'help-2',
      });
      expect(res.valid).toBe(false);
    }

    // 5to intento fallido activa bloqueo
    const res5 = await verifyCommitmentCode({
      sharedSecret: secret,
      commitmentId,
      enteredCode: '0000',
      requesterDeviceId: 'req-1',
      helperDeviceId: 'help-2',
      currentDeviceId: 'help-2',
    });

    expect(res5.valid).toBe(false);
    expect(res5.error).toContain('15 minutos');

    // Intentos subsiguientes permanecen bloqueados
    const resBlocked = await verifyCommitmentCode({
      sharedSecret: secret,
      commitmentId,
      enteredCode: '0000',
      requesterDeviceId: 'req-1',
      helperDeviceId: 'help-2',
      currentDeviceId: 'help-2',
    });
    expect(resBlocked.valid).toBe(false);
    expect(resBlocked.error).toContain('Bloqueado temporalmente');
  });

  it('5. Hasheo irreversible de DNI con sal y cotejo tolerante de nombres', async () => {
    const dni = '12345678';
    const hash1 = hashDniWithSalt(dni);
    const hash2 = hashDniWithSalt(dni);

    // Determinista para validación, pero irreversible y no contiene el DNI en plano
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toContain(dni);

    // Comparación tolerante de nombres
    expect(compareNames('Juan Pérez', 'JUAN PÉREZ QUISPE')).toBe(true);
    expect(compareNames('Maria Alvarez', 'MARÍA ÁLVAREZ SOTO')).toBe(true);
    expect(compareNames('Carlos Gomez', 'ROBERTO ZAPATA')).toBe(false);
  });

  it('6. Proveedor DNI falla limpiamente ante DNI inválido o de formato erróneo sin caerse', async () => {
    const provider = new ApisNetPeDniProvider();

    // DNI con longitud menor a 8 dígitos
    const resShort = await provider.validateDni('1234', 'Juan Perez');
    expect(resShort.success).toBe(false);
    expect(resShort.verified).toBe(false);
    expect(resShort.errorMessage).toContain('8 dígitos');

    // DNI simulado inexistente
    const resNotFound = await provider.validateDni('00000000', 'Desconocido');
    expect(resNotFound.success).toBe(false);
    expect(resNotFound.verified).toBe(false);
    expect(resNotFound.errorMessage).toContain('padrón');
  });

  it('7. Sincronización offline por lotes (POST /api/v1/sync) es idempotente y deduplica eventos', async () => {
    const { POST: syncHandler } = await import('@/app/api/v1/sync/route');
    const evtId = 'evt-unique-batch-999';

    const req1 = new Request('http://localhost:3000/api/v1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            event_id: evtId,
            device_id: 'dev-alpha',
            signature: 'sig-test',
            event_type: 'DELIVERY_DECLARED',
            payload: { commitment_id: 'comm-sync-test' },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    const res1 = await syncHandler(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.data.processed).toBe(1);
    expect(data1.data.ignored_duplicates).toBe(0);

    // Segundo envío con el mismo event_id (idempotencia)
    const req2 = new Request('http://localhost:3000/api/v1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            event_id: evtId,
            device_id: 'dev-alpha',
            signature: 'sig-test',
            event_type: 'DELIVERY_DECLARED',
            payload: { commitment_id: 'comm-sync-test' },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    const res2 = await syncHandler(req2);
    const data2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(data2.data.processed).toBe(0);
    expect(data2.data.ignored_duplicates).toBe(1);
  });
});
