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

## 명세 변경이 예상되는 기존 테스트 (보고 대상)
- PUBG 불변식 「화면이 읽는 쌍의 파일이 전부 있다」 — `observationFailed` stub 허용
- `screen-parity.test.ts` 섹션 순서 (PR-C)
