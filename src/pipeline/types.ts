import type { NoteModeScope } from "./shared/mode-scope";
// src/pipeline/types.ts
// 파이프라인 핵심 도메인 타입. 구현은 각 모듈(collect/aggregate/match)에서 채운다 — 여기는
// 계약(contract)만 정의한다. SCOPE §2 F1~F4 참고. ST-01 확정본 — 다른 배치가 그대로 소비한다.
// 변경 시 반드시 docs/plan/PLAN-patchgap.md ⑥을 함께 갱신한다.

/** 패치 번호. 정규형은 패치노트 표기(예: "26.17") — shared/patches.ts의 canonicalPatch()가 보장한다. */
export type PatchId = string;

/** [low, high] 형태의 신뢰구간(CI) 튜플. */
export type Interval = [number, number];

/** Riot teamPosition 원본 값. 빈 문자열은 미배정(아레나 잔재 등 비표준 케이스)을 뜻한다. */
export type TeamPosition = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "";

/** teamPosition 중 실제 라인 집계에 쓰이는 5개 값(빈 문자열 제외). */
export type LanePosition = Exclude<TeamPosition, "">;

/** participant.challenges 중 파이프라인이 소비하는 필드 — 매치마다 존재 여부가 다르므로 전부 optional. */
export interface ParticipantChallenges {
  goldPerMinute?: number;
  laneMinionsFirst10Minutes?: number;
  damagePerMinute?: number;
}

/** collect 단계에서 reduce-on-ingest로 남기는 참가자 요약 레코드. MatchSlim.participants 1개 = 이 타입. */
export interface ParticipantSlim {
  puuid: string;
  championId: number;
  championName: string;
  teamId: number;
  teamPosition: TeamPosition;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  /** item0..6 순서 그대로 7개 슬롯(빈 슬롯은 0). */
  items: number[];
  goldEarned: number;
  challenges: ParticipantChallenges;
}

/** 팀 단위 오브젝트 1종의 최초 획득 여부·횟수. */
export interface TeamObjectiveRecord {
  first: boolean;
  kills: number;
}

/** teams[].objectives — void 유충(grubs)은 패치에 따라 존재하지 않을 수 있어 optional. */
export interface TeamObjectives {
  baron: TeamObjectiveRecord;
  dragon: TeamObjectiveRecord;
  riftHerald: TeamObjectiveRecord;
  tower: TeamObjectiveRecord;
  grubs?: TeamObjectiveRecord;
}

/** collect 단계에서 reduce-on-ingest로 남기는 팀 요약 레코드. */
export interface TeamSlim {
  teamId: number;
  win: boolean;
  bans: number[];
  objectives: TeamObjectives;
}

/**
 * collect 단계에서 reduce-on-ingest로 남기는 매치 요약 레코드 (JSONL 1줄 = MatchSlim 1개).
 * 불변식(런타임에서 강제, 타입으로는 표현하지 않음 — 튜플 캐스팅보다 toMatchSlim()의 명시적
 * 검증이 실제 보장을 준다): participants.length === 10, teams.length === 2.
 */
export interface MatchSlim {
  matchId: string;
  gameVersion: string;
  patch: PatchId;
  gameCreationMs: number;
  gameDurationSec: number;
  queueId: number;
  participants: ParticipantSlim[];
  teams: TeamSlim[];
}

/** 라인 하나(블루/레드 한쪽)의 10분·14분 시점 골드 스냅샷. 표본에 해당 시점 프레임이 없으면 null. */
export interface LaneGoldSnapshot {
  goldAt10: number | null;
  goldAt14: number | null;
}

/** 라인 하나의 블루/레드 양쪽 골드 스냅샷. */
export interface TimelineLaneSplit {
  blue: LaneGoldSnapshot;
  red: LaneGoldSnapshot;
}

/** 매치 전체의 첫 오브젝트 획득 시각(초). 해당 이벤트가 없으면 null. */
export interface FirstObjectiveSeconds {
  dragonSec: number | null;
  heraldSec: number | null;
  baronSec: number | null;
  towerSec: number | null;
}

/** collect/timeline.ts가 남기는 타임라인 표본 요약 레코드 (JSONL 1줄 = TimelineSlim 1개). */
export interface TimelineSlim {
  matchId: string;
  patch: PatchId;
  lanes: Partial<Record<LanePosition, TimelineLaneSplit>>;
  firstObjectives: FirstObjectiveSeconds;
}

