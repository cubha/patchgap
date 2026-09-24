// src/pipeline/collect/staleness.ts
// **캘린더가 아는 최신 패치 ↔ 화면이 보는 최신 패치**의 격차. 순수 함수만(파일 I/O 없음).
//
// **왜 필요한가**(2026-09-24 실측). 세 게임의 수집 크론은 조건이 아니면 `should_run=false`로
// 초록불 no-op을 낸다 — 옳은 설계지만, 그 초록불은 **두 상태를 덮는다**: "받을 게 없어서 안
// 했다"와 "받아야 하는데 못 했다". 실제로 TFT는 18.3이 9/22에 나왔는데 403(제품 미승인)으로
// 막혀 화면이 18.2에 멈춰 있고, 실행 이력은 전부 초록불이었다.
//
// **합불을 판정하지 않는다.** "N일 이상 밀리면 실패"는 값을 정직하게 고를 수 없다 — 심사가
// 몇 주면 매일 빨간불이 되고, 그 알림은 곧 무시된다(고치려는 실패 양식 그대로). 대신 격차를
// **매일 같은 자리에 숫자로** 적는다. 왜 밀렸는지는 키를 쥔 수집 워크플로가 말한다
// (`scripts/shared/determine-report.ts`의 `SkipReason`) — 관측할 수 있는 쪽이 적는 것이 맞다.

import { comparePatchId } from "./calendar-overlay";

export type StalenessGame = "lol" | "tft" | "pubg";

export interface GameStaleness {
  game: StalenessGame;
  /** 캘린더(기준 + 오버레이 병합)가 아는 최신 패치. 캘린더가 비면 `null`. */
  calendarLatest: string | null;
  /** 집계 산출물(`deltas.*.json`의 `meta.to`) 중 최신. 산출물이 없으면 `null`. */
  aggregatedLatest: string | null;
  /** 캘린더가 집계보다 앞서 있나 = 아직 못 받은 패치가 있나. */
  behind: boolean;
}

/**
 * 여러 패치 ID 중 최신.
 *
 * **문자열 정렬을 쓰지 않는다** — `"26.9" > "26.10"`이 사전순으로는 참이라 마이너가 두 자리로
 * 넘어가는 순간 조용히 틀린다. 비교 규칙의 소유자는 `calendar-overlay.ts`의 `comparePatchId`
 * 하나다(캘린더 단조성 검사가 이미 그것을 쓴다).
 */
export function latestPatchId(ids: readonly string[]): string | null {
  let best: string | null = null;
  for (const id of ids) {
    if (best === null || comparePatchId(id, best) > 0) best = id;
  }
  return best;
}

/**
 * 한 게임의 격차.
 *
 * 캘린더가 비어 있으면(`calendarLatest === null`) **밀렸다고 말하지 않는다** — 그건 "못 받았다"가
 * 아니라 "감시자가 아직 아무것도 모른다"이고, 둘을 뭉치면 또 한 문구가 두 상태를 덮는다.
 * 집계가 비어 있는데 캘린더에 패치가 있으면 밀린 것이 맞다(첫 수집 전).
 */
export function stalenessOf(
  game: StalenessGame,
  calendarLatest: string | null,
  aggregatedLatest: string | null,
): GameStaleness {
  const behind =
    calendarLatest !== null &&
    (aggregatedLatest === null || comparePatchId(calendarLatest, aggregatedLatest) > 0);
  return { game, calendarLatest, aggregatedLatest, behind };
}

/** 실행 요약용 마크다운 표. 표를 만드는 것도 순수 함수라 테스트가 문자열까지 고정한다. */
export function stalenessTable(rows: readonly GameStaleness[]): string {
  const head = ["| 게임 | 캘린더 최신 | 집계 최신 | 상태 |", "|---|---|---|---|"];
  const body = rows.map((r) => {
    const cal = r.calendarLatest ?? "—";
    const agg = r.aggregatedLatest ?? "—";
    // 「최신」과 「미수집」만 쓴다. 며칠 밀렸는지는 적지 않는다 — 날짜를 적으면 곧 임계값을
    // 만들고 싶어지고, 그 임계값은 정직하게 고를 수 없다(이 파일 머리말).
    const state = r.calendarLatest === null ? "캘린더 비어 있음" : r.behind ? `미수집 (${agg} → ${cal})` : "최신";
    return `| ${r.game} | ${cal} | ${agg} | ${state} |`;
  });
  return [...head, ...body].join("\n");
}
