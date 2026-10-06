# patchgap 분석 보고서

> 분석일: 2026-10-06
> 프로젝트: patchgap — 패치노트(선언) vs 매치 통계(관측) 괴리 정적 사이트 (LoL·TFT·PUBG)
> 분석 관점: 전체 분석 (예선 심사 9/21~10/5 종료 직후, `/refactoring` 착수 전 기준선)
> 방법: 에이전트 3종(구조·아키텍처·품질) 병렬 탐색 → 핵심 주장 메인 세션 재검증(grep·코드 대조) → `npm outdated`/`npm audit`

---

> **처리 결과(2026-10-06 같은 날)**: 이 보고서의 기술부채 #1~#12·로드맵 전건을 PR #71(CI 경로 — LoL LLM 총 상한·예산 $14·
> 쓰기 토큰 범위)·#72(구조 정리 17 SubTask)로 처리해 main에 머지했다. 기준선·대응표는 `docs/plan/PLAN-refactor-analysis-2026-10-06.md`,
> 남은 결정 1건(랜딩 어댑터 매핑표 문구)은 `PLAN-residuals-sweep-2026-09-27.md` §⑥ B6. 아래 본문은 착수 전 시점의 기록이다.

## 1. 프로젝트 개요

### 목적 및 핵심 가치
게임사가 패치노트로 **말한 것**과 매치 데이터가 **말하는 것**의 괴리를 보여준다. 두 발견 축이 직교한다 —
지표 축(승률·픽률 통계 추론)과 수치 축(F9: 잠수함 패치·공지값 불일치). 프로덕션 `patchgap.vercel.app`,
런타임 외부 호출 0(커밋된 JSON만 읽는 정적 export).

### 기술 스택
| 분류 | 기술 | 버전 | 비고 |
|---|---|---|---|
| 프론트 | Next.js (App Router, `output:"export"`) | 16.3.4 | 정적 배포 |
| UI | React / Tailwind v4 / recharts | 19.2.8 / 4 / 3.10 | recharts는 `ItemChart.tsx` 1곳만 |
| 파이프라인 | TypeScript + tsx (ESM) | 5.9.3 / 4.23 | `scripts/run-*.ts` 27개 |
| 수집 | fetch + bottleneck | 2.19 | Riot 2단 리밋, PUBG |
| LLM | @anthropic-ai/sdk (Opus 5.5) | 0.124.0 | `llm-match.ts` 단일 호출 지점 |
| 파서/검증 | cheerio / zod | 1.2 / 4.5 | |
| 테스트·품질 | vitest(dom/node 2프로젝트) + eslint 9 + tsc + verify.sh | 5.0 | 테스트 파일 171개 |
| CI/운영 | GitHub Actions 5종 + Vercel | — | 매일 감시자→수집 무인 |

### 현재 완성도
세 게임 수집·집계·판정·LLM 원인·화면(브리핑/대조표/방법론/상세)·과거 패치쌍(LoL·TFT)·패치 캘린더 무인화까지 완료.
4개 워크플로가 9/29~10/6 매일 성공(실제 수집은 신규 패치 발생 시에만 — 현재 26.19/18.3/43.1 모두 최신).

---

## 2. 아키텍처 분석

### 구조 개요
```
src/app/         19 page.tsx (lol·tft·pubg × 홈/compare/methodology/상세 + LoL·TFT history)
src/components/  공통 ~26 + compare/ home/ detail/ methodology/ gamedata/ causes/ tft/ pubg/
src/lib/         빌드 타임 로더(data.ts=LoL, tftData, pubgData, gamedata) + 라우트·포맷 유틸
src/pipeline/    collect / aggregate(순수) / match(판정+LLM) / gamedata(F9) / discord / shared / types.ts
scripts/         run-*·*-determine·patch-watch (워크플로 진입점)
data/            aggregated(커밋) · cache/llm(커밋, 1,969) · raw(gitignore)
```

