import { requireAdminUser } from "@/lib/auth/auth";
import { getHistoryReports } from "@/lib/services/dashboard";
import { resolveDateRange } from "@/lib/utils/date-range";
import { formatCurrencyFromCents, formatDateTime, formatPaymentMethod } from "@/lib/utils/format";
import { Card } from "@/components/ui/card";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const params = await searchParams;
  const range = resolveDateRange({
    preset: typeof params.preset === "string" ? params.preset : "last7",
    start: typeof params.start === "string" ? params.start : undefined,
    end: typeof params.end === "string" ? params.end : undefined,
  });
  const reports = await getHistoryReports({
    start: range.start,
    end: range.end,
  });

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Relatórios
        </p>
        <h1 className="mt-2 text-5xl font-semibold tracking-[-0.06em] text-white">
          Histórico de movimentações
        </h1>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Período: {formatDateTime(range.start)} até {formatDateTime(range.end)}
        </p>
      </Card>

      <Card>
        <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">Tickets abertos</h2>
        <div className="mt-5 space-y-3">
          {reports.openTickets.map((ticket) => (
            <div key={ticket.id} className="rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
              <p className="font-semibold text-white">{ticket.plate} • {ticket.ticketNumber}</p>
              <p className="mt-2">Entrada: {formatDateTime(ticket.entryAt)}</p>
              <p>Operador: {ticket.entryRegisteredBy.name}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">Tickets fechados</h2>
        <div className="mt-5 space-y-3">
          {reports.closedTickets.map((ticket) => (
            <div key={ticket.id} className="rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
              <p className="font-semibold text-white">{ticket.plate} • {ticket.ticketNumber}</p>
              <p className="mt-2">Entrada: {formatDateTime(ticket.entryAt)}</p>
              <p>Saída: {formatDateTime(ticket.exitAt)}</p>
              <p>Valor: {formatCurrencyFromCents(ticket.payment?.amountChargedCents ?? 0)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">Pagamentos</h2>
        <div className="mt-5 space-y-3">
          {reports.payments.map((payment) => (
            <div key={payment.id} className="rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
              <p className="font-semibold text-white">
                {payment.ticket.plate} • {formatCurrencyFromCents(payment.amountChargedCents)}
              </p>
              <p className="mt-2">Forma: {formatPaymentMethod(payment.method)}</p>
              <p>Data: {formatDateTime(payment.paidAt)}</p>
              <p>Operador: {payment.registeredBy.name}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">Auditoria por operador</h2>
        <div className="mt-5 space-y-3">
          {reports.operatorMovements.map((movement) => (
            <div key={movement.id} className="rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
              <p className="font-semibold text-white">{movement.actor?.name ?? "Sistema"}</p>
              <p className="mt-2">{movement.description}</p>
              <p>{formatDateTime(movement.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
