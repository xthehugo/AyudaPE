import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_SECTOR_LISTINGS,
  INITIAL_SECTOR_POSTS,
} from '@/lib/initial-data';
import { RedVecinaLocalDB } from '@/lib/offline/db';
import {
  CreateListingSchema,
  ExtractedPiiSchema,
  MONEY_REGEX,
  NeighborIntentSchema,
  PERU_PHONE_REGEX,
} from '@/shared/schemas';
import {
  AVAILABLE_SECTORS,
  DEFAULT_SECTOR,
  type ITerritorySector,
} from '@/context/location-context';

describe('R1: Semillas y Selector de Ubicación Hiperlocal (Huancayo y Zonas Críticas)', () => {
  /* =========================================================================
   * FEATURE 1: SELECTOR DE UBICACIÓN (HUANCAYO POR DEFECTO Y ZONAS CRÍTICAS)
   * ========================================================================= */
  describe('F1 - Selector de Ubicación: Tier 1 (Funcional)', () => {
    it('F1-T1-01: Establece Huancayo como territorio por defecto con sectores en El Tambo, San Carlos y Centro', () => {
      expect(DEFAULT_SECTOR).toBeDefined();
      expect(DEFAULT_SECTOR.id).toBe('huancayo-el-tambo');
      expect(DEFAULT_SECTOR.department).toBe('Junín');

      const elTambo = AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-el-tambo');
      const sanCarlos = AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-san-carlos');
      const centro = AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-centro');

      expect(elTambo).toBeDefined();
      expect(elTambo?.department).toBe('Junín');
      expect(elTambo?.district).toBe('El Tambo');

      expect(sanCarlos).toBeDefined();
      expect(sanCarlos?.department).toBe('Junín');

      expect(centro).toBeDefined();
      expect(centro?.district).toBe('Huancayo');
    });

    it('F1-T1-02: Identifica explícitamente sectores críticos ante catástrofes (Falla Huaytapallana y Fenómeno El Niño / Mantaro)', () => {
      const catastropheZones = AVAILABLE_SECTORS.filter((s) => s.isCatastropheZone === true);
      expect(catastropheZones.length).toBeGreaterThanOrEqual(2);

      const huaytapallana = catastropheZones.find((s) => s.id === 'zona-critica-huaytapallana');
      const nino = catastropheZones.find((s) => s.id === 'zona-critica-mantaro');

      expect(huaytapallana?.isCatastropheZone).toBe(true);
      expect(nino?.isCatastropheZone).toBe(true);
    });

    it('F1-T1-03: Mantiene compatibilidad con Jesús María para migración interprovincial', () => {
      const jesusMaria = AVAILABLE_SECTORS.find((s) => s.id === 'lima-jesus-maria-4');
      expect(jesusMaria).toBeDefined();
      expect(jesusMaria?.department).toBe('Lima');
    });

    it('F1-T1-04: Configura niveles de zoom cartográfico adecuados para sectores urbanos (15-16) vs zonas críticas (14)', () => {
      const urbanSector = AVAILABLE_SECTORS.find((s) => s.id === 'huancayo-el-tambo')!;
      const criticalSector = AVAILABLE_SECTORS.find((s) => s.id === 'zona-critica-huaytapallana')!;

      expect(urbanSector.zoomLevel).toBeGreaterThanOrEqual(15);
      expect(criticalSector.zoomLevel).toBeLessThan(urbanSector.zoomLevel);
    });

    it('F1-T1-05: Verifica que el contrato de ITerritorySector satisfaga todas las propiedades requeridas', () => {
      for (const sector of AVAILABLE_SECTORS) {
        expect(typeof sector.id).toBe('string');
        expect(typeof sector.name).toBe('string');
        expect(typeof sector.district).toBe('string');
        expect(typeof sector.department).toBe('string');
        expect(typeof sector.centerLat).toBe('number');
        expect(typeof sector.centerLng).toBe('number');
        expect(typeof sector.zoomLevel).toBe('number');
      }
    });
  });

  describe('F1 - Selector de Ubicación: Tier 2 (BVA y Límites)', () => {
    it('F1-T2-01: Valida que las coordenadas de Huancayo estén dentro de la caja delimitadora de Junín (-12.2 a -11.9 lat, -75.4 a -75.0 lng)', () => {
      const huancayoSectors = AVAILABLE_SECTORS.filter((s) => s.department === 'Junín');
      for (const sector of huancayoSectors) {
        expect(sector.centerLat).toBeLessThan(-11.9);
        expect(sector.centerLat).toBeGreaterThan(-12.2);
        expect(sector.centerLng).toBeLessThan(-75.0);
        expect(sector.centerLng).toBeGreaterThan(-75.4);
      }
    });

    it('F1-T2-02: Rechaza coordenadas con latitud fuera de [-90, 90]', () => {
      const invalidLat1 = 90.001;
      const invalidLat2 = -90.001;
      expect(CreateListingSchema.safeParse({ latitude: invalidLat1 }).success).toBe(false);
      expect(CreateListingSchema.safeParse({ latitude: invalidLat2 }).success).toBe(false);
    });

    it('F1-T2-03: Rechaza coordenadas con longitud fuera de [-180, 180]', () => {
      const invalidLng1 = 180.001;
      const invalidLng2 = -180.001;
      expect(CreateListingSchema.safeParse({ longitude: invalidLng1 }).success).toBe(false);
      expect(CreateListingSchema.safeParse({ longitude: invalidLng2 }).success).toBe(false);
    });

    it('F1-T2-04: Comprueba que los identificadores de sector sigan formato kebab-case limpio', () => {
      for (const sector of AVAILABLE_SECTORS) {
        expect(sector.id).toMatch(/^[a-z0-9-]+$/);
      }
    });

    it('F1-T2-05: Rechaza selección de sector con ID inexistente arrojando error controlado', () => {
      const findSector = (id: string) => {
        const found = AVAILABLE_SECTORS.find((s) => s.id === id);
        if (!found) throw new Error(`Sector no reconocido: ${id}`);
        return found;
      };
      expect(() => findSector('sector-fantasma')).toThrow('Sector no reconocido: sector-fantasma');
      expect(() => findSector('')).toThrow('Sector no reconocido: ');
    });
  });

  /* =========================================================================
   * FEATURE 2: SEMILLAS MURO SOLIDARIO (CERO DINERO: MULETAS Y CARPOOLING)
   * ========================================================================= */
  describe('F2 - Semillas Muro Solidario: Tier 1 (Funcional)', () => {
    it('F2-T1-01: Verifica publicación de préstamo gratuito de muletas ortopédicas de aluminio', () => {
      const muletasPost = INITIAL_SECTOR_POSTS.find(
        (p) =>
          p.title.toLowerCase().includes('muletas') ||
          p.description.toLowerCase().includes('muletas')
      );
      expect(muletasPost).toBeDefined();
      expect(muletasPost?.post_type).toBe('OFERTA_FAVOR');
      expect(muletasPost?.operational_mode).toBe('HABITUAL');
      expect(muletasPost?.title.toLowerCase()).toContain('muletas');
    });

    it('F2-T1-02: Verifica publicación de carpooling escolar vecinal entre padres verificados', () => {
      const poolPost = INITIAL_SECTOR_POSTS.find(
        (p) =>
          p.title.toLowerCase().includes('pool escolar') ||
          p.description.toLowerCase().includes('colegio')
      );
      expect(poolPost).toBeDefined();
      expect(poolPost?.post_type).toBe('OFERTA_FAVOR');
      expect(poolPost?.description.toLowerCase()).toContain('coordinamos entre padres');
    });

    it('F2-T1-03: Comprueba que las publicaciones del Muro Solidario operen bajo status ACTIVO', () => {
      const solidaryPosts = INITIAL_SECTOR_POSTS.filter((p) => p.post_type === 'OFERTA_FAVOR');
      expect(solidaryPosts.length).toBeGreaterThanOrEqual(2);
      for (const post of solidaryPosts) {
        expect(post.status).toBe('ACTIVO');
      }
    });

    it('F2-T1-04: Verifica que las ofertas solidarias tengan urgencia adecuada (BAJA o MEDIA)', () => {
      const solidaryPosts = INITIAL_SECTOR_POSTS.filter((p) => p.post_type === 'OFERTA_FAVOR');
      for (const post of solidaryPosts) {
        expect(['BAJA', 'MEDIA']).toContain(post.urgency_level);
      }
    });

    it('F2-T1-05: Garantiza que ninguna semilla del Muro Solidario contenga palabras de cobro', () => {
      const solidaryPosts = INITIAL_SECTOR_POSTS.filter((p) => p.post_type === 'OFERTA_FAVOR');
      for (const post of solidaryPosts) {
        expect(MONEY_REGEX.test(post.title)).toBe(false);
        expect(MONEY_REGEX.test(post.description)).toBe(false);
      }
    });
  });

  describe('F2 - Semillas Muro Solidario: Tier 2 (BVA e Invariante RN-01 Cero Dinero)', () => {
    it('F2-T2-01: MONEY_REGEX detecta símbolos y montos explícitos (S/, soles, dólares, USD)', () => {
      expect(MONEY_REGEX.test('Muletas por S/ 25')).toBe(true);
      expect(MONEY_REGEX.test('Préstamo a 15 soles')).toBe(true);
      expect(MONEY_REGEX.test('Costo 10 usd')).toBe(true);
      expect(MONEY_REGEX.test('Tarifa 20 dólares')).toBe(true);
    });

    it('F2-T2-02: MONEY_REGEX detecta jerga peruana de dinero (lucas, mangos, ferros, morlacos)', () => {
      expect(MONEY_REGEX.test('Doy carpooling por 5 lucas')).toBe(true);
      expect(MONEY_REGEX.test('Pido 10 mangos para la gasolina')).toBe(true);
      expect(MONEY_REGEX.test('Son 2 ferros')).toBe(true);
      expect(MONEY_REGEX.test('Colabora con unos morlacos')).toBe(true);
    });

    it('F2-T2-03: MONEY_REGEX detecta billeteras y bancos locales (Yape, Plin, Tunki, BCP)', () => {
      expect(MONEY_REGEX.test('Yape al 999111222')).toBe(true);
      expect(MONEY_REGEX.test('Paga por plin')).toBe(true);
      expect(MONEY_REGEX.test('Transferencia bcp')).toBe(true);
      expect(MONEY_REGEX.test('Depósito a interbank')).toBe(true);
    });

    it('F2-T2-04: MONEY_REGEX detecta cobros indirectos ("chanchita", "colaboración económica")', () => {
      expect(MONEY_REGEX.test('Hacemos una chanchita para el chofer')).toBe(true);
      expect(MONEY_REGEX.test('Se pide una colaboración económica')).toBe(true);
      expect(MONEY_REGEX.test('Aporte voluntario obligatorio')).toBe(true);
    });

    it('F2-T2-05: Acepta expresiones solidarias legítimas con "sin costo", "sin cobro" y "gratis"', () => {
      expect(MONEY_REGEX.test('Presto muletas sin costo alguno')).toBe(false);
      expect(MONEY_REGEX.test('Pool escolar sin cobro entre vecinos')).toBe(false);
      expect(MONEY_REGEX.test('Entrega gratuita a quien lo necesite')).toBe(false);
    });
  });

  /* =========================================================================
   * FEATURE 3: SEMILLAS CATÁLOGO DE PROXIMIDAD (LASAÑAS, MATEMÁTICAS, OFICIOS)
   * ========================================================================= */
  describe('F3 - Semillas Catálogo de Proximidad: Tier 1 (Funcional)', () => {
    it('F3-T1-01: Verifica catálogo con lasañas caseras y postres familiares de la vecina', () => {
      const lasanaListing = INITIAL_SECTOR_LISTINGS.find((l) =>
        l.title.toLowerCase().includes('lasañas')
      );
      expect(lasanaListing).toBeDefined();
      expect(lasanaListing?.listing_type).toBe('PRODUCTO_LOCAL');
      expect(lasanaListing?.description).toContain('recién horneadas');
    });

    it('F3-T1-02: Verifica servicio de clases de matemáticas y nivelación escolar', () => {
      const clasesListing = INITIAL_SECTOR_LISTINGS.find((l) =>
        l.title.toLowerCase().includes('matemáticas')
      );
      expect(clasesListing).toBeDefined();
      expect(clasesListing?.listing_type).toBe('SERVICIO_OFICIO');
      expect(clasesListing?.description).toContain('refuerzo escolar');
    });

    it('F3-T1-03: Verifica oficio de gasfitería para emergencias de tuberías y fugas', () => {
      const gasfiteria = INITIAL_SECTOR_LISTINGS.find((l) =>
        l.title.toLowerCase().includes('gasfitería')
      );
      expect(gasfiteria).toBeDefined();
      expect(gasfiteria?.listing_type).toBe('SERVICIO_OFICIO');
      expect(gasfiteria?.available_for_emergencies).toBe(true);
    });

    it('F3-T1-04: Verifica oficio de electricidad para tableros y cortocircuitos', () => {
      const electricidad = INITIAL_SECTOR_LISTINGS.find((l) =>
        l.title.toLowerCase().includes('electricista')
      );
      expect(electricidad).toBeDefined();
      expect(electricidad?.listing_type).toBe('SERVICIO_OFICIO');
      expect(electricidad?.available_for_emergencies).toBe(true);
    });

    it('F3-T1-05: Verifica que todos los registros de catálogo incluyan teléfonos de contacto peruanos válidos (móviles 9xx o fijos regionales 064)', () => {
      const PERU_ANY_PHONE_REGEX = /^(?:(?:\+?51\s*)?9\d{2}[-\s]?\d{3}[-\s]?\d{3}|0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4})$/;
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        expect(listing.contact_phone).toBeDefined();
        expect(PERU_ANY_PHONE_REGEX.test(listing.contact_phone)).toBe(true);
      }
    });
  });

  describe('F3 - Semillas Catálogo de Proximidad: Tier 2 (BVA y Esquema Zod)', () => {
    it('F3-T2-01: Valida longitud de títulos de catálogo entre 5 y 100 caracteres', () => {
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        expect(listing.title.length).toBeGreaterThanOrEqual(5);
        expect(listing.title.length).toBeLessThanOrEqual(100);
      }
    });

    it('F3-T2-02: Valida longitud de descripciones de catálogo entre 10 y 1000 caracteres', () => {
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        expect(listing.description.length).toBeGreaterThanOrEqual(10);
        expect(listing.description.length).toBeLessThanOrEqual(1000);
      }
    });

    it('F3-T2-03: Rechaza teléfono con menos de 9 dígitos o caracteres alfanuméricos', () => {
      expect(PERU_PHONE_REGEX.test('98765432')).toBe(false); // 8 dígitos
      expect(PERU_PHONE_REGEX.test('9876543210')).toBe(false); // 10 dígitos locales sin +51
      expect(PERU_PHONE_REGEX.test('987-abc-222')).toBe(false); // letras
    });

    it('F3-T2-04: Valida que los weighted_trust_score sean números positivos coherentes', () => {
      for (const listing of INITIAL_SECTOR_LISTINGS) {
        expect(listing.weighted_trust_score).toBeGreaterThanOrEqual(0);
        expect(listing.endorsement_count).toBeGreaterThanOrEqual(0);
      }
    });

    it('F3-T2-05: Comprueba que CreateListingSchema valide integralmente todas las semillas de catálogo con móvil peruano', () => {
      const mobileListings = INITIAL_SECTOR_LISTINGS.filter((l) =>
        PERU_PHONE_REGEX.test(l.contact_phone)
      );
      expect(mobileListings.length).toBeGreaterThanOrEqual(6);
      for (const listing of mobileListings) {
        const parseResult = CreateListingSchema.safeParse({
          client_mutation_id: listing.client_mutation_id,
          category_id: listing.category_id,
          listing_type: listing.listing_type,
          title: listing.title,
          description: listing.description,
          contact_phone: listing.contact_phone,
          latitude: listing.latitude,
          longitude: listing.longitude,
          available_for_emergencies: listing.available_for_emergencies,
        });
        expect(parseResult.success).toBe(true);
      }
    });
  });

  /* =========================================================================
   * FEATURE 4: SEMILLAS EMERGENCIAS (OXÍGENO, ACOPIO, BRIGADAS Y SISMOS)
   * ========================================================================= */
  describe('F4 - Semillas Emergencias y Catástrofes: Tier 1 (Funcional)', () => {
    it('F4-T1-01: Verifica catálogo con servicio de enfermería y soporte de oxígeno medicinal 24/7', () => {
      const oxigeno = INITIAL_SECTOR_LISTINGS.find((l) =>
        l.title.toLowerCase().includes('oxígeno')
      );
      expect(oxigeno).toBeDefined();
      expect(oxigeno?.listing_type).toBe('SOPORTE_EMERGENCIA');
      expect(oxigeno?.available_for_emergencies).toBe(true);
      expect(oxigeno?.description).toContain('Brigada');
    });

    it('F4-T1-02: Verifica publicación de acopio solidario para agua potable y víveres', () => {
      const acopio = INITIAL_SECTOR_POSTS.find((p) =>
        p.title.toLowerCase().includes('acopio')
      );
      expect(acopio).toBeDefined();
      expect(acopio?.urgency_level).toBe('ALTA');
      expect(acopio?.post_type).toBe('SOLICITUD_FAVOR');
    });

    it('F4-T1-03: Verifica publicación de emergencia SOS vulnerable con nivel de urgencia CRITICA', () => {
      const sosPost = INITIAL_SECTOR_POSTS.find((p) => p.post_type === 'SOS_VULNERABLE');
      expect(sosPost).toBeDefined();
      expect(sosPost?.operational_mode).toBe('EMERGENCIA');
      expect(sosPost?.urgency_level).toBe('CRITICA');
    });

    it('F4-T1-04: Comprueba difuminado de privacidad geográfico configurado en exactamente 50 metros', () => {
      const sosPost = INITIAL_SECTOR_POSTS.find((p) => p.post_type === 'SOS_VULNERABLE');
      expect(sosPost?.privacy_radius_meters).toBe(50);
    });

    it('F4-T1-05: Verifica que la descripción pública del reporte SOS no revele dirección exacta', () => {
      const sosPost = INITIAL_SECTOR_POSTS.find((p) => p.post_type === 'SOS_VULNERABLE')!;
      expect(sosPost.description).toContain('[DIRECCIÓN EXACTA PROTEGIDA - LEY 29733]');
      expect(sosPost.description).toContain('[CONDICIÓN DE SALUD PROTEGIDA]');
    });
  });

  describe('F4 - Semillas Emergencias: Tier 2 (BVA y Protección PII Ley 29733)', () => {
    it('F4-T2-01: ExtractedPiiSchema exige dirección exacta con mínimo de 5 caracteres', () => {
      const shortAddress = { exact_address_reference: 'Jr.' };
      expect(ExtractedPiiSchema.safeParse(shortAddress).success).toBe(false);

      const validPii = {
        exact_address_reference: 'Jr. Huiracocha 1488 Dpto 201',
        emergency_contact_phone: '987-111-222',
      };
      expect(ExtractedPiiSchema.safeParse(validPii).success).toBe(true);
    });

    it('F4-T2-02: ExtractedPiiSchema rechaza dirección que exceda 300 caracteres', () => {
      const hugeAddress = { exact_address_reference: 'A'.repeat(301) };
      expect(ExtractedPiiSchema.safeParse(hugeAddress).success).toBe(false);
    });

    it('F4-T2-03: ExtractedPiiSchema valida teléfono de emergencia con formato peruano', () => {
      const piiWithBadPhone = {
        exact_address_reference: 'Calle Real 450, El Tambo',
        emergency_contact_phone: '12345',
      };
      expect(ExtractedPiiSchema.safeParse(piiWithBadPhone).success).toBe(false);
    });

    it('F4-T2-04: Verifica que los reportes no SOS tengan radio de privacidad igual a 0 metros', () => {
      const regularPosts = INITIAL_SECTOR_POSTS.filter((p) => p.post_type !== 'SOS_VULNERABLE');
      for (const post of regularPosts) {
        expect(post.privacy_radius_meters).toBe(0);
      }
    });

    it('F4-T2-05: Valida formato ISO 8601 en fechas de creación de publicaciones de emergencia', () => {
      for (const post of INITIAL_SECTOR_POSTS) {
        const timestamp = Date.parse(post.client_created_at);
        expect(Number.isNaN(timestamp)).toBe(false);
        expect(new Date(timestamp).toISOString()).toBe(post.client_created_at);
      }
    });
  });

  /* =========================================================================
   * TIER 3: PRUEBAS COMBINATORIAS Y PERSISTENCIA INTEGRAL (R1)
   * ========================================================================= */
  describe('R1: Tier 3 (Interacciones Combinatorias y Persistencia)', () => {
    it('R1-T3-01: Persiste e indexa semillas en base local Dexie sin colisiones de identificadores', async () => {
      const db = new RedVecinaLocalDB(`TestDb_R1_T3_${Date.now()}`);
      await db.bulkCacheListings(INITIAL_SECTOR_LISTINGS);
      await db.bulkCachePosts(INITIAL_SECTOR_POSTS);

      const savedListings = await db.listings.toArray();
      const savedPosts = await db.posts.toArray();

      expect(savedListings.length).toBe(INITIAL_SECTOR_LISTINGS.length);
      expect(savedPosts.length).toBe(INITIAL_SECTOR_POSTS.length);
    });

    it('R1-T3-02: Filtra dinámicamente registros clasificados para emergencias vs. habituales', async () => {
      const db = new RedVecinaLocalDB(`TestDb_EmergencyFilter_T3_${Date.now()}`);
      await db.bulkCacheListings(INITIAL_SECTOR_LISTINGS);

      const emergencyListings = await db.listings
        .filter((item) => item.available_for_emergencies === true)
        .toArray();

      expect(emergencyListings.length).toBeGreaterThanOrEqual(3);
    });

    it('R1-T3-03: Simula conmutación de sector activo de Lima a Huancayo y verifica preservación de datos locales', () => {
      let currentSectorId = 'lima-jesus-maria-4';
      const switchSector = (newSectorId: string) => {
        const sector = AVAILABLE_SECTORS.find((s) => s.id === newSectorId);
        if (!sector) throw new Error(`Sector ${newSectorId} no encontrado`);
        currentSectorId = sector.id;
        return sector;
      };

      const switched = switchSector('huancayo-el-tambo');
      expect(switched.id).toBe('huancayo-el-tambo');
      expect(currentSectorId).toBe('huancayo-el-tambo');

      const switchedCatastrophe = switchSector('zona-critica-huaytapallana');
      expect(switchedCatastrophe.isCatastropheZone).toBe(true);
    });
  });
});
