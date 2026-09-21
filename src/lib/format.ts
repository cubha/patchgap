// src/lib/format.ts
// 표시 포맷 유틸(퍼센트·델타·타임스탬프·라벨 등). 컴포넌트·페이지가 공통으로 소비한다.
// 음수는 하이픈(-)이 아니라 유니코드 마이너스(U+2212, −)로 표기한다 — 타이포그래피 관례이자
// 표에서 하이픈/마이너스 혼용을 없애기 위함(UX-BRIEF 델타 표기 전반에 일관 적용).

import type { DeltaEntityType, DeltaMetric, Interval, LanePosition, MatchStatus, TeamPosition } from "@/pipeline/types";
import type { DisplayStatus } from "@/pipeline/shared/display-status";
import { sectionHref } from "./game";

const MINUS = "−";

/** 부호 문자열(+/−/"")을 반환한다. 0은 부호 없음. */
function sign(n: number): string {
  if (n > 0) return "+";
  if (n < 0) return MINUS;
  return "";
}

/** 절대값을 고정 소수점 문자열로. 유니코드 마이너스 부호와 조합해 쓴다. */
function fixedAbs(n: number, digits: number): string {
  return Math.abs(n).toFixed(digits);
}

/** 비율(0~1 분수)을 퍼센트 문자열로. fmtPct(0.046) => "4.6%". */
export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** 퍼센트포인트 델타(분수 단위 입력)를 부호 포함 문자열로. fmtPp(0.025) => "+2.5%p",
 * fmtPp(-0.018) => "−1.8%p". */
export function fmtPp(delta: number, digits = 1): string {
  return `${sign(delta)}${fixedAbs(delta * 100, digits)}%p`;
}

/** CI [lo, hi]의 반폭(half-width)을 "±X" 문자열로. 단위 변환(퍼센트포인트 등)은 호출부가
 * 미리 스케일링한 interval을 넘긴다 — fmtCiHalf([0.021, 0.029]) => "±0.4"(퍼센트 스케일 전제 시
 * 호출부가 *100 해서 넘긴다는 뜻이 아니라, 이 함수 자체는 단위 불문 반폭만 계산한다). */
export function fmtCiHalf(ci: Interval, digits = 1): string {
  const [lo, hi] = ci;
  const half = Math.abs(hi - lo) / 2;
  return `±${half.toFixed(digits)}`;
}

