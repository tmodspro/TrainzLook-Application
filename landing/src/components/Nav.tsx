"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { DownloadButton } from "./ui";

const links = [
  ["#fitur", "Fitur"],
  ["#cara-kerja", "Cara kerja"],
  ["#faq", "FAQ"],
];

// The glass only appears once content scrolls under the nav: at the top there is nothing to separate it from.
export function Nav() {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setStuck(y > 8));
  return (
    <nav aria-label="Utama" className="sticky top-0 z-50 px-4 pt-3">
      <div
        className={`mx-auto flex max-w-6xl items-center gap-6 rounded-xl border px-4 py-1.5 transition-[background-color,border-color,backdrop-filter] duration-300 ${
          stuck ? "glass" : "border-transparent"
        }`}
      >
        <a href="#" aria-label="TrainzLook, ke atas halaman" className="flex min-h-11 items-center">
          <Image src="/brand/trainzlook-horizontal-dark.svg" alt="" width={918} height={188} className="h-6 w-auto" priority />
        </a>
        <ul className="ml-auto hidden gap-2 text-sm text-muted sm:flex">
          {links.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="flex min-h-11 items-center px-2 transition hover:text-text">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <DownloadButton className="ml-auto min-h-11 px-4 text-sm sm:ml-0" />
      </div>
    </nav>
  );
}
