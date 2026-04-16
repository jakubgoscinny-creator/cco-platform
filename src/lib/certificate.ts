/**
 * Certificate issuance and query logic.
 * Issues CEU certificates for passing exam attempts.
 */

import { db } from "./db";
import { certificates, attempts, tests, contacts, ceuItems } from "./schema";
import type { Certificate, CeuItem } from "./schema";
import { eq, and } from "drizzle-orm";
import { getCeuItemsForTest } from "./sync";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Verification code generator — "CCO-A7K2-M9P4"
// ---------------------------------------------------------------------------

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const seg = () => {
    const bytes = crypto.randomBytes(4);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join("");
  };
  return `CCO-${seg()}-${seg()}`;
}

// ---------------------------------------------------------------------------
// Issue certificates for a passing attempt
// ---------------------------------------------------------------------------

export async function issueCertificate(
  attemptId: number,
  contactId: number
): Promise<Certificate[]> {
  // Get attempt
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt || attempt.status !== "submitted") return [];

  // Get test with passing score and CEU links
  const [test] = await db
    .select({
      passingScore: tests.passingScore,
      ceuItemIds: tests.ceuItemIds,
      testName: tests.testName,
    })
    .from(tests)
    .where(eq(tests.podioItemId, attempt.testPodioId))
    .limit(1);

  if (!test?.ceuItemIds?.length) return [];

  const score = attempt.scorePercent ? Number(attempt.scorePercent) : 0;
  const threshold = test.passingScore ?? 70;
  if (score < threshold) return [];

  // Get contact name
  const [contact] = await db
    .select({ fullName: contacts.fullName })
    .from(contacts)
    .where(eq(contacts.podioItemId, contactId))
    .limit(1);

  const studentName = contact?.fullName ?? "Student";

  // Get CEU items from Podio/Neon
  const ceuItemList = await getCeuItemsForTest(attempt.testPodioId);
  if (!ceuItemList.length) return [];

  const issued: Certificate[] = [];

  for (const ceu of ceuItemList) {
    // Check if already issued (idempotent)
    const [existing] = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.attemptId, attemptId),
          eq(certificates.ceuItemPodioId, ceu.podioItemId)
        )
      )
      .limit(1);

    if (existing) {
      issued.push(existing);
      continue;
    }

    const cert: typeof certificates.$inferInsert = {
      attemptId,
      contactId,
      ceuItemPodioId: ceu.podioItemId,
      testPodioId: attempt.testPodioId,
      verificationCode: generateVerificationCode(),
      templateFileId: ceu.certificateTemplateFileId,
      studentName,
      eventTitle: ceu.title,
      ceuIndexNumber: ceu.ceuIndexNumber,
      ceuValue: ceu.ceuValue,
      aapcCeuTypes: ceu.aapcCeuTypes,
      completionDate: attempt.submittedAt ?? new Date(),
    };

    const [inserted] = await db
      .insert(certificates)
      .values(cert)
      .returning();

    issued.push(inserted);
  }

  return issued;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function getCertificatesForAttempt(
  attemptId: number
): Promise<Certificate[]> {
  return db
    .select()
    .from(certificates)
    .where(eq(certificates.attemptId, attemptId));
}

export async function getCertificateById(
  id: number
): Promise<Certificate | null> {
  const [cert] = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, id))
    .limit(1);
  return cert ?? null;
}
