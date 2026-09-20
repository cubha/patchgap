// src/pipeline/match/tft-notes-parser.ts
// TFT 패치노트 파서 — LoL 파서(`patchnotes-parser.ts`)와 **별도 모듈**이다.
//
// 왜 기존 파서를 확장하지 않는가: `PatchNoteItem.id`는 내용 해시이고, 그 id가
// `DeltaRecord.matchedNoteIds`와 LLM 캐시 키(`candidateSetHash`)에 들어간다. 기존 파서의
// 제어 흐름에 TFT 분기를 넣으면 LoL 경로를 건드릴 위험이 생기고, 한 줄만 어긋나도 커밋된
// 판정 산출물과 캐시 866건이 통째로 무효가 된다. 별도 모듈이면 그 위험이 **구조적으로 0**이다.
//
// 마크업 실측(2026-09-20, patch-18-2):
//   - `h3.change-title` **0건** — LoL의 엔티티 앵커가 없다.
//   - `h2[id]` 섹션 = 체계 · 대규모 변경 사항 · 소규모 변경 사항 · 버그 수정 (+ 하이라이트·장식 등)
//   - `h4.change-detail-title` 21건 = 분류(특성 · 유닛 · 증강 · 수호령)
//   - `blockquote.blockquote.context` = 산문 맥락. **항목이 아니다.**
//   - 변경 줄은 중첩 `<ul>` 안에 있다:
//       <li>검은 가시:<ul><li>체력: 175/300/550 ⇒ 175/350/600</li>…</ul></li>
//
// 핵심 난점 — **머리가 항상 엔티티인 것은 아니다**(계획 §2의 "소규모는 앞머리 토큰" 서술을
// 실측이 정정했다. 소규모도 같은 중첩 구조이며, 다른 것은 머리의 성격이다):
//   <li>검은 가시:   …>  머리가 특성 → 머리가 엔티티, 자식은 속성
//   <li>4단계 3성:   …>  머리가 단계 구간 → 머리는 엔티티가 아니고,
//                        자식 「덩굴정령 방어력 무시: …」의 앞머리가 엔티티
// 마크업만으로는 둘을 못 가른다 — DDragon TFT 카탈로그(특성 355 · 유닛 334 · 증강 758 ·
// 아이템 1187)와 **대조**해야 한다. 그래서 카탈로그가 파서의 입력이다.
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import type { PatchNoteItem, PatchId, PatchNoteSection } from "../types";
import {
  contentHash,
  detectKeywordHint,
  parseStatLine,
  resolveDirection,
  slugify,
} from "./patchnotes-parser";

/** DDragon TFT 카탈로그의 한국어 표시명 집합. `tft-catalog.ts`가 빌드 타임에 받아 온다. */
export interface TftCatalog {
  readonly units: readonly string[];
  readonly traits: readonly string[];
  readonly augments: readonly string[];
  readonly items: readonly string[];
}

export type TftEntityKind = "unit" | "trait" | "augment" | "item";

export interface TftEntityResolution {
  entity: string;
  kind: TftEntityKind;
  /** 엔티티명을 걷어낸 나머지 — 「덩굴정령 방어력 무시」→ 「방어력 무시」. */
  stat: string;
}

export interface ParseTftNotesOptions {
  patch: PatchId;
  sourceUrl: string;
  catalog: TftCatalog;
}

export interface TftNotesParseResult {
  items: PatchNoteItem[];
  stats: {
    /** 파싱 대상이 된 h2 섹션 수. */
    sections: number;
    /** `⇒`를 가진 변경 줄 수 — items보다 크거나 같다. */
    lines: number;
    /** 카탈로그에서 엔티티를 못 찾아 버린 줄 수. **숨기지 않는다.** */
    unresolved: number;
  };
}

const ARROW = "\u21d2";

/** 엔티티명 바로 뒤에 올 수 있는 경계 — 공백 또는 구두점. 글자가 이어지면 다른 이름이다. */
const BOUNDARY_AFTER_NAME = /^[\s,，、(（)）·:：\-+/]/;

/** 집계 대상이 아닌 섹션 — 하이라이트·장식 요소·관련 글은 밸런스 변경이 아니다. */
const SKIP_SECTION_KEYWORDS = ["패치 하이라이트", "관련 글", "장식 요소", "이용 안내"];

/** 카탈로그 종류 → `PatchNoteSection`. 엔티티의 **실제 종류**로 정하고 h4 제목은 쓰지 않는다
 *  — h4는 「4단계 3성」처럼 엔티티 종류와 어긋나는 머리를 품을 수 있기 때문이다. */
const SECTION_OF: Record<TftEntityKind, PatchNoteSection> = {
  unit: "champion",
  item: "item",
  trait: "system",
  augment: "system",
};

interface CatalogIndex {
  /** 표시명 → 종류. 긴 이름이 먼저 오도록 정렬해 최장 일치를 보장한다. */
  entries: { name: string; kind: TftEntityKind }[];
  lookup: Map<string, TftEntityKind>;
}

