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
  orderId: text("order_id").notNull().references(() => orders.id),
  status: text("status", { enum: ["valid", "used"] }).notNull().default("valid"),
  scannedAt: text("scanned_at"),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  paystackSubaccountCode: text("paystack_subaccount_code").notNull(),
  platformFeePercentage: integer("platform_fee_percentage").notNull().default(10),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: text("event_date"),
  venue: text("venue"),
  imageUrl: text("image_url"),
  ticketPrice: integer("ticket_price").notNull(),
  capacity: integer("capacity").notNull().default(500),
  soldCount: integer("sold_count").notNull().default(0),
  paystackSubaccountCode: text("paystack_subaccount_code").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const eventTickets = sqliteTable("event_tickets", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  paystackRef: text("paystack_ref").notNull(),
  status: text("status", { enum: ["valid", "used"] }).notNull().default("valid"),
  scannedAt: text("scanned_at"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const ordersRelations = relations(orders, ({ many }) => ({ tickets: many(tickets) }));
export const ticketsRelations = relations(tickets, ({ one }) => ({ order: one(orders, { fields: [tickets.orderId], references: [orders.id] }) }));
export const clientsRelations = relations(clients, ({ many }) => ({ events: many(events) }));
export const eventsRelations = relations(events, ({ one, many }) => ({ client: one(clients, { fields: [events.clientId], references: [clients.id] }), tickets: many(eventTickets) }));
export const eventTicketsRelations = relations(eventTickets, ({ one }) => ({ event: one(events, { fields: [eventTickets.eventId], references: [events.id] }) }));

export type Order = typeof orders.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventTicket = typeof eventTickets.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type InsertEvent = typeof events.$inferInsert;
export type InsertEventTicket = typeof eventTickets.$inferInsert;
