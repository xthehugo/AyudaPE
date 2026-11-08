-- ============================================================================
-- @file src/database/migrations/002_functions_and_triggers.sql
-- @description Capa 1 (MOD-02) — Funciones Geodésicas Haversine, Triggers ACID
-- de Reputación Vecinal y Políticas Row Level Security (RLS - Ley N° 29733).
-- Compatible con PostgreSQL 16/17 Local y Supabase Cloud.
-- ============================================================================

-- ============================================================================
-- SHIM DE COMPATIBILIDAD PARA POSTGRESQL LOCAL Y SUPABASE CLOUD
-- Garantiza que auth.uid() y los roles anon / authenticated existan al ejecutar
-- el script en una instancia local limpia de PostgreSQL 16/17.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
DECLARE
    v_sub TEXT;
BEGIN
    v_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
    IF v_sub IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN v_sub::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END
$$;

-- ============================================================================
-- 1. FUNCIÓN GEODÉSICA HAVERSINE PURA (PL/pgSQL)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_distance_meters(
    lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS INT AS $$
DECLARE
    earth_radius CONSTANT DOUBLE PRECISION := 6371000;
    dlat DOUBLE PRECISION := radians(lat2 - lat1);
    dlng DOUBLE PRECISION := radians(lng2 - lng1);
    a DOUBLE PRECISION;
BEGIN
    a := sin(dlat / 2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2)^2;
    RETURN ROUND(earth_radius * 2 * asin(sqrt(LEAST(1.0, GREATEST(0.0, a)))))::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- ============================================================================
-- 2. TRIGGERS TRANSACCIONALES ACID PARA "VISTO BUENO VECINAL" (RN-02 / RN-03)
-- ============================================================================

-- 2.1 Validación Anti-Autovoto y Cálculo Geodésico de Peso (BEFORE INSERT)
CREATE OR REPLACE FUNCTION fn_validate_and_weigh_endorsement()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id BIGINT;
    v_listing_lat DOUBLE PRECISION;
    v_listing_lng DOUBLE PRECISION;
    v_endorser_lat DOUBLE PRECISION;
    v_endorser_lng DOUBLE PRECISION;
    v_endorser_verified BOOLEAN;
    v_distance INT;
BEGIN
    SELECT owner_user_id, latitude, longitude
      INTO v_owner_id, v_listing_lat, v_listing_lng
      FROM proximity_listing
     WHERE id = NEW.listing_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'ENTIDAD_NO_ENCONTRADA: El servicio o producto indicado no existe.';
    END IF;

    -- RN-03: Bloqueo estricto de auto-recomendación
    IF v_owner_id = NEW.endorser_user_id THEN
        RAISE EXCEPTION 'VIOLACION_INTEGRIDAD: Un usuario no puede emitir Visto Bueno a su propia publicación.';
    END IF;

    SELECT home_lat, home_lng, is_verified_neighbor
      INTO v_endorser_lat, v_endorser_lng, v_endorser_verified
      FROM user_profile
     WHERE id = NEW.endorser_user_id;

    IF v_endorser_lat IS NULL THEN
        RAISE EXCEPTION 'ENTIDAD_NO_ENCONTRADA: El perfil del vecino recomendador no existe.';
    END IF;

    -- RN-02: Cálculo geodésico Haversine en metros y asignación de peso barrial
    v_distance := fn_calculate_distance_meters(v_listing_lat, v_listing_lng, v_endorser_lat, v_endorser_lng);
    NEW.distance_meters := v_distance;

    IF v_endorser_verified AND v_distance <= 500 THEN
        NEW.proximity_weight := 1.50;
    ELSIF v_distance <= 1500 THEN
        NEW.proximity_weight := 1.00;
    ELSE
        NEW.proximity_weight := 0.30;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_insert_weigh_endorsement ON neighbor_endorsement;
CREATE TRIGGER trg_before_insert_weigh_endorsement
BEFORE INSERT ON neighbor_endorsement
FOR EACH ROW EXECUTE FUNCTION fn_validate_and_weigh_endorsement();

-- 2.2 Acumulación Atómica Idempotente (AFTER INSERT)
-- Se dispara solo cuando la fila fue efectivamente insertada (protege ante ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION fn_accumulate_endorsement()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE proximity_listing
       SET endorsement_count = endorsement_count + 1,
           weighted_trust_score = weighted_trust_score + NEW.proximity_weight,
           updated_at = NOW()
     WHERE id = NEW.listing_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_insert_accumulate_endorsement ON neighbor_endorsement;
CREATE TRIGGER trg_after_insert_accumulate_endorsement
AFTER INSERT ON neighbor_endorsement
FOR EACH ROW EXECUTE FUNCTION fn_accumulate_endorsement();

-- 2.3 Reversión Atómica ante Eliminación o Revocación (AFTER DELETE)
CREATE OR REPLACE FUNCTION fn_revert_endorsement()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE proximity_listing
       SET endorsement_count = GREATEST(0, endorsement_count - 1),
           weighted_trust_score = GREATEST(0.00, weighted_trust_score - OLD.proximity_weight),
           updated_at = NOW()
     WHERE id = OLD.listing_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_delete_revert_endorsement ON neighbor_endorsement;
CREATE TRIGGER trg_after_delete_revert_endorsement
AFTER DELETE ON neighbor_endorsement
FOR EACH ROW EXECUTE FUNCTION fn_revert_endorsement();

-- ============================================================================
-- 3. POLÍTICAS DE SEGURIDAD A NIVEL DE FILA (ROW LEVEL SECURITY - 13 TABLAS)
-- ============================================================================

-- 3.1 district & neighborhood_sector (Catálogos de lectura pública)
ALTER TABLE district ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_district_select ON district;
CREATE POLICY p_district_select ON district FOR SELECT USING (true);

ALTER TABLE neighborhood_sector ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_sector_select ON neighborhood_sector;
CREATE POLICY p_sector_select ON neighborhood_sector FOR SELECT USING (true);

-- 3.2 user_profile
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_user_profile_select ON user_profile;
CREATE POLICY p_user_profile_select ON user_profile FOR SELECT USING (true);

DROP POLICY IF EXISTS p_user_profile_update ON user_profile;
CREATE POLICY p_user_profile_update ON user_profile FOR UPDATE USING (
    auth.uid() = public_id OR
    id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT
);

-- 3.3 support_group & support_group_member
ALTER TABLE support_group ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_support_group_select ON support_group;
CREATE POLICY p_support_group_select ON support_group FOR SELECT USING (true);

DROP POLICY IF EXISTS p_support_group_write ON support_group;
CREATE POLICY p_support_group_write ON support_group FOR ALL USING (
    coordinator_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = coordinator_user_id AND public_id = auth.uid())
);

ALTER TABLE support_group_member ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_group_member_select ON support_group_member;
CREATE POLICY p_group_member_select ON support_group_member FOR SELECT USING (true);

DROP POLICY IF EXISTS p_group_member_write ON support_group_member;
CREATE POLICY p_group_member_write ON support_group_member FOR ALL USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = user_id AND public_id = auth.uid())
);

