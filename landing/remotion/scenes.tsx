import type { ReactNode } from "react";
import { AbsoluteFill, Series, useCurrentFrame } from "remotion";
import { AppMockup, type MockState } from "@/mockup/AppMockup";
import { base, empty, livery, merged, replaced, tour } from "@/mockup/states";
import { Cursor, Editor, FileChip, Keys, along, tween, type Path, type Point } from "./overlays";
import { TOUR_SEGMENTS } from "./timing";

// Scenes of the 1400×900 TrainzLook window at 30 fps. Every UI state is one the real app showed (see states.ts);
// only the pointer, the dragged file, the key hints and the image editor are drawn on top.

// Mockup coordinates, measured in the browser on the rendered mockup.
const P = {
  off: [1460, 940] as Point,
  view: [821, 362] as Point,
  tile: [312, 727] as Point,
  revert: [323, 836] as Point,
  importBtn: [192, 46] as Point,
  exportBtn: [301, 46] as Point,
};

// After the Replace: 1.jpg has a backup and the notice stays until the next action, as in the app.
const afterReplace: MockState = { ...base, textures: tour.textures.map((t) => ({ ...t, selected: false })), notice: replaced };

const thumb1 = base.textures[0].swatch;
const thumb1New = livery.textures[0].swatch;

function Open() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.off],
    [38, P.view],
    [60, P.view],
    [86, P.tile],
  ];
  const s: MockState = f < 46 ? empty : { ...base, viewport: empty.viewport, viewportNext: base.viewport, viewportMix: tween(f, [[46, 0], [56, 1]]) };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        {f < 52 && <FileChip at={along(f, path)} label="body.im" opacity={tween(f, [[44, 1], [52, 0]])} />}
        <Cursor f={f} path={path} clicks={[44]} />
      </AppMockup>
    </AbsoluteFill>
  );
}

function Reload() {
  const f = useCurrentFrame();
  const saved = f >= 78;
  const s: MockState = saved
    ? { ...livery, viewport: base.viewport, viewportNext: livery.viewport, viewportMix: tween(f, [[78, 0], [88, 1]]) }
    : base;
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Editor
          at={[tween(f, [[0, 1020], [14, 990], [100, 990], [116, 1020]]), 110]}
          opacity={tween(f, [[0, 0], [14, 1], [100, 1], [116, 0]])}
          before={thumb1}
          after={thumb1New}
          reveal={tween(f, [[22, 0], [60, 1]])}
        />
        <Keys at={[1110, 540]} keys={["Ctrl", "S"]} opacity={tween(f, [[64, 0], [70, 1], [92, 1], [100, 0]])} />
      </AppMockup>
    </AbsoluteFill>
  );
}

function Replace() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.off],
    [34, P.tile],
    [46, P.tile],
    [60, P.revert],
  ];
  const dropped = f >= 40;
  const s: MockState = dropped
    ? {
        ...afterReplace,
        viewport: livery.viewport,
        viewportNext: base.viewport,
        viewportMix: tween(f, [[40, 0], [50, 1]]),
        hotButton: f >= 60 ? "Revert 1.jpg" : undefined,
      }
    : { ...livery, notice: undefined, textures: livery.textures.map((t, i) => (i === 0 ? { ...t, drop: f >= 26 } : t)) };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        {f < 46 && <FileChip at={along(f, path)} label="livery-merah.jpg" opacity={tween(f, [[38, 1], [46, 0]])} />}
        <Cursor f={f} path={path} clicks={[40]} />
        <Keys at={[360, 760]} keys={["Ctrl", "Z"]} opacity={tween(f, [[62, 0], [68, 1]])} />
      </AppMockup>
    </AbsoluteFill>
  );
}

function Highlight() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.revert],
    [20, P.tile],
  ];
  const s: MockState = f < 20 ? afterReplace : tour;
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Cursor f={f} path={path} />
      </AppMockup>
    </AbsoluteFill>
  );
}

function Merge() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.tile],
    [26, P.importBtn],
    [60, P.importBtn],
    [80, P.exportBtn],
  ];
  const s: MockState =
    f < 30
      ? { ...afterReplace, hotButton: f > 22 ? "Import .im…" : undefined }
      : {
          ...merged,
          textures: afterReplace.textures,
          tilesScroll: tween(f, [[36, 0], [56, 560]]),
          hotButton: f > 76 ? "Export merged…" : undefined,
          notice: f >= 86 ? "Exported body_merged.im: 13 parts · copied masiniskin.texture.txt, masiniskin.jpg" : merged.notice,
        };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Cursor f={f} path={path} clicks={[28, 84]} />
      </AppMockup>
    </AbsoluteFill>
  );
}

// Fades the livery state to the empty window so the hero loop restarts on Open without a jump.
function Outro() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AppMockup state={f < 20 ? livery : { ...empty, viewport: livery.viewport, viewportNext: empty.viewport, viewportMix: tween(f, [[20, 0], [40, 1]]) }} />
    </AbsoluteFill>
  );
}

const SCENES = { S1: Open, S2: Reload, S3: Replace, S4: Highlight, S7: Merge };

// Tour camera: the part of the 1400×900 window each step is about, as [x, y, width] (height keeps 14:9). It glides
// there over the first 18 frames of the step, from wherever the previous step was looking.
const FOCUS: Record<keyof typeof SCENES, [number, number, number]> = {
  S1: [0, 0, 1400], // the whole window opening
  S2: [300, 40, 1100], // viewport and the image editor
  S3: [120, 380, 800], // Texture Browser: drop, backup, Revert
  S4: [200, 240, 1000], // the car and its tile
  S7: [0, 20, 1100], // Import / Export buttons and the placement fields
};
const camKeys = TOUR_SEGMENTS.reduce<{ at: number; keys: [number, number[]][] }>(
  ({ at, keys }, [scene, frames]) => ({
    at: at + frames,
    keys: at ? [...keys, [at, keys.at(-1)![1]], [at + 18, FOCUS[scene]]] : [[0, FOCUS[scene]]],
  }),
  { at: 0, keys: [] },
).keys;

function Camera({ children }: { children: ReactNode }) {
  const f = useCurrentFrame();
  const [x, y, w] = [0, 1, 2].map((i) => tween(f, camKeys.map(([k, v]) => [k, v[i]])));
  return <AbsoluteFill style={{ transformOrigin: "0 0", transform: `scale(${1400 / w}) translate(${-x}px, ${-y}px)` }}>{children}</AbsoluteFill>;
}

export function Tour() {
  return (
    <Camera>
      <Series>
      {TOUR_SEGMENTS.map(([scene, frames]) => {
        const Scene = SCENES[scene];
        return (
          <Series.Sequence key={scene} durationInFrames={frames}>
            <Scene />
          </Series.Sequence>
        );
      })}
      </Series>
    </Camera>
  );
}

export function Hero() {
  return (
    <Series>
      <Series.Sequence durationInFrames={90}>
        <Open />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <Reload />
      </Series.Sequence>
      <Series.Sequence durationInFrames={45}>
        <Outro />
      </Series.Sequence>
    </Series>
  );
}
