"use client";

import Link from "next/link";
import type { ClipSort, ClipTime } from "@/lib/kick";
import {
  ClockIcon,
  FlameIcon,
  GithubIcon,
  KickBoltIcon,
  ShuffleIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "@/components/icons";

export type FeedMode = "mix" | ClipSort;

const MODE_TABS: { value: FeedMode; label: string; icon: typeof FlameIcon }[] = [
  { value: "mix", label: "MIX", icon: ShuffleIcon },
  { value: "view", label: "TOP", icon: FlameIcon },
  { value: "date", label: "NEW", icon: ClockIcon },
];

const TIME_OPTIONS: { value: ClipTime; label: string }[] = [
  { value: "day", label: "24H" },
  { value: "week", label: "7D" },
  { value: "month", label: "30D" },
  { value: "all", label: "ALL" },
];

interface TopBarProps {
  mode: FeedMode;
  time: ClipTime;
  muted: boolean;
  volume: number;
  scopeLabel?: string;
  onModeChange: (mode: FeedMode) => void;
  onTimeChange: (time: ClipTime) => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
}

export default function TopBar({
  mode,
  time,
  muted,
  volume,
  scopeLabel,
  onModeChange,
  onTimeChange,
  onToggleMute,
  onVolumeChange,
}: TopBarProps) {
  // MIX is a global deck; inside a channel/category feed only TOP/NEW apply.
  const tabs = scopeLabel
    ? MODE_TABS.filter((t) => t.value !== "mix")
    : MODE_TABS;
  function cycleTime() {
    const idx = TIME_OPTIONS.findIndex((t) => t.value === time);
    onTimeChange(TIME_OPTIONS[(idx + 1) % TIME_OPTIONS.length].value);
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-ink/90 via-ink/50 to-transparent pb-8">
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <Link
          href="/"
          data-ui="logo"
          className="flex shrink-0 items-center gap-1.5"
          aria-label="KickTok home"
        >
          <span className="flex items-center gap-1 bg-kick px-2 py-1 font-display text-lg font-extrabold leading-none text-ink">
            <KickBoltIcon width={14} height={14} />
            KICK
          </span>
          <span className="hidden font-display text-lg font-extrabold leading-none tracking-tight text-fog min-[400px]:inline">
            TOK
          </span>
        </Link>

        {scopeLabel && (
          <Link
            href="/"
            data-ui="scope-pill"
            title="Back to the global feed"
            className="group flex min-w-0 shrink items-center gap-1.5 rounded-full border border-kick/40 bg-kick/10 px-3 py-1 font-mono text-xs font-semibold text-kick backdrop-blur-md transition-colors hover:bg-kick hover:text-ink"
          >
            <span className="truncate">{scopeLabel}</span>
            <span aria-hidden className="shrink-0 opacity-60 group-hover:opacity-100">
              ✕
            </span>
          </Link>
        )}

        <nav
          data-ui="mode-nav"
          className="flex min-w-0 shrink items-center gap-1 rounded-full border border-white/10 bg-smoke/80 p-1 backdrop-blur-md"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = mode === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => onModeChange(tab.value)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-semibold transition-colors sm:px-3 ${
                  isActive ? "bg-kick text-ink" : "text-fog/60 hover:text-fog"
                }`}
                title={
                  tab.value === "mix"
                    ? "Shuffled mix — tap again to reshuffle"
                    : tab.value === "view"
                      ? "Most viewed"
                      : "Newest"
                }
              >
                <Icon width={12} height={12} className="shrink-0" />
                <span className="hidden min-[420px]:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div data-ui="top-controls" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {mode !== "mix" && (
            <button
              onClick={cycleTime}
              className="rounded-full border border-kick/40 bg-smoke/80 px-3 py-1.5 font-mono text-xs font-semibold text-kick backdrop-blur-md transition-colors hover:bg-kick hover:text-ink"
              title="Time range — tap to cycle"
            >
              {TIME_OPTIONS.find((t) => t.value === time)?.label}
            </button>
          )}

          <div className="group hidden items-center sm:flex">
            <button
              onClick={onToggleMute}
              className="rounded-full border border-white/10 bg-smoke/80 p-2 text-fog/80 backdrop-blur-md transition-colors hover:border-kick/40 hover:text-kick"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <VolumeOffIcon width={16} height={16} />
              ) : (
                <VolumeOnIcon width={16} height={16} />
              )}
            </button>
            <div className="max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-w-[5rem] group-hover:opacity-100">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="ml-1.5 w-16 cursor-pointer accent-kick"
                aria-label="Volume"
              />
            </div>
          </div>

          <a
            href="https://github.com/EstebanDevJR/KickTok"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full border border-white/10 bg-smoke/80 p-2 text-fog/80 backdrop-blur-md transition-colors hover:border-kick/40 hover:text-kick sm:block"
            aria-label="Source code on GitHub"
          >
            <GithubIcon width={16} height={16} />
          </a>
        </div>
      </div>
    </header>
  );
}
