// src/pipeline/match/patchnotes-parser.ts
// F3: 패치노트 파서 — ko-kr 정적 HTML(cheerio) → PatchNoteItem[] 구조화 + 요약문·원문 anchor 링크.
//
// 관찰한 실제 마크업(2026-09-05, 26.16/26.17 ko-kr 라이브 페이지 실측 — WebFetch/curl, 라운드 2에서
// 추가 관찰):
// - 전체 컨텐츠는 `#patch-notes-container` 아래 **평평한(flat) 형제 시퀀스**다. 섹션별로
//   중첩되지 않는다 — `<header class="header-primary"><h2 id="patch-{slug}">{제목}</h2></header>`
//   가 나온 뒤 그 다음 헤더가 나오기 전까지의 `<div>` 형제들이 그 섹션 소속이다(문서 순서로 직접
//   추적해야 함). **h2 자신이 `id` 속성을 갖는다**(`header` 태그 자체는 id가 없다) — 라운드 2에서
//   앵커 폴백에 씀.
// - 헤더 h2 텍스트: "패치 하이라이트"(스킵) · "챔피언" · "아이템" · "클래식" · "룬"/"체계"(패치별
//   존재 여부 다름 — 26.16엔 독립 h2로 존재, 26.17엔 없음) · "무작위 총력전: 아수라장" · "아레나" ·
//   "시스템 사양 업데이트" · "버그 수정 및 편의성 개선" · "앞으로 나올 스킨 및 크로마" ·
//   "관련 글"(스킵, id 없음).
// - 챔피언/아이템/룬(독립 h2) 섹션의 표준 블록(엔티티 1개 = `div.content-border` 1개):
//     <h3 class="change-title" id="patch-{anchor}">{엔티티명}</h3>
//     <blockquote class="blockquote context"><p>{서술 요약}</p></blockquote>
//     <h4 class="change-detail-title ability-title">{Q/W/E/R/기본 능력치/기본 지속 효과 - 이름}</h4>
//     <ul><li><strong>{스탯명}</strong>: {변경 전} ⇒ <strong>{변경 후}</strong></li></ul>
//   (h4/ul 쌍이 스킬 수만큼 반복. 첫 h4만 blockquote 안에 들어가는 등 중첩이 일관되지 않아
//   `.find("h4.change-detail-title, ul")` 로 문서 순서를 다시 평탄화해서 순회해야 한다 — cheerio는
//   복수 셀렉터라도 문서 순서를 보존한다(실측 확인).)
// - "클래식" 섹션은 h3가 없다. 대신 `<h4 class="change-detail-title">{범주/엔티티명}</h4>` 또는
//   `<p><strong>{라벨}</strong></p>`가 엔티티/스킬 라벨을 대신한다 — **패치마다 하위 표현이 다르다**:
//   26.17은 그룹당 범주 라벨 1회("챔피언"/"아이템"/"룬 및 진척도"/"체계"/"아트"/"버그 수정")만
//   등장하고 이후 각 챔피언은 `<p><strong>{이름}</strong></p>`로만 나온다. 26.16은 "챔피언" 라벨
//   1회 이후 **각 챔피언 이름 자체가 매번 `<h4 class="change-detail-title">`로 반복**된다(예:
//   `<h4 class="change-detail-title"><strong>아무무</strong></h4>`). 두 표현 모두 "라벨이 문서
//   순서로 이어지며, 인식되는 범주 라벨(챔피언/아이템/룬 포함/체계)이 나오면 그 뒤 라벨 없는 블록은
//   직전 범주를 상속한다"는 상태 기계 하나로 통합 처리한다(`classicCategoryFor()` 참고). "아트"·
//   "버그 수정"처럼 인식 안 되는 라벨은 상태를 리셋하지 않고 직전 범주를 유지한다 — 관찰상 이런
//   라벨은 항상 챔피언/아이템/룬/체계 그룹이 전부 끝난 **뒤쪽**에만 나타나 실질적 오분류가 없다
//   (미확인 사항 참고).
// - **blockquote 오염(라운드 2 결함 3)**: 26.16의 클래식 섹션은 blockquote 안의 서술 문단
//   전체를 `<p><strong>...</strong></p>`로 굵게 감싼다(26.17은 감싸지 않음 — 패치 간 마크업
//   드리프트). `p > strong` 라벨 탐색이 이 서술 문단까지 "라벨"로 오인하지 않도록, 라벨/ul 탐색은
//   `blockquote` 조상을 가진 노드를 전부 제외한다.
// - 버그 수정/시스템 사양/스킨 섹션은 라벨이 전혀 없는 `<ul><li>서술문</li></ul>` 뿐이다 — 엔티티를
//   특정할 수 없어 h2 제목을 엔티티 폴백으로 쓴다.
// - 항목 원문 실측: "초당 마나 소모량: 35/40/45/50/55 ⇒ 30/35/40/45/50"(아우렐리온 솔 Q),
//   "생명력 흡수: 12/18/24% ⇒ 10/15/20%"(나서스 패시브), "공격 속도: 20% ⇒ 25%"(폭풍갈퀴, 아이템).
//   h4/p>strong 라벨 요소는 관찰된 두 fixture 어디에도 `id` 속성이 없다(앵커 폴백 ②는 방어적
//   코드로 남겨두지만 현재 데이터로는 발동하지 않는다 — 미확인 사항 참고).
//
// direction 판정 우선순위(구현 결정 — VERIFY-SPEC ST-07.md 참고):
//   1) before/after에서 숫자를 뽑아 원소별 델타가 전부 같은 부호면 그 부호로 buff/nerf 결정.
//      "재사용 대기시간·마나 소모·피해 감소" 등 낮을수록 좋은 스탯(LOWER_IS_BETTER_KEYWORDS)은 반전.
//   2) 델타가 없거나(순변화 0) 부호가 섞이면(=수치로 판단 불가) blockquote 서술 요약에 "상향"만
//      있거나 "하향"만 있으면 그 방향을 쓴다("표기가 있으면 우선"). 단, 서술 요약은 과거 패치를
//      회고하는 문장을 자주 포함해(예: "그레이브즈는 지난 패치에서 상향을 받아 위력을 떨치고
//      있습니다" — 상향은 과거 이야기이고 이번 패치는 그 챔피언을 하향) 숫자 근거가 있을 때는
//      절대 서술 힌트로 덮어쓰지 않는다(실측 반례: 그레이브즈 — 힌트=buff이지만 실제 수치는 전부
//      감소=nerf).
//   3) 둘 다 없으면(before/after 자체가 없거나 숫자도 힌트도 없음) 'adjust'(값은 있는데 방향
//      불명) 또는 'unknown'(값 자체를 못 뽑음 — 라인에 "⇒"가 아예 없는 서술형).
//
// anchorUrl 정밀도(라운드 2 추가) — PatchNoteItem.anchorKind로 구분:
//   1) 엔티티 자신의 h3 앵커(id)가 있으면 그것 — anchorKind="entity" (챔피언/아이템/독립 h2 룬 섹션).
//   2) 없으면 그 항목이 속한 섹션 헤더(h2)의 id — anchorKind="section" (클래식 재분류·시스템류).
//   3) 그것도 없으면(직전 h4/p>strong 라벨 요소에 id가 있는 경우의 방어적 폴백, 관찰상 미발동)
//      그 라벨의 id — anchorKind="section"(엔티티 고유 앵커가 아니므로 section과 동급 취급).
//   4) 전부 없으면 sourceUrl 그대로 — anchorKind="page".
//
// id 안정성(라운드 2 결함 1): 기존에는 `note:{patch}:{section}:{slug}:{문서순서 카운터}` 였으나,
// 라이엇이 패치노트를 정정 재배포해 앞쪽에 항목이 추가/삭제되면 뒤 항목들의 순서 카운터가 전부
// 밀려 ST-08의 matchedNoteId·LLM 캐시가 엉뚱한 항목에 오귀속된다. 그래서 콘텐츠 해시 기반으로
// 바꿨다: `note:{patch}:{section}:{slug}:{hash8}` (hash8 = sha256(`${skill}|${stat}|${before}|
// ${after}`)의 앞 8자). 완전히 같은 절(skill/stat/before/after 전부 동일)이 여러 번 나오면
// `-2`/`-3`... 접미를 붙인다 — 이 경우엔 문서 순서가 유일한 구분 근거이므로 여전히 순서에 약간
// 의존하지만(예: 스탯 없는 서술형 li가 대량으로 같은 해시를 공유하는 버그 수정 섹션), 그 영역은
// stat이 없어 애초에 ST-08 매칭 대상이 아니라 실질적 영향이 없다(VERIFY-SPEC 미확인 사항 참고).

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PatchId, PatchNoteItem, PatchNoteSection } from "../types";
import { DATA_ROOT } from "../shared/paths";

