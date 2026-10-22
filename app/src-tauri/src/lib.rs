use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use trainz_formats::im::{padded, text};
use trainz_formats::{ImFile, parse_im, parse_texture_txt, texture_txt_path};

const IMAGE_EXTS: [&str; 6] = ["jpg", "jpeg", "png", "bmp", "tga", "dds"];
const BACKUP_DIR: &str = ".trainzlook-backup";

/// Folder of the open mesh and the watcher that reports texture edits in it.
#[derive(Default)]
struct Opened(Mutex<Option<(PathBuf, RecommendedWatcher)>>);

/// Folder of the mesh imported to merge, and the watcher that reports texture edits in it.
#[derive(Default)]
struct Imported(Mutex<Option<(PathBuf, RecommendedWatcher)>>);

fn is_image(p: &Path) -> bool {
    p.extension()
        .is_some_and(|x| IMAGE_EXTS.iter().any(|e| x.eq_ignore_ascii_case(e)))
}

/// Emits `texture-changed` with the file path whenever an image in `dir` is written (Photoshop save, Replace, copy).
/// One save arrives as several write events; they are merged until the folder is quiet for 150 ms, so the
/// webview decodes and uploads each texture once per save, after the file is complete.
fn watch(app: &tauri::AppHandle, dir: &Path) -> notify::Result<RecommendedWatcher> {
    let app = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<PathBuf>();
    // Ends when the watcher (and with it `tx`) is dropped.
    std::thread::spawn(move || {
        while let Some(paths) = next_batch(&rx, Duration::from_millis(150)) {
            for p in paths {
                let _ = app.emit("texture-changed", p);
            }
        }
    });
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
            for p in event.paths.into_iter().filter(|p| is_image(p)) {
                let _ = tx.send(p);
            }
        }
    })?;
    watcher.watch(dir, RecursiveMode::NonRecursive)?;
    Ok(watcher)
}

/// Waits for a changed path, then gathers more until none arrives for `quiet`. None once the sender is gone.
fn next_batch(
    rx: &std::sync::mpsc::Receiver<PathBuf>,
    quiet: Duration,
) -> Option<HashSet<PathBuf>> {
    let mut paths = HashSet::from([rx.recv().ok()?]);
    while let Ok(p) = rx.recv_timeout(quiet) {
        paths.insert(p);
    }
    Some(paths)
}

/// Overwrites `target` (an image beside the open or imported mesh) with `source`, converting between JPG/PNG/TGA/BMP
/// to the target's format so `.texture.txt` stays valid, and keeping a timestamped backup first.
// `async`: Tauri runs plain commands on the main thread, so decoding a 16 MB TGA would freeze the window.
#[tauri::command(async)]
fn replace_texture(
    state: tauri::State<Opened>,
    imported: tauri::State<Imported>,
    target: PathBuf,
    source: PathBuf,
) -> Result<Value, String> {
    let dir = texture_dir(&state, &imported, &target)?;
    replace_file(&dir, &target, &source)
}

/// Replace's work once `target` is known to be a texture in `dir`; shared with applying a livery preset.
fn replace_file(dir: &Path, target: &Path, source: &Path) -> Result<Value, String> {
    if source == target {
        return Err("pick a different file than the texture being replaced".into());
    }
    let ext = |p: &Path| p.extension().map(|e| e.to_ascii_lowercase());
    // Decode before touching anything, so a bad source never costs the original.
    let converted = if ext(source) == ext(target) {
        None
    } else {
        Some(image::open(source).map_err(|e| format!("cannot read {}: {e}", source.display()))?)
    };
    let (w, h) = match &converted {
        Some(img) => (img.width(), img.height()),
        None => image::image_dimensions(source)
            .map_err(|e| format!("cannot read {}: {e}", source.display()))?,
    };

    let name = target.file_name().unwrap().to_string_lossy().into_owned();
    let backups = dir.join(BACKUP_DIR);
    std::fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    let backup = backups.join(format!("{}-{name}", now_ms()));
    std::fs::copy(target, &backup).map_err(|e| format!("backup failed, nothing replaced: {e}"))?;

    let failed = |e: String| format!("replace failed, original kept at {}: {e}", backup.display());
    match converted {
        None => std::fs::copy(source, target)
            .map(|_| ())
            .map_err(|e| failed(e.to_string()))?,
        Some(img) => {
            // Write beside the target and rename, so the watcher never sees a half-written texture.
            let tmp = target.with_extension("trainzlook-tmp");
            write_image(&img, target, &tmp).map_err(failed)?;
            std::fs::rename(&tmp, target).map_err(|e| failed(e.to_string()))?;
        }
    }

    let warning = (!w.is_power_of_two() || !h.is_power_of_two())
        .then(|| format!("{w}x{h} is not a power of two; Trainz may show it blurred or wrong"));
    Ok(json!({ "backup": backup, "warning": warning, "backups": backups_of(dir, &name).len() }))
}

