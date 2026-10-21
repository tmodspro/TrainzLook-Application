import type { ReactNode } from "react";
import "./mockup.css";

// Markup mirrors app/src/App.tsx at its native 1400×900 window size; every bit of UI state is a prop so the
// L4 Remotion scenes can animate it. Copied, not imported: the landing page never depends on ../app.

export type MockTexture = {
  name: string;
  size: string;
  users: number;
  swatch: string; // CSS background of the thumbnail (a captured image)
  backups?: number;
  selected?: boolean;
  drop?: boolean;
};

export type MockState = {
  path?: string;
  parts: { material: string; problem?: boolean; hot?: boolean }[];
  attachments?: string[];
  issues?: { level: "error" | "warn" | "ok"; text: string; hot?: boolean }[];
  textures: MockTexture[];
  missing?: { problem: string; material: string }[];
  status: string;
  notice?: string;
  wireframe?: boolean;
  axes?: boolean;
  hotButton?: string; // label of a button drawn as hovered
  viewport: string; // render of the 3D view, 1158×540 CSS px
  viewportNext?: string; // cross-faded over `viewport` by `viewportMix` (0–1), for the scenes
  viewportMix?: number;
  tilesScroll?: number; // px the Texture Browser strip is scrolled sideways
  imported?: {
    name: string;
    mode: "translate" | "rotate" | "scale";
    position: number[];
    rotation: number[];
    scale: number[];
    parts: string[];
    textures: MockTexture[];
  };
};

const TOOLS = [
  ["translate", "M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3"],
  ["rotate", "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"],
  ["scale", "M4 20h9V11H4zM13 11l7-7m0 0h-5m5 0v5"],
] as const;

function Tile({ t, btn }: { t: MockTexture; btn: (label: string, extra?: string) => string }) {
  return (
    <figure className={`${t.users ? "" : "unused"} ${t.selected ? "selected" : ""} ${t.drop ? "drop" : ""}`}>
      <div className="thumb" style={{ background: t.swatch }} />
      <figcaption>
        {t.name}
        <small>
          {t.size} · {t.users ? `${t.users} material` : "unused"}
        </small>
      </figcaption>
      <div className="tile-actions">
        <button className={btn(`Replace ${t.name}`)}>Replace…</button>
        <button className={btn(`Revert ${t.name}`)} disabled={!t.backups}>
          Revert
        </button>
        <button className={btn(`UV ${t.name}`, "uv")} disabled={!t.users}>
          UV
        </button>
      </div>
    </figure>
  );
}

// `eager` only for the hero poster: every other mockup's images wait until they are near the screen.
export function AppMockup({ state: s, eager, children }: { state: MockState; eager?: boolean; children?: ReactNode }) {
  const btn = (label: string, extra = "") => `${extra} ${s.hotButton === label ? "hot" : ""}`;
  return (
    <div className="tl-mock" inert>
      <div className="titlebar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" />
        TrainzLook
        <div className="caption">
          <span>─</span>
          <span>☐</span>
          <span>✕</span>
        </div>
      </div>
      <div className="app">
        <header className="topbar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/brand/trainzlook-symbol-small.svg" alt="" />
          <button className={btn("Open…")}>
            Open… <kbd>Ctrl O</kbd>
          </button>
          <button className={btn("Import .im…")} disabled={!s.path}>
            Import .im…
          </button>
          <button className={btn("Export merged…")} disabled={!s.imported}>
            Export merged…
          </button>
          <span className="path">{s.path ?? "Drop a .im file anywhere, or press Ctrl+O"}</span>
        </header>

        <aside className="outliner panel">
          <h2>Outliner</h2>
          <ul>
            {s.parts.map((p) => (
              <li key={p.material} className={p.hot ? "hot" : ""}>
                <span className="dot material" />
                {p.material}
                {p.problem && <span className="warn">!</span>}
              </li>
            ))}
            {s.attachments?.map((a) => (
              <li key={a}>
                <span className="dot attachment" />
                {a}
              </li>
            ))}
          </ul>
          {s.imported && (
            <>
              <h2 className="imported-head">
                Imported · {s.imported.name}
                <button>×</button>
              </h2>
              <div className="xf">
                {(
                  [
                    ["Location", s.imported.position, " m"],
                    ["Rotation", s.imported.rotation, "°"],
                    ["Scale", s.imported.scale, ""],
                  ] as const
                ).map(([label, v, unit]) => (
                  <div key={label} className="xf-group">
                    <div className="xf-label">{label}</div>
                    {v.map((n, axis) => (
                      <div key={axis} className="numfield">
                        <div className="numbody">
                          <span>{"XYZ"[axis]}</span>
                          <span>
                            {n}
                            {unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <ul className="imported-parts">
                {s.imported.parts.map((p) => (
                  <li key={p}>
                    <span className="dot imported" />
                    {p}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2>Validation{s.path ? ` (${s.issues?.filter((i) => i.level !== "ok").length ?? 0})` : ""}</h2>
          <ul className="issues">
            {s.issues?.map((it) => (
              <li key={it.text} className={it.hot ? "hot" : ""}>
                <span className={`dot lvl-${it.level}`} />
                {it.text}
              </li>
            ))}
          </ul>
        </aside>

        <main className="viewport-area">
          <div className="area-header">
            <button className={btn("Material", s.wireframe ? "" : "on")}>Material</button>
            <button className={btn("Wireframe", s.wireframe ? "on" : "")}>Wireframe</button>
            <button className={btn("Axes", s.axes === false ? "" : "on")}>Axes</button>
            <span className="sep" />
            <button className={btn("ss.jpg")} disabled={!s.path}>
              ss.jpg
            </button>
            <button className={btn("$screenshot$")} disabled={!s.path}>
              $screenshot$
            </button>
            <span className="hint">Drag orbit · Shift+drag pan · Wheel zoom · Home · Numpad 1 / 3 / 7</span>
          </div>
          <div className="viewport">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.viewport} alt="" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
            {s.viewportNext && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.viewportNext} alt="" loading={eager ? "eager" : "lazy"} style={{ opacity: s.viewportMix ?? 1 }} />
            )}
          </div>
          {s.imported && (
            <div className="toolbar">
              {TOOLS.map(([m, d]) => (
                <button key={m} className={s.imported?.mode === m ? "on" : ""}>
                  <svg viewBox="0 0 24 24">
                    <path d={d} />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </main>

        <section className="textures panel">
          <h2>Texture Browser</h2>
          <div className="tiles" style={s.tilesScroll ? { transform: `translateX(${-s.tilesScroll}px)` } : undefined}>
            {s.textures.map((t) => (
              <Tile key={t.name} t={t} btn={btn} />
            ))}
            {s.missing?.map((m) => (
              <figure key={m.material} className="missing">
                <div className="placeholder">?</div>
                <figcaption>
                  {m.problem}
                  <small>{m.material}</small>
                </figcaption>
              </figure>
            ))}
            {s.imported && (
              <>
                <div className="tiles-sep">Imported · {s.imported.name}</div>
                {s.imported.textures.map((t) => (
                  <Tile key={t.name} t={t} btn={btn} />
                ))}
              </>
            )}
          </div>
        </section>

        <footer className="status">
          {s.status}
          {s.notice && <span className="notice">{s.notice}</span>}
        </footer>
      </div>
      {children}
    </div>
  );
}
