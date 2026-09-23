// src/app/__tests__/link-fragments.test.ts
// 내부 링크의 **프래그먼트가 실재하는지** 검사한다(2026-09-19).
//
// 실측 결함: `/methodology/#discord`를 가리키는 링크가 2곳 남아 있었는데, 그 섹션은 2026-09-14
// 사용자 지시로 제거됐다. 404가 아니라 페이지 최상단에 착지하므로 "왜 아무 일도 안 일어나지"를
// 겪을 뿐 아무 게이트도 울리지 않았다. 앵커 존재는 기계가 셀 수 있는 사실이므로 기계가 센다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { METHODOLOGY_SLOTS } from "@/components/methodology/slots";

const SRC = path.join(process.cwd(), "src");

/** 방법론 화면의 앵커는 9슬롯 registry가 소유한다(§8-4) — 화면 소스에 문자열로 나타나지 않는다. */
const METHODOLOGY_ANCHORS = new Set<string>(
  METHODOLOGY_SLOTS.flatMap((slot) => (slot.anchor === null ? [] : [slot.anchor]))
);

/** 해시가 DOM 앵커가 아니라 상태 키인 라우트 — 그 경우 프래그먼트는 페이지가 해석한다. */
// 2026-09-19: LoL이 `/lol` 접두를 받으면서 대조표 경로가 `/lol/compare/`로 옮겼다. 구 경로는
// vercel.json 리다이렉트가 받으므로 소스에는 더 이상 존재하지 않는다(legacy-redirects.test.ts).
// 2026-09-23 §8-3: TFT 대조표도 상태 칩을 갖게 되어 `#unannounced`가 착지한다.
const STATE_FRAGMENT_ROUTES = new Set(["/lol/compare/", "/tft/compare/", "/pubg/compare/"]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** `/route/#fragment` 형태의 내부 링크를 전부 뽑는다. */
function collectLinks(): { file: string; route: string; fragment: string }[] {
  const found: { file: string; route: string; fragment: string }[] = [];
  for (const file of walk(SRC)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/href=\{?["'`](\/[^"'`\s{}]*?)#([^"'`\s{}]+)["'`]/g)) {
      found.push({ file: path.relative(process.cwd(), file), route: match[1], fragment: match[2] });
    }
  }
  return found;
}

/**
 * 주석을 지운다. 이게 없으면 검사가 **거짓 통과**한다 — methodology/page.tsx의 헤더 주석에
 * `id="discord"` 섹션을 제거했다는 설명이 적혀 있어서, 존재하지 않는 앵커가 존재하는 것처럼
 * 잡혔다(이 테스트를 처음 돌렸을 때 실제로 그랬다).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** 한 화면이 거쳐서라도 그리는 소스 전부 — `@/…` 임포트를 깊이 제한으로 따라간다. */
function closureOf(entry: string, depth: number, seen = new Set<string>()): string {
  if (seen.has(entry) || !fs.existsSync(entry)) return "";
  seen.add(entry);
  const source = stripComments(fs.readFileSync(entry, "utf8"));
  if (depth === 0) return source;
  let out = source;
  for (const match of source.matchAll(/from\s+"(@\/[^"]+)"/g)) {
    const base = path.join(process.cwd(), match[1].replace(/^@\//, "src/"));
    for (const ext of [".tsx", ".ts"]) {
      if (fs.existsSync(base + ext)) {
        out += "\n" + closureOf(base + ext, depth - 1, seen);
        break;
      }
    }
  }
  return out;
}

/** 라우트 → 그 페이지 소스 경로(정적 export 규약: /a/b/ → src/app/a/b/page.tsx). */
function pageSourceOf(route: string): string {
  const segments = route.split("/").filter((s) => s.length > 0);
  return path.join(SRC, "app", ...segments, "page.tsx");
}

describe("내부 링크 프래그먼트", () => {
  const links = collectLinks();

  it("검사 대상 링크를 실제로 수집한다(정규식이 죽으면 테스트가 공회전한다)", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it("가리키는 앵커가 대상 페이지에 존재한다", () => {
    const dead = links.filter((link) => {
      if (STATE_FRAGMENT_ROUTES.has(link.route)) return false;
      const source = pageSourceOf(link.route);
      if (!fs.existsSync(source)) return true;
      // 앵커가 **소스에 문자열로 없을 수 있다**(2026-09-23): 방법론은 9슬롯 골격이
      // `id={slot.anchor}`로 그리므로 grep으로는 영원히 못 찾는다. 그 경우 **앵커의 소유자**
      // (`slots.ts`)에게 묻는다 — 슬롯에서 앵커를 지우면 여기서 죽은 링크로 잡힌다.
      if (/\/methodology\/$/.test(link.route)) return !METHODOLOGY_ANCHORS.has(link.fragment);
      return !closureOf(source, 3).includes(`id="${link.fragment}"`);
    });
    expect(dead.map((d) => `${d.file} → ${d.route}#${d.fragment}`)).toEqual([]);
  });
});
