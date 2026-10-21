"use client";

import type { PlayerRef } from "@remotion/player";
import { useLenis } from "lenis/react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import type { Feature } from "@/site";
import { TOUR_FRAMES, TOUR_SEGMENTS } from "../../../remotion/timing";
import { Reveal } from "../Reveal";

const PlayerView = dynamic(() => import("./PlayerView"), { ssr: false });

// False on the server, for reduced-motion visitors and below 1024 px: they get the static poster only. On a phone the
// 1400 px window is too small to read, and re-rendering it every frame costs more than it shows.
function useMotion(query = "(prefers-reduced-motion: no-preference) and (min-width: 1024px)") {
  return useSyncExternalStore(
    (changed) => {
      const m = matchMedia(query);
      m.addEventListener("change", changed);
      return () => m.removeEventListener("change", changed);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

// True once the browser is idle after load and `box` is near the screen: Remotion (~110 KB) never competes with
// the first paint, and a player the reader never scrolls to is never loaded.
function useLate(box: RefObject<HTMLElement | null>, on: boolean) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) return;
    let io: IntersectionObserver | undefined;
    const watch = () => {
      io = new IntersectionObserver(([e]) => e.isIntersecting && setLate(true), { rootMargin: "50%" });
      io.observe(box.current!);
    };
    const ric = window.requestIdleCallback as typeof requestIdleCallback | undefined; // missing in older Safari
    const idle = ric ? ric(watch, { timeout: 2500 }) : window.setTimeout(watch, 1500);
    return () => {
      if (ric) cancelIdleCallback(idle);
      else clearTimeout(idle);
      io?.disconnect();
    };
  }, [box, on]);
  return late && on;
}

// The poster (a static mockup) keeps the layout; the player loads on top of it and plays only while on screen.
export function HeroDemo({ poster, className = "" }: { poster: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const ok = useLate(box, useMotion());
  const player = useRef<PlayerRef>(null);
  useEffect(() => {
    if (!ok) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? player.current?.play() : player.current?.pause()));
    io.observe(box.current!);
    return () => io.disconnect();
  }, [ok]);
  return (
    <div ref={box} className={`relative overflow-hidden ${className}`}>
      {poster}
      {ok && (
        <div className="absolute inset-0">
          <PlayerView kind="hero" playerRef={player} />
        </div>
      )}
    </div>
  );
}

const ends = TOUR_SEGMENTS.reduce<number[]>((a, [, f]) => [...a, (a.at(-1) ?? 0) + f], []);
const clamp = (v: number) => Math.min(1, Math.max(0, v));

// Pinned stage (desktop): the section holds still while the reader scrolls through it; scroll position is the
// player's time. Step pills fill as their step plays, the caption card swaps per step, and the Remotion camera
// (scenes.tsx) zooms to the part of the window the step is about. Phones get the poster and the steps as cards.
export function TourDemo({ steps, poster }: { steps: Feature[]; poster: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const player = useRef<PlayerRef>(null);
  const ok = useLate(track, useMotion());
  const [step, setStep] = useState(0);
  const lenis = useLenis();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });

  const show = useCallback((p: number) => {
    const frame = Math.round(p * (TOUR_FRAMES - 1));
    player.current?.seekTo(frame);
    bars.current.forEach((b, i) => {
      const start = i ? ends[i - 1] : 0;
      b?.style.setProperty("transform", `scaleX(${clamp((frame - start) / (ends[i] - start))})`);
    });
    setStep(ends.findIndex((e) => frame < e));
  }, []);
  useMotionValueEvent(scrollYProgress, "change", show);
  const ready = useCallback(() => show(scrollYProgress.get()), [show, scrollYProgress]);

  // A pill jumps to the end of its step, where the step's result is on screen.
  const go = (i: number) => {
    const el = track.current!;
    const top = el.getBoundingClientRect().top + scrollY + ((el.offsetHeight - innerHeight) * (ends[i] - 6)) / (TOUR_FRAMES - 1);
    if (lenis) lenis.scrollTo(top);
    else scrollTo({ top });
  };

  return (
    <>
      <div className="space-y-4 lg:hidden">
        <div className="glass-card overflow-hidden rounded-2xl p-1.5">
          <div className="overflow-hidden rounded-xl">{poster}</div>
        </div>
        <ol className="space-y-4">
          {steps.map((f, i) => (
            <li key={f.scene}>
              <Reveal delay={i * 0.05} className="glass-card rounded-2xl p-6">
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-pretty text-muted">{f.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>

      <div ref={track} className="relative hidden lg:block" style={{ height: `${steps.length * 85}vh` }}>
        <div className="sticky top-0 flex h-dvh flex-col items-center justify-center gap-6 pt-20 pb-8">
          <nav aria-label="Langkah fitur" className="flex flex-wrap justify-center gap-2">
            {steps.map((f, i) => (
              <button
                key={f.scene}
                type="button"
                aria-current={i === step ? "step" : undefined}
                onClick={() => go(i)}
                className={`btn-glass relative overflow-hidden text-sm ${i === step ? "btn-primary" : "text-muted"}`}
              >
                {f.short}
                <span
                  ref={(el) => {
                    bars.current[i] = el;
                  }}
                  aria-hidden
                  className="absolute inset-x-5 bottom-1.5 h-0.5 origin-left scale-x-0 rounded-full bg-accent"
                />
              </button>
            ))}
          </nav>

          <div className="relative w-full" style={{ maxWidth: "calc((100dvh - 14rem) * 14 / 9)" }}>
            <div className="glass-card rounded-[1.4rem] p-2">
              <div className="relative overflow-hidden rounded-2xl">
                {poster}
                {ok && (
                  <div className="absolute inset-0">
                    <PlayerView kind="tour" playerRef={player} onReady={ready} />
                  </div>
                )}
              </div>
            </div>
            <div className="absolute -bottom-4 -left-8 w-[24rem] max-w-[45%]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  className="glass-card rounded-2xl p-5"
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-xs font-semibold text-accent">
                    Langkah {step + 1} dari {steps.length}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{steps[step].title}</h3>
                  <p className="mt-2 text-sm text-pretty text-muted">{steps[step].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
