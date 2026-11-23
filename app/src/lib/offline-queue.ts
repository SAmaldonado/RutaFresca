"use client";

export interface OfflineWeighingRecord {
  offlineSyncId: string;
  harvestAssignmentId: string;
  actualKg: number;
  qualityResult: "APPROVED_STANDARD" | "RECLASSIFIED_FUNCTIONAL" | "REJECTED";
  rejectionReason?: string;
  producerSignatureAck: boolean;
  captureChannel: string;
  queuedAt: string;
  labelSummary: string;
}

const DB_NAME = "ruta-fresca-offline-db";
const STORE_NAME = "acopio_queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "offlineSyncId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineWeighing(record: OfflineWeighingRecord): Promise<void> {
  if (typeof indexedDB === "undefined") {
    const current = JSON.parse(localStorage.getItem(STORE_NAME) || "[]") as OfflineWeighingRecord[];
    current.push(record);
    localStorage.setItem(STORE_NAME, JSON.stringify(current));
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOfflineWeighings(): Promise<OfflineWeighingRecord[]> {
  if (typeof indexedDB === "undefined") {
    return JSON.parse(localStorage.getItem(STORE_NAME) || "[]") as OfflineWeighingRecord[];
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result || []) as OfflineWeighingRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineWeighing(offlineSyncId: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    const current = JSON.parse(localStorage.getItem(STORE_NAME) || "[]") as OfflineWeighingRecord[];
    localStorage.setItem(
      STORE_NAME,
      JSON.stringify(current.filter((r) => r.offlineSyncId !== offlineSyncId))
    );
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(offlineSyncId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
