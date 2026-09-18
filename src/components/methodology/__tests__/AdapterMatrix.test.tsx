// src/components/methodology/__tests__/AdapterMatrix.test.tsx
// 어댑터 매핑표(ST-L) 렌더 검증 — HANDOFF §4-4 요구사항: 계층 전부 렌더 · PUBG 수집
// 수치 0 명시 · 판정 엔진 게임 무관 고지 · 라인별 밴률 컬럼 등 §6 금지 항목이 섞여 들지 않음.
// 2026-09-10(verify-impl 축B): 4열이 "PUBG 상태" → "어댑터 인터페이스"로 바뀌고 판정 엔진이
// 표 밖 문단 → 9번째 행이 됐다(시안 구조). 어서션도 그 명세로 갱신한다.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import AdapterMatrix from "../AdapterMatrix";
import { ADAPTER_MATRIX } from "../adapterMatrixData";

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
  it("PUBG 실연결 고지와 판정 엔진 게임 무관 고지를 렌더한다", () => {
    const { container } = render(<AdapterMatrix />);
    // 2026-09-18 명세 변경(ST-7): 개발자 메모 톤("실연결 완료 … 판정했다")을 사용자 문장으로 —
    // 사실(실제 수집·집계·판정)은 그대로 어서션한다.
    expect(container.textContent).toContain("실제로 수집·집계·판정했습니다");
    expect(container.textContent).not.toContain("수집 수치: 0건");
    expect(container.textContent).toContain("판정 엔진");
    expect(container.textContent).toContain("게임 무관");
  });

  it("PUBG 열 머리글이 실연결 구간을 명시한다", () => {
    const { container } = render(<AdapterMatrix />);
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads).toContain("PUBG (실연결 · 42.3 ⇒ 43.1)");
    expect(heads).not.toContain("PUBG (어댑터 확정 · 미연결)");
  });

  it("4번째 열은 어댑터 인터페이스이고 8계층 전부 인터페이스 이름을 노출한다", () => {
    const { container } = render(<AdapterMatrix />);
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads[3]).toBe("어댑터 인터페이스");
    for (const iface of [
      "NoteSource.fetch()",
      "MatchSource.collect()",
      "Entity{type,key,name}",
      "Segment[]",
      "Metric.adoption",
      "Metric.outcome",
      "Metric.timeline",
      "AssetSource.icon()",
    ]) {
      expect(container.textContent).toContain(iface);
    }
  });

  it("판정 엔진은 표 밖 문단이 아니라 마지막 행이며 인터페이스가 '고정'이다", () => {
    const { container } = render(<AdapterMatrix />);
    const rows = [...container.querySelectorAll("tbody tr")];
    const last = rows[rows.length - 1];
    expect(last.textContent).toContain("판정 엔진");
    expect(last.textContent).toContain("고정");
    // 게임 무관이므로 LoL 셀이 PUBG 열까지 가로지른다 — 셀 4개가 아니라 3개.
    expect(last.querySelectorAll("td")).toHaveLength(3);
  });

  // 2026-09-16: 관측 소스 행이 "텔레메트리 … 무제한"이라 주장했으나 실호출로 반증됐다
  // (매치·텔레메트리 조회는 리밋 없음 / `/samples`는 10 RPM / 보존 336h). 방법론 페이지가
  // 미검증 단언을 싣는 것은 "무근거 문장은 회색" 원칙의 자기부정이라 문구를 실측값으로 바꿨다.
  // 이 테스트는 그 거짓 주장이 되돌아오는 것을 막는다.
  it("관측 소스 행은 무제한이라 주장하지 않고 실측 제약(10 RPM · 336h)을 명시한다", () => {
    const { container } = render(<AdapterMatrix />);
    const observ = ADAPTER_MATRIX.find((r) => r.layer === "관측 소스");
    expect(observ?.pubg).not.toContain("무제한");
    expect(container.textContent).toContain("10 RPM");
    expect(container.textContent).toContain("336");
  });
});
