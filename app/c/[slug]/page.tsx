import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Feed from "@/components/Feed";
import { getClips, SLUG_RE, type ClipsPage } from "@/lib/kick";
import { randomSeed } from "@/lib/recommend";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `@${slug} — KickTok`,
    description: `The best clips from ${slug} on Kick, in a vertical feed.`,
  };
}

export default async function ChannelPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  if (!SLUG_RE.test(slug)) notFound();

  let initial: ClipsPage | null = null;
  let label = `@${slug}`;
  try {
    initial = await getClips({ channel: slug, sort: "view", time: "all" });
    const username = initial.clips[0]?.channel.username;
    if (username) label = `@${username}`;
  } catch {
    // Feed falls back to fetching client-side through /api/clips.
  }

  return (
    <Feed
      initial={initial}
      initialSeed={randomSeed()}
      scope={{ channel: slug, label }}
    />
  );
}
