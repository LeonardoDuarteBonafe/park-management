import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { getExitPreview, getTicketById, updateTicket } from "@/lib/services/tickets";
import { ticketUpdateSchema } from "@/lib/validation/tickets";

type Context = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function GET(request: Request, context: Context) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { ticketId } = await context.params;
  const { searchParams } = new URL(request.url);
  const includeQuote = searchParams.get("includeQuote");
  const lostTicket = searchParams.get("lostTicket") === "true";
  const discountAmountCents = Number(searchParams.get("discountAmountCents") ?? "0");

  try {
    if (includeQuote === "true") {
      const preview = await getExitPreview({
        ticketId,
        lostTicket,
        discountAmountCents,
      });

      return Response.json(preview);
    }

    const ticket = await getTicketById(ticketId);

    if (!ticket) {
      return Response.json({ error: "Ticket não encontrado." }, { status: 404 });
    }

    return Response.json({
      ticket,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao carregar ticket.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const { ticketId } = await context.params;
    const body = await request.json();
    const parsed = ticketUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const ticket = await updateTicket({
      ticketId,
      actor: user,
      ...parsed.data,
    });

    return Response.json({
      ticket,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao atualizar ticket.",
      },
      { status: 400 },
    );
  }
}
