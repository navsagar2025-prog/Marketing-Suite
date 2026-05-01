import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { websitesTable } from "./websites";

export const siteAuditStatusEnum = pgEnum("site_audit_status", ["queued", "crawling", "complete", "failed"]);
export const siteAuditSeverityEnum = pgEnum("site_audit_severity", ["critical", "warning", "info"]);

export const siteAuditsTable = pgTable("site_audits", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().references(() => websitesTable.id, { onDelete: "cascade" }),
  status: siteAuditStatusEnum("status").notNull().default("queued"),
  pagesFound: integer("pages_found").notNull().default(0),
  pagesCrawled: integer("pages_crawled").notNull().default(0),
  healthScore: integer("health_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const siteAuditPagesTable = pgTable("site_audit_pages", {
  id: serial("id").primaryKey(),
  siteAuditId: integer("site_audit_id").notNull().references(() => siteAuditsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  statusCode: integer("status_code"),
  title: text("title"),
  metaDescription: text("meta_description"),
  h1: text("h1"),
  wordCount: integer("word_count"),
  responseTimeMs: integer("response_time_ms"),
  issueCount: integer("issue_count").notNull().default(0),
  score: integer("score"),
  crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteAuditIssuesTable = pgTable("site_audit_issues", {
  id: serial("id").primaryKey(),
  siteAuditId: integer("site_audit_id").notNull().references(() => siteAuditsTable.id, { onDelete: "cascade" }),
  pageUrl: text("page_url").notNull(),
  issueType: text("issue_type").notNull(),
  severity: siteAuditSeverityEnum("severity").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
});

export type SiteAudit = typeof siteAuditsTable.$inferSelect;
export type SiteAuditPage = typeof siteAuditPagesTable.$inferSelect;
export type SiteAuditIssue = typeof siteAuditIssuesTable.$inferSelect;
