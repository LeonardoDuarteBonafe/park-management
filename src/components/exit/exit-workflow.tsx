"use client";

import { PaymentMethod } from "@prisma/client";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/fields";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCurrencyFromCents, formatDateInputValue, formatDateTime, formatDurationBetween } from "@/lib/utils/format";

type SearchTicket = {
  id: string;
  ticketNumber: string;
  plate: string;
  entryAt: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
};

type ExitWorkflowProps = {
  isAdmin: boolean;
};

export function ExitWorkflow({ isAdmin }: ExitWorkflowProps) {
  const scannerRef = useRef<{ clear: () => void | Promise<void> } | null>(null);
  const [query, setQuery] = useState("");
  const [searching, startSearchTransition] = useTransition();
  const [saving, startSavingTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<SearchTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SearchTicket | null>(null);
  const [quote, setQuote] = useState<{
    calculation: {
      finalAmountCents: number;
      grossAmountCents: number;
      ruleLabel: string;
      totalMinutes: number;
    };
    ticket: SearchTicket & { entryAt: string; plate: string };
    exitAt: string;
  } | null>(null);
  const [lostTicket, setLostTicket] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [amountPaid, setAmountPaid] = useState("0");
  const [exitAt, setExitAt] = useState(formatDateInputValue(new Date()));
  const [notes, setNotes] = useState("");

  const refreshQuote = useEffectEvent(async (ticketId: string) => {
    const response = await fetch(`/api/tickets/${ticketId}/close`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lostTicket,
        discountAmountCents: Math.round(Number(discountAmount || "0") * 100),
        exitAt,
      }),
    });

    const data = (await response.json()) as typeof quote & { error?: string };

    if (!response.ok || !data) {
      toast.error(data?.error ?? "Não foi possível calcular a saída.");
      return;
    }

    setQuote(data);
  });

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }

    void refreshQuote(selectedTicket.id);
  }, [selectedTicket, lostTicket, discountAmount, exitAt]);

  useEffect(() => {
    if (!quote) {
      return;
    }

    setAmountPaid(String(quote.calculation.finalAmountCents / 100));
  }, [quote]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  const searchTickets = () => {
    if (!query.trim()) {
      toast.error("Informe placa ou número do ticket.");
      return;
    }

    startSearchTransition(async () => {
      const response = await fetch(`/api/tickets?query=${encodeURIComponent(query)}&status=OPEN`);
      const data = (await response.json()) as { tickets?: SearchTicket[]; error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Falha ao buscar tickets.");
        return;
      }

      setResults(data.tickets ?? []);
      if ((data.tickets ?? []).length === 1) {
        setSelectedTicket(data.tickets![0]);
      }
    });
  };

  const handleFinalize = () => {
    if (!selectedTicket || !quote) {
      toast.error("Selecione um ticket antes de finalizar.");
      return;
    }

    startSavingTransition(async () => {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exitAt,
          method: paymentMethod,
          amountPaidCents: Math.round(Number(amountPaid || "0") * 100),
          amountChargedCents: quote.calculation.finalAmountCents,
          discountAmountCents: Math.round(Number(discountAmount || "0") * 100),
          lostTicket,
          notes,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        result?: { ticket: { ticketNumber: string } };
      };

      if (!response.ok || !data.result) {
        toast.error(data.error ?? "Não foi possível concluir o pagamento.");
        return;
      }

      toast.success("Saída e pagamento registrados.");
      window.location.href = `/ticket/${data.result.ticket.ticketNumber}`;
    });
  };

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      setScanning(true);

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: 240,
        },
        async (decodedText) => {
          setQuery(decodedText);
          await stopScanner();
          toast.success("Ticket lido pela câmera.");
          startSearchTransition(async () => {
            const response = await fetch(`/api/tickets?query=${encodeURIComponent(decodedText)}&status=OPEN`);
            const data = (await response.json()) as { tickets?: SearchTicket[] };
            setResults(data.tickets ?? []);
            if ((data.tickets ?? []).length > 0) {
              setSelectedTicket(data.tickets![0]);
            }
          });
        },
        () => undefined,
      );
    } catch {
      toast.error("Não foi possível iniciar o leitor da câmera.");
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) {
      setScanning(false);
      return;
    }

    try {
      await scannerRef.current.clear();
    } catch {
      // no-op
    }

    scannerRef.current = null;
    setScanning(false);
  };

  const changeAmount = useMemo(() => {
    const paid = Math.round(Number(amountPaid || "0") * 100);
    if (!quote || paymentMethod !== PaymentMethod.CASH) {
      return 0;
    }

    return Math.max(0, paid - quote.calculation.finalAmountCents);
  }, [amountPaid, paymentMethod, quote]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Registrar saída
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
          Leia o ticket ou busque manualmente
        </h2>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => void startScanner()} disabled={scanning}>
            {scanning ? "Scanner ativo" : "Ler por câmera"}
          </Button>
          <Button variant="secondary" onClick={() => void stopScanner()}>
            Parar câmera
          </Button>
        </div>

        <div id="reader" className="mt-5 overflow-hidden rounded-[28px] bg-black" />

        <div className="mt-5 grid gap-4">
          <FieldLabel label="Busca manual">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Número do ticket ou placa"
            />
          </FieldLabel>
          <Button onClick={searchTickets} fullWidth disabled={searching}>
            {searching ? "Buscando..." : "Buscar ticket em aberto"}
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {results.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelectedTicket(ticket)}
              className="w-full rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-left transition hover:bg-[#243246]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{ticket.plate}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    {ticket.ticketNumber}
                  </p>
                </div>
                <StatusPill status={ticket.status} />
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Entrada em {formatDateTime(ticket.entryAt)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Resumo antes do fechamento
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
          Cálculo e pagamento
        </h2>

        {selectedTicket && quote ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] bg-[var(--color-panel-strong)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-white">{quote.ticket.plate}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    {quote.ticket.ticketNumber}
                  </p>
                </div>
                <StatusPill status={quote.ticket.status} />
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[var(--color-muted)] sm:grid-cols-2">
                <p>Entrada: {formatDateTime(quote.ticket.entryAt)}</p>
                <p>Saída: {formatDateTime(quote.exitAt)}</p>
                <p>Tempo: {formatDurationBetween(quote.ticket.entryAt, quote.exitAt)}</p>
                <p>Regra: {quote.calculation.ruleLabel}</p>
              </div>
              <p className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-[var(--color-accent)]">
                {formatCurrencyFromCents(quote.calculation.finalAmountCents)}
              </p>
            </div>

            <FieldLabel label="Horário da saída">
              <Input
                type="datetime-local"
                value={exitAt}
                onChange={(event) => setExitAt(event.target.value)}
              />
            </FieldLabel>

            <FieldLabel label="Forma de pagamento">
              <Select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value={PaymentMethod.CREDIT_CARD}>Cartão de crédito</option>
                <option value={PaymentMethod.DEBIT_CARD}>Cartão de débito</option>
                <option value={PaymentMethod.PIX}>Pix</option>
                <option value={PaymentMethod.CASH}>Dinheiro</option>
              </Select>
            </FieldLabel>

            <FieldLabel label="Valor pago">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
              />
            </FieldLabel>

            {isAdmin ? (
              <FieldLabel label="Desconto manual (R$)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                />
              </FieldLabel>
            ) : null}

            <label className="flex items-center gap-3 rounded-[22px] bg-[var(--color-panel-strong)] px-4 py-4 text-sm text-white">
              <input
                type="checkbox"
                checked={lostTicket}
                onChange={(event) => setLostTicket(event.target.checked)}
              />
              Marcar ticket como extraviado
            </label>

            <FieldLabel label="Observações do pagamento">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: comprovante conferido manualmente."
              />
            </FieldLabel>

            {paymentMethod === PaymentMethod.CASH ? (
              <div className="rounded-[24px] bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-500/20">
                Troco previsto: {formatCurrencyFromCents(changeAmount)}
              </div>
            ) : null}

            <Button onClick={handleFinalize} fullWidth disabled={saving}>
              {saving ? "Finalizando..." : "Registrar pagamento e fechar ticket"}
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-[28px] border border-dashed border-white/12 bg-[var(--color-panel-strong)] p-8 text-sm leading-6 text-[var(--color-muted)]">
            Leia o QR Code ou busque a placa para abrir o resumo de cobrança.
          </div>
        )}
      </Card>
    </div>
  );
}
