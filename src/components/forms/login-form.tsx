"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/fields";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("admin@parkflow.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Não foi possível autenticar.");
        return;
      }

      window.location.replace("/dashboard");
    });
  };

  return (
    <Card className="w-full max-w-md p-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Acesso operacional
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
          Entrar no sistema
        </h2>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Sessão persistida, rotas protegidas e fluxo otimizado para maquininha e celular.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FieldLabel label="E-mail">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </FieldLabel>
        <FieldLabel label="Senha">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FieldLabel>

        {error ? (
          <div className="rounded-2xl bg-rose-500/12 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/25">
            {error}
          </div>
        ) : null}

        <Button type="submit" fullWidth disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="mt-6 rounded-[24px] bg-[var(--color-panel-strong)] p-4 text-sm text-[var(--color-muted)]">
        <p className="font-semibold text-white">Credenciais seed</p>
        <p className="mt-2">Admin: `admin@parkflow.local` / `Admin123!`</p>
        <p>Operador: `operador@parkflow.local` / `Operador123!`</p>
      </div>
    </Card>
  );
}
