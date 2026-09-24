import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SKIP_ACTION, reportRun, reportSkip, type SkipReason } from "../determine-report";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const DETERMINE_SCRIPTS = ["scripts/lol-determine.ts", "scripts/pubg-determine.ts", "scripts/tft-determine.ts"];

describe("스킵 사유 어휘", () => {
  it("모든 사유가 **조치**를 갖는다", () => {
    // 표의 값은 문구가 아니라 "누가 무엇을 해야 하는가"다. 조치가 없는 사유는 로그와 같다 —
    // 읽어도 다음에 뭘 할지 모른다.
    const reasons: SkipReason[] = ["no-run-condition", "key-missing", "key-expired", "product-unapproved"];
    for (const r of reasons) expect(SKIP_ACTION[r]).toBeTruthy();
    expect(Object.keys(SKIP_ACTION).sort()).toEqual([...reasons].sort());
  });

  it("사람이 할 일이 있는 사유와 없는 사유가 갈려 있다", () => {
    // 403(심사 대기)에 「조치 필요」가 붙으면 사람이 매일 헛걸음한다. 401(만료)에 「불필요」가
    // 붙으면 영영 안 고친다. 두 실수가 정반대라 어휘 단계에서 갈라 둔다.
    expect(SKIP_ACTION["product-unapproved"]).toContain("불필요");
    expect(SKIP_ACTION["no-run-condition"]).toContain("불필요");
    expect(SKIP_ACTION["key-expired"]).toContain("필요");
    expect(SKIP_ACTION["key-missing"]).toContain("필요");
  });
});

describe("판정 보고", () => {
  let dir: string;
  let outFile: string;
  let sumFile: string;
  const saved = { out: process.env.GITHUB_OUTPUT, sum: process.env.GITHUB_STEP_SUMMARY };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "determine-report-"));
    outFile = path.join(dir, "out.txt");
    sumFile = path.join(dir, "summary.md");
    fs.writeFileSync(outFile, "");
    fs.writeFileSync(sumFile, "");
    process.env.GITHUB_OUTPUT = outFile;
    process.env.GITHUB_STEP_SUMMARY = sumFile;
  });

  afterEach(() => {
    if (saved.out === undefined) delete process.env.GITHUB_OUTPUT;
    else process.env.GITHUB_OUTPUT = saved.out;
    if (saved.sum === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = saved.sum;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("스킵은 사유를 **출력과 요약 양쪽에** 남긴다", () => {
    reportSkip("tft", "product-unapproved", "TFT 프리플라이트 403 — 이 키에 TFT 제품 권한이 없다.");
    const out = fs.readFileSync(outFile, "utf8");
    expect(out).toContain("should_run=false");
    expect(out).toContain("skip_reason=product-unapproved");

    // 요약이 load-bearing이다 — 로그는 펼쳐야 보이고, run 페이지 첫 화면은 펼치지 않아도 보인다.
    const summary = fs.readFileSync(sumFile, "utf8");
    expect(summary).toContain("product-unapproved");
    expect(summary).toContain("403");
    expect(summary).toContain(SKIP_ACTION["product-unapproved"]);
  });

  it("수집 진행도 같은 자리에 적는다", () => {
    // 「돌았다」와 「안 돌았다」가 다른 자리에 적히면, 아무것도 없는 요약이 둘 중 무엇인지 모른다.
    reportRun("lol", { patch: "26.19", from: "26.18", to: "26.19" });
    const out = fs.readFileSync(outFile, "utf8");
    expect(out).toContain("should_run=true");
    expect(out).toContain("skip_reason=");
    expect(fs.readFileSync(sumFile, "utf8")).toContain("26.18 → 26.19");
  });
});

describe("게이트 — 사유 없는 스킵을 막는다", () => {
  it("determine 스크립트는 should_run=false를 직접 쓰지 않는다", () => {
    // `reportSkip`의 시그니처가 사유를 필수로 받으므로, 그것을 **거치기만 하면** 사유 없는
    // 스킵은 타입에서 막힌다. 여기서 막는 것은 그 우회 — 원시 emit으로 되돌아가는 것이다.
    // (2026-09-24 실측: TFT 실행이 determine 성공 + 이후 전부 skipped + 결론 success로 끝났고,
    //  왜인지는 로그를 열어야만 알 수 있었다.)
    const offenders: string[] = [];
    for (const f of DETERMINE_SCRIPTS) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      if (/should_run:\s*"false"/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("세 게임 모두 공용 보고 모듈을 쓴다", () => {
    for (const f of DETERMINE_SCRIPTS) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(src).toMatch(/from "\.\/shared\/determine-report"/);
      expect(src).toMatch(/reportSkip\(/);
      expect(src).toMatch(/reportRun\(/);
    }
  });

  it("emit·warn 헬퍼가 다시 복제되지 않는다", () => {
    // 이 셋에 각각 박혀 있던 것을 흡수했다. 복제된 규칙은 반드시 하나가 어긋난다
    // (`ExternalLink`·`panelScroll`·`BriefingTabs`가 같은 이유로 공용화됐다).
    for (const f of DETERMINE_SCRIPTS) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(src).not.toMatch(/^function (emit|warn)\(/m);
    }
  });
});
