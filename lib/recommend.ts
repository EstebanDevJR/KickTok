import { getClips, type ClipsPage, type KickClip } from "@/lib/kick";

// The "MIX" feed. Kick's API only offers deterministic sorts, so refreshing
// always returned the same clips in the same order. This builds a
// recommendation deck instead: several pools are fetched (trending today,
// this week, this month, and the freshest uploads), each pool is shuffled
// with a seeded RNG, and the deck is assembled by weighted round-robin
// sampling across pools. A new seed on every page load means a new order,
// while the same seed keeps pagination stable within one session.

const PAGE_SIZE = 20;

interface Pool {
  clips: KickClip[];
  weight: number;
}

// FNV-1a — turns the client's seed string into a uint32 for the RNG.
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32 — tiny deterministic PRNG, plenty for shuffling a feed.
function mulberry32(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchPool(
  sort: "view" | "date",
  time: "day" | "week" | "month",
): Promise<KickClip[]> {
  try {
    return (await getClips({ sort, time })).clips;
  } catch {
    // One pool failing shouldn't kill the whole feed.
    return [];
  }
}

async function buildDeck(seed: string): Promise<KickClip[]> {
  const [day, week, month, fresh] = await Promise.all([
    fetchPool("view", "day"),
    fetchPool("view", "week"),
    fetchPool("view", "month"),
    fetchPool("date", "day"),
  ]);

  const rand = mulberry32(hashSeed(seed));

  // Weights decide how often each pool gets the next slot: mostly what's hot
  // today, with steady doses of weekly/monthly hits and brand-new clips so
  // small streamers surface too.
  const pools: Pool[] = [
    { clips: shuffle(day, rand), weight: 0.4 },
    { clips: shuffle(week, rand), weight: 0.25 },
    { clips: shuffle(month, rand), weight: 0.15 },
    { clips: shuffle(fresh, rand), weight: 0.2 },
  ];

  const seen = new Set<string>();
  const deck: KickClip[] = [];

  while (pools.some((p) => p.clips.length > 0)) {
    const total = pools.reduce(
      (sum, p) => sum + (p.clips.length > 0 ? p.weight : 0),
      0,
    );
    let pick = rand() * total;
    let chosen: Pool | null = null;
    for (const pool of pools) {
      if (pool.clips.length === 0) continue;
      pick -= pool.weight;
      if (pick <= 0) {
        chosen = pool;
        break;
      }
    }
    chosen ??= pools.find((p) => p.clips.length > 0)!;

    const clip = chosen.clips.pop()!;
    if (!seen.has(clip.id)) {
      seen.add(clip.id);
      deck.push(clip);
    }
  }

  return deck;
}

// Taste-based promotion: clips matching the client's favorite channels or
// categories keep their deck position but with a shrunken sort key, so they
// surface earlier without displacing variety. Purely a function of the deck
// and the favorites, so pagination stays deterministic within a session.
function promoteFavorites(
  deck: KickClip[],
  favCategories: string[],
  favChannels: string[],
): KickClip[] {
  if (favCategories.length === 0 && favChannels.length === 0) return deck;
  const cats = new Set(favCategories);
  const chans = new Set(favChannels);
  return deck
    .map((clip, i) => {
      const factor = chans.has(clip.channel.slug)
        ? 0.55
        : cats.has(clip.category.slug)
          ? 0.7
          : 1;
      return { clip, score: i * factor };
    })
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.clip);
}

export async function getMixedFeed(
  seed: string,
  page: number,
  favCategories: string[] = [],
  favChannels: string[] = [],
): Promise<ClipsPage> {
  const deck = promoteFavorites(await buildDeck(seed), favCategories, favChannels);
  const start = page * PAGE_SIZE;
  const clips = deck.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < deck.length;
  return { clips, nextCursor: hasMore ? String(page + 1) : null };
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
