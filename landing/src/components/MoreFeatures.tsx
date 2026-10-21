"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { extras } from "@/site";
import { AppMockup } from "@/mockup/AppMockup";
import { Frame } from "@/mockup/Frame";
import { crops, navigation, thumbnail, uv, validation } from "@/mockup/states";
import { Reveal } from "./Reveal";

const states = { S5: uv, S6: validation, S8: thumbnail, S9: navigation };
const ease = [0.22, 1, 0.36, 1] as const;

// One large view of the app inside a glass panel. Tabs advance on their own (a line fills in the active tab; it
// pauses while the pointer or focus is in the panel, and is off for reduced motion); the view tilts toward the
// pointer and cross-fades between features; the caption swaps with them.
export function MoreFeatures() {
  const [pick, setPick] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const f = extras[pick];

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-7, 7]), { stiffness: 150, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [6, -6]), { stiffness: 150, damping: 18 });
  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };

  // Arrow keys move between tabs, as in any tab list.
  const keys = (e: KeyboardEvent) => {
    const d = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (!d) return;
    e.preventDefault();
    const next = (pick + d + extras.length) % extras.length;
    setPick(next);
    document.getElementById(`tab-${extras[next].scene}`)?.focus();
  };

  return (
    <section aria-labelledby="lainnya-title" className="px-4 py-24">
      <Reveal className="glass-card mx-auto max-w-6xl rounded-[2rem] p-5 sm:p-8">
        <div
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => {
            setPaused(false);
            px.set(0);
            py.set(0);
          }}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-accent">Juga ada</p>
              <h2 id="lainnya-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Detail kecil yang menghemat waktu
              </h2>
            </div>
            <div role="tablist" aria-label="Fitur lainnya" onKeyDown={keys} className="flex flex-wrap gap-2">
              {extras.map((e, i) => {
                const on = i === pick;
                return (
                  <button
                    key={e.scene}
                    id={`tab-${e.scene}`}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="lainnya-view"
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPick(i)}
                    className={`btn-glass relative overflow-hidden text-sm ${on ? "btn-primary" : "text-muted"}`}
                  >
                    {on && <motion.span layoutId="tab-light" className="absolute inset-0 -z-10 rounded-full bg-accent/15" transition={{ duration: 0.4, ease }} />}
                    {e.title}
                    {on && !reduce && (
                      <span
                        key={pick}
                        aria-hidden
                        onAnimationEnd={() => setPick((pick + 1) % extras.length)}
                        className="absolute inset-x-5 bottom-1.5 h-0.5 origin-left animate-[grow_6s_linear] rounded-full bg-accent"
                        style={{ animationPlayState: paused ? "paused" : "running" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.6fr_1fr]">
            <div className="[perspective:1400px]" onPointerMove={tilt}>
              <motion.div
                id="lainnya-view"
                role="tabpanel"
                aria-labelledby={`tab-${f.scene}`}
                style={{ rotateX, rotateY }}
                className="glass-card rounded-2xl p-1.5 [transform-style:preserve-3d]"
              >
                <div className="relative overflow-hidden rounded-xl">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={f.scene}
                      initial={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.45, ease }}
                    >
                      <Frame focus={crops[f.scene]} label={`Cuplikan TrainzLook: ${f.title}`}>
                        <AppMockup state={states[f.scene as keyof typeof states]} />
                      </Frame>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={f.scene}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.35, ease }}
              >
                <h3 className="text-2xl font-semibold">{f.title}</h3>
                <p className="mt-3 text-pretty text-muted">{f.body}</p>
                {f.meta && (
                  <p className="mt-5 inline-block rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-text/80">{f.meta}</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
