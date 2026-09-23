// src/app/pubg/compare/page.tsx
// PUBG 대조표 — 내비 "대조표"가 PUBG일 때 도달하는 화면. LoL `/lol/compare/`와 같은 자리다.
// 판정이 선 무기만 올린다(바닥 미달·변화 없음·표본 부족은 표시하지 않는다 — 그 규칙과 q 열이
// 없는 이유는 방법론이 말한다).
//
// 2026-09-23 §8-3 정렬: 화면 머리(이동 경로 + h1)·도구모음·좌 「패치노트 항목」 내비·2컬럼
// 골격을 공용 컴포넌트로 세웠다. 인터랙션은 `PubgCompareExplorer`('use client')가 소유한다.
import type { Metadata } from "next";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import PubgCompareExplorer from "@/components/pubg/PubgCompareExplorer";
import { PubgFooter, PubgUnavailable } from "@/components/pubg/shared";
import { compareCrumbs } from "@/lib/breadcrumbs";
import { isReportable, loadPubg, loadPubgAssets } from "@/lib/pubgData";
import { loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";

export const metadata: Metadata = {
  title: "PUBG 대조표 · patchgap",
  description: "PUBG 42.3 → 43.1 무기별 획득 점유율 변화와 판정입니다.",
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

  const { deltas, before, after, notes } = bundle;
  const judged = deltas.rows.filter((row) => isReportable(row.status)).length;
  const submarine = summarizeGameData(loadGameDataDiff("pubg", deltas.meta.from, deltas.meta.to));

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 py-8">
          <PageHeader
            crumbs={compareCrumbs("pubg")}
            eyebrow="PUBG: BATTLEGROUNDS"
            title={
              <>
                <span className="text-accent">
                  {deltas.meta.from} → {deltas.meta.to}
                </span>{" "}
                대조표
              </>
            }
            lead={
              <>
                {deltas.meta.n}개 무기 중 판정 <strong className="text-fg">{judged}개</strong> ·{" "}
                {before.nMatches.toLocaleString()} → {after.nMatches.toLocaleString()}매치. 왼쪽에서
                패치노트 항목을 고르면 오른쪽 표의 그 무기로 이동합니다.
              </>
            }
          />

          <PubgCompareExplorer
            rows={deltas.rows}
            notes={notes}
            fromLabel={deltas.meta.from}
            toLabel={deltas.meta.to}
            assetKeys={loadPubgAssets()?.weapons ?? []}
            submarineChanges={submarine?.submarines ?? []}
            mismatchChanges={(submarine?.mismatches ?? []).flatMap((e) => e.changes)}
          />

          {/* 수치 축의 **전수 목록은 브리핑 「미공지 Gap」 탭**이 소유한다(§8-3) — LoL·TFT와 같은
              자리다. 전에는 이 대조표에만 같은 섹션이 한 벌 더 있어서 세 게임에서 같은 개념을 찾는
              자리가 갈렸다(2026-09-23 화면 대조 V4). 이 표에서는 「바뀐 것」 열이 그 대상의 수치
              변경을 말하고, 판정이 서지 않아 행이 없는 대상은 브리핑이 전량 보여 준다. */}

          <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
        </div>
      </Container>
    </main>
  );
}
