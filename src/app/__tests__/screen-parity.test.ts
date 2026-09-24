// src/app/__tests__/screen-parity.test.ts
// 게임 간 화면 동등성 게이트 — `docs/design/UX-BRIEF.md` §8의 계약을 **기계가 지킨다**.
//
// **왜 파일 검사인가**: 이 계약이 깨지는 방식은 "새 게임/새 화면이 공용 컴포넌트를 안 쓰고 자기
// 걸 하나 더 만드는 것"이다. 렌더 테스트는 그걸 못 잡는다 — 자기 걸 만들어도 화면은 그럴듯하게
// 나오기 때문이다. `panelScroll.test.ts`가 같은 형태로 상한을 지키고 있고, 그 테스트의 약점
// (손으로 세는 파일 목록)은 여기서 **게임 목록을 코드에서 읽어** 보완한다 — 게임이 늘면 이
// 테스트가 자동으로 그 게임을 요구한다.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { GAMES } from "@/lib/game";
import { gapHrefOf } from "@/components/StatTiles";
import { COMPARE_FILTERS } from "@/components/compare/toolbarRules";
import { METHODOLOGY_SLOTS } from "@/components/methodology/slots";
import { ENTITY_INDEX_TITLE } from "@/components/EntityIndexSection";

const COMPARE_FILTER_KEYS = COMPARE_FILTERS.map((f) => f.key);

const ROOT = path.resolve(__dirname, "..", "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));

/** 게임 목록은 `lib/game.ts`가 소유한다 — 네 번째 게임을 붙이면 아래 전부가 자동으로 그 게임을 요구한다. */
const GAME_IDS = GAMES.map((g) => g.id);

/**
 * 한 화면이 **거쳐서라도** 쓰는 파일 전부 — `@/…` 임포트를 따라간다.
 *
 * 페이지 파일만 grep하면 "Explorer를 거쳐 공용 도구모음을 쓴다"를 이탈로 오판한다. 반대로
 * 깊이 제한이 없으면 사실상 전 소스가 들어와 게이트가 무의미해진다 — 2단계면 페이지 → Explorer
 * → 공용 조각까지 닿는다.
 */
const closureOf = (entry: string, depth = 2): string => {
  const seen = new Set<string>();
  const resolve = (spec: string): string | null => {
    const base = spec.replace(/^@\//, "src/");
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      if (exists(base + ext)) return base + ext;
    }
    return null;
  };
  const visit = (file: string, left: number): string => {
    if (seen.has(file) || !exists(file)) return "";
    seen.add(file);
    const src = read(file);
    if (left === 0) return src;
    let out = src;
    for (const m of src.matchAll(/from\s+"(@\/[^"]+)"/g)) {
      const hit = resolve(m[1]);
      if (hit) out += "\n" + visit(hit, left - 1);
    }
    return out;
  };
  return visit(entry, depth);
};

