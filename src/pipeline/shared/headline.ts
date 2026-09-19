// src/pipeline/shared/headline.ts
// 브리핑 헤드라인 수치("통계는 M개 변화를 말합니다 · 미공지 N건")의 **단일 소유**.
//
// 왜 모듈로 빼는가(2026-09-20, 실측 결함): 같은 두 수치를 웹 히어로(`home/logic.ts`)와 디스코드
// 브리핑(`discord/webhook.ts`)이 각자 세고 있었다. 2026-09-19에 히어로만 `isReportableRecord`로
// 옮기고 웹훅을 두는 바람에 **같은 패치를 두고 사이트는 62개·29건, 디스코드는 403개·31건**을
// 말하게 됐다(`--dry-run` 실측). 이 프로젝트가 반복해서 고쳐 온 "표면마다 다른 수치" 결함군이고,
// 원인은 언제나 술어가 복제돼 있다는 것이다 — `reportable.ts`가 같은 이유로 만들어졌다.
//
// 그래서 두 표면이 **이 파일을 부르는 것 말고는 셀 방법이 없게** 한다. 판정 엔진·상태값은
// 건드리지 않는다 — 세는 술어만 표시 계층의 것으로 고정한다.
import type { DeltaRecord } from "../types";
import { isReportableRecord } from "./reportable";
import { isGapStatus } from "./status-order";

/**
 * "통계는 M개 변화를 말합니다"의 M — 화면 목록에 실제로 오를 자격이 있는 관측 **행** 수.
 *
 * `isSignificantDelta` 단독이 아니다: 그것은 효과크기 바닥 미달(`below-threshold`)까지 세므로
 * 26.17→26.18에서 403건이 나오는데, 그중 321건(80%)은 어떤 목록도 렌더하지 않는다.
 */
export function countReportable(rows: readonly DeltaRecord[], qAlpha?: number): number {
  let count = 0;
  for (const row of rows) {
    if (isReportableRecord(row, qAlpha)) count++;
  }
  return count;
}

/**
 * "미공지 N건"의 N — Gap 상태(`unannounced` + `indirect-effect`)의 **엔티티** 수.
 *
 * 행이 아니라 엔티티인 이유(2026-09-17 라운드6 보완 4): Gap 탭 카드·대조표 미공지 행·라인 분포가
 * 전부 엔티티 단위라, 행 수를 타일에 쓰면 카드 수와 어긋난다. 한 챔피언이 승률·픽률 두 행으로
 * 잡혀도 사람에게는 한 건이다.
 */
export function countGapEntities(rows: readonly DeltaRecord[]): number {
  const entities = new Set<string>();
  for (const row of rows) {
    if (isGapStatus(row.status)) entities.add(`${row.entityType}:${row.entityKey}`);
  }
  return entities.size;
}
