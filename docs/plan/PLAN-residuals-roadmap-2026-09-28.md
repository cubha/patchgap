# PLAN — 잔여 전건 해소 로드맵 실행 (PR-A · PR-B · PR-C) — 2026-09-28

기준선 상세: `docs/plan/BRAINTRUST-residuals-2026-09-28.md` §3 해소안 · §4 결정 D1~D8(전부 권장안 채택) · §6 외부검토 수정(§6이 §3을 덮어쓴다).

## 요구사항 (사용자 원문)

- R0. "우선 개선대상, 신규구현 항목 등 키발급이 선행되어야항목 제외한 나머지대상들 /sh-dev-loop --tdd --auto진행해"
- 선행 결정: "전부 권장안방향으로 채택. 위 점검 전체대상 진행할수잇도록 로드맵으로 묶어서 메모리에기록해줘" (D1~D8)
- 상위 결정 8: 선언 축(패치노트)은 항상 최신, 관측 축이 인질로 잡지 않는다.

## 제외 합의 (키 발급 선행 = 이번 범위 밖)

- X1. TFT 실 API 재수집 실행(18.3 N일차 재수집 · 18.4 수집) — `RIOT_TFT_API_KEY` 개발 키가 9/26부터 401. **코드(C13·C14)는 범위 안**, Actions 실측 증명만 범위 밖.
- X2. push·PR·머지 — 요청되지 않았다. PR-A 머지는 TFT 재수집을 켜므로 키 갱신일과 맞춰야 한다(사람 결정).
- X3. B4 N4 — 잔여 아님(D7), 별도 SCOPE.

## 실행 구조

세 PR을 **순차 3 패스**로, 로컬 누적 브랜치에서 진행한다(B는 A의 데이터, C의 B3는 B의 품질에 의존).
- PR-A: `feature/silver_sh` · PR-B: `feature/residuals-prb`(A 위) · PR-C: `feature/residuals-prc`(B 위, 10/6 머지)
- 전량 `[S]` — `llm-match.ts`·파서·`data/aggregated`를 공유해 worktree 병렬은 재생성 JSON이 충돌한다.
- 각 PR 안에서 코드 먼저, 데이터 재생성은 끝에 1회.

## PR-A — LLM 재질의 최소(C1 재요청분만, 수 명시)

| ID | 항목 | TDD | 수용 기준 |
|---|---|---|---|
| A1 | TFT 자산 키 가드 `publicTftAssetPath` 키 `^[A-Za-z0-9_]+$` 외 throw | [TDD] | 경로 탈출 키 throw 테스트 |
| A2 | C12 「소모」→「체력·마나·기력 소모」 + 「판매」「환급」 예외 | [TDD] | 26.16 「중첩 소모」 방향 불변 |
| A3 | C10 커밋 노트 `direction`만 재계산(id 불변, 재파싱 없음) | — | 전 커밋 노트 core 방향 변화 0 assert |
| A4 | C16 `@source not "../../docs"` · `#fff` lint 예외 | — | 유령 클래스 2개 빌드 CSS에서 소멸 |
| A5 | C5 프로필 `promptRevision`(빈 기본값, 캐시 키 불변) + 골든 가드 | [TDD] | 지시문 변경+태그 불변이면 테스트 실패 |
| A6 | C9 `startsNewEntity`에 「h4 + 다음 p>strong」 | [TDD] | core 노트 id·후보 해시 불변, 모드 섹션 재묶음 |
| A7 | C1 `proseRepairAttempts` 캐시 기록 + 재요청 요약 인용 통과 시 채택 + 초과 시 결정론 수치 요약 | [TDD] | 요약 100자 초과 0 · 캐시 적중 재요청 1회 한정 |
| A8 | C4 요약 인용 **전부** 불일치일 때만 `summaryVerified=false` | [TDD] | 현 데이터 오탐 0 |
| A9 | C3 결정론 사실성 검사 3종(A→B · ±X% · 획득 감소 귀속) — 연결 전 전 쌍 측정·수동 대조 | [TDD] | 플래그 전건 수동 대조 = 실제 오류 |
| A10 | C6 `meta.llm`에 대상 이름 없는 원인 수 계측 | — | meta 필드 존재 |
| A11 | C13 TFT·PUBG 선언 축 분리: 노트·F9는 키/대기 무관 즉시, 관측 재수집은 **기록된 관측 cutoff** 기준 N일차(세트 중간 3 · 세트 개시 9) | [TDD] | fake-clock 테스트: cron 지연·누락일에도 1회 재수집, 매일 재수집 아님 |
| A12 | C14 크래시·키 만료 시 노트 + `meta.observationFailed` stub 판정 파일; stub은 "산출물 없음" 취급; 화면 관측 영역 회색 사유 | [TDD] | stub 쌍이 화면에 선택되고 노트가 보임 |
| A13 | C15 TFT 타일·탭을 대상 합집합으로 | [TDD] | 타일 31 · 탭 34 |
| A14 | F3 헤더 패치쌍 select 표시 전용(비활성 + 설명) | — | onChange 없는 활성 select 0 |

