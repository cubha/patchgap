// src/lib/landing.ts
// 랜딩(`/`)이 소비하는 게임 요약 — **게임 수를 단언하지 않기 위한 데이터 층**이다(2026-09-19).
//
// 사용자 요구 원문: "이때 추후 게임이 추가될수잇으니 두가지종류만 단언해서 작성하지는마".
// 화면에서 게임을 하드코딩하지 않는 것만으로는 그 요구를 못 지킨다 — 게임마다 집계 산출물의
// 모양이 달라(LoL은 패치별 5종 JSON + 델타, PUBG는 무기 집계 2개 + 델타) 로더는 게임별로
// 존재할 수밖에 없기 때문이다. 그래서 두 층으로 나눈다:
//   - UI 층: 게임을 하나도 모른다. `landingCards()`가 준 배열을 map으로 그릴 뿐이다.
//   - 데이터 층: `Record<GameId, LandingLoader>`라, GAMES에 게임을 추가하고 로더를 안 붙이면
//     **타입 에러**가 난다. 조용히 빠지는 경로를 컴파일러가 막는다.
//
// 수치의 출처를 둘로 만들지 않는다 — LoL 카드의 공지/유의/미공지는 LoL 홈 히어로가 쓰는
// `computeHeadline`을 그대로 부른다. 여기서 따로 세면 랜딩과 브리핑이 다른 숫자를 주장하게
// 되고, 그건 이 프로젝트가 반복해서 고쳐온 결함군이다(채점표 B2 "페이지 간 수치 정합").
import "server-only";
import { computeHeadline } from "@/components/home/logic";
import { isReportable, loadPubg } from "./pubgData";
import { loadTft } from "./tftData";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { isGapStatus } from "@/pipeline/shared/status-order";
import { getDefaultPair, listPatches, loadDeltas, loadNotes, loadSummary } from "./data";
import { fmtInt } from "./format";
import { GAMES, sectionHref, type GameId } from "./game";

/** 랜딩 패널 1장이 필요로 하는 전부. 화면은 이 배열 말고 아무것도 읽지 않는다. */
export interface GameLandingCard {
  id: GameId;
  /** 한국어 정식 명칭(GAMES). */
  label: string;
  /** 영문 이벤트 라벨(GAMES) — 패널 상단 모노 캡션. */
  tag: string;
  /** 키아트 경로(GAMES). */
  art: string;
  /** 그 게임의 브리핑 — `sectionHref`가 소유한다. */
  href: string;
  pair: { from: string; to: string };
  /** 표본 한 줄 — 헤더 표본 칩과 같은 어휘를 쓴다(두 화면이 다른 말을 하지 않도록). */
  sample: string;
  /** 패치노트가 공지한 변화 수. */
  announced: number;
  /** 통계 게이트를 통과한 관측 수. */
  significant: number;
  /** 그중 패치노트에 없던 것. */
  unannounced: number;
  /** 이 게임이 분석한 매치 총수 — 합산 타일의 재료. */
  matches: number;
}

export interface LandingTotals {
  matches: number;
  significant: number;
  unannounced: number;
}

/** 게임별 가변부. 불변부(label·tag·art·href)는 GAMES와 `sectionHref`에서 나온다. */
export type LandingSummary = Pick<
  GameLandingCard,
  "pair" | "sample" | "announced" | "significant" | "unannounced" | "matches"
>;

/** 데이터가 없으면 `null` — 그 게임은 랜딩에서 빠진다(PUBG 출하 게이트와 같은 규약). */
export type LandingLoader = () => LandingSummary | null;

function lolSummary(): LandingSummary | null {
  const pair = getDefaultPair();
  if (!pair) return null;
  const deltas = loadDeltas(pair.from, pair.to);
  const notes = loadNotes(pair.to);
  if (!deltas || !notes) return null;

  const headline = computeHeadline(deltas, notes, deltas.meta.qAlpha);
  // 분석한 매치는 **수집한 모든 패치**의 합이다 — 현재 쌍(2개)만 세면 이미 쌓아 둔 표본을
  // 작게 말하게 된다. summary가 없는 패치는 0으로 흡수한다(빈 데이터 빌드 보장).
  const matches = listPatches().reduce((sum, patch) => sum + (loadSummary(patch)?.data.matches ?? 0), 0);
  const nAfter = loadSummary(pair.to)?.data.matches ?? 0;

  return {
    pair,
    sample: `KR · Master+ · ${fmtInt(nAfter)}매치`,
    announced: headline.noteEntityCount,
    significant: headline.statCount,
    unannounced: headline.unannouncedCount,
    matches,
  };
}

