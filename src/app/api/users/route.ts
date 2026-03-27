import { AuditAction } from "@prisma/client";
import bcrypt from "bcryptjs";

import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { userSchema } from "@/lib/validation/tickets";

export async function GET() {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({ users });
}

export async function POST(request: Request) {
  const admin = await getAuthenticatedUserOrNull();

  if (!admin) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (admin.role !== "ADMIN") {
    return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = userSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    if (payload.id) {
      const updateData: Record<string, unknown> = {
        name: payload.name,
        email: payload.email.toLowerCase(),
        role: payload.role,
        active: payload.active,
      };

      if (payload.password) {
        updateData.passwordHash = await bcrypt.hash(payload.password, 10);
      }

      const user = await prisma.user.update({
        where: { id: payload.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await createAuditLog({
        actorId: admin.id,
        action: AuditAction.USER_UPDATED,
        entityType: "User",
        entityId: user.id,
        description: `Usuário ${user.name} atualizado.`,
        metadata: {
          role: user.role,
          active: user.active,
        },
      });

      return Response.json({ user });
    }

    if (!payload.password) {
      return Response.json(
        {
          error: "Senha obrigatória para novo usuário.",
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email.toLowerCase(),
        passwordHash: await bcrypt.hash(payload.password, 10),
        role: payload.role,
        active: payload.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      actorId: admin.id,
      action: AuditAction.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      description: `Usuário ${user.name} criado.`,
      metadata: {
        role: user.role,
      },
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao salvar usuário.",
      },
      { status: 400 },
    );
  }
}
