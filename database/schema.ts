import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  userId: text("user_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
});

export const scans = pgTable(
  "scans",
  {
    scanId: text("scan_id").primaryKey(),
    userId: text("user_id").references(() => users.userId, { onDelete: "set null" }),
    mediaType: text("media_type").notNull(),
    filename: text("filename"),
    fileSize: integer("file_size"),
    verdict: text("verdict").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    riskLevel: text("risk_level"),
    summary: text("summary"),
    details: jsonb("details").notNull().default(sql`'[]'::jsonb`),
    artifactsDetected: jsonb("artifacts_detected").notNull().default(sql`'[]'::jsonb`),
    recommendation: text("recommendation"),
    audioFeatures: jsonb("audio_features"),
    frameAnalysis: jsonb("frame_analysis"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("scans_user_created_idx").on(table.userId, table.createdAt),
    mediaVerdictIdx: index("scans_media_verdict_idx").on(table.mediaType, table.verdict),
  })
);
