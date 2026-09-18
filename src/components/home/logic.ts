// src/components/home/logic.ts
// 브리핑 홈 순수 로직 — 요약 카드 수치·미공지 상위 5·공지 대조 미리보기 5·추정 원인 표기·노트
// id 인덱스. 렌더(page.tsx·home/*.tsx)와 분리해 단위 테스트한다(완료 조건 "순수 함수로 분리").
// UX-BRIEF §3 "01 브리핑 홈" + 코디네이터 지시(ST-11 프롬프트) 기준.

import type { DeltaKind } from "@/components/DeltaValue";
import type { DeltaMetric, DeltaRecord, DeltasFile, LlmCause, PatchNoteItem } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { METRIC_KIND, fmtDeltaInt, fmtDeltaSec, fmtInt, fmtPct, fmtPp, fmtSec, metricLabel } from "@/lib/format";
import { countRelevantNoteEntities as countRelevantNoteEntitiesInFile } from "@/pipeline/shared/notes-count";
import { isSignificantDelta } from "@/pipeline/shared/significance";
import { FDR_ALPHA } from "@/pipeline/aggregate/stats";
import { isGapStatus } from "@/pipeline/shared/status-order";

/** 패치노트 항목(section champion|item)을 "entity" 단위로 묶어 몇 개의 서로 다른 엔티티가
 * 언급됐는지 센다 — ST-08 `matchedNoteIds`가 같은 엔티티의 노트 여러 줄을 한 묶음으로 취급하는
 * 기준과 일치시킨다(예: 아우렐리온 솔 스킬 2줄 변경 = 노트 항목 2건이지만 엔티티는 1개).
 * 실제 계산은 `pipeline/shared/notes-count.ts`(scripts/run-notify.ts의 `countEntityNotes`와도
 * 공유하는 단일 구현, 2026-09-05 리팩토링)에 있다 — 이 함수는 `NotesFile | null` 래퍼를 벗겨
 * items 배열만 넘기는 얇은 어댑터다. */
export function countRelevantNoteEntities(notes: NotesFile | null): number {
  if (!notes) return 0;
  return countRelevantNoteEntitiesInFile(notes.items);
}

/**
 * 델타 1건이 "통계적으로 유의한 변화"인지 — **상태 라벨이 아니라 q·CI를 직접 검사**한다
 * (코디네이터 정정, 2026-09-05). `status`만으로 세면 `announced-inconsistent`가 "방향이
 * 다른 유의한 변화"와 "노트는 있지만 통계적으로 변화 없음"(ST-08 verdict.assignStatus 3번
 * 분기) 두 경우를 한데 묶어 M을 부풀린다 — 실측: 자기쌍(26.17→26.17) `announced-inconsistent`
 * 212건은 전부 후자(델타 그 자체가 없는 자기비교)인데, status 기준으로 세면 M=212로 잘못
 * 나온다. `insufficient-sample`(승률 n 게이트 미달)은 q·CI가 있어도 무조건 비유의로 친다 —
 * PLAN ②의 "미달=insufficient-sample"과 동일한 무조건 우선순위.
 *
 * 실제 판정 로직은 `pipeline/shared/significance.ts`(`discord/webhook.ts`와 공유, 2026-09-05
 * 리팩토링으로 단일화)에 있다 — 이 재export는 기존 호출부(`compare/logic.ts`·`page.tsx`·이
 * 파일의 `computeHeadline`)의 import 경로를 그대로 보존한다. `qAlpha` 기본값은 `FDR_ALPHA`
 * (0.1, 이전 하드코딩 값과 동일)이며, `computeHeadline`은 `deltas.meta.qAlpha`를 넘겨 실제 그
 * 델타 파일이 만들어질 때 쓴 값을 재사용한다.
 */
export { isSignificantDelta };

/**
 * Gap 소속 판정 — 실제 정의는 `pipeline/shared/status-order.ts`에 있다(서버·클라이언트가
 * 공유하는 단일 소스). 여기서는 기존 호출부(`page.tsx`·`releaseStream.ts`)의 import 경로를
 * 보존하기 위해 재export만 한다 — `isSignificantDelta`를 이 파일이 재export하는 것과 같은 관례다.
 */
