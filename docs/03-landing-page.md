# TrainzLook — Rancangan Landing Page

Status: **L1–L2 selesai** (kerangka + halaman statis di `landing/`, Next.js 16.4.2). URL unduhan, ukuran, SHA-256 dan capture masih placeholder sampai §11 dijawab.

Penyesuaian saat L1–L2:
- `cacheComponents` dimatikan: tidak bisa dipakai bersama `output: "export"`. Manifest web jadi file statis `public/manifest.webmanifest`.
- FAQ memakai `<details>` bawaan HTML (aksesibel tanpa library); shadcn/ui baru dipasang saat ada komponen yang benar-benar butuh.
- Tombol **Unduh gratis** langsung ke installer bila `site.download.url` terisi; selama `null` mengarah ke bagian Unduh yang menulis "Tautan unduhan sedang disiapkan".
- Halaman `/lisensi` membaca `../LICENSE` saat build, jadi selalu sama dengan file lisensi aplikasi.
- Dev server: `npm --prefix landing run dev` (konfigurasi pratinjau di `.claude/launch.json`).

L3 (mockup) selesai:
- `src/mockup/AppMockup.tsx` + `mockup.css`: salinan markup & CSS `app/src/App.tsx`/`App.css` (di-scope `.tl-mock`) pada ukuran jendela asli 1400×900, termasuk title bar Windows. Semua keadaan UI berupa prop untuk scene L4. **Ubah UI aplikasi → ubah juga salinan ini.**
- `src/mockup/Frame.tsx`: menskala mockup ke lebar wadah, atau memperbesar satu area (`focus`) untuk kartu bento.
- `src/mockup/states.ts`: data asli Indorails **TC1-8500** (TKK-8500) dari aplikasi yang membuka mesh itu: 12 material, 10 attachment, 12 tekstur, status `62,974 verts · 50,614 tris`, validasi `panto_a.jpg is not used`. Path folder di topbar dibuat netral (`D:\Trainz\TKK-8500\…`), bukan path lokal.
- `public/captures/`: render viewport 2× (material, highlight `1.jpg`, wireframe) dan 12 thumbnail Texture Browser, diambil dari aplikasi asli yang berjalan (`npm run tauri dev` + WebView2 DevTools; mesh dibuka lewat backend asli, kamera digerakkan dengan input mouse). Cara mengulang: `landing/scripts/capture/README.md`. Total ±430 KB WebP.
- §11 #1 dijawab (2026-10-21): pakai TKK-8500; hasil render & thumbnail boleh di-commit. File `.im`/tekstur asli tetap tidak.

