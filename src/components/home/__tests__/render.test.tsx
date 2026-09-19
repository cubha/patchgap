// src/components/home/__tests__/render.test.tsx
// 브리핑 홈 컴포넌트 빈 상태 렌더 검증(ST-11 완료 조건 "빈 상태 렌더"). 프로젝트 관례대로
// jest-dom 매처 없이 render()의 container를 직접 querying한다(src/__tests__/components.test.tsx
// 참고 — setupFiles는 RTL cleanup 등록에만 쓰고 매처는 붙이지 않는다, vitest.setup.ts).
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DeltaRecord } from "@/pipeline/types";
import { AmbientProvider } from "@/components/AmbientContext";
import HeroSummary from "../HeroSummary";
import LaneGapPanel from "../LaneGapPanel";
import ReleaseNoteStream, { type ReleaseStreamEntry } from "../ReleaseNoteStream";
import StreamLaneFilter from "../StreamLaneFilter";
import SideMatchAverages from "../SideMatchAverages";
import DiscordPanel from "../DiscordPanel";

/** ReleaseNoteStream은 useAmbient()로 라인 선택 상태를 읽는다(AmbientContext.tsx) —
 * AmbientProvider 밖에서 렌더하면 throw하므로 테스트 전용 래퍼로 감싼다. */
function withAmbient(children: ReactNode) {
  return <AmbientProvider>{children}</AmbientProvider>;
}

describe("HeroSummary — 빈 상태(모든 수치 0)", () => {
  it("0을 그대로 렌더하고 크래시하지 않는다", () => {
    const { container } = render(
      <HeroSummary stats={{ noteEntityCount: 0, noteItemCount: 0, statCount: 0, unannouncedCount: 0 }} />
    );
    // 2026-09-18 명세 변경(채점 라운드1 ST-10): 히어로 문장이 "N 엔티티 / M 항목"에서 사람 말
    // ("N개 챔피언·아이템을 바꿨다고 말했고")로 바뀌었다 — 테스트 약화가 아니라 문구 반영.
    expect(container.textContent).toContain("0개 챔피언·아이템");
    expect(container.textContent).toContain("패치노트가 말한 것 vs 통계가 말하는 것");
    expect(container.querySelector("h1")).not.toBeNull();
  });
});

describe("ReleaseNoteStream — 빈 상태", () => {
  // 2026-09-12(4차, R2): 라인 필터가 StreamLaneFilter.tsx로 분리되면서 이 컴포넌트는 더 이상
  // 필터를 렌더하지 않는다(StreamColumnLayout의 별도 그리드 행이 필터를 담당) — 명세 변경.
  // 필터 렌더 단언은 아래 "StreamLaneFilter" 케이스로 옮겼다.
  it("그룹이 없으면 기본(패치 내용) 탭에서 빈 상태 문구를 렌더하고, 탭 행은 여전히 존재한다", () => {
    const { container } = render(
      withAmbient(
        <ReleaseNoteStream
          entries={[]}
          spellIcons={null}
          noteDeltas={{}}
          patch={null}
          contentCount={0}
          gapCount={0}
        />
      )
    );
    expect(container.textContent).toContain("이 라인에서는 관측된 변화가 없습니다");
    // 빈 상태에서도 탭 바가 사라지면 안 된다(2026-09-14 — early-return 구조의 결함이었다).
    expect(container.querySelectorAll('button[role="tab"]')).toHaveLength(2);
  });

  it("미공지 Gap 탭으로 전환하면 신규 빈 상태 문구를 렌더한다", () => {
    const { container } = render(
      withAmbient(
        <ReleaseNoteStream
          entries={[]}
          spellIcons={null}
          noteDeltas={{}}
          patch={null}
          contentCount={0}
          gapCount={0}
        />
      )
    );
    const gapTab = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) =>
      b.textContent?.startsWith("미공지 Gap")
    );
    expect(gapTab).not.toBeUndefined();
    fireEvent.click(gapTab!);
    // 문구 변경(2026-09-18 라운드6 C5): "노트에 없는 변화"·"간접 영향"·"미공지"를 "미공지" 한 어휘로 통일했다.
    expect(container.textContent).toContain("이 라인에서는 미공지 변화가 없습니다");
    expect(container.querySelectorAll('button[role="tab"]')).toHaveLength(2);
  });

  it("기본 진입은 패치 내용 탭 — matched 엔트리만 렌더하고 unannounced는 숨긴다", () => {
    const matchedEntry: ReleaseStreamEntry = {
      group: { kind: "matched", entity: "아우렐리온 솔", notes: [] },
      icon: { entityType: "champion", entityKey: "AurelionSol" },
      lanes: [],
    };
    const unannouncedEntry: ReleaseStreamEntry = {
      group: { kind: "unannounced", entity: "로크", deltas: [] },
      icon: { entityType: "champion", entityKey: "Locke" },
      lanes: [],
    };
    const { container } = render(
      withAmbient(
        <ReleaseNoteStream
          entries={[matchedEntry, unannouncedEntry]}
          spellIcons={null}
          noteDeltas={{}}
          patch="26.17"
          contentCount={1}
          gapCount={1}
        />
      )
    );
    expect(container.textContent).toContain("아우렐리온 솔");
    expect(container.textContent).not.toContain("로크");
  });

  it("탭 배지 숫자는 props로 받은 값을 그대로 표시한다(라인 필터·렌더 카드 수와 무관)", () => {
    const { container } = render(
      withAmbient(
        <ReleaseNoteStream entries={[]} spellIcons={null} noteDeltas={{}} patch={null} contentCount={181} gapCount={65} />
      )
    );
    expect(container.textContent).toContain("패치 내용 181");
    expect(container.textContent).toContain("미공지 Gap 65");
  });
});

