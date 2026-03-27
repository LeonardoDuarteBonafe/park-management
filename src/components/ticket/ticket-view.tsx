"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatPaymentMethod,
  formatVehicleType,
} from "@/lib/utils/format";

type TicketViewProps = {
  ticket: {
    ticketNumber: string;
    plate: string;
    entryAt: string | Date;
    exitAt: string | Date | null;
    vehicleType: "CAR" | "MOTORCYCLE" | "UTILITY";
    status: "OPEN" | "CLOSED" | "CANCELLED";
    notes: string | null;
    platePhotoPath: string | null;
    finalAmountCents: number | null;
    payment: {
      method: "CREDIT_CARD" | "DEBIT_CARD" | "PIX" | "CASH";
      amountChargedCents: number;
      amountPaidCents: number;
      changeAmountCents: number;
      paidAt: string | Date;
      registeredBy: { name: string };
    } | null;
    entryRegisteredBy: { name: string };
    exitRegisteredBy: { name: string } | null;
  };
};

export function TicketView({ ticket }: TicketViewProps) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const renderCodes = useEffectEvent(async () => {
    const QRCode = await import("qrcode");
    const JsBarcode = (await import("jsbarcode")).default;

    setQrDataUrl(
      await QRCode.toDataURL(ticket.ticketNumber, {
        width: 240,
        margin: 1,
        color: {
          dark: "#f6f7fb",
          light: "#121a26",
        },
      }),
    );

    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, ticket.ticketNumber, {
        format: "CODE128",
        lineColor: "#f6f7fb",
        background: "#121a26",
        displayValue: false,
        height: 56,
        margin: 0,
      });
    }
  });

  useEffect(() => {
    void renderCodes();
  }, [ticket.ticketNumber]);

  const shareTicket = async () => {
    if (!navigator.share) {
      window.print();
      return;
    }

    await navigator.share({
      title: `Ticket ${ticket.ticketNumber}`,
      text: `Ticket ${ticket.ticketNumber} - placa ${ticket.plate}`,
      url: window.location.href,
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Ticket gerado
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-[-0.06em] text-white">
              {ticket.ticketNumber}
            </h1>
            <div className="mt-4 flex items-center gap-3">
              <p className="text-2xl font-semibold text-white">{ticket.plate}</p>
              <StatusPill status={ticket.status} />
            </div>
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              Entrada em {formatDateTime(ticket.entryAt)} por {ticket.entryRegisteredBy.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void shareTicket()}>Compartilhar / imprimir</Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] bg-[var(--color-panel-strong)] p-5">
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="QR code do ticket"
                width={240}
                height={240}
                unoptimized
                className="mx-auto h-56 w-56 rounded-2xl"
              />
            ) : (
              <div className="mx-auto h-56 w-56 rounded-2xl bg-white/5" />
            )}
            <svg ref={barcodeRef} className="mt-6 w-full overflow-hidden rounded-xl" />
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 rounded-[28px] bg-[var(--color-panel-strong)] p-5 text-sm text-[var(--color-muted)] sm:grid-cols-2">
              <p>Número do ticket: <span className="font-semibold text-white">{ticket.ticketNumber}</span></p>
              <p>Veículo: <span className="font-semibold text-white">{formatVehicleType(ticket.vehicleType)}</span></p>
              <p>Entrada: <span className="font-semibold text-white">{formatDateTime(ticket.entryAt)}</span></p>
              <p>Saída: <span className="font-semibold text-white">{formatDateTime(ticket.exitAt)}</span></p>
              <p>Operador entrada: <span className="font-semibold text-white">{ticket.entryRegisteredBy.name}</span></p>
              <p>Operador saída: <span className="font-semibold text-white">{ticket.exitRegisteredBy?.name ?? "-"}</span></p>
            </div>

            {ticket.payment ? (
              <div className="rounded-[28px] bg-[var(--color-panel-strong)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
                  Comprovante de encerramento
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-accent)]">
                  {formatCurrencyFromCents(ticket.payment.amountChargedCents)}
                </p>
                <div className="mt-4 grid gap-2 text-sm text-[var(--color-muted)] sm:grid-cols-2">
                  <p>Pagamento: {formatPaymentMethod(ticket.payment.method)}</p>
                  <p>Recebido: {formatCurrencyFromCents(ticket.payment.amountPaidCents)}</p>
                  <p>Troco: {formatCurrencyFromCents(ticket.payment.changeAmountCents)}</p>
                  <p>Baixado por: {ticket.payment.registeredBy.name}</p>
                  <p>Data: {formatDateTime(ticket.payment.paidAt)}</p>
                </div>
              </div>
            ) : null}

            {ticket.platePhotoPath ? (
              <div className="overflow-hidden rounded-[28px] bg-[var(--color-panel-strong)]">
                <Image
                  src={ticket.platePhotoPath}
                  alt="Foto da placa"
                  width={1280}
                  height={720}
                  unoptimized
                  className="h-56 w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
