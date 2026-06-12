import { gotScraping } from "got-scraping";

export type ClipSort = "view" | "date" | "like";
export type ClipTime = "day" | "week" | "month" | "all";

export interface KickClip {
  id: string;
  livestream_id: string;
  category_id: string;
  channel_id: number;
  user_id: number;
  title: string;
  clip_url: string;
  thumbnail_url: string;
  privacy: string;
  duration: number;
  created_at: string;
  is_mature: boolean;
  video_url: string;
  view_count: number;
  likes_count: number;
  category: {
    id: number;
    name: string;
    slug: string;
    parent_category: string;
  };
  creator: {
    id: number;
    username: string;
    slug: string;
  };
  channel: {
    id: number;
    username: string;
    slug: string;
    profile_picture: string | null;
  };
}

export interface ClipsPage {
  clips: KickClip[];
  nextCursor: string | null;
}

const KICK_API_BASE = "https://kick.com/api/v2";
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { at: number; data: ClipsPage }>();

// Narrows the global clip feed to one channel or one category. Kick exposes
// the same clips listing shape under /channels/{slug}/clips and
// /categories/{slug}/clips.
export interface ClipScope {
  channel?: string;
  category?: string;
}

export interface GetClipsOptions extends ClipScope {
  cursor?: string;
  sort?: ClipSort;
  time?: ClipTime;
}

export const SLUG_RE = /^[a-z0-9_-]{1,64}$/i;

function clipsUrl({ channel, category }: ClipScope): string {
  if (channel) return `${KICK_API_BASE}/channels/${channel}/clips`;
  if (category) return `${KICK_API_BASE}/categories/${category}/clips`;
  return `${KICK_API_BASE}/clips`;
}

export async function getClips({
  cursor = "0",
  sort = "view",
  time = "day",
  channel,
  category,
}: GetClipsOptions = {}): Promise<ClipsPage> {
  if (channel && !SLUG_RE.test(channel)) throw new Error("Invalid channel");
  if (category && !SLUG_RE.test(category)) throw new Error("Invalid category");

  const key = `${channel ?? ""}:${category ?? ""}:${sort}:${time}:${cursor}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = `${clipsUrl({ channel, category })}?cursor=${encodeURIComponent(cursor)}&sort=${sort}&time=${time}`;

  // Kick's API sits behind Cloudflare TLS fingerprinting; got-scraping
  // impersonates a real browser handshake, which is why plain fetch 403s.
  const res = await gotScraping({
    url,
    headers: { accept: "application/json" },
    timeout: { request: 15_000 },
    responseType: "json",
  });

  if (res.statusCode !== 200) {
    throw new Error(`Kick API responded with ${res.statusCode}`);
  }

  const body = res.body as { clips?: KickClip[]; nextCursor?: string | null };
  const data: ClipsPage = {
    clips: (body.clips ?? []).filter((c) => c.privacy === "public"),
    nextCursor: body.nextCursor ?? null,
  };

  cache.set(key, { at: Date.now(), data });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  return data;
}
