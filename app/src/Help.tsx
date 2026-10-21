import type { ReactNode, RefObject } from "react";

// Panduan Penggunaan, opened from Help > Panduan TrainzLook or F1. Keep it in step with the features in App.tsx.
const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "mulai",
    title: "1. Membuka mesh",
    body: (
      <ul>
        <li>
          <b>File › Open…</b> atau <kbd>Ctrl O</kbd>: pilih file <code>.im</code>. Texture dicari otomatis lewat{" "}
          <code>.texture.txt</code> di folder yang sama.
        </li>
        <li>
          <b>Drag-drop</b> file <code>.im</code> ke mana saja di jendela.
        </li>
        <li>
          <b>File › Open Recent</b>: 10 mesh terakhir (3 teratas juga ada di layar awal). File yang sudah dipindah/dihapus
          hilang sendiri dari daftar.
        </li>
        <li>
          <b>Double-click</b> <code>.im</code> di Explorer (versi installer) langsung membuka TrainzLook.
        </li>
        <li>Status bar bawah: jumlah part, vertex, segitiga, gambar di folder.</li>
      </ul>
    ),
  },
  {
    id: "navigasi",
    title: "2. Navigasi viewport",
    body: (
      <ul>
        <li>
          <b>Putar (orbit)</b>: drag klik kiri atau klik tengah.
        </li>
        <li>
          <b>Geser (pan)</b>: drag klik kanan, atau <kbd>Shift</kbd> + drag.
        </li>
        <li>
          <b>Zoom</b>: scroll mouse.
        </li>
        <li>
          <kbd>Home</kbd> tampilan awal · <kbd>Numpad 1</kbd> depan · <kbd>Numpad 3</kbd> samping ·{" "}
          <kbd>Numpad 7</kbd> atas.
        </li>
        <li>
          <b>Bola sumbu</b> pojok kanan atas: klik X / Y / Z untuk melihat dari arah itu.
        </li>
        <li>
          <b>Statistik</b> pojok kiri atas viewport: Objects (part terpilih / total), Vertices, Edges, Faces,
          Triangles. Matikan lewat <b>View › Statistics</b>.
        </li>
        <li>
          <b>Material / Wireframe</b>: tampilan texture atau garis segitiga. <b>Axes</b>: sumbu lantai dan bola
          sumbu.
        </li>
        <li>
          <b>Klik model</b>: memilih part. Status bar menampilkan <i>material → texture</i>, dan tile texture-nya
          ditandai.
        </li>
      </ul>
    ),
  },
  {
    id: "outliner",
    title: "3. Outliner & Validasi",
    body: (
      <ul>
        <li>
          <b>Outliner</b>: daftar part (material) dan attachment (<code>a.*</code>). Tanda <b>!</b> = texture part itu
          bermasalah.
        </li>
        <li>
          <b>Arahkan mouse</b> ke part: bagian itu menyala di viewport. <b>Klik</b>: part terpilih dan tile texture-nya
          ditandai, sama seperti klik model.
        </li>
        <li>
          <b>Validasi</b>: merah = merusak aset di Trainz (texture hilang, ukuran bukan pangkat dua). Kuning = boros
          (lebih dari 2048 px, gambar tidak dipakai mesh).
        </li>
        <li>Klik baris validasi untuk menandai tile gambarnya.</li>
      </ul>
    ),
  },
  {
    id: "texture",
    title: "4. Texture Browser",
    body: (
      <ul>
        <li>Semua gambar di folder mesh, dengan ukuran dan jumlah material yang memakainya. Gambar redup = tidak dipakai.</li>
        <li>
          <b>Arahkan mouse</b> ke tile: bagian model yang memakai texture itu menyala biru.
        </li>
        <li>
          <b>Scroll mouse</b> di atas strip tile: geser kiri/kanan.
        </li>
        <li>
          Tile <b>?</b> merah = texture yang direferensikan mesh tapi tidak ketemu.
        </li>
      </ul>
    ),
  },
  {
    id: "replace",
    title: "5. Ganti texture (Replace, Revert, Before)",
    body: (
      <ul>
        <li>
          <b>Replace…</b> di tile, atau <b>drag-drop gambar</b> (JPG/PNG/TGA/BMP) ke tile. Format dikonversi otomatis
          ke format asli supaya <code>.texture.txt</code> tetap valid.
        </li>
        <li>
          Sebelum diganti, file lama selalu disalin ke <code>.trainzlook-backup</code>. Ada peringatan kalau ukuran
          bukan pangkat dua.
        </li>
        <li>
          <b>Revert</b>: kembali ke versi sebelum Replace terakhir. <kbd>Ctrl Z</kbd>: batalkan langkah terakhir
          (Replace, livery, atau geser mesh import).
        </li>
        <li>
          <b>Before (B)</b>: tahan tombolnya atau tahan <kbd>B</kbd> untuk melihat texture sebelum Replace terakhir.
          Lepas untuk kembali. Hanya tampilan, file tidak berubah.
        </li>
        <li>Viewport dan tile update sendiri setiap file texture di folder berubah (hot reload).</li>
      </ul>
    ),
  },
  {
    id: "edit",
    title: "6. Edit di Photoshop",
    body: (
      <ul>
        <li>
          <b>Ikon pensil</b> di pojok tile: buka texture di Photoshop (atau aplikasi default kalau Photoshop tidak
          ada).
        </li>
        <li>
          Cat lalu <kbd>Ctrl S</kbd> di Photoshop: TrainzLook langsung memperbarui viewport. Tidak perlu Replace.
        </li>
        <li>Simpan langsung lewat Photoshop tidak membuat backup. Pakai Save livery dulu kalau ingin bisa kembali.</li>
      </ul>
    ),
  },
  {
    id: "livery",
    title: "7. Livery preset",
    body: (
      <ul>
        <li>
          <b>Save livery…</b> (header Texture Browser): simpan semua texture yang dipakai mesh dengan nama, misalnya
          "KAI 2024". Nama yang sudah ada akan ditimpa setelah konfirmasi di dialog.
        </li>
        <li>
          <b>Livery…</b>: pilih preset untuk dipasang. Hanya texture yang beda yang diganti, lewat Replace (ada
          backup).
        </li>
        <li>
          <kbd>Ctrl Z</kbd> membatalkan satu livery sekaligus. Tahan <kbd>B</kbd> untuk membandingkan.
        </li>
        <li>
          Preset tersimpan di <code>.trainzlook-livery/&lt;nama&gt;</code>. Hapus foldernya untuk menghapus preset.
        </li>
      </ul>
    ),
  },
  {
    id: "uv",
    title: "8. UV template & thumbnail",
    body: (
      <ul>
        <li>
          <b>UV</b> di tile: simpan garis UV sebagai PNG seukuran texture, untuk ditaruh sebagai layer di Photoshop.
        </li>
        <li>
          <b>ss.jpg</b>: thumbnail Content Manager 512×512. <b>$screenshot$</b>: preview 240×180. Diambil dari sudut
          kamera saat ini, tanpa grid dan gizmo. Lokasi default: folder yang berisi <code>config.txt</code>.
        </li>
      </ul>
    ),
  },
  {
    id: "merge",
    title: "9. Gabung mesh (Import & Export merged)",
    body: (
      <ul>
        <li>
          <b>File › Import .im…</b>: tambahkan mesh statis kedua (mesh beranimasi ditolak). Texture-nya muncul di bagian{" "}
          <i>Imported</i> Texture Browser dengan Replace/Revert/UV sendiri.
        </li>
        <li>
          Posisikan dengan gizmo: <kbd>G</kbd> geser, <kbd>R</kbd> putar, <kbd>S</kbd> skala, atau tombol di kiri
          viewport.
        </li>
        <li>
          Kolom <b>Location / Rotation / Scale</b>: drag kiri-kanan untuk mengubah, <kbd>Shift</kbd> lebih halus,{" "}
          <kbd>Ctrl</kbd> snap. Klik untuk mengetik angka, <kbd>Enter</kbd> simpan, <kbd>Esc</kbd> batal.
        </li>
        <li>
          <b>File › Export merged…</b>: tulis mesh utama + mesh import ke <code>.im</code> baru di folder mesh utama. Texture
          import ikut disalin. File lama yang tertimpa di-backup dulu.
        </li>
        <li>
          <b>×</b> di judul Imported: buang mesh import.
        </li>
      </ul>
    ),
  },
  {
    id: "keys",
    title: "10. Shortcut",
    body: (
      <table>
        <tbody>
          {[
            ["Ctrl O", "Buka mesh"],
            ["Ctrl Z", "Undo (Replace, livery, posisi import)"],
            ["B (tahan)", "Lihat texture sebelum Replace"],
            ["G / R / S", "Gizmo geser / putar / skala"],
            ["Home", "Tampilan awal"],
            ["Numpad 1 / 3 / 7", "Depan / samping / atas"],
            ["F1", "Panduan ini"],
          ].map(([k, v]) => (
            <tr key={k}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  },
  {
    id: "file",
    title: "11. Folder yang dibuat TrainzLook",
    body: (
      <ul>
        <li>
          <code>.trainzlook-backup</code>: salinan texture sebelum Replace/livery (dan versi <code>.undone</code>{" "}
          setelah Revert).
        </li>
        <li>
          <code>.trainzlook-livery</code>: preset livery.
        </li>
        <li>Keduanya ada di folder mesh. Jangan ikut dikemas saat membuat CDP / upload aset.</li>
      </ul>
    ),
  },
];

export default function Help({ dialog }: { dialog: RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog ref={dialog} className="modal help" aria-labelledby="help-title">
      <div className="help-head">
        <h3 id="help-title">Panduan TrainzLook</h3>
        <button aria-label="Tutup panduan" onClick={() => dialog.current?.close()}>
          ×
        </button>
      </div>
      <div className="help-body">
        <nav aria-label="Isi panduan">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => document.getElementById(`help-${s.id}`)?.scrollIntoView({ behavior: "smooth" })}>
              {s.title}
            </button>
          ))}
        </nav>
        <div className="help-content">
          {SECTIONS.map((s) => (
            <section key={s.id} id={`help-${s.id}`}>
              <h4>{s.title}</h4>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
