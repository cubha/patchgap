# patchgap

**패치노트는 14개 챔피언·아이템을 바꿨다고 말했고, 통계는 403개 변화를 말한다.**(26.17→26.18 실측) patchgap는 LoL 공식 패치노트가 *말한 것*과
매치 통계가 *실제로 말하는 것* 사이의 괴리 — 미공지 변화·간접 메타 이동 — 를 통계 게이트를
통과한 원천 매치 링크와 함께 24~72h 안에 보여주는 정적 브리핑 사이트다.

- **타겟**: LoL KR 코치·클랜장·분석 스트리머
- **1차 완성 기준**: ① 패치노트 항목 ↔ 관측 델타 자동 대조표 ② 통계 게이트를 통과한 미공지 변화
  ≥1건(원천 매치 링크 첨부) ③ 브리핑 화면이 Vercel에 정적 배포되어 외부 API 호출 0으로 상시 작동
  ④ 동일 브리핑을 디스코드 웹훅으로 전송
- 근거 문서: `docs/scope/SCOPE-patchgap-2026-09-05.md` · `docs/research/RESEARCH-patchgap-2026-09-05.md`
  · `docs/plan/PLAN-patchgap.md`

## 아키텍처

```
수집(F1/F8) → 집계+통계(F2) → 패치노트 파싱(F3) → 짝짓기+판정(F4) → 정적 빌드(F5/F7) → 디스코드(F6)
```

1. **수집** — KR 챌린저/GM/마스터 시드 → puuid → 매치ID(패치 라이브 시간창) → 상세 전량(패치당
   목표 1만, 최소 2천) + 별도 큐로 타임라인 표본(1~2천). Riot API `fetch` + bottleneck 2단 리밋
   (20/1s ⟵ 100/120s), 429 재시도, `gameVersion` 접두 컷, JSONL reduce-on-ingest, 파일 단위
   idempotent 재개. → `data/raw/{patch}/*.jsonl`(gitignore, 로컬·CI 러너 전용)
2. **집계 + 통계** — 챔피언 픽·밴·승률(포지션별), 아이템 채택률(완성템), 라인별 골드@10/@14,
   첫 오브젝트 시각. Wilson/Newcombe CI + 최소 n 게이트 + BH-FDR(자체 구현, 외부 통계 라이브러리
   0). → `data/aggregated/{patch}/*.json`(커밋)
3. **패치노트 파싱** — ko-kr 공식 패치노트 정적 HTML을 cheerio로 파싱해 `{entity, skill, stat,
   before, after, direction}` 구조 + 원문 anchor 링크로 변환. → `data/aggregated/notes/{patch}.json`
4. **짝짓기 + 판정** — 1단 결정론(엔티티 ID 블로킹 + 방향 정합 스코어) → 2단 LLM(Claude
   Opus 5, 짝 없는 델타만 배치 추론, 반환 후보 ID를 입력 후보셋 안에서만 검증, 세션 상한 +
   캐시 우선 + 예산 소진 시 캐시 폴백). → `data/aggregated/deltas/{from}_{to}.json`(모든 판정문에
   원천 링크, 무근거는 `--muted`로만 렌더)
5. **정적 빌드** — Next.js 16 App Router `output: 'export'`. 빌드 타임에 `data/aggregated/**` JSON을
   그대로 임베드하고, 브라우저는 이후 어떤 외부 API도 호출하지 않는다(Riot API·Claude API 호출은
   전부 빌드 이전 파이프라인에서 끝난다).
6. **디스코드** — 상위 미공지 5건 + 링크를 embed(≤10개·6,000자 제한 준수)로 웹훅 전송, 429
   `retry_after` 재시도.

## 로컬 실행

진입점은 `npm run pipeline:all`이다 — `.env`의 `PATCH_FROM`/`PATCH_TO`를 그대로 읽어
**수집(F1) → 타임라인 표본(F8) → 집계(F2) → Data Dragon 자산 → 패치노트 짝짓기·판정(F3/F4) →
정적 빌드** 전체를 한 번에 순서대로 실행하는 오케스트레이터다(`package.json` 확인):

