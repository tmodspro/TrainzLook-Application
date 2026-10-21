//! Lossless `.im` model for editing: everything TrainzLook does not change is kept as raw bytes, so writing an
//! unmodified file reproduces it byte for byte (checked on the whole corpus by `im-inspect`).

use crate::{Error, Reader};

/// A whole `.im` file, top-level chunks in file order.
#[derive(Debug, Clone)]
pub struct ImFile {
    pub chunks: Vec<TopChunk>,
}

#[derive(Debug, Clone)]
pub enum TopChunk {
    /// INFO payload, version word included.
    Info(Vec<u8>),
    Part(Box<RawPart>),
    /// SKEL, INFL, ATCH and anything else: tag and raw payload.
    Other([u8; 4], Vec<u8>),
}

/// One CHNK (MATL + GEOM).
#[derive(Debug, Clone)]
pub struct RawPart {
    pub index: u32,
    /// Material name as stored (NUL padding included); see [`text`] / [`padded`].
    pub material: Vec<u8>,
    matl_fixed: Vec<u8>,
    pub textures: Vec<TextureRef>,
    matl_tail: Vec<u8>,
    /// GEOM header words after the version: [4, has_tangents, area, nv, nt, ni, nt, skin, bone_len].
    geom_head: [u32; 9],
    /// Bone name as stored; empty when the part is not bound to a bone.
    pub bone: Vec<u8>,
    /// x, y, z, u, v per vertex.
    pub verts: Vec<[f32; 5]>,
    pub indices: Vec<u16>,
    pub normals: Vec<[f32; 3]>,
    face_normals: Vec<[f32; 3]>,
    tangents: Option<Vec<[f32; 3]>>,
    chnk_tail: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct TextureRef {
    slot: u32,
    /// Reference as stored, e.g. an absolute author path ending in `mc.texture`.
    pub path: Vec<u8>,
    amount: [u8; 4],
}

/// Decodes a stored, NUL-padded Latin-1 string.
pub fn text(raw: &[u8]) -> String {
    let end = raw.iter().position(|&b| b == 0).unwrap_or(raw.len());
    raw[..end].iter().map(|&b| b as char).collect()
}

/// Encodes a string the way the corpus does: Latin-1, NUL-padded to a multiple of 4 (no terminator when it fits exactly).
pub fn padded(s: &str) -> Vec<u8> {
    let mut b: Vec<u8> = s
        .chars()
        .map(|c| if (c as u32) < 256 { c as u8 } else { b'?' })
        .collect();
    b.resize(b.len().div_ceil(4) * 4, 0);
    b
}

impl ImFile {
    pub fn parse(data: &[u8]) -> Result<Self, Error> {
        let mut r = crate::header(data)?;
        let mut chunks = Vec::new();
        while !r.done() {
            let (tag, mut c) = r.chunk()?;
            chunks.push(match &tag {
                b"INFO" => {
                    let raw = c.take(c.data.len() - c.pos)?.to_vec();
                    let mut v = Reader { data: &raw, pos: 0 };
                    v.version("INFO", 104)?;
                    if raw.len() < 0x44 {
                        return c.err("INFO chunk too short");
                    }
                    TopChunk::Info(raw)
                }
                b"CHNK" => TopChunk::Part(Box::new(parse_part(&mut c)?)),
                _ => TopChunk::Other(tag, c.take(c.data.len() - c.pos)?.to_vec()),
            });
        }
        Ok(ImFile { chunks })
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut body = b"IDXM".to_vec();
        for c in &self.chunks {
            match c {
                TopChunk::Info(raw) => put_chunk(&mut body, b"INFO", raw),
                TopChunk::Part(p) => put_chunk(&mut body, b"CHNK", &p.to_bytes()),
                TopChunk::Other(tag, raw) => put_chunk(&mut body, tag, raw),
            }
        }
        let mut out = b"JIRF".to_vec();
        out.extend((body.len() as u32).to_le_bytes());
        out.extend(body);
        out
    }

    pub fn parts(&self) -> impl Iterator<Item = &RawPart> {
        self.chunks.iter().filter_map(|c| match c {
            TopChunk::Part(p) => Some(p.as_ref()),
            _ => None,
        })
    }

    pub fn parts_mut(&mut self) -> impl Iterator<Item = &mut RawPart> {
        self.chunks.iter_mut().filter_map(|c| match c {
            TopChunk::Part(p) => Some(p.as_mut()),
            _ => None,
        })
    }

    /// Skinned meshes (SKEL) or parts bound to bones move with animation; transforming them breaks it.
    pub fn is_animated(&self) -> bool {
        self.chunks
            .iter()
            .any(|c| matches!(c, TopChunk::Other(t, _) if t == b"SKEL"))
            || self.parts().any(|p| !p.bone.is_empty())
    }

