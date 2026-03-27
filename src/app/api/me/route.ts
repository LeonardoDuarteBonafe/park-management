import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";

export async function GET() {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json(
      {
        error: "Não autenticado.",
      },
      { status: 401 },
    );
  }

  return Response.json({
    user,
  });
}
