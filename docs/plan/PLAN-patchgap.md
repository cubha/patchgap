# PLAN — patchgap 구현 계획

> 생성일: 2026-09-05 · 소비자: /mvp Phase 3 TODO 루프(sh-dev-loop --auto, 구현=sonnet 서브에이전트) · acceptance-critic 기준선
> 입력: docs/scope/SCOPE-patchgap-2026-09-05.md · docs/research/RESEARCH-patchgap-2026-09-05.md · docs/design/UX-BRIEF.md · docs/design/DESIGN-TOKENS.md · docs/design/prototype/01~04.html
> TDD 포스처: null(`--auto` 단독 → 전부 test-after). `[TDD]` 태그 없음

## ① 사용자 요구사항 원문 (SCOPE Must/Should — 요약 금지)

| # | 기능 | 원문 |
|---|---|---|
| F1 | 매치 상세 수집기 | KR 챌린저/GM/마스터 시드 → puuid → 매치ID(startTime 필터) → 상세 전량(패치당 목표 1만, 최소 2천). bottleneck 2단 리밋, 429 재시도, `gameVersion` 접두 컷, 파일 단위 idempotent 재개, reduce-on-ingest(JSONL) |
| F2 | 패치별 지표 집계 + 통계 | 챔피언 픽률·밴률·승률(포지션별), 아이템 채택률(완성템 6슬롯). Wilson/Newcombe CI, 승률 최소 n 게이트, BH-FDR |
| F3 | 패치노트 파서 | ko-kr 정적 HTML(cheerio) → 챔피언/아이템/시스템 항목 `{entity, skill, stat, before, after, direction}` 구조화 + 요약문·원문 anchor 링크. fixture 테스트 |
| F4 | 델타 짝짓기 + 미공지 판정 | 1단 결정론(엔티티 ID 블로킹·방향 정합 스코어) → 2단 LLM(짝 없는 델타에 간접 영향 후보 추론, **반환 ID 후보셋 검증**, 배치·캐시·세션 상한·예산 소진 시 캐시 폴백) → `deltas/{from}_{to}.json`(모든 판정문에 원천 링크, 무근거=회색) |
| F5 | 브리핑 화면 | 패치 쌍 선택 → 요약 카드("노트 N줄 vs 통계 M개") → 공지 대조표 → **미공지 변화 목록(첫 컷)** → 항목 상세(델타 차트·CI·원천 매치 링크). 빌드 타임 JSON 임베드 |
| F6 | 디스코드 웹훅 브리핑 | 상위 미공지 5건 + 링크를 embed(≤10·6,000자)로 전송, 429 재시도 |
| F7 | 정적 배포·상시 작동 | Next static export → Vercel, 사전 인덱싱 스크립트(`run-collect→aggregate→match→build`), UptimeRobot ping, 라이엇 terms 고지 |
| F8 | 타임라인 표본 수집·집계 | 패치당 1~2천 매치 타임라인 → 라인별 골드@10/@14, 첫 오브젝트(용·전령·바론·포탑) 시각 델타. 상세 수집과 별도 큐, reduce-on-ingest |
| S2 | GitHub Actions cron 자동 수집·재빌드(9/23 26.19) | Should |
| S3 | LLM 브리핑 요약문 생성(인용 강제, 캐시) | Should — F4 파이프라인 재사용 |

## ② 확정 제약·거부 사항
- 런타임 외부 API 호출 0(정적 export, 빌드 타임 JSON 임베드) · LLM 호출은 배치·캐시·세션 상한·예산 소진 시 캐시 폴백 · 모든 판정문에 원천 링크(매치 ID·집계·패치노트 anchor) · 무근거 문장 `--muted`
- 승률 델타는 n≥200 게이트 + Newcombe CI 비중첩 + BH-FDR q<0.10 통과 시만 "관측된 변화", 미달=`insufficient-sample`
- 패치 표기 매핑: 패치노트 `26.17` ↔ Data Dragon/`gameVersion` `16.17` (실측 2026-09-05). 구축 쌍 26.16→26.17, 도그푸딩 26.17→26.18(9/10), 예선 26.19(9/23)
- 라이엇 terms: 표시 허용·유료화 금지·아레나 통계 금지. `.env` 비밀값은 코드·문서·커밋 금지
- 디자인: `docs/design/DESIGN-TOKENS.md` Ground Truth, 토큰 verbatim(`src/styles/tokens.css` + `globals.css @theme inline`), 하드코딩 색 금지, 프로토타입 01~04가 화면 Ground Truth
- Won't: 멀티게임 어댑터 구현·실시간 API·계정·서버 DB·아레나/칼바람·모델 학습·N4

