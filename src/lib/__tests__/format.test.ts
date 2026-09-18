import { describe, expect, it } from "vitest";
import {
  fmtCiHalf,
  fmtDeltaInt,
  fmtDeltaSec,
  fmtInt,
  fmtKst,
  fmtPct,
  fmtPp,
  fmtSec,
  itemHref,
  itemIdFromSlug,
  itemSlug,
  metricLabel,
  positionLabel,
  statusLabel,
} from "../format";

describe("fmtPct", () => {
  it("분수를 퍼센트 문자열로 변환한다", () => {
    expect(fmtPct(0.046)).toBe("4.6%");
  });

  it("digits로 소수 자리를 제어한다", () => {
    expect(fmtPct(0.0463, 2)).toBe("4.63%");
    expect(fmtPct(0.5, 0)).toBe("50%");
  });

  it("0은 부호 없이 0%", () => {
    expect(fmtPct(0)).toBe("0.0%");
  });
});

describe("fmtPp", () => {
  it("양수 델타에 + 부호를 붙인다", () => {
    expect(fmtPp(0.025)).toBe("+2.5%p");
  });

  it("음수 델타는 유니코드 마이너스(U+2212)를 쓴다", () => {
    expect(fmtPp(-0.018)).toBe("−1.8%p");
    expect(fmtPp(-0.018)).not.toContain("-");
  });

  it("0은 부호 없이 0.0%p", () => {
    expect(fmtPp(0)).toBe("0.0%p");
  });
});

describe("fmtCiHalf", () => {
  it("interval의 반폭을 ±접두로 표기한다(digits로 정밀도 지정)", () => {
    expect(fmtCiHalf([0.021, 0.029], 3)).toBe("±0.004");
  });

  it("퍼센트 스케일로 미리 곱한 interval도 그대로 반폭 계산한다", () => {
    expect(fmtCiHalf([2.1, 2.9], 1)).toBe("±0.4");
  });

  it("digits로 자리수를 제어한다(초·골드 등 정수 단위)", () => {
    expect(fmtCiHalf([16, 28], 0)).toBe("±6");
  });
});

describe("fmtSec", () => {
  it("초를 분:초로 변환한다", () => {
    expect(fmtSec(352)).toBe("5:52");
  });

  it("초 자리는 항상 2자리 zero-pad", () => {
    expect(fmtSec(305)).toBe("5:05");
  });

  it("60초 미만은 0분", () => {
    expect(fmtSec(45)).toBe("0:45");
  });
});

describe("fmtDeltaSec", () => {
  it("양수 델타에 + 부호", () => {
    expect(fmtDeltaSec(22)).toBe("+22s");
  });

  it("음수 델타는 유니코드 마이너스", () => {
    expect(fmtDeltaSec(-11)).toBe("−11s");
  });

  it("0은 부호 없음", () => {
    expect(fmtDeltaSec(0)).toBe("0s");
  });
});

describe("fmtInt", () => {
  it("천 단위 콤마를 넣는다", () => {
    expect(fmtInt(10240)).toBe("10,240");
  });

  it("1000 미만은 콤마 없음", () => {
    expect(fmtInt(842)).toBe("842");
  });
});

describe("fmtDeltaInt", () => {
  it("양수 델타에 + 부호와 천단위 콤마", () => {
    expect(fmtDeltaInt(320)).toBe("+320");
  });

  it("음수 델타는 유니코드 마이너스", () => {
    expect(fmtDeltaInt(-1500)).toBe("−1,500");
  });
});

describe("fmtKst", () => {
  it("UTC ISO를 KST(UTC+9) 'YYYY-MM-DD HH:mm KST'로 변환한다", () => {
    expect(fmtKst("2026-09-05T05:00:00.000Z")).toBe("2026-09-05 14:00 KST");
  });

  it("자정 경계를 넘는 변환도 날짜가 올라간다", () => {
    expect(fmtKst("2026-09-05T16:30:00.000Z")).toBe("2026-09-06 01:30 KST");
  });
});

