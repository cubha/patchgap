// scripts/run-migrate-notes.ts
// 커밋된 `data/aggregated/notes/{patch}.json`에 `modeScope`를 **덧붙이기만** 하는 결정론
// 마이그레이션(2026-09-19). 실행: `npm run pipeline:migrate-notes -- --patch 26.18` 또는 `--all`.
//
// **왜 재파싱이 아니라 마이그레이션인가**(이 스크립트의 존재 이유):
// 라이엇이 발행 후 패치노트 페이지를 수정한다. 실측으로 26.18은 저장본 180건 대비 오늘자
// 페이지가 162건이었다(아수라장 증강 18건 삭제, 카시오페아 1건은 문구 변경 → 내용 해시 기반
// id까지 바뀜). 원문 HTML 아카이브가 없어 복원 경로도 없으므로, 재파싱하면 "플레이어가 그 패치를
// 플레이하던 시점에 노트가 무엇이라 말했는가"라는 관측 사실이 오늘자 페이지로 덮인다.
// 그래서 저장된 JSON을 신뢰하고 **필드만** 더한다. 근거: docs/plan/BRAINTRUST-root-fix-2026-09-19.md §0-1.
//
// 멱등이다(이미 값이 있고 같으면 "변경 없음"으로 끝난다). 값이 다르면 덮어쓰되 그 사실을 센다.
import fs from "node:fs";
import path from "node:path";
import { notesFile } from "../src/pipeline/shared/paths";
import { modeScopeFromAnchorUrl, type NoteModeScope } from "../src/pipeline/shared/mode-scope";
import type { PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

/** 마이그레이션 전 노트 — modeScope가 아직 없을 수 있다. */
type LegacyNote = Omit<PatchNoteItem, "modeScope"> & { modeScope?: NoteModeScope };

interface NotesFileShape {
  meta: Record<string, unknown>;
  summary: string | null;
  sections: string[];
  items: LegacyNote[];
}

export interface MigrateResult {
  patch: string;
  total: number;
  /** modeScope가 새로 채워진 항목 수. */
  filled: number;
  /** 이미 있었고 값이 같아 건드리지 않은 항목 수. */
  unchanged: number;
  /** 이미 있었는데 값이 달라 덮어쓴 항목 수(0이어야 정상). */
  corrected: number;
  byScope: Record<string, number>;
}

/**
 * 노트 배열에 modeScope를 채운다 — **다른 필드는 절대 건드리지 않는다.** 순수 함수라 테스트가
 * 파일 없이 검증할 수 있고, 호출부가 결과를 그대로 기록한다.
 */
export function migrateNotes(items: readonly LegacyNote[]): { items: PatchNoteItem[]; result: Omit<MigrateResult, "patch"> } {
  let filled = 0;
  let unchanged = 0;
  let corrected = 0;
  const byScope: Record<string, number> = {};

  const migrated = items.map((item): PatchNoteItem => {
    const scope = modeScopeFromAnchorUrl(item.anchorUrl);
    byScope[scope] = (byScope[scope] ?? 0) + 1;
    if (item.modeScope === undefined) filled += 1;
    else if (item.modeScope === scope) unchanged += 1;
    else corrected += 1;
    return { ...item, modeScope: scope };
  });

  return { items: migrated, result: { total: items.length, filled, unchanged, corrected, byScope } };
}

/** 마이그레이션이 modeScope 외의 필드를 바꾸지 않았는지 구조로 증명한다(빈 배열 = 무손실). */
export function diffExceptModeScope(before: readonly LegacyNote[], after: readonly PatchNoteItem[]): string[] {
  const problems: string[] = [];
  if (before.length !== after.length) {
    problems.push(`항목 수가 달라졌습니다: ${before.length} → ${after.length}`);
    return problems;
  }
  for (let i = 0; i < before.length; i++) {
    const a = { ...before[i] } as Record<string, unknown>;
    const b = { ...after[i] } as Record<string, unknown>;
    delete a.modeScope;
    delete b.modeScope;
    if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`#${i} ${String(before[i].id)} 내용이 변경됨`);
  }
  return problems;
}

export function migrateFile(patch: string, dataRoot?: string): MigrateResult {
  const file = notesFile(patch, dataRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`run-migrate-notes: ${file} 이(가) 없습니다 — 마이그레이션 대상이 아닙니다.`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as NotesFileShape;
  const { items, result } = migrateNotes(parsed.items);

  const problems = diffExceptModeScope(parsed.items, items);
  if (problems.length > 0) {
    throw new Error(
      `run-migrate-notes: modeScope 외의 내용이 바뀌었습니다(${problems.length}건) — 기록을 중단합니다.\n` +
        problems.slice(0, 5).join("\n")
    );
  }

  fs.writeFileSync(file, `${JSON.stringify({ ...parsed, items }, null, 2)}\n`, "utf8");
  return { patch, ...result };
}

export function main(argv: readonly string[]): void {
  const raw = parseCliArgs("run-migrate-notes", [...argv], [
    { name: "patch", type: "string" },
    { name: "all", type: "boolean", default: false },
  ]);
  const all = raw.all as boolean;
  const patch = raw.patch as string | undefined;
  if (!all && (patch === undefined || patch.length === 0)) {
    throw new Error("run-migrate-notes: --patch 26.18 또는 --all 중 하나가 필요합니다.");
  }

  const patches = all
    ? fs
        .readdirSync(path.dirname(notesFile("26.00")))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort()
    : [patch as string];

  for (const p of patches) {
    const r = migrateFile(p);
    const scopes = Object.entries(r.byScope)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ");
    console.log(
      `[run-migrate-notes] ${r.patch}: ${r.total}건 — 신규 ${r.filled} · 동일 ${r.unchanged} · 교정 ${r.corrected} | ${scopes}`
    );
  }
}

if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error("run-migrate-notes 실패:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
