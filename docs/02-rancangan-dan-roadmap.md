# TrainzLook — Analisis Rancangan, Rekomendasi & Roadmap

Dasar: laporan RE di [01-reverse-engineering.md](01-reverse-engineering.md).

---

## 1. Analisis rancangan Anda

Rancangan inti: **viewer mesh Trainz bergaya Blender + panel daftar tekstur dari folder `.im` + upload/replace tekstur yang langsung terlihat (realtime).**

Penilaian:

| Aspek | Penilaian |
|---|---|
| Kebutuhan pasar | **Kuat.** Pembuat repaint/livery (komunitas Indonesia: KRL, KAI, Indorails dll) saat ini harus: edit di Photoshop → simpan → tutup-buka Mesh Viewer atau commit ke CM → buka Trainz. Siklus ini menit-an; TrainzLook bisa membuatnya < 1 detik. |
| Kelayakan teknis | **Tinggi.** Format `.im` sudah terpetakan dan terverifikasi (43 file, 272 sub-mesh). Tekstur di sampel adalah JPG biasa via `.texture.txt` — mudah di-hot-swap. |
| Pembeda dari Mesh Viewer | Hot reload, replace + backup/undo, UI modern, preview livery, UV template. Mesh Viewer tidak punya file watcher sama sekali. |
| Risiko terbesar | Format terkompilasi TANE/TRS (`.texture` biner, mesh baru TRS22) dan aset yang masih di dalam database Content Manager. Lihat §7. |

Yang perlu dipertajam dari rancangan:

1. **"Upload texture" sebaiknya 2 mode:** *Preview* (hanya di memori, file asli tidak disentuh) dan *Apply* (tulis ke disk + backup otomatis). Repainter sering ingin membandingkan dulu.
2. **Daftar tekstur harus berbasis material, bukan sekadar isi folder.** Satu file bisa dipakai beberapa material (`stk.jpg`), dan ada file yang tidak dipakai (`10.jpg`). Tampilkan status: *used / shared / unused / missing / non-power-of-two*.
3. **Watch folder** untuk edit eksternal: saat Photoshop/GIMP menyimpan `4_a.jpg`, viewport langsung update tanpa klik apa pun. Ini fitur "wow" yang paling terasa.
4. **Rantai `.texture.txt`:** replace yang mengganti format (mis. PNG → JPG) harus memperbarui `Primary=` atau mengonversi ke format/nama asli. Default yang aman: **konversi ke nama & format asli**.

## 2. Rekomendasi stack teknologi

**Rekomendasi: Tauri 2 (Rust) + React + TypeScript + three.js**

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Shell desktop | Tauri 2 (WebView2) | Installer ~10 MB (Electron ~150 MB), akses file & watcher native, cocok untuk dijual |
| Inti format | Rust crate `trainz-formats` | Parser `.im`, `.texture.txt`, `config.txt`, nanti `.texture` TANE/DXT. Bisa di-unit-test terhadap korpus, dan dipakai ulang untuk CLI |
| File watcher | crate `notify` + debounce | Native `ReadDirectoryChangesW`, tahan pola "simpan ke temp lalu rename" ala Photoshop |
| Decode gambar | Browser (`createImageBitmap`) untuk JPG/PNG; Rust (`image`, `texpresso`/`bcdec`) untuk TGA/BMP/DDS/.texture | Decode di luar main thread → UI tidak tersendat walau 2048² |
| Viewport | three.js (WebGL2) | Hot-swap tekstur cukup `texture.image = bmp; texture.needsUpdate = true`; dukung S3TC/DXT; ekosistem besar (OrbitControls, TransformControls, TGALoader, DDSLoader) |
| UI | React + docking (`dockview` atau `flexlayout-react`) + tema CSS gaya Blender | Panel bisa di-split/drag seperti Blender |
| State | Zustand + undo stack sendiri | Ringan, mudah untuk undo/redo |

Alternatif yang dipertimbangkan: **C++ + Dear ImGui (docking) + OpenGL** — paling "Blender" dan paling cepat, tapi pengembangan UI (dialog, drag-drop, thumbnail grid, i18n) jauh lebih lambat untuk satu developer. Bisa dipertimbangkan ulang hanya jika performa WebGL terbukti kurang (kecil kemungkinannya: sampel 40 ribu vertex).

## 3. Arsitektur

