"use client";

import { openDB } from "idb";

export type PendingEntry = {
  localId: string;
  plate: string;
  plateOcrSuggestion?: string | null;
  platePhotoDataUrl?: string | null;
  vehicleType: "CAR" | "MOTORCYCLE" | "UTILITY";
  entryAt: string;
  notes?: string | null;
  createdOfflineAt: string;
};

export type CachedTicket = {
  ticketNumber: string;
  plate: string;
  entryAt: string;
  status: "OPEN" | "CLOSED" | "CANCELLED";
};

let dbPromise: ReturnType<typeof openDB> | null = null;

function getDb() {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB("parking-mvp", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending-entries")) {
          db.createObjectStore("pending-entries", {
            keyPath: "localId",
          });
        }

        if (!db.objectStoreNames.contains("cached-tickets")) {
          db.createObjectStore("cached-tickets", {
            keyPath: "ticketNumber",
          });
        }
      },
    });
  }

  return dbPromise;
}

export async function getPendingEntries() {
  const db = await getDb();
  if (!db) {
    return [];
  }
  return db.getAll("pending-entries");
}

export async function queuePendingEntry(entry: PendingEntry) {
  const db = await getDb();
  if (!db) {
    return;
  }
  await db.put("pending-entries", entry);
}

export async function removePendingEntry(localId: string) {
  const db = await getDb();
  if (!db) {
    return;
  }
  await db.delete("pending-entries", localId);
}

export async function cacheTicket(ticket: CachedTicket) {
  const db = await getDb();
  if (!db) {
    return;
  }
  await db.put("cached-tickets", ticket);
}

export async function getCachedTickets() {
  const db = await getDb();
  if (!db) {
    return [];
  }
  return db.getAll("cached-tickets");
}
