/**
 * @file src/server/db/schema.ts
 * @description Capa 1 (MOD-02) — Esquema Relacional Tipado en Drizzle ORM (13 Tablas en 3FN/BCNF).
 * Refleja con exactitud `001_initial_enterprise_schema.sql`.
 */

import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. district
// ============================================================================
export const district = pgTable(
  'district',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    ubigeo_code: varchar('ubigeo_code', { length: 6 }).notNull().unique(),
    name: text('name').notNull(),
    province: text('province').notNull().default('Lima'),
    department: text('department').notNull().default('Lima'),
    emergency_active: boolean('emergency_active').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_district_ubigeo').on(table.ubigeo_code)]
);

// ============================================================================
// 2. neighborhood_sector
// ============================================================================
export const neighborhood_sector = pgTable(
  'neighborhood_sector',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    district_id: bigint('district_id', { mode: 'number' })
      .notNull()
      .references(() => district.id, { onDelete: 'restrict' }),
    sector_code: varchar('sector_code', { length: 20 }).notNull().unique(),
    name: text('name').notNull(),
    center_lat: doublePrecision('center_lat').notNull(),
    center_lng: doublePrecision('center_lng').notNull(),
    radius_meters: integer('radius_meters').notNull().default(1000),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_sector_district').on(table.district_id),
    check('chk_sector_lat', sql`${table.center_lat} BETWEEN -90 AND 90`),
    check('chk_sector_lng', sql`${table.center_lng} BETWEEN -180 AND 180`),
    check('chk_sector_radius', sql`${table.radius_meters} > 0`),
  ]
);

// ============================================================================
// 3. user_profile
// ============================================================================
export const user_profile = pgTable(
  'user_profile',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    public_id: uuid('public_id').notNull().defaultRandom().unique(),
    sector_id: bigint('sector_id', { mode: 'number' })
      .notNull()
      .references(() => neighborhood_sector.id, { onDelete: 'restrict' }),
    full_name: text('full_name').notNull(),
    phone_number: varchar('phone_number', { length: 20 }).notNull().unique(),
    email: text('email').unique(),
    home_lat: doublePrecision('home_lat').notNull(),
    home_lng: doublePrecision('home_lng').notNull(),
    is_verified_neighbor: boolean('is_verified_neighbor').notNull().default(false),
    verification_method: text('verification_method').notNull().default('SMS_GEO'),
    system_role: text('system_role').notNull().default('VECINO'),
    reputation_points: integer('reputation_points').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_user_sector').on(table.sector_id),
    index('idx_user_role_verif').on(table.system_role, table.is_verified_neighbor),
  ]
);

// ============================================================================
// 4. support_group
// ============================================================================
export const support_group = pgTable(
  'support_group',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    public_id: uuid('public_id').notNull().defaultRandom().unique(),
    sector_id: bigint('sector_id', { mode: 'number' })
      .notNull()
      .references(() => neighborhood_sector.id, { onDelete: 'restrict' }),
    coordinator_user_id: bigint('coordinator_user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    group_type: text('group_type').notNull(),
    description: text('description').notNull(),
    contact_phone: varchar('contact_phone', { length: 20 }).notNull(),
    meeting_point_lat: doublePrecision('meeting_point_lat').notNull(),
    meeting_point_lng: doublePrecision('meeting_point_lng').notNull(),
    meeting_point_address: text('meeting_point_address').notNull(),
    operational_status: text('operational_status').notNull().default('ACTIVO'),
    is_verified_by_municipality: boolean('is_verified_by_municipality').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_support_group_sector').on(table.sector_id),
    index('idx_support_group_coordinator').on(table.coordinator_user_id),
  ]
);

// ============================================================================
// 5. support_group_member
// ============================================================================
export const support_group_member = pgTable(
  'support_group_member',
  {
    group_id: bigint('group_id', { mode: 'number' })
      .notNull()
      .references(() => support_group.id, { onDelete: 'cascade' }),
    user_id: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'cascade' }),
    member_role: text('member_role').notNull().default('VOLUNTARIO'),
    joined_at: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.group_id, table.user_id] }),
    index('idx_group_member_user').on(table.user_id),
  ]
);

