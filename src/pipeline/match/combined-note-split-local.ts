// src/pipeline/match/combined-note-split-local.ts
// C2 합친 이름 노트 분해의 **로컬 DDragon 배선**(I/O). 규칙은 `combined-note-split.ts`(순수), 표 로더는
// `ddragon.ts`. 따로 둔 이유: `ddragon.ts`는 매칭 전반이 부르는 가벼운 로더라, 여기서 파서(cheerio)까지 끌면
// 모든 소비자의 로드 시간이 늘었다(실측: 실데이터 스모크 테스트가 5초 제한을 넘김).
import { ddragonPairForPatch, splitCombinedNotes } from "./combined-note-split";
import { listDdragonVersions, loadItemStatTable, type LoadDdragonOptions } from "./ddragon";
import type { PatchNoteItem } from "../types";

/**
 * 합친 이름 아이템 노트 분해(C2)를 **로컬 DDragon**으로 — 이 패치와 직전 패치의 버전(`ddragonPairForPatch`)을
 * 고른다. 버전이 없거나 표를 못 읽으면 **분해하지 않고 경보**한다 — 노트(선언 축)를 막지 않는다(결정 8).
 * run-match·run-fetch-notes 두 파싱 경로가 같이 쓴다(스크립트끼리 import하지 않도록 여기 둔다).
 */
export function splitCombinedWithLocalDdragon(items: PatchNoteItem[], patch: string, options: LoadDdragonOptions = {}): PatchNoteItem[] {
  const pair = ddragonPairForPatch(listDdragonVersions(options), patch);
  if (pair === null) {
    console.log(`::warning::[C2] ${patch}와 직전 패치의 DDragon 버전을 찾지 못해 합친 이름 노트를 나누지 않았다 — 원문 그대로 둔다`);
    return items;
  }
  let before: ReturnType<typeof loadItemStatTable>;
  let after: ReturnType<typeof loadItemStatTable>;
  try {
    before = loadItemStatTable(pair.from, options);
    after = loadItemStatTable(pair.to, options);
  } catch (error: unknown) {
    console.log(`::warning::[C2] DDragon 아이템 표를 읽지 못했다(${error instanceof Error ? error.message : String(error)}) — 원문 그대로 둔다`);
    return items;
  }
  const { items: split, report } = splitCombinedNotes(items, before, after);
  for (const r of report) {
    console.log(`${r.outcome === "kept" ? "::warning::" : ""}[C2] 합친 이름 노트 ${r.entity}: ${r.outcome} — ${r.reason} (${pair.from} → ${pair.to})`);
  }
  return split;
}
