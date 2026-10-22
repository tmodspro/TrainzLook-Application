import type { ReactNode } from "react";
import { AbsoluteFill, Series, useCurrentFrame } from "remotion";
import { AppMockup, type MockState } from "@/mockup/AppMockup";
import { base, empty, livery, replaced, tour } from "@/mockup/states";
import { Cursor, Editor, FileChip, Keys, along, tween, type Path, type Point } from "./overlays";
import { TOUR_SEGMENTS } from "./timing";

// Scenes of the 1400×900 TrainzLook window at 30 fps. Every UI state and notice is one the real app shows (see
// states.ts and app/src/App.tsx); only the pointer, the dragged file, the key hints and the image editor are drawn on top.

// Mockup coordinates, measured in the browser on the rendered mockup.
const P = {
  off: [1460, 940] as Point,
  recent: [821, 406] as Point,
  pencil: [359, 684] as Point,
  tile: [312, 731] as Point,
  before: [486, 77] as Point,
  partRow: [70, 121] as Point,
  saveLivery: [442, 648] as Point,
  liverySelect: [366, 648] as Point,
  dialogSave: [811, 500] as Point,
};

const blueThumb = livery.textures[0].swatch;
const redThumb = base.textures[0].swatch;
const withThumb = (s: MockState, swatch: string, extra: Partial<MockState["textures"][0]> = {}): MockState["textures"] =>
  s.textures.map((t, i) => (i === 0 ? { ...t, swatch, ...extra } : t));
// After the Replace: 1.jpg is the red file again, with one backup, and the notice stays until the next action.
const afterReplace: MockState = { ...base, textures: withThumb(base, redThumb, { backups: 1 }), notice: replaced };

// Start screen → Recent → the mesh opens.
function Open() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.off],
    [34, P.recent],
    [70, P.recent],
    [88, P.tile],
  ];
  const s: MockState =
    f < 42
      ? { ...empty, hotButton: f > 30 ? `Recent ${empty.recent![0]}` : undefined }
      : f < 52
        ? { ...empty, busy: "Opening body.im…", hotButton: `Recent ${empty.recent![0]}` }
        : { ...base, viewport: empty.viewport, viewportNext: base.viewport, viewportMix: tween(f, [[52, 0], [62, 1]]) };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Cursor f={f} path={path} clicks={[40]} />
      </AppMockup>
    </AbsoluteFill>
  );
}

// Pencil → the image editor opens → paint → Ctrl+S → the view reloads.
function Edit() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.tile],
    [18, P.pencil],
    [30, P.pencil],
    [46, [1180, 300]],
  ];
  const opened = "Opened 1.jpg in Photoshop · save there and the view updates";
  const saved = f >= 96;
  const s: MockState = saved
    ? { ...livery, viewport: base.viewport, viewportNext: livery.viewport, viewportMix: tween(f, [[96, 0], [106, 1]]) }
    : { ...base, hotButton: f > 14 && f < 32 ? "Edit 1.jpg" : undefined, notice: f >= 24 ? opened : undefined };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Editor
          at={[tween(f, [[28, 1020], [42, 990], [118, 990], [128, 1020]]), 110]}
          opacity={tween(f, [[28, 0], [42, 1], [118, 1], [128, 0]])}
          before={redThumb}
          after={blueThumb}
          reveal={tween(f, [[48, 0], [82, 1]])}
        />
        <Keys at={[1110, 540]} keys={["Ctrl", "S"]} opacity={tween(f, [[84, 0], [88, 1], [108, 1], [116, 0]])} />
        <Cursor f={f} path={path} clicks={[24]} />
      </AppMockup>
    </AbsoluteFill>
  );
}