/** 낮을수록 좋은 스탯 — 값이 늘면 nerf, 줄면 buff로 반전한다(그 외 스탯은 늘면 buff). */
const LOWER_IS_BETTER_KEYWORDS = ["재사용 대기시간", "마나 소모", "기력 소모", "피해 감소", "비용"];

/** "{라벨}: {before} ⇒ {after}" 형태의 원문 한 줄을 분해한다. 매치 실패 시 null(서술형 취급). */
const STAT_LINE_PATTERN = /^(.+?):\s*(.+?)\s*⇒\s*(.+)$/;

const ARROW = "⇒";

// ─── URL 조립 ──────────────────────────────────────────────────────────────

/**
 * 패치노트 정규 URL을 조립한다. 실측(RESEARCH-patchgap-2026-09-05.md §1):
 * `https://www.leagueoflegends.com/{locale}/news/game-updates/league-of-legends-patch-{XX-YY}-notes/`
 * 단축형("patch-26-17-notes"가 아니라 "league-of-legends-patch-26-17-notes")은 404였다.
 */
export function buildPatchNotesUrl(patch: PatchId, locale = "ko-kr"): string {
  const slug = patch.replace(/\./g, "-");
  return `https://www.leagueoflegends.com/${locale}/news/game-updates/league-of-legends-patch-${slug}-notes/`;
}

