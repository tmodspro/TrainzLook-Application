# TrainzLook — Laporan Reverse Engineering

Tanggal: 2026-10-20
Target: PEVSoft Trainz Mesh Viewer v2.29 (`C:\Trainz Tools\Mesh Viewer2`)
Sampel: `TKK-8500 Trainset - PLUS\kuid 1047762 100158 IR - T-VVVF-8500 K1\body\body.im`
Tool: REA `rea-agents` 6.7.0 (CLI via npx) + analisis PE/strings + analisis biner file `.im` (Python/numpy)

---

## 1. Ringkasan

| Hal | Temuan |
|---|---|
| Bahasa / compiler | **Delphi** (Borland linker 2.25, section `CODE/DATA/BSS`, timestamp Delphi 1992), 32-bit x86 |
| Renderer | **OpenGL 1.x fixed-function** + **GLSL 1.10** (ekstensi dimuat via `wglGetProcAddress`), basis kode "Sulaco GPL rendering code for Delphi" |
| Upload tekstur | `gluBuild2DMipmaps` (decode di CPU, upload ulang penuh) |
| Format mesh | `.im` (chunk `JIRF/IDXM`) dan `.pm` (lama) |
| Format tekstur | `.texture.txt` → TGA / BMP / JPG; `.texture` biner TANE (rgba, dxt1, dxt3, dxt5, mip; cube map & multi-slice **tidak** didukung) |
| Mode traincar | Membaca `config.txt` → `mesh-table`, `bogeys`, `attachment`, plus tabel kuid usang di `Mesh_Viewer.ini` |
| Realtime reload | **Tidak ada.** Tidak ada import `FindFirstChangeNotification` / `ReadDirectoryChangesW`; tekstur hanya dimuat sekali saat file dibuka |

Kesimpulan: kelemahan utama Mesh Viewer adalah arsitektur lama (immediate mode, single-load, UI VCL standar). Itu celah yang diisi TrainzLook.

## 2. Hasil REA

- `rea providers` — di host Windows ini yang tersedia: `rea-artifact-graph`, `rea-dotnet-static`, `sqlite`. Provider native (Ghidra/IDA/Hopper) **tidak terpasang**, jadi dekompilasi fungsi belum dilakukan.
- `rea inspect-artifact Mesh_Viewer.exe` — format `pe`, sha256 `f26f4626…d557912`, **tidak ada container/payload tertanam** (tidak di-pack, tidak ada resource tambahan yang bisa diekstrak).
- Untuk lanjut ke level dekompilasi (opsional, mis. untuk format `.pm` atau `.texture` TANE): pasang **Ghidra 11.x + JDK 21**, jalankan `npx rea-agents setup` (daftarkan MCP), lalu `rea decompile <exe> <alamat> --provider ghidra`.

### Peta alamat penting (VA = file offset + 0x400C00, image base 0x400000)

| Area | VA perkiraan | Petunjuk |
|---|---|---|
| Dispatcher chunk `.im` (unit `Unit3DS3`) | ~0x495A2E | `cmp` dengan `'INFO' 'CHNK' 'MATL' 'SKEL' 'INFL' 'ATCH' 'PMIN' 'NINF' 'BONE'` |
| Loader `.texture` TANE | ~0x4944C9 | tag `JIRF`, `MMTF`, `INFO`, `MMAP` |
| Decoder DXT / tipe tekstur | ~0x493209 | string `rgba dxt1 dxt3 dxt5`, `Mip Skip`, `cube tex NOT supported` |
| Pemilihan material & loader tekstur | ~0x497A58 | `m.notex m.onetex m.reflect m.gloss m.tbumptex m.tbumpgloss m.tbumpenv`, `primary=` `alpha=` |
| Binding shader / uniform | ~0x49A609 | `colourMap reflectMap normalMap hasnormalalpha diffuse speccolor opacity` |

## 3. Perilaku Mesh Viewer yang perlu ditiru

