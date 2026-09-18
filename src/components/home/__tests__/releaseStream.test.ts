// src/components/home/__tests__/releaseStream.test.ts
// 릴리즈노트 스트림 조립(releaseStream.ts) 단위 테스트 — ST-B TDD.
// 최소 케이스: 노트만 있음(정상) / 델타만 있음(미공지) / 둘 다 있음(정상 짝) /
// 미공지 여러 건 |delta| 내림차순 정렬 / matched·unannounced 그룹 분리 불변식.
//
// 2026-09-10 명세 변경(verify-impl 축B): "미공지를 스트림 상단에 몰아 삽입" → "노트 순서
// 그대로 두고 그 사이에 균등 분산 삽입"으로 바꿨었다(상단 몰림이 실데이터에서 노트 스트림을
// 화면 밖으로 밀어냄).
//
// 2026-09-14 명세 변경(재정정, 사용자 지시): 균등 분산 자체를 걷어내고 matched/unannounced를
// **완전히 분리**한다 — 홈이 "패치 내용"/"미공지 Gap" 탭 2개로 나뉘면서(ReleaseNoteStream.tsx),
// 두 그룹을 한 스트림에 섞어 배치할 이유가 없어졌다(탭이 곧 그 구분을 담당). `buildReleaseStream`
// 반환 타입은 그대로 `ReleaseStreamGroup[]`이지만 순서는 이제 단순히 `[...matched, ...unannounced]`
// — 인터리브가 지키던 "미공지 최소 1건을 스트림 최상단에 승격"(HANDOFF §1-1) 불변식은 Gap 탭이
// 카운트 배지와 함께 상시 노출되는 것으로 대체된다(탭 UI 쪽에서 보장, 이 파일의 책임 밖).
// 아래 테스트는 "위치"가 아니라 ①matched는 노트 문서 순서 ②unannounced는 |delta| 내림차순
// ③unannounced는 항상 matched 뒤 — 3개 불변식으로 검증한다(인덱스 하드코딩 금지).

import { describe, expect, it } from "vitest";
import type { DeltaRecord, PatchNoteItem } from "@/pipeline/types";
import type { DeltasFile } from "@/pipeline/types";
import type { NotesFile } from "@/lib/data";
import { buildReleaseStream, contentTier, sortMatchedGroups } from "../releaseStream";
import { indexNoteDeltas } from "../noteDeltaIndex";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:26.17:champion:x:0000",
    patch: "26.17",
    section: "champion",
    entity: "테스트챔프",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "unknown",
    summary: "테스트 요약",
    anchorUrl: "https://example.com/#x",
    anchorKind: "entity",
    ...overrides,
  };
}

function notesFile(items: PatchNoteItem[]): NotesFile {
  return {
    meta: {
      patch: "26.17",
      sourceUrl: "https://example.com",
      fetchedAt: "2026-09-05T00:00:00.000Z",
      itemCount: items.length,
    },
    summary: "요약",
    sections: [],
    items,
  };
}

function delta(overrides: Partial<DeltaRecord>): DeltaRecord {
  return {
    id: "champion:X:pickRate",
    entityType: "champion",
    entityKey: "X",
    entityName: "테스트챔프",
    metric: "pickRate",
    before: 0.1,
    after: 0.12,
    delta: 0.02,
    ci: [0.01, 0.03],
    n: { before: 1000, after: 1000 },
    q: 0.02,
    status: "unannounced",
    matchedNoteId: null,
    matchedNoteIds: [],
    causes: [],
    evidence: { matchIds: [], aggregatePath: "#", noteAnchor: null },
    ...overrides,
  };
}

function deltasFile(rows: DeltaRecord[]): DeltasFile {
  return {
    meta: { from: "26.16", to: "26.17", generatedAt: "2026-09-05T05:00:00.000Z", n: rows.length, counts: {}, qAlpha: 0.1 },
    rows,
  };
}

