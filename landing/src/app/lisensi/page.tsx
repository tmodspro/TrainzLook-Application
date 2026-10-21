import { readFileSync } from "node:fs";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Lisensi TrainzLook" };

// Read at build time, so the page always shows the LICENSE file shipped with the site.
// shortcut: landing/LICENSE is a copy of the app's LICENSE (the site is published as its own repo); update both together.
const license = readFileSync(`${process.cwd()}/LICENSE`, "utf8");

export default function Lisensi() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted transition hover:text-text">
        ← Kembali
      </Link>
      <pre className="glass-card mt-6 overflow-x-auto rounded-2xl p-6 font-mono text-sm whitespace-pre-wrap">{license}</pre>
    </main>
  );
}
