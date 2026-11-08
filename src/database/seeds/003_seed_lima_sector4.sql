-- ============================================================================
-- @file src/database/seeds/003_seed_lima_sector4.sql
-- @description Capa 1 (MOD-03) — Dataset Semilla Hiperrealista (Jesús María - Sector 4)
-- Escenario: Residencial San Felipe / Jr. Huiracocha / Av. Gregorio Escobedo, Lima.
-- Ejecutable de forma transaccional sobre PostgreSQL 16/17 Local y Supabase Cloud.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DISTRITO Y SECTOR BARRIAL (UBIGEO 150113 - JESÚS MARÍA)
-- ============================================================================
INSERT INTO district (ubigeo_code, name, province, department, emergency_active)
VALUES ('150113', 'Jesús María', 'Lima', 'Lima', FALSE)
ON CONFLICT (ubigeo_code) DO NOTHING;

INSERT INTO neighborhood_sector (district_id, sector_code, name, center_lat, center_lng, radius_meters)
VALUES (
    (SELECT id FROM district WHERE ubigeo_code = '150113'),
    'JM-SEC-04',
    'Sector 4 - Residencial San Felipe / Huiracocha',
    -12.0850,
    -77.0515,
    1200
)
ON CONFLICT (sector_code) DO NOTHING;

-- ============================================================================
-- 2. CATÁLOGO MAESTRO DE 10 CATEGORÍAS (2FN / 3FN)
-- ============================================================================
INSERT INTO category_catalog (code, name, module_scope, is_emergency_critical, priority_weight, icon_name)
VALUES
    ('GASFITERIA', 'Gasfitería', 'ECONOMIA_LOCAL', TRUE, 9, 'wrench'),
    ('ELECTRICIDAD', 'Electricidad', 'ECONOMIA_LOCAL', TRUE, 9, 'zap'),
    ('CERRAJERIA', 'Cerrajería', 'ECONOMIA_LOCAL', TRUE, 8, 'key'),
    ('BOTICA_INSUMOS', 'Botica e Insumos Médicos', 'AMBOS', TRUE, 10, 'pill'),
    ('BODEGA_ABARROTES', 'Bodega y Abarrotes', 'ECONOMIA_LOCAL', TRUE, 7, 'shopping-basket'),
    ('AGUA_ALIMENTOS', 'Agua Potable y Alimentos', 'ECONOMIA_SOLIDARIA', TRUE, 10, 'droplets'),
    ('BRIGADA_RESCATE', 'Brigada de Rescate', 'AMBOS', TRUE, 10, 'shield-alert'),
    ('CUIDADO_ADULTOS', 'Cuidado de Adultos Mayores', 'AMBOS', TRUE, 9, 'heart-handshake'),
    ('HERRAMIENTAS_BARRIALES', 'Herramientas Barriales', 'ECONOMIA_SOLIDARIA', FALSE, 5, 'hammer'),
    ('APOYO_ESCOLAR', 'Apoyo Escolar', 'ECONOMIA_SOLIDARIA', FALSE, 4, 'book-open')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. 8 PERFILES VECINALES REALISTAS (Sector 4 - Jesús María)
