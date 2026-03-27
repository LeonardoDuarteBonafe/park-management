import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { finalizeTicketPayment } from "@/lib/services/tickets";
import { paymentSchema } from "@/lib/validation/tickets";

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
    const body = await request.json();
    const parsed = paymentSchema.safeParse({
      ...body,
      role: user.role,
    });

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const result = await finalizeTicketPayment({
      ticketId,
      actor: user,
      exitAt: parsed.data.exitAt,
      method: parsed.data.method,
      amountPaidCents: parsed.data.amountPaidCents,
      discountAmountCents: parsed.data.discountAmountCents,
      lostTicket: parsed.data.lostTicket,
      notes: parsed.data.notes,
    });

    return Response.json({
      result,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao registrar pagamento.",
      },
      { status: 400 },
    );
  }
}
