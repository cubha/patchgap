# VERIFY-SPEC — 트랙 B ST-14 수치 축 행 링크 (parity-S11 · tft-S11)

- 변경 요약: LoL 브리핑 `SubmarineSection hrefOf` — 이 쌍에 상세 라우트가 있는 대상(`detailEntityKeys`)만 `lolEntityHref`. TFT 선언 뷰 — 관측이 있는 최신 쌍 상세에 그 대상이 있으면 그 쌍 상세로(`tftDetailRows` 자격, 404 방지).
- 구현 결정: tft-S11의 「잠수함 요약을 fold로」는 9/23 §8-3 결정(수치 축 = Gap 탭 최상단)과 충돌 — 링크만 고친다(감사 재해석). 상대%는 세 게임 공통 포매터(ST-9)로 이미 같다. PUBG 선언 뷰는 무기 상세 라우트가 없어 null 유지(가드가 예외로 명시).
- 검증: `wording.test.ts` hrefOf 가드(LoL·TFT 전 사용처 non-null, PUBG 관측 브리핑 weaponHref).
- 미확인 사항: 현재 LoL 26.20 잠수함 0종이라 실제 링크 렌더는 과거 쌍(26.16→26.17 등)에서만 확인 가능 — VERIFY 빌드 산출물로.
