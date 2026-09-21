# patchgap 범위·스택 확정서

> 생성일: 2026-09-05
> 기반 리서치: docs/research/RESEARCH-patchgap-2026-09-05.md
> 상태: 확정 (스택 사용자 승인 완료 2026-09-05 — 타임라인 표본 Must 승격, LLM=Claude Sonnet 5 → 2026-09-18 Opus 5로 상향)

---

## 1. 프로젝트 정의
- **해결 문제**: 패치노트는 12줄인데 통계는 37개가 바뀐다 — 공식 패치노트가 *말한 것*과 매치 통계가 *말하는 것*의 괴리(미공지 변화·간접 메타 이동)를 코치·클랜장이 패치 후 24~72h 안에 알 수 없다
- **타겟 사용자**: LoL KR 코치·클랜장·분석 스트리머
- **성공 기준(1차 완성)**: 26.16→26.17 쌍에서 ① 패치노트 항목 ↔ 관측 델타 자동 대조표 ② 통계 게이트를 통과한 **미공지 변화 ≥1건**(원천 매치 링크 첨부) ③ 브리핑 화면이 Vercel에 정적 배포되어 외부 API 0으로 상시 작동 ④ 디스코드 웹훅으로 동일 브리핑 전송
- **규모 포지션**: MVP (해커톤 출품·예선 15일 상시 운영)
- **일정**: 구현 9/5~9/13(24h 가동 달력 4.2일) · 도그푸딩 9/14~18(26.17→**26.18 라이브**, 9/10 배포) · 배포 9/20 · 예선 9/21~10/5(26.19=9/23 자동 수집)

## 2. 기능 범위 (MoSCoW)

### Must (핵심 — 이게 없으면 성립 안 됨)
| # | 기능 | 공수(8h 단위) | 근거 |
|---|---|---|---|
| F1 | **매치 상세 수집기** — KR 챌린저/GM/마스터 시드 → puuid → 매치ID(startTime 필터) → 상세 전량(패치당 목표 1만, 최소 2천). bottleneck 2단 리밋, 429 재시도, `gameVersion` 접두 컷, 파일 단위 idempotent 재개, reduce-on-ingest(JSONL) | M · 1.5 | 데이터 없으면 전부 없음. 1만 매치=3.3h라 착수 즉시 백그라운드 |
| F2 | **패치별 지표 집계 + 통계** — 챔피언 픽률·밴률·승률(포지션별), 아이템 채택률(완성템 6슬롯). Wilson/Newcombe CI, 승률 최소 n 게이트, BH-FDR | M · 1.5 | 미공지 판정의 통계적 근거. 오탐이면 차별이 약점이 됨 |
| F3 | **패치노트 파서** — ko-kr 정적 HTML(cheerio) → 챔피언/아이템/시스템 항목 `{entity, skill, stat, before, after, direction}` 구조화 + 요약문·원문 anchor 링크. fixture 테스트 | M · 1.5 | "선언" 쪽 데이터. 마크업 변경 대비 fixture 고정 |
| F4 | **델타 짝짓기 + 미공지 판정** — 1단 결정론(엔티티 ID 블로킹·방향 정합 스코어) → 2단 LLM(짝 없는 델타에 간접 영향 후보 추론, **반환 ID 후보셋 검증**, 배치·캐시·세션 상한·예산 소진 시 캐시 폴백) → `deltas/{from}_{to}.json`(모든 판정문에 원천 링크, 무근거=회색) | L · 3 | 제품의 핵심 형태(b)+(c). AI 활용 적절성 심사 축 |
| F5 | **브리핑 화면** — 패치 쌍 선택 → 요약 카드("노트 N줄 vs 통계 M개") → 공지 대조표 → **미공지 변화 목록(첫 컷)** → 항목 상세(델타 차트·CI·원천 매치 링크). 빌드 타임 JSON 임베드 | M · 2 | 데모·심사 표면 |
| F6 | **디스코드 웹훅 브리핑** — 상위 미공지 5건 + 링크를 embed(≤10·6,000자)로 전송, 429 재시도 | S · 0.5 | 요구사항 "디스코드 전송" |
| F7 | **정적 배포·상시 작동** — Next static export → Vercel, 사전 인덱싱 스크립트(`run-collect→aggregate→match→build`), UptimeRobot ping, 라이엇 terms 고지 | S · 1 | 자격요건(9/21~10/5 상시) |
| F8 | **타임라인 표본 수집·집계** — 패치당 1~2천 매치 타임라인 → 라인별 골드@10/@14, 첫 오브젝트(용·전령·바론·포탑) 시각 델타. 상세 수집과 별도 큐, reduce-on-ingest | M · 1.5 | 사용자 승격(2026-09-05): 데모에 "첫 오브젝트 시각 델타" 필요 |
| | **Must 합계** | **12.5** (8h) → 달력 **5.0일** | 구현 창 9/5~9/13(9일)에 24h 가동 기준 수용, 초과분은 Should 이월 |

