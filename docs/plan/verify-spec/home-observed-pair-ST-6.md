# VERIFY-SPEC ST-6 — TFT 홈·브리핑에 newer 배너 · 선언 뷰에 eta · LoL은 배너 없음(stub 파이프라인 없음)
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/app/tft/page.tsx · src/components/tft/TftBriefing.tsx
- 구현 결정:
- 배너는 홈(평소 주소)만 받는다 — 과거 쌍 페이지는 `newer` 기본 []. 히어로 캡션 바로 아래, 3타일 위.
- 선언 뷰(TftDeclarationView)는 골격(타일 —·Gap 탭) 유지 — ST-16(parity-S2) 결정 존중. 바뀐 건 캡션·날짜뿐.
- 미확인 사항:
- 타일 「—」·「미공지 Gap 4」 탭의 표현 자체는 사용자가 「저따구」라 부른 요소일 수 있다 — 이번 범위는 '홈에서 치운다'이고 선언 뷰 자체의 시각 개선은 하지 않았다(PLAN ② 범위).
