export const BRAZILIAN_PLATE_LENGTH = 7;
export const OLD_BR_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;
export const MERCOSUL_PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

export type BrazilianPlateFormat = "old_br" | "mercosul" | "invalid";

export function normalizePlateValue(value: string | null | undefined) {
  return (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function getBrazilianPlateFormat(value: string | null | undefined): BrazilianPlateFormat {
  const normalized = normalizePlateValue(value);

  if (OLD_BR_PLATE_REGEX.test(normalized)) {
    return "old_br";
  }

  if (MERCOSUL_PLATE_REGEX.test(normalized)) {
    return "mercosul";
  }

  return "invalid";
}

export function isValidBrazilianPlate(value: string | null | undefined) {
  return getBrazilianPlateFormat(value) !== "invalid";
}

export function normalizeBrazilianPlateOrNull(value: string | null | undefined) {
  const normalized = normalizePlateValue(value);

  return isValidBrazilianPlate(normalized) ? normalized : null;
}