/**
 * 비율 지표(픽률·밴률·승률) 각각의 CI. 승률은 최소 n 게이트 미달 시 null.
 * 밴은 포지션 정보가 없는 챔피언 단위 지표라 `ChampionStat.scope !== "all"`인 행(포지션별·미배정)
 * 에서는 항상 null이다 — ST-08이 같은 밴을 여러 포지션 행에서 중복 합산하는 것을 계약으로
 * 차단한다(ST-06 실장 중 발견, 2026-09-05 types.ts로 승격).
 */
export interface ChampionRateCi {
  pick: Interval;
  ban: Interval | null;
  win: Interval | null;
}

/**
 * 챔피언 단위 집계 지표. `scope`로 세 종류의 행을 구분한다:
 * - `"position"`: 명명된 포지션(TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY) 1개에서의 등장(픽/승) 통계.
 * - `"unknown"`: teamPosition이 빈 문자열(미배정·비표준 케이스)인 등장 통계.
 * - `"all"`: 챔피언 전체(포지션 무관) 합산 — 챔피언당 정확히 1행. **밴률(`banRate`/`ci.ban`)은
 *   이 scope에서만 값이 있다.**
 * `position`은 `scope==="position"`일 때만 명명된 포지션 값을, 그 외(`"all"`/`"unknown"`)는
 * `""`을 갖는다 — `""`이 곧 "미배정"이던 이전 계약을 `scope`가 명시적으로 대체한다.
 */
export interface ChampionStat {
  championId: number;
  championKey: string;
  championName: string;
  position: LanePosition | "";
  patch: PatchId;
  scope: "all" | "position" | "unknown";
  /** pickRate/banRate의 공통 분모(해당 패치 전체 매치 수) — 행 단위로 자기완결시킨다. */
  totalMatches: number;
  n: number;
  pickRate: number;
  /** scope!=="all"이면 null(위 ChampionRateCi 주석 참고). */
  banRate: number | null;
  winRate: number;
  ci: ChampionRateCi;
}

/** 아이템 채택률 집계 지표 (완성템 필터는 ST-08 Data Dragon 매핑 단계 몫 — 여기서는 6슬롯에
 * 등장한 아이템 전체를 집계). */
export interface ItemStat {
  itemId: number;
  patch: PatchId;
  n: number;
  /** adoptionRate의 분모(해당 패치 전체 참가자 수 = 매치 수 × 10) — 행 단위로 자기완결시킨다. */
  totalParticipants: number;
  adoptionRate: number;
  ci: Interval;
}

/** 오브젝트 1종의 확장 통계 — null 제외 평균·표본표준편차·n + 발생 비율(실제로 그 이벤트가
 * 있었던 매치 비율). */
export interface ObjectiveMetricDetail {
  n: number;
  mean: number | null;
  sd: number;
  occurrenceRate: number;
}

/** 오브젝트(용·전령·바론·포탑) 최초 획득 시각 집계 — 라인 골드는 LaneGoldStat으로 분리(F8).
 * `n`은 오브젝트 종류와 무관한 공통 표본(타임라인) 수 — 오브젝트별 실제 발생 건수·sd·발생 비율은
 * `dragon`/`herald`/`baron`/`tower` 하위 필드에 있다. */
export interface ObjectiveStat {
  patch: PatchId;
  n: number;
  firstDragonSecAvg: number | null;
  firstHeraldSecAvg: number | null;
  firstBaronSecAvg: number | null;
  firstTowerSecAvg: number | null;
  dragon: ObjectiveMetricDetail;
  herald: ObjectiveMetricDetail;
  baron: ObjectiveMetricDetail;
  tower: ObjectiveMetricDetail;
}

/** 라인별 10분/14분 시점 평균 골드 집계 (F8). `goldAt14Avg`는 non-nullable이라 `n14===0`이면
 * 실측 없는 0이 들어갈 수 있다 — 소비처는 반드시 `n14`을 먼저 확인해야 한다. */
export interface LaneGoldStat {
  patch: PatchId;
  position: LanePosition;
  n: number;
  goldAt10Avg: number;
  goldAt10Sd: number;
  goldAt14Avg: number;
  goldAt14Sd: number;
  n14: number;
}

/** 패치 단위 요약 지표(브리핑 홈 카드용). */
export interface PatchSummary {
  patch: PatchId;
  matches: number;
  avgDurationSec: number;
  avgDurationSecSd: number;
  firstDragonSecAvg: number | null;
  firstHeraldSecAvg: number | null;
  firstBaronSecAvg: number | null;
  firstTowerSecAvg: number | null;
  /** queueId → 해당 큐로 진행된 매치 수. */
  queueDistribution: Record<number, number>;
  /** 수집된 매치들의 gameCreationMs 최소~최대 범위. 매치 0건이면 null. */
  gameCreationMsRange: { min: number; max: number } | null;
  /** 타임라인 표본 수(matches와 별도 — F8은 상세 수집의 부분표본). */
  timelineSamples: number;
}

