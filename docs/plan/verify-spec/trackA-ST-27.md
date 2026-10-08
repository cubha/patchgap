### VERIFY-SPEC — SubTask ST-27 (LLM 요약 1회·근거 등급 색)
- 기준선 요구사항: "`ObservationCauses`가 요약을 그리고 `CausesPanel`이 또 그린다 → 한 곳만. 근거가 전부 「신뢰도 낮음」·미검증이면 요약을 `text-muted`·일반 굵기로. PUBG 상세의 공지 요약 2회도 1회" (PLAN ST-27 · 리뷰 lol-S10·tft-S16·pubg-S24)
- 변경 파일: `src/components/observation/ObservationCauses.tsx`(수정 — 머리 요약 제거) · `src/components/causes/CausesPanel.tsx`(수정 — `hasStrongCause`)
- 관찰 가능한 계약: 렝가·Beryl 상세 bodyText에 LLM 요약 문장이 1회. 룰루 상세처럼 근거가 전부 「신뢰도 낮음」이면 요약이 `text-muted font-normal`(본문색·굵은 글씨 아님). 검증된 보통 이상 근거가 있으면 `text-fg`.
- 구현 결정: 남긴 쪽은 `CausesPanel` 바닥(캡션 「캐시 {시각}」과 함께) — 근거 목록 **뒤**에 요약이 오는 편이 "근거 → 요약" 순서로 읽힌다. PUBG 머리 문장의 「공지 “…” 대조」(노트 요약 재인용)는 LLM 요약이 아니라 **그대로 두었다**(pubg-S24가 가리킨 중복은 LLM 블록 머리 = 결론 문장이고, 그것이 이 수정으로 1회가 된다).
- 인접 경계: `ObservationCauses`의 "LLM 미실행" 안내는 `CausesPanel` 바닥 블록이 같은 문구로 그린다(손실 없음). `llmCaption.test`·`CausesPanel` 렌더 테스트 통과.
- 미확인 사항: 요약이 2회였던 다른 화면(TFT·PUBG 상세)도 같은 컴포넌트 경유라 함께 닫혔다고 판단 — 렌더 캡처로 보지 않았다.