describe("buildReleaseStream", () => {
  it("notes/deltas 둘 다 null이면 빈 배열", () => {
    expect(buildReleaseStream(null, null)).toEqual([]);
  });

  it("노트만 있고 델타가 없으면 정상(matched) 그룹으로만 구성된다", () => {
    const notes = notesFile([
      note({ id: "a", entity: "아우렐리온 솔", skill: "Q", stat: "마나 소모량" }),
      note({ id: "b", entity: "아우렐리온 솔", skill: "W", stat: "재사용 대기시간" }),
    ]);
    const stream = buildReleaseStream(notes, null);
    expect(stream).toEqual([
      { kind: "matched", entity: "아우렐리온 솔", notes: notes.items },
    ]);
  });

  it("노트 그룹 순서는 notes.json 원본(첫 등장) 순서를 유지한다", () => {
    const notes = notesFile([
      note({ id: "a", entity: "그레이브즈" }),
      note({ id: "b", entity: "초가스" }),
      note({ id: "c", entity: "그레이브즈" }),
    ]);
    const stream = buildReleaseStream(notes, null);
    expect(stream.map((g) => g.entity)).toEqual(["그레이브즈", "초가스"]);
  });

  it("델타만 있고(status=unannounced) 대응 노트가 없으면 미공지 그룹만으로 구성된다", () => {
    const deltas = deltasFile([
      delta({ id: "champion:Locke:banRate", entityKey: "Locke", entityName: "로크", status: "unannounced", delta: -0.13 }),
    ]);
    const stream = buildReleaseStream(null, deltas);
    expect(stream).toHaveLength(1);
    expect(stream[0]).toEqual({
      kind: "unannounced",
      entity: "로크",
      deltas: deltas.rows,
    });
  });

  it("status가 unannounced가 아닌 델타(예: no-change)는 미공지 그룹에 들어가지 않는다", () => {
    const deltas = deltasFile([
      delta({ id: "champion:Locke:banRate", entityKey: "Locke", entityName: "로크", status: "no-change" }),
    ]);
    expect(buildReleaseStream(null, deltas)).toEqual([]);
  });

  it("둘 다 있으면(노트 그룹 + 델타 존재) 정상 짝으로 matched 그룹 하나만 나온다", () => {
    const notes = notesFile([note({ id: "a", entity: "키아나", skill: "Q" })]);
    const deltas = deltasFile([
      delta({
        id: "champion:Qiyana:banRate",
        entityKey: "Qiyana",
        entityName: "키아나",
        status: "announced-inconsistent",
        matchedNoteId: "a",
        matchedNoteIds: ["a"],
      }),
    ]);
    const stream = buildReleaseStream(notes, deltas);
    expect(stream).toEqual([{ kind: "matched", entity: "키아나", notes: notes.items }]);
  });

  it("미공지 여러 건은 |delta| 내림차순으로 정렬된다(공지 그룹과 섞이지 않음)", () => {
    const notes = notesFile([note({ id: "a", entity: "공지된챔프" })]);
    const deltas = deltasFile([
      delta({ id: "champion:A:pickRate", entityKey: "A", entityName: "작은변화", status: "unannounced", delta: 0.05 }),
      delta({ id: "champion:B:pickRate", entityKey: "B", entityName: "큰변화", status: "unannounced", delta: -0.3 }),
      delta({ id: "champion:C:pickRate", entityKey: "C", entityName: "중간변화", status: "unannounced", delta: 0.15 }),
    ]);
    const stream = buildReleaseStream(notes, deltas);
    const unannouncedOrder = stream.filter((g) => g.kind === "unannounced").map((g) => g.entity);
    expect(unannouncedOrder).toEqual(["큰변화", "중간변화", "작은변화"]);
  });

  it("노트 그룹의 상대 순서는 원본(문서 등장) 순서를 유지한다", () => {
    const notes = notesFile([
      note({ id: "n1", entity: "노트1" }),
      note({ id: "n2", entity: "노트2" }),
      note({ id: "n3", entity: "노트3" }),
    ]);
    const deltas = deltasFile([
      delta({ id: "champion:U1:pickRate", entityKey: "U1", entityName: "미공지1", status: "unannounced", delta: -0.4 }),
    ]);
    const stream = buildReleaseStream(notes, deltas);
    const matchedOrder = stream.filter((g) => g.kind === "matched").map((g) => g.entity);
    expect(matchedOrder).toEqual(["노트1", "노트2", "노트3"]);
  });

  it("불변식: matched 그룹은 항상 unannounced 그룹보다 앞에 온다(탭 분리 후 순서 의미 — 2026-09-14)", () => {
    const notes = notesFile([note({ id: "n1", entity: "노트1" }), note({ id: "n2", entity: "노트2" })]);
    const deltas = deltasFile([
      // |delta|가 커서 예전 인터리브 규칙이라면 스트림 최상단(슬롯 0)으로 승격됐을 값 — 그래도
      // 지금은 모든 matched 뒤에 와야 한다.
      delta({ id: "champion:U1:pickRate", entityKey: "U1", entityName: "미공지큰", status: "unannounced", delta: -0.9 }),
      delta({ id: "champion:U2:pickRate", entityKey: "U2", entityName: "미공지작은", status: "unannounced", delta: 0.05 }),
    ]);
    const stream = buildReleaseStream(notes, deltas);
    const lastMatchedIndex = stream.findLastIndex((g) => g.kind === "matched");
    const firstUnannouncedIndex = stream.findIndex((g) => g.kind === "unannounced");
    expect(firstUnannouncedIndex).toBeGreaterThan(lastMatchedIndex);
    expect(stream.map((g) => g.entity)).toEqual(["노트1", "노트2", "미공지큰", "미공지작은"]);
  });

  it("미공지가 없으면 노트 그룹 순서 그대로다", () => {
    const notes = notesFile([note({ id: "n1", entity: "노트1" }), note({ id: "n2", entity: "노트2" })]);
    const stream = buildReleaseStream(notes, deltasFile([]));
    expect(stream.map((g) => g.entity)).toEqual(["노트1", "노트2"]);
  });

  it("같은 엔티티의 미공지 델타가 여럿이면 하나의 그룹으로 묶인다", () => {
    const deltas = deltasFile([
      delta({ id: "champion:Locke:banRate", entityKey: "Locke", entityName: "로크", metric: "banRate", status: "unannounced", delta: -0.13 }),
      delta({ id: "champion:Locke:pickRate", entityKey: "Locke", entityName: "로크", metric: "pickRate", status: "unannounced", delta: 0.02 }),
    ]);
    const stream = buildReleaseStream(null, deltas);
    expect(stream).toHaveLength(1);
    expect(stream[0].kind).toBe("unannounced");
    if (stream[0].kind === "unannounced") {
      expect(stream[0].deltas).toHaveLength(2);
    }
  });

  it("champion 외 entityType(lane/objective/summary)의 미공지 델타도 그룹에 포함된다(필터링하지 않음, scope-critic 2026-09-10 확인)", () => {
    const deltas = deltasFile([
      delta({
        id: "lane:BOTTOM:goldAt10",
        entityType: "lane",
        entityKey: "BOTTOM",
        entityName: "바텀",
        metric: "goldAt10",
        status: "unannounced",
        delta: 120,
      }),
      delta({
        id: "objective:dragon:firstSec",
        entityType: "objective",
        entityKey: "dragon",
        entityName: "첫 용",
        metric: "firstSec",
        status: "unannounced",
        delta: -15,
      }),
    ]);
    const stream = buildReleaseStream(null, deltas);
    expect(stream.map((g) => g.entity).sort()).toEqual(["바텀", "첫 용"].sort());
    expect(stream.every((g) => g.kind === "unannounced")).toBe(true);
  });

  it("U=0(미공지 없음)이면 노트로 그대로 시작한다", () => {
    const notes = notesFile([note({ id: "n1", entity: "노트1" })]);
    const stream = buildReleaseStream(notes, deltasFile([]));
    expect(stream).toEqual([{ kind: "matched", entity: "노트1", notes: notes.items }]);
  });
});