/** 초를 "분:초" 문자열로. fmtSec(352) => "5:52". 음수는 지원하지 않는다(절대 시각용). */
export function fmtSec(s: number): string {
  const total = Math.round(Math.abs(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** 초 단위 델타를 부호 포함 "+Ns" 문자열로. fmtDeltaSec(22) => "+22s", fmtDeltaSec(-11) => "−11s". */
export function fmtDeltaSec(d: number): string {
  return `${sign(d)}${Math.round(Math.abs(d))}s`;
}

/** 정수를 천 단위 콤마로. fmtInt(10240) => "10,240". */
export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/** 부호 포함 정수(골드 델타 등). fmtDeltaInt(320) => "+320", fmtDeltaInt(-85) => "−85". */
export function fmtDeltaInt(n: number): string {
  return `${sign(n)}${fmtInt(Math.abs(n))}`;
}

/** ISO 8601(UTC) 문자열을 KST(UTC+9) "YYYY-MM-DD HH:mm KST"로. fmtKst("2026-09-05T05:00:00.000Z")
 * => "2026-09-05 14:00 KST". Intl.DateTimeFormat의 Asia/Seoul 타임존으로 실제 오프셋을
 * 계산한다(고정 +9 가산이 아님 — 서머타임 없는 KST라 동일하지만 실 오프셋 계산이 더 안전). */
export function fmtKst(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = get("hour") === "24" ? "00" : get("hour");
  const mi = get("minute");
  return `${y}-${mo}-${d} ${h}:${mi} KST`;
}

/**
 * 상태 라벨 — 2026-09-18 라운드6(사용자 C5) 어휘 통일. 표시 키(`DisplayStatus`) 3종 + 부재 1종 +
 * 노이즈 3종(방법론 정의표용). raw `MatchStatus`가 그대로 들어와도(PUBG 화면은 q가 없어 상태값을
 * 배지에 직접 넘긴다) **같은 통일 어휘**로 읽히도록 두 키 집합을 한 표에 둔다 — 옛 세분 어휘
 * ("공지-일치"·"공지-불일치"·"관측 미확인"·"바닥 미달(공지)"·"간접 영향"·"노트에 없는 변화")는 화면
 * 어디에도 남기지 않는다. 알려지지 않은 값은 크래시 대신 원본 문자열을 그대로 반환한다.
 */
const STATUS_LABELS: Record<DisplayStatus | MatchStatus, string> = {
  // 수치 축(2026-09-21) — 통칭을 쓴다. 게이머가 실제로 쓰는 말이라 인지 비용이 0이고,
  // 정확한 정의("패치노트에 없는 원본 수치 변경")는 방법론과 상세가 말한다.
  submarine: "잠수함 패치",
  announced: "공지",
  "announced-anomaly": "공지 · 이상 관측",
  unannounced: "미공지",
  unpaired: "짝지은 관측 없음",
  // raw MatchStatus → 같은 통일 어휘
  "announced-consistent": "공지",
  "announced-inconsistent": "공지 · 이상 관측",
  "indirect-effect": "미공지",
  // 노이즈 3종 — 화면 배지에는 쓰지 않고 방법론 "표시하지 않는 관측" 정의표에만 나온다.
  "insufficient-sample": "표본 부족",
  "below-threshold": "바닥 미달",
  "no-change": "변화 없음",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as DisplayStatus | MatchStatus] ?? status;
}

/** DeltaRecord.metric(문자열 키) → 한글 라벨. 알려지지 않은 metric은 원본 문자열을 그대로
 * 반환한다(ST-08 산출 metric 어휘가 아직 확정되지 않았으므로 목록은 문서화된 사례 위주). */
/**
 * `DeltaMetric` 11종 전수 라벨(2026-09-05 리팩토링 — `types.ts`의 `DeltaMetric` 유니온을 키로
 * 삼아 pipeline·web 양쪽이 이 하나만 참조한다. 이전엔 챔피언/아이템/라인 5종만 채워져 있었고
 * "firstSec"(오브젝트 첫 획득 시각, 실제 생산되는 값)은 `discord/webhook.ts`가 로컬로
 * "첫 처치 시각"을 따로 매핑했다 — 여기 흡수). */
const METRIC_LABELS: Record<DeltaMetric, string> = {
  pickRate: "픽률",
  banRate: "밴률",
  winRate: "승률",
  adoptionRate: "채택률",
  goldAt10: "골드@10",
  goldAt14: "골드@14",
  firstSec: "첫 처치 시각",
  avgDurationSec: "경기 시간",
  top4Rate: "순방률",
  playRate: "등장률",
  avgPlacement: "평균 등수",
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric as DeltaMetric] ?? metric;
}

/** `DeltaEntityType` 7종 → 한글 라벨. 항목상세 브레드크럼("대조표 › 챔피언 › 노틸러스")이
 * 쓴다(2026-09-12 /verify-impl 보완 — 원시안 2종 모두 브레드크럼을 그렸는데 구현에 없었다).
 * 대조표 좌 내비의 섹션 탭 라벨(`compare/logic.ts` NAV_SECTIONS)과 어휘를 맞춘다 — 다만 그쪽은
 * 3탭(champion/item/system)만 다루는 별개 축이라 키 집합이 달라 합치지 않았다. */
const ENTITY_TYPE_LABELS: Record<DeltaEntityType, string> = {
  champion: "챔피언",
  item: "아이템",
  objective: "오브젝트",
  lane: "라인",
  summary: "매치 평균",
  unit: "유닛",
  trait: "특성",
};

export function entityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType as DeltaEntityType] ?? entityType;
}

/**
 * `DeltaMetric` → 값 표시 단위 종류(2026-09-05 리팩토링 — `discord/webhook.ts`의 로컬
 * `MetricKind`("ratio"/"gold"/"seconds")와 `components/home/logic.ts`의 로컬 `metricKind`
 * (Set 기반, "pp"/"sec"/"gold")를 이 하나의 `Record`로 통합했다. 유니온을 전수 커버하므로
 * "알려지지 않은 metric" 폴백 분기가 없다 — 그런 폴백이 필요한 소비처(예: `home/logic.ts`가
 * `"unknownMetric"` 같은 임의 문자열도 받아야 하는 기존 계약)는 자체적으로 얇은 어댑터를 둔다.
 * `src/components/item/metricFormat.ts`(ST-12 소유, 별도 `MetricKind`="pp"/"sec"/"gold")는
 * 의도적으로 이 함수를 쓰지 않는다 — 알려지지 않은 metric까지 "gold"로 안전하게 받는 별도 계약이라
 * 통합하면 그 계약이 깨진다.
 */
