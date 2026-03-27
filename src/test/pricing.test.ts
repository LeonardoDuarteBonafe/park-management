import { VehicleType, PaymentMethod } from "@prisma/client";
import { addMinutes } from "date-fns";
import { describe, expect, it } from "vitest";

import { calculateParkingPrice } from "@/lib/services/pricing";
import { validatePaymentSettlement } from "@/lib/services/tickets";

const rule = {
  id: "CAR-default",
  name: "Carro - padrão",
  vehicleType: VehicleType.CAR,
  initialPriceCents: 1200,
  graceMinutes: 15,
  additionalFractionMinutes: 60,
  additionalFractionPriceCents: 800,
  dailyMaxPriceCents: 4500,
  lostTicketFeeCents: 6000,
};

describe("calculateParkingPrice", () => {
  it("does not charge within grace period", () => {
    const entryAt = new Date("2026-03-26T10:00:00.000Z");
    const exitAt = addMinutes(entryAt, 10);

    const result = calculateParkingPrice({
      rule,
      entryAt,
      exitAt,
    });

    expect(result.finalAmountCents).toBe(0);
    expect(result.billableMinutes).toBe(0);
  });

  it("charges initial plus additional fractions after grace period", () => {
    const entryAt = new Date("2026-03-26T10:00:00.000Z");
    const exitAt = addMinutes(entryAt, 165);

    const result = calculateParkingPrice({
      rule,
      entryAt,
      exitAt,
    });

    expect(result.billableMinutes).toBe(150);
    expect(result.initialChargeCents).toBe(1200);
    expect(result.fractionChargeCents).toBe(1600);
    expect(result.finalAmountCents).toBe(2800);
  });

  it("applies daily cap and lost ticket rule", () => {
    const entryAt = new Date("2026-03-26T10:00:00.000Z");

    const dailyResult = calculateParkingPrice({
      rule,
      entryAt,
      exitAt: addMinutes(entryAt, 1500),
    });

    const lostTicketResult = calculateParkingPrice({
      rule,
      entryAt,
      exitAt: addMinutes(entryAt, 40),
      lostTicket: true,
    });

    expect(dailyResult.finalAmountCents).toBe(rule.dailyMaxPriceCents + rule.initialPriceCents);
    expect(lostTicketResult.finalAmountCents).toBe(rule.lostTicketFeeCents);
  });
});

describe("validatePaymentSettlement", () => {
  it("returns change for cash payment", () => {
    const change = validatePaymentSettlement({
      method: PaymentMethod.CASH,
      amountChargedCents: 2500,
      amountPaidCents: 3000,
    });

    expect(change).toBe(500);
  });

  it("rejects non-cash mismatch and cash shortage", () => {
    expect(() =>
      validatePaymentSettlement({
        method: PaymentMethod.PIX,
        amountChargedCents: 2500,
        amountPaidCents: 2400,
      }),
    ).toThrow(/exatamente igual/);

    expect(() =>
      validatePaymentSettlement({
        method: PaymentMethod.CASH,
        amountChargedCents: 2500,
        amountPaidCents: 2400,
      }),
    ).toThrow(/maior ou igual/);
  });
});
