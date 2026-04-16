import {
  pgTable,
  bigint,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  serial,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Podio mirror tables
// ---------------------------------------------------------------------------

export const tests = pgTable("tests", {
  podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
  testName: text("test_name").notNull(),
  testType: text("test_type"), // 'Static' | 'Random'
  description: text("description"),
  domainIds: bigint("domain_ids", { mode: "number" }).array(),
  questionCount: integer("question_count"),
  timeLimitMinutes: integer("time_limit_minutes"),
  passingScore: integer("passing_score"),
  status: text("status"),
  ceuItemIds: bigint("ceu_item_ids", { mode: "number" }).array(),
  payload: jsonb("payload"), // full Podio field snapshot
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const questions = pgTable("questions", {
  podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
  domainId: bigint("domain_id", { mode: "number" }),
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull(), // [{key, text}]
  correctKey: text("correct_key").notNull(),
  rationale: text("rationale"),
  difficulty: text("difficulty"), // 'Foundational' | 'Intermediate' | 'Advanced'
  disposition: text("disposition"), // 'Course Exam' | 'Practice Exam' | etc.
  status: text("status"),
  payload: jsonb("payload"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const domains = pgTable("domains", {
  podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  credential: text("credential").array(), // ['CPC', 'COC', ...]
  status: text("status"),
  cpcQuestionCount: integer("cpc_question_count"),
  payload: jsonb("payload"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const ceuItems = pgTable("ceu_items", {
  podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
  ceuIndexNumber: text("ceu_index_number"),
  title: text("title").notNull(),
  aapcCeuTypes: text("aapc_ceu_types").array(), // ["Core A", "Risk Adjustment - CRC"]
  ceuValue: numeric("ceu_value", { precision: 4, scale: 2 }),
  dateExpires: timestamp("date_expires", { withTimezone: true }),
  certificateStatus: text("certificate_status"),
  relatedTestPodioId: bigint("related_test_podio_id", { mode: "number" }),
  certificateTemplateFileId: bigint("certificate_template_file_id", { mode: "number" }),
  payload: jsonb("payload"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const contacts = pgTable(
  "contacts",
  {
    podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name"),
    circleMember: boolean("circle_member").default(false).notNull(),
    payload: jsonb("payload"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("contacts_email_idx").on(table.email)]
);

// ---------------------------------------------------------------------------
// Platform-owned tables
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: bigint("contact_id", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  contactId: bigint("contact_id", { mode: "number" }).notNull(),
  testPodioId: bigint("test_podio_id", { mode: "number" }).notNull(),
  status: text("status").default("in_progress"), // 'in_progress' | 'submitted' | 'timed_out'
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  timeRemainingSeconds: integer("time_remaining_seconds"),
  scorePercent: numeric("score_percent", { precision: 5, scale: 2 }),
  domainScores: jsonb("domain_scores"), // {domainId: {correct, total}}
  scratchPad: text("scratch_pad"),
  podioSynced: boolean("podio_synced").default(false),
  questionOrder: bigint("question_order", { mode: "number" }).array(),
  questionSnapshots: jsonb("question_snapshots"), // frozen question data at attempt time
  highlights: jsonb("highlights"), // {questionId: highlightedHTML}
  paneWidth: numeric("pane_width", { precision: 4, scale: 1 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id").notNull(),
    questionPodioId: bigint("question_podio_id", { mode: "number" }).notNull(),
    selectedKey: text("selected_key"), // null = skipped
    isCorrect: boolean("is_correct"),
    flagged: boolean("flagged").default(false),
    timeSpentSeconds: integer("time_spent_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("answers_attempt_question_idx").on(
      table.attemptId,
      table.questionPodioId
    ),
  ]
);

export const certificates = pgTable(
  "certificates",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id").notNull(),
    contactId: bigint("contact_id", { mode: "number" }).notNull(),
    ceuItemPodioId: bigint("ceu_item_podio_id", { mode: "number" }).notNull(),
    testPodioId: bigint("test_podio_id", { mode: "number" }).notNull(),
    verificationCode: text("verification_code").notNull(),
    templateFileId: bigint("template_file_id", { mode: "number" }), // Podio file_id of AAPC PDF template
    studentName: text("student_name").notNull(),
    eventTitle: text("event_title").notNull(),
    ceuIndexNumber: text("ceu_index_number"),
    ceuValue: numeric("ceu_value", { precision: 4, scale: 2 }),
    aapcCeuTypes: text("aapc_ceu_types").array(),
    completionDate: timestamp("completion_date", { withTimezone: true }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("certificates_verification_code_idx").on(table.verificationCode),
    uniqueIndex("certificates_attempt_ceu_idx").on(table.attemptId, table.ceuItemPodioId),
  ]
);

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull(),
  questionPodioId: bigint("question_podio_id", { mode: "number" }).notNull(),
  difficultyRating: text("difficulty_rating"), // 'easy' | 'medium' | 'hard'
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type Test = typeof tests.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type CeuItem = typeof ceuItems.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
