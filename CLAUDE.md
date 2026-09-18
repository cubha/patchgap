# Claude Code 운영 규칙: patchgap

> 전역 공통 규칙은 `~/.claude/CLAUDE.md`를 따른다.
> 이 파일은 프로젝트 고유 내용만 기술한다.

## ⚠️ Next.js 16 주의사항 (create-next-app 생성본 보존)

`AGENTS.md`(create-next-app이 생성, `next dev`가 재생성)의 경고를 그대로 유지한다: **이 Next.js
버전은 학습 데이터와 다른 breaking change를 포함한다** — API·컨벤션·파일 구조가 다를 수 있으므로
코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 읽고 deprecation 공지를 따른다.
`AGENTS.md`는 `next dev`가 실행될 때마다 재생성되므로 **diff에서 지워도 되돌아온다** — 그 자체를
커밋에 포함하는 것이 정상이다. 이 프로젝트에서 실측한 구체 사례: `LayoutProps<"/">` 같은 앰비언트
타입은 `.next/types`가 생성된 뒤에만 존재하므로, 최초 `tsc --noEmit`(빌드 이전)에는 잡히지 않는다
— `src/app/layout.tsx`는 그래서 명시 타입(`{ children: ReactNode }`)을 쓴다.

@AGENTS.md

## 🛠️ 기술 스택 (고정값 — 변경 금지)

- 언어·런타임: TypeScript 5 / Node 22 (ESM, `tsx`)
- 패키지 구조: 단일 패키지 `src/{app,components,lib,pipeline}` + `scripts/` (모노레포 아님)
- 프론트: Next.js 16 App Router, `output: 'export'`(정적 배포) + Tailwind v4 + recharts
- Riot API 클라이언트: `fetch` + `bottleneck` 2단 체이닝(20/1s ⟵ 100/120s) + Retry-After 재시도
- 저장·집계: JSONL reduce-on-ingest + 순수 TS 집계(`data/raw` gitignore, `data/aggregated` 커밋). 네이티브 의존 0
- 통계: 자체 구현(Wilson/Newcombe/BH-FDR) — 외부 통계 라이브러리 의존 0
- 패치노트 파서: `cheerio`
- LLM 짝짓기·요약: `@anthropic-ai/sdk` — Claude Opus 5(`claude-opus-5`, 2026-09-18 SCOPE §3 갱신으로 Sonnet 5에서 상향), 배치 1회 상한(400, 2026-09-18 SCOPE §3 갱신으로 120에서 상향 — 후보 244건 패치에서 124건이 미검토였다)·캐시 우선
- 알림: `fetch` Discord Webhook (의존 0)
- 배포·모니터링: Vercel(정적) + UptimeRobot 5분
- 테스트·품질: vitest + eslint + tsc + `verify.sh`

> 근거: `docs/scope/SCOPE-patchgap-2026-09-05.md` §3. 대안 채택 금지 — 바꾸려면 SCOPE 문서를 먼저 갱신한다.

## 📁 프로젝트 핵심 구조

```
src/app/            페이지(App Router) — 브리핑 홈 · compare · item/[id] · methodology
src/components/     UI 컴포넌트 (Header, FilterBar, …)
src/lib/            빌드 타임 데이터 로더(data.ts) · 포맷 유틸(format.ts)
src/styles/         tokens.css (디자인 토큰 Ground Truth 실체)
src/pipeline/       도메인 타입(types.ts) + collect/aggregate/match/discord 파이프라인
scripts/            pipeline:* 진입점 (dotenv 로드 + pipeline 함수 호출)
data/aggregated/    빌드 타임에 소비하는 집계 결과 JSON (커밋 대상)
data/raw/           원본 수집 데이터 (gitignore, `.gitkeep`만 커밋)
public/dd/          Data Dragon 정적 자산(챔피언/아이템 아이콘) — 빌드 타임 다운로드, 런타임 외부 호출 0
```

## 📐 핵심 구현 원칙

