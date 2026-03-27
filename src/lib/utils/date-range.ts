import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

export type DatePreset =
  | "today"
  | "last7"
  | "last30"
  | "week"
  | "month"
  | "custom";

export type DateRangeInput = {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
};

export function resolveDateRange(input: DateRangeInput) {
  const now = new Date();
  const preset = normalizePreset(input.preset);

  if (preset === "custom" && input.start && input.end) {
    return {
      preset,
      start: startOfDay(new Date(input.start)),
      end: endOfDay(new Date(input.end)),
    };
  }

  switch (preset) {
    case "today":
      return { preset, start: startOfDay(now), end: endOfDay(now) };
    case "last7":
      return { preset, start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30":
      return { preset, start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "week":
      return {
        preset,
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return {
        preset,
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    default:
      return { preset: "today" as const, start: startOfDay(now), end: endOfDay(now) };
  }
}

function normalizePreset(value?: string | null): DatePreset {
  if (
    value === "today" ||
    value === "last7" ||
    value === "last30" ||
    value === "week" ||
    value === "month" ||
    value === "custom"
  ) {
    return value;
  }

  return "today";
}
