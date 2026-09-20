import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as cheerio from "cheerio";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPatchNotesUrl,
  fetchPatchNotesHtml,
  parsePatchNotes,
  type PatchNotesParseResult,
} from "../patchnotes-parser";

// 26.16→26.17 ko-kr 라이브 페이지를 실측 fetch한 뒤 <main> 컨텐츠만(스크립트/스타일/svg 제거)
// 남긴 fixture — 마크업 관찰 근거는 patchnotes-parser.ts 상단 주석 참고.
const FIXTURE_17 = fs.readFileSync(path.join(__dirname, "../../../__fixtures__/patch-26-17.html"), "utf8");
const FIXTURE_16 = fs.readFileSync(path.join(__dirname, "../../../__fixtures__/patch-26-16.html"), "utf8");

const SOURCE_URL_17 = "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-17-notes/";
const SOURCE_URL_16 = "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-16-notes/";

function find(result: PatchNotesParseResult, entity: string, statSub: string) {
  const hit = result.items.find((i) => i.entity === entity && (i.stat ?? "").includes(statSub));
  if (!hit) throw new Error(`fixture item not found: entity=${entity} stat~=${statSub}`);
  return hit;
}

describe("buildPatchNotesUrl", () => {
  it("패치 표기의 '.'을 '-'로 바꿔 실측 URL 패턴을 조립한다", () => {
    expect(buildPatchNotesUrl("26.17")).toBe(
      "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-17-notes/"
    );
  });

  it("locale을 오버라이드할 수 있다", () => {
    expect(buildPatchNotesUrl("26.17", "en-us")).toBe(
      "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-17-notes/"
    );
  });
});