## PR-B — LLM 재질의 1 배치(D8 ≈200)

| ID | 항목 | TDD | 수용 기준 |
|---|---|---|---|
| B1 | C7 TFT 마나 시작/최대 위치별 의미(시작↑좋음·최대↓좋음·혼재=조정) | [TDD] | 마오카이 2·아칼리·레오나 방향 교정 |
| B2 | C7 `#patch-midpatch-updates` 체이닝 | [TDD] | 추가 패치 줄 구분 |
| B3 | C11 `, <라벨>: X ⇒ Y` 줄 분할 | [TDD] | 3줄 분할 |
| B4 | C2 DDragon 수치 대조로 합친 이름 노트 분해(불일치면 현행 유지) + linkedNotes 재생성 + from DDragon 부재 시 크게 실패 | [TDD] | 세계 지도집·룬 나침반·세계의 결실 분해 |
| B5 | 재생성: TFT 18.1→18.2 · 18.2→18.3 · LoL 26.18→26.19 (쌍별 실행, 상한 400) | — | 불변식 전부 통과 |

## PR-C — 브랜치 준비만, 10/6 머지

| ID | 항목 | 수용 기준 |
|---|---|---|
| C1 | B1 섹션 순서 뒤집기(발견 먼저) + `screen-parity.test.ts` 명세 변경(보고) | 세 게임 동일 순서 |
| C2 | B2 TFT·PUBG 탭을 LoL식(카드 안)으로 | 세 게임 탭 위치 동일 |
| C3 | D2 타일=탭 합집합(잠수함 포함) 세 게임 공용 헬퍼 | 타일 숫자 = 탭 숫자 |
| C4 | B3 `/lol/history/[pair]/` 정적 라우트(`generateStaticParams`) + select 배선 | 과거 쌍 정적 생성 |

## 명세 변경한 기존 테스트 (보고 대상 — 2026-09-28 구현 중 추가분 포함)
- PUBG 불변식 「화면이 읽는 쌍의 파일이 전부 있다」 — `observationFailed` stub 허용 (A12)
- `tft-patch-calendar.test.ts` 7일 대기·`determineTftRun` 블록 삭제 → `tft-run-plan.test.ts`로 대체 (A11, D6이 7일 대기를 폐기)
- `landing.test.ts` 「미공지 ⊆ 유의」 검사를 관측 전(null) 허용으로 (A12 — 관측 없는 카드는 0이 아니라 null)
- `deltas-invariants.test.ts` 「인용 어긋남」 이름 풀을 core 노트로 (A6 — 엔진 `candidatesOf`와 같은 풀. 모드 대상 「오른」이 「(유지력이) 오른」에 걸림)
- `screen-parity.test.ts` 섹션 순서·2컬럼 골격(카드·사이드 한 행)·상세 계약에서 `history` 제외 (PR-C)
- `home/__tests__/render.test.tsx` 기본 탭 전제 5건 — 패치 내용 탭을 먼저 연다 (PR-C B1)
- `pubg/__tests__/page-order.test.tsx` 순서 검사 — 패치 내용 탭을 연 뒤 (PR-C B1)
- `components/__tests__/header-pair-select.test.tsx` 표시 전용 → LoL 실제 이동 (PR-C B3)
- `landing.test.ts` 「미공지 ⊆ 유의」 삭제 — 미공지 Gap이 수치 축 합집합이라 부분집합 아님, null 대칭만 유지 (PR-C D2)