```bash
cp .env.example .env   # RIOT_API_KEY 필수, ANTHROPIC_API_KEY/DISCORD_WEBHOOK_URL은 선택
#   PATCH_FROM=26.16 PATCH_TO=26.17 처럼 짝을 채운 뒤:
npm ci
npm run pipeline:all   # collect→timeline→aggregate→ddragon→match→build 전체, out/ 산출
```

패치당 목표 1만 매치 기준 상세 수집만 약 3.3h가 걸리므로(SCOPE §4), 처음 두 패치(26.16·26.17)를
구축할 때처럼 시간이 오래 걸리는 실행은 배경에서 돌리거나 `nohup`/`tmux` 등으로 분리하는 걸
권장한다.

`pipeline:all`이 묶는 개별 단계를 따로따로 돌리거나 재개하고 싶을 때(예: 특정 단계만 재시도,
`--target`처럼 기본값과 다른 인자 지정)는 아래처럼 CLI 인자를 직접 넘긴다:

```bash
# 1) 상세 매치 수집 (패치당 3~4h 소요 — 1만 매치 기준 약 3.3h)
npm run pipeline:collect -- --patch 26.17 --target 10000

# 2) 타임라인 표본 수집 (상세 수집 완료 후 실행 — matches.jsonl 스냅샷에 표본이 결정론으로 묶인다)
npm run pipeline:timeline -- --patch 26.17 --sample 1500

# 3) 집계 (5종 JSON: champions/items/lanes/objectives/summary)
npm run pipeline:aggregate -- --patch 26.17

# 4) Data Dragon 자산(챔피언·아이템 아이콘 + 매핑 JSON)
npm run pipeline:ddragon

# 5) 패치노트 파싱 + 짝짓기 + 판정 (from < to, 둘 다 이미 집계돼 있어야 함)
npm run pipeline:match -- --from 26.16 --to 26.17

# 6) 정적 빌드
npm run build   # out/ 에 산출
```

여러 패치를 한 번에 수집하려면(집계·매칭 이전, 순수 수집 단계만) `scripts/collect-all.sh`를
쓴다(상세 수집 전체 → 타임라인 표본 전체 순서, 재실행 안전):

```bash
scripts/collect-all.sh --patches 26.17,26.16 --target 10000 --sample 1500
```

CLI 인자 전체 목록은 각 `scripts/run-*.ts` 상단 주석 참고. `--dry-run`을 지원하는 스크립트는
네트워크 호출 없이 인자 검증만 수행한다.

## 운영 절차

### 패치 D+1 수집 체크리스트

새 패치가 KR에 라이브되면(공식 패치는 관측상 매주 목요일 KST):

1. `src/pipeline/collect/patch-calendar.ts`의 `PATCH_CALENDAR`에 새 패치 라이브일(KST)이
   등록돼 있는지 확인 — 없으면 여기부터 추가한다(시간창 산정의 유일한 소스).
2. 실매치 1건으로 `info.gameVersion` 포맷·`startTime` 파라미터·`challenges` 필드 존재를
   확인한다(SCOPE §4 D+1 게이트) — 라이엇이 API 스키마를 조용히 바꾸는 사고에 대비.
3. `.github/workflows/collect.yml`을 GitHub Actions 수동 트리거(아래)로 실행하거나, 로컬에서
   "로컬 실행" 절차를 그대로 따른다.
4. `data/aggregated/deltas/{from}_{to}.json`의 `meta.counts`에서 `unannounced`(미공지) 건수가
   ≥1인지, 상위 델타 짝짓기 비율이 합리적인지 확인한다.
5. 이상 없으면 커밋된 `data/aggregated/**`를 Vercel이 감지해 자동 재배포한다.

### GitHub Actions secrets·variables

저장소 Settings → Secrets and variables → Actions에서 등록한다(값은 어떤 로그·문서에도 노출되지
않는다):

| 종류 | 이름 | 필수 여부 | 설명 |
|---|---|---|---|
| Secret | `RIOT_API_KEY` | **필수** | Riot Developer Portal Personal Key |
| Secret | `ANTHROPIC_API_KEY` | 선택 | 없으면 LLM 2단 매칭이 캐시 폴백/스킵으로 떨어짐 |
| Secret | `DISCORD_WEBHOOK_URL` | 선택 | 없으면 Discord briefing 스텝 자체를 건너뜀 |
| Variable | `PATCHGAP_SITE_URL` | **배포 후 필수** | Vercel 배포 URL(현재 확정값 `https://patchgap.vercel.app`). 미등록 상태로는 `run-notify.ts`의 자리표시 기본값이 그대로 브리핑 embed 링크에 쓰여 실제 도메인과 어긋날 수 있다 — 배포 전에는 비워둬도 워크플로우가 깨지지 않지만(자체 기본값으로 폴백), **첫 Vercel 배포 직후 반드시 등록**한다 |

