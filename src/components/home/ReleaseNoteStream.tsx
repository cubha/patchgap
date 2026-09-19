// src/components/home/ReleaseNoteStream.tsx
// 릴리즈노트 스트림 — 홈 좌측 메인 콘텐츠(리스트 패널 본문만). "use client" 경계는 라인 필터
// 선택 상태 하나만 소비한다(src/lib/data.ts가 "server-only"라 필터 상태를 page.tsx/서버
// 컴포넌트에 두면 안 된다 — CompareExplorer.tsx와 동일한 서버-로드/클라이언트-필터 분리 패턴).
// 데이터(그룹·아이콘·라인·스펠아이콘·노트상태)는 전부 page.tsx가 빌드 타임에 준비해 props로
// 내려준다 — 이 컴포넌트 자체는 fs를 읽지 않는다.
//
// 선택 라인 상태는 2026-09-12부터 로컬 useState가 아니라 AmbientContext(useAmbient)가 소유한다
// — 같은 값을 layout.tsx의 전역 배경(AmbientBackground)이 라인 카메라 이동에 그대로 쓴다
// (advisor 검토: 배경을 두 번 렌더해 상태를 동기화하는 대신 소유권을 한 곳에 둔다).
//
// 2026-09-12(4차, R2): 라인 필터 뱃지 행은 StreamLaneFilter.tsx로 분리됐다 — 이 컴포넌트는
// 이제 리스트 패널 본문만 그린다(StreamColumnLayout의 그리드 row2). 필터-리스트 상단 정렬
// 결함의 원인이 이 컴포넌트가 필터와 패널을 한 flex 컬럼에 같이 갖고 있던 것이었다.
//
// 2026-09-12(5차, R6 — 사용자 재지적): 히어로 스탯·매치평균만 유리화하고 이 패널(홈에서 가장
// 눈에 띄는 좌측 메인 패널)을 불투명으로 남겨뒀더니 "왜 여기만 다르냐"는 지적을 받았다 —
// bg-visibility-proposal.html의 "옵션 B"(카메라 밴드 안 패널만 유리화)는 사용자가 실제 배치
// 화면을 보기 전 판단이었고, 실물을 보니 인접 패널 간 이질감이 진단보다 훨씬 크게 느껴진다는
// 것. 그래서 카메라 밴드 여부와 무관하게 홈의 모든 `.panel-surface`를 유리화하는 쪽으로
// 방향을 바꿨다(LaneGapPanel.tsx·DiscordPanel.tsx도 동일 라운드에 함께 수정 — 전부 같은
// 커밋 단위로 취급). 상세 근거·트레이드오프는 PLAN-deployed-ui-fix-2026-09-12.md R6 절 참고.
//
// 2026-09-14(탭 분리) — "패치 내용"/"미공지 Gap" 탭 2개 추가(PLAN-home-tab-split-intro-fix-
// 2026-09-14.md). `releaseStream.buildReleaseStream()`이 더 이상 두 그룹을 섞어 배치하지
// 않으므로(단순 concat) 여기서 `group.kind`로 걸러 탭별 목록을 만든다. 탭 DOM/스타일은
// `/compare/`의 `NoteNavigator.tsx`(패치노트 섹션 탭)를 그대로 재사용 — 사이트 안에 이미
// 있는 탭 패턴과 다른 시맨틱을 새로 만들지 않는다(role="tablist"/role="tab"/aria-selected,
// `aria-controls`·`role="tabpanel"`은 그 전례도 안 쓰므로 여기서도 생략).
// `panelSurfaceClass("glass")`를 스크롤 `<ul>`에서 비스크롤 `<section>` 래퍼로 옮겼다 — 골드
// 레일이 이제 탭 행 위에 걸리고, `<ul>`은 그 안의 스크롤 전용 자식이 된다. "프레임 vignette"
// 부수효과(아래 주석)는 스크롤 컨테이너가 `<ul>`인 한 그대로 유지된다.
"use client";

import { useMemo, useState } from "react";
import type { DeltaRecord, LanePosition } from "@/pipeline/types";
import { useAmbient } from "@/components/AmbientContext";
import { panelSurfaceClass } from "@/lib/panelSurface";
import ReleaseNoteRow from "./ReleaseNoteRow";
import type { CosmeticSkinItem } from "./CosmeticSkinPreview";
import type { IndirectEffectEntry } from "./indirectEffects";
import type { ContentTier, ReleaseStreamGroup } from "./releaseStream";
import type { StreamEntityIcon } from "./releaseStreamEntity";
import { segmentStream } from "./streamSegments";
import MiscChangesSection from "./MiscChangesSection";
import type { MiscSection } from "./miscSections";

