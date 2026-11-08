# Reporte de Investigación Técnica: Semillas Hiperlocales (Huancayo y Zonas Críticas), Bóveda PII y Modo Presentación Jurado 180s (R1 y R4)

**Proyecto:** RedVecina — Plataforma Hiperlocal y Resiliente de Economía Vecinal y Respuesta Humanitaria  
**Fecha:** 2026-11-07  
**Autor:** Explorer 3 (Survey Phase)  
**Ruta del Archivo:** `C:\Users\hugoc\OneDrive\Documentos\hackaton\.agents\teamwork\teamwork_explorer_survey_3\handoff.md`  
**Referencia:** `ORIGINAL_REQUEST.md` (R1 y R4)  
**Tipo de Handoff:** Hard Handoff — Investigación exhaustiva, accionable y verificada

---

## 1. Observation (Observaciones Directas con Evidencia Verificada)

### 1.1. Estado de Línea Base del Código y Testing
- **Pruebas Automatizadas (`npm test`):**
  - Ejecutado en `C:\Users\hugoc\OneDrive\Documentos\hackaton` con Vitest v3.2.7.
  - Resultado: **13 archivos pasados (13/13), 63 tests pasados (63/63), 0 fallos** en 13.44s.
- **Tipado Estático (`npm run typecheck`):**
  - Ejecutado `tsc --noEmit`. Resultado: **0 errores de compilación**.

---

### 1.2. Datos Semilla Actuales y Almacén de Datos

#### A. Datos Semilla en Memoria Local (`src/lib/initial-data.ts`)
- Archivo de 176 líneas que exporta dos constantes:
  1. `INITIAL_SECTOR_LISTINGS: IListingLocal[]` (6 registros):
     - `id: 1`: Gasfitería Maestro Jorge (`lat: -12.0751, lng: -77.0482`, Jr. Huiracocha cdra 14).
     - `id: 2`: Lic. Rosa · Enfermería y Oxígeno Medicinal 24/7 (`lat: -12.0746, lng: -77.0479`).
     - `id: 3`: Electricista Matriculado Don Alberto (`lat: -12.0759, lng: -77.0491`).
     - `id: 4`: Bodega y Menú Familiar Doña Carmen (`lat: -12.0763, lng: -77.0488`).
     - `id: 5`: Lasañas Artesanales y Postres · Vecina Elena (`lat: -12.0753, lng: -77.0483`).
     - `id: 6`: Prof. Martín · Clases de Matemáticas, Física (`lat: -12.0756, lng: -77.0486`).
  2. `INITIAL_SECTOR_POSTS: IPostLocal[]` (4 registros):
     - `id: 1`: Acopio solidario de agua potable para adultos mayores (`SOLICITUD_FAVOR`, `lat: -12.0753, lng: -77.0484`).
     - `id: 2`: SOS Adulto Mayor requiere recarga de oxígeno medicinal (`SOS_VULNERABLE`, `lat: -12.0749, lng: -77.0481`, `privacy_radius_meters: 50`).
     - `id: 3`: Presto muletas ortopédicas de aluminio y escalera telescópica (`OFERTA_FAVOR`, `lat: -12.0757, lng: -77.0489`).
     - `id: 4`: Pool Escolar Solidario · Turnos para llevar niños al colegio (`OFERTA_FAVOR`, `lat: -12.0754, lng: -77.0485`).

#### B. Semillas Relacionales PostgreSQL (`src/database/seeds/003_seed_lima_sector4.sql`)
- 813 líneas SQL con datos para Lima:
  - Distrito: `UBIGEO 150113` (Jesús María, Lima).
  - Sector: `JM-SEC-04` ("Sector 4 - Residencial San Felipe / Huiracocha", centroide: `-12.0850, -77.0515`, radio: `1200m`).
  - 10 categorías en `category_catalog`.
  - 8 perfiles vecinales (`user_profile`).
  - 2 brigadas / grupos de apoyo (`support_group`).
  - 12 registros en `proximity_listing`.
  - 15 endosos (`neighbor_endorsement`).
  - 10 publicaciones comunitarias (`community_post`).
  - 2 registros en Bóveda PII (`post_sensitive_pii`): Doña Grimanesa Soto (84 años, oxígeno) y Don Teófilo Cáceres (79 años, insulina).
  - 1 registro de auditoría en `pii_access_audit_log` por el Dr. Ricardo Huamán (Brigadista Certificado B-202).

