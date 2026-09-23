// src/components/compare/useFilterHash.ts
// 홈 3타일 「미공지 Gap」이 `/{game}/compare/#unannounced`로 착지할 때 **칩을 맞춰 주는** 규약.
//
// **왜 훅으로 빼나**: 이 세 줄이 LoL·PUBG에는 있고 TFT에는 없었다 — 실측으로 TFT만 「전체」에
// 착지했다(2026-09-23 렌더 검증). 같은 규약을 화면마다 손으로 적는 한 다음 게임에서도 하나가
// 빠진다. `StatTiles.gapHrefOf`가 링크를 소유하듯, 받는 쪽은 이 훅이 소유한다.
//
// 빌드 타임엔 `window`가 없으므로 초기 상태는 항상 `"all"`이고 **마운트 후 한 번만** 맞춘다.
"use client";

import { useEffect } from "react";

import { COMPARE_FILTERS, type CompareFilterKey } from "./toolbarRules";

export function useFilterHash(onMatch: (key: CompareFilterKey) => void): void {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (COMPARE_FILTERS.some((f) => f.key === hash)) {
      onMatch(hash as CompareFilterKey);
    }
    // 마운트 1회 — URL 해시는 외부 시스템이고 이후 변화는 이 화면이 소유한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
