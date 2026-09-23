// src/pipeline/match/pubg-delta.ts
// PUBG 델타 산출 + 판정 — 순수 함수. LoL 경로(delta.ts·verdict.ts)와 같은 판정 어휘
// (MatchStatus)를 쓰되, 효과크기 바닥만은 **이 게임 데이터에서 유도**한다.
//
// **왜 EFFECT_SIZE_FLOORS를 재사용하지 않는가**: 그 8개 값은 LoL 실측에서 도출된 것이다
// (픽/밴은 경기당 고정 슬롯인 제로섬 구조, 라인 골드는 최대 75골드 …). PUBG 픽업 점유율에
// 쓸 근거가 0이고, 바닥 없이 출하하면 시행수 수십만 규모에서 전부 "유의"로 터진다 —
// 2026-09-13에 이미 겪은 실패(미공지 277건 중 84%가 잡음)의 재현이다.
// 그래서 **패치노트가 언급하지 않은 무기들의 변화 분포를 귀무분포로 삼아** 바닥을 만든다.
import type { Interval, MatchStatus, LlmCause, PatchNoteItem } from "../types";
import type { PubgPatchAggregate } from "../aggregate/pubg-weapons";

/** 손으로 옮긴 PUBG 패치노트 항목 1건(파서 없음 — PLAN §5, 43.1 노트는 수기 입력). */
export interface PubgNoteItem {
  id: string;
  patch: string;
  /** 대상 무기 itemId. 무기가 특정되지 않는 항목은 빈 배열. */
  weaponKeys: string[];
  stat: string;
  before: string | null;
  after: string | null;
  direction: "buff" | "nerf" | "adjust" | "unknown";
  /**
   * 점유율로 검증 가능한 항목이면 기대 상대변화(-0.30 = 30% 감소). 검증 축이 설계되지
   * 않은 항목(반동·ADS 등)은 null — 이때 판정은 항상 회색으로 떨어진다(무근거 문장 금지).
   */
  expectedRelChange: number | null;
  summary: string;
  anchorUrl: string;
}

export interface PubgDeltaRow {
  id: string;
  weaponKey: string;
  weaponName: string;
  metric: "pickupShare";
  before: number | null;
  after: number | null;
  /** 상대 변화(-0.162 = 16.2% 감소). 점유율 차이가 아니라 비율이라 노트와 직접 비교된다. */
  relChange: number | null;
  /** relChange의 95% 신뢰구간. */
  relCi: Interval;
  n: { before: number; after: number };
  status: MatchStatus;
  matchedNoteId: string | null;
  matchedNoteIds: string[];
  evidence: { aggregatePath: string; noteAnchor: string | null; matchIds: string[] };
  /**
   * LLM 2단이 짚은 **간접 원인 후보**(2026-09-23 신설). 선택 필드인 이유는 이 파이프라인이
   * LLM 단계를 건너뛸 수 있기 때문이다 — 없는 것과 0건인 것을 구분한다. 검증(`verified`)을
   * 통과하지 못한 문장은 화면에서 회색으로만 쓰인다(무근거 회색 원칙).
   */
  causes?: LlmCause[];
  /**
   * LLM 2단 처리 진단 + 브리핑 한 줄 요약. `DeltaRecord.llm`과 같은 계약이다 —
   * `skipped=true`면 예산 소진·파싱 실패 등으로 끝내 처리하지 못했다는 뜻이고 `causes`는 항상 `[]`다.
   */
  llm?: {
    skipped: boolean;
    reason?: string;
    summary?: string;
    summaryCites?: string[];
    summaryVerified?: boolean;
  };
}

/** 점유율 비교 최소 시행수 — 이보다 적으면 `insufficient-sample`. */
export const PICKUP_MIN_N = 300;