## ③ SubTask 목록 (파일 소유권 — 같은 배치 내 겹침 금지)

| ID | SubTask | 소유 파일 | 요구 | 라우팅 |
|---|---|---|---|---|
| ST-01 | 도메인 타입·패치 매핑·경로·env 로더 확정 — `PatchId` 양방향 매핑(26.17↔16.17), `parseGameVersion`, data 레이아웃 상수, zod env 스키마 | `src/pipeline/types.ts` `src/pipeline/shared/{patches,paths,env}.ts` + 테스트 | F1 전제 | B1 [S] |
| ST-02 | Riot API 클라이언트 — fetch + bottleneck chain(20/1s ⟵ 100/120s, minTime·maxConcurrent), 429 `Retry-After`·5xx 지수 재시도, 타입드 엔드포인트(league-v4 challenger/grandmaster/master entries, match-v5 ids by puuid(startTime/endTime/queue/count), match, timeline) | `src/pipeline/collect/riot-client.ts` + 테스트(fetch 모킹) | F1 | B1 [S] |
| ST-03 | 시드·크롤러·체크포인트 + run-collect CLI — 시드(3티어 puuid 집합) → 매치ID(시간창 휴리스틱) → 상세 → `gameVersion` 접두 컷 → `MatchSlim` reduce-on-ingest(JSONL append) · seen-ids 인덱스 · 재개 · 진행 로그 · `--patch 26.17 --target 10000` | `src/pipeline/collect/{seed,crawler,checkpoint}.ts` `scripts/run-collect.ts` + 테스트 | F1 | B2 [P] |
| ST-04 | 타임라인 표본 수집·축약 + run-timeline CLI — 상세 JSONL에서 표본 K개 선택 → timeline → 라인별 골드@10/@14·첫 오브젝트(용·전령·바론·첫 포탑) 시각 → `TimelineSlim` JSONL | `src/pipeline/collect/timeline.ts` `scripts/run-timeline.ts` + 테스트(fixture) | F8 | B2 [P] |
| ST-05 | 통계 엔진 — Wilson CI, Newcombe 두 비율 차이 CI, BH-FDR, beta-binomial 축소, 최소 n 게이트 판정, 연속 지표(골드·초) 평균 차이 CI(Welch)·summarize (F8 델타용) | `src/pipeline/aggregate/stats.ts` + 테스트(기지값 대조) | F2 | B2 [P] |
| ST-06 | 집계기 + run-aggregate — 챔피언(포지션별 픽·밴·승률, n, CI), 아이템 채택률(완성템), 타임라인 집계(골드·오브젝트), 매치 평균(경기 시간 등) → `data/aggregated/{patch}/{champions,items,lanes,objectives,summary}.json` | `src/pipeline/aggregate/{champions,items,lanes,objectives,summary}.ts` `scripts/run-aggregate.ts` + 테스트 | F2 F8 | B3 [P] |
| ST-07 | 패치노트 파서 + fixture — ko-kr HTML fetch(캐시) → cheerio → `PatchNoteItem[]`(section·entity·skill·stat·before·after·direction·anchor) + 요약문 · fixture `src/__fixtures__/patch-26-17.html` | `src/pipeline/match/patchnotes-parser.ts` `scripts/run-fetch-notes.ts` + fixture·테스트 | F3 | B3 [P] |
| ST-08 | 델타·1단 결정론 짝짓기·판정 + Data Dragon 매핑 — 두 패치 집계 diff → `DeltaRecord`(Δ·CI·q·n) → 엔티티 ID 블로킹(ko 이름↔ddragon key) → **완성템 필터**(Data Dragon item.json `into` 없음·`gold.purchasable`·total≥1600 기준, ST-06은 전 아이템 집계) → 방향 정합 → `MatchStatus` 7종(announced-consistent / announced-inconsistent / unannounced / **indirect-effect**(다른 조항의 파급효과로 설명됨, 2026-09-13 신규) / insufficient-sample / **below-threshold**(유의하나 효과크기 바닥 미달, 2026-09-13 신규 — 아래 계약 확장 이력 참고) / **no-change**(비유의·짝없음, 회색)) → `data/aggregated/deltas/{from}_{to}.json` · `scripts/run-ddragon.ts`(챔피언/아이템 JSON·이미지 → `public/dd/`) | `src/pipeline/match/{entity-match,verdict,ddragon}.ts` `scripts/run-ddragon.ts` + 테스트 | F4 | B4 [S] |
| ST-09 | LLM 2단 짝짓기 + run-match — Claude Sonnet 5(`@anthropic-ai/sdk`), 짝 없는 델타 상위 N건 배치, 후보셋 ID 검증(불일치 폐기), `data/cache/llm/` 캐시, 세션 상한·예산 소진 시 캐시 폴백, 브리핑 요약문(S3) · `run-match.ts`가 07→08→09 오케스트레이션 | `src/pipeline/match/llm-match.ts` `scripts/run-match.ts` + 테스트(SDK 모킹) | F4 S3 | B4 [S] |
| ST-10 | 웹 데이터 로더·공통 UI — `src/lib/data.ts`(빌드 타임 JSON 로드·패치 쌍 목록), `format.ts`, `Header`·`FilterBar`(정적 선택→라우트)·`StatusBadge`·`DeltaValue`·`EntityIcon`(public/dd) — 프로토타입 공통 마크업 1:1 · `--font-roboto-mono`(next/font)를 수치 열에 배선(스캐폴드 follow-up) | `src/lib/*` `src/components/*` `src/app/layout.tsx` + 테스트(format) | F5 | B5 [S] |
| ST-11 | 브리핑 홈 + 대조표 페이지 — 프로토타입 01·02 구현(요약 카드·미공지 목록·공지 대조 미리보기·매치 평균·디스코드 CTA / 상태 필터·좌 내비·델타 테이블·커버리지 바) | `src/app/page.tsx` `src/app/compare/page.tsx` `src/components/home/*` `src/components/compare/*` | F5 | B6 [P] |
| ST-12 | 항목 상세 + 방법론 페이지 — 프로토타입 03·04(recharts 일별 시계열·전/후 막대, 통계 패널, 패치노트 대조, LLM 후보, 원천 매치 ID / 파이프라인·상태 정의·게이트·디스코드 미리보기·라이엇 고지) · `generateStaticParams` | `src/app/item/[id]/page.tsx` `src/app/methodology/page.tsx` `src/components/item/*` `src/components/methodology/*` | F5 F7 | B6 [P] |
| ST-13 | 디스코드 웹훅 + run-notify — embed 빌더(제한 준수), 429 `retry_after` 재시도, `--dry-run`, 전송 로그 | `src/pipeline/discord/webhook.ts` `scripts/run-notify.ts` + 테스트 | F6 | B7 [P] |
| ST-14 | 배포·운영 — `.github/workflows/collect.yml`(cron+dispatch, 수집→집계→짝짓기→커밋), `vercel.json`(정적), `pipeline:all` 문서, README(운영 절차·UptimeRobot·terms), `data/aggregated` 샘플 fixture로 빈 데이터 빌드 보장 | `.github/workflows/*` `vercel.json` `README.md` `data/aggregated/README.md` | F7 S2 | B7 [P] |

