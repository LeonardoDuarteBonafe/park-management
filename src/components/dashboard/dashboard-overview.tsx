"use client";

import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip, BarChart, Bar } from "recharts";

import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrencyFromCents, formatDateTime, formatPaymentMethod } from "@/lib/utils/format";

type DashboardOverviewProps = {
  summary: {
    entries: number;
    finalized: number;
    openTickets: number;
    totalRevenueCents: number;
    averageTicketCents: number;
    averageStayMinutes: number;
    paymentsByMethod: Array<{
      method: "CREDIT_CARD" | "DEBIT_CARD" | "PIX" | "CASH";
      totalCents: number;
      count: number;
    }>;
    weeklySeries: Array<{
      label: string;
      entradas: number;
      receita: number;
    }>;
    monthlySeries: Array<{
      label: string;
      entradas: number;
      receita: number;
    }>;
    recentTickets: Array<{
      id: string;
      ticketNumber: string;
      plate: string;
      entryAt: string | Date;
      exitAt: string | Date | null;
      status: "OPEN" | "CLOSED" | "CANCELLED";
      finalAmountCents: number | null;
      entryRegisteredBy: { name: string };
      exitRegisteredBy: { name: string } | null;
      payment: { amountChargedCents: number } | null;
    }>;
    operatorPerformance: Array<{
      operatorId: string;
      operatorName: string;
      totalCents: number;
      payments: number;
    }>;
  };
};

export function DashboardOverview({ summary }: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard eyebrow="Entradas" value={String(summary.entries)} detail="Veículos registrados no período." />
        <StatCard eyebrow="Finalizados" value={String(summary.finalized)} detail="Tickets encerrados com saída confirmada." />
        <StatCard eyebrow="Abertos" value={String(summary.openTickets)} detail="Tickets ainda em permanência." />
        <StatCard eyebrow="Arrecadação" value={formatCurrencyFromCents(summary.totalRevenueCents)} detail={`Ticket médio ${formatCurrencyFromCents(summary.averageTicketCents)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Ritmo semanal
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
                Entradas e receita
              </h2>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Permanência média: {Math.round(summary.averageStayMinutes / 60)}h {summary.averageStayMinutes % 60}m
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.weeklySeries}>
                <defs>
                  <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffb83d" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#ffb83d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" stroke="#9ca9bb" />
                <Tooltip
                  contentStyle={{
                    background: "#182231",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 20,
                  }}
                  formatter={(value, name) =>
                    name === "receita"
                      ? formatCurrencyFromCents(Number(value ?? 0))
                      : Number(value ?? 0)
                  }
                />
                <Area type="monotone" dataKey="receita" stroke="#ffb83d" fill="url(#areaRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="entradas" stroke="#5bc0ff" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Forma de pagamento
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
            Mix financeiro
          </h2>
          <div className="mt-6 space-y-3">
            {summary.paymentsByMethod.map((item) => (
              <div key={item.method} className="rounded-[22px] bg-[var(--color-panel-strong)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{formatPaymentMethod(item.method)}</p>
                  <p className="text-sm text-[var(--color-muted)]">{item.count} pagamento(s)</p>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-accent)]">
                  {formatCurrencyFromCents(item.totalCents)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Operadores
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
            Desempenho por caixa
          </h2>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.operatorPerformance}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="operatorName" stroke="#9ca9bb" />
                <Tooltip
                  contentStyle={{
                    background: "#182231",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 20,
                  }}
                  formatter={(value) => formatCurrencyFromCents(Number(value ?? 0))}
                />
                <Bar dataKey="totalCents" fill="#5bc0ff" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Movimentações recentes
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
                Últimos tickets
              </h2>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {summary.recentTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-[24px] bg-[var(--color-panel-strong)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{ticket.plate}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                      {ticket.ticketNumber}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--color-accent)]">
                    {formatCurrencyFromCents(ticket.payment?.amountChargedCents ?? ticket.finalAmountCents ?? 0)}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-2">
                  <p>Entrada: {formatDateTime(ticket.entryAt)}</p>
                  <p>Saída: {formatDateTime(ticket.exitAt)}</p>
                  <p>Operador entrada: {ticket.entryRegisteredBy.name}</p>
                  <p>Operador saída: {ticket.exitRegisteredBy?.name ?? "-"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
