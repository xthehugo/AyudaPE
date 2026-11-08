# PLAN.md: Plan de Ejecución Paso a Paso por Capas (Hackathon 48h)
**Proyecto:** RedVecina  
**Metodología:** Spec-Driven Development (SDD) — Tareas Atómicas Verificables

---

## Matriz de Roles del Equipo (4 Integrantes)
* **Rol A (UI/UX & Mapa Móvil):** Encargado de la Capa 1 (Layout Mobile-First, Switch Dual, Mapa Leaflet y Tutorial).
* **Rol B (Motor Offline & Flujo 3 Clics):** Encargado de la Capa 2 (PWA, IndexedDB con Dexie.js, Cola de Sincronización y Modal de 3 Clics).
* **Rol C (Backend, Geo-Datos & Seguridad):** Encargado de las Capas 5 y 6 (Supabase PostgreSQL, Seed Data barrial, Visto Bueno Vecinal y RLS).
* **Rol D (Ingeniería de IA, Integración & Pitch):** Encargado de las Capas 3, 4 y 7 (Endpoint con Vercel AI SDK, Voz a Texto, Despliegue en Vercel y Presentación Ejecutiva).

---

## Fase 1: Cimientos, Base de Datos y Configuración PWA (Horas 1 a 5)

- [ ] **T-01 [Rol C]: Inicialización del Repositorio y Dependencias Base**
  * **Acción:** Crear proyecto Next.js con TypeScript y Tailwind CSS. Instalar `lucide-react`, `zod`, `dexie`, `dexie-react-hooks`, `leaflet`, `react-leaflet`, `ai`, `@ai-sdk/google` (o `@ai-sdk/openai`).
  * **Verificación:** `npm run build` compila sin errores de tipos.

- [ ] **T-02 [Rol C]: Creación del Esquema SQL en Supabase y Datos Semilla (`Seed Data`)**
  * **Acción:** Ejecutar las tablas `profiles`, `local_services`, `endorsements` y `community_posts`. Insertar 12 registros realistas de un barrio limeño (ej. Jesús María / San Miguel / Surquillo): 6 oficios con "Visto Bueno Vecinal", 4 favores solidarios sin dinero y 4 alertas críticas de emergencia SOS.
  * **Verificación:** Consulta de lectura devuelve los 12 registros con coordenadas válidas $(\text{lat}, \text{lng})$.

- [ ] **T-03 [Rol B]: Configuración de Manifiesto PWA y Base de Datos Local (`Dexie.js`)**
  * **Acción:** Crear `public/manifest.json` y configurar `src/lib/db/dexie.ts` con las tablas `servicesCache`, `postsCache` y `outboxQueue`.
  * **Verificación:** En Chrome DevTools $\rightarrow$ *Application* $\rightarrow$ *IndexedDB*, aparece la base de datos `RedVecinaDB` inicializada.

- [ ] **T-04 [Rol A]: Contexto Global de Estado Dual (`AppModeContext`)**
  * **Acción:** Crear el proveedor de estado que controle `mode: 'HABITUAL' | 'EMERGENCIA'` y `isOnline: boolean` (escuchando los eventos `online` y `offline` de `window`).
  * **Verificación:** Cambiar el switch alterna las clases CSS globales de la aplicación en $< 50\text{ ms}$.

---

## Fase 2: Capa de Presentación Móvil y Mapa Geolocalizado (Horas 6 a 14)

- [ ] **T-05 [Rol A]: Shell Mobile-First, Cabecera SOS y Barra de Navegación Inferior**
  * **Acción:** Implementar contenedor centrado de tamaño móvil (`max-w-md mx-auto`), cabecera con indicador de conexión (`Online` verde / `Modo Offline Activo` ámbar), botón de pánico **Modo Emergencia** y navegación inferior con 3 pestañas: *Mapa Vecinal*, *Oficios Locales*, *Red Solidaria*.
  * **Verificación:** Vista responsiva impecable en resolución $390 \times 844\text{ px}$ (iPhone 14/Android).

- [ ] **T-06 [Rol A]: Mapa Interactivo con Pines Diferenciados (`React-Leaflet`)**
  * **Acción:** Crear componente de mapa cargado con `next/dynamic` (`ssr: false`). Renderizar marcadores personalizados según el modo:
    * Azul: Oficios validados.
    * Verde: Favores solidarios.
    * Rojo pulsante: Vecinos vulnerables SOS y Recursos Críticos.
  * **Verificación:** Al activar el Modo Emergencia, el mapa filtra el ruido y resalta únicamente los puntos de soporte y ayuda humanitaria.