function indexCatalog(catalog: TftCatalog): CatalogIndex {
  const lookup = new Map<string, TftEntityKind>();
  const push = (names: readonly string[], kind: TftEntityKind) => {
    for (const raw of names) {
      const name = raw.trim();
      if (name.length === 0) continue;
      // 먼저 등록된 종류를 유지한다 — 유닛/특성 동명이인은 유닛을 우선(아래 push 순서).
      if (!lookup.has(name)) lookup.set(name, kind);
    }
  };
  push(catalog.units, "unit");
  push(catalog.traits, "trait");
  push(catalog.augments, "augment");
  push(catalog.items, "item");
  const entries = [...lookup.entries()]
    .map(([name, kind]) => ({ name, kind }))
    .sort((a, z) => z.name.length - a.name.length);
  return { entries, lookup };
}

/**
 * 엔티티를 찾을 **탐색 공간**. `⇒` 앞까지 자르고, 거기에 `:`가 있으면 그 앞까지 더 자른다.
 * 콜론이 없는 줄(「완성 아이템 모루 2개 + 12골드 ⇒ …」)은 라벨이 곧 before 값이라 빈 문자열을
 * 돌려준다 — 그런 줄의 stat은 머리 쪽에서 와야 한다.
 */
function labelOf(line: string): string {
  const beforeArrow = line.split(ARROW)[0];
  const colon = beforeArrow.indexOf(":");
  return colon >= 0 ? beforeArrow.slice(0, colon).trim() : "";
}

/** 엔티티 탐색용 — 콜론이 없으면 `⇒` 앞 전체를 본다(평평한 줄의 엔티티가 거기 있다). */
function searchSpaceOf(line: string): string {
  const label = labelOf(line);
  return label.length > 0 ? label : line.split(ARROW)[0].trim();
}

/** `stat: before ⇒ after` 또는 콜론 없는 `before ⇒ after`를 가른다. */
function splitChange(line: string): { stat: string | null; before: string; after: string } | null {
  const parsed = parseStatLine(line);
  if (parsed) return parsed;
  const idx = line.indexOf(ARROW);
  if (idx < 0) return null;
  const before = line.slice(0, idx).trim();
  const after = line.slice(idx + ARROW.length).trim();
  if (before.length === 0 || after.length === 0) return null;
  return { stat: null, before, after };
}

/**
 * 중첩 `<li>` 한 쌍(머리 + 자식 줄)에서 엔티티를 판정한다.
 *
 * 세 가지 모양을 한 함수가 받는다(실측 18.2 기준 ⇒줄 182 중 중첩 88 · 평평 94):
 *   A. 중첩 머리가 엔티티      `<li>검은 가시:<ul><li>체력: … ⇒ …`
 *   B. 중첩 머리가 엔티티 아님  `<li>4단계 3성:<ul><li>덩굴정령 방어력 무시: … ⇒ …`
 *   C. 평평한 줄(머리 없음)     `<li>카밀 스킬 피해량: … ⇒ …`   → `head=null`
 *
 * ① 머리가 카탈로그에 있으면 머리가 엔티티이고 자식 줄의 `:` 앞이 stat이다(A).
 * ② 아니면 줄 라벨에서 **가장 긴 카탈로그 일치**를 찾아 엔티티로 승격한다(B·C)
 *    (유닛명에 공백이 있어서 최장 일치여야 한다 — 「미스 포츈」이 「미스」로 잘리면 안 된다).
 * ③ 둘 다 실패하면 `null`. 머리나 섹션명으로 폴백하지 않는다 — 짝짓기 대상이 못 되는 이름을
 *    엔티티로 올리면 화면에 근거 없는 행이 생긴다(무근거 회색 원칙과 같은 이유). 실제로
 *    「8레벨에서 9레벨 요구 경험치」 같은 체계 변경은 엔티티가 **없는 것이 사실**이고,
 *    그 사실은 `stats.unresolved`로 보고한다.
 */
export function resolveTftEntity(
  head: string | null,
  childLine: string,
  catalog: TftCatalog
): TftEntityResolution | null {
  return resolveWithIndex(head, childLine, indexCatalog(catalog));
}

/**
 * 한 라벨의 **앞머리**에서 카탈로그 엔티티를 떼어낸다. 없으면 null.
 *
 * 이름 뒤는 **경계**여야 한다 — 줄 끝이거나, 공백이거나, 구두점이다. 공백만 허용하면
 * 「경쟁을 넘어서, …」·「카밀(개화) …」 같은 실측 줄을 놓치고, 아무 경계도 안 보면
 * 「나르」가 「나르샤」를 먹는다. 한글·영숫자가 바로 이어지면 그건 다른 이름이다.
 */
function stripEntityPrefix(label: string, index: CatalogIndex): { entity: string; kind: TftEntityKind; rest: string } | null {
  for (const { name, kind } of index.entries) {
    if (!label.startsWith(name)) continue;
    const tail = label.slice(name.length);
    if (tail.length > 0 && !BOUNDARY_AFTER_NAME.test(tail)) continue;
    return { entity: name, kind, rest: tail.replace(/^[\s,，、(（)）·:：-]+/, "").trim() };
  }
  return null;
}

