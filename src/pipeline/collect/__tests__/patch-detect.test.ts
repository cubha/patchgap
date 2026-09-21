// src/pipeline/collect/__tests__/patch-detect.test.ts
// RED 먼저 — 감시자가 쓰는 **탐지 규칙**. fetch는 스크립트가 하고 여기는 순수 판정만 한다.
//
// 합격 기준은 **역산 재현**이다(CDragon 추출기와 같은 규율): 손으로 적어 둔 캘린더 값을
// 패치노트 페이지에서 그대로 복원할 수 있어야 한다. 실측으로 확인한 사실이 근거다 —
//   LoL  26.18 `datePublished` 2026-09-09T18:00:00.000Z → KST 2026-09-10 = liveKst 그대로
//   TFT  18.2  `datePublished` 2026-09-09T18:00:00.000Z = TFT_PATCH_WINDOWS[1].startMs 그대로
// 즉 날짜를 "탐지한 날"로 추측할 필요가 없다. 페이지가 정확한 값을 준다.
import { describe, it, expect } from "vitest";

import {
  nextPatchCandidates,
  extractDatePublished,
  kstDateOf,
  pubgPatchOfLabel,
  telemetryMajor,
} from "../patch-detect";

describe("nextPatchCandidates — 다음 후보 둘(마이너 +1, 메이저 롤오버)", () => {
  it("★ 롤오버를 놓치지 않는다 — 26.24 다음은 26.25가 아니라 27.1일 수 있다", () => {
    expect(nextPatchCandidates("26.24")).toEqual(["26.25", "27.1"]);
  });

  it("TFT도 같은 규칙이다 — 세트가 넘어가면 19.1", () => {
    expect(nextPatchCandidates("18.2")).toEqual(["18.3", "19.1"]);
  });

  it("마이너가 1이어도 후보는 둘이다", () => {
    expect(nextPatchCandidates("43.1")).toEqual(["43.2", "44.1"]);
  });
});

describe("extractDatePublished — 페이지에서 발행 시각을 읽는다", () => {
  it("JSON-LD의 datePublished를 집는다", () => {
    const html = `<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-09-09T18:00:00.000Z"}</script>`;
    expect(extractDatePublished(html)).toBe("2026-09-09T18:00:00.000Z");
  });

  it("★ 첫 번째 datePublished만 쓴다 — 같은 페이지에 다른 글의 publishedAt이 여럿 섞여 있다", () => {
    const html = `{"datePublished":"2026-09-09T18:00:00.000Z"} … {"publishedAt":"2026-08-25T18:00:00.000Z"}`;
    expect(extractDatePublished(html)).toBe("2026-09-09T18:00:00.000Z");
  });

  it("없으면 null — 호출부가 던진다(추측한 날짜를 캘린더에 넣지 않는다)", () => {
    expect(extractDatePublished("<html>아무것도 없음</html>")).toBeNull();
  });

  it("형식이 ISO가 아니면 null", () => {
    expect(extractDatePublished(`{"datePublished":"어제"}`)).toBeNull();
  });
});

describe("kstDateOf — 발행 시각 → liveKst", () => {
  it("★ 커밋된 캘린더를 그대로 복원한다 — LoL 26.18 = 2026-09-10", () => {
    expect(kstDateOf("2026-09-09T18:00:00.000Z")).toBe("2026-09-10");
  });

  it("KST 자정 직전·직후가 갈린다", () => {
    expect(kstDateOf("2026-09-09T14:59:59.000Z")).toBe("2026-09-09");
    expect(kstDateOf("2026-09-09T15:00:00.000Z")).toBe("2026-09-10");
  });
});

describe("PUBG — 텔레메트리 라벨", () => {
  it("라벨에서 메이저를 읽는다", () => {
    expect(telemetryMajor("pc-2018-43")).toBe(43);
  });

  it("★ 라벨은 메이저까지만 담는다 — 표기는 언제나 {메이저}.1이다", () => {
    expect(pubgPatchOfLabel("pc-2018-44")).toBe("44.1");
  });

  it("형식이 아니면 null", () => {
    expect(telemetryMajor("pc-2018")).toBeNull();
    expect(pubgPatchOfLabel("nonsense")).toBeNull();
  });
});
