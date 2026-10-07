// src/styles/__tests__/status-contrast.test.ts
// 상태 색 4종은 세 게임 테마가 **공유**한다(tokens.css 「상태 4종은 재정의 금지」 불변식). 그래서 한 게임 바탕에서만 재면
// 다른 게임에서 깨진다 — 2026-10-07 실측: `--danger #cf4740`이 11px 굵은 뱃지(「공지 · 이상 관측」)로 세 게임 바탕 모두에서
// 4.31~4.35:1(AA 4.5:1 미달)이었고, 레이아웃 게이트가 TFT 상세에서 처음 표본에 잡았다. 값 보정(#d45b54)이 다시 어두워지거나
// 게임 바탕이 바뀌어 미달이 되면 여기서 실패한다. 브라우저 없이 tokens.css만 읽는다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve(__dirname, "..", "tokens.css"), "utf8");

/** 선택자 블록 안의 `--name: #hex;` 선언만 모은다(color-mix 같은 파생값은 대상 아님). */
function hexVars(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`선택자 없음: ${selector}`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const root = hexVars(":root");
const themes: Record<string, Record<string, string>> = {
  lol: root,
  tft: { ...root, ...hexVars(':root:has([data-game="tft"])') },
  pubg: { ...root, ...hexVars(':root:has([data-game="pubg"])') },
};

describe("상태 색 대비 — 세 게임 바탕 모두에서 AA(4.5:1)", () => {
  // --warn(표본 부족)은 화면에 렌더하지 않는 상태 전용이라(방법론 정의표만) 여기서 재지 않는다.
  for (const token of ["--danger", "--accent", "--success"]) {
    for (const [game, vars] of Object.entries(themes)) {
      for (const surface of ["--bg", "--surface"]) {
        it(`${token} on ${game} ${surface}`, () => {
          const fg = root[token];
          const bg = vars[surface];
          expect(fg, `${token} 값`).toMatch(/^#/);
          expect(bg, `${game} ${surface} 값`).toMatch(/^#/);
          expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
