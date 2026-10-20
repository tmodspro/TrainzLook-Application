//! Readers for Trainz asset formats. Layouts are documented in `docs/01-reverse-engineering.md` §4.

use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct Error {
    pub offset: usize,
    pub msg: String,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{} (at byte {:#x})", self.msg, self.offset)
    }
}

impl std::error::Error for Error {}

/// A parsed `.im` mesh. Trainz axes: Z up, Y along the vehicle, metres.
#[derive(Debug)]
pub struct Mesh {
    /// `[min, max]` from the INFO chunk.
    pub bbox: [[f32; 3]; 2],
    pub parts: Vec<Part>,
    pub attachments: Vec<Attachment>,
}

/// One CHNK: a single material and its triangles. Arrays are flat, ready for GPU buffers.
#[derive(Debug)]
pub struct Part {
    /// e.g. `4.m.onetex` or `grey_m.notex`; the `m.<type>` suffix is the material type.
    pub material: String,
    /// Raw MATL references, often absolute paths from the author's PC; see [`texture_txt_path`].
    pub textures: Vec<String>,
    /// Bone this part is rigidly attached to, e.g. `b.r.body1`.
    pub bone: Option<String>,
    pub positions: Vec<f32>,
    pub uvs: Vec<f32>,
    pub normals: Vec<f32>,
    pub indices: Vec<u16>,
}

#[derive(Debug)]
pub struct Attachment {
    pub name: String,
    /// 3x3 rotation followed by xyz position.
    pub matrix: [f32; 12],
}

/// Bounds-checked little-endian reader; offsets stay absolute so errors point into the file.
struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn err<T>(&self, msg: impl Into<String>) -> Result<T, Error> {
        Err(Error {
            offset: self.pos,
            msg: msg.into(),
        })
    }

    fn done(&self) -> bool {
        self.pos >= self.data.len()
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], Error> {
        match self
            .pos
            .checked_add(n)
            .filter(|&end| end <= self.data.len())
        {
            Some(end) => {
                let bytes = &self.data[self.pos..end];
                self.pos = end;
                Ok(bytes)
            }
            None => self.err(format!("unexpected end of data, needed {n} more bytes")),
        }
    }

    fn u32(&mut self) -> Result<u32, Error> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn count(&mut self) -> Result<usize, Error> {
        Ok(self.u32()? as usize)
    }

    fn f32s(&mut self, n: usize) -> Result<Vec<f32>, Error> {
        let bytes = self.take(n * 4)?;
        Ok(bytes
            .as_chunks::<4>()
            .0
            .iter()
            .map(|b| f32::from_le_bytes(*b))
            .collect())
    }

    /// Fixed-size, NUL-padded text.
    fn text(&mut self, n: usize) -> Result<String, Error> {
        let bytes = self.take(n)?;
        let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
        // Latin-1: author paths can contain non-UTF-8 bytes.
        Ok(bytes[..end].iter().map(|&b| b as char).collect())
    }

    /// u32 length followed by NUL-padded text.
    fn string(&mut self) -> Result<String, Error> {
        let n = self.count()?;
        self.text(n)
    }

    fn version(&mut self, tag: &str, want: u32) -> Result<(), Error> {
        let v = self.u32()?;
        if v != want {
            self.pos -= 4;
            return self.err(format!("unsupported {tag} version {v}, expected {want}"));
        }
        Ok(())
    }

    /// Reads `tag, u32 size, payload` and returns a reader limited to the payload.
    fn chunk(&mut self) -> Result<([u8; 4], Reader<'a>), Error> {
        let tag: [u8; 4] = self.take(4)?.try_into().unwrap();
        let size = self.count()?;
        let start = self.pos;
        self.take(size)?;
        Ok((
            tag,
            Reader {
                data: &self.data[..self.pos],
                pos: start,
            },
        ))
    }

    fn expect_chunk(&mut self, want: &[u8; 4]) -> Result<Reader<'a>, Error> {
        let at = self.pos;
        let (tag, payload) = self.chunk()?;
        if &tag != want {
            return Err(Error {
                offset: at,
                msg: format!("expected {} chunk, found {}", tag_str(want), tag_str(&tag)),
            });
        }
        Ok(payload)
    }
}

fn tag_str(tag: &[u8; 4]) -> String {
    tag.iter().map(|&b| b as char).collect()
}

