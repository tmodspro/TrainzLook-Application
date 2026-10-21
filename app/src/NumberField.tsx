import { useRef, useState } from "react";

type Props = {
  label: string;
  value: number;
  /** Change per pixel dragged; Shift drags 10x finer. */
  step: number;
  /** Ctrl-drag snaps to multiples of this; the ◀ ▶ arrows step by it. */
  snap: number;
  unit?: string;
  /** Called once at the start of each edit (drag, arrow click, typed value), before the first change: one undo step. */
  onBegin: () => void;
  onChange: (v: number) => void;
};

const tidy = (v: number) => Math.round(v * 1e4) / 1e4;

/**
 * Blender-style number field: drag left/right to change the value, click to type it, Enter / Esc to commit / cancel,
 * ◀ ▶ to step. No spinner and no mouse-wheel changes.
 */
export default function NumberField({ label, value, step, snap, unit = "", onBegin, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  // Measured from the press position: pointer lock (Blender's endless drag) gives bogus jumps in WebView2.
  const drag = useRef<{ start: number; x: number; dragging: boolean } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: value, x: e.clientX, dragging: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.dragging) {
      if (Math.abs(dx) < 3) return;
      d.dragging = true;
      onBegin();
    }
    let v = d.start + dx * step * (e.shiftKey ? 0.1 : 1);
    if (e.ctrlKey) v = Math.round(v / snap) * snap;
    onChange(tidy(v));
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.dragging) setEditing(String(value));
  };

  const nudge = (dir: number) => {
    onBegin();
    onChange(tidy(value + dir * snap));
  };

  const commit = () => {
    const v = Number(editing?.replace(",", "."));
    setEditing(null);
    if (editing !== null && editing.trim() !== "" && Number.isFinite(v) && v !== value) {
      onBegin();
      onChange(tidy(v));
    }
  };

  if (editing !== null) {
    return (
      <input
        className="numfield editing"
        autoFocus
        value={editing}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setEditing(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="numfield">
      <button className="arrow" tabIndex={-1} onClick={() => nudge(-1)} aria-label={`${label} down`}>
        ◀
      </button>
      <div
        className="numbody"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span>{label}</span>
        <span>
          {tidy(value)}
          {unit}
        </span>
      </div>
      <button className="arrow" tabIndex={-1} onClick={() => nudge(1)} aria-label={`${label} up`}>
        ▶
      </button>
    </div>
  );
}