type StreamTab = "content" | "gap";

const STREAM_TABS: { key: StreamTab; label: string }[] = [
  { key: "content", label: "패치 내용" },
  { key: "gap", label: "미공지 Gap" },
];

/** ReleaseStreamGroup.kind → 탭 키. buildReleaseStream이 두 그룹을 이미 concat해 두므로
 * 여기서 kind로 되나눈다(단일 소스: releaseStream.ts의 kind 판별을 재사용, 새 분류 로직
 * 만들지 않음). */
function tabForGroup(group: ReleaseStreamGroup): StreamTab {
  return group.kind === "matched" ? "content" : "gap";
}

/** 이 그룹이 아이템을 다루는가 — 라인 필터가 무엇을 걷어냈는지 화면이 정확히 말하기 위한 판별.
 * 두 그룹 종류가 서로 다른 필드를 들고 있어 kind로 갈라 본다(새 분류 축을 만들지 않는다). */
function isItemGroup(group: ReleaseStreamGroup): boolean {
  return group.kind === "matched"
    ? group.notes.some((note) => note.section === "item")
    : group.deltas.some((delta) => delta.entityType === "item");
}

export interface ReleaseStreamEntry {
  group: ReleaseStreamGroup;
  icon: StreamEntityIcon;
  /** 이 엔티티의 position-scope 델타에서 도출한 라인 집합. 빈 배열이면 "전체" 필터에서만
   * 노출된다(라인을 추측하지 않음 — src/lib/lane.ts의 lanesForEntityKey 계약). */
  lanes: LanePosition[];
  /** 공지 그룹의 티어(releaseStream.contentTier) — page.tsx가 정렬에 쓴 것과 **같은 값**.
   * 미공지 그룹은 undefined. 접기(라운드5 E2)가 이 값으로 tier 2를 묶는다. tier 3·4는 이 목록에
   * 오지 않는다(2026-09-18 라운드6 — `miscSections`로 간다). */
  tier?: ContentTier;
}

export interface ReleaseNoteStreamProps {
  entries: ReleaseStreamEntry[];
  spellIcons: Record<string, string> | null;
  /** note.id → 짝지어진 델타(page.tsx가 matchedNoteIds 역색인으로 구성). */
  noteDeltas: Record<string, DeltaRecord>;
  /** 헤더 비관측 사유 계산 전용 짝 전수(S4 후속) — ReleaseNoteRow로 그대로 통과시킨다. */
  noteDeltaRows?: Record<string, DeltaRecord[]>;
  patch: string | null;
  /** deltas.meta.qAlpha — 판정 문장(streamVerdict)의 유의 임계. */
  qAlpha?: number;
  /** 탭 배지 숫자 — page.tsx의 기존 `computeHeadline()` 결과를 그대로 받는다(라인 필터와
   * 무관한 전체 건수: 공지된 변화=항목 수, 미공지=행 수). 화면에 실제로 렌더되는 카드는
   * 엔티티 그룹 단위라 이 숫자와 다를 수 있지만, HeroSummary·확정 시안과 정합을 맞추기 위해
   * 의도적으로 그대로 쓴다(PLAN-home-tab-split-intro-fix-2026-09-14.md "카운트 배지 소스"
   * 절 참고) — 새 집계를 만들지 않는다. */
  contentCount: number;
  gapCount: number;
  /** deltaId → 인과 체인(B2, 2026-09-17) — `indirect-effect` Gap 행이 원인을 그릴 때 쓴다. */
  causes?: Record<string, IndirectEffectEntry>;
  /** note.id → 치장 스킨 미리보기(ST-B6, 2026-09-18). 자산 존재가 확인된 것만. */
  skinPreviews?: Record<string, CosmeticSkinItem[]>;
  /** "기타 변경" 카테고리(2026-09-18 라운드6 L2) — 패치 내용 탭 목록의 마지막 1블록. 라인 필터와
   * 무관하게 항상 실린다(줄에 라인 정보가 없다). */
  miscSections?: MiscSection[];
}

