import type { MetadataRoute } from "next";
import { site } from "@/site";

export const dynamic = "force-static";

// Empty until site.url is known: sitemap entries must be absolute.
export default function sitemap(): MetadataRoute.Sitemap {
  return site.url ? [{ url: site.url }, { url: `${site.url}/lisensi` }] : [];
}
