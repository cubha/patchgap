// src/components/observation/ObservationSection.tsx
// **상세 공통 관측 섹션** — 네 상세(LoL 챔피언·아이템 · TFT 유닛·특성·아이템 · PUBG 무기 · PUBG 맵)가 같은 자리에
// 같은 모양으로 쓴다(2026-10-06 사용자 확정 — 시안 https://claude.ai/artifact/5Jitae5GfFhk8icKRTDggB ,
// PLAN-detail-observation-section-2026-10-06.md).
//
// 입력은 「지표[] → 구간[] → 패널」 하나다. 게임 어댑터(각 상세 본문)가 자격 있는 조합만 골라 패널을 그려 넘기고,
// 이 섹션은 머리(제목·건수)·전환(`ObservationTabs`)·각주만 소유한다. 탭이 1개면 탭 줄이 라벨 1개가 되고, 구간이
// 없으면 선택 상자가 사라질 뿐 섹션은 같다.
//
// **자격 없는 조합은 여기 들어오지 않는다**(9/18 확정 규칙 — 표본 부족·바닥 미달·변화 없음은 탭도 선택지도 만들지
// 않는다). 그래서 조합이 0이면 숨긴 상태의 이름을 꺼내지 않고 `emptyText` 한 줄만 말한다.
import SectionCard from "@/components/SectionCard";
import ObservationTabs, { type ObservationTabMetric } from "./ObservationTabs";

export interface ObservationSectionProps {
  metrics: ObservationTabMetric[];
  initial: { metric: string; segment: string } | null;
  /** 구간 축 이름(LoL 챔피언 「라인」). null이면 구간 축이 없다. */
  segmentLabel: string | null;
  /** 구간 축이 없는 대상에서 그 이유 한 줄. */
  noSegmentNote?: string;
  /**
   * `verdict`(기본) — 판정이 선 관측. `descriptive` — 판정을 만들지 않는 축(PUBG 맵)의 **기술통계 모드**:
   * 같은 섹션이되 건수를 「보고할 관측」이 아니라 「관측 지표」로 센다(판정이 없는데 보고 자격을 말하지 않는다).
   */
  mode?: "verdict" | "descriptive";
  /** 자격 조합이 0일 때의 문장. */
  emptyText: string;
}

export default function ObservationSection({
  metrics,
  initial,
  segmentLabel,
  noSegmentNote,
  mode = "verdict",
  emptyText,
}: ObservationSectionProps) {
  const count = metrics.reduce((sum, m) => sum + m.segments.length, 0);
  const descriptive = mode === "descriptive";
  const footnote = descriptive
    ? "판정을 만들지 않는 축이라 관측값만 보입니다 — 신뢰구간·통계 게이트·원천 매치·추정 원인은 판정이 있는 대상에만 있습니다."
    : `통계 게이트와 효과크기 바닥을 통과한 관측만 지표 탭${segmentLabel ? `과 ${segmentLabel} 선택지` : ""}로 나타납니다. 탭·선택지에 없는 조합은 보고할 변화가 없다는 뜻입니다.`;

  return (
    <SectionCard
      eyebrow="관측"
      title="지표별 변화"
      variant="glass"
      action={
        <span className="font-mono text-xs text-muted">
          {descriptive ? `관측 지표 ${count}개` : `보고할 관측 ${count}건`}
        </span>
      }
    >
      <div data-observation-section={mode}>
        {count === 0 || initial === null ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{emptyText}</p>
        ) : (
          <ObservationTabs
            metrics={metrics}
            segmentLabel={segmentLabel}
            noSegmentNote={noSegmentNote}
            initial={initial}
          />
        )}
        <p className="border-t border-border-soft px-5 py-3 text-xs leading-relaxed text-muted">{footnote}</p>
      </div>
    </SectionCard>
  );
}