describe("§8-1 골격 — 세 게임이 같은 컴포넌트를 쓴다", () => {
  for (const id of GAME_IDS) {
    const home = `src/app/${id}/page.tsx`;

    it(`${id} 홈이 존재한다`, () => {
      expect(exists(home)).toBe(true);
    });

    it(`${id} 홈이 공용 3타일(StatTiles)을 쓴다`, () => {
      // LoL은 HeroSummary를 거쳐 쓴다 — 간접도 인정하되 **자기 타일을 직접 그리는 것**은 막는다.
      const src = read(home);
      const viaHero = src.includes("HeroSummary");
      expect(src.includes("StatTiles") || viaHero).toBe(true);
    });

    it(`${id} 홈이 디스코드 패널을 가진다 — 웹훅은 세 게임 모두 있다`, () => {
      expect(read(home)).toContain("DiscordPanel");
    });

    it(`${id} 홈이 공용 탭(BriefingTabs/BriefingTabBar)을 쓴다`, () => {
      const src = read(home);
      // LoL은 ReleaseNoteStream 안에서 탭 바를 쓴다 — 그 경유를 인정한다.
      const direct = src.includes("BriefingTabs");
      const viaStream = src.includes("ReleaseNoteStream")
        && read("src/components/home/ReleaseNoteStream.tsx").includes("BriefingTabBar");
      expect(direct || viaStream).toBe(true);
    });
  }

  it("탭 바 구현체는 하나뿐이다 — 게임별 사본을 다시 만들지 않는다", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx$/.test(e.name) && rel !== "src/components/BriefingTabs.tsx") {
          if (/role="tablist"[\s\S]{0,400}미공지 Gap/.test(read(rel))) offenders.push(rel);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});

describe("§8-2 본문 행 — 2026-09-23 화면 대조가 잡은 것", () => {
  /**
   * 이 세 케이스는 **렌더로만 드러났다**. 코드 게이트는 전부 통과하고 있었고, 주석은 심지어
   * "뱃지가 맨 앞"이라고 말하고 있었다 — 실제 순서는 그렇지 않았다.
   */
  it("뱃지가 아이콘보다 앞이다 — 세 게임의 뱃지 좌측 시작점이 같아야 한다(§8-1)", () => {
    for (const file of ["src/components/BriefingRowList.tsx", "src/components/home/ReleaseNoteRow.tsx"]) {
      const src = read(file);
      const summary = src.slice(src.indexOf("<summary"));
      const badge = summary.indexOf("<StatusBadge");
      const icon = Math.min(
        ...[summary.indexOf("<CardIcon"), summary.indexOf("iconOf")].filter((i) => i >= 0)
      );
      expect(badge, `${file}: 요약 줄에 뱃지 없음`).toBeGreaterThanOrEqual(0);
      expect(badge, `${file}: 아이콘이 뱃지보다 앞`).toBeLessThan(icon);
    }
  });

  it("접힌 줄이 「N개 항목」을 밝힌다 — 더 있다는 사실이 접힌 채로 사라지지 않는다", () => {
    // LoL은 한 대상에 지표가 여럿일 때(오공 — 전체 승률·정글 승률) 하나만 보여주고 나머지
    // 존재를 알리지 않았다. TFT·PUBG는 `itemCountLabel`로 늘 적고 있었다.
    expect(read("src/components/briefingRows.ts")).toContain("개 항목");
    expect(read("src/components/home/ReleaseNoteRow.tsx")).toContain("개 항목");
  });

  it("세 게임 브리핑이 「공지했는데 움직이지 않았다」를 같은 자리에서 말한다", () => {
    for (const id of GAME_IDS) {
      expect(closureOf(`src/app/${id}/page.tsx`), id).toContain("AnnouncedCoverageLine");
    }
  });
});

describe("§8-1 상세 머리 — 유형과 판정이 머리에 있다", () => {
  it("세 게임 상세가 제목 옆에 유형 라벨과 판정 뱃지를 둔다", () => {
    // PUBG만 둘 다 히어로 아래 카드로 밀려 있었다(2026-09-23 화면 대조 V3) — 같은 자리를
    // 세 게임에서 열면 PUBG만 머리가 비어 보였다.
    const pages = [
      "src/app/lol/item/[id]/page.tsx",
      "src/app/tft/unit/[key]/page.tsx",
      "src/app/pubg/weapon/[key]/page.tsx",
    ];
    for (const page of pages) {
      const src = read(page);
      const aside = src.indexOf("titleAside");
      expect(aside, `${page}: titleAside 없음`).toBeGreaterThanOrEqual(0);
      // 유형 라벨과 뱃지가 그 안에 있어야 한다 — 머리 바깥으로 밀면 이 검사가 실패한다.
      const asideBlock = src.slice(aside, aside + 400);
      expect(asideBlock, `${page}: 머리에 판정 뱃지 없음`).toContain("StatusBadge");
    }
  });
});

describe("§8-3 대조표 — 세 게임이 같은 도구와 골격을 쓴다", () => {
  for (const id of GAME_IDS) {
    const page = `src/app/${id}/compare/page.tsx`;

    it(`${id} 대조표가 존재한다`, () => {
      expect(exists(page)).toBe(true);
    });

    it(`${id} 대조표에 제목(h1)과 이동 경로가 있다`, () => {
      // 실측 이탈(§8-7 #1·#8): h1이 LoL 대조표에 없었고 이동 경로는 형식이 셋이었다.
      // `PageHeader`가 둘을 함께 소유하므로 그것을 쓰는지 본다.
      expect(closureOf(page)).toContain("PageHeader");
    });

    for (const owner of ["CompareToolbar", "NoteNavPanel", "CompareSplit"]) {
      it(`${id} 대조표가 공용 ${owner}을(를) 쓴다`, () => {
        expect(closureOf(page)).toContain(owner);
      });
    }
  }

  it("세 게임의 미공지 타일이 그 게임 대조표의 미공지 칩으로 간다 — 죽은 앵커 0", () => {
    // 실측: TFT 타일만 앵커 없이 `/tft/compare/`로 갔다(그 대조표에 칩이 없었다). 이제 착지점은
    // `gapHrefOf`가 계산하므로 호출부가 틀릴 자리가 없다 — 그래도 **칩 키가 해시와 같다**는
    // 전제는 여기서 잰다(칩 키를 바꾸면 세 타일이 동시에 죽는다).
    expect(COMPARE_FILTER_KEYS).toContain("unannounced");
    for (const id of GAME_IDS) {
      expect(gapHrefOf(id)).toBe(`/${id}/compare/#unannounced`);
    }
  });

  it("타일 → 칩 착지 규약을 세 게임이 같은 훅으로 받는다", () => {
    // 실측(2026-09-23 렌더): LoL·PUBG는 해시를 칩에 반영했는데 **TFT만 「전체」에 떨어졌다**.
    // 세 줄짜리 `useEffect`를 화면마다 손으로 적고 있었기 때문이다 — 링크를 `gapHrefOf`가
    // 소유하듯 받는 쪽도 한 곳이 소유한다.
    for (const id of GAME_IDS) {
      expect(closureOf(`src/app/${id}/compare/page.tsx`), id).toContain("useFilterHash");
    }
  });

  it("상태 칩 목록은 하나뿐이다 — 게임별 사본을 다시 만들지 않는다", () => {
    // 실측(§8-7 #7): 칩이 LoL 4종·PUBG 3종·TFT 0종이었다. 사본이 생기는 형태는 늘 같다 —
    // 화면 파일 안에 `{ key: "unannounced", label: "미공지" }` 배열을 다시 적는 것이다.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(rel);
        } else if (/\.tsx?$/.test(e.name) && rel !== "src/components/compare/toolbarRules.ts") {
          if (/key:\s*"unannounced"[\s\S]{0,60}label:/.test(read(rel))) offenders.push(rel);
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});

describe("§8-1 푸터 — 모든 화면이 같은 컴포넌트를 쓴다", () => {
  for (const id of GAME_IDS) {
    it(`${id}의 모든 라우트가 푸터를 가진다`, () => {
      const dir = path.join(ROOT, "src/app", id);
      const pages: string[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory() && e.name !== "__tests__") walk(full);
          else if (e.name === "page.tsx") pages.push(full);
        }
      };
      walk(dir);
      expect(pages.length).toBeGreaterThan(0);
      // 2026-09-23: 방법론은 `MethodologyLayout`을 거쳐 푸터를 갖는다 — 페이지 파일만 grep하면
      // 그 경유를 이탈로 오판한다. 임포트를 따라가되 게임별 얇은 위임(Tft/PubgFooter)도 인정한다.
      const missing = pages.filter((f) => {
        const rel = path.relative(ROOT, f).split(path.sep).join("/");
        return !/SiteFooter|TftFooter|PubgFooter/.test(closureOf(rel));
      });
      expect(missing).toEqual([]);
    });
  }

  it("게임별 푸터 래퍼는 SiteFooter로 위임한다 — 문구를 두 벌 쓰지 않는다", () => {
    for (const f of ["src/components/tft/shared.tsx", "src/components/pubg/shared.tsx"]) {
      expect(read(f)).toContain("SiteFooter");
    }
  });
});

describe("§8-1 섹션 순서 — 세 브리핑이 같은 순서다", () => {
  /**
   * **왜 순서를 게이트하나**: §8-0이 "섹션 순서"를 반드시 같아야 하는 축으로 못박는다. 지금은
   * 셋이 같지만, 게임을 붙일 때마다 손으로 맞춰 온 것이라 근거가 사람의 기억뿐이었다.
   *
   * **순서를 뒤집지는 않는다**(대조 → 발견). 그것은 구현 비용이 아니라 ①사용자 확정
   * (2026-09-21 "읽는 순서가 맞다") ②출품 스크린샷 등록 때문에 심사 종료 뒤로 미룬 결정이고
   * (UX-BRIEF §2-1 백로그), 이 게이트가 재는 것은 **셋이 같은가**다.
   */
  const orderOf = (src: string, markers: readonly string[]): number[] => markers.map((m) => src.indexOf(m));

  for (const id of GAME_IDS) {
    it(`${id} 브리핑이 타일 → 본문 → 전 대상 색인 → 푸터 순이다`, () => {
      const src = read(`src/app/${id}/page.tsx`);
      // LoL은 타일·본문을 각각 `HeroSummary`·`ReleaseNoteStream`을 거쳐 쓴다(§8-1이 인정한 경유).
      const tiles = src.includes("StatTiles") ? "StatTiles" : "HeroSummary";
      const body = src.includes("BriefingTabs") ? "BriefingTabs" : "ReleaseNoteStream";
      const footer = /SiteFooter|TftFooter|PubgFooter/.exec(src)?.[0] ?? "SiteFooter";
      const positions = orderOf(src, [tiles, body, "EntityIndexSection", footer]);
      // 임포트 줄이 아니라 **JSX 사용 지점**을 본다 — 임포트는 알파벳 순일 수 있다.
      const jsx = src.slice(src.indexOf("return ("));
      const jsxPositions = orderOf(jsx, [tiles, body, "EntityIndexSection", footer]);
      expect(positions.every((p) => p >= 0), `${id}: 구성요소 누락`).toBe(true);
      for (let i = 1; i < jsxPositions.length; i += 1) {
        expect(jsxPositions[i], `${id}: ${i}번째 블록 순서`).toBeGreaterThan(jsxPositions[i - 1]);
      }
    });
  }

  it("탭 순서는 공용 컴포넌트가 소유한다 — 공지 먼저, 미공지 Gap 나중", () => {
    const tabs = read("src/components/BriefingTabs.tsx");
    expect(tabs.indexOf("패치 내역") >= 0 || tabs.indexOf("패치 내용") >= 0).toBe(true);
    expect(tabs.indexOf("미공지 Gap")).toBeGreaterThan(
      Math.max(tabs.indexOf("패치 내역"), tabs.indexOf("패치 내용"))
    );
  });
});

describe("§8-1 전 대상 색인 — 세 브리핑이 같은 슬롯을 쓴다", () => {
  for (const id of GAME_IDS) {
    it(`${id} 브리핑 맨 아래에 전 대상 색인이 있다`, () => {
      // 대조표는 세 게임 모두 **판정된 것만** 올린다. 그래서 판정이 서지 않은 대상의 상세로 가는
      // 길이 여기밖에 없다 — PUBG에서 실제로 그 지적이 나왔고(2026-09-18 P1) 무기 47종 그리드가
      // 그 답이었다. 같은 구멍이 LoL·TFT에도 있었다.
      expect(read(`src/app/${id}/page.tsx`)).toContain("EntityIndexSection");
    });
  }

  it("색인 제목은 하나뿐이다 — 게임이 자기 제목을 다시 쓰지 않는다", () => {
    const owner = read("src/components/EntityIndexSection.tsx");
    expect(owner).toContain(ENTITY_INDEX_TITLE);
    for (const id of GAME_IDS) {
      expect(read(`src/app/${id}/page.tsx`)).not.toContain(`title="${ENTITY_INDEX_TITLE}"`);
    }
  });
});

describe("§8-4 방법론 — 세 게임이 같은 9슬롯을 쓴다", () => {
  for (const id of GAME_IDS) {
    const page = `src/app/${id}/methodology/page.tsx`;

    it(`${id} 방법론이 공용 골격(MethodologyLayout)을 쓴다`, () => {
      // 슬롯 **충족**은 타입이 강제한다(`Record<MethodologySlotKey, …>`). 여기서 막는 것은
      // "골격을 안 쓰고 자기 카드를 손으로 나열하는 것"이다 — 그러면 타입 강제도 함께 빠진다.
      expect(read(page)).toContain("MethodologyLayout");
    });

    it(`${id} 방법론이 SectionCard를 직접 나열하지 않는다`, () => {
      expect(read(page)).not.toMatch(/<SectionCard\b/);
    });
  }

  it("슬롯 목록은 코드가 소유한다 — 화면이 제목을 다시 쓰지 않는다", () => {
    const owner = read("src/components/methodology/slots.ts");
    for (const slot of METHODOLOGY_SLOTS) {
      expect(owner).toContain(slot.title);
    }
    // 게임 화면이 같은 제목을 다시 적으면 한쪽만 고쳐진다.
    for (const id of GAME_IDS) {
      const src = read(`src/app/${id}/methodology/page.tsx`);
      for (const slot of METHODOLOGY_SLOTS) {
        expect(src, `${id}/${slot.key}`).not.toContain(`title="${slot.title}"`);
      }
    }
  });
});

describe("§8-5 상세 — 세 게임이 같은 머리를 쓴다", () => {
  /** 동적 세그먼트(`[id]`·`[key]`)를 가진 라우트 = 상세. */
  const detailPagesOf = (id: string): string[] => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(rel);
        } else if (e.name === "page.tsx" && /\[[^\]]+\]/.test(dir)) {
          out.push(rel);
        }
      }
    };
    walk(`src/app/${id}`);
    return out;
  };

  for (const id of GAME_IDS) {
    it(`${id} 상세가 존재한다`, () => {
      expect(detailPagesOf(id).length).toBeGreaterThan(0);
    });

    it(`${id} 상세가 제목(h1)·이동 경로·액션을 공용 PageHeader로 둔다`, () => {
      // 실측 이탈(§8-7 #1·#8·#18): PUBG 상세엔 h1이 없었고, 이동 경로는 `대조표 › 챔피언 › 오공`
      // (LoL) / `← 대조표 / 유닛`(TFT) / `브리핑 / 대조표 / Groza`(PUBG)로 셋이 달랐다.
      // 「방송 규칙 보기 →」는 LoL 상세에만 있었다.
      for (const page of detailPagesOf(id)) {
        expect(read(page), page).toContain("PageHeader");
        expect(read(page), page).toContain("detailCrumbs");
      }
    });
  }

  it("이동 경로 형식은 하나뿐이다 — 화면이 마디를 직접 조립하지 않는다", () => {
    const owners = new Set(["src/components/Breadcrumb.tsx", "src/lib/breadcrumbs.ts"]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(rel);
        } else if (/\.tsx?$/.test(e.name) && !owners.has(rel)) {
          // 손으로 만든 경로 줄의 표식: `aria-label="위치"` 또는 `← 대조표` 같은 되돌아가기 링크.
          if (/aria-label="위치"|←\s*대조표|←\s*브리핑/.test(read(rel))) offenders.push(rel);
        }
      }
    };
    walk("src/app");
    walk("src/components");
    expect(offenders).toEqual([]);
  });

  it("상세 제목에 지표를 붙이지 않는다 — 라우트 단위가 대상이다(§8-7 #10)", () => {
    // LoL 상세가 `{이름} — {지표}`를 h1에 쓰고 있었고 라우트도 지표 단위였다.
    const lol = read("src/app/lol/item/[id]/page.tsx");
    expect(lol).not.toContain("{delta.entityName} — {displayMetricLabel(delta)}");
    // 정준 라우트는 대상 키다 — 별칭(구 지표 경로)은 `detailRouteSlugs`가 따로 만든다.
    expect(lol).toContain("detailRouteSlugs");
  });
});