export { isGapStatus };

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
  /** "패치노트는 N개 엔티티를 말했고" + 스탯 타일 "공지된 변화" — countRelevantNoteEntities. */
  noteEntityCount: number;
  /** 원문 패치노트 "항목" 수(`NotesFile.meta.itemCount`) — HANDOFF §4-1 "35 엔티티 / 215 항목"
   * 분리 표기에 쓰는 참고 병기 수치. */
  noteItemCount: number;
  /** "통계는 M개 변화를 말합니다" + 스탯 타일 "유의 변화" — `isSignificantDelta` 통과 건수. */
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
  let statCount = 0;
  let unannouncedCount = 0;
  for (const row of rows) {
    if (isSignificantDelta(row, qAlpha)) statCount++;
    if (isGapStatus(row.status)) unannouncedCount++;
  }
  return { noteEntityCount, noteItemCount, statCount, unannouncedCount };
}

/** delta===null은 "측정 불가"에 가까운 취급으로 정렬 맨 뒤로 보낸다(ST-08 verdict.sortDeltas와
 * 동일 관례). */
export function absDelta(record: DeltaRecord): number {
  return record.delta === null ? -Infinity : Math.abs(record.delta);
}

/** 릴리즈노트 스트림 미공지 카드 하단 delta 리스트에서, 헤더(ObservationLine)가 이미 보여준
 * 대표 관측(`observation`)과 같은 레코드(id 기준)를 제외한다 — 헤더 1회 + 리스트 1회로
 * 중복 렌더되던 결함(2026-09-11) 수정. `observation`이 null이면 원본을 그대로 돌려준다. */
export function excludeObservation(
  rows: readonly DeltaRecord[],
  observation: DeltaRecord | null
): DeltaRecord[] {
  if (!observation) return [...rows];
  return rows.filter((row) => row.id !== observation.id);
}

/** 미공지 변화 상위 N건 — ST-08 `writeDeltas`가 이미 상태 우선순위(unannounced 최우선) →
 * `|delta|` 내림차순으로 정렬해 기록하므로(verdict.sortDeltas), 여기서는 상태로 필터링만 하고
 * 파일 순서를 신뢰한다(재정렬하지 않음 — ST-11 프롬프트 "정렬은 파일 순서 신뢰"). */
export function selectTopUnannounced(deltas: DeltasFile | null, limit = 5): DeltaRecord[] {
  const rows = deltas?.rows ?? [];
  return rows.filter((r) => r.status === "unannounced").slice(0, limit);
}

/** 챔피언 델타 id가 "scope=all"(포지션 무관) 행인지 — `champion:{key}:{metric}`(3세그먼트)이면
 * all, `champion:{key}:{pos}:{metric}`(4세그먼트)이면 position(ST-08 id 네임스페이스 확정).
 * 다른 entityType은 이 구분이 없어 항상 true(우선순위 동점 처리 — 실질적으로 아래 dedupe에서
 * `|delta|` 비교로만 갈린다). */
function isAllScopeChampionRow(record: DeltaRecord): boolean {
  if (record.entityType !== "champion") return true;
  return record.id.split(":").length === 3;
}

/** 공지 대조 미리보기 상위 N건 — **엔티티 단위로 대표 1행만** 뽑아 `|delta|` 큰 순으로 정렬한다
 * (코디네이터 정정, 2026-09-05, 두 번째 라운드). 최초 구현은 `matchedNoteIds`가 있는 모든
 * **행**(픽률·밴률·승률·포지션별 픽/승 등 지표별로 별도 행)을 그대로 `|delta|`로 정렬해 상위
 * N개를 뽑았는데, 실측(26.17 자기쌍)에서 delta가 전부 0으로 동률이 되자 정렬이 안정 정렬로
 * 원본 파일 순서를 유지해 **같은 챔피언(예: 키아나)의 지표별 행 6개가 상위 5자리를 모두
 * 차지**했다 — 전부 같은 `matchedNoteId`를 공유하므로 미리보기 5행이 전부 동일한 노트 문장을
 * 반복해서 보여주는 결함으로 나타났다. 같은 엔티티는 하나만 대표로 뽑아야 5행이 서로 다른
 * 엔티티를 보여준다.
 *
 * 대표 선정 규칙: `entityType:entityKey`로 그룹핑 → 그룹 내에서 (1) 챔피언 scope=all 행 우선
 * (2) 그중(또는 scope 구분이 없으면 전체 중) `|delta|` 최댓값. */
