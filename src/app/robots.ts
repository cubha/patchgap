// src/app/robots.ts — robots.txt(ST-1, 2026-10-11 site-review lol-S28·tft-S26·pubg-S25). 전에는 404였다.
// 정적 export에서 메타 라우트는 빌드 때 한 번 파일로 굳는다(`force-static`).
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
