"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import type { ClipsPage, ClipTime, KickClip } from "@/lib/kick";
import { getWatchedSet, markWatched } from "@/lib/watched";
import ClipCard from "@/components/ClipCard";
import TopBar, { type FeedMode } from "@/components/TopBar";
import { KickBoltIcon } from "@/components/icons";

export interface FeedScope {
  channel?: string;
  category?: string;
  label: string;
}

interface FeedProps {
  initial: ClipsPage | null;
  initialSeed: string;
  scope?: FeedScope;
}

const MAX_RESHUFFLES = 5;

function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pageUrl(
  mode: FeedMode,
  cursor: string,
  time: ClipTime,
  seed: string,
  scope?: FeedScope,
): string {
  if (mode === "mix") {
    return `/api/feed?seed=${encodeURIComponent(seed)}&page=${encodeURIComponent(cursor)}`;
  }
  let url = `/api/clips?cursor=${encodeURIComponent(cursor)}&sort=${mode}&time=${time}`;
  if (scope?.channel) url += `&channel=${encodeURIComponent(scope.channel)}`;
  if (scope?.category) url += `&category=${encodeURIComponent(scope.category)}`;
  return url;
}

async function fetchPage(url: string): Promise<ClipsPage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function appendUnique(existing: KickClip[], incoming: KickClip[]): KickClip[] {
  const seen = new Set(existing.map((c) => c.id));
  return [...existing, ...incoming.filter((c) => !seen.has(c.id))];
}

// In MIX mode, clips the user already watched are dropped — unless that
// would empty the page, in which case repeats beat a blank feed.
function dropWatched(clips: KickClip[], mode: FeedMode): KickClip[] {
  if (mode !== "mix") return clips;
  const watched = getWatchedSet();
  const unseen = clips.filter((c) => !watched.has(c.id));
  return unseen.length > 0 ? unseen : clips;
}

