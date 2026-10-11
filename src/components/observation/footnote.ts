// src/components/observation/footnote.ts
// 관측 섹션 각주 — 순수 문구 함수(트랙 B ST-12, lol-S30·pubg-S23 · ST-17 pubg-S15).
//
// 전에는 템플릿 한 줄(`지표 탭${선택지 ? "과 … 선택지" : ""}로`)이라 선택지가 없을 때 「지표 탭로」가 됐다 — 세 게임 상세 278장.
// 조사는 앞 낱말이 정한다(탭 → 「으로」, 선택지 → 「로」). 기술통계(판정 없는 축) 화면에서 지표가 0개면 「관측값만 보입니다」는
// 없는 관측을 약속하므로 각주를 내지 않는다(미라마 실측).

export function observationFootnote({
  mode,
  segmentLabel,
  count,
}: {
  mode: "verdict" | "descriptive";
  segmentLabel: string | null | undefined;
  count: number;
}): string | null {
  if (mode === "descriptive") {
    if (count === 0) return null;
    return "판정을 만들지 않는 축이라 관측값만 보입니다 — 신뢰구간·통계 게이트·원천 매치·추정 원인은 판정이 있는 대상에만 있습니다.";
  }
  const where = segmentLabel ? `지표 탭과 ${segmentLabel} 선택지로` : "지표 탭으로";
  return `통계 게이트와 효과크기 바닥을 통과한 관측만 ${where} 나타납니다. 탭·선택지에 없는 조합은 보고할 변화가 없다는 뜻입니다.`;
}