-- ============================================================================
-- Coordenadas distribuidas en torno a (-12.0850, -77.0515) para verificar pesos Haversine:
--   - Vecinos verificados a <= 500m generan w = 1.50
--   - Vecinos no verificados o entre 500m y 1500m generan w = 1.00
INSERT INTO user_profile (
    public_id, sector_id, full_name, phone_number, email,
    home_lat, home_lng, is_verified_neighbor, verification_method, system_role, reputation_points
)
VALUES
    -- 1. Líder Vecinal (Coordinadora de Junta Vecinal San Felipe) - Verificada (~110m del centro)
    (
        '11111111-1111-4111-8111-111111111101',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'Elena Vargas de Zárate',
        '+51991234501',
        'elena.vargas@juntasanfelipe.pe',
        -12.0842, -77.0512,
        TRUE, 'PADRON_JUNTA', 'LIDER_VECINAL', 180
    ),
    -- 2. Brigadista Certificado (Médico Emergenciólogo y Bombero Voluntario B-202) - Verificado (~180m)
    (
        '11111111-1111-4111-8111-111111111102',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'Dr. Ricardo Huamán Salazar',
        '+51991234502',
        'rhuaman.brigada@defensacivil.pe',
        -12.0861, -77.0508,
        TRUE, 'MUNICIPAL', 'BRIGADISTA_CERTIFICADO', 240
    ),
    -- 3. Vecino Verificado Barrial 1 (Maestro Gasfitero en Jr. Huiracocha) - Verificado (~95m)
    (
        '11111111-1111-4111-8111-111111111103',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'Jorge Luis Quispe Palomino',
        '+51991234503',
        'jorge.gasfiteria.jm@gmail.com',
        -12.0855, -77.0521,
        TRUE, 'PADRON_JUNTA', 'VECINO', 145
    ),
    -- 4. Vecino Verificado Barrial 2 (Técnico Electricista en Av. Gregorio Escobedo) - Verificado (~230m)
    (
        '11111111-1111-4111-8111-111111111104',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'Martín Alarcón Chuquimango',
        '+51991234504',
        'martin.electricista@gmail.com',
        -12.0833, -77.0525,
        TRUE, 'SMS_GEO', 'VECINO', 130
    ),
    -- 5. Vecino Estándar 1 (Farmacéutica de Botica San Felipe) - Verificada (~150m)
    (
        '11111111-1111-4111-8111-111111111105',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'QF. Milagros Paredes Ríos',
        '+51991234505',
        'botica.sanfelipe@gmail.com',
        -12.0846, -77.0503,
        TRUE, 'SMS_GEO', 'VECINO', 110
    ),
    -- 6. Vecino Estándar 2 (Docente jubilada en Residencial San Felipe) - No verificada aún (~310m)
    (
        '11111111-1111-4111-8111-111111111106',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'Rosa María Calderón Vda. de Tello',
        '+51991234506',
        'rosamaria.calderon@gmail.com',
        -12.0872, -77.0530,
        FALSE, 'SMS_GEO', 'VECINO', 65
    ),
    -- 7. Vecino Estándar 3 (Comerciante de Bodega y Ferretería en Calle Estados Unidos) - (~680m)
    (
        '11111111-1111-4111-8111-111111111107',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'César Augusto Mendoza Tovar',
        '+51991234507',
        'bodega.doncesar@gmail.com',
        -12.0792, -77.0532,
        FALSE, 'SMS_GEO', 'VECINO', 75
    ),
    -- 8. Vecino Estándar 4 (Enfermera Geriátrica y Voluntaria en Av. Pershing) - (~820m)
    (
        '11111111-1111-4111-8111-111111111108',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        'Lic. Lucía Fernández Gamarra',
        '+51991234508',
        'lucia.enfermeria.jm@gmail.com',
        -12.0898, -77.0572,
        FALSE, 'SMS_GEO', 'VECINO', 90
    )
ON CONFLICT (phone_number) DO NOTHING;

-- ============================================================================
-- 4. 2 GRUPOS DE APOYO BARRIAL Y MIEMBROS (Brecha B-02 / RN-13)
-- ============================================================================
INSERT INTO support_group (
    public_id, sector_id, coordinator_user_id, name, group_type,
    description, contact_phone, meeting_point_lat, meeting_point_lng,
    meeting_point_address, operational_status, is_verified_by_municipality
)
VALUES
    (
        '22222222-2222-4222-8222-222222222201',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        'Brigada Comunitaria de Defensa Civil San Felipe',
        'BRIGADA_DEFENSA_CIVIL',
        'Equipo de primera respuesta ante sismos e incendios equipado con camillas rígidas, extintores PQS, radio VHF y botiquín de trauma.',
        '+51991234502',
        -12.0852, -77.0514,
        'Ágora Central de la Residencial San Felipe (frente al edificio Las Palmeras)',
        'ACTIVO',
        TRUE
    ),
    (
        '22222222-2222-4222-8222-222222222202',
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        'Comité Vecinal de Rescate y Salud Huiracocha',
        'VOLUNTARIADO_SALUD',
        'Red de médicos, enfermeras y vecinos capacitados en triaje geriátrico, monitoreo de pacientes electrodependientes y acopio de agua.',
        '+51991234501',
        -12.0844, -77.0519,
        'Parque Huiracocha cdra. 14 - Puesto de Auxilio Rápido Vecinal',
        'ACTIVO',
        TRUE
    )
ON CONFLICT (public_id) DO NOTHING;

INSERT INTO support_group_member (group_id, user_id, member_role)
VALUES
    (
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        'COORDINADOR'
    ),
    (
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        'RESCATE_TECNICO'
    ),
    (
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234504'),
        'RESCATE_TECNICO'
    ),
    (
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        'COORDINADOR'
    ),
    (
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234505'),
        'PRIMEROS_AUXILIOS'
    ),
    (
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234508'),
        'PRIMEROS_AUXILIOS'
    )
