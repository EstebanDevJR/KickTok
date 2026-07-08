// Taste profile for the MIX feed: per-category and per-channel scores built
// from watch history (weight 1) and likes (weight 3), kept in localStorage.
// The top slugs are sent to /api/feed once per session so the server can
// promote matching clips without any server-side state.

import type { KickClip } from "@/lib/kick";

const KEY = "kicktok:affinity";
const MAX_ENTRIES = 200;

interface AffinityData {
  categories: Record<string, number>;
  channels: Record<string, number>;
}

let cache: AffinityData | null = null;

function read(): AffinityData {
  if (cache) return cache;
  if (typeof window === "undefined") return { categories: {}, channels: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AffinityData>) : null;
    cache = {
      categories: parsed?.categories ?? {},
      channels: parsed?.channels ?? {},
    };
  } catch {
    cache = { categories: {}, channels: {} };
  }
  return cache;
}

// Drops the lowest-scoring entries once a map outgrows the cap, so one
// long-lived profile can't bloat localStorage.
function prune(scores: Record<string, number>): Record<string, number> {
  const entries = Object.entries(scores);
  if (entries.length <= MAX_ENTRIES) return scores;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export function recordAffinity(clip: KickClip, weight: number): void {
  const data = read();
  data.categories[clip.category.slug] =
    (data.categories[clip.category.slug] ?? 0) + weight;
  data.channels[clip.channel.slug] =
    (data.channels[clip.channel.slug] ?? 0) + weight;
  data.categories = prune(data.categories);
  data.channels = prune(data.channels);
  cache = data;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked — the profile just won't persist
  }
}

function top(scores: Record<string, number>, n: number): string[] {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([slug]) => slug);
}

export function getTopCategories(n: number): string[] {
  return top(read().categories, n);
}

export function getTopChannels(n: number): string[] {
  return top(read().channels, n);
}
