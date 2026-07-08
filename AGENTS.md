<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# KickTok — Agent Guide

KickTok is an open-source TikTok-style vertical clip feed for [Kick.com](https://kick.com).
Stack: **Next.js 16 App Router · React 19 · Tailwind CSS v4 · hls.js · got-scraping · TypeScript**.

## Commands

```bash
npm run dev    # dev server at http://localhost:3000
npm run build  # type-check + production build
npm run lint   # ESLint
```

## Definition of done

A change is not finished until `npm run build` passes (it runs the strict type-check) and `npm run lint` is clean.

- There is **no test suite** and no `npm test` script — verification is build + lint + manual check in the browser.
- There are **no environment variables or secrets**. Don't introduce any without asking first.

## Key architecture decisions

- **No official Kick API.** Kick's undocumented `/api/v2/clips` sits behind Cloudflare TLS fingerprinting. All Kick requests go through Next.js route handlers that use `got-scraping` to present a browser-like TLS handshake. IMPORTANT: never call Kick's API from the browser or with plain `fetch`/`axios` — it will get a Cloudflare 403.
- **In-memory cache.** `lib/kick.ts` caches Kick responses for 60 s to reduce traffic to Kick. Don't bypass or remove it without a good reason.
- **Client-only persistence.** Likes (`lib/likes.ts`) and watch history (`lib/watched.ts`) are localStorage-only. There is no database and no user accounts — that is a deliberate product decision, not a TODO. Don't add server-side persistence or auth.
- **MIX feed algorithm.** `lib/recommend.ts` implements a seeded PRNG (mulberry32) + weighted round-robin across four time-window pools. The seed must stay stable within a session so pagination is deterministic — don't reseed between pages.

## File map

```
app/
  page.tsx              server component — prefetches first MIX page
  c/[slug]/page.tsx     channel feed
  g/[slug]/page.tsx     category feed
  manifest.ts           PWA manifest
  api/feed/route.ts     MIX recommendation endpoint
  api/clips/route.ts    proxy to Kick's sorted clip feeds
components/
  Feed.tsx              snap-scroll container, modes (MIX/TOP/NEW), infinite scroll
  ClipCard.tsx          HLS player, action rail, double-tap like, progress bar
  TopBar.tsx            logo, scope pill, tab switcher, time range, mute toggle
  icons.tsx             inline SVG icon helpers
lib/
  recommend.ts          seeded shuffle + weighted pool mixing + favorites boost
  kick.ts               got-scraping fetcher, Kick types, 60 s memory cache
  format.ts             compact numbers, durations, relative time
  likes.ts              localStorage likes
  watched.ts            localStorage watch history
  affinity.ts           localStorage taste profile (category/channel scores)
  settings.ts           localStorage preferences (18+ filter)
```

## Conventions

- **App Router only.** No `pages/` directory. Server components are the default; add `'use client'` only where strictly needed (event handlers, localStorage, browser APIs).
- **Tailwind v4.** Utility classes only; there is no `tailwind.config.js` — theme configuration lives in `globals.css` under `@theme`.
- **TypeScript strict.** All new code must type-check.
- **localStorage access must be guarded** (`typeof window !== "undefined"` or run inside effects) — these modules are imported by components that also render on the server.
- **Comments explain WHY, never WHAT.** Don't comment obvious code.

## Gotchas

- **HLS playback is two-branch:** `ClipCard.tsx` prefers hls.js even when the browser claims native HLS support, because Chrome answers `"maybe"` to the HLS MIME type but can't demux it; only Safari takes the native `canPlayType` branch. Test video changes in both.
- **The 60 s cache hides your changes:** when iterating on `lib/kick.ts` or the API routes, stale cached responses can make a fix look ineffective. Restart the dev server or wait out the TTL before concluding a change didn't work.
- **A Cloudflare 403 from Kick means TLS fingerprinting**, not bad credentials or a wrong URL. The fix is always "route it through `got-scraping` in a route handler", never headers or retries.
