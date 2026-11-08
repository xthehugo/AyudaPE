import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import type { OperationalMode } from '@shared/types';
import { NeighborIntentSchema, type NeighborIntent } from '@shared/schemas';
import type { IIntentParserStrategy } from '../types';

export interface GeminiCloudStrategyOptions {
  apiKey?: string;
  modelName?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const GEMINI_SYSTEM_PROMPT = `Eres el Clasificador Semántico Inteligente de RedVecina para barrios de Huancayo (Junín, Perú) y gestión comunitaria ante desastres (Ley N° 29733).
Analiza el mensaje del vecino y devuelve la intención estructurada cumpliendo estrictamente con el esquema:
1. "module": "OFICIOS_PRODUCTOS" | "CADENA_FAVORES" | "EMERGENCIA_SOS"
2. "post_type": "SERVICIO_OFICIO" | "PRODUCTO_LOCAL" | "SOLICITUD_FAVOR" | "OFERTA_FAVOR" | "SOS_VULNERABLE" | "RECURSO_CRITICO"
3. "category": Categoría barrial contextualizada (ej. "Gasfitería y Saneamiento", "Electricidad e Iluminación", "Botica e Insumos Médicos", "Brigada de Rescate Huancayo", "Alimentos y Viandas", "Apoyo Solidario").
4. "title": Título conciso de 5 a 65 caracteres sin datos personales sensibles.
5. "description": Texto público donde direcciones exactas (Jr., Av., Pje., nros), teléfonos y condiciones médicas graves se redactan con marcadores si es SOS_VULNERABLE.
6. "urgency": "BAJA" | "MEDIA" | "ALTA" | "CRITICA"
7. "zero_money_compliant": false si menciona precios, soles, S/, yape, plin o cobros; true si es solidario/sin costo (Regla RN-01).
8. "has_monetary_intent": true si existe cobro comercial o venta de producto/oficio.
9. "is_pii_redacted": true si se separó dirección exacta o teléfono a la bóveda privada.
10. "extracted_pii": (opcional) { "exact_address_reference": string, "medical_or_mobility_notes"?: string, "emergency_contact_phone"?: string }
11. "resources": (opcional) lista de recursos [{ "item_name": string, "unit": string, "quantity_needed": number }].`;

/**
 * Estrategia Nivel 1 (Cloud Primary):
 * Utiliza Vercel AI SDK (generateObject) con Google Gemini 2.5 Flash
 * y validación directa con Zod Schema (NeighborIntentSchema).
 */
export class GeminiCloudStrategy implements IIntentParserStrategy {
  public readonly tier = 'TIER_1_GEMINI_CLOUD' as const;
  public readonly name = 'Vercel AI SDK (Google Gemini 2.5 Flash)';

  private readonly apiKey: string | undefined;
  private readonly modelName: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: GeminiCloudStrategyOptions = {}) {
    this.apiKey =
      options.apiKey ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
      process.env.GEMINI_API_KEY;
    this.modelName = options.modelName ?? 'gemini-2.5-flash';
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fetchImpl = options.fetchImpl;
  }

  public isConfigured(): boolean {
    if (process.env.NEXT_PUBLIC_PAUSE_CLOUD_AI === 'true' && !this.fetchImpl) {
      return false; // Pausado para cero consumo de tokens durante desarrollo/demos locales
    }
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async parseIntent(text: string, mode: OperationalMode): Promise<NeighborIntent> {
    if (!this.isConfigured()) {
      throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
    }

    // Si se inyecta fetchImpl de prueba (por ejemplo en tests unitarios con mocks de la API raw de Gemini):
    if (this.fetchImpl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text }] }],
            }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJsonText) {
          throw new Error('GEMINI_EMPTY_RESPONSE');
        }
        return NeighborIntentSchema.parse(JSON.parse(rawJsonText));
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('TIMEOUT') || err.message.includes('ABORTED'))) {
          throw new Error('GEMINI_ABORTED_BY_TIMEOUT');
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const google = createGoogleGenerativeAI({
      apiKey: this.apiKey!,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const result = await generateObject({
        model: google(this.modelName),
        schema: NeighborIntentSchema,
        system: GEMINI_SYSTEM_PROMPT,
        prompt: `Modo Operativo: ${mode}\nMensaje del Vecino en Huancayo: "${text}"`,
        abortSignal: controller.signal,
      });

      return result.object;
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('TIMEOUT') || err.message.includes('ABORTED'))) {
        throw new Error(`GEMINI_ABORTED_BY_TIMEOUT`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
