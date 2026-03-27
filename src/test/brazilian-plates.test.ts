import { describe, expect, it } from "vitest";

import {
  getBrazilianPlateFormat,
  isValidBrazilianPlate,
  normalizeBrazilianPlateOrNull,
  normalizePlateValue,
} from "@/lib/plates/brazilian-plates";
import { ticketEntrySchema } from "@/lib/validation/tickets";

describe("brazilian plate helpers", () => {
  it("accepts old and Mercosul formats", () => {
    expect(getBrazilianPlateFormat("abc1234")).toBe("old_br");
    expect(getBrazilianPlateFormat("FMM6A10")).toBe("mercosul");
    expect(isValidBrazilianPlate("FMM6A10")).toBe(true);
  });

  it("normalizes and rejects invalid lengths", () => {
    expect(normalizePlateValue(" ab-c1234 ")).toBe("ABC1234");
    expect(normalizeBrazilianPlateOrNull("PDVJE0AX")).toBeNull();
    expect(isValidBrazilianPlate("PDVJE0AX")).toBe(false);
  });

  it("rejects invalid manual plate and invalid OCR suggestion on ticket creation", () => {
    const invalidPlate = ticketEntrySchema.safeParse({
      plate: "PDVJE0AX",
      plateOcrSuggestion: "FMM6A10",
      platePhotoDataUrl: null,
      vehicleType: "CAR",
      entryAt: new Date().toISOString(),
      notes: null,
    });

    expect(invalidPlate.success).toBe(false);

    const invalidSuggestion = ticketEntrySchema.safeParse({
      plate: "FMM6A10",
      plateOcrSuggestion: "PDVJE0AX",
      platePhotoDataUrl: null,
      vehicleType: "CAR",
      entryAt: new Date().toISOString(),
      notes: null,
    });

    expect(invalidSuggestion.success).toBe(false);
  });
});