### Should / Could
| # | 기능 | 등급 | 공수 | 비고 |
|---|---|---|---|---|
| S2 | GitHub Actions cron 자동 수집·재빌드(9/23 26.19) | Should | S · 0.5 | 도그푸딩 후 9/19 전 배선. 그 전엔 로컬 실행 |
| S3 | LLM 브리핑 요약문 생성(인용 강제, 캐시) | Should | S · 0.5 | F4 파이프라인 재사용 |
| C1 | en-us 로케일 병행 파싱(엔티티 ID 안정화용) | Could | S | 한글 챔피언명↔Data Dragon 매핑으로 대체 가능 |
| C2 | 티어·포지션 필터, 브리핑 히스토리 목록 | Could | S | |
| C3 | 경쟁 4곳(blitz patch-analysis·valking·stratz·dotabuff) Playwright 재확인 | Could(게이트) | S | 배포 전 차별 문장 최종 점검 |

### Won't (now) — 명시적 제외
- ~~PUBG 등 **멀티 게임 어댑터 구현**(확장성 슬라이드·인터페이스 시그니처만)~~
  → **2026-09-16 사용자 결정으로 Won't 해제**. 9/20 제출 기준으로 PUBG 어댑터를 실구현 대상에 넣는다.
  근거·제약·게이트는 `docs/plan/PLAN-pubg-gate-2026-09-16.md`. 단 **출하 게이트 유지** — PUBG에서
  근거 딸린 판정이 1건도 서지 않으면 탭을 링크하지 않고 방법론의 "미연결" 표기를 그대로 둔다.
  게임 스위처 통합(전역 UI 개편)은 **여전히 Won't** — 9/20 전 착수 금지.
- ~~**TFT(전략적 팀 전투) 어댑터**~~
  → **2026-09-20 사용자 결정으로 Won't 해제**. 3번째 게임으로 실구현했다. 근거·제약·게이트는
  `docs/plan/PLAN-tft-adapter-2026-09-20.md`. PUBG와 같은 **출하 게이트 유지** — 집계가 없으면
  `getTftChrome()`이 null을 돌려주고 드롭다운에서 빠진다.
  **착수 조건(실측으로 드러난 것)**: ① Riot 개발자 계정의 제품 등록에 TFT가 포함돼야 한다 —
  기존 PATCHDRIFT 제품(LoL 전용)의 키는 TFT 엔드포인트 전부에 403을 돌려준다(kr·na1·euw1·jp1
  4개 지역 확인, 2026-09-20). 개발 키(24h)로는 열린다.
  ② 정기 수집을 붙이려면 **TFT를 별도 제품으로 등록**해 개별 승인을 받아야 한다.
  ~~`EDIT APP`으로 기존 제품에 TFT API를 추가~~ → **2026-09-20 정정**: 승인된 제품의
  Product Description은 읽기 전용이고(승인받은 내용 자체다), Riot 문서가 "If you are working on
  multiple projects, you should register each one separately and each one needs to be individually
  approved for a separate production API key"라고 명시한다(developer.riotgames.com/docs/portal).
  ③ 별도 제품이면 **키도 별도**라 rate limit이 분리된다 — 앞서 우려한 LoL 크론과의 예산 충돌은
  그 경우 발생하지 않는다. 반대로 한 키를 공유하게 되면 리밋이 키 단위이므로 순차 배치가 전제다
  (리미터 인스턴스는 아직 공유하지 않는다).
  **Riot terms 재확인(2026-09-20)**: TFT는 아레나가 아니므로 「아레나 Augments 승률 금지」 조항에
  걸리지 않는다. 다만 **TFT 증강(augment) 통계는 애초에 만들 수 없다** — API 응답에 그 필드가
  없다(참가자 400명 전원 부재 실측). 유료화·재판매 금지, 런타임 호출 0은 그대로 적용된다.
- 실시간/런타임 API 호출, 사용자 계정·로그인, 서버 DB
- 아레나·무작위 총력전 모드 통계(terms: 아레나 Augments 승률 금지)
- 자체 모델 학습, 승률 예측
- N4 OSS 릴리즈 미공지 탐지(해커톤 후)
- 유료화·재판매 관련 기능 일체(라이엇 terms)

