# RedVecina — Plataforma Hiperlocal de Resiliencia Barrial
> **Hackathon UTP – El Comercio** | Lima & Huancayo

RedVecina es una aplicación móvil hiperlocal, **Offline-First**, diseñada para operar tanto en condiciones normales como ante colapsos de infraestructura (sismos, huaicos o cortes de internet), garantizando acceso inmediato al mapa y al SOS sin pedir registro ni conexión.

---

## 1. Principio Honesto: Protocolo de Confirmación P2P Bilateral (Sin Cuenta)

Ninguna pantalla afirma más de lo que sabe. No se declara una entrega como "entregado" si solo lo afirmó una persona. Se utiliza un protocolo criptográfico bilateral entre dispositivos:

```mermaid
sequenceDiagram
    autonumber
    actor Solicitante as Vecino Solicitante (Dispositivo A)
    actor Voluntario as Vecino Voluntario (Dispositivo B)
    participant Protocolo as WebCrypto & HMAC-SHA256
    participant Sync as Cola Offline / API /api/v1/sync

    Solicitante->>Protocolo: 1. Publica necesidad (ej. 5 bidones de agua)
    Voluntario->>Protocolo: 2. Toca "Quiero ayudar" (Se crea compromiso + secreto P2P)
    Protocolo-->>Solicitante: 3. Código 4 dígitos = HMAC(secreto, commitment_id, epoch24h)
    Note over Solicitante,Voluntario: Entrega física en el barrio
    Solicitante->>Voluntario: 4. Muestra verbalmente/en pantalla el código de 4 dígitos
    Voluntario->>Protocolo: 5. Escribe código y pulsa "Ya entregué"
    Solicitante->>Protocolo: 6. Pulsa "Ya recibí"
    Protocolo->>Sync: 7. Ambos dispositivos confirman con claves distintas -> "Confirmado por ambos"
```

### Reglas Anti-Abuso Implementadas
1. **Identidad Criptográfica de Dispositivo:** Generada en `WebCrypto` (`crypto.subtle`) sin solicitar nombre, teléfono ni correo.
2. **Diferenciación Estricta:** Un dispositivo no puede confirmarse a sí mismo (`requester_device_id !== helper_device_id`).
3. **Control de Fuerza Bruta:** Máximo 5 intentos fallidos de código por compromiso; al 5to intento se bloquea preventivamente por 15 minutos.
4. **Rotación Determinista:** El código de 4 dígitos rota automáticamente cada 24 horas.
5. **Independencia Métricas:** El conteo de la dona circular refleja los compromisos vecinales; la insignia *"Confirmado por ambos"* refleja la verificación criptográfica bilateral.

---

## 2. Verificación Opcional con DNI (Ley N° 29733)

- **100% Voluntaria:** Nunca bloquea el uso de la app, el botón SOS ni la consulta del mapa.
- **Privacidad Absoluta:** El DNI completo **nunca se almacena en texto plano ni se expone a otros vecinos**. Solo se guarda un hash irreversible `SHA-256(DNI + SALT)`.
- **Proveedor Desacoplado (`DniProvider`):** Arquitectura con adaptadores intercambiables (`apis.net.pe`, `apiperu.dev` o `mock`). El token vive exclusivamente en variables de entorno del servidor.
- **Insignia Comunitaria:** Otorga el distintivo *"Vecino verificado"* con la aclaración: *"Sus datos de DNI fueron validados. No incluye verificación facial"*.
- *Nota de mejora futura:* Arquitectura preparada para verificación biométrica facial (selfie en vivo + foto de DNI).

---

## 3. Variables de Entorno

Crear un archivo `.env` o `.env.local` en la raíz del proyecto:

```env
# Puerto y Entorno
PORT=3000
NODE_ENV=development

# Base de Datos PostgreSQL (Local o Supabase Cloud)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redvecina
DB_POOL_MAX=10

# Proveedor de DNI (apis.net.pe / apiperu.dev)
DNI_PROVIDER_API_KEY=tu_token_aqui
DNI_SALT=redvecina_secure_dni_salt_2026
```

---

## 4. Cómo Ejecutar

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo Next.js
npm run dev

# 3. Ejecutar suite de pruebas (29 archivos, 327 pruebas)
node --single-threaded ./node_modules/vitest/vitest.mjs run

# 4. Verificación de TypeScript
npx tsc --noEmit
```

---

## 5. Endpoints REST (`/api/v1`)

| Endpoint | Método | Descripción |
| :--- | :---: | :--- |
| `/api/v1/devices` | `POST` | Registra clave pública de dispositivo anónimo. |
| `/api/v1/needs` | `GET` / `POST` | Publica y consulta necesidades con ubicación aproximada (difuminado 50m). |
| `/api/v1/commitments` | `POST` | Crea compromiso solidario y secreto compartido P2P. |
| `/api/v1/commitments/:id/deliver` | `POST` | Valida código HMAC de 4 dígitos y registra entrega por el voluntario. |
| `/api/v1/commitments/:id/receive` | `POST` | Registra recepción por el solicitante; confirma si ambos validaron. |
| `/api/v1/sync` | `POST` | Sincronización offline en lote con deduplicación e idempotencia. |
| `/api/v1/identity/verify-dni` | `POST` | Validación con cotejo de padrón oficial y hasheo irreversible. |
