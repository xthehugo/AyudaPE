import type { OperationalMode } from '@shared/types';
import type { NeighborIntent } from '@shared/schemas';
import { GeminiCloudStrategy, type GeminiCloudStrategyOptions } from './strategies/gemini-cloud-strategy';
import { LocalHeuristicStrategy } from './strategies/local-heuristic-strategy';
import type { IIntentParserStrategy, IntentParseExecutionResult } from './types';

export interface AIOrchestratorOptions {
  strategies?: IIntentParserStrategy[];
  geminiOptions?: GeminiCloudStrategyOptions;
}

/**
 * Orquestador de IA Híbrida en 3 Niveles (Strategy + Chain of Responsibility):
 * - Nivel 1: Google Gemini 2.5 Flash (Cloud Primary, timeout estricto de 2.0s).
 * - Nivel 2: Estrategia intermedia inyectable (Local LLM / Edge AI si está disponible).
 * - Nivel 3: Motor Heurístico Determinista Local (<15ms, 100% offline y sin excepciones).
 */
export class AIOrchestrator {
  private readonly strategies: IIntentParserStrategy[];
  private readonly fallbackStrategy: LocalHeuristicStrategy;

  constructor(options: AIOrchestratorOptions = {}) {
    this.fallbackStrategy = new LocalHeuristicStrategy();
    if (options.strategies && options.strategies.length > 0) {
      this.strategies = options.strategies;
    } else {
      this.strategies = [
        new GeminiCloudStrategy(options.geminiOptions),
        this.fallbackStrategy,
      ];
    }
  }

  /**
   * Ejecuta la cadena de responsabilidad y retorna tanto el `NeighborIntent` como
   * la telemetría del nivel utilizado y la latencia en milisegundos.
   */
  public async parseIntentWithMeta(
    text: string,
    mode: OperationalMode = 'HABITUAL'
  ): Promise<IntentParseExecutionResult> {
    const startTime = performance.now();
    let lastErrorReason: string | undefined;

    for (const strategy of this.strategies) {
      try {
        const intent = await strategy.parseIntent(text, mode);
        const latencyMs = Math.max(0.1, Number((performance.now() - startTime).toFixed(2)));
        return {
          intent,
          tier_used: strategy.tier,
          strategy_name: strategy.name,
          latency_ms: latencyMs,
          fallback_reason: lastErrorReason,
        };
      } catch (err) {
        lastErrorReason = err instanceof Error ? err.message : 'STRATEGY_EXECUTION_ERROR';
      }
    }

    // Garantía absoluta de resiliencia: si una lista personalizada de estrategias fallara,
    // el motor heurístico determinista local resuelve sin lanzar excepciones no controladas.
    const fallbackStart = performance.now();
    const fallbackIntent = await this.fallbackStrategy.parseIntent(text, mode);
    const fallbackLatency = Math.max(0.1, Number((performance.now() - fallbackStart).toFixed(2)));

    return {
      intent: fallbackIntent,
      tier_used: this.fallbackStrategy.tier,
      strategy_name: this.fallbackStrategy.name,
      latency_ms: fallbackLatency,
      fallback_reason: lastErrorReason,
    };
  }

  /**
   * Método directo compatible con la firma `parseNeighborIntent(text, mode)`.
   */
  public async parseIntent(
    text: string,
    mode: OperationalMode = 'HABITUAL'
  ): Promise<NeighborIntent> {
    const result = await this.parseIntentWithMeta(text, mode);
    return result.intent;
  }
}

const defaultOrchestrator = new AIOrchestrator();

/**
 * Función unificada exportada para el consumo desde componentes UI, hooks y endpoints API.
 */
export async function parseNeighborIntent(
  text: string,
  mode: OperationalMode = 'HABITUAL'
): Promise<NeighborIntent> {
  return defaultOrchestrator.parseIntent(text, mode);
}

/**
 * Variante con metadatos de telemetría (nivel de IA empleado, latencia y razón de fallback).
 */
export async function parseNeighborIntentWithMeta(
  text: string,
  mode: OperationalMode = 'HABITUAL'
): Promise<IntentParseExecutionResult> {
  return defaultOrchestrator.parseIntentWithMeta(text, mode);
}