ON CONFLICT (group_id, user_id) DO NOTHING;

-- ============================================================================
-- 5. 12 REGISTROS EN PROXIMITY_LISTING (6 Oficios, 4 Productos, 2 Soporte SOS)
-- ============================================================================
INSERT INTO proximity_listing (
    client_mutation_id, owner_user_id, support_group_id, sector_id, category_id,
    listing_type, title, description, contact_phone, latitude, longitude,
    available_for_emergencies, emergency_response_note
)
VALUES
    -- OFICIO 1: Gasfitero Certificado
    (
        '33333333-3333-4333-8333-333333333301',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'GASFITERIA'),
        'SERVICIO_OFICIO',
        'Maestro Gasfitero Sanitario y Detección de Fugas',
        'Más de 18 años atendiendo edificios en la Residencial San Felipe y Jr. Huiracocha. Reparación de tuberías matrices, bombas hidroneumáticas y llaves de paso.',
        '+51991234503',
        -12.0855, -77.0521,
        TRUE,
        'En sismos apoyo de inmediato en cierre de válvulas troncales de gas y agua.'
    ),
    -- OFICIO 2: Electricista 24h
    (
        '33333333-3333-4333-8333-333333333302',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234504'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'ELECTRICIDAD'),
        'SERVICIO_OFICIO',
        'Técnico Electricista Certificado — Tableros y Cortocircuitos',
        'Instalación de llaves diferenciales, pozos a tierra, reparación de cortocircuitos y diagnóstico de fugas eléctricas en departamentos.',
        '+51991234504',
        -12.0833, -77.0525,
        TRUE,
        'Disponible 24/7 con detector de tensión y herramientas aisladas para aislar riesgos de incendio eléctrico.'
    ),
    -- OFICIO 3: Cerrajería de Emergencia
    (
        '33333333-3333-4333-8333-333333333303',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234507'),
        NULL,
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'CERRAJERIA'),
        'SERVICIO_OFICIO',
        'Cerrajería Técnica Barrial — Apertura Sin Daño',
        'Apertura de puertas trabadas, cambio de bombines de alta seguridad y destrabe de cerraduras tras movimientos sísmicos.',
        '+51991234507',
        -12.0840, -77.0529,
        TRUE,
        'Equipo portátil a batería para liberar puertas descuadradas de adultos mayores atrapados.'
    ),
    -- OFICIO 4: Enfermería Geriátrica a Domicilio
    (
        '33333333-3333-4333-8333-333333333304',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234508'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'CUIDADO_ADULTOS'),
        'SERVICIO_OFICIO',
        'Enfermera Geriátrica Colegiada — Inyectables y Control Vital',
        'Atención a adultos mayores en casa: control de presión arterial, glucosa, curación de heridas, colocación de sondas y nebulizaciones.',
        '+51991234508',
        -12.0865, -77.0522,
        TRUE,
        'Cuento con tensiómetro, oxímetro de pulso, glucómetro y maletín de primeros auxilios.'
    ),
    -- OFICIO 5: Nivelación Escolar de Matemáticas y Física
    (
        '33333333-3333-4333-8333-333333333305',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234506'),
        NULL,
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'APOYO_ESCOLAR'),
        'SERVICIO_OFICIO',
        'Profesora de Matemáticas y Refuerzo Escolar en San Felipe',
        'Clases personalizadas para primaria y secundaria con paciencia y metodología didáctica en mi domicilio o biblioteca parroquial.',
        '+51991234506',
        -12.0872, -77.0530,
        FALSE,
        NULL
    ),
    -- OFICIO 6: Mantenimiento de Bombas de Agua y Cisternas de Edificios
    (
        '33333333-3333-4333-8333-333333333306',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        NULL,
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'GASFITERIA'),
        'SERVICIO_OFICIO',
        'Especialista en Cisternas y Electro-bombas de Edificios',
        'Limpieza de cisternas, purgado de electrobombas y habilitación de válvulas de extracción manual ante cortes de fluido eléctrico.',
        '+51991234503',
        -12.0858, -77.0518,
        TRUE,
        'Cuento con motobomba auxiliar a gasolina para extraer agua de cisternas subterráneas.'
    ),
    -- PRODUCTO LOCAL 7: Botica Barrial con Insulina, Sueros y Oxígeno
    (
        '33333333-3333-4333-8333-333333333307',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234505'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BOTICA_INSUMOS'),
        'PRODUCTO_LOCAL',
        'Botica Vecinal San Felipe — Insulina, Sueros y Botiquín',
        'Dispensación farmacéutica en el barrio: insulina refrigerada con batería de respaldo, sales de rehidratación, gasas estériles, antihipertensivos e inhaladores.',
        '+51991234505',
        -12.0846, -77.0503,
        TRUE,
        'Cadena de frío con autonomía de 48h para conservar insulina de vecinos diabéticos durante apagones.'
    ),
    -- PRODUCTO LOCAL 8: Bodega con Reserva de Agua Potable y Víveres No Perecibles
    (
        '33333333-3333-4333-8333-333333333308',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234507'),
        NULL,
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BODEGA_ABARROTES'),
        'PRODUCTO_LOCAL',
        'Bodega Don César — Bidones de Agua de 20L y Conservas',
        'Abastecimiento barrial de bidones de agua de mesa sellados, conservas de pescado, avena, leche evaporada y velas de emergencia.',
        '+51991234507',
        -12.0792, -77.0532,
        TRUE,
        'Compromiso de precio justo congelado sin especulación durante emergencias distritales.'
    ),
    -- PRODUCTO LOCAL 9: Ferretería Barrial con Linternas, Pilas y Generador
    (
        '33333333-3333-4333-8333-333333333309',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234504'),
        NULL,
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'HERRAMIENTAS_BARRIALES'),
        'PRODUCTO_LOCAL',
        'Ferretería Huiracocha — Linternas Recargables, Cintas y Herramientas',
        'Proveemos linternas LED recargables, pilas alcalinas, radios a pilas, llaves stilson para corte de gas y lonas impermeables.',
        '+51991234504',
        -12.0837, -77.0520,
        TRUE,
        'Disponemos de generador inverter de 3500W para emergencias de la cuadra.'
    ),
    -- PRODUCTO LOCAL 10: Panadería y Horno Comunitario San Felipe
    (
        '33333333-3333-4333-8333-333333333310',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        NULL,
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'AGUA_ALIMENTOS'),
        'PRODUCTO_LOCAL',
        'Panadería Artesanal del Barrio — Pan del Día y Raciones Secas',
        'Elaboración diaria de pan integral, tostadas de larga duración y galletas nutritivas para familias de la zona.',
        '+51991234501',
        -12.0845, -77.0510,
        TRUE,
        'Horno a gas GLP independiente que continúa operando aunque se corte la red eléctrica.'
    ),
    -- SOPORTE EMERGENCIA 11: Puesto Médico de Triaje y Oxígeno San Felipe
    (
        '33333333-3333-4333-8333-333333333311',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BRIGADA_RESCATE'),
        'SOPORTE_EMERGENCIA',
        'Puesto de Primera Respuesta y Triaje Médico — Brigada San Felipe',
        'Punto oficial de reunión de brigadistas con 2 balones de oxígeno medicinal de 10m3, desfibrilador DEA y camillas de evacuación vertical.',
        '+51991234502',
        -12.0852, -77.0514,
        TRUE,
        'Operativo en menos de 5 minutos tras cualquier sismo mayor a 5.0 ML.'
    ),
    -- SOPORTE EMERGENCIA 12: Estación Vecinal de Carga Solar y Radio VHF
    (
        '33333333-3333-4333-8333-333333333312',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BRIGADA_RESCATE'),
        'SOPORTE_EMERGENCIA',
        'Punto de Comunicaciones VHF y Recarga para Equipos Médicos',
        'Estación con paneles solares portátiles y batería LiFePO4 de 2000Wh exclusiva para recargar celulares en emergencia y equipos médicos.',
        '+51991234501',
        -12.0844, -77.0519,
        TRUE,
        'Enlace directo por radio VHF con el COED de la Municipalidad de Jesús María.'
    )
