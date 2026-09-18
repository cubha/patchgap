// src/pipeline/shared/reportable.ts
// "보고 가능한 관측" 술어 — 화면이 관측 1건을 **올릴 자격**을 한 곳에서 정한다(2026-09-18 라운드6,
// scope-critic ST2 지적: 같은 판단이 대조표 `entityRows`·홈 `streamVerdict`·`noteDeltaIndex` 세 곳에 따로
// 있으면 한쪽만 고쳤을 때 홈과 대조표가 서로를 반박한다).
//
// 조건: 노이즈 상태 아님(`isNoiseStatus`) ∧ delta 존재 ∧ 유의(`isSignificantDelta`) ∧ 효과크기 바닥 통과
// (`meetsEffectFloor`). 판정 엔진의 정의상 노이즈 3종은 뒤 두 조건에서 이미 걸러지지만(표본 부족·변화 없음
// = 비유의, 바닥 미달 = 바닥 미통과), 그 동치성은 엔진 구현에 기댄 것이라 술어에 명시해 둔다.
// 클라이언트 번들에도 실린다 — Node 전용 의존 금지.
import type { DeltaRecord } from "../types";
import { meetsEffectFloor } from "../aggregate/stats";
import { isSignificantDelta } from "./significance";
import { isNoiseStatus } from "./display-status";

export function isReportableRecord(record: DeltaRecord, qAlpha?: number): boolean {
  if (isNoiseStatus(record.status)) return false;
  if (record.delta === null) return false;
  if (!isSignificantDelta(record, qAlpha)) return false;
  return meetsEffectFloor(record.metric, record.delta, record.before);
}