export const METRIC_KIND: Record<DeltaMetric, "pp" | "seconds" | "gold" | "placement"> = {
  pickRate: "pp",
  banRate: "pp",
  winRate: "pp",
  adoptionRate: "pp",
  goldAt10: "gold",
  goldAt14: "gold",
  firstSec: "seconds",
  avgDurationSec: "seconds",
  // TFT(2026-09-20). 순방률·등장률은 비율이라 기존 "pp"에 그대로 붙는다.
  top4Rate: "pp",
  playRate: "pp",
  // 평균 등수만 새 종류다 — 1~8 고정 범위의 **순위**라 %p도 초도 골드도 아니고,
  // 유일하게 **작을수록 개선**이라 화살표 방향까지 반대다(소비처가 그것을 알아야 한다).
  avgPlacement: "placement",
};

export type MetricKind = (typeof METRIC_KIND)[DeltaMetric];

export function metricKind(metric: DeltaMetric): MetricKind {
  return METRIC_KIND[metric];
}

/** 값이 **작을수록 개선**인 지표. 평균 등수가 유일하다 — 화살표·색을 뒤집는 소비처가 쓴다. */
export function isLowerBetter(metric: DeltaMetric): boolean {
  return metric === "avgPlacement";
}

/** LanePosition(+빈 문자열 "미배정") → 한글 라벨. 알려지지 않은 값은 원본을 반환한다. */
const POSITION_LABELS: Record<TeamPosition, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MIDDLE: "미드",
  BOTTOM: "원딜",
  UTILITY: "서포터",
  "": "미배정",
};

export function positionLabel(position: LanePosition | TeamPosition | string): string {
  return POSITION_LABELS[position as TeamPosition] ?? position;
}

/**
 * `DeltaRecord.id` → `/lol/item/[id]/` 정적 라우트 슬러그(오케스트레이터 지시, 2026-09-05 근본
 * 수정). `encodeURIComponent(id)`는 `:` 포함 id를 퍼센트 인코딩하는데, 실측(정적 파일 서버로
 * `out/`를 직접 서빙 — Vercel과 동일한 "URL 1회 디코드 후 파일 매칭" 규칙)으로 단일 인코딩·
 * 원문 콜론 둘 다 404, 이중 인코딩만 200이 나오는 걸 확인했다 — 즉 퍼센트 인코딩을 슬러그에
 * 쓰는 한 링크가 배포 시 전부 깨진다. 그래서 인코딩을 아예 쓰지 않고 `:`를 `~`로 바꾸는
 * 문자 치환 슬러그로 전환한다(`~`는 URL 경로 세그먼트에서 예약되지 않은 문자라 퍼센트
 * 인코딩이 전혀 필요 없다). id 자체에 이미 `~`가 있으면 왕복이 깨지므로 방어적으로 throw —
 * 실 데이터(`data/aggregated/deltas/26.17_26.17.json`, 1,751행) 전수 조회로 현재 id 네임스페이스
 * (`champion:`/`item:`/`lane:`/`objective:`/`summary:` + ddragon id·포지션·metric 세그먼트)에
 * `~`가 전혀 없음을 확인했다.
 */
export function itemSlug(id: string): string {
  if (id.includes("~")) {
    throw new Error(`itemSlug: id에 이미 '~'가 포함되어 있어 슬러그 왕복이 불안전합니다: ${id}`);
  }
  return id.replaceAll(":", "~");
}

/** `itemSlug`의 역변환 — `/lol/item/[id]/` 라우트 파라미터에서 원래 `DeltaRecord.id`를 복원한다. */
export function itemIdFromSlug(slug: string): string {
  return slug.replaceAll("~", ":");
}

/** `DeltaRecord.id` → `/lol/item/{slug}/` 링크 href. 홈·대조표·디스코드 알림 등 항목 상세로
 * 링크를 거는 모든 곳이 이 함수를 통해서만 href를 만든다(퍼센트 인코딩 재도입 방지).
 *
 * 2026-09-19: 게임 접두(`/lol`)를 `sectionHref`에서 가져온다 — 접두를 여기 문자열로 박으면
 * `game.ts`의 GAMES와 두 벌이 되고, 다음에 접두가 바뀔 때 한쪽만 고쳐질 자리가 생긴다. */
export function itemHref(id: string): string {
  return `${sectionHref("lol", "item")}${itemSlug(id)}/`;
}
