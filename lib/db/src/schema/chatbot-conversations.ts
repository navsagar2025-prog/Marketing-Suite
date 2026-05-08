import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export const chatbotConversationsTable = pgTable("chatbot_conversations", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  pageUrl: text("page_url"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ChatbotConversation = typeof chatbotConversationsTable.$inferSelect;
export type InsertChatbotConversation = typeof chatbotConversationsTable.$inferInsert;
export type ChatbotMessage = { role: "user" | "assistant"; content: string; at?: string };
