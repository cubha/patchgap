// src/components/compare/DeltaTable.tsx
// 우 델타 테이블(2/3) — 프로토타입 `table.delta-table`(docs/design/prototype/02-comparison-table.html)의
// 골격을 유지하되, 2026-09-18 라운드6(사용자 L3·L4·C1)부터 **행 = 엔티티**다.
//
// 이전엔 `DeltaRecord` 1건 = 1행이라 같은 챔피언이 지표·라인별로 최대 13번 반복됐고 "지표"·"26.17"·
// "26.18" 열이 따로 있었다. 사용자: "델타테이블 Label에 버전 Mig 표시하고, 지표 및 버전 col 제거 →
// 밴률 / 승률 / 픽률 / 채택률을 인라인으로 표시. 상승 하락 기호까지 cell 데이터에 함께 표시".
// 조립(`buildEntityRows`)은 entityRows.ts가 하고 여기선 그린다 — 셀에는 `전 → 후`와 `▲/▼ Δ`만.
// 보고 가능하지 않은 지표는 빈 셀(`—`)이다. 라인 골드·오브젝트·매치 평균 행은 표에 없다.
//
// **스크롤 포커스(L4)**: 좌 내비에서 엔티티를 고르면 `focusKey`가 바뀌고, 그 행을 640px 내부 스크롤
// 컨테이너의 **최상단**(sticky 헤더 바로 아래)으로 옮긴 뒤 `.row-highlight`로 강조한다.
// `scrollIntoView`를 쓰지 않는 이유: 문서 스크롤까지 같이 움직여 페이지가 튄다 — 컨테이너의
// scrollTop만 계산한다.
//
// 2026-09-12(4차, R5): 본문을 640px 내부 스크롤(NoteNavigator.tsx의 `.note-item-list` 규약과
// 동일값)로 감쌌다 — 이전엔 rows(최대 200행)가 전부 펼쳐져 페이지 전체가 13,000px 넘게 길어졌다.
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { DeltaRecord } from "@/pipeline/types";
import { PANEL_SPLIT_BODY } from "@/lib/panelScroll";
import type { LaneAxis } from "@/lib/lane";
import { itemHref, metricLabel, positionLabel } from "@/lib/format";
import EntityIcon from "@/components/EntityIcon";
import LaneGlyph from "@/components/LaneGlyph";
import StatusBadge from "@/components/StatusBadge";
import SubmarineCell from "@/components/gamedata/SubmarineCell";
import { formatMetricValue, metricKind } from "@/components/home/logic";
import { fmtPp } from "@/lib/format";
import { ENTITY_METRICS, type EntityCell, type EntityCompareRow, type EntityMetric } from "./entityRows";

export interface DeltaTableProps {
  pair: { from: string; to: string } | null;
  rows: EntityCompareRow[];
  /** 강조·스크롤 포커스 대상 행의 key(`champion:Ekko`). null이면 없음. */
  focusKey: string | null;
}

/**
 * 관측 1건 — `[축] 전 → 후` + `▲/▼ Δ`. 색은 DeltaValue 관례.
 *
 * **축 라벨은 늘 붙는다**(2026-09-20 사용자 지적). 전에는 라인 행일 때만 작은 글리프를 달아서
 * "표기 없음 = 전체"라는 암묵 규칙이 있었고, 그래서 전체 수치와 라인 한정 수치가 같은 종류의
 * 숫자로 읽혔다. 라인 필터가 걸려 있을 때만 라벨을 뗀다 — 그때는 필터 칩이 이미 축을 말한다.
 */
