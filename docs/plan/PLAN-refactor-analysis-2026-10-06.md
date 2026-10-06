# PLAN — /analyze 기술부채 전건 리팩토링 (2026-10-06)

## ① 사용자 요구사항 원문
- "우선 /analyze 및 /refactoring 진행해"
- (리팩토링 계획 제시 후) **"이월없이 전건진행 /sh-dev-loop --tdd --auto"**

기준 문서: `docs/analysis/ANALYSIS-patchgap-2026-10-06.md` §3 기술부채 표 #1~#12 + §5 로드맵 +
리팩토링 계획(대화)의 9건 + 그 계획의 "제외 목록" 전부. "이월 없음" — 제외 목록도 대상이다.

### 리팩토링 계획(대화)의 "제외 목록" 원문 — 사용자 "이월 없이"로 전부 대상에 포함
- signedPct 나머지 사본(%p / − 기호 / 0 처리가 다름) → ST-7(스타일 옵션으로 단일화)
- readJson(throw / null / try-catch 의미가 다름) → ST-8(의미별 변종으로 단일화)
- 메트릭 포맷 3벌(시그니처 설계 필요) → ST-9
- 테스트 전용 export ~25개(knip 재확인 필요) → ST-10
- 대형 파일 분할 · 게임 어댑터 인터페이스(아키텍처 재설계) → ST-14 · ST-15
- next 16.3.8 업(의존성 변경) → ST-17
- 계획 9건 중 3번 워크플로(persist-credentials) → ST-2(PR-1에서 브랜치 dispatch로 검증)

### 리팩토링 계획(대화) 9건 → SubTask 대응
| 계획 # | 내용 | SubTask |
|---|---|---|
| 1 | LoL `maxTotalCalls` 누락(상한 150 고정) | ST-1 |
| 2 | `cacheKeyFor` effort 기준값 | ST-3 |
| 3 | 워크플로 checkout 토큰 범위 | ST-2 |
| 4 | 미사용 export 6건 | ST-4 |
| 5 | `PATCH_ID_PATTERN` 4벌 + `trimmed()` 3벌 | ST-5 |
| 6 | `defaultSleep`/`backoffMs` 3벌 | ST-6 |
| 7 | `pct`/`signedPct` 사본 | ST-7 |
| 8 | 문서 드리프트 주석 4곳 | ST-12 |
| 9 | vitest `e2e/**` exclude | ST-12 |

## ② 확정 제약
- 리팩토링 = **기능 보존**. 동작이 바뀌는 것은 🔴#1(버그 수정)과 #3(CI 인증 배선)뿐이며 명시한다.
- 의미가 다른 사본(signedPct 변종·readJson 변종)은 **출력을 하나로 합치지 않는다** — 옵션/명시 변종으로 단일 소스화하고,
  호출부별 현재 출력을 특성화 테스트로 먼저 고정한다.
- 테스트를 통과 목적으로 수정 금지. 죽은 export를 지울 때 그 테스트를 함께 지우면 보고서에 파일명을 명시한다.
- 새 의존성 추가 금지(knip 등). SCOPE §3 고정값(TS 5·Node 22·eslint 9) 메이저 업 금지 — next 16.3.x 패치 업만.
- `llm-match.ts`가 Claude SDK 호출의 유일한 계층 — 분할 시 `import Anthropic`·`new Anthropic()`은 이 파일에 남긴다.
- 공용 모듈에서 `server-only` import 금지(tsx 스크립트가 터진다).
- 시한: LoL 26.20 실발화(감시자 2026-10-07 19:00 UTC → collect 10/8 00:00 UTC) 전에 PR-1 머지 + 브랜치 dispatch 검증.

## ③ SubTask (라우팅: 전량 [S] — `llm-match.ts` 등 파일 겹침, 작업 트리 비청결)

### PR-1 `refactor/ci-llm-cap` (CI 경로 — 먼저 머지)
| ID | 내용 | 파일 | 태그 |
|---|---|---|---|
| ST-1 | LoL LLM 총 상한 150 고정 결함 — 엔진이 `totalCallCapFor(maxDeltas)`로 유도(max(150, maxDeltas+40)), TFT 명시값 제거(단일 소스), collect.yml 예산 명시($14 ≥ 440×$0.03) + 예산≥견적 구조 게이트 테스트, llm-config 주석 정정 | `llm-match.ts`, `run-tft-match.ts`, `llm-config.ts`, `collect.yml`, `llm-cost-policy.test.ts` | [TDD] |
| ST-2 | 쓰기 토큰 범위 — 5 워크플로 checkout `persist-credentials: false`, push 스텝에서만 extraheader 주입, patch-watch 매일 push 인증 카나리아(`git push --dry-run`) + 가드 테스트 | `.github/workflows/*.yml`, `workflow-credentials.test.ts` | — (CI 설정) |

