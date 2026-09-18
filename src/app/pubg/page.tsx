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
//  - 배지는 표시 키(`displayStatusOf`)로 — 공지 / 공지 · 이상 관측 / 미공지(C5).
//
// 이 게임은 판정 축이 하나뿐이다(무기 획득 점유율). 43.1 밸런스 항목 중 텔레메트리로 분리되는 축이
// 그것뿐이었고, 명중률 축은 반증됐다(PLAN-pubg-gate-2026-09-16 §8) — 그 사실은 방법론이 말한다.
import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { PubgFooter, PubgPageHeader, PubgUnavailable, pct, signedPct } from "@/components/pubg/shared";
import PubgBriefingTabs from "@/components/pubg/PubgBriefingTabs";
import PubgWeaponGrid from "@/components/pubg/PubgWeaponGrid";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { loadPubg, loadPubgAssets, loadPubgMaps, isReportable } from "@/lib/pubgData";
import { mapHref, weaponHref } from "@/lib/pubgRoutes";
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";
import { publicMapPath } from "@/pipeline/pubg/asset-path";
import { displayStatusOf } from "@/pipeline/shared/display-status";

export const metadata: Metadata = {
  title: "PUBG 42.3 ⇒ 43.1 · patchgap",
  description: "PUBG: BATTLEGROUNDS 43.1 패치노트의 공지와 실제 관측 데이터를 대조한다.",
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
  const maps = loadPubgMaps();
  const assets = loadPubgAssets();
  const weaponAssets = new Set(assets?.weapons ?? []);
  const mapAssets = new Set(assets?.maps ?? []);
  const reportable = deltas.rows.filter((row) => isReportable(row.status));
  const unannounced = reportable.filter((row) => row.status === "unannounced");
  const announced = reportable.filter((row) => row.status !== "unannounced");
  // 표 아래 원문 링크 1개 — 모든 공지 행이 같은 패치노트 페이지를 가리킨다(43.1 노트는 5항목 1페이지).
  const noteSource = announced.find((row) => row.evidence.noteAnchor)?.evidence.noteAnchor ?? null;

  return (
    <main>
      <Container>
        {/* pt-40 — 시안 `.hero-body`가 히어로 스테이지 하단에 붙는 배치. 키아트 상단 구간을 글자로 덮지
            않는다(LoL 홈 pt-44와 같은 이유, 아트 밴드 높이에 맞춰 한 단계 작은 값). */}
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <PubgPageHeader
            title={
              <>
                <span className="text-accent">42.3 ⇒ 43.1</span> · 무기 획득 점유율
              </>
            }
            lead={
              <>
                43.1 패치노트가 말한 무기 변경을 실제 매치의 획득 점유율로 대조합니다. 공지에 없는데 움직인
                무기는 <strong className="text-fg">미공지</strong>로 따로 모읍니다.
              </>
            }
          />

          {/* 판정 요약 3타일 — 시안 `.stat-row`/`.stat-tile`. 숫자 정의는 PUBG 데이터 기준이다. */}
          <section className={`${panelSurfaceClass("glass")} grid grid-cols-3 overflow-hidden rounded-lg`}>
            <div className="border-r border-border-soft p-5">
              <strong className="block font-display text-3xl font-bold tabular-nums text-fg">{notes.length}</strong>
              <span className="mt-1 block text-xs text-muted">공지된 변화 (43.1 패치노트)</span>
            </div>
            <div className="border-r border-border-soft p-5">
              <strong className="block font-display text-3xl font-bold tabular-nums text-fg">{reportable.length}</strong>
              <span className="mt-1 block text-xs text-muted">유의 변화</span>
            </div>
            <div className="p-5">
              <strong className="block font-display text-3xl font-bold tabular-nums text-accent">{unannounced.length}</strong>
              <span className="mt-1 block text-xs text-muted">미공지</span>
            </div>
          </section>

          {/* 공지 대조가 기본 탭, 미공지가 두 번째 탭(2026-09-17 사용자 지시 — 홈과 같은 순서). */}
          <PubgBriefingTabs
            contentCount={announced.length}
            gapCount={unannounced.length}
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
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm" style={{ minWidth: "var(--table-min)" }}>
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pl-5 pr-3 font-mono text-xs font-bold text-muted">무기</th>
                        <th className="py-2 pr-3 font-mono text-xs font-bold text-muted">공지</th>
                        <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">관측</th>
                        <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">95% CI</th>
                        <th className="py-2 pr-5 font-mono text-xs font-bold text-muted">판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {announced.map((row) => {
                        const note = notes.find((item) => item.id === row.matchedNoteId);
                        return (
                          <tr key={row.id} className="border-b border-border-soft">
                            <td className="py-3 pl-5 pr-3 font-display font-bold">
                              <Link href={weaponHref(row.weaponKey)} className="text-fg underline-offset-4 hover:text-accent hover:underline">
                                {row.weaponName} →
                              </Link>
                            </td>
                            <td className="py-3 pr-3 text-fg-2">
                              {note?.expectedRelChange !== null && note?.expectedRelChange !== undefined
                                ? signedPct(note.expectedRelChange, 0)
                                : "—"}
                              <span className="ml-2 text-xs text-muted">{note?.stat}</span>
                            </td>
                            <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-fg">
                              {signedPct(row.relChange ?? 0)}
                            </td>
                            <td className="py-3 pr-3 text-right font-mono text-xs tabular-nums text-muted">
                              [{signedPct(row.relCi[0])}, {signedPct(row.relCi[1])}]
                            </td>
                            <td className="py-3 pr-5">
                              <StatusBadge status={displayStatusOf(row.status)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {noteSource ? (
                  <div className="border-t border-border-soft px-5 py-3">
                    <a className="text-sm font-bold text-accent hover:underline" href={noteSource} target="_blank" rel="noreferrer">
                      패치노트 원문 보기 ↗
                    </a>
                  </div>
                ) : null}
              </SectionCard>
            }
            gap={
              <SectionCard
                eyebrow="발견"
                title="공지에 없는데 움직였다"
                variant="glass"
                action={<span className="font-mono text-xs text-muted">{unannounced.length}건</span>}
              >
                {unannounced.length === 0 ? (
                  <p className="p-5 text-sm text-muted">바닥을 넘는 미공지 변화가 없습니다.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border-soft">
                    {unannounced.map((row) => (
                      <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                        <StatusBadge status={displayStatusOf(row.status)} />
                        <Link
                          href={weaponHref(row.weaponKey)}
                          className="font-display font-bold text-fg underline-offset-4 hover:text-accent hover:underline"
                        >
                          {row.weaponName} →
                        </Link>
                        <span
                          className={`font-mono text-lg font-bold tabular-nums ${
                            (row.relChange ?? 0) > 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {signedPct(row.relChange ?? 0)}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          95% CI [{signedPct(row.relCi[0])}, {signedPct(row.relCi[1])}] · n=
                          {row.n.before.toLocaleString()}→{row.n.after.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            }
          />

          {/* 무기 상세 진입점(P1) — 전 무기. 판정된 것만 링크가 있던 표와 달리 여기서는 47종 전부 상세로 간다. */}
          <SectionCard
            eyebrow="상세"
            title="무기별 상세"
            variant="glass"
            action={<span className="font-mono text-xs text-muted">{after.weapons.length}종 · 43.1 점유율순</span>}
          >
            <PubgWeaponGrid weapons={after.weapons} rows={deltas.rows} assetKeys={weaponAssets} />
          </SectionCard>

          {/* 맵 — 43.1 패치노트에 맵 항목이 0건이라 판정은 없고 관측값만. 카드가 곧 맵 상세 진입점이다. */}
          {maps ? (
            <SectionCard
              eyebrow="맵"
              title="어디서 얼마나 싸웠나"
              variant="glass"
              action={<span className="font-mono text-xs text-muted">{maps.after.maps.length}종</span>}
            >
              <ul className="grid gap-px bg-border-soft sm:grid-cols-2 lg:grid-cols-4">
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
            </SectionCard>
          ) : null}

          <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
        </div>
      </Container>
    </main>
  );
}
