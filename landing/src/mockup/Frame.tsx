import type { ReactNode } from "react";

export type Rect = [x: number, y: number, w: number, h: number];

const FULL: Rect = [0, 0, 1400, 900];

// Shows the `focus` part of the 1400×900 mockup at the frame's width, in CSS only so it paints with the HTML
// (no wait for JavaScript). tan(atan2(100cqw, Wpx)) is the unitless ratio frame width / W. `zoom` rather than a
// transform: the mockup is laid out at its shown size instead of rasterised as one huge scaled layer.
export function Frame({ focus = FULL, label, className = "", children }: { focus?: Rect; label: string; className?: string; children: ReactNode }) {
  const [x, y, w, h] = focus;
  return (
    <div role="img" aria-label={label} className={`relative overflow-hidden [container-type:inline-size] ${className}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <div className="absolute" style={{ zoom: `tan(atan2(100cqw, ${w}px))`, left: -x, top: -y }}>
        {children}
      </div>
    </div>
  );
}
