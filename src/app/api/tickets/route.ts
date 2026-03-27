import { TicketStatus } from "@prisma/client";

import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { createTicketEntry, searchTickets } from "@/lib/services/tickets";
import { ticketEntrySchema } from "@/lib/validation/tickets";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "OPEN" || statusParam === "CLOSED" || statusParam === "CANCELLED"
      ? (statusParam as TicketStatus)
      : undefined;

  if (!query) {
    return Response.json({
      tickets: [],
    });
  }

  const tickets = await searchTickets(query, status);

  return Response.json({
    tickets,
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ticketEntrySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const ticket = await createTicketEntry({
      ...parsed.data,
      actor: user,
    });

    return Response.json(
      {
        ticket,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Não foi possível registrar a entrada.",
      },
      { status: 500 },
    );
  }
}
