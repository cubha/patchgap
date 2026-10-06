// src/lib/headline.ts
// 브리핑 히어로·랜딩 카드가 같은 숫자를 말하게 하는 헤드라인 집계(2026-10-06 `components/home/logic.ts`에서 이관 —
// `lib/landing.ts`가 컴포넌트 모듈을 import하던 역방향 의존을 없앤다). 세는 규칙 자체는 `pipeline/shared/headline.ts`가
// 소유하고, 여기는 노트 파일과 판정 파일을 받아 그 규칙을 부르는 조립만 한다.
import type { DeltasFile } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { FDR_ALPHA } from "@/pipeline/aggregate/stats";
import { countGapEntities, countReportable } from "@/pipeline/shared/headline";
import { countRelevantNoteEntities as countRelevantNoteEntitiesInFile } from "@/pipeline/shared/notes-count";

function countRelevantNoteEntities(notes: NotesFile | null): number {
  return notes ? countRelevantNoteEntitiesInFile(notes.items) : 0;
}

/** 요약 카드 헤드라인 수치(+스탯 타일이 그대로 이 수치를 쓴다 — 코디네이터 정정, 2026-09-05:
 * 타일 "공지된 변화"는 별도 델타 집계가 아니라 `noteEntityCount`(N)를 그대로 재사용한다).
 *
 * `noteEntityCount`/`noteItemCount` 리네임(HANDOFF-redesign-2026-09-10.md §4-1, 2026-09-10):
 * 기존 필드명 `noteItemCount`가 실제로는 "노트 **항목** 수"가 아니라 "노트 **엔티티** 수"를
 * 담고 있어 오라벨이었다 — `src/components/methodology/pipelineSteps.ts`(ST-07)는 이미
 * `noteEntityCount`/`noteItemCount`(=`NotesFile.meta.itemCount`)로 올바르게 분리해 썼으므로,
 * 그 기존 컨벤션에 홈을 맞춘다. 소비처 3곳(`page.tsx`·`HeroSummary.tsx`·이 파일의 테스트)
 * 전수 확인 후 리네임 — 외부 공개 API가 아니므로 `tsc --noEmit`가 누락을 전부 잡는다. */
export interface HeadlineStats {
  /** "패치노트는 N개 항목을 말했고" + 스탯 타일 "공지된 변화" — countRelevantNoteEntities. */
  noteEntityCount: number;
  /** 원문 패치노트 "항목" 수(`NotesFile.meta.itemCount`) — HANDOFF §4-1 "35 엔티티 / 215 항목"
   * 분리 표기에 쓰는 참고 병기 수치. */
  noteItemCount: number;
  /**
   * "통계는 M개 변화를 말합니다" + 스탯 타일 "유의한 관측" — **`isReportableRecord` 통과 건수**.
   *
   * 2026-09-19 계약 변경(사용자 지적): 이전엔 `isSignificantDelta` 단독이라 **효과크기 바닥
   * 미달(`below-threshold`)까지 세고 있었다**. 26.17→26.18 실측으로 403건 중 321건(80%)이
   * 그것이었고, 그 321건은 **어느 목록에도 렌더되지 않는다**(표시 자격 없음). 즉 히어로가
   * 자기 화면이 보여주지 않는 것을 세고 "유의한 관측"이라 부르고 있었다 — 라벨과 수치가
   * 어긋난다. 사용자 판정: "유의미한 내용만 cnt한다고 하면 히어로를 바꾸는 게 맞다."
   * 이제 목록·대조표가 쓰는 술어와 같은 것을 쓴다(403 → 62). 판정 엔진은 건드리지 않았다 —
   * 세는 술어만 표시 계층의 것으로 맞춘 것이다.
   */
  statCount: number;
  /**
   * 스탯 타일·Gap 탭 배지 "미공지 Gap" — **`unannounced` + `indirect-effect`** 건수.
   *
   * 2026-09-17 계약 변경(사용자 지적 B2: "미공지 Gap 탭의 데이터와 노트에 없는 파급효과/간접
   * 영향 섹션의 데이터가 동일한 목적으로 보이는데 다른영역에 별도로 표기되니 혼돈됨"):
   * 두 상태는 **배타적이지만 같은 뿌리**다 — `verdict.assignStatus`가 "짝 없음 + 유의 +
   * 효과크기 바닥 통과"를 `unannounced`로 확정한 뒤, `reclassifyIndirectEffects`가 **그
   * `unannounced`만 대상으로** 원인이 신뢰도 게이트를 넘으면 `indirect-effect`로 재분류한다.
   * 즉 `indirect-effect` ⊂ (원래 `unannounced`)이고, 차이는 **원인이 규명됐는가** 하나뿐이다.
   * 그래서 화면에서도 한 곳(Gap 탭)에 모으고 그 안에서 규명 여부로 나눈다.
   *
   * ⚠️ 이 값은 **히어로 타일 · Gap 탭 배지 · 그리고 그 탭이 거르는 목록**이 공유한다.
   * 셋이 어긋나면 화면이 스스로를 반박한다(PLAN-home-tab-split-intro-fix-2026-09-14.md
   * "카운트 배지 소스").
   */
  /** 미공지 Gap **엔티티** 수(관측 행 수가 아니다 — Gap 탭 카드 수와 같다). */
  unannouncedCount: number;
}

/** deltas/notes가 아직 없으면(ST-08 미착수 구간·빈 데이터 빌드) 전부 0을 반환한다(throw 없음 —
 * 빈 상태 카드 렌더 보장, ST-11 완료 조건). `qAlpha` 기본값은 `FDR_ALPHA` — 호출부(`page.tsx`)가
 * `deltas?.meta.qAlpha`를 명시적으로 넘기면 그 값을 우선한다(2026-09-05 리팩토링, 기존엔
 * `isSignificantDelta` 내부에 0.1이 하드코딩돼 있었다). */
export function computeHeadline(
  deltas: DeltasFile | null,
  notes: NotesFile | null,
  qAlpha: number = FDR_ALPHA
): HeadlineStats {
  const noteEntityCount = countRelevantNoteEntities(notes);
  const noteItemCount = notes?.meta.itemCount ?? 0;
  const rows = deltas?.rows ?? [];
  // 세는 규칙은 `pipeline/shared/headline.ts`가 소유한다(2026-09-20) — 여기서 직접 세면
  // 디스코드 브리핑이 같은 수치를 따로 세는 상태로 되돌아간다(그렇게 해서 403 vs 62가 났다).
  return {
    noteEntityCount,
    noteItemCount,
    statCount: countReportable(rows, qAlpha),
    unannouncedCount: countGapEntities(rows),
  };
}
