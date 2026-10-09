// src/lib/__tests__/pubgDeclaration.test.ts
// PUBG 선언 축의 출처 규칙(PLAN-home-observed-pair ST-9, 2026-10-09). stub은 `declaration.json`에 따로 살고(관측 `deltas.json`
// 보존), 관측이 그 쌍을 따라잡으면 stub은 낡은 것이다. 로더는 cwd 고정 경로를 읽어 갈아끼울 수 없으므로 **선택 규칙**만 순수
// 함수로 떼어 고정한다(tftLatestPair.test와 같은 방식).
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { pickPubgDeclaration } from "@/lib/pubgData";

const stub = (from: string, to: string) => ({ from, to, generatedAt: "2026-10-09T00:00:00Z", observationFailed: { reason: "awaiting-observation" as const, detail: "", at: "2026-10-09T00:00:00Z" } });

describe("pickPubgDeclaration — 어느 stub이 「선언만 쌍」인가", () => {
  it("관측 쌍보다 새 stub만 선언만 쌍이다", () => {
    expect(pickPubgDeclaration({ from: "42.3", to: "43.1" }, stub("43.1", "43.2"))?.to).toBe("43.2");
  });
  it("관측이 그 쌍을 따라잡았으면(같거나 더 새 to) stub은 낡았다 — null", () => {
    expect(pickPubgDeclaration({ from: "43.1", to: "43.2" }, stub("43.1", "43.2"))).toBeNull();
    expect(pickPubgDeclaration({ from: "43.2", to: "43.3" }, stub("43.1", "43.2"))).toBeNull();
  });
  it("관측이 없으면 stub이 곧 선언 축(홈이 선언 뷰)", () => {
    expect(pickPubgDeclaration(null, stub("43.1", "43.2"))?.to).toBe("43.2");
  });
  it("옛 배치: deltas.json 자체가 stub이면(관측 없음) 그것이 선언 축", () => {
    expect(pickPubgDeclaration(stub("43.1", "43.2"), null)?.to).toBe("43.2");
  });
  it("둘 다 없으면 null", () => {
    expect(pickPubgDeclaration(null, null)).toBeNull();
  });
});
