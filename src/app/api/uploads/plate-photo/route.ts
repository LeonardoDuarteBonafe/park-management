import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { savePlatePhoto } from "@/lib/services/tickets";

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { dataUrl?: string };

    if (!body.dataUrl) {
      return Response.json({ error: "Imagem obrigatória." }, { status: 400 });
    }

    const path = await savePlatePhoto(body.dataUrl);

    return Response.json({ path });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Falha no upload da imagem.",
      },
      { status: 400 },
    );
  }
}