1. **Resolusi tekstur:** MATL menyimpan path **absolut milik pembuat** (contoh: `E:\Games\Trainz Railroad Simulator 2022\editing\...\New folder\mc.texture`). Viewer membuang folder, ambil basename `mc.texture`, lalu cari `mc.texture.txt` di folder mesh → baca `Primary=` (dan `Alpha=`) → buka gambar.
2. **Tipe material dari nama:** `<nama>.m.<tipe>`. Tipe yang dikenal: `notex, onetex, reflect, gloss, tbumptex, tbumpgloss, tbumpenv`.
3. **Pencahayaan sederhana** (dari shader GLSL di exe): lampu tetap `normalize(1,-20,30)`, wrap lighting `dot*0.25+0.75` di-clamp `[0.75,1]`, specular `spec² * 0.3`. Reflection memakai sphere-map (`sky.jpg`).
4. **Alpha:** alpha test + alpha sorting (sejak v2.10), alpha terpisah via `Alpha=` di `.texture.txt`.
5. **Traincar:** `config.txt` → `mesh-table` (`default` + sub-mesh), `bogeys` dengan `reversed`, attachment `a.bog0/a.bog1`, rel & ground (`BallastTexture.jpg`, `GroundTexture.jpg`, `sky.jpg`), lebar sepur dan jarak bantalan dari INI.
6. **Fitur kecil:** thumbnail 240×180 (`$screenshot$.jpg`), warna background, wireframe, tampil attachment (tripod), hitung polygon, "locate texture", deteksi tekstur duplikat.

## 4. Spesifikasi format `.im` (hasil verifikasi)

Semua little-endian. Diverifikasi pada **43 file `.im` / 272 chunk GEOM** di `C:\Tempat Kerja\Indorails` — semua ukuran chunk cocok dengan rumus di bawah.

### 4.1 Header & chunk

```
"JIRF"  u32 size(=filesize-8)  "IDXM"
lalu deretan chunk: tag[4]  u32 size  payload[size]   (payload diawali u32 version)
```

Chunk level atas yang ditemukan: `INFO v104`, `CHNK v100` (×N), `SKEL v100` (opsional), `INFL v100`, `ATCH v100` (opsional).

### 4.2 INFO (v104)

| Offset payload | Isi |
|---|---|
| 0x00 | u32 version = 104 |
| 0x04–0x1C | kemungkinan quaternion (x,y,z,w) + posisi; selalu (0,0,0,1) + (0,0,0) di 44/44 file korpus, jadi vertex sudah di posisi akhir |
| 0x20 | u32 jumlah CHNK |
| 0x2C | float3 bbox min |
| 0x38 | float3 bbox max |

Sampel: bbox (-1.47, -10.05, 0) – (1.46, 10.33, 4.01) → **Z = atas, Y = panjang kereta**, satuan meter.

### 4.3 CHNK (v100) = satu sub-mesh per material

```
u32 version(100)  u32 chunkIndex
  MATL ...
  GEOM ...
```

### 4.4 MATL (v103)

```
u32 version (103)
u32 nameLen, char name[nameLen]          ; mis. "1.m.onetex\0\0" (dipadding)
16 x u32/f32 tetap (semantik belum pasti), contoh sampel:
  0, 1, 1.0 x7, 0.5 x3, 0.0 x3          ; flag, warna ambient/diffuse/specular/emissive
  (word ke-16 = shininess, 64 atau 32)
u32 textureCount                         ; 0 untuk m.notex
  per tekstur: u32 slot (=1, diffuse), u32 len, char path[len], f32 amount(=1.0)
```

Koreksi 2026-10-20: versi awal dokumen ini menulis 17 word tetap tanpa `slot`. Hasilnya kebetulan sama pada sampel TKK-8500 (slot = count = 1), tapi salah untuk material `m.notex`. Ketahuan saat parser Rust dijalankan pada seluruh korpus.

Sampel (9 material, semua `m.onetex`):

| Material | Referensi | File gambar | Resolusi |
|---|---|---|---|
| 1.m.onetex | mc.texture | mc.jpg | 2048² |
| 2.m.onetex | 2.texture | 2.jpg | 2048² |
| 4.m.onetex | 4_a.texture | 4_a.jpg | 2048² |
| 5.m.onetex | 5_a.texture | 5_a.jpg | 2048² |
| kacafrm.m.onetex | stk.texture | stk.jpg | 2048² |
| 7.m.onetex | 7.texture | 7.jpg | 2048² |
| 8.m.onetex | 8_a.texture | 8_a.jpg | 2048² |
| 9.m.onetex | 9.texture | 9.jpg | 2048² |
| stk.m.onetex | stk.texture | stk.jpg | 2048² |

Catatan: **`10.jpg` ada di folder tetapi tidak dipakai mesh mana pun**, dan `stk.jpg` dipakai 2 material. UI TrainzLook harus menampilkan status *unused* dan *shared*.

