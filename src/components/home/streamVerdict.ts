// src/components/home/streamVerdict.ts
// 릴리즈노트 스트림의 "판정 문장" 순수 로직 — 확정 시안(2026-09-10) 홈의 두 요소를 만든다:
//   .rn-obs   엔티티 레벨 대표 관측 1줄 ("밴률 26.8% → 42.4% ▲ +15.7%p · CI ±1.3")
//   .verdict .m  스킬 행별 판정 근거 1줄 ("노트=상향 · 관측=밴률 상승")
// verify-impl 축B(2026-09-10)에서 둘 다 부재로 확인돼 신설했다. 렌더는 ReleaseNoteRow 몫 —
// 이 모듈은 "어떤 델타를 대표로 쓰고 무슨 문장을 만들지"만 결정한다(부수효과 없음).
//
// 무근거 문장 금지 원칙: 짝지어진 델타가 없으면 문장을 만들지 않고 `null`을 돌려준다.
// 호출부는 그 자리에 아무것도 렌더하지 않는다(StatusBadge "짝지은 관측 없음"이 이미 상태를 말한다).

import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import { metricLabel } from "@/lib/format";
import { meetsEffectFloor } from "@/pipeline/aggregate/stats";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { absDelta, isSignificantDelta } from "./logic";

/** 노트 방향(direction) → 시안 표기. `unknown`은 방향을 지어내지 않고 "변경"으로 둔다. */
const DIRECTION_LABEL: Record<PatchNoteItem["direction"], string> = {
  buff: "상향",
  nerf: "하향",
  adjust: "조정",
  unknown: "변경",
};

/**
 * 엔티티 대표 관측 — |delta| 최대 1건. 시안 `.rn-obs`가 엔티티당 1줄이라 "무엇을 대표로
 * 보여줄지"를 결정해야 하는데, 스트림 정렬 기준(maxAbsDelta)과 같은 잣대를 써야 카드 순서와
 * 카드 안 대표 수치가 어긋나지 않는다. delta===null(측정 불가)뿐이면 null.
 */
export function selectEntityObservation(rows: readonly DeltaRecord[]): DeltaRecord | null {
  let best: DeltaRecord | null = null;
  for (const row of rows) {
    if (row.delta === null) continue;
    if (!best || absDelta(row) > absDelta(best)) best = row;
  }
  return best;
}

/**
 * **공지(matched) 카드용** 대표 관측 — `selectEntityObservation`과 달리 **유의성 + 효과크기
 * 바닥**을 통과한 행만 후보로 본다. 하나도 없으면 null이다.
 *
 * **왜 두 함수가 필요한가**(사용자 지적 3번, 2026-09-17: "아직도 3% 미만의 미비한 변화내용
 * 표기됨"): 같은 `selectEntityObservation`이 두 갈래에서 불리는데 **입력의 성질이 다르다**.
 * 미공지 카드에 들어오는 행은 이미 `verdict.assignStatus`가 `meetsEffectFloor`를 통과시킨
 * 것들이라 자동으로 게이트돼 있다. 반면 공지 카드에는 아무 게이트가 없어서, 첨부 이미지의
 * `카시오페아 승률 55.1% → 54.4% ▼ -0.6%p CI ±9.2 · q=1` 같은 행이 카드 대표 수치로
 * 올라왔다 — 승률 바닥은 2%p이고 q=1은 유의하지 않다는 뜻이니, 저 줄은 **발견이 아니라
 * 잡음**이다.
 *
 * 게이트를 `selectEntityObservation` 자체에 걸지 않은 이유: 그러면 미공지 경로까지 조용히
 * 바뀐다. 결함은 "게이트가 없다"가 아니라 **"두 경로의 게이트가 비대칭"**이므로, 비대칭인
 * 쪽만 고친다.
 *
 * 판정 축(`EFFECT_SIZE_FLOORS` 값 자체)은 건드리지 않는다 — 2026-09-13/14에 실측으로 확정된
 * 값이고, 이번 수정은 **표기 축**이다.
 */
export function selectReportableObservation(
  rows: readonly DeltaRecord[],
  qAlpha?: number
): DeltaRecord | null {
  // 자격 술어는 shared/reportable.ts 한 곳 — 대조표 `entityRows`와 같은 잣대(라운드6 scope-critic ST2).
  let best: DeltaRecord | null = null;
  for (const row of rows) {
    if (!isReportableRecord(row, qAlpha)) continue;
    if (!best || absDelta(row) > absDelta(best)) best = row;
  }
  return best;
}

/**
 * 대표 관측이 **없는** 이유. 카드 헤더가 그 이유를 말하려면 먼저 계산해야 한다.
 *
 * **왜 필요한가**(2026-09-18 채점 라운드4 S4): `ReleaseNoteRow`의 헤더는 `observation === null`인
 * 모든 그룹에 상수 문자열 `"관측 변화 없음 · 바닥 미달"`을 찍고 있었다. 그런데 그 자리는
 * `selectReportableObservation`이 null을 낸 자리이고, 그 함수는 **유의성과 바닥 둘 다**를 보므로
 * 어느 쪽이 깨져도 null이 된다 — 즉 문구는 사유를 단정하는데 코드는 그 사유를 계산한 적이 없다.
 *
 * 실측(26.17→26.18): 노트 짝 96행 중 비보고 83행의 **59행(71%)**이 바닥이 아니라 유의차 문제였다.
 * 엔티티 단위로는 그 문구를 쓰는 6개 중 **바닥 미달이 진짜 이유인 것이 0개**(비유의만 1 · 혼재 5).
 * 「구인수의 격노검」(채택률 Δ−0.08%p, q=0.577)은 **문장 자체가 거짓**이었다.
 *
 * **`mixed`에서 사유를 비우는 것이 이 함수의 핵심이다.** 혼재가 다수인데 거기서 한 사유를 고르면
 * 그게 바로 위의 거짓말이다. 어휘는 새로 만들지 않고 `buildNoteVerdict`가 이미 확정한 두 단어
 * ("유의차 없음" / "변화 규모 바닥 미달")를 그대로 쓴다 — 같은 사실을 두 어휘로 부르지 않기 위해서다.
 */
