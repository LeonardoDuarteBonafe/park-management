import { VehicleType, type Prisma, type PricingRule } from "@prisma/client";
import { differenceInMinutes } from "date-fns";

export type PricingRuleSnapshot = Pick<
  PricingRule,
  | "id"
  | "name"
  | "vehicleType"
  | "initialPriceCents"
  | "graceMinutes"
  | "additionalFractionMinutes"
  | "additionalFractionPriceCents"
  | "dailyMaxPriceCents"
  | "lostTicketFeeCents"
>;

export type PriceCalculationInput = {
  rule: PricingRuleSnapshot;
  entryAt: Date;
  exitAt: Date;
  lostTicket?: boolean;
  discountAmountCents?: number;
};

export type PriceCalculationResult = {
  totalMinutes: number;
  billableMinutes: number;
  dailyBlocks: number;
  fractionBlocks: number;
  initialChargeCents: number;
  fractionChargeCents: number;
  grossAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  ruleLabel: string;
  pricingSnapshot: Prisma.InputJsonValue;
};

export function calculateParkingPrice(input: PriceCalculationInput): PriceCalculationResult {
  const totalMinutes = Math.max(0, differenceInMinutes(input.exitAt, input.entryAt));
  const discountAmountCents = Math.max(0, input.discountAmountCents ?? 0);

  if (input.lostTicket) {
    const grossAmountCents = input.rule.lostTicketFeeCents;
    const finalAmountCents = Math.max(0, grossAmountCents - discountAmountCents);

    return {
      totalMinutes,
      billableMinutes: totalMinutes,
      dailyBlocks: 0,
      fractionBlocks: 0,
      initialChargeCents: grossAmountCents,
      fractionChargeCents: 0,
      grossAmountCents,
      discountAmountCents,
      finalAmountCents,
      ruleLabel: `${input.rule.name} • ticket extraviado`,
      pricingSnapshot: {
        lostTicket: true,
        rule: input.rule,
        totalMinutes,
        grossAmountCents,
        discountAmountCents,
        finalAmountCents,
      },
    };
  }

  if (totalMinutes <= input.rule.graceMinutes) {
    return {
      totalMinutes,
      billableMinutes: 0,
      dailyBlocks: 0,
      fractionBlocks: 0,
      initialChargeCents: 0,
      fractionChargeCents: 0,
      grossAmountCents: 0,
      discountAmountCents: 0,
      finalAmountCents: 0,
      ruleLabel: `${input.rule.name} • dentro da tolerância`,
      pricingSnapshot: {
        lostTicket: false,
        withinGracePeriod: true,
        rule: input.rule,
        totalMinutes,
      },
    };
  }

  const billableMinutes = totalMinutes - input.rule.graceMinutes;
  const dailyBlocks = Math.floor(billableMinutes / 1440);
  const leftoverMinutes = billableMinutes % 1440;
  const leftoverCharge = calculateSingleBlockCharge(leftoverMinutes, input.rule);
  const grossAmountCents = dailyBlocks * input.rule.dailyMaxPriceCents + leftoverCharge.total;
  const finalAmountCents = Math.max(0, grossAmountCents - discountAmountCents);

  return {
    totalMinutes,
    billableMinutes,
    dailyBlocks,
    fractionBlocks: leftoverCharge.fractionBlocks,
    initialChargeCents: leftoverCharge.initialChargeCents,
    fractionChargeCents: leftoverCharge.fractionChargeCents,
    grossAmountCents,
    discountAmountCents,
    finalAmountCents,
    ruleLabel:
      dailyBlocks > 0 || leftoverCharge.cappedByDaily
        ? `${input.rule.name} • diária máxima aplicada`
        : input.rule.name,
    pricingSnapshot: {
      lostTicket: false,
      rule: input.rule,
      totalMinutes,
      billableMinutes,
      dailyBlocks,
      fractionBlocks: leftoverCharge.fractionBlocks,
      initialChargeCents: leftoverCharge.initialChargeCents,
      fractionChargeCents: leftoverCharge.fractionChargeCents,
      cappedByDaily: leftoverCharge.cappedByDaily,
      grossAmountCents,
      discountAmountCents,
      finalAmountCents,
    },
  };
}

function calculateSingleBlockCharge(minutes: number, rule: PricingRuleSnapshot) {
  if (minutes <= 0) {
    return {
      total: 0,
      fractionBlocks: 0,
      initialChargeCents: 0,
      fractionChargeCents: 0,
      cappedByDaily: false,
    };
  }

  const remainingAfterInitial = Math.max(0, minutes - rule.additionalFractionMinutes);
  const fractionBlocks =
    remainingAfterInitial > 0
      ? Math.ceil(remainingAfterInitial / rule.additionalFractionMinutes)
      : 0;
  const initialChargeCents = rule.initialPriceCents;
  const fractionChargeCents = fractionBlocks * rule.additionalFractionPriceCents;
  const rawTotal = initialChargeCents + fractionChargeCents;
  const cappedByDaily = rawTotal > rule.dailyMaxPriceCents;

  return {
    total: Math.min(rawTotal, rule.dailyMaxPriceCents),
    fractionBlocks,
    initialChargeCents,
    fractionChargeCents,
    cappedByDaily,
  };
}

export function getVehicleRuleLabel(type: VehicleType) {
  switch (type) {
    case VehicleType.CAR:
      return "Tabela de carro";
    case VehicleType.MOTORCYCLE:
      return "Tabela de moto";
    case VehicleType.UTILITY:
      return "Tabela de utilitário";
  }
}
