import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  providerCustomerId: text("provider_customer_id").notNull(),
  providerSubscriptionId: text("provider_subscription_id").notNull(),
  status: text("status", { enum: ["active", "trialing", "past_due", "canceled"] }).notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("subscriptions_provider_id_unique").on(table.providerSubscriptionId)]);

export const tokenLedger = sqliteTable("token_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason", { enum: ["purchase", "export_authorization", "refund", "admin_adjustment"] }).notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }).notNull(),
});

