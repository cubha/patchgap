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
import { isReportable, loadPubg, loadPubgAssets, pubgPair, loadPubgDeclaration } from "@/lib/pubgData";
import { loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";
import CoverageSection from "@/components/compare/CoverageSection";
import { pubgGapTotal } from "@/lib/gapTotals";
import { pubgVerdictCount } from "@/pipeline/shared/headline";

// 쌍은 산출물에서 읽는다(`pubgPair`) — 하드코딩하면 다음 패치에서 설명문만 옛 쌍을 말한다.
const PAIR = pubgPair();

export const metadata: Metadata = {
  title: "PUBG 대조표 · patchgap",
  description: PAIR
    ? `PUBG ${PAIR.from} → ${PAIR.to} 무기별 획득 점유율 변화와 판정입니다.`
    : "PUBG 무기별 획득 점유율 변화와 판정입니다.",
};

export default function PubgComparePage() {
  const bundle = loadPubg();
  if (!bundle) {
    return (
      <main>
        <Container>
          <PubgUnavailable failure={loadPubgDeclaration()?.failure} crumbs={compareCrumbs("pubg")} />
        </Container>
      </main>
    );
  }

  const { deltas, before, after, notes } = bundle;
  const judged = deltas.rows.filter((row) => isReportable(row.status)).length;
  const submarine = summarizeGameData(loadGameDataDiff("pubg", deltas.meta.from, deltas.meta.to));
  // 커버리지 — 세 게임 공용 블록(ST-18, site-review pubg-S2·parity-S14). PUBG만 더 밝힐 것: 기대값이 없는 조항(조준 전환·
  // 반동·차량 피해)은 **이 데이터로 측정 불가**라 표에 오를 수 없다 — 전에는 방법론 맨 아래에만 있어 노트를 읽고 온 사람에게
  // 사이트가 그 변경을 놓친 것처럼 보였다. 숨김 상태(바닥 미달 등)의 건수는 여기서도 말하지 않는다(2026-10-07 결정).
  const unmeasurable = notes.filter((note) => note.expectedRelChange === null);
  const coverage = (
    <CoverageSection
      noteEntities={new Set(notes.flatMap((note) => note.weaponKeys)).size}
      noteItems={notes.length}
      matched={new Set(deltas.rows.filter((row) => isReportable(row.status) && row.matchedNoteIds.length > 0).map((row) => row.weaponKey)).size}
      gap={pubgGapTotal(deltas.rows, submarine)}
      extra={
        unmeasurable.length > 0 ? (
          <>
            이 데이터로 측정 불가 <strong className="font-bold text-fg">{unmeasurable.length}</strong>조항 —{" "}
            {[...new Set(unmeasurable.map((note) => note.stat))].join(" · ")}. 텔레메트리는 획득 점유율과 피해 격자만 담고 조준·
            반동·차량 피해는 담지 않습니다. 그 조항은 무기 상세의 「패치노트가 말한 것」에 회색으로 적습니다.
          </>
        ) : null
      }
    />
  );

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
            coverage={coverage}
          />

          {/* 수치 축의 **전수 목록은 브리핑 「미공지 Gap」 탭**이 소유한다(§8-3) — LoL·TFT와 같은
              자리다. 전에는 이 대조표에만 같은 섹션이 한 벌 더 있어서 세 게임에서 같은 개념을 찾는
              자리가 갈렸다(2026-09-23 화면 대조 V4). 이 표에서는 「바뀐 것」 열이 그 대상의 수치
              변경을 말하고, 판정이 서지 않아 행이 없는 대상은 브리핑이 전량 보여 준다. */}

          <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={pubgVerdictCount(deltas.rows)} />
        </div>
      </Container>
    </main>
  );
}
