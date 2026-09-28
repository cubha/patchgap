# VERIFY-SPEC — 잔여 로드맵 PR-A (2026-09-28)

기준선: `docs/plan/PLAN-residuals-roadmap-2026-09-28.md` §PR-A · `docs/plan/BRAINTRUST-residuals-2026-09-28.md` §3·§6.
브랜치: `feature/silver_sh` (origin/main 대비 커밋 37개, 미푸시).

## A1 — TFT 자산 키 가드
- 변경: `src/pipeline/tft/asset-path.ts` `publicTftAssetPath`가 `^[A-Za-z0-9_]+$` 밖 키에 throw.
- 실측: 커밋된 매니페스트·두 판정 파일 키 위반 0건(throw가 빌드를 깨지 않음).
- 미확인: 한 커밋에 RED 테스트와 구현이 함께 들어갔다(선커밋 RED 절차 이탈 — 이후 항목은 분리).

## A2·A3 — C12 「소모」 좁히기 → C10 방향만 마이그레이션
- 변경: `LOWER_IS_BETTER_KEYWORDS` 「소모」→「체력 소모」, `HIGHER_IS_BETTER_OVERRIDES` +판매·환급. `scripts/run-migrate-note-directions.ts`(`migrateDirections`·`regroupModeNotes`).
- 구현 결정: 방향 힌트(blockquote 상향/하향)는 커밋 JSON에 없어 **캐시 원문 재파싱 결과에서 id로만** 옮긴다. 캐시에 없는 id는 그대로.
- 실측: core 변화 0(스크립트가 0이 아니면 throw). 모드 노트 6줄 교정(26.16 1 · 26.17 4 · 26.18 1) — PLAN §⑥ C10 「모드 6줄, core 0」과 일치.
- 미확인: 「둔화 기준치 50%→60%」(아레나 불타는 향로) buff→nerf는 기준치=낮을수록 좋음 규칙을 따른 것 — 원문 의미(둔화 발동 기준인지 저항 기준인지) 수동 확인 안 함. 애니비아 「재사용 최소 지연 시간 0→0.25초」 nerf도 같은 규칙.

## A4 — C16
- 변경: `globals.css` `@source not "../../docs";`, `DESIGN-TOKENS.md` 「알려진 lint 예외」(Tailwind `@property` 초기값 `#fff`).
- 실측: 빌드 CSS에서 `120px` 0건. `#fff` 2건 잔존(예외로 문서화).
- 미확인: design-lint 렌더 재실행은 안 했다(빌드 CSS grep만).

## A5 — C5 개정 태그를 프로필로 + 골든 가드
- 변경: `GameLlmProfile.promptRevision?`, 엔진은 옵션 우선·프로필 차선. PUBG 태그를 스크립트에서 프로필로 이동(키 불변). `__tests__/prompt-golden.test.ts` + `prompt-golden.json`(게임별 (태그, 지시문 sha256) 이력, 한 태그 한 해시).
- 미확인: 사용자 메시지 템플릿(`buildUserPrompt`) 변경은 가드하지 않는다 — 함수 소스 해시는 포맷 변경에도 깨져 캐시를 무효화하므로 제외했다.

## A6 — C9 모드 섹션 대상 재묶음
- 변경: `startsNewEntity`에 「h4 + 다음 형제 p>strong」, 범주 h4가 새 묶음을 열면 앞 대상을 끊음, 클래식 「아이템」 범주 아래 strong 라벨은 각각 대상. `regroupModeNotes`로 커밋 노트의 **모드 노트만** 재묶음(짝: modeScope+summary+순번).
- 실측: 구·신 파서 동일 캐시 HTML core 항목 **완전 동일**(4패치). 재묶음 26.16 5 · 26.17 8 · 26.18 0 · 26.19 51줄. 모드 노트 id는 다른 산출물 참조 0건.
- 명세 변경한 기존 테스트: `deltas-invariants.test.ts` 「인용 어긋남」의 이름 풀을 **core 노트로**(엔진 `candidatesOf`와 동일) — 모드 대상 「오른」이 문장의 「(유지력이) 오른」에 걸렸다.
- 미확인: 아레나 「삐뽀삐뽀」 뒤 증강 6개(응징의 천사…)는 여전히 삐뽀삐뽀에 묶인다(소개 문단 있는 증강 뒤의 문단 없는 증강 — 구조 신호 없음). 26.18은 캐시 원문이 사후 수정본이라 모드 재묶음 0건.

## A7 — C1 요약 100자
- 변경: 캐시 `proseRepairAttempts`(항목당 1회), `mergeRepairedProse(…, acceptSummaryCites)` — 새 인용이 검증 통과면 문장·인용 쌍째 채택, 그래도 초과면 `profile.fallbackSummary`(델타 수치만, `summaryCites=[]`, `summaryDeterministic=true`). 주격 조사·「로/으로」 끝소리 선택, 부호 중복 제거.
- 실측: LLM 호출 11회(LoL 2 · TFT 6+3). 요약 100자 초과 0(전 쌍). 결정론 요약 LoL 1 · TFT 18.2 3 · 18.3 2. 캐시 v5 위반·시도기록 없음 상한 39건.
- 미확인: 결정론 요약의 반올림(요정 16.2%→7.9%인데 −8.4%p — 원값 차이의 반올림)이 표시값 차이와 0.1 어긋날 수 있다.

