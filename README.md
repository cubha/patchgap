# patchgap

**26.18 패치노트는 12개 챔피언·아이템을 바꿨다고 말했고, 통계는 62개 변화를 말한다.**

patchgap는 게임 공식 패치노트가 *말한 것*과 매치 통계가 *실제로 말하는 것* 사이의 괴리 —
미공지 변화·간접 메타 이동 — 를 통계 게이트와 원천 링크를 붙여 보여주는 정적 브리핑 사이트다.
26.17→26.18 기준 미공지 Gap 29개 엔티티, 전부 원천 매치·집계·패치노트 앵커로 되짚을 수 있다.

- 🔗 **서비스**: https://patchgap.vercel.app
- 🎯 **타겟**: LoL KR 코치·클랜장·분석 스트리머 — "패치 첫 주에 뭘 먼저 봐야 하나"를 24~72h 안에 답해야 하는 사람
- ❓ **문제**: 패치노트는 *바꾼 것*만 적는다. 실제 메타를 흔드는 것은 적히지 않은 변화와 간접 파급인데,
  그걸 알려면 각자 통계 사이트에서 수치를 눈으로 대조해야 하고 그 대조는 재현되지 않는다.
- ✅ **완성 기준**: ① 패치노트 항목 ↔ 관측 델타 자동 대조 ② 통계 게이트를 통과한 미공지 변화(원천 링크 첨부)
  ③ 런타임 외부 API 호출 0의 정적 배포 ④ 동일 브리핑 Discord 웹훅 전송 ⑤ 두 번째 게임(PUBG) 어댑터 실동작

## 화면

| 경로 | 무엇을 답하나 |
|---|---|
| `/` | 랜딩 — 게임 목록과 합산 요약. 게임을 고르면 그 게임의 브리핑으로 들어간다 |
| `/lol` | LoL 브리핑 — 공지된 변화 / 미공지 Gap 두 축, 라인 필터 |
| `/lol/compare` | 패치노트 항목 ↔ 관측 델타 대조표(엔티티 1행) |
| `/lol/item/[id]` | 관측 1건의 상세 — 전후 수치·CI·원천 링크·추정 원인(LLM) |
| `/lol/methodology` | 통계 게이트·파이프라인·어댑터 매핑표(LoL ↔ PUBG)·LLM 사용 경계 |
| `/pubg` | 두 번째 게임 어댑터 — 42.3→43.1 무기 47종 판정(미공지 5건) + 맵 기술통계 |

게임은 **경로 접두**다(`/lol`, `/pubg`). 루트는 어느 게임에도 속하지 않는 랜딩이고, 랜딩은
`GAMES` 레지스트리를 순회해 패널을 그린다 — 게임이 늘면 화면 코드는 그대로다. 구 무접두 경로
(`/compare`·`/item/{id}`·`/methodology`)는 `vercel.json` 리다이렉트가 `/lol/**`로 넘긴다.

## 아키텍처

```
수집(F1/F8) → 집계+통계(F2) → 패치노트 파싱(F3) → 짝짓기+판정(F4) → 정적 빌드(F5/F7) → 디스코드(F6)
```

판정 엔진(`verdict.ts`)은 **게임을 모른다** — `{entity, metric, before, after, n}`만 받는다.
게임별 어댑터가 그 형태로 정규화하면 같은 엔진이 판정한다. LoL은 Riot Match-v5,
PUBG는 PUBG API `/samples` + 텔레메트리 축약이 어댑터다.

1. **수집** — KR 챌린저/GM/마스터 시드 → puuid → 패치 라이브 시간창 매치ID → 상세 전량(패치당 1만)
   + 타임라인 표본. `fetch` + bottleneck 2단 리밋(20/1s ⟵ 100/120s), 429 재시도, `gameVersion` 접두 컷,
   JSONL reduce-on-ingest, 파일 단위 idempotent 재개. → `data/raw/{patch}/*.jsonl`(커밋 안 함)
2. **집계 + 통계** — 챔피언 픽·밴·승률(포지션별), 완성템 채택률, 라인 골드@10/@14, 첫 오브젝트 시각.
   Wilson/Newcombe CI + 최소 n 게이트 + BH-FDR **자체 구현**(외부 통계 라이브러리 0). → `data/aggregated/{patch}/*.json`