-- 3.4 category_catalog
ALTER TABLE category_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_category_select ON category_catalog;
CREATE POLICY p_category_select ON category_catalog FOR SELECT USING (true);

-- 3.5 proximity_listing
ALTER TABLE proximity_listing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_listing_select ON proximity_listing;
CREATE POLICY p_listing_select ON proximity_listing FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS p_listing_insert ON proximity_listing;
CREATE POLICY p_listing_insert ON proximity_listing FOR INSERT WITH CHECK (
    owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = owner_user_id AND public_id = auth.uid())
);

DROP POLICY IF EXISTS p_listing_update ON proximity_listing;
CREATE POLICY p_listing_update ON proximity_listing FOR UPDATE USING (
    owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = owner_user_id AND public_id = auth.uid())
);

-- 3.6 neighbor_endorsement
ALTER TABLE neighbor_endorsement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_endorsement_select ON neighbor_endorsement;
CREATE POLICY p_endorsement_select ON neighbor_endorsement FOR SELECT USING (true);

DROP POLICY IF EXISTS p_endorsement_insert ON neighbor_endorsement;
CREATE POLICY p_endorsement_insert ON neighbor_endorsement FOR INSERT WITH CHECK (
    endorser_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = endorser_user_id AND public_id = auth.uid())
);

-- 3.7 community_post
ALTER TABLE community_post ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_post_select ON community_post;
CREATE POLICY p_post_select ON community_post FOR SELECT USING (
    status IN ('ACTIVO', 'EN_COORDINACION', 'ATENDIDO', 'CERRADO')
);

DROP POLICY IF EXISTS p_post_insert ON community_post;
CREATE POLICY p_post_insert ON community_post FOR INSERT WITH CHECK (
    author_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = author_user_id AND public_id = auth.uid())
);

