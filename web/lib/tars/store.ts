// Conversation history, kept in the visitor's own browser (IndexedDB). Nothing is sent to the server: SERVER_HISTORY is the disabled hook
// for a server-side copy, pending a decision. Every access is wrapped: private windows and blocked storage fall back to memory.

export interface StoredConversation {
  id: string;
  title: string;
  updated: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
}

/** TODO(Luis's decision): save conversations on the server. Off: nothing leaves the browser. */
export const SERVER_HISTORY = false;

const DB = "pyrion-tars";
const STORE = "conversations";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    } catch (e) {
      reject(e);
    }
  });
}

const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> => {
  try {
    const db = await open();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = f(tx.objectStore(STORE));
      tx.oncomplete = () => {
        resolve(req ? req.result : undefined);
        db.close();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return undefined;
  }
};

export const loadConversations = async (): Promise<StoredConversation[]> => ((await run<StoredConversation[]>("readonly", (s) => s.getAll())) ?? []).sort((a, b) => b.updated - a.updated);
export const saveConversation = async (c: StoredConversation) => void (await run("readwrite", (s) => s.put(c)));
export const deleteConversation = async (id: string) => void (await run("readwrite", (s) => s.delete(id)));
export const clearConversations = async () => void (await run("readwrite", (s) => s.clear()));

/** A title from the first thing the visitor said. */
export const titleFrom = (text: string) => (text.length > 40 ? `${text.slice(0, 40)}…` : text) || "New chat";