/// Livery presets live beside the mesh as `.trainzlook-livery/<name>/<texture file>`: byte copies of its textures.
const LIVERY_DIR: &str = ".trainzlook-livery";

/// A preset name that is safe as one Windows folder name.
fn livery_name(name: &str) -> Result<&str, String> {
    let name = name.trim();
    let bad = name.is_empty()
        || name.len() > 64
        || name.ends_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || r#"<>:"/\|?*"#.contains(c));
    if bad {
        return Err(format!(
            "\"{name}\" can't be a livery name: use 1-64 characters without < > : \" / \\ | ? *"
        ));
    }
    Ok(name)
}

/// Livery presets of the mesh folder `dir`: `[{ name, files }]`, sorted by name.
fn liveries(dir: &Path) -> Vec<Value> {
    let Ok(entries) = std::fs::read_dir(dir.join(LIVERY_DIR)) else {
        return Vec::new();
    };
    let mut list: Vec<(String, Vec<String>)> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_dir() && p.extension().is_none_or(|x| x != "trainzlook-tmp"))
        .map(|p| {
            let files = std::fs::read_dir(&p)
                .into_iter()
                .flatten()
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|f| is_image(f))
                .map(|f| f.file_name().unwrap().to_string_lossy().into_owned())
                .collect();
            (p.file_name().unwrap().to_string_lossy().into_owned(), files)
        })
        .collect();
    list.sort_by_key(|(n, _)| n.to_lowercase());
    list.into_iter()
        .map(|(name, files)| json!({ "name": name, "files": files }))
        .collect()
}

/// Saves `files` (textures of the open mesh) as the preset `name`, replacing a preset of that name only once
/// the new copy is complete. Returns the folder's presets.
#[tauri::command(async)]
fn save_livery(
    state: tauri::State<Opened>,
    name: String,
    files: Vec<PathBuf>,
) -> Result<Value, String> {
    let name = livery_name(&name)?;
    let dir = state
        .0
        .lock()
        .unwrap()
        .as_ref()
        .map(|(d, _)| d.clone())
        .ok_or("no mesh is open")?;
    for f in &files {
        if f.parent() != Some(dir.as_path()) || !f.is_file() || !is_image(f) {
            return Err(format!("{} is not a texture of the open mesh", f.display()));
        }
    }
    if files.is_empty() {
        return Err("the mesh uses no texture files to save".into());
    }
    let root = dir.join(LIVERY_DIR);
    let preset = root.join(name);
    let tmp = root.join(format!("{name}.trainzlook-tmp"));
    let _ = std::fs::remove_dir_all(&tmp); // leftover of a save that crashed
    std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    let copied = files
        .iter()
        .try_for_each(|f| std::fs::copy(f, tmp.join(f.file_name().unwrap())).map(|_| ()));
    if let Err(e) = copied {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err(format!(
            "could not save livery {name}, nothing changed: {e}"
        ));
    }
    if preset.exists() {
        std::fs::remove_dir_all(&preset)
            .map_err(|e| format!("could not replace livery {name}: {e}"))?;
    }
    std::fs::rename(&tmp, &preset).map_err(|e| format!("could not save livery {name}: {e}"))?;
    Ok(json!(liveries(&dir)))
}

/// Puts preset `name` on the open mesh through Replace (so every changed texture is backed up and revertable),
/// skipping files that are already identical. Stops at the first failure and still reports what changed.
#[tauri::command(async)]
fn apply_livery(state: tauri::State<Opened>, name: String) -> Result<Value, String> {
    let name = livery_name(&name)?;
    let dir = state
        .0
        .lock()
        .unwrap()
        .as_ref()
        .map(|(d, _)| d.clone())
        .ok_or("no mesh is open")?;
    let preset = dir.join(LIVERY_DIR).join(name);
    let entries = std::fs::read_dir(&preset).map_err(|e| format!("livery {name}: {e}"))?;
    let mut changed: Vec<Value> = Vec::new();
    for source in entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| is_image(p))
    {
        let target = dir.join(source.file_name().unwrap());
        if !target.is_file() || std::fs::read(&target).ok() == std::fs::read(&source).ok() {
            continue; // texture gone from the mesh folder, or already this livery
        }
        match replace_file(&dir, &target, &source) {
            Ok(r) => changed.push(json!({ "target": target, "backups": r["backups"] })),
            Err(e) => return Ok(json!({ "changed": changed, "error": e })),
        }
    }
    Ok(json!({ "changed": changed, "error": null }))
}

