/* eslint-disable @next/next/no-img-element */
// src/app/pubg/page.tsx
// PUBG 브리핑 — 게임 드롭다운으로 전환하면 뜨는 화면. 내비(브리핑·대조표·방법론)는 그대로다
// (PLAN-game-switcher-2026-09-17 R1). 브리핑은 **판정된 것**(공지 대조 + 미공지)과 **상세 진입점**
// (무기·맵)을 보여주고, 전체 판정표는 `/pubg/compare/`, 표본·게이트·한계는 `/pubg/methodology/`가 맡는다.
//
// 2026-09-18 라운드6(사용자 P1·P2·C1·C3):
//  - 표본·기저·게이트 카드 3장과 "대리 지표" 설명 문단·맵 각주를 **방법론으로 옮겼다** — "표기 이유나 방법에
//    대한 내용은 방법론 메뉴에 총망라"(C3). 브리핑에 남는 방법 서술은 표 머리의 단위 1줄뿐이다.
//  - 무기 상세 진입 그리드(`PubgWeaponGrid`)를 신설했다 — 판정된 무기만 링크가 있던 것이 P1의 원인이었다.
//  - 이 화면의 사용자 문구에서 다른 게임과의 비교 서술을 전부 뺐다(P2).
//  - 배지는 표시 키(`pubgDisplayStatus`)로 — 공지 / 공지 · 이상 관측 / 미공지(C5) / 잠수함 패치(F9).
//
// 이 게임은 판정 축이 하나뿐이다(무기 획득 점유율). 43.1 밸런스 항목 중 텔레메트리로 분리되는 축이
// 그것뿐이었고, 명중률 축은 반증됐다(PLAN-pubg-gate-2026-09-16 §8) — 그 사실은 방법론이 말한다.
import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import SubmarineSection from "@/components/gamedata/SubmarineSection";
import { gameDataEntityCount, loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";
import { PubgFooter, PubgUnavailable, pct, signedPct } from "@/components/pubg/shared";
import PubgWeaponGrid from "@/components/pubg/PubgWeaponGrid";
import { loadPubg, loadPubgAssets, loadPubgMaps, isReportable } from "@/lib/pubgData";
import { mapHref, weaponHref } from "@/lib/pubgRoutes";
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";
import { publicMapPath } from "@/pipeline/pubg/asset-path";
import { pubgDisplayStatus } from "@/pipeline/shared/pubg-status";
import ExternalLink from "@/components/ExternalLink";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";
import StatTiles from "@/components/StatTiles";
import DiscordPanel from "@/components/home/DiscordPanel";
import BriefingTabs from "@/components/BriefingTabs";
import BriefingRowList from "@/components/BriefingRowList";
import AnnouncedCoverageLine from "@/components/home/AnnouncedCoverageLine";
import EntityIndexSection from "@/components/EntityIndexSection";
import { groupBriefingItems } from "@/components/briefingRows";
import { pubgNotesAsPatchNotes } from "@/pipeline/match/pubg-delta";

export const metadata: Metadata = {
  // 패치쌍은 헤더 셀렉터가 말한다 — 탭 제목에서도 뺀다(2026-09-21, TFT와 같은 형식).
  title: "배틀그라운드 — patchgap",
  description: "PUBG: BATTLEGROUNDS 43.1 패치노트의 공지와 실제 관측 데이터를 대조합니다.",
};

export default function PubgPage() {
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
  // 원인 문장이 인용한 노트를 찾으려면 **엔진과 같은 변환**을 써야 한다(사본 금지).
  const notesById = new Map(
    pubgNotesAsPatchNotes(notes, (key) => deltas.rows.find((r) => r.weaponKey === key)?.weaponName ?? null).map(
      (note) => [note.id, note] as const
    )
  );
  const maps = loadPubgMaps();
  const assets = loadPubgAssets();
  const weaponAssets = new Set(assets?.weapons ?? []);
  const mapAssets = new Set(assets?.maps ?? []);
  const reportable = deltas.rows.filter((row) => isReportable(row.status));
  // 수치 축(F9) — 산출물이 없으면 섹션이 통째로 빠진다. 세 게임이 같은 컴포넌트를 쓴다.
  const submarine = summarizeGameData(loadGameDataDiff("pubg", deltas.meta.from, deltas.meta.to));
  const submarineKeys = new Set(submarine?.submarines.map((change) => change.entityKey) ?? []);
  const unannounced = reportable.filter((row) => row.status === "unannounced");
  const announced = reportable.filter((row) => row.status !== "unannounced");
  // 표 아래 원문 링크 1개 — 모든 공지 행이 같은 패치노트 페이지를 가리킨다(43.1 노트는 5항목 1페이지).
  const noteSource = announced.find((row) => row.evidence.noteAnchor)?.evidence.noteAnchor ?? null;

  /**
   * 델타 id → 원인 한 줄(§8-2). 이 게임에도 **추정 원인 축이 생겼다**(2026-09-23,
   * `scripts/run-pubg-llm.ts`) — 전에는 이 줄 자체가 없었다. 검증을 통과한 문장만 본문색이고,
   * 통과하지 못한 문장은 회색으로 남는다(무근거 회색 원칙). 없으면 줄을 그리지 않는다.
   */
  const causeById = new Map(
    deltas.rows
      .filter((row) => (row.causes ?? []).length > 0)
      .map((row) => [row.id, (row.causes ?? [])] as const)
  );
  const causeLine = (itemId: string) => {
    const causes = causeById.get(itemId);
    if (!causes || causes.length === 0) return null;
    // 가장 신뢰도 높은 검증 통과 문장 하나 — 없으면 첫 문장을 회색으로 보여 준다.
    const verified = causes.find((cause) => cause.verified);
    const pick = verified ?? causes[0];
    const note = verified ? notesById.get(pick.candidateNoteId ?? "") : undefined;
    return { text: pick.text, verified: pick.verified, href: note?.anchorUrl ?? null };
  };

  /**
   * PUBG 행 → 대상 단위 그룹(§8-2). 무기 하나가 여러 지표를 들 수 있고, 공지 표는 노트가 적은
   * 기대값을 함께 말한다 — 그 둘을 한 줄 안에 문자열로 합쳐 넘긴다(포맷은 게임 몫).
   */
  const weaponGroups = (rows: typeof deltas.rows) =>
    groupBriefingItems(
      rows.map((row) => {
        const note = notes.find((item) => item.id === row.matchedNoteId);
        const expected =
          note?.expectedRelChange !== null && note?.expectedRelChange !== undefined
            ? `공지 ${signedPct(note.expectedRelChange, 0)}${note.stat ? ` ${note.stat}` : ""} · `
            : "";
        return {
          id: row.id,
          entityKey: row.weaponKey,
          entityName: row.weaponName,
          entityType: "weapon",
          typeLabel: "무기",
          status: pubgDisplayStatus(row.status, submarineKeys.has(row.weaponKey)),
          field: "획득 점유율",
          change: `${expected}관측 ${signedPct(row.relChange ?? 0)} · 95% CI [${signedPct(row.relCi[0])}, ${signedPct(row.relCi[1])}]`,
          delta: null,
          noteAnchor: noteSource ?? null,
        };
      })
    );

  return (
    <main>
      <Container>
        {/* pt-40 — 시안 `.hero-body`가 히어로 스테이지 하단에 붙는 배치. 키아트 상단 구간을 글자로 덮지
            않는다(LoL 홈 pt-44와 같은 이유, 아트 밴드 높이에 맞춰 한 단계 작은 값). */}
        <div className="flex flex-col gap-6 pt-40 pb-8">
          {/* 히어로 = 문장 1줄 + 캡션(§8-1). 전에는 문장 아래 **페이지 헤더 카드가 한 장 더**
              있어 h1이 둘로 갈렸다(LoL은 문장이 곧 h1이다). 카드가 들던 제목·표본은 캡션 한 줄로
              흡수한다 — 같은 값을 잃지 않으면서 첫 화면의 블록 수를 세 게임이 맞춘다. */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">
              패치노트가 말한 것 vs 통계가 말하는 것
            </span>
            <h1 className="max-w-3xl font-display text-2xl leading-snug font-bold text-fg sm:text-3xl">
              패치노트는 <span className="text-accent">{notes.length}개 항목</span>을 말했고, 통계는{" "}
              <span className="text-accent">{reportable.length}개 변화</span>를 말합니다
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
              <strong className="text-fg">무기 획득 점유율</strong> · Steam · 전 지역·전 티어 <strong className="text-fg">{before.nMatches.toLocaleString()}</strong> →{" "}
              <strong className="text-fg">{after.nMatches.toLocaleString()}</strong>매치 · 무기{" "}
              <strong className="text-fg">{deltas.meta.n}</strong>종
            </p>
          </div>

          {/* 3타일은 세 게임 공통 컴포넌트가 그린다(UX-BRIEF §8-1). PUBG 대조표는 상태 칩이
              있어 `#unannounced` 앵커가 실제로 걸린다. */}
          <StatTiles
            announcedCount={notes.length}
            patch={deltas.meta.to}
            significantCount={reportable.length}
            gapCount={unannounced.length}
            game="pubg"
          />

          {/* 공지 대조가 기본 탭, 미공지가 두 번째 탭(2026-09-17 사용자 지시 — 홈과 같은 순서). */}
          {/* 2컬럼 골격 — 좌 본문 / 우 사이드(UX-BRIEF §8-1, A안). 무기 그리드·맵은 아래
              「전 대상 색인」 슬롯에 그대로 둔다 — 1fr 사이드로 옮기면 7~47칸 격자가 찌그러진다. */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-6">
            <BriefingTabs
              contentCount={announced.length}
              gapCount={unannounced.length + gameDataEntityCount(submarine)}
              content={
                <SectionCard
                  eyebrow="대조"
                  title="공지된 변경은 실제로 그렇게 됐나"
                  variant="glass"
                  action={<span className="font-mono text-xs text-muted">{announced.length}건</span>}
                >
                  {/* 단위 1줄 — 매치당 총 획득이 함께 내려가(490 → 427) 이 한 줄이 없으면 모든 무기가 하향으로
                      읽힌다. 왜 그런지는 방법론 "기저" 카드가 말한다. */}
                  <p className="border-b border-border-soft px-5 py-2 text-xs text-muted">
                    모든 수치는 매치당 총 획득 대비 <strong className="text-fg-2">점유율</strong> ·{" "}
                    {before.nMatches.toLocaleString()} → {after.nMatches.toLocaleString()}매치
                  </p>
                  {/* 본문 행은 **대상 단위**다(UX-BRIEF §8-2) — 전에는 무기 1개가 지표마다
                      흩어졌고 판정 뱃지가 맨 뒤 열이었다. 공용 행이 뱃지를 맨 앞에 두고
                      이름을 링크로 만든다. 높이 상한은 `@/lib/panelScroll`이 소유한다. */}
                  <div className={PANEL_SCROLL_BODY}>
                    <BriefingRowList
                      groups={weaponGroups(announced)}
                      hrefOf={(g) => weaponHref(g.entityKey)}
                      causeOf={causeLine}
                      emptyText="공지와 짝지어진 유의한 관측이 없습니다."
                    />
                  </div>
                  {/* 세 게임이 같은 자리에서 같은 말을 한다(§8-1, 2026-09-23 화면 대조 V5). */}
                  <AnnouncedCoverageLine
                    noteTargets={new Set(notes.flatMap((n) => n.weaponKeys)).size}
                    observed={new Set(announced.map((r) => r.weaponKey)).size}
                  />
                  {noteSource ? (
                    <div className="border-t border-border-soft px-5 py-3">
                      <ExternalLink className="text-sm font-bold text-accent hover:underline" href={noteSource}>
                        패치노트 원문 보기 ↗
                      </ExternalLink>
                    </div>
                  ) : null}
                </SectionCard>
              }
              gap={
                // 미공지 Gap은 **두 갈래**다(2026-09-21): 위가 수치 축(게임사가 무엇을 바꿨나),
                // 아래가 지표 축(공지에 없는데 움직였나). 위계의 근거는 증거 등급이다.
                <div className="flex flex-col gap-6">
                {submarine ? (
                  <SubmarineSection summary={submarine} hrefOf={(change) => weaponHref(change.entityKey)} />
                ) : null}
                <SectionCard
                  eyebrow="발견 · 지표 축"
                  title="공지에 없는데 움직였습니다"
                  variant="glass"
                  action={<span className="font-mono text-xs text-muted">{unannounced.length}건</span>}
                >
                  <div className={PANEL_SCROLL_BODY}>
                    <BriefingRowList
                      groups={weaponGroups(unannounced)}
                      hrefOf={(g) => weaponHref(g.entityKey)}
                      causeOf={causeLine}
                      emptyText="바닥을 넘는 미공지 변화가 없습니다."
                    />
                  </div>
                </SectionCard>
                </div>
              }
            />
            </div>
            <div className="flex flex-col gap-6">
              {/* 사이드는 그 게임이 가진 것만(§8-1). PUBG는 지금 디스코드뿐이다. */}
              <DiscordPanel game="pubg" generatedAt={deltas.meta.generatedAt} />
            </div>
          </div>

          {/* 전 대상 색인(§8-1) — 세 게임 공통 슬롯. 대조표는 판정이 선 무기만 올리므로
              전수 진입점은 여기뿐이다(2026-09-18 P1 "상세페이지 진입점이 없음"이 이 슬롯의 출처다).
              표현은 게임 몫이라 공식 렌더 카드를 그대로 쓴다(§8-0). */}
          <EntityIndexSection
            groups={[
              {
                label: `무기 · ${deltas.meta.to} 점유율순`,
                total: after.weapons.length,
                body: <PubgWeaponGrid weapons={after.weapons} rows={deltas.rows} assetKeys={weaponAssets} />,
              },
              ...(maps
                ? [
                    {
                      label: "맵",
                      total: maps.after.maps.length,
                      body: (
                    <ul className={`grid gap-px bg-border-soft sm:grid-cols-2 lg:grid-cols-4 ${PANEL_SCROLL_BODY}`}>
                      {maps.after.maps.map((map) => {
                        const identity = mapIdentity(map.mapKey);
                        const delta = maps.deltas.rows.find((r) => r.mapKey === map.mapKey) ?? null;
                        const hasRender = identity.assetName !== "" && mapAssets.has(identity.assetName);
                        return (
                          <li key={map.mapKey} className="bg-surface">
                            <Link
                              href={mapHref(map.mapKey)}
                              className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-accent/10"
                              aria-label={`${identity.koName} 상세`}
                            >
                              <span className="relative block h-20 overflow-hidden rounded-sm bg-surface-warm">
                                {hasRender ? (
                                  <img
                                    src={publicMapPath(identity.assetName)}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </span>
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="font-display font-bold text-fg">{identity.koName}</span>
                                <span className="font-mono text-xs text-muted">{identity.sizeLabel}</span>
                              </span>
                              <span className="flex items-baseline gap-2 font-mono text-xs text-muted">
                                <span className="tabular-nums text-fg-2">{pct(map.matchShare, 1)}</span>
                                {delta ? (
                                  <span className={delta.matchShareDelta > 0 ? "tabular-nums text-success" : "tabular-nums text-danger"}>
                                    {signedPct(delta.matchShareDelta, 1)}
                                  </span>
                                ) : null}
                                <span className="tabular-nums">n={map.nMatches.toLocaleString()}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
        </div>
      </Container>
    </main>
  );
}
