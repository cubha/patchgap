// src/app/sitemap.ts — sitemap.xml(ST-1, 2026-10-11 site-review lol-S28·tft-S26·pubg-S25). 전에는 404였다.
// 주소 목록은 `lib/sitemap.ts`가 소유한다(라우트와 같은 자격 함수).
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/meta";
import { sitemapPaths } from "@/lib/sitemap";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths().map((path) => ({ url: absoluteUrl(path) }));
}