ON CONFLICT (client_mutation_id) DO NOTHING;

-- ============================================================================
-- 6. 15 REGISTROS EN NEIGHBOR_ENDORSEMENT (Disparan Triggers Geodésicos ACID)
-- ============================================================================
INSERT INTO neighbor_endorsement (client_mutation_id, listing_id, endorser_user_id, comment)
VALUES
    -- Endosos para Oficio 1 (Maestro Gasfitero Jorge Quispe)
    (
        '44444444-4444-4444-8444-444444444401',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333301'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        'El maestro Jorge reparó la tubería matriz del edificio Las Palmeras en tiempo récord. Totalmente confiable.'
    ),
    (
        '44444444-4444-4444-8444-444444444402',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333301'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        'Conoce al detalle las válvulas de la Residencial San Felipe y apoya siempre en los simulacros.'
    ),
    (
        '44444444-4444-4444-8444-444444444403',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333301'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234506'),
        'Vino a mi departamento a solucionar una filtración de agua y fue sumamente respetuoso y honesto.'
    ),
    -- Endosos para Oficio 2 (Técnico Electricista Martín Alarcón)
    (
        '44444444-4444-4444-8444-444444444404',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333302'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        'Actualizó todo el tablero eléctrico de la junta vecinal con llaves termomagnéticas certificadas.'
    ),
    (
        '44444444-4444-4444-8444-444444444405',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333302'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234505'),
        'Excelente profesional, instaló el sistema de respaldo de la botica sin ningún inconveniente.'
    ),
    -- Endosos para Oficio 3 (Cerrajería)
    (
        '44444444-4444-4444-8444-444444444406',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333303'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        'Abrió la puerta de una vecina mayor en menos de 10 minutos sin dañar la chapa.'
    ),
    -- Endosos para Oficio 4 (Enfermera Geriátrica Lucía Fernández)
    (
        '44444444-4444-4444-8444-444444444407',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333304'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234506'),
        'La Lic. Lucía controla mi presión todas las semanas con una calidez humana admirable.'
    ),
    (
        '44444444-4444-4444-8444-444444444408',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333304'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        'Profesional colegiada de primera línea, parte activa de nuestra red de salud barrial.'
    ),
    -- Endosos para Oficio 5 (Profesora Rosa María)
    (
        '44444444-4444-4444-8444-444444444409',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333305'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234504'),
        'Gracias a la profesora Rosa María mi hijo subió sus notas en álgebra y geometría.'
    ),
    -- Endosos para Producto 7 (Botica Vecinal San Felipe)
    (
        '44444444-4444-4444-8444-444444444410',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333307'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        'La QF. Milagros siempre orienta con ética a los adultos mayores del barrio y mantiene stock de insulina.'
    ),
    (
        '44444444-4444-4444-8444-444444444411',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333307'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        'Botica aliada del comité de emergencia con cadena de frío garantizada.'
    ),
    (
        '44444444-4444-4444-8444-444444444412',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333307'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234508'),
        'Siempre cuentan con insumos estériles, suero fisiológico y tensiómetro calibrado.'
    ),
    -- Endosos para Producto 8 (Bodega Don César)
    (
        '44444444-4444-4444-8444-444444444413',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333308'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        'Don César abastece de bidones de agua a domicilio a los vecinos del tercer y cuarto piso.'
    ),
    -- Endosos para Soporte 11 (Puesto de Primera Respuesta San Felipe)
    (
        '44444444-4444-4444-8444-444444444414',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333311'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        'Brigada perfectamente organizada por el Dr. Huamán, orgullo de la Residencial San Felipe.'
    ),
    -- Endosos para Soporte 12 (Estación Vecinal de Carga Solar)
    (
        '44444444-4444-4444-8444-444444444415',
        (SELECT id FROM proximity_listing WHERE client_mutation_id = '33333333-3333-4333-8333-333333333312'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234505'),
        'Punto vital de respaldo energético para mantener comunicada a toda la cuadra 14 de Huiracocha.'
    )
ON CONFLICT (client_mutation_id) DO NOTHING;

-- ============================================================================
-- 7. 10 REGISTROS EN COMMUNITY_POST (4 Ofertas Favor, 2 Solicitudes Favor,
--    2 Alertas SOS_VULNERABLE con Bóveda PII, 2 Recursos Críticos Solidarios)
-- ============================================================================
INSERT INTO community_post (
    client_mutation_id, author_user_id, sector_id, category_id,
    operational_mode, post_type, title, description, urgency_level,
    public_lat, public_lng, privacy_radius_meters, status, ai_triaged,
    has_monetary_intent, zero_money_compliant
)
VALUES
    -- 1. OFERTA_FAVOR: Préstamo de taladro percutor y caja de herramientas
    (
        '55555555-5555-4555-8555-555555555501',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'HERRAMIENTAS_BARRIALES'),
        'HABITUAL',
        'OFERTA_FAVOR',
        'Presto taladro percutor y llaves para asegurar muebles',
        'Vecinos del sector, presto mi taladro percutor con brocas de concreto para quienes deseen fijar estantes o repisas a la pared por prevención sísmica.',
        'BAJA',
        -12.0855, -77.0521, 0, 'ACTIVO', TRUE, FALSE, TRUE
    ),
    -- 2. OFERTA_FAVOR: Acompañamiento solidario a citas médicas en Rebagliati
    (
        '55555555-5555-4555-8555-555555555502',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234508'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'CUIDADO_ADULTOS'),
        'HABITUAL',
        'OFERTA_FAVOR',
        'Acompañamiento solidario a adultos mayores al Hospital Rebagliati',
        'Tengo disponibilidad los martes y jueves de 8am a 11am para acompañar a vecinos adultos mayores que vivan solos a recoger sus medicamentos o pasar consulta.',
        'MEDIA',
        -12.0865, -77.0522, 0, 'ACTIVO', TRUE, FALSE, TRUE
    ),
    -- 3. OFERTA_FAVOR: Taller gratuito de lectura y matemáticas para niños del barrio
    (
        '55555555-5555-4555-8555-555555555503',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234506'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'APOYO_ESCOLAR'),
        'HABITUAL',
        'OFERTA_FAVOR',
        'Círculo solidario de tareas escolares los sábados en el Ágora',
        'Como docente jubilada ofrezco dos horas de refuerzo solidario en matemáticas y comprensión lectora para niños de primaria de nuestra residencial.',
        'BAJA',
        -12.0872, -77.0530, 0, 'ACTIVO', TRUE, FALSE, TRUE
    ),
    -- 4. OFERTA_FAVOR: Préstamo de escalera tijera de aluminio de 8 pasos
    (
        '55555555-5555-4555-8555-555555555504',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234504'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'HERRAMIENTAS_BARRIALES'),
        'HABITUAL',
        'OFERTA_FAVOR',
        'Presto escalera tijera de aluminio de 8 peldaños',
        'Disponible para vecinos de Jr. Huiracocha y San Felipe que necesiten cambiar luminarias altas o podar ramas pequeñas en sus jardines.',
        'BAJA',
        -12.0833, -77.0525, 0, 'ACTIVO', TRUE, FALSE, TRUE
    ),
    -- 5. SOLICITUD_FAVOR: Apoyo entre vecinos para bajar cama clínica al primer piso
    (
        '55555555-5555-4555-8555-555555555505',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234506'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'CUIDADO_ADULTOS'),
        'HABITUAL',
        'SOLICITUD_FAVOR',
        'Necesito apoyo de 2 vecinos para mover cama clínica al primer piso',
        'Por indicación médica debemos trasladar la cama articulada de mi esposo del segundo al primer nivel hoy a las 5pm. Agradeceré mucho dos manos solidarias.',
        'MEDIA',
        -12.0870, -77.0528, 0, 'EN_COORDINACION', TRUE, FALSE, TRUE
    ),
    -- 6. SOLICITUD_FAVOR: Préstamo de silla de ruedas por 3 días
    (
        '55555555-5555-4555-8555-555555555506',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'CUIDADO_ADULTOS'),
        'HABITUAL',
        'SOLICITUD_FAVOR',
        'Solicito préstamo temporal de silla de ruedas plegable por 3 días',
        'Una vecina del bloque C acaba de salir de alta por esguince de tobillo y requiere una silla de ruedas prestada solo hasta el viernes para sus controles.',
        'MEDIA',
        -12.0842, -77.0512, 0, 'ACTIVO', TRUE, FALSE, TRUE
    ),
    -- 7. SOS_VULNERABLE 1: Adulta mayor de 84 años requiere oxígeno medicinal urgente (PII Difuminada 50m)
    (
        '55555555-5555-4555-8555-555555555507',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BOTICA_INSUMOS'),
        'EMERGENCIA',
        'SOS_VULNERABLE',
        'Urgente: Adulta mayor electrodependiente requiere oxígeno y respaldo',
        'Vecina vulnerable en [DIRECCIÓN EXACTA PROTEGIDA - LEY 29733] con [CONDICIÓN DE SALUD PROTEGIDA] se quedó sin energía para su concentrador tras el corte.',
        'CRITICA',
        -- Coordenadas públicas con Spatial Blurring (~45m desplazadas de la puerta exacta)
        -12.0848, -77.0516, 50, 'EN_COORDINACION', TRUE, FALSE, TRUE
    ),
    -- 8. SOS_VULNERABLE 2: Adulto mayor en piso 8 sin ascensor necesita insulina NPH y agua
    (
        '55555555-5555-4555-8555-555555555508',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234508'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BOTICA_INSUMOS'),
        'EMERGENCIA',
        'SOS_VULNERABLE',
        'Auxilio: Vecino de 79 años aislado en piso alto requiere insulina y agua',
        'Vecino adulto mayor con movilidad reducida en [DIRECCIÓN EXACTA PROTEGIDA - LEY 29733] no puede bajar por las escaleras y requiere insulina refrigerada.',
        'CRITICA',
        -- Coordenadas públicas con Spatial Blurring (~48m desplazadas de la puerta exacta)
        -12.0856, -77.0509, 50, 'EN_COORDINACION', TRUE, FALSE, TRUE
    ),
    -- 9. RECURSO_SOLIDARIO 1: Punto de Acopio de Agua Potable y Frazadas en Parque Huiracocha
    (
        '55555555-5555-4555-8555-555555555509',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234501'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'AGUA_ALIMENTOS'),
        'EMERGENCIA',
        'RECURSO_SOLIDARIO',
        'Acopio Comunitario de Bidones de Agua de 20L y Frazadas para Damnificados',
        'Estamos reuniendo agua potable sellada y frazadas térmicas en el Puesto de Auxilio de Huiracocha para distribuir a los edificios sin suministro.',
        'ALTA',
        -12.0844, -77.0519, 0, 'EN_COORDINACION', TRUE, FALSE, TRUE
    ),
    -- 10. RECURSO_SOLIDARIO 2: Punto de Recarga de Baterías Médicas y Botiquines de Trauma
    (
        '55555555-5555-4555-8555-555555555510',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        (SELECT id FROM neighborhood_sector WHERE sector_code = 'JM-SEC-04'),
        (SELECT id FROM category_catalog WHERE code = 'BRIGADA_RESCATE'),
        'EMERGENCIA',
        'RECURSO_SOLIDARIO',
        'Coordinación de Botiquines de Primeros Auxilios y Linternas para Brigadas',
        'La Brigada de Defensa Civil San Felipe coordina el préstamo de linternas frontales e insumos de curación para el recorrido nocturno de bloques.',
        'ALTA',
        -12.0852, -77.0514, 0, 'EN_COORDINACION', TRUE, FALSE, TRUE
    )
