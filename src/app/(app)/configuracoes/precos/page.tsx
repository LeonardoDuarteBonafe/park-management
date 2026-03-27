import { PricingSettings } from "@/components/forms/pricing-settings";
import { Card } from "@/components/ui/card";
import { requireAdminUser } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";

export default async function PricingPage() {
  await requireAdminUser();
  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ vehicleType: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Configuração administrativa
        </p>
        <h1 className="mt-2 text-5xl font-semibold tracking-[-0.06em] text-white">
          Tabela de preços
        </h1>
      </Card>
      <PricingSettings initialRules={rules} />
    </div>
  );
}
