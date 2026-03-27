import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { cancelTicket } from "@/lib/services/tickets";

type Context = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const { ticketId } = await context.params;
    const body = (await request.json().catch(() => null)) as { reason?: string } | null;
    const ticket = await cancelTicket({
      ticketId,
      actor: user,
      reason: body?.reason,
    });

    return Response.json({ ticket });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao cancelar ticket.",
      },
      { status: 400 },
    );
  }
}