describe("StreamLaneFilter", () => {
  it("라인 필터 6종(전체/탑/정글/미드/원딜/서포터)을 항상 렌더한다", () => {
    const { container } = render(withAmbient(<StreamLaneFilter />));
    expect(container.querySelectorAll('button[role="button"], button').length).toBeGreaterThanOrEqual(6);
  });
});

describe("SideMatchAverages — 데이터 없음(전부 null)", () => {
  it("크래시 없이 대시(—)로 렌더한다", () => {
    const { container } = render(
      <SideMatchAverages summaryTo={null} summaryFrom={null} objectivesTo={null} objectivesFrom={null} />
    );
    expect(container.textContent).toContain("경기 시간");
    expect(container.querySelectorAll("span").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("—");
  });
});

// 2026-09-19 **명세 변경**(코드가 아니라 문구가 틀렸던 경우): 이 패널은 정적 사이트라 아무것도
// 전송하지 못한다(전송은 CI의 scripts/run-notify.ts가 한다). 그런데 캡션이 "마지막 전송"이고
// 버튼이 "디스코드로 브리핑 보내기"라 할 수 없는 행위를 약속했고, 설명은 "미공지 · 공지 · 이상
// 관측"을 보낸다고 했지만 webhook.ts가 보내는 것은 미공지 상위 N + 이상 관측 상위 3뿐이다
// ("공지"는 방송 대상이 아니다). 넘기던 값도 실제로는 델타 파일 생성 시각(generatedAt)이다.
// 그래서 테스트를 통과시키려고 고친 것이 아니라, **테스트가 고정하던 문구가 거짓이어서** 함께
// 갱신했다. 링크의 죽은 프래그먼트(#discord)도 함께 뗐다(그 섹션은 2026-09-14 사용자 지시로 제거).
describe("DiscordPanel — generatedAt 없음", () => {
  it("집계 시각 캡션을 생략한다", () => {
    const { container } = render(<DiscordPanel generatedAt={null} />);
    expect(container.textContent).not.toContain("마지막 집계");
    // 방송 규칙으로 가는 링크는 **두 갈래 모두에서** 남는다 — 문구만 갈린다(초대가 있으면
    // "무엇이 언제 나가나", 없으면 "방송 규칙 보기"). 여기서 문구 하나를 박으면 초대 상수를
    // 켜고 끌 때마다 이 테스트가 깨진다(2026-09-20 실측). 갈래별 문구는 DiscordPanel.test.tsx가
    // 모킹으로 따로 고정하므로, 이 파일은 "링크가 살아 있는가"만 본다.
    const rules = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(rules.some((href) => href?.includes("#discord"))).toBe(true);
  });

  it("generatedAt이 있으면 KST로 포맷한 캡션을 렌더한다", () => {
    const { container } = render(<DiscordPanel generatedAt="2026-09-05T05:00:00.000Z" />);
    expect(container.textContent).toContain("마지막 집계 2026-09-05 14:00 KST");
  });

  it("보내지 않는 것을 보낸다고 말하지 않는다 — '공지'는 방송 대상이 아니다", () => {
    const { container } = render(<DiscordPanel generatedAt={null} />);
    expect(container.textContent).not.toContain("디스코드로 브리핑 보내기");
    expect(container.textContent).toContain("미공지 상위 항목과 이상 관측");
  });
});

describe("LaneGapPanel — 빈 상태", () => {
  it("전부 0이면 빈 상태 문구를 렌더한다", () => {
    const rows = (["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "all"] as const).map((lane) => ({
      lane,
      label: lane === "all" ? "전체" : lane,
      count: 0,
    }));
    const { container } = render(<LaneGapPanel rows={rows} />);
    expect(container.textContent).toContain("라인별로 집계할 미공지 변화가 없습니다");
  });

  it("count가 있으면 라인별 글리프+수치를 렌더한다", () => {
    const { container } = render(
      <LaneGapPanel rows={[{ lane: "TOP", label: "탑", count: 22 }, { lane: "all", label: "전체", count: 0 }]} />
    );
    expect(container.textContent).toContain("탑");
    expect(container.textContent).toContain("22");
    // 라벨("탑")이 글리프 바로 옆에 있어 labelled(장식) 처리 — <title> 중복 낭독 방지.
    const glyph = container.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ReleaseNoteStream — 라인 엔티티(entityType='lane') 카드 아이콘", () => {
  it("대조표(RowIcon)와 동형으로 LaneGlyph를 렌더한다 — 텍스트 첫글자 폴백('바')을 쓰지 않는다", () => {
    const laneDelta: DeltaRecord = {
      id: "lane:BOTTOM:goldAt14",
      entityType: "lane",
      entityKey: "BOTTOM",
      entityName: "바텀",
      metric: "goldAt14",
      before: 6139,
      after: 6211,
      delta: 72,
      ci: [16, 128],
      n: { before: 2946, after: 2962 },
      q: 0.02,
      status: "unannounced",
      matchedNoteId: null,
      matchedNoteIds: [],
      causes: [],
      evidence: { matchIds: [], aggregatePath: "x", noteAnchor: null },
    };
    const entries: ReleaseStreamEntry[] = [
      {
        group: { kind: "unannounced", entity: "바텀", deltas: [laneDelta] },
        icon: { entityType: "lane", entityKey: "BOTTOM" },
        lanes: [],
      },
    ];
    const { container } = render(
      withAmbient(
        <ReleaseNoteStream
          entries={entries}
          spellIcons={null}
          noteDeltas={{}}
          patch="26.17"
          contentCount={0}
          gapCount={1}
        />
      )
    );
    // 이 엔트리는 unannounced(미공지 Gap) — 기본 탭은 "패치 내용"이라 먼저 Gap 탭으로
    // 전환해야 카드가 렌더된다(2026-09-14 탭 분리로 기본 탭 필터링이 추가됨).
    const gapTab = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) =>
      b.textContent?.startsWith("미공지 Gap")
    );
    fireEvent.click(gapTab!);
    const glyph = container.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    // EntityIcon 기본 폴백(첫 글자 텍스트 박스)이 아님을 확인 — "바" 단독 텍스트 박스 부재.
    expect(container.querySelector('span[style*="width: 56px"]')?.textContent?.trim()).not.toBe("바");
  });
});

