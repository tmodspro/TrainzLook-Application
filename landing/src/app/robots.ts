import type { MetadataRoute } from "next";
import { site } from "@/site";

export const dynamic = "force-static";

// The sitemap line waits for the site's real origin (site.url); a relative sitemap URL is invalid.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(site.url && { sitemap: `${site.url}/sitemap.xml` }),
  };
}
