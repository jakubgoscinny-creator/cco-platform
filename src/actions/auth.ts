"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession } from "@/lib/auth";

export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await authenticate(email, password);

  if (!result.success) {
    return { error: result.error };
  }

  await createSession(result.contactId);
  redirect("/catalog");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/sign-in");
}
