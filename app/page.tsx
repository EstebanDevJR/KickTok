import Feed from "@/components/Feed";
import type { ClipsPage } from "@/lib/kick";
import { getMixedFeed, randomSeed } from "@/lib/recommend";

export const dynamic = "force-dynamic";

export default async function Home() {
  // A fresh seed per request: every refresh deals a different feed.
  const seed = randomSeed();
  let initial: ClipsPage | null = null;
  try {
    initial = await getMixedFeed(seed, 0);
  } catch {
    // Feed falls back to fetching client-side through /api/feed.
  }
  return <Feed initial={initial} initialSeed={seed} />;
}
