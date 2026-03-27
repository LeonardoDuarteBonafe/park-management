"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select } from "@/components/ui/fields";
import { formatRole } from "@/lib/utils/format";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
  active: boolean;
};

export function UsersManager({ initialUsers }: { initialUsers: UserItem[] }) {
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "OPERATOR" as "ADMIN" | "OPERATOR",
    active: true,
  });

  const saveUser = (payload: Record<string, unknown>) => {
    startTransition(async () => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string; user?: UserItem };

      if (!response.ok || !data.user) {
        toast.error(data.error ?? "Não foi possível salvar o usuário.");
        return;
      }

      setUsers((current) => {
        const existing = current.find((item) => item.id === data.user!.id);
        if (existing) {
          return current.map((item) => (item.id === data.user!.id ? data.user! : item));
        }

        return [data.user!, ...current];
      });

      setForm({
        name: "",
        email: "",
        password: "",
        role: "OPERATOR",
        active: true,
      });
      toast.success("Usuário salvo.");
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Novo usuário
        </p>
        <h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">
          Gestão básica de acessos
        </h2>
        <div className="mt-6 space-y-4">
          <FieldLabel label="Nome">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldLabel>
          <FieldLabel label="E-mail">
            <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </FieldLabel>
          <FieldLabel label="Senha inicial">
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </FieldLabel>
          <FieldLabel label="Perfil">
            <Select
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as typeof form.role })
              }
            >
              <option value="OPERATOR">Operador</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </FieldLabel>

          <label className="flex items-center gap-3 rounded-2xl bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Usuário ativo
          </label>

          <Button onClick={() => saveUser(form)} fullWidth disabled={pending}>
            {pending ? "Salvando..." : "Criar usuário"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {users.map((user) => (
          <Card key={user.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold text-white">{user.name}</p>
                <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
              </div>
              <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                {formatRole(user.role)}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Select
                value={user.role}
                onChange={(event) =>
                  setUsers((current) =>
                    current.map((item) =>
                      item.id === user.id
                        ? { ...item, role: event.target.value as typeof user.role }
                        : item,
                    ),
                  )
                }
              >
                <option value="OPERATOR">Operador</option>
                <option value="ADMIN">Admin</option>
              </Select>
              <label className="flex items-center gap-3 rounded-2xl bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={user.active}
                  onChange={(event) =>
                    setUsers((current) =>
                      current.map((item) =>
                        item.id === user.id ? { ...item, active: event.target.checked } : item,
                      ),
                    )
                  }
                />
                Ativo
              </label>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => saveUser(user)}
              >
                Atualizar
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
