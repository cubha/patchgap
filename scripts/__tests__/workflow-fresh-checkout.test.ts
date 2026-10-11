// 대기열 실행의 낡은 체크아웃 가드(2026-10-11, run 38097140647). 수집 워크플로 넷은 같은 동시 실행 그룹(`patchgap-collect`)이라 줄을 서는데,
// `actions/checkout` 기본값은 **이벤트 SHA**(예약 시점의 main)를 받는다. 줄 선 동안 앞 실행이 데이터를 커밋하면 뒤 실행은 낡은 트리에서
// 판정하고 같은 파일을 다시 써 `git pull --rebase`에서 충돌했다(06:00 정기 실행 실패). 앞 실행이 이미 관측을 넣었다면 낡은 트리의
// stub이 그걸 덮을 수도 있었다 — 그래서 충돌을 "이번 쪽 우선"으로 자동 해소하지 않고, 체크아웃을 **잡 시작 시점의 브랜치 끝**으로 바꾼다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const workflows = fs.readdirSync(path.join(process.cwd(), ".github/workflows")).filter((f) => f.endsWith(".yml"));

/** checkout 스텝 블록 — `uses: actions/checkout@`부터 다음 스텝 전까지. */
function checkoutBlocks(src: string): string[] {
  return src
    .split(/\n {6}- /)
    .filter((s) => s.includes("uses: actions/checkout@"));
}

describe("워크플로 — push하는 실행은 브랜치 끝을 체크아웃한다(이벤트 SHA 아님)", () => {
  const pushing = workflows.filter((f) => /git push(?! --dry-run)/.test(read(`.github/workflows/${f}`)));

  it("데이터를 push하는 워크플로가 넷이다(collect·collect-tft·collect-pubg·patch-watch) — 새로 생기면 이 가드 대상", () => {
    expect(pushing.sort()).toEqual(["collect-pubg.yml", "collect-tft.yml", "collect.yml", "patch-watch.yml"]);
  });

  for (const wf of pushing) {
    it(`${wf}: 모든 checkout이 ref: \${{ github.ref_name }}`, () => {
      const blocks = checkoutBlocks(read(`.github/workflows/${wf}`));
      expect(blocks.length).toBeGreaterThan(0);
      for (const b of blocks) expect(b).toMatch(/^\s+ref: \$\{\{ github\.ref_name \}\}$/m);
    });
  }
});
