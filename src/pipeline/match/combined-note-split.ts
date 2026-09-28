// src/pipeline/match/combined-note-split.ts
// 합친 이름 노트 분해(2026-09-28, C2 — 잔여 로드맵 PR-B). 순수 함수만.
//
// **무엇이 깨져 있었나.** 26.19 「세계 지도집과 룬 나침반 — 체력: 30/100/200 ⇒ 0/60/200」은 한 줄이 두 아이템
// (그리고 이름 없는 3단계)을 단계값으로 늘어놓는다. 어느 값이 어느 아이템인지는 원문에 없고(도메인 지식),
// 파서는 한 노트로 두었다. 그 결과 LLM이 제드 밴률 원인에 「룬 나침반 체력 30→0」이라고 썼다 — 실제로는
// 세계 지도집의 값이다(PLAN-residuals-sweep §⑥ C2).
//
// **어떻게 푸나.** 게임 파일(DDragon)이 답을 갖고 있다: 16.18.1 → 16.19.1에서 세계 지도집 체력 30 → 0,
// 룬 나침반 100 → 60(F7 실측). 바뀐 단계마다 **이전·이후 값이 둘 다 맞는 아이템이 정확히 하나**일 때만
// 그 단계를 그 아이템에 배정한다. 바뀐 단계 하나라도 배정이 안 되면 그 대상은 **현행 유지** — 지어내지
// 않는다. DDragon에 없는 수치(「체력 재생」 등)는 같은 대상에서 검증된 단계 배정을 그대로 따른다
// (같은 줄 묶음이 같은 단계 순서를 쓴다는 원문 형식에 기댄다 — 검증된 배정이 없으면 역시 현행 유지).
import { contentHash, resolveDirection, slugify } from "./patchnotes-parser";
import { splitCombinedEntity } from "./entity-match";
import type { PatchNoteItem } from "../types";

/** 아이템 이름 → DDragon 수치(`FlatHPPoolMod` 등). 한 버전의 표. */
export interface ItemStatTable {
  byName(name: string): { id: string; stats: Record<string, number> }[];
}

export interface SplitReport {
  entity: string;
  outcome: "split" | "kept";
  reason: string;
}

/**
 * 노트 수치 이름 → DDragon 스탯 키와 배율(노트 표기 단위). 단계 배정을 **검증**하는 데만 쓴다 — 표에 없는
 * 수치는 검증 근거가 못 되고, 검증된 배정을 따를 뿐이다.
 */
const STAT_KEY: Record<string, { key: string; scale: number }> = {
  체력: { key: "FlatHPPoolMod", scale: 1 },
  마나: { key: "FlatMPPoolMod", scale: 1 },
  공격력: { key: "FlatPhysicalDamageMod", scale: 1 },
  주문력: { key: "FlatMagicDamageMod", scale: 1 },
  방어력: { key: "FlatArmorMod", scale: 1 },
  "마법 저항력": { key: "FlatSpellBlockMod", scale: 1 },
  "공격 속도": { key: "PercentAttackSpeedMod", scale: 100 },
  "치명타 확률": { key: "FlatCritChanceMod", scale: 100 },
};

const numberOf = (token: string): number | null => {
  const m = /-?\d+(?:\.\d+)?/.exec(token.replace(/,/g, ""));
  return m ? Number(m[0]) : null;
};

/** 「30/100/200」 → 단계 토큰. 단계 구분자가 없으면 한 단계. */
const stagesOf = (value: string | null): string[] => (value ?? "").split("/").map((t) => t.trim());

/** 단계 i → 아이템 이름. 바뀐 단계만 담는다. 검증 실패면 사유 문자열. */
function verifiedStageMap(
  note: PatchNoteItem,
  parts: readonly string[],
  before: ItemStatTable,
  after: ItemStatTable
): Map<number, string> | string | null {
  const spec = note.stat === null ? undefined : STAT_KEY[note.stat];
  if (!spec) return null; // 검증 근거가 아니다.
  const b = stagesOf(note.before);
  const a = stagesOf(note.after);
  if (b.length !== a.length || b.length < 2) return null;
  const map = new Map<number, string>();
  for (let i = 0; i < b.length; i += 1) {
    const bv = numberOf(b[i]);
    const av = numberOf(a[i]);
    if (bv === null || av === null) return `${note.stat} ${i + 1}단계 값을 숫자로 읽지 못했다`;
    if (bv === av) continue;
    const hits = parts.filter((part) => {
      const pb = before.byName(part);
      const pa = after.byName(part);
      if (pb.length !== 1 || pa.length !== 1) return false;
      return (pb[0].stats[spec.key] ?? 0) * spec.scale === bv && (pa[0].stats[spec.key] ?? 0) * spec.scale === av;
    });
    if (hits.length !== 1) return `${note.stat} ${i + 1}단계(${b[i]} ⇒ ${a[i]})와 맞는 아이템이 ${hits.length}개`;
    map.set(i, hits[0]);
  }
  return map.size > 0 ? map : null;
}

