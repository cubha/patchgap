// src/pipeline/shared/pubg-status.ts
// PUBG 판정 상태 술어 — **클라이언트 번들에도 실리는** 순수 모듈. `src/lib/pubgData.ts`는 `node:fs`를
// import하므로 "use client" 컴포넌트(PubgCompareTable)가 거기서 가져오면 Turbopack이 클라이언트 청크에
// `node:fs`를 넣으려다 빌드가 죽는다(2026-09-18 라운드6 실측: "the chunking context does not support
// external modules (request: node:fs)"). 서버 로더는 이 파일을 재export한다.
import type { MatchStatus } from "../types";
import { displayStatusOf, type DisplayStatus } from "./display-status";

/** 화면 상단 "발견"·표·그리드에 올릴 자격이 있는 판정 — 근거가 실제로 선 것만. */
export function isReportable(status: MatchStatus): boolean {
  return status === "announced-consistent" || status === "announced-inconsistent" || status === "unannounced";
}

/**
 * 배지에 올릴 표시 키. 수치 축(잠수함)이 있으면 지표 축 판정을 **덮는다** — LoL·TFT의
 * `displayStatusWithGameData`와 같은 규칙(증거 등급이 더 높다). 원래 상태는 행에 그대로 남는다.
 */
export function pubgDisplayStatus(status: MatchStatus, hasSubmarine: boolean): DisplayStatus {
  return hasSubmarine ? "submarine" : displayStatusOf(status);
}
