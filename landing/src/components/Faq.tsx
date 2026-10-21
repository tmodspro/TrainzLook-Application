import { faq } from "@/site";
import { SectionHeading } from "./ui";

// Native <details>: keyboard and screen-reader support without a component library.
export function Faq() {
  return (
    <section aria-labelledby="faq-title" id="faq" className="px-4 py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Pertanyaan yang sering muncul" />
        <div className="space-y-3">
          {faq.map(({ q, a }) => (
            <details key={q} className="glass-card group rounded-2xl">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-accent transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-pretty text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
