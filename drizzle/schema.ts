import { relations } from "drizzle-orm";
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(), openId: varchar("openId", { length: 64 }).notNull().unique(), name: text("name"),
  email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }), role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey(), buyerEmail: varchar("buyerEmail", { length: 320 }).notNull(), totalAmount: int("totalAmount").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tickets = mysqlTable("tickets", {
  id: varchar("id", { length: 64 }).primaryKey(), orderId: varchar("orderId", { length: 64 }).notNull().references(() => orders.id), status: mysqlEnum("status", ["valid", "used"]).default("valid").notNull(),
});

export const ordersRelations = relations(orders, ({ many }) => ({ tickets: many(tickets) }));
export const ticketsRelations = relations(tickets, ({ one }) => ({ order: one(orders, { fields: [tickets.orderId], references: [orders.id] }) }));
export type User = typeof users.$inferSelect; export type InsertUser = typeof users.$inferInsert; export type Order = typeof orders.$inferSelect; export type Ticket = typeof tickets.$inferSelect;
