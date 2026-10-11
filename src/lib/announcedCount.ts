// src/lib/announcedCount.ts
// 「공지된 변화」 수 — 단위는 **대상**(트랙 B ST-3, 2026-10-11 site-review tft-S5·parity-S5·parity-S6·lol-S15).
//
// 왜 한 곳인가: 같은 셈을 화면마다 따로 했다 — PUBG 히어로·타일은 `notes.length`(조항 5), 본문 「공지된 대상」·랜딩은 무기
// 합집합(3)이라 한 게임 안에서 같은 라벨이 두 수를 말했다. TFT도 선언 뷰·랜딩·브리핑이 각자 Set을 만들었다. 조항(줄) 수는
// 타일 부제 「· N개 항목」 한 곳이 든다(2026-10-09 결정). 순수 함수만 — 클라이언트 번들에서도 쓴다.

/** TFT·LoL 노트 — 줄이 아니라 그 줄이 가리키는 대상 수. */
export function tftNoteEntityCount(items: readonly { entity: string }[]): number {
  return new Set(items.map((n) => n.entity)).size;
}

/** PUBG 노트 — 조항이 가리키는 무기의 합집합. 무기를 가리키지 않는 조항(맵·시스템)은 대상이 아니다. */
export function pubgNoteTargetCount(notes: readonly { weaponKeys: readonly string[] }[]): number {
  return new Set(notes.flatMap((n) => n.weaponKeys)).size;
}
