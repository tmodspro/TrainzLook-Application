"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, type Ref } from "react";
import { Hero, Tour } from "../../../remotion/scenes";
import { FPS, HEIGHT, HERO_FRAMES, TOUR_FRAMES, WIDTH } from "../../../remotion/timing";

// Loaded on demand (next/dynamic) so Remotion stays out of the first page load.
export default function PlayerView({ kind, playerRef, onReady }: { kind: "hero" | "tour"; playerRef?: Ref<PlayerRef>; onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady]);
  const hero = kind === "hero";
  return (
    <Player
      ref={playerRef}
      component={hero ? Hero : Tour}
      durationInFrames={hero ? HERO_FRAMES : TOUR_FRAMES}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      autoPlay={hero}
      loop={hero}
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      style={{ width: "100%" }}
    />
  );
}
