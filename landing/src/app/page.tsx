import { MoreFeatures } from "@/components/MoreFeatures";
import { Download } from "@/components/Download";
import { Faq } from "@/components/Faq";
import { FeatureTour } from "@/components/FeatureTour";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Workflow } from "@/components/Workflow";
import { site } from "@/site";

// What search engines read about the download; optional fields appear once site.ts has the real values.
const app = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  description: site.description,
  applicationCategory: "DesignApplication",
  operatingSystem: "Windows 10, Windows 11",
  softwareVersion: site.download.version,
  inLanguage: "id",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
  publisher: { "@type": "Organization", name: site.publisher },
  ...(site.url && { url: site.url }),
  ...(site.download.url && { downloadUrl: site.download.url }),
  ...(site.download.size && { fileSize: site.download.size }),
};

export default function Home() {
  return (
    <div className="page-bg">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(app).replace(/</g, "\u003c") }} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Lewati ke konten
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <FeatureTour />
        <MoreFeatures />
        <Workflow />
        <Download />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
