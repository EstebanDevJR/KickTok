// Tiny localStorage-backed store, shaped for useSyncExternalStore.

const KEY = "kicktok:likes";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (cache) return cache;
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

export function subscribeLikes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isLiked(id: string): boolean {
  return read().has(id);
}

export function setLiked(id: string, liked: boolean): void {
  const ids = read();
  if (liked) ids.add(id);
  else ids.delete(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // storage full or blocked — likes just won't persist
  }
  listeners.forEach((l) => l());
}
