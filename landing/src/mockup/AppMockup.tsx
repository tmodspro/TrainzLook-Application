import type { ReactNode } from "react";
import "./mockup.css";

// Markup mirrors app/src/App.tsx (and Menubar.tsx) at its native 1400×900 window size, merge UI hidden as in the app
// (features.ts MERGE_UI = false); every bit of UI state is a prop so the Remotion scenes can animate it. Copied, not
// imported: the landing page never depends on ../app.

export type MockTexture = {
  name: string;
  size: string;
  users: number;
  swatch: string; // CSS background of the thumbnail (a captured image)
  backups?: number;
  selected?: boolean;
  drop?: boolean;
};

export type MenuName = "File" | "Edit" | "View" | "Help";

export type MockState = {
  path?: string; // no path: the start screen
  recent?: string[]; // "body.im · body" labels, newest first
  parts: { material: string; problem?: boolean; hot?: boolean; selected?: boolean }[];
  attachments?: string[];
  issues?: { level: "error" | "warn"; text: string; hot?: boolean }[];
  textures: MockTexture[];
  missing?: { problem: string; material: string }[];
  status: string;
  notice?: string;
  busy?: string; // spinner label in the status bar, shown instead of the notice
  wireframe?: boolean;
  axes?: boolean;
  comparing?: boolean; // Before (B) held
  stats?: { objects: number; vertices: number; edges: number; faces: number; triangles: number; selected?: [file: string, objects: number] };
  hotButton?: string; // label of a button drawn as hovered
  menu?: { open: MenuName; hot?: string }; // an open menu and its hovered item
  liveries?: number; // saved presets: enables the Livery… select
  livery?: { name: string; note: string }; // the Save livery popup
  viewport: string; // render of the 3D view, 1158×540 CSS px
  viewportNext?: string; // cross-faded over `viewport` by `viewportMix` (0–1), for the scenes
  viewportMix?: number;
  tilesScroll?: number; // px the Texture Browser strip is scrolled sideways
};

type Item = { label: string; shortcut?: string; disabled?: boolean; checked?: boolean } | { heading: string } | "sep";

const menus = (s: MockState): Record<MenuName, Item[]> => ({
  File: [
    { label: "Open…", shortcut: "Ctrl O" },
    { heading: "Open Recent" },
    ...(s.recent?.length ? s.recent.map((label) => ({ label })) : [{ label: "No recent meshes", disabled: true }]),
    "sep",
    { label: "Save thumbnail ss.jpg (512×512)", disabled: !s.path },
    { label: "Save preview $screenshot$ (240×180)", disabled: !s.path },
  ],
  Edit: [{ label: "Undo", shortcut: "Ctrl Z", disabled: !s.path }, "sep", { label: "Save livery…", disabled: !s.path }],
  View: [
    { label: "Material", checked: !s.wireframe },
    { label: "Wireframe", checked: !!s.wireframe },
    { label: "Axes", checked: s.axes !== false },
    { label: "Statistics", checked: !!s.stats },
  ],
  Help: [{ label: "Panduan TrainzLook", shortcut: "F1" }],
});

const PENCIL = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";
const n = (v: number) => v.toLocaleString("en-US");

