import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import Help from "./Help";
import Menubar from "./Menubar";
import NumberField from "./NumberField";
import Viewport, { type GizmoMode, IDENTITY, type Pick, pivotOf, placementOf, type Snapshot, type Xf, xfMatrix } from "./Viewport";
import { dropRecent, pushRecent, readRecent, saveRecent } from "./recent";
import { meshStats } from "./stats";
import { decodeImage, REPLACE_EXTS } from "./textures";
import type { Livery, MeshData } from "./types";
import logo from "./logo.svg"; // copy of branding/trainzlook-symbol-small.svg (the cut for 32 px and below)

const fileName = (path: string) => path.split(/[\\/]/).pop();
const dirOf = (path: string) => path.replace(/[\\/][^\\/]*$/, "").toLowerCase();
/** Props that make a clickable list row work from the keyboard too: Tab reaches it, Enter or Space presses it. */
const pressable = (press: () => void) => ({
  role: "button",
  tabIndex: 0,
  onClick: press,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    press();
  },
});
/** File name plus its folder: many assets name their mesh body.im. */
const recentLabel = (path: string) => `${fileName(path)} · ${fileName(path.replace(/[\\/][^\\/]*$/, ""))}`;

/** Lowercased image file name -> materials of `m` that use it. */
function usageOf(m: MeshData | null) {
  const map = new Map<string, string[]>();
  for (const p of m?.parts ?? []) {
    const file = p.texture?.file?.toLowerCase();
    if (file) map.set(file, [...(map.get(file) ?? []), p.material]);
  }
  return map;
}

/** Texture tile image, decoded in Rust at thumbnail size: a 2048² JPEG in an <img> would hold ~16 MB per tile. */
function Thumb({ path, version }: { path: string; version: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    decodeImage(path, 128)
      .then(({ data, width, height }) => {
        const canvas = Object.assign(document.createElement("canvas"), { width, height });
        const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
        canvas.getContext("2d")!.putImageData(new ImageData(pixels, width, height), 0, 0);
        if (live) setSrc(canvas.toDataURL());
      })
      .catch(() => live && setSrc(""));
    return () => {
      live = false;
    };
  }, [path, version]);
  return src ? <img src={src} alt="" /> : <div className="placeholder pending">…</div>;
}

