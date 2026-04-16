"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession } from "@/lib/auth";

/**
 * Only accept return_to paths that live on our own origin. We require
 * it to start with a single "/" and NOT "//" — `//evil.com` is a
 * protocol-relative URL that the browser would navigate to
 * https://evil.com. Everything else (absolute URLs, missing path,
 * empty string) falls back to /catalog.
 */
function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return "/catalog";
  if (!raw.startsWith("/")) return "/catalog";
  if (raw.startsWith("//")) return "/catalog";
  return raw;
}

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const returnTo = safeReturnTo(formData.get("return_to") as string | null);

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await authenticate(email, password);

  if (!result.success) {
    return { error: result.error };
  }

  await createSession(result.contactId);
  redirect(returnTo);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/sign-in");
}
