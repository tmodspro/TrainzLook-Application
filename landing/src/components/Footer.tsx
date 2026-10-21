import Image from "next/image";
import Link from "next/link";
import { site } from "@/site";

export function Footer() {
  return (
    <footer className="border-t border-glass-border px-4 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4">
        <Image src="/brand/trainzlook-horizontal-dark.svg" alt="TrainzLook" width={918} height={188} className="h-5 w-auto" />
        <p>
          © 2026 {site.publisher}. Publisher: {site.publisher}.
        </p>
        <Link href="/lisensi" className="inline-flex min-h-11 items-center transition hover:text-text sm:ml-auto">
          Lisensi
        </Link>
      </div>
    </footer>
  );
}
