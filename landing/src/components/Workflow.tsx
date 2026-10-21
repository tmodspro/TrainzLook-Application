"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { useRef } from "react";
import { workflow } from "@/site";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./ui";

// The three steps sit on a rail line (the brand's motif) that fills in Signal Orange as the reader scrolls through
// them: the order matters, so the motion shows it. Horizontal from md up, vertical on phones.
const track = "[--rail-dir:to_right] [--tie-dir:to_bottom] md:[--rail-dir:to_bottom] md:[--tie-dir:to_right]";
const place = "absolute top-1 bottom-1 left-[7px] w-[10px] md:top-[7px] md:bottom-auto md:left-0 md:right-0 md:h-[10px] md:w-auto";

export function Workflow() {
  const list = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 80%", "end 55%"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => fill.current?.style.setProperty("--p", String(p)));
  return (
    <section aria-labelledby="cara-kerja-title" id="cara-kerja" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="cara-kerja-title" eyebrow="Cara kerja" title="Dari kuas ke kereta, tanpa bolak-balik" />
        <div ref={list} className="relative">
          <div aria-hidden className={`rail ${track} ${place}`} />
          <div
            ref={fill}
            aria-hidden
            className={`rail ${track} ${place} [--rail:var(--accent)] [--tie:rgb(255_138_0/0.45)] [clip-path:inset(0_0_calc((1-var(--p))*100%)_0)] md:[clip-path:inset(0_calc((1-var(--p))*100%)_0_0)]`}
            style={{ "--p": 0 } as never}
          />
          <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
            {workflow.map((s, i) => (
              <li key={s.title} className="relative pl-10 md:pt-12 md:pl-0">
                <span aria-hidden className="absolute top-0.5 left-0 size-6 rounded-full border-2 border-accent bg-bg shadow-[0_0_14px_rgb(255_138_0/0.6)] md:top-0" />
                <Reveal delay={i * 0.12} className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-pretty text-muted">{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
