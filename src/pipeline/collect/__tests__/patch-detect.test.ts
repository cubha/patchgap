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
  lolLiveKstOf,
  pubgPatchOfSteamTitle,
  telemetryLabelFor,
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

// 역산 재현이 잡은 불일치(2026-09-21 실측). `datePublished`는 **기사 발행 시각**이고 KR 라이브일이
// 아니다 — 26.16·26.17은 KST 수요일에 발행됐는데 캘린더 `liveKst`는 목요일이다.
//
//   26.16  발행 KST 08-12(수)  →  liveKst 08-13(목)
//   26.17  발행 KST 08-26(수)  →  liveKst 08-27(목)
//   26.18  발행 KST 09-10(목)  →  liveKst 09-10(목)
//
// 그대로 썼으면 시간창이 하루 일찍 닫혀 **직전 패치의 마지막 날 매치를 잃는다**(`endTime`은
// 다음 패치의 liveKst다). 이 저장소가 이미 적어 둔 관측 — "패치 라이브 요일이 전부 KST 목요일"
// (`collect.yml` cron 주석) — 을 규칙으로 쓴다: **발행일 이후(당일 포함) 첫 목요일**.
describe("lolLiveKstOf — 발행 시각 → KR 라이브일", () => {
  it("★ 커밋된 캘린더 3건을 전부 복원한다 — 이게 합격 기준이다", () => {
    expect(lolLiveKstOf("2026-08-11T18:00:00.000Z")).toBe("2026-08-13");
    expect(lolLiveKstOf("2026-08-25T18:00:00.000Z")).toBe("2026-08-27");
    expect(lolLiveKstOf("2026-09-09T18:00:00.000Z")).toBe("2026-09-10");
  });

  it("발행일이 이미 목요일이면 그날이다 — 다음 주로 밀지 않는다", () => {
    expect(lolLiveKstOf("2026-09-09T18:00:00.000Z")).toBe("2026-09-10");
  });

  it("목요일 직후(금요일) 발행이면 다음 목요일이다", () => {
    // KST 금요일 2026-09-11 발행 → 다음 목요일 09-17
    expect(lolLiveKstOf("2026-09-11T00:00:00.000Z")).toBe("2026-09-17");
  });
});

// PUBG 탐지는 **Steam 뉴스 피드**가 답이다(2026-09-21). PUBG 자체 API·웹사이트에는 신호가 없어
// 한때 "탐지 원천 불가"로 적었는데, 정작 Steam 게임이 공지를 내는 곳을 안 봤던 것이다.
// `api.steampowered.com/ISteamNews/GetNewsForApp`은 키가 필요 없고 구조화 JSON을 준다.
//
// 역산 재현 확인(실측): `Patch Notes - Update 42.3` → 2026-08-11 = 캘린더 liveFrom,
// `Patch Notes - Update 43.1` → 2026-09-09 = 캘린더 liveFrom. 2/2 일치.
describe("pubgPatchOfSteamTitle — Steam 공지 제목 → 패치 표기", () => {
  it("★ 패치노트 제목에서 버전을 뽑는다", () => {
    expect(pubgPatchOfSteamTitle("Patch Notes - Update 43.1")).toBe("43.1");
    expect(pubgPatchOfSteamTitle("Patch Notes - Update 42.3")).toBe("42.3");
  });

  it("앞뒤 공백을 허용한다", () => {
    expect(pubgPatchOfSteamTitle("  Patch Notes - Update 44.1  ")).toBe("44.1");
  });

  it("★ 같은 날 올라오는 이웃 공지를 집지 않는다 — 실측으로 섞여 있다", () => {
    expect(pubgPatchOfSteamTitle("Map Service Report - Update 43.1")).toBeNull();
    expect(pubgPatchOfSteamTitle("September Store Update 2026")).toBeNull();
    expect(pubgPatchOfSteamTitle("PEC: Fall Finals 1 Day 3 is LIVE!!")).toBeNull();
  });
});

describe("telemetryLabelFor — 직전 라벨에서 새 라벨을 만든다", () => {
  it("★ 메이저만 갈아 끼운다 — 연도 자리(2018)는 레거시 상수라 직전 것을 그대로 쓴다", () => {
    expect(telemetryLabelFor("pc-2018-43", "44.1")).toBe("pc-2018-44");
  });

  it("마이너는 라벨이 그대로다 — 텔레메트리가 마이너를 구분하지 않기 때문", () => {
    expect(telemetryLabelFor("pc-2018-43", "43.2")).toBe("pc-2018-43");
  });

  it("직전 라벨 형식이 아니면 null — 지어내지 않는다", () => {
    expect(telemetryLabelFor("nonsense", "44.1")).toBeNull();
  });
});
