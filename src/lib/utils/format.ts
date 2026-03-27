import { PaymentMethod, TicketStatus, UserRole, VehicleType } from "@prisma/client";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrencyFromCents(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return format(new Date(value), "dd/MM/yyyy HH:mm", {
    locale: ptBR,
  });
}

export function formatDateInputValue(value: Date | string) {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

export function formatDurationBetween(start: Date | string, end: Date | string) {
  return formatDistanceStrict(new Date(start), new Date(end), {
    locale: ptBR,
  });
}

export function formatVehicleType(type: VehicleType) {
  switch (type) {
    case VehicleType.CAR:
      return "Carro";
    case VehicleType.MOTORCYCLE:
      return "Moto";
    case VehicleType.UTILITY:
      return "Utilitário";
  }
}

export function formatPaymentMethod(type: PaymentMethod) {
  switch (type) {
    case PaymentMethod.CASH:
      return "Dinheiro";
    case PaymentMethod.CREDIT_CARD:
      return "Cartão de crédito";
    case PaymentMethod.DEBIT_CARD:
      return "Cartão de débito";
    case PaymentMethod.PIX:
      return "Pix";
  }
}

export function formatRole(role: UserRole) {
  return role === UserRole.ADMIN ? "Admin" : "Operador";
}

export function formatTicketStatus(status: TicketStatus) {
  switch (status) {
    case TicketStatus.OPEN:
      return "Aberto";
    case TicketStatus.CLOSED:
      return "Fechado";
    case TicketStatus.CANCELLED:
      return "Cancelado";
  }
}

export function plateMask(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}