// ── "패치 내용" 탭 3티어 정렬 (2026-09-18, 채점 라운드1 ST-8 / advisor 권장 A안) ──────
// 첫 행이 "홀 오브 레전드(치장)"이고 이어 8행이 "관측 변화 없음"이었다(실측). UX-BRIEF 01의
// 수용 기준 "상단 캡처가 패치노트 요약 사이트로 읽히면 실패"를 그대로 집행한다 — 숨기지 않고
// 아래로 내릴 뿐이며, 티어 안에서는 패치노트 순서를 유지한다.
describe("sortMatchedGroups — 3티어", () => {
  const notes = notesFile([
    note({ id: "n-skin", entity: "홀 오브 레전드", section: "champion", summary: "떠오른 전설 오리아나 스킨", stat: null, direction: "unknown" }),
    note({ id: "n-cass", entity: "카시오페아", section: "champion" }),
    note({ id: "n-bard", entity: "바드", section: "champion" }),
    note({ id: "n-ekko", entity: "에코", section: "champion" }),
    note({ id: "n-varus", entity: "바루스", section: "champion" }),
  ]);
  const deltas = deltasFile([
    // 바드: 노트와 방향 일치·유의·바닥 통과
    delta({ id: "d-bard", entityName: "바드", metric: "pickRate", delta: -0.022, ci: [-0.031, -0.013], q: 0.001, status: "announced-consistent", matchedNoteId: "n-bard", matchedNoteIds: ["n-bard"] }),
    // 에코: 방향 반대·유의·바닥 통과 → 불일치가 최상단
    delta({ id: "d-ekko", entityName: "에코", metric: "winRate", before: 0.5, after: 0.404, delta: -0.096, ci: [-0.15, -0.04], q: 0.01, status: "announced-inconsistent", matchedNoteId: "n-ekko", matchedNoteIds: ["n-ekko"] }),
    // 카시오페아: 짝은 있으나 비유의 → 관측 없음
    delta({ id: "d-cass", entityName: "카시오페아", metric: "winRate", delta: -0.006, ci: [-0.05, 0.04], q: 1, status: "announced-inconsistent", matchedNoteId: "n-cass", matchedNoteIds: ["n-cass"] }),
  ]);

  it("불일치 → 일치 → 관측 없음 → 치장 순이고, 티어 안에서는 노트 순서를 지킨다", () => {
    const groups = buildReleaseStream(notes, deltas).filter((g) => g.kind === "matched");
    const sorted = sortMatchedGroups(groups, deltas, 0.1);
    expect(sorted.map((g) => g.entity)).toEqual(["에코", "바드", "카시오페아", "바루스", "홀 오브 레전드"]);
  });

  it("deltas가 없으면 전부 '관측 없음' 티어라 노트 순서 그대로(치장만 맨 뒤)", () => {
    const groups = buildReleaseStream(notes, null).filter((g) => g.kind === "matched");
    expect(sortMatchedGroups(groups, null, 0.1).map((g) => g.entity)).toEqual(["카시오페아", "바드", "에코", "바루스", "홀 오브 레전드"]);
  });
});

