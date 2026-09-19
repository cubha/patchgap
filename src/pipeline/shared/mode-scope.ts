// src/pipeline/shared/mode-scope.ts
// 노트가 **어디에 적용되나**를 답하는 단일 술어(2026-09-19 근본수정). `section`이 "무엇이 바뀌었나"
// 라면 이쪽은 적용 범위다 — 두 축을 분리해야 하는 이유는 실측에서 나왔다.
//
// 배경(26.16~26.18 원문 확인): 패치노트 h2 "클래식"은 소환사의 협곡이 아니라 **별도 게임 모드**다
// ("LoL 클래식 n번째 패치… 2010~2017 시점 챔피언 복각", "애니비아의 수치를 2013년에 맞게 재조정",
// 룬 페이지·영향력 포인트 등 현행 SR에 없는 요소). 그런데 파서는 그 섹션의 하위 라벨 "챔피언"을
// 만나면 section을 champion으로 재분류했고(라운드2의 의도된 동작), 그 결과 클래식 피오라 65줄이
// SR 피오라 델타와 짝지어져 "공지"로 판정됐다. 26.16→26.17 쌍에서는 짝지어진 351행 중 186행이
// 모드 노트에만 걸려 있었다.
//
// **왜 section을 고치지 않는가**: 노트 id가 `note:{patch}:{section}:{slug}:{내용해시}`라 section을
// 바꾸면 id가 바뀐다 → 커밋된 두 델타 파일의 matchedNoteIds가 전부 댕글링되고, llm-match의
// candidateSetHash(= 전체 노트 직렬화 해시, section 포함)가 바뀌어 LLM 캐시 388건이 전량 무효가
// 된다. 새 필드는 `toCandidateView`가 직렬화하지 않으므로 캐시·id가 모두 불변이다.
// 근거: docs/plan/BRAINTRUST-root-fix-2026-09-19.md §4.
//
// 클라이언트 번들에서도 import되므로 node:* 의존을 두지 않는다.

/** 노트의 적용 범위. `"core"`는 소환사의 협곡(집계 대상), 나머지는 별도 게임 모드. */
export type NoteModeScope = "core" | "classic" | "aram" | "arena" | "swiftplay" | "brawl";

/** 모드 섹션 앵커 id 접두 → 스코프. 순서는 무관(접두가 서로 겹치지 않는다). */
const MODE_ANCHOR_RULES: ReadonlyArray<readonly [RegExp, Exclude<NoteModeScope, "core">]> = [
  [/^patch-classic/, "classic"],
  [/^patch-(?:aram|mayhem)/, "aram"],
  [/^patch-arena/, "arena"],
  [/^patch-swiftplay/, "swiftplay"],
  [/^patch-brawl/, "brawl"],
];

/** h2 제목 → 스코프. 모드로 읽히지 않으면 null(= core 후보). 앵커와 **독립인 두 번째 신호**다. */
const MODE_TITLE_RULES: ReadonlyArray<readonly [RegExp, Exclude<NoteModeScope, "core">]> = [
  [/^클래식$/, "classic"],
  [/무작위 총력전|아수라장/, "aram"],
  [/아레나/, "arena"],
  [/속도전/, "swiftplay"],
  [/난투/, "brawl"],
];

/** anchorUrl에서 프래그먼트만 뽑는다(없으면 빈 문자열). */
export function anchorHashOf(anchorUrl: string): string {
  const idx = anchorUrl.indexOf("#");
  return idx < 0 ? "" : anchorUrl.slice(idx + 1);
}

/** 섹션 앵커 id로 스코프를 판정한다 — 파서가 노트에 새기는 값의 출처. */
export function modeScopeFromAnchorUrl(anchorUrl: string): NoteModeScope {
  const hash = anchorHashOf(anchorUrl);
  for (const [pattern, scope] of MODE_ANCHOR_RULES) {
    if (pattern.test(hash)) return scope;
  }
  return "core";
}

/** h2 제목으로 스코프를 판정한다. 모드가 아니면 null. */
export function modeScopeFromSectionTitle(title: string): NoteModeScope | null {
  const trimmed = title.trim();
  for (const [pattern, scope] of MODE_TITLE_RULES) {
    if (pattern.test(trimmed)) return scope;
  }
  return null;
}

/** 짝짓기·인과 추론 자격. 이 술어 하나가 "SR 데이터에 이 노트를 쓸 수 있나"를 답한다. */
export function isCoreNote(note: { modeScope: NoteModeScope }): boolean {
  return note.modeScope === "core";
}

/**
 * 제목 신호와 앵커 신호가 엇갈리면 **던진다**. 라이엇이 h2 제목이나 앵커 id 한쪽만 바꾸면 모드
 * 섹션이 조용히 core로 떨어져 오귀속이 재발하는데, 그때 아무도 눈치채지 못하는 것이 이 결함군의
 * 본질이었다("산문 규칙은 게이트 없이 드리프트한다"). 파싱 시점에 크게 실패시킨다.
 */
export function assertModeScopeConsistent(sectionTitle: string, anchorUrl: string): void {
  const byTitle = modeScopeFromSectionTitle(sectionTitle);
  const byAnchor = modeScopeFromAnchorUrl(anchorUrl);
  if (byTitle === null && byAnchor === "core") return;
  if (byTitle === byAnchor) return;
  throw new Error(
    `assertModeScopeConsistent: modeScope 신호 불일치 — 제목 "${sectionTitle}"은 ` +
      `${byTitle ?? "core"}, 앵커 "${anchorHashOf(anchorUrl)}"은 ${byAnchor}로 읽힙니다. ` +
      `패치노트 구조가 바뀌었을 수 있습니다(src/pipeline/shared/mode-scope.ts의 규칙 표를 갱신하세요).`
  );
}
