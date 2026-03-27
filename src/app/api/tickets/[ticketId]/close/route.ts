import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { getExitPreview } from "@/lib/services/tickets";

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
    const body = (await request.json().catch(() => null)) as
      | {
          lostTicket?: boolean;
          discountAmountCents?: number;
          exitAt?: string;
        }
      | null;

    const preview = await getExitPreview({
      ticketId,
      lostTicket: Boolean(body?.lostTicket),
      discountAmountCents: Number(body?.discountAmountCents ?? 0),
      exitAt: body?.exitAt ? new Date(body.exitAt) : undefined,
    });

    return Response.json(preview);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha ao calcular saída.",
      },
      { status: 400 },
    );
  }
}