// ── 섹션 묶음 티어 (2026-09-18, 채점 라운드5 ST2 / B2) ────────────────────────────────
// h3 없는 섹션의 폴백 엔티티(「의회 - 투표 1 결과」·「증강」·「버그 수정」)는 엔티티가 아니다.
// 관측 없음(2) 뒤·치장(4) 앞의 티어 3에 둔다 — 챔피언과 같은 위계로 섞이지 않되 숨기지도 않는다.
// 판별(`isSectionBundle`)은 ddragon을 알아야 하므로 page.tsx가 하고, 정렬은 이름 집합만 받는다.
describe("sortMatchedGroups — 섹션 묶음 티어(3)", () => {
  const notes = notesFile([
    note({ id: "n-council", entity: "의회 - 투표 1 결과", section: "champion", anchorKind: "section" }),
    note({ id: "n-skin", entity: "홀 오브 레전드", section: "champion", summary: "떠오른 전설 오리아나 스킨" }),
    note({ id: "n-bard", entity: "바드", section: "champion" }),
    note({ id: "n-bug", entity: "버그 수정", section: "system", anchorKind: "section" }),
    note({ id: "n-cass", entity: "카시오페아", section: "champion" }),
  ]);
  const deltas = deltasFile([
    delta({ id: "d-bard", entityName: "바드", metric: "pickRate", delta: -0.022, ci: [-0.031, -0.013], q: 0.001, status: "announced-consistent", matchedNoteId: "n-bard", matchedNoteIds: ["n-bard"] }),
    delta({ id: "d-cass", entityName: "카시오페아", metric: "winRate", delta: -0.006, ci: [-0.05, 0.04], q: 1, status: "announced-inconsistent", matchedNoteId: "n-cass", matchedNoteIds: ["n-cass"] }),
  ]);
  const bundles = new Set(["의회 - 투표 1 결과", "버그 수정"]);

  it("일치 → 관측 없음 → 섹션 묶음 → 치장 순이고, 섹션 묶음 안에서는 노트 순서", () => {
    const groups = buildReleaseStream(notes, deltas).filter((g) => g.kind === "matched");
    expect(sortMatchedGroups(groups, deltas, 0.1, bundles).map((g) => g.entity)).toEqual([
      "바드",
      "카시오페아",
      "의회 - 투표 1 결과",
      "버그 수정",
      "홀 오브 레전드",
    ]);
  });

  it("집합을 안 주면 이전과 동일하게 동작한다(섹션 묶음은 관측 없음 티어에 노트 순서로 섞인다)", () => {
    const groups = buildReleaseStream(notes, deltas).filter((g) => g.kind === "matched");
    expect(sortMatchedGroups(groups, deltas, 0.1).map((g) => g.entity)).toEqual([
      "바드",
      "의회 - 투표 1 결과",
      "버그 수정",
      "카시오페아",
      "홀 오브 레전드",
    ]);
  });

  it("contentTier: 치장은 4, 섹션 묶음은 3, 짝 없는 일반 엔티티는 2", () => {
    const groups = buildReleaseStream(notes, deltas).filter((g) => g.kind === "matched");
    const byEntity = Object.fromEntries(groups.map((g) => [g.entity, g]));
    const noteDeltas = indexNoteDeltas(deltas.rows, 0.1);
    expect(contentTier(byEntity["홀 오브 레전드"], noteDeltas, 0.1, bundles)).toBe(4);
    expect(contentTier(byEntity["의회 - 투표 1 결과"], noteDeltas, 0.1, bundles)).toBe(3);
    expect(contentTier(byEntity["카시오페아"], noteDeltas, 0.1, bundles)).toBe(2);
    expect(contentTier(byEntity["바드"], noteDeltas, 0.1, bundles)).toBe(1);
  });
});