#### C. Esquema IndexedDB (`src/lib/offline/db.ts`)
- Utiliza Dexie.js v4 (`RedVecinaLocalDB`) con tablas:
  - `listings: '++id, &client_mutation_id, category_id, listing_type, available_for_emergencies, weighted_trust_score'`
  - `posts: '++id, &client_mutation_id, operational_mode, post_type, urgency_level, status, client_created_at'`
  - `commitments: '++id, &client_mutation_id, post_id, post_client_mutation_id, resource_item_id, status'`
  - `outbox: '++local_id, &client_mutation_id, status, created_at'`
- **Hallazgo clave:** No existe actualmente una tabla en Dexie para `pii_audit_log` ni para almacenar datos de Bóveda PII localmente cuando la app opera offline.

---

### 1.3. Selección e Inicialización Actual de Ubicación (Geolocalización)
- **TopBar (`src/components/layout/top-bar.tsx` línea 69):**
  Texto hardcodeado sin interactividad:
  ```tsx
  <span className="text-[11px] text-[var(--muted-foreground)] font-semibold truncate hidden xs:inline">
    Jesús María · Sector 4
  </span>
  ```
- **App Principal (`src/app/page.tsx` línea 31):**
  Llama de forma estática `useDownlinkSync(1);` (anclado al sector 1).
- **Mapa (`src/components/map/neighborhood-map.tsx` líneas 21-25):**
  ```typescript
  const CENTER_LAT = -12.0752;
  const CENTER_LNG = -77.0485;
  ```
- **Catálogo de Proximidad (`src/components/views/proximity-catalog-view.tsx` líneas 17-18):**
  ```typescript
  const SECTOR_CENTER_LAT = -12.0752;
  const SECTOR_CENTER_LNG = -77.0485;
  ```
- **Publicación Rápida (`src/components/publish/quick-publish-sheet.tsx` líneas 35-36):**
  ```typescript
  const DEFAULT_SECTOR_LAT = -12.0752;
  const DEFAULT_SECTOR_LNG = -77.0485;
  ```
- **Diagnóstico:** El 100% de los módulos de la aplicación están anclados rígidamente a Jesús María (Lima). No existe un contexto de ubicación ni selector de territorio.

---

### 1.4. Estado de Implementación de Bóveda PII, Alerta SOS y Conmutador Offline

#### A. Conmutador Offline (Modo Avión)
- En `src/lib/offline/sync-manager.ts`:
  - Método `public setOnlineStatus(online: boolean): void` (línea 78).
  - Emite el evento `'state_changed'`.
  - El hook `useNetworkSync` (`src/hooks/use-network-sync.ts`) escucha `'state_changed'` y actualiza el estado `isOnline`.
  - El componente `OfflineBanner` (`src/components/layout/offline-banner.tsx`) y `TopBar` reaccionan inmediatamente mostrando `"Modo Sin Red / Guardado Local Seguro"` y la insignia `"Sin red"` en ámbar.
  - **Eficacia:** Cambiar `syncManager.setOnlineStatus(false)` commuta la aplicación a offline inmediatamente sin recargar la página (<16ms).

#### B. Publicación de Emergencia SOS con Difuminado de Privacidad a 50m
- En `src/components/publish/quick-publish-modal.tsx` (líneas 125-146):
  - Cuando `intent.post_type === 'SOS_VULNERABLE'`, calcula un desplazamiento espacial (`offsetLat = 0.00022`, `offsetLng = -0.00019`) y fija `privacy_radius_meters = 50`.
  - En `src/server/use-cases/create-community-post.ts` (líneas 33-53 y 58-81), la función `applySpatialBlurring50m(exactLat, exactLng, seed)` perturba determinísticamente la coordenada en un radio de 35 a 49 metros, mientras `sanitizePublicSosText` sustituye la dirección exacta por `[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]` y patologías médicas por `[CONDICIÓN DE SALUD PROTEGIDA]`.
  - En `src/components/map/neighborhood-map.tsx` (líneas 218-243), se renderiza el círculo difuminado de 50 metros con `data-testid="sos-privacy-circle-50m"` y `data-radius-meters={50}`.

#### C. Desbloqueo Auditado de Bóveda PII
- **Servidor (`src/app/api/v1/posts/[id]/sensitive-pii/route.ts`):**
  - Valida rol (`BRIGADISTA_CERTIFICADO`, `LIDER_VECINAL`, `OPERADOR_MUNICIPAL`).
  - Valida motivo operativo (`access_reason >= 10 caracteres`).
  - Registra transacción inmutable en `schema.pii_access_audit_log` (protegida contra `UPDATE`/`DELETE` por el trigger `trg_prevent_audit_log_mutation`).
  - Retorna `{ exact_lat, exact_lng, exact_address, vulnerable_person_name, contact_phone, medical_notes, access_audit_id }`.
