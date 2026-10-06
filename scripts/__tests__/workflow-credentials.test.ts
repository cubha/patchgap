// 쓰기 토큰 노출 범위 가드(2026-10-06 /analyze 🟡). 워크플로들은 RIOT·ANTHROPIC 키를 "npm ci의 postinstall이
// 읽을 수 있다"는 이유로 스텝 env로 내렸는데, contents:write `GITHUB_TOKEN`은 checkout 기본값(persist-credentials)
// 때문에 .git/config에 평문으로 남아 같은 위협에 열려 있었다. 토큰은 push 스텝에서만 붙는다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const HEADER = "http.https://github.com/.extraheader";

describe("워크플로 — 쓰기 토큰은 push 스텝에서만", () => {
  for (const wf of ["ci", "collect", "collect-tft", "collect-pubg", "patch-watch"]) {
    const src = read(`.github/workflows/${wf}.yml`);
    it(`${wf}: checkout이 토큰을 .git/config에 남기지 않는다`, () => {
      const checkouts = src.split("uses: actions/checkout@v4").length - 1;
      expect(checkouts).toBeGreaterThan(0);
      expect(src.match(/^ +persist-credentials: false$/gm)?.length ?? 0).toBe(checkouts);
    });
  }

  for (const wf of ["collect", "collect-tft", "collect-pubg", "patch-watch"]) {
    const src = read(`.github/workflows/${wf}.yml`);
    it(`${wf}: 헤더 주입은 git push가 있는 스텝에만 있다`, () => {
      const steps = src.split(/\n {6}- name: /).slice(1);
      const withHeader = steps.filter((s) => s.includes(HEADER));
      expect(withHeader.length).toBeGreaterThan(0);
      for (const s of withHeader) {
        expect(s).toMatch(/git push/);
        expect(s).toContain("GH_TOKEN: ${{ github.token }}");
      }
      // push가 있는 스텝은 전부 헤더를 붙인다 — 하나라도 빠지면 그 push는 인증 없이 거절된다.
      for (const s of steps.filter((x) => /git push/.test(x))) expect(s).toContain(HEADER);
    });
  }

  it("patch-watch: 매일 push 인증을 확인하는 카나리아가 있다(수집 push는 패치 날에만 돈다)", () => {
    const src = read(".github/workflows/patch-watch.yml");
    const canary = src.slice(src.indexOf("- name: Push auth canary"));
    expect(canary).toContain("git push --dry-run");
  });
});