/**
 * 공지값 대비 관측값의 허용 비율. 이 범위 안이면 `announced-consistent`.
 *
 * **CI 포함 여부로 판정하면 안 된다**(2026-09-16 실측으로 폐기한 최초 규칙). 픽업 시행수가
 * 수만~수십만이면 CI 폭이 ±1%p대로 좁아져 공지값을 거의 항상 배제한다 — 실제로 RPD -26.0%
 * [-27.3, -24.7]가 공지 -30%를 배제해 "불일치"로 찍혔다. 그 규칙을 그대로 두면 모든 공지
 * 항목이 불일치가 되는 오탐 기계가 된다(2026-09-13 "미공지 277건 중 84% 잡음"과 같은 실패).
 *
 * **더 근본적으로, 정확한 배수 일치를 기대하는 것 자체가 틀렸다.** 픽업 점유율은 스폰율의
 * **대리 지표**다 — 스폰이 30% 줄어도 플레이어가 남은 것을 더 적극적으로 줍거나(감쇠) 너프
 * 소식에 회피하면(증폭) 관측 배수가 달라진다. 이 감쇠·증폭 계수를 추정할 방법이 없으므로
 * 검증 가능한 것은 **방향 + 자릿수**이고, 그 범위를 이 밴드가 명시한다. 밴드를 넘으면
 * "공지와 관측이 자릿수 단위로 어긋난다"는 뜻이라 불일치로 판정할 근거가 된다.
 */
export const ANNOUNCED_RATIO_BAND: readonly [number, number] = [0.5, 1.5];

const Z = 1.96;

/**
 * 두 비율의 **로그비** 신뢰구간 → 상대변화 CI. 점유율 차이(percentage point)가 아니라
 * 비율을 보는 이유는 패치노트가 "스폰율 30% 감소"처럼 상대값으로 쓰이기 때문이다 —
 * 같은 단위로 맞춰야 공지와 관측을 직접 대조할 수 있다.
 */
export function relChangeInterval(
  before: number,
  nBefore: number,
  after: number,
  nAfter: number
): { rel: number; ci: Interval } {
  if (before <= 0 || after <= 0 || nBefore <= 0 || nAfter <= 0) {
    return { rel: 0, ci: [0, 0] };
  }
  const pBefore = before / nBefore;
  const pAfter = after / nAfter;
  const logRatio = Math.log(pAfter / pBefore);
  // 포아송/이항 근사: Var(log p̂) ≈ (1-p)/x ≈ 1/x (p가 작을 때).
  const se = Math.sqrt((1 - pBefore) / before + (1 - pAfter) / after);
  return {
    rel: Math.exp(logRatio) - 1,
    ci: [Math.exp(logRatio - Z * se) - 1, Math.exp(logRatio + Z * se) - 1],
  };
}

/**
 * **효과크기 바닥을 데이터에서 유도한다.** 패치노트가 언급하지 않은 무기들의 |상대변화|
 * 분포가 곧 "패치와 무관한 변동"의 귀무분포다. 그 90번째 백분위수를 바닥으로 삼으면
 * "언급 없는 무기 10개 중 9개보다 크게 움직였다"가 유의성의 실무적 의미가 된다.
 *
 * 시행수가 적은 무기는 분포를 부풀리므로 `PICKUP_MIN_N`을 넘는 것만 쓴다.
 */
export function deriveEffectFloor(
  rows: readonly { weaponKey: string; relChange: number | null; n: { before: number; after: number } }[],
  mentionedKeys: ReadonlySet<string>,
  percentile = 0.9
): number {
  const nulls = rows
    .filter(
      (r) =>
        !mentionedKeys.has(r.weaponKey) &&
        r.relChange !== null &&
        r.n.before >= PICKUP_MIN_N &&
        r.n.after >= PICKUP_MIN_N
    )
    .map((r) => Math.abs(r.relChange as number))
    .sort((a, b) => a - b);
  if (nulls.length === 0) return Infinity;
  const idx = Math.min(nulls.length - 1, Math.floor(percentile * nulls.length));
  return nulls[idx] as number;
}

function significant(ci: Interval): boolean {
  return (ci[0] > 0 && ci[1] > 0) || (ci[0] < 0 && ci[1] < 0);
}