// A file dropped on the tile replaces 1.jpg (backup first); holding B shows the texture from before.
function Replace() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.off],
    [32, P.tile],
    [44, P.tile],
    [64, P.before],
  ];
  const holding = f >= 72 && f < 104;
  const s: MockState =
    f < 38
      ? { ...livery, notice: undefined, textures: withThumb(livery, blueThumb, { drop: f >= 24 }) }
      : f < 46
        ? { ...livery, notice: undefined, busy: "Replacing 1.jpg…" }
        : {
            ...afterReplace,
            viewport: livery.viewport,
            viewportNext: base.viewport,
            viewportMix: holding ? 0 : tween(f, [[46, 0], [56, 1]]),
            comparing: holding,
            hotButton: f >= 64 && !holding ? "Before (B)" : undefined,
          };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        {f < 44 && <FileChip at={along(f, path)} label="livery-merah.jpg" opacity={tween(f, [[36, 1], [44, 0]])} />}
        <Cursor f={f} path={path} clicks={[38, 72]} />
        <Keys at={[P.before[0] + 70, P.before[1] + 30]} keys={["B"]} opacity={holding ? 1 : 0} />
      </AppMockup>
    </AbsoluteFill>
  );
}

// A part clicked in the Outliner: row, tile and the parts using its texture light up; Statistics counts it.
function Select() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.before],
    [22, P.partRow],
  ];
  const s: MockState =
    f < 26
      ? { ...afterReplace, parts: base.parts.map((p, i) => (i === 0 ? { ...p, hot: f > 16 } : p)) }
      : { ...tour, textures: tour.textures.map((t) => ({ ...t, backups: 1 })) };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Cursor f={f} path={path} clicks={[26]} />
      </AppMockup>
    </AbsoluteFill>
  );
}

// Save livery… names the current textures; Livery… puts a saved preset back on (only changed textures, backed up).
function Livery() {
  const f = useCurrentFrame();
  const path: Path = [
    [0, P.partRow],
    [20, P.saveLivery],
    [28, P.saveLivery],
    [44, P.dialogSave],
    [70, P.dialogSave],
    [88, P.liverySelect],
  ];
  const name = "Merah Kuning".slice(0, Math.max(0, Math.floor((f - 34) / 2)));
  const s: MockState =
    f < 30
      ? { ...afterReplace, hotButton: f > 18 ? "Save livery…" : undefined }
      : f < 74
        ? { ...afterReplace, livery: { name, note: "Copies the 11 textures this mesh uses" }, hotButton: f > 62 ? "Save" : undefined }
        : f < 96
          ? { ...afterReplace, liveries: 2, notice: "Saved livery Merah Kuning: 11 texture(s)", hotButton: f > 86 ? "Livery…" : undefined }
          : f < 104
            ? { ...afterReplace, liveries: 2, busy: "Applying livery Biru…" }
            : {
                ...livery,
                liveries: 2,
                textures: withThumb(livery, blueThumb, { backups: 2 }),
                viewport: base.viewport,
                viewportNext: livery.viewport,
                viewportMix: tween(f, [[104, 0], [114, 1]]),
                notice: "Applied livery Biru: 1 texture(s) changed · Ctrl+Z undoes · hold B to compare",
              };
  return (
    <AbsoluteFill>
      <AppMockup state={s}>
        <Cursor f={f} path={path} clicks={[28, 72, 94]} />
      </AppMockup>
    </AbsoluteFill>
  );
}

// Fades the reloaded livery to the start screen so the hero loop restarts on Open without a jump.
function Outro() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AppMockup state={f < 20 ? livery : { ...empty, viewport: livery.viewport, viewportNext: empty.viewport, viewportMix: tween(f, [[20, 0], [40, 1]]) }} />
    </AbsoluteFill>
  );
}

const SCENES = { open: Open, edit: Edit, replace: Replace, select: Select, livery: Livery };

// Tour camera: the part of the 1400×900 window each step is about, as [x, y, width] (height keeps 14:9). It glides
// there over the first 18 frames of the step, from wherever the previous step was looking.
const FOCUS: Record<keyof typeof SCENES, [number, number, number]> = {
  open: [320, 100, 1000], // the start screen and its Recent list
  edit: [242, 40, 1158], // the pencil on the tile, the image editor and the viewport
  replace: [100, 40, 1300], // the dropped tile and the Before (B) button
  select: [0, 40, 1100], // Outliner, Statistics and the lit parts
  livery: [150, 190, 1100], // Texture Browser header and the Save livery popup
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
      <Series.Sequence durationInFrames={130}>
        <Edit />
      </Series.Sequence>
      <Series.Sequence durationInFrames={45}>
        <Outro />
      </Series.Sequence>
    </Series>
  );
}
