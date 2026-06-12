<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# KickTok — Agent Guide

## Project overview

KickTok is an open-source TikTok-style vertical clip feed for [Kick.com](https://kick.com).  
Stack: **Next.js 16 App Router · React 19 · Tailwind CSS v4 · hls.js · got-scraping · TypeScript**.

## Key architecture decisions

- **No official Kick API.** Kick's undocumented `/api/v2/clips` sits behind Cloudflare TLS fingerprinting. All Kick requests go through Next.js route handlers that use `got-scraping` to present a browser-like TLS handshake. Never call Kick's API directly from the browser or with plain `fetch`/`axios`.
- **In-memory cache.** `lib/kick.ts` caches responses for 60 s to reduce traffic to Kick. Don't bypass or remove the cache without a good reason.
- **Client-only persistence.** Likes (`lib/likes.ts`) and watch history (`lib/watched.ts`) are localStorage-only — no database, no user accounts.
- **MIX feed algorithm.** `lib/recommend.ts` implements a seeded PRNG (mulberry32) + weighted round-robin across four time-window pools. Keep the seed stable within a session so pagination is deterministic.

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
  recommend.ts          seeded shuffle + weighted pool mixing
  kick.ts               got-scraping fetcher, Kick types, 60 s memory cache
  format.ts             compact numbers, durations, relative time
  likes.ts              localStorage likes
  watched.ts            localStorage watch history
```

## Conventions

- **App Router only.** No `pages/` directory. Server components are the default; opt in to `'use client'` only where strictly needed (event handlers, localStorage, browser APIs).
- **Tailwind v4.** Use utility classes; no `tailwind.config.js` — configuration lives in `globals.css` with `@theme`.
- **TypeScript strict.** All new code must type-check (`npm run build`).
- **No comments on obvious code.** Only add a comment when the WHY is non-obvious.

## Dev workflow

```bash
npm run dev    # http://localhost:3000
npm run build  # type-check + production build
npm run lint   # ESLint
```
