import type { MetadataRoute } from "next";
import { config } from "@site.config";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const root = config.siteRoot.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${root}/sitemap.xml`,
  };
}