## ④ 배치·실행 순서 (mvp TODO 루프 — total_batches 7)

| 배치 | SubTask | 라우팅 | 근거 |
|---|---|---|---|
| B1 | ST-01 → ST-02 | [S] 순차 1에이전트 | 타입·클라이언트는 핵심 레이어(core) — 직렬 |
| B2 | ST-03 ∥ ST-04 ∥ ST-05 | [P] 3에이전트 | 파일 독립. ST-05는 수집과 무관한 순수 함수 |
| ▶ 운영 | B2 검증 후 **실수집 시작**(백그라운드): 26.16·26.17 상세 각 ≥2,000(목표 1만) → **상세 수집 종료 후** 타임라인 표본(표본은 matches.jsonl 스냅샷에 결정론) — D+1 게이트(gameVersion 포맷·startTime·challenges 필드 확인) | — | 수집 3.3h/패치, 구현과 병행 |
| B3 | ST-06 ∥ ST-07 | [P] 2에이전트 | 집계기는 ST-05 시그니처 위에, 파서는 독립 |
| B4 | ST-08 → ST-09 | [S] 순차 | LLM 2단은 1단 출력 스키마에 의존. ST-09 전 claude-api 스킬 참조 |
| ▶ 게이트 | 실데이터로 `pipeline:aggregate→match` 실행 → 델타 상위 10 짝짓기 비율·미공지 ≥1 확인 | — | SCOPE §4 D+1 게이트 |
| B5 | ST-10 | [S] 1에이전트 | 공통 UI·로더는 페이지의 전제 |
| B6 | ST-11 ∥ ST-12 | [P] 2에이전트 | 페이지 파일 독립 |
| B7 | ST-13 ∥ ST-14 | [P] 2에이전트 | 독립 |

각 배치: 구현(sonnet) → VERIFY-SPEC(`docs/plan/verify-spec/ST-xx.md`) → 배치 VERIFY(`bash verify.sh --full` ∥ scope-critic × SubTask ∥ acceptance-critic) → FIX 루프(최대 3회) → 커밋 → state `completed_batches` 갱신.

