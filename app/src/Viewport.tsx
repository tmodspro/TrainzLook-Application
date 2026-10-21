import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { ViewHelper } from "three/examples/jsm/helpers/ViewHelper.js";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { decodeImage, isJpeg } from "./textures";
import type { MeshData } from "./types";

// shortcut: DDS and compiled TANE .texture are not decoded yet; those parts render untextured (roadmap phase 4).
const WEB_IMAGE = /\.(jpe?g|png|bmp|tga)$/i;

type Scene = {
  group: THREE.Group;
  /** The second mesh being placed for a merge; moved by the gizmo. */
  imported: THREE.Group;
  gizmo: TransformControls;
  axes: THREE.Group;
  look: (dir: THREE.Vector3) => void;
  /** Asks for a redraw: the viewport only renders when something changed. */
  invalidate: () => void;
  bbox?: THREE.Box3;
};

export type Pick = { material: string; texture: string | null } | null;
/** Renders the current view at exactly w×h pixels as a JPEG. */
export type Snapshot = (w: number, h: number) => Promise<Blob>;
/** Placement of the imported mesh in Trainz axes; rotation in degrees, XYZ order. */
export type Xf = { position: number[]; rotation: number[]; scale: number[] };
export const IDENTITY: Xf = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
export type GizmoMode = "translate" | "rotate" | "scale";

/** The object's own centre (from the INFO bbox): the pivot it rotates and scales about, like Blender's origin. */
export const pivotOf = (m: MeshData) => m.bbox[0].map((v, i) => (v + m.bbox[1][i]) / 2);

/** A mesh's placement as stored: .im vertices are already final (INFO holds an identity rotation), so it sits
 * at its own centre with no rotation and scale 1. */
export const placementOf = (m: MeshData): Xf => ({ position: pivotOf(m), rotation: [0, 0, 0], scale: [1, 1, 1] });

/** Column-major matrix for the Rust exporter: the same transform the viewport renders the import with. */
export function xfMatrix(xf: Xf, pivot: number[]): number[] {
  const [rx, ry, rz] = xf.rotation.map(THREE.MathUtils.degToRad);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "XYZ"));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...xf.position), q, new THREE.Vector3(...xf.scale));
  m.multiply(new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
  return [...m.elements];
}

const HIGHLIGHT = new THREE.Color(0x0b2350); // emissive tint on parts using the hovered/selected texture; brighter hides the livery
const NONE = new THREE.Color(0x000000);

type Props = {
  mesh: MeshData | null;
  imported: MeshData | null;
  xf: Xf;
  onXf: (xf: Xf) => void;
  /** Called when a gizmo drag starts, before it changes anything: one undo step. */
  onXfStart: () => void;
  mode: GizmoMode;
  /** Axis lines on the floor plus the corner navigation gizmo. */
  axes: boolean;
  wireframe: boolean;
  /** Lowercased texture path whose parts glow. */
  highlight: string | null;
  /** Called on a click (not a drag) in the viewport with the part under the cursor, or null for empty space. */
  onPick: (hit: Pick) => void;
  /** Lowercased texture paths shown as their newest backup (Before/After compare). */
  before: string[];
  /** Filled with a snapshot function once the renderer exists. */
  snapshot: { current: Snapshot | null };
};

