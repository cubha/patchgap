# VERIFY-SPEC R1-ST-3 — LLM 모델 Opus 5 + 프롬프트 v3 + CLI 기본 120 + 26.17→26.18·26.16→26.17 재실행

- 대상 파일: src/pipeline/match/llm-match.ts, scripts/run-match.ts, src/pipeline/match/__tests__/run-match.test.ts, data/aggregated/deltas/*.json, data/cache/llm/*
- 구현 결정:
  - PROMPT_VERSION v3(규칙 7~9) · 사용자 프롬프트 수치 %·%p·초 표기 · 포지션 한국어
  - run-match --llm-max 기본 50→120(테스트 어서션 갱신 — 명세 변경, DEFAULT_MAX_DELTAS와 일치)
- 부수 결정:
  - 모델 변경은 SCOPE §3·CLAUDE.md 선행 갱신(커밋 af3e158)
  - 재실행은 로컬 .env 키로, 산출물 커밋
- 미확인 사항:
  - Opus 출력의 low 신뢰도 비율(A/B 48/49)이 실제 실행에서도 재현되는지 — 결과 파일로 확인 예정
  - zod output_config가 Opus에서도 동일하게 동작하는지(실행 로그로 확인)
- 검증 방법: `bash verify.sh --full` + 해당 __tests__ + 프로덕션 재채점(SCORECARD §3 라운드2)
