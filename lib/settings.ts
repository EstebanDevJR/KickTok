// Tiny localStorage-backed store, shaped for useSyncExternalStore.

const KEY = "kicktok:hide-mature";

let cache: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (cache !== null) return cache;
  if (typeof window === "undefined") return false;
  try {
    cache = window.localStorage.getItem(KEY) === "1";
  } catch {
    cache = false;
  }
  return cache;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isMatureHidden(): boolean {
  return read();
}

export function setMatureHidden(hidden: boolean): void {
  cache = hidden;
  try {
    window.localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {
    // storage full or blocked — the preference just won't persist
  }
  listeners.forEach((l) => l());
}
