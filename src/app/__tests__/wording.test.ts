// src/app/__tests__/wording.test.ts
// 렌더 문구 게이트(트랙 B ST-12 — lol-S18·lol-S19·parity-S27·pubg-S14·parity-S12). 문장은 함수로 고정할 수 없어 소스에서 막는다.
// 각 금지 문자열은 리뷰가 실측한 그 문장이다 — 다시 쓰면 같은 결함이 돌아온다.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("렌더 문구", () => {
  it("대조표·방법론 안내문에 「왼쪽/오른쪽」 방향어가 없다 — 375폭에서는 위아래로 쌓인다(lol-S18·tft-S14·pubg-S11)", () => {
    for (const rel of [
      "components/compare/LolCompareView.tsx",
      "components/tft/TftCompareView.tsx",
      "app/pubg/compare/page.tsx",
      "app/tft/methodology/page.tsx",
      "app/lol/methodology/page.tsx",
      "app/pubg/methodology/page.tsx",
    ]) {
      expect(read(rel), rel).not.toMatch(/왼쪽에서[^/\n]*오른쪽|오른쪽 표의/);
    }
  });

  it("LoL 방법론 — 픽률 분모는 전체 매치, 승률 분모는 등장 판(lol-S19)", () => {
    const src = read("app/lol/methodology/page.tsx");
    expect(src).not.toMatch(/승률·픽률의 분모는 매치가 아니라/);
    expect(src).toMatch(/픽률·밴률의 분모는/);
  });

  it("PUBG 방법론 — 파일명·API 필드명을 사용자에게 보이지 않는다(parity-S27)", () => {
    const src = read("app/pubg/methodology/page.tsx");
    expect(src).not.toMatch(/meta: "[^"]*\.ts"/);
    expect(src).not.toMatch(/`matchType`/);
    expect(src).not.toMatch(/`\/samples`/);
  });

  it("PUBG 방법론 — 「무기 상세는 판정이 선 무기만」은 사실이 아니다(pubg-S14·parity-S12)", () => {
    expect(read("app/pubg/methodology/page.tsx")).not.toMatch(/무기 상세는 <strong className="text-fg">판정이 선 무기<\/strong>만/);
  });

  it("「탭로」 조사 오류가 소스 어디에도 없다(lol-S30·pubg-S23)", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? (e.name === "__tests__" ? [] : walk(path.join(dir, e.name))) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    const bad = walk(SRC).filter((f) => /지표 탭\$\{.*\}로 나타납니다|탭로 나타납니다/.test(fs.readFileSync(f, "utf8")));
    expect(bad.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("브리핑 탭 머리 — 세 게임 같은 상수(트랙 B ST-10·ST-13, parity-S25·parity-S9)", () => {
  const files = ["components/home/ReleaseNoteStream.tsx", "components/tft/TftBriefing.tsx", "components/pubg/PubgBriefing.tsx"];
  it.each(files)("%s — 패치 내용 머리·Gap 지표 축 제목을 상수로", (rel) => {
    const src = read(rel);
    expect(src).toMatch(/\{CONTENT_TAB_TITLE\}/);
    expect(src).toMatch(/\{GAP_METRIC_AXIS_TITLE\}/);
    expect(src).not.toMatch(/공지에 없는데 움직였습니다/);
  });
  it("LoL 접힌 행에 유형 줄이 있다(parity-S9 — TFT·PUBG 행과 같은 구성)", () => {
    expect(read("components/home/ReleaseNoteRow.tsx")).toMatch(/data-row-type/);
  });
});

describe("수치 축 행 이름 링크 — 세 브리핑이 hrefOf를 넘긴다(트랙 B ST-14, parity-S11·tft-S11)", () => {
  const usesOf = (rel: string) => read(rel).match(/<SubmarineSection\b[\s\S]*?\/>/g) ?? [];
  it.each(["components/home/LolBriefing.tsx", "components/tft/TftBriefing.tsx"])("%s — 모든 사용처가 링크 함수를 넘긴다", (rel) => {
    const uses = usesOf(rel);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) {
      expect(u).toMatch(/hrefOf=/);
      expect(u).not.toMatch(/hrefOf=\{\(\) => null\}/);
    }
  });
  it("PUBG — 관측 브리핑은 링크를 넘긴다(선언만 쌍은 무기 상세 라우트 자체가 없어 null이 정직하다)", () => {
    const uses = usesOf("components/pubg/PubgBriefing.tsx");
    expect(uses.some((u) => /hrefOf=\{\(change\) => \(weaponDetailKeys\.has\(change\.entityKey\) \? weaponHref/.test(u))).toBe(true);
  });
});

describe("패치노트 원문 링크 — 세 브리핑 같은 자리(트랙 B ST-15, parity-S13)", () => {
  it("공용 커버리지 줄이 원문 링크를 소유하고 세 브리핑이 주소를 넘긴다", () => {
    expect(read("components/home/AnnouncedCoverageLine.tsx")).toMatch(/패치노트 원문 보기 ↗/);
    expect(read("components/home/ReleaseNoteStream.tsx")).toMatch(/sourceUrl=\{announcedCoverage\.sourceUrl/);
    expect(read("components/home/LolBriefing.tsx")).toMatch(/sourceUrl: notesTo\?\.meta\.sourceUrl/);
    expect(read("components/tft/TftBriefing.tsx")).toMatch(/sourceUrl=\{notes\.sourceUrl/);
    expect(read("components/pubg/PubgBriefing.tsx")).toMatch(/sourceUrl=\{noteSource\}/);
    expect(read("components/pubg/PubgBriefing.tsx")).not.toMatch(/패치노트 원문 보기 ↗/);
  });
});

describe("대조표·방법론 머리 틀 — 세 게임 같다(트랙 B ST-16, parity-S18·parity-S29)", () => {
  it("PUBG 대조표·방법론 머리에 eyebrow가 없고 대조표는 pt-40이다", () => {
    const compare = read("app/pubg/compare/page.tsx");
    expect(compare).not.toMatch(/eyebrow="PUBG: BATTLEGROUNDS"/);
    expect(compare).toMatch(/flex flex-col gap-6 pt-40 pb-8/);
    expect(read("app/pubg/methodology/page.tsx")).not.toMatch(/eyebrow="PUBG: BATTLEGROUNDS"/);
  });
  it("방법론 H1은 「{게임} — 어떻게 판정하나」", () => {
    expect(read("app/lol/methodology/page.tsx")).toMatch(/리그 오브 레전드 — 어떻게 판정하나/);
    expect(read("app/tft/methodology/page.tsx")).toMatch(/전략적 팀 전투 — 어떻게 판정하나/);
    expect(read("app/pubg/methodology/page.tsx")).toMatch(/\$\{gameLabel\("pubg"\)\} — 어떻게 판정하나/);
  });
  it("PUBG 방법론 표본 고지는 슬롯 안 한 곳(notice 콜아웃 없음)", () => {
    expect(read("app/pubg/methodology/page.tsx")).not.toMatch(/PubgSampleNotice/);
  });
});

describe("상세 골격(트랙 B ST-17 — parity-S22·S23·S24·pubg-S10·S15·S16·tft-S28)", () => {
  const details = ["components/detail/LolItemDetail.tsx", "components/tft/TftUnitDetail.tsx", "components/pubg/PubgWeaponDetail.tsx", "components/pubg/PubgMapDetail.tsx"];
  it.each(details)("%s — 상세 폭은 좁은 폭(9/12 LoL 기준, 사용자 결정 2026-10-11)", (rel) => {
    const src = read(rel);
    expect(src).toMatch(/<Container width="narrow"/);
    expect(src).not.toMatch(/<Container>/);
  });
  it("LoL 상세 패치노트 대조에 「말한 것 N · 말하지 않은 것 N」과 「패치노트가 말한 것」", () => {
    const src = read("components/detail/LolItemDetail.tsx");
    expect(src).toMatch(/말한 것 \{saidCount\} · 말하지 않은 것/);
    expect(src).toMatch(/패치노트가 말한 것/);
  });
  it("PUBG 무기 상세에 렌더 카드가 없다 — 머리 다음이 패치노트 대조", () => {
    expect(read("components/pubg/PubgWeaponDetail.tsx")).not.toMatch(/PubgDetailSplash/);
  });
  it("PUBG 맵 상세 — 지형도는 패치노트 대조 뒤, 판정 규칙 링크 라벨은 세 상세와 같다", () => {
    const src = read("components/pubg/PubgMapDetail.tsx");
    expect(src.indexOf("<PubgDetailSplash")).toBeGreaterThan(src.indexOf('title="패치노트 대조"'));
    expect(src).not.toMatch(/방법론 보기 →/);
    expect(src).toMatch(/판정 규칙 보기 →/);
  });
  it("관측 패널 — 막대 앞 문단 1개, 캡션은 375폭에서 줄바꿈", () => {
    const src = read("components/observation/ObservationPanel.tsx");
    expect(src).toMatch(/\{prose\[0\]\}/);
    expect(src).toMatch(/whitespace-normal text-muted lg:truncate/);
  });
  it("기술통계 화면은 탭 배지를 그리지 않는다", () => {
    expect(read("components/observation/ObservationSection.tsx")).toMatch(/showCounts=\{!descriptive\}/);
  });
});

describe("첫 화면 미공지 상위 — 세 브리핑(트랙 B ST-22, lol-S23·pubg-S8)", () => {
  it.each(["components/home/LolBriefing.tsx", "components/tft/TftBriefing.tsx", "components/pubg/PubgBriefing.tsx"])("%s", (rel) => {
    expect(read(rel)).toMatch(/<GapPreview\b/);
  });
  it("채움 버튼이 아니다 — 주 행동(디스코드) 바인딩을 둘로 만들지 않는다", () => {
    expect(read("components/GapPreview.tsx")).not.toMatch(/bg-accent/);
  });
});

describe("랜딩 확장성 표는 접혀 있다(트랙 B ST-23, lol-S16)", () => {
  it("AdapterMatrix가 details 안에 있다", () => {
    const src = read("app/page.tsx");
    const details = src.indexOf("<details data-adapter-matrix");
    expect(details).toBeGreaterThan(-1);
    expect(src.indexOf("<AdapterMatrix />")).toBeGreaterThan(details);
    expect(src.indexOf("<AdapterMatrix />")).toBeLessThan(src.indexOf("</details>", details));
  });
});

describe("경계 표기 — 세 대조표·상세 머리·세 방법론(트랙 B ST-25, pubg-S13)", () => {
  it.each([
    "components/compare/DeltaTable.tsx",
    "components/tft/TftCompareExplorer.tsx",
    "components/pubg/PubgCompareExplorer.tsx",
    "components/detail/LolItemDetail.tsx",
    "components/tft/TftUnitDetail.tsx",
    "components/pubg/PubgWeaponDetail.tsx",
  ])("%s — 판정 배지 옆에 경계 표기", (rel) => {
    expect(read(rel)).toMatch(/<BoundaryMark \/>/);
  });
  it("세 방법론이 같은 경계 문장(BOUNDARY_RULE)을 쓴다", () => {
    expect(read("components/methodology/StatusDefinitionTable.tsx")).toMatch(/\{BOUNDARY_RULE\}/);
    expect(read("app/tft/methodology/page.tsx")).toMatch(/\{BOUNDARY_RULE\}/);
    expect(read("app/pubg/methodology/page.tsx")).toMatch(/\{BOUNDARY_RULE\}/);
  });
  it("렌더 문장에 「홈 카드」가 없다(ST-10 보완)", () => {
    expect(read("components/methodology/StatusDefinitionTable.tsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")).not.toMatch(/홈 카드/);
  });
});

describe("대조표 마지막 고정 열 = 판정 — 세 게임(트랙 B ST-26, tft-S14·parity-S15)", () => {
  it("TFT 마지막 고정 열은 「판정 · 근거」 하나 — 별도 근거 열이 없다(tft-S13·tft-S14, 2026-10-12 verify-impl S1)", () => {
    // 근거 열을 따로 두면 1280에서 표가 66–136px 넘쳐, 무엇을 고정하든 다른 열이 고정 열 밑에 깔렸다(판정만 고정 → 근거,
    // 근거까지 고정 → 「바뀐 것」). 근거는 고정 판정 칸 안에 있어 375·1280 모두 보인다. 기하 자체는 렌더 실측으로 확인했다.
    const src = read("components/tft/TftCompareExplorer.tsx");
    expect(src).toMatch(/<th className=\{`\$\{thBase\} \$\{pinnedCol\} px-4`\}>판정 · 근거<\/th>/);
    expect(src).not.toMatch(/"근거", "판정"/);
    expect(src).not.toMatch(/evidencePinnedLg|verdictWidth/);
    // 근거 링크가 고정 칸 안에 있다 — 고정 칸(pinnedCell) 뒤에 원문 링크가 온다.
    expect(src).toMatch(/<td className=\{`\$\{pinnedCell\} px-4 py-3`\}>[\s\S]*?원문 ↗[\s\S]*?<\/td>/);
  });
  it("PUBG 이름 칸 아이콘은 375폭에서 숨는다(무기명 잘림 원인, pubg-S11)", () => {
    expect(read("components/pubg/PubgCompareExplorer.tsx")).toMatch(/hideIconOnMobile/);
  });
});

describe("「엔티티」→「대상」 치환 잔재 — 받침 조사(acceptance-critic 발견)", () => {
  // 「엔티티」는 받침이 없고 「대상」은 받침이 있다. 일괄 치환이 「대상를」「대상가」를 남겼다(TFT 방법론 실측).
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  it("src 전역에 「대상를·대상가·대상는·대상와·대상로」가 없다", () => {
    const hits = walk(SRC).filter((f) => /대상(를|가|는|와|로)(?![가-힣])|대상(를|가|는|와)\s/.test(fs.readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("노트 미해소 줄은 탭 라벨과 같은 어휘 「시스템」으로 부른다(parity-S17)", () => {
    for (const rel of ["components/tft/TftCompareView.tsx", "app/tft/methodology/page.tsx"]) {
      expect(read(rel), rel).not.toMatch(/대상이 없는 체계 변경/);
    }
  });
});

describe("내부 용어 「델타」를 렌더 문장에 쓰지 않는다(parity-S16·lol-S22 잔재, 2026-10-12 verify-impl S13)", () => {
  it.each(["components/methodology/GateGrid.tsx", "components/methodology/adapterMatrixData.ts", "app/tft/methodology/page.tsx", "app/lol/methodology/page.tsx", "app/pubg/methodology/page.tsx"])("%s", (rel) => {
    // 주석(// · {/* */} · * 줄)은 빼고 본다 — 렌더되는 문자열만.
    const rendered = read(rel)
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
      .map((l) => l.replace(/\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, ""))
      .join("\n");
    expect(rendered).not.toMatch(/델타/);
  });
});

describe("세 게임 같은 자리 같은 규칙(2026-10-12 verify-impl 축B S2·S7)", () => {
  it("브리핑 히어로 h1 — 어절 단위 줄바꿈(break-keep)과 같은 클래스", () => {
    const cls = "ambient-hero-headline max-w-3xl break-keep";
    for (const rel of ["components/home/HeroSummary.tsx", "components/tft/TftBriefing.tsx", "components/pubg/PubgBriefing.tsx", "components/DeclarationOnly.tsx"]) {
      expect(read(rel), rel).toContain(`<h1 className="${cls}`);
    }
  });
  it("상세 머리 시작 여백 — 네 상세 모두 pt-12", () => {
    for (const rel of ["components/detail/LolItemDetail.tsx", "components/tft/TftUnitDetail.tsx", "components/pubg/PubgWeaponDetail.tsx", "components/pubg/PubgMapDetail.tsx"]) {
      const src = read(rel);
      expect(src, rel).toMatch(/flex flex-col gap-6 pt-12 pb-8/);
      expect(src, rel).not.toMatch(/flex flex-col gap-[36] (pt-40|py-8)/);
    }
  });
});
