// src/components/methodology/adapterMatrixData.ts
// 어댑터 매핑표 — HANDOFF-redesign-2026-09-10.md §4-4 "확장성의 증명은 셀렉터가 아니라
// 어댑터 매핑표". 계층별 대응을 정적 데이터로 선언한다(순수 데이터, I/O 없음).
//
// **게임을 박아 두지 않는다(2026-09-20 사용자 지시로 구조 변경)**: 이전 형태는 행마다
// `lol`/`pubg` 필드를 직접 갖고 있어서, 세 번째 게임이 붙으면 타입부터 고쳐야 했다 — 이 표가
// 증명하려는 것이 "게임이 늘어도 판정 엔진은 그대로"인데 정작 표 자신이 두 게임에 묶여 있었다.
// 이제 셀을 `Record<GameId, string>`으로 들고, 렌더는 `GAMES` 레지스트리를 순회한다. GAMES에
// 게임을 추가하면 **여기에도 칸을 채워야 타입이 통과한다**(랜딩 `LANDING_LOADERS`와 같은 장치).
//
// 표가 사는 곳도 LoL 방법론 → **랜딩**으로 옮겼다. "판정 엔진은 게임을 모른다"는 주장은 어느 한
// 게임의 페이지가 아니라 게임 중립 표면에서 해야 하고, 랜딩이 이미 "패치노트를 내고 매치 API를
// 여는 게임이면 어댑터만 붙습니다"라고 말하고 있다 — 이 표가 그 문장의 증거다.
//
// 각 칸은 "확인된 사실만" 적는다. 아직 연결하지 않은 제안은 `(설계)`를 앞에 붙인다.

import type { GameId } from "@/lib/game";

export interface AdapterMatrixRow {
  layer: string;
  /**
   * 게임별 셀. `null`이면 게임 무관 행이고 `shared`가 게임 열 전체를 가로지른다(판정 엔진).
   * `Record`라 GAMES에 게임이 늘면 컴파일러가 누락을 잡는다 — 조용히 빈 칸이 생기지 않는다.
   */
  byGame: Record<GameId, string> | null;
  /** `byGame`이 null인 행에서 게임 열 전체를 덮는 한 칸. */
  shared?: string;
  /** 이 계층에서 게임별로 갈아끼우는 인터페이스. 판정 엔진은 갈아끼우지 않으므로 "고정". */
  iface: string;
}

