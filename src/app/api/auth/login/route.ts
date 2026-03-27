import { AuditAction } from "@prisma/client";

import { authenticateUser, createSession } from "@/lib/auth/auth";
import { createAuditLog } from "@/lib/services/audit";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const user = await authenticateUser(parsed.data.email, parsed.data.password);

    if (!user) {
      return Response.json(
        {
          error: "Credenciais inválidas.",
        },
        { status: 401 },
      );
    }

    await createSession(user);

    await createAuditLog({
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: "User",
      entityId: user.id,
      description: "Login realizado com sucesso.",
      metadata: {
        email: user.email,
      },
    });

    return Response.json({
      ok: true,
      user,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Não foi possível realizar o login.",
      },
      { status: 500 },
    );
  }
}
