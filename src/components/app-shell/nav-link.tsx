"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

export function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-ink)]"
          : "bg-white/5 text-[var(--color-muted)] hover:bg-white/10 hover:text-white",
      )}
    >
      {label}
    </Link>
  );
}
