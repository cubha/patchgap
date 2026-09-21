// src/pipeline/gamedata/__tests__/snapshot-version.test.ts
// RED 먼저 — **버전 짝을 CI가 스스로 찾을 수 있어야** F9가 cron에 올라간다(2026-09-21).
//
// 지금까지 `run-gamedata-diff`는 `--version-from/--version-to`(DDragon·CDragon 버전)를 사람이
// 손으로 줬다. cron은 "지금 라이브인 패치"만 알고 게임 버전은 모른다 — 패치 번호(26.19·18.3)와
// 게임 버전(16.19.1·16.19)의 대응은 규칙이 아니라 사실이라 계산할 수 없다.
//
// 그런데 그 사실은 **이미 커밋돼 있다**: 직전 쌍의 산출물 `meta.source.to`가 곧 이번 쌍의
// `versionFrom`이다(실측: lol/26.17_26.18.json의 source.to = "16.18.1"). `versionTo`는 같은 잡의
// 앞 스텝이 방금 받아 놓은 **가장 새 스냅숏 디렉터리**다. 여기 두 순수 함수가 그 둘을 고른다.
import { describe, it, expect } from "vitest";

import { newestVersion, diffFileEndingAt } from "../snapshot-version";

describe("newestVersion — 스냅숏 디렉터리 중 가장 새 버전", () => {
  it("★ 숫자로 센다 — 문자열 정렬이면 16.9.1이 16.18.1을 이긴다", () => {
    expect(newestVersion(["16.9.1", "16.18.1", "16.17.1"])).toBe("16.18.1");
  });

  it("마이너만 있는 라벨(CDragon)도 같은 규칙이다", () => {
    expect(newestVersion(["16.17", "16.18", "16.9"])).toBe("16.18");
  });

  it("자릿수가 다르면 없는 자리는 0으로 본다", () => {
    expect(newestVersion(["16.18", "16.18.1"])).toBe("16.18.1");
  });

  it("버전처럼 생기지 않은 이름은 후보가 아니다", () => {
    expect(newestVersion(["patch-versions.json", "tmp", "16.17.1"])).toBe("16.17.1");
  });

  it("후보가 없으면 null — 호출부가 던질 수 있게 한다", () => {
    expect(newestVersion([])).toBeNull();
    expect(newestVersion(["tmp"])).toBeNull();
  });
});

describe("diffFileEndingAt — 그 패치를 `to`로 삼은 직전 산출물", () => {
  const FILES = ["26.16_26.17.json", "26.17_26.18.json"];

  it("`{from}_{patch}.json`을 고른다", () => {
    expect(diffFileEndingAt(FILES, "26.18")).toBe("26.17_26.18.json");
  });

  it("★ 패치를 건너뛰어도 직전 쌍을 찾는다 — 26.18→26.20의 앞은 26.17_26.18이다", () => {
    expect(diffFileEndingAt(FILES, "26.18")).toBe("26.17_26.18.json");
    expect(diffFileEndingAt(FILES, "26.20")).toBeNull();
  });

  it("그 패치가 `from`인 쌍은 고르지 않는다 — 방향을 뒤집으면 버전이 한 칸 밀린다", () => {
    expect(diffFileEndingAt(["26.18_26.19.json"], "26.18")).toBeNull();
  });

  it("같은 `to`가 여럿이면 `from`이 가장 나중인 것을 고른다", () => {
    const picked = diffFileEndingAt(["26.16_26.18.json", "26.17_26.18.json"], "26.18");
    expect(picked).toBe("26.17_26.18.json");
  });

  it("없으면 null", () => {
    expect(diffFileEndingAt([], "26.18")).toBeNull();
  });
});
