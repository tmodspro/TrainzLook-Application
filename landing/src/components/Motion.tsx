"use client";

import { ReactLenis } from "lenis/react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";

// Smooth wheel scrolling (it is what makes the scrubbed tour feel continuous) and smooth in-page anchors (sections
// keep 96 px of top padding, enough to clear the sticky nav). Reduced-motion visitors keep native scrolling and
// instant jumps, and Motion drops its transforms for them.
export function Motion({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  // One listener for every glass card: it moves the card's orange spotlight to the pointer.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.<HTMLElement>(".glass-card");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      {!reduce && <ReactLenis root options={{ anchors: true, autoRaf: true }} />}
      {children}
    </MotionConfig>
  );
}
