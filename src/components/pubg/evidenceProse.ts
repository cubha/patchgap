// src/components/pubg/evidenceProse.ts
// PUBG 상세의 **근거를 자연어로** 조립하는 순수 함수(2026-09-19).
//
// 사용자 지적 원문: "근거가 전혀 사용자가 알아볼 수 없게되어있어. 사용자는 자연어로 근거를
// 제공받아야함. (또는 링크)". 그전 화면은 근거 영역에 집계 파일 경로
// (`data/aggregated/pubg/weapons-43.1.json#weapons[weaponKey=Item_Weapon_BerylM762_C]`)와 매치
// UUID 세 개를 그대로 늘어놨다. 그건 **감사 흔적**이지 사람이 읽는 근거가 아니다.
//
// 그렇다고 원천을 지우지는 않는다 — "모든 판정문은 원천 링크를 가진다"(CLAUDE.md)가 이 프로젝트의
// 불변식이다. 그래서 위계를 바꾼다: 자연어 문장이 먼저 오고, 식별자는 접힌 영역에 남는다.
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";

export interface PubgEvidenceProseInput {
  /** 대상 이름 — "Beryl M762" 또는 맵 이름. */
  subjectName: string;
  /** "무기" | "맵" 등 대상 종류(문장 주어를 자연스럽게 만든다). */
  subjectKind: string;
  /** 지표의 한국어 이름 — 무기는 "획득 점유율". */
  metricLabel: string;
  from: string;
  to: string;
  before: number | null;
  after: number | null;
  row: PubgDeltaRow | null;
  /** 짝지어진 패치노트 줄의 요약문(없으면 null). */
  noteSummary: string | null;
  /** 이 패치 쌍의 효과크기 바닥(`deltas.meta.effectFloor`). 바닥 미달 사유를 말할 때 값을 함께
   * 밝히려고 받는다 — 없으면 값 없이 사유만 말한다(수치를 지어내지 않는다). */
  effectFloor?: number;
}

function pct(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 구간이 0을 걸치는가 — **문장이 인용하는 바로 그 수치**로 판정한다(2026-09-19 최종 채점 K2-1).
 *
 * 그전에는 `!isReportable(status)`로 갈랐는데, 그 한 덩어리 안에 사유가 다른 둘이 들어 있었다:
 * `no-change`(구간이 0을 포함)와 `below-threshold`(구간은 0을 안 포함하나 변화폭이 바닥 미만).
 * 그래서 바닥 미달 21종 전부가 "[+3.3%, +5.8%]로 0을 포함해"라고 **거짓을 말했다**. 게다가
 * `classify()`는 짝 노트가 있으면 유의성 검사를 건너뛰고 announced-*를 내므로, 공지 행의 구간이
 * 0을 포함할 수도 있다 — status에서 구간의 성질을 추론하는 것 자체가 성립하지 않는다.
 */
function ciIncludesZero(ci: readonly [number, number]): boolean {
  return ci[0] <= 0 && ci[1] >= 0;
}

function signedPct(value: number, digits = 1): string {
  const formatted = `${(Math.abs(value) * 100).toFixed(digits)}%`;
  return value >= 0 ? `+${formatted}` : `−${formatted}`;
}

/**
 * 근거 문단을 문장 배열로 돌려준다(렌더는 호출부 몫). 문장은 넷으로 나뉜다 —
 * ① 무엇이 어떻게 변했나 ② 그 변화를 왜 믿을 수 있나(또는 왜 판정을 보류했나)
 * ③ 어떤 표본에서 나왔나 ④ 패치노트와 어떻게 대조했나.
 */
export function buildPubgEvidenceProse(input: PubgEvidenceProseInput): string[] {
  const { subjectName, subjectKind, metricLabel, from, to, before, after, row, noteSummary, effectFloor } = input;
  const sentences: string[] = [];

  if (before !== null && after !== null) {
    const direction = after > before ? "올랐습니다" : after < before ? "내렸습니다" : "그대로입니다";
    const relPart = row?.relChange != null ? ` 상대 변화로는 ${signedPct(row.relChange)}입니다.` : "";
    sentences.push(
      `${from}에서 ${to}로 오면서 ${subjectName} ${subjectKind}의 ${metricLabel}은 ` +
        `${pct(before)}에서 ${pct(after)}로 ${direction}.${relPart}`
    );
  } else {
    sentences.push(`${to} 집계에서 ${subjectName} ${subjectKind}의 ${metricLabel}은 ${after === null ? "집계되지 않았습니다" : pct(after)}입니다.`);
  }

  if (row === null) {
    sentences.push("이 대상은 판정 대상 목록에 없어 통계 판정을 하지 않았습니다.");
  } else if (row.status === "insufficient-sample") {
    sentences.push(
      `다만 비교에 쓸 시행이 ${row.n.before.toLocaleString()}건 → ${row.n.after.toLocaleString()}건으로 ` +
        "기준에 못 미쳐, 변화가 있는지 없는지를 말하지 않습니다."
    );
  } else if (row.status === "below-threshold") {
    // 바닥 미달은 "구간이 0을 포함한다"와 **다른 사유**다. 이 행들의 구간은 0을 포함하지 않는다
    // (실측: 21종 전부). 보류한 이유는 변화폭이 이 패치의 효과크기 바닥에 못 미쳐서다.
    const floorPart = effectFloor === undefined ? "" : ` ${pct(effectFloor, 1)}`;
    const relPart = row.relChange === null ? "이 변화" : `상대 변화 ${signedPct(row.relChange)}`;
    sentences.push(
      `${relPart}가 이 패치의 효과크기 바닥${floorPart}에 못 미쳐, 관측은 남기되 판정하지 않습니다.`
    );
  } else if (ciIncludesZero(row.relCi)) {
    sentences.push(
      `95% 신뢰구간이 [${signedPct(row.relCi[0])}, ${signedPct(row.relCi[1])}]로 0을 포함해, ` +
        "이 정도 차이는 표본이 흔들린 결과와 구분되지 않습니다."
    );
  } else {
    sentences.push(
      `95% 신뢰구간이 [${signedPct(row.relCi[0])}, ${signedPct(row.relCi[1])}]로 0을 포함하지 않아, ` +
        "표본이 흔들린 결과로 보기 어렵습니다."
    );
  }

  if (row !== null) {
    sentences.push(
      `표본은 Steam 전 지역·전 티어 매치에서 모은 ${row.n.before.toLocaleString()}건(${from}) · ` +
        `${row.n.after.toLocaleString()}건(${to})의 기록입니다.`
    );
  }

  if (noteSummary !== null) {
    sentences.push(`${to} 패치노트의 "${noteSummary}" 항목과 대조했습니다.`);
  } else {
    sentences.push(`${to} 패치노트에는 이 ${subjectKind}를 다룬 항목이 없어, 관측만으로 판정했습니다.`);
  }

  return sentences;
}