```
┌──────────────────────── Frontend (React/TS, WebView2) ────────────────────────┐
│  UI Shell (docking)  ─  Outliner  ─  Properties  ─  Texture Browser  ─  Info  │
│                │                                                             │
│  Scene Store (Zustand) ── Undo/Redo ── Texture Registry (path → GPU texture)  │
│                │                                                             │
│  Viewport (three.js): kamera Blender, shading modes, overlay, picking        │
└────────────────┬───────────────────────────────▲─────────────────────────────┘
       invoke()  │                               │ events: texture-changed,
                 ▼                               │         mesh-changed
┌──────────────────────── Backend (Rust, Tauri) ─┴──────────────────────────────┐
│  trainz-formats: im::parse, texture_txt, config_txt(ACS), tex_tane, dxt      │
│  asset_index: scan folder / kuid → path                                      │
│  watcher: notify + debounce (150 ms) + hash cek                              │
│  texture_ops: validate, convert, backup, atomic write                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Pipeline tekstur realtime

1. Buka `body.im` → Rust parse → kirim geometri sebagai buffer biner (`Float32Array`/`Uint16Array`, bukan JSON).
2. Untuk tiap MATL: basename referensi → `<nama>.texture.txt` → `Primary=`/`Alpha=` → path gambar. Registry dedup per path (satu GPU texture untuk `stk.jpg`).
3. Watcher aktif di folder mesh. File berubah → debounce → cek hash → event `texture-changed`.
4. Frontend: load ulang lewat asset protocol `convertFileSrc(path) + '?v=' + mtime` → `createImageBitmap` → tukar `texture.image` → semua material yang memakai ikut update. Target latensi < 300 ms untuk 2048² JPG.
5. **Replace (drag-drop / tombol):**
   - Validasi: power-of-two, ukuran maks, ada/tidaknya alpha dibandingkan asli, rasio aspek.
   - Mode *Preview*: hanya override di registry (badge "PREVIEW").
   - Mode *Apply*: backup asli ke `.trainzlook/backup/<waktu>/`, konversi ke nama+format asli, tulis atomik (tulis temp → rename). Masuk undo stack.
   - Revert: kembalikan dari backup.

## 4. Desain UI gaya Blender

```
┌ Top bar: File Edit View Help │ Workspace: [Layout] [Texture Paint] [Traincar] [Inspect] ─────────┐
├──────────────┬──────────────────────────────────────────────────────┬───────────────────────────┤
│ OUTLINER     │ 3D VIEWPORT                                          │ PROPERTIES                │
│ ▾ body.im    │ [Solid][Material][Wire][UV Checker]  Overlays ▾      │ [Obj][Material][Texture]  │
│   ▸ 1.m.onetex│                                                     │ Material: 4.m.onetex      │
│   ▸ 2.m.onetex│              (model kereta)                 ⊕ gizmo │  Tipe: onetex             │
│   ▸ ...      │                                                      │  Tekstur: 4_a.jpg 2048²   │
│ ▾ Attachments│                                                      │  Tile: st   Hint: dynamic │
│   a.bog0 ... │                                                      │  [Replace] [Revert]       │
├──────────────┴──────────────────────────────────────────────────────┴───────────────────────────┤
│ TEXTURE BROWSER  [Search] [Used|Unused|Missing]                                                  │
│ [mc.jpg ●] [2.jpg ●] [4_a.jpg ●] [5_a.jpg ●] [stk.jpg ●×2] [7.jpg ●] [8_a.jpg ●] [9.jpg ●] [10.jpg ○]│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Status: 40.792 vert · 31.956 tri · 9 material · 8 tekstur (~170 MB VRAM) · 60 fps · watch: ON     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Detail gaya Blender:
- Tema gelap Blender (latar `#303030`, panel `#3d3d3d`, aksen biru `#4772b3`, oranye seleksi `#ff9a00`), font kecil 11–12 px, header area dengan dropdown tipe editor.
- Area bisa di-split / di-resize / di-swap; tata letak disimpan per workspace.
- Navigasi: MMB orbit, Shift+MMB pan, scroll zoom, Numpad 1/3/7 (+Ctrl), `.` numpad frame selected, Home view all, `Z` pie shading, `N` sidebar, `T` toolbar; opsi *Emulate 3 Button Mouse* (Alt+LMB) untuk laptop.
- Hover thumbnail tekstur → bagian mesh yang memakainya disorot di viewport (versi modern fitur "locate texture" Mesh Viewer).
- Klik permukaan di viewport → material & tekstur terpilih di Properties/Texture Browser.

## 5. Daftar fitur (prioritas)

**MVP (harus ada untuk rilis pertama)**
1. Buka `.im` (drag-drop, menu, argumen command line, file association).
2. Render tekstur `onetex`/`notex` dengan alpha (test + blend sort).
3. Outliner sub-mesh/material + attachments.
4. Texture Browser + status used/shared/unused/missing.
5. Hot reload otomatis dari folder.
6. Replace Preview/Apply + backup + undo/revert.
7. Shading Solid/Material/Wireframe, grid, statistik.

**V1.x**
8. Material lengkap: `reflect, gloss, tbumptex, tbumpgloss, tbumpenv` (normal map pakai tangen dari GEOM).
9. TGA/BMP/DDS dan `.texture` TANE (DXT1/3/5).
10. Mode traincar: `config.txt`, bogey via kuid, rel & ground.
11. **UV template export** (PNG overlay UV per material — sangat berguna untuk painter).
12. Livery preset: simpan set override sebagai preset, ganti cepat, bandingkan side-by-side.
13. Screenshot/thumbnail generator (`$screenshot$.jpg` 240×180, `ss.jpg` 512×512).

**Nanti**
14. Animasi `.kin`, mesh skinned (`SKEL/INFL`), LOD `.lm.txt`, `.pm` lama.
15. Integrasi Content Manager: "Open With" dari CM, commit via TrainzUtil.
16. Edit properti material & tulis ulang `.im` (risiko tinggi, butuh writer yang terverifikasi bit-per-bit).

