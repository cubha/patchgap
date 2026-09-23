// src/components/home/HeroSummary.tsx
// 요약 카드(히어로) — 프로토타입 `.panel > .panel-body(.hero-headline/.hero-sub) + .stat-tile-grid`
// 1:1 (docs/design/prototype/01-briefing-home.html). 서버 컴포넌트(순수 렌더, 상태 없음).
// 스탯 타일 "공지된 변화"는 별도 델타 집계가 아니라 헤드라인의 N(noteEntityCount)을 그대로
// 재사용한다(코디네이터 확정, 2026-09-05 — HeadlineStats 주석 참고. 필드명은 2026-09-10
// noteEntityCount/noteItemCount로 분리됐다 — HANDOFF-redesign-2026-09-10.md §4-1).
//
// 카드 자체 배경(HeroAmbient)은 2026-09-12 확정 시안(아티팩트 "협곡 앰비언트 배경" v5)에서
// 제거됐다 — 지형은 이제 카드 하나가 아니라 사이트 전역(layout.tsx AmbientBackground)에서
// 콘텐츠 바깥에 깔린다. 카드마다 반투명 스플래시를 얹는 대신 배경이 페이지 전체를 감싼다.
//
// 2026-09-12(2차): 헤드라인 문단을 카드 밖으로 빼 시안 `.hero`와 같은 구조로 맞췄다 — 시안의
// 히어로는 패널이 아니라 배경 위에 직접 앉은 텍스트(text-shadow만)고, 보더 패널은 아래
// `.tiles`(스탯 3분할)뿐이다. 구현이 둘을 한 카드로 묶고 있어서 앰비언트 배경의 섬 지형 중심부
// (y 180~420)를 불투명 --surface가 덮고 있었다. 보조 문단 색은 --muted에서 --fg로 올렸다 —
// 배경 픽셀 휘도를 실측해 최악 지점(섬의 밝은 잔디) 대비를 계산했더니 --muted/--fg-2로는
// 3.54:1(일반 텍스트 AA 4.5:1 미달, 그 줄 면적의 0.83%)이고 --fg면 5.67:1로 전 구간 통과한다.
// 위계는 색이 아니라 크기(28px bold vs 12px)가 진다.
//
// 2026-09-12(3차): 스탯 3분할 section의 골드 4변 프레임(border-border + elev-ring)을
// `.panel-surface`(상단 골드 레일 + 깊이 그라디언트)로 교체(Q2 "A+B 결합" — SectionCard.tsx와
// 동일 클래스, 대상 목록은 PLAN-panel-chrome-redesign-2026-09-12.md 참고).
//
// 2026-09-12(5차, R6): 헤드라인↔스탯 패널 간격을 gap-5(20px)→gap-8(32px)로 넓혔다 — 사용자
// 지적("모든 섹션판넬이 화면 상단에 너무가까워서 BG를 가리니까")에 대한 배치 조정의 일부
// (Container 쪽 pt-8→pt-14와 합쳐 최초 불투명 패널 등장을 늦춘다, src/app/page.tsx 주석 참고).
// 스탯 패널 자체는 방향 제안 아티팩트 "옵션 B"(구간 한정 유리화) 대상이라 `panel-surface-glass`도
// 추가했다(y<873px 카메라 노출 밴드 안에 들어오는 최초 패널 중 하나 — 실측: 1440px에서 top≈203px).
// SectionCard를 안 쓰는 이유는 이 section이 자체 헤더 없이 3분할 그리드만 그려 SectionCard의
// panel-head-wash 구조와 안 맞기 때문(기존 3차 결정 유지) — 그래서 여기서는 variant prop이 아니라
// 클래스를 직접 붙인다.
// 라벨은 여기서 그냥 text-muted를 쓴다 — 유리화로 배경 알파가 지형에 섞이면서 --muted 대비가
// 흔들리는 문제(전체 라인 4.01:1, 서포터 라인 4.23:1까지 하락, AA 4.5:1 미달, 실측)는 처음엔
// 이 컴포넌트에서만 text-fg-2로 개별 치환했는데, 홈의 모든 패널을 유리화하면서 같은 문제가
// ReleaseNoteStream 등 다른 곳에서도 반복돼 src/styles/panel.css의
// `.panel-surface-glass .text-muted { color: var(--fg-2) }` 한 줄로 중앙화했다(개별 치환은
// 되돌림). 대비 실측·근거는 그 CSS 주석 참고.