## A8 — C4 요약 ↔ 인용 대상
- 변경: `summaryCitesAllMismatched` — 인용 **전부**가 다른 대상일 때만 `summaryVerified=false`.
- 실측: 재생성 3쌍 summaryVerified 변화 0.

## A9 — C3 원인 사실성 3종
- 변경: `cause-factuality.ts` — ① 「A→B」↔ 인용·형제 노트 before/after·요약 쌍·델타 자신 수치 ② PUBG 부호 백분율 ↔ 상대 변화·CI·재분배 기대치·전체 획득 변화 ③ 「전체 획득 감소」 귀속 ↔ 인용 무기 이전 비중 ≥ 50%. `verifyCauses`에 연결(공통 ①, 프로필 `isCauseGrounded`로 ②③).
- 실측(연결 전): LoL·TFT 5쌍 화살표 주장 567건 → 원 규칙 2건 걸림, 둘 다 사실(한 줄 두 수치·델타 표본 n) → 근거 출처 확장 후 0. PUBG 8원인 flip 0. 재생성 후 verified 변화 0.
- 미확인: 이 검사는 현재 데이터에서 **잡은 결함이 0**이다 — 가드로서의 가치만 있다. ②는 부호 없는 「17.9% 줄어」 형태를 보지 않는다(노트 수치와 구분 불가).

## A10 — C6 계측
- 변경: `ProseHygieneStats.causeUnnamedTarget`·`summaryDeterministic`, 엔진이 채워 meta.llm.prose로 나간다.
- 실측: LoL 26.19 causeUnnamedTarget 18.

## A11·A12 — C13·C14 선언/관측 분리 + stub
- 변경: `planTftRun`·`applyTftKeyFailure`(N=세트 중간 3·세트 개시 9, 관측 시점 `observedUntil` 기준), `planPubgRun`(수확 창 그대로 + 노트 즉시 선언, `windowLost`). `observation-stub.ts`·`scripts/write-observation-stub.ts`(같은 쌍 실제 관측은 덮지 않음). determine 두 스크립트 재작성(키는 관측 계획에만). `determine-report.ts` `reportDeclaration`·출력 `mode`·`declare`·`stub_reason`. 워크플로 두 개: 선언 스텝 `declare`, 관측 스텝 `should_run`, stub 스텝, 관측 크래시 → HEAD 복원 + 노트·F9·stub → 커밋(잡은 빨간 X 유지). 로더 `loadTftDeclaration`·`loadPubgDeclaration`(stub이면 `loadTft`/`loadPubg`는 null), `DeclarationOnly` 화면, 하위 화면 「관측 전」 사유, 헤더 크롬·랜딩(관측 수 `null`=「—」).
- C8(같이 들어감): `run-tft-aggregate --until`, `observedUntil` 기록. 18.2 `--until 2026-09-20T12:57Z` = 2,496매치 정확 재현, 수치 전부 동일(차이: 선체분쇄자 이름 조인 1건). 18.3 동일.
- 실측: 로컬 determine(9/28, 키 401) → 18.3 관측 필요(관측 시점 9/24 04:46Z < 3일차) → 키 실패 → 기존 관측 유지 skip. stub 픽스처로 `next build` 성공, TFT·PUBG 홈이 새 노트·회색 사유, 대조표·상세 「관측 전」, 랜딩 「—」 확인 후 픽스처 원복.
- 명세 변경한 기존 테스트: `tft-patch-calendar.test.ts`의 7일 대기·`determineTftRun` 블록 삭제(D6로 대체, `tft-run-plan.test.ts`) · `tft-pubg-data-invariants` PUBG 「쌍 파일 존재」가 stub이면 노트만 요구 · `landing.test` 부분집합 검사 null 허용.
- 미확인(**Actions 실측 없음** — 키 발급 선행 X1): 워크플로 `if:` 식(`!cancelled() && … && (success() || steps.crash_stub.outcome == 'success')`)은 YAML 파싱만 확인. 크래시 스텝의 `git restore`·`git clean` 범위가 관측 산출물을 정확히 되돌리는지 CI에서 본 적 없음. PR-A 머지 후 첫 TFT 실행은 **18.3 재수집**을 계획한다(관측 시점 3일차 이전) — 그날 키가 살아 있어야 한다.

## A13 — C15
- 변경: `gapEntityKeys`·`gapUnionCount`(`lib/gamedata.ts`), TFT 타일=통계 Gap 대상 수, 탭=합집합.
- 실측: 재생성 후 TFT 타일 31 · 탭 34(렌더 확인). LoL은 이번에 안 바꿨다(D2 — 세 게임 공용 합집합은 PR-C).

## A14 — F3 헤더 select
- 변경: 항상 disabled, `aria-describedby` sr-only 설명 + title.
- 미확인: 시각 설명은 title(hover)뿐 — 모바일에선 이유가 안 보인다.

## 데이터 재생성
- LoL 26.18→26.19 · TFT 18.1→18.2 · 18.2→18.3 · PUBG 43.1. 판정 상태·원인 검증 변화 0, 요약 교체 LoL 2 · TFT 18.2 5 · 18.3 3.
- 과거 LoL 쌍(26.16→26.17 · 26.17→26.18)은 재생성하지 않았다 — 화면에 안 나온다. B3(PR-C)로 노출될 때 같은 품질로 재생성한다(명문화 규칙 「새로 노출되는 과거 쌍은 최신 쌍과 같은 품질」).
