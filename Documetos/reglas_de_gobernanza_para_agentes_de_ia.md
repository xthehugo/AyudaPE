# CLAUDE.md / Reglas del Agente de Código: RedVecina

Este archivo instruye a los agentes de IA (Claude Code, Cursor, Windsurf, GitHub Copilot) sobre cómo escribir código dentro de este repositorio respetando la arquitectura multicapa.

---

## 1. Reglas Estrictas por Capa

1. **Capa 1 (UI/UX Mobile-First):**
   * Diseña siempre para un contenedor móvil (`max-w-md mx-auto min-h-screen`).
   * Todo botón interactivo debe tener un área mínima táctil de `h-12` ($48\text{ px}$) y alto contraste para facilitar el uso por adultos mayores.
   * El estado `mode === 'EMERGENCIA'` debe cambiar visiblemente la interfaz (cabecera roja de alerta, priorización de reportes SOS y servicios de emergencia).
2. **Capa 2 (Offline-First Obligatorio):**
   * **Prohibido** hacer llamadas `fetch` que rompan la interfaz cuando `navigator.onLine === false`.
   * Toda lectura debe tener fallback a `Dexie.js` / caché local, y toda escritura realizada sin red debe encolarse localmente y reflejarse inmediatamente en el estado de React (*Optimistic Update*).
3. **Capa 3 (IA con Fallback Determinista):**
   * Usa `generateObject` de Vercel AI SDK con el esquema Zod `NeighborIntentSchema`.
   * Si el usuario no tiene API Key configurada en el entorno local o está en modo offline, el sistema debe ejecutar automáticamente el clasificador local por palabras clave (`localFallbackParser`) para que el flujo de **3 clics** jamás falle durante la evaluación del jurado.
4. **Calidad de Código:**
   * TypeScript estricto (`noImplicitAny`).
   * Componentes modulares, limpios y documentados.