    /// Appends parts after the last existing CHNK, numbering them on, and grows INFO's chunk count and bounding box.
    /// The existing parts and INFO bytes stay untouched otherwise.
    pub fn append_parts(&mut self, parts: Vec<RawPart>) -> Result<(), Error> {
        let mut next = self.parts().map(|p| p.index + 1).max().unwrap_or(0);
        let at = self
            .chunks
            .iter()
            .rposition(|c| matches!(c, TopChunk::Part(_)))
            .map_or(self.chunks.len(), |i| i + 1);
        let total = (self.parts().count() + parts.len()) as u32;
        let (mut lo, mut hi) = ([f32::INFINITY; 3], [f32::NEG_INFINITY; 3]);
        for p in &parts {
            for v in &p.verts {
                for k in 0..3 {
                    lo[k] = lo[k].min(v[k]);
                    hi[k] = hi[k].max(v[k]);
                }
            }
        }
        let info = self
            .chunks
            .iter_mut()
            .find_map(|c| match c {
                TopChunk::Info(raw) => Some(raw),
                _ => None,
            })
            .ok_or(Error {
                offset: 0,
                msg: "mesh has no INFO chunk".into(),
            })?;
        info[0x20..0x24].copy_from_slice(&total.to_le_bytes());
        for k in 0..3 {
            let (min_at, max_at) = (0x2C + 4 * k, 0x38 + 4 * k);
            let min = f32::from_le_bytes(info[min_at..min_at + 4].try_into().unwrap()).min(lo[k]);
            let max = f32::from_le_bytes(info[max_at..max_at + 4].try_into().unwrap()).max(hi[k]);
            info[min_at..min_at + 4].copy_from_slice(&min.to_le_bytes());
            info[max_at..max_at + 4].copy_from_slice(&max.to_le_bytes());
        }
        let parts = parts.into_iter().map(|mut p| {
            p.index = next;
            next += 1;
            TopChunk::Part(Box::new(p))
        });
        self.chunks.splice(at..at, parts);
        Ok(())
    }
}

impl RawPart {
    /// Applies a column-major 4x4 affine matrix (three.js `Matrix4.elements`) to positions, normals, face normals and
    /// tangents, and recomputes the stored surface area. A mirroring matrix also flips the triangle winding so the
    /// faces stay outward under Trainz's back-face culling.
    pub fn transform(&mut self, m: &[f32; 16]) -> Result<(), Error> {
        let m: Vec<f64> = m.iter().map(|&x| x as f64).collect();
        let a = |r: usize, c: usize| m[c * 4 + r];
        let det = a(0, 0) * (a(1, 1) * a(2, 2) - a(1, 2) * a(2, 1))
            - a(0, 1) * (a(1, 0) * a(2, 2) - a(1, 2) * a(2, 0))
            + a(0, 2) * (a(1, 0) * a(2, 1) - a(1, 1) * a(2, 0));
        if det.abs() < 1e-12 {
            return Err(Error {
                offset: 0,
                msg: "transform collapses the mesh (a scale of 0)".into(),
            });
        }
        // Normals use the inverse transpose; the cofactor matrix is that times det, so fix the sign and normalise.
        let cof = |r: usize, c: usize| {
            let (r1, r2) = ((r + 1) % 3, (r + 2) % 3);
            let (c1, c2) = ((c + 1) % 3, (c + 2) % 3);
            (a(r1, c1) * a(r2, c2) - a(r1, c2) * a(r2, c1)) * det.signum()
        };
        let mul = |f: &dyn Fn(usize, usize) -> f64, v: [f32; 3], w: f64| {
            let v = [v[0] as f64, v[1] as f64, v[2] as f64];
            [0, 1, 2].map(|r| f(r, 0) * v[0] + f(r, 1) * v[1] + f(r, 2) * v[2] + w * m[12 + r])
        };
        let unit = |v: [f64; 3]| {
            let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-30);
            v.map(|x| (x / l) as f32)
        };
        for v in &mut self.verts {
            let p = mul(&a, [v[0], v[1], v[2]], 1.0);
            (v[0], v[1], v[2]) = (p[0] as f32, p[1] as f32, p[2] as f32);
        }
        for n in self.normals.iter_mut().chain(self.face_normals.iter_mut()) {
            *n = unit(mul(&cof, *n, 0.0));
        }
        for t in self.tangents.iter_mut().flatten() {
            *t = unit(mul(&a, *t, 0.0));
        }
        if det < 0.0 {
            for tri in self.indices.as_chunks_mut::<3>().0 {
                tri.swap(1, 2);
            }
        }
        self.geom_head[2] = (self.surface_area() as f32).to_bits();
        Ok(())
    }