- **Cliente / Mapa (`src/components/map/neighborhood-map.tsx` líneas 90-143):**
  - Modal de desbloqueo con campo de texto para `access_reason` (valida $\ge 10$ caracteres).
  - Si el rol es Brigadista, envía POST al endpoint y almacena en `unlockedMap`.
  - **Brecha detectada para R4:** En modo offline o simulación local ante el jurado, no existe un log local visible en la interfaz para mostrar el historial de auditoría de desbloqueos PII en tiempo real sin conexión al servidor PostgreSQL.

---

### 1.5. Regla de Accesibilidad Universal en Botones
- En `tests/e2e-audit-mod13.test.ts` (líneas 117-125):
  Se valida que **todo elemento `<button>`** contenga `min-h-[48px]`, `min-h-[52px]` o `min-h-[56px]`.
  Cualquier botón nuevo en el panel del jurado, en el selector de ubicación o en el cronómetro debe cumplir estrictamente esta regla.

---

## 2. Logic Chain (Cadena Lógica desde Observaciones hacia Conclusiones)

1. **Premisa 1 (Requerimiento R1 — Huancayo y Casos del Video):**
   - El requerimiento exige que la aplicación inicie por defecto en Junín, Huancayo (con sectores: El Tambo, San Carlos, Centro) y zonas críticas ante catástrofes (terremotos / Falla Huaytapallana y Fenómeno El Niño / desbordes del Mantaro).
   - Debe incorporar exactamente los casos de Mario Cortijo:
     - *Muro Solidario (Cero Dinero):* Préstamo gratuito de muletas ortopédicas y carpooling / pool escolar.
     - *Catálogo de Proximidad:* Lasañas caseras y postres, clases de matemáticas/nivelación, oficios técnicos (gasfitería, electricidad, enfermería).
     - *Emergencias:* Puntos de acopio, oxígeno medicinal, brigadas vecinales y puntos de encuentro.
   - *Deducción:* Se debe crear un `LocationContext` que maneje la ubicación activa, default a Huancayo (`-12.0528, -75.2155`), enriquecer `initial-data.ts` con semillas realistas de Huancayo geolocalizadas a distancias caminables (<1km), y dotar a `TopBar` de un selector interactivo que permita alternar de forma inmediata entre sectores.
   - *Restricción de No Regresión:* Para que `app-shell-mod10.test.ts` (que busca `'Jesús María · Sector 4'`) y `seed-mod03.test.ts` no fallen, Jesús María debe conservarse como opción válida dentro del selector y en el dataset de respaldo.

2. **Premisa 2 (Requerimiento R4 — Modo Presentación Jurado 180s):**
   - R4 solicita un panel interactivo flotante accesible en pantalla para la exposición de 180 segundos con:
     1. Cronómetro regresivo de 180s (3 minutos) con controles de Inicio, Pausa y Reinicio.
     2. Botón de simulación 1: Caída de red / Modo Avión en 1 clic (demostrando navegación local en IndexedDB sin recargar).
     3. Botón de simulación 2: Publicación SOS por voz con difuminado automático a 50 metros.
     4. Botón de simulación 3: Desbloqueo auditado de Bóveda PII por un Brigadista con log local visible.
   - *Deducción para Simulación 1 (Modo Avión):*
     Se conecta directamente con `syncManager.setOnlineStatus(!syncManager.getState().isOnline)`. Esto cambia instantáneamente el estado reactivo sin recargar la página, activando el `OfflineBanner` y el badge "Sin red", permitiendo al jurado navegar por el catálogo y el mapa desde Dexie.js.
   - *Deducción para Simulación 2 (SOS Voz con 50m Blur):*
     Se puede simular el dictado por voz de Mario Cortijo: *"SOS Adulto mayor electrodependiente en El Tambo requiere oxígeno urgente por corte de energía"*. Al presionar el botón, se ejecuta `executeQuickPublishPersist` con `privacy_radius_meters = 50`, coordenadas difuminadas a ~45m y descripción sanitizada. Se notifica con Sonner y se conmuta automáticamente la vista a `MAPA` o `MURO`, mostrando el círculo sombreado rojo de 50 metros.
   - *Deducción para Simulación 3 (Bóveda PII + Log Local):*
     Para que funcione 100% offline ante el jurado, la simulación debe:
     a) Conmutar el rol activo a `BRIGADISTA_CERTIFICADO`.
     b) Revelar los datos confidenciales de la alerta SOS (Doña Gregoria Mayta, Jr. Puno 420 Huancayo, diagnóstico de EPOC severo, teléfono de contacto).
     c) Registrar la entrada en un log de auditoría local (con timestamp, nombre de brigadista, motivo y certificación Ley 29733) y renderizarlo inmediatamente en pantalla en un visualizador de auditoría forense.

