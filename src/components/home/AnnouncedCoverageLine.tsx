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
}

export default function AnnouncedCoverageLine({ noteTargets, observed }: AnnouncedCoverageLineProps) {
  return (
    <p className="border-t border-border-soft px-5 py-3 text-xs leading-relaxed text-muted">
      공지된 대상 <strong className="text-fg-2">{noteTargets}</strong>개 중 유의한 관측이 선 것은{" "}
      <strong className="text-fg-2">{observed}</strong>개입니다. 나머지는 패치노트가 말했지만 지표가
      움직이지 않았거나 게이트를 넘지 못한 것이고, 어느 쪽인지는 대조표 아래 커버리지가 밝힙니다.
    </p>
  );
}