/// Undoes the last Replace of `target` by restoring its newest backup. The current file is kept as
/// `<millis>-<name>.undone` in the backup folder, so an edit saved since the Replace is never lost.
#[tauri::command(async)]
fn revert_texture(
    state: tauri::State<Opened>,
    imported: tauri::State<Imported>,
    target: PathBuf,
) -> Result<Value, String> {
    let dir = texture_dir(&state, &imported, &target)?;
    let name = target.file_name().unwrap().to_string_lossy().into_owned();
    let mut backups = backups_of(&dir, &name);
    backups.sort();
    let Some((_, newest)) = backups.pop() else {
        return Err(format!("{name} has no backup to revert to"));
    };
    let undone = dir
        .join(BACKUP_DIR)
        .join(format!("{}-{name}.undone", now_ms()));
    std::fs::rename(&target, &undone)
        .map_err(|e| format!("revert failed, nothing changed: {e}"))?;
    if let Err(e) = std::fs::rename(&newest, &target) {
        let _ = std::fs::rename(&undone, &target); // put the current file back
        return Err(format!("revert failed, nothing changed: {e}"));
    }
    Ok(json!({ "backups": backups.len() }))
}

/// Opens a texture for painting: in Photoshop when it is installed (repainters' editor; the Windows default for
/// JPG/PNG is often a viewer), else in the default app. The folder watcher hot-reloads it on every save.
#[tauri::command(async)]
fn edit_texture(
    state: tauri::State<Opened>,
    imported: tauri::State<Imported>,
    target: PathBuf,
) -> Result<&'static str, String> {
    texture_dir(&state, &imported, &target)?;
    let fail = |e: std::io::Error| format!("cannot open {}: {e}", target.display());
    if let Some(photoshop) = photoshop() {
        std::process::Command::new(photoshop)
            .arg(&target)
            .spawn()
            .map_err(fail)?;
        return Ok("Photoshop");
    }
    // explorer hands a file to its default app
    std::process::Command::new("explorer")
        .arg(&target)
        .spawn()
        .map_err(fail)?;
    Ok("the default app")
}

/// Links of the Bantuan popup (About.tsx). Only these open: the webview can't make the app launch any other URL.
const LINKS: [&str; 3] = [
    "https://trainzlook.web.id",
    "https://www.facebook.com/nolanagrn",
    "https://indorails.my.id/",
];

/// Opens one of `LINKS` in the default browser.
#[tauri::command(async)]
fn open_link(url: String) -> Result<(), String> {
    if !LINKS.contains(&url.as_str()) {
        return Err(format!("{url} is not a TrainzLook link"));
    }
    // explorer hands a URL to the default browser
    std::process::Command::new("explorer")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("cannot open {url}: {e}"))
}

