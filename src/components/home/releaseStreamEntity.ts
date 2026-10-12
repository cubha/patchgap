// src/components/home/releaseStreamEntity.ts
// 릴리즈노트 스트림 그룹(ReleaseStreamGroup) → EntityIcon이 요구하는 {entityType, entityKey}
// 해석. "unannounced" 그룹은 이미 DeltaRecord를 들고 있어 그대로 쓰고, "matched"(노트 전용)
// 그룹은 entity 한글명뿐이라 ddragon 챔피언/아이템 인덱스로 역조회한다(entity-match.ts의
// byKoName 블로킹 키와 동일 방식). champion/item 섹션이 아니면(system/other) ddragon 자산이
// 없으므로 null — 렌더러는 EntityIcon 대신 일반 폴백 라벨을 쓴다(무근거 아이콘 방지).

import type { DdragonData } from "@/pipeline/match/ddragon";
import type { DeltaEntityType, PatchNoteSection } from "@/pipeline/types";
import type { ReleaseStreamGroup } from "./releaseStream";

export interface StreamEntityIcon {
  entityType: DeltaEntityType | null;
  entityKey: string | null;
  /** 자산 매니페스트에 없는 대상(TFT) — 요청 없이 이니셜로 그린다. 없으면 요청한다(LoL Data Dragon은 전수). */
  assetMissing?: boolean;
}

/**
 * entity 한글명 + 패치노트 section(champion/item/system/other) → EntityIcon 계약
 * {entityType, entityKey}. ddragon 챔피언/아이템 인덱스로 역조회한다(entity-match.ts의
 * byKoName 블로킹 키와 동일 방식). system/other 섹션이거나 매핑 실패(신규 스킨 접두 등)면
 * null — 무근거 아이콘을 지어내지 않는다. 홈(releaseStreamEntity) · 대조표(NoteNavigator)가
 * 공유하는 단일 구현.
 */
export function resolveEntityIconBySection(
  entity: string,
  section: PatchNoteSection,
  ddragon: DdragonData
): StreamEntityIcon {
  if (section === "champion") {
    const champion = ddragon.champions.byKoName(entity);
    return champion
      ? { entityType: "champion", entityKey: champion.id }
      : { entityType: null, entityKey: null };
  }
  if (section === "item") {
    const candidates = ddragon.items.byKoName(entity);
    const first = candidates[0];
    return first ? { entityType: "item", entityKey: String(first.id) } : { entityType: null, entityKey: null };
  }
  return { entityType: null, entityKey: null };
}

export function resolveStreamEntityIcon(
  group: ReleaseStreamGroup,
  ddragon: DdragonData
): StreamEntityIcon {
  if (group.kind === "unannounced") {
    const first = group.deltas[0];
    return first
      ? { entityType: first.entityType, entityKey: first.entityKey }
      : { entityType: null, entityKey: null };
  }

  const section = group.notes[0]?.section;
  if (!section) return { entityType: null, entityKey: null };
  return resolveEntityIconBySection(group.entity, section, ddragon);
}
