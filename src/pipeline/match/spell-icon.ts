// src/pipeline/match/spell-icon.ts
// DDragon 챔피언 상세 JSON(data/{lang}/champion/{Key}.json)에서 스펠 아이콘 파일명을 조회하는
// 순수 매핑 함수. 파일명은 챔피언마다 임의 문자열이라 규칙화 불가(예: 초가스 E="VorpalSpikes.png",
// 그레이브즈 Q="GravesQLineSpell.png") — 상세 JSON의 spells[] 배열(순서가 Q,W,E,R 고정) 인덱스로
// 읽는다. P(패시브)는 spells가 아니라 passive 필드에 별도로 있다.
// 네트워크 fetch·파일 IO는 하지 않는다(그건 scripts/run-ddragon.ts 몫) — 순수 매핑만 둔다.
// 이 함수는 자산 존재 확인용이라 실패(슬롯 없음·구조 이상)가 정상 경로 — throw 아니라 null 반환.

export type SpellSlot = "Q" | "W" | "E" | "R" | "P";

/** spells[] 배열에서 Q/W/E/R에 대응하는 인덱스 — DDragon 상세 JSON은 이 순서를 항상 고정한다. */
const SPELL_SLOT_INDEX: Record<Exclude<SpellSlot, "P">, number> = {
  Q: 0,
  W: 1,
  E: 2,
  R: 3,
};

interface DdragonSpellImage {
  full: string;
}

interface DdragonSpellEntry {
  image: DdragonSpellImage;
}

interface DdragonChampionDetailEntry {
  spells: DdragonSpellEntry[];
  passive: DdragonSpellEntry;
}

/** data/{lang}/champion/{Key}.json 전체 파일 형태 — data는 챔피언 id(예: "Chogath")를 키로 갖는다. */
interface DdragonChampionDetailFile {
  data: Record<string, DdragonChampionDetailEntry>;
}

function isSpellImage(value: unknown): value is DdragonSpellImage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { full?: unknown }).full === "string"
  );
}

function isSpellEntry(value: unknown): value is DdragonSpellEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    isSpellImage((value as { image?: unknown }).image)
  );
}

function isChampionDetailEntry(value: unknown): value is DdragonChampionDetailEntry {
  if (typeof value !== "object" || value === null) return false;
  const spells = (value as { spells?: unknown }).spells;
  const passive = (value as { passive?: unknown }).passive;
  return Array.isArray(spells) && spells.every(isSpellEntry) && isSpellEntry(passive);
}

function isChampionDetailFile(value: unknown): value is DdragonChampionDetailFile {
  if (typeof value !== "object" || value === null) return false;
  const data = (value as { data?: unknown }).data;
  return typeof data === "object" && data !== null;
}

/**
 * championJson(data/{lang}/champion/{Key}.json 전체 파일 — `data` 아래 챔피언 1개)에서 slot에
 * 해당하는 스펠 아이콘 파일명(예: "VorpalSpikes.png")을 조회한다. slot이 "P"면
 * passive.image.full, 나머지(Q/W/E/R)는 spells[해당 인덱스].image.full. 슬롯이 없거나 구조가
 * 예상과 다르면 null을 반환한다(throw 하지 않음 — 자산 존재 확인용이라 실패가 정상 경로).
 */
export function resolveSpellIconFile(championJson: unknown, slot: SpellSlot): string | null {
  if (!isChampionDetailFile(championJson)) return null;

  const champion = Object.values(championJson.data)[0];
  if (!isChampionDetailEntry(champion)) return null;

  if (slot === "P") {
    return champion.passive.image.full;
  }

  const spell = champion.spells[SPELL_SLOT_INDEX[slot]];
  return spell ? spell.image.full : null;
}

/**
 * `PatchNoteItem.skill`(예: "Q - 빛의 숨결", "RW - 모방: 왜곡")에서 선행 슬롯 문자를 추출한다.
 * 「기본 지속 효과 - …」는 패시브(P). 그 밖에 맨 앞이 Q/W/E/R가 아니면(예: "기본 능력치", 아펠리오스 무기명)
 * null — 슬롯을 추측하지 않는다(무근거 아이콘 매핑 방지). "RW" 같은
 * 복합 표기(궁극기로 다른 스킬을 모방하는 챔피언)는 첫 글자(R)만 슬롯으로 취급한다.
 */
export function parseSkillSlot(skill: string): SpellSlot | null {
  const text = skill.trim();
  // 「기본 지속 효과」는 LoL 한국어 노트의 패시브 **명시 표기**다 — 추측이 아니다(2026-09-29, 26.19 패시브 4행이
  // 글자 폴백으로 나가던 것을 사용자가 지적).
  if (text.startsWith("기본 지속 효과")) return "P";
  const match = /^([QWER])/.exec(text);
  return match ? (match[1] as SpellSlot) : null;
}

/** DDragon CDN의 이미지 폴더 — 패시브는 `img/passive/`, 스킬은 `img/spell/`이다. */
export function spellImageDir(slot: SpellSlot): "passive" | "spell" {
  return slot === "P" ? "passive" : "spell";
}

/** entity+skill 쌍을 스펠 아이콘 인덱스(`data/aggregated/spell-icons.json`)의 키로 정규화한다.
 * Unit Separator(U+001F, 인쇄 불가 제어문자라 실제 entity/skill 텍스트와 충돌하지 않음)로
 * 결합 — entity·skill 어느 쪽에도 나타나지 않는 문자라 키 충돌 걱정 없이 안전하다. */
export function spellIconKey(entity: string, skill: string): string {
  return `${entity}\u001F${skill}`;
}
