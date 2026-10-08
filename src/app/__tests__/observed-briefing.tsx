// src/app/__tests__/observed-briefing.tsx
// 관측 화면을 검사하는 테스트가 그릴 **가장 최근 관측 쌍**의 브리핑(2026-10-07).
//
// 커밋된 산출물로 렌더하는 테스트는 "최신 쌍 = 관측된 쌍"을 전제해 왔다. 새 패치가 뜨면 감시자가 노트만 먼저
// 반영하고 관측은 3일차부터라(결정 8), 그 사이 최신 쌍은 **선언 축만** 있다 — 그 화면은 설계대로 탭·타일이
// 없다(`declaration-only.test.tsx`가 지킨다). 10/7 TFT 18.4 선언 커밋 직후 탭·타일·상세를 보던 테스트 4건이
// main에서 깨진 것이 그 전제 때문이다. 관측 화면의 계약은 최신 관측 쌍으로 검사한다 — 최신이면 평소 주소,
// 선언 중이면 그 직전 관측 쌍의 과거 쌍 라우트(같은 본문 `LolBriefing`·`TftBriefing`).
import type { ReactElement } from "react";

import LolPage from "../lol/page";
import LolHistoryPage from "../lol/history/[pair]/page";
import TftPage from "../tft/page";
import TftHistoryPage from "../tft/history/[pair]/page";
import PubgPage from "../pubg/page";
import { listPatchPairs, loadDeltas } from "@/lib/data";
import { pairSlug, type PairLike } from "@/lib/pairRoutes";
import { latestObservedTftPair } from "@/lib/tftData";
import { isObservationStub } from "@/pipeline/shared/observation-stub";

export type BriefingGame = "lol" | "tft" | "pubg";

function lolObserved(pair: PairLike): boolean {
  const deltas = loadDeltas(pair.from, pair.to);
  return deltas !== null && !isObservationStub(deltas.meta);
}

/** 최신 관측 쌍과, 그것이 최신 쌍인지. 관측 쌍이 하나도 없으면 null. */
export function latestObservedPair(game: "lol" | "tft"): { pair: PairLike; isLatest: boolean } | null {
  // TFT는 프로덕션 함수가 소유한다(ST-14) — 화면과 테스트가 같은 「최신 관측 쌍」을 본다.
  if (game === "tft") return latestObservedTftPair();
  const pairs: PairLike[] = listPatchPairs();
  const index = pairs.findIndex(lolObserved);
  return index === -1 ? null : { pair: pairs[index], isLatest: index === 0 };
}

/**
 * 가장 최근 관측 쌍의 브리핑 요소. PUBG는 과거 쌍 라우트가 없어 평소 주소만 그린다(선언 중이면 호출부가
 * `pubgObserved()`로 건너뛴다 — 그 상태는 `declaration-only.test.tsx`가 검사한다).
 */
export async function observedBriefing(game: BriefingGame): Promise<ReactElement> {
  if (game === "pubg") return <PubgPage />;
  const found = latestObservedPair(game);
  if (!found || found.isLatest) return game === "lol" ? <LolPage /> : <TftPage />;
  const params = Promise.resolve({ pair: pairSlug(found.pair) });
  return game === "lol" ? await LolHistoryPage({ params }) : await TftHistoryPage({ params });
}