L4 (Remotion) selesai:
- `remotion/scenes.tsx`: scene 1400×900 @30 fps yang menganimasikan `AppMockup`: S1 buka `.im` (drag `body.im`), S2 hot reload (jendela editor gambar netral + Ctrl+S → livery biru), S3 Replace (drag file ke tile → backup, Revert aktif, hint Ctrl+Z), S4 highlight tekstur, S7 merge `masinis.im` ke kabin + Export merged. `remotion/overlays.tsx`: pointer, file yang di-drag, keycap, editor. `remotion/timing.ts`: jumlah frame (dipakai halaman tanpa memuat Remotion).
- Semua keadaan UI dan render viewport diambil dari aplikasi asli (`landing/scripts/capture/scenes.mjs`, pada salinan scratch TC1-8500): livery biru = `1.jpg` yang hue-nya digeser untuk demo; teks notice Replace/Revert/Import dari aplikasi. Satu-satunya teks yang tidak direkam: notice "Exported body_merged.im: 13 parts · copied …", disusun dari format di `App.tsx` + urutan salinan di `lib.rs` (export tidak dijalankan).
- Hero: Player autoplay loop (buka → hot reload → fade), dimuat lazy di atas poster statis, berhenti saat di luar layar. Tur fitur: Player di-scrub oleh scroll (segmen i diputar saat kartu i naik ke tengah layar), kartu lain meredup; hanya ≥ 1024 px.
- `prefers-reduced-motion`: Player tidak dimuat, tampil poster statis.
- Chunk Remotion ±110 KB gzip, hanya dimuat saat Player dibutuhkan.
- Lisensi Remotion (§11 #4) belum dijawab: konsol menampilkan peringatan lisensi Remotion; `acknowledgeRemotionLicense` sengaja belum dipasang.

---

## 1. Tujuan

Satu halaman yang membuat repainter Trainz (KRL, KAI, Indorails) **paham dalam 10 detik** apa itu TrainzLook, **melihat aplikasinya bekerja**, lalu **mengunduhnya gratis**.

| Harus | Tidak boleh |
|---|---|
| Jelas: **gratis**, **Windows**, **dipublikasikan INDORAILS** | Angka palsu ("10.000 user", "0,1 ms") — tidak ada data, tidak ditulis |
| Tombol **Unduh gratis** di hero, di nav, dan di akhir halaman | Klaim fitur yang belum ada (TANE `.texture`, mode traincar, livery preset) |
| Demo bergerak yang meniru aplikasi asli, bukan ilustrasi generik | Font IBM Plex Mono (seluruh keluarga IBM Plex) |
| Dark mode saja, glassmorphism yang tetap terbaca | Mode terang, toggle tema |

## 2. Pemisahan folder

Landing page adalah proyek npm sendiri. Tidak berbagi `package.json`, lockfile, `node_modules`, atau build dengan aplikasi Tauri.

```
TrainzLook/
├─ app/                  aplikasi desktop (Tauri + React)      ← tidak disentuh
├─ crates/               parser Rust                           ← tidak disentuh
├─ branding/             sumber logo (master)                  ← hanya dibaca
├─ docs/                 03-landing-page.md (dokumen ini)
└─ landing/              ← BARU: situs Next.js
   ├─ package.json       dependensi landing saja
   ├─ next.config.ts     output: "export" (situs statis)
   ├─ src/
   │  ├─ app/            layout.tsx, page.tsx, globals.css, opengraph-image
   │  ├─ components/     Nav, Hero, FeatureTour, Bento, Workflow, Download, Faq, Footer
   │  ├─ mockup/         tiruan UI TrainzLook (lihat §5)
   │  └─ site.ts         SATU sumber data: versi, URL unduhan, ukuran, SHA-256
   ├─ remotion/          komposisi video (scene per fitur), dipakai Player
   └─ public/
      ├─ brand/          salinan dari branding/exports (favicon, logo, manifest)
      └─ captures/       tangkapan viewport dari aplikasi asli (lihat §11 #1)
```

- Folder bernama `landing/` (bukan `web/`) supaya tidak tertukar dengan frontend web di dalam `app/`.
- `src/app/` dipakai supaya `landing/app` tidak tertukar dengan `TrainzLook/app`.
- `.gitignore` milik `landing/` mengabaikan `.next/`, `out/`, `node_modules/`.
- Tidak memakai npm workspaces: build aplikasi desktop tetap persis seperti sekarang.

## 3. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript), `output: "export"` | Rekomendasi Anda; ekspor statis = hosting gratis di mana saja, tanpa server |
| Styling | **Tailwind CSS v4** + token CSS sendiri | Bawaan `create-next-app`; token glass ditulis sekali di `globals.css` |
| Komponen dasar | **shadcn/ui** (Radix) — Button, Accordion (FAQ), Tooltip | Disalin ke repo, aksesibel (keyboard, ARIA), tanpa lock-in |
| Efek tambahan | **Magic UI** — hanya bila satu efek benar-benar dibutuhkan, lolos filter antislop | Copy-paste, sama-sama ekosistem shadcn |
| Motion UI | **Motion** (`motion/react`, dulu Framer Motion) | Scroll-linked (`useScroll`), sticky scroll, spring, `useReducedMotion` |
| Smooth scroll | **Lenis** | Scroll halus yang membuat sticky scroll terasa "niat"; mati otomatis saat reduced motion |
| Video/motion graphic | **Remotion** + **@remotion/player** | Scene ditulis sebagai React; diputar live di browser, bisa di-*scrub* oleh scroll |
| Font | `next/font` (self-host, tanpa request ke Google saat runtime) | Lihat §6 |

Versi pasti dikunci saat `npm install` (lockfile), bukan ditebak di dokumen ini.

## 4. Struktur halaman

| # | Bagian | Isi | Motion |
|---|---|---|---|
| 1 | **Nav** (glass, menempel di atas) | Logo horizontal, Fitur · Cara kerja · FAQ, tombol **Unduh gratis** | Blur & border muncul setelah scroll > 8 px |
| 2 | **Hero** | Judul: *Lihat tekstur Trainz-mu berubah secara realtime* · sub: viewer mesh `.im` bergaya Blender untuk repainter · badge **Gratis · Windows 10/11 · oleh INDORAILS** · CTA **Unduh gratis** + *Lihat cara kerjanya* | Remotion Player autoplay, loop ±12 dtk: montase buka mesh → ganti livery → hot reload |
| 3 | **Tur fitur (sticky scroll)** | Mockup aplikasi menempel di tengah; teks fitur di samping berganti saat scroll | Progres scroll → `player.seekTo(frame)`: video ikut maju-mundur sesuai scroll |
| 4 | **Bento fitur** (kartu glass) | Fitur lain yang belum muncul di tur (lihat §5) | Kartu muncul bertahap saat masuk viewport |
| 5 | **Alur kerja** | Photoshop/GIMP → simpan → TrainzLook langsung update → commit ke Trainz | Garis rel menghubungkan 3 langkah, digambar saat scroll |
| 6 | **Unduh** | Tombol besar, versi, ukuran installer, syarat sistem (Windows 10/11 64-bit, WebView2), SHA-256, catatan rilis | Statis (fokus pada informasi) |
| 7 | **FAQ** | Benar gratis? · Apakah file asli saya aman? (backup + Revert + Ctrl+Z) · Format apa yang didukung? · Ada versi Mac/Linux? · Bisa buka aset dari Content Manager? | Accordion |
| 8 | **Footer** | © 2026 INDORAILS · Publisher: INDORAILS · tautan Lisensi · logo | — |

Bahasa: **Indonesia** (komunitas utama). Bahasa Inggris ditunda.

## 5. Mockup komponen dari aplikasi asli + scene Remotion

"Seolah merekam aplikasi" dibuat begini:

1. **Bingkai UI = komponen React tiruan dari aplikasi asli.** `landing/src/mockup/` menyalin markup dan token warna dari `app/src/App.tsx` + `App.css` (topbar, outliner, viewport header, toolbar kiri, texture browser, status bar, number field gaya Blender). Hasilnya tajam di resolusi apa pun dan teks bisa dianimasikan. Salinan, bukan import: landing tidak boleh bergantung pada folder `app/`.
2. **Isi viewport 3D = tangkapan dari aplikasi asli** (`npm run tauri dev`) — PNG/WebM per keadaan (sebelum/sesudah replace, wireframe, highlight, gizmo).
3. **Kursor, klik, drag, dan sorotan** dianimasikan Remotion (`interpolate`, `spring`) di atas keduanya.

Scene — hanya fitur yang **sudah dibangun** (sumber: memory proyek & roadmap Fase 2/3/6):

| Scene | Fitur | Apa yang terlihat | Dipakai di |
|---|---|---|---|
| S1 | Buka `.im` | File di-drag ke jendela → mesh muncul, outliner & status bar terisi | Hero, Tur |
| S2 | **Hot reload** | Jendela editor gambar menyimpan `4_a.jpg` → tile berkedip → livery di viewport berganti | Hero, Tur |
| S3 | Replace + Revert + Ctrl+Z | Gambar di-drag ke tile → badge backup bertambah → Ctrl+Z memulihkan | Tur |
| S4 | Highlight tekstur ↔ mesh | Hover tile → bagian mesh pemakai tekstur menyala | Tur |
| S5 | UV template | Klik tombol UV → PNG layout UV muncul | Bento |
| S6 | Panel validasi | Daftar masalah (missing, non power-of-two) → klik → tekstur terpilih | Bento |
| S7 | Merge `.im` | Import mesh kedua → gizmo Move/Rotate/Scale + number field → Export | Tur |
| S8 | Thumbnail | Klik `ss.jpg` / `$screenshot$` → bingkai 512² / 240×180 tersimpan | Bento |
| S9 | Navigasi | Sumbu + gizmo navigasi, Solid ↔ Wireframe | Bento |

Performa Player:
- Hero menampilkan **poster statis** dulu; Player dimuat lazy (`next/dynamic`, `ssr: false`) setelah halaman interaktif.
- Player tur fitur baru dimuat saat bagian itu mendekati viewport.
- `prefers-reduced-motion`: tanpa autoplay, tanpa scroll-scrub; tampil poster + tombol Putar.

## 6. Desain visual (dark only, glassmorphism)

Diturunkan dari `branding/GUIDELINES.md`:

| Token | Nilai | Pakai |
|---|---|---|
| `--bg` | `#0F1012` (lebih gelap dari Ballast Graphite) | Latar halaman |
| `--surface` | `#1E1F22` Ballast Graphite | Bidang solid, fallback glass |
| `--accent` | `#FF8A00` Signal Orange | CTA, sorotan, garis rel — **satu-satunya** warna aksen |
| `--text` | `#F2F2F2` Rail Light | Teks utama |
| `--muted` | ±`#A1A1AA` (cek kontras ≥ 4.5:1 di atas glass) | Teks sekunder |
| `--glass` | `rgb(255 255 255 / 0.05)` + `backdrop-filter: blur(16px) saturate(140%)` | Nav, kartu, panel FAQ |
| `--glass-border` | `rgb(255 255 255 / 0.08)` + highlight 1 px di tepi atas | Tepi kartu |

Aturan glass:
- Glass butuh sesuatu di belakangnya: cahaya oranye lembut dari arah mockup + pola bantalan rel/grid tipis. **Bukan** blob gradasi ungu-biru.
- Tidak menumpuk glass di atas glass. Teks penting tidak diletakkan di atas area latar yang ramai.
- Fallback: `@supports not (backdrop-filter: blur(1px))` dan `prefers-reduced-transparency` → `--surface` solid.
- `color-scheme: dark` di `<html>`; tanpa media query mode terang.

Font (IBM Plex Mono dan keluarga IBM dilarang):
- **Teks: Inter** (variable) — sesuai panduan brand untuk web.
- **Nama file & angka teknis** (`body.im`, `4_a.jpg`, `512×512`): **JetBrains Mono**, dipakai hemat.
- Wordmark TrainzLook selalu SVG dari `branding/`, tidak pernah diketik ulang.

Logo: ikuti `GUIDELINES.md` — versi `-dark.svg` di latar gelap, ruang kosong ≥ 1 diameter lensa, tanpa bayangan/glow pada logo.

## 7. Praktik terbaik (wajib lolos)

| Area | Syarat |
|---|---|
| Aksesibilitas | Kontras ≥ 4.5:1 (teks), fokus keyboard terlihat, semua tombol berlabel, video punya teks alternatif/ringkasan, `prefers-reduced-motion` dihormati |
| Performa | Lighthouse mobile ≥ 90; LCP adalah judul hero (teks), bukan video; font self-host + `display: swap`; gambar via `next/image` (unoptimized saat export) atau WebP/AVIF |
| SEO | `metadata` judul/deskripsi, Open Graph image (`opengraph-image.tsx`), `sitemap`, `robots`, JSON-LD `SoftwareApplication` dengan `offers.price = 0`, `operatingSystem = Windows`, `publisher = INDORAILS` |
| Kejujuran | Ukuran installer & SHA-256 diambil dari build nyata; tidak ada testimoni/angka karangan |
| Keamanan | Tautan unduhan langsung ke sumber resmi (HTTPS); SHA-256 ditampilkan agar bisa diverifikasi |

## 8. Alat bantu pengembangan (Claude Code)

| Repo | Peran | Pasang (jalankan sendiri di terminal `claude`) |
|---|---|---|
| [antislop](https://github.com/miqdadbadjuber/anti-slop) | Filter UI/copy generik; Delivery Gate PASS/FAIL sebelum rilis | `/plugin marketplace add https://github.com/miqdadbadjuber/anti-slop` lalu `/plugin install antislop@anti-slop` |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Kode seminimal mungkin. Aturannya **sudah aktif** lewat `AGENTS.md` repo ini | Opsional: `/plugin marketplace add DietrichGebert/ponytail` lalu `/plugin install ponytail@ponytail` (dapat `/ponytail-review`) |
| [caveman](https://github.com/JuliusBrussee/caveman) | **Rekomendasi hemat token**: jawaban agen dibuat ringkas | Lihat README repo. Penghematan nyata ±12–30% (output hanya bagian kecil dari tagihan), bukan 65% seperti klaim |
| shadcn/ui + Magic UI | Repo UI (§3) | Lewat `npx shadcn@latest add …` saat dibutuhkan |

Antislop tidak memberi arah desain (aturannya R-37); arah desainnya adalah §6 dokumen ini.

## 9. Tahapan

| Tahap | Isi | Selesai bila |
|---|---|---|
| **L0. Persiapan** | Keputusan §11, pasang plugin §8, tangkap layar aplikasi asli | Ada folder capture + data unduhan nyata |
| **L1. Kerangka** ✅ | `create-next-app` di `landing/`, Tailwind, token §6, font, favicon & manifest dari `branding/exports/symbol` | `npm run build` menghasilkan `out/` statis |
| **L2. Halaman statis** ✅ | Semua bagian §4 dengan copy final, tanpa motion; data dari `site.ts` | Bisa dibaca & diunduh tanpa JavaScript tambahan |
| **L3. Mockup** ✅ | `src/mockup/` meniru UI aplikasi + capture viewport | Bersebelahan dengan screenshot asli, sulit dibedakan |
| **L4. Remotion** ✅ | Scene S1–S9, Player hero (poster + lazy), sticky scroll + scrub | Animasi 60 fps di laptop menengah; reduced motion → statis |
| **L5. Polish** 🟡 (lihat catatan L5) | Motion UI, Lenis, glass, OG image, JSON-LD, audit antislop + Lighthouse | Delivery Gate PASS, Lighthouse ≥ 90, a11y 100 |
| **L6. Rilis** | Deploy, domain, uji di Chrome/Edge/Firefox + ponsel | Tautan unduhan diuji dari situs live |

## 10. Risiko

| Risiko | Mitigasi |
|---|---|
| **Lisensi Remotion**: gratis untuk perorangan & perusahaan ≤ 3 karyawan; di atas itu wajib *Company License* berbayar | Pastikan status INDORAILS (§11 #4). Alternatif tanpa biaya: scene yang sama dirender sekali ke WebM/MP4 dan diputar `<video>` (tanpa scroll-scrub) |
| Aset payware tampil di video | Hanya pakai mesh yang boleh dipublikasikan (§11 #1). Capture tidak memuat file `.im`/tekstur mentah, hanya gambar hasil render |
| Player Remotion memperberat halaman | Lazy-load, poster dulu, dimuat saat dekat viewport |
| Glass tidak terbaca di layar murah / browser lama | Fallback solid + cek kontras pada latar terterang di belakang glass |
| Lisensi aplikasi melarang redistribusi pihak ketiga | Unduhan hanya dari sumber resmi INDORAILS; FAQ menjelaskan "gratis, tapi jangan di-reupload" |
| Klaim fitur kedaluwarsa | Copy fitur hanya dari daftar yang sudah dibangun; tambah fitur baru ke §5 saat rilis |

## 11. Keputusan yang dibutuhkan

1. **Mesh untuk demo**: TKK-8500 milik Indorails (repo melarang commit asetnya; capture render diletakkan di `landing/public/captures/` — boleh di-commit?), atau mesh lain yang bebas dipublikasikan?
2. **Lokasi file installer**: GitHub Releases (repo harus publik atau pakai repo rilis terpisah), situs Indorails, atau layanan lain?
3. **Hosting situs**: Vercel / Cloudflare Pages / GitHub Pages (semua bisa, karena ekspor statis) dan **domain**.
4. **Jumlah karyawan INDORAILS** (lisensi Remotion, §10).
5. **Font**: Inter + JetBrains Mono sesuai panduan brand, atau ingin font display yang lebih berkarakter untuk judul?

## Catatan L5 (2026-10-21)

Design read: landing page produk desktop gratis untuk repainter Trainz Indonesia; jendela aplikasi asli di atas grafit gelap, satu aksen Signal Orange, glass terbatas. Dial: ENERGY 2, RHYTHM 2, MOTION 3 (sticky tour + demo yang di-scrub, sesuai permintaan pemilik).

Selesai:
- Lenis (scroll halus + anchor), mati untuk reduced motion. Motion dipakai hemat: nav jadi glass setelah scroll, rel "Cara kerja" terisi oranye mengikuti scroll (motif rel, vertikal di ponsel).
- Antislop: blur glass hanya di nav + panel Unduh (R-10), badge hero jadi satu baris teks (R-09), "Bento" diganti pemilih fitur dengan satu tampilan besar (R-05/R-14), langkah "Cara kerja" tanpa kartu dan nomor mono (R-06), latar garis dihapus (R-07), CTA "Lihat demo fiturnya" (R-15), tap target ≥ 44 px (R-03), kontras semua pasangan ≥ 5,45:1 (R-25), mockup `inert`.
- OG image statis `src/app/opengraph-image.png` (render asli TC1-8500), JSON-LD `SoftwareApplication` (gratis, Windows, publisher INDORAILS), `robots.txt`, `sitemap.xml` (kosong sampai `site.url` diisi).
- Demo Remotion hanya ≥ 1024 px dan dimuat setelah idle + dekat layar; ponsel melihat poster statis.

Lighthouse (Edge headless, build statis): accessibility/best practices/SEO 100. Performance desktop 95–98 (sekali 76), mobile 68–85 dan sangat bervariasi antar-run untuk build yang sama; first paint di headless tertahan GPU software. LCP di browser biasa: 272 ms (H1). Target mobile ≥ 90 belum tercapai; ukur ulang dengan PageSpeed Insights setelah deploy.

Belum: Delivery Gate antislop lengkap ditulis per item, uji Safari/Firefox, `site.url` (OG/sitemap butuh domain), keputusan §11 #2–#5.

## Revisi tampilan (2026-10-21, permintaan pemilik)

- **Fitur → pinned stage:** di desktop section ditahan di layar sambil di-scroll (±425vh); posisi scroll = waktu player. Pill langkah (glass) terisi sesuai langkah yang diputar, kartu caption glass berganti per langkah (Motion), dan kamera Remotion (`FOCUS` di `remotion/scenes.tsx`) zoom ke bagian jendela yang dibahas tiap langkah. Klik pill = lompat ke akhir langkahnya. Ponsel: poster + kartu glass bertumpuk.
- **Juga ada:** panel glass besar, tab pill (role tablist, panah kiri/kanan) dengan sorotan meluncur (`layoutId`), autoplay 6 detik dengan garis progres (berhenti saat kursor/fokus di panel, mati untuk reduced motion), tampilan aplikasi miring 3D mengikuti kursor, caption + chip teks asli aplikasi.
- **Glass:** `.glass-card` (gradien cahaya, rim gradien, spotlight oranye mengikuti kursor) di semua kartu; `.ambient` cahaya oranye/baja yang bergerak pelan di belakang halaman supaya blur terlihat; `Reveal` (Motion) memunculkan kartu dari blur saat masuk layar.
- **Tombol:** semua pill glass (`.btn-glass`), rim cahaya diam (terang di atas, oranye tipis di bawah), kilau sekali saat hover; primer & pilihan aktif = glass oranye. Versi rim berputar dicoba lalu dibuang atas permintaan pemilik (terlihat jelek).
- Catatan antislop: glass di banyak kartu melampaui R-10 (1–2 elemen); dipertahankan karena arahan eksplisit pemilik (R-37).
- Jangan jalankan `npm run build` saat `npm run dev` hidup: keduanya memakai `.next`, dev lalu menyajikan CSS lama (hapus `.next` dan restart dev).
