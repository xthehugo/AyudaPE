import { describe, expect, it } from 'vitest';
import { AIOrchestrator, parseNeighborIntent } from '../ai-orchestrator';
import { LocalHeuristicStrategy } from '../strategies/local-heuristic-strategy';

describe('MOD-08: Orquestador de IA Híbrida en 3 Niveles (Gemini Cloud -> Fallback Local Heurístico)', () => {
  it('1. Extrae intención estructurada con GeminiCloudStrategy cuando la API Key está activa y responde a tiempo', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      module: 'CADENA_FAVORES',
                      post_type: 'OFERTA_FAVOR',
                      category: 'Herramientas Barriales',
                      title: 'Préstamo solidario de taladro percutor',
                      description: 'Presto mi taladro percutor sin costo a vecinos de la cuadra.',
                      urgency: 'BAJA',
                      zero_money_compliant: true,
                      has_monetary_intent: false,
                      is_pii_redacted: false,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const orchestrator = new AIOrchestrator({
      geminiOptions: {
        apiKey: 'test-gemini-key-active',
        timeoutMs: 2000,
        fetchImpl: mockFetch,
      },
    });

    const result = await orchestrator.parseIntentWithMeta(
      'Presto mi taladro percutor sin costo a vecinos de la cuadra',
      'HABITUAL'
    );

    expect(result.tier_used).toBe('TIER_1_GEMINI_CLOUD');
    expect(result.intent.module).toBe('CADENA_FAVORES');
    expect(result.intent.post_type).toBe('OFERTA_FAVOR');
    expect(result.intent.zero_money_compliant).toBe(true);
    expect(result.fallback_reason).toBeUndefined();
  });

  it('2. Cancela llamada colgada de Gemini con AbortController y degrada al motor heurístico sin lanzar excepción', async () => {
    const slowFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('GEMINI_ABORTED_BY_TIMEOUT'));
        });
      });

    const orchestrator = new AIOrchestrator({
      geminiOptions: {
        apiKey: 'test-gemini-key-timeout',
        timeoutMs: 40, // Timeout rápido para test
        fetchImpl: slowFetch,
      },
    });

    const result = await orchestrator.parseIntentWithMeta(
      'Necesito un gasfitero para revisar una fuga de agua en el caño',
      'HABITUAL'
    );

    expect(result.tier_used).toBe('TIER_3_DETERMINISTIC_HEURISTIC');
    expect(result.fallback_reason).toContain('GEMINI_ABORTED_BY_TIMEOUT');
    expect(result.intent.category).toBe('Gasfitería y Saneamiento');
  });

  it('3. Ejecuta LocalHeuristicStrategy en <15ms en modo desconectado detectando jerga peruana y cobros monetarios (RN-01)', async () => {
    const heuristic = new LocalHeuristicStrategy();

    const start = performance.now();
    const tradeIntent = await heuristic.parseIntent(
      'Soy electricista matriculado, reviso tableros de luz y cortocircuitos. Cobro S/ 40 por yape o plin.',
      'HABITUAL'
    );
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(15);
    expect(tradeIntent.module).toBe('OFICIOS_PRODUCTOS');
    expect(tradeIntent.post_type).toBe('SERVICIO_OFICIO');
    expect(tradeIntent.category).toBe('Electricidad e Iluminación');
    expect(tradeIntent.has_monetary_intent).toBe(true);
    expect(tradeIntent.zero_money_compliant).toBe(false);
  });

  it('4. Sanitiza PII (Ley 29733) y extrae recursos cuantificables en alertas SOS vulnerables', async () => {
    const sosIntent = await parseNeighborIntent(
      'Auxilio urgente por sismo, mi abuelita postrada en silla de ruedas necesita 2 balones de oxígeno y 4 bidones de agua en Jr. Huiracocha 1420 Dpto 302, llamar al 987-654-321',
      'EMERGENCIA'
    );

    expect(sosIntent.module).toBe('EMERGENCIA_SOS');
    expect(sosIntent.post_type).toBe('SOS_VULNERABLE');
    expect(sosIntent.urgency).toBe('CRITICA');
    expect(sosIntent.is_pii_redacted).toBe(true);
    expect(sosIntent.description).not.toContain('Jr. Huiracocha 1420');
    expect(sosIntent.description).not.toContain('987-654-321');
    expect(sosIntent.extracted_pii?.exact_address_reference).toContain('Jr. Huiracocha 1420');
    expect(sosIntent.extracted_pii?.emergency_contact_phone).toBe('987-654-321');
    expect(sosIntent.resources).toBeDefined();
    expect(sosIntent.resources?.length).toBeGreaterThanOrEqual(2);
    expect(sosIntent.resources?.[0]?.quantity_needed).toBe(2);
  });
});