/**
 * 판정. 공지 항목이 붙은 무기는 **기대값이 관측 CI 안에 들어오는지**로 일치/불일치를 가른다 —
 * 이것이 이 제품의 핵심 판정이다("공지는 -30%인데 실제는 -16%"). 기대값이 없는 공지 항목
 * (반동·ADS처럼 관측 축이 설계되지 않은 것)은 판정하지 않고 회색으로 남긴다.
 */
/**
 * 95% 신뢰구간에서 **0에 가장 가까운 끝** — "최소한 이만큼은 움직였다"고 말할 수 있는 크기다.
 * 구간이 0을 가로지르면 0(주장할 수 있는 하한이 없다).
 *
 * 정렬 키를 점추정 |relChange|에서 이 값으로 바꾼 이유(2026-09-16 verify-impl B-4): 점추정으로
 * 줄을 세우면 **표본이 작아 구간이 넓은 항목이 위로 올라온다**. 실측에서 Groza(+26.3%,
 * n=879, CI 반폭 ±12%p)와 L6(+20.2%, ±10%p)가 Beryl M762(+15.7%, n=32,835, ±1.8%p)보다
 * 앞섰다 — 목록 첫 줄이 가장 흔들리는 발견이 되는 구조다. 하한으로 세우면 L6가 4번째로
 * 내려가고 Beryl이 2번째로 올라온다. "효과가 크다"가 아니라 **"작다고 말하기 어렵다"** 순서다.
 */
export function conservativeEffect(relCi: readonly [number, number]): number {
  const [lo, hi] = relCi;
  if (lo > 0) return lo;
  if (hi < 0) return Math.abs(hi);
  return 0;
}

export function classify(
  relChange: number | null,
  relCi: Interval,
  n: { before: number; after: number },
  note: PubgNoteItem | null,
  effectFloor: number
): MatchStatus {
  if (relChange === null || n.before < PICKUP_MIN_N || n.after < PICKUP_MIN_N) {
    return "insufficient-sample";
  }
  if (note) {
    if (note.expectedRelChange === null) {
      // 공지는 있으나 이 축으로는 검증할 수 없다 — 지어내지 않고 회색.
      return "no-change";
    }
    const expected = note.expectedRelChange;
    if (relChange === 0 || Math.sign(relChange) !== Math.sign(expected)) {
      // 방향 자체가 다르면(또는 안 움직였으면) 불일치 — 크기를 볼 것도 없다.
      return "announced-inconsistent";
    }
    const ratio = relChange / expected;
    return ratio >= ANNOUNCED_RATIO_BAND[0] && ratio <= ANNOUNCED_RATIO_BAND[1]
      ? "announced-consistent"
      : "announced-inconsistent";
  }
  if (!significant(relCi)) return "no-change";
  return Math.abs(relChange) >= effectFloor ? "unannounced" : "below-threshold";
}

/** 무기 → 그 무기를 언급한 노트 항목들. */
function indexNotes(notes: readonly PubgNoteItem[]): Map<string, PubgNoteItem[]> {
  const idx = new Map<string, PubgNoteItem[]>();
  for (const note of notes) {
    for (const key of note.weaponKeys) {
      const list = idx.get(key) ?? [];
      list.push(note);
      idx.set(key, list);
    }
  }
  return idx;
}

export interface PubgDeltaResult {
  rows: PubgDeltaRow[];
  effectFloor: number;
  counts: Partial<Record<MatchStatus, number>>;
}

