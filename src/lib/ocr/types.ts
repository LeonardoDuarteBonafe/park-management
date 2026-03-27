import { z } from "zod";

import type { BrazilianPlateFormat } from "@/lib/plates/brazilian-plates";

export type PlateOcrCandidate = {
  source: string;
  raw_text: string;
  sanitized_text: string;
  normalized_text: string | null;
  plate_format: BrazilianPlateFormat;
  confidence: number;
  corrections_applied: string[];
  corrections_count: number;
  valid: boolean;
  occurrences: number;
};

export type PlateOcrResult = {
  plate_raw: string | null;
  plate_normalized: string | null;
  plate_format: BrazilianPlateFormat;
  confidence: number;
  candidates: PlateOcrCandidate[];
  corrections_applied: string[];
  debug_images_paths?: string[];
};

export const plateOcrRequestSchema = z.object({
  dataUrl: z.string().startsWith("data:image/"),
  roi: z
    .object({
      x: z.number().nonnegative(),
      y: z.number().nonnegative(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  debug: z.boolean().optional(),
});

export const plateOcrResultSchema = z.object({
  plate_raw: z.string().nullable(),
  plate_normalized: z.string().nullable(),
  plate_format: z.enum(["old_br", "mercosul", "invalid"]),
  confidence: z.number().min(0).max(1),
  candidates: z.array(
    z.object({
      source: z.string(),
      raw_text: z.string(),
      sanitized_text: z.string(),
      normalized_text: z.string().nullable(),
      plate_format: z.enum(["old_br", "mercosul", "invalid"]),
      confidence: z.number().min(0).max(1),
      corrections_applied: z.array(z.string()),
      corrections_count: z.number().int().min(0),
      valid: z.boolean(),
      occurrences: z.number().int().min(1),
    }),
  ),
  corrections_applied: z.array(z.string()),
  debug_images_paths: z.array(z.string()).optional(),
});
