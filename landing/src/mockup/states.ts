import type { MockState, MockTexture } from "./AppMockup";
import type { Rect } from "./Frame";

// Indorails TC1-8500 (TKK-8500 Trainset), shown with INDORAILS' permission. Names, counts and validation come from
// the real app with this mesh open; viewport renders and thumbnails in public/captures were taken from the running
// app over WebView2 DevTools (2x). Notice strings copy the app's wording (app/src/App.tsx).

const tex = (name: string, users: number, size = "2048×2048"): MockTexture => ({
  name,
  size,
  users,
  swatch: `url(/captures/tex-${name.replace(/\.[^.]+$/, "")}.webp) center / cover`,
});

const textures: MockTexture[] = [
  tex("1.jpg", 1),
  tex("10.jpg", 1),
  tex("2.jpg", 1),
  tex("4_a.jpg", 1),
  tex("5_a.jpg", 1),
  tex("6.jpg", 1),
  tex("7.jpg", 1),
  tex("8_a.jpg", 1),
  tex("9.jpg", 1),
  tex("panto_a.jpg", 0),
  tex("stk.jpg", 2),
  tex("texture-kaca.tga", 1, "1024×1024"),
];

const dir = "D:\\Trainz\\TKK-8500\\kuid 1047762 100199 IR - TC1-8500 K1 1 8\\body";

// Open Recent labels as the app writes them (file name · folder): meshes from the same TKK-8500 set.
export const RECENT = ["body.im · body", "int.im · int", "masinis.im · masinis"];

export const base: MockState = {
  path: `${dir}\\body.im`,
  parts: [
    "1.m.onetex",
    "stk.m.onetex",
    "2.m.onetex",
    "4.m.onetex",
    "5.m.onetex",
    "kaca.m.onetex",
    "6.m.onetex",
    "7.m.onetex",
    "8.m.onetex",
    "9.m.onetex",
    "kacafrm.m.onetex",
    "10.m.onetex",
  ].map((material) => ({ material })),
  attachments: ["a.bog0", "a.bog1", "a.limfront", "a.limback", "a.load0", "a.cabfront", "a.cabback", "a.light0", "a.light1", "a.pant0"],
  issues: [{ level: "warn", text: "panto_a.jpg is not used by this mesh" }],
  textures,
  status: "12 parts · 62,974 verts · 50,614 tris · 12 images in folder · watching folder",
  // Statistics overlay; edges counted the way app/src/stats.ts does (unique per part) from the same body.im.
  stats: { objects: 12, vertices: 62974, edges: 105165, faces: 50614, triangles: 50614 },
  recent: RECENT,
  liveries: 1,
  viewport: "/captures/tc1-material.webp",
};

const select = (name: string, extra: Partial<MockTexture> = {}) =>
  textures.map((t) => (t.name === name ? { ...t, selected: true, ...extra } : t));

export const hero: MockState = { ...base, notice: "Reloaded 1.jpg" };

export const replaced = `Replaced 1.jpg · backup: ${dir}\\.trainzlook-backup\\1792563281072-1.jpg`;

// 1.m.onetex clicked in the Outliner: the row, its tile and the parts using 1.jpg light up (the real capture), and
// the Statistics overlay counts the selection.
export const tour: MockState = {
  ...base,
  parts: base.parts.map((p, i) => (i === 0 ? { ...p, selected: true } : p)),
  textures: select("1.jpg", { backups: 1 }),
  stats: { ...base.stats!, selected: ["1.jpg", 1] },
  viewport: "/captures/tc1-highlight.webp",
  notice: "1.m.onetex → 1.jpg",
};

// Scene states. The edited livery is a hue-shifted 1.jpg made for the demo; the app reloaded it from disk.
export const empty: MockState = { parts: [], textures: [], status: "Ready", recent: RECENT, viewport: "/captures/tc1-empty.webp" };

export const livery: MockState = {
  ...base,
  textures: textures.map((t) => (t.name === "1.jpg" ? { ...t, swatch: "url(/captures/tex-1-livery.webp) center / cover" } : t)),
  viewport: "/captures/tc1-livery.webp",
  notice: "Reloaded 1.jpg",
};

export const validation: MockState = {
  ...base,
  issues: base.issues?.map((i) => ({ ...i, hot: true })),
  textures: select("panto_a.jpg"),
};

export const uv: MockState = {
  ...base,
  textures: select("1.jpg"),
  hotButton: "UV 1.jpg",
  notice: "Saved UV template 1_uv.png (2048×2048)",
};

export const thumbnail: MockState = { ...base, hotButton: "ss.jpg", notice: "Saved thumbnail ss.jpg (512×512)" };

export const navigation: MockState = { ...base, wireframe: true, viewport: "/captures/tc1-wireframe.webp" };

// Crops (x, y, w, h in the 1400×900 mockup) for the "Juga ada" view; all 2:1 so switching never jumps the layout.
export const crops: Record<string, Rect> = {
  S5: [242, 580, 640, 320], // texture browser, UV button
  S6: [0, 580, 640, 320], // validation list
  S8: [242, 61, 640, 320], // viewport header: ss.jpg / $screenshot$
  S9: [560, 61, 840, 420], // wireframe car and the navigation gizmo
};