function pubgSummary(): LandingSummary | null {
  const bundle = loadPubg();
  if (!bundle) return null;
  const { deltas, before, after, notes } = bundle;
  const reportable = deltas.rows.filter((row) => isReportable(row.status));
  const matches = before.nMatches + after.nMatches;

  return {
    pair: { from: deltas.meta.from, to: deltas.meta.to },
    sample: `Steam · 전 지역 · ${fmtInt(matches)}매치`,
    announced: notes.length,
    significant: reportable.length,
    // **`status === "unannounced"`로 세지 않는다**(2026-09-20). 미공지의 정의는
    // `isGapStatus` 하나가 갖는다 — `unannounced` + `indirect-effect`(원인이 규명됐는가만
    // 다를 뿐 같은 뿌리). 원시 status로 세면 화면(`displayStatusOf`)과 랜딩이 같은 것을 두고
    // 다른 수를 말하게 되고, 그게 이 저장소가 반복해서 고쳐 온 결함군이다.
    unannounced: reportable.filter((row) => isGapStatus(row.status)).length,
    matches,
  };
}

function tftSummary(): LandingSummary | null {
  const bundle = loadTft();
  if (!bundle) return null;
  const { deltas, before, after, notes } = bundle;
  // **LoL과 같은 술어를 쓴다** — PUBG가 상태만 보는 `isReportable`을 쓰는 것은 그쪽
  // `classify()`가 유의성·바닥을 이미 상태에 접어 넣었기 때문이고, TFT는 `DeltaRecord`를
  // 그대로 내므로 4조건 술어가 맞다.
  const reportable = deltas.rows.filter((row) => isReportableRecord(row, deltas.meta.qAlpha));
  const matches = before.matches + after.matches;

  return {
    pair: { from: deltas.meta.from, to: deltas.meta.to },
    sample: `KR · Master+ · ${fmtInt(matches)}매치`,
    announced: notes.items.length,
    significant: reportable.length,
    // TFT는 LLM 2단·3단을 돌므로 `indirect-effect`가 실제로 생긴다(2026-09-20) — 원시 status로
    // 세면 랜딩 카드가 TFT 홈 타일보다 **적게** 말한다. 정의는 `isGapStatus`가 소유한다.
    unannounced: reportable.filter((row) => isGapStatus(row.status)).length,
    matches,
  };
}

/**
 * 게임 → 요약 로더. **이 Record가 누락 차단 장치다** — GAMES에 게임을 추가하면 여기에도
 * 항목을 넣어야 타입이 통과한다.
 */
export const LANDING_LOADERS: Record<GameId, LandingLoader> = {
  lol: lolSummary,
  pubg: pubgSummary,
  tft: tftSummary,
};

/** GAMES 순서대로, 데이터가 있는 게임만. 빌드 타임 fs 호출이라 서버에서만 부른다. */
export function landingCards(): GameLandingCard[] {
  const cards: GameLandingCard[] = [];
  for (const game of GAMES) {
    const summary = LANDING_LOADERS[game.id]();
    if (!summary) continue;
    cards.push({
      id: game.id,
      label: game.label,
      tag: game.tag,
      art: game.art,
      href: sectionHref(game.id, ""),
      ...summary,
    });
  }
  return cards;
}

/** 합산 타일. 게임이 늘면 합도 자동으로 커진다 — 숫자를 어디에도 적어두지 않는다. */
export function landingTotals(cards: readonly GameLandingCard[]): LandingTotals {
  return cards.reduce<LandingTotals>(
    (acc, card) => ({
      matches: acc.matches + card.matches,
      significant: acc.significant + card.significant,
      unannounced: acc.unannounced + card.unannounced,
    }),
    { matches: 0, significant: 0, unannounced: 0 }
  );
}