export interface FetchPatchNotesOptions {
  /** 기본 "ko-kr". */
  locale?: string;
  /** 테스트 주입용. 기본값 전역 fetch. */
  fetchImpl?: typeof fetch;
  /** 캐시 디렉토리 오버라이드(테스트 주입용). 기본 data/cache/notes/. */
  cacheDir?: string;
  /** true면 캐시를 무시하고 재요청한다. */
  force?: boolean;
}

export interface FetchedPatchNotes {
  html: string;
  sourceUrl: string;
  /** 캐시 파일에서 읽었으면 true — 이 경우 fetchImpl은 호출되지 않는다. */
  fromCache: boolean;
}

/**
 * data/cache/notes/{patch}.html 캐시(gitignore 대상) → 없으면 fetchImpl로 요청 후 캐시에 기록한다.
 * 404는 "아직 해당 패치 발표 전"이라는 뜻이므로 명확한 에러 메시지로 던진다.
 */
export async function fetchPatchNotesHtml(
  patch: PatchId,
  options: FetchPatchNotesOptions = {}
): Promise<FetchedPatchNotes> {
  const locale = options.locale ?? "ko-kr";
  const sourceUrl = buildPatchNotesUrl(patch, locale);
  const cacheDir = options.cacheDir ?? path.join(DATA_ROOT, "cache", "notes");
  const cacheFile = path.join(cacheDir, `${patch}.html`);

  if (!options.force && fs.existsSync(cacheFile)) {
    return { html: fs.readFileSync(cacheFile, "utf8"), sourceUrl, fromCache: true };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(sourceUrl);
  if (res.status === 404) {
    throw new Error(
      `fetchPatchNotesHtml: 404 Not Found — 패치 "${patch}" 패치노트 페이지가 아직 없습니다 (${sourceUrl})`
    );
  }
  if (!res.ok) {
    throw new Error(`fetchPatchNotesHtml: HTTP ${res.status} ${res.statusText} (${sourceUrl})`);
  }
  const html = await res.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, html, "utf8");
  return { html, sourceUrl, fromCache: false };
}

// ─── 파싱 ──────────────────────────────────────────────────────────────────

export interface ParsePatchNotesOptions {
  patch: PatchId;
  sourceUrl: string;
}

export interface PatchNotesParseResult {
  patch: PatchId;
  sourceUrl: string;
  /** 최상단 총평 문단(첫 blockquote). 없으면 null. */
  summary: string | null;
  /** 문서에 등장한 h2 섹션 제목 원문(문서 순서, "패치 하이라이트"/"관련 글" 등 스킵 대상도 포함). */
  sections: string[];
  items: PatchNoteItem[];
}

type ClassicCategory = "champion" | "item" | "rune" | "mechanics" | null;

