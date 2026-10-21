import { site } from "@/site";
import { Reveal } from "./Reveal";

// Goes straight to the installer once it has a URL; until then to the #unduh section.
export function DownloadButton({ className = "" }: { className?: string }) {
  const { url, fileName } = site.download;
  return (
    <a href={url ?? "#unduh"} download={url ? fileName : undefined} className={`btn-glass btn-primary ${className}`}>
      Unduh gratis
    </a>
  );
}

export function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <Reveal className="mb-10 max-w-2xl">
      <p className="mb-3 text-sm font-semibold text-accent">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
    </Reveal>
  );
}