describe("§8-5 어휘 — 한 개념에 한 어휘", () => {
  /**
   * 검사 대상 — `.tsx`**와 `.ts`**를 둘 다 본다.
   *
   * 2026-09-23 실측: 문체 게이트가 `.tsx`만 걷다가 `adapterMatrixData.ts`의 반말 한 줄을
   * 놓쳤고, 그 줄은 랜딩 확장성 표에 그대로 렌더되고 있었다(빌드 산출물 렌더로 잡혔다).
   * 사용자 문장은 컴포넌트에만 있지 않다.
   */
  const screens = (): string[] => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(rel);
        } else if (/\.tsx?$/.test(e.name)) out.push(rel);
      }
    };
    walk("src/app");
    walk("src/components");
    return out;
  };

  /**
   * 주석을 걷어낸 본문 — 지난 결정의 기록까지 고쳐 쓰면 근거가 사라진다.
   * **블록 주석을 먼저 지운다**: JSX 주석(`{/* … *\/}`)은 여러 줄에 걸치고 둘째 줄부터는
   * 주석 표식으로 시작하지 않아, 줄 단위로만 거르면 본문으로 오인된다(실측: HeroSummary).
   */
  const codeOf = (f: string) =>
    read(f)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .join("\n");

  it("패치 쌍은 `→`만 쓴다 — `⇒`는 패치노트가 적은 값 전용이다", () => {
    // 패치 번호 두 개를 `⇒`로 잇는 형태만 잡는다(`115 ⇒ 120` 같은 값 표기는 정당하다).
    const bad = screens().filter((f) =>
      /\d+\.\d+\s*⇒\s*\d+\.\d+|\{[^}]*\.from\}\s*⇒|meta\.from\}\s*⇒/.test(codeOf(f))
    );
    expect(bad).toEqual([]);
  });

  it("판정 열 헤더는 `판정`이다 — `상태`를 쓰지 않는다", () => {
    const bad = screens().filter((f) => /^\s*상태\s*$/m.test(codeOf(f)));
    expect(bad).toEqual([]);
  });

  it("내부 용어를 화면에 쓰지 않는다 — `델타 테이블`", () => {
    const bad = screens().filter((f) => />\s*델타 테이블\s*</.test(codeOf(f)));
    expect(bad).toEqual([]);
  });

  it("집계 시각은 KST 포맷이다 — ISO 원문을 화면에 노출하지 않는다", () => {
    // §8-6이 지정한 금지 문자열 4개 중 이것만 게이트가 없었다(2026-09-23 acceptance-critic V5).
    // TFT 푸터가 `2026-09-21T11:22:11.264Z`를 그대로 찍고 있던 것이 실제 사례다 —
    // 값을 JSX에 바로 쓰면(`{generatedAt}`) 이 패턴이 화면에 나간다. `fmtKst`를 거쳐야 한다.
    const bad = screens().filter((f) => {
      const code = codeOf(f);
      // ISO 리터럴 자체, 또는 포맷 없이 시각 값을 **자식으로 렌더**하는 형태.
      // `generatedAt={generatedAt}`는 prop 전달이지 렌더가 아니다 — `=` 뒤는 제외한다
      // (2026-09-23: 좁히기 전 규칙이 푸터 위임 3곳을 오탐했다).
      return (
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(code) ||
        /(?<![=\w])\{\s*generatedAt\s*\}/.test(code)
      );
    });
    expect(bad).toEqual([]);
  });

  /**
   * **문체 게이트**(§8-5 「존댓말 — 사용자에게 보이는 모든 문장」).
   *
   * §8-6의 게이트 목록은 어휘 4종만 적고 문체를 빠뜨렸는데, 실측으로 **TFT 화면 전체가 반말**
   * 이었고(§8-7 #14) 공용 `StatusDefinitionTable`까지 섞여 있었다 — 산문 규칙을 게이트 없이 두면
   * 반드시 드리프트한다는 이 repo의 반복 실패다.
   *
   * **판별**: 종결 `다`가 `니다`·`습니다`가 아닌 것. `다.`로만 잡으면 놓친다 — 실측에서
   * `가른다(18.1 …`, `하나다"`(title 속성), `엔티티다</h1>`가 전부 마침표 없이 빠져나갔다.
   * 반대로 `발동했다</strong>는`처럼 **조사가 이어지는 인용형**은 종결이 아니므로 제외한다.
   * `throw new Error`·`console.*`는 개발자 메시지라 화면 문장이 아니다.
   */
  it("사용자에게 보이는 문장은 존댓말이다 — 반말 종결이 없다", () => {
    const BANMAL = /[^니습]다(?=[.!?"”)]|\s*[—(]|<\/\w+>(?![는은이가을를도와과라며면]))/;
    const DEV_ONLY = /throw new Error|console\./;
    const bad: string[] = [];
    for (const f of screens()) {
      const hits = codeOf(f)
        .split("\n")
        .filter((l) => !DEV_ONLY.test(l) && BANMAL.test(l));
      if (hits.length > 0) bad.push(`${f}: ${hits[0].trim().slice(0, 80)}`);
    }
    expect(bad).toEqual([]);
  });

  it("타일·탭의 미공지 어휘는 `미공지 Gap` 하나다 — 랜딩까지 같은 상수를 쓴다", () => {
    // **상태 뱃지·필터 칩의 「미공지」는 대상이 아니다**(2026-09-23 정정): 그건 판정 어휘이고
    // `display-status.ts`/`format.ts`가 이미 세 게임 공통으로 소유한다. 뱃지가 "미공지 Gap"이라
    // 말하면 오히려 틀린다 — Gap은 **집계 이름**이지 한 관측의 판정이 아니다.
    // 여기서 막는 것은 **타일·탭 라벨의 사본**이다.
    const owners = ["src/components/StatTiles.tsx", "src/components/BriefingTabs.tsx"];
    const bad = screens()
      .filter((f) => !owners.includes(f))
      .filter((f) => /"미공지 Gap"|>\s*미공지 Gap\s*<|패치노트에 없던 변화/.test(codeOf(f)));
    expect(bad).toEqual([]);
  });
});

