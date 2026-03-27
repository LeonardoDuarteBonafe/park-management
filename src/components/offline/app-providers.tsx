"use client";

import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

import { getPendingEntries, removePendingEntry } from "@/lib/offline/storage";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateOnlineState = () => {
      setOnline(window.navigator.onLine);
    };

    updateOnlineState();

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      return;
    }

    void syncPendingEntries();
  }, [online]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  }, []);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 px-4 pt-3">
        <div
          className={[
            "mx-auto flex max-w-5xl items-center justify-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] backdrop-blur",
            online
              ? "bg-emerald-500/12 text-emerald-200 ring-1 ring-emerald-500/20"
              : "bg-amber-500/12 text-amber-200 ring-1 ring-amber-500/20",
          ].join(" ")}
        >
          {online ? "Online e sincronizando" : "Offline com fila local ativa"}
        </div>
      </div>
      {children}
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          className: "!bg-[var(--color-panel)] !border !border-white/10 !text-white",
        }}
      />
    </>
  );
}

async function syncPendingEntries() {
  const entries = await getPendingEntries();

  if (!entries.length) {
    return;
  }

  const response = await fetch("/api/sync/entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) {
    toast.error("Não foi possível sincronizar as entradas pendentes.");
    return;
  }

  const data = (await response.json()) as {
    results: Array<{ ok: boolean; ticket?: { ticketNumber: string }; error?: string }>;
  };

  await Promise.all(
    data.results.map(async (result, index) => {
      if (result.ok) {
        await removePendingEntry(entries[index].localId);
      }
    }),
  );

  const syncedCount = data.results.filter((result) => result.ok).length;

  if (syncedCount > 0) {
    toast.success(`${syncedCount} entrada(s) sincronizada(s).`);
  }
}