export const ADAPTER_MATRIX: readonly AdapterMatrixRow[] = [
  {
    layer: "선언 소스",
    byGame: {
      lol: "공식 패치노트 HTML — {스킬키} {스탯}: A ⇒ B",
      pubg: "공식 패치노트 — 동일한 A ⇒ B 구조",
      tft: "공식 패치노트 — 같은 CMS·같은 ⇒ 구조이나 엔티티 앵커(h3.change-title)가 0건이라 DDragon 카탈로그 대조로 대상을 판별합니다",
    },
    iface: "NoteSource.fetch()",
  },
  {
    layer: "관측 소스",
    byGame: {
      lol: "Riot Match-V5 · Timeline",
      pubg: "PUBG Developer API — 실측 완료(2026-09-16) · 매치·텔레메트리 조회 리밋 없음 · 표본 API 10 RPM · 보존 336시간",
      tft: "Riot TFT-League-V1 → TFT-Match-V1 — game_version이 비어 있어(\"TFT Unreal Version ?.?.?.?\") 패치 구분은 노트 발행 시각 창으로 합니다",
    },
    iface: "MatchSource.collect()",
  },
  {
    layer: "주 엔티티",
    byGame: {
      lol: "챔피언 (173)",
      pubg: "무기 47종 · 맵 관측 7종(자산 9종) · 차량·소모품 미수집",
      tft: "유닛 56 · 특성 36 · 아이템 141 (Set 18). 증강은 응답에 필드가 없어 미수집",
    },
    iface: "Entity{type,key,name}",
  },
  {
    layer: "공간 축",
    byGame: {
      lol: "라인 5종 (탑·정글·미드·원딜·서포터)",
      pubg: "맵 (설계: 낙하 구역)",
      tft: "없음 — 보드는 위치 축을 갖지 않습니다",
    },
    iface: "Segment[]",
  },
  {
    layer: "채택률 지표",
    byGame: {
      lol: "픽률 · 밴률",
      pubg: "무기 획득 점유율 (설계: 초반 교전 사용률)",
      tft: "등장률 — 분모가 매치가 아니라 **보드(참가자)**입니다. 한 보드에 여러 유닛이 서므로 제로섬이 아닙니다",
    },
    iface: "Metric.adoption",
  },
  {
    layer: "성과 지표",
    byGame: {
      lol: "승률 (n≥200 게이트)",
      pubg: "(설계) 순위 · 생존 시간",
      tft: "순방률(상위 4등, n≥200 게이트) · 평균 등수 — 평균 등수만 **작을수록 개선**이라 방향이 반대입니다",
    },
    iface: "Metric.outcome",
  },
  {
    layer: "시계열 지표",
    byGame: {
      lol: "골드@10/14 · 첫 오브젝트 시각",
      pubg: "(설계) 첫 교전 시각 · 자기장 단계별 생존",
      tft: "(설계) 탈락 라운드 · 탈락 시각 — 수집은 되고 있으나 델타로는 아직 내지 않습니다",
    },
    iface: "Metric.timeline",
  },
  {
    layer: "엔티티 자산",
    byGame: {
      lol: "Data Dragon 아이콘·스펠·스플래시(챔피언 186)",
      pubg: "pubg/api-assets 공식 렌더(무기 38/47 · 맵 9/9)",
      // 2026-09-23: 이 칸은 **거짓이었다** — "Data Dragon tft-champion·tft-trait·tft-item
      // (Set 18 필터)"라 적었지만 그것은 **이름 카탈로그** 용도였고 TFT 화면의 이미지는 0건이었다
      // (UX-BRIEF §8-7 말미가 이 자기모순을 기록했다). 자산 조달을 배선한 뒤 실측 수로 고친다.
      tft: "Data Dragon 스플래시·아이콘(유닛 55 · 특성 36 · 아이템 140 — 미보유 2)",
    },
    iface: "AssetSource.icon()",
  },
  {
    layer: "판정 엔진",
    byGame: null,
    shared: "게임 무관 — BH-FDR q<0.10 · Newcombe CI · 표본 게이트 · 짝짓기 · LLM 2단 인용검증",
    iface: "고정",
  },
] as const;

/**
 * 게임 열 머리글에 붙는 연결 상태. 행마다 뱃지를 붙이던 것을 머리글 1회로 접었다(4번째 열을
 * 어댑터 인터페이스에 내줬기 때문).
 *
 * 2026-09-16: PUBG가 "어댑터 확정 · 미연결" → "실연결". 사용자 결정으로 SCOPE Won't가 해제되고
 * 실제 수집·집계·판정이 붙었다(/pubg/). 데이터가 커밋된 뒤에도 "미연결"을 그대로 두면
 * 이번에 고친 "무제한"과 **정확히 같은 종류의 거짓 문장**이 된다 — PLAN §6-7이 예고한 함정.
 *
 * 2026-09-20: `PUBG_COLUMN_HEADER` 단일 상수 → 게임별 Record. 머리글 이름은 여기서 짓지 않고
 * `gameLabel()`이 준다 — 사이트 다른 곳과 명칭이 갈리지 않게 한다("PUBG" → "배틀그라운드").
 */
export const COLUMN_STATUS: Record<GameId, string> = {
  lol: "연결됨",
  pubg: "실연결 · 42.3 → 43.1",
  tft: "실연결 · 18.1 → 18.2",
};

/** 표 아래 강조 문단 — 시안 `.note-blocked`. 마지막 행(판정 엔진)이 왜 핵심인지 말한다. */
export const JUDGMENT_ENGINE_NOTE =
  "마지막 행이 핵심입니다 — 게임을 바꿀 때 달라지는 것은 어댑터 8줄이고 판정 엔진은 그대로입니다. (설계) 표시가 붙은 칸은 아직 연결하지 않은 제안이고, 나머지는 실제로 연결된 값입니다.";