export function buildPubgDeltas(
  before: PubgPatchAggregate,
  after: PubgPatchAggregate,
  notes: readonly PubgNoteItem[],
  sampleMatchIds: ReadonlyMap<string, string[]>
): PubgDeltaResult {
  const noteIndex = indexNotes(notes);
  const mentioned = new Set(noteIndex.keys());
  const beforeByKey = new Map(before.weapons.map((w) => [w.weaponKey, w]));

  // 1단: 수치만 먼저 만든다(바닥 유도에 필요).
  const base = after.weapons.map((w) => {
    const prev = beforeByKey.get(w.weaponKey);
    const nBefore = prev?.pickups ?? 0;
    const { rel, ci } = relChangeInterval(nBefore, before.totalPickups, w.pickups, after.totalPickups);
    const usable = nBefore > 0 && w.pickups > 0;
    return {
      weapon: w,
      prev,
      relChange: usable ? rel : null,
      relCi: ci,
      n: { before: nBefore, after: w.pickups },
    };
  });

  // 2단: 언급되지 않은 무기 분포에서 바닥을 유도한다.
  const effectFloor = deriveEffectFloor(
    base.map((b) => ({ weaponKey: b.weapon.weaponKey, relChange: b.relChange, n: b.n })),
    mentioned
  );

  // 3단: 판정.
  const counts: Partial<Record<MatchStatus, number>> = {};
  const rows: PubgDeltaRow[] = base.map((b) => {
    const matched = noteIndex.get(b.weapon.weaponKey) ?? [];
    // 검증 가능한(기대값이 있는) 항목을 대표로 올린다 — 없으면 첫 항목.
    const primary = matched.find((note) => note.expectedRelChange !== null) ?? matched[0] ?? null;
    const status = classify(b.relChange, b.relCi, b.n, primary, effectFloor);
    counts[status] = (counts[status] ?? 0) + 1;
    return {
      id: `pubg:weapon:${b.weapon.weaponKey}:pickupShare`,
      weaponKey: b.weapon.weaponKey,
      weaponName: b.weapon.weaponName,
      metric: "pickupShare",
      before: b.prev ? b.prev.share : null,
      after: b.weapon.share,
      relChange: b.relChange,
      relCi: b.relCi,
      n: b.n,
      status,
      matchedNoteId: primary?.id ?? null,
      matchedNoteIds: matched.map((note) => note.id),
      evidence: {
        aggregatePath: `data/aggregated/pubg/weapons-${after.patch}.json#weapons[weaponKey=${b.weapon.weaponKey}]`,
        noteAnchor: primary?.anchorUrl ?? null,
        matchIds: sampleMatchIds.get(b.weapon.weaponKey) ?? [],
      },
    };
  });

  rows.sort((a, z) => {
    const d = conservativeEffect(z.relCi) - conservativeEffect(a.relCi);
    return d !== 0 ? d : Math.abs(z.relChange ?? 0) - Math.abs(a.relChange ?? 0);
  });
  return { rows, effectFloor, counts };
}

/**
 * PUBG 노트 → **공용 `PatchNoteItem`**(2026-09-23).
 *
 * LLM 2단 엔진과 화면의 원인 패널이 둘 다 `PatchNoteItem`을 전제로 서 있다. 변환을 두 곳에서
 * 따로 하면 같은 노트가 서로 다른 문자열이 되어, 원인 문장이 인용한 id를 화면이 못 찾는다.
 *
 * `entity`에 **무기 표시명을 이어 붙인다**(「RPD · M249」) — 한 줄이 여러 무기를 말하기 때문이다.
 * 자기참조 판정은 이 문자열이 아니라 원본 키 배열이 한다(`llm-profile-pubg.ts` 참고).
 */
export function pubgNotesAsPatchNotes(
  notes: readonly PubgNoteItem[],
  nameOf: (weaponKey: string) => string | null
): PatchNoteItem[] {
  return notes.map((note) => ({
    id: note.id,
    patch: note.patch,
    // PUBG 노트는 전부 무기 조항이다 — 섹션 축이 하나뿐이라 `item`으로 고정한다.
    section: "item" as const,
    entity: note.weaponKeys.map((key) => nameOf(key) ?? key).join(" · ") || "체계",
    skill: null,
    stat: note.stat,
    before: note.before,
    after: note.after,
    direction: note.direction,
    summary: note.summary,
    anchorUrl: note.anchorUrl,
    anchorKind: "page" as const,
    modeScope: "core" as const,
  }));
}