## 이월 잔여 — 전건 (2026-09-28 PR-A·B·C 구현 완료 시점, 출처 = verify-spec 각 절)
세 PR 구현 후에도 닫히지 않은 것. 빠짐없이 적는다 — 새 PR에서 닫으면 이 줄을 지우고 커밋 해시를 남긴다.

**사람 결정·외부 조건**
- R1. push·PR·머지(X2). PR-A 머지일 = TFT 개발 키가 살아 있는 날(머지가 18.3 재수집을 켠다) · 머지 창 03:00~19:00Z, LoL 패치일 제외. PR-C = 10/6.
- R2. PR-C B1(발견 먼저)은 2026-09-21 사용자 재확인 「읽는 순서가 맞다」를 뒤집는다 — 머지 시 사용자 확인(pr-c §C1).
- R3. TFT 실 API 재수집·Actions 실측(X1) — 크래시 stub 경로 `if:` 식은 YAML 파싱만 확인(pr-a §C14).
- R4. UX-BRIEF 표의 `/tft/`·`/pubg/` 행과 「탭 위치 통일 미착수」 서술은 10/6 머지 시점에 갱신(pr-c §C1·§C2).

**검증 미실시(코드는 있음)**
- R5. PR-C 렌더 스크린샷 대조(시안 축B) — 카드 높이·스크롤이 LoL 카드와 같게 보이는지(pr-c §C2).
- R6. PR-A design-lint 렌더 재실행 없음(빌드 CSS grep만, pr-a §C16).
- R7. PR-B flip 판정 원인 문장 품질 전수 대조 — LoL 7건만 확인, TFT 19건 미확인(pr-b §B5).

**알려진 한계(의도적으로 남김)**
- R8. 과거 쌍 화면의 대상 링크는 쌍 문맥을 잃는다(`/lol/item/[id]`는 그 id의 첫 쌍) · `/lol/compare/`는 기본 쌍만 · TFT 쌍 라우트 없음(D3 = LoL만) (pr-c §C4).
- R9. TFT 수치 축 스냅숏이 18.2 중간 패치 이전 값(마오카이 최대 마나 90 vs 체이닝 노트 30/100) — `noteMismatch`는 안 붙어 화면 거짓은 없음(pr-b Phase 3).
- R10. 체력 재생 단계 배정은 DDragon 미검증(원문 형식 가정) · 새 패치 경로는 run-ddragon이 같은 잡에서 새 버전을 받는다는 전제(pr-b §B4).
- R11. 아레나 「삐뽀삐뽀」 뒤 문단 없는 증강 6개가 삐뽀삐뽀에 묶인다(구조 신호 없음, pr-a §C9).
- R12. 「둔화 기준치 50%→60%」 buff→nerf — 원문 의미 미확인(pr-a §C12).
- R13. 결정론 요약 반올림이 표시값 차이와 0.1 어긋날 수 있다(pr-a §C1).
- R14. C3 사실성 검사는 현재 데이터에서 잡은 결함 0(가드 가치만) · 부호 없는 「17.9% 줄어」형 미검사(pr-a §C3).
- R15. C5 골든 가드는 `buildUserPrompt` 템플릿 변경을 직접 가드하지 않는다(렌더 결과 sha만, pr-a §C5).
- R16. 선언 전용 화면의 시각 설명은 title(hover)뿐 — 모바일에선 이유가 안 보인다(pr-a §C14).
- R17. 중간 패치가 본 패치에 없는 수치를 새로 바꾼 경우는 체이닝하지 않는다(의도, pr-b §B2).
- R18. RED 선커밋 절차 이탈 2건(A1·C9 — RED와 구현이 한 커밋, pr-a).
- R19. vitest `maxWorkers: 12` — 워커 시작 타임아웃의 근본 원인은 추정(동시 jsdom 기동)이지 확정 아님(pr-c Phase 3).
- R20. 재분류: B4 N4 → 잔여 아님, 별도 SCOPE 주제(D7).
