# VERIFY-SPEC mobile-cta ST-2 — 세 브리핑 배치 + 파리티 게이트
- 변경 파일: `LolBriefing.tsx`(푸터 뒤), `TftBriefing.tsx`(관측·선언 두 분기 푸터 뒤), `PubgBriefing.tsx`(관측 분기 푸터 뒤), `src/app/__tests__/screen-parity.test.ts`(§8-1 행 추가, RED 선커밋)
- 구현 결정: `<main>` 안 마지막 자식으로 두어 스페이서가 푸터 아래 흐름에 들어간다 · PUBG 선언 뷰 제외(사이드 패널 부재와 일관)
- 미확인 사항: 세 브리핑의 `<main>` 바깥 래퍼(`GameRoot`/배경)가 `overflow`나 `transform`을 걸면 fixed가 뷰포트가 아닌 그 요소 기준이 될 수 있음 — 렌더로 확인(UI 게이트 375 캡처에서 y ≤ 812인지)