/**
 * §8-6 모바일 — **390px에서 칸이 무너지지 않는다.**
 *
 * 2026-09-23 렌더 실측(390×844)에서 네 화면이 깨져 있었다. 증상은 전부 같다 — 한 줄 flex/표에서
 * 형제가 전부 `shrink-0`이고 한 칸만 줄어들어, 그 칸의 텍스트가 **세로로 한 글자씩** 쌓였다
 * (`/lol/` 이름 20px · `/tft/compare/` 이름 16px · `/pubg/compare/` 숫자 55px ·
 * `/` 계층 라벨 52px). 1440×900에서는 넷 다 정상이라 데스크톱 렌더 대조로는 안 잡혔다.
 *
 * **이 게이트가 무엇을 못 하는지 먼저 적는다**: vitest는 jsdom이라 **폭을 측정할 수 없다**.
 * 즉 "20px로 눌렸는가"를 여기서 물을 방법이 없고, 물을 수 있는 척하면 통과만 하는 게이트가 된다.
 * 실제 폭 검증은 브라우저가 필요한데 그 의존성은 SCOPE §3에 없다. 그래서 여기서는 **처방의
 * 존재**만 막는다 — 위 네 곳에서 해당 클래스가 지워지면 실패한다. 약하지만 회귀는 잡는다
 * (뱃지 순서·임포트 폐포 게이트와 같은 모양).
 */
