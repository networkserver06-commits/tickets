import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  buyerEmail: text("buyer_email").notNull(),
  totalAmount: integer("total_amount").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  status: text("status", { enum: ["valid", "used"] })
    .notNull()
    .default("valid"),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  tickets: many(tickets),
}));
export const ticketsRelations = relations(tickets, ({ one }) => ({
  order: one(orders, { fields: [tickets.orderId], references: [orders.id] }),
}));

export type Order = typeof orders.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
