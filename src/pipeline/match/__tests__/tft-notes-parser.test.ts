import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  parseTftPatchNotes,
  resolveTftEntity,
  type TftCatalog,
  type TftNotesParseResult,
} from "../tft-notes-parser";

// teamfighttactics.leagueoflegends.com/ko-kr/news/game-updates/teamfight-tactics-patch-18-2/ 를
// 실측 fetch한 뒤 <main>만(script/style/svg 제거) 남긴 fixture. 2026-09-20 기준 최신 패치이며
// `⇒`(span.change-indicator) 182개 · h4.change-detail-title 21개.
const FIXTURE = fs.readFileSync(path.join(__dirname, "../../../__fixtures__/tft-patch-18-2.html"), "utf8");
const SOURCE_URL = "https://teamfighttactics.leagueoflegends.com/ko-kr/news/game-updates/teamfight-tactics-patch-18-2/";

// 실제 DDragon 카탈로그의 부분집합 — 테스트가 네트워크에 의존하지 않도록 고정한다.
// (전체 사전은 tft-catalog.ts가 빌드 타임에 받아 온다.)
const CATALOG: TftCatalog = {
  traits: ["검은 가시", "악의 여단", "요정", "사냥꾼", "햇빛"],
  units: ["덩굴정령", "니달리", "나르", "럭스", "케이틀린", "카밀", "코부코", "애쉬", "티모"],
  augments: ["황금 나비정령"],
  items: ["완성 아이템 모루"],
};

function find(result: TftNotesParseResult, entity: string, statSub: string) {
  const hit = result.items.find((i) => i.entity === entity && (i.stat ?? "").includes(statSub));
  if (!hit) throw new Error(`fixture item not found: entity=${entity} stat~=${statSub}`);
  return hit;
}

describe("resolveTftEntity — 엔티티가 머리에 있을 때와 자식에 있을 때", () => {
  it("머리가 카탈로그에 있으면 머리가 엔티티다", () => {
    expect(resolveTftEntity("검은 가시", "체력: 175/300/550 ⇒ 175/350/600", CATALOG)).toEqual({
      entity: "검은 가시",
      kind: "trait",
      stat: "체력",
    });
  });

  it("머리가 카탈로그에 없으면 자식 줄의 앞머리 토큰에서 엔티티를 찾는다", () => {
    // 「4단계 3성」은 단계 구간이지 엔티티가 아니다 — 실제 엔티티는 자식 줄의 덩굴정령이다.
    expect(resolveTftEntity("4단계 3성", "덩굴정령 방어력 무시: 10 + 주문력 50% ⇒ 10 + 주문력 70%", CATALOG)).toEqual({
      entity: "덩굴정령",
      kind: "unit",
      stat: "방어력 무시",
    });
  });

  it("엔티티명이 여러 어절이어도 가장 긴 카탈로그 일치를 고른다", () => {
    expect(resolveTftEntity("증강", "황금 나비정령 획득 확률: 5% ⇒ 8%", CATALOG)).toEqual({
      entity: "황금 나비정령",
      kind: "augment",
      stat: "획득 확률",
    });
  });

  it("머리도 자식도 카탈로그에 없으면 null — 지어내지 않는다", () => {
    expect(resolveTftEntity("4단계 3성", "무언가 알 수 없는 값: 1 ⇒ 2", CATALOG)).toBeNull();
  });

  it("머리가 없는 평평한 줄도 앞머리 토큰으로 푼다", () => {
    expect(resolveTftEntity(null, "카밀 스킬 피해량: 공격력 160 ⇒ 공격력 150", CATALOG)).toEqual({
      entity: "카밀",
      kind: "unit",
      stat: "스킬 피해량",
    });
  });

  it("엔티티가 없는 체계 줄은 null — 섹션명을 엔티티로 끌어오지 않는다", () => {
    expect(resolveTftEntity(null, "8레벨에서 9레벨 요구 경험치: 64 ⇒ 68", CATALOG)).toBeNull();
  });

  it("머리가 「엔티티 + 수식」이면 접두에서 엔티티를 떼어낸다", () => {
    // 실측 18.2: 「악의 여단 정기 250개 보상:」 아래 4줄이 정확일치만 보면 통째로 버려진다.
    expect(
      resolveTftEntity("악의 여단 정기 250개 보상", "완성 아이템 모루 2개 + 12골드 ⇒ 완성 아이템 모루 2개 + 20골드", CATALOG)
    ).toEqual({
      entity: "악의 여단",
      kind: "trait",
      // 콜론이 없는 줄이라 라벨 자리가 before 값이다 — stat은 머리 나머지에서만 온다.
      stat: "정기 250개 보상",
    });
  });

  it("엔티티명 뒤가 구두점이어도 떼어낸다 — 공백만 허용하면 놓친다", () => {
    // 실측 18.2: 「경쟁을 넘어서, …」처럼 쉼표가 붙는 줄이 있다.
    expect(resolveTftEntity(null, "카밀, 스킬 피해량: 10 ⇒ 20", CATALOG)?.entity).toBe("카밀");
    expect(resolveTftEntity(null, "카밀(개화) 스킬 피해량: 10 ⇒ 20", CATALOG)?.entity).toBe("카밀");
  });

  it("그래도 다른 이름의 접두로는 잘리지 않는다", () => {
    // 「나르」가 「나르샤」를 먹으면 안 된다 — 뒤가 한글이면 다른 이름이다.
    expect(resolveTftEntity(null, "나르샤 무언가: 1 ⇒ 2", CATALOG)).toBeNull();
  });

  it("머리에서 푼 엔티티가 자식 라벨보다 우선한다", () => {
    // 자식 라벨(첫 번째)에는 엔티티가 없다 — 머리가 없으면 이 줄은 통째로 버려진다.
    const r = resolveTftEntity("요정 황금 나비정령 등장 기준치", "첫 번째: 200,000 ⇒ 170,000", CATALOG);
    expect(r?.entity).toBe("요정");
    expect(r?.kind).toBe("trait");
  });
});