3. **패치노트 파싱** — ko-kr 공식 패치노트를 cheerio로 `{entity, skill, stat, before, after, direction}` +
   원문 anchor로 변환. 노트마다 `modeScope`(core/classic/aram/…)를 새겨 **별도 게임 모드 노트가
   소환사의 협곡 델타와 짝지어지지 않게** 막는다. → `data/aggregated/notes/{patch}.json`
4. **짝짓기 + 판정** — 1단 결정론(엔티티 ID 블로킹 + 방향 정합) → 2단 LLM(짝 없는 델타만). → `data/aggregated/deltas/{from}_{to}.json`
5. **정적 빌드** — Next.js 16 `output: 'export'`. 빌드 타임에 JSON을 임베드하고 브라우저는 어떤 외부 API도 호출하지 않는다.
6. **디스코드** — 상위 미공지 5건 + 링크를 embed(≤10개·6,000자)로 전송, 429 `retry_after` 재시도.

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어·런타임 | TypeScript 5 / Node 22 (ESM, `tsx`) | `strict`, `any` 금지 |
| 프론트 | Next.js 16 App Router `output:'export'` + Tailwind v4 + recharts | 런타임 서버 0 → 상시 작동·비용 0 |
| 수집 | `fetch` + `bottleneck` | Riot Personal Key 고정 리밋 준수 |
| 저장·집계 | JSONL reduce-on-ingest + 순수 TS 집계 | 네이티브 의존 0, CI에서 그대로 재현 |
| 통계 | Wilson / Newcombe / BH-FDR 자체 구현 | 판정 규칙을 블랙박스에 두지 않는다 |
| 파서 | `cheerio` | 정적 HTML 패치노트 |
| LLM | `@anthropic-ai/sdk` — Claude Opus 5, 캐시 우선·세션 상한 | 아래 "AI 사용 경계" |
| 배포·모니터링 | Vercel(정적) + UptimeRobot 5분 | |
| 품질 | vitest + eslint + tsc + `verify.sh` | |

## 판정 규칙

- **분모=전체매치 지표**(픽률·밴률·채택률·골드·오브젝트 시각)는 Wilson CI로 바로 후보가 된다.
- **승률 델타**는 `n≥게이트` ∧ Newcombe CI 비중첩 ∧ **BH-FDR q<0.10**을 전부 통과해야 한다.
  미달은 `insufficient-sample`로 회색 처리 — 근거를 지어내지 않는다.
  (2,000매치면 챔피언당 CI 반폭 ±9~10%p인데 밸런스 변동은 1~3%p다. 승률 단독으로는 판정이 성립하지 않는다.)
- **효과크기 바닥**(`EFFECT_SIZE_FLOORS`) — 유의해도 실전에서 무의미한 폭은 `below-threshold`로 내린다.
- **판정 7종**: `announced-consistent` / `announced-inconsistent` / `unannounced`(핵심 산출) /
  `indirect-effect`(미공지 중 원인이 규명된 것) / `below-threshold` / `insufficient-sample` / `no-change`.
- **다중검정 보정**: 170여 챔피언 × 다지표 동시검정이라 BH-FDR로 거짓양성을 통제한다.

## AI 사용 경계

LLM은 **결정론 단계가 못 푸는 두 가지에만** 쓴다 — 짝 없는 델타의 간접 원인 추론, 그리고 그 원인의 인용 검증.

- 모델이 돌려준 후보 노트 ID는 **입력 후보셋 안에 있을 때만** 인정한다. 밖이면 통째로 버린다.
- 검증 실패 문장은 삭제하지 않고 **회색(`--muted`)으로 떨어뜨린다** — "AI가 말했다"와 "근거가 있다"를 화면에서 구분한다.
- 판정(`MatchStatus`)은 LLM이 정하지 않는다. 통계 게이트가 정하고, LLM은 *왜*만 제안한다.
- 캐시 키는 `sha256(model|promptVersion|deltaId|candidateSetHash)` — 같은 입력은 두 번 호출하지 않는다.
  예산 소진·API 장애 시 캐시 폴백, 그래도 없으면 회색. 크래시하지 않는다.

## 품질 게이트·에러 추적

