-- ============================================================================
-- @file src/database/migrations/001_initial_enterprise_schema.sql
-- @description Capa 1 (MOD-02) — Esquema Físico Empresarial Normalizado (3FN/BCNF)
-- Compatible con PostgreSQL 16/17 Local y Supabase Cloud.
-- ============================================================================

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN
    -- En PostgreSQL 13+ (16/17), gen_random_uuid() es nativo del core sin requerir pgcrypto externo
    NULL;
END
$$;

-- ============================================================================
-- 1. Tabla: district (Jurisdicción Distrital por Código UBIGEO Oficial)
-- ============================================================================
CREATE TABLE IF NOT EXISTS district (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ubigeo_code VARCHAR(6) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    province TEXT NOT NULL DEFAULT 'Lima',
    department TEXT NOT NULL DEFAULT 'Lima',
    emergency_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_district_ubigeo ON district(ubigeo_code);

-- ============================================================================
-- 2. Tabla: neighborhood_sector (Sectores y Cuadrantes Barriales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS neighborhood_sector (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_id BIGINT NOT NULL REFERENCES district(id) ON DELETE RESTRICT,
    sector_code VARCHAR(20) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL CHECK (center_lat BETWEEN -90 AND 90),
    center_lng DOUBLE PRECISION NOT NULL CHECK (center_lng BETWEEN -180 AND 180),
    radius_meters INT NOT NULL DEFAULT 1000 CHECK (radius_meters > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sector_district ON neighborhood_sector(district_id);

-- ============================================================================
-- 3. Tabla: user_profile (Perfiles Vecinales, Especialistas y Brigadistas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profile (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    sector_id BIGINT NOT NULL REFERENCES neighborhood_sector(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    email TEXT UNIQUE,
    home_lat DOUBLE PRECISION NOT NULL CHECK (home_lat BETWEEN -90 AND 90),
    home_lng DOUBLE PRECISION NOT NULL CHECK (home_lng BETWEEN -180 AND 180),
    is_verified_neighbor BOOLEAN NOT NULL DEFAULT FALSE,
    verification_method TEXT NOT NULL DEFAULT 'SMS_GEO'
        CHECK (verification_method IN ('SMS_GEO', 'PADRON_JUNTA', 'MUNICIPAL', 'PENDIENTE')),
    system_role TEXT NOT NULL DEFAULT 'VECINO'
        CHECK (system_role IN ('VECINO', 'BRIGADISTA_CERTIFICADO', 'LIDER_VECINAL', 'OPERADOR_MUNICIPAL')),
    reputation_points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sector ON user_profile(sector_id);
CREATE INDEX IF NOT EXISTS idx_user_role_verif ON user_profile(system_role, is_verified_neighbor);

-- ============================================================================
-- 4. Tabla: support_group (Grupos de Apoyo y Brigadas Comunitarias - Brecha B-02)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_group (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    sector_id BIGINT NOT NULL REFERENCES neighborhood_sector(id) ON DELETE RESTRICT,
    coordinator_user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    group_type TEXT NOT NULL CHECK (group_type IN (
        'BRIGADA_DEFENSA_CIVIL',
        'JUNTA_VECINAL_SEGURIDAD',
        'COMEDOR_OLLA_COMUN',
        'VOLUNTARIADO_SALUD',
        'PUNTO_ACOPIO_BARRIAL'
    )),
    description TEXT NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    meeting_point_lat DOUBLE PRECISION NOT NULL CHECK (meeting_point_lat BETWEEN -90 AND 90),
    meeting_point_lng DOUBLE PRECISION NOT NULL CHECK (meeting_point_lng BETWEEN -180 AND 180),
    meeting_point_address TEXT NOT NULL,
    operational_status TEXT NOT NULL DEFAULT 'ACTIVO'
        CHECK (operational_status IN ('ACTIVO', 'DESPLEGADO_EMERGENCIA', 'INACTIVO')),
    is_verified_by_municipality BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_group_sector ON support_group(sector_id);
CREATE INDEX IF NOT EXISTS idx_support_group_coordinator ON support_group(coordinator_user_id);

-- ============================================================================
-- 5. Tabla: support_group_member (Relación N:M Vecinos <-> Grupos de Apoyo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_group_member (
    group_id BIGINT NOT NULL REFERENCES support_group(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
    member_role TEXT NOT NULL DEFAULT 'VOLUNTARIO'
        CHECK (member_role IN ('COORDINADOR', 'PRIMEROS_AUXILIOS', 'RESCATE_TECNICO', 'LOGISTICA', 'VOLUNTARIO')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_member_user ON support_group_member(user_id);

-- ============================================================================
-- 6. Tabla: category_catalog (Taxonomía Maestra 2FN/3FN)
-- ============================================================================
CREATE TABLE IF NOT EXISTS category_catalog (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    module_scope TEXT NOT NULL CHECK (module_scope IN ('ECONOMIA_LOCAL', 'ECONOMIA_SOLIDARIA', 'AMBOS')),
    is_emergency_critical BOOLEAN NOT NULL DEFAULT FALSE,
    priority_weight SMALLINT NOT NULL DEFAULT 1 CHECK (priority_weight BETWEEN 1 AND 10),
    icon_name VARCHAR(40) NOT NULL DEFAULT 'wrench',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. Tabla: proximity_listing (Módulo 1: Oficios, Productos y Soporte Local)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proximity_listing (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_mutation_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    owner_user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE RESTRICT,
    support_group_id BIGINT REFERENCES support_group(id) ON DELETE SET NULL,
    sector_id BIGINT NOT NULL REFERENCES neighborhood_sector(id) ON DELETE RESTRICT,
    category_id BIGINT NOT NULL REFERENCES category_catalog(id) ON DELETE RESTRICT,
    listing_type TEXT NOT NULL CHECK (listing_type IN ('SERVICIO_OFICIO', 'PRODUCTO_LOCAL', 'SOPORTE_EMERGENCIA')),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    available_for_emergencies BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_response_note TEXT,
    endorsement_count INT NOT NULL DEFAULT 0 CHECK (endorsement_count >= 0),
    weighted_trust_score NUMERIC(8,2) NOT NULL DEFAULT 0.00 CHECK (weighted_trust_score >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_owner ON proximity_listing(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_listing_support_group ON proximity_listing(support_group_id);
CREATE INDEX IF NOT EXISTS idx_listing_category ON proximity_listing(category_id);
CREATE INDEX IF NOT EXISTS idx_listing_sector_cat
    ON proximity_listing(sector_id, category_id)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_listing_emergency
    ON proximity_listing(sector_id, weighted_trust_score DESC)
    WHERE is_active = TRUE AND available_for_emergencies = TRUE;

-- ============================================================================
-- 8. Tabla: neighbor_endorsement (Visto Bueno Vecinal Ponderado - RN-02 / RN-03)
-- ============================================================================
CREATE TABLE IF NOT EXISTS neighbor_endorsement (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_mutation_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    listing_id BIGINT NOT NULL REFERENCES proximity_listing(id) ON DELETE CASCADE,
    endorser_user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE RESTRICT,
    distance_meters INT NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
    proximity_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (proximity_weight IN (1.50, 1.00, 0.30)),
    comment VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_endorsement_listing_user UNIQUE (listing_id, endorser_user_id)
);
CREATE INDEX IF NOT EXISTS idx_endorsement_listing ON neighbor_endorsement(listing_id);
CREATE INDEX IF NOT EXISTS idx_endorsement_user ON neighbor_endorsement(endorser_user_id);

-- ============================================================================
-- 9. Tabla: community_post (Módulo 2: Cadena de Favores y Tablero Humanitario SOS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_post (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_mutation_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    author_user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE RESTRICT,
    sector_id BIGINT NOT NULL REFERENCES neighborhood_sector(id) ON DELETE RESTRICT,
    category_id BIGINT NOT NULL REFERENCES category_catalog(id) ON DELETE RESTRICT,
    operational_mode TEXT NOT NULL CHECK (operational_mode IN ('HABITUAL', 'EMERGENCIA')),
    post_type TEXT NOT NULL CHECK (post_type IN ('OFERTA_FAVOR', 'SOLICITUD_FAVOR', 'SOS_VULNERABLE', 'RECURSO_SOLIDARIO')),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    urgency_level TEXT NOT NULL DEFAULT 'MEDIA' CHECK (urgency_level IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
    public_lat DOUBLE PRECISION NOT NULL CHECK (public_lat BETWEEN -90 AND 90),
    public_lng DOUBLE PRECISION NOT NULL CHECK (public_lng BETWEEN -180 AND 180),
    privacy_radius_meters INT NOT NULL DEFAULT 0 CHECK (privacy_radius_meters >= 0),
    status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'EN_COORDINACION', 'ATENDIDO', 'CERRADO')),
    ai_triaged BOOLEAN NOT NULL DEFAULT FALSE,
    has_monetary_intent BOOLEAN NOT NULL DEFAULT FALSE,
    zero_money_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    client_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Invariante RN-01: Cero Dinero absoluto en Cadena de Favores
    CONSTRAINT chk_cero_dinero_favores CHECK (
        (post_type NOT IN ('OFERTA_FAVOR', 'SOLICITUD_FAVOR')) OR
        (zero_money_compliant = TRUE AND has_monetary_intent = FALSE)
    ),
    CONSTRAINT chk_no_monetary_terms_in_favors CHECK (
        post_type NOT IN ('OFERTA_FAVOR', 'SOLICITUD_FAVOR') OR (
            description !~* '(\y(?:s/|soles|so|lucas|mangos|ferros|morlacos|chanchita|efectivo|yape|plin|bcp|interbank|propina|honorarios|remuneraci[oó]n|d[oó]lares|usd)\y)'
            AND title !~* '(\y(?:s/|soles|so|lucas|mangos|ferros|morlacos|chanchita|efectivo|yape|plin|bcp|interbank|propina|honorarios|remuneraci[oó]n|d[oó]lares|usd)\y)'
        )
    )
);
CREATE INDEX IF NOT EXISTS idx_post_author ON community_post(author_user_id);
CREATE INDEX IF NOT EXISTS idx_post_category ON community_post(category_id);
CREATE INDEX IF NOT EXISTS idx_post_feed
    ON community_post(sector_id, operational_mode, urgency_level, created_at DESC)
    WHERE status IN ('ACTIVO', 'EN_COORDINACION');

-- ============================================================================
-- 10. Tabla: post_sensitive_pii (Particionamiento 1:1 Bóveda PII - Ley N° 29733)
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_sensitive_pii (
    post_id BIGINT PRIMARY KEY REFERENCES community_post(id) ON DELETE CASCADE,
    exact_lat DOUBLE PRECISION NOT NULL CHECK (exact_lat BETWEEN -90 AND 90),
    exact_lng DOUBLE PRECISION NOT NULL CHECK (exact_lng BETWEEN -180 AND 180),
    exact_address_reference TEXT NOT NULL,
    vulnerable_person_name TEXT,
    medical_or_mobility_notes TEXT,
    emergency_contact_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. Tabla: pii_access_audit_log (Auditoría Forense Inmutable - RN-05)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pii_access_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES post_sensitive_pii(post_id) ON DELETE RESTRICT,
    accessed_by_user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE RESTRICT,
    access_reason TEXT NOT NULL,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pii_audit_post ON pii_access_audit_log(post_id);
CREATE INDEX IF NOT EXISTS idx_pii_audit_user ON pii_access_audit_log(accessed_by_user_id);

-- ============================================================================
-- 12. Tabla: post_resource_item (Ítems Cuantificables de Recursos 1FN - RN-08)
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_resource_item (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_mutation_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    post_id BIGINT NOT NULL REFERENCES community_post(id) ON DELETE CASCADE,
    item_name VARCHAR(80) NOT NULL,
    unit_measure VARCHAR(20) NOT NULL DEFAULT 'UNIDAD',
    quantity_needed NUMERIC(8,2) NOT NULL CHECK (quantity_needed > 0),
    quantity_committed NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (quantity_committed >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_item_post ON post_resource_item(post_id);
CREATE INDEX IF NOT EXISTS idx_resource_item_mutation ON post_resource_item(client_mutation_id);

-- ============================================================================
-- 13. Tabla: resource_commitment (Compromisos Vecinales de Ayuda y Recursos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_commitment (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_mutation_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    post_id BIGINT NOT NULL REFERENCES community_post(id) ON DELETE RESTRICT,
    resource_item_id BIGINT REFERENCES post_resource_item(id) ON DELETE SET NULL,
    post_client_mutation_id UUID REFERENCES community_post(client_mutation_id) ON DELETE RESTRICT,
    resource_item_client_mutation_id UUID REFERENCES post_resource_item(client_mutation_id) ON DELETE SET NULL,
    helper_user_id BIGINT NOT NULL REFERENCES user_profile(id) ON DELETE RESTRICT,
    support_group_id BIGINT REFERENCES support_group(id) ON DELETE SET NULL,
    committed_quantity NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (committed_quantity > 0),
    commitment_note VARCHAR(250) NOT NULL,
    status TEXT NOT NULL DEFAULT 'EN_CAMINO'
        CHECK (status IN ('COMPROMETIDO', 'EN_CAMINO', 'ENTREGADO_VERIFICADO', 'CANCELADO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commitment_post ON resource_commitment(post_id);
CREATE INDEX IF NOT EXISTS idx_commitment_resource_item ON resource_commitment(resource_item_id);
CREATE INDEX IF NOT EXISTS idx_commitment_helper ON resource_commitment(helper_user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_support_group ON resource_commitment(support_group_id);
