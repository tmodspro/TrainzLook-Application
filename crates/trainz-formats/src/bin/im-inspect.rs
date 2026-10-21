//! `im-inspect <file.im | folder>...`: details for a file, one summary line per mesh for a folder (recursive).
//! Exits non-zero if any mesh fails to parse or to round-trip byte for byte, so it doubles as the corpus validator.

use std::path::{Path, PathBuf};
use std::{env, fs, process};
use trainz_formats::{ImFile, Mesh, parse_im, parse_texture_txt, texture_txt_path};

fn main() {
    let args: Vec<PathBuf> = env::args_os().skip(1).map(PathBuf::from).collect();
    if args.is_empty() {
        eprintln!("usage: im-inspect <file.im | folder>...");
        process::exit(2);
    }
    let mut failed = 0;
    for arg in &args {
        let detailed = arg.is_file();
        let mut files = Vec::new();
        if detailed {
            files.push(arg.clone());
        } else if let Err(e) = find_meshes(arg, &mut files) {
            eprintln!("{}: {e}", arg.display());
            failed += 1;
        }
        for path in &files {
            match fs::read(path).map_err(|e| e.to_string()).and_then(|d| {
                roundtrip(&d)?;
                parse_im(&d).map_err(|e| e.to_string())
            }) {
                Ok(mesh) if detailed => print_details(path, &mesh),
                Ok(mesh) => {
                    let (v, t) = totals(&mesh);
                    println!(
                        "OK   {}  parts={} verts={v} tris={t}",
                        path.display(),
                        mesh.parts.len()
                    );
                }
                Err(e) => {
                    println!("FAIL {}  {e}", path.display());
                    failed += 1;
                }
            }
        }
    }
    if failed > 0 {
        eprintln!("{failed} failed");
        process::exit(1);
    }
}

/// The editor's writer must reproduce an untouched file exactly; report the first differing byte otherwise.
fn roundtrip(data: &[u8]) -> Result<(), String> {
    let out = ImFile::parse(data).map_err(|e| e.to_string())?.to_bytes();
    match out.iter().zip(data).position(|(a, b)| a != b) {
        None if out.len() == data.len() => Ok(()),
        at => Err(format!(
            "round-trip differs at byte {:#x} (rewrite {} bytes, original {})",
            at.unwrap_or(out.len().min(data.len())),
            out.len(),
            data.len()
        )),
    }
}

fn find_meshes(dir: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            find_meshes(&path, out)?;
        } else if path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("im"))
        {
            out.push(path);
        }
    }
    Ok(())
}

fn totals(mesh: &Mesh) -> (usize, usize) {
    mesh.parts.iter().fold((0, 0), |(v, t), p| {
        (v + p.positions.len() / 3, t + p.indices.len() / 3)
    })
}

fn print_details(path: &Path, mesh: &Mesh) {
    let dir = path.parent().unwrap_or(Path::new("."));
    let (v, t) = totals(mesh);
    println!(
        "{}\n  bbox {:?} .. {:?}\n  {} parts, {v} verts, {t} tris",
        path.display(),
        mesh.bbox[0],
        mesh.bbox[1],
        mesh.parts.len()
    );
    for p in &mesh.parts {
        let bone = p
            .bone
            .as_deref()
            .map(|b| format!("  bone={b}"))
            .unwrap_or_default();
        println!(
            "  - {:<20} verts={:<6} tris={:<6}{bone}",
            p.material,
            p.positions.len() / 3,
            p.indices.len() / 3
        );
        for reference in &p.textures {
            let txt = texture_txt_path(dir, reference);
            let image = match fs::read(&txt) {
                Ok(bytes) => parse_texture_txt(&String::from_utf8_lossy(&bytes))
                    .get("primary")
                    .map(|img| {
                        if dir.join(img).is_file() {
                            img.clone()
                        } else {
                            format!("{img} (MISSING)")
                        }
                    })
                    .unwrap_or_else(|| "no Primary= entry".into()),
                Err(_) => format!("{} not found", txt.file_name().unwrap().to_string_lossy()),
            };
            println!(
                "      texture {} -> {image}",
                txt.file_name().unwrap().to_string_lossy()
            );
        }
    }
    for a in &mesh.attachments {
        println!(
            "  @ {:<14} pos=({:.3}, {:.3}, {:.3})",
            a.name, a.matrix[9], a.matrix[10], a.matrix[11]
        );
    }
}
