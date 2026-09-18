// src/components/home/sectionBundle.ts
// 섹션 묶음 판별(2026-09-18, 채점 라운드5 B2). ST1 — TDD RED 단계 스텁.
import type { DeltaRecord } from "@/pipeline/types";
import type { MatchedStreamGroup } from "./releaseStream";
import type { StreamEntityIcon } from "./releaseStreamEntity";

export function isSectionBundle(
  _group: MatchedStreamGroup,
  _icon: StreamEntityIcon,
  _noteDeltaRows: Record<string, DeltaRecord[]>
): boolean {
  throw new Error("TODO(ST1): isSectionBundle 미구현");
}