describe("§8-6 모바일 — 390px에서 칸이 무너지지 않는다", () => {
  it("LoL 브리핑 행 머리는 줄바꿈되고, 이름 칸은 모바일에서 한 줄을 통째로 쓴다", () => {
    const src = read("src/components/home/ReleaseNoteRow.tsx");
    // 뱃지·아이콘·「N개 항목」이 전부 shrink-0이라, wrap이 없으면 이름 칸만 20px로 눌린다.
    expect(src).toMatch(/<summary className="[^"]*\bflex-wrap\b/);
    // `min-w-*` 임계가 아니라 basis로 접는다 — 뱃지 문구 길이에 따라 행마다 접힘이 갈리지 않게.
    expect(src).toMatch(/\bbasis-full sm:basis-0 sm:flex-1\b/);
  });

  it("대조표의 짧은 라벨·숫자 칸은 nowrap이다 — 표가 넓어져 가로로 스크롤한다", () => {
    // 표는 이미 `overflow-auto`(PANEL_SCROLL_BODY) 안에 있다. min-content가 뷰포트를 넘으면
    // 눌리는 대신 스크롤된다. `min-width` 하한만으로는 못 막는다 — 640÷열수가 내용보다 작다.
    const tft = read("src/components/tft/TftCompareExplorer.tsx");
    expect(tft).toMatch(/font-bold whitespace-nowrap text-fg group-hover:text-accent/);
    expect(tft).toMatch(/추정 원인/);
    expect(tft.match(/whitespace-nowrap/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    const pubg = read("src/components/pubg/PubgCompareExplorer.tsx");
    // 숫자 5열 전부 — 하나라도 빠지면 그 열만 다시 무너진다.
    expect(pubg.match(/text-right font-mono whitespace-nowrap/g)?.length ?? 0).toBe(5);
  });

  it("랜딩 어댑터 표는 라벨만 nowrap이고 산문 칸은 접힌다", () => {
    const src = read("src/components/methodology/AdapterMatrix.tsx");
    expect(src).toMatch(/const HEAD_CLASS = "[^"]*\bwhitespace-nowrap\b/);
    expect(src).toMatch(/align-top font-bold whitespace-nowrap text-fg/);
    expect(src).toMatch(/minWidth: "var\(--table-min\)"/);
    // 본문(산문) 칸에 nowrap을 걸면 표가 3000px가 된다 — 걸려 있으면 실패한다.
    expect(src).toMatch(/const CELL_CLASS = "(?:(?!whitespace-nowrap)[^"])*"/);
  });
});

