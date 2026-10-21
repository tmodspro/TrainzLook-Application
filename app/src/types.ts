// Shape of the `open_mesh` command result (app/src-tauri/src/lib.rs).
export type Texture = { file: string | null; path: string | null; problem: string | null };

export type Part = {
  material: string;
  texture: Texture | null;
  positions: number[];
  uvs: number[];
  normals: number[];
  indices: number[];
};

export type Livery = { name: string; files: string[] };

export type MeshData = {
  path: string;
  /** Folder holding config.txt, where Content Manager thumbnails go. */
  assetDir: string;
  bbox: [number[], number[]];
  parts: Part[];
  attachments: { name: string; position: number[] }[];
  images: { name: string; path: string; backups: number; width: number; height: number }[];
  /** Saved livery presets in the mesh folder (`.trainzlook-livery/<name>`): texture file names per preset. */
  liveries: Livery[];
};
