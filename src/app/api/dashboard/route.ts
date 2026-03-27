import { getAuthenticatedUserOrNull } from "@/lib/auth/auth";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { resolveDateRange } from "@/lib/utils/date-range";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserOrNull();

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = resolveDateRange({
    preset: searchParams.get("preset"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
  });

  const summary = await getDashboardSummary({
    start: range.start,
    end: range.end,
  });

  return Response.json({
    range,
    summary,
  });
}
