// Watch history, used by the MIX feed to avoid re-serving clips the user
// has already seen. Kept as a capped FIFO in localStorage.

const KEY = "kicktok:watched";
const MAX = 1000;

let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function getWatchedSet(): Set<string> {
  return new Set(read());
}

export function markWatched(id: string): void {
  const list = read();
  if (list[list.length - 1] === id) return;
  const next = list.filter((x) => x !== id);
  next.push(id);
  if (next.length > MAX) next.splice(0, next.length - MAX);
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked — history just won't persist
  }
}
