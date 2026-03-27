import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { resolveDateRange } from "@/lib/utils/date-range";
import { formatDateTime } from "@/lib/utils/format";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const preset = typeof params.preset === "string" ? params.preset : "today";
  const start = typeof params.start === "string" ? params.start : undefined;
  const end = typeof params.end === "string" ? params.end : undefined;
  const range = resolveDateRange({ preset, start, end });
  const summary = await getDashboardSummary({
    start: range.start,
    end: range.end,
  });

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Dashboard gerencial
            </p>
            <h2 className="mt-3 text-5xl font-semibold leading-none tracking-[-0.06em] text-white">
              Operação sob controle
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
              Entradas, saídas, faturamento e ritmo da equipe em uma leitura rápida para uso
              na palma da mão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["today", "Hoje"],
              ["last7", "7 dias"],
              ["last30", "30 dias"],
              ["week", "Semana"],
              ["month", "Mês"],
            ].map(([value, label]) => (
              <a key={value} href={`/dashboard?preset=${value}`}>
                <Button variant={preset === value ? "primary" : "secondary"}>{label}</Button>
              </a>
            ))}
          </div>
        </div>
        <div className="mt-6 rounded-[24px] bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
          Período analisado: {formatDateTime(range.start)} até {formatDateTime(range.end)}
        </div>
      </Card>

      <DashboardOverview summary={summary} />
    </div>
  );
}
