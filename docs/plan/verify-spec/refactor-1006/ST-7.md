### VERIFY-SPEC — SubTask ST-7
- 기준선 요구사항: "`pct`/`signedPct` 사본 전부 → `pipeline/shared/percent.ts`(단위 `%`/`%p`·부호 규칙·마이너스 기호를 옵션으로), 호출부별 특성화 테스트 선고정"
- 변경 파일: pipeline/shared/percent.ts(신규)·__tests__/percent.test.ts · components/{tft,pubg}/shared.tsx · components/pubg/evidenceProse.ts · components/methodology/StatusDefinitionTable.tsx · pipeline/discord/pubg-briefing.ts
- 관찰 가능한 계약: 다섯 호출부 출력이 원래 식(오라클)과 문자 단위 동일 — digits 0/1/2 × 14값(±0·반올림 경계 포함)
- 구현 결정: 스타일 상수 3개(SIGNED_POINT·SIGNED_PERCENT·SIGNED_PERCENT_PROSE). PUBG 화면·디스코드는 같은 상수 — 손으로 맞추던 규칙이 구조로 묶임
- 인접 경계: 디스코드 메시지 문구, PUBG 근거 산문
- 미확인 사항: NaN 입력은 오라클과 다르다(evidenceProse 원식 −NaN% · 새 함수 +NaN%, TFT 원식 NaN%p · 새 함수 +NaN%p) — 판정 산출물에 NaN이 없다는 전제(scope-critic 지적으로 정정)
