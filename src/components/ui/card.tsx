import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/8 bg-[var(--color-panel)] p-5 shadow-[0_24px_60px_rgba(5,10,19,0.35)]",
        className,
      )}
      {...props}
    />
  );
}