    /// Total triangle area, the value Trainz stores in the GEOM header.
    pub fn surface_area(&self) -> f64 {
        let p = |i: u16| {
            let v = self.verts[i as usize];
            [v[0] as f64, v[1] as f64, v[2] as f64]
        };
        self.indices
            .as_chunks::<3>()
            .0
            .iter()
            .map(|t| {
                let (a, b, c) = (p(t[0]), p(t[1]), p(t[2]));
                let (u, w) = (
                    [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
                    [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
                );
                let x = [
                    u[1] * w[2] - u[2] * w[1],
                    u[2] * w[0] - u[0] * w[2],
                    u[0] * w[1] - u[1] * w[0],
                ];
                (x[0] * x[0] + x[1] * x[1] + x[2] * x[2]).sqrt() / 2.0
            })
            .sum()
    }

    /// Stored surface area (GEOM header).
    pub fn stored_area(&self) -> f32 {
        f32::from_bits(self.geom_head[2])
    }

    fn to_bytes(&self) -> Vec<u8> {
        let mut matl = Vec::new();
        put_u32s(&mut matl, &[103, self.material.len() as u32]);
        matl.extend(&self.material);
        matl.extend(&self.matl_fixed);
        put_u32s(&mut matl, &[self.textures.len() as u32]);
        for t in &self.textures {
            put_u32s(&mut matl, &[t.slot, t.path.len() as u32]);
            matl.extend(&t.path);
            matl.extend(t.amount);
        }
        matl.extend(&self.matl_tail);

        let (nv, nt) = (self.verts.len() as u32, (self.indices.len() / 3) as u32);
        let h = &self.geom_head;
        let mut geom = Vec::new();
        put_u32s(
            &mut geom,
            &[
                201,
                h[0],
                self.tangents.is_some() as u32,
                h[2],
                nv,
                nt,
                nt * 3,
                nt,
                h[7],
                self.bone.len() as u32,
            ],
        );
        geom.extend(&self.bone);
        self.verts
            .iter()
            .flatten()
            .for_each(|x| geom.extend(x.to_le_bytes()));
        self.indices
            .iter()
            .for_each(|i| geom.extend(i.to_le_bytes()));
        let vec3s = self
            .normals
            .iter()
            .chain(&self.face_normals)
            .chain(self.tangents.iter().flatten());
        vec3s.flatten().for_each(|x| geom.extend(x.to_le_bytes()));

        let mut out = Vec::new();
        put_u32s(&mut out, &[100, self.index]);
        put_chunk(&mut out, b"MATL", &matl);
        put_chunk(&mut out, b"GEOM", &geom);
        out.extend(&self.chnk_tail);
        out
    }
}

fn parse_part(c: &mut Reader) -> Result<RawPart, Error> {
    c.version("CHNK", 100)?;
    let index = c.u32()?;

    let mut m = c.expect_chunk(b"MATL")?;
    m.version("MATL", 103)?;
    let n = m.count()?;
    let material = m.take(n)?.to_vec();
    let matl_fixed = m.take(16 * 4)?.to_vec(); // colours, shininess, flags: semantics not verified yet
    let mut textures = Vec::new();
    for _ in 0..m.u32()? {
        let slot = m.u32()?; // 1 = diffuse in every sample so far
        let n = m.count()?;
        let path = m.take(n)?.to_vec();
        let amount = m.take(4)?.try_into().unwrap();
        textures.push(TextureRef { slot, path, amount });
    }
    let matl_tail = m.take(m.data.len() - m.pos)?.to_vec();

    let mut g = c.expect_chunk(b"GEOM")?;
    g.version("GEOM", 201)?;
    let mut geom_head = [0u32; 9];
    for w in &mut geom_head {
        *w = g.u32()?;
    }
    let [_, has_tangents, _, nv, nt, ni, _, _, bone_len] = geom_head.map(|w| w as usize);
    if ni != nt * 3 {
        return g.err(format!("index count {ni} is not 3 x triangle count {nt}"));
    }
    let bone = g.take(bone_len)?.to_vec();
    let verts = g.f32s(nv * 5)?.as_chunks::<5>().0.to_vec();
    let indices: Vec<u16> = g
        .take(ni * 2)?
        .as_chunks::<2>()
        .0
        .iter()
        .map(|b| u16::from_le_bytes(*b))
        .collect();
    if let Some(i) = indices.iter().find(|&&i| i as usize >= nv) {
        return g.err(format!("index {i} out of range for {nv} vertices"));
    }
    let vec3s = |g: &mut Reader, n: usize| -> Result<Vec<[f32; 3]>, Error> {
        Ok(g.f32s(n * 3)?.as_chunks::<3>().0.to_vec())
    };
    let normals = vec3s(&mut g, nv)?;
    let face_normals = vec3s(&mut g, nt)?;
    let tangents = if has_tangents != 0 {
        Some(vec3s(&mut g, nv)?)
    } else {
        None
    };
    if !g.done() {
        return g.err("unexpected trailing data in GEOM");
    }
    let chnk_tail = c.take(c.data.len() - c.pos)?.to_vec();

    Ok(RawPart {
        index,
        material,
        matl_fixed,
        textures,
        matl_tail,
        geom_head,
        bone,
        verts,
        indices,
        normals,
        face_normals,
        tangents,
        chnk_tail,
    })
}

fn put_u32s(out: &mut Vec<u8>, vals: &[u32]) {
    vals.iter().for_each(|v| out.extend(v.to_le_bytes()));
}

fn put_chunk(out: &mut Vec<u8>, tag: &[u8; 4], payload: &[u8]) {
    out.extend(tag);
    out.extend((payload.len() as u32).to_le_bytes());
    out.extend(payload);
}
