import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { createTicketEntry } from "@/lib/services/tickets";
import { ticketEntrySchema } from "@/lib/validation/tickets";

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { entries?: unknown[] };

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return Response.json({ error: "Nenhuma entrada pendente enviada." }, { status: 400 });
    }

    const results = [];

    for (const entry of body.entries) {
      const parsed = ticketEntrySchema.safeParse(entry);

      if (!parsed.success) {
        results.push({
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        });
        continue;
      }

      const ticket = await createTicketEntry({
        ...parsed.data,
        actor: user,
      });

      results.push({
        ok: true,
        ticket,
      });
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao sincronizar entradas.",
      },
      { status: 400 },
    );
  }
}