function Observation({
  record,
  lane,
  labelled,
}: {
  record: DeltaRecord;
  lane: LaneAxis | null;
  labelled: boolean;
}) {
  const delta = record.delta ?? 0;
  const up = delta > 0;
  const kind = metricKind(record.metric);
  // 이 표의 4개 지표는 전부 비율(pp)이다 — 다른 kind가 오면 formatMetricValue가 단위를 안다.
  const deltaText = kind === "pp" ? fmtPp(delta) : String(delta);
  return (
    <Link
      href={itemHref(record.id)}
      className="group/cell flex flex-col gap-0.5 rounded-sm px-1 py-0.5 hover:bg-accent/10"
      aria-label={`${record.entityName} ${lane && lane !== "all" ? `${positionLabel(lane)} ` : ""}${metricLabel(record.metric)} 상세`}
    >
      {/* 값 쌍은 접히면 안 된다 — 좁은 열에서 "57.1% →/45.5%"로 쪼개지면 한 관측이 둘로 보인다. */}
      <span className="whitespace-nowrap text-xs text-muted">
        {formatMetricValue(record.before, record.metric)} → {formatMetricValue(record.after, record.metric)}
      </span>
      {/* 축 라벨은 **Δ 줄**에 붙인다 — 값 쌍 줄에 붙이면 폭을 두 배로 먹어 열이 무너진다(실측). */}
      <span className="flex items-center gap-1 whitespace-nowrap">
        {labelled ? (
          lane === "all" ? (
            <span className="font-body text-xs text-muted">전체</span>
          ) : (
            <span className="flex items-center gap-1 font-body text-xs text-muted">
              <LaneGlyph lane={lane!} size={11} labelled />
              {positionLabel(lane!)}
            </span>
          )
        ) : null}
        <span className={`font-bold ${up ? "text-success" : "text-danger"}`}>
          {up ? "▲" : "▼"} {deltaText}
        </span>
      </span>
    </Link>
  );
}

/** 지표 셀 — 전체 관측과 라인 한정 관측을 **접지 않고** 축 순서대로 쌓는다. */
function MetricCell({ cell, labelled }: { cell: EntityCell; labelled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {cell.overall ? (
        <Observation record={cell.overall} lane="all" labelled={labelled} />
      ) : labelled && cell.lane ? (
        // 라인 한정 관측만 있는 칸 — 전체가 왜 비었는지 말한다(빈 셀의 `—`와 같은 어휘).
        <span className="px-1 font-body text-xs text-muted">전체 —</span>
      ) : null}
      {cell.lane ? <Observation record={cell.lane.record} lane={cell.lane.lane} labelled={labelled} /> : null}
    </div>
  );
}

