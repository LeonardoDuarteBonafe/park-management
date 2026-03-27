import { AuditAction } from "@prisma/client";

import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { pricingRuleSchema } from "@/lib/validation/tickets";

export async function GET() {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  }

  const rules = await prisma.pricingRule.findMany({
    orderBy: [{ vehicleType: "asc" }, { updatedAt: "desc" }],
  });

  return Response.json({ rules });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = pricingRuleSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const rule = payload.id
      ? await prisma.pricingRule.update({
          where: { id: payload.id },
          data: {
            ...payload,
            updatedById: user.id,
          },
        })
      : await prisma.pricingRule.create({
          data: {
            ...payload,
            createdById: user.id,
            updatedById: user.id,
          },
        });

    await createAuditLog({
      actorId: user.id,
      action: payload.id ? AuditAction.PRICING_RULE_UPDATED : AuditAction.PRICING_RULE_CREATED,
      entityType: "PricingRule",
      entityId: rule.id,
      description: payload.id
        ? `Tabela ${rule.name} atualizada.`
        : `Tabela ${rule.name} criada.`,
      metadata: payload,
    });

    return Response.json({ rule });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao salvar tabela.",
      },
      { status: 400 },
    );
  }
}
