// scripts/run-remap-note-entities.ts
// 저장된 `data/aggregated/notes/{patch}.json`의 **엔티티 귀속만** 현재 파서 결과로 다시 맞춘다
// (2026-09-20). 실행: `npm run pipeline:remap-notes -- --patch 26.18` 또는 `--all` (+`--dry-run`).
//
// **왜 재파싱이 아니라 재귀속인가**: 라이엇이 발행 후 패치노트를 수정하기 때문에, 저장본을 오늘자
// 페이지로 덮으면 "플레이어가 그 패치를 플레이하던 시점에 노트가 무엇이라 말했는가"라는 관측 사실이
// 사라진다(실측: 26.18 저장본 180건 vs 오늘자 162건 — 아수라장 증강 18건 삭제). 그 판단은
// run-migrate-notes.ts에서 이미 내렸고 여기서도 그대로 따른다. 그래서 **줄은 저장본의 것을 쓰고**,
// 파서가 고쳐진 필드(`entity`·`skill`·그 둘에서 파생되는 `id`)만 옮겨 온다.
//
// **무엇을 고치려고 만들었나**: 26.18 「클래식」은 챔피언 12명이 `div.content-border` **한 블록**에
// 들어 있는데, 파서가 "첫 라벨 = 엔티티, 그 뒤는 전부 스킬"로 읽어 65줄 전부를 첫 챔피언 "피오라"에
// 귀속시켰다(갈리오·뽀삐·쉬바나… 이름은 `currentSkill`에 담겼다가 다음 라벨에 덮여 사라졌다).
// 파서는 고쳤지만(patchnotes-parser.ts `startsNewEntity`), 저장본에는 그 이름이 **어느 필드에도
// 남아 있지 않아** 표시 계층에서 복구할 방법이 없다 — 그래서 원문 캐시(data/cache/notes/*.html)를
// 근거로 귀속만 되돌린다.
//
// **안전 규칙 3개**(하나라도 깨지면 그 묶음을 통째로 건너뛴다 — 저장본이 이긴다):
//   ① `modeScope === "core"`는 절대 건드리지 않는다. 소환사의 협곡 노트는 LLM 후보셋 해시
//      (candidateSetHash)의 입력이라, id가 1건만 바뀌어도 캐시 866건이 통째로 무효가 된다.
//   ② 짝짓기는 `summary` 동일성으로만 한다. 재파싱본 줄이 하나라도 저장본에서 짝을 못 찾으면
//      그 묶음은 손대지 않는다(원문이 실제로 바뀐 구간이라는 뜻이다).
//   ③ 짝지어진 줄끼리 귀속 외 필드(stat·before·after·direction·section·anchor…)가 다르면 역시
//      건너뛴다 — 그건 귀속 교정이 아니라 내용 변경이다.
// 멱등이다(두 번째 실행은 "변경 0"으로 끝난다).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parsePatchNotes } from "../src/pipeline/match/patchnotes-parser";
import { notesCacheFile, notesFile } from "../src/pipeline/shared/paths";
import type { PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

interface NotesFileShape {
  meta: { sourceUrl: string; [key: string]: unknown };
  summary: string | null;
  sections: string[];
  items: PatchNoteItem[];
}

/** 귀속(entity·skill·id) 외에는 같아야 하는 필드 — 하나라도 다르면 내용이 바뀐 것이다. */
const INVARIANT_FIELDS = [
  "patch",
  "section",
  "subsection",
  "stat",
  "before",
  "after",
  "direction",
  "summary",
  "anchorUrl",
  "anchorKind",
  "modeScope",
] as const;

export interface RemapGroupReport {
  scope: string;
  committed: number;
  reparsed: number;
  /** 귀속이 실제로 바뀐 줄 수. */
  changed: number;
  /** null이면 적용됨, 아니면 건너뛴 사유. */
  skipped: string | null;
}

export interface RemapOutcome {
  items: PatchNoteItem[];
  groups: RemapGroupReport[];
}

function invariantMismatch(a: PatchNoteItem, b: PatchNoteItem): string | null {
  for (const field of INVARIANT_FIELDS) {
    if (a[field] !== b[field]) return `${field}: ${String(a[field])} ≠ ${String(b[field])}`;
  }
  return null;
}

/**
 * 저장본 줄은 그대로 두고 `entity`·`skill`·`id`만 재파싱본에서 옮겨 온다. 순수 함수 —
 * 파일 없이 검증할 수 있고, 호출부가 결과를 그대로 기록한다.
 */
export function remapNoteEntities(
  committed: readonly PatchNoteItem[],
  reparsed: readonly PatchNoteItem[]
): RemapOutcome {
  const items = committed.map((item) => ({ ...item }));
  const scopes = [...new Set(committed.map((i) => i.modeScope))].filter((s) => s !== "core");
  const groups: RemapGroupReport[] = [];

  for (const scope of scopes) {
    const targets = items.filter((i) => i.modeScope === scope);
    const source = reparsed.filter((i) => i.modeScope === scope);
    const report: RemapGroupReport = {
      scope,
      committed: targets.length,
      reparsed: source.length,
      changed: 0,
      skipped: null,
    };

    // ② 문서 순서를 지키며 summary로 짝짓는다. 저장본에만 있는 줄은 그냥 넘어가지만(파서가 나중에
    //    거르게 된 `A ⇒ A` 잔여물 등), 재파싱본에만 있는 줄이 남으면 정렬이 어긋난 것이다.
    const pairs: Array<[PatchNoteItem, PatchNoteItem]> = [];
    let j = 0;
    for (const target of targets) {
      if (j < source.length && source[j].summary === target.summary) {
        pairs.push([target, source[j]]);
        j += 1;
      }
    }
    if (j !== source.length) {
      report.skipped = `재파싱본 ${source.length - j}건이 저장본에서 짝을 찾지 못했습니다(원문이 바뀐 구간)`;
      groups.push(report);
      continue;
    }

    // ③ 귀속 외 필드가 다르면 내용 변경이다 — 건너뛴다.
    const mismatch = pairs
      .map(([a, b]) => {
        const problem = invariantMismatch(a, b);
        return problem === null ? null : `${a.id} ${problem}`;
      })
      .find((x): x is string => x !== null);
    if (mismatch !== undefined) {
      report.skipped = `귀속 외 필드가 달라졌습니다 — ${mismatch}`;
      groups.push(report);
      continue;
    }

    for (const [target, source_] of pairs) {
      if (target.entity === source_.entity && target.skill === source_.skill && target.id === source_.id) continue;
      target.entity = source_.entity;
      target.skill = source_.skill;
      target.id = source_.id;
      report.changed += 1;
    }
    groups.push(report);
  }

  return { items, groups };
}

export interface RemapResult {
  patch: string;
  changed: number;
  groups: RemapGroupReport[];
}

export function remapFile(patch: string, opts: { dryRun?: boolean; dataRoot?: string } = {}): RemapResult {
  const file = notesFile(patch, opts.dataRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`run-remap-note-entities: ${file} 이(가) 없습니다.`);
  }
  const cache = notesCacheFile(patch, opts.dataRoot);
  if (!fs.existsSync(cache)) {
    throw new Error(
      `run-remap-note-entities: 원문 캐시 ${cache} 이(가) 없습니다 — 귀속을 대조할 근거가 없으므로 중단합니다.`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as NotesFileShape;
  const reparsed = parsePatchNotes(fs.readFileSync(cache, "utf8"), {
    patch,
    sourceUrl: parsed.meta.sourceUrl,
  }).items;

  const { items, groups } = remapNoteEntities(parsed.items, reparsed);

  // ① core 불변 증명 — 한 건이라도 달라지면 LLM 후보셋 해시가 움직인다.
  const coreBefore = JSON.stringify(parsed.items.filter((i) => i.modeScope === "core"));
  const coreAfter = JSON.stringify(items.filter((i) => i.modeScope === "core"));
  if (coreBefore !== coreAfter) {
    throw new Error("run-remap-note-entities: core 노트가 변경됐습니다 — 기록을 중단합니다.");
  }
  if (items.length !== parsed.items.length) {
    throw new Error(`run-remap-note-entities: 항목 수가 달라졌습니다 ${parsed.items.length} → ${items.length}`);
  }
  const ids = new Set(items.map((i) => i.id));
  if (ids.size !== items.length) {
    throw new Error("run-remap-note-entities: id가 중복됐습니다 — 기록을 중단합니다.");
  }

  const changed = groups.reduce((sum, g) => sum + g.changed, 0);
  if (changed > 0 && opts.dryRun !== true) {
    fs.writeFileSync(file, `${JSON.stringify({ ...parsed, items }, null, 2)}\n`, "utf8");
  }
  return { patch, changed, groups };
}

export function main(argv: readonly string[]): void {
  const raw = parseCliArgs("run-remap-note-entities", [...argv], [
    { name: "patch", type: "patch" },
    { name: "all", type: "boolean", default: false },
    { name: "dry-run", type: "boolean", default: false },
  ]);
  const all = raw.all as boolean;
  const patch = raw.patch as string | undefined;
  const dryRun = raw["dry-run"] as boolean;
  if (!all && (patch === undefined || patch.length === 0)) {
    throw new Error("run-remap-note-entities: --patch 26.18 또는 --all 중 하나가 필요합니다.");
  }

  const patches = all
    ? fs
        .readdirSync(path.dirname(notesFile("26.00")))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort()
    : [patch as string];

  for (const p of patches) {
    const r = remapFile(p, { dryRun });
    const detail = r.groups
      .map((g) => (g.skipped === null ? `${g.scope} ${g.changed}/${g.committed}` : `${g.scope} 건너뜀(${g.skipped})`))
      .join(" · ");
    console.log(`[run-remap-note-entities] ${r.patch}: 귀속 변경 ${r.changed}건${dryRun ? " (dry-run)" : ""} | ${detail}`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error("run-remap-note-entities 실패:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
