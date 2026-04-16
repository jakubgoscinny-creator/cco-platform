-- Add circle_member column to contacts for Circle SSO
-- Default false so existing rows (password-auth users) are treated as non-Circle members
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "circle_member" boolean DEFAULT false NOT NULL;