function resolveWithIndex(
  head: string | null,
  childLine: string,
  index: CatalogIndex
): TftEntityResolution | null {
  const label = searchSpaceOf(childLine);
  // 콜론이 있을 때만 라벨이 stat 노릇을 한다 — 없으면 그 자리는 before 값이다.
  const statFromLabel = labelOf(childLine);

  // ① 머리 우선. 머리는 「엔티티」이기도 하고 「엔티티 + 수식」이기도 하다 —
  //    실측 18.2에서 「악의 여단 정기 250개 보상:」·「드레이븐 현상금 사냥꾼:」·
  //    「요정 황금 나비정령 등장 기준치:」가 후자였고, 정확일치만 보면 그 아래 줄이 통째로
  //    버려졌다(96줄 중 약 40줄). 그래서 접두 일치를 쓰고 수식은 stat 앞에 붙인다.
  if (head !== null) {
    const headName = head.trim().replace(/[::]\s*$/, "");
    const fromHead = stripEntityPrefix(headName, index);
    if (fromHead) {
      const stat = [fromHead.rest, statFromLabel].filter((x) => x.length > 0).join(" ");
      return { entity: fromHead.entity, kind: fromHead.kind, stat };
    }
  }

  // ② 머리가 못 풀면 줄 자신의 라벨에서 — 평평한 줄(머리 없음)과 머리가 엔티티가 아닌 경우.
  const fromLabel = stripEntityPrefix(label, index);
  if (fromLabel) return { entity: fromLabel.entity, kind: fromLabel.kind, stat: fromLabel.rest };

  return null;
}

/** `<li>`의 **자기 텍스트**만 — 중첩 `<ul>` 안의 자식 텍스트는 뺀다. */
function ownText($: cheerio.CheerioAPI, li: AnyNode): string {
  const clone = $(li).clone();
  clone.find("ul,ol").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

export function parseTftPatchNotes(html: string, options: ParseTftNotesOptions): TftNotesParseResult {
  const { patch, sourceUrl, catalog } = options;
  const $ = cheerio.load(html);
  const index = indexCatalog(catalog);

  const items: PatchNoteItem[] = [];
  const idCounters = new Map<string, number>();
  let sections = 0;
  let lines = 0;
  let unresolved = 0;

  $("h2[id]").each((_i, h2) => {
    const title = $(h2).text().replace(/\s+/g, " ").trim();
    if (title.length === 0) return;
    if (SKIP_SECTION_KEYWORDS.some((k) => title.includes(k))) return;

    const sectionAnchorId = $(h2).attr("id") ?? null;
    // 섹션 본문 = 이 h2를 품은 header 다음의 형제들(다음 header 전까지).
    const header = $(h2).closest("header");
    const scope = header.length > 0 ? header.nextUntil("header") : $(h2).nextUntil("h2");
    if (scope.length === 0) return;
    sections += 1;

    // 섹션 산문(blockquote.context)은 방향 힌트로만 쓴다 — 항목이 아니다.
    const keywordHint = detectKeywordHint(scope.find("blockquote.context").text() || null);

    // ⇒를 가진 줄을 전부 훑는다. 중첩 자식이면 부모 머리를, 평평한 최상위면 null을 머리로 준다.
    // (중첩 부모 자신은 제외 — 자기 텍스트에는 ⇒가 없고 자식이 따로 잡힌다.)
    scope.find("li").each((_j, li) => {
      if ($(li).children("ul,ol").length > 0) return;
      const text = $(li).text().replace(/\s+/g, " ").trim();
      if (!text.includes(ARROW)) return; // ⇒ 없는 줄은 신규 추가 — before/after를 지어내지 않는다.
      lines += 1;

      const parentLi = $(li).parent().closest("li");
      const head = parentLi.length > 0 ? ownText($, parentLi[0]) : null;

      const resolved = resolveWithIndex(head, text, index);
      if (!resolved) {
        unresolved += 1;
        return;
      }
      const parsedLine = splitChange(text);
      if (!parsedLine) {
        unresolved += 1;
        return;
      }

      const section = SECTION_OF[resolved.kind];
      const stat = resolved.stat.length > 0 ? resolved.stat : parsedLine.stat;
      const { before, after } = parsedLine;
      const direction = resolveDirection(stat, before, after, keywordHint);

      const slug = slugify(resolved.entity);
      const hash = contentHash(null, stat, before, after);
      const counterKey = `${section}:${slug}:${hash}`;
      const occurrence = idCounters.get(counterKey) ?? 0;
      idCounters.set(counterKey, occurrence + 1);
      const id =
        occurrence === 0
          ? `note:tft:${patch}:${section}:${slug}:${hash}`
          : `note:tft:${patch}:${section}:${slug}:${hash}-${occurrence + 1}`;

      items.push({
        id,
        patch,
        section,
        entity: resolved.entity,
        skill: null,
        stat,
        before,
        after,
        direction,
        summary: text,
        anchorUrl: sectionAnchorId ? `${sourceUrl}#${sectionAnchorId}` : sourceUrl,
        anchorKind: sectionAnchorId ? "section" : "page",
        modeScope: "core",
      });
    });
  });

  return { items, stats: { sections, lines, unresolved } };
}