/** 클래식 섹션 내부의 범주 라벨(h4.change-detail-title 원문) → 범주. 인식 못하면 null(상태 유지). */
function classicCategoryFor(label: string): ClassicCategory {
  if (label === "챔피언") return "champion";
  if (label === "아이템") return "item";
  if (label.includes("룬")) return "rune";
  if (label === "체계") return "mechanics";
  return null;
}

type SectionStrategy =
  | { kind: "skip" }
  | { kind: "fixed"; section: PatchNoteSection; subsection?: "rune" | "system" }
  | { kind: "classic" };

/**
 * h2 원문 → 섹션 처리 전략. "클래식"은 하위 라벨에 따라 블록마다 달라지므로(champion/item/rune/
 * mechanics 상태 기계) 고정 매핑이 아니라 `{kind:"classic"}`로 별도 처리한다.
 */
function resolveSectionStrategy(title: string): SectionStrategy {
  if (title === "챔피언") return { kind: "fixed", section: "champion" };
  if (title === "아이템") return { kind: "fixed", section: "item" };
  if (title.includes("아레나") || title.includes("무작위 총력전") || title.includes("스킨")) {
    return { kind: "fixed", section: "other" };
  }
  if (title === "" || title.includes("패치 하이라이트") || title.includes("관련 글")) return { kind: "skip" };
  if (title === "클래식") return { kind: "classic" };
  if (title === "룬") return { kind: "fixed", section: "system", subsection: "rune" };
  if (title === "체계") return { kind: "fixed", section: "system", subsection: "system" };
  // 시스템 사양 업데이트·버그 수정 및 편의성 개선 및 그 외 미지의 향후 헤더 — 안전한 기본값.
  return { kind: "fixed", section: "system" };
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

type NumericVerdict = "buff" | "nerf" | "inconclusive";

/** before/after 문자열에서 숫자를 뽑아 원소별 델타 부호가 일관될 때만 buff/nerf를 확정한다. */
function computeNumericDirection(stat: string | null, before: string, after: string): NumericVerdict {
  const b = extractNumbers(before);
  const a = extractNumbers(after);
  if (b.length === 0 || a.length === 0) return "inconclusive";
  const n = Math.min(b.length, a.length);
  let sawIncrease = false;
  let sawDecrease = false;
  for (let i = 0; i < n; i++) {
    const delta = a[i] - b[i];
    if (delta > 0) sawIncrease = true;
    else if (delta < 0) sawDecrease = true;
  }
  if (sawIncrease === sawDecrease) return "inconclusive"; // 둘 다 참(혼재) 또는 둘 다 거짓(순변화 0)
  const lowerIsBetter = stat !== null && LOWER_IS_BETTER_KEYWORDS.some((k) => stat.includes(k));
  if (lowerIsBetter) return sawIncrease ? "nerf" : "buff";
  return sawIncrease ? "buff" : "nerf";
}

/** blockquote 서술 요약에서 "상향"/"하향" 중 한쪽만 발견되면 그 방향을 힌트로 쓴다(둘 다/둘 다 아니면 null). */
function detectKeywordHint(contextText: string | null): "buff" | "nerf" | null {
  if (!contextText) return null;
  const hasBuff = contextText.includes("상향");
  const hasNerf = contextText.includes("하향");
  if (hasBuff && !hasNerf) return "buff";
  if (hasNerf && !hasBuff) return "nerf";
  return null;
}

function resolveDirection(
  stat: string | null,
  before: string | null,
  after: string | null,
  keywordHint: "buff" | "nerf" | null
): PatchNoteItem["direction"] {
  if (before === null || after === null) {
    return keywordHint ?? "unknown";
  }
  const numeric = computeNumericDirection(stat, before, after);
  if (numeric !== "inconclusive") return numeric;
  return keywordHint ?? "adjust";
}

function parseStatLine(text: string): { stat: string; before: string; after: string } | null {
  if (!text.includes(ARROW)) return null;
  const match = STAT_LINE_PATTERN.exec(text);
  if (!match) return null;
  return { stat: match[1].trim(), before: match[2].trim(), after: match[3].trim() };
}

function slugify(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "unknown";
}

function entitySlugFrom(anchorId: string | null, entity: string): string {
  if (anchorId) return slugify(anchorId.replace(/^patch-/, ""));
  return slugify(entity);
}

/**
 * id 안정성(라운드 2): 문서상 위치가 아니라 내용(skill/stat/before/after)의 해시로 id를 만든다 —
 * 패치노트가 정정 재배포되어 앞쪽에 항목이 추가/삭제돼도 나머지 항목의 id가 밀리지 않는다.
 */
function contentHash(skill: string | null, stat: string | null, before: string | null, after: string | null): string {
  const normalized = `${skill ?? ""}|${stat ?? ""}|${before ?? ""}|${after ?? ""}`;
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 8);
}

