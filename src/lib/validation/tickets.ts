import { PaymentMethod, UserRole, VehicleType } from "@prisma/client";
import { z } from "zod";

import {
  isValidBrazilianPlate,
  normalizePlateValue,
} from "@/lib/plates/brazilian-plates";

const dateSchema = z.coerce.date();

const brazilianPlateSchema = z
  .string()
  .min(1, "Informe a placa.")
  .transform((value) => normalizePlateValue(value))
  .refine(
    (value) => isValidBrazilianPlate(value),
    "Informe uma placa brasileira válida no padrão antigo ou Mercosul.",
  );

const optionalBrazilianPlateSchema = z
  .string()
  .trim()
  .transform((value) => normalizePlateValue(value) || null)
  .refine(
    (value) => value === null || isValidBrazilianPlate(value),
    "Sugestão OCR inválida.",
  );

export const ticketEntrySchema = z.object({
  plate: brazilianPlateSchema,
  plateOcrSuggestion: optionalBrazilianPlateSchema.optional().nullable(),
  platePhotoDataUrl: z.string().startsWith("data:image/").optional().nullable(),
  vehicleType: z.nativeEnum(VehicleType),
  entryAt: dateSchema,
  originalEntryAt: dateSchema.optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
});

export const ticketSearchSchema = z.object({
  query: z.string().trim().min(1),
});

export const ticketUpdateSchema = z.object({
  plate: brazilianPlateSchema.optional(),
  entryAt: dateSchema.optional(),
  notes: z.string().max(400).optional().nullable(),
  vehicleType: z.nativeEnum(VehicleType).optional(),
});

export const paymentSchema = z.object({
  exitAt: dateSchema,
  method: z.nativeEnum(PaymentMethod),
  amountPaidCents: z.number().int().min(0),
  amountChargedCents: z.number().int().min(0),
  discountAmountCents: z.number().int().min(0).default(0),
  lostTicket: z.boolean().default(false),
  notes: z.string().max(400).optional().nullable(),
  role: z.nativeEnum(UserRole),
});

export const pricingRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3).max(80),
  vehicleType: z.nativeEnum(VehicleType),
  initialPriceCents: z.number().int().min(0),
  graceMinutes: z.number().int().min(0),
  additionalFractionMinutes: z.number().int().min(1),
  additionalFractionPriceCents: z.number().int().min(0),
  dailyMaxPriceCents: z.number().int().min(0),
  lostTicketFeeCents: z.number().int().min(0),
  active: z.boolean().default(true),
});

export const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).optional().or(z.literal("")),
  role: z.nativeEnum(UserRole),
  active: z.boolean().default(true),
});

export type TicketEntryInput = z.infer<typeof ticketEntrySchema>;
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;
export type UserInput = z.infer<typeof userSchema>;