## 3. 확정 기술 스택
| 카테고리 | 채택 | 대안 | 채택 근거(ADR-lite) |
|---|---|---|---|
| 언어·런타임 | TypeScript 5 / Node 22 (ESM, tsx) | Python | 하네스 verify.sh(tsc+eslint) 정합, 수집·집계·프론트 단일 언어 |
| 패키지 구조 | 단일 패키지 `src/{collect,aggregate,match,discord}` + `app/` | 모노레포 | 4.2일 공수에 워크스페이스 오버헤드 불가 |
| Riot API 클라이언트 | `fetch` + **bottleneck** chain(20/1s ⟵ 100/120s) + Retry-After | twisted | Personal 키 고정 리밋이라 동적 감지 불필요, 안정성·다운로드 압도 |
| 저장·집계 | **JSONL reduce-on-ingest + 순수 TS 집계** (`data/raw` gitignore, `data/aggregated` 커밋) | DuckDB node-api | 네이티브 의존 0 → GH Actions·Vercel 호환 리스크 소멸 |
| 통계 | 자체 구현(Wilson·Newcombe·Beta-binomial 축소·BH-FDR) | simple-statistics | 함수 4개 수준, 판정 로직 투명성 |
| 패치노트 파서 | **cheerio** | linkedom | ko-kr·en-us 정적 HTML 실측 |
| 엔티티 ID | Data Dragon(champion·item JSON) 한글명↔key 매핑 | 수동 테이블 | 공식 정적 데이터, 패치별 버전 |
| **원본 수치 대조**(F9, 2026-09-21 사용자 승인) | **Data Dragon**(LoL: `champion.json`·`item.json`·챔피언별 `spells`) + **Community Dragon**(TFT: `cdragon/tft/{locale}.json` — 버전 경로 `/{patch}/` 사용) | 공식 TFT 수치 소스 **없음** | **런타임 의존성 0**(빌드 타임 `fetch`만, npm 패키지 추가 없음). DDragon의 `tft-champion.json`은 이름·아이콘·cost뿐이라 **수치가 아예 없다**(실측) — 유닛 `stats`·`ability.variables`를 주는 곳은 Community Dragon뿐이고 대안이 존재하지 않는다. 비공식 미러이므로 ① 빌드 타임에만 호출 ② 응답에서 **수치 필드만** 추출해 `data/cdragon/{version}/`에 커밋(재현성 확보, 미러가 사라져도 과거 판정은 남는다) ③ 실패해도 그 게임의 F9만 빠지고 나머지 파이프라인은 그대로 |
| **패치 발행 탐지**(캘린더 무인화, 2026-09-21 사용자 결정) | **공식 패치노트 페이지**(LoL·TFT: 다음 후보 URL의 200/404 + JSON-LD `datePublished`) + **Steam 뉴스 API**(PUBG: `ISteamNews/GetNewsForApp`, appid 578080, 무인증) | 수기 상수 갱신(현행 유지 가능) | **런타임 의존성 0**(빌드 이전 `fetch`만, npm 패키지 추가 없음). 패치 라이브 일자를 주는 공식 API가 **세 게임 모두 없어서** 캘린더가 수기 상수였고, 안 채우면 cron이 초록불로 아무것도 안 했다. PUBG는 자체 API·웹사이트에 신호가 없으나(매치 `attributes`·`/status`에 패치 필드 없음, 공지 사이트는 SPA라 없는 패치도 200) **Steam 공지**가 구조화 JSON을 준다. 세 소스 모두 **역산 재현**을 채택 기준으로 삼았다 — 손으로 적어 둔 캘린더 값을 그대로 복원해야 쓴다(LoL 3/3 · TFT 2/2 · PUBG 2/2). 감시자 산출물은 `data/patch-calendar/{game}.json` 오버레이로만 커밋하고 기저 상수는 건드리지 않는다 |
| LLM 짝짓기·요약 | **Claude API — Opus 5** (`claude-opus-5`; ~~Sonnet 5~~ → 2026-09-18 사용자 확정 상향. 근거: 동일 델타 12건 A/B에서 간접 원인 탐지 Opus 12/12 vs Sonnet 1/12(`docs/plan/LLM-AB-2026-09-17.md`), Gap 원인 커버리지 20%가 심사 축 "AI 활용 적절성"의 직접 감점. 저신뢰(low) 후보는 화면에서 회색 "가능성" 문장으로만 표시해 무근거 회색 원칙 유지; 배치 1회 상한·캐시 우선·폴백) | Sonnet 5 / Haiku 4.5 | 요구사항 3 "자체 에이전트 파이프라인", AI 활용 적절성 |
| 프론트 | **Next.js 16 App Router `output:'export'`** + Tailwind + recharts | Astro | 완전 정적·Vercel 무료·하네스 스킬(ui-plan/design-lint) 경험치 |
| 배치 실행 | 로컬(초기·도그푸딩) → **GitHub Actions cron + workflow_dispatch**(9/19~) | Vercel Cron | 6h job·무료, Vercel Cron은 60~300s |
| 알림 | `fetch` Discord Webhook | discord.js | 의존 0, embed 제한만 준수 |
| 배포·모니터링 | **Vercel**(정적) + **UptimeRobot** 5분 | Cloudflare Pages | 무료·자격요건 상시 작동 |
| 테스트·품질 | vitest + eslint + tsc + verify.sh(spec 규칙) | jest | 하네스 표준 |

