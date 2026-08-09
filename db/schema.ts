import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const regions = sqliteTable(
  "regions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("regions_name_unique").on(table.name),
    uniqueIndex("regions_code_unique").on(table.code),
  ],
);

export const constituencies = sqliteTable(
  "constituencies",
  {
    id: text("id").primaryKey(),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("constituencies_region_name_unique").on(table.regionId, table.name),
    uniqueIndex("constituencies_code_unique").on(table.code),
    index("constituencies_region_idx").on(table.regionId),
  ],
);

export const electoralAreas = sqliteTable(
  "electoral_areas",
  {
    id: text("id").primaryKey(),
    constituencyId: text("constituency_id")
      .notNull()
      .references(() => constituencies.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("electoral_areas_constituency_name_unique").on(
      table.constituencyId,
      table.name,
    ),
    index("electoral_areas_constituency_idx").on(table.constituencyId),
  ],
);

export const pollingStations = sqliteTable(
  "polling_stations",
  {
    id: text("id").primaryKey(),
    electoralAreaId: text("electoral_area_id")
      .notNull()
      .references(() => electoralAreas.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("polling_stations_code_unique").on(table.code),
    index("polling_stations_electoral_area_idx").on(table.electoralAreaId),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    role: text("role", { enum: ["admin", "campaign_manager", "viewer"] })
      .notNull()
      .default("campaign_manager"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    pollingStationId: text("polling_station_id").references(() => pollingStations.id, {
      onDelete: "set null",
    }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phoneNumber: text("phone_number").notNull(),
    preferredLanguage: text("preferred_language").notNull().default("en"),
    consentStatus: text("consent_status", {
      enum: ["pending", "opted_in", "opted_out"],
    })
      .notNull()
      .default("pending"),
    consentSource: text("consent_source"),
    optedInAt: text("opted_in_at"),
    optedOutAt: text("opted_out_at"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contacts_phone_number_unique").on(table.phoneNumber),
    index("contacts_polling_station_idx").on(table.pollingStationId),
    index("contacts_consent_active_idx").on(table.consentStatus, table.isActive),
    index("contacts_name_idx").on(table.lastName, table.firstName),
  ],
);

export const contactGroups = sqliteTable(
  "contact_groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [uniqueIndex("contact_groups_name_unique").on(table.name)],
);

export const contactGroupMembers = sqliteTable(
  "contact_group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => contactGroups.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    addedAt: text("added_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.contactId] }),
    index("contact_group_members_contact_idx").on(table.contactId),
  ],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    message: text("message").notNull(),
    status: text("status", {
      enum: ["draft", "scheduled", "sending", "completed", "cancelled", "failed"],
    })
      .notNull()
      .default("draft"),
    audienceType: text("audience_type", {
      enum: ["individual", "group", "location"],
    }).notNull(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    groupId: text("group_id").references(() => contactGroups.id, { onDelete: "set null" }),
    regionId: text("region_id").references(() => regions.id, { onDelete: "set null" }),
    constituencyId: text("constituency_id").references(() => constituencies.id, {
      onDelete: "set null",
    }),
    electoralAreaId: text("electoral_area_id").references(() => electoralAreas.id, {
      onDelete: "set null",
    }),
    pollingStationId: text("polling_station_id").references(() => pollingStations.id, {
      onDelete: "set null",
    }),
    scheduledAt: text("scheduled_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    estimatedRecipients: integer("estimated_recipients").notNull().default(0),
    smsParts: integer("sms_parts").notNull().default(1),
    estimatedCostPesewas: integer("estimated_cost_pesewas").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("campaigns_status_scheduled_idx").on(table.status, table.scheduledAt),
    index("campaigns_created_by_idx").on(table.createdById),
    index("campaigns_region_idx").on(table.regionId),
    index("campaigns_constituency_idx").on(table.constituencyId),
    index("campaigns_electoral_area_idx").on(table.electoralAreaId),
    index("campaigns_polling_station_idx").on(table.pollingStationId),
  ],
);

export const campaignRecipients = sqliteTable(
  "campaign_recipients",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    phoneNumber: text("phone_number").notNull(),
    firstName: text("first_name").notNull().default(""),
    pollingStationName: text("polling_station_name"),
    personalizedMessage: text("personalized_message").notNull(),
    deliveryStatus: text("delivery_status", {
      enum: ["queued", "submitted", "delivered", "failed", "skipped"],
    })
      .notNull()
      .default("queued"),
    failureReason: text("failure_reason"),
    deliveredAt: text("delivered_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("campaign_recipients_campaign_phone_unique").on(
      table.campaignId,
      table.phoneNumber,
    ),
    index("campaign_recipients_campaign_status_idx").on(
      table.campaignId,
      table.deliveryStatus,
    ),
    index("campaign_recipients_contact_idx").on(table.contactId),
  ],
);

export const deliveryAttempts = sqliteTable(
  "delivery_attempts",
  {
    id: text("id").primaryKey(),
    campaignRecipientId: text("campaign_recipient_id")
      .notNull()
      .references(() => campaignRecipients.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerMessageId: text("provider_message_id"),
    status: text("status", {
      enum: ["submitted", "accepted", "delivered", "failed", "rejected"],
    }).notNull(),
    responseCode: text("response_code"),
    responseMessage: text("response_message"),
    attemptedAt: text("attempted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("delivery_attempts_recipient_idx").on(table.campaignRecipientId),
    uniqueIndex("delivery_attempts_provider_message_unique").on(
      table.provider,
      table.providerMessageId,
    ),
  ],
);

export const smsCreditTransactions = sqliteTable(
  "sms_credit_transactions",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["purchase", "campaign_debit", "refund", "adjustment"] })
      .notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("sms_credit_transactions_created_idx").on(table.createdAt),
    index("sms_credit_transactions_campaign_idx").on(table.campaignId),
  ],
);

export type Region = typeof regions.$inferSelect;
export type Constituency = typeof constituencies.$inferSelect;
export type ElectoralArea = typeof electoralAreas.$inferSelect;
export type PollingStation = typeof pollingStations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