/** `scripts/run-aggregate.ts`가 champions/items/lanes/objectives/summary.json 5종에 공통으로
 * 얹는 메타 블록(2026-09-05 리팩토링 — 원래 `src/lib/data.ts` 로컬 정의를 여기로 승격, `data.ts`는
 * re-export만 한다. `src/pipeline/match/delta.ts`의 `loadAggregatedPatch`는 이 필드들을 읽지 않고
 * `rows`/`data`만 뽑아 쓰므로 이 타입으로 교체해도 영향이 없다). */
export interface AggregateMeta {
  patch: PatchId;
  generatedAt: string;
  nMatches: number;
  nParticipants: number;
  nTimelines: number;
  source: string;
}

/** 배열형 산출 파일(`{meta, rows: T[]}`) 공통 래퍼 — champions/items/lanes.json. */
export interface RowsFile<T> {
  meta: AggregateMeta;
  rows: T[];
}

/** 단일 객체형 산출 파일(`{meta, data: T}`) 공통 래퍼 — objectives/summary.json. */
export interface DataFile<T> {
  meta: AggregateMeta;
  data: T;
}

/**
 * `spellIconKey(entity, skill)`(`src/pipeline/match/spell-icon.ts`) → 스펠 아이콘 파일명
 * (`public/dd/spell/` 아래). 상세 JSON 170여 개를 커밋하지 않고 노트에 등장한 (entity, skill)
 * 쌍만 slim 인덱스로 산출한다.
 */
export type SpellIconMap = Record<string, string>;

/** `data/aggregated/spell-icons.json` 전체 파일 형태 — scripts/run-ddragon.ts가 산출한다.
 * 특정 패치가 아니라 전 패치 노트를 스캔한 결과라 `AggregateMeta`(patch 단일값 전제)를 재사용하지
 * 않고 별도 메타를 둔다. */
export interface SpellIconIndexFile {
  meta: {
    ddragonVersion: string;
    generatedAt: string;
    count: number;
  };
  icons: SpellIconMap;
}

/** 패치노트 항목 섹션 분류. */
export type PatchNoteSection = "champion" | "item" | "system" | "other";

/** 패치노트 파서가 산출하는 항목 1건. */
export interface PatchNoteItem {
  id: string;
  patch: PatchId;
  section: PatchNoteSection;
  /**
   * section이 `"system"`일 때만 의미 있는 세부 분류(그 외 section에서는 항상 undefined).
   * "룬" 밸런스 변경은 `"rune"`, "체계"(게임 매커니즘) 변경은 `"system"`. 클래식/버그 수정/
   * 시스템 사양 업데이트처럼 더 세분화할 근거가 없으면 undefined로 둔다(ST-07 라운드 2).
   */
  subsection?: "rune" | "system";
  entity: string;
  skill: string | null;
  stat: string | null;
  before: string | null;
  after: string | null;
  direction: "buff" | "nerf" | "adjust" | "unknown";
  summary: string;
  anchorUrl: string;
  /**
   * anchorUrl의 정밀도. `"entity"`=해당 엔티티 고유 앵커(h3 id) · `"section"`=섹션 헤더 앵커로
   * 폴백(엔티티 전용 앵커가 없음) · `"page"`=앵커 없이 기본 URL(섹션 앵커조차 없음). 하류(브리핑
   * 화면)가 링크 정밀도를 구분해 표시할 수 있도록 ST-07 라운드 2에서 추가.
   */
  anchorKind: "entity" | "section" | "page";
  /**
   * 이 노트가 **어디에 적용되나**. `"core"`는 소환사의 협곡(우리 집계 대상), 나머지는 별도 게임
   * 모드(LoL 클래식·아수라장·아레나 등)다. `section`이 "무엇이 바뀌었나"라면 이쪽은 적용 범위이고,
   * 짝짓기·인과 추론 자격은 **이 필드 하나로** 판정한다(2026-09-19).
   *
   * 왜 section 재분류가 아니라 새 필드인가: 노트 id가 section을 포함해서, section을 바꾸면 커밋된
   * 델타의 matchedNoteIds가 전부 댕글링되고 LLM 캐시(candidateSetHash)도 전량 무효가 된다.
   * 근거: docs/plan/BRAINTRUST-root-fix-2026-09-19.md §4.
   */
  modeScope: NoteModeScope;
}