### PR-2 `refactor/analysis-debt` (구조 정리)
| ID | 내용 | 태그 |
|---|---|---|
| ST-3 | effort 캐시 키: 비교 기준을 고정 리터럴(캐시 생성 기준 effort)로 분리, `cacheKeyFor`가 기준값을 인자로 받음. 실제 캐시 파일 golden 테스트 + 기본값 변경 시나리오 테스트 | [TDD] |
| ST-4 | 미사용 export 6건 제거(PubgPageHeader·TftPageHeader·TftMetricCaption·gameDataEntityCount·noteAnchorHash·TELEMETRY_RETENTION_HOURS) + 앵커 해시 이중 구현 정리 | — |
| ST-5 | `PATCH_ID_PATTERN` 4벌 + `trimmed()` 3벌 → `scripts/shared/cli.ts` 단일 export(공용화하며 `envValue(name, env?)`로 개명 — 3개 determine 스크립트가 import) | — |
| ST-6 | `defaultSleep`/`backoffMs` 3벌 → `pipeline/shared/retry.ts`(base는 인자) | — |
| ST-7 | `pct`/`signedPct` 사본 전부 → `pipeline/shared/percent.ts`(단위 `%`/`%p`·부호 규칙·마이너스 기호를 옵션으로), 호출부별 특성화 테스트 선고정 | — |
| ST-8 | `readJson` 변종 → 명시 2변종(없으면 null+깨지면 throw / 깨져도 null)으로 단일화(lib 3곳 + scripts 동일 사본) | — |
| ST-9 | 메트릭 포맷 3벌(`lib/format.ts`·`home/logic.ts`·`item/metricFormat.ts`·`tft/shared.tsx`) → `lib/format.ts` 단일 소스, DeltaMetric 전체 golden 선고정 | — |
| ST-10 | 테스트 전용 export ~25개 재확인 → 같은 파일 내 호출자 없는 진짜 죽은 로직은 함수+테스트 함께 제거(보고서에 파일 명시), 살아 있는 것은 export만 정리 | — |
| ST-11 | `LolItemDetail` fs 재독 → `data.ts`에 원문 반환 로더 | — |
| ST-12 | design-lint CI 스킵을 명시 경고로 · vitest `e2e/**` 제거 · 문서 드리프트 주석 4곳 · `pubgData.ts` `server-only` | — |
| ST-13 | `lib → components` 역방향 import 3건(landing·pairPages·breadcrumbs) — 순수 로직을 lib로 이동, components는 lib에서 import | — |
| ST-14 | `llm-match.ts`(948줄) 분할 — 캐시/견적/검증 모듈로 이동 + re-export(import 경로 불변), SDK 호출은 원 파일 유지. `delta.ts`·`patchnotes-parser.ts`·`run-ddragon.ts`는 응집도 평가 후 판정 기록 | — |
| ST-15 | 게임 어댑터 계약을 실제 타입으로 — `types.ts`에 determine/캘린더 등 공통 계약 타입, 기존 모듈 `satisfies`. `adapterMatrixData.ts` 서술과 코드 일치 확인 | — |
| ST-16 | PUBG 페이지 내장 로직(브리핑·무기/맵 상세) → `components/pubg/` 이동(LoL·TFT 대칭) | — |
| ST-17 | next/eslint-config-next 16.3.8 + 패치 레벨 devDeps(vitest·tsx·plugin-react) | — |

## ④ 기능 보존 증거
- `bash verify.sh --full`(tsc·eslint·vitest·build)
- **캐시 전용 재실행 diff**: `run-match 26.18→26.19`, `run-tft-match 18.2→18.3`, PUBG LLM을 임시 출력으로 재실행 → 커밋된 deltas JSON과 동일(미스로 멈추면 캐시 키 변동 신호)
- 정적 빌드 `out/` 전후 HTML diff(ST-9·13·16)

## ⑤ UI 설계 명세
없음 — 화면 변경 없음(ST-16은 파일 이동, 렌더 결과 동일이 기준).