## 6. Roadmap

Asumsi: 1 developer penuh waktu. Estimasi dalam minggu.

| Fase | Durasi | Isi | Kriteria selesai |
|---|---|---|---|
| **0. Riset & spike** | ✅ sebagian (1 mgg) | Spesifikasi `.im` terverifikasi, spike `im2obj` + preview three.js sukses render `body.im` | Sisa: kumpulkan korpus uji (PM, `.texture` TANE, mesh skinned, aset TRS22) |
| **1. Core parser (Rust)** | 2 mgg — 🟡 `.im` baca **dan tulis** (lossless, round-trip byte-identik 44/44 korpus), `.texture.txt`, `im-inspect`; `config.txt` & export glTF belum | crate `trainz-formats`: `.im` (semua varian GEOM), MATL, ATCH, `.texture.txt`, parser `config.txt` (ACS); CLI `trainzlook inspect` / `export gltf` | 100% korpus lolos `im_survey`; output glTF identik dengan spike |
| **2. App shell + viewport** | 3 mgg — 🟡 app Tauri jalan: buka `.im`, viewport, outliner, texture browser, sumbu + gizmo navigasi, installer NSIS; docking panel belum | Proyek Tauri, tema Blender, docking, buka file, render, kamera Blender, outliner, status bar | Buka `body.im` < 1 s, 60 fps, navigasi setara Blender |
| **3. Texture Manager realtime** | 2 mgg — ✅ hot reload, Replace (dialog/drag-drop, konversi JPG/PNG/TGA/BMP, backup), Revert + Ctrl+Z, highlight tekstur↔mesh, panel validasi; mode Preview belum | Texture Browser, watcher, hot reload, Replace Preview/Apply, backup, undo, validasi | Simpan dari Photoshop → viewport update < 300 ms; revert selalu memulihkan file asli |
| **4. Fidelity material** | 3 mgg | Shader semua tipe `m.*`, alpha terpisah, normal/env map, TGA/BMP/DDS, `.texture` TANE | Visual sebanding Mesh Viewer pada korpus |
| **5. Mode traincar** | 3 mgg | `config.txt`, indeks kuid (scan folder), bogey + `reversed`, attachments, rel/ground/sky | TKK-8500 tampil lengkap dengan bogey `<kuid:1047762:100148>` |
| **6. Fitur repainter** | 2 mgg — 🟡 UV template, thumbnail `ss.jpg`/`$screenshot$`, merge `.im` (import + gizmo Move/Rotate/Scale + undo), compare Before/After (tahan B), livery preset (`.trainzlook-livery`) selesai | UV template export, livery preset, compare, screenshot/thumbnail | Alur repaint lengkap tanpa membuka Trainz |
| **7. Rilis** | 2 mgg — 🟡 installer NSIS (lisensi + publisher INDORAILS), file association `.im` (double-click / Open with) selesai | Installer (MSI/NSIS), auto-update, file association, CM "Open With", lisensi (jika dijual), crash report, dokumentasi ID/EN | Beta publik |

Total ±17–18 minggu ke beta. **MVP yang bisa dipakai (Fase 1–3) ±7 minggu.**

## 7. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| `.texture` TANE & mesh TRS22 tidak terdokumentasi | Aset modern tak bisa dibuka | Kumpulkan sampel dari CM ("Open for edit"/export); RE lanjutan dengan REA + Ghidra (`rea decompile` pada ~0x4944C9) |
| Aset ada di database CM, bukan di folder | User bingung "file tidak ada" | Fase 7: integrasi "Open for edit" / TrainzUtil; sementara dokumentasikan alur edit folder |
| Payware/DRM | Masalah hukum & reputasi | Hanya baca file yang sudah terbuka di disk; tidak menyentuh arsip terenkripsi; tidak ada fitur "ekstrak/redistribusi" |
| Replace merusak file asli | Kehilangan kerja user | Backup wajib, tulis atomik, undo, tombol Revert |
| Tekstur non-POT / terlalu besar | Tampil di TrainzLook tapi rusak di Trainz | Validasi + peringatan sesuai batas versi Trainz |

## 8. Keputusan yang perlu Anda ambil

1. **Stack:** setuju Tauri + React + three.js? (alternatif: C++/ImGui).
2. **Model bisnis:** gratis, freemium (MVP gratis, fitur repainter berbayar), atau berbayar penuh — mempengaruhi sistem lisensi di Fase 7.
3. **Target versi Trainz:** TS2009–TRS2022 semuanya, atau fokus TANE/TRS19/TRS22 dulu?
4. **Bahasa UI:** Indonesia + Inggris sejak awal?

## 9. Langkah berikutnya yang disarankan

1. Inisialisasi repo git + kerangka proyek Tauri (Fase 1–2 bisa paralel: crate parser & app shell).
2. Port `research/im-format/im2obj.py` ke Rust sebagai `trainz-formats::im` + test terhadap korpus.
3. Kumpulkan 5–10 sampel `.texture` biner TANE dan satu aset TRS22 untuk riset format berikutnya.
