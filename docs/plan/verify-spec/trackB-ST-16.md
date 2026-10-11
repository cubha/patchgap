# VERIFY-SPEC — 트랙 B ST-16 PUBG 머리 틀·표본 슬롯 (parity-S18 · parity-S29)

- 변경 요약: PUBG 대조표 `py-8`→`pt-40 pb-8`, eyebrow 「PUBG: BATTLEGROUNDS」 제거(대조표·방법론 2곳). 방법론 H1 「어떻게 판정했고, 무엇을 못 했나」→「배틀그라운드 — 어떻게 판정하나」(`gameLabel`). `PubgSampleNotice` 콜아웃 삭제 → 표본 슬롯 첫 문단.
- 구현 결정: `notice`는 관측 전 고지 전용으로 남긴다(TFT·PUBG 관측 전 분기).
- 검증: `wording.test.ts` 머리 틀 가드 3.
- 미확인 사항: breadcrumb y 좌표 차 ≤20px(수용기준)은 렌더 측정 — VERIFY에서 빌드 산출물 실측.
