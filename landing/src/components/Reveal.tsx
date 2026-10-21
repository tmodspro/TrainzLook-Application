"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Content below the fold rises out of a blur as it enters the screen, once. Not used above the fold (it would
// hold back the first paint). Reduced motion: MotionConfig keeps only the fade.
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