function Tile({ t, btn }: { t: MockTexture; btn: (label: string, extra?: string) => string }) {
  return (
    <figure className={`${t.users ? "" : "unused"} ${t.selected ? "selected" : ""} ${t.drop ? "drop" : ""}`}>
      <div className="thumb" style={{ background: t.swatch }} />
      <button className={`edit ${btn(`Edit ${t.name}`)}`}>
        <svg viewBox="0 0 24 24">
          <path d={PENCIL} />
        </svg>
      </button>
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
  const fileName = s.path?.split(/[\\/]/).pop();
  const all = menus(s);
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
          <div className="menubar">
            {(Object.keys(all) as MenuName[]).map((m) => (
              <div key={m} className="menu">
                <button className={s.menu?.open === m ? "open" : ""}>{m}</button>
                {s.menu?.open === m && (
                  <div className="menu-list">
                    {all[m].map((it, k) =>
                      it === "sep" ? (
                        <hr key={k} />
                      ) : "heading" in it ? (
                        <div key={k} className="menu-heading">
                          {it.heading}
                        </div>
                      ) : (
                        <button key={k} disabled={it.disabled} className={s.menu?.hot === it.label ? "hot" : ""}>
                          <span className="check">{it.checked ? "✓" : ""}</span>
                          <span className="label">{it.label}</span>
                          {it.shortcut && <kbd>{it.shortcut}</kbd>}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="path">{s.path ?? "Drop a .im file anywhere, or press Ctrl+O"}</span>
        </header>

        <aside className="outliner panel">
          <h2>Outliner</h2>
          <ul>
            {s.path && <li className="group">Parts · {s.parts.length}</li>}
            {s.parts.map((p) => (
              <li key={p.material} className={`${p.hot ? "hot" : ""} ${p.selected ? "selected" : ""}`}>
                <span className="dot material" />
                {p.material}
                {p.problem && <span className="warn">!</span>}
              </li>
            ))}
            {!!s.attachments?.length && <li className="group">Attachments · {s.attachments.length}</li>}
            {s.attachments?.map((a) => (
              <li key={a}>
                <span className="dot attachment" />
                {a}
              </li>
            ))}
          </ul>
          <h2>Validation{s.path ? ` (${s.issues?.length ?? 0})` : ""}</h2>
          <ul className="issues">
            {s.path && !s.issues?.length && (
              <li>
                <span className="dot lvl-ok" />
                No problems found
              </li>
            )}
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
            <button className={btn("Before (B)", s.comparing ? "on" : "")} disabled={!s.textures.some((t) => t.backups)}>
              Before (B)
            </button>
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
          {s.path && s.stats && (
            <div className="stats">
              <div className="title">
                {fileName}
                {s.stats.selected ? ` | ${s.stats.selected[0]}` : ""}
              </div>
              <dl>
                {(
                  [
                    ["Objects", `${s.stats.selected?.[1] ?? 0} / ${s.stats.objects}`],
                    ["Vertices", n(s.stats.vertices)],
                    ["Edges", n(s.stats.edges)],
                    ["Faces", n(s.stats.faces)],
                    ["Triangles", n(s.stats.triangles)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {!s.path && (
            <div className="start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/trainzlook-symbol-small.svg" alt="" />
              <h3>TrainzLook</h3>
              <p>Open a Trainz mesh (.im) to view and repaint it</p>
              <button className="on">
                Open… <kbd>Ctrl O</kbd>
              </button>
              {!!s.recent?.length && (
                <div className="start-recent">
                  <small>Recent</small>
                  {s.recent.slice(0, 3).map((r) => (
                    <button key={r} className={btn(`Recent ${r}`)}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <p className="muted">or drop a .im anywhere · F1 for the guide</p>
            </div>
          )}
        </main>

        <section className="textures panel">
          <h2 className="tex-head">
            Texture Browser
            <span className={`select ${s.liveries ? btn("Livery…") : "disabled"}`}>Livery…</span>
            <button className={btn("Save livery…")} disabled={!s.path}>
              Save livery…
            </button>
          </h2>
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
          </div>
        </section>

        <footer className="status">
          {s.status}
          {s.busy ? (
            <span className="notice busy">
              <span className="spinner" />
              {s.busy}
            </span>
          ) : (
            s.notice && <span className="notice">{s.notice}</span>
          )}
        </footer>
      </div>

      {s.livery && (
        <div className="backdrop">
          <div className="modal">
            <h3>Save livery</h3>
            <label>
              Name
              <span className="input">{s.livery.name}</span>
            </label>
            <p className="note">{s.livery.note}</p>
            <div className="actions">
              <button className={btn("Cancel")}>Cancel</button>
              <button className={btn("Save", "on")} disabled={!s.livery.name}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