/**
 * §8-1 행 정렬 — **맨 앞 칸이 고정폭이라 그 뒤가 항상 같은 x에서 시작한다.**
 *
 * 2026-09-24 사용자 지적(스크린샷): 뱃지가 `inline-flex`라 「공지」 54px · 「공지 · 이상 관측」
 * 125px로 폭이 변했고, 맨 앞에 있으니 그 71px 차이가 아이콘·이름·지표를 행마다 밀어냈다.
 * 「뱃지는 행 맨 앞」(§8-1)은 유지하고 **칸만 고정**하는 쪽으로 닫았다 — 계약을 뒤집지 않는다.
 */
describe("§8-1 행 정렬 — 뱃지 칸이 고정폭이다", () => {
  it("세 게임 브리핑 행이 같은 뱃지 슬롯 상수를 쓴다", () => {
    // 폭의 소유자는 하나다 — 화면마다 손으로 적으면 반드시 하나가 어긋난다(이 repo의 결함군).
    for (const f of ["src/components/home/ReleaseNoteRow.tsx", "src/components/BriefingRowList.tsx"]) {
      const src = read(f);
      expect(src).toMatch(/import StatusBadge, \{ BADGE_SLOT \}/);
      expect(src).toMatch(/className=\{BADGE_SLOT\}/);
    }
  });

  it("뱃지가 없는 행도 슬롯은 남긴다 — 그 행만 당겨지지 않게", () => {
    // 「유의한 관측 없음」 묶음은 붙일 판정이 없어 뱃지를 안 그린다. 칸까지 비우면 그 행만
    // 아이콘이 왼쪽으로 당겨진다 — 조건부인 것은 **뱃지**여야 하고 **슬롯**이면 안 된다.
    const src = read("src/components/home/ReleaseNoteRow.tsx");
    const slot = src.slice(src.indexOf("className={BADGE_SLOT}"));
    expect(slot).toMatch(/^className=\{BADGE_SLOT\}>\s*\{headerBadge \? <StatusBadge/);
  });

  it("슬롯 폭(w-36=144px)이 모든 상태 라벨을 담는다", () => {
    // **jsdom은 폭을 못 잰다** — 실제 폭은 브라우저 렌더로 쟀다(최장 125px = 「공지 · 이상 관측」).
    // 여기서 막는 것은 그 실측을 무효로 만드는 변경, 즉 **더 긴 라벨의 추가**다. 글자 수는
    // 픽셀의 근사일 뿐이지만(실측 125px ↔ 공백 포함 10자), 회귀는 이걸로 잡힌다.
    const MAX_LABEL_CHARS = 10;
    const body = read("src/lib/format.ts");
    const block = body.slice(body.indexOf("const STATUS_LABELS"), body.indexOf("export function statusLabel"));
    const labels = [...block.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(5);
    expect(labels.filter((l) => l.length > MAX_LABEL_CHARS)).toEqual([]);
    expect(read("src/components/StatusBadge.tsx")).toMatch(/export const BADGE_SLOT = "w-36 shrink-0"/);
  });

  it("2컬럼 골격의 소유자는 BriefingTabs다 — 페이지가 그리드를 만들지 않는다", () => {
    // 페이지가 그리드를 쥐면 우측 패널이 좌측 **탭 바** 상단에 맞아 카드끼리 어긋난다.
    // 탭 바는 1행, 카드와 사이드는 같은 2행에 서야 한다 — 그 배치는 탭 바 위치를 아는 쪽만 안다.
    const tabs = read("src/components/BriefingTabs.tsx");
    expect(tabs).toMatch(/lg:row-start-1/);
    expect(tabs).toMatch(/lg:col-start-2 lg:row-start-2/);
    for (const g of ["tft", "pubg"]) {
      const page = read(`src/app/${g}/page.tsx`);
      expect(page).toMatch(/<BriefingTabs[\s\S]*?aside=\{/);
      expect(page).not.toMatch(/grid-cols-\[2fr_1fr\]/);
    }
  });
});