function groupKey(group: ReleaseStreamGroup): string {
  return `${group.kind}:${group.entity}`;
}

const EMPTY_MESSAGE: Record<StreamTab, string> = {
  content: "이 라인에서는 관측된 변화가 없습니다",
  gap: "이 라인에서는 미공지 변화가 없습니다",
};

export default function ReleaseNoteStream({
  entries,
  spellIcons,
  noteDeltas,
  noteDeltaRows,
  patch,
  qAlpha,
  contentCount,
  gapCount,
  causes,
  skinPreviews,
  miscSections = [],
}: ReleaseNoteStreamProps) {
  const { selectedLane } = useAmbient();
  const [tab, setTab] = useState<StreamTab>("content");

  const laneFiltered = useMemo(() => {
    if (selectedLane === "all") return entries;
    return entries.filter((entry) => entry.lanes.includes(selectedLane));
  }, [entries, selectedLane]);

  /** 라인 선택 때문에 목록에서 빠진 **아이템**이 실제로 있는가 — 있을 때만 말한다(없는데 말하면
   * 그것도 거짓이다). 아이템은 `lanes`가 비어 있어 어떤 라인에도 속하지 않는다(lane.ts 계약). */
  const hasLaneExcludedItems = useMemo(() => {
    if (selectedLane === "all") return false;
    // **탭 스코프까지 본다**(2026-09-19 재판정 지적): 지금 데이터는 두 탭 모두 아이템을 갖고 있어
    // 우연히 가려졌지만, 한쪽 탭에만 아이템이 있는 패치가 오면 빠진 것이 없는 탭에서도 캡션이 떠
    // 거짓이 된다. 캡션은 **이 탭에서 실제로 빠진 것**이 있을 때만 말한다.
    return entries.some(
      (entry) =>
        tabForGroup(entry.group) === tab &&
        isItemGroup(entry.group) &&
        !entry.lanes.includes(selectedLane)
    );
  }, [entries, selectedLane, tab]);

  const filtered = useMemo(
    () => laneFiltered.filter((entry) => tabForGroup(entry.group) === tab),
    [laneFiltered, tab]
  );

  const renderRow = (entry: ReleaseStreamEntry) => (
    <ReleaseNoteRow
      key={groupKey(entry.group)}
      group={entry.group}
      icon={entry.icon}
      spellIcons={spellIcons}
      noteDeltas={noteDeltas}
      noteDeltaRows={noteDeltaRows}
      patch={patch}
      qAlpha={qAlpha}
      causes={causes}
      skinPreviews={skinPreviews}
    />
  );

  const miscTotal = tab === "content" ? miscSections.reduce((sum, s) => sum + s.notes.length, 0) : 0;

  return (
    // NoteNavigator.tsx(/compare/)와 동일 골격 — <section>이 panel-surface-glass(레일+채움)를
    // 소유하고, 탭 행 아래 <ul>은 순수 스크롤 컨테이너(자체 표면 없음). 탭 행은 목록이 비어도
    // 항상 렌더되므로 빈 탭에서도 다른 탭으로 되돌아올 수 있다(2026-09-14 — 이전 early-return
    // 구조는 filtered.length===0일 때 패널 전체를 문구로 바꿔치기해 탭 자체가 사라졌다).
    <section className={`${panelSurfaceClass("glass")} flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg`}>
      <div className="flex gap-2 border-b border-border-soft px-5 pt-4" role="tablist" aria-label="스트림 보기">
        {STREAM_TABS.map(({ key, label }) => {
          const count = key === "content" ? contentCount : gapCount;
          const isActive = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(key)}
              className={`border-b-2 px-1 py-2 text-xs font-bold ${
                isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-2"
              }`}
            >
              {label} {count}
            </button>
          );
        })}
      </div>

      {/* 정렬 고지("관측이 있는 항목부터 …")는 2026-09-18 라운드6(C3)에 뺐다 — 표기 이유는 방법론이
          말한다("표시 규칙"). */}
      {filtered.length === 0 && miscTotal === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="p-5 text-sm text-muted">{EMPTY_MESSAGE[tab]}</p>
        </div>
      ) : (
        // panel-surface(2026-09-12·3차)의 background는 border box 기준 고정(기본
        // background-attachment:scroll)이라 이 <ul>의 부모(<section>)가 스크롤 컨테이너가
        // 아니어도(<ul> 자신이 스크롤) 레일·채움이 콘텐츠와 함께 스크롤해 사라지지 않는다 —
        // 채움이 스크롤 전체 높이가 아니라 보이는 프레임 높이에 맞춰져 프레임 vignette처럼
        // 읽힌다(의도된 부수효과, panel.css 주석 참고). 2026-09-14부터 이 표면 클래스는
        // <ul>이 아니라 부모 <section>에 있다 — 탭 행도 같은 레일 아래 들어오게 하려는 것.
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {/* 2026-09-19: 라인 필터 결과가 0건인데 "기타 변경"이 있으면, 이전엔 위 빈 상태 분기가
              걸리지 않아 **안내 없이 무관한 블록만** 남았다(사용자가 고른 라인에 대해 아무 말도
              하지 않는 화면). 목록 머리에 한 줄로 말한다 — 기타 변경 줄에는 라인 축이 원리적으로
              없으므로 그 블록은 그대로 둔다. */}
          {filtered.length === 0 ? (
            <li className="border-b border-border-soft px-5 py-3 text-sm text-muted">{EMPTY_MESSAGE[tab]}</li>
          ) : null}
          {/* 2026-09-19 최종 채점 K1-4: 라인을 고르면 아이템 행이 **말없이** 사라졌다(구인수의
              격노검이 6건 → 5건으로 줄어드는데 화면은 아무 말도 안 했다). 대조표는 같은 상황을
              캡션으로 말하고 있었으므로(CompareExplorer.tsx) 같은 어휘·같은 층위로 맞춘다.
              아이템에 라인 축이 없다는 것은 데이터의 사실이지 필터의 버그가 아니다 — 그래서
              숨기지 않고 사실로 말한다. */}
          {selectedLane !== "all" && hasLaneExcludedItems ? (
            <li className="border-b border-border-soft px-5 py-2 text-xs text-muted">
              아이템은 라인별로 집계하지 않아 라인을 고르면 이 목록에서 빠집니다.
            </li>
          ) : null}
          {segmentStream(filtered).map((segment) =>
            segment.kind === "rows" ? (
              segment.entries.map((entry) => renderRow(entry))
            ) : (
              // E2(라운드5) — tier 2("유의한 관측 없음", 라운드6에서 어휘 통일) 그룹을 요약 1행으로 접는다. 행은 전부 그 안에
              // 있고 펼치면 카드 그대로다(숨기지 않는다 — 아래로 내릴 뿐이라는 ST-8 결정의 연장).
              // 요약행은 **건수만** 말한다: 6건 중 5건이 사유 혼재(mixed)라 그룹 단위로 사유를
              // 단정하면 S4가 고친 "대표 1행 사유 거짓"이 그룹 단위로 재발한다. 조건 분기 없이
              // 항상 접는다 — 26.19에서 관측 그룹이 줄어도 건수는 거짓이 없다.
              // key: 구간 첫 엔티티명 — segmentStream은 tier 2가 떨어져 있으면 구간을 여러 개
              // 만들 수 있으므로(scope-critic ST3) 상수 key를 쓰면 React key가 중복된다.
              // `group/fold`: 카드(ReleaseNoteRow)도 `<details className="group">`이라 이름 없는
              // group을 쓰면 이 요약행이 열릴 때 **안쪽 카드의 화살표까지** `group-open:`에 반응한다.
              <li key={`fold:${segment.entries[0]?.group.entity ?? ""}`} className="border-b border-border-soft last:border-b-0">
                <details className="group/fold">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3 text-xs text-muted [&::-webkit-details-marker]:hidden">
                    <span className="font-bold text-fg-2">유의한 관측 없음</span>
                    <span className="font-mono tabular-nums">{segment.entries.length}건</span>
                    <span className="flex-1" />
                    <span aria-hidden="true" className="transition-transform group-open/fold:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <ul className="border-t border-border-soft">
                    {segment.entries.map((entry) => renderRow(entry))}
                  </ul>
                </details>
              </li>
            )
          )}
          {tab === "content" ? <MiscChangesSection sections={miscSections} skinPreviews={skinPreviews} laneFiltered={selectedLane !== "all"} /> : null}
        </ul>
      )}
    </section>
  );
}