/// Photoshop's exe from its App Paths registration, which every Photoshop installer writes.
fn photoshop() -> Option<PathBuf> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000; // no console flash from a GUI app
    let out = std::process::Command::new("reg")
        .args([
            "query",
            r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Photoshop.exe",
            "/ve",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    let path = PathBuf::from(reg_default(&String::from_utf8_lossy(&out.stdout))?);
    path.is_file().then_some(path)
}

/// The default value in `reg query /ve` output: `    (Default)    REG_SZ    C:\...\Photoshop.exe`.
fn reg_default(output: &str) -> Option<&str> {
    let value = output
        .split_once("REG_SZ")?
        .1
        .lines()
        .next()?
        .trim()
        .trim_matches('"');
    (!value.is_empty()).then_some(value)
}

/// Writes an image the user saved through a dialog (UV template PNG, thumbnail JPG). The bytes must match
/// the extension, so this can't be used to write arbitrary files.
// shortcut: bytes arrive as a JSON number array (~4x size); switch to a raw IPC body if large exports feel slow.
#[tauri::command(async)]
fn write_export(path: PathBuf, data: Vec<u8>) -> Result<(), String> {
    let ext = path.extension().map(|e| e.to_ascii_lowercase());
    let ok = match ext.as_ref().and_then(|e| e.to_str()) {
        Some("png") => data.starts_with(b"\x89PNG"),
        Some("jpg" | "jpeg") => data.starts_with(&[0xFF, 0xD8]),
        _ => false,
    };
    if !ok {
        return Err("only PNG or JPG images can be saved here".into());
    }
    std::fs::write(&path, data).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

/// Backups are named `<timestamp>-<file name>`; returns the timestamp if `file` is a backup of `name`.
/// `.undone` copies don't match, so Revert never restores them.
fn backup_stamp(file: &str, name: &str) -> Option<u128> {
    let (stamp, rest) = file.split_once('-')?;
    if !rest.eq_ignore_ascii_case(name) {
        return None;
    }
    stamp.parse().ok()
}

fn backups_of(dir: &Path, name: &str) -> Vec<(u128, PathBuf)> {
    let Ok(entries) = std::fs::read_dir(dir.join(BACKUP_DIR)) else {
        return Vec::new();
    };
    entries
        .filter_map(|e| {
            let path = e.ok()?.path();
            Some((
                backup_stamp(&path.file_name()?.to_string_lossy(), name)?,
                path,
            ))
        })
        .collect()
}

/// Encodes `img` in the format of `target`'s extension into `tmp`.
fn write_image(img: &image::DynamicImage, target: &Path, tmp: &Path) -> Result<(), String> {
    let format = image::ImageFormat::from_path(target).map_err(|e| e.to_string())?;
    let file = std::fs::File::create(tmp).map_err(|e| e.to_string())?;
    let mut out = std::io::BufWriter::new(file);
    match format {
        // JPEG has no alpha, and the encoder's default quality (75) visibly smears livery detail.
        image::ImageFormat::Jpeg => {
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 95)
                .encode_image(&img.to_rgb8())
                .map_err(|e| e.to_string())
        }
        _ => img.write_to(&mut out, format).map_err(|e| e.to_string()),
    }
}

/// Returns the open or imported mesh's folder when `path` is an existing image directly inside it: the only files
/// Replace, Revert and the decoder may touch.
fn texture_dir(opened: &Opened, imported: &Imported, path: &Path) -> Result<PathBuf, String> {
    let open = opened.0.lock().unwrap().as_ref().map(|(d, _)| d.clone());
    let import = imported.0.lock().unwrap().as_ref().map(|(d, _)| d.clone());
    if open.is_none() {
        return Err("no mesh is open".into());
    }
    match [open, import]
        .into_iter()
        .flatten()
        .find(|d| path.parent() == Some(d.as_path()))
    {
        Some(dir) if path.is_file() && is_image(path) => Ok(dir),
        _ => Err(format!(
            "{} is not a texture of the open or imported mesh",
            path.display()
        )),
    }
}

/// Decodes a non-JPEG texture (PNG, TGA, BMP) to RGBA for the webview, which cannot read TGA itself.
/// Layout: u32 width, u32 height, u32 has-alpha, then rows top to bottom. `max` downsizes for thumbnails.
/// `before` decodes the newest backup instead (what Revert would restore), for Before/After compare.
#[tauri::command(async)]
fn decode_image(
    state: tauri::State<Opened>,
    imported: tauri::State<Imported>,
    path: PathBuf,
    max: Option<u32>,
    before: Option<bool>,
) -> Result<tauri::ipc::Response, String> {
    let dir = texture_dir(&state, &imported, &path)?;
    let source = if before.unwrap_or(false) {
        let name = path.file_name().unwrap().to_string_lossy();
        let newest = backups_of(&dir, &name).into_iter().max();
        newest
            .ok_or(format!("{name} has no backup to compare with"))?
            .1
    } else {
        path
    };
    let mut img =
        image::open(&source).map_err(|e| format!("cannot decode {}: {e}", source.display()))?;
    if let Some(max) = max {
        img = img.thumbnail(max, max);
    }
    let rgba = img.to_rgba8();
    let alpha = img.color().has_alpha() && rgba.pixels().any(|p| p[3] < 255);
    let mut out = Vec::with_capacity(12 + rgba.len());
    for v in [rgba.width(), rgba.height(), alpha as u32] {
        out.extend(v.to_le_bytes());
    }
    out.extend_from_slice(&rgba);
    Ok(tauri::ipc::Response::new(out))
}

/// Follows MATL reference -> `.texture.txt` -> `Primary=` image, reporting the first broken link.
fn resolve_texture(dir: &Path, reference: &str) -> Value {
    let txt = texture_txt_path(dir, reference);
    let txt_name = txt
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let problem = |msg: String| json!({ "file": null, "path": null, "problem": msg });
    let Ok(bytes) = std::fs::read(&txt) else {
        return problem(format!("{txt_name} not found"));
    };
    let Some(file) = parse_texture_txt(&String::from_utf8_lossy(&bytes)).remove("primary") else {
        return problem(format!("{txt_name} has no Primary="));
    };
    let path = dir.join(&file);
    if !path.is_file() {
        return problem(format!("{file} not found"));
    }
    json!({ "file": file, "path": path, "problem": null })
}

/// The `.im` the app was started with (Explorer double-click / "Open with" passes it as the first argument).
#[tauri::command]
fn launch_path() -> Option<PathBuf> {
    let arg = PathBuf::from(std::env::args_os().nth(1)?);
    let is_im = arg
        .extension()
        .is_some_and(|x| x.eq_ignore_ascii_case("im"));
    // absolute, so the mesh folder is never "" when started from a shell with a relative path
    (is_im && arg.is_file())
        .then(|| std::path::absolute(&arg).ok())
        .flatten()
}

/// Parses a mesh, resolves its textures and lets the webview read files in the mesh folder.
#[tauri::command(async)]
fn open_mesh(
    app: tauri::AppHandle,
    state: tauri::State<Opened>,
    imported: tauri::State<Imported>,
    path: PathBuf,
) -> Result<Value, String> {
    let dir = path.parent().unwrap_or(Path::new("."));
    let described = describe(&app, &path)?;
    let watcher = watch(&app, dir).map_err(|e| format!("cannot watch {}: {e}", dir.display()))?;
    *state.0.lock().unwrap() = Some((dir.to_path_buf(), watcher));
    *imported.0.lock().unwrap() = None;
    Ok(described)
}

/// Loads a second mesh to place inside the open one. Animated meshes are refused: moving bone-bound parts breaks them.
#[tauri::command(async)]
fn import_mesh(
    app: tauri::AppHandle,
    imported: tauri::State<Imported>,
    path: PathBuf,
) -> Result<Value, String> {
    let data = std::fs::read(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if ImFile::parse(&data)
        .map_err(|e| e.to_string())?
        .is_animated()
    {
        return Err(format!(
            "{} is animated (skeleton or bone-bound parts); only static meshes can be merged",
            path.display()
        ));
    }
    let described = describe(&app, &path)?;
    let dir = path.parent().unwrap_or(Path::new("."));
    let watcher = watch(&app, dir).map_err(|e| format!("cannot watch {}: {e}", dir.display()))?;
    *imported.0.lock().unwrap() = Some((dir.to_path_buf(), watcher));
    Ok(described)
}

/// The viewer's description of a mesh file: geometry, resolved textures, attachments and the images beside it.
fn describe(app: &tauri::AppHandle, path: &Path) -> Result<Value, String> {
    let data = std::fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mesh = parse_im(&data).map_err(|e| e.to_string())?;
    let dir = path.parent().unwrap_or(Path::new("."));
    app.asset_protocol_scope()
        .allow_directory(dir, false)
        .map_err(|e| e.to_string())?;

    let mut images: Vec<Value> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| is_image(p))
        .map(|p| {
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            // Header-only read; 0x0 for formats the decoder lacks (DDS).
            let (width, height) = image::image_dimensions(&p).unwrap_or((0, 0));
            json!({ "backups": backups_of(dir, &name).len(), "name": name, "path": p, "width": width, "height": height })
        })
        .collect();
    images.sort_by_key(|i| i["name"].as_str().unwrap_or_default().to_lowercase());

    // shortcut: geometry goes over JSON (~3 MB for a 40k-vertex car); switch to binary IPC if load time hurts.
    let parts: Vec<Value> = mesh
        .parts
        .iter()
        .map(|p| {
            json!({
                "material": p.material,
                "texture": p.textures.first().map(|r| resolve_texture(dir, r)),
                "positions": p.positions,
                "uvs": p.uvs,
                "normals": p.normals,
                "indices": p.indices,
            })
        })
        .collect();
    let attachments: Vec<Value> = mesh
        .attachments
        .iter()
        .map(|a| json!({ "name": a.name, "position": &a.matrix[9..] }))
        .collect();

    // Thumbnails belong beside config.txt, usually one level above the mesh (kuid folder / body / body.im).
    let asset_dir = [Some(dir), dir.parent()]
        .into_iter()
        .flatten()
        .find(|d| d.join("config.txt").is_file())
        .unwrap_or(dir);

    Ok(json!({
        "path": path,
        "assetDir": asset_dir,
        "bbox": mesh.bbox,
        "parts": parts,
        "attachments": attachments,
        "images": images,
        "liveries": liveries(dir),
    }))
}

/// Writes `base` plus every part of `import` (moved by the column-major `matrix`) to `target`, a new `.im` beside
/// `base`. The import's textures are copied next to it; clashing material names and texture files get a prefix.
#[tauri::command(async)]
fn export_merged(
    base: PathBuf,
    import: PathBuf,
    matrix: [f32; 16],
    target: PathBuf,
) -> Result<Value, String> {
    let dir = base.parent().ok_or("the opened mesh has no folder")?;
    if target.parent() != Some(dir) {
        return Err("save the merged mesh in the same folder as the opened mesh, so its textures still resolve".into());
    }
    if !target
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("im"))
    {
        return Err("the merged file must end in .im".into());
    }
    let read = |p: &Path| std::fs::read(p).map_err(|e| format!("{}: {e}", p.display()));
    let mut merged = ImFile::parse(&read(&base)?).map_err(|e| e.to_string())?;
    let extra = ImFile::parse(&read(&import)?).map_err(|e| e.to_string())?;
    if extra.is_animated() {
        return Err("the imported mesh is animated; only static meshes can be merged".into());
    }
    let src = import.parent().ok_or("the imported mesh has no folder")?;
    let stem = import.file_stem().unwrap_or_default().to_string_lossy();
    let mut prefix: String = stem
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if prefix.is_empty() {
        prefix = "import".into();
    }
    prefix.push('_');

    let mut taken: HashSet<String> = merged
        .parts()
        .map(|p| text(&p.material).to_lowercase())
        .collect();
    let mut brought: HashMap<String, String> = HashMap::new(); // texture reference -> name stored in the merge
    let mut copied = Vec::new();
    let mut parts = Vec::new();
    for part in extra.parts() {
        let mut part = part.clone();
        part.transform(&matrix).map_err(|e| e.to_string())?;
        let original = text(&part.material);
        let (mut name, mut n) = (original.clone(), 1);
        while taken.contains(&name.to_lowercase()) {
            name = if n == 1 {
                format!("{prefix}{original}")
            } else {
                format!("{prefix}{n}_{original}")
            };
            n += 1;
        }
        taken.insert(name.to_lowercase());
        part.material = padded(&name);
        for t in &mut part.textures {
            let reference = text(&t.path);
            let stored = match brought.get(&reference) {
                Some(s) => s.clone(),
                None => {
                    let s = bring_texture(src, dir, &reference, &prefix, &mut copied)?;
                    brought.insert(reference, s.clone());
                    s
                }
            };
            t.path = padded(&stored);
        }
        parts.push(part);
    }
    merged.append_parts(parts).map_err(|e| e.to_string())?;
    let bytes = merged.to_bytes();
    // Never leave a file behind that TrainzLook itself can't read back.
    parse_im(&bytes)
        .map_err(|e| format!("internal error, the merged mesh does not re-read: {e}"))?;

    let name = target.file_name().unwrap().to_string_lossy().into_owned();
    let mut backup = None;
    if target.is_file() {
        let backups = dir.join(BACKUP_DIR);
        std::fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
        let b = backups.join(format!("{}-{name}", now_ms()));
        std::fs::copy(&target, &b).map_err(|e| format!("backup failed, nothing written: {e}"))?;
        backup = Some(b);
    }
    let tmp = target.with_extension("trainzlook-tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| format!("cannot write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, &target)
        .map_err(|e| format!("cannot write {}: {e}", target.display()))?;
    Ok(
        json!({ "path": target, "copied": copied, "backup": backup, "parts": merged.parts().count() }),
    )
}