export function splitCombinedNotes(
  notes: readonly PatchNoteItem[],
  before: ItemStatTable,
  after: ItemStatTable
): { items: PatchNoteItem[]; report: SplitReport[] } {
  const report: SplitReport[] = [];
  const replacement = new Map<string, PatchNoteItem[]>();

  const groups = new Map<string, PatchNoteItem[]>();
  for (const note of notes) {
    if (note.section !== "item" || note.modeScope !== "core") continue;
    if (splitCombinedEntity(note.entity).length < 2) continue;
    groups.set(note.entity, [...(groups.get(note.entity) ?? []), note]);
  }

  for (const [entity, group] of groups) {
    const parts = splitCombinedEntity(entity);
    let stageMap: Map<number, string> | null = null;
    let failure: string | null = null;
    for (const note of group) {
      const verified = verifiedStageMap(note, parts, before, after);
      if (typeof verified === "string") {
        failure = verified;
        break;
      }
      if (verified === null) continue;
      // 두 검증 노트가 서로 다른 배정을 내면 믿지 않는다.
      if (stageMap && [...verified].some(([i, part]) => stageMap?.has(i) && stageMap.get(i) !== part)) {
        failure = "검증 노트끼리 단계 배정이 어긋난다";
        break;
      }
      stageMap = new Map([...(stageMap ?? []), ...verified]);
    }
    if (failure !== null || stageMap === null) {
      report.push({ entity, outcome: "kept", reason: failure ?? "DDragon으로 검증할 수 있는 수치가 없다" });
      continue;
    }

    const planned = new Map<string, PatchNoteItem[]>();
    let unmapped: string | null = null;
    for (const note of group) {
      const b = stagesOf(note.before);
      const a = stagesOf(note.after);
      const subs: PatchNoteItem[] = [];
      for (let i = 0; i < b.length && b.length === a.length; i += 1) {
        if (b[i] === a[i]) continue;
        const part = stageMap.get(i);
        if (part === undefined) {
          unmapped = `${note.stat} ${i + 1}단계가 바뀌었는데 배정된 아이템이 없다`;
          break;
        }
        subs.push({
          ...note,
          id: `note:${note.patch}:item:${slugify(part)}:${contentHash(note.skill, note.stat, b[i], a[i])}`,
          entity: part,
          before: b[i],
          after: a[i],
          direction: resolveDirection(note.stat, b[i], a[i], null),
          summary: `${note.stat}: ${b[i]} ⇒ ${a[i]} (원문 「${entity}」 ${note.stat}: ${note.before} ⇒ ${note.after}의 ${i + 1}단계)`,
        });
      }
      if (unmapped !== null || subs.length === 0) {
        unmapped ??= `${note.stat}: 나눌 단계가 없다`;
        break;
      }
      planned.set(note.id, subs);
    }
    if (unmapped !== null) {
      report.push({ entity, outcome: "kept", reason: unmapped });
      continue;
    }
    for (const [id, subs] of planned) replacement.set(id, subs);
    report.push({ entity, outcome: "split", reason: `단계 배정 ${[...stageMap].map(([i, p]) => `${i + 1}→${p}`).join(", ")}` });
  }

  const items = notes.flatMap((note) => replacement.get(note.id) ?? [note]);
  return { items, report };
}

/**
 * 이 패치(LoL `26.N`)와 직전 패치의 DDragon 버전 쌍(2026-09-28, scope-critic). DDragon 버전 `16.N.x`의 마이너가
 * 패치 번호와 같다(실측 26.16~26.19 ↔ 16.16.1~16.19.1 — `gamedata/lol/*.json` `meta.source`). 「로컬 최신 두
 * 버전」은 패치를 몰라, 노트가 DDragon보다 먼저 나오거나 옛 패치를 다시 파싱하면 엉뚱한 쌍으로 나눴다.
 * 한쪽이라도 없으면 `null` — 추측하지 않는다(호출부가 경보하고 원문을 둔다).
 */
export function ddragonPairForPatch(versions: readonly string[], patch: string): { from: string; to: string } | null {
  const minor = Number(patch.split(".")[1]);
  if (!Number.isInteger(minor)) return null;
  const newestOf = (m: number) =>
    versions
      .filter((v) => Number(v.split(".")[1]) === m)
      .sort((a, b) => Number(b.split(".")[2] ?? 0) - Number(a.split(".")[2] ?? 0))[0];
  const to = newestOf(minor);
  const from = newestOf(minor - 1);
  return to && from ? { from, to } : null;
}
