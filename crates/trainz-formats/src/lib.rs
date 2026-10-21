//! Readers for Trainz asset formats. Layouts are documented in `docs/01-reverse-engineering.md` §4.

use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};

pub mod im;
pub use im::ImFile;
use im::TopChunk;

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
pub(crate) struct Reader<'a> {
    pub(crate) data: &'a [u8],
    pub(crate) pos: usize,
}

impl<'a> Reader<'a> {
    pub(crate) fn err<T>(&self, msg: impl Into<String>) -> Result<T, Error> {
        Err(Error {
            offset: self.pos,
            msg: msg.into(),
        })
    }

    pub(crate) fn done(&self) -> bool {
        self.pos >= self.data.len()
    }

    pub(crate) fn take(&mut self, n: usize) -> Result<&'a [u8], Error> {
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

    pub(crate) fn u32(&mut self) -> Result<u32, Error> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    pub(crate) fn count(&mut self) -> Result<usize, Error> {
        Ok(self.u32()? as usize)
    }

    pub(crate) fn f32s(&mut self, n: usize) -> Result<Vec<f32>, Error> {
        let bytes = self.take(n * 4)?;
        Ok(bytes
            .as_chunks::<4>()
            .0
            .iter()
            .map(|b| f32::from_le_bytes(*b))
            .collect())
    }

    /// Fixed-size, NUL-padded text.
    pub(crate) fn text(&mut self, n: usize) -> Result<String, Error> {
        let bytes = self.take(n)?;
        let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
        // Latin-1: author paths can contain non-UTF-8 bytes.
        Ok(bytes[..end].iter().map(|&b| b as char).collect())
    }

    /// u32 length followed by NUL-padded text.
    pub(crate) fn string(&mut self) -> Result<String, Error> {
        let n = self.count()?;
        self.text(n)
    }

    pub(crate) fn version(&mut self, tag: &str, want: u32) -> Result<(), Error> {
        let v = self.u32()?;
        if v != want {
            self.pos -= 4;
            return self.err(format!("unsupported {tag} version {v}, expected {want}"));
        }
        Ok(())
    }

    /// Reads `tag, u32 size, payload` and returns a reader limited to the payload.
    pub(crate) fn chunk(&mut self) -> Result<([u8; 4], Reader<'a>), Error> {
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

    pub(crate) fn expect_chunk(&mut self, want: &[u8; 4]) -> Result<Reader<'a>, Error> {
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

/// Checks the `JIRF` / `IDXM` header and returns a reader at the first chunk.
pub(crate) fn header(data: &[u8]) -> Result<Reader<'_>, Error> {
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
    Ok(r)
}

/// Parses a `.im` file (`JIRF` / `IDXM`) for viewing. Input is untrusted: every count is bounds-checked.
pub fn parse_im(data: &[u8]) -> Result<Mesh, Error> {
    let file = ImFile::parse(data)?;
    let mut mesh = Mesh {
        bbox: [[0.0; 3]; 2],
        parts: Vec::new(),
        attachments: Vec::new(),
    };
    for c in &file.chunks {
        match c {
            TopChunk::Info(raw) => {
                let f = |o: usize| f32::from_le_bytes(raw[o..o + 4].try_into().unwrap());
                mesh.bbox = [[f(0x2C), f(0x30), f(0x34)], [f(0x38), f(0x3C), f(0x40)]];
            }
            TopChunk::Part(p) => mesh.parts.push(Part {
                material: im::text(&p.material),
                textures: p.textures.iter().map(|t| im::text(&t.path)).collect(),
                bone: (!p.bone.is_empty()).then(|| im::text(&p.bone)),
                positions: p.verts.iter().flat_map(|v| [v[0], v[1], v[2]]).collect(),
                uvs: p.verts.iter().flat_map(|v| [v[3], v[4]]).collect(),
                normals: p.normals.iter().flatten().copied().collect(),
                indices: p.indices.clone(),
            }),
            TopChunk::Other(tag, raw) if tag.eq(b"ATCH") => {
                let mut c = Reader { data: raw, pos: 0 };
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
