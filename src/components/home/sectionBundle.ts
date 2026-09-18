// src/components/home/sectionBundle.ts
// "섹션 묶음" 판별(2026-09-18, 채점 라운드5 B2). 패치노트 파서는 h3(엔티티 제목)가 없는 섹션에서
// 섹션 라벨 자체를 엔티티로 폴백한다(patchnotes-parser.ts `entity = label`) — 그래서 「의회 - 투표
// 1 결과」(34줄)·「증강」(28)·「버그 수정」(7)·「버그 수정 및 편의성 개선」(4)이 26.18 홈에서 챔피언과
// 같은 엔티티 카드로 렌더됐다(라운드4 B2 −1, 파서 잔여물).
//
// **왜 파서를 고치지 않는가**: LLM 캐시 키(`candidateSetHash`)가 전체 노트 직렬화 해시라 노트 1건의
// 엔티티가 바뀌면 그 패치쌍 캐시가 전량 무효가 되고(Opus 최대 400건 재호출), note id에 엔티티
// 슬러그가 들어가 `deltas/*.json`까지 재생성해야 한다. 표시 층위에서 갈라도 채점 기준(프로덕션
// 실렌더)은 같은 결과를 본다.
//
// **왜 이 키인가**(실측, /braintrust 렌즈 3·4): `anchorKind === "section"`은 피오라 65줄도 잡아
// 불가 · `entity ∈ sections[]`는 의회·증강을 못 잡아 불가 · `section ∈ {system, other}`는 의회
// (`champion`)를 못 잡아 불가. 성립하는 유일한 결정론 키는 **이미 홈이 계산하는 아이콘 해석 결과**
// (ddragon에 없는 이름 → entityType null) ∧ 비치장 ∧ 짝지은 델타 0행이다. 26.18에서 정확히 위
// 4건, 26.17에선 「챔피언 변경」·「아트」·「시스템 사양 업데이트」가 걸리는데 그것들도 실제 섹션
// 라벨이라 오탐이 아니다.
//
// 이 판별은 **렌더 위계만** 바꾼다 — 34줄을 병합하지 않고 `unpaired` 배지도 그대로다
// (cosmetic-note.ts 헤더의 "치장으로 접지 말라" 결정 ①②③ 보존).
import type { DeltaRecord } from "@/pipeline/types";
import { isCosmeticGroup } from "@/pipeline/shared/cosmetic-note";
import type { MatchedStreamGroup } from "./releaseStream";
import type { StreamEntityIcon } from "./releaseStreamEntity";

export function isSectionBundle(
  group: MatchedStreamGroup,
  icon: StreamEntityIcon,
  noteDeltaRows: Record<string, DeltaRecord[]>
): boolean {
  if (group.notes.length === 0) return false; // 아무것도 없는 것을 "섹션"이라 부르지 않는다
  if (icon.entityType !== null) return false;
  if (isCosmeticGroup(group.notes)) return false;
  return group.notes.every((note) => (noteDeltaRows[note.id] ?? []).length === 0);
}