function resolveAnchor(
  entityAnchorId: string | null,
  sectionAnchorId: string | null,
  labelAnchorId: string | null,
  sourceUrl: string
): { anchorUrl: string; anchorKind: PatchNoteItem["anchorKind"] } {
  if (entityAnchorId) return { anchorUrl: `${sourceUrl}#${entityAnchorId}`, anchorKind: "entity" };
  if (sectionAnchorId) return { anchorUrl: `${sourceUrl}#${sectionAnchorId}`, anchorKind: "section" };
  if (labelAnchorId) return { anchorUrl: `${sourceUrl}#${labelAnchorId}`, anchorKind: "section" };
  return { anchorUrl: sourceUrl, anchorKind: "page" };
}

interface RawNoteLine {
  text: string;
  entity: string;
  skill: string | null;
  /** 이 절 직전에 나온 라벨 요소의 id(관찰상 거의 항상 null — 앵커 폴백 ② 방어 코드). */
  labelAnchorId: string | null;
}

interface BuildItemContext {
  patch: PatchId;
  sourceUrl: string;
  section: PatchNoteSection;
  subsection?: "rune" | "system";
  entityAnchorId: string | null;
  sectionAnchorId: string | null;
  keywordHint: "buff" | "nerf" | null;
  /** `${section}:${slug}:${hash}` → 지금까지 등장 횟수(완전 동일 항목 dedup 접미용). */
  idCounters: Map<string, number>;
}

function buildItem(line: RawNoteLine, ctx: BuildItemContext): PatchNoteItem {
  const parsed = parseStatLine(line.text);
  const stat = parsed?.stat ?? null;
  const before = parsed?.before ?? null;
  const after = parsed?.after ?? null;
  const direction = resolveDirection(stat, before, after, ctx.keywordHint);

  const slug = entitySlugFrom(ctx.entityAnchorId, line.entity);
  const hash = contentHash(line.skill, stat, before, after);
  const counterKey = `${ctx.section}:${slug}:${hash}`;
  const occurrence = ctx.idCounters.get(counterKey) ?? 0;
  ctx.idCounters.set(counterKey, occurrence + 1);
  const id =
    occurrence === 0
      ? `note:${ctx.patch}:${ctx.section}:${slug}:${hash}`
      : `note:${ctx.patch}:${ctx.section}:${slug}:${hash}-${occurrence + 1}`;

  const { anchorUrl, anchorKind } = resolveAnchor(
    ctx.entityAnchorId,
    ctx.sectionAnchorId,
    line.labelAnchorId,
    ctx.sourceUrl
  );

  return {
    id,
    patch: ctx.patch,
    section: ctx.section,
    subsection: ctx.subsection,
    entity: line.entity,
    skill: line.skill,
    stat,
    before,
    after,
    direction,
    summary: line.text,
    anchorUrl,
    anchorKind,
  };
}

interface ParseBlockOptions {
  section: PatchNoteSection;
  subsection?: "rune" | "system";
  patch: PatchId;
  sourceUrl: string;
  sectionAnchorId: string | null;
  /** h3가 없는 블록(클래식/아레나/버그수정 등)에서 엔티티를 특정할 수 없을 때 쓸 이름(대개 h2 제목). */
  fallbackEntity: string;
}

/**
 * `p > strong` 매치가 `blockquote.context` 서술 문단 내부인지(=라벨이 아니라 서술문 오염,
 * 라운드 2 결함 3) 판별한다. **h4는 절대 제외하지 않는다** — 아우렐리온 솔처럼 첫 스킬 h4가
 * `blockquote.context` 안에 중첩되는(반면 그 h4에 대응하는 ul은 밖에 있는) 정상 마크업이 있어서,
 * `blockquote` 조상을 가진 노드를 전부 걸러내면 정상 스킬 라벨까지 함께 사라진다(실제로 걸려서
 * 되돌린 시행착오 — 최초 구현은 h4까지 걸러내 아우렐리온 솔 Q의 skill이 null이 되는 회귀를 냈다).
 * 오염은 오직 26.16 클래식 섹션의 "서술 전체를 <strong>으로 감싼" 패턴에서만 나므로, `strong`
 * 매치 중 `blockquote.context` 안에 있는 것만 좁게 제외한다.
 */