describe("parsePatchNotes — 26.17 fixture 실측 항목 검증", () => {
  const result = parsePatchNotes(FIXTURE_17, { patch: "26.17", sourceUrl: SOURCE_URL_17 });

  it("아우렐리온 솔 Q 마나 소모량 — 감소=buff(낮을수록 좋은 스탯 반전)", () => {
    const item = find(result, "아우렐리온 솔", "초당 마나 소모량");
    expect(item.before).toBe("35/40/45/50/55");
    expect(item.after).toBe("30/35/40/45/50");
    expect(item.direction).toBe("buff");
    expect(item.section).toBe("champion");
    expect(item.skill).toBe("Q - 빛의 숨결");
  });

  it("아우렐리온 솔 W 재사용 대기시간 — 감소=buff(반전 케이스)", () => {
    const item = find(result, "아우렐리온 솔", "재사용 대기시간");
    expect(item.before).toBe("22/20.5/19/17.5/16초");
    expect(item.after).toBe("22/20/18/16/14초");
    expect(item.direction).toBe("buff");
  });

  it("나서스 패시브 생명력 흡수 — 감소=nerf(일반 스탯은 반전 없음)", () => {
    const item = find(result, "나서스", "생명력 흡수");
    expect(item.before).toBe("12/18/24%");
    expect(item.after).toBe("10/15/20%");
    expect(item.direction).toBe("nerf");
    expect(item.skill).toBe("기본 지속 효과 - 영혼의 포식자");
  });

  it("이렐리아 Q 추가 공격력 계수 — 70%⇒80%=buff", () => {
    const item = find(result, "이렐리아", "피해량");
    expect(item.before).toContain("70%");
    expect(item.after).toContain("80%");
    expect(item.direction).toBe("buff");
  });

  it("폭풍갈퀴(아이템) 공격 속도 — 20%⇒25%=buff", () => {
    const item = find(result, "폭풍갈퀴", "공격 속도");
    expect(item.before).toBe("20%");
    expect(item.after).toBe("25%");
    expect(item.direction).toBe("buff");
    expect(item.section).toBe("item");
    expect(item.skill).toBeNull();
  });

  it("그레이브즈 — 서술 요약은 '상향'을 언급하지만 수치가 명확히 감소하면 수치가 우선해 nerf", () => {
    // blockquote 서술: "그레이브즈는 ... 간접적인 상향을 받아 ... 능력을 조금 덜어내고자 합니다"
    // (상향은 과거 패치 회고 — 이번 패치의 실제 변경은 수치상 전부 하향이다)
    const item = find(result, "그레이브즈", "최초 피해량");
    expect(item.before).toContain("65%");
    expect(item.after).toContain("55%");
    expect(item.direction).toBe("nerf");
  });

  it("챔피언 수가 26.17 실측(정규 14명 + 클래식 재분류 18명 = 32명) 그대로다", () => {
    // 라운드 2: "클래식" 섹션 내부의 h4 범주 라벨(챔피언/아이템)로 하위 항목을 champion/item으로
    // 재분류한다(이전엔 전부 system으로 뭉뚱그려져 ST-08 매칭에서 빠졌었다). 26.17 클래식 섹션은
    // "챔피언" 라벨 아래 18명(아리~트위치)이 나열된다.
    const champions = new Set(result.items.filter((i) => i.section === "champion").map((i) => i.entity));
    expect(champions.size).toBe(32);
    expect(champions.has("아우렐리온 솔")).toBe(true); // 정규 챔피언 섹션(h3 기반)
    expect(champions.has("베인")).toBe(true);
    expect(champions.has("아리")).toBe(true); // 클래식 섹션 재분류(h4/p>strong 기반)
    expect(champions.has("트위치")).toBe(true);
  });

  // 2026-09-20 명세 변경: 「리글의 랜턴과 야생의 섬광」은 클래식 아이템 블록에서 "활력증진의 펜던트"
  // 뒤에 자기 소개 문단을 달고 나오는 **별개 아이템**인데, 한 블록에 엔티티가 여럿일 때 첫 엔티티에
  // 전부 붙던 결함 때문에 3줄이 펜던트의 스킬로 들어가 있었다(아래 "한 블록 안의 엔티티 경계" 참고).
  it("아이템 수가 26.17 실측(정규 2종 + 클래식 재분류 2종 = 4종) 그대로다", () => {
    const items = new Set(result.items.filter((i) => i.section === "item").map((i) => i.entity));
    expect(items).toEqual(
      new Set(["폭풍갈퀴", "갈라진 하늘", "활력증진의 펜던트", "리글의 랜턴과 야생의 섬광"])
    );
  });

  it("클래식 섹션의 룬/체계 그룹은 system 섹션에 subsection으로 표기된다", () => {
    const runeItems = result.items.filter((i) => i.entity === "체력 재생 정수");
    expect(runeItems.length).toBeGreaterThan(0);
    expect(runeItems.every((i) => i.section === "system" && i.subsection === "rune")).toBe(true);

    const mechanicsItems = result.items.filter((i) => i.entity === "챔피언 변경");
    expect(mechanicsItems.length).toBeGreaterThan(0);
    expect(mechanicsItems.every((i) => i.section === "system" && i.subsection === "system")).toBe(true);
  });

  it("클래식 섹션에서 아리(첫 챔피언 엔트리)의 스킬/스탯이 blockquote 서술로 오염되지 않는다", () => {
    const item = result.items.find((i) => i.entity === "아리" && (i.stat ?? "").includes("체력"));
    expect(item).toBeDefined();
    expect(item?.skill).toBe("기본 능력치");
    expect(item?.section).toBe("champion");
  });

  it("최상단 총평 문단을 summary로 채택한다", () => {
    expect(result.summary).not.toBeNull();
    expect(result.summary).toContain("나서스와 베인을 하향");
  });

  it("h2 섹션 제목을 문서 순서대로 sections에 기록한다(스킵 섹션 포함)", () => {
    expect(result.sections[0]).toBe("패치 하이라이트");
    expect(result.sections).toContain("챔피언");
    expect(result.sections).toContain("아이템");
    expect(result.sections).toContain("아레나");
  });

  it("아레나·무작위 총력전·스킨은 other 섹션으로 분리되고, 챔피언 섹션 항목이 섞이지 않는다", () => {
    const otherItems = result.items.filter((i) => i.section === "other");
    expect(otherItems.length).toBeGreaterThan(0);
    // 아레나 섹션 자체의 밸런스 항목(암베사 등)이 other로 잘 들어온다.
    expect(otherItems.some((i) => i.entity === "암베사")).toBe(true);
    // "챔피언" 섹션(정규 밸런스)의 아우렐리온 솔 항목은 other로 새지 않는다. 다만 르블랑처럼
    // "챔피언" 섹션과 "아레나" 섹션 양쪽에서 각각 독립적으로(정규 밸런스 + 아레나 전용 밸런스)
    // 다뤄지는 챔피언은 실제로 두 섹션 모두에 항목을 남기는 게 정상이다(아래 별도 검증).
    expect(otherItems.some((i) => i.entity === "아우렐리온 솔")).toBe(false);
  });

  it("아레나 전용 밸런스는 챔피언 섹션과 별개 항목으로 other에 남는다(르블랑처럼 양쪽에 등장 가능)", () => {
    const championLeblanc = result.items.filter((i) => i.section === "champion" && i.entity === "르블랑");
    const otherLeblanc = result.items.filter((i) => i.section === "other" && i.entity === "르블랑");
    expect(championLeblanc.length).toBeGreaterThan(0);
    expect(otherLeblanc.length).toBeGreaterThan(0);
    // 두 섹션의 id는 section이 다르므로 절대 충돌하지 않는다(카운터 키가 section:slug 단위).
    expect(new Set([...championLeblanc, ...otherLeblanc].map((i) => i.id)).size).toBe(
      championLeblanc.length + otherLeblanc.length
    );
  });

  it("수치·서술 모두 파싱 불가한 항목도 버리지 않고 direction:'unknown'·stat null로 남긴다(누락 0)", () => {
    const unknownItems = result.items.filter((i) => i.direction === "unknown");
    expect(unknownItems.length).toBeGreaterThan(0);
    for (const item of unknownItems) {
      expect(item.stat).toBeNull();
      expect(item.before).toBeNull();
      expect(item.after).toBeNull();
      expect(item.summary.length).toBeGreaterThan(0);
    }
  });

  it("항목 id는 patch:section:entitySlug:contentHash8 형태(위치가 아니라 내용 기반)이고 전체가 유일하다", () => {
    const ids = result.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const aurelionQ = find(result, "아우렐리온 솔", "초당 마나 소모량");
    expect(aurelionQ.id).toMatch(/^note:26\.17:champion:aurelionsol:[0-9a-f]{8}(-\d+)?$/);
  });

  it("동일 HTML을 두 번 파싱해도 id가 완전히 동일하다(안정성)", () => {
    const again = parsePatchNotes(FIXTURE_17, { patch: "26.17", sourceUrl: SOURCE_URL_17 });
    expect(again.items.map((i) => i.id)).toEqual(result.items.map((i) => i.id));
  });

  it("변형 HTML 앞쪽에 항목을 하나 삽입해도 나머지 항목의 id는 그대로다(내용 기반 id 안정성)", () => {
    // scope-critic 지적: 예전엔 id가 "문서 순서 카운터"였다 — 라이엇이 패치노트를 정정
    // 재배포해 앞쪽에 항목이 추가되면 뒤 항목들의 순서 카운터가 전부 밀려 matchedNoteId·LLM
    // 캐시가 오귀속됐다. 챔피언 섹션 맨 앞(아우렐리온 솔 블록 바로 앞)에 완전히 새로운 챔피언
    // 블록 하나를 끼워 넣은 변형 HTML을 다시 파싱해, 기존 항목들의 id가 삽입 전과 완전히
    // 동일한지 검증한다.
    const $ = cheerio.load(FIXTURE_17);
    const container = $("#patch-notes-container");
    const aurelionBlock = container.find("h3.change-title#patch-aurelionsol").closest(".content-border");
    expect(aurelionBlock.length).toBe(1);

    const injected = $(
      '<div class="content-border"><div class="patch-change-block white-stone accent-before"><div>' +
        '<h3 class="change-title" id="patch-inserted-decoy">삽입된 디코이</h3>' +
        '<h4 class="change-detail-title ability-title">Q - 디코이 스킬</h4>' +
        "<ul><li><strong>피해량</strong>: 10 ⇒ <strong>20</strong></li></ul>" +
        "</div></div></div>"
    );
    aurelionBlock.before(injected);

    const mutatedHtml = $.html();
    const mutatedResult = parsePatchNotes(mutatedHtml, { patch: "26.17", sourceUrl: SOURCE_URL_17 });

    const originalNonAurelion = result.items.filter((i) => i.entity !== "아우렐리온 솔");
    const mutatedNonAurelion = mutatedResult.items.filter(
      (i) => i.entity !== "아우렐리온 솔" && i.entity !== "삽입된 디코이"
    );
    expect(mutatedNonAurelion.map((i) => i.id)).toEqual(originalNonAurelion.map((i) => i.id));

    // 아우렐리온 솔 자신의 항목 id도 삽입 이전과 동일(내용이 안 바뀌었으므로).
    const originalAurelion = result.items.filter((i) => i.entity === "아우렐리온 솔");
    const mutatedAurelion = mutatedResult.items.filter((i) => i.entity === "아우렐리온 솔");
    expect(mutatedAurelion.map((i) => i.id)).toEqual(originalAurelion.map((i) => i.id));

    // 삽입된 디코이 자신은 새 id를 갖고, 다른 어떤 id와도 충돌하지 않는다.
    const decoyItem = mutatedResult.items.find((i) => i.entity === "삽입된 디코이");
    expect(decoyItem).toBeDefined();
    expect(new Set(mutatedResult.items.map((i) => i.id)).size).toBe(mutatedResult.items.length);
  });

  it("h3 앵커가 있는 항목(정규 챔피언/아이템)은 anchorKind='entity'로 sourceUrl#{h3 id}를 가진다", () => {
    const item = find(result, "아우렐리온 솔", "초당 마나 소모량");
    expect(item.anchorUrl).toBe(`${SOURCE_URL_17}#patch-aurelionsol`);
    expect(item.anchorKind).toBe("entity");
  });

  it("h3 앵커가 없는 system 항목(버그 수정 목록)은 anchorKind='section'으로 섹션 헤더(h2) 앵커를 쓴다", () => {
    const bugfixItem = result.items.find((i) => i.summary.includes("ReplayAPI"));
    expect(bugfixItem).toBeDefined();
    expect(bugfixItem?.section).toBe("system");
    expect(bugfixItem?.anchorKind).toBe("section");
    expect(bugfixItem?.anchorUrl).toBe(`${SOURCE_URL_17}#patch-bugfixes-and-qol-changes`);
  });

  it("클래식 재분류로 champion이 된 항목(h3 없음)도 anchorKind='section'이지 'entity'가 아니다", () => {
    // "아리"는 이제 section='champion'이지만 실제 마크업엔 h3 앵커가 없다 — anchorKind는
    // 정직하게 'section'(클래식 섹션 헤더 앵커)이어야 한다. 하류가 이 구분으로 링크 정밀도를
    // 표시할 수 있다(과대 정밀도 주장 방지).
    const item = result.items.find((i) => i.entity === "아리");
    expect(item).toBeDefined();
    expect(item?.section).toBe("champion");
    expect(item?.anchorKind).toBe("section");
    expect(item?.anchorUrl).toBe(`${SOURCE_URL_17}#patch-classic`);
  });

  it("섹션 헤더 앵커조차 없는 경우에만 anchorKind='page'로 sourceUrl 그대로다", () => {
    // "관련 글" 섹션은 h2 자체에 id가 없고(스킵 섹션이라 항목도 안 만든다), 이 fixture에는
    // section/label 앵커가 전부 없는 실제 항목이 없어 직접 재현한다: sourceUrl만 있고 h2 id가
    // 없는 미니 HTML로 page 폴백 경로를 확인한다.
    const html =
      '<main><div id="patch-notes-container">' +
      "<header class=\"header-primary\"><h2>알 수 없는 섹션</h2></header>" +
      '<div class="content-border"><ul><li>앵커 없는 서술형 항목</li></ul></div>' +
      "</div></main>";
    const noAnchorResult = parsePatchNotes(html, { patch: "26.17", sourceUrl: SOURCE_URL_17 });
    expect(noAnchorResult.items).toHaveLength(1);
    expect(noAnchorResult.items[0].anchorKind).toBe("page");
    expect(noAnchorResult.items[0].anchorUrl).toBe(SOURCE_URL_17);
  });
});