/** Adds one THREE.Mesh per part to `group`; returns the shared textures and the loader hot reload reuses. */
function populate(group: THREE.Group, data: MeshData, changed: () => void) {
  const textures = new Map<string, THREE.Texture>(); // one GPU texture per file, shared across materials

  // (Re)loads the file into `tex` in place, so hot reload updates every material sharing it.
  // `before` loads the newest backup instead; a load that finishes after a newer request is dropped.
  const fill = (tex: THREE.Texture, path: string, before = false) => {
    const ticket = (tex.userData.ticket = (tex.userData.ticket ?? 0) + 1);
    const stale = () => tex.userData.ticket !== ticket;
    if (isJpeg(path) && !before) {
      // a half-written file fails to decode; the save's next watcher event retries
      new THREE.ImageLoader().load(`${convertFileSrc(path)}?v=${Date.now()}`, (img) => {
        if (stale()) return;
        tex.image = img;
        tex.needsUpdate = true;
        changed();
      });
      return;
    }
    decodeImage(path, undefined, before)
      .then(async ({ data, width, height, alpha }) => {
        // JPEG textures are plain Textures that upload an image, not raw RGBA
        const image = tex instanceof THREE.DataTexture
          ? { data, width, height }
          : await createImageBitmap(new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height));
        if (stale()) return;
        tex.image = image;
        tex.needsUpdate = true;
        changed();
        // shortcut: any alpha means blended glass-style rendering; masked cutouts (alpha test) need the material type from MATL.
        for (const o of group.children as THREE.Mesh[]) {
          const m = o.material as THREE.MeshLambertMaterial;
          if (m.map === tex && m.transparent !== alpha) {
            m.transparent = alpha;
            m.depthWrite = !alpha;
            m.needsUpdate = true;
          }
        }
      })
      .catch((e) => console.warn(String(e)));
  };

  for (const part of data.parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(part.uvs, 2));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3));
    geo.setIndex(part.indices);

    const path = part.texture?.path;
    let map: THREE.Texture | undefined;
    if (path && WEB_IMAGE.test(path)) {
      map = textures.get(path);
      if (!map) {
        map = isJpeg(path) ? new THREE.Texture() : new THREE.DataTexture();
        map.flipY = false; // Trainz UVs are DirectX-style (v=0 at the image top); checked against PEV Mesh Viewer
        map.colorSpace = THREE.SRGBColorSpace;
        map.minFilter = THREE.LinearMipmapLinearFilter;
        map.magFilter = THREE.LinearFilter;
        map.generateMipmaps = true;
        map.anisotropy = 8;
        textures.set(path, map);
      }
    }
    const mat = new THREE.MeshLambertMaterial({ color: map ? 0xffffff : 0xb4b4b4, map });
    const obj = Object.assign(new THREE.Mesh(geo, mat), { name: part.material });
    obj.userData.texture = path?.toLowerCase() ?? null;
    group.add(obj);
  }
  textures.forEach((tex, path) => fill(tex, path));
  return { textures, fill };
}

type Loaded = { textures: Map<string, THREE.Texture>; fill: (tex: THREE.Texture, path: string, before?: boolean) => void };

/** Reloads a texture in place whenever the backend's folder watcher reports its file changed. */
function hotReload(textures: Map<string, THREE.Texture>, fill: Loaded["fill"]) {
  return listen<string>("texture-changed", ({ payload }) => {
    const hit = [...textures].find(([p]) => p.toLowerCase() === payload.toLowerCase());
    if (hit) fill(hit[1], hit[0]);
  });
}