export function selectAnnouncedPreview(deltas: DeltasFile | null, limit = 5): DeltaRecord[] {
  const matched = (deltas?.rows ?? []).filter((r) => r.matchedNoteIds.length > 0);

  const groups = new Map<string, DeltaRecord[]>();
  for (const row of matched) {
    const key = `${row.entityType}:${row.entityKey}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const representatives: DeltaRecord[] = [];
  for (const group of groups.values()) {
    const best = [...group].sort((a, b) => {
      const scopeDiff = Number(isAllScopeChampionRow(b)) - Number(isAllScopeChampionRow(a));
      if (scopeDiff !== 0) return scopeDiff;
      return absDelta(b) - absDelta(a);
    })[0];
    representatives.push(best);
  }

  return representatives.sort((a, b) => absDelta(b) - absDelta(a)).slice(0, limit);
}

/** 공지 대조 미리보기 행 텍스트 — "{엔티티명}[ · {스킬}] — {노트 stat 라인}[ 외 K건]"(코디네이터
 * 지시, 2026-09-05 — 프로토타입 "나서스 기본 지속 효과 생명력 흡수 12/18/24% ⇒ 10/15/20%"처럼
 * 엔티티명이 문장 맨 앞에 오도록). `matchedNoteCount`가 1보다 크면(같은 엔티티에 노트가 여럿
 * 걸림, 예: 스킬 변경 2줄) "외 K건"(K=matchedNoteCount-1)을 덧붙인다. `note`가 없으면(방어적
 * 케이스 — matchedNoteId가 있는데 notesById에서 못 찾는 경우) 엔티티명만 표시. */
export function formatNotePreviewText(
  note: PatchNoteItem | undefined,
  matchedNoteCount: number,
  fallbackEntityName: string
): string {
  if (!note) return fallbackEntityName;
  const skillPart = note.skill ? ` · ${note.skill}` : "";
  const extra = matchedNoteCount > 1 ? ` 외 ${matchedNoteCount - 1}건` : "";
  return `${note.entity}${skillPart} — ${note.summary}${extra}`;
}

/** `lib/format.ts`의 `"seconds"` → 이 파일(및 DeltaValue)이 쓰는 `"sec"` 표기로 옮긴다 — 하위
 * 소비처(DeltaValue.tsx의 `DeltaKind`, compare/logic.ts 등)가 전부 "sec"를 쓰므로 여기서만
 * 흡수한다(2026-09-05 리팩토링, `DeltaKind` 리네임은 범위 밖). */
const SHARED_KIND_TO_UI: Record<"pp" | "seconds" | "gold", DeltaKind> = {
  pp: "pp",
  seconds: "sec",
  gold: "gold",
};

/** DeltaRecord.metric → DeltaValue의 kind 3종. 분류 자체는 `lib/format.ts`의 `METRIC_KIND`
 * (`DeltaMetric` 전수 `Record`, 2026-09-05 리팩토링으로 단일화)에 위임한다. 알려지지 않은
 * metric은 "gold"(정수 그대로 표기)로 폴백한다(pp처럼 ×100 스케일링하면 임의 단위를 왜곡할
 * 위험이 더 크기 때문) — `METRIC_KIND`는 `DeltaMetric` 전수라 폴백이 없으므로, 이 폴백은
 * 여기 얇은 어댑터가 계속 책임진다. */
export function metricKind(metric: string): DeltaKind {
  const shared = METRIC_KIND[metric as DeltaMetric] as "pp" | "seconds" | "gold" | undefined;
  return shared ? SHARED_KIND_TO_UI[shared] : "gold";
}

/** 공지 대조 미리보기 ".note-observed" 텍스트 — "픽률 −1.8%p" 형태. delta===null이면 "관측
 * 불가"(레코드 자체가 없는 경우는 애초에 이 함수에 안 들어옴 — buildDeltas가 측정 불가 케이스는
 * 레코드를 생략하므로 null은 방어적 케이스). */
export function formatObservedSummary(record: DeltaRecord): string {
  if (record.delta === null) return `${metricLabel(record.metric)} 관측 불가`;
  const kind = metricKind(record.metric);
  const valueText =
    kind === "pp"
      ? fmtPp(record.delta)
      : kind === "sec"
        ? fmtDeltaSec(record.delta)
        : fmtDeltaInt(record.delta);
  return `${metricLabel(record.metric)} ${valueText}`;
}

/** DeltaRecord.before/after(절대값) 표시 — kind별 단위: pp=퍼센트(`fmtPct`, 분수 입력) ·
 * sec=`fmtSec`(mm:ss) · gold=`fmtInt`(천단위 콤마). `value===null`이면 "—"(측정 불가 방어). */
export function formatMetricValue(value: number | null, metric: string): string {
  if (value === null) return "—";
  const kind = metricKind(metric);
  if (kind === "pp") return fmtPct(value);
  if (kind === "sec") return fmtSec(value);
  return fmtInt(value);
}

/** id 문자열 → notes.json PatchNoteItem 조회 맵. */
export function indexNotesById(notes: NotesFile | null): Record<string, PatchNoteItem> {
  const map: Record<string, PatchNoteItem> = {};
  if (!notes) return map;
  for (const item of notes.items) map[item.id] = item;
  return map;
}

// **`resolveCause`/`CauseDisplay` 삭제(2026-09-17)** — `resolveGapCause`가 그 자리를 대신한다.
// 프로덕션 소비자는 `ReleaseNoteRow` 하나였고, 그 문구가 "근거 미확인" 한 마디로 **세 가지 다른
// 상태**(호출 안 됨 / 검토했으나 후보 없음 / 후보 미검증)를 덮고 있던 것이 이번 지적의 핵심이라
// 함수를 고치는 대신 계약을 바꿨다. 남겨 두면 다음 사람이 "둘 중 뭘 써야 하지"를 묻게 된다 —
// 이 세션에서 `selectIndirectEffects`를 지운 것과 같은 기준이다.
// (프로토타입 `01-briefing-home.html`의 `.delta-cause` 표기 계보는 `resolveGapCause` 주석이 승계.)

/**
 * Gap 행의 원인 표시 — **네 상태를 구분한다**(사용자 지적 B5, 2026-09-17: "미공지 Gap의
 * 데이터가 대부분 근거 미확인으로 표시됨").
 *
 * 왜 네 갈래인가(실측, 26.17→26.18 미공지 47건):
 *
 * | 실제 상태 | 건수 | 이전 표기 | 지금 표기 |
 * |---|---|---|---|
 * | LLM 호출 자체가 안 됨(세션 상한 밖) | 14 | "근거 미확인" | **원인 미검토** |
 * | LLM이 검토했고 후보가 없음 | 22 | "근거 미확인" | **설명 후보 없음(검토 완료)** |
 * | 후보 있으나 미검증 | 0 | "… — 근거 미확인" | **후보 미검증** |
 * | 검증된 후보 있음 | 5~11 | 원인 문장 | **추정 원인** |
 *
 * **이전 표기의 결함**: 위 1·2행이 같은 문구였다. 둘은 전혀 다르다 — 앞은 우리 파이프라인이
 * 덜 돈 것이고, 뒤는 **정직한 관측 결과**다(미공지 상위는 대부분 밴률인데, 밴률 이동은
 * 메타·인기도 기인이라 패치노트 원인이 없는 것이 정상이다). 둘을 같은 말로 부르면 시스템이
 * 고장난 것처럼 보이고, 실제로 사용자가 그렇게 읽었다.
 *
 * 판별 근거는 `DeltaRecord.llm`이다: 필드 자체가 없으면 대상이 아니었고(미검토),
 * `skipped:true`면 예산 초과, `skipped:false`인데 causes가 비면 검토 후 후보 없음.
 *
 * 표기 계보: 프로토타입 `01-briefing-home.html`의 `.delta-cause` 5개 행. 검증된 것만 본문색,
 * 나머지는 회색이라는 규칙은 그대로 승계한다(무근거 문장은 회색).
 */
/**
 * 2026-09-18(채점 라운드1 ST-2, 사용자 확정 M1): `weak` 추가. 모델을 Opus로 올리면 후보는
 * 늘지만(A/B 12/12) 신뢰도가 거의 전부 `low`다. `verified:true`는 "인용한 노트 id가 실재한다"는
 * 뜻이지 "믿을 만하다"가 아니므로, low는 본문색 "추정 원인"이 아니라 회색 "가능성"으로만
 * 나간다 — 무근거 회색 원칙을 신뢰도 축까지 확장한 것이다.
 */
export type GapCauseMode = "verified" | "weak" | "candidate" | "none" | "unreviewed";

const CONFIDENCE_RANK: Record<LlmCause["confidence"], number> = { high: 2, medium: 1, low: 0 };

/** 대표 후보 — 검증된 것 중 신뢰도가 가장 높은 것, 없으면 첫 후보. `causes[0]`을 그대로
 * 쓰면 low가 앞에 오고 medium이 뒤에 있는 행이 회색으로 떨어진다. */
function representativeCause(causes: readonly LlmCause[]): LlmCause | undefined {
  let best: LlmCause | undefined;
  for (const cause of causes) {
    if (!cause.verified) continue;
    if (!best || CONFIDENCE_RANK[cause.confidence] > CONFIDENCE_RANK[best.confidence]) best = cause;
  }
  return best ?? causes[0];
}

export interface GapCauseDisplay {
  mode: GapCauseMode;
  text: string;
}

export function resolveGapCause(record: DeltaRecord): GapCauseDisplay {
  const cause: LlmCause | undefined = representativeCause(record.causes);
  if (cause) {
    if (cause.verified) {
      return { mode: cause.confidence === "low" ? "weak" : "verified", text: cause.text };
    }
    return { mode: "candidate", text: `${cause.text} — 후보 미검증` };
  }
  if (!record.llm) {
    return { mode: "unreviewed", text: "원인 미검토 — 이번 실행의 분석 상한에 들지 않았습니다" };
  }
  if (record.llm.skipped) {
    return {
      mode: "unreviewed",
      text: `원인 미검토 — ${record.llm.reason === "call-budget-exceeded" ? "호출 예산 소진" : "분석 건너뜀"}`,
    };
  }
  // 문구 압축(2026-09-18 ST-8) — 같은 문장이 Gap 탭에 21회 반복돼 노이즈였다. 뜻은 유지한다.
  return { mode: "none", text: "설명 후보 없음 — 노트에 원인 조항 없음" };
}

/** entityType이 champion/item이 아닌 행(objective·lane·summary)의 EntityIcon 폴백 글자 —
 * DdragonPicture가 없는 엔티티에 프로토타입처럼 의미 있는 한 글자를 준다(기본 동작은 이름
 * 첫 글자라 "첫 용 처치 시각"이 "첫"이 되어 버려 무의미하다). champion/item은 undefined를
 * 반환해 EntityIcon 기본 동작(ddragon 이미지 우선)에 맡긴다. */
export function entityFallbackLabel(record: Pick<DeltaRecord, "entityType" | "entityKey">): string | undefined {
  if (record.entityType === "objective") {
    const labels: Record<string, string> = { dragon: "용", herald: "전", baron: "바", tower: "포" };
    return labels[record.entityKey];
  }
  if (record.entityType === "lane") return "골";
  if (record.entityType === "summary") return "경";
  return undefined;
}
