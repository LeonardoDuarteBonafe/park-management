import Link from "next/link";

import { NavLink } from "@/components/app-shell/nav-link";
import { LogoutButton } from "@/components/app-shell/logout-button";

export function AppShell({
  children,
  user,
  isAdmin,
}: {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: "ADMIN" | "OPERATOR";
  };
  isAdmin: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-28 pt-20 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 rounded-[32px] border border-white/8 bg-[var(--color-panel)] px-5 py-5 shadow-[0_30px_60px_rgba(5,10,19,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Gestão de estacionamento
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">
              ParkFlow Mobile
            </h1>
          </div>
          <LogoutButton />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[var(--color-panel-strong)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-[var(--color-muted)]">{user.email}</p>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {isAdmin ? "Admin" : "Operador"}
          </span>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto grid max-w-6xl grid-cols-4 gap-2 px-4 sm:px-6">
        <NavLink href="/dashboard" label="Dashboard" />
        <NavLink href="/entrada" label="Entrada" />
        <NavLink href="/saida" label="Saída" />
        <NavLink href="/consulta" label="Consulta" />
      </nav>

      {isAdmin ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/historico"
            className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Histórico e relatórios
          </Link>
          <Link
            href="/configuracoes/precos"
            className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Preços
          </Link>
          <Link
            href="/configuracoes/usuarios"
            className="rounded-2xl bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Usuários
          </Link>
        </div>
      ) : null}
    </div>
  );
}
