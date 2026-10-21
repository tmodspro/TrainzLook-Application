import { site } from "@/site";
import { AppMockup } from "@/mockup/AppMockup";
import { Frame } from "@/mockup/Frame";
import { hero } from "@/mockup/states";
import { HeroDemo } from "./demo/Demo";
import { DownloadButton } from "./ui";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pt-20 pb-16 sm:pt-28">
      <div className="mx-auto max-w-6xl text-center">
        <p className="mb-6 text-sm font-medium text-muted">
          <span className="text-accent">Gratis</span> · Windows 10/11 · Publisher {site.publisher}
        </p>
        <h1 id="hero-title" className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {site.tagline}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted">
          Viewer mesh <span className="font-mono text-text">.im</span> bergaya Blender untuk repainter Trainz. Simpan tekstur
          dari Photoshop atau GIMP, keretanya langsung berubah di layar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <DownloadButton />
          <a href="#fitur" className="btn-glass">
            Lihat demo fiturnya
          </a>
        </div>
        <HeroDemo
          className="mt-16 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10"
          poster={
            <Frame label="Jendela TrainzLook dengan kereta TC1-8500 Indorails terbuka: outliner, viewport 3D, texture browser, dan status bar">
              <AppMockup state={hero} eager />
            </Frame>
          }
        />
      </div>
    </section>
  );
}