### 4.5 GEOM (v201)

Header 40 byte:

```
u32 version (201)
u32 4                ; konstan (format/stride id)
u32 hasTangents      ; 1 = ada array tangen, 0 = tidak
f32 surfaceArea      ; total triangle area (m²); verified exact on 272/272 corpus chunks (earlier misread as a radius)
u32 vertexCount  (nv)
u32 triangleCount (nt)
u32 indexCount   (ni = nt*3)
u32 triangleCount (lagi)
u32 skinInfo         ; >0 pada mesh skinned (masinis.im, csot.im) – tidak menambah byte
u32 boneNameLen      ; >0 → mesh menempel ke bone, mis. "b.r.body1"
```

Payload setelah header (berurutan):

| Blok | Ukuran | Isi |
|---|---|---|
| boneName | boneNameLen | ASCII, mis. `b.r.main.002` |
| vertices | nv × 20 | `float3 position, float2 uv` |
| indices | ni × 2 | `u16`, segitiga CCW |
| vertexNormals | nv × 12 | `float3` (dot dengan face normal ≈ 0.99) |
| faceNormals | nt × 12 | `float3` per segitiga (dot = 1.000) |
| tangents | nv × 12 | **hanya jika hasTangents=1**; tegak lurus normal, arah −dP/du |

Rumus ukuran: `40 + boneNameLen + nv*20 + ni*2 + nv*12 + nt*12 + (hasTangents ? nv*12 : 0)` — cocok 272/272 chunk.

UV: konvensi **DirectX — v=0 di baris atas gambar**. Di three.js berarti `texture.flipY = false`. Dibandingkan langsung dengan PEV Mesh Viewer pada TKK-8500: dengan `flipY = true` body tampil hitam bergaris, dengan `false` silver + strip merah-kuning sesuai aslinya. (Koreksi 2026-10-20: versi awal dokumen ini salah menyimpulkan OpenGL dari spike.)

### 4.6 ATCH (v100)

```
u32 version, u32 count
per attachment: u32 len, char name[len], f32[12]  (matriks rotasi 3x3 + posisi xyz)
```

Sampel: `a.bog0 (0,-6.838,0)`, `a.bog1 (0,6.951,0)`, `a.limfront`, `a.limback`, `a.load0`, `a.cabfront`, `a.cabback`.

### 4.7 Menulis `.im` (dipakai fitur merge)

- **String** (nama material, path tekstur, nama bone) dipadding NUL ke kelipatan 4, **tanpa terminator wajib**: `RubyTMIX_Output\rtm_0001.texture` (32 karakter) disimpan tepat 32 byte.
- **Nomor CHNK** berurutan 0..n-1; **INFO +0x20** = jumlah CHNK; bbox INFO mencakup semua vertex.
- Writer TrainzLook (`crates/trainz-formats/src/im.rs`) menyimpan semua byte yang tidak diubah apa adanya; `im-inspect` memverifikasi round-trip byte-identik pada seluruh korpus (43/43).
- File hasil merge terbaca oleh PEV Mesh Viewer.

### 4.8 Belum dipetakan

- `SKEL`, `INFL` detail (skinning, 12 file), file `.kin` (animasi, 13 file lokal).
- `.texture` biner TANE (`JIRF … MMTF/INFO/MMAP`, dxt1/3/5) — **tidak ada sampel lokal**; butuh contoh hasil compile CM.
- `.pm` (format lama), `.lm.txt` (LOD), format mesh TRS2019/22 terbaru.

## 5. File riset di repo

- `research/im-format/im2obj.py` — parser referensi `.im` → OBJ/MTL + resolusi `.texture.txt`.
- `research/im-format/im_survey.py` — validator massal semua `.im` dalam satu folder.
- `research/im-format/preview.html` — viewer three.js minimal untuk hasil `im2obj.py`.

Pemakaian:

```
py -I research/im-format/im2obj.py "<path>\body.im" out
py -m http.server 8765 --directory out     (salin preview.html ke out\index.html)
```

## 6. Catatan legal

- Spesifikasi di atas diturunkan dari **data file** (analisis biner) dan string/import exe, bukan menyalin kode PEV. Implementasi TrainzLook harus *clean-room* dari spesifikasi ini.
- Jangan ikut sertakan aset payware (mis. TKK-8500 Indorails) di repo, installer, atau materi promosi tanpa izin pemilik. Pakai aset sendiri / freeware berizin untuk test corpus publik.