| 층 | 무엇을 잡나 |
|---|---|
| `bash verify.sh --full` | Spec(토큰 우회·하드코딩) → tsc → eslint → vitest → 빌드 → design-lint 6단 |
| vitest **85 파일 / 1,026 케이스** | 순수 로직·컴포넌트 렌더·파서 fixture |
| **산출물 불변식 테스트** | 커밋된 `deltas/*.json`을 직접 검사 — 댕글링 노트 id 0, 모드 노트 짝 0, 모드 노트 인용 0. 결함을 *그 형태 그대로* 인코딩해, 다음에 같은 결함이 나면 데이터 단계에서 깨진다 |
| `assertModeScopeConsistent` | 패치노트 h2 제목과 앵커 id 신호가 엇갈리면 파싱 시점에 **크게 실패**한다(조용한 오귀속 방지) |
| GitHub Actions `ci.yml` | main push·모든 PR에서 동일 게이트 재실행 |
| Actions artifact | 수집·매칭 실패 시 `logs/**`·`data/aggregated/**` 스냅샷 업로드 → 실패한 run에서 회수 |
| UptimeRobot 5분 | `https://patchgap.vercel.app/health.txt`(순수 정적) HTTP 모니터 |

**장애 폴백** — 부분 실패가 사이트 다운으로 이어지지 않는다.

- 수집·매칭 배치 실패 → `data/aggregated/**`는 마지막 성공 커밋 그대로, Vercel은 그 데이터로 계속 서빙.
- LLM 예산 소진·API 장애 → `run-match.ts --no-llm`으로 1단 결정론만 기록, 캐시 있으면 재사용.
- 패치노트 마크업 변경 → 파서 fixture 테스트가 먼저 깨진다. 고치기 전까지 이전 `notes/{patch}.json`이 남아 사이트는 산다.
- 빌드 실패 → 데이터가 하나도 없는 상태에서도 빌드가 깨지지 않는 것이 완료 조건(로더가 부재를 `null`/`[]`로 흡수).

## 문제 해결 기록

| 문제 | 원인 | 처방 |
|---|---|---|
| 승률만으로는 미공지 판정이 성립하지 않았다 | 1만 매치라도 챔피언당 표본이 CI 반폭 ±9~10%p | 다지표(픽·밴·채택률·골드)로 1차축을 옮기고 승률은 Newcombe+FDR 통과분만 |
| LLM이 후보 목록에 없는 노트를 인용했다 | 생성 모델에 검증이 없었다 | 반환 ID를 **입력 후보셋 안에서만** 인정 + 실패 문장은 회색 |
| 문장 다듬기 재요청이 **판정을 뒤집었다** | 응답을 통째로 채택 → 인용·confidence까지 교체됨(3단 재분류가 원인 문장을 읽는다) | `mergeRepairedProse` — 문장만 가져오고 근거는 원본 고정, 개수 불일치면 병합 포기 |
| 별도 게임 모드("클래식") 노트가 협곡 델타와 짝지어져 "공지"로 판정됐다 | `section`(무엇이 바뀌었나)이 적용 범위까지 겸했다 | 축 분리(`modeScope`) + 커밋 산출물 불변식 테스트로 게이트화 |
| PUBG 근거 문장이 판정 사유와 어긋났다 | "표시 자격 없음"을 전부 "CI가 0을 포함"으로 뭉갰다 | 인용하는 수치 자체로 분기(효과크기 바닥 미달 ↔ CI가 0을 포함) |

> 공통 교훈: **산문으로 적은 제약은 계약이 아니다.** 프롬프트·주석·계획서에 "이건 그대로 두세요"라고
> 적어도 강제되지 않는다. 강제는 코드(병합 함수·불변식 테스트·assert)가 한다.

## 로컬 실행

```bash
cp .env.example .env   # RIOT_API_KEY 필수, ANTHROPIC_API_KEY/DISCORD_WEBHOOK_URL 선택
#   PATCH_FROM=26.17 PATCH_TO=26.18 처럼 짝을 채운 뒤:
npm ci
npm run pipeline:all   # collect→timeline→aggregate→ddragon→match→build, out/ 산출
```

패치당 1만 매치 수집만 약 3.3h다 — 배경 실행(`nohup`/`tmux`)을 권한다.
개별 단계 재개·재시도는 CLI 인자를 직접 넘긴다(전체 목록은 각 `scripts/run-*.ts` 상단 주석,
`--dry-run` 지원 스크립트는 네트워크 없이 인자만 검증):

