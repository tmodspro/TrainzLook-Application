// Single source for everything the page states as fact. Copy only describes features already built
// in app/ (docs/03-landing-page.md §5); add a feature here when it ships, not before.

export const site = {
  name: "TrainzLook",
  publisher: "INDORAILS",
  tagline: "Lihat tekstur Trainz-mu berubah secara realtime",
  description:
    "Viewer mesh .im bergaya Blender untuk repainter Trainz. Simpan tekstur dari Photoshop atau GIMP, keretanya langsung berubah. Gratis untuk Windows, dari INDORAILS.",
  url: "https://trainzlook.web.id" as string | null, // site origin: OG image, sitemap and JSON-LD need absolute URLs
  // shortcut: null = not decided yet (docs/03-landing-page.md §11), the page then says the link is coming; fill from the real release build.
  download: {
    version: "0.1.0",
    fileName: "TrainzLook_0.1.0_x64-setup.exe",
    url: null as string | null,
    size: null as string | null,
    sha256: null as string | null,
  },
  requirements: [
    "Windows 10 atau 11, 64-bit",
    "Microsoft Edge WebView2 (sudah ada di Windows 11; installer memasangnya bila belum ada, perlu internet)",
    "Kartu grafis dengan WebGL 2",
  ],
};

export type Feature = { scene: string; title: string; body: string; short?: string; meta?: string };

// Pinned tour, in step order (scene ids match remotion/timing.ts). Only features the app shows today: merge is
// hidden there (app/src/features.ts MERGE_UI), so it is not claimed here.
export const tour: Feature[] = [
  {
    scene: "open",
    short: "Buka & Recent",
    title: "Buka .im dari mana saja",
    body: "Seret .im ke jendela, tekan Ctrl+O, atau pilih dari Open Recent. Layar awal menampilkan tiga mesh terakhir, dan versi installer membuka .im lewat double-click di Explorer.",
  },
  {
    scene: "edit",
    short: "Edit di Photoshop",
    title: "Klik pensil, cat, simpan",
    body: "Ikon pensil di tile membuka tekstur di Photoshop (atau aplikasi default). Begitu disimpan, TrainzLook memuat ulang viewport sendiri. Tidak perlu Replace, tidak perlu membuka ulang.",
  },
  {
    scene: "replace",
    short: "Replace + Before",
    title: "Ganti tekstur, bandingkan dengan yang lama",
    body: "Seret gambar ke tile: dikonversi ke nama dan format asli supaya .texture.txt tetap valid, file lama disalin ke backup dulu. Tahan B untuk melihat versi sebelumnya; Revert atau Ctrl+Z untuk kembali.",
  },
  {
    scene: "select",
    short: "Sorot + statistik",
    title: "Bagian mana memakai tekstur apa",
    body: "Klik part di Outliner atau di model: bagian yang memakai teksturnya menyala dan tile-nya ditandai. Overlay Statistics ala Blender menghitung objek, vertex, edge, dan segitiga.",
  },
  {
    scene: "livery",
    short: "Livery preset",
    title: "Simpan livery, pasang lagi sekali klik",
    body: "Save livery menyimpan semua tekstur yang dipakai mesh dengan sebuah nama. Pilih dari Livery… untuk memasangnya: hanya tekstur yang berbeda yang diganti (dengan backup), dan Ctrl+Z membatalkan satu livery sekaligus.",
  },
];

export const extras: Feature[] = [
  {
    scene: "S5",
    meta: "Saved UV template 1_uv.png (2048×2048)",
    title: "Template UV",
    body: "Ekspor layout UV sebuah tekstur sebagai PNG, siap jadi layer panduan saat mengecat livery.",
  },
  {
    scene: "S6",
    meta: "panto_a.jpg is not used by this mesh",
    title: "Panel validasi",
    body: "Tekstur hilang, .texture.txt tanpa Primary=, atau ukuran yang bukan pangkat dua langsung terdaftar. Klik untuk menuju teksturnya.",
  },
  {
    scene: "S8",
    meta: "ss.jpg 512×512 · $screenshot$.jpg 240×180",
    title: "Thumbnail sekali klik",
    body: "Buat ss.jpg 512×512 untuk Content Manager dan $screenshot$.jpg 240×180 dari sudut pandang yang sedang tampil, tanpa grid dan gizmo. Dari header viewport atau menu File.",
  },
  {
    scene: "S9",
    meta: "Home · Numpad 1 / 3 / 7",
    title: "Navigasi ala Blender",
    body: "Garis sumbu dan gizmo navigasi: klik bola sumbu untuk melihat dari arah itu. Tampilan Solid atau Wireframe.",
  },
];

export const workflow = [
  { title: "Buka mesh", body: "Buka .im kereta di TrainzLook. Semua teksturnya terdaftar di bawah viewport." },
  { title: "Cat livery", body: "Klik ikon pensil di tile: tekstur terbuka di Photoshop. Cat seperti biasa, lalu simpan." },
  { title: "Lihat hasilnya", body: "Kereta di viewport berubah saat itu juga. Puas? Commit ke Trainz seperti biasa." },
];

export const faq = [
  {
    q: "Apakah TrainzLook benar-benar gratis?",
    a: "Ya. TrainzLook gratis diunduh dan dipakai untuk pekerjaan konten Trainz Anda sendiri, tanpa akun dan tanpa langganan. Mohon jangan mengunggah ulang installer-nya; bagikan tautan halaman ini.",
  },
  {
    q: "Apakah file asli saya aman?",
    a: "Sebelum Replace, file asli disalin ke folder .trainzlook-backup di samping mesh. Revert atau Ctrl+Z mengembalikannya, dan versi yang sedang terpasang ikut disimpan sebagai .undone, jadi hasil edit Anda juga tidak hilang.",
  },
  {
    q: "Format apa saja yang bisa dibuka?",
    a: "Mesh .im Trainz, dengan tekstur yang dirujuk lewat .texture.txt (JPG, PNG, TGA, BMP). File .texture terkompilasi (TANE/TRS22), mesh beranimasi, dan mode traincar lengkap dengan bogey belum didukung.",
  },
  {
    q: "Ada versi Mac atau Linux?",
    a: "Belum. Saat ini TrainzLook hanya untuk Windows 10 dan 11 64-bit.",
  },
  {
    q: "Bisa membuka aset yang masih di Content Manager?",
    a: "TrainzLook membuka file yang ada di disk. Untuk aset di database Content Manager, pilih \"Open for edit\" di Content Manager dulu, lalu buka file .im dari folder tersebut.",
  },
];