import { fmtInt } from "@/lib/format";
import type { ReactNode } from "react";
import type { HeadlineStats } from "./logic";
import StatTiles from "@/components/StatTiles";

export interface HeroSummaryProps {
  stats: HeadlineStats;
  /** 대조 후 패치 번호 — 3타일 첫 칸 부제("26.18 패치노트 · 181개 항목")의 재료(§8-1). */
  patch: string;
  /**
   * 히어로 문구 바로 아래에 놓일 조작 요소(인트로 재생 버튼). **주입받는 이유**: 이 컴포넌트는
   * 순수 프레젠테이션이고 `__tests__/render.test.tsx`가 provider 없이 단독 렌더한다. 버튼을
   * 여기서 직접 import하면 그 버튼이 쓰는 `useAmbient()`가 AmbientProvider 밖이라 throw하고,
   * 테스트를 통과시키려고 provider를 끼워 넣는 일이 생긴다 — 의존을 호출부로 올려 그 압력을
   * 구조적으로 없앤다. 넘기지 않으면 아무것도 렌더하지 않는다.
   */
  action?: ReactNode;
}

export default function HeroSummary({ stats, patch, action }: HeroSummaryProps) {
  const { noteEntityCount, noteItemCount, statCount, unannouncedCount } = stats;

  return (
    <div className="flex flex-col gap-8">
      <div className="pt-1">
        {/* 2026-09-18(채점 라운드1 ST-10): 첫 줄에 제품이 답하는 질문을 사람 말로 — 심사석·투표자는
            30초 안에 "무엇을 하는 사이트인지" 알아야 한다. 숫자는 <h1> 한 문장에 넣고 mono span
            안의 여백을 없앴다(이중 공백이 그대로 렌더되던 결함). 부제의 통계 용어(FDR·1차축·
            게이트)는 방법론으로 보내고 여기는 표본과 규칙만 말한다. */}
        <p className="ambient-hero-sub text-xs font-bold tracking-wide text-accent">
          패치노트가 말한 것 vs 통계가 말하는 것
        </p>
        <h1 className="ambient-hero-headline mt-2 max-w-3xl break-keep text-2xl font-bold leading-tight text-fg">
          {/* 두 숫자를 accent로 든다(2026-09-21 사용자 지시 — 세 게임 히어로 통일). 이 문장이
              히어로의 전부이므로 "패치가 말한 수"와 "통계가 말한 수"가 한눈에 대비돼야 한다. */}
          패치노트는{" "}
          <strong className="font-mono tabular-nums text-accent">{fmtInt(noteEntityCount)}</strong>개
          챔피언·아이템을 바꿨다고 말했고, 통계는{" "}
          <strong className="font-mono tabular-nums text-accent">{fmtInt(statCount)}</strong>개 변화를
          말합니다
        </h1>
        {/* 계산 방법 설명 문장("패치 전후 … 유의한 변화만 셉니다")은 방법론으로 옮겼다(재판정 보완 6, C3). */}
        {/* 인트로 재생 버튼은 2026-09-18 라운드6(사용자 C4 "인트로재생 버튼 제거")에 뺐다. `action`
            슬롯은 히어로 아래 조작 요소 주입용으로 남긴다(지금은 호출부가 넘기지 않는다). */}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      {/* 3타일은 세 게임 공통 컴포넌트다(UX-BRIEF §8-1) — 전에는 이 안에 직접 그렸고,
          그래서 라벨("미공지 Gap")과 클릭 동작이 LoL에만 있었다. `patch`는 대조 후 패치다. */}
      <StatTiles
        announcedCount={noteEntityCount}
        patch={patch}
        itemCount={noteItemCount}
        significantCount={statCount}
        gapCount={unannouncedCount}
        game="lol"
      />
    </div>
  );
}
