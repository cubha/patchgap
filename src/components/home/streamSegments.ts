// src/components/home/streamSegments.ts
// 스트림 접힘 구간 분할(2026-09-18, 채점 라운드5 E2). 순수 함수 — ReleaseNoteStream이 렌더 직전에
// 호출한다.
//
// **왜 접는가**: 실측 홈(26.17→26.18) 공지 그룹 20개 중 관측 보유는 7개가 데이터 상한이라, 어떤
// 정렬로도 8행째부터 "관측 변화 없음"이 6행 연속이었다(채점 라운드4 E2 −1 "같은 빈 문장의 연속
// 노출"). 행을 숨기는 대신 연속 구간을 요약 1행 `<details>`로 묶는다 — ST-8(라운드1) 결정
// "숨기지 않고 아래로 내릴 뿐"의 연장이지 예외가 아니다.
//
// **규칙**: 순서를 바꾸지 않고, 행을 잃지 않고, **연속된** tier 2 항목만 하나의 접힘 구간으로
// 묶는다. 정렬(page.tsx)이 tier 2를 한 덩어리로 만들어 두지만 그 가정에 기대지 않는다 — 정렬
// 규칙이 바뀌어도 이 함수는 참이다. tier가 없는 항목(미공지 그룹)은 절대 접지 않는다.
import type { ReleaseStreamEntry } from "./ReleaseNoteStream";

export type StreamSegment =
  | { kind: "rows"; entries: ReleaseStreamEntry[] }
  | { kind: "collapsed"; entries: ReleaseStreamEntry[] };

export function segmentStream(entries: readonly ReleaseStreamEntry[]): StreamSegment[] {
  const out: StreamSegment[] = [];
  for (const entry of entries) {
    const kind: StreamSegment["kind"] = entry.tier === 2 ? "collapsed" : "rows";
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.entries.push(entry);
    else out.push({ kind, entries: [entry] });
  }
  return out;
}