- [ ] **T-07 [Rol C]: Módulo 1 — Directorio de Oficios y Sistema de "Visto Bueno Vecinal"**
  * **Acción:** Construir tarjetas de oficios con filtro por categoría, botón directo de contacto e insignia de **"Visto Bueno Vecinal"** con contador interactivo que incrementa la validación comunitaria y muestra los comentarios de vecinos cercanos.
  * **Verificación:** Hacer clic en "Dar Visto Bueno" actualiza el contador de inmediato (*Optimistic UI*) y persiste el respaldo.

- [ ] **T-08 [Rol C]: Módulo 2 — Muro de Cadena de Favores y Tablero Humanitario**
  * **Acción:** Construir el muro colaborativo dividido en *Necesito Ayuda* y *Ofrezco Apoyo* (sin precios). Cuando `mode === 'EMERGENCIA'`, transformar la vista en el **Tablero de Ayuda Humanitaria** con etiquetas de severidad (`CRÍTICO`, `ADULTO MAYOR`, `AGUA/BOTIQUÍN`).
  * **Verificación:** No existe ningún campo de precio monetario en el muro solidario; las alertas SOS muestran radio de protección de privacidad.

---

## Fase 3: Capa de IA, Regla de los 3 Clics y Resiliencia Offline (Horas 15 a 26)

- [ ] **T-09 [Rol D]: Endpoint de IA para Clasificación y Autocompletado (`/api/ai-parse`)**
  * **Acción:** Implementar Route Handler con Vercel AI SDK (`generateObject`) y `NeighborIntentSchema`. Incluir un analizador heurístico local de respaldo (*Fallback*) por si el jurado prueba la app sin conexión a internet o si la API tarda más de $2\text{ s}$.
  * **Verificación:** Enviar `{"text": "Tengo un taladro percutor para prestar a quien lo necesite"}` retorna `{"targetModule": "CADENA_FAVORES", "postType": "OFERTA_FAVOR", "category": "Herramientas", ...}`.

- [ ] **T-10 [Rol B + Rol D]: Modal de Publicación Rápida en 3 Clics con Dictado por Voz**
  * **Acción:** Crear `QuickPublishModal.tsx` integrando `webkitSpeechRecognition` (botón de micrófono) y caja de texto.
    * **Clic 1:** Abrir modal y hablar/escribir.
    * **Clic 2:** Botón *Autocompletar con IA* que llena categoría, tipo, título y coordenadas GPS.
    * **Clic 3:** Botón *Publicar Ahora*.
  * **Verificación:** Cronometrar la creación de un reporte desde cero: debe completarse en 3 toques y menos de 10 segundos.

- [ ] **T-11 [Rol B]: Sincronizador Offline (`SyncManager`) y Cola en `IndexedDB`**
  * **Acción:** Conectar el botón de publicar para que, si `isOnline === false`, guarde el objeto en `outboxQueue` de `Dexie.js` con una etiqueta visual `"Guardado en el teléfono (Pendiente de red)"`. Al volver a estar `online`, sincronizar automáticamente y mostrar notificación Toast `"¡Reportes offline sincronizados con la comunidad!"`.
  * **Verificación:** Apagar el WiFi/Red en DevTools, publicar un reporte SOS, verificar que aparece en pantalla y en el mapa, encender la red y comprobar que cambia a estado `"Sincronizado"`.

- [ ] **T-12 [Rol A]: Tutorial Interactivo de Accesibilidad Universal**
  * **Acción:** Crear un asistente guiado de 3 pasos claros con tipografía grande que explique: (1) Cómo buscar un oficio con Visto Bueno, (2) Cómo pedir u ofrecer un favor en 3 clics, y (3) Cómo usar el botón rojo en una emergencia sin internet. Añadir botón en la cabecera para volver a abrir el tutorial en cualquier momento.
  * **Verificación:** El jurado puede activar el tutorial desde un botón visible `¿Cómo funciona?` en la barra superior.

---

## Fase 4: Pulido Empresarial, Pruebas de Estrés y Presentación (Horas 27 a 48)

- [ ] **T-13 [Rol D]: Panel de Métricas / Vista Institucional (Valor para El Comercio y Municipios)**
  * **Acción:** Agregar un modal o pestaña ejecutiva de "Impacto Barrial" que muestre indicadores clave en tiempo real: Vecinos conectados, Oficios validados, Favores resueltos (ahorro estimado en soles para las familias) y Alertas SOS activas para Defensa Civil.
  * **Verificación:** Datos calculados dinámicamente a partir de los registros activos del sistema.

- [ ] **T-14 [Todos]: Simulacro Completo de Demo y Grabación de Video de Respaldo**
  * **Acción:** Desplegar en Vercel, probar desde 2 celulares reales escaneando un código QR, grabar un video de respaldo de 90 segundos mostrando los 3 flujos (Oficios $\rightarrow$ Favor con IA en 3 clics $\rightarrow$ Modo Emergencia Offline) y cronometrar la exposición de 5 minutos.