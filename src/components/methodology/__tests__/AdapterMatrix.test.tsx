// src/components/methodology/__tests__/AdapterMatrix.test.tsx
// 어댑터 매핑표(ST-L) 렌더 검증 — HANDOFF §4-4 요구사항: 계층 전부 렌더 · PUBG 수집
// 수치 0 명시 · 판정 엔진 게임 무관 고지 · 라인별 밴률 컬럼 등 §6 금지 항목이 섞여 들지 않음.
// 2026-09-10(verify-impl 축B): 4열이 "PUBG 상태" → "어댑터 인터페이스"로 바뀌고 판정 엔진이
// 표 밖 문단 → 9번째 행이 됐다(시안 구조). 어서션도 그 명세로 갱신한다.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import AdapterMatrix from "../AdapterMatrix";
import { ADAPTER_MATRIX } from "../adapterMatrixData";
import { GAMES, gameLabel } from "@/lib/game";

describe("AdapterMatrix", () => {
  it("9개 계층(어댑터 8 + 판정 엔진)을 모두 렌더한다", () => {
    const { container } = render(<AdapterMatrix />);
    expect(ADAPTER_MATRIX.length).toBe(9);
    for (const row of ADAPTER_MATRIX) {
      expect(container.textContent).toContain(row.layer);
    }
  });

  it("주 엔티티 행은 챔피언↔무기를 매핑한다", () => {
    const { container } = render(<AdapterMatrix />);
    expect(container.textContent).toContain("챔피언");
    expect(container.textContent).toContain("무기");
  });

  // 2026-09-16 명세 변경 — SCOPE Won't 해제로 PUBG가 실연결됐다(/pubg/). "수집 수치 0건"은
  // 데이터가 커밋된 시점부터 거짓이라 어서션을 사실에 맞춰 갱신한다(테스트 약화가 아니라 명세 반영).
  it("PUBG 실연결 고지와 판정 엔진 공유 범위를 렌더한다", () => {
    const { container } = render(<AdapterMatrix />);
    // 2026-09-18 명세 변경(ST-7): 개발자 메모 톤("실연결 완료 … 판정했다")을 사용자 문장으로 —
    // 사실(실제 수집·집계·판정)은 그대로 어서션한다.
    // 2026-09-20: "PUBG는 … 실제로 수집·집계·판정했습니다 / 결과 보기 →" 문단은 표가 랜딩으로
    // 옮겨오며 뺐다(바로 위 게임 패널이 패치 쌍·표본·링크를 이미 보여주고, 한 게임만 이름으로
    // 지목하는 문장이라 게임이 늘면 낡는다). 그 사실은 열 머리글이 계속 말하므로 거기서 단언한다.
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads.some((h) => h?.includes("실연결"))).toBe(true);
    expect(container.textContent).not.toContain("수집 수치: 0건");
    expect(container.textContent).toContain("판정 엔진");
    // 2026-10-06 명세 변경: 「게임 무관」은 과장이었다 — PUBG는 BH-FDR·Newcombe 대신 자체 바닥·로그비 CI를
    // 쓴다(/pubg/methodology). 이제 공유 범위(판정 어휘·LLM 2단은 세 게임, 통계 게이트는 LoL·TFT)를 그대로 말한다.
    expect(container.textContent).toContain("세 게임 공유");
    expect(container.textContent).toContain("PUBG는 자체 효과크기 바닥");
  });

  // 2026-09-20 명세 변경: 열이 GAMES 레지스트리에서 나온다. 머리글 이름도 gameLabel()이 주므로
  // "PUBG"가 아니라 사이트 전체가 쓰는 "배틀그라운드"다 — 표만 다른 명칭을 쓰지 않게 한 것이다.
  // 게임 이름을 테스트에 박지 않는 이유는 화면과 같다: 게임이 늘면 단언도 따라 늘어야 한다.
  it("게임마다 열이 하나씩 생기고 머리글이 연결 상태를 명시한다", () => {
    const { container } = render(<AdapterMatrix />);
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    // 계층 + 게임 수 + 어댑터 인터페이스
    expect(heads).toHaveLength(GAMES.length + 2);
    for (const game of GAMES) {
      expect(heads.some((h) => h?.startsWith(gameLabel(game.id)))).toBe(true);
    }
    // 2026-09-23 **명세 변경**(UX-BRIEF §8-5): 패치 쌍 기호를 `→`로 통일했다. `⇒`는 패치노트가
    // 적은 값(`115 ⇒ 120`) 전용이라 두 뜻이 겹치고 있었다 — 테스트 약화가 아니라 어휘 반영이다.
    // 2026-09-27 **명세 변경**: 머리글에서 패치 쌍을 뺐다 — 수기 상수라 TFT가 18.3으로 넘어간 뒤에도
    // 「18.1 → 18.2」라고 말하고 있었다(패치마다 낡는 문장). 쌍은 위 패널들이 산출물에서 읽는다.
    expect(heads.some((h) => h?.includes("실연결"))).toBe(true);
    expect(heads.some((h) => /\d+\.\d+\s*→/.test(h ?? ""))).toBe(false);
    expect(heads).not.toContain("PUBG (어댑터 확정 · 미연결)");
  });

  // 2026-10-06 **명세 변경(사용자 결정 "문구 고치고 필요하면 구현")**: 이 테스트는 코드에 없는 인터페이스
  // 이름(NoteSource.fetch() 등)이 노출되는지를 고정하고 있었다 — 표가 "확인된 사실만"이라는 자기 원칙을 어긴
  // 문구를 테스트가 지키던 셈이다. 이제 반대로 **실재하는 이름만** 노출되는지와 옛 가공 이름이 돌아오지 않는지를 본다.
  it("마지막 열은 공유 코드이고 코드에 실재하는 이름만 노출한다", () => {
    const { container } = render(<AdapterMatrix />);
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads[heads.length - 1]).toBe("공유 코드");
    for (const name of ["PatchNoteItem", "DeltaRecord.entityType", "DeltaMetric", "verdict.ts", "llm-match.ts"]) {
      expect(container.textContent).toContain(name);
    }
    for (const fiction of ["NoteSource", "MatchSource", "AssetSource", "Segment[]", "Metric.adoption", "어댑터 8줄"]) {
      expect(container.textContent).not.toContain(fiction);
    }
  });

  it("판정 엔진은 표 밖 문단이 아니라 마지막 행이며 공유 파일을 가리킨다", () => {
    const { container } = render(<AdapterMatrix />);
    const rows = [...container.querySelectorAll("tbody tr")];
    const last = rows[rows.length - 1];
    expect(last.textContent).toContain("판정 엔진");
    // 2026-10-06 명세 변경: 「고정」(가공 인터페이스 열의 값) → 실제 공유 파일.
    expect(last.textContent).toContain("verdict.ts");
    // 게임 무관이라 한 칸이 게임 열 전체를 가로지른다 — 계층 + 합친 칸 + 인터페이스 = 3.
    expect(last.querySelectorAll("td")).toHaveLength(3);
    expect(last.querySelector("td[colspan]")?.getAttribute("colspan")).toBe(String(GAMES.length));
  });

  // 2026-09-16: 관측 소스 행이 "텔레메트리 … 무제한"이라 주장했으나 실호출로 반증됐다
  // (매치·텔레메트리 조회는 리밋 없음 / `/samples`는 10 RPM / 보존 336h). 방법론 페이지가
  // 미검증 단언을 싣는 것은 "무근거 문장은 회색" 원칙의 자기부정이라 문구를 실측값으로 바꿨다.
  // 이 테스트는 그 거짓 주장이 되돌아오는 것을 막는다.
  it("관측 소스 행은 무제한이라 주장하지 않고 실측 제약(10 RPM · 336h)을 명시한다", () => {
    const { container } = render(<AdapterMatrix />);
    const observ = ADAPTER_MATRIX.find((r) => r.layer === "관측 소스");
    expect(observ?.byGame?.pubg).not.toContain("무제한");
    expect(container.textContent).toContain("10 RPM");
    expect(container.textContent).toContain("336");
  });
});