export default function Feed({ initial, initialSeed, scope }: FeedProps) {
  // Scoped feeds (one channel / one category) have no MIX deck; they start
  // on most-viewed of all time, which is the natural "best of" view.
  const defaultMode: FeedMode = scope ? "view" : "mix";
  const defaultTime: ClipTime = scope ? "all" : "day";

  const [clips, setClips] = useState<KickClip[]>(initial?.clips ?? []);
  const [mode, setMode] = useState<FeedMode>(defaultMode);
  const [time, setTime] = useState<ClipTime>(defaultTime);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const clipsRef = useRef<KickClip[]>(initial?.clips ?? []);
  const cursorRef = useRef<string | null>(initial?.nextCursor ?? null);
  const seedRef = useRef(initialSeed);
  const reshufflesRef = useRef(0);
  const fetchingRef = useRef(false);
  const generationRef = useRef(0);

  preconnect("https://clips.kick.com");

  const replaceClips = useCallback((next: KickClip[]) => {
    clipsRef.current = next;
    setClips(next);
  }, []);

  const resetFeed = useCallback(
    async (nextMode: FeedMode, nextTime: ClipTime) => {
      const generation = ++generationRef.current;
      replaceClips([]);
      setActiveIndex(0);
      setError(null);
      setLoading(true);
      cursorRef.current = null;
      reshufflesRef.current = 0;
      if (nextMode === "mix") seedRef.current = newSeed();
      containerRef.current?.scrollTo({ top: 0 });
      try {
        const page = await fetchPage(
          pageUrl(nextMode, "0", nextTime, seedRef.current, scope),
        );
        if (generation !== generationRef.current) return;
        replaceClips(dropWatched(page.clips, nextMode));
        cursorRef.current = page.nextCursor;
      } catch {
        if (generation !== generationRef.current) return;
        setError(
          "Couldn't load clips from Kick. It may be rate-limiting — try again.",
        );
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    },
    [replaceClips, scope],
  );

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || fetchingRef.current) return;
    fetchingRef.current = true;
    const generation = generationRef.current;
    try {
      const page = await fetchPage(
        pageUrl(mode, cursor, time, seedRef.current, scope),
      );
      if (generation !== generationRef.current) return;
      replaceClips(appendUnique(clipsRef.current, dropWatched(page.clips, mode)));

      if (page.nextCursor) {
        cursorRef.current = page.nextCursor;
      } else if (
        mode === "mix" &&
        page.clips.length > 0 &&
        reshufflesRef.current < MAX_RESHUFFLES
      ) {
        // Deck exhausted: deal a fresh one. The seed changes so the order
        // differs, and dedupe + watch history drop anything already shown.
        reshufflesRef.current += 1;
        seedRef.current = newSeed();
        cursorRef.current = "0";
      } else {
        cursorRef.current = null;
      }
    } catch {
      // transient — the next scroll near the end retries
    } finally {
      fetchingRef.current = false;
    }
  }, [mode, time, scope, replaceClips]);

  // Initial load when server-side prefetch failed. State already starts
  // empty + loading, so only the fetch itself happens here.
  useEffect(() => {
    if (initial) return;
    const generation = generationRef.current;
    (async () => {
      try {
        const page = await fetchPage(
          pageUrl(defaultMode, "0", defaultTime, seedRef.current, scope),
        );
        if (generation !== generationRef.current) return;
        replaceClips(dropWatched(page.clips, defaultMode));
        cursorRef.current = page.nextCursor;
      } catch {
        if (generation !== generationRef.current) return;
        setError(
          "Couldn't load clips from Kick. It may be rate-limiting — try again.",
        );
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    })();
  }, [initial, defaultMode, defaultTime, scope, replaceClips]);

  // Track which card owns the viewport.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 },
    );
    container
      .querySelectorAll("[data-index]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [clips.length]);

  // Record history + pull the next page a few cards before the end.
  useEffect(() => {
    const clip = clipsRef.current[activeIndex];
    if (clip) markWatched(clip.id);
    if (clips.length > 0 && activeIndex >= clips.length - 3) void loadMore();
  }, [activeIndex, clips.length, loadMore]);

  // Keyboard: arrows navigate, M mutes, click on the card toggles playback.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const container = containerRef.current;
      if (!container) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        container.scrollBy({
          top:
            e.key === "ArrowDown"
              ? container.clientHeight
              : -container.clientHeight,
          behavior: "smooth",
        });
      } else if (e.key.toLowerCase() === "m") {
        setMuted((m) => !m);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleModeChange(next: FeedMode) {
    // Re-tapping MIX deals a new shuffle on purpose.
    if (next === mode && next !== "mix") return;
    setMode(next);
    void resetFeed(next, time);
  }

  function handleTimeChange(next: ClipTime) {
    if (next === time) return;
    setTime(next);
    void resetFeed(mode, next);
  }

  return (
    <main className="relative h-dvh bg-ink">
      <TopBar
        mode={mode}
        time={time}
        muted={muted}
        scopeLabel={scope?.label}
        onModeChange={handleModeChange}
        onTimeChange={handleTimeChange}
        onToggleMute={() => setMuted((m) => !m)}
      />

      <div
        ref={containerRef}
        className="no-scrollbar h-dvh snap-y snap-mandatory overflow-y-scroll"
      >
        {clips.map((clip, i) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={i}
            active={i === activeIndex}
            preload={Math.abs(i - activeIndex) === 1}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ))}

        {loading && clips.length === 0 && (
          <div className="flex h-dvh flex-col items-center justify-center gap-4">
            <KickBoltIcon
              width={42}
              height={42}
              className="text-glow animate-pulse text-kick"
            />
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-fog/50">
              loading clips
            </p>
          </div>
        )}

        {!loading && !error && clips.length === 0 && (
          <div className="flex h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
            <KickBoltIcon width={42} height={42} className="text-fog/20" />
            <p className="max-w-sm text-sm text-fog/70">
              No clips here{scope ? ` for ${scope.label}` : ""} yet.
            </p>
          </div>
        )}

        {error && clips.length === 0 && (
          <div className="flex h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
            <KickBoltIcon width={42} height={42} className="text-fog/20" />
            <p className="max-w-sm text-sm text-fog/70">{error}</p>
            <button
              onClick={() => void resetFeed(mode, time)}
              className="border border-kick bg-kick/10 px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-kick transition-colors hover:bg-kick hover:text-ink"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <p
        data-ui="kbd-hint"
        className="pointer-events-none fixed bottom-2 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.25em] text-fog/30 sm:block"
      >
        ↑↓ scroll · click pause · double-click like · M mute
      </p>
    </main>
  );
}