function clear(group: THREE.Group, textures: Map<string, THREE.Texture>) {
  for (const o of group.children as THREE.Mesh[]) {
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
  }
  group.clear();
  textures.forEach((t) => t.dispose());
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

export default function Viewport({ mesh, imported, xf, onXf, onXfStart, mode, axes, wireframe, highlight, before, onPick, snapshot }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<Scene | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const xfOut = useRef(onXf);
  xfOut.current = onXf;
  const xfStart = useRef(onXfStart);
  xfStart.current = onXfStart;
  const loaded = useRef(new Set<Loaded>()); // the base and imported meshes' textures, for compare

  // One renderer for the app's lifetime; meshes are swapped into `group` and `imported`.
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // 4K at 3x would triple the pixels for no visible gain
    renderer.autoClear = false; // the corner navigation gizmo draws over the frame
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x393939);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
    camera.up.set(0, 0, 1); // Trainz is Z-up
    camera.position.set(15, -15, 8);
    const controls = new OrbitControls(camera, renderer.domElement);
    // Blender: MMB orbit, Shift+drag pan (OrbitControls pans on Shift+rotate), wheel zoom. LMB orbits too for mice without MMB.
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN };

    const sky = new THREE.HemisphereLight(0xffffff, 0x555555, 2);
    sky.position.set(0, 0, 1);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(5, -10, 12);
    const grid = new THREE.GridHelper(100, 100, 0x5a5a5a, 0x474747);
    grid.rotation.x = Math.PI / 2;
    const group = new THREE.Group();
    const importedGroup = new THREE.Group();
    const gizmo = new TransformControls(camera, renderer.domElement);
    // Render on demand: these events, prop changes and texture loads ask for frames; an idle viewport costs nothing.
    let frames = 2;
    const invalidate = () => {
      frames = 2;
    };
    controls.addEventListener("change", invalidate);
    gizmo.addEventListener("change", invalidate); // drags and axis hover highlight
    gizmo.addEventListener("dragging-changed", (e) => {
      controls.enabled = !e.value;
    });
    gizmo.addEventListener("mouseDown", () => xfStart.current());
    gizmo.addEventListener("objectChange", () => {
      const o = importedGroup;
      xfOut.current({
        position: o.position.toArray().map(round),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z].map((r) => round(THREE.MathUtils.radToDeg(r))),
        scale: o.scale.toArray().map(round),
      });
    });
    // Blender's axis colours: X red, Y green on the floor, Z blue up. Lifted a hair to win over the grid's centre lines.
    const axes = new THREE.Group();
    for (const [to, color] of [[[50, 0, 0], 0xff3352], [[0, 50, 0], 0x8bdc00], [[0, 0, 50], 0x2890ff]] as const) {
      const from = to[2] ? [0, 0, 0] : to.map((v) => -v);
      const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([...from, ...to], 3));
      axes.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
    }
    axes.position.z = 0.002;
    const viewHelper = new ViewHelper(camera, renderer.domElement);
    viewHelper.setLabels("X", "Y", "Z");
    viewHelper.location = { top: 8, right: 8, bottom: 0, left: null }; // top-right, where Blender keeps it
    viewHelper.center = controls.target;
    scene.add(sky, sun, grid, axes, group, importedGroup, gizmo.getHelper());

    const c: Scene = {
      group,
      imported: importedGroup,
      gizmo,
      axes,
      invalidate,
      look(dir) {
        const box = c.bbox ?? new THREE.Box3(new THREE.Vector3(-5, -5, 0), new THREE.Vector3(5, 5, 4));
        const center = box.getCenter(new THREE.Vector3());
        const radius = box.getSize(new THREE.Vector3()).length() / 2;
        const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
        camera.position.copy(center).addScaledVector(dir.clone().normalize(), dist);
        controls.target.copy(center);
        controls.update();
        invalidate();
      },
    };
    ctx.current = c;

    const views: Record<string, THREE.Vector3> = {
      Home: new THREE.Vector3(1, -1, 0.6),
      Numpad1: new THREE.Vector3(0, -1, 0), // front
      Numpad3: new THREE.Vector3(1, 0, 0), // right
      Numpad7: new THREE.Vector3(0, -0.001, 1), // top; tiny Y keeps OrbitControls off the Z-up singularity
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey) return;
      if (views[e.code]) c.look(views[e.code]);
    };
    window.addEventListener("keydown", onKey);

    // LMB both orbits and picks: a press that moves more than a few pixels is an orbit, not a click.
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      if (axes.visible && viewHelper.handleClick(e)) return; // clicked an axis ball: the view turns to it
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([...group.children, ...importedGroup.children])[0]?.object;
      pick.current(hit ? { material: hit.name, texture: hit.userData.texture } : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    // Thumbnails: same camera, without grid, gizmo and selection glow. Everything is restored in the same task,
    // after toBlob has copied the frame, so the viewport never shows the resized frame.
    snapshot.current = (w, h) => {
      const meshes = [...group.children, ...importedGroup.children] as THREE.Mesh[];
      const mats = meshes.map((o) => o.material as THREE.MeshLambertMaterial);
      const glow = mats.map((m) => m.emissive.clone());
      mats.forEach((m) => m.emissive.copy(NONE));
      const axesShown = axes.visible;
      grid.visible = axes.visible = false;
      gizmo.getHelper().visible = false;
      const ratio = renderer.getPixelRatio();
      const fov = camera.fov;
      // A thumbnail narrower than the viewport would crop the sides; widen the FOV to keep the same horizontal view.
      if (w / h < camera.aspect) {
        const half = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (camera.aspect / (w / h));
        camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half));
      }
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.clear();
      renderer.render(scene, camera);
      const blob = new Promise<Blob>((done, fail) =>
        renderer.domElement.toBlob((b) => (b ? done(b) : fail(new Error("could not encode the thumbnail"))), "image/jpeg", 0.92),
      );
      mats.forEach((m, i) => m.emissive.copy(glow[i]));
      grid.visible = true;
      axes.visible = axesShown;
      gizmo.getHelper().visible = true;
      camera.fov = fov;
      renderer.setPixelRatio(ratio);
      resize();
      return blob;
    };
    let last = performance.now();
    renderer.setAnimationLoop((now) => {
      if (viewHelper.animating) {
        viewHelper.update((now - last) / 1000);
        invalidate();
      }
      last = now;
      if (frames <= 0) return;
      frames--;
      controls.update();
      renderer.clear();
      renderer.render(scene, camera);
      if (axes.visible) viewHelper.render(renderer);
    });

    return () => {
      snapshot.current = null;
      window.removeEventListener("keydown", onKey);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      gizmo.dispose();
      viewHelper.dispose();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    if (!c || !mesh) return;
    const set = populate(c.group, mesh, c.invalidate);
    const { textures, fill } = set;
    loaded.current.add(set);
    const [min, max] = mesh.bbox;
    c.bbox = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    c.look(new THREE.Vector3(1, -1, 0.6));

    const unlisten = hotReload(textures, fill);

    return () => {
      loaded.current.delete(set);
      unlisten.then((f) => f());
      clear(c.group, textures);
    };
  }, [mesh]);

  useEffect(() => {
    const c = ctx.current;
    if (!c || !imported) return;
    const set = populate(c.imported, imported, c.invalidate);
    const { textures, fill } = set;
    loaded.current.add(set);
    const unlisten = hotReload(textures, fill);
    // Centre the geometry on its pivot so the gizmo sits on the object; xfMatrix applies the same offset on export.
    const [px, py, pz] = pivotOf(imported);
    for (const o of c.imported.children as THREE.Mesh[]) o.geometry.translate(-px, -py, -pz);
    c.gizmo.attach(c.imported);
    return () => {
      c.gizmo.detach();
      loaded.current.delete(set);
      unlisten.then((f) => f());
      clear(c.imported, textures);
    };
  }, [imported]);

  useEffect(() => {
    ctx.current?.gizmo.setMode(mode);
  }, [mode]);

  useEffect(() => {
    if (ctx.current) ctx.current.axes.visible = axes;
  }, [axes]);

  useEffect(() => {
    const o = ctx.current?.imported;
    if (!o) return;
    const [rx, ry, rz] = xf.rotation.map(THREE.MathUtils.degToRad);
    o.position.set(xf.position[0], xf.position[1], xf.position[2]);
    o.rotation.set(rx, ry, rz, "XYZ");
    o.scale.set(xf.scale[0], xf.scale[1], xf.scale[2]);
  }, [xf]);

  useEffect(() => {
    const c = ctx.current;
    for (const o of [...(c?.group.children ?? []), ...(c?.imported.children ?? [])] as THREE.Mesh[]) {
      (o.material as THREE.MeshLambertMaterial).wireframe = wireframe;
    }
  }, [wireframe, mesh, imported]);

  useEffect(() => {
    const c = ctx.current;
    for (const o of [...(c?.group.children ?? []), ...(c?.imported.children ?? [])] as THREE.Mesh[]) {
      const lit = highlight !== null && o.userData.texture === highlight;
      (o.material as THREE.MeshLambertMaterial).emissive.copy(lit ? HIGHLIGHT : NONE);
    }
  }, [highlight, mesh, imported]);

  // Swaps textures between the file and its newest backup; only ones whose side changed reload.
  useEffect(() => {
    for (const { textures, fill } of loaded.current) {
      textures.forEach((tex, path) => {
        const want = before.includes(path.toLowerCase());
        if (want !== !!tex.userData.before) fill(tex, path, (tex.userData.before = want));
      });
    }
  }, [before]);

  // Any prop change (mesh, placement, wireframe, highlight, compare, axes, gizmo mode) may change the picture.
  useEffect(() => ctx.current?.invalidate());

  return <div className="viewport" ref={host} />;
}
