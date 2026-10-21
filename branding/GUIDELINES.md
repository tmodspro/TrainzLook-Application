# TrainzLook — Panduan Logo (ringkas)

## 1. Logo
- **Ide**: *Rail Eye* — penampang rel kereta (kepala, badan, kaki) dengan lensa di kepala rel. "Trainz" + "Look" dalam satu siluet.
- **Versi**: utama horizontal · bertumpuk · simbol saja · wordmark saja
- **File master** (SVG, warna untuk layar):
  - `trainzlook-horizontal.svg` / `-dark.svg` — logo utama, latar terang / gelap
  - `trainzlook-stacked.svg` / `-dark.svg` — bertumpuk, untuk ruang persegi
  - `trainzlook-symbol.svg` — simbol saja, ukuran ≥ 32 px
  - `trainzlook-symbol-small.svg` — simbol untuk ≤ 32 px (lensa lebih besar, badan lebih tebal)
  - `trainzlook-wordmark.svg` — wordmark saja
- **Ekspor siap pakai**: `exports/symbol/` (hitam, putih, oranye, ikon app, favicon, set ikon web), `exports/horizontal/`, `exports/stacked/`
- **Presentasi**: `board/presentation.html`, slide PNG di `board/slides/`

## 2. Ruang kosong
Sisakan ruang kosong minimal **1 × diameter lensa** di semua sisi logo. Ruang ini ikut membesar/mengecil bersama logo.

## 3. Ukuran minimum
| Versi | Layar | Cetak |
|---|---|---|
| Horizontal | 160 px lebar | 30 mm lebar |
| Bertumpuk | 96 px lebar | 20 mm lebar |
| Simbol | 16 px (pakai `trainzlook-symbol-small.svg` / `favicon.ico`) | 6 mm |

## 4. Warna
| Nama | HEX | RGB | CMYK (perkiraan) | Pantone (terdekat) |
|---|---|---|---|---|
| Signal Orange | `#FF8A00` | 255 138 0 | 0 46 100 0 | ≈ 151 C |
| Ballast Graphite | `#1E1F22` | 30 31 34 | 12 9 0 87 | ≈ 419 C |
| Rail Light | `#F2F2F2` | 242 242 242 | 0 0 0 5 | — |

Nilai CMYK/Pantone adalah perkiraan; cocokkan dengan swatch fisik sebelum cetak.

**Pasangan yang disetujui**: simbol oranye + wordmark grafit di latar putih/terang · simbol oranye + wordmark terang di latar grafit · hitam satu warna di latar putih · putih satu warna di latar gelap atau foto yang tenang.
Di atas foto ramai, pakai ikon app (simbol di ubin grafit).

## 5. Tipografi
- **Wordmark** digambar khusus (monoline geometris, tebal garis = badan rel). Jangan diketik ulang dengan font apa pun.
- **Teks pendamping**: Segoe UI (bawaan Windows, sama dengan UI aplikasi). Untuk web: Inter (lisensi OFL) dengan fallback `system-ui, sans-serif`.

## 6. Jangan
Jangan meregangkan atau memipihkan · jangan mengganti warna di luar palet · jangan memutar · jangan menambah bayangan, outline, gradasi, atau efek · jangan mengubah susunan atau ukuran relatif simbol dan wordmark · jangan menaruh di latar ramai tanpa ubin · jangan mengetik ulang wordmark.

## 7. Catatan
- Uji yang sudah dijalankan: `svg_audit.py` 100/100 untuk kedua simbol, uji 16/32/48 px, satu warna, terbalik, dan blur (squint).
- Versi putih di latar gelap tampak sedikit lebih tebal (efek iradiasi); untuk pemakaian kritis, tipiskan geometri putihnya secara manual.
- Belum ada cek merek dagang. Lakukan pencarian di database merek (mis. DJKI / WIPO) dan reverse image search sebelum dipakai komersial.
- Dibuat dengan alur [logo-design-skill](https://github.com/kaankiziltug/logo-design-skill).
