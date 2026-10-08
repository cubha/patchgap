// src/components/tft/TftBriefing.tsx
// TFT 브리핑 본문(2026-09-28 이월 R8 — `app/tft/page.tsx`에서 옮겼다: 최신 쌍 `/tft/`와 과거 쌍
// `/tft/history/[pair]/`가 같은 본문을 쓴다. 로드는 라우트가 하고 여기는 번들을 받는다 — 과거 쌍이면 `pairBase`로
// 대상 링크·미공지 타일이 그 쌍의 상세·대조표에 머문다). TFT 브리핑 홈. LoL·PUBG 홈과 **같은 정보 우선순위**를 따른다:
//   1. 결과(판정 요약 3타일) 먼저 — 설명 카드는 아래로(라운드4 A3 지적과 같은 규칙)
//   2. 미공지가 강조 색(accent), 나머지는 중립
//   3. 표에 올릴 자격은 `isReportableRecord` 하나가 정한다 — 표본부족·바닥 미달은 안 올라간다
//   4. 모든 판정문은 원천 링크를 갖는다. 없으면 회색으로 떨어뜨리고 링크를 걸지 않는다
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import SubmarineSection from "@/components/gamedata/SubmarineSection";
import { loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";
import {
  TftFooter,
  TftSampleNotice,
  TftUnavailable,
  deltaDisplay,
  formatMetricValue,
} from "@/components/tft/shared";
import { selectTftCauseRows } from "@/components/tft/causeRows";
import { tftEntityHref } from "@/lib/tftRoutes";
import { tftEntityRows } from "@/lib/tftEntityRows";
import { entityTypeLabel, metricLabel } from "@/lib/format";
import { tftGapTotal, tftMetricGapRows } from "@/lib/gapTotals";
import { loadTftAssets, type TftBundle, type TftDeclaration } from "@/lib/tftData";
import DeclarationOnly from "@/components/DeclarationOnly";
import { displayStatus } from "@/pipeline/shared/display-status";
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
import { countAnnouncedObservedEntities, verdictCount } from "@/pipeline/shared/headline";

export interface TftBriefingProps {
  /** 그 쌍의 관측 번들. 없으면(관측 stub·미수집) `declaration`을 본다. */
  bundle: TftBundle | null;
  /** 관측 stub 쌍의 선언 축(C13·C14). */
  declaration: TftDeclaration | null;
  /** 과거 쌍 화면이면 그 기준 경로(`/tft/history/{쌍}`). */
  pairBase?: string | null;
}

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
function briefingGroups(rows: DeltaRecord[], qAlpha?: number): BriefingGroup[] {
  return groupBriefingItems(
    rows.map((row) => {
      const d = deltaDisplay(row.metric, row.delta ?? 0);
      return {
        id: row.id,
        entityKey: row.entityKey,
        entityName: row.entityName,
        entityType: row.entityType,
        typeLabel: entityTypeLabel(row.entityType),
        status: displayStatus(row, qAlpha),
        field: metricLabel(row.metric),
        change: `${formatMetricValue(row.metric, row.before ?? 0)} → ${formatMetricValue(row.metric, row.after ?? 0)}`,
        delta: { text: d.text, improved: d.improved },
        noteAnchor: row.evidence.noteAnchor ?? null,
      };
    })
  );
}

export default function TftBriefing({ bundle, declaration, pairBase = null }: TftBriefingProps) {
  if (!bundle) {
    // 그 쌍이 관측 stub이면 선언 축(노트 + 수치 축)만 그린다(C13·C14) — 새 노트가 관측을 기다리며 숨지 않게.
    if (declaration) return <TftDeclarationView declaration={declaration} />;
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
  // 대조표(`entityRows`)와 **같은 함수**로 표시 키를 낸다 — 상태값만 보는 `displayStatusOf`는 방향 중립
  // (동률 노트)을 모르므로, 같은 대상이 홈에선 「이상 관측」, 대조표에선 「공지」로 갈렸다(인수검증 V1, 오른).
  // 지표 축 목록은 수치 축 대상을 뺀다(ST-10) — 한 대상은 한 섹션에만, 머리 수는 대조표 미공지 칩과 같은 대상 수.
  const unannounced = tftMetricGapRows(deltas.rows, deltas.meta.qAlpha, submarine);
  const unannouncedEntities = new Set(unannounced.map((r) => `${r.entityType}:${r.entityKey}`)).size;
  const announced = reportable.filter((row) => displayStatus(row, deltas.meta.qAlpha) !== "unannounced");
  const matches = before.matches + after.matches;
  // 시안 04-applied의 헤드라인 — 이 사이트가 무엇을 하는 곳인지 한 문장으로 말한다.
  // 숫자는 아래 3타일과 **같은 출처**를 쓴다(따로 세면 화면이 스스로를 반박한다).
  const noteEntities = new Set(notes.items.map((n) => n.entity)).size;
  // 「미공지 Gap」은 대상을 센다 — 타일은 통계 Gap 대상, 탭은 거기에 수치 축 대상을 **합집합**으로(C15·D2).
  const gapTotal = tftGapTotal(deltas.rows, deltas.meta.qAlpha, submarine);

  // 상세 바로가기(§8-1) — 이 패치 보드 집계에 등장한 유닛·특성·아이템 중 **상세가 있는 것**(buildEntityIndex가 거른다).
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
      (t, key) => tftEntityHref(`${t}:${key}`, pairBase)
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
              패치노트는 <span className="text-accent">{noteEntities}개 항목</span>을 말했고, 통계는{" "}
              <span className="text-accent">{reportable.length}개 변화</span>를 말합니다
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-2 wrap-anywhere">
              <strong className="text-fg">유닛 · 특성 · 아이템</strong> · KR · Master+ <strong className="text-fg">{before.matches.toLocaleString()}</strong> →{" "}
              <strong className="text-fg">{after.matches.toLocaleString()}</strong>매치 · 대상{" "}
              <strong className="text-fg">{after.units.length + after.traits.length + after.items.length}</strong>종
            </p>
          </div>

          {/* 3타일은 세 게임 공통 컴포넌트가 그린다(UX-BRIEF §8-1) — 라벨·부제·클릭 대상이
              게임마다 달랐다. TFT 대조표는 아직 상태 칩이 없어 앵커 없이 보낸다. */}
          <StatTiles
            announcedCount={noteEntities}
            patch={deltas.meta.to}
            itemCount={notes.items.length}
            significantCount={reportable.length}
            // 대상 수(C15, 사용자 확정 7)이자 탭 배지와 같은 합집합(D2, 2026-09-28).
            gapCount={gapTotal}
            game="tft"
            pairBase={pairBase}
          />

          {/* 「패치 내용 / 미공지 Gap」 탭(2026-09-21 신설) — LoL·PUBG에 이미 있던 것을 TFT에도.
              미공지 Gap 안은 **두 갈래**다: 위가 수치 축(게임사가 무엇을 바꿨나 — 증거 A),
              아래가 지표 축(패치노트에 없는데 움직였나 — 증거 B). 위계의 근거는 중요도가 아니라
              증거 등급이다(통계가 "움직였다"고 말하는 것과 게임사 파일이 "바꿨다"고 말하는 것). */}
          {/* 2컬럼 골격 — 좌 본문 / 우 사이드(UX-BRIEF §8-1, A안). LoL의 `StreamColumnLayout`을
              쓰지 않는 이유: 그쪽은 좌측 높이를 우측에 맞춰 고정하고 좌측 안에서 스크롤시키는
              장치인데, TFT 본문은 이미 `PANEL_SCROLL_BODY`로 제 높이를 갖는다. 두 장치를 겹치면
              카드가 잘린다 — **같은 골격을 쓰되 높이 결합은 하지 않는다**. */}
          {/* 2컬럼 골격의 소유자는 `BriefingTabs`다(§8-1 A안). 페이지가 그리드를 만들면
              우측 패널이 좌측 **탭 바** 상단에 맞아 카드끼리 어긋난다 — 그 배치는 탭 바
              위치를 아는 쪽만 정할 수 있다(2026-09-24). */}
          <BriefingTabs
              contentCount={announced.length}
              gapCount={gapTotal}
              content={
                <SectionCard
                  eyebrow="대조"
                  title="공지된 변경은 실제로 그렇게 됐나"
                  variant="embedded"
                  action={<span className="font-mono text-xs text-muted">{announced.length}건</span>}
                >
                  <div className={PANEL_SCROLL_BODY}>
                  <BriefingRowList
                    groups={briefingGroups(topRows(announced, 15), deltas.meta.qAlpha)}
                    hrefOf={(g) => tftEntityHref(`${g.entityType}:${g.entityKey}`, pairBase)}
                    iconOf={rowIcon}
                    causeOf={causeLine}
                    emptyText="공지와 짝지어진 유의한 관측이 없습니다."
                  />
                </div>
                {/* 세 게임이 같은 자리에서 같은 말을 한다(§8-1, 2026-09-23 화면 대조 V5). */}
                <AnnouncedCoverageLine
                  noteTargets={noteEntities}
                  /* 세 게임이 같은 함수로 센다(ST-06) — 전에는 표시 상태로 걸러 간접 영향 행까지 공지로 셌다. */
                  observed={countAnnouncedObservedEntities(deltas.rows, deltas.meta.qAlpha)}
                />
                </SectionCard>
              }
              gap={
                <div>
                  {/* 수치 축 — 산출물이 없으면 통째로 빠진다(없는 것을 있는 척하지 않는다). 탭 카드 안에서
                      LoL 스트림과 같은 자리(위쪽 갈래, p-5 + 아래 테두리)에 선다(B2). */}
                  {submarine ? (
                    <div className="border-b border-border-soft p-5">
                      <SubmarineSection
                        summary={submarine}
                        hrefOf={(change) => tftEntityHref(`${change.entityType}:${change.entityKey}`, pairBase)}
                      />
                    </div>
                  ) : null}

                  <SectionCard
                    eyebrow="발견 · 지표 축"
                    title="패치노트에 없는데 움직인 것"
                    variant="embedded"
                    action={<span className="font-mono text-xs text-muted">대상 {unannouncedEntities}종</span>}
                  >
                    <div className={PANEL_SCROLL_BODY}>
                    <BriefingRowList
                      groups={briefingGroups(topRows(unannounced, 15), deltas.meta.qAlpha)}
                      hrefOf={(g) => tftEntityHref(`${g.entityType}:${g.entityKey}`, pairBase)}
                      iconOf={rowIcon}
                      causeOf={causeLine}
                      emptyText="미공지 변화가 없습니다."
                    />
                  </div>
                  </SectionCard>
                </div>
              }
            aside={
              /* 사이드는 그 게임이 가진 것만 — TFT는 지금 디스코드뿐이고, 없는 패널을 만들어
                 채우지 않는다(§8-1). 표본은 화면 하단 캡션이 이미 말한다. */
              <DiscordPanel game="tft" generatedAt={deltas.meta.generatedAt} />
            }
          />

          {/* 원인은 **그 대상의 행 안에서** 말한다(UX-BRIEF §8-2) — 하단 별도 카드
              「왜 그랬을까 — LLM이 짚은 원인」은 폐지했다. 목적(사용자 2026-09-20 지시)은
              그대로고 자리만 옮긴 것이다: 표가 이름을 부른 뒤 화면 맨 아래 딴 카드가 같은
              이름을 다시 부르면, 읽는 쪽이 두 곳을 오가며 짝을 맞춰야 한다. */}

          {/* 상세 바로가기(§8-1) — 상세가 있는 유닛·특성·아이템만 아이콘 격자로(2026-09-29, 「판정 없음」 칸 제거). */}
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
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={verdictCount(deltas.rows, deltas.meta.qAlpha)} />
    </main>
  );
}

/**
 * 선언 축만 있는 쌍(C13·C14)의 홈 — 노트와 수치 축(F9)만, 관측 영역은 회색 사유. 기본 내보내기 **아래**에
 * 두는 이유: 화면 동등성 테스트가 첫 `return (`부터의 JSX 순서를 본다(본 브리핑의 블록 순서 계약).
 */
function TftDeclarationView({ declaration }: { declaration: TftDeclaration }) {
  const submarine = summarizeGameData(loadGameDataDiff("tft", declaration.from, declaration.to));
  return (
    <main>
      <Container>
        <DeclarationOnly
          from={declaration.from}
          to={declaration.to}
          failure={declaration.failure}
          notes={declaration.notes.items.map((n) => ({ id: n.id, group: n.entity, summary: n.summary, anchorUrl: n.anchorUrl }))}
          // 관측 없는 쌍엔 상세 라우트가 없다 — 링크 없이 이름만 그린다.
          extra={submarine ? <SubmarineSection summary={submarine} hrefOf={() => null} /> : null}
        />
        <TftFooter generatedAt={declaration.generatedAt} nVerdicts={0} />
      </Container>
    </main>
  );
}
