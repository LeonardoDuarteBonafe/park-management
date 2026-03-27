"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/fields";
import { formatCurrencyFromCents, formatVehicleType } from "@/lib/utils/format";

type PricingRuleItem = {
  id: string;
  name: string;
  vehicleType: "CAR" | "MOTORCYCLE" | "UTILITY";
  initialPriceCents: number;
  graceMinutes: number;
  additionalFractionMinutes: number;
  additionalFractionPriceCents: number;
  dailyMaxPriceCents: number;
  lostTicketFeeCents: number;
  active: boolean;
};

export function PricingSettings({ initialRules }: { initialRules: PricingRuleItem[] }) {
  const [pending, startTransition] = useTransition();
  const [rules, setRules] = useState(initialRules);

  const updateField = (id: string, field: keyof PricingRuleItem, value: string | boolean) => {
    setRules((current) =>
      current.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              [field]:
                typeof value === "boolean"
                  ? value
                  : field.includes("Cents") || field.includes("Minutes")
                    ? Number(value)
                    : value,
            }
          : rule,
      ),
    );
  };

  const saveRule = (rule: PricingRuleItem) => {
    startTransition(async () => {
      const response = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rule),
      });

      const data = (await response.json()) as { error?: string; rule?: PricingRuleItem };

      if (!response.ok || !data.rule) {
        toast.error(data.error ?? "Não foi possível salvar a tabela.");
        return;
      }

      setRules((current) => current.map((item) => (item.id === data.rule!.id ? data.rule! : item)));
      toast.success("Tabela atualizada.");
    });
  };

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <Card key={rule.id}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                {formatVehicleType(rule.vehicleType)}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
                {rule.name}
              </h2>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Valor inicial atual: {formatCurrencyFromCents(rule.initialPriceCents)}
              </p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-[var(--color-panel-strong)] px-4 py-3 text-sm text-white">
              <input
                type="checkbox"
                checked={rule.active}
                onChange={(event) => updateField(rule.id, "active", event.target.checked)}
              />
              Regra ativa
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FieldLabel label="Valor inicial (centavos)">
              <Input
                type="number"
                value={rule.initialPriceCents}
                onChange={(event) => updateField(rule.id, "initialPriceCents", event.target.value)}
              />
            </FieldLabel>
            <FieldLabel label="Tolerância em minutos">
              <Input
                type="number"
                value={rule.graceMinutes}
                onChange={(event) => updateField(rule.id, "graceMinutes", event.target.value)}
              />
            </FieldLabel>
            <FieldLabel label="Fração adicional (minutos)">
              <Input
                type="number"
                value={rule.additionalFractionMinutes}
                onChange={(event) =>
                  updateField(rule.id, "additionalFractionMinutes", event.target.value)
                }
              />
            </FieldLabel>
            <FieldLabel label="Preço da fração adicional (centavos)">
              <Input
                type="number"
                value={rule.additionalFractionPriceCents}
                onChange={(event) =>
                  updateField(rule.id, "additionalFractionPriceCents", event.target.value)
                }
              />
            </FieldLabel>
            <FieldLabel label="Diária máxima (centavos)">
              <Input
                type="number"
                value={rule.dailyMaxPriceCents}
                onChange={(event) => updateField(rule.id, "dailyMaxPriceCents", event.target.value)}
              />
            </FieldLabel>
            <FieldLabel label="Taxa de ticket extraviado (centavos)">
              <Input
                type="number"
                value={rule.lostTicketFeeCents}
                onChange={(event) => updateField(rule.id, "lostTicketFeeCents", event.target.value)}
              />
            </FieldLabel>
          </div>

          <div className="mt-6">
            <Button onClick={() => saveRule(rule)} disabled={pending}>
              {pending ? "Salvando..." : "Salvar tabela"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