> **TFT 추가 (2026-09-20)**: 수집은 `tft-league-v1`(challenger/grandmaster/master) →
> `tft-match-v1`(by-puuid ids → match). 엔티티 사전은 Data Dragon
> `tft-champion`·`tft-trait`·`tft-item`을 **현행 세트로 걸러** 쓴다(안 거르면 「12골드」 같은
> 표시명이 엔티티로 잡힌다). 패치노트는 `teamfighttactics.leagueoflegends.com`(도메인이 다르고
> `-notes` 접미가 없다). **새 런타임 의존성 0** — 기존 fetch·bottleneck·cheerio만 쓴다.
> 패치 구분은 버전이 아니라 **노트 발행 시각 창**이다(`game_version`이 비어 있다).

> **잠수함 패치 검출 F9 추가 (2026-09-21)**: 기존 F1~F4는 "지표가 어떻게 움직였나"(통계 추론)만
> 본다. F9는 게임사가 배포한 **원본 수치**를 패치 간 대조해 "무엇이 실제로 바뀌었나"(문서 대조)를
> 본다 — 두 축은 직교하고 산출물도 `data/aggregated/gamedata/**`로 분리한다. `MatchStatus`는
> 무수정이며 `DisplayStatus` 표시 계층에서만 갈라진다. PUBG는 수치 파일이 없어 텔레메트리 피격
> 이벤트의 **피해 격자**(선언값의 직접 관측)를 읽는다 — 새 의존성 0.

## 4. 리스크 & 선행 과제
- **D+1 게이트(9/6, 구현과 병행)**: 실매치 1건으로 `info.gameVersion` 포맷·`startTime` 파라미터·`challenges` 골드 필드 존재 확인 → F1 컷 규칙 확정
- **표본 리스크**: 26.16 매치는 8/12~8/26 창 — 상위 티어 ID 조회로 1만 확보 가능 여부를 첫 수집 1h 내 판정(미달 시 다이아 확장)
- **미공지 오탐**: F2 게이트 값(n≥200 초안)은 첫 집계 후 시뮬레이션으로 재산정
- **LLM 예산**: 델타 상위 **400건**(미공지·간접·공지-불일치 전수, 2026-09-17 50→120 → **2026-09-18 120→400 사용자 확정**)만 2단 호출, 결과 캐시 커밋 → 예선 중 LLM 호출 0
  - 상향 근거(실측): 이 항목의 의도는 처음부터 **전수**인데 120은 관측 시점 후보 수(113)에 맞춘 값이었다. 26.16→26.17은 후보가 **244건**이어서 **124건이 LLM을 아예 거치지 못했고**, 그 구간 원인 보유가 117/244에 그쳤다(26.17→26.18은 113/113으로 상한 미작동). 상한은 **천장이지 목표가 아니므로** 올려도 후보가 적은 패치의 비용은 변하지 않는다 — 26.18 같은 패치는 호출 수 불변.
  - 완전 제거를 택하지 않은 이유: 이 값의 본래 역할은 커버리지 조절이 아니라 **예산 폭주 가드**다(이상 입력에서 1,951행 전량 호출 방지). 관측 최대 244에 여유를 둔 400이 전수와 가드를 동시에 만족한다.
- **경쟁 (b) 선점 미확인 4곳**: C3 게이트, 배포 전
- **미해결 결정**: 디스코드 웹훅 URL(사용자 제공), 브리핑 도메인명(Vercel 기본 사용)

---
> 이 문서는 /init-project(구조 생성)·/plan(SubTask 수립)의 입력 기준이다.