ON CONFLICT (client_mutation_id) DO NOTHING;

-- ============================================================================
-- 8. BÓVEDA PII 1:1 (post_sensitive_pii) Y AUDITORÍA FORENSE (Ley N° 29733)
-- ============================================================================
INSERT INTO post_sensitive_pii (
    post_id, exact_lat, exact_lng, exact_address_reference,
    vulnerable_person_name, medical_or_mobility_notes, emergency_contact_phone
)
VALUES
    (
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555507'),
        -12.08445, -77.05185,
        'Jr. Huiracocha 1420, Dpto 402 (Edificio color crema, tocar intercomunicador 402 o puerta lateral)',
        'Doña Grimanesa Soto Vda. de Luján (84 años)',
        'Insuficiencia cardíaca severa y EPOC; requiere oxígeno medicinal a 3 L/min continuo.',
        '+51991234501'
    ),
    (
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555508'),
        -12.08528, -77.05118,
        'Residencial San Felipe, Edificio Las Begonias, Piso 8, Dpto 803 (Ascensor bloqueado por corte eléctrico)',
        'Don Teófilo Cáceres Valdivia (79 años)',
        'Paciente diabético insulinodependiente y postrado en silla de ruedas tras fractura de cadera.',
        '+51991234508'
    )
ON CONFLICT (post_id) DO NOTHING;

