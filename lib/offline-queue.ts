/** Fila de escritas offline em IndexedDB (somente no navegador). */
const DB = "mki-offline", STORE = "ops";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise((resolve, reject) => { const r = fn(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
};

export type QueuedOp = { clientId: string; type: string; [k: string]: unknown };
export const enqueue = (op: QueuedOp) => tx("readwrite", (s) => s.put(op));
export const list = () => tx<QueuedOp[]>("readonly", (s) => s.getAll());
export const remove = (id: string) => tx("readwrite", (s) => s.delete(id));
export const count = () => tx<number>("readonly", (s) => s.count());

export type SendResult = "ok" | "network" | "rejected";

export async function send(op: QueuedOp): Promise<{ result: SendResult; error?: string }> {
  try {
    const res = await fetch("/api/quick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(op) });
    if (res.ok) return { result: "ok" };
    if (res.status === 401 || res.status >= 500) return { result: "network" }; // sessão expirada ou servidor fora: tenta depois
    const body = await res.json().catch(() => ({}));
    return { result: "rejected", error: body.error };
  } catch { return { result: "network" }; }
}

/** Envia o que ficou guardado. Mantém o que falhou por rede; descarta o que o servidor recusou. */
export async function flush(): Promise<{ sent: number; dropped: number; left: number }> {
  let sent = 0, dropped = 0;
  for (const op of await list()) {
    const r = await send(op);
    if (r.result === "network") break;
    await remove(op.clientId);
    if (r.result === "ok") sent++; else dropped++;
  }
  return { sent, dropped, left: await count() };
}