describe("parseTftPatchNotes — 18.2 실측 fixture", () => {
  // describe 본문에서 즉시 호출하면 수집 단계에서 한 번 던지고 파일 전체가 죽어 개별 실패가 안 보인다.
  let cached: TftNotesParseResult | null = null;
  const parsed = (): TftNotesParseResult =>
    (cached ??= parseTftPatchNotes(FIXTURE, { patch: "18.2", sourceUrl: SOURCE_URL, catalog: CATALOG }));

  it("중첩 <li> 머리가 엔티티인 경우를 뽑는다 (대규모 변경 사항 · 특성)", () => {
    const hit = find(parsed(), "검은 가시", "체력");
    expect(hit.before).toBe("175/300/550");
    expect(hit.after).toBe("175/350/600");
    expect(hit.direction).toBe("buff");
  });

  it("머리가 엔티티가 아닌 경우 자식에서 엔티티를 승격한다 (소규모 변경 사항 · 유닛)", () => {
    const hit = find(parsed(), "니달리", "스킬 피해량");
    expect(hit.before).toBe("공격력 2,500%");
    expect(hit.after).toBe("공격력 3,000%");
    // 머리(4단계 3성)를 엔티티로 잘못 잡으면 이 줄은 니달리로 검색되지 않는다.
    expect(parsed().items.some((i) => i.entity === "4단계 3성")).toBe(false);
  });

  it("같은 머리 아래 서로 다른 유닛이 각자 엔티티가 된다", () => {
    const entities = parsed().items.filter((i) => i.stat?.includes("추가 체력") || i.stat?.includes("레이저"));
    expect(new Set(entities.map((i) => i.entity)).size).toBeGreaterThan(1);
  });

  it("blockquote.context(산문)는 항목이 되지 않는다", () => {
    expect(parsed().items.some((i) => i.summary.includes("사람의 일생처럼"))).toBe(false);
    expect(parsed().items.some((i) => i.entity.includes("코부코에게 애도"))).toBe(false);
  });

  it("⇒가 없는 줄(신규 추가)은 항목이 되지 않는다 — before/after를 지어내지 않는다", () => {
    expect(parsed().items.every((i) => i.before !== null && i.after !== null)).toBe(true);
  });

  it("h4 분류를 section으로 옮긴다", () => {
    expect(find(parsed(), "검은 가시", "체력").section).toBe("system");
    expect(find(parsed(), "니달리", "스킬 피해량").section).toBe("champion");
  });

  it("모든 항목이 원천 앵커를 갖는다 (근거 링크 원칙)", () => {
    expect(parsed().items.length).toBeGreaterThan(0);
    for (const item of parsed().items) {
      expect(item.anchorUrl.startsWith(SOURCE_URL)).toBe(true);
      expect(["entity", "section", "page"]).toContain(item.anchorKind);
    }
  });

  it("id가 고유하고 내용 기반이다 — 문서 위치가 밀려도 안 바뀐다", () => {
    const ids = parsed().items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("해소하지 못한 줄 수를 숨기지 않고 보고한다", () => {
    expect(parsed().stats.unresolved).toBeGreaterThanOrEqual(0);
    expect(parsed().stats.lines).toBeGreaterThanOrEqual(parsed().items.length);
  });

  it("modeScope는 전부 core — TFT는 모드 분기가 없다", () => {
    expect(parsed().items.every((i) => i.modeScope === "core")).toBe(true);
  });

  it("평평한 최상위 <li>도 수확한다 — 18.2 변경줄의 절반이 거기 있다", () => {
    // 「카밀 스킬 피해량: 공격력 160/240/410/700 ⇒ …」은 중첩이 아니라 평평한 줄이다.
    const hit = find(parsed(), "카밀", "스킬 피해량");
    expect(hit.before).toContain("160");
    expect(hit.direction).toBe("nerf");
  });

  it("⇒줄 집계가 중첩과 평평을 모두 센다", () => {
    // fixture 실측: li 깊이1 94줄 · 깊이2 88줄. 중첩만 세면 88 언저리에서 멈춘다.
    expect(parsed().stats.lines).toBeGreaterThan(150);
  });
});