-- Registro de Auditoría Inmutable de Desbloqueo PII por el Brigadista Certificado
INSERT INTO pii_access_audit_log (post_id, accessed_by_user_id, access_reason)
VALUES
    (
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555507'),
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        'Despacho inmediato de Brigada San Felipe con balón de oxígeno portátil de 10m3 hacia domicilio de paciente.'
    );

-- ============================================================================
-- 9. ÍTEMS CUANTIFICABLES DE RECURSOS (1FN) Y COMPROMISOS VECINALES (40%-60%)
-- ============================================================================
INSERT INTO post_resource_item (
    client_mutation_id, post_id, item_name, unit_measure, quantity_needed, quantity_committed
)
VALUES
    -- Para SOS_VULNERABLE 1 (Oxígeno medicinal)
    (
        '66666666-6666-4666-8666-666666666601',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555507'),
        'Balón de oxígeno medicinal o batería de respaldo',
        'UNIDAD',
        2,
        1 -- 50% cubierto
    ),
    -- Para SOS_VULNERABLE 2 (Agua e Insulina NPH)
    (
        '66666666-6666-4666-8666-666666666602',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555508'),
        'Agua potable para hidratación',
        'LITROS',
        20,
        10 -- 50% cubierto
    ),
    -- Para RECURSO_SOLIDARIO 1 (Bidones de agua de 20L y Frazadas) — cubierto al 40% y 60%
    (
        '66666666-6666-4666-8666-666666666603',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555509'),
        'Bidones de agua potable de 20L',
        'UNIDADES',
        10,
        4 -- 40% cubierto
    ),
    (
        '66666666-6666-4666-8666-666666666604',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555509'),
        'Frazadas térmicas de abrigo',
        'UNIDADES',
        10,
        6 -- 60% cubierto
    ),
    -- Para RECURSO_SOLIDARIO 2 (Botiquines de trauma / Linternas) — cubierto al 50%
    (
        '66666666-6666-4666-8666-666666666605',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555510'),
        'Kits de gasas estériles y vendas elásticas',
        'UNIDADES',
        6,
        3 -- 50% cubierto
    )