function isNarrativeStrong($: cheerio.CheerioAPI, node: AnyNode): boolean {
  if (node.type !== "tag" || node.name !== "strong") return false;
  return $(node).parents("blockquote.context").length > 0;
}

/**
 * 컨텐츠 블록 1개(div.content-border 등)를 파싱한다. 챔피언/아이템/룬처럼 `h3.change-title`이
 * 있는 표준 블록과, 클래식/아레나처럼 `h4`/`p>strong` 라벨만 있는 블록을 하나의 순회로 통합
 * 처리한다 — 상단 파일 주석의 마크업 관찰 참고. `blockquote` 내부(서술 문단)는 라벨/스탯 탐색에서
 * 제외한다(26.16 클래식 섹션이 서술 전체를 `<strong>`으로 감싸 라벨로 오인되는 문제 방지).
 */
function parseNoteBlock(
  $: cheerio.CheerioAPI,
  block: cheerio.Cheerio<AnyNode>,
  opts: ParseBlockOptions,
  idCounters: Map<string, number>
): PatchNoteItem[] {
  const h3 = block.find("h3.change-title").first();
  let entity: string | null = h3.length > 0 ? h3.text().trim() : null;
  const entityAnchorId: string | null = h3.length > 0 ? (h3.attr("id") ?? null) : null;

  const contextP = block.find("blockquote.context > p").first();
  const contextText = contextP.length > 0 ? contextP.text().trim() : null;
  const keywordHint = detectKeywordHint(contextText);

  let currentSkill: string | null = null;
  let lastLabelAnchorId: string | null = null;
  const rawLines: RawNoteLine[] = [];

  block
    .find("h4.change-detail-title, p > strong, ul")
    .filter((_, node) => !isNarrativeStrong($, node))
    .each((_, node) => {
      if (node.type === "tag" && node.name === "ul") {
        $(node)
          .children("li")
          .each((__, li) => {
            const text = $(li).text().trim();
            if (text.length === 0) return;
            rawLines.push({
              text,
              entity: entity ?? opts.fallbackEntity,
              skill: currentSkill,
              labelAnchorId: lastLabelAnchorId,
            });
          });
        return;
      }

      const label = $(node).text().trim();
      if (label.length === 0) return;
      if (entity === null && classicCategoryFor(label) !== null) {
        // 클래식/아레나 섹션의 범주 라벨("챔피언"/"아이템"/"룬 및 진척도"/"체계" 등)은 엔티티
        // 자체가 아니다 — 건너뛴다. `classicCategoryFor`를 재사용해 인식 범위를 한 곳에 고정한다
        // (전에는 "챔피언"/"아이템"만 걸러 "룬 및 진척도"/"체계" 라벨 자체가 엔티티로 오인되고
        // 그 뒤 진짜 엔티티명이 skill 자리로 밀리는 결함이 있었다 — scope-critic 라운드 2).
        return;
      }
      lastLabelAnchorId = $(node).attr("id") ?? null;
      if (entity === null) {
        entity = label;
      } else {
        currentSkill = label;
      }
    });

  if (rawLines.length === 0) {
    // 스탯 변경 목록이 전혀 없는 블록(신규 엔티티 소개, 서술형 공지 등) — 통째로 요약 1건으로
    // 남긴다(누락 0 원칙). blockquote 서술이 있으면 그것을, 없으면 블록 전체 텍스트를 쓴다.
    const fallbackText = contextText ?? block.text().trim();
    if (fallbackText.length > 0) {
      rawLines.push({
        text: fallbackText,
        entity: entity ?? opts.fallbackEntity,
        skill: currentSkill,
        labelAnchorId: lastLabelAnchorId,
      });
    }
  }

  return rawLines.map((line) =>
    buildItem(line, {
      patch: opts.patch,
      sourceUrl: opts.sourceUrl,
      section: opts.section,
      subsection: opts.subsection,
      entityAnchorId,
      sectionAnchorId: opts.sectionAnchorId,
      keywordHint,
      idCounters,
    })
  );
}