describe("statusLabel", () => {
  it("4개 알려진 상태 + no-change + below-threshold를 한글 라벨로 매핑한다", () => {
    expect(statusLabel("announced-consistent")).toBe("공지-일치");
    expect(statusLabel("announced-inconsistent")).toBe("공지-불일치");
    expect(statusLabel("unannounced")).toBe("미공지");
    expect(statusLabel("insufficient-sample")).toBe("표본 부족");
    expect(statusLabel("no-change")).toBe("변화 없음");
    // 2026-09-18 S6 명세 변경: "임계 미달"→"바닥 미달"(동의어 교체, 뜻 불변). "임계"가 q<α
    // 임계와 충돌해 한 상태를 네 단어로 부르던 것을 "바닥" 어근 하나로 모았다.
    expect(statusLabel("below-threshold")).toBe("바닥 미달");
  });

  it("알려지지 않은 상태값은 원본을 그대로 반환한다(크래시 없음)", () => {
    expect(statusLabel("future-status")).toBe("future-status");
  });
});

describe("metricLabel", () => {
  it("알려진 metric 키를 한글로 매핑한다", () => {
    expect(metricLabel("pickRate")).toBe("픽률");
    expect(metricLabel("winRate")).toBe("승률");
    expect(metricLabel("goldAt10")).toBe("골드@10");
  });

  it("알려지지 않은 metric은 원본을 반환한다", () => {
    expect(metricLabel("someFutureMetric")).toBe("someFutureMetric");
  });
});

describe("positionLabel", () => {
  it("포지션 5종 + 미배정을 한글로 매핑한다", () => {
    expect(positionLabel("TOP")).toBe("탑");
    expect(positionLabel("JUNGLE")).toBe("정글");
    expect(positionLabel("MIDDLE")).toBe("미드");
    expect(positionLabel("BOTTOM")).toBe("원딜");
    expect(positionLabel("UTILITY")).toBe("서포터");
    expect(positionLabel("")).toBe("미배정");
  });
});

// 2026-09-05 오케스트레이터 지시 — 퍼센트 인코딩 슬러그(encodeURIComponent) 폐기, `:`→`~`
// 문자 치환 슬러그로 전환(실측: 정적 파일 서버에 out/를 직접 서빙하면 단일/원문 인코딩 둘 다
// 404, 이중 인코딩만 200이 나와 배포 시 링크가 깨지는 근본 문제를 확인했다).
describe("itemSlug / itemIdFromSlug / itemHref", () => {
  it("':'를 '~'로 치환한다", () => {
    expect(itemSlug("champion:Trundle:pickRate")).toBe("champion~Trundle~pickRate");
  });

  it("결과에 '%' 문자가 없다(퍼센트 인코딩 미사용 확인)", () => {
    expect(itemSlug("champion:Aatrox:BOTTOM:pickRate")).not.toContain("%");
    expect(itemHref("champion:Aatrox:BOTTOM:pickRate")).not.toContain("%");
  });

  it("itemIdFromSlug는 itemSlug의 정확한 역변환이다(왕복)", () => {
    const ids = [
      "champion:Trundle:pickRate",
      "champion:Aatrox:BOTTOM:pickRate",
      "item:3047:adoptionRate",
      "lane:TOP:goldAt14",
      "objective:dragon",
      "summary:avgDurationSec",
    ];
    for (const id of ids) {
      expect(itemIdFromSlug(itemSlug(id))).toBe(id);
    }
  });

  it("id에 이미 '~'가 있으면 왕복이 불안전하므로 throw한다", () => {
    expect(() => itemSlug("champion:Weird~Name:pickRate")).toThrow();
  });

  it("itemHref는 '/item/{slug}/' 형태를 반환한다", () => {
    expect(itemHref("champion:Trundle:pickRate")).toBe("/item/champion~Trundle~pickRate/");
  });
});
