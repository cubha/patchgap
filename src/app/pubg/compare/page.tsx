// src/app/pubg/compare/page.tsx
// PUBG 대조표 — 내비 "대조표"가 PUBG일 때 도달하는 화면. LoL `/compare/`와 같은 자리다.
// 2026-09-18 라운드6(사용자 C1·C3): 판정이 선 무기만 올린다(바닥 미달·변화 없음·표본 부족은 표시하지
// 않는다 — 그 규칙과 q 열이 없는 이유는 방법론이 말한다). 이 화면의 설명 문단은 뺐다.
import type { Metadata } from "next";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import PubgCompareTable from "@/components/pubg/PubgCompareTable";
import { PubgFooter, PubgPageHeader, PubgUnavailable } from "@/components/pubg/shared";
import { isReportable, loadPubg } from "@/lib/pubgData";
import SubmarineSection from "@/components/gamedata/SubmarineSection";
import { loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";

export const metadata: Metadata = {
  title: "PUBG 대조표 · patchgap",
  description: "PUBG 42.3 ⇒ 43.1 무기별 획득 점유율 변화와 판정.",
};

export default function PubgComparePage() {
  const bundle = loadPubg();
  if (!bundle) {
    return (
      <main>
        <Container>
          <PubgUnavailable />
        </Container>
      </main>
    );
  }

  const { deltas, before, after } = bundle;
  const judged = deltas.rows.filter((row) => isReportable(row.status)).length;
  const submarine = summarizeGameData(loadGameDataDiff("pubg", deltas.meta.from, deltas.meta.to));

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 py-8">
          <PubgPageHeader
            title="무기 판정표 — 42.3 ⇒ 43.1"
            lead={
              <>
                {deltas.meta.n}개 무기 중 판정 <strong className="text-fg">{judged}개</strong>
              </>
            }
          />

          <SectionCard
            eyebrow="판정"
            title="무기별 획득 점유율"
            variant="glass"
            action={
              <span className="font-mono text-xs tabular-nums text-muted">
                {before.nMatches.toLocaleString()} → {after.nMatches.toLocaleString()}매치
              </span>
            }
          >
            <div className="p-5">
              <PubgCompareTable
                rows={deltas.rows}
                submarineChanges={submarine?.submarines ?? []}
                mismatchChanges={(submarine?.mismatches ?? []).flatMap((e) => e.changes)}
              />
            </div>
          </SectionCard>

          {/* 수치 축(2026-09-21) — LoL·TFT 대조표는 지표가 여럿이라 잠수함을 **행으로** 끼워
              넣지만, 이 표는 지표가 `pickupShare` 하나뿐이라 빈 점유율 행은 표를 망가뜨린다.
              그래서 같은 섹션을 표 아래에 둔다 — 전량이 보인다는 요구는 그대로 지킨다. */}
          {submarine ? <SubmarineSection summary={submarine} /> : null}

          <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
        </div>
      </Container>
    </main>
  );
}