### 데이터 흐름
```
collect → data/raw/*.jsonl → aggregate(순수) → data/aggregated/{patch}
  → match/{delta,tft-delta,pubg-delta}(BH-FDR/Newcombe) → llm-match(GameLlmProfile)
  → data/aggregated/deltas/*.json → lib 로더(빌드 타임 fs) → app 서버 컴포넌트 → out/
```
PUBG만 집계와 판정이 `run-pubg-aggregate.ts` 한 스크립트에 합쳐져 있다(`:33`).

### 사용 패턴
- **Strategy** — `GameLlmProfile`(`llm-profile.ts:52`) + 게임별 3구현. 코드로 실재하는 유일한 게임 어댑터.
- **Overlay 병합** — 기저 상수 + 감시자 오버레이(`data/patch-calendar/*.json`), 롤백 = 파일 비우기.
- **서버 계산 → 클라이언트 얇은 상태** — `"use client"` 23개, 전부 경로 판별·탭·필터·이미지 폴백·recharts 사유.
- **사유 동반 스킵** — `reportSkip(game, reason, detail)`로 초록불 no-op의 원인을 강제.

### 평가
| 항목 | 평가 | 근거 |
|---|---|---|
| 레이어 분리 | 높음 | Riot/PUBG 호출은 collect만, Claude는 `llm-match.ts`만, aggregate fs 0, pipeline→components 역참조 0(※정정 2026-10-06: pipeline/discord → lib의 순수 유틸 3개(format·detailRoutes·pubgRoutes) 의존은 있다 — 디스코드가 화면과 같은 링크·포맷을 써야 하는 정당한 의존) |
| 패턴 일관성 | 보통 | LLM 2단·UI 쉘(CompareToolbar/NoteNavPanel/BriefingTabs)은 공용, 수집·1단 판정·로더·표 본문은 게임별 평행 3벌 |
| 확장성 | 보통 | 4번째 게임 = LLM 프로필 1개 + 나머지 평행 파일 세트 신설. `adapterMatrixData.ts`가 서술하는 `NoteSource`/`MatchSource` 인터페이스는 코드에 없음 |
| 테스트 가능성 | 높음 | fetchImpl 주입, 순수 함수 판정, 171 테스트 파일, screen-parity 계약 테스트 |

**경계 예외(문서화됨)**: `LolItemDetail.tsx:139-151`이 해시용 원문을 위해 `data.ts`를 우회해 fs 재독 ·
`lib/gamedata.ts` 별도 fs 로더 · `lib/{landing,pairPages,breadcrumbs}.ts → components` 역방향 import(순환 아님) ·
`pipeline/gamedata/types.ts`·`PubgDeltaRow` 등 `types.ts` 밖 산출물 스키마.

---

## 3. 코드 품질

### 강점
- 프로덕션 코드 `any`/`as unknown as`/`dangerouslySetInnerHTML`/런타임 외부 fetch **0건**.
- 워크플로 `run:`에 사용자 입력 `${{ }}` 직삽입 없음(전부 `env:` 경유), 시크릿 스텝 스코프.
- 빈 `catch {}`는 전부 의도 주석 동반. 과거 결함이 실측치와 함께 주석에 남아 재발 방지 근거가 됨.