/**
 * 델타(관측 변화)의 판정 상태 — UX-BRIEF의 4개 상태 뱃지 + `"no-change"`(ST-08 신규) +
 * `"below-threshold"`(2026-09-13 신규, 아래 참고).
 * `"no-change"`: 비유의(q>=FDR_ALPHA 이거나 CI가 0 포함)이고 패치노트 짝도 없는 델타 — "노트도
 * 없고 통계적으로도 변화가 없다"는 뜻으로, `unannounced`(짝 없음+유의)와는 구별해야 한다(그렇지
 * 않으면 소음 델타가 전부 "미공지 변화"로 잘못 뜬다). 하류(UI)는 회색으로 표시한다.
 * `"below-threshold"`: 짝 없음 + 통계적으로 유의(q<FDR_ALPHA, CI가 0 미포함)하지만 효과크기
 * 바닥(`aggregate/stats.ts` `EFFECT_SIZE_FLOORS`/`meetsEffectFloor`) 미달인 델타. n≈10,000
 * 규모에서는 0.2%p 픽률 변화도 통계적으로 유의해지므로(실측: 픽/밴은 경기당 고정 슬롯인 제로섬
 * 구조라 한 챔피언의 변화가 다수 챔피언의 강제 반대 방향 이동으로 상쇄되고, 그 이동분이 개별
 * 적으로 유의하게 잡힘) `no-change`(비유의)와는 다른 의미다 — "실재하는 변화이지만 실무상 무시
 * 가능한 규모"라는 뜻. `unannounced`로 승격시키지 않는다(docs/plan/
 * PLAN-unannounced-effect-size-floor-2026-09-13.md). 정렬 우선순위는
 * `src/pipeline/shared/status-order.ts` 단일 소스를 따른다.
 */
export type MatchStatus =
  | "announced-consistent"
  | "announced-inconsistent"
  | "unannounced"
  | "indirect-effect"
  | "insufficient-sample"
  | "below-threshold"
  | "no-change";

/**
 * F4 2단(LLM)이 제시하는 간접 영향 후보 원인 1건. candidateNoteId는 후보셋 검증(verified) 전까지
 * 링크로 노출하지 않는다(텍스트는 회색 표기용으로 보존). `confidence`는 ST-09가 LLM 출력 스키마에
 * 맞춰 추가한 필드 — 하류(UI)가 신뢰도 배지를 달 때 쓴다.
 */
export interface LlmCause {
  text: string;
  candidateNoteId: string | null;
  verified: boolean;
  confidence: "high" | "medium" | "low";
}

/** DeltaRecord.id가 가리키는 엔티티 종류. `"summary"`는 패치 단위 매치 평균 지표(ST-08 신규
 * — `summary:avgDurationSec` 등 PatchSummary 파생 델타)를 가리킨다. */
export type DeltaEntityType = "champion" | "item" | "objective" | "lane" | "summary";

/**
 * `DeltaRecord.metric` 유니온 — `src/pipeline/match/delta.ts`(buildDeltas)가 실제로 생산하는
 * 8개 값 그대로다(2026-09-05 리팩토링 시 delta.ts 전수 확인 — 챔피언 pickRate/banRate/winRate,
 * 아이템 adoptionRate, 라인 goldAt10/goldAt14, 오브젝트 firstSec, 매치 평균 avgDurationSec).
 * `src/lib/format.ts`의 `metricLabel`/`metricKind`가 이 유니온을 `Record`의 키로 삼아 단일
 * 진실원(SSOT)을 이룬다 — 새 metric을 추가하려면 여기부터 갱신한다.
 */
export type DeltaMetric =
  | "pickRate"
  | "banRate"
  | "winRate"
  | "adoptionRate"
  | "goldAt10"
  | "goldAt14"
  | "firstSec"
  | "avgDurationSec";

/** 판정에 첨부하는 원천 증거 — 모든 판정문은 이 링크를 가져야 한다(무근거=null 필드로 표시). */
export interface DeltaEvidence {
  matchIds: string[];
  aggregatePath: string;
  noteAnchor: string | null;
}

/**
 * 패치 간 관측 변화 1건 — 통계 델타 + 판정 + (있으면) 패치노트 짝짓기 + LLM 간접 후보.
 * id 포맷(ST-08 확정, PLAN ③ ST-08 행 네임스페이스 그대로): `champion:{ddragonId}:{metric}`
 * (scope="all" 행) | `champion:{ddragonId}:{pos}:{metric}`(scope="position" 행, 픽/승만 —
 * 밴은 포지션이 없으므로 이 포맷에 등장하지 않는다) | `item:{itemId}:{metric}`
 * | `lane:{position}:{metric}` | `objective:{name}`(metric은 항상 `"firstSec"`, name은
 * `dragon`|`herald`|`baron`|`tower`) | `summary:{metric}`.
 */
