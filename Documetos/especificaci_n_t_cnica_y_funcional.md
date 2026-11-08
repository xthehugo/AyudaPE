# SPEC.md: Especificación Funcional, Técnica y de Negocio
**Proyecto:** RedVecina (Plataforma Hiperlocal y Resiliente de Economía Vecinal y Ayuda Humanitaria)  
**Marco:** Hackathon UTP – El Comercio  
**Modalidad:** Mobile-First / PWA (Online & Offline)  
**Estado:** Borrador Inicial de Especificación (v1.0)

---

## 1. Visión del Producto y Contexto Institucional

### 1.1 Declaración del Problema
Los barrios urbanos carecen de canales digitales confiables para activar su economía de proximidad (gasfitería, cerrajería, trueque de habilidades y herramientas). Cuando ocurre una emergencia o catástrofe climática/social, las redes comerciales fallan y las aplicaciones convencionales quedan inutilizadas por falta de conectividad o desactualización, dejando a los vecinos vulnerables aislados y sin acceso a recursos críticos.

### 1.2 La Solución: Arquitectura de Estado Dual
**RedVecina** es una plataforma vecinal hiperlocal que opera de manera dual:
1. **Modo Día a Día (Economía Local y Solidaria):** Conecta a vecinos con trabajadores locales respaldados por un sistema de *"Visto Bueno Vecinal"* (reputación social verificada) y facilita una *"Cadena de Favores"* para resolver necesidades cotidianas sin dinero.
2. **Modo Emergencia (Soporte Humanitario y Coordinación Crítica):** Al activarse, la interfaz prioriza el mapa de calor humanitario, el reporte geolocalizado de personas vulnerables (ancianos, personas con movilidad reducida) y el racionamiento/compartición de recursos vitales (agua, botiquines, generadores).

### 1.3 Propuesta de Valor Institucional y Viabilidad Empresarial
* **Para el Grupo El Comercio:** Canal de vinculación comunitaria y reportería hiperlocal ciudadana, con posibilidad de suscripciones patrocinadas y pauta de anunciantes zonales.
* **Para Municipalidades y Defensa Civil (B2G):** Panel de control geolocalizado en tiempo real para visualizar zonas críticas durante desastres, optimizar rutas de brigadistas y formalizar oficios barriales.
* **Sostenibilidad Económica:** Modelo *Freemium* para comercios y servicios locales (destacados barriales) y licencias anuales de gestión de riesgo de desastres para gobiernos distritales.

---

## 2. Requerimientos Funcionales (RF)

### RF-01: Alternancia de Estado Dual (Barrio vs. Emergencia SOS)
* El sistema debe contar con un conmutador de modo accesible en la barra superior.
* **Modo Habitual (Día a Día):** Paleta visual cálida (azul/verde/neutro), enfocado en comercio local y favores.
* **Modo Emergencia:** Paleta de alto contraste (rojo/ámbar/oscuro), bloquea publicaciones no críticas, reordena la interfaz hacia el tablero humanitario y activa el mapa de auxilio.

### RF-02: Directorio de Oficios y "Visto Bueno Vecinal"
* Listado y filtrado geolocalizado de servicios por categoría (Gasfitería, Electricidad, Cerrajería, Paseo de mascotas, Cuidado de adultos, etc.).
* Sistema de **Visto Bueno Vecinal:** Las recomendaciones solo pueden ser otorgadas por vecinos confirmados en un radio geográfico específico, mostrando insignias de confianza comunitaria.
* Filtro especial: *"Disponible para soporte en emergencias"* (profesionales que voluntariamente apoyan en catástrofes).

### RF-03: Cadena de Favores & Economía Solidaria (Sin Dinero)
* Tablero colaborativo para publicaciones de tipo:
  * Préstamo de herramientas.
  * Intercambio de habilidades / clases.
  * Donación de materiales en desuso.
  * Movilidad solidaria (compartir viajes).
* Regla estricta: No se permite fijar precios monetarios en este módulo; se promueve el trueque o la ayuda altruista.

### RF-04: Tablero de Ayuda Humanitaria y Reportes de Vulnerabilidad
* Activado automáticamente en **Modo Emergencia**.
* Registro de personas o familias en estado de vulnerabilidad (ej. "Adulto mayor solo en piso 4 sin agua", "Bebé necesita leche especializada").
* Registro de centros o vecinos con recursos críticos compartibles (puntos de recarga de batería, bidones de agua, botiquín).
* Geolocalización precisa con radio de proximidad visual en el mapa.

### RF-05: Publicación Rápida con IA en Máximo 3 Clics
* Cumplimiento estricto de la regla de los 3 clics:
  * **Paso 1 (Entrada de Voz o Texto):** El usuario graba una nota de voz o escribe: *"Necesito que me presten una escalera tijera en Calle Lima"*.
  * **Procesamiento de IA (Background):** Un agente extrae automáticamente:
    * `tipo`: `SOLICITUD_FAVOR`
    * `categoria`: `Herramientas`
    * `item`: `Escalera tijera`
    * `urgencia`: `Media`
  * **Paso 2 (Ubicación/Foto):** Confirmación automática por GPS del dispositivo o selección de 1 toque.
  * **Paso 3 (Publicar):** Botón grande de consolidación.

