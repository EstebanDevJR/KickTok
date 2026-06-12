import { NextRequest, NextResponse } from "next/server";
import { getClips, SLUG_RE, type ClipSort, type ClipTime } from "@/lib/kick";

export const dynamic = "force-dynamic";

const SORTS: ClipSort[] = ["view", "date", "like"];
const TIMES: ClipTime[] = ["day", "week", "month", "all"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const cursor = params.get("cursor") ?? "0";
  const sortParam = params.get("sort") ?? "view";
  const timeParam = params.get("time") ?? "day";
  const channel = params.get("channel") ?? undefined;
  const category = params.get("category") ?? undefined;

  if (channel && !SLUG_RE.test(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  if (category && !SLUG_RE.test(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const sort = SORTS.includes(sortParam as ClipSort)
    ? (sortParam as ClipSort)
    : "view";
  const time = TIMES.includes(timeParam as ClipTime)
    ? (timeParam as ClipTime)
    : "day";

  if (cursor.length > 64) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  try {
    const page = await getClips({ cursor, sort, time, channel, category });
    return NextResponse.json(page, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (err) {
    console.error("[api/clips]", err);
    return NextResponse.json(
      { error: "Failed to reach Kick. Try again in a moment." },
      { status: 502 },
    );
  }
}
