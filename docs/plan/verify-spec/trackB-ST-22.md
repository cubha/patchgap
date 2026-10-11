# VERIFY-SPEC — 트랙 B ST-22 첫 화면 미공지 상위 (lol-S23 · pubg-S8)

- 변경 요약: `gapPreviewPick.ts` `pickGapPreview`(대상당 최대 → 크기순 → 상위 N) + `GapPreview`(텍스트 링크 한 줄 「미공지 상위 · 이름 → 지표 변화」). LoL(히어로 아래, 보고 자격 미공지·간접 행), TFT(타일 아래, 지표 Gap 행·`effectStrength`), PUBG(타일 아래, 지표 Gap 무기·상대변화)에 상위 3.
- 구현 결정: 탭 순서·주 행동 바인딩(디스코드) 유지 — pubg-S8 「채색 강조 = 미공지」 부분은 10/8 「바인딩 하향 기각」 결정으로 마감(PARTIAL 종결 사유). 채움 금지(D-UX-01). 수치 축(잠수함)은 넣지 않는다 — 지표 축 사례만(Gap 탭 위쪽 갈래가 수치 축 전수).
- 파일명 주의: `/mnt/d`(대소문자 무시)에서 `gapPreview.ts`와 `GapPreview.tsx`가 한 모듈로 해석돼 `gapPreviewPick.ts`로.
- 검증: `gapPreview.test.ts` 3 + 세 브리핑 사용 가드.
- 미확인 사항: 1280×800 fold 안에 실제로 들어오는지(LoL 히어로 pt-44 + 타일 + 이 줄) — VERIFY 렌더 실측.