### 기술 부채
| # | 항목 | 심각도 | 위치 | 설명 |
|---|---|---|---|---|
| 1 | LoL LLM 호출 총 상한 미전달 | 🔴 | `scripts/run-match.ts:166-169`, `llm-match.ts:48` | `maxDeltas`만 넘기고 `maxTotalCalls`는 기본 150. CI는 `--llm-max 400`. 미스 150건 초과 패치에서 뒤쪽 델타가 `call-budget-exceeded`로 회색 — 9/17 B5와 같은 증상. TFT(`run-tft-match.ts:191`)는 `llmMax+40`으로 고쳐져 있음. 견적도 150에서 잘려 예산 게이트를 우회 |
| 2 | effort 기본값 변경 시 캐시 키 충돌 | 🟡 | `llm-match.ts:98-105`, `llm-config.ts:38-43` | 태그가 "현재 상수와 다를 때만" 붙어, `LLM_EFFORT`를 medium→high로 바꾸면 기존 medium 답이 high 키로 적중. 주석은 반대로 주장. 테스트는 명시 effort만 검증 |
| 3 | `persist-credentials` 미설정 | 🟡 | `.github/workflows/{collect,collect-tft,collect-pubg,patch-watch}.yml` | `contents: write` 토큰이 `.git/config`에 남은 채 `npm ci` postinstall 실행 — 워크플로 스스로 명시한 위협 모델이 GITHUB_TOKEN엔 열려 있음 |
| 4 | 퍼센트·백오프 등 유틸 사본 | 🟡 | `pct`/`signedPct`: `tft/shared.tsx`·`pubg/shared.tsx`·`pubg/evidenceProse.ts`·`discord/pubg-briefing.ts`·`StatusDefinitionTable.tsx` / `backoffMs`·`defaultSleep`: riot-client·tft-client·webhook / `trimmed`·`PATCH_ID_PATTERN`: 3 determine / `readJson` 5곳 | 동작은 같지만 자릿수 기본값이 사본마다 다름(2 vs 1) |
| 5 | 메트릭 포맷 3벌 | 🟡 | `lib/format.ts`·`components/home/logic.ts`·`components/item/metricFormat.ts`(+`tft/shared.tsx`) | `metricKind`/`formatMetricValue` 시그니처 상이 |
| 6 | 앵커 해시 이중 구현 | 🟢 | `shared/excluded-notes.ts::noteAnchorHash`(미사용) vs `shared/mode-scope.ts::anchorHashOf` | |
| 7 | 미사용 export | 🟢 | `PubgPageHeader`, `TftPageHeader`, `TftMetricCaption`, `gameDataEntityCount`, `noteAnchorHash`, `TELEMETRY_RETENTION_HOURS` | 정의 파일 밖 참조 0(grep 확인) |
| 8 | 테스트 전용 export ~25개 | 🟢 | `compare/logic.ts`·`home/logic.ts`·`pairRoutes.ts` 등 | 운영 경로 사용 0 — 죽은 로직을 테스트만 붙들고 있을 가능성(knip 재확인 필요) |
| 9 | 문서 드리프트 | 🟢 | `llm-match.ts:2`(Sonnet 5 표기), `:589,591`(기본 50/60 표기 vs 120/150), `collect.yml:161`·`collect-tft.yml:228`(cache/llm gitignore 서술), `collect-tft.yml:69`·`collect-pubg.yml:55`(줄 번호 참조) | |
| 10 | design-lint 외부 경로 의존 | 🟢 | `verify.sh:308` | `$HOME/.claude/skills/...` 부재 시 조용히 스킵 — CI에선 항상 스킵 |
| 11 | 대형 파일 | 🟢 | `llm-match.ts` 948 · `delta.ts` 743 · `patchnotes-parser.ts` 728 · `run-ddragon.ts` 584 | 분할 후보(기능 결함 아님) |
| 12 | vitest `exclude: e2e/**` | 🟢 | `vitest.config.ts` | 존재하지 않는 디렉토리 |

### 보안 점검
- **의존성**: `npm audit --omit=dev` — next 16.2.0–16.3.5 **critical**(GHSA-vcvr-r3jv-pc5j, `next/og` ImageResponse RCE),
  source-map-js high(DoS). **실노출 없음**: `next/og`/`ImageResponse` 사용 0 + 정적 export(서버 없음). 그래도 16.3.8 패치 업은 무비용.
- CI: 부채 #3(persist-credentials). 그 외 인젝션·시크릿 노출 없음.
- 런타임: 정적 HTML, 사용자 입력 처리 없음 — OWASP 웹 항목 대부분 해당 없음.

