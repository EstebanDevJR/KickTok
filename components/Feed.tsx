"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { preconnect } from "react-dom";
import type { ClipsPage, ClipTime, KickClip } from "@/lib/kick";
import { getTopCategories, getTopChannels, recordAffinity } from "@/lib/affinity";
import { isMatureHidden, setMatureHidden, subscribeSettings } from "@/lib/settings";
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

interface Favorites {
  categories: string[];
  channels: string[];
}

function pageUrl(
  mode: FeedMode,
  cursor: string,
  time: ClipTime,
  seed: string,
  favs: Favorites,
  scope?: FeedScope,
): string {
  if (mode === "mix") {
    let url = `/api/feed?seed=${encodeURIComponent(seed)}&page=${encodeURIComponent(cursor)}`;
    if (favs.categories.length > 0)
      url += `&fc=${encodeURIComponent(favs.categories.join(","))}`;
    if (favs.channels.length > 0)
      url += `&fh=${encodeURIComponent(favs.channels.join(","))}`;
    return url;
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

// 18+ clips are removed outright when the filter is on. Watched clips are
// only dropped in MIX mode — unless that would empty the page, in which
// case repeats beat a blank feed.
function filterClips(
  clips: KickClip[],
  mode: FeedMode,
  hideMature: boolean,
): KickClip[] {
  const pool = hideMature ? clips.filter((c) => !c.is_mature) : clips;
  if (mode !== "mix") return pool;
  const watched = getWatchedSet();
  const unseen = pool.filter((c) => !watched.has(c.id));
  return unseen.length > 0 ? unseen : pool;
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
  const [volume, setVolume] = useState(0.8);
  const [activeIndex, setActiveIndex] = useState(0);
  const volumeRef = useRef(0.8);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const clipsRef = useRef<KickClip[]>(initial?.clips ?? []);
  const cursorRef = useRef<string | null>(initial?.nextCursor ?? null);
  const seedRef = useRef(initialSeed);
  const reshufflesRef = useRef(0);
  const fetchingRef = useRef(false);
  const generationRef = useRef(0);
  const favsRef = useRef<Favorites>({ categories: [], channels: [] });
  const hideMatureRef = useRef(false);

  const hideMature = useSyncExternalStore(
    subscribeSettings,
    isMatureHidden,
    () => false,
  );

  preconnect("https://clips.kick.com");

  // Favorites are snapshotted alongside the seed: refreshing them only when
  // the seed changes keeps /api/feed pagination deterministic in-session.
  const refreshFavorites = useCallback(() => {
    favsRef.current = {
      categories: getTopCategories(4),
      channels: getTopChannels(4),
    };
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

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
      if (nextMode === "mix") {
        seedRef.current = newSeed();
        refreshFavorites();
      }
      containerRef.current?.scrollTo({ top: 0 });
      try {
        const page = await fetchPage(
          pageUrl(nextMode, "0", nextTime, seedRef.current, favsRef.current, scope),
        );
        if (generation !== generationRef.current) return;
        replaceClips(filterClips(page.clips, nextMode, hideMatureRef.current));
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
    [replaceClips, refreshFavorites, scope],
  );

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || fetchingRef.current) return;
    fetchingRef.current = true;
    const generation = generationRef.current;
    try {
      const page = await fetchPage(
        pageUrl(mode, cursor, time, seedRef.current, favsRef.current, scope),
      );
      if (generation !== generationRef.current) return;
      replaceClips(
        appendUnique(
          clipsRef.current,
          filterClips(page.clips, mode, hideMatureRef.current),
        ),
      );

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
        refreshFavorites();
        cursorRef.current = "0";
      } else {
        cursorRef.current = null;
      }
    } catch {
      // transient — the next scroll near the end retries
    } finally {
      fetchingRef.current = false;
    }
  }, [mode, time, scope, replaceClips, refreshFavorites]);

  // Initial load when server-side prefetch failed. State already starts
  // empty + loading, so only the fetch itself happens here.
  useEffect(() => {
    if (initial) return;
    const generation = generationRef.current;
    (async () => {
      try {
        refreshFavorites();
        const page = await fetchPage(
          pageUrl(
            defaultMode,
            "0",
            defaultTime,
            seedRef.current,
            favsRef.current,
            scope,
          ),
        );
        if (generation !== generationRef.current) return;
        replaceClips(filterClips(page.clips, defaultMode, hideMatureRef.current));
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
  }, [initial, defaultMode, defaultTime, scope, replaceClips, refreshFavorites]);

  // Flipping the 18+ filter on also scrubs clips that are already loaded;
  // flipping it off only affects pages fetched from then on.
  useEffect(() => {
    hideMatureRef.current = hideMature;
    if (!hideMature) return;
    const filtered = clipsRef.current.filter((c) => !c.is_mature);
    if (filtered.length !== clipsRef.current.length) {
      replaceClips(filtered);
      setActiveIndex((i) => Math.max(0, Math.min(i, filtered.length - 1)));
    }
  }, [hideMature, replaceClips]);

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

  // Record history + taste signal, and pull the next page a few cards
  // before the end.
  useEffect(() => {
    const clip = clipsRef.current[activeIndex];
    if (clip) {
      markWatched(clip.id);
      recordAffinity(clip, 1);
    }
    if (clips.length > 0 && activeIndex >= clips.length - 3) void loadMore();
  }, [activeIndex, clips.length, loadMore]);

  const scrollByCard = useCallback((dir: 1 | -1) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({
      top: dir * container.clientHeight,
      behavior: "smooth",
    });
  }, []);

  const handleClipEnded = useCallback(
    (index: number): boolean => {
      if (index >= clipsRef.current.length - 1) return false;
      scrollByCard(1);
      return true;
    },
    [scrollByCard],
  );

  const handleVolumeChange = useCallback((v: number) => {
    const next = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    volumeRef.current = next;
    setVolume(next);
    if (next > 0) setMuted(false);
    else setMuted(true);
  }, []);

  // Keyboard: arrows navigate, M mutes, [ ] adjust volume.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const container = containerRef.current;
      if (!container) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        scrollByCard(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key.toLowerCase() === "m") {
        setMuted((m) => !m);
      } else if (e.key === "[") {
        handleVolumeChange(volumeRef.current - 0.1);
      } else if (e.key === "]") {
        handleVolumeChange(volumeRef.current + 0.1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleVolumeChange, scrollByCard]);

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
        volume={volume}
        hideMature={hideMature}
        scopeLabel={scope?.label}
        onModeChange={handleModeChange}
        onTimeChange={handleTimeChange}
        onToggleMute={() => setMuted((m) => !m)}
        onVolumeChange={handleVolumeChange}
        onToggleMature={() => setMatureHidden(!hideMature)}
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
            volume={volume}
            onToggleMute={() => setMuted((m) => !m)}
            onVolumeChange={handleVolumeChange}
            onEnded={() => handleClipEnded(i)}
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
        ↑↓ scroll · click pause · double-click like · drag bar seek · M mute · [ ] volume
      </p>
    </main>
  );
}
