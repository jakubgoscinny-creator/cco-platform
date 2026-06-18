import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";
import { getSessionContact } from "@/lib/auth";
import { HelpDeskWidget } from "@/components/HelpDeskWidget";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "CCO Academy · Learn it. Get certified. Stay certified.",
    template: "%s · CCO Academy",
  },
  description:
    "CCO Academy — medical coding study portal. Practice exams, CEU quizzes, and certificates. Learn it. Get certified. Stay certified.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the signed-in contact (null on logged-out pages — sign-in,
  // forgot/reset-password — where the widget runs anonymously). The help-desk
  // chat is mounted ONCE here so it appears on every portal surface; the
  // in-exam route is suppressed inside the component itself.
  const user = await getSessionContact().catch(() => null);

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <HelpDeskWidget
          name={user?.fullName ?? user?.email ?? null}
          email={user?.email ?? null}
        />
      </body>
    </html>
  );
}
