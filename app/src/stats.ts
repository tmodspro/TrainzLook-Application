import type { Part } from "./types";

/** Blender-style scene statistics for the viewport overlay. Trainz meshes are all triangles, so faces = triangles. */
export function meshStats(parts: Part[]) {
  let vertices = 0;
  let triangles = 0;
  let edges = 0;
  for (const p of parts) {
    const nv = p.positions.length / 3;
    vertices += nv;
    triangles += p.indices.length / 3;
    // Unique undirected edges per part. Indices are u16, so a*nv+b stays an exact integer.
    const seen = new Set<number>();
    for (let i = 0; i + 2 < p.indices.length; i += 3) {
      for (const [a, b] of [
        [p.indices[i], p.indices[i + 1]],
        [p.indices[i + 1], p.indices[i + 2]],
        [p.indices[i + 2], p.indices[i]],
      ]) {
        seen.add(a < b ? a * nv + b : b * nv + a);
      }
    }
    edges += seen.size;
  }
  return { objects: parts.length, vertices, edges, faces: triangles, triangles };
}

if (import.meta.env.DEV) {
  const part = (indices: number[], nv: number) => ({ material: "", texture: null, positions: new Array(nv * 3).fill(0), uvs: [], normals: [], indices });
  const tri = meshStats([part([0, 1, 2], 3)]);
  console.assert(tri.edges === 3 && tri.triangles === 1 && tri.vertices === 3, "one triangle: 3 edges", tri);
  const quad = meshStats([part([0, 1, 2, 2, 1, 3], 4)]);
  console.assert(quad.edges === 5 && quad.faces === 2, "two triangles sharing an edge: 5 edges", quad);
}