/// Parses a `.im` file (`JIRF` / `IDXM`). Input is untrusted: every count is bounds-checked.
pub fn parse_im(data: &[u8]) -> Result<Mesh, Error> {
    let mut r = Reader { data, pos: 0 };
    if r.take(4)? != b"JIRF" {
        return Err(Error {
            offset: 0,
            msg: "not a Trainz mesh (missing JIRF header)".into(),
        });
    }
    let size = r.count()?;
    if size != data.len() - 8 {
        return Err(Error {
            offset: 4,
            msg: format!(
                "header says {} bytes, file has {} (truncated?)",
                size + 8,
                data.len()
            ),
        });
    }
    if r.take(4)? != b"IDXM" {
        return Err(Error {
            offset: 8,
            msg: "not an indexed mesh (missing IDXM)".into(),
        });
    }

    let mut mesh = Mesh {
        bbox: [[0.0; 3]; 2],
        parts: Vec::new(),
        attachments: Vec::new(),
    };
    while !r.done() {
        let (tag, mut c) = r.chunk()?;
        match &tag {
            b"INFO" => {
                c.version("INFO", 104)?;
                c.take(0x28)?;
                let b = c.f32s(6)?;
                mesh.bbox = [[b[0], b[1], b[2]], [b[3], b[4], b[5]]];
            }
            b"CHNK" => {
                c.version("CHNK", 100)?;
                c.u32()?; // chunk index
                mesh.parts.push(parse_part(&mut c)?);
            }
            b"ATCH" => {
                c.version("ATCH", 100)?;
                for _ in 0..c.u32()? {
                    let name = c.string()?;
                    let matrix = c.f32s(12)?.try_into().unwrap();
                    mesh.attachments.push(Attachment { name, matrix });
                }
            }
            // shortcut: SKEL/INFL (skinning) are skipped, skinned meshes render in bind pose; parse them for .kin animation.
            _ => {}
        }
    }
    Ok(mesh)
}

fn parse_part(c: &mut Reader) -> Result<Part, Error> {
    let mut m = c.expect_chunk(b"MATL")?;
    m.version("MATL", 103)?;
    let material = m.string()?;
    m.take(16 * 4)?; // colours, shininess, flags: semantics not verified yet
    let mut textures = Vec::new();
    for _ in 0..m.u32()? {
        m.take(4)?; // texture slot, 1 = diffuse in every sample so far
        textures.push(m.string()?);
        m.take(4)?; // blend amount
    }

    let mut g = c.expect_chunk(b"GEOM")?;
    g.version("GEOM", 201)?;
    g.take(4)?;
    let has_tangents = g.u32()? != 0;
    g.take(4)?; // bounding radius
    let nv = g.count()?;
    let nt = g.count()?;
    let ni = g.count()?;
    g.take(8)?; // triangle count again, skin info
    let bone_len = g.count()?;
    if ni != nt * 3 {
        return g.err(format!("index count {ni} is not 3 x triangle count {nt}"));
    }
    let bone = if bone_len > 0 {
        Some(g.text(bone_len)?)
    } else {
        None
    };

    let verts = g.f32s(nv * 5)?;
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
    let normals = g.f32s(nv * 3)?;
    // shortcut: face normals and tangents are skipped; read tangents when normal-mapped materials land (roadmap phase 4).
    g.take(nt * 12 + if has_tangents { nv * 12 } else { 0 })?;
    if !g.done() {
        return g.err("unexpected trailing data in GEOM");
    }

    let verts = verts.as_chunks::<5>().0;
    Ok(Part {
        material,
        textures,
        bone,
        positions: verts.iter().flat_map(|v| [v[0], v[1], v[2]]).collect(),
        uvs: verts.iter().flat_map(|v| [v[3], v[4]]).collect(),
        normals,
        indices,
    })
}

/// Trainz resolves a MATL reference by file name only, beside the mesh: `mc.texture` -> `<dir>/mc.texture.txt`.
pub fn texture_txt_path(mesh_dir: &Path, reference: &str) -> PathBuf {
    let name = reference.rsplit(['\\', '/']).next().unwrap_or(reference);
    mesh_dir.join(format!("{name}.txt"))
}

/// Parses `key=value` lines of a `.texture.txt`; keys are lowercased (`primary`, `alpha`, `tile`, `hint`).
pub fn parse_texture_txt(text: &str) -> HashMap<String, String> {
    text.trim_start_matches('\u{feff}')
        .lines()
        .filter_map(|line| line.split_once('='))
        .map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_string()))
        .collect()
}