export default function DeltaTable({ pair, rows, focusKey }: DeltaTableProps) {
  // 수치 축 열은 **이 패치쌍에 잠수함이 있을 때만** 만든다. 26.17→26.18처럼 0건인 쌍에서는
  // 열 전체가 `—`가 되는데, 0건 증명은 홈 `SubmarineSection`이 이미 맡고 있다(중복 금지).
  const showSubmarine = rows.some(
    (row) => row.submarineChanges.length > 0 || row.mismatchChanges.length > 0
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);

  // 포커스 행을 컨테이너 최상단으로 — sticky 헤더 높이만큼 아래에 앉힌다.
  useEffect(() => {
    if (!focusKey) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // `CSS.escape`·`scrollTo`는 jsdom에 없다 — 속성 비교로 찾고 존재할 때만 스크롤한다.
    const row = Array.from(scroller.querySelectorAll<HTMLTableRowElement>("tr[data-entity-key]")).find(
      (tr) => tr.dataset.entityKey === focusKey
    );
    if (!row) return;
    // 즉시 이동 — `behavior: "smooth"`는 실측(정적 빌드, Chromium)에서 이동이 시작되지 않는 경우가 있었다.
    const headerHeight = theadRef.current?.offsetHeight ?? 0;
    scroller.scrollTop = Math.max(0, row.offsetTop - headerHeight);
  }, [focusKey]);

  const fromLabel = pair?.from ?? "이전";
  const toLabel = pair?.to ?? "이후";

  // sticky 헤더(2026-09-12·4차, R5) — `border-collapse`와 `position:sticky`를 같이 쓰면 th 하단
  // border가 사라지는 상호작용이 있어 `shadow-[inset_0_-1px_0_var(--border-soft)]`로 대체한다(색은
  // 토큰 참조). 헤더 배경은 불투명 단색 — 스크롤 시 그라디언트가 띠로 끊겨 보이지 않게.
  const thBase =
    "sticky top-0 z-10 whitespace-nowrap bg-surface px-4 py-3 text-left shadow-[inset_0_-1px_0_var(--border-soft)] font-body text-xs font-bold text-muted";

  return (
    <div ref={scrollerRef} className={PANEL_SPLIT_BODY}>
      <table className="w-full border-collapse font-mono text-sm tabular-nums">
        <thead ref={theadRef}>
          <tr>
            <th scope="col" className={thBase}>
              {/* 버전 이동은 여기 한 번만 — 열마다 "26.17"·"26.18"을 두지 않는다(L3). */}
              엔티티 <span className="ml-1 font-mono font-normal">{fromLabel} → {toLabel}</span>
            </th>
            {ENTITY_METRICS.map((metric) => (
              <th key={metric} scope="col" className={thBase}>
                {metricLabel(metric)}
              </th>
            ))}
            {/* 「바뀐 것」 — 수치 축(F9). 지표 열은 "지표가 어떻게 움직였나"를, 이 열은
                "게임사가 무엇을 바꿨나"를 말한다. LoL은 잠수함 전용 행에 상세가 없으므로
                (그 엔티티엔 델타가 0건이다) **표에서 값을 끝까지 말해야** 한다. */}
            {showSubmarine ? (
              <th scope="col" className={thBase}>
                바뀐 것
              </th>
            ) : null}
            <th scope="col" className={thBase}>
              상태
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={ENTITY_METRICS.length + (showSubmarine ? 3 : 2)}
                className="px-4 py-8 text-center font-body text-sm text-muted"
              >
                표시할 델타가 없습니다
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const highlighted = focusKey === row.key;
              return (
                <tr
                  key={row.key}
                  data-entity-key={row.key}
                  className={`border-b border-border-soft ${highlighted ? "row-highlight" : ""}`}
                >
                  <td className="px-4 py-3 font-body">
                    <div className="flex items-center gap-3">
                      <EntityIcon entityType={row.entityType} entityKey={row.entityKey} name={row.entityName} size={40} />
                      {/* 잠수함 전용 행은 관측이 하나도 없어 상세로 갈 자리가 없다 —
                          없는 링크를 만들지 않고 이름만 그린다(2026-09-21). */}
                      {row.representative ? (
                        <Link href={itemHref(row.representative.id)} className="font-bold text-fg hover:text-accent hover:underline">
                          {row.entityName}
                        </Link>
                      ) : (
                        <span className="font-bold text-fg">{row.entityName}</span>
                      )}
                    </div>
                  </td>
                  {ENTITY_METRICS.map((metric: EntityMetric) => {
                    const cell = row.cells[metric];
                    return (
                      <td key={metric} className="px-3 py-2 align-middle">
                        {cell ? <MetricCell cell={cell} labelled={row.lane === "all"} /> : <span className="px-1 text-muted">—</span>}
                      </td>
                    );
                  })}
                  {showSubmarine ? (
                    <td className="px-3 py-2 align-middle font-body">
                      {/* 상세로 갈 자리가 없는 행(`representative === null` = 델타 0건)은
                          접지 않는다 — "외 N건"은 나머지를 상세에서 본다는 약속인데
                          그 상세가 없다(2026-09-21 acceptance-critic V1). */}
                      <SubmarineCell
                        changes={row.submarineChanges}
                        mismatchChanges={row.mismatchChanges}
                        collapsible={row.representative !== null}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-body">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {/* 포커스 여백(L4 "최상단으로 Scroll Focus") — 바닥 근처 행은 스크롤이 끝에 닿아 최상단까지 못 올라온다
          (실측: 마지막 행 바드는 헤더 아래 574px에 멈췄다). 포커스가 있을 때만 컨테이너 높이만큼 빈 여백을
          두어 어느 행이든 헤더 바로 아래에 앉을 수 있게 한다. 인라인 style — 토큰이 없는 1회성 배치 수치. */}
      {focusKey ? <div aria-hidden="true" style={{ height: "600px" }} /> : null}
    </div>
  );
}
