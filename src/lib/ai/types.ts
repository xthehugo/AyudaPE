import type { OperationalMode } from '@shared/types';
import type { NeighborIntent } from '@shared/schemas';

export type AIExecutionTier =
  | 'TIER_1_GEMINI_CLOUD'
  | 'TIER_2_LOCAL_LLM'
  | 'TIER_3_DETERMINISTIC_HEURISTIC';

/**
 * Contrato común (Strategy Pattern) para los motores de clasificación
 * e interpretación de intenciones vecinales de RedVecina.
 */
export interface IIntentParserStrategy {
  readonly tier: AIExecutionTier;
  readonly name: string;
  parseIntent(text: string, mode: OperationalMode): Promise<NeighborIntent>;
}

/**
 * Reporte enriquecido del orquestador en 3 niveles (Chain of Responsibility)
 * que incluye telemetría de latencia y el nivel que resolvió la petición.
 */
export interface IntentParseExecutionResult {
  intent: NeighborIntent;
  tier_used: AIExecutionTier;
  strategy_name: string;
  latency_ms: number;
  fallback_reason?: string;
}
