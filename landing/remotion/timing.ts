// Frame counts only, so the page can map scroll to frames without loading Remotion.
export const FPS = 30;
export const WIDTH = 1400;
export const HEIGHT = 900;

// Tour segments in the order of the tour cards (site.ts `tour`, matched by `scene`).
export const TOUR_SEGMENTS = [
  ["open", 90],
  ["edit", 130],
  ["replace", 120],
  ["select", 75],
  ["livery", 140],
] as const;
export const TOUR_FRAMES = TOUR_SEGMENTS.reduce((n, [, f]) => n + f, 0);
export const HERO_FRAMES = 90 + 130 + 45;