### GitHub Actions 수동 트리거

`.github/workflows/collect.yml`은 GitHub 저장소 페이지 → Actions → `collect` → **Run workflow**로
수동 실행할 수 있다(`workflow_dispatch`). 모든 입력값은 비워두면 캘린더 기반 자동 판정과 동일하게
동작한다:

| 입력 | 기본값 | 설명 |
|---|---|---|
| `patch` | (비우면 오늘 KST 기준 캘린더 자동 판정) | 수집할 패치 ID |
| `target` | `10000` | 패치당 상세 매치 수집 목표 |
| `timeline_sample` | `1500` | 타임라인 표본 수 |
| `from` / `to` | (비우면 캘린더상 직전 패치 / patch) | 매칭 기준 패치 쌍 |
| `llm_max` | `50` | LLM 2단 매칭 세션 상한 |
| `force` | `false` | 이미 이번 패치가 집계돼 있어도 강제 재실행 |

예약 실행(`schedule: cron`)은 매주 목요일 00:00 UTC에 깨어나 그날(KST) 라이브하는 신규 패치가
`PATCH_CALENDAR`에 있는지 자동 판정한다 — 없으면 아무 것도 하지 않고 종료한다(no-op).

### 재개 규칙

- `run-collect.ts`/`run-timeline.ts`는 파일 단위 idempotent 재개다 — 이미 받은 매치 ID는
  다시 요청하지 않는다. GitHub Actions에서는 `data/raw`를 `actions/cache`로 패치별 캐시해
  실행이 6h 타임아웃·실패로 중단돼도 다음 실행이 이어받는다.
- SIGINT(Ctrl+C) 시 `run-collect.ts`는 진행 중인 매치까지만 마치고 정상 종료한다.
- `data/aggregated/{patch}/summary.json`이 이미 있으면 GitHub Actions 예약 실행은 같은 패치를
  다시 수집하지 않는다(중복 방지) — 강제 재실행은 `force: true`로 수동 트리거.

### UptimeRobot 설정(5분 HTTP 모니터)