// ============================================================================
// 6. category_catalog
// ============================================================================
export const category_catalog = pgTable('category_catalog', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  name: text('name').notNull(),
  module_scope: text('module_scope').notNull(),
  is_emergency_critical: boolean('is_emergency_critical').notNull().default(false),
  priority_weight: smallint('priority_weight').notNull().default(1),
  icon_name: varchar('icon_name', { length: 40 }).notNull().default('wrench'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 7. proximity_listing
// ============================================================================
export const proximity_listing = pgTable(
  'proximity_listing',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    client_mutation_id: uuid('client_mutation_id').notNull().defaultRandom().unique(),
    owner_user_id: bigint('owner_user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'restrict' }),
    support_group_id: bigint('support_group_id', { mode: 'number' }).references(
      () => support_group.id,
      { onDelete: 'set null' }
    ),
    sector_id: bigint('sector_id', { mode: 'number' })
      .notNull()
      .references(() => neighborhood_sector.id, { onDelete: 'restrict' }),
    category_id: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => category_catalog.id, { onDelete: 'restrict' }),
    listing_type: text('listing_type').notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    description: text('description').notNull(),
    contact_phone: varchar('contact_phone', { length: 20 }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    available_for_emergencies: boolean('available_for_emergencies').notNull().default(false),
    emergency_response_note: text('emergency_response_note'),
    endorsement_count: integer('endorsement_count').notNull().default(0),
    weighted_trust_score: numeric('weighted_trust_score', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_listing_owner').on(table.owner_user_id),
    index('idx_listing_support_group').on(table.support_group_id),
    index('idx_listing_category').on(table.category_id),
    index('idx_listing_sector_cat')
      .on(table.sector_id, table.category_id)
      .where(sql`${table.is_active} = TRUE`),
    index('idx_listing_emergency')
      .on(table.sector_id, table.weighted_trust_score)
      .where(sql`${table.is_active} = TRUE AND ${table.available_for_emergencies} = TRUE`),
  ]
);

// ============================================================================
// 8. neighbor_endorsement
// ============================================================================
export const neighbor_endorsement = pgTable(
  'neighbor_endorsement',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    client_mutation_id: uuid('client_mutation_id').notNull().defaultRandom().unique(),
    listing_id: bigint('listing_id', { mode: 'number' })
      .notNull()
      .references(() => proximity_listing.id, { onDelete: 'cascade' }),
    endorser_user_id: bigint('endorser_user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'restrict' }),
    distance_meters: integer('distance_meters').notNull().default(0),
    proximity_weight: numeric('proximity_weight', { precision: 3, scale: 2 })
      .notNull()
      .default('1.00'),
    comment: varchar('comment', { length: 300 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_endorsement_listing_user').on(table.listing_id, table.endorser_user_id),
    index('idx_endorsement_listing').on(table.listing_id),
    index('idx_endorsement_user').on(table.endorser_user_id),
  ]
);

// ============================================================================
// 9. community_post
// ============================================================================
export const community_post = pgTable(
  'community_post',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    client_mutation_id: uuid('client_mutation_id').notNull().defaultRandom().unique(),
    author_user_id: bigint('author_user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'restrict' }),
    sector_id: bigint('sector_id', { mode: 'number' })
      .notNull()
      .references(() => neighborhood_sector.id, { onDelete: 'restrict' }),
    category_id: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => category_catalog.id, { onDelete: 'restrict' }),
    operational_mode: text('operational_mode').notNull(),
    post_type: text('post_type').notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    description: text('description').notNull(),
    urgency_level: text('urgency_level').notNull().default('MEDIA'),
    public_lat: doublePrecision('public_lat').notNull(),
    public_lng: doublePrecision('public_lng').notNull(),
    privacy_radius_meters: integer('privacy_radius_meters').notNull().default(0),
    status: text('status').notNull().default('ACTIVO'),
    ai_triaged: boolean('ai_triaged').notNull().default(false),
    has_monetary_intent: boolean('has_monetary_intent').notNull().default(false),
    zero_money_compliant: boolean('zero_money_compliant').notNull().default(true),
    client_created_at: timestamp('client_created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_post_author').on(table.author_user_id),
    index('idx_post_category').on(table.category_id),
    index('idx_post_feed')
      .on(table.sector_id, table.operational_mode, table.urgency_level, table.created_at)
      .where(sql`${table.status} IN ('ACTIVO', 'EN_COORDINACION')`),
  ]
);

// ============================================================================
// 10. post_sensitive_pii
// ============================================================================
export const post_sensitive_pii = pgTable('post_sensitive_pii', {
  post_id: bigint('post_id', { mode: 'number' })
    .primaryKey()
    .references(() => community_post.id, { onDelete: 'cascade' }),
  exact_lat: doublePrecision('exact_lat').notNull(),
  exact_lng: doublePrecision('exact_lng').notNull(),
  exact_address_reference: text('exact_address_reference').notNull(),
  vulnerable_person_name: text('vulnerable_person_name'),
  medical_or_mobility_notes: text('medical_or_mobility_notes'),
  emergency_contact_phone: varchar('emergency_contact_phone', { length: 20 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 11. pii_access_audit_log
// ============================================================================
export const pii_access_audit_log = pgTable(
  'pii_access_audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    post_id: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => post_sensitive_pii.post_id, { onDelete: 'restrict' }),
    accessed_by_user_id: bigint('accessed_by_user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'restrict' }),
    access_reason: text('access_reason').notNull(),
    accessed_at: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_pii_audit_post').on(table.post_id),
    index('idx_pii_audit_user').on(table.accessed_by_user_id),
  ]
);

// ============================================================================
// 12. post_resource_item
// ============================================================================
export const post_resource_item = pgTable(
  'post_resource_item',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    client_mutation_id: uuid('client_mutation_id').notNull().defaultRandom().unique(),
    post_id: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => community_post.id, { onDelete: 'cascade' }),
    item_name: varchar('item_name', { length: 80 }).notNull(),
    unit_measure: varchar('unit_measure', { length: 20 }).notNull().default('UNIDAD'),
    quantity_needed: numeric('quantity_needed', { precision: 8, scale: 2 }).notNull(),
    quantity_committed: numeric('quantity_committed', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_resource_item_post').on(table.post_id),
    index('idx_resource_item_mutation').on(table.client_mutation_id),
  ]
);

// ============================================================================
// 13. resource_commitment
// ============================================================================
export const resource_commitment = pgTable(
  'resource_commitment',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    client_mutation_id: uuid('client_mutation_id').notNull().defaultRandom().unique(),
    post_id: bigint('post_id', { mode: 'number' })
      .notNull()
      .references(() => community_post.id, { onDelete: 'restrict' }),
    resource_item_id: bigint('resource_item_id', { mode: 'number' }).references(
      () => post_resource_item.id,
      { onDelete: 'set null' }
    ),
    post_client_mutation_id: uuid('post_client_mutation_id').references(
      () => community_post.client_mutation_id,
      { onDelete: 'restrict' }
    ),
    resource_item_client_mutation_id: uuid('resource_item_client_mutation_id').references(
      () => post_resource_item.client_mutation_id,
      { onDelete: 'set null' }
    ),
    helper_user_id: bigint('helper_user_id', { mode: 'number' })
      .notNull()
      .references(() => user_profile.id, { onDelete: 'restrict' }),
    support_group_id: bigint('support_group_id', { mode: 'number' }).references(
      () => support_group.id,
      { onDelete: 'set null' }
    ),
    committed_quantity: numeric('committed_quantity', { precision: 8, scale: 2 })
      .notNull()
      .default('1.00'),
    commitment_note: varchar('commitment_note', { length: 250 }).notNull(),
    status: text('status').notNull().default('EN_CAMINO'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_commitment_post').on(table.post_id),
    index('idx_commitment_resource_item').on(table.resource_item_id),
    index('idx_commitment_helper').on(table.helper_user_id),
    index('idx_commitment_support_group').on(table.support_group_id),
  ]
);

// ============================================================================
// RELACIONES TIPADAS DRIZZLE ORM
// ============================================================================
export const districtRelations = relations(district, ({ many }) => ({
  sectors: many(neighborhood_sector),
}));

export const neighborhoodSectorRelations = relations(neighborhood_sector, ({ one, many }) => ({
  district: one(district, {
    fields: [neighborhood_sector.district_id],
    references: [district.id],
  }),
  residents: many(user_profile),
  support_groups: many(support_group),
  listings: many(proximity_listing),
  posts: many(community_post),
}));

export const userProfileRelations = relations(user_profile, ({ one, many }) => ({
  sector: one(neighborhood_sector, {
    fields: [user_profile.sector_id],
    references: [neighborhood_sector.id],
  }),
  coordinated_groups: many(support_group),
  group_memberships: many(support_group_member),
  listings: many(proximity_listing),
  endorsements_given: many(neighbor_endorsement),
  posts: many(community_post),
  commitments: many(resource_commitment),
  pii_audits: many(pii_access_audit_log),
}));

export const supportGroupRelations = relations(support_group, ({ one, many }) => ({
  sector: one(neighborhood_sector, {
    fields: [support_group.sector_id],
    references: [neighborhood_sector.id],
  }),
  coordinator: one(user_profile, {
    fields: [support_group.coordinator_user_id],
    references: [user_profile.id],
  }),
  members: many(support_group_member),
  listings: many(proximity_listing),
  commitments: many(resource_commitment),
}));

export const supportGroupMemberRelations = relations(support_group_member, ({ one }) => ({
  group: one(support_group, {
    fields: [support_group_member.group_id],
    references: [support_group.id],
  }),
  user: one(user_profile, {
    fields: [support_group_member.user_id],
    references: [user_profile.id],
  }),
}));

export const categoryCatalogRelations = relations(category_catalog, ({ many }) => ({
  listings: many(proximity_listing),
  posts: many(community_post),
}));

export const proximityListingRelations = relations(proximity_listing, ({ one, many }) => ({
  owner: one(user_profile, {
    fields: [proximity_listing.owner_user_id],
    references: [user_profile.id],
  }),
  support_group: one(support_group, {
    fields: [proximity_listing.support_group_id],
    references: [support_group.id],
  }),
  sector: one(neighborhood_sector, {
    fields: [proximity_listing.sector_id],
    references: [neighborhood_sector.id],
  }),
  category: one(category_catalog, {
    fields: [proximity_listing.category_id],
    references: [category_catalog.id],
  }),
  endorsements: many(neighbor_endorsement),
}));

export const neighborEndorsementRelations = relations(neighbor_endorsement, ({ one }) => ({
  listing: one(proximity_listing, {
    fields: [neighbor_endorsement.listing_id],
    references: [proximity_listing.id],
  }),
  endorser: one(user_profile, {
    fields: [neighbor_endorsement.endorser_user_id],
    references: [user_profile.id],
  }),
}));

export const communityPostRelations = relations(community_post, ({ one, many }) => ({
  author: one(user_profile, {
    fields: [community_post.author_user_id],
    references: [user_profile.id],
  }),
  sector: one(neighborhood_sector, {
    fields: [community_post.sector_id],
    references: [neighborhood_sector.id],
  }),
  category: one(category_catalog, {
    fields: [community_post.category_id],
    references: [category_catalog.id],
  }),
  sensitive_pii: one(post_sensitive_pii, {
    fields: [community_post.id],
    references: [post_sensitive_pii.post_id],
  }),
  resource_items: many(post_resource_item),
  commitments: many(resource_commitment),
}));

export const postSensitivePiiRelations = relations(post_sensitive_pii, ({ one, many }) => ({
  post: one(community_post, {
    fields: [post_sensitive_pii.post_id],
    references: [community_post.id],
  }),
  audit_logs: many(pii_access_audit_log),
}));

export const piiAccessAuditLogRelations = relations(pii_access_audit_log, ({ one }) => ({
  sensitive_pii: one(post_sensitive_pii, {
    fields: [pii_access_audit_log.post_id],
    references: [post_sensitive_pii.post_id],
  }),
  accessed_by: one(user_profile, {
    fields: [pii_access_audit_log.accessed_by_user_id],
    references: [user_profile.id],
  }),
}));

export const postResourceItemRelations = relations(post_resource_item, ({ one, many }) => ({
  post: one(community_post, {
    fields: [post_resource_item.post_id],
    references: [community_post.id],
  }),
  commitments: many(resource_commitment),
}));

export const resourceCommitmentRelations = relations(resource_commitment, ({ one }) => ({
  post: one(community_post, {
    fields: [resource_commitment.post_id],
    references: [community_post.id],
  }),
  resource_item: one(post_resource_item, {
    fields: [resource_commitment.resource_item_id],
    references: [post_resource_item.id],
  }),
  helper: one(user_profile, {
    fields: [resource_commitment.helper_user_id],
    references: [user_profile.id],
  }),
  support_group: one(support_group, {
    fields: [resource_commitment.support_group_id],
    references: [support_group.id],
  }),
}));

export const schema = {
  district,
  neighborhood_sector,
  user_profile,
  support_group,
  support_group_member,
  category_catalog,
  proximity_listing,
  neighbor_endorsement,
  community_post,
  post_sensitive_pii,
  pii_access_audit_log,
  post_resource_item,
  resource_commitment,
};
