import { PaymentMethod, UserRole, VehicleType } from "@prisma/client";
import { z } from "zod";

const dateSchema = z.coerce.date();

export const ticketEntrySchema = z.object({
  plate: z
    .string()
    .min(6, "Informe a placa.")
    .max(8, "Placa inválida.")
    .transform((value) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()),
  plateOcrSuggestion: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
    .optional()
    .nullable(),
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
  plate: z
    .string()
    .min(6)
    .max(8)
    .transform((value) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
    .optional(),
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