### RF-06: Funcionalidad Resiliente Online / Offline
* La aplicación debe funcionar como **Progressive Web App (PWA)** instalable.
* **Modo Offline:**
  * Uso de Service Workers para servir la interfaz estática sin conexión.
  * Almacenamiento local mediante IndexedDB (`Dexie.js`) para persistir el último estado conocido del mapa, teléfonos de emergencia y directorio vecinal.
  * Cola de sincronización local: Las publicaciones creadas sin internet se encolan con marca de tiempo y se sincronizan automáticamente al recuperar la red (*Background Sync*).

### RF-07: Onboarding y Tutorial de Accesibilidad Universal
* Primer inicio: Tour guiado e interactivo de 3 pantallas con lenguaje claro para personas adultas mayores.
* Modos visuales de texto aumentado y botones táctiles de mínimo 48x48 px.

---

## 3. Requerimientos No Funcionales y Seguridad (RNF)

* **RNF-01 (Rendimiento):** Tiempo de carga interactivo (TTI) menor a 1.5 segundos en redes móviles 3G/4G.
* **RNF-02 (Privacidad de Datos y PII):** Las publicaciones de vecinos vulnerables en emergencias no revelan el nombre completo ni el piso/departamento exacto en la vista pública general; solo muestran la manzana y un radio de 50 metros. La dirección exacta solo se desbloquea para brigadistas y vecinos verificados.
* **RNF-03 (Sanitización y Validación):** Todos los ingresos de datos (especialmente los parseados por IA) deben validarse en el backend con esquemas Zod estrictos para prevenir inyecciones XSS y manipulaciones de estado.
* **RNF-04 (Fallback de IA):** Si la API de IA no responde o no hay internet, la aplicación debe presentar un formulario simple con 3 selects desplegables tradicionales sin bloquear al usuario.

---

## 4. Arquitectura y Stack Tecnológico

```
┌────────────────────────────────────────────────────────┐
│                   Cliente PWA Móvil                    │
│   (Next.js App Router + Tailwind CSS + shadcn/ui)      │
│   - Service Worker & Cache Storage                     │
│   - IndexedDB (Dexie.js) para almacenamiento offline   │
│   - Mapa interactivo: React-Leaflet / OpenStreetMap    │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       (Online HTTPS / WSS)       (Offline Queue)
                │                        │
                ▼                        ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│       Backend & APIs          │ │ Sync Manager Local   │
│ (Next.js Server Actions/Hono) │ │ (Dispara al volver)  │
└───────┬───────────────┬───────┘ └──────────────────────┘
        │               │
        ▼               ▼
┌──────────────┐ ┌───────────────────────────────────────┐
│ Supabase DB  │ │         Orquestación de IA            │
│ (PostgreSQL  │ │  (Vercel AI SDK + OpenAI/Claude/Gemini│
│  + PostGIS)  │ │   Structured Outputs con Zod)         │
└──────────────┘ └───────────────────────────────────────┘
```

---

## 5. Esquema de Base de Datos (PostgreSQL DDL)

```sql
-- 1. Usuarios / Perfiles Barriales
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    neighborhood_sector TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_verified_neighbor BOOLEAN DEFAULT FALSE,
    is_emergency_volunteer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Servicios de Proximidad (Oficios)
CREATE TABLE local_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- Gasfitería, Electricidad, Cuidado, etc.
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    phone_contact TEXT,
    available_for_emergencies BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Visto Bueno Vecinal (Endorsements)
CREATE TABLE endorsements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES local_services(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_endorsement_per_neighbor UNIQUE (service_id, author_id)
);

-- 4. Muro Solidario & Reportes de Emergencia SOS
CREATE TABLE community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('HABITUAL', 'EMERGENCIA')),
    post_type TEXT NOT NULL CHECK (post_type IN ('OFERTA_FAVOR', 'NECESIDAD_FAVOR', 'SOS_VULNERABLE', 'RECURSO_CRITICO')),
    category TEXT NOT NULL, -- Herramientas, Alimentos, Agua, Salud, Movilidad
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'ATENDIDO', 'CERRADO')),
    client_created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Criterios de Aceptación Verificables (DoD - Definition of Done)

* [ ] **CA-01 (Modo Dual):** Un interruptor en la cabecera conmuta el estado global de la app entre `HABITUAL` y `EMERGENCIA`, transformando el tema visual y los marcadores del mapa en menos de 100 ms.
* [ ] **CA-02 (Directorio y Visto Bueno):** Cada tarjeta de servicio muestra el contador de "Vistos Buenos" y solo permite calificar si el usuario ha iniciado sesión.
* [ ] **CA-03 (Publicación en 3 Clics con IA):** Al ingresar un texto libre en el modal de publicación, el endpoint de IA devuelve un JSON estructurado con `categoria`, `tipo` y `resumen`, rellenando el formulario en menos de 1.2 segundos.
* [ ] **CA-04 (Prueba Offline):** Al desconectar la red en el panel de inspección del navegador (Network Offline), el usuario puede navegar el directorio cacheado, abrir el mapa de recursos y redactar un reporte que queda guardado localmente con un estado visual "Pendiente de sincronización".
* [ ] **CA-05 (Tutorial):** El usuario nuevo visualiza un modal instructivo paso a paso con opción de "Omitir" o "Completar", guardando la preferencia en `localStorage`.