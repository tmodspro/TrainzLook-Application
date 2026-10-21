// Frame counts only, so the page can map scroll to frames without loading Remotion.
export const FPS = 30;
export const WIDTH = 1400;
export const HEIGHT = 900;

// Tour segments in the order of the tour cards (site.ts `tour`).
export const TOUR_SEGMENTS = [
  ["S1", 90],
  ["S2", 120],
  ["S3", 90],
  ["S4", 60],
  ["S7", 110],
] as const;
export const TOUR_FRAMES = TOUR_SEGMENTS.reduce((n, [, f]) => n + f, 0);
export const HERO_FRAMES = 90 + 120 + 45;
