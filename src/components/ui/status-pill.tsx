import { TicketStatus } from "@prisma/client";

import { cn } from "@/lib/utils/cn";
import { formatTicketStatus } from "@/lib/utils/format";

export function StatusPill({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const statusClass =
    status === TicketStatus.OPEN
      ? "bg-emerald-500/12 text-emerald-300 ring-emerald-500/20"
      : status === TicketStatus.CLOSED
        ? "bg-sky-500/12 text-sky-300 ring-sky-500/20"
        : "bg-rose-500/12 text-rose-300 ring-rose-500/20";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ring-1",
        statusClass,
        className,
      )}
    >
      {formatTicketStatus(status)}
    </span>
  );
}
