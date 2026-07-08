"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Hls from "hls.js";
import type { KickClip } from "@/lib/kick";
import { recordAffinity } from "@/lib/affinity";
import { formatCount, formatDuration, timeAgo } from "@/lib/format";
import { isLiked, setLiked as persistLiked, subscribeLikes } from "@/lib/likes";
import {
  ExternalIcon,
  EyeIcon,
  HeartIcon,
  KickBoltIcon,
  PauseIcon,
  PlayIcon,
  ShareIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "@/components/icons";

interface ClipCardProps {
  clip: KickClip;
  index: number;
  active: boolean;
  preload: boolean;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  // Returns true when the feed advanced to the next clip; false means this
  // was the last card, so the clip replays in place instead.
  onEnded: () => boolean;
}

interface Burst {
  key: number;
  x: number;
  y: number;
}

export default function ClipCard({
  clip,
  index,
  active,
  preload,
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
  onEnded,
}: ClipCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const seekAreaRef = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekingRef = useRef(false);

  const liked = useSyncExternalStore(
    subscribeLikes,
    () => isLiked(clip.id),
    () => false,
  );
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [flash, setFlash] = useState<{ kind: "play" | "pause"; key: number } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const shouldLoad = active || preload;
  const clipUrl = `https://kick.com/${clip.channel.slug}/clips/${clip.id}`;

  // Attach the HLS source only while the card is on (or next to) screen,
  // and tear it down when it scrolls far away to keep memory bounded.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;

    // Prefer hls.js over native playback: Chrome answers "maybe" to the HLS
    // MIME type but can't actually demux it. Safari takes the native branch.
    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 12, capLevelToPlayerSize: true });
      hls.loadSource(clip.video_url);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = clip.video_url;
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [shouldLoad, clip.video_url]);

  // `paused` mirrors the element's play/pause events so the big play glyph
  // only shows when playback is actually stopped on the active card.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onPlaying);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onPlaying);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active, shouldLoad]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = muted;
      video.volume = volume;
    }
  }, [muted, volume, shouldLoad]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setFlash({ kind: "play", key: Date.now() });
    } else {
      video.pause();
      setFlash({ kind: "pause", key: Date.now() });
    }
  }

  function like(at?: { x: number; y: number }) {
    if (!liked) recordAffinity(clip, 3);
    persistLiked(clip.id, true);
    if (at) {
      const burst = { key: Date.now(), ...at };
      setBursts((b) => [...b.slice(-3), burst]);
      setTimeout(
        () => setBursts((b) => b.filter((x) => x.key !== burst.key)),
        850,
      );
    }
  }

  function toggleLike() {
    if (!liked) recordAffinity(clip, 3);
    persistLiked(clip.id, !liked);
  }

  // Single tap toggles playback, double tap likes.
  function handleSurfaceClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      like(at);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        togglePlay();
      }, 260);
    }
  }

  // The bar and its aria value update imperatively to avoid re-rendering
  // the card several times per second.
  function paintProgress(frac: number) {
    if (progressRef.current) {
      progressRef.current.style.width = `${frac * 100}%`;
    }
    seekAreaRef.current?.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
  }

  function handleTimeUpdate() {
    if (seekingRef.current) return;
    const video = videoRef.current;
    if (!video || !video.duration) return;
    paintProgress(video.currentTime / video.duration);
  }

  function handleEnded() {
    if (onEnded()) return;
    const video = videoRef.current;
    if (video && active) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }

  function seekTo(e: React.PointerEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = frac * video.duration;
    paintProgress(frac);
  }

  function handleSeekDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekingRef.current = true;
    setScrubbing(true);
    seekTo(e);
  }

  function handleSeekMove(e: React.PointerEvent<HTMLDivElement>) {
    if (seekingRef.current) seekTo(e);
  }

  function handleSeekUp() {
    seekingRef.current = false;
    setScrubbing(false);
  }

  async function share() {
    const payload = {
      title: clip.title,
      text: `${clip.title} — ${clip.channel.username} on Kick`,
      url: clipUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(clipUrl);
        setToast("Link copied");
      }
    } catch {
      // user dismissed the share sheet
    }
  }

  const likeTotal = clip.likes_count + (liked ? 1 : 0);

  return (
    <section
      data-index={index}
      className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-ink"
    >
      {/* Blurred backdrop fills the letterbox around the 16:9 clip */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={clip.thumbnail_url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl"
      />

      <div
        className="absolute inset-0 flex cursor-pointer items-center justify-center"
        onClick={handleSurfaceClick}
      >
        <video
          ref={videoRef}
          poster={clip.thumbnail_url}
          playsInline
          muted
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="h-full w-full object-contain"
        />

        {flash && (
          <div
            key={flash.key}
            className="animate-play-flash pointer-events-none absolute rounded-full bg-ink/60 p-6 text-fog"
          >
            {flash.kind === "play" ? (
              <PlayIcon width={36} height={36} />
            ) : (
              <PauseIcon width={36} height={36} />
            )}
          </div>
        )}

        {active && paused && !flash && (
          <div className="pointer-events-none absolute rounded-full bg-ink/50 p-6 text-fog/90">
            <PlayIcon width={36} height={36} />
          </div>
        )}

        {active && buffering && !paused && (
          <div
            aria-hidden
            className="pointer-events-none absolute h-12 w-12 animate-spin rounded-full border-2 border-kick/25 border-t-kick"
          />
        )}

        {bursts.map((b) => (
          <HeartIcon
            key={b.key}
            filled
            width={84}
            height={84}
            className="animate-heart-burst pointer-events-none absolute text-kick drop-shadow-[0_0_18px_rgba(83,252,24,0.7)]"
            style={{ left: b.x - 42, top: b.y - 42 }}
          />
        ))}
      </div>

      {/* Bottom gradient for legibility */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink/95 via-ink/50 to-transparent" />

      {/* Clip metadata */}
      <div
        data-ui="clip-meta"
        className="absolute bottom-6 left-4 right-20 z-10 flex flex-col gap-2 sm:bottom-9 sm:left-6"
      >
        <Link
          href={`/c/${clip.channel.slug}`}
          className="w-fit font-display text-lg font-extrabold tracking-tight text-fog transition-colors hover:text-kick"
          title={`More clips from ${clip.channel.username}`}
        >
          @{clip.channel.username}
        </Link>
        <p className="line-clamp-2 max-w-xl text-sm text-fog/90">{clip.title}</p>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-fog/60">
          <Link
            href={`/g/${clip.category.slug}`}
            className="border border-kick/40 bg-kick/10 px-2 py-0.5 uppercase tracking-wide text-kick transition-colors hover:bg-kick hover:text-ink"
            title={`More ${clip.category.name} clips`}
          >
            {clip.category.name}
          </Link>
          <span>{formatDuration(clip.duration)}</span>
          <span>·</span>
          <span>{timeAgo(clip.created_at)}</span>
          {clip.is_mature && (
            <span className="border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-red-400">
              18+
            </span>
          )}
        </div>
      </div>

      {/* Action rail */}
      <aside
        data-ui="action-rail"
        className="absolute bottom-6 right-2 z-10 flex flex-col items-center gap-5 sm:bottom-9 sm:right-4"
      >
        <Link
          href={`/c/${clip.channel.slug}`}
          aria-label={`More clips from ${clip.channel.username}`}
          className="mb-1 block h-12 w-12 overflow-hidden rounded-full ring-2 ring-kick transition-transform hover:scale-110"
        >
          {clip.channel.profile_picture && !avatarBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clip.channel.profile_picture}
              alt={clip.channel.username}
              className="h-full w-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-smoke font-display text-lg font-extrabold text-kick">
              {clip.channel.username.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>

        <button
          onClick={toggleLike}
          className="group flex flex-col items-center gap-1"
          aria-label={liked ? "Unlike" : "Like"}
        >
          <span
            className={`rounded-full bg-ink/50 p-2.5 backdrop-blur-sm transition-all group-hover:scale-110 ${
              liked
                ? "text-kick drop-shadow-[0_0_12px_rgba(83,252,24,0.6)]"
                : "text-fog"
            }`}
          >
            <HeartIcon filled={liked} width={26} height={26} />
          </span>
          <span className="font-mono text-[11px] text-fog/80">
            {formatCount(likeTotal)}
          </span>
        </button>

        <div className="flex flex-col items-center gap-1" title="Views">
          <span className="rounded-full bg-ink/50 p-2.5 text-fog backdrop-blur-sm">
            <EyeIcon width={26} height={26} />
          </span>
          <span className="font-mono text-[11px] text-fog/80">
            {formatCount(clip.view_count)}
          </span>
        </div>

        <button
          onClick={share}
          className="group flex flex-col items-center gap-1"
          aria-label="Share clip"
        >
          <span className="rounded-full bg-ink/50 p-2.5 text-fog backdrop-blur-sm transition-transform group-hover:scale-110">
            <ShareIcon width={26} height={26} />
          </span>
          <span className="font-mono text-[11px] text-fog/80">Share</span>
        </button>

        <a
          href={clipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-1"
          aria-label="Watch on Kick"
        >
          <span className="rounded-full border border-kick/50 bg-ink/50 p-2.5 text-kick backdrop-blur-sm transition-transform group-hover:scale-110">
            <ExternalIcon width={24} height={24} />
          </span>
          <span className="font-mono text-[11px] text-fog/80">Kick</span>
        </a>

        <div className="flex flex-col items-center gap-1 sm:hidden">
          <button
            onClick={() => onVolumeChange(Math.min(1, Math.round((volume + 0.1) * 10) / 10))}
            className="rounded-full bg-ink/50 px-3 py-1.5 font-mono text-base font-bold text-fog backdrop-blur-sm"
            aria-label="Volume up"
          >
            +
          </button>
          <button
            onClick={onToggleMute}
            className="rounded-full bg-ink/50 p-2.5 text-fog backdrop-blur-sm"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeOffIcon width={22} height={22} />
            ) : (
              <VolumeOnIcon width={22} height={22} />
            )}
          </button>
          <button
            onClick={() => onVolumeChange(Math.max(0, Math.round((volume - 0.1) * 10) / 10))}
            className="rounded-full bg-ink/50 px-3 py-1.5 font-mono text-base font-bold text-fog backdrop-blur-sm"
            aria-label="Volume down"
          >
            −
          </button>
        </div>
      </aside>

      {toast && (
        <div className="animate-toast-in absolute bottom-28 left-1/2 z-20 -translate-x-1/2">
          <span className="flex items-center gap-2 border border-kick/40 bg-ink/90 px-4 py-2 font-mono text-xs text-kick backdrop-blur-md">
            <KickBoltIcon width={12} height={12} />
            {toast}
          </span>
        </div>
      )}

      {/* Playback progress — the thin bar sits inside a taller hit area so
          it stays draggable on touch screens without cluttering the UI. */}
      <div
        ref={seekAreaRef}
        className="absolute inset-x-0 bottom-0 z-20 flex h-6 cursor-pointer touch-none flex-col justify-end"
        onPointerDown={handleSeekDown}
        onPointerMove={handleSeekMove}
        onPointerUp={handleSeekUp}
        onPointerCancel={handleSeekUp}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <div
          className={`w-full bg-white/10 transition-[height] duration-150 ${
            scrubbing ? "h-1.5" : "h-0.5"
          }`}
        >
          <div
            ref={progressRef}
            className="h-full bg-kick shadow-[0_0_8px_rgba(83,252,24,0.8)]"
            style={{ width: "0%" }}
          />
        </div>
      </div>
    </section>
  );
}
