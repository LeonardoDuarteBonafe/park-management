"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/fields";
import { StatusPill } from "@/components/ui/status-pill";
import { getCachedTickets } from "@/lib/offline/storage";
import { formatDateTime } from "@/lib/utils/format";

type TicketItem = {
  id: string;
  ticketNumber: string;
  plate: string;
  vehicleType: "CAR" | "MOTORCYCLE" | "UTILITY";
  entryAt: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  notes?: string | null;
};

export function TicketSearch({ isAdmin }: { isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [plate, setPlate] = useState("");
  const [entryAt, setEntryAt] = useState("");
  const [vehicleType, setVehicleType] = useState<"CAR" | "MOTORCYCLE" | "UTILITY">("CAR");
  const [notes, setNotes] = useState("");

  const search = () => {
    if (!window.navigator.onLine) {
      startTransition(async () => {
        const cached = await getCachedTickets();
        setTickets(
          cached.map((ticket) => ({
            id: ticket.ticketNumber,
            ticketNumber: ticket.ticketNumber,
            plate: ticket.plate,
            vehicleType: "CAR",
            entryAt: ticket.entryAt,
            status: ticket.status,
          })),
        );
      });
      toast.message("Sem conexão: mostrando tickets recentes armazenados localmente.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/tickets?query=${encodeURIComponent(query)}`);
      const data = (await response.json()) as { tickets?: TicketItem[]; error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível buscar tickets.");
        return;
      }

      setTickets(data.tickets ?? []);
    });
  };

  const saveChanges = () => {
    if (!selectedTicket) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plate,
          entryAt,
          vehicleType,
          notes,
        }),
      });

      const data = (await response.json()) as { ticket?: TicketItem; error?: string };

      if (!response.ok || !data.ticket) {
        toast.error(data.error ?? "Não foi possível atualizar o ticket.");
        return;
      }

      toast.success("Ticket atualizado.");
      setSelectedTicket(data.ticket);
      search();
    });
  };

  const cancelTicket = () => {
    if (!selectedTicket || !isAdmin) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Cancelado pela tela de consulta",
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível cancelar o ticket.");
        return;
      }

      toast.success("Ticket cancelado.");
      setSelectedTicket(null);
      search();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Consulta de ticket
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
          Localize por placa ou número
        </h2>
        <div className="mt-6 space-y-4">
          <FieldLabel label="Buscar ticket">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="PK..., ABC1234 ou Mercosul"
            />
          </FieldLabel>
          <Button onClick={search} fullWidth disabled={pending}>
            {pending ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => {
                setSelectedTicket(ticket);
                setPlate(ticket.plate);
                setEntryAt(ticket.entryAt.slice(0, 16));
                setVehicleType(ticket.vehicleType);
                setNotes(ticket.notes ?? "");
              }}
              className="w-full rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-left transition hover:bg-[#243246]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{ticket.plate}</p>
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    {ticket.ticketNumber}
                  </p>
                </div>
                <StatusPill status={ticket.status} />
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Entrada: {formatDateTime(ticket.entryAt)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        {selectedTicket ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Edição e reimpressão
                </p>
                <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
                  {selectedTicket.plate}
                </h2>
              </div>
              <StatusPill status={selectedTicket.status} />
            </div>

            <FieldLabel label="Placa">
              <Input value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} />
            </FieldLabel>
            <FieldLabel label="Horário de entrada">
              <Input
                type="datetime-local"
                value={entryAt}
                onChange={(event) => setEntryAt(event.target.value)}
              />
            </FieldLabel>
            <FieldLabel label="Tipo do veículo">
              <Select
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value as typeof vehicleType)}
              >
                <option value="CAR">Carro</option>
                <option value="MOTORCYCLE">Moto</option>
                <option value="UTILITY">Utilitário</option>
              </Select>
            </FieldLabel>
            <FieldLabel label="Observações">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </FieldLabel>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={saveChanges} disabled={pending}>
                Salvar correções
              </Button>
              <Link
                href={`/ticket/${selectedTicket.ticketNumber}`}
                className="flex min-h-12 items-center justify-center rounded-2xl bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Reabrir ticket
              </Link>
            </div>

            {isAdmin && selectedTicket.status === "OPEN" ? (
              <Button variant="danger" onClick={cancelTicket} disabled={pending}>
                Cancelar ticket
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/12 bg-[var(--color-panel-strong)] p-8 text-sm leading-6 text-[var(--color-muted)]">
            Selecione um ticket para corrigir placa, ajustar horário, revisar observações e reabrir a
            visualização do ticket com QR Code.
          </div>
        )}
      </Card>
    </div>
  );
}
