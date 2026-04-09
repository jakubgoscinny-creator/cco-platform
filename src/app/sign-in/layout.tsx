// Force dynamic rendering so Server Action IDs stay in sync across deployments
export const dynamic = "force-dynamic";

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
