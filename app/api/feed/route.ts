import { NextRequest, NextResponse } from "next/server";
import { getMixedFeed } from "@/lib/recommend";
import { SLUG_RE } from "@/lib/kick";

export const dynamic = "force-dynamic";

// Favorite slugs arrive as CSV; anything malformed is dropped rather than
// rejected so a corrupt localStorage profile can't break the feed.
function parseSlugs(csv: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .filter((s) => SLUG_RE.test(s))
    .slice(0, 5);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const seed = params.get("seed") ?? "";
  const page = Number(params.get("page") ?? "0");

  if (!/^[a-z0-9-]{1,32}$/i.test(seed)) {
    return NextResponse.json({ error: "Invalid seed" }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 0 || page > 50) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const favCategories = parseSlugs(params.get("fc"));
  const favChannels = parseSlugs(params.get("fh"));

  try {
    const feed = await getMixedFeed(seed, page, favCategories, favChannels);
    return NextResponse.json(feed, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[api/feed]", err);
    return NextResponse.json(
      { error: "Failed to reach Kick. Try again in a moment." },
      { status: 502 },
    );
  }
}