describe("parsePatchNotes — 26.16 fixture(다른 패치·다른 부가 섹션 존재)", () => {
  const result = parsePatchNotes(FIXTURE_16, { patch: "26.16", sourceUrl: SOURCE_URL_16 });

  it("26.16에만 있는 독립 '룬' 섹션은 system+subsection:'rune'으로 분류되고 h3 앵커를 그대로 쓴다", () => {
    expect(result.sections).toContain("룬");
    const runeItem = result.items.find((i) => i.entity === "칼날비");
    expect(runeItem).toBeDefined();
    expect(runeItem?.section).toBe("system");
    expect(runeItem?.subsection).toBe("rune");
    expect(runeItem?.anchorKind).toBe("entity"); // 독립 "룬" 섹션은 h3.change-title을 그대로 씀
  });

  it("26.16에만 있는 독립 '체계' 섹션은 system+subsection:'system'으로 분류된다", () => {
    expect(result.sections).toContain("체계");
    const mechanicsItems = result.items.filter((i) => {
      const anchor = i.anchorUrl;
      return anchor.includes("#patch-systems") || (i.section === "system" && i.subsection === "system");
    });
    expect(mechanicsItems.length).toBeGreaterThan(0);
  });

  it("클래식 섹션 재분류로 챔피언 수가 늘어난다(정규 7명 + 클래식 신규/기존 챔피언 20명)", () => {
    const champions = new Set(result.items.filter((i) => i.section === "champion").map((i) => i.entity));
    expect(champions.size).toBe(27);
    expect(champions.has("아지르")).toBe(true); // 정규 챔피언 섹션
    expect(champions.has("아무무")).toBe(true); // 클래식 재분류(h4=엔티티명 자체인 26.16 패턴)
    expect(champions.has("신규 아칼리")).toBe(true); // "신규 " 배지가 붙은 항목도 누락되지 않는다
  });

  it("클래식 섹션의 26.16 특유 패턴(h4=엔티티명 반복)에서도 blockquote 서술 오염이 없다", () => {
    // 아무무 블록은 <blockquote class=\"context\"><p><strong>{긴 서술}</strong></p></blockquote>
    // 로 서술 전체가 굵게 감싸여 있다(26.17엔 없는 패턴) — 이게 skill로 잘못 들어가면 안 된다.
    const items = result.items.filter((i) => i.entity === "아무무");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.skill).not.toContain("상향됩니다"); // 서술문 특유의 문장이 skill에 새면 안 된다
      expect(item.skill === null || item.skill.length < 30).toBe(true); // 정상 스킬 라벨은 짧다
    }
    expect(items.some((i) => i.skill === "기본 지속 효과 - 저주의 손길")).toBe(true);
  });

  it("patch 필드가 모든 항목에 일관되게 26.16으로 채워진다", () => {
    expect(result.items.every((i) => i.patch === "26.16")).toBe(true);
  });
});