DROP POLICY IF EXISTS p_post_update ON community_post;
CREATE POLICY p_post_update ON community_post FOR UPDATE USING (
    author_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (
        SELECT 1 FROM user_profile
        WHERE (id = author_user_id AND public_id = auth.uid())
           OR (public_id = auth.uid() AND system_role IN ('BRIGADISTA_CERTIFICADO', 'LIDER_VECINAL', 'OPERADOR_MUNICIPAL'))
           OR (id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT AND system_role IN ('BRIGADISTA_CERTIFICADO', 'LIDER_VECINAL', 'OPERADOR_MUNICIPAL'))
    )
);

-- 3.8 post_sensitive_pii (BÓVEDA DE CONFIDENCIALIDAD MÉDICA - LEY N° 29733)
ALTER TABLE post_sensitive_pii ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_sensitive_pii_select ON post_sensitive_pii;
CREATE POLICY p_sensitive_pii_select ON post_sensitive_pii FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM community_post cp
        WHERE cp.id = post_sensitive_pii.post_id
          AND (
              cp.author_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT
              OR EXISTS (SELECT 1 FROM user_profile up WHERE up.id = cp.author_user_id AND up.public_id = auth.uid())
          )
    )
    OR EXISTS (
        SELECT 1 FROM user_profile up
        WHERE (up.id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR up.public_id = auth.uid())
          AND up.system_role IN ('BRIGADISTA_CERTIFICADO', 'LIDER_VECINAL', 'OPERADOR_MUNICIPAL')
    )
);

DROP POLICY IF EXISTS p_sensitive_pii_insert ON post_sensitive_pii;
CREATE POLICY p_sensitive_pii_insert ON post_sensitive_pii FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM community_post cp
        WHERE cp.id = post_sensitive_pii.post_id
          AND (
              cp.author_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT
              OR EXISTS (SELECT 1 FROM user_profile up WHERE up.id = cp.author_user_id AND up.public_id = auth.uid())
          )
    )
);

-- 3.9 pii_access_audit_log (INMUTABILIDAD FORENSE - LEY N° 29733)
ALTER TABLE pii_access_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_pii_audit_insert ON pii_access_audit_log;
CREATE POLICY p_pii_audit_insert ON pii_access_audit_log FOR INSERT WITH CHECK (
    accessed_by_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = accessed_by_user_id AND public_id = auth.uid())
);

DROP POLICY IF EXISTS p_pii_audit_select ON pii_access_audit_log;
CREATE POLICY p_pii_audit_select ON pii_access_audit_log FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM user_profile up
        WHERE (up.id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR up.public_id = auth.uid())
          AND up.system_role IN ('OPERADOR_MUNICIPAL', 'LIDER_VECINAL')
    )
);

-- INMUTABILIDAD FORENSE ESTRICTA: Prohibición absoluta de UPDATE y DELETE
REVOKE UPDATE, DELETE ON pii_access_audit_log FROM PUBLIC, anon, authenticated;

-- 3.10 post_resource_item & resource_commitment
ALTER TABLE post_resource_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_resource_item_select ON post_resource_item;
CREATE POLICY p_resource_item_select ON post_resource_item FOR SELECT USING (true);

DROP POLICY IF EXISTS p_resource_item_insert ON post_resource_item;
CREATE POLICY p_resource_item_insert ON post_resource_item FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM community_post cp
        WHERE cp.id = post_resource_item.post_id
          AND (
              cp.author_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT
              OR EXISTS (SELECT 1 FROM user_profile up WHERE up.id = cp.author_user_id AND up.public_id = auth.uid())
          )
    )
);

ALTER TABLE resource_commitment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_commitment_select ON resource_commitment;
CREATE POLICY p_commitment_select ON resource_commitment FOR SELECT USING (true);

DROP POLICY IF EXISTS p_commitment_insert ON resource_commitment;
CREATE POLICY p_commitment_insert ON resource_commitment FOR INSERT WITH CHECK (
    helper_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = helper_user_id AND public_id = auth.uid())
);

DROP POLICY IF EXISTS p_commitment_update ON resource_commitment;
CREATE POLICY p_commitment_update ON resource_commitment FOR UPDATE USING (
    helper_user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR
    EXISTS (SELECT 1 FROM user_profile WHERE id = helper_user_id AND public_id = auth.uid()) OR
    EXISTS (
        SELECT 1 FROM user_profile up
        WHERE (up.id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT OR up.public_id = auth.uid())
          AND up.system_role IN ('BRIGADISTA_CERTIFICADO', 'LIDER_VECINAL', 'OPERADOR_MUNICIPAL')
    )
);