export interface DeltaRecord {
  id: string;
  entityType: DeltaEntityType;
  entityKey: string;
  entityName: string;
  metric: DeltaMetric;
  before: number | null;
  after: number | null;
  delta: number | null;
  ci: Interval;
  n: { before: number; after: number };
  q: number | null;
  status: MatchStatus;
  matchedNoteId: string | null;
  /**
   * ST-08 신규 — 같은 엔티티에 노트 항목이 여럿이면(예: 챔피언 스킬 변경 3줄) 그 전부를 여기
   * 담는다. `matchedNoteId`는 이 배열의 대표(첫 항목)이며, 짝이 없으면 둘 다 `null`/`[]`.
   */
  matchedNoteIds: string[];
  causes: LlmCause[];
  evidence: DeltaEvidence;
  /**
   * ST-09 신규(optional) — LLM 2단 처리 진단 + 브리핑 한 줄 요약(S3). LLM이 이 델타를 대상으로
   * 실제 호출됐을 때만 존재한다(2단 대상이 아니었던 델타 — 1단에서 이미 매칭됐거나 애초에
   * unannounced/announced-inconsistent가 아니었던 델타 — 는 이 필드 자체가 없다).
   * `skipped=true`면 세션 호출 상한 초과·API 예산 소진·응답 스키마 파싱 실패 등으로 이 델타를
   * 끝내 처리하지 못했다는 뜻이고, 이때 `causes`는 항상 `[]`(회색 표기), `reason`에 사유,
   * `summary`는 없음. `skipped=false`면 LLM이 정상 응답했다는 뜻이고 `summary`(S3 브리핑 1줄)가
   * 채워진다(causes는 비어있을 수 있음 — LLM이 근거를 못 찾았다고 답한 경우).
   * `summaryCites`/`summaryVerified`(B4 후속 수정, S3 인용 강제)는 `summary`가 근거로 인용한
   * 후보 노트 id 목록과 그 구조적 검증 결과다 — `causes.verified`와 동일한 원칙: `summaryCites`의
   * 모든 id가 입력 후보셋에 실제로 존재하면 `summaryVerified=true`, 하나라도 지어낸 id면
   * `false`(이 경우도 `summary` 텍스트 자체는 지우지 않고 보존 — 하류가 회색 처리). 델타 수치만
   * 근거로 쓴 요약문은 `summaryCites=[]`이며 이때는 인용할 후보가 없으므로 `summaryVerified=true`
   * (빈 배열은 항상 검증 통과 — 아래 verifySummaryCites 참고).
   */
  llm?: {
    skipped: boolean;
    reason?: string;
    summary?: string;
    summaryCites?: string[];
    summaryVerified?: boolean;
  };
}

/** ST-09가 deltas 파일 meta.llm에 남기는 세션 단위 LLM 2단 실행 요약(개별 DeltaRecord.llm과는
 * 별개 — 이쪽은 run 전체 집계치). verdict.ts writeDeltas의 WriteDeltasParams.llm과 동일 타입. */
export interface DeltasRunLlmMeta {
  calls: number;
  cacheHits: number;
  skipped: number;
  usage: {
    inputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    outputTokens: number;
  };
}

/**
 * data/aggregated/deltas/{from}_{to}.json의 meta — ST-06 5개 집계 파일의 `AggregateMeta`(patch·
 * nMatches 등)와는 다른 별도 스키마다(verdict.ts writeDeltas 실제 산출 그대로, ST-08 확정).
 * `counts`는 status별 건수 — 모든 MatchStatus가 항상 채워지지는 않으므로(0건인 상태는 키
 * 자체가 없음) Partial이다.
 */
export interface DeltasFileMeta {
  from: PatchId;
  to: PatchId;
  generatedAt: string;
  n: number;
  counts: Partial<Record<MatchStatus, number>>;
  qAlpha: number;
  llm?: DeltasRunLlmMeta;
}

/** data/aggregated/deltas/{from}_{to}.json 전체 구조 — verdict.ts writeDeltas가 기록하는
 * `{meta, rows}`와 웹(data.ts loadDeltas)이 읽는 타입을 여기서 일치시킨다. */
export interface DeltasFile {
  meta: DeltasFileMeta;
  rows: DeltaRecord[];
}
