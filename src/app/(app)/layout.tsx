import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/data/current-user";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
      }}
      isAdmin={user.role === "ADMIN"}
    >
      {children}
    </AppShell>
  );
}
