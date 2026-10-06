### VERIFY-SPEC — SubTask ST-8
- 기준선 요구사항: "`readJson` 변종 → 명시 2변종(없으면 null+깨지면 throw / 깨져도 null)으로 단일화(lib 3곳 + scripts 동일 사본)"
- 변경 파일: pipeline/shared/json-file.ts(신규, 3변종 — Required 추가)·__tests__/json-file.test.ts · lib/{data,tftData,pubgData}.ts · pipeline/match/ddragon.ts · scripts/{run-pubg-assets,run-tft-match,run-gamedata-diff}.ts
- 관찰 가능한 계약: 각 호출부의 실패 의미 유지(lib/data·pubgData: 없으면 null·깨지면 throw / tftData: 둘 다 null / 스크립트·ddragon: 없으면 같은 메시지로 throw)
- 구현 결정: PLAN은 2변종이라 했으나 스크립트·ddragon의 "없으면 메시지와 함께 던짐"이 세 번째 의미라 Required를 추가. run-gamedata-diff는 원래 ENOENT를 던졌고 이제 "입력이 없다: {path}" 메시지(던지는 동작은 같음)
- 인접 경계: server-only를 json-file에 넣지 않음(tsx 스크립트 공용)
- 미확인 사항: run-gamedata-diff 에러 메시지 문자열 변경을 기대하는 외부 소비자 없음(grep 확인)
