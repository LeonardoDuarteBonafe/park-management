"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-ink)] shadow-[0_10px_30px_rgba(255,184,61,0.35)] hover:bg-[#ffc55d]",
  secondary:
    "bg-[var(--color-panel)] text-[var(--color-copy)] ring-1 ring-white/10 hover:bg-[var(--color-panel-strong)]",
  ghost:
    "bg-transparent text-[var(--color-copy)] ring-1 ring-white/10 hover:bg-white/6",
  danger:
    "bg-[#ff6b5a] text-white shadow-[0_10px_30px_rgba(255,107,90,0.25)] hover:bg-[#ff8475]",
};

export function Button({
  className,
  variant = "primary",
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold tracking-[0.02em] transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