/// Brings the `.texture.txt` behind `reference`, and the images it names, from `src` into `dst`, returning the
/// reference to store. Identical files already in `dst` are shared, new names are copied as they are, and on a name
/// clash the copies are prefixed.
fn bring_texture(
    src: &Path,
    dst: &Path,
    reference: &str,
    prefix: &str,
    copied: &mut Vec<String>,
) -> Result<String, String> {
    let name = reference
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(reference)
        .to_string();
    let Ok(txt) = std::fs::read(texture_txt_path(src, &name)) else {
        // Nothing to bring; the prefix keeps it from silently using the base mesh's texture of the same name.
        return Ok(format!("{prefix}{name}"));
    };
    let content = String::from_utf8_lossy(&txt).into_owned();
    // shortcut: only images in the same folder as the .texture.txt are copied; sub-folder paths are left unresolved.
    let mut files: Vec<String> = parse_texture_txt(&content)
        .into_values()
        .filter(|v| !v.contains(['\\', '/']) && src.join(v).is_file())
        .collect();
    files.sort();
    files.dedup();
    let same = |f: &str| std::fs::read(dst.join(f)).ok() == std::fs::read(src.join(f)).ok();
    let txt_in_dst = std::fs::read(texture_txt_path(dst, &name)).ok();
    if txt_in_dst.as_deref() == Some(&txt[..]) && files.iter().all(|f| same(f)) {
        return Ok(name);
    }
    // Keep the original names when nothing of that name is in `dst` yet; prefix only on a clash.
    let free = txt_in_dst.is_none() && files.iter().all(|f| !dst.join(f).exists());
    let prefix = if free { "" } else { prefix };
    let renamed: String = content
        .split_inclusive('\n')
        .map(|line| match line.split_once('=') {
            Some((key, value)) if files.iter().any(|f| f == value.trim()) => {
                let ending = &line[line.trim_end_matches(['\r', '\n']).len()..];
                format!("{key}={prefix}{}{ending}", value.trim())
            }
            _ => line.to_string(),
        })
        .collect();
    let stored = format!("{prefix}{name}");
    write_new(&texture_txt_path(dst, &stored), renamed.as_bytes(), copied)?;
    for f in &files {
        let data = std::fs::read(src.join(f)).map_err(|e| format!("{f}: {e}"))?;
        write_new(&dst.join(format!("{prefix}{f}")), &data, copied)?;
    }
    Ok(stored)
}

