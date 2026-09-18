// src/pipeline/shared/display-status.ts
// 표시 전용 상태 키 — 판정 엔진의 `MatchStatus`는 그대로 두고 화면이 갈라 보여야 하는 경우만
// 여기서 매핑한다(2026-09-18, 채점 라운드1 ST-4 / 사용자 확정 M2).
//
// **왜 필요한가**: `verdict.assignStatus`는 "노트 짝이 있고 방향이 반대"와 "노트 짝이 있는데
// 관측이 유의하지 않음"을 둘 다 `announced-inconsistent`에 넣는다(verdict.ts 헤더 주석). 판정
// 엔진 관점에서는 둘 다 "선언대로 관측되지 않았다"라 같은 값이 맞다. 그러나 화면에서 둘을 같은
// 빨간 "공지-불일치" 배지로 내보내면 독자는 "패치노트가 틀렸다"로 읽는다 — 실측 26.17→26.18:
// 64건 중 59건이 비유의였고 노트 항목 128개 대부분이 빨간 배지를 달았다.
//
// **왜 MatchStatus를 늘리지 않는가**: 상태값은 판정 계약이고 파이프라인·디스코드·방법론이 전부
// 그 어휘로 말한다. 화면이 구분하고 싶은 건 "유의한가"인데 그것은 `isSignificantDelta`가 이미
// 답한다 — 새 상태를 만들면 같은 질문을 두 곳에 적게 된다. 그래서 **표시 키**만 하나 더 둔다.
//
// 클라이언트 번들에도 실린다(CompareExplorer → compare/logic) — Node 전용 의존 금지.

import type { DeltaRecord, MatchStatus } from "../types";
import { meetsEffectFloor } from "../aggregate/stats";
import { isSignificantDelta } from "./significance";
import { STATUS_SORT_PRIORITY } from "./status-order";

/** 화면 배지·칩·정의표가 쓰는 키.
 * - `announced-unobserved` = 노트 짝은 있으나 관측이 유의하지 않다(2026-09-18 M2).
 * - `announced-below-floor` = 노트 짝이 있고 관측도 **유의하지만 변화 규모가 효과크기 바닥 미달**
 *   (2026-09-18 채점 라운드4 S9/S10 = 사용자 확정 CF-1·CF-2).
 * - `unpaired` = 그 노트 줄에 **짝지어진 델타가 아예 없다**(2026-09-18 채점 라운드4 S5).
 *
 * **왜 `unpaired`를 키로 만드는가**: `ReleaseNoteRow`가 이 자리에 한국어 리터럴 `"관측 보류"`를
 * 직접 넣고 있었다. `StatusBadge.status`가 `string`이라 tsc가 잡지 못했고, `statusLabel`의 fallback이
 * 그 문자열을 그대로 출력해 홈에 **50건**(투표 결과 줄 32 · 버그 수정 줄 18)이 찍혔다.
 * 문구도 틀렸다 — "보류"는 "아직 관측 못 했다"는 **미래 약속**인데, 투표 결과·버그 수정 줄에는
 * 측정할 지표가 원리적으로 없다. 같은 파일 B4 주석이 치장 항목에 대해 이미 그렇게 적어 뒀는데
 * 치장에만 적용돼 있었다. 사실 서술("짝지은 관측 없음")로 바꾸고 타입이 지키게 한다. */
export type DisplayStatus =
  | MatchStatus
  | "announced-unobserved"
  | "announced-below-floor"
  | "unpaired";

/**
 * 판정 상태 + 두 게이트(유의성·효과크기 바닥)로 **화면이 쓸 키**를 정한다.
 *
 * **S9/S10(2026-09-18, 사용자 확정 CF-1·CF-2) — 왜 바닥까지 보게 됐나**: 기존 구현은 유의성만
 * 봤고 그래서 두 방향으로 어긋났다.
 *
 * ① **빨강 ↔ 회색 모순**(CF-1): `announced-inconsistent`이면서 **유의하지만 바닥 미달**인 행은
 *    이 함수의 remap을 빠져나가 상세에서 빨간 "공지-불일치"를 달았는데, 홈은 같은 엔티티를
 *    회색 "관측 변화 없음"으로 적었다(실측 26.18 4행 — 자헨 픽률 +1.58%p q=0.000, 세라핀 밴률
 *    +0.28%p q=0.029. 26.17에서는 22행). 한 항목이 두 화면에서 정반대 강도로 읽혔다.
 *
 * ② **"공지-일치"의 오독**(CF-2): `announced-consistent` 32건 중 **20건(63%)**이 바닥 미달이다.
 *    배지는 "노트대로 확인됐다"로 읽히는데 실제 뜻은 "방향은 맞지만 움직임이 의미 있는 크기에
 *    못 미친다"이다. 63%면 소수 예외가 아니라 다수라, 라벨이 사실상 틀렸다.
 *
 * 둘은 **같은 사실**("노트 짝은 있고 관측도 유의하나 규모가 바닥 미달")이므로 표시 키 하나로 묶는다.
 * 판정 엔진·`MatchStatus`·`EFFECT_SIZE_FLOORS`는 그대로다 — 여기서 하는 일은 **읽는 법**뿐이다.
 */
export function displayStatus(record: DeltaRecord, qAlpha?: number): DisplayStatus {
  if (record.status !== "announced-consistent" && record.status !== "announced-inconsistent") {
    return record.status;
  }
  if (!isSignificantDelta(record, qAlpha)) {
    // 비유의는 방향을 말할 수 없다 — 빨간 "불일치"로 읽히지 않게 한다(M2).
    return record.status === "announced-inconsistent" ? "announced-unobserved" : record.status;
  }
  if (record.delta !== null && !meetsEffectFloor(record.metric, record.delta, record.before)) {
    return "announced-below-floor";
  }
  return record.status;
}

/** 대표 상태 선택용 우선순위 — `announced-unobserved`는 "일치"보다 덜 흥미롭고 "바닥 미달"보다는
 * 노트가 있다는 점에서 앞선다. 값이 `STATUS_SORT_PRIORITY`와 겹치지 않도록 .5를 쓴다. */
export const DISPLAY_SORT_PRIORITY: Record<DisplayStatus, number> = {
  ...STATUS_SORT_PRIORITY,
  "announced-unobserved": STATUS_SORT_PRIORITY["announced-consistent"] + 0.5,
  // 관측이 **있긴 한** 상태라 "관측 미확인"보다는 앞이고 "일치"보다는 뒤다.
  "announced-below-floor": STATUS_SORT_PRIORITY["announced-consistent"] + 0.3,
  // 짝이 없으면 판정할 것도 없다 — "변화 없음"과 같은 최약 위치에 둔다.
  unpaired: STATUS_SORT_PRIORITY["no-change"] + 0.5,
};
