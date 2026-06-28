import type { MetadataRoute } from "next";
import { config } from "@site.config";
import { getAllMembers } from "@/lib/members";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const root = config.siteRoot.replace(/\/$/, "");
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${root}/`, lastModified: now },
    { url: `${root}/about/`, lastModified: now },
    { url: `${root}/members/`, lastModified: now },
  ];
  const members = getAllMembers().map((m) => ({
    url: `${root}/members/${m.id}/`,
    lastModified: now,
  }));
  return [...base, ...members];
}
