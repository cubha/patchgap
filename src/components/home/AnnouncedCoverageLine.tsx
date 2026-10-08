// src/components/home/AnnouncedCoverageLine.tsx
// 「패치 내용」 탭 맨 아래 한 줄 — **공지된 대상 중 몇 개가 실제로 움직였나**.
//
// **왜 생겼나**(2026-09-23 화면 대조 V5): 이 사실을 LoL 브리핑만 말하고 있었다. LoL은 패치노트
// 대상을 전부 카드로 싣고 관측이 없는 것을 「유의한 관측 없음」으로 접어 보여 주는데, TFT·PUBG
// 브리핑은 **보고 가능한 것만** 상위 N개 싣는다. 그래서 같은 탭을 세 게임에서 열면 "공지했는데
// 아무 일도 없었다"는 사실이 한 게임에서만 보였다.
//
// **목록 범위를 맞추지 않고 사실을 맞춘 이유**: 목록 범위는 파서 해소율에 매인다 — LoL 파서는
// 노트 181줄을 전부 대상에 붙이지만 TFT는 163줄 중 일부, PUBG는 수기 5줄이다. 없는 대상을
// 지어내 목록을 채우는 대신, **세는 수를 같은 자리에서 같은 말로** 밝힌다.
export interface AnnouncedCoverageLineProps {
  /** 패치노트가 말한 대상 수. */
  noteTargets: number;
  /** 그중 유의한 관측이 선 대상 수. */
  observed: number;
  /**
   * 「나머지」에 들어가는 **게임 고유 범주** 한 구절(Phase 3 scope-critic 권고). PUBG는 지표가 안 움직인 것 말고도 이 데이터로
   * 측정할 수 없는 조항(조준 전환·반동·차량 피해)이 있어, 그 말이 없으면 문장이 거짓이 된다. 없는 게임은 생략.
   */
  alsoUnmeasured?: string | null;
}

export default function AnnouncedCoverageLine({ noteTargets, observed, alsoUnmeasured = null }: AnnouncedCoverageLineProps) {
  return (
    <p className="border-t border-border-soft px-5 py-3 text-xs leading-relaxed text-muted">
      공지된 대상 <strong className="text-fg-2">{noteTargets}</strong>개 중 유의한 관측이 선 것은{" "}
      {/* 약속은 실제 표시 범위만(ST-18): 숨김 상태의 건수·사유는 화면이 말하지 않기로 했다(2026-10-07, #78) — 전에는 이
          문장이 "어느 쪽인지는 커버리지가 밝힙니다"라고 **없는 것**을 약속했다. 그 규칙은 방법론이 말한다. */}
      <strong className="text-fg-2">{observed}</strong>개입니다. 나머지는 패치노트가 말했지만 지표가
      움직이지 않았거나 게이트를 넘지 못한 것{alsoUnmeasured ? `이거나 ${alsoUnmeasured}` : ""}입니다 — 대조표 하단
      「표가 다룬 범위」가 노트 대상 중 관측 짝과 미공지 수를, 방법론이 게이트 규칙을 밝힙니다.
    </p>
  );
}
