import { site } from "@/site";
import { DownloadButton } from "./ui";

export function Download() {
  const d = site.download;
  const facts = [
    ["Versi", d.version],
    ["File", d.fileName],
    ["Ukuran", d.size],
    ["SHA-256", d.sha256],
  ].filter((f): f is [string, string] => f[1] !== null);

  return (
    // A second Signal Orange light: it marks the download as the page's goal.
    <section
      aria-labelledby="unduh-title"
      id="unduh"
      className="bg-[radial-gradient(40rem_20rem_at_50%_55%,rgb(255_138_0/0.12),transparent_70%)] px-4 py-24"
    >
      <div className="glass-card mx-auto grid max-w-4xl gap-10 rounded-[2rem] p-8 sm:p-12 md:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-semibold text-accent">Gratis dari {site.publisher}</p>
          <h2 id="unduh-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Unduh TrainzLook
          </h2>
          <p className="mt-4 text-pretty text-muted">Tanpa akun, tanpa langganan. Pasang, buka .im, mulai mengecat.</p>
          {d.url ? (
            <DownloadButton className="mt-8" />
          ) : (
            <p role="status" className="mt-8 rounded-lg border border-accent/40 px-4 py-3 text-sm">
              Tautan unduhan sedang disiapkan.
            </p>
          )}
        </div>
        <div className="space-y-6 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono break-all">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 font-semibold">Syarat sistem</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {site.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