describe("fetchPatchNotesHtml", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "patchgap-notes-cache-"));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("캐시가 없으면 fetchImpl을 호출하고 결과를 캐시 파일에 기록한다", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>fixture</html>", { status: 200 }));

    const result = await fetchPatchNotesHtml("26.17", { cacheDir, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.html).toBe("<html>fixture</html>");
    expect(result.sourceUrl).toBe(
      "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-17-notes/"
    );
    expect(fs.readFileSync(path.join(cacheDir, "26.17.html"), "utf8")).toBe("<html>fixture</html>");
  });

  it("캐시 파일이 있으면 fetchImpl을 전혀 호출하지 않는다(재사용)", async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "26.17.html"), "<html>cached</html>", "utf8");
    const fetchImpl = vi.fn(async () => new Response("<html>should-not-be-used</html>", { status: 200 }));

    const result = await fetchPatchNotesHtml("26.17", { cacheDir, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.html).toBe("<html>cached</html>");
  });

  it("--force 상당 옵션(force:true)이면 캐시가 있어도 재요청한다", async () => {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "26.17.html"), "<html>stale</html>", "utf8");
    const fetchImpl = vi.fn(async () => new Response("<html>fresh</html>", { status: 200 }));

    const result = await fetchPatchNotesHtml("26.17", {
      cacheDir,
      force: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.html).toBe("<html>fresh</html>");
  });

  it("404면 아직 발표되지 않은 패치라는 의미의 명확한 에러를 던진다", async () => {
    const fetchImpl = vi.fn(async () => new Response("not found", { status: 404 }));

    await expect(
      fetchPatchNotesHtml("99.99", { cacheDir, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow(/404/);
  });

  it("그 외 실패 상태코드는 HTTP 상태를 포함한 에러를 던진다", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));

    await expect(
      fetchPatchNotesHtml("26.17", { cacheDir, fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow(/500/);
  });
});

// ── before===after 항목 제거 (2026-09-18, 채점 라운드1 ST-6) ─────────────────────
// 실측: 26.18 "카시오페아 E - 쌍독니 전체 주문력 계수: 65% ⇒ 65%"가 항목으로 살아남아 대조표에
// "공지-불일치" 배지를 달고 나갔다. 값이 같으면 선언이 아니다 — 짝지을 방향이 없다.
describe("parsePatchNotes — 값이 바뀌지 않은 'A ⇒ A' 항목은 내보내지 않는다", () => {
  it("before와 after가 같은 줄은 items에서 빠지고, 다른 줄은 그대로 남는다", () => {
    const $ = cheerio.load(FIXTURE_17);
    const container = $("#patch-notes-container");
    const aurelionBlock = container.find("h3.change-title#patch-aurelionsol").closest(".content-border");
    aurelionBlock.before(
      $(
        '<div class="content-border"><div class="patch-change-block white-stone accent-before"><div>' +
          '<h3 class="change-title" id="patch-same-decoy">동일값 디코이</h3>' +
          '<h4 class="change-detail-title ability-title">E - 디코이 스킬</h4>' +
          "<ul><li><strong>전체 주문력 계수</strong>: 65% ⇒ <strong>65%</strong></li>" +
          "<li><strong>피해량</strong>: 10 ⇒ <strong>20</strong></li></ul>" +
          "</div></div></div>"
      )
    );
    const parsed = parsePatchNotes($.html(), { patch: "26.17", sourceUrl: SOURCE_URL_17 });
    const decoy = parsed.items.filter((i) => i.entity === "동일값 디코이");
    expect(decoy.map((i) => i.stat)).toEqual(["피해량"]);
    expect(parsed.items.some((i) => i.before !== null && i.before === i.after)).toBe(false);
  });
});

describe("modeScope — 적용 범위 새기기(2026-09-19 근본수정)", () => {
  const parsed17 = parsePatchNotes(FIXTURE_17, { patch: "26.17", sourceUrl: SOURCE_URL_17 });
  const parsed16 = parsePatchNotes(FIXTURE_16, { patch: "26.16", sourceUrl: SOURCE_URL_16 });

  it("클래식 섹션 항목은 section이 champion이어도 modeScope='classic'이다", () => {
    const classicItems = parsed17.items.filter((i) => i.anchorUrl.endsWith("#patch-classic"));
    expect(classicItems.length).toBeGreaterThan(50);
    expect(classicItems.every((i) => i.modeScope === "classic")).toBe(true);
    // section은 **바뀌지 않는다** — 노트 id가 section을 포함하므로 바꾸면 기존 델타의
    // matchedNoteIds가 전부 댕글링된다(BRAINTRUST-root-fix-2026-09-19.md §4).
    expect(classicItems.some((i) => i.section === "champion")).toBe(true);
  });

  it("아레나·아수라장도 모드로 새겨진다", () => {
    const arena = parsed17.items.filter((i) => i.anchorUrl.endsWith("#patch-arena"));
    expect(arena.length).toBeGreaterThan(0);
    expect(arena.every((i) => i.modeScope === "arena")).toBe(true);
    const aram = parsed17.items.filter((i) => i.anchorUrl.includes("#patch-aram"));
    expect(aram.length).toBeGreaterThan(0);
    expect(aram.every((i) => i.modeScope === "aram")).toBe(true);
  });

  it("26.16도 같은 규칙으로 새겨진다(클래식 패턴이 다른 패치)", () => {
    const classic16 = parsed16.items.filter((i) => i.anchorUrl.endsWith("#patch-classic"));
    expect(classic16.length).toBeGreaterThan(50);
    expect(classic16.every((i) => i.modeScope === "classic")).toBe(true);
  });

  it("SR 챔피언·아이템 항목은 core다 — 이들만 짝짓기 자격을 갖는다", () => {
    const core = parsed17.items.filter((i) => i.modeScope === "core");
    expect(core.length).toBeGreaterThan(0);
    expect(core.every((i) => !i.anchorUrl.includes("#patch-classic"))).toBe(true);
    // 엔티티 앵커(h3)를 가진 항목은 전부 core여야 한다 — 구조 신호와 제목 신호의 교차 확인.
    const entityAnchored = parsed17.items.filter((i) => i.anchorKind === "entity");
    expect(entityAnchored.length).toBeGreaterThan(0);
    expect(entityAnchored.every((i) => i.modeScope === "core")).toBe(true);
  });
});

describe("모르는 섹션의 안전한 기본값 — 새 모드가 SR 짝짓기에 닿지 않는다(2026-09-19)", () => {
  // scope-critic 질문: 라이엇이 새 모드(예: 우르프)를 추가하면 mode-scope 규칙표에 없어 core로
  // 읽히는데, 그러면 원래 버그가 재발하는가? **재발하지 않는다** — 모르는 h2 제목은
  // resolveSectionStrategy의 기본값 `section:"system"`으로 떨어지고, entity-match는
  // champion|item 버킷만 만들므로 SR 델타와 짝지어질 경로가 없다. 오귀속이 가능했던 것은
  // "클래식"이 **명시적으로** 하위 라벨을 champion/item으로 재분류하는 분기를 갖고 있었기
  // 때문이다. 이 테스트는 그 안전한 기본값이 유지되는지를 고정한다.
  //
  // 남는 잔여 위험은 하나다: 그런 노트가 `system` 섹션으로 LLM 후보 풀에 들어간다(체계·버그
  // 수정 노트와 구분할 구조 신호가 없다). 커밋된 데이터에 대한 불변식 검사
  // (notes-invariants.test.ts)가 champion/item 누출만 잡는다는 한계도 함께 기록해 둔다.
  const UNKNOWN_MODE_HTML = `
    <div id="patch-notes-container">
      <header id="patch-mystery-mode"><h2>정체불명 모드</h2></header>
      <div class="content-border">
        <h4 class="change-detail-title">챔피언</h4>
        <p><strong>아리</strong></p>
        <ul><li>기본 공격력: 55 ⇒ 60</li></ul>
      </div>
    </div>`;

  it("모르는 섹션의 항목은 champion이 아니라 system이 된다(짝짓기 대상 밖)", () => {
    const parsed = parsePatchNotes(UNKNOWN_MODE_HTML, { patch: "26.19", sourceUrl: SOURCE_URL_17 });
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(parsed.items.every((i) => i.section === "system")).toBe(true);
  });

  it("실제 패치 3종 파싱은 예외 없이 끝난다(교차 단언이 정상 데이터를 막지 않는다)", () => {
    expect(() => parsePatchNotes(FIXTURE_16, { patch: "26.16", sourceUrl: SOURCE_URL_16 })).not.toThrow();
    expect(() => parsePatchNotes(FIXTURE_17, { patch: "26.17", sourceUrl: SOURCE_URL_17 })).not.toThrow();
  });
});

// ── 한 블록에 엔티티가 여럿일 때(2026-09-20 사용자 지적) ─────────────────────────────────────
// 실측 결함: 26.18 「클래식」은 챔피언 12명이 `div.content-border` **한 블록**에 들어 있는데,
// 파서가 "첫 라벨 = 엔티티, 그 뒤는 전부 스킬"로 읽어 65줄 전부를 첫 챔피언 "피오라"에 귀속시켰다.
// 갈리오·뽀삐 … 이름은 `currentSkill`에 담겼다가 다음 라벨에 덮여 **어디에도 남지 않았다** —
// 화면에는 소유자 없는 스킬 줄만 떴다. 엔티티 경계는 자기 소개 문단(blockquote.context)이 준다.
const MULTI_ENTITY_HTML = [
  '<div id="patch-notes-container">',
  '<header class="header-primary"><h2 id="patch-classic">클래식</h2></header>',
  '<div class="content-border"><div class="white-stone accent-before"><div>',
  '<blockquote class="blockquote context"><p>클래식 세 번째 패치입니다.</p></blockquote>',
  '<h4 class="change-detail-title">챔피언</h4>',
  "<p><strong>피오라</strong></p>",
  '<blockquote class="blockquote context"><p>클래식 피오라가 돌아왔습니다.</p></blockquote>',
  "<p><strong>Q - 찌르기</strong></p>",
  "<ul><li>피오라가 돌진합니다.</li></ul>",
  '<hr class="divider">',
  "<p><strong>갈리오</strong></p>",
  '<blockquote class="blockquote context"><p>클래식 갈리오입니다.</p></blockquote>',
  "<p><strong>기본 지속 효과 - 룬 피부</strong></p>",
  "<ul><li>갈리오는 주문력을 얻습니다.</li></ul>",
  "<p><br><strong>W - 방벽</strong></p>",
  "<ul><li><strong>방어력</strong>: 10 ⇒ <strong>20</strong></li></ul>",
  "</div></div></div>",
  "</div>",
].join("");

describe("parsePatchNotes — 한 블록 안의 엔티티 경계", () => {
  const parsed = parsePatchNotes(MULTI_ENTITY_HTML, {
    patch: "26.18",
    sourceUrl: "https://www.leagueoflegends.com/ko-kr/news/game-updates/league-of-legends-patch-26-18-notes/",
  });

  it("소개 문단을 데리고 나온 라벨이 새 엔티티를 연다 — 두 번째 챔피언 줄이 첫 챔피언에 붙지 않는다", () => {
    expect(parsed.items.map((i) => i.entity)).toEqual(["피오라", "갈리오", "갈리오"]);
  });

  it("엔티티가 바뀌면 직전 스킬이 새 엔티티의 첫 줄로 새지 않는다", () => {
    const gallio = parsed.items.filter((i) => i.entity === "갈리오");
    expect(gallio.map((i) => i.skill)).toEqual(["기본 지속 효과 - 룬 피부", "W - 방벽"]);
    expect(parsed.items.some((i) => i.skill === "갈리오")).toBe(false);
  });

  it("범주 라벨(챔피언)은 엔티티가 되지 않는다", () => {
    expect(parsed.items.some((i) => i.entity === "챔피언")).toBe(false);
  });

  it("h3로 엔티티가 확정된 표준 블록에는 적용하지 않는다 — 블록 안 소개 문단이 엔티티를 빼앗지 않는다", () => {
    const $ = cheerio.load(FIXTURE_17);
    const container = $("#patch-notes-container");
    const block = container.find("h3.change-title#patch-aurelionsol").closest(".content-border");
    block.before(
      $(
        '<div class="content-border"><div class="patch-change-block white-stone accent-before"><div>' +
          '<h3 class="change-title" id="patch-h3-owner">h3 소유자</h3>' +
          "<p><strong>가짜 엔티티</strong></p>" +
          '<blockquote class="blockquote context"><p>소개 문단처럼 생긴 문단.</p></blockquote>' +
          "<ul><li><strong>피해량</strong>: 10 ⇒ <strong>20</strong></li></ul>" +
          "</div></div></div>"
      )
    );
    const result = parsePatchNotes($.html(), { patch: "26.17", sourceUrl: SOURCE_URL_17 });
    expect(result.items.some((i) => i.entity === "가짜 엔티티")).toBe(false);
    expect(result.items.find((i) => i.entity === "h3 소유자")?.skill).toBe("가짜 엔티티");
  });
});
