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
    title: `${slug} clips — KickTok`,
    description: `The best ${slug} clips on Kick, in a vertical feed.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = raw.toLowerCase();
  if (!SLUG_RE.test(slug)) notFound();

  let initial: ClipsPage | null = null;
  let label = slug;
  try {
    initial = await getClips({ category: slug, sort: "view", time: "all" });
    const name = initial.clips[0]?.category.name;
    if (name) label = name;
  } catch {
    // Feed falls back to fetching client-side through /api/clips.
  }

  return (
    <Feed
      initial={initial}
      initialSeed={randomSeed()}
      scope={{ category: slug, label }}
    />
  );
}
