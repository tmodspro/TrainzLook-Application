import { readFileSync } from "node:fs";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { site } from "@/site";

export const metadata: Metadata = { title: "Lisensi TrainzLook" };

// Read at build time, so the page always shows the LICENSE file shipped with the site.
// shortcut: landing/LICENSE is a copy of the app's LICENSE (the site is published as its own repo); update both together.
const license = readFileSync(`${process.cwd()}/LICENSE`, "utf8");

// The file's own structure: blank lines split blocks, "- " starts a list item, hard-wrapped lines are joined.
const [head, ...blocks] = license
  .trim()
  .split(/\n\s*\n/)
  .map((b) => b.split("\n").map((l) => l.trim()));
const unwrap = (lines: string[]) => lines.join(" ");
const items = (lines: string[]) =>
  lines.reduce<string[]>((acc, l) => (l.startsWith("- ") ? [...acc, l.slice(2)] : [...acc.slice(0, -1), `${acc.at(-1)} ${l}`]), []);

// Plain-language summary of the text below; the license text is what applies.
const summary = [
  { title: "Boleh", body: "Memasang dan memakai TrainzLook untuk pekerjaan konten Trainz Anda sendiri, gratis." },
  {
    title: "Perlu izin tertulis INDORAILS",
    body: "Menyalin, mengubah, menjual, menyewakan, mendistribusikan ulang, atau membongkar (reverse engineer) perangkat lunaknya.",
  },
  { title: "Aset tetap milik pembuatnya", body: "Mesh dan tekstur yang Anda buka tidak menjadi milik TrainzLook, dan lisensi ini tidak memberi hak atasnya." },
];

export default function Lisensi() {
  return (
    <div className="page-bg min-h-dvh">
      <header className="px-4 pt-3">
        <div className="glass mx-auto flex max-w-4xl items-center gap-4 rounded-xl px-4 py-1.5">
          <Link href="/" aria-label="TrainzLook, ke beranda" className="flex min-h-11 items-center">
            <Image src="/brand/trainzlook-horizontal-dark.svg" alt="" width={918} height={188} className="h-6 w-auto" priority />
          </Link>
          <Link href="/" className="btn-glass ml-auto text-sm">
            Kembali ke beranda
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-16 pb-24">
        <p className="mb-3 text-sm font-semibold text-accent">Lisensi</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Lisensi TrainzLook</h1>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted">
          TrainzLook gratis untuk pekerjaan konten Trainz Anda, diterbitkan oleh {site.publisher}. Ringkasan di bawah memudahkan
          membaca; yang berlaku adalah teks lisensi lengkapnya.
        </p>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {summary.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.08} className="glass-card h-full rounded-2xl p-6">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-2 text-pretty text-muted">{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal className="glass-card mt-10 rounded-[2rem] p-6 sm:p-10">
          <article lang="en" aria-labelledby="license-title">
            <header className="border-b border-white/10 pb-6">
              <h2 id="license-title" className="text-2xl font-semibold">
                {head[0]}
              </h2>
              {head.slice(1).map((l) => (
                <p key={l} className="mt-1 text-muted">
                  {l}
                </p>
              ))}
            </header>
            <div className="mt-6 space-y-5 leading-relaxed text-text/90">
              {blocks.map((b, i) =>
                b[0].startsWith("- ") ? (
                  <ul key={i} className="space-y-2">
                    {items(b).map((it) => (
                      <li key={it} className="flex gap-3">
                        <span aria-hidden className="mt-2.5 size-1.5 flex-none rounded-full bg-accent" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className={b[0] === b[0].toUpperCase() ? "rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-muted" : ""}>
                    {unwrap(b)}
                  </p>
                ),
              )}
            </div>
          </article>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
