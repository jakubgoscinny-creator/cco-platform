-- CCO-T031: single-use enforcement for password-reset JWTs.
-- See src/lib/schema.ts (contacts.passwordResetJti) for the column purpose.
--
-- NOTE: drizzle-kit's generator currently shows a lot of drift relative to
-- the live DB because the project has historically applied schema changes
-- via one-off scripts in scripts/apply-*.mjs (T002 / T003 / T006). This
-- migration has been hand-trimmed to ONLY the password_reset_jti column so
-- it can be applied safely on top of the live schema. The apply path is
-- scripts/apply-t031-password-reset-jti.mjs (idempotent).
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "password_reset_jti" text;
