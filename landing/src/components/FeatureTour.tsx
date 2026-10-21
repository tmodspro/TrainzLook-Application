import { tour } from "@/site";
import { AppMockup } from "@/mockup/AppMockup";
import { Frame } from "@/mockup/Frame";
import { tour as tourState } from "@/mockup/states";
import { TourDemo } from "./demo/Demo";
import { SectionHeading } from "./ui";

export function FeatureTour() {
  return (
    <section aria-labelledby="fitur-title" id="fitur" className="px-4 pt-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="fitur-title" eyebrow="Fitur" title="Semua yang dibutuhkan repainter, dalam satu jendela" />
        <TourDemo
          steps={tour}
          poster={
            <Frame label="TrainzLook setelah Replace: tekstur 1.jpg terpilih dan bagian TC1-8500 yang memakainya tersorot">
              <AppMockup state={tourState} />
            </Frame>
          }
        />
      </div>
    </section>
  );
}
