// scripts/run-migrate-note-directions.ts
// 커밋된 LoL 노트의 `direction`을 현재 파서 규칙으로 다시 매기고(C10), 모드 노트의 대상 묶음을
// 바로잡는(C9) 결정론 마이그레이션(2026-09-28).
// 실행: `npx tsx scripts/run-migrate-note-directions.ts --all` (또는 `--patch 26.17`) · `--dry-run`
//
// **왜 재파싱이 아니라 방향만인가**: 라이엇은 발행 후 페이지를 고친다. 원문 캐시로 다시 파싱하면
// 26.16 4·26.18 1개 core id가 사라지거나 새로 생긴다(내용 해시 id) — 판정·LLM 후보 해시가 흔들린다
// (`run-migrate-notes.ts` 헤더와 같은 이유). 그래서 **id가 양쪽에 다 있는 항목의 방향만** 옮긴다.
// 방향은 원문 blockquote 요약(상향/하향 힌트)까지 봐야 정해지므로 커밋 JSON만으로는 재계산할 수 없고,
// 캐시 원문을 파싱한 결과에서 가져온다. 캐시에 없는 id는 건드리지 않는다.
//
// **머지 조건**: core 노트의 방향 변화 0(판정·후보 해시 불변). 0이 아니면 던진다 — 그 경우는 파서
// 규칙 변화가 판정을 바꾼다는 뜻이라 이 스크립트가 조용히 할 일이 아니다(C12가 먼저 들어간 이유).
import fs from "node:fs";
import { parsePatchNotes } from "../src/pipeline/match/patchnotes-parser";
import { notesCacheFile, notesFile } from "../src/pipeline/shared/paths";
import type { PatchNoteItem } from "../src/pipeline/types";
import { isMainModule, parseCliArgs } from "./shared/cli";

export interface DirectionChange {
  id: string;
  modeScope: PatchNoteItem["modeScope"];
  label: string;
  from: PatchNoteItem["direction"];
  to: PatchNoteItem["direction"];
}

/** 순수 함수 — 커밋 노트에 재파싱 결과의 방향을 id로만 옮긴다. 입력을 바꾸지 않는다. */
export function migrateDirections(
  committed: readonly PatchNoteItem[],
  reparsed: readonly PatchNoteItem[]
): { items: PatchNoteItem[]; changes: DirectionChange[] } {
  const byId = new Map(reparsed.map((n) => [n.id, n] as const));
  const changes: DirectionChange[] = [];
  const items = committed.map((n) => {
    const r = byId.get(n.id);
    if (r === undefined || r.direction === n.direction) return n;
    changes.push({
      id: n.id,
      modeScope: n.modeScope,
      label: `${n.entity} · ${n.stat ?? n.summary}`,
      from: n.direction,
      to: r.direction,
    });
    return { ...n, direction: r.direction };
  });
  return { items, changes };
}

/**
 * 모드 노트(클래식·아레나 등) 대상 재묶음(2026-09-28, C9) — 파서가 모드 섹션의 대상 경계를 새로 잡으면
 * 커밋본의 **모드 노트만** 재파싱 결과로 바꾼다. 짝은 (modeScope, summary, 같은 문구 내 순번)으로 짓고,
 * 짝이 없는 커밋 항목은 그대로 둔다(원문이 사후 수정돼 사라진 줄 — 플레이 시점 기록을 지우지 않는다).
 * core 노트는 판정·후보 해시의 입력이라 **손대지 않는다**. 모드 노트 id는 어디서도 참조되지 않는다
 * (LLM 인용 가능 대상이 core뿐 — `isCitableBalanceNote`, 2026-09-28 실측 참조 0건).
 */
export function regroupModeNotes(
  committed: readonly PatchNoteItem[],
  reparsed: readonly PatchNoteItem[]
): { items: PatchNoteItem[]; regrouped: number } {
  const keyOf = (n: PatchNoteItem, seen: Map<string, number>) => {
    const base = `${n.modeScope}|${n.summary}`;
    const k = seen.get(base) ?? 0;
    seen.set(base, k + 1);
    return `${base}#${k}`;
  };
  const pool = new Map<string, PatchNoteItem>();
  const seenR = new Map<string, number>();
  for (const n of reparsed) if (n.modeScope !== "core") pool.set(keyOf(n, seenR), n);
  const seenC = new Map<string, number>();
  let regrouped = 0;
  const items = committed.map((n) => {
    if (n.modeScope === "core") return n;
    const r = pool.get(keyOf(n, seenC));
    if (r === undefined || (r.entity === n.entity && r.skill === n.skill)) return n;
    regrouped += 1;
    return { ...n, id: r.id, entity: r.entity, skill: r.skill, direction: r.direction, anchorUrl: r.anchorUrl, anchorKind: r.anchorKind };
  });
  return { items, regrouped };
}

const ALL_PATCHES = ["26.16", "26.17", "26.18", "26.19"];

function main(): void {
  const raw = parseCliArgs("run-migrate-note-directions", process.argv.slice(2), [
    { name: "patch", type: "patch" },
    { name: "all", type: "boolean", default: false },
    { name: "dry-run", type: "boolean", default: false },
  ]);
  const patches = raw.all === true ? ALL_PATCHES : [raw.patch as string];
  for (const patch of patches) {
    const file = notesFile(patch);
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { meta: { sourceUrl: string }; items: PatchNoteItem[] };
    const cache = notesCacheFile(patch);
    if (!fs.existsSync(cache)) throw new Error(`${patch}: 원문 캐시가 없다 (${cache}) — 방향 힌트를 복원할 수 없다`);
    const reparsed = parsePatchNotes(fs.readFileSync(cache, "utf8"), { patch, sourceUrl: data.meta.sourceUrl });
    const migrated = migrateDirections(data.items, reparsed.items);
    const { changes } = migrated;
    const { items, regrouped } = regroupModeNotes(migrated.items, reparsed.items);
    console.log(`[migrate-directions] ${patch}: 모드 노트 대상 재묶음 ${regrouped}건`);
    const core = changes.filter((c) => c.modeScope === "core");
    console.log(`[migrate-directions] ${patch}: 변경 ${changes.length}건 (core ${core.length})`);
    for (const c of changes) console.log(`  ${c.modeScope} | ${c.label} | ${c.from} → ${c.to}`);
    if (core.length > 0) throw new Error(`${patch}: core 방향 변화 ${core.length}건 — 판정이 바뀐다. 마이그레이션을 멈춘다`);
    if (raw["dry-run"] !== true && (changes.length > 0 || regrouped > 0)) {
      fs.writeFileSync(file, JSON.stringify({ ...data, items }, null, 2), "utf8");
    }
  }
}

if (isMainModule(import.meta.url)) main();
