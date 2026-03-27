import {
  AuditAction,
  PaymentMethod,
  TicketStatus,
  VehicleType,
  type ParkingTicket,
  type Payment,
  type PricingRule,
  type User,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { canApplyDiscount, canCancelTicket } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/services/audit";
import { calculateParkingPrice, type PriceCalculationResult } from "@/lib/services/pricing";

export type TicketWithRelations = ParkingTicket & {
  entryRegisteredBy: Pick<User, "id" | "name" | "email" | "role">;
  exitRegisteredBy: Pick<User, "id" | "name" | "email" | "role"> | null;
  entryTimeAdjustedBy: Pick<User, "id" | "name" | "email" | "role"> | null;
  cancelledBy: Pick<User, "id" | "name" | "email" | "role"> | null;
  priceRule: PricingRule | null;
  payment: (Payment & { registeredBy: Pick<User, "id" | "name"> }) | null;
};

const ticketInclude = {
  entryRegisteredBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  exitRegisteredBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  entryTimeAdjustedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  priceRule: true,
  payment: {
    include: {
      registeredBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export async function generateTicketNumber() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `PK${new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(2, 12)}${Math.floor(Math.random() * 9000 + 1000)}`;

    const existing = await prisma.parkingTicket.findUnique({
      where: { ticketNumber: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `PK${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

export async function savePlatePhoto(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);

  if (!matches) {
    throw new Error("Formato de imagem inválido.");
  }

  const mimeType = matches[1];
  const base64 = matches[2];
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const relativeDirectory = path.join("uploads", "plates");
  const absoluteDirectory = path.join(process.cwd(), "public", relativeDirectory);

  await mkdir(absoluteDirectory, { recursive: true });

  const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${ext}`;
  const absoluteFilePath = path.join(absoluteDirectory, fileName);

  await writeFile(absoluteFilePath, Buffer.from(base64, "base64"));

  return `/${relativeDirectory.replace(/\\/g, "/")}/${fileName}`;
}

export async function getActivePricingRule(vehicleType: VehicleType) {
  return prisma.pricingRule.findFirst({
    where: {
      vehicleType,
      active: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function createTicketEntry(input: {
  plate: string;
  plateOcrSuggestion?: string | null;
  platePhotoDataUrl?: string | null;
  vehicleType: VehicleType;
  entryAt: Date;
  notes?: string | null;
  actor: Pick<User, "id" | "name" | "role">;
}) {
  const ticketNumber = await generateTicketNumber();
  const priceRule = await getActivePricingRule(input.vehicleType);

  if (!priceRule) {
    throw new Error("Nenhuma tabela ativa encontrada para o tipo de veículo.");
  }

  const platePhotoPath = input.platePhotoDataUrl
    ? await savePlatePhoto(input.platePhotoDataUrl)
    : null;
  const now = new Date();
  const manualEntryTimeChanged = Math.abs(now.getTime() - input.entryAt.getTime()) > 60_000;

  const ticket = await prisma.parkingTicket.create({
    data: {
      ticketNumber,
      plate: input.plate,
      plateOcrSuggestion: input.plateOcrSuggestion,
      platePhotoPath,
      vehicleType: input.vehicleType,
      entryAt: input.entryAt,
      originalEntryAt: manualEntryTimeChanged ? now : null,
      manualEntryTimeChanged,
      notes: input.notes,
      entryRegisteredById: input.actor.id,
      entryTimeAdjustedById: manualEntryTimeChanged ? input.actor.id : null,
      priceRuleId: priceRule.id,
      pricingSnapshot: {
        entryPricingRule: {
          id: priceRule.id,
          name: priceRule.name,
          vehicleType: priceRule.vehicleType,
        },
      },
    },
    include: ticketInclude,
  });

  await createAuditLog({
    actorId: input.actor.id,
    action: AuditAction.ENTRY_CREATED,
    entityType: "ParkingTicket",
    entityId: ticket.id,
    description: `Entrada registrada para a placa ${ticket.plate}.`,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      entryAt: ticket.entryAt.toISOString(),
      vehicleType: ticket.vehicleType,
      manualEntryTimeChanged,
    },
  });

  if (manualEntryTimeChanged) {
    await createAuditLog({
      actorId: input.actor.id,
      action: AuditAction.ENTRY_TIME_UPDATED,
      entityType: "ParkingTicket",
      entityId: ticket.id,
      description: "Horário de entrada ajustado manualmente no cadastro.",
      metadata: {
        originalDetectedAt: now.toISOString(),
        adjustedTo: input.entryAt.toISOString(),
      },
    });
  }

  return ticket;
}

export async function getTicketByNumber(ticketNumber: string) {
  return prisma.parkingTicket.findUnique({
    where: { ticketNumber },
    include: ticketInclude,
  });
}

export async function getTicketById(ticketId: string) {
  return prisma.parkingTicket.findUnique({
    where: { id: ticketId },
    include: ticketInclude,
  });
}

export async function searchTickets(query: string, status?: TicketStatus) {
  const normalizedQuery = query.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  return prisma.parkingTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      OR: [
        {
          ticketNumber: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          plate: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
      ],
    },
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getExitPreview(input: {
  ticketId: string;
  exitAt?: Date;
  lostTicket?: boolean;
  discountAmountCents?: number;
}) {
  const ticket = await getTicketById(input.ticketId);

  if (!ticket) {
    throw new Error("Ticket não encontrado.");
  }

  if (ticket.status !== TicketStatus.OPEN) {
    throw new Error("Somente tickets em aberto podem ser encerrados.");
  }

  const activeRule = ticket.priceRule ?? (await getActivePricingRule(ticket.vehicleType));

  if (!activeRule) {
    throw new Error("Nenhuma tabela ativa disponível para cálculo.");
  }

  const exitAt = input.exitAt ?? new Date();
  const calculation = calculateParkingPrice({
    rule: {
      id: activeRule.id,
      name: activeRule.name,
      vehicleType: activeRule.vehicleType,
      initialPriceCents: activeRule.initialPriceCents,
      graceMinutes: activeRule.graceMinutes,
      additionalFractionMinutes: activeRule.additionalFractionMinutes,
      additionalFractionPriceCents: activeRule.additionalFractionPriceCents,
      dailyMaxPriceCents: activeRule.dailyMaxPriceCents,
      lostTicketFeeCents: activeRule.lostTicketFeeCents,
    },
    entryAt: ticket.entryAt,
    exitAt,
    lostTicket: input.lostTicket,
    discountAmountCents: input.discountAmountCents,
  });

  return {
    ticket,
    calculation,
    exitAt,
  };
}

export async function updateTicket(input: {
  ticketId: string;
  actor: Pick<User, "id" | "role" | "name">;
  plate?: string;
  entryAt?: Date;
  notes?: string | null;
  vehicleType?: VehicleType;
}) {
  const current = await getTicketById(input.ticketId);

  if (!current) {
    throw new Error("Ticket não encontrado.");
  }

  const updates: Record<string, unknown> = {};
  const auditEntries: Array<Promise<unknown>> = [];

  if (input.plate && input.plate !== current.plate) {
    updates.plate = input.plate;
    auditEntries.push(
      createAuditLog({
        actorId: input.actor.id,
        action: AuditAction.PLATE_UPDATED,
        entityType: "ParkingTicket",
        entityId: current.id,
        description: `Placa corrigida de ${current.plate} para ${input.plate}.`,
        metadata: {
          previousPlate: current.plate,
          nextPlate: input.plate,
        },
      }),
    );
  }

  if (input.entryAt && input.entryAt.toISOString() !== current.entryAt.toISOString()) {
    updates.entryAt = input.entryAt;
    updates.originalEntryAt = current.originalEntryAt ?? current.entryAt;
    updates.manualEntryTimeChanged = true;
    updates.entryTimeAdjustedById = input.actor.id;

    auditEntries.push(
      createAuditLog({
        actorId: input.actor.id,
        action: AuditAction.ENTRY_TIME_UPDATED,
        entityType: "ParkingTicket",
        entityId: current.id,
        description: "Horário de entrada alterado manualmente.",
        metadata: {
          previousEntryAt: current.entryAt.toISOString(),
          nextEntryAt: input.entryAt.toISOString(),
        },
      }),
    );
  }

  if (typeof input.notes !== "undefined") {
    updates.notes = input.notes;
  }

  if (input.vehicleType && input.vehicleType !== current.vehicleType) {
    updates.vehicleType = input.vehicleType;
    const nextRule = await getActivePricingRule(input.vehicleType);
    if (nextRule) {
      updates.priceRuleId = nextRule.id;
    }
  }

  const updated = await prisma.parkingTicket.update({
    where: { id: current.id },
    data: updates,
    include: ticketInclude,
  });

  await Promise.all(auditEntries);

  return updated;
}

export async function finalizeTicketPayment(input: {
  ticketId: string;
  actor: Pick<User, "id" | "name" | "role">;
  exitAt: Date;
  method: PaymentMethod;
  amountPaidCents: number;
  discountAmountCents?: number;
  lostTicket?: boolean;
  notes?: string | null;
}) {
  const preview = await getExitPreview({
    ticketId: input.ticketId,
    exitAt: input.exitAt,
    lostTicket: input.lostTicket,
    discountAmountCents: input.discountAmountCents,
  });

  if (preview.ticket.payment || preview.ticket.status !== TicketStatus.OPEN) {
    throw new Error("Este ticket já foi encerrado e não pode receber pagamento novamente.");
  }

  if ((input.discountAmountCents ?? 0) > 0 && !canApplyDiscount(input.actor.role)) {
    throw new Error("Somente administradores podem aplicar desconto.");
  }

  const amountChargedCents = preview.calculation.finalAmountCents;
  const amountPaidCents = input.amountPaidCents;
  const changeAmountCents = validatePaymentSettlement({
    method: input.method,
    amountChargedCents,
    amountPaidCents,
  });

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        ticketId: preview.ticket.id,
        method: input.method,
        amountChargedCents,
        amountPaidCents,
        changeAmountCents,
        notes: input.notes,
        registeredById: input.actor.id,
        paidAt: input.exitAt,
      },
      include: {
        registeredBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const ticket = await tx.parkingTicket.update({
      where: { id: preview.ticket.id },
      data: {
        exitAt: input.exitAt,
        exitRegisteredById: input.actor.id,
        status: TicketStatus.CLOSED,
        lostTicket: Boolean(input.lostTicket),
        chargeAmountCents: preview.calculation.grossAmountCents,
        discountAmountCents: input.discountAmountCents ?? 0,
        finalAmountCents: amountChargedCents,
        pricingSnapshot: preview.calculation.pricingSnapshot,
      },
      include: ticketInclude,
    });

    return { payment, ticket };
  });

  await createAuditLog({
    actorId: input.actor.id,
    action: AuditAction.EXIT_RECORDED,
    entityType: "ParkingTicket",
    entityId: result.ticket.id,
    description: "Saída registrada.",
    metadata: {
      exitAt: input.exitAt.toISOString(),
      amountChargedCents,
      lostTicket: Boolean(input.lostTicket),
    },
  });

  await createAuditLog({
    actorId: input.actor.id,
    action: AuditAction.PAYMENT_RECORDED,
    entityType: "Payment",
    entityId: result.payment.id,
    description: "Pagamento registrado.",
    metadata: {
      ticketId: result.ticket.id,
      method: input.method,
      amountChargedCents,
      amountPaidCents,
      changeAmountCents,
    },
  });

  if (Boolean(input.lostTicket)) {
    await createAuditLog({
      actorId: input.actor.id,
      action: AuditAction.TICKET_MARKED_LOST,
      entityType: "ParkingTicket",
      entityId: result.ticket.id,
      description: "Ticket marcado como extraviado no encerramento.",
      metadata: {
        paymentId: result.payment.id,
      },
    });
  }

  if ((input.discountAmountCents ?? 0) > 0) {
    await createAuditLog({
      actorId: input.actor.id,
      action: AuditAction.DISCOUNT_APPLIED,
      entityType: "ParkingTicket",
      entityId: result.ticket.id,
      description: "Desconto manual aplicado no encerramento.",
      metadata: {
        discountAmountCents: input.discountAmountCents,
      },
    });
  }

  return {
    ...result,
    calculation: preview.calculation,
  };
}

export async function cancelTicket(input: {
  ticketId: string;
  actor: Pick<User, "id" | "role" | "name">;
  reason?: string;
}) {
  if (!canCancelTicket(input.actor.role)) {
    throw new Error("Somente administradores podem cancelar tickets.");
  }

  const current = await getTicketById(input.ticketId);

  if (!current) {
    throw new Error("Ticket não encontrado.");
  }

  if (current.status !== TicketStatus.OPEN) {
    throw new Error("Somente tickets em aberto podem ser cancelados.");
  }

  const ticket = await prisma.parkingTicket.update({
    where: { id: current.id },
    data: {
      status: TicketStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledById: input.actor.id,
      notes: current.notes
        ? `${current.notes}\n\nCancelado: ${input.reason ?? "Sem observação"}`
        : `Cancelado: ${input.reason ?? "Sem observação"}`,
    },
    include: ticketInclude,
  });

  await createAuditLog({
    actorId: input.actor.id,
    action: AuditAction.TICKET_CANCELLED,
    entityType: "ParkingTicket",
    entityId: ticket.id,
    description: "Ticket cancelado pelo administrador.",
    metadata: {
      reason: input.reason ?? null,
    },
  });

  return ticket;
}

export async function markTicketLost(input: {
  ticketId: string;
  actor: Pick<User, "id" | "role" | "name">;
  lostTicket: boolean;
}) {
  const current = await getTicketById(input.ticketId);

  if (!current) {
    throw new Error("Ticket não encontrado.");
  }

  if (current.status !== TicketStatus.OPEN) {
    throw new Error("Somente tickets em aberto podem ser marcados como extraviados.");
  }

  const ticket = await prisma.parkingTicket.update({
    where: { id: current.id },
    data: {
      lostTicket: input.lostTicket,
    },
    include: ticketInclude,
  });

  await createAuditLog({
    actorId: input.actor.id,
    action: AuditAction.TICKET_MARKED_LOST,
    entityType: "ParkingTicket",
    entityId: ticket.id,
    description: input.lostTicket
      ? "Ticket marcado como extraviado."
      : "Marcação de ticket extraviado removida.",
    metadata: {
      lostTicket: input.lostTicket,
    },
  });

  return ticket;
}

export function buildReceiptData(ticket: TicketWithRelations, calculation?: PriceCalculationResult) {
  return {
    ticketNumber: ticket.ticketNumber,
    plate: ticket.plate,
    entryAt: ticket.entryAt,
    exitAt: ticket.exitAt,
    vehicleType: ticket.vehicleType,
    status: ticket.status,
    operatorEntry: ticket.entryRegisteredBy.name,
    operatorExit: ticket.exitRegisteredBy?.name ?? null,
    paymentMethod: ticket.payment?.method ?? null,
    paidAt: ticket.payment?.paidAt ?? null,
    amountChargedCents: ticket.payment?.amountChargedCents ?? ticket.finalAmountCents ?? 0,
    amountPaidCents: ticket.payment?.amountPaidCents ?? ticket.finalAmountCents ?? 0,
    changeAmountCents: ticket.payment?.changeAmountCents ?? 0,
    calculation,
  };
}

export function validatePaymentSettlement(input: {
  method: PaymentMethod;
  amountChargedCents: number;
  amountPaidCents: number;
}) {
  if (input.method === PaymentMethod.CASH && input.amountPaidCents < input.amountChargedCents) {
    throw new Error("O valor recebido em dinheiro deve ser maior ou igual ao valor cobrado.");
  }

  if (input.method !== PaymentMethod.CASH && input.amountPaidCents !== input.amountChargedCents) {
    throw new Error("Para cartão e Pix, registre o valor pago exatamente igual ao valor cobrado.");
  }

  return input.method === PaymentMethod.CASH
    ? Math.max(0, input.amountPaidCents - input.amountChargedCents)
    : 0;
}