/// Writes a new file; an identical existing one is fine, a different one is never overwritten.
fn write_new(path: &Path, data: &[u8], copied: &mut Vec<String>) -> Result<(), String> {
    match std::fs::read(path) {
        Ok(existing) if existing == data => Ok(()),
        Ok(_) => Err(format!(
            "{} already exists with different content; move it away first",
            path.display()
        )),
        Err(_) => {
            std::fs::write(path, data)
                .map_err(|e| format!("cannot write {}: {e}", path.display()))?;
            copied.push(
                path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
            );
            Ok(())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Opened::default())
        .manage(Imported::default())
        .invoke_handler(tauri::generate_handler![
            launch_path,
            open_mesh,
            replace_texture,
            revert_texture,
            edit_texture,
            open_link,
            save_livery,
            apply_livery,
            decode_image,
            write_export,
            import_mesh,
            export_merged
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{backup_stamp, bring_texture, livery_name, next_batch, open_link, reg_default};

    #[test]
    fn opens_only_the_bantuan_links() {
        for url in [
            "https://example.com",
            "file:///C:/Windows/System32/calc.exe",
            "C:\\Windows\\notepad.exe",
            "",
        ] {
            assert!(open_link(url.into()).is_err(), "{url:?} must be refused");
        }
    }

    #[test]
    fn one_save_is_one_reload() {
        let (tx, rx) = std::sync::mpsc::channel();
        let quiet = std::time::Duration::from_millis(50);
        for p in ["a.jpg", "a.jpg", "b.tga", "a.jpg"] {
            tx.send(std::path::PathBuf::from(p)).unwrap();
        }
        let batch = next_batch(&rx, quiet).unwrap();
        assert_eq!(
            batch.len(),
            2,
            "repeated writes of a file merge into one event"
        );
        tx.send("c.png".into()).unwrap();
        assert_eq!(
            next_batch(&rx, quiet).unwrap().len(),
            1,
            "a later save is its own batch"
        );
        drop(tx);
        assert!(
            next_batch(&rx, quiet).is_none(),
            "the thread stops once the watcher is gone"
        );
    }

    #[test]
    fn livery_names_are_single_safe_folder_names() {
        assert_eq!(livery_name("  KAI 2024 "), Ok("KAI 2024"));
        for bad in [
            "",
            "   ",
            "..",
            "a/b",
            r"a\b",
            "x:y",
            "what?",
            "ends.",
            &"x".repeat(65),
        ] {
            assert!(livery_name(bad).is_err(), "{bad:?} should be refused");
        }
    }
    use std::fs;

    #[test]
    fn reads_the_default_value_of_reg_query() {
        let out = "\r\nHKEY_LOCAL_MACHINE\\...\\Photoshop.exe\r\n    (Default)    REG_SZ    C:\\Program Files\\Adobe\\Photoshop.exe\r\n\r\n";
        assert_eq!(
            reg_default(out),
            Some(r"C:\Program Files\Adobe\Photoshop.exe")
        );
        assert_eq!(
            reg_default("    (Default)    REG_SZ    \"C:\\a b\\x.exe\"\r\n"),
            Some(r"C:\a b\x.exe")
        );
        assert_eq!(reg_default("    (Default)    REG_SZ    \r\n"), None); // key exists, value empty
        assert_eq!(
            reg_default("ERROR: The system was unable to find the specified registry key"),
            None
        );
    }

    #[test]
    fn brings_textures_shared_when_identical_and_prefixed_when_not() {
        let root = std::env::temp_dir().join(format!("trainzlook-bring-{}", std::process::id()));
        let (src, dst) = (root.join("kursi"), root.join("interior"));
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(&dst).unwrap();
        fs::write(
            src.join("2.texture.txt"),
            "Primary=2.jpg\r\nAlpha=2.jpg\r\nTile=st\r\n",
        )
        .unwrap();
        fs::write(src.join("2.jpg"), "seat").unwrap();
        fs::write(src.join("3.texture.txt"), "Primary=3.jpg\n").unwrap();
        fs::write(src.join("3.jpg"), "same").unwrap();
        fs::write(
            dst.join("2.texture.txt"),
            "Primary=2.jpg\r\nAlpha=2.jpg\r\nTile=st\r\n",
        )
        .unwrap();
        fs::write(dst.join("2.jpg"), "wall").unwrap(); // same name, different picture
        fs::write(dst.join("3.texture.txt"), "Primary=3.jpg\n").unwrap();
        fs::write(dst.join("3.jpg"), "same").unwrap();

        let mut copied = Vec::new();
        let author_path = r"E:\Games\Trainz\editing\kursi\2.texture";
        assert_eq!(
            bring_texture(&src, &dst, author_path, "kursi_", &mut copied).unwrap(),
            "kursi_2.texture"
        );
        assert_eq!(
            fs::read_to_string(dst.join("kursi_2.texture.txt")).unwrap(),
            "Primary=kursi_2.jpg\r\nAlpha=kursi_2.jpg\r\nTile=st\r\n"
        );
        assert_eq!(fs::read_to_string(dst.join("kursi_2.jpg")).unwrap(), "seat");
        assert_eq!(
            fs::read_to_string(dst.join("2.jpg")).unwrap(),
            "wall",
            "the interior's own texture is untouched"
        );
        assert_eq!(
            bring_texture(&src, &dst, "3.texture", "kursi_", &mut copied).unwrap(),
            "3.texture",
            "identical files are shared"
        );
        assert_eq!(copied, ["kursi_2.texture.txt", "kursi_2.jpg"]);
        assert_eq!(
            bring_texture(&src, &dst, "9.texture", "kursi_", &mut copied).unwrap(),
            "kursi_9.texture",
            "missing stays missing, never borrows the interior's"
        );
        fs::write(src.join("seat.texture.txt"), "Primary=seat.tga\n").unwrap();
        fs::write(src.join("seat.tga"), "new").unwrap();
        assert_eq!(
            bring_texture(&src, &dst, "seat.texture", "kursi_", &mut copied).unwrap(),
            "seat.texture",
            "no clash, no prefix"
        );
        assert_eq!(
            fs::read_to_string(dst.join("seat.texture.txt")).unwrap(),
            "Primary=seat.tga\n"
        );
        assert_eq!(copied[2..], ["seat.texture.txt", "seat.tga"]);

        fs::write(dst.join("kursi_2.jpg"), "someone else's").unwrap();
        fs::write(src.join("2.jpg"), "seat v2").unwrap();
        assert!(
            bring_texture(&src, &dst, "2.texture", "kursi_", &mut Vec::new()).is_err(),
            "never overwrites a different file"
        );
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn matches_only_backups_of_that_file() {
        assert_eq!(
            backup_stamp("1792511951-mc.jpg", "mc.jpg"),
            Some(1792511951)
        );
        assert_eq!(
            backup_stamp("1792511951123-MC.JPG", "mc.jpg"),
            Some(1792511951123)
        );
        assert_eq!(backup_stamp("17-rtm-0001.jpg", "rtm-0001.jpg"), Some(17));
        assert_eq!(backup_stamp("17-rtm-0001.jpg", "0001.jpg"), None);
        assert_eq!(backup_stamp("17-mc.jpg.undone", "mc.jpg"), None);
        assert_eq!(backup_stamp("notes-mc.jpg", "mc.jpg"), None);
        assert_eq!(backup_stamp("mc.jpg", "mc.jpg"), None);
    }
}
