// src/app/__tests__/tft-assets.test.ts
// TFT 엔티티 자산이 **실재하는지** 센다(§8-7 말미 자기모순의 게이트).
//
// 랜딩 확장성 표가 TFT 「엔티티 자산 = 연결됨」이라 주장하는데 화면의 이미지가 0건이던 상태를
// 아무 게이트도 잡지 못했다 — 표는 문자열이고, 문자열은 거짓말을 할 수 있다. 이제 매니페스트와
// 실제 파일을 대조한다: 표가 말한 수가 곧 디스크에 있는 수여야 한다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { publicTftAssetPath, type TftAssetManifest } from "@/pipeline/tft/asset-path";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const MANIFEST = path.join(ROOT, "data/aggregated/tft/assets.json");

const manifest = (): TftAssetManifest | null =>
  fs.existsSync(MANIFEST) ? (JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as TftAssetManifest) : null;

describe("TFT 엔티티 자산", () => {
  it("매니페스트가 있다 — 없으면 화면이 전부 폴백 박스로 떨어진다", () => {
    expect(manifest(), "npx tsx scripts/run-tft-assets.ts 를 실행한다").not.toBeNull();
  });

  it("매니페스트가 가진 것으로 적은 파일이 전부 실재한다", () => {
    const m = manifest();
    if (!m) return;
    const missing: string[] = [];
    for (const kind of ["unit", "trait", "item"] as const) {
      for (const key of m.assets[kind]) {
        const file = path.join(ROOT, "public", publicTftAssetPath(kind, key));
        if (!fs.existsSync(file) || fs.statSync(file).size === 0) missing.push(`${kind}/${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("유닛 스플래시가 실제로 있다 — 「TFT는 이미지가 0건」 상태로 되돌아가지 않는다", () => {
    const m = manifest();
    if (!m) return;
    expect(m.assets.unit.length).toBeGreaterThan(30);
  });

  it("못 받은 항목은 숨기지 않고 사유와 함께 적는다", () => {
    const m = manifest();
    if (!m) return;
    for (const item of m.missing) {
      expect(item.reason.length, `${item.kind}/${item.key}`).toBeGreaterThan(0);
    }
  });
});