- **런타임 외부 API 호출 0** — 브라우저에서 서빙되는 정적 사이트는 `data/aggregated/*.json`만 읽는다. Riot API·LLM 호출은 전부 빌드 이전 파이프라인(`scripts/`)에서 끝낸다.
- **사전 인덱싱** — 수집(F1) → 집계(F2) → 매칭/판정(F3~F4) → 빌드(F5) 순서를 반드시 지킨다. 각 단계 산출물은 다음 단계 입력 파일로만 연결한다.
- **모든 판정문은 원천 링크를 가진다** — `DeltaRecord.evidence`(`DeltaEvidence.matchIds`·`aggregatePath`·`noteAnchor`)가 채워지지 않은 판정은 화면에 링크를 걸지 않는다.
- **무근거 문장은 회색** — `DeltaRecord.causes[].verified`가 `false`이거나 `causes`가 비어 있으면 `--muted` 토큰으로만 렌더한다. 임의로 근거를 지어내 채우지 않는다. (2026-09-05: 미사용 `Verdict` 인터페이스는 `DeltaEvidence`/`DeltaRecord.status`로 완전히 대체되어 삭제됐다 — ST-08 확정.)
- **LLM 배치·캐시·상한** — `llm-match.ts`는 세션당 처리 델타 수 상한(`LlmMatchOptions.maxDeltas`)을 지키고, 캐시 파일이 있으면 우선 사용한다. 예산 소진 시 캐시 폴백 — 실패해도 무근거 회색으로 떨어질 뿐 크래시하지 않는다.
- **라이엇 API terms 준수** — Personal 키 고정 리밋 이내로만 호출, 유료화·재판매 기능 금지, 아레나/무작위 총력전 승률 통계 생성 금지(Won't 항목).

## 🔷 TypeScript 규칙

- `strict: true` 유지. `any` 타입 금지 — 불가피하면 `unknown` + 타입 가드.
- 도메인 타입은 `src/pipeline/types.ts`에만 정의한다(다른 모듈에서 중복 선언 금지).
- 미구현 함수는 시그니처만 두고 `throw new Error("TODO(...): ...")`로 명시한다 — 조용히 빈 값을 반환하지 않는다(무근거 회색 원칙과 동일한 이유: 구현 안 됐음을 숨기지 않는다).
- `scripts/**/*.ts`도 `tsconfig.json` `include` 대상이다 — 타입 체크에서 제외하지 않는다.

## 📦 디렉토리 규칙

- `src/pipeline/collect/*`: Riot API 호출이 발생하는 유일한 계층. 다른 계층에서 직접 `fetch`로 Riot API를 호출하지 않는다.
- `src/pipeline/match/llm-match.ts`: Claude API 호출이 발생하는 유일한 계층.
- `src/pipeline/aggregate/*`: 순수 함수만 — 부수효과(파일 I/O) 금지, 입력 `MatchSlim[]`/출력 `*Stat[]`.
- `src/app/*`: 데이터 페칭은 빌드 타임(`src/lib/data.ts`)에서만. `"use client"` 없이 서버 컴포넌트 우선.
- `data/raw/`: 절대 커밋하지 않는다(`.gitkeep`만 예외). `data/aggregated/`: 빌드 재현을 위해 커밋한다.

## 🎨 디자인 토큰 바인딩

- Ground Truth: `docs/design/DESIGN-TOKENS.md` + `docs/design/prototype/*.html`
- 토큰 실체: `src/styles/tokens.css`의 `:root`(카탈로그 verbatim 복사) + `src/app/globals.css`의 `@theme inline` 바인딩
- 네임스페이스: `--bg --surface --surface-warm --fg --fg-2 --muted --border --border-soft --accent --accent-on --success --warn --danger --game-wash --game-glow --font-display --font-body --font-mono --radius-sm --radius-md --radius-lg --radius-pill`
- 소비 형태: 웹 CSS 변수(`var(--*)`) + Tailwind v4 유틸리티(`bg-surface`, `text-muted`, `font-mono`, `rounded-md` 등) — 다른 소비 대상 없음
- 예외 표기: 정당한 하드코딩(브랜드 로고색 등)은 같은 줄에 `design-lint-ignore` 주석
- 게이트: `bash verify.sh`의 Spec 규칙(소스 하드코딩·arbitrary 우회 검사) + `/design-lint`(렌더 산출물, `docs/design/prototype/*.html` 대상)

## 📚 참조 (구현 Ground Truth)

- `docs/scope/SCOPE-patchgap-2026-09-05.md` — 범위·스택·일정 확정
- `docs/research/RESEARCH-patchgap-2026-09-05.md` — 기반 리서치
- `docs/design/UX-BRIEF.md` — 화면 맵·스토리보드·구현 준수 원칙
- `docs/design/DESIGN-TOKENS.md` / `docs/design/seed/catalog-tokens.css` — 토큰 값
- `docs/design/prototype/*.html` — 화면 4장 프로토타입(픽셀 단위 참조)

## 🚫 프로젝트 추가 금지 사항

- `any` 타입, 미사용 변수/임포트
- SCOPE §3에 없는 신규 의존성 임의 추가(통계·크롤링·상태관리 라이브러리 등 — 자체 구현 원칙 위반)
- `data/raw/*`(원본 매치 데이터), `.env`, API 키·웹훅 URL 커밋
- 런타임(브라우저)에서의 Riot API·Claude API 직접 호출
- 아레나·무작위 총력전 모드 통계, 실시간 로그인·서버 DB, 유료화·재판매 기능(SCOPE §2 Won't)