ON CONFLICT (client_mutation_id) DO NOTHING;

INSERT INTO resource_commitment (
    client_mutation_id, post_id, resource_item_id,
    post_client_mutation_id, resource_item_client_mutation_id,
    helper_user_id, support_group_id, committed_quantity, commitment_note, status
)
VALUES
    -- Compromiso 1: Brigada San Felipe lleva 1 balón de oxígeno a Doña Grimanesa (50%)
    (
        '77777777-7777-4777-8777-777777777701',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555507'),
        (SELECT id FROM post_resource_item WHERE client_mutation_id = '66666666-6666-4666-8666-666666666601'),
        '55555555-5555-4555-8555-555555555507',
        '66666666-6666-4666-8666-666666666601',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234502'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222201'),
        1,
        'Subiendo con el balón portátil de la brigada y cánula binaural al piso 4.',
        'EN_CAMINO'
    ),
    -- Compromiso 2: Vecino Jorge Quispe lleva 10L de agua al piso 8 de Las Begonias (50%)
    (
        '77777777-7777-4777-8777-777777777702',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555508'),
        (SELECT id FROM post_resource_item WHERE client_mutation_id = '66666666-6666-4666-8666-666666666602'),
        '55555555-5555-4555-8555-555555555508',
        '66666666-6666-4666-8666-666666666602',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234503'),
        NULL,
        10,
        'Llevo 2 galoneras de 5 litros por las escaleras junto con el gel refrigerante de la botica.',
        'EN_CAMINO'
    ),
    -- Compromiso 3: Bodega Don César aporta 4 bidones de 20L al punto de acopio (40%)
    (
        '77777777-7777-4777-8777-777777777703',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555509'),
        (SELECT id FROM post_resource_item WHERE client_mutation_id = '66666666-6666-4666-8666-666666666603'),
        '55555555-5555-4555-8555-555555555509',
        '66666666-6666-4666-8666-666666666603',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234507'),
        NULL,
        4,
        'Entregando 4 bidones sellados de 20L en el puesto del Parque Huiracocha.',
        'ENTREGADO_VERIFICADO'
    ),
    -- Compromiso 4: Vecinos aportan 6 frazadas térmicas al punto de acopio (60%)
    (
        '77777777-7777-4777-8777-777777777704',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555509'),
        (SELECT id FROM post_resource_item WHERE client_mutation_id = '66666666-6666-4666-8666-666666666604'),
        '55555555-5555-4555-8555-555555555509',
        '66666666-6666-4666-8666-666666666604',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234506'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        6,
        'Llevamos 6 frazadas nuevas recolectadas en el bloque D de la Residencial.',
        'ENTREGADO_VERIFICADO'
    ),
    -- Compromiso 5: Botica San Felipe entrega 3 kits de gasas y vendas (50%)
    (
        '77777777-7777-4777-8777-777777777705',
        (SELECT id FROM community_post WHERE client_mutation_id = '55555555-5555-4555-8555-555555555510'),
        (SELECT id FROM post_resource_item WHERE client_mutation_id = '66666666-6666-4666-8666-666666666605'),
        '55555555-5555-4555-8555-555555555510',
        '66666666-6666-4666-8666-666666666605',
        (SELECT id FROM user_profile WHERE phone_number = '+51991234505'),
        (SELECT id FROM support_group WHERE public_id = '22222222-2222-4222-8222-222222222202'),
        3,
        'Disponibles 3 kits completos de curación listos para recoger en la botica.',
        'COMPROMETIDO'
    )
ON CONFLICT (client_mutation_id) DO NOTHING;

COMMIT;