export default function App() {
  const [mesh, setMesh] = useState<MeshData | null>(null);
  const [error, setError] = useState("");
  // Label of a slow action in progress (open, replace, export...), shown with a spinner in the status bar.
  const [busy, setBusy] = useState<string | null>(null);
  const track = useCallback(<T,>(label: string, work: Promise<T>) => {
    setBusy(label);
    return work.finally(() => setBusy((b) => (b === label ? null : b)));
  }, []);
  const [wireframe, setWireframe] = useState(false);
  const [notice, setNotice] = useState("");
  const [versions, setVersions] = useState<Record<string, number>>({}); // cache-busts thumbnails after edits

  useEffect(() => {
    const unlisten = listen<string>("texture-changed", ({ payload }) => {
      setVersions((v) => ({ ...v, [payload.toLowerCase()]: Date.now() }));
      setNotice(`Reloaded ${fileName(payload)}`);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const [backups, setBackups] = useState<Record<string, number>>({}); // backup count per texture path
  // One undo history for the session, newest last: texture replaces and edits of the imported mesh's placement.
  // A livery is one step: Ctrl+Z reverts every texture it changed.
  const history = useRef<
    ({ kind: "texture"; target: string } | { kind: "livery"; name: string; targets: string[] } | { kind: "xf"; xf: Xf })[]
  >([]);
  const [liveries, setLiveries] = useState<Livery[]>([]);

  const [dropTarget, setDropTarget] = useState<string | null>(null); // tile under a dragged image
  // Lowercased texture paths: the tile under the mouse, and the one picked by clicking the model.
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const onPick = useCallback((hit: Pick) => {
    setSelected(hit?.texture ?? null);
    setNotice(hit ? `${hit.material} → ${hit.texture ? fileName(hit.texture) : "no texture"}` : "");
  }, []);

  useEffect(() => {
    const tile = [...document.querySelectorAll<HTMLElement>("[data-path]")].find(
      (el) => el.dataset.path?.toLowerCase() === selected,
    );
    tile?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);
  const draggingImage = useRef(false);

  const replace = async (target: string) => {
    const source = await open({ filters: [{ name: "Image (converted to the original format)", extensions: REPLACE_EXTS }] });
    if (source) replaceWith(target, source);
  };

  const replaceWith = useCallback(async (target: string, source: string) => {
    try {
      const r = await track(`Replacing ${fileName(target)}…`, invoke<{ backup: string; warning: string | null; backups: number }>("replace_texture", { target, source }));
      setBackups((b) => ({ ...b, [target.toLowerCase()]: r.backups }));
      history.current.push({ kind: "texture", target });
      setNotice(`Replaced ${fileName(target)} · backup: ${r.backup}${r.warning ? ` · ⚠ ${r.warning}` : ""}`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, [track]);

  const edit = async (target: string) => {
    try {
      const app = await invoke<string>("edit_texture", { target });
      setNotice(`Opened ${fileName(target)} in ${app} · save there and the view updates`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const revert = useCallback(async (target: string) => {
    try {
      const r = await invoke<{ backups: number }>("revert_texture", { target });
      setBackups((b) => ({ ...b, [target.toLowerCase()]: r.backups }));
      setNotice(`Reverted ${fileName(target)} · ${r.backups} older version(s) left`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const helpDialog = useRef<HTMLDialogElement>(null);
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => saveRecent(recent), [recent]);

  const load = useCallback(async (path: string) => {
    try {
      const m = await track(`Opening ${fileName(path)}…`, invoke<MeshData>("open_mesh", { path }));
      setRecent((r) => pushRecent(r, path));
      setMesh(m);
      setLiveries(m.liveries);
      setImported(null);
      setBackups(Object.fromEntries(m.images.map((i) => [i.path.toLowerCase(), i.backups])));
      history.current = [];
      setSelected(null);
      setError("");
      setNotice("");
    } catch (e) {
      setRecent((r) => dropRecent(r, path)); // moved, deleted or no longer a mesh
      setError(String(e));
    }
  }, [track]);

  // Opened from Explorer (double-click / Open with): load that mesh straight away.
  useEffect(() => {
    invoke<string | null>("launch_path").then((p) => {
      if (p) load(p);
    });
  }, [load]);

  const browse = useCallback(async () => {
    const path = await open({ filters: [{ name: "Trainz mesh", extensions: ["im"] }] });
    if (path) load(path);
  }, [load]);

  // Merge: a second, static mesh placed by the gizmo / numeric fields, then written into a new .im beside the open one.
  const [imported, setImported] = useState<MeshData | null>(null);
  const [xf, setXf] = useState<Xf>(IDENTITY);
  const [mode, setMode] = useState<GizmoMode>("translate");
  const [axes, setAxes] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const stats = useMemo(() => meshStats([...(mesh?.parts ?? []), ...(imported?.parts ?? [])]), [mesh, imported]);
  // Before/After compare: while held, replaced textures show their newest backup (files are not touched).
  const [comparing, setComparing] = useState(false);
  const before = useMemo(
    () => (comparing ? Object.keys(backups).filter((p) => backups[p] > 0) : []),
    [comparing, backups],
  );
  const xfNow = useRef(xf);
  xfNow.current = xf;
  /** Records the placement before a gizmo drag or field edit, so Ctrl+Z steps back over that whole edit. */
  const pushXf = useCallback(() => history.current.push({ kind: "xf", xf: xfNow.current }), []);
  const keepBaseHistory = () => {
    const baseDir = mesh ? dirOf(mesh.path) : "";
    history.current = history.current.filter(
      (u) => u.kind === "livery" || (u.kind === "texture" && dirOf(u.target) === baseDir),
    );
  };
  const dropImport = () => {
    setImported(null);
    keepBaseHistory();
  };

  const importMesh = async () => {
    const path = await open({ filters: [{ name: "Trainz mesh", extensions: ["im"] }] });
    if (!path) return;
    try {
      const m = await track(`Importing ${fileName(path)}…`, invoke<MeshData>("import_mesh", { path }));
      setImported(m);
      keepBaseHistory();
      setBackups((b) => ({ ...b, ...Object.fromEntries(m.images.map((i) => [i.path.toLowerCase(), i.backups])) }));
      setXf(placementOf(m));
      setMode("translate");
      setNotice("Move / Rotate / Scale: toolbar or G / R / S · Ctrl+Z undoes");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const exportMerged = async () => {
    if (!mesh || !imported) return;
    const stem = (fileName(mesh.path) ?? "mesh").replace(/\.im$/i, "");
    const target = await save({
      defaultPath: mesh.path.replace(/[^\\/]+$/, `${stem}_merged.im`),
      filters: [{ name: "Trainz mesh", extensions: ["im"] }],
    });
    if (!target) return;
    try {
      const r = await track(
        `Exporting ${fileName(target)}…`,
        invoke<{ path: string; copied: string[]; parts: number }>("export_merged", {
          base: mesh.path,
          import: imported.path,
          matrix: xfMatrix(xf, pivotOf(imported)),
          target,
        }),
      );
      setNotice(`Exported ${fileName(r.path)}: ${r.parts} parts${r.copied.length ? ` · copied ${r.copied.join(", ")}` : ""}`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  // Livery presets: byte copies of the open mesh's textures, put back through Replace (backed up, revertable).
  // Named in our own <dialog> (the webview's prompt() says "localhost says"); the native element gives modality,
  // focus and Esc-to-cancel for free.
  const nameDialog = useRef<HTMLDialogElement>(null);
  const [liveryName, setLiveryName] = useState("");
  const overwrites = liveries.find((l) => l.name.toLowerCase() === liveryName.trim().toLowerCase());
  const openLiveryDialog = () => {
    setLiveryName("");
    nameDialog.current?.showModal();
  };
  const usedFiles = () =>(mesh?.images ?? []).filter((i) => usage.has(i.name.toLowerCase())).map((i) => i.path);

  const saveLivery = async (name: string) => {
    const files = usedFiles();
    try {
      setLiveries(await track(`Saving livery ${name}…`, invoke<Livery[]>("save_livery", { name, files })));
      setNotice(`Saved livery ${name}: ${files.length} texture(s)`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const applyLivery = async (name: string) => {
    try {
      const r = await track(
        `Applying livery ${name}…`,
        invoke<{ changed: { target: string; backups: number }[]; error: string | null }>("apply_livery", { name }),
      );
      setBackups((b) => ({ ...b, ...Object.fromEntries(r.changed.map((c) => [c.target.toLowerCase(), c.backups])) }));
      if (r.changed.length) history.current.push({ kind: "livery", name, targets: r.changed.map((c) => c.target) });
      setNotice(
        r.changed.length
          ? `Applied livery ${name}: ${r.changed.length} texture(s) changed · Ctrl+Z undoes · hold B to compare`
          : `Livery ${name} is already on`,
      );
      setError(r.error ? `Livery ${name} stopped: ${r.error}` : "");
    } catch (e) {
      setError(String(e));
    }
  };

  const setAxis = (key: keyof Xf, axis: number, v: number) =>
    setXf((x) => ({ ...x, [key]: x[key].map((w, i) => (i === axis ? v : w)) }));

  // Ctrl+Z and Edit > Undo: steps back over the newest texture replace, livery or import placement.
  const undo = useCallback(() => {
    const last = history.current.pop();
    if (!last) setNotice("Nothing to undo");
    else if (last.kind === "texture") revert(last.target);
    else if (last.kind === "livery") last.targets.forEach((t) => revert(t));
    else {
      setXf(last.xf);
      setNotice("Undid a move / rotate / scale of the imported mesh");
    }
  }, [revert]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        if (!helpDialog.current?.open) helpDialog.current?.showModal();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        browse();
      }
      if (e.target instanceof HTMLInputElement) return; // typing in a field keeps the field's own keys
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      const modeKeys: Record<string, GizmoMode> = { KeyG: "translate", KeyR: "rotate", KeyS: "scale" };
      if (!e.ctrlKey && !e.altKey && modeKeys[e.code]) setMode(modeKeys[e.code]);
      if (!e.ctrlKey && !e.altKey && e.code === "KeyB") setComparing(true);
    };
    const onKeyUp = (e: KeyboardEvent) => e.code === "KeyB" && setComparing(false);
    const stopComparing = () => setComparing(false); // a release outside the window never arrives
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stopComparing);
    // Native drops never reach HTML drop events in Tauri, so the tile is found from the cursor position.
    const tileAt = ({ x, y }: { x: number; y: number }) =>
      (document.elementFromPoint(x / devicePixelRatio, y / devicePixelRatio)?.closest("[data-path]") as HTMLElement | null)
        ?.dataset.path ?? null;
    const isImage = (p: string) => REPLACE_EXTS.includes(p.split(".").pop()?.toLowerCase() ?? "");
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload: p }) => {
      if (p.type === "leave") return setDropTarget(null);
      if (p.type === "enter") draggingImage.current = p.paths.some(isImage);
      const tile = draggingImage.current ? tileAt(p.position) : null;
      if (p.type !== "drop") return setDropTarget(tile);

      setDropTarget(null);
      const im = p.paths.find((x) => x.toLowerCase().endsWith(".im"));
      const image = p.paths.find(isImage);
      if (im) load(im);
      else if (image && tile) replaceWith(tile, image);
      else if (image) setNotice("Drop the image onto a texture tile to replace it");
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stopComparing);
      unlisten.then((f) => f());
    };
  }, [browse, load, undo, replaceWith]);

  const usage = useMemo(() => usageOf(mesh), [mesh]);
  const importUsage = useMemo(() => usageOf(imported), [imported]);

  const exportUv = async (img: MeshData["images"][number], from: MeshData | null) => {
    const target = await save({
      defaultPath: img.path.replace(/\.[^.\\/]+$/, "_uv.png"),
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (!target) return;
    // Same size as the texture so it overlays 1:1 in Photoshop; v=0 is the image top (DirectX-style UVs).
    const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    const g = canvas.getContext("2d")!;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1;
    g.beginPath();
    for (const p of from?.parts ?? []) {
      if (p.texture?.file?.toLowerCase() !== img.name.toLowerCase()) continue;
      for (let i = 0; i < p.indices.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = p.indices[i + k];
          const [x, y] = [p.uvs[v * 2] * img.width, p.uvs[v * 2 + 1] * img.height];
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
      }
    }
    g.stroke();
    try {
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
      if (!blob) throw new Error("could not encode the UV template");
      await invoke("write_export", { path: target, data: Array.from(new Uint8Array(await blob.arrayBuffer())) });
      setNotice(`Saved UV template ${fileName(target)} (${img.width}×${img.height})`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const snapshot = useRef<Snapshot | null>(null);
  const saveThumbnail = async (name: string, w: number, h: number) => {
    if (!mesh) return;
    const target = await save({ defaultPath: `${mesh.assetDir}\\${name}`, filters: [{ name: "JPEG", extensions: ["jpg"] }] });
    if (!target || !snapshot.current) return;
    try {
      const blob = await snapshot.current(w, h);
      await invoke("write_export", { path: target, data: Array.from(new Uint8Array(await blob.arrayBuffer())) });
      setNotice(`Saved thumbnail ${fileName(target)} (${w}×${h})`);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  // Outliner row of a part: hover lights it in the viewport, click selects it like clicking the model.
  const partRow = (p: MeshData["parts"][number], i: number, dot: string) => {
    const tex = p.texture?.path?.toLowerCase() ?? null;
    return (
      <li
        key={i}
        title={p.texture?.problem ?? p.texture?.file ?? "no texture"}
        className={`clickable ${tex && tex === selected ? "selected" : ""}`}
        {...pressable(() => onPick({ material: p.material, texture: tex }))}
        aria-pressed={!!tex && tex === selected}
        onMouseEnter={() => setHovered(tex)}
        onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(tex)}
        onBlur={() => setHovered(null)}
      >
        <span className={`dot ${dot}`} />
        {p.material}
        {p.texture?.problem && <span className="warn">!</span>}
      </li>
    );
  };

  const verts = mesh?.parts.reduce((n, p) => n + p.positions.length / 3, 0) ?? 0;
  const tris = mesh?.parts.reduce((n, p) => n + p.indices.length / 3, 0) ?? 0;
  const problems = mesh?.parts.filter((p) => p.texture?.problem) ?? [];

  // Validation: errors break the asset in Trainz, warnings cost memory or clutter the folder.
  const issues = useMemo(() => {
    const list: { level: "error" | "warn"; text: string; path?: string }[] = [];
    for (const p of mesh?.parts ?? []) {
      if (p.texture?.problem) list.push({ level: "error", text: `${p.material}: ${p.texture.problem}` });
    }
    const pot = (n: number) => (n & (n - 1)) === 0;
    for (const img of mesh?.images ?? []) {
      const path = img.path.toLowerCase();
      if (img.width && (!pot(img.width) || !pot(img.height))) {
        list.push({ level: "error", path, text: `${img.name} is ${img.width}×${img.height}, not a power of two` });
      }
      if (Math.max(img.width, img.height) > 2048) {
        list.push({ level: "warn", path, text: `${img.name} is over 2048 px: TS12 and older can't load it` });
      }
      if (!usage.has(img.name.toLowerCase())) list.push({ level: "warn", path, text: `${img.name} is not used by this mesh` });
    }
    return list.sort((a, b) => Number(a.level === "warn") - Number(b.level === "warn")); // errors first
  }, [mesh, usage]);

  return (
    <div className="app">
      <header className="topbar">
        <img className="logo" src={logo} alt="TrainzLook" title="TrainzLook" />
        {/* Blender-style menus; every item is also reachable by its shortcut or a button elsewhere */}
        <Menubar
          menus={[
            {
              label: "File",
              items: [
                { label: "Open…", shortcut: "Ctrl O", onSelect: browse },
                { heading: "Open Recent" },
                ...(recent.length
                  ? recent.map((p) => ({ label: recentLabel(p), title: p, onSelect: () => load(p) }))
                  : [{ label: "No recent meshes", disabled: true, onSelect: () => {} }]),
                "sep",
                { label: "Import .im…", disabled: !mesh, title: "Bring a second, static .im in to place and merge", onSelect: importMesh },
                { label: "Export merged…", disabled: !imported, title: "Write the open mesh plus the placed import to a new .im", onSelect: exportMerged },
                "sep",
                { label: "Save thumbnail ss.jpg (512×512)", disabled: !mesh, onSelect: () => saveThumbnail("ss.jpg", 512, 512) },
                { label: "Save preview $screenshot$ (240×180)", disabled: !mesh, onSelect: () => saveThumbnail("$screenshot$.jpg", 240, 180) },
              ],
            },
            {
              label: "Edit",
              items: [
                { label: "Undo", shortcut: "Ctrl Z", disabled: !mesh, onSelect: undo },
                "sep",
                { label: "Save livery…", disabled: !mesh, onSelect: openLiveryDialog },
              ],
            },
            {
              label: "View",
              items: [
                { label: "Material", checked: !wireframe, onSelect: () => setWireframe(false) },
                { label: "Wireframe", checked: wireframe, onSelect: () => setWireframe(true) },
                { label: "Axes", checked: axes, onSelect: () => setAxes((a) => !a) },
                { label: "Statistics", checked: showStats, onSelect: () => setShowStats((v) => !v) },
              ],
            },
            {
              label: "Help",
              items: [{ label: "Panduan TrainzLook", shortcut: "F1", onSelect: () => helpDialog.current?.showModal() }],
            },
          ]}
        />
        <span className="path" title={mesh?.path}>
          {mesh?.path ?? "Drop a .im file anywhere, or press Ctrl+O"}
        </span>
      </header>

      <aside className="outliner panel">
        <h2>Outliner</h2>
        <ul>
          {mesh && <li className="group">Parts · {mesh.parts.length}</li>}
          {mesh?.parts.map((p, i) => partRow(p, i, "material"))}
          {!!mesh?.attachments.length && <li className="group">Attachments · {mesh.attachments.length}</li>}
          {mesh?.attachments.map((a) => (
            <li key={a.name} title={a.position.map((v) => v.toFixed(3)).join(", ")}>
              <span className="dot attachment" />
              {a.name}
            </li>
          ))}
        </ul>
        {imported && (
          <>
            <h2 className="imported-head">
              Imported · {fileName(imported.path)}
              <button title="Remove the imported mesh" onClick={dropImport}>
                ×
              </button>
            </h2>
            <div className="xf">
              {(
                [
                  ["position", "Location", 0.01, 0.1, " m"],
                  ["rotation", "Rotation", 0.5, 5, "°"],
                  ["scale", "Scale", 0.005, 0.1, ""],
                ] as const
              ).map(([key, label, step, snap, unit]) => (
                <div key={key} className="xf-group">
                  <div className="xf-label">{label}</div>
                  {[0, 1, 2].map((axis) => (
                    <NumberField
                      key={axis}
                      label={"XYZ"[axis]}
                      value={xf[key][axis]}
                      step={step}
                      snap={snap}
                      unit={unit}
                      onBegin={pushXf}
                      onChange={(v) => setAxis(key, axis, v)}
                    />
                  ))}
                </div>
              ))}
            </div>
            <ul className="imported-parts">
              {imported.parts.map((p, i) => partRow(p, i, "imported"))}
            </ul>
          </>
        )}
        <h2>Validation{mesh ? ` (${issues.length})` : ""}</h2>
        <ul className="issues">
          {mesh && !issues.length && (
            <li>
              <span className="dot lvl-ok" />
              No problems found
            </li>
          )}
          {issues.map((it, i) => (
            <li key={i} title={it.text} className={it.path ? "clickable" : ""} {...(it.path ? pressable(() => setSelected(it.path!)) : {})}>
              <span className={`dot lvl-${it.level}`} />
              {it.text}
            </li>
          ))}
        </ul>
      </aside>

      <main className="viewport-area">
        <div className="area-header">
          <button className={wireframe ? "" : "on"} onClick={() => setWireframe(false)}>
            Material
          </button>
          <button className={wireframe ? "on" : ""} onClick={() => setWireframe(true)}>
            Wireframe
          </button>
          <button className={axes ? "on" : ""} title="Axis lines and the navigation gizmo (click an axis ball to view along it)" onClick={() => setAxes((a) => !a)}>
            Axes
          </button>
          <button
            className={comparing ? "on" : ""}
            disabled={!Object.values(backups).some((n) => n > 0)}
            title="Hold (or hold B) to see replaced textures as they were before the last Replace"
            onPointerDown={() => setComparing(true)}
            onPointerUp={() => setComparing(false)}
            onPointerLeave={() => setComparing(false)}
          >
            Before (B)
          </button>
          <span className="sep" />
          <button disabled={!mesh} title="Content Manager thumbnail, 512×512, from the current view" onClick={() => saveThumbnail("ss.jpg", 512, 512)}>
            ss.jpg
          </button>
          <button
            disabled={!mesh}
            title="Mesh Viewer-style preview, 240×180, from the current view"
            onClick={() => saveThumbnail("$screenshot$.jpg", 240, 180)}
          >
            $screenshot$
          </button>
          <span className="hint">Drag orbit · Shift+drag pan · Wheel zoom · Home · Numpad 1 / 3 / 7</span>
        </div>
        <Viewport
          mesh={mesh}
          imported={imported}
          xf={xf}
          onXf={setXf}
          onXfStart={pushXf}
          mode={mode}
          axes={axes}
          wireframe={wireframe}
          highlight={hovered ?? selected}
          before={before}
          onPick={onPick}
          snapshot={snapshot}
        />
        {/* Blender's Statistics overlay; parts count as objects, and "selected" are the parts using the picked texture */}
        {mesh && showStats && (
          <div className={`stats ${imported ? "beside-toolbar" : ""}`} role="group" aria-label="Scene statistics">
            <div className="title">
              {fileName(mesh.path)}
              {imported ? ` + ${fileName(imported.path)}` : ""}
              {selected ? ` | ${fileName(selected)}` : ""}
            </div>
            <dl>
            {(
              [
                ["Objects", `${[...mesh.parts, ...(imported?.parts ?? [])].filter((p) => p.texture?.path?.toLowerCase() === selected).length} / ${stats.objects}`],
                ["Vertices", stats.vertices.toLocaleString("en-US")],
                ["Edges", stats.edges.toLocaleString("en-US")],
                ["Faces", stats.faces.toLocaleString("en-US")],
                ["Triangles", stats.triangles.toLocaleString("en-US")],
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
        {imported && (
          <div className="toolbar">
            {(
              [
                ["translate", "Move", "G", "M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3"],
                ["rotate", "Rotate", "R", "M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"],
                ["scale", "Scale", "S", "M4 20h9V11H4zM13 11l7-7m0 0h-5m5 0v5"],
              ] as const
            ).map(([m, name, key, d]) => (
              <button key={m} className={mode === m ? "on" : ""} title={`${name} (${key})`} onClick={() => setMode(m)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={d} />
                </svg>
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {/* Start screen: what to do first, instead of an empty grid */}
        {!mesh && (
          <div className="start">
            <img src={logo} alt="" />
            <h3>TrainzLook</h3>
            <p>Open a Trainz mesh (.im) to view and repaint it</p>
            <button className="on" onClick={browse}>
              Open… <kbd>Ctrl O</kbd>
            </button>
            {recent.length > 0 && (
              <div className="start-recent">
                <small>Recent</small>
                {recent.slice(0, 3).map((p) => (
                  <button key={p} title={p} onClick={() => load(p)}>
                    {recentLabel(p)}
                  </button>
                ))}
              </div>
            )}
            <p className="muted">or drop a .im anywhere · F1 for the guide</p>
          </div>
        )}
      </main>

      <section
        className="textures panel"
        onWheel={(e) => {
          // The tile strip only scrolls sideways, so turn the ordinary up/down wheel into left/right; touchpad
          // sideways swipes (deltaX) keep their native behaviour.
          if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          const unit = [1, 40, e.currentTarget.clientWidth][e.deltaMode] ?? 1; // pixel, line or page deltas
          e.currentTarget.scrollLeft += e.deltaY * unit;
        }}
      >
        <h2 className="tex-head">
          Texture Browser
          <select
            value=""
            disabled={!liveries.length}
            title="Apply a saved livery: changed textures are replaced (backed up; Ctrl+Z undoes the whole livery)"
            onChange={(e) => e.target.value && applyLivery(e.target.value)}
          >
            <option value="">Livery…</option>
            {liveries.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name} ({l.files.length})
              </option>
            ))}
          </select>
          <button
            disabled={!mesh}
            title="Save the textures this mesh uses as a named livery preset"
            onClick={openLiveryDialog}
          >
            Save livery…
          </button>
        </h2>
        <div className="tiles">
          {mesh?.images.map((img) => {
            const users = usage.get(img.name.toLowerCase()) ?? [];
            return (
              <figure
                key={img.path}
                data-path={img.path}
                className={`${users.length ? "" : "unused"} ${dropTarget === img.path ? "drop" : ""} ${selected === img.path.toLowerCase() ? "selected" : ""}`}
                onMouseEnter={() => setHovered(img.path.toLowerCase())}
                onMouseLeave={() => setHovered(null)}
                title={users.join("\n") || "Not used by this mesh"}
              >
                <Thumb path={img.path} version={versions[img.path.toLowerCase()] ?? 0} />
                <button className="edit" title="Edit in Photoshop (or the default app); every save reloads here" aria-label={`Edit ${img.name}`} onClick={() => edit(img.path)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                  </svg>
                </button>
                <figcaption>
                  {img.name}
                  <small>
                    {img.width ? `${img.width}×${img.height} · ` : ""}
                    {users.length ? `${users.length} material` : "unused"}
                  </small>
                </figcaption>
                <div className="tile-actions">
                  <button onClick={() => replace(img.path)}>Replace…</button>
                  <button
                    disabled={!backups[img.path.toLowerCase()]}
                    title={`${backups[img.path.toLowerCase()] ?? 0} backup(s) · Ctrl+Z undoes the last Replace`}
                    onClick={() => revert(img.path)}
                  >
                    Revert
                  </button>
                  <button
                    className="uv"
                    disabled={!users.length || !img.width}
                    title="Export the UV layout as a PNG template for painting"
                    onClick={() => exportUv(img, mesh)}
                  >
                    UV
                  </button>
                </div>
              </figure>
            );
          })}
          {problems.map((p) => (
            <figure key={p.material} className="missing" title={p.material}>
              <div className="placeholder">?</div>
              <figcaption>
                {p.texture?.problem}
                <small>{p.material}</small>
              </figcaption>
            </figure>
          ))}
          {imported && (
            <>
              <div className="tiles-sep" title={imported.path}>
                Imported · {fileName(imported.path)}
              </div>
              {/* Only what the import uses. Replace/Revert change files in the import's own folder (backed up there). */}
              {imported.images
                .filter((img) => importUsage.has(img.name.toLowerCase()))
                .map((img) => {
                  const users = importUsage.get(img.name.toLowerCase()) ?? [];
                  return (
                    <figure
                      key={img.path}
                      data-path={img.path}
                      className={`${dropTarget === img.path ? "drop" : ""} ${selected === img.path.toLowerCase() ? "selected" : ""}`}
                      onMouseEnter={() => setHovered(img.path.toLowerCase())}
                      onMouseLeave={() => setHovered(null)}
                      title={users.join(", ")}
                    >
                      <Thumb path={img.path} version={versions[img.path.toLowerCase()] ?? 0} />
                      <button className="edit" title="Edit in Photoshop (or the default app); every save reloads here" aria-label={`Edit ${img.name}`} onClick={() => edit(img.path)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                        </svg>
                      </button>
                      <figcaption>
                        {img.name}
                        <small>
                          {img.width ? `${img.width}×${img.height} · ` : ""}
                          {users.length} material
                        </small>
                      </figcaption>
                      <div className="tile-actions">
                        <button onClick={() => replace(img.path)}>Replace…</button>
                        <button
                          disabled={!backups[img.path.toLowerCase()]}
                          title={`${backups[img.path.toLowerCase()] ?? 0} backup(s) · Ctrl+Z undoes the last Replace`}
                          onClick={() => revert(img.path)}
                        >
                          Revert
                        </button>
                        <button
                          className="uv"
                          disabled={!img.width}
                          title="Export the UV layout as a PNG template for painting"
                          onClick={() => exportUv(img, imported)}
                        >
                          UV
                        </button>
                      </div>
                    </figure>
                  );
                })}
              {imported.parts
                .filter((p) => p.texture?.problem)
                .map((p) => (
                  <figure key={`imported-${p.material}`} className="missing" title={p.material}>
                    <div className="placeholder">?</div>
                    <figcaption>
                      {p.texture?.problem}
                      <small>{p.material}</small>
                    </figcaption>
                  </figure>
                ))}
            </>
          )}
        </div>
      </section>

      <dialog ref={nameDialog} className="modal" aria-labelledby="livery-title">
        {/* method="dialog": submitting closes it; Enter saves, Esc cancels */}
        <form
          method="dialog"
          onSubmit={(e) => {
            if (liveryName.trim()) saveLivery(liveryName.trim());
            else e.preventDefault();
          }}
        >
          <h3 id="livery-title">Save livery</h3>
          <label>
            Name
            <input value={liveryName} maxLength={64} placeholder="e.g. KAI 2024" onChange={(e) => setLiveryName(e.target.value)} />
          </label>
          <p className={overwrites ? "note warn" : "note"}>
            {overwrites
              ? `Overwrites livery "${overwrites.name}" (${overwrites.files.length} textures)`
              : `Copies the ${usedFiles().length} textures this mesh uses`}
          </p>
          <div className="actions">
            <button type="button" onClick={() => nameDialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="on" disabled={!liveryName.trim()}>
              {overwrites ? "Overwrite" : "Save"}
            </button>
          </div>
        </form>
      </dialog>

      <Help dialog={helpDialog} />

      <footer className="status">
        {mesh
          ? `${mesh.parts.length} parts · ${verts.toLocaleString()} verts · ${tris.toLocaleString()} tris · ${mesh.images.length} images in folder · watching folder`
          : "Ready"}
        {busy ? (
          <span className="notice busy" role="status">
            <span className="spinner" aria-hidden="true" />
            {busy}
          </span>
        ) : (
          notice && (
            <span key={notice} className="notice" role="status">
              {notice}
            </span>
          )
        )}
      </footer>
    </div>
  );
}