export type NoObservationReason = "no-pair" | "not-significant" | "below-floor" | "mixed";

/**
 * 보고 가능한 행이 하나라도 있으면 `null`(사유를 물을 상황이 아니다).
 * 그렇지 않으면 왜 없는지를 돌려준다.
 */
export function explainNoObservation(
  rows: readonly DeltaRecord[],
  qAlpha?: number
): NoObservationReason | null {
  if (rows.length === 0) return "no-pair";

  let significant = 0;
  let belowFloor = 0;
  let insignificant = 0;
  for (const row of rows) {
    if (row.delta === null || !isSignificantDelta(row, qAlpha)) {
      insignificant += 1;
      continue;
    }
    significant += 1;
    if (!meetsEffectFloor(row.metric, row.delta, row.before)) belowFloor += 1;
  }

  // 유의하면서 바닥도 넘은 행이 있다 = 보고 가능한 관측이 존재한다.
  if (significant > belowFloor) return null;

  if (significant === 0) return "not-significant";
  if (insignificant === 0) return "below-floor";
  return "mixed";
}

/** 사유 → 카드 헤더 문구. `mixed`는 **사유 없이** 사실만 말한다. */
const NO_OBSERVATION_LABELS: Record<NoObservationReason, string> = {
  "no-pair": "짝지은 관측 없음",
  "not-significant": "관측 변화 없음 · 유의차 없음",
  "below-floor": "관측 변화 없음 · 변화 규모 바닥 미달",
  mixed: "관측 변화 없음",
};

export function noObservationLabel(reason: NoObservationReason): string {
  return NO_OBSERVATION_LABELS[reason];
}

export interface NoteVerdict {
  /** "노트=상향" 좌변. */
  noteLabel: string;
  /** "밴률 상승" / "유의차 없음" 우변. */
  observedLabel: string;
  /** 우변 색 — DeltaValue와 같은 관례(up=success·down=danger·none=muted). */
  kind: "up" | "down" | "none";
}

/**
 * 스킬 행 1줄의 판정 근거 — 시안 `.verdict .m`("노트=상향 · 관측=밴률 폭증").
 * `record`가 없으면(그 노트에 짝지어진 델타 없음) `null` — 관측하지 않은 것을 관측했다고
 * 쓰지 않는다. 유의성은 `isSignificantDelta`(q·CI 직접 검사, status 라벨 아님)로 판정하며
 * 비유의면 방향어를 붙이지 않고 "유의차 없음"으로 끝낸다.
 *
 * 시안의 "폭증"·"급락" 같은 강도 부사는 쓰지 않는다 — 임계값을 새로 지어내야 하고 그 임계는
 * 어디에도 정의돼 있지 않다. 강도는 바로 옆 `.rn-obs`의 실수치가 이미 말한다.
 */
export function buildNoteVerdict(
  note: PatchNoteItem,
  record: DeltaRecord | undefined,
  qAlpha?: number
): NoteVerdict | null {
  if (!record) return null;
  const noteLabel = `노트=${DIRECTION_LABEL[note.direction]}`;
  if (!isSignificantDelta(record, qAlpha) || record.delta === null || record.delta === 0) {
    return { noteLabel, observedLabel: "유의차 없음", kind: "none" };
  }
  // 유의하지만 **규모가 바닥 미달**인 경우 — 카드 헤더만 게이트하고 여기를 놓치면 같은 결함이
  // 한 단계 아래에서 그대로 살아난다. 실측(26.17→26.18): 노트 짝이 있는 135행 중 **24행**
  // (픽률 19 · 밴률 5, 11개 엔티티)이 q<0.1을 통과하면서 효과크기 바닥 아래다. n≈10,000에서는
  // 0.5%p 이동도 유의해지므로 "유의하다"가 "의미 있다"를 뜻하지 못한다.
  //
  // 문구를 "유의차 없음"으로 뭉뚱그리지 않는 이유: 차이는 **실재한다**. 없다고 말하면 그것도
  // 거짓이다. 방향어만 거두고 규모가 못 미친다고 말한다.
  if (!meetsEffectFloor(record.metric, record.delta, record.before)) {
    return { noteLabel, observedLabel: "변화 규모 바닥 미달", kind: "none" };
  }
  const up = record.delta > 0;
  return {
    noteLabel,
    observedLabel: `${metricLabel(record.metric)} ${up ? "상승" : "하락"}`,
    kind: up ? "up" : "down",
  };
}

/** q 표기 — 시안 `.rn-obs` 꼬리("· q<0.001" / "· q=0.14"). 0.001 미만은 유효숫자를 더 찍어도
 * 읽는 사람이 쓸 수 없으므로 부등호로 바꾼다(항목 상세 게이트 표기와 같은 관례). `q===null`
 * (계산 불가)이면 표기 자체를 생략한다 — 없는 값을 0으로 쓰지 않는다. */
export function formatQ(q: number | null): string | null {
  if (q === null) return null;
  if (q < 0.001) return "q<0.001";
  return `q=${q.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
}
