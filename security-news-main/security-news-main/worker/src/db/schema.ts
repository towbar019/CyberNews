import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  real,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

export const periodTypeEnum = pgEnum("period_type", [
  "daily",
  "weekly",
  "monthly",
]);

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 255 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  publishedAt: timestamp("published_at").notNull(),
  content: text("content"),
  profileRelevance: jsonb("profile_relevance").default({}),
  cvssScore: real("cvss_score"),
  isCisaKev: boolean("is_cisa_kev").default(false).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  periodType: periodTypeEnum("period_type").notNull(),
  periodStart: timestamp("period_start").notNull(),
  contentMd: text("content_md").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rssSources = pgTable("rss_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull().unique(),
  lastFetched: timestamp("last_fetched"),
  articleCount: integer("article_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type NewSummary = typeof summaries.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type RssSource = typeof rssSources.$inferSelect;
export type NewRssSource = typeof rssSources.$inferInsert;
