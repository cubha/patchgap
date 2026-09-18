// src/pipeline/shared/display-status.ts
// 표시 전용 상태 키 — 판정 엔진의 `MatchStatus`는 그대로 두고 **화면이 읽는 어휘**만 여기서 정한다.
//
// **2026-09-18 라운드6(사용자 C5·C1) — 어휘를 3종으로 줄였다.** 이전엔 표시 키가 `MatchStatus` 7종
// + `announced-unobserved` + `announced-below-floor` + `unpaired` = 10종이었고 대조표 칩도 10개였다.
// 사용자 지적: "공지된 내용은 공지된 내용인데 공지-일치, 불일치, 관측미확인 등 상세 value가 나뉨 →
// 통일 · 미공지, 노트에없는변화, 간접영향은 결국 미공지내용 → 통일". 화면이 답해야 할 질문은
// 둘뿐이다 — ① 노트가 말한 것인가(공지/미공지) ② 노트와 **반대로** 움직였는가(이상 관측).
//
//   announced          공지 — 노트 짝이 있는 관측 전부(일치·비유의·바닥 미달을 더 이상 가르지 않는다)
//   announced-anomaly  공지 · 이상 관측 — 노트 방향과 반대로 **유의 + 효과크기 바닥 통과**
//                      ("공지는 상향인데 승률·픽률 실측은 하락")
//   unannounced        미공지 — `unannounced` + `indirect-effect`(원인이 규명됐는가만 다를 뿐 같은 뿌리)
//   unpaired           짝지은 관측 없음 — 홈 스킬 행 전용. 판정이 아니라 부재(2026-09-18 S5)
//
// 노이즈 3종(`below-threshold`·`insufficient-sample`·`no-change`)은 키를 그대로 통과시킨다 —
// 방법론 정의표가 "표시하지 않는 관측"으로 설명해야 하기 때문이다. **화면은 `isNoiseStatus`로
// 거른다**(사용자 C1 "표본부족하고 수치에 유의미한 변화가 없는 항목은 아예 보여주지 않도록").
//
// **왜 MatchStatus를 늘리거나 줄이지 않는가**: 상태값은 판정 계약이고 파이프라인·디스코드·방법론이
// 전부 그 어휘로 말한다. 화면이 묻는 "유의한가·바닥을 넘는가"는 `isSignificantDelta`·
// `meetsEffectFloor`가 이미 답한다 — 같은 질문을 두 곳에 적지 않는다.
//
// 클라이언트 번들에도 실린다(CompareExplorer → compare/logic) — Node 전용 의존 금지.

import type { DeltaRecord, MatchStatus } from "../types";
import { meetsEffectFloor } from "../aggregate/stats";
import { isSignificantDelta } from "./significance";

/** 화면 배지·칩·정의표가 쓰는 키. */
export type DisplayStatus =
  | "announced"
  | "announced-anomaly"
  | "unannounced"
  | "below-threshold"
  | "insufficient-sample"
  | "no-change"
  | "unpaired";

/** 화면에 **표시하지 않는** 관측 — 표본 부족·바닥 미달·변화 없음(사용자 C1). 판정 파일에는 그대로
 * 남고 방법론이 규칙을 밝힌다. */
export function isNoiseStatus(status: MatchStatus): boolean {
  return status === "below-threshold" || status === "insufficient-sample" || status === "no-change";
}

/** 상태값만으로 표시 키를 정한다 — q·바닥을 볼 수 없는 곳(PUBG 행·방법론 정의표)용. PUBG의
 * `announced-inconsistent`는 판정기가 비율 밴드 밖 = 방향·규모 불일치를 이미 확정한 값이라 그대로
 * "이상 관측"이다. */
export function displayStatusOf(status: MatchStatus): DisplayStatus {
  if (status === "announced-consistent") return "announced";
  if (status === "announced-inconsistent") return "announced-anomaly";
  if (status === "indirect-effect") return "unannounced";
  return status;
}

/**
 * 판정 상태 + 두 게이트(유의성·효과크기 바닥)로 **화면이 쓸 키**를 정한다.
 *
 * LoL의 `announced-inconsistent`는 판정 엔진이 "방향 반대"와 "비유의"를 한 값에 넣는다(verdict.ts
 * 헤더 — 실측 26.17→26.18: 64건 중 59건이 비유의). 그래서 **유의 + 바닥 통과**일 때만 이상 관측이고,
 * 나머지는 전부 "공지"다 — 노트가 말한 항목이고 반대 증거는 없다는 뜻이다.
 */
export function displayStatus(record: DeltaRecord, qAlpha?: number): DisplayStatus {
  if (record.status === "announced-inconsistent") {
    const significant = isSignificantDelta(record, qAlpha);
    const aboveFloor =
      record.delta !== null && meetsEffectFloor(record.metric, record.delta, record.before);
    return significant && aboveFloor ? "announced-anomaly" : "announced";
  }
  return displayStatusOf(record.status);
}

/** 대표 상태 선택·정렬용 우선순위 — 미공지 → 이상 관측 → 공지 → 노이즈 → 짝 없음. */
export const DISPLAY_SORT_PRIORITY: Record<DisplayStatus, number> = {
  unannounced: 0,
  "announced-anomaly": 1,
  announced: 2,
  "below-threshold": 4,
  "insufficient-sample": 5,
  "no-change": 6,
  unpaired: 7,
};
