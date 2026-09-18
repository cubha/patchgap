// src/components/item/SourceMatchesPanel.tsx
// 항목 상세 "원천 매치"(ST-12 ⑥) — evidence.matchIds 칩(말줄임 없이, 칩 단위로만 줄바꿈) +
// aggregatePath 텍스트 + 데이터 스냅샷 해시.
//
// 렌더 결함 수정(코디네이터 지적, 2026-09-05): 고정 열 `grid`(`grid-cols-2 sm:grid-cols-3
// lg:grid-cols-5`) + `whitespace-normal break-all`을 쓰면 매치 ID 문자열이 칩 경계가 아니라
// **칩 내부에서** 줄바꿈돼("KR_835880612" / "2"처럼 ID 중간이 끊김) 정확한 ID를 읽거나
// 복사할 수 없었다. `flex flex-wrap`(칩마다 콘텐츠 폭만큼 차지, 줄이 차면 다음 칩째로 줄바꿈)
// + `whitespace-nowrap`(칩 내부 텍스트는 항상 한 줄)으로 교체해 ID가 항상 통째로 보이게 한다.

export interface SourceMatchesPanelProps {
  matchIds: string[];
  aggregatePath: string;
  /** deltas 파일 sha256 앞 12자(서버에서 snapshotHash로 계산해 전달). */
  snapshotHash: string;
}

export default function SourceMatchesPanel({
  matchIds,
  aggregatePath,
  snapshotHash,
}: SourceMatchesPanelProps) {
  // 2026-09-18 라운드6(scope-critic ST8): 카드가 고정 높이(h-64)가 되면서 **칩 목록만** 내부 스크롤하고
  // 메타(집계 경로·해시)는 카드 하단에 고정한다 — 래퍼 전체가 스크롤하면 메타가 같이 밀려 보이지 않는다.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {matchIds.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto p-5">
          {matchIds.map((id) => (
            <span
              key={id}
              className="whitespace-nowrap rounded-sm border border-border-soft bg-surface-warm px-3 py-2 text-center font-mono text-xs tabular-nums text-fg-2"
            >
              {id}
            </span>
          ))}
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">원천 매치 표본 없음</p>
      )}
      {/* mt-auto — 부모(SectionCard)가 옆 컬럼과 하단을 맞추려 flex-1로 늘어난 경우, 이 메타
          블록이 항상 카드 하단에 붙는다. 늘어난 공간이 없으면 자연 높이 그대로. */}
      <div className="flex min-w-0 flex-col gap-2 border-t border-border-soft px-5 py-3 font-mono text-xs text-muted">
        {/* `break-all`은 **이 두 줄에만** 건다(2026-09-18 채점 라운드4 S3).
            **왜 필요한가 — 상세 페이지 좌우 폭 역전의 원인이 이 한 줄이었다.** `aggregatePath`는
            `data/aggregated/26.18/champions.json#rows[championId=62,scope=position,position=JUNGLE]`
            처럼 **공백이 하나도 없는 48~89자 토큰**이다(1,951행 실측). 래핑 지점이 없으면 이 줄의
            min-content가 346~641px이 되는데, 부모 그리드가 `lg:grid-cols-[2fr_1fr]`이고 CSS `fr`은
            `minmax(auto, Nfr)`이라 **min-content가 fr 배분을 이긴다** — `1fr` 몫 315px을 최소
            케이스(346px)조차 넘으므로 aside가 부풀고 `2fr` 본문이 잔여로 눌렸다. 실측: 오공 정글
            승률 페이지에서 본문 328px / aside 616px로 **완전히 뒤집혀** 판정 차트와 추정 원인이
            좁은 쪽에 갇혀 있었다(1,951행 전량, 예외 0건).
            **칩에는 절대 걸지 않는다**: 위 헤더 주석대로 2026-09-05에 `break-all`을 칩에서 걷어낸
            이력이 있다(매치 ID가 칩 내부에서 끊겨 복사 불가). 같은 속성을 컨테이너나 칩에 걸면
            그 수정을 회귀시킨다 — 그래서 span 단위로만 준다. */}
        <span className="break-all">집계 경로: {aggregatePath}</span>
        <span className="break-all">데이터 스냅샷 sha256:{snapshotHash}</span>
      </div>
    </div>
  );
}
