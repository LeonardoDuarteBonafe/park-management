import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { recognizeBrazilianPlate } from "@/lib/ocr/python-plate-ocr";
import { plateOcrRequestSchema } from "@/lib/ocr/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = plateOcrRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "Imagem inválida para OCR.",
        },
        { status: 400 },
      );
    }

    const result = await recognizeBrazilianPlate(parsed.data);

    if (!result.plate_normalized || result.plate_format === "invalid") {
      return Response.json(
        {
          error:
            "Não foi possível confirmar uma placa brasileira válida. Faça uma nova captura ou digite manualmente.",
          result,
        },
        { status: 422 },
      );
    }

    return Response.json({ result });
  } catch (error) {
    console.error("[plate-ocr]", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao executar a leitura da placa.",
      },
      { status: 500 },
    );
  }
}
