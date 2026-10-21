import { Easing, interpolate } from "remotion";

// Overlays drawn over the 1400×900 mockup: the pointer, a file being dragged, key hints and the image editor.

export type Key = [frame: number, value: number];

// Piecewise ease between [frame, value] keys, held at both ends.
export const tween = (f: number, keys: Key[]) =>
  interpolate(
    f,
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
    { easing: Easing.bezier(0.45, 0, 0.2, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

export type Point = [x: number, y: number];
export type Path = [frame: number, point: Point][];

export const along = (f: number, path: Path): Point => [
  tween(f, path.map(([k, p]) => [k, p[0]])),
  tween(f, path.map(([k, p]) => [k, p[1]])),
];

export function Cursor({ f, path, clicks = [] }: { f: number; path: Path; clicks?: number[] }) {
  const [x, y] = along(f, path);
  const since = clicks.map((c) => f - c).find((d) => d >= 0 && d < 14);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 20, pointerEvents: "none" }}>
      {since !== undefined && (
        <div
          style={{
            position: "absolute",
            left: -18,
            top: -18,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "2px solid #ff8a00",
            opacity: 1 - since / 14,
            transform: `scale(${0.4 + since / 10})`,
          }}
        />
      )}
      <svg width="22" height="28" viewBox="0 0 22 28" style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / .5))" }}>
        <path d="M1 1v22l6-6 4.5 9.5 3.6-1.7L10.6 15H19z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function FileChip({ at, label, opacity = 1 }: { at: Point; label: string; opacity?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: at[0] + 14,
        top: at[1] + 18,
        zIndex: 19,
        opacity,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 6,
        background: "#2b2b2bee",
        border: "1px solid #555",
        color: "#e6e6e6",
        font: "12px 'Segoe UI', var(--font-inter), sans-serif",
        boxShadow: "0 6px 16px rgb(0 0 0 / .45)",
      }}
    >
      <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
        <path d="M1 1h8l4 4v10H1z" fill="#4772b3" />
        <path d="M9 1v4h4" fill="none" stroke="#9fb8de" />
      </svg>
      {label}
    </div>
  );
}

export function Keys({ at, keys, opacity }: { at: Point; keys: string[]; opacity: number }) {
  return (
    <div style={{ position: "absolute", left: at[0], top: at[1], zIndex: 21, opacity, display: "flex", gap: 6, alignItems: "center" }}>
      {keys.map((k, i) => (
        <span key={k} style={{ display: "contents" }}>
          {i > 0 && <span style={{ color: "#e6e6e6", font: "600 16px var(--font-inter), sans-serif" }}>+</span>}
          <kbd
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              background: "#1e1f22",
              border: "1px solid #ff8a00",
              boxShadow: "0 3px 0 #000",
              color: "#f2f2f2",
              font: "600 16px var(--font-inter), sans-serif",
            }}
          >
            {k}
          </kbd>
        </span>
      ))}
    </div>
  );
}

// A plain image-editor window: the app the repainter saves from. Deliberately unbranded.
export function Editor({ at, opacity, before, after, reveal }: { at: Point; opacity: number; before: string; after: string; reveal: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: at[0],
        top: at[1],
        zIndex: 18,
        opacity,
        width: 380,
        borderRadius: 8,
        overflow: "hidden",
        background: "#2a2a2a",
        border: "1px solid #4a4a4a",
        boxShadow: "0 18px 40px rgb(0 0 0 / .55)",
        font: "12px 'Segoe UI', var(--font-inter), sans-serif",
        color: "#ddd",
      }}
    >
      <div style={{ padding: "6px 10px", background: "#202020" }}>1.jpg · editor gambar</div>
      <div style={{ position: "relative", height: 380, background: before }}>
        <div style={{ position: "absolute", inset: 0, background: after, clipPath: `inset(0 ${100 - reveal * 100}% 0 0)` }} />
      </div>
    </div>
  );
}