// ── 2026-09-18 채점 라운드5(ST4) 접힘 구간 · 라운드6(L2) 기타 변경 블록 ─────────────────────
// 라운드6 명세 변경: 요약행 어휘 "관측 변화 없음" → "유의한 관측 없음"(C1 어휘 통일), 섹션 묶음(tier 3)은
// 카드가 아니라 `miscSections`로 목록 끝 "기타 변경" 블록에 실린다.
describe("ReleaseNoteStream — tier 2 접기 · 기타 변경", () => {
  const entries: ReleaseStreamEntry[] = [
    { group: { kind: "matched", entity: "에코", notes: [] }, icon: { entityType: "champion", entityKey: "Ekko" }, lanes: [], tier: 0 },
    { group: { kind: "matched", entity: "카사딘", notes: [] }, icon: { entityType: "champion", entityKey: "Kassadin" }, lanes: [], tier: 2 },
    { group: { kind: "matched", entity: "마스터 이", notes: [] }, icon: { entityType: "champion", entityKey: "MasterYi" }, lanes: [], tier: 2 },
  ];
  const misc = [
    {
      category: "bugfix" as const,
      label: "버그 수정",
      notes: [
        {
          id: "b1",
          patch: "26.18",
          section: "system" as const,
          entity: "버그 수정",
          skill: null,
          stat: null,
          before: null,
          after: null,
          direction: "unknown" as const,
          summary: "티모의 버섯 함정이 정상적으로 지속되지 않던 버그를 수정했습니다.",
          anchorUrl: "https://example.com/#classic",
          anchorKind: "section" as const,
          modeScope: "core" as const,
        },
      ],
    },
    {
      category: "cosmetic" as const,
      label: "신규 스킨·치장",
      notes: [
        {
          id: "h1",
          patch: "26.18",
          section: "system" as const,
          entity: "홀 오브 레전드",
          skill: null,
          stat: null,
          before: null,
          after: null,
          direction: "unknown" as const,
          summary: "떠오른 전설 오리아나 스킨 및 테두리",
          anchorUrl: "https://example.com/#hall-of-legends",
          anchorKind: "section" as const,
          modeScope: "core" as const,
        },
      ],
    },
  ];

  function renderStream() {
    return render(
      withAmbient(
        <ReleaseNoteStream entries={entries} spellIcons={null} noteDeltas={{}} patch="26.18" contentCount={5} gapCount={0} miscSections={misc} />
      )
    );
  }

  it("연속 tier 2는 요약 1행('유의한 관측 없음 · N건')으로 접히고, 그 안에 카드가 전부 남는다", () => {
    const { container } = renderStream();
    const summaries = Array.from(container.querySelectorAll("ul > li > details > summary")).map((s) => s.textContent ?? "");
    const collapsed = summaries.find((t) => t.startsWith("유의한 관측 없음"));
    expect(collapsed).toBeDefined();
    expect(collapsed).toContain("2건");
    expect(collapsed).not.toContain("유의차");
    expect(collapsed).not.toContain("바닥");
    expect(container.textContent).toContain("카사딘");
    expect(container.textContent).toContain("마스터 이");
    const details = Array.from(container.querySelectorAll("details")).find((d) =>
      d.querySelector("summary")?.textContent?.startsWith("유의한 관측 없음")
    );
    expect(details?.querySelectorAll(":scope > ul > li")).toHaveLength(2);
  });

  it("tier 2가 떨어져 있으면 접힘 구간이 둘 — 각각 자기 건수를 말하고 key가 겹치지 않는다(scope-critic ST3)", () => {
    const split: ReleaseStreamEntry[] = [entries[1], entries[0], entries[2]];
    const { container } = render(
      withAmbient(
        <ReleaseNoteStream entries={split} spellIcons={null} noteDeltas={{}} patch="26.18" contentCount={3} gapCount={0} />
      )
    );
    const folds = Array.from(container.querySelectorAll("ul > li > details > summary")).filter((s) =>
      s.textContent?.startsWith("유의한 관측 없음")
    );
    expect(folds).toHaveLength(2);
    expect(folds.map((s) => s.textContent)).toEqual(["유의한 관측 없음1건▾", "유의한 관측 없음1건▾"]);
    expect(container.textContent).toContain("카사딘");
    expect(container.textContent).toContain("에코");
    expect(container.textContent).toContain("마스터 이");
  });

  it("기타 변경 블록은 목록의 마지막 항목 1개 — 카테고리 소제목 아래 줄만, 배지·아이콘 없음", () => {
    const { container } = renderStream();
    // 스트림 <ul>의 직접 자식만 — 기타 변경 블록 안의 카테고리 <section><ul>과 헷갈리지 않게 :scope로 센다.
    const streamList = container.querySelector("section > ul")!;
    const items = streamList.querySelectorAll(":scope > li");
    const last = items[items.length - 1];
    const summary = last.querySelector("summary");
    expect(summary?.textContent).toContain("기타 변경");
    expect(summary?.textContent).toContain("2건");
    expect(summary?.textContent).toContain("버그 수정 · 신규 스킨·치장");
    expect(last.textContent).toContain("티모의 버섯 함정");
    expect(last.textContent).toContain("떠오른 전설 오리아나");
    // 배지(StatusBadge는 font-mono span에 점 마커) — 기타 변경 안에는 없다. 섹션 묶음 카드의 § 표식도 없다.
    expect(last.querySelectorAll('span[aria-hidden="true"].bg-current')).toHaveLength(0);
    expect(container.textContent).not.toContain("패치노트 섹션 · 엔티티 아님");
  });

  it("미공지 Gap 탭에서는 기타 변경 블록이 없다", () => {
    const { container } = renderStream();
    const gapTab = Array.from(container.querySelectorAll('button[role="tab"]')).find((b) => b.textContent?.startsWith("미공지 Gap"));
    fireEvent.click(gapTab!);
    expect(container.textContent).not.toContain("기타 변경");
  });
});