1. [uptimerobot.com](https://uptimerobot.com) 무료 계정 생성 → **Add New Monitor**
2. Monitor Type: `HTTP(s)`
3. URL: `https://<배포 도메인>/health.txt`(정적 파일, 항상 `ok` 반환 — `public/health.txt`)
4. Monitoring Interval: `5 minutes`
5. 알림 연락처(이메일 등) 등록 후 저장

`/health.txt`는 런타임 로직이 없는 순수 정적 파일이라 별도 상태 체크 API 없이도 "사이트가
떠 있는가"만 확인한다(F7 "상시 작동" 자격요건).

### 장애 시 폴백

- **수집/매칭 배치 실패**: `data/aggregated/**`는 마지막 성공한 커밋 상태 그대로 남아있다 —
  Vercel은 그 시점 데이터로 계속 서빙한다(부분 실패가 사이트 다운으로 이어지지 않음).
  GitHub Actions 실패 시 `logs/**`·`data/aggregated/**` 스냅샷이 workflow artifact로 업로드된다
  (Actions 탭 → 실패한 run → Artifacts).
- **LLM 예산 소진/API 장애**: `run-match.ts --no-llm`으로 2단 추론을 건너뛰고 1단 결정론 판정만
  기록할 수 있다. 캐시된 `data/cache/llm/*.json`이 있으면 우선 재사용해 API 호출 없이 폴백한다.
- **패치노트 마크업 변경**: `src/pipeline/match/patchnotes-parser.ts`의 fixture 테스트가 먼저
  깨진다 — 파서를 고치기 전엔 이전 패치의 `notes/{patch}.json`이 캐시된 채로 남아있어 사이트
  자체는 죽지 않는다.
- **빌드 실패**: `data/aggregated/`가 커밋된 상태로 남아있다면 로컬에서 `npm ci && npm run build`가
  항상 재현 가능해야 한다 — 데이터가 하나도 없는 초기 상태(빈 `{patch}/` 디렉토리)에서도 빌드가
  깨지지 않는 것이 완료 조건이다(로더가 파일 부재를 `null`/`[]`로 흡수, `src/lib/data.ts`).

## 통계 게이트 요약

- **분모=전체매치 지표**(픽률·밴률·완성템 채택률·라인 골드@10/@14·첫 오브젝트 시각)는 Wilson
  score interval로 CI를 낸다 — 표본이 곧 전체 관측치라 임계값 없이 바로 "관측된 변화" 후보.
- **승률 델타**는 더 엄격하다: `n≥게이트`(초안 200, 첫 집계 후 시뮬레이션으로 재산정 예정) +
  Newcombe(Wilson) 두 비율 차이 CI **비중첩** + **BH-FDR q<0.10** 통과 시에만 "관측된 변화"로
  판정한다. 미달이면 `insufficient-sample`(표본 부족) — 회색으로만 렌더하고 근거를 지어내지
  않는다. (근거: 2,000매치 규모에서 챔피언당 100~120게임 → 95% CI 반폭 ±9~10%p인데 밸런스
  패치 변동 폭은 보통 1~3%p라 승률 단독으로는 미공지 판정이 성립하지 않는다 — RESEARCH §3-2.)
- **판정 5종**(`MatchStatus`): `announced-consistent`(공지·방향 일치) / `announced-inconsistent`
  (공지됐지만 관측 방향 불일치) / `unannounced`(미공지 — 이 사이트의 핵심 산출) /
  `insufficient-sample`(표본 부족) / `no-change`(비유의·짝 없음).
- **다중검정 보정**: 170여 챔피언 × 다지표 동시검정이라 BH-FDR로 거짓양성을 통제한다.

## 데이터 계약

웹은 **빌드 타임에만** `data/aggregated/**`를 읽는다(런타임 외부 호출 0). 레이아웃·커밋 규칙은
`data/aggregated/README.md` 참고. 요약:

- `data/raw/{patch}/{matches,timelines}.jsonl` — 원본 수집(로컬/CI 러너 전용, **커밋 안 함**)
- `data/aggregated/{patch}/{champions,items,lanes,objectives,summary}.json` — 5종 집계(**커밋**)
- `data/aggregated/notes/{patch}.json` — 패치노트 파서 출력(**커밋**)
- `data/aggregated/deltas/{from}_{to}.json` — 짝짓기·판정 최종 산출, 모든 판정문에 원천
  매치 ID·집계·패치노트 anchor 링크(**커밋**)
- `data/cache/llm/*.json` — LLM 2단 캐시(**커밋 안 함**, 예산 보호용)
- `public/dd/{champion,item}/*.png`, `data/ddragon/{v}/*.json` — Data Dragon 정적 자산(**커밋**)

## 라이엇 API 이용 고지

이 프로젝트는 [Riot Games Developer Portal](https://developer.riotgames.com)의 Personal API Key로
동작하며, 고정 레이트 리밋(20req/1s, 100req/120s) 안에서만 호출한다. Riot Games의 지식재산
(챔피언·아이템 명칭·이미지, Data Dragon 정적 자산 등)을 표시 목적으로만 사용하며, **재판매·유료화
기능은 포함하지 않는다**. 아레나·무작위 총력전 모드의 승률 통계는 생성하지 않는다(Riot API 이용
약관 준수, SCOPE §2 Won't). patchgap는 Riot Games와 제휴하거나 Riot Games의 보증을 받지
않았으며, Riot Games는 League of Legends 및 Riot Games가 소유한 모든 관련 자산의 저작권자다.

## 라이선스·저작권

이 저장소는 해커톤 출품용 비공개(private) 프로젝트이며 별도 오픈소스 라이선스를 채택하지 않았다
(OSS 공개는 해커톤 이후 검토 대상 — SCOPE §2 "N4 OSS 릴리즈 미공지 탐지", 이번 스코프의 Won't).
코드 저작권은 프로젝트 제작자에게 있다. League of Legends 관련 상표·자산의 저작권은 Riot Games,
Inc.에 있다.
