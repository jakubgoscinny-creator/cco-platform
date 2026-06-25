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
  index,
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
  // CCO-T006 + CCO-T033: per-test access tier. Mary tags in the Podio Tests
  // app (16243239), access-tier category field. T006 shipped Free/Member;
  // T033 extends to 'Free' | 'Club' | 'Student' (legacy 'Member' === Club).
  // Untagged tests fall back to Club (fail-closed) in sync; the DB default
  // stays 'Member' (legacy — normalizeAccessTier collapses it to Club).
  accessTier: text("access_tier").notNull().default("Member"),
  // CCO-T033: per-test progress-tracker type for Student-tier gating, mirrored
  // from the Tests app "Progress Tracker Type" category (external_id
  // progress-tracker-type-2), e.g. 'PBC' | 'IPC' | 'RAC'. Null for non-Student
  // tests; a Student-tier test with this null is an admin error (stays locked).
  studentTrackerType: text("student_tracker_type"),
  // CCO-T044 (2026-05-28 meeting): portal visibility is driven by the dedicated
  // "Ready for Portal" Yes/No flag (Podio field 276781364), NOT by overloading
  // Test Status = "Active - In Portal" (cleaner separation of dev-status from
  // student-facing readiness). getActiveTests filters on this. Default false =
  // hidden until Mary flags it Ready.
  readyForPortal: boolean("ready_for_portal").notNull().default(false),
  ceuItemIds: bigint("ceu_item_ids", { mode: "number" }).array(),
  payload: jsonb("payload"), // full Podio field snapshot
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
    domainId: bigint("domain_id", { mode: "number" }),
    questionText: text("question_text").notNull(),
    options: jsonb("options").notNull(), // [{key, text}]
    correctKey: text("correct_key").notNull(),
    rationale: text("rationale"),
    difficulty: text("difficulty"), // 'Foundational' | 'Intermediate' | 'Advanced'
    disposition: text("disposition"), // 'Course Exam' | 'Practice Exam' | etc.
    status: text("status"),
    // CCO-T065: the Podio Tests (16243239) item_ids this question is linked to,
    // mirrored from the QB Multi Choice "Tests" app-ref field (137526907) at
    // sync time. This is the linkage that makes the questions mirror queryable
    // by test — so exam-start can fall back to the last-synced questions when a
    // live Podio sync fails (e.g. HTTP 420 rate-limit — the 2026-06-24 outage).
    // A question can belong to multiple tests, so this is an array; GIN-indexed
    // for the `test_podio_ids @> ARRAY[testId]` containment lookup.
    testPodioIds: bigint("test_podio_ids", { mode: "number" }).array(),
    payload: jsonb("payload"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("questions_test_podio_ids_idx").using("gin", table.testPodioIds),
  ]
);

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
    // Podio CONTACT_FIELDS.SUBSCRIPTION_STATUS (134218375). Active values per
    // Mary (2026-05-14): "Monthly (Grandfathered)", "Monthly (26)",
    // "Active Annual", "Monthly". Anything else (including null) is treated
    // as non-subscriber. See `circle-access.ts`.
    subscriptionStatus: text("subscription_status"),
    // CCO-T033: the progress-tracker types this Contact is enrolled in,
    // resolved from the Podio Progress Tracker app (16163523) at sign-in /
    // SSO callback (mirrored like subscription_status). Drives Student-tier
    // gating: a Student test unlocks when its studentTrackerType is in this
    // set. Null = not yet resolved (treated as no enrollment / non-student).
    enrolledTrackerTypes: text("enrolled_tracker_types").array(),
    // CCO-T031: single-use enforcement for password-reset JWTs. When the
    // /forgot-password action issues a token, we store its jti here. The
    // /reset-password verifier requires the jti claim to match this column
    // AND clears it on successful consumption. Replaying the same link is
    // therefore rejected even within the 30-min TTL. Nullable: cleared on
    // consumption; null = no outstanding reset request.
    passwordResetJti: text("password_reset_jti"),
    payload: jsonb("payload"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [uniqueIndex("contacts_email_idx").on(table.email)]
);

// ---------------------------------------------------------------------------
// Platform-owned tables
// ---------------------------------------------------------------------------

// CCO-T031 hardening: per-key sliding-window rate limiter buckets. Used
// by /forgot-password to keep a single IP from flooding the Podio API
// (which is how my dev-session burned the Podio rate-limit 2026-05-21).
// See src/lib/rate-limit.ts for the checkAndIncrement implementation.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  // CCO-T034: item_id of the Podio Test Results (16234798) row this attempt was
  // replicated to. Null = not yet written. Acts as the idempotency key so a
  // retry / backfill never creates a duplicate Test Results row.
  podioTestResultItemId: bigint("podio_test_result_item_id", { mode: "number" }),
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
    type: text("type").notNull().default("aapc_ceu"), // 'aapc_ceu' | 'cco_credential'
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
    uniqueIndex("certificates_attempt_ceu_type_idx").on(
      table.attemptId,
      table.ceuItemPodioId,
      table.type
    ),
  ]
);

// Lazy-fetched mirror of Podio Test Results (app 16234798) for the
// authenticated student. Score-only legacy data: original answers do
// not exist in Podio for Xenforo/ProProfs imports, so we don't try.
export const legacyTestResults = pgTable(
  "legacy_test_results",
  {
    podioItemId: bigint("podio_item_id", { mode: "number" }).primaryKey(),
    contactItemId: bigint("contact_item_id", { mode: "number" }).notNull(),
    appItemId: integer("app_item_id"),
    dateTaken: timestamp("date_taken", { withTimezone: true }),
    testItemId: bigint("test_item_id", { mode: "number" }),
    testName: text("test_name"),
    scorePercent: numeric("score_percent", { precision: 5, scale: 2 }),
    passed: boolean("passed"),
    source: text("source"),
    type: text("type"),
    durationSeconds: integer("duration_seconds"),
    legacyCertUrl: text("legacy_cert_url"),
    legacyViewUrl: text("legacy_view_url"),
    // For CEU passes, we resolve the AAPC PDF template (uploaded by Mary
    // to the Test's linked CEU Item) at sync time so the gradebook can
    // offer a Download Cert button without an extra Podio round-trip.
    aapcTemplateFileId: bigint("aapc_template_file_id", { mode: "number" }),
    ceuIndexNumber: text("ceu_index_number"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("legacy_results_contact_date_idx").on(
      table.contactItemId,
      table.dateTaken
    ),
  ]
);

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull(),
  questionPodioId: bigint("question_podio_id", { mode: "number" }).notNull(),
  difficultyRating: text("difficulty_rating"), // 'easy' | 'medium' | 'hard'
  comment: text("comment"),
  // CCO-T068: issue category from FEEDBACK_ISSUE_TYPES (wrong_answer | typo |
  // unclear | outdated | other). Nullable — optional in the form.
  issueType: text("issue_type"),
  // CCO-T068: item_id of the row created in the dedicated "CCO Question
  // Feedback" Podio app. Null = Neon-captured but not (yet) mirrored to Podio
  // (a Podio outage at submit time leaves it null + logged, recoverable);
  // mirrors the attempts.podioTestResultItemId idempotency/traceability pattern.
  podioItemId: bigint("podio_item_id", { mode: "number" }),
  contactId: bigint("contact_id", { mode: "number" }), // reporter (resolved from the attempt)
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
export type LegacyTestResult = typeof legacyTestResults.$inferSelect;
