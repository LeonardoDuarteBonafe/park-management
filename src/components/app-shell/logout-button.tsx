"use client";

import { useTransition } from "react";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      window.location.href = "/login";
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="min-h-11 rounded-2xl bg-white/6 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
      disabled={pending}
    >
      {pending ? "Saindo..." : "Sair"}
    </button>
  );
}