3. **Premisa 3 (Ergonomía y Accesibilidad WCAG AAA):**
   - Todos los botones del widget del jurado (play, pause, reset, simulación 1, 2 y 3) y del selector de ubicación deben incluir la clase `min-h-[48px]` para cumplir la aserción de `tests/e2e-audit-mod13.test.ts`.

---

## 3. Caveats (Áreas no Investigadas, Supuestos y Riesgos)

1. **Persistencia en Navegadores en Modo Privado:**
   - Dexie.js (IndexedDB) puede operar en memoria en pestañas de incógnito de ciertos navegadores. Para asegurar la visibilidad del log de auditoría local ante el jurado, se recomienda mantener un estado en React sincronizado con IndexedDB y `localStorage`.
2. **Coordenadas de Huancayo vs Jesús María en Pruebas Unitarias:**
   - Las pruebas existentes (`views-mod12.test.ts`, `publish-map-mod11.test.ts`) pasan props `initialListings` e `initialPosts` con coordenadas de Jesús María. La lógica del mapa y catálogo debe calcular distancias tomando como referencia el centroide del sector activo (Huancayo por defecto para el usuario, o el centroide inferido de los datos pasados en props durante los tests).
3. **Dependencia de Red Externa:**
   - La demostración ante el jurado debe ser 100% autónoma; ninguna simulación puede fallar por falta de acceso a APIs externas de geolocalización o de IA en la nube. Todas las simulaciones deben utilizar las estrategias locales ya implementadas (`LocalHeuristicStrategy`, `localDb`).

---

## 4. Conclusion (Diagnóstico Final y Especificación de Implementación)

### 4.1. Catálogo de Semillas para Huancayo y Zonas Críticas (R1)
Se define el conjunto de datos semilla hiperrealistas para Huancayo (Junín) que cubrirá exactamente los casos del video de Mario Cortijo:

#### Presets Geográficos de Huancayo y Zonas Críticas
1. **Huancayo · El Tambo (Sector por Defecto):** Centroide `(-12.0528, -75.2155)`.
2. **Huancayo · San Carlos:** Centroide `(-12.0625, -75.2005)`.
3. **Huancayo · Centro Urbano (Plaza Constitución):** Centroide `(-12.0678, -75.2085)`.
4. **Zona Crítica Sismos · Falla Huaytapallana (Junín):** Centroide `(-12.0480, -75.1950)`.
5. **Zona Crítica El Niño · Desbordes Río Mantaro:** Centroide `(-12.0580, -75.2280)`.
6. **Lima · Jesús María Sector 4 (Compatibilidad):** Centroide `(-12.0752, -77.0485)`.

#### Casos Específicos de Mario Cortijo Modelados
- **Muro Solidario (Cero Dinero):**
  1. *Muletas ortopédicas gratis:* Vecino en Jr. Nemesio Ráez 420 (El Tambo) ofrece préstamo sin costo de muletas ortopédicas regulables y andador para rehabilitación.
  2. *Pool Escolar Solidario:* Padres verificados organizan carpooling rotativo matutino (7:20 a.m.) por Av. Huancavelica hacia el Colegio Mariscal Castilla.
- **Catálogo de Proximidad:**
  3. *Lasañas y postres caseros:* Vecina Gladys en Jr. Parra del Riego elabora lasañas artesanales de carne y espinaca recién horneadas y queque de plátano para el barrio.
  4. *Clases de matemáticas y nivelación:* Profesor Yuri en Jr. Sebastián Lorente brinda refuerzo escolar en álgebra y geometría.
  5. *Oficios técnicos:*
     - Maestro Teodoro (Gasfitería): Especialista en tuberías congeladas por heladas y bombas de agua en Av. Mariscal Castilla.
     - Técnico Wálter (Electricidad): Mantenimiento de tableros trifásicos y cortocircuitos.
     - Lic. Maritza (Enfermería comunitaria): Inyectables, nebulizaciones y soporte con balón de oxígeno 24/7.