## ⑤ UI 설계 명세 경로
- `docs/design/UX-BRIEF.md` §3 스토리보드 · `docs/design/prototype/01~04.html`(+png) · `docs/design/DESIGN-TOKENS.md` · REF-RECON.md
- 구현 규칙: 프로토타입 마크업·클래스 위계 1:1, Tailwind 유틸은 `@theme inline` 바인딩 토큰만, 차트는 recharts(색=토큰 var), 이미지=`public/dd/`
- 승인 편차(오케스트레이터 지시): `DeltaValue`는 모든 kind에 ▲/▼ 화살표 표기(방향 가독성) · 티어/지역/큐 select는 데이터가 있는 옵션만(현재 1개+disabled — C2 미착수) · 패치 쌍 select는 경로 기반 라우팅 · 홈 사이드 "매치 평균"은 경기 시간 + 첫 오브젝트 4종(용·전령·바론·포탑) — 골드@14는 라인별 지표라 대조표/상세로 이관 · 대조표 정렬은 헤더 클릭(|Δ|·q·n) · 상세 차트는 전/후 막대+CI(일별 시계열은 수집 확장 후) · `/item/{slug}/`는 `:`→`~` 슬러그(퍼센트 인코딩 금지 — 정적 서버 404 실측)

## ⑥ 데이터 계약 (배치 간 인터페이스 — ST-01이 확정, 이후 변경 시 PLAN 갱신)
- `data/raw/{patch}/matches.jsonl` — `MatchSlim` 1행/매치 · `data/raw/{patch}/timelines.jsonl` — `TimelineSlim` · `data/raw/{patch}/seen-ids.txt` · 수집기 내부(웹·집계기 미소비): `seed-puuids.json`(24h 캐시)·`collect-state.json`(재개 체크포인트)·`samples/`
- `data/aggregated/{patch}/{champions,items,lanes,objectives,summary}.json` · `data/aggregated/deltas/{from}_{to}.json` · `data/aggregated/notes/{patch}.json`(파서 출력) · `data/cache/llm/*.json`(gitignore)
- 웹은 `data/aggregated/**`만 읽는다(빌드 타임)
- **계약 확장 이력(B4, 2026-09-05)**: `MatchStatus` +`no-change` · `DeltaEntityType` +`summary` · `DeltaRecord` +`matchedNoteIds: string[]`, +`llm?: {skipped, reason?, summary?, summaryVerified?, summaryCites?}` · `LlmCause` +`confidence` · `PatchNoteItem` +`subsection`, +`anchorKind` · deltas 파일 `{meta:{from,to,generatedAt,n,counts,qAlpha,llm?}, rows}` · 완성템 판정은 Data Dragon(into 없음·purchasable·total≥1600·Boots/Consumable/Trinket 제외) · `data/ddragon/{v}/*.json`·`public/dd/**` 커밋 대상
- **계약 확장 이력(2026-09-13, effect-size floor)**: `MatchStatus` +`below-threshold` — 통계적 유의성(q<FDR_ALPHA·CI가 0 미포함)만으로 미공지를 판정하던 결함 수정. 실측(26.16→26.17): 미공지 277건 중 84%가 픽/밴률이었고 |delta| 중앙값 0.76%p — 픽/밴은 경기당 고정 슬롯(제로섬)이라 한 챔피언의 변화가 다수 챔피언의 강제 반대이동으로 상쇄되고, 그 이동분이 n≈10,000에서 개별적으로 유의하게 잡혀 전부 미공지로 계상됐다(챔피언 픽률 델타 전체합=0.00%p 실측이 이 메커니즘의 직접 증거). `src/pipeline/aggregate/stats.ts`의 `EFFECT_SIZE_FLOORS`(pickRate 2%p·banRate 3%p·winRate 2%p 절대, adoptionRate 상대 25% — 연속 지표는 이번 스코프에서 바닥=0 유지)를 `verdict.assignStatus`의 **"짝 없음" 분기에만** 적용한다(⚠️ `isSignificant()` 자체에 걸면 노트 짝이 있는 델타가 else 분기로 떨어져 정상 공지-일치가 공지-불일치로 뒤집히는 회귀가 생긴다 — 설계 정정, `docs/plan/PLAN-unannounced-effect-size-floor-2026-09-13.md` 참고). 재생성 결과: 26.16→26.17 미공지 277→41건(below-threshold 236건 흡수), 공지-일치/공지-불일치/표본부족/변화없음 4개 카운트는 정확히 불변 — 설계 정정이 올바르게 적용됐음을 실측으로 확인. 상태 정렬 우선순위는 `src/pipeline/shared/status-order.ts`(verdict.ts·compare/logic.ts 공유 단일 소스, exhaustive `Record`로 전환 — 기존 `compare/logic.ts`의 `MatchStatus[]` + `indexOf` 구현은 미등록 상태를 -1(최우선)로 오판정하는 결함이 있었다)
- **계약 확장 이력(2026-09-13 2차, 바닥 보강)**: 1차 바닥 도입 후 도그푸딩에서 두 결함이 남았다. ① **집계 엔티티(lane/objective/summary)가 미공지로 계상됨** — 이 행들은 `match/entity-match.ts`가 매칭 루프에서 `entityType !== "champion" && !== "item"`을 `continue`로 건너뛰므로 **패치노트와 짝지어질 수 있는 경로가 구조적으로 없다**(실측: 두 패치쌍 집계 엔티티 15행 전부 `matchedNoteIds=0`). "짝이 없다"가 관측이 아니라 전제인 행을 "미공지 변화"로 부르면 차별 지표가 항상 참인 명제로 오염된다. 게다가 실측 라인 골드 변화는 최대 75골드(상대 1.36%)로, 14분 시점 아이템 한 칸을 못 바꾸는 규모이고 라인 평균 골드는 메타 구성(어느 챔피언이 그 라인에 서는가)에 따라 그만큼은 늘 흔들린다. → 연속 지표 바닥을 `value: 0`에서 실값으로 교체: `goldAt10`/`goldAt14` 상대 3%(라인별 베이스가 서포터 4.2k~바텀 6.2k로 달라 절대 골드 바닥은 라인마다 다른 엄격도가 된다), `firstSec` 30초, `avgDurationSec` 60초. **엔티티 타입 게이트가 아니라 규모 바닥으로 처리한 이유**: 방법론 페이지 상태 정의표가 한 행으로 거짓 없이 설명할 수 있어야 하고(타입 게이트는 두 번째 조항이 필요하다), 라인 골드가 3%(바텀 기준 186골드) 움직이면 그건 노트 없이 일어난 진짜 이상 신호이므로 다시 미공지로 올라와야 하기 때문이다. ② **아이템 채택률 저기저 잡음** — 상대 25% 바닥만으로는 기저 0.24%인 아이템이 0.08%p 움직여도 통과했다(26.17→26.18 모렐로노미콘 0.237%→0.316%). 절대 co-floor를 얹으면 "채택률 분모는 `totalParticipants`(경기수×10, 168챔피언 전체)라 절대 %p가 구조적으로 희석된다"는 1차의 근거를 스스로 부정하게 되므로, **"애초에 쓰이던 아이템인가"** 라는 다른 축으로 건다 — `EffectFloor.minBase`(0.01) 신설, `max(|before|, |after|) >= minBase`(before=0에서 1.5%로 급등한 신규 채택은 잡음이 아니므로 살린다). 재생성 결과: 26.16→26.17 미공지 32→29·간접 9→7·임계미달 236→241, 26.17→26.18 미공지 76→65·간접 5→6·임계미달 309→319, **공지-일치/공지-불일치/표본부족/변화없음 4개 카운트는 양쪽 모두 정확히 불변**(1차와 동일한 회귀 방지 확인). 집계 엔티티가 미공지·간접에 남은 건수 0, 잔존 아이템 6건씩의 최소 상대변화 25%·기저 1% 이상. 방법론 상태 정의표는 낱개 prop(`pickFloor`/`banFloor`/…) 대신 `EFFECT_SIZE_FLOORS` 전수 Record를 주입받도록 바꿨다 — 바닥이 늘 때마다 prop을 추가해야 했고 빠뜨려도 화면이 조용히 옛 숫자를 말하던 드리프트 경로를 없앤다
- **계약 정리 이력(리팩토링, 2026-09-05)**: 미사용 `Verdict` 인터페이스 삭제(참조 0건 확인) · `DeltaRecord.metric`을 `string`에서 `DeltaMetric`(`pickRate`·`banRate`·`winRate`·`adoptionRate`·`goldAt10`·`goldAt14`·`firstSec`·`avgDurationSec`) 유니온으로 좁힘 · `AggregateMeta`/`RowsFile<T>`/`DataFile<T>`를 `src/lib/data.ts`에서 `src/pipeline/types.ts`로 승격(`data.ts`는 재export) — **디스크 JSON 스키마·필드는 변경 없음**(타입 레벨 정리만, self-pair `buildDeltas` 출력이 리팩토링 전/후 byte-identical임을 확인)