```bash
npm run pipeline:collect  -- --patch 26.18 --target 10000
npm run pipeline:timeline -- --patch 26.18 --sample 1500
npm run pipeline:aggregate -- --patch 26.18
npm run pipeline:ddragon
npm run pipeline:match -- --from 26.17 --to 26.18
npm run build
scripts/collect-all.sh --patches 26.18,26.17 --target 10000 --sample 1500   # 수집만 일괄
```

## 운영

**패치 D+1 체크리스트** (KR 라이브는 관측상 매주 목요일 KST)

1. `src/pipeline/collect/patch-calendar.ts`의 `PATCH_CALENDAR`에 새 패치 라이브일이 있는지 확인(시간창의 유일한 소스).
2. 실매치 1건으로 `info.gameVersion` 포맷·`startTime`·`challenges` 존재 확인 — 라이엇이 스키마를 조용히 바꾸는 사고 대비.
3. Actions `collect` 워크플로를 수동 트리거(`workflow_dispatch`, 입력을 비우면 캘린더 자동 판정)하거나 로컬 절차대로.
4. `deltas/{from}_{to}.json`의 `meta.counts`에서 `unannounced` ≥1인지, 짝짓기 비율이 합리적인지 확인.
5. 커밋된 `data/aggregated/**`를 Vercel이 감지해 자동 재배포.

예약 실행은 매주 목요일 00:00 UTC에 깨어나 그날 라이브하는 패치가 캘린더에 없으면 그대로 종료한다(no-op).
`{patch}/summary.json`이 이미 있으면 같은 패치를 다시 수집하지 않는다(강제는 `force: true`).
`run-collect.ts`/`run-timeline.ts`는 파일 단위 idempotent 재개이며, Actions는 `data/raw`를 패치별로 캐시해
6h 타임아웃에 끊겨도 다음 실행이 이어받는다.

**Actions secrets·variables** (Settings → Secrets and variables → Actions)

| 종류 | 이름 | 필수 | 비고 |
|---|---|---|---|
| Secret | `RIOT_API_KEY` | ✅ | Riot Developer Portal Personal Key |
| Secret | `ANTHROPIC_API_KEY` | — | 없으면 LLM 2단이 캐시 폴백/스킵 |
| Secret | `DISCORD_WEBHOOK_URL` | — | 없으면 브리핑 스텝 자체를 건너뜀 |
| Variable | `PATCHGAP_SITE_URL` | 배포 후 ✅ | 미등록이면 브리핑 embed 링크가 자리표시 기본값으로 나간다 |

## 데이터 계약

웹은 **빌드 타임에만** `data/aggregated/**`를 읽는다(런타임 외부 호출 0). 상세는 `data/aggregated/README.md`.

- `data/raw/{patch}/{matches,timelines}.jsonl` — 원본 수집(**커밋 안 함**)
- `data/aggregated/{patch}/{champions,items,lanes,objectives,summary}.json` — 5종 집계(**커밋**)
- `data/aggregated/notes/{patch}.json` — 패치노트 파서 출력(**커밋**)
- `data/aggregated/deltas/{from}_{to}.json` — 판정 최종 산출, 모든 판정문에 원천 링크(**커밋**)
- `data/aggregated/pubg/*.json` — PUBG 어댑터 집계·판정(**커밋**)
- `data/cache/llm/*.json` — LLM 캐시(**커밋 안 함**)
- `public/dd/**`, `data/ddragon/{v}/*.json` — Data Dragon 정적 자산(**커밋**)

## 고지

Riot Games Developer Portal의 Personal API Key로 고정 레이트 리밋(20req/1s, 100req/120s) 안에서만 호출한다.
Riot Games의 지식재산(챔피언·아이템 명칭·이미지, Data Dragon 자산)은 표시 목적으로만 사용하며
**재판매·유료화 기능은 포함하지 않는다**. 아레나·무작위 총력전 승률 통계는 생성하지 않는다.
PUBG 데이터는 PUBG Developer Portal API의 공개 `/samples`·`/matches` 응답만 사용한다.
patchgap는 Riot Games·KRAFTON과 제휴하거나 보증을 받지 않았으며, 각 게임 관련 상표·자산의 저작권은 각 권리자에게 있다.

이 저장소는 해커톤 출품용 비공개 프로젝트이며 별도 오픈소스 라이선스를 채택하지 않았다.
코드 저작권은 프로젝트 제작자에게 있다.