- **Emergencias y Catástrofes:**
  6. *Punto de Acopio Solidario:* Coliseo Municipal de El Tambo (frazadas térmicas y bidones de agua de 20L).
  7. *Alerta SOS Oxígeno:* Adulto mayor electrodependiente en Jr. Puno 420 Huancayo requiere recarga urgente de oxígeno con coordenadas difuminadas a 50m y PII en bóveda.
  8. *Brigada y Punto de Encuentro:* Brigada de Defensa Civil El Tambo en Parque Bolognesi con camillas y radios VHF ante sismos de la Falla Huaytapallana.
  9. *Fenómeno El Niño:* Puesto de distribución comunitaria de sacos de arena y motobombas en la ribera del Mantaro.

---

### 4.2. Especificación del Widget "Modo Presentación Jurado (Pitch 3 Minutos)" (R4)

Se estructurará como un componente flotante interactivo `<PitchJuryPanel />` integrado en `AppShell`:

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 PITCH JURADO (3 MIN) · [ 02:45 ] ─────── [ Minimizar ]  │
├─────────────────────────────────────────────────────────────┤
│ CRONÓMETRO REGRESIVO                                       │
│ [ 02:45 ] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━░ 180s               │
│ [ ▶ Iniciar ]       [ ⏸ Pausar ]       [ 🔄 Reiniciar ]    │
├─────────────────────────────────────────────────────────────┤
│ SIMULACIONES EN VIVO (EVALUACIÓN 1:1)                      │
│ 1. [ ✈ Simular Caída de Red (Modo Avión 1 Clic) ]         │
│    -> syncManager.setOnlineStatus(!isOnline)                │
│ 2. [ 🚨 Simular Alerta SOS por Voz (50m Blur) ]            │
│    -> Inserta SOS en Dexie con 50m privacy radius y toast  │
│ 3. [ 🔓 Desbloquear Bóveda PII (Brigadista + Log) ]         │
│    -> Revela PII + Inserta registro en Audit Log Local     │
├─────────────────────────────────────────────────────────────┤
│ 📋 REGISTRO DE AUDITORÍA FORENSE LOCAL (Ley N° 29733)       │
│ • [12:28:15] Brigadista Dr. Huamán desbloqueó Post SOS #2   │
│   Motivo: "Despacho inmediato de oxígeno medicinal 10m3"   │
└─────────────────────────────────────────────────────────────┘
```

- **Requisitos de Accesibilidad del Panel:**
  - Botón disparador flotante de `min-h-[48px]` con contraste AAA.
  - Cada botón interno con altura táctil mínima `min-h-[48px]`.
  - Cronómetro de alta visibilidad con transiciones de color verde $\rightarrow$ amarillo $\rightarrow$ rojo pulsante.
  - Registro de auditoría local visible en tiempo real que demuestra cumplimiento estricto de la Ley N° 29733.

---

## 5. Verification Method (Método de Verificación Independiente)

Para comprobar de forma rigurosa los hallazgos y validar la futura implementación:

1. **Ejecutar Suite de Pruebas de Línea Base:**
   ```powershell
   Set-Location "C:\Users\hugoc\OneDrive\Documentos\hackaton"
   npm test
   ```
   *Criterio:* Los 13 archivos de prueba deben completarse con 63/63 tests aprobados.

2. **Verificar Compilación TypeScript:**
   ```powershell
   Set-Location "C:\Users\hugoc\OneDrive\Documentos\hackaton"
   npm run typecheck
   ```
   *Criterio:* 0 errores en `tsc --noEmit`.

3. **Verificación de Auditoría WCAG AAA en Nuevos Componentes:**
   - Ejecutar `tests/e2e-audit-mod13.test.ts`. Todos los botones del panel del jurado y selector de ubicación deben satisfacer `min-h-[48px]`.

4. **Verificación Funcional R1:**
   - La cabecera muestra el selector de territorio con "Huancayo · El Tambo" activo por defecto.
   - Al seleccionar "Huancayo · El Tambo", el catálogo muestra las lasañas de Gladys, clases de Yuri, gasfitería de Teodoro y préstamo de muletas.
   - El cambio de sector actualiza inmediatamente el catálogo y el mapa con las coordenadas correspondientes.

5. **Verificación Funcional R4:**
   - El widget de pitch se despliega en pantalla y el cronómetro de 180s corre y se pausa adecuadamente.
   - El clic en "Simular Modo Avión" alterna el estado a "Sin red" sin recargar la página.
   - El clic en "Simular Alerta SOS" crea el post con difuminado de 50 metros en el mapa.
   - El clic en "Desbloquear Bóveda PII" revela los datos protegidos y agrega un registro inmediato al log de auditoría local.