/**
 * ko-kr 패치노트 정적 HTML을 구조화한다. 순수 함수 — 네트워크 호출 없음(fetchPatchNotesHtml이
 * 그 역할을 분리해서 맡는다).
 */
export function parsePatchNotes(html: string, options: ParsePatchNotesOptions): PatchNotesParseResult {
  const $ = cheerio.load(html);
  const container = $("#patch-notes-container");
  if (container.length === 0) {
    throw new Error(
      "parsePatchNotes: #patch-notes-container를 찾을 수 없습니다 — 패치노트 마크업이 바뀌었을 수 있습니다."
    );
  }

  let summary: string | null = null;
  let sawFirstHeader = false;
  let currentStrategy: SectionStrategy = { kind: "skip" };
  let currentH2 = "";
  let currentSectionAnchorId: string | null = null;
  let classicCategory: ClassicCategory = null;
  const sections: string[] = [];
  const items: PatchNoteItem[] = [];
  const idCounters = new Map<string, number>();

  container.children().each((_, el) => {
    const $el = $(el);

    if (el.type === "tag" && el.name === "header") {
      const h2 = $el.find("h2").first();
      const title = h2.text().trim();
      if (title.length > 0) sections.push(title);
      currentH2 = title;
      currentSectionAnchorId = $el.attr("id") ?? h2.attr("id") ?? null;
      currentStrategy = resolveSectionStrategy(title);
      if (currentStrategy.kind === "classic") classicCategory = null; // 클래식 섹션 진입 시 리셋
      sawFirstHeader = true;
      return;
    }

    if (!sawFirstHeader) {
      // 최상단(첫 h2 이전) — 총평 blockquote만 요약으로 채택하고, 그 외(디자이너 크레딧 등)는 무시.
      if (summary === null && el.type === "tag" && el.name === "blockquote") {
        const p = $el.find("p").first();
        const text = (p.length > 0 ? p.text() : $el.text()).trim();
        if (text.length > 0) summary = text;
      }
      return;
    }

    if (currentStrategy.kind === "skip") return; // 패치 하이라이트/관련 글

    let blockSection: PatchNoteSection;
    let blockSubsection: "rune" | "system" | undefined;

    if (currentStrategy.kind === "fixed") {
      blockSection = currentStrategy.section;
      blockSubsection = currentStrategy.subsection;
    } else {
      // "클래식" — 블록의 선두 h4 범주 라벨로 상태를 갱신한 뒤, 현재 상태로 섹션을 결정한다.
      const leadingH4 = $el.find("h4.change-detail-title").first();
      if (leadingH4.length > 0) {
        const detected = classicCategoryFor(leadingH4.text().trim());
        if (detected !== null) classicCategory = detected;
      }
      switch (classicCategory) {
        case "champion":
          blockSection = "champion";
          break;
        case "item":
          blockSection = "item";
          break;
        case "rune":
          blockSection = "system";
          blockSubsection = "rune";
          break;
        case "mechanics":
          blockSection = "system";
          blockSubsection = "system";
          break;
        default:
          blockSection = "system";
      }
    }

    const blockItems = parseNoteBlock(
      $,
      $el,
      {
        section: blockSection,
        subsection: blockSubsection,
        patch: options.patch,
        sourceUrl: options.sourceUrl,
        sectionAnchorId: currentSectionAnchorId,
        fallbackEntity: currentH2,
      },
      idCounters
    );
    // 2026-09-18(채점 라운드1 ST-6): `A ⇒ A`는 선언이 아니다 — 방향이 없어 짝지을 수 없고,
    // 대조표에서는 "공지-불일치" 배지를 달고 나갔다(실측: 26.18 카시오페아 "전체 주문력 계수
    // 65% ⇒ 65%"). 라이엇 편집 잔여물이므로 항목으로 내보내지 않는다. before/after가 둘 다
    // 있을 때만 비교한다 — 서술형(둘 다 null)은 이 규칙의 대상이 아니다.
    items.push(...blockItems.filter((item) => item.before === null || item.before !== item.after));
  });

  return { patch: options.patch, sourceUrl: options.sourceUrl, summary, sections, items };
}