### 성능 점검
- 빌드 타임 로더가 페이지마다 JSON을 재파싱(정적 export라 런타임 영향 없음, 빌드 시간만).
- CI 수집은 시간 상한·부분 저장(#54·#60)으로 이미 방어. 신규 병목 HIGH 없음.

---

## 4. 기술 트렌드 대비

### 스택 최신성 (`npm outdated`, 2026-10-06)
| 기술 | 현재 | 최신 | 상태 |
|---|---|---|---|
| next / eslint-config-next | 16.3.4 | 16.3.8 | ⚠️ 패치 업 권장(audit) |
| react / react-dom | 19.2.8 | 19.3.0 | ⚠️ 마이너 |
| @anthropic-ai/sdk | 0.124.0 | 0.131.0 | ⚠️ 0.x 마이너 — 변경 로그 확인 후 |
| zod | 4.5.4 | 4.6.5 | ⚠️ 마이너 |
| vitest / tsx / @vitejs/plugin-react | 5.0.0 / 4.23.13 / 6.1.1 | 5.0.3 / 4.23.15 / 6.1.2 | ✅ 패치 |
| typescript | 5.9.3 | 7.0.2 | 고정값(SCOPE §3 "TypeScript 5") — 변경 대상 아님 |
| eslint / dotenv / @types/node | 9 / 17 / 22 | 10 / 18 / 26 | 메이저 — 필요 시 별도 검토(Node 22 고정이라 @types/node 22 유지가 맞음) |

### 대안 기술 검토
SCOPE §3 고정 스택 — 대안 채택 검토 대상 아님. 기존 `RESEARCH-patchgap-2026-09-05.md` §2·§6이 스택 근거를 소유하므로 재조사 생략.

---

## 5. 개선 로드맵

### 즉시 개선 (Quick Win)
- [ ] 🔴 `run-match.ts`에 `maxTotalCalls: llmMax + 40` 전달(TFT와 동일) + 회귀 테스트
- [ ] 🟡 effort 캐시 키: 기본값 비교 대신 고정 기준값(`"medium"`) 비교로 바꿔 기존 캐시 적중 유지 + 기본값 변경 시 키 분리 + 테스트
- [ ] 🟡 수집 4워크플로 checkout `persist-credentials: false` + 푸시 스텝에서만 토큰 주입
- [ ] next/eslint-config-next 16.3.8, 패치 레벨 devDeps 업
- [ ] 미사용 export 6건 제거, `noteAnchorHash` 중복 정리, 문서 드리프트 주석 4곳 수정, vitest `e2e/**` 제거

### 단기 개선 (1~2주)
- [ ] `pct`/`signedPct`/`backoffMs`/`defaultSleep`/`readJson`/`trimmed`·`PATCH_ID_PATTERN`을 `shared/`로 단일화(자릿수 기본값 차이는 인자로)
- [ ] 메트릭 포맷 3벌 통합(`lib/format.ts` 단일 소스)
- [ ] 테스트 전용 export ~25개를 knip으로 재확인 → 죽은 로직이면 테스트와 함께 제거
- [ ] `LolItemDetail` fs 재독 → `data.ts`에 raw 텍스트 반환 옵션
- [ ] design-lint를 repo 내 스크립트로 고정하거나 CI 스킵을 명시 경고로

### 중장기 개선 (1개월+, 다음 게임 어댑터 착수 시)
- [ ] 도타2 착수 전에 determine·patch-calendar·로더의 공통 인터페이스 추출 — 지금 4벌째 평행 파일을 만들면 중복이 33% 증가
- [ ] `adapterMatrixData.ts`의 서술 인터페이스(`NoteSource`/`MatchSource`)를 실제 타입으로 만들거나 방법론 문구를 "LLM 2단만 공용"으로 정정
- [ ] PUBG 페이지 내장 로직(브리핑·상세)을 `components/pubg/`로 이동해 LoL·TFT와 대칭화
- [ ] `llm-match.ts`(948줄)를 계획·캐시·호출·검증 모듈로 분할

---

## 6. 리서치 출처
- `npm outdated` / `npm audit --omit=dev` (2026-10-06 로컬 실행)
- GitHub Advisory GHSA-vcvr-r3jv-pc5j (next/og RCE), GHSA-68fv-2mgg-jv7q (source-map-js)
- 기존 리서치: `docs/research/RESEARCH-patchgap-2026-09-05.md` (스택·아키텍처·경쟁 — 재조사 생략)

> 이 보고서는 Claude Code `/analyze` 스킬로 자동 생성되었습니다.
