import { UsersManager } from "@/components/forms/users-manager";
import { Card } from "@/components/ui/card";
import { requireAdminUser } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";

export default async function UsersPage() {
  await requireAdminUser();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Administração
        </p>
        <h1 className="mt-2 text-5xl font-semibold tracking-[-0.06em] text-white">
          Gestão de usuários
        </h1>
      </Card>
      <UsersManager initialUsers={users} />
    </div>
  );
}
