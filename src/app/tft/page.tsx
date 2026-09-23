// src/app/tft/page.tsx
// TFT 브리핑 홈. LoL·PUBG 홈과 **같은 정보 우선순위**를 따른다:
//   1. 결과(판정 요약 3타일) 먼저 — 설명 카드는 아래로(라운드4 A3 지적과 같은 규칙)
//   2. 미공지가 강조 색(accent), 나머지는 중립
//   3. 표에 올릴 자격은 `isReportableRecord` 하나가 정한다 — 표본부족·바닥 미달은 안 올라간다
//   4. 모든 판정문은 원천 링크를 갖는다. 없으면 회색으로 떨어뜨리고 링크를 걸지 않는다
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import SubmarineSection from "@/components/gamedata/SubmarineSection";
import { gameDataEntityCount, loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";
import {
  TftFooter,
  TftSampleNotice,
  TftUnavailable,
  deltaDisplay,
  formatMetricValue,
} from "@/components/tft/shared";
import { selectTftCauseRows } from "@/components/tft/causeRows";
import { tftEntityHref } from "@/lib/tftRoutes";
import { tftEntityRows } from "@/components/tft/entityRows";
import { entityTypeLabel, metricLabel } from "@/lib/format";
import { loadTft, loadTftAssets } from "@/lib/tftData";
import { displayStatusOf } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/pipeline/shared/reportable";
import { STATUS_SORT_PRIORITY } from "@/pipeline/shared/status-order";
import type { DeltaRecord } from "@/pipeline/types";
import { PANEL_SCROLL_BODY } from "@/lib/panelScroll";
import StatTiles from "@/components/StatTiles";
import DiscordPanel from "@/components/home/DiscordPanel";
import BriefingTabs from "@/components/BriefingTabs";
import BriefingRowList from "@/components/BriefingRowList";
import AnnouncedCoverageLine from "@/components/home/AnnouncedCoverageLine";
import EntityIcon from "@/components/EntityIcon";
import EntityIndexSection, { EntityIndexGrid } from "@/components/EntityIndexSection";
import { buildEntityIndex } from "@/components/home/entityIndex";
import { groupBriefingItems, type BriefingGroup } from "@/components/briefingRows";

export const metadata = { title: "전략적 팀 전투 — patchgap" };

/** 자산이 실재하는 키 집합 — 매니페스트가 없으면 전부 폴백으로 떨어진다(요청을 만들지 않는다). */
function assetKeySet(manifest: ReturnType<typeof loadTftAssets>): Set<string> {
  if (!manifest) return new Set();
  return new Set(
    (["unit", "trait", "item"] as const).flatMap((kind) =>
      manifest.assets[kind].map((key) => `${kind}:${key}`)
    )
  );
}

/**
 * 색인 격자의 아이콘 — 키는 `unit:DA_18_Rakan` 형태라 **뒷조각만** 자산 파일명이다.
 * 컴포넌트를 돌려주지 않고 엘리먼트를 돌려준다(그래야 익명 컴포넌트 정의가 되지 않는다).
 */
function indexIcon(type: DeltaRecord["entityType"], have: ReadonlySet<string>) {
  const render = (item: { key: string; name: string }) => (
    <EntityIcon
      game="tft"
      entityType={type}
      entityKey={item.key.slice(item.key.indexOf(":") + 1)}
      name={item.name}
      size={40}
      assetMissing={!have.has(item.key)}
    />
  );
  return render;
}

/**
 * 본문 행의 아이콘 — LoL 카드에는 있고 TFT 행에는 **없었다**(자산 배선이 빠져 있었다,
 * §8-7 말미 자기모순). `scripts/run-tft-assets.ts`가 조달한 `public/dd/tft/`를 본다.
 */
function tftRowIcon(have: ReadonlySet<string>) {
  const render = (group: BriefingGroup) => (
    <EntityIcon
      game="tft"
      entityType={group.entityType as DeltaRecord["entityType"]}
      entityKey={group.entityKey}
      name={group.entityName}
      size={32}
      assetMissing={!have.has(`${group.entityType}:${group.entityKey}`)}
    />
  );
  return render;
}

/** 상위 N건 — LoL 홈과 같은 정렬(상태 우선순위 → 효과크기). */
function topRows(rows: DeltaRecord[], limit: number): DeltaRecord[] {
  return [...rows]
    .sort(
      (a, z) =>
        STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[z.status] ||
        Math.abs(z.delta ?? 0) - Math.abs(a.delta ?? 0)
    )
    .slice(0, limit);
}

/**
 * 델타 목록 → **대상 단위 그룹**(UX-BRIEF §8-2). 표를 버리고 공용 행을 쓴다 —
 * 전에는 한 유닛이 지표 수만큼 행으로 흩어졌고, 판정 뱃지가 맨 뒤 열이었으며, 이름에 링크가
 * 없었다(2026-09-23 acceptance-critic V1·V2·V3). 셋 다 §8-1·§8-2 위반이다.
 */
function briefingGroups(rows: DeltaRecord[]): BriefingGroup[] {
  return groupBriefingItems(
    rows.map((row) => {
      const d = deltaDisplay(row.metric, row.delta ?? 0);
      return {
        id: row.id,
        entityKey: row.entityKey,
        entityName: row.entityName,
        entityType: row.entityType,
        typeLabel: entityTypeLabel(row.entityType),
        status: displayStatusOf(row.status),
        field: metricLabel(row.metric),
        change: `${formatMetricValue(row.metric, row.before ?? 0)} → ${formatMetricValue(row.metric, row.after ?? 0)}`,
        delta: { text: d.text, improved: d.improved },
        noteAnchor: row.evidence.noteAnchor ?? null,
      };
    })
  );
}

export default function TftPage() {
  const bundle = loadTft();
  if (!bundle) {
    return (
      <main>
        <Container>
          <TftUnavailable />
        </Container>
      </main>
    );
  }

  const { deltas, before, after, notes } = bundle;
  // 수치 축(F9) — 산출물이 없으면 섹션이 통째로 빠진다.
  const submarine = summarizeGameData(loadGameDataDiff("tft", deltas.meta.from, deltas.meta.to));
  const reportable = deltas.rows.filter((row) => isReportableRecord(row, deltas.meta.qAlpha));
  const unannounced = reportable.filter((row) => displayStatusOf(row.status) === "unannounced");
  const announced = reportable.filter((row) => displayStatusOf(row.status) !== "unannounced");
  const matches = before.matches + after.matches;
  // 시안 04-applied의 헤드라인 — 이 사이트가 무엇을 하는 곳인지 한 문장으로 말한다.
  // 숫자는 아래 3타일과 **같은 출처**를 쓴다(따로 세면 화면이 스스로를 반박한다).
  const noteEntities = new Set(notes.items.map((n) => n.entity)).size;

  // 전 대상 색인(§8-1) — 이 패치 보드 집계에 등장한 **모든** 유닛·특성·아이템.
  // 이름은 판정 산출물이 이미 들고 있다(실측 233종 중 232종). 못 찾는 1종은 키를 그대로 쓴다.
  const haveAssets = assetKeySet(loadTftAssets());
  const rowIcon = tftRowIcon(haveAssets);
  const nameByKey = new Map(deltas.rows.map((row) => [`${row.entityType}:${row.entityKey}`, row.entityName]));
  // 상세 자격은 **라우트가 실제로 만드는 집합**과 같아야 한다 — 대조표 행 생성기(`tftEntityRows`)가
  // 그 단일 소스다(2026-09-21에 이 둘이 갈려 링크 21건이 404였다).
  const detailKeys = new Set(
    tftEntityRows(deltas, loadGameDataDiff("tft", deltas.meta.from, deltas.meta.to)?.changes ?? []).map(
      (row) => row.key
    )
  );
  const indexOf = (type: string, stats: readonly { key: string }[]) =>
    buildEntityIndex(
      stats.map((stat) => ({
        type,
        key: stat.key,
        name: nameByKey.get(`${type}:${stat.key}`) ?? stat.key,
      })),
      (t, key) => detailKeys.has(`${t}:${key}`),
      (t, key) => tftEntityHref(`${t}:${key}`)
    );
  const unitIndex = indexOf("unit", after.units);
  const traitIndex = indexOf("trait", after.traits);
  const tftItemIndex = indexOf("item", after.items);
  // 대조표와 **같은 자격·같은 정렬**로 고른 원인 목록(components/tft/causeRows.ts).
  // 원인은 행 안에서 말한다(§8-2) — 상위 N 제한 없이 델타 id로 찾을 수 있게 색인한다.
  const causeById = new Map(
    selectTftCauseRows(deltas.rows, deltas.meta.qAlpha, deltas.rows.length).map((r) => [r.record.id, r] as const)
  );
  const notesById = new Map(notes.items.map((n) => [n.id, n] as const));
  /**
   * 델타 id → 원인 한 줄. 없으면 `null`이고 그 줄은 **그려지지 않는다** — 빈 줄이 원인인 척하지
   * 않게 한다(`selectTftCauseRows`가 이미 미검토·후보 없음을 걸러 놨다).
   */
  const causeLine = (itemId: string) => {
    const row = causeById.get(itemId);
    if (!row) return null;
    const top = row.causes[0] ?? null;
    const text = row.summary ?? top?.text ?? null;
    if (!text) return null;
    const note = top?.candidateNoteId ? notesById.get(top.candidateNoteId) : undefined;
    return {
      text,
      verified: row.summaryVerified,
      href: top?.verified && note ? note.anchorUrl : null,
    };
  };

  return (
    <main>
      <Container>
        {/* pt-40 — 키아트 밴드 상단을 글자로 덮지 않는다(PUBG 홈과 같은 값). */}
        <div className="flex flex-col gap-6 pt-40 pb-8">
          {/* 히어로 = 문장 1줄 + 캡션(§8-1). 전에는 문장 아래 **페이지 헤더 카드가 한 장 더**
              있어 h1이 둘로 갈렸다(LoL은 문장이 곧 h1이다). 카드가 들던 제목·표본은 캡션 한 줄로
              흡수한다 — 같은 값을 잃지 않으면서 첫 화면의 블록 수를 세 게임이 맞춘다. */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">
              패치노트가 말한 것 vs 통계가 말하는 것
            </span>
            <h1 className="max-w-3xl font-display text-2xl leading-snug font-bold text-fg sm:text-3xl">
              패치노트는 <span className="text-accent">{noteEntities}개 엔티티</span>를 말했고, 통계는{" "}
              <span className="text-accent">{reportable.length}개 변화</span>를 말합니다
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
              <strong className="text-fg">유닛 · 특성 · 아이템</strong> · KR · Master+ <strong className="text-fg">{before.matches.toLocaleString()}</strong> →{" "}
              <strong className="text-fg">{after.matches.toLocaleString()}</strong>매치 · 엔티티{" "}
              <strong className="text-fg">{after.units.length + after.traits.length + after.items.length}</strong>종
            </p>
          </div>

          {/* 3타일은 세 게임 공통 컴포넌트가 그린다(UX-BRIEF §8-1) — 라벨·부제·클릭 대상이
              게임마다 달랐다. TFT 대조표는 아직 상태 칩이 없어 앵커 없이 보낸다. */}
          <StatTiles
            announcedCount={notes.items.length}
            patch={deltas.meta.to}
            significantCount={reportable.length}
            gapCount={unannounced.length}
            game="tft"
          />

          {/* 「패치 내용 / 미공지 Gap」 탭(2026-09-21 신설) — LoL·PUBG에 이미 있던 것을 TFT에도.
              미공지 Gap 안은 **두 갈래**다: 위가 수치 축(게임사가 무엇을 바꿨나 — 증거 A),
              아래가 지표 축(패치노트에 없는데 움직였나 — 증거 B). 위계의 근거는 중요도가 아니라
              증거 등급이다(통계가 "움직였다"고 말하는 것과 게임사 파일이 "바꿨다"고 말하는 것). */}
          {/* 2컬럼 골격 — 좌 본문 / 우 사이드(UX-BRIEF §8-1, A안). LoL의 `StreamColumnLayout`을
              쓰지 않는 이유: 그쪽은 좌측 높이를 우측에 맞춰 고정하고 좌측 안에서 스크롤시키는
              장치인데, TFT 본문은 이미 `PANEL_SCROLL_BODY`로 제 높이를 갖는다. 두 장치를 겹치면
              카드가 잘린다 — **같은 골격을 쓰되 높이 결합은 하지 않는다**. */}
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
                  <div className={PANEL_SCROLL_BODY}>
                  <BriefingRowList
                    groups={briefingGroups(topRows(announced, 15))}
                    hrefOf={(g) => tftEntityHref(`${g.entityType}:${g.entityKey}`)}
                    iconOf={rowIcon}
                    causeOf={causeLine}
                    emptyText="공지와 짝지어진 유의한 관측이 없습니다."
                  />
                </div>
                {/* 세 게임이 같은 자리에서 같은 말을 한다(§8-1, 2026-09-23 화면 대조 V5). */}
                <AnnouncedCoverageLine
                  noteTargets={noteEntities}
                  observed={new Set(announced.map((r) => `${r.entityType}:${r.entityKey}`)).size}
                />
                </SectionCard>
              }
              gap={
                <div className="flex flex-col gap-6">
                  {/* 수치 축 — 산출물이 없으면 통째로 빠진다(없는 것을 있는 척하지 않는다). */}
                  {submarine ? (
                    <SubmarineSection
                      summary={submarine}
                      hrefOf={(change) => tftEntityHref(`${change.entityType}:${change.entityKey}`)}
                    />
                  ) : null}

                  <SectionCard
                    eyebrow="발견 · 지표 축"
                    title="패치노트에 없는데 움직인 것"
                    variant="glass"
                    action={<span className="font-mono text-xs text-muted">{unannounced.length}건</span>}
                  >
                    <div className={PANEL_SCROLL_BODY}>
                    <BriefingRowList
                      groups={briefingGroups(topRows(unannounced, 15))}
                      hrefOf={(g) => tftEntityHref(`${g.entityType}:${g.entityKey}`)}
                      iconOf={rowIcon}
                      causeOf={causeLine}
                      emptyText="미공지 변화가 없습니다."
                    />
                  </div>
                  </SectionCard>
                </div>
              }
            />
            </div>
            <div className="flex flex-col gap-6">
              {/* 사이드는 그 게임이 가진 것만 — TFT는 지금 디스코드뿐이고, 없는 패널을 만들어
                  채우지 않는다(§8-1). 표본은 화면 하단 캡션이 이미 말한다. */}
              <DiscordPanel game="tft" generatedAt={deltas.meta.generatedAt} />
            </div>
          </div>

          {/* 원인은 **그 대상의 행 안에서** 말한다(UX-BRIEF §8-2) — 하단 별도 카드
              「왜 그랬을까 — LLM이 짚은 원인」은 폐지했다. 목적(사용자 2026-09-20 지시)은
              그대로고 자리만 옮긴 것이다: 표가 이름을 부른 뒤 화면 맨 아래 딴 카드가 같은
              이름을 다시 부르면, 읽는 쪽이 두 곳을 오가며 짝을 맞춰야 한다. */}

          {/* 전 대상 색인(§8-1) — 대조표는 판정이 선 것만 올리므로 전수 진입점은 여기뿐이다. */}
          <EntityIndexSection
            groups={[
              { label: "유닛", total: unitIndex.length, body: <EntityIndexGrid items={unitIndex} iconOf={indexIcon("unit", haveAssets)} /> },
              { label: "특성", total: traitIndex.length, body: <EntityIndexGrid items={traitIndex} iconOf={indexIcon("trait", haveAssets)} /> },
              { label: "아이템", total: tftItemIndex.length, body: <EntityIndexGrid items={tftItemIndex} iconOf={indexIcon("item", haveAssets)} /> },
            ]}
          />

          <TftSampleNotice boards={before.boards + after.boards} matches={matches} />
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
