# VERIFY-SPEC — 트랙 B ST-13 LoL 접힌 행·탭 머리 (parity-S9)

- 변경 요약: `ReleaseNoteRow` 이름 옆 유형 줄(아이콘 해석 종류 → `entityTypeLabel`, 없으면 노트 섹션 → `noteSectionLabel`). `BriefingTabs.CONTENT_TAB_TITLE` 상수 — TFT·PUBG 카드 제목과 LoL 스트림 패치 내용 탭 머리(「대조 · 공지된 변경은 실제로 그렇게 됐나」)가 같은 상수.
- 구현 결정: LoL 접힌 행의 대표 관측 값(ST-08·ST-19 산출)은 유지 — §8-2 접힘 정의에 대표 관측 1줄을 넣을지는 사용자 결정 사항이라 제거하지 않고 「유형」만 더했다(감사 권고).
- 검증: `wording.test.ts` 상수 사용·`data-row-type` 가드.
- 미확인 사항: 「유의한 관측 없음」 묶음·치장 묶음 행의 유형 줄 표시 여부는 렌더로 확인(섹션 라벨 폴백).
