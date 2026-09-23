# VERIFY-SPEC — 화면 동등성 Phase 1 (브리핑 + 전역)

기준: `docs/design/UX-BRIEF.md` §8 · `docs/plan/PLAN-screen-parity-2026-09-23.md`

## 구현한 것

| ST | 내용 | 산출물 |
|---|---|---|
| ST-1 | 공용 `BriefingTabs` + `BriefingTabBar` — 탭 3벌 → 1벌 | `src/components/BriefingTabs.tsx` 신설, `Tft/PubgBriefingTabs.tsx` **삭제**, `ReleaseNoteStream`은 바만 사용 |
| ST-2 | **본문 행 = 대상 단위 묶음** — 묶음 순수함수 + 공용 행(접힘/펼침·뱃지 맨 앞·이름 링크·원인 줄) | `src/components/briefingRows.ts`(+테스트 5건) · `src/components/BriefingRowList.tsx` 신설, TFT 표·PUBG 표/리스트 교체, LoL 카드 헤더에 대표 뱃지+이름 링크 |
| ST-3 | TFT 하단 「왜 그랬을까」 카드 폐지 → 표 행 아래 `CauseRow` 1줄 | `src/app/tft/page.tsx` |
| ST-4 | 공용 `StatTiles` — 라벨·부제·미공지 타일 링크 통일 | `src/components/StatTiles.tsx` 신설, 세 홈 + 랜딩이 소비 |
| ST-5 | 히어로 = 문장(h1) + 캡션. `Tft/PubgPageHeader` 카드를 캡션으로 흡수 | `src/app/{tft,pubg}/page.tsx` |
| ST-6 | 2컬럼 골격(A안) — TFT·PUBG에 사이드 신설 | `src/app/{tft,pubg}/page.tsx` |
| ST-7 | 디스코드 3게임 공통 + **게임별** 방법론 앵커 | `DiscordPanel`에 `game` prop, TFT·PUBG 방법론에 `#discord` 슬롯 신설 |
| ST-8 | 공용 `SiteFooter` — 집계(KST)·판정 수·데이터 출처·법적 고지 | 신설 + 게임 래퍼 위임 + LoL 4화면·랜딩 적용 |
| ST-9 | 어휘 통일 — `→`/`판정`/`선언 ↔ 관측`/`미공지 Gap` | 화면 다수 + `verify.sh` Spec 규칙 4d |
| ST-10 | 골격·어휘 게이트 | `src/app/__tests__/screen-parity.test.ts` (21 케이스) |

## 2차 검증(2026-09-23) 이후 반영

acceptance-critic이 **이 문서가 ST-2를 표에서 누락한 것**을 근거로 미충족을 짚었고, 실제로 원인 줄만
구현돼 있었다. 계약의 핵심(§8-2)이라 마저 구현했다 — 위 표 ST-2 행이 그 결과다.

| 지적 | 반영 |
|---|---|
| V1 그룹핑 함수 없음 | `groupBriefingItems` 신설 + 단위 테스트(같은 이름·다른 유형 분리, 입력 순서 보존, 대표 상태 규칙) |
| V2 뱃지가 맨 뒤 열 | 공용 행이 뱃지를 summary 맨 앞에 둔다 — TFT·PUBG 표/리스트, LoL 카드 헤더 모두 |
| V3 TFT 홈 이름이 링크 아님 | 공용 행의 이름이 상세 링크(`hrefOf`) — LoL도 카드 헤더 이름을 링크로 |
| V5 ISO 타임스탬프 게이트 없음 | `screen-parity.test.ts`에 신설. 처음 규칙이 `generatedAt={generatedAt}`(prop 전달) 3곳을 오탐해 **자식 렌더만** 잡도록 좁혔다 |
| scope-critic: LoL 고지 두 벌 | Riot 영문 원문을 `SiteFooter`로 올리고 방법론 카드에서 제거 — 닿는 범위는 오히려 넓어졌다 |
| scope-critic: PUBG 죽은 앵커 | `PubgCompareTable`에 해시 동기화 `useEffect` 추가(LoL `CompareExplorer`와 같은 방식). **2026-09-23 후속**: 그 파일은 Phase 2에서 `PubgCompareExplorer`로 대체됐고, 해시 동기화는 세 게임 공용 훅 `useFilterHash`가 소유한다 — 화면마다 손으로 적던 것이 TFT에서 빠져 있었기 때문이다(렌더 실측). |

**따르지 않은 판정과 사유**
- `selectTftCauseRows` 상한 8→전체(scope-critic): 그 함수는 이미 `isReportableRecord ∧ LLM 있음 ∧
  미검토 제외`로 거르고 미검증 요약은 회색으로 떨어진다. §8-2가 "행마다 원인 1줄"을 요구하므로
  상한으로 막으면 계약이 성립하지 않는다.
- 게이트 위치 이탈(V6): 어휘 4종 중 2종이 `verify.sh`, 2종이 vitest. 둘 다 `verify.sh --full`
  경로에서 실행돼 기능상 동등하고, critic도 영향 "없음/낮음"으로 적었다.
- 접힌 「유의한 관측 없음」 묶음에 뱃지 없음: 그 묶음에 든 행들은 **보고 가능한 관측이 없어** 붙일
  판정이 없다. 요약행 문구가 그 사실을 이미 말한다(라운드6 C1이 이 어휘를 뱃지에서 뺀 결정).

## 구현 결정 (stub·보류·하드코딩)

- ~~**TFT 대조표 타일 앵커 없음**~~ → **Phase 2에서 닫혔다**: 대조표에 칩이 생겼고, 착지점은
  `StatTiles.gapHrefOf(game)`가 계산한다(문자열을 호출부가 넘기는 한 네 번째 게임도 같은 방식으로
  틀린다). 받는 쪽은 `useFilterHash`가 소유한다.
- **사이드 컬럼에 디스코드만**: TFT·PUBG는 지금 사이드에 놓을 패널이 그것뿐이다. 없는 패널을
  지어내지 않았다(§8-1 "그 게임이 가진 패널만").
- **`StreamColumnLayout` 재사용 안 함**: 그 컴포넌트는 좌측 높이를 우측에 맞춰 고정하는 장치인데
  TFT·PUBG 본문은 이미 `PANEL_SCROLL_BODY`로 제 높이를 갖는다. 같은 2컬럼 골격을 쓰되 높이 결합은
  하지 않았다(겹치면 카드가 잘린다).
- **테스트 1건 수정**: `AdapterMatrix.test.tsx`가 `"실연결 · 42.3 ⇒ 43.1"`을 고정하고 있었다.
  §8-5 어휘 변경에 따른 **명세 반영**이며 통과시키려는 약화가 아니다(사유를 테스트 주석에 남김).
- **어휘 게이트 범위 정정**: 처음 규칙이 상태 뱃지·필터 칩의 「미공지」까지 잡았다. 그건 판정
  어휘(`format.ts`가 소유)라 대상이 아니다 — 타일·탭 라벨의 사본만 막도록 좁혔다.

## 미확인 사항

- **렌더 실측 완료(2026-09-23)**: `npm run build` 산출물(`out/`)을 정적 서버로 띄워 1440×900에서
  확인했다 — 세 홈 모두 `[뱃지][이름 →][유형][N개 항목 ▾]`, 가로 스크롤 0, 2컬럼, 푸터 존재.
  dev 서버는 WSL inotify 때문에 변경을 놓치는 일이 반복돼(같은 증상 3회) **빌드 산출물로 본다**.
- ~~모바일 폭 미측정~~ → **390×844 전 14화면 실측 완료(2026-09-23)**. 데스크톱에서 멀쩡하던
  **네 화면이 깨져 있었다** — 한 줄 flex/표에서 형제가 전부 `shrink-0`이고 한 칸만 줄어들어,
  그 칸의 텍스트가 세로로 한 글자씩 쌓였다(`/lol/` 이름 **20px** · `/tft/compare/` 이름 16px ·
  `/` 계층 라벨 52px · `/pubg/compare/` 숫자 열). 수정 후 14/14가 `pageScrollW=390` ·
  무너진 칸 0. 처방·게이트 한계는 UX-BRIEF §8-6.
  **측정 방법의 교훈**: 첫 스윕의 판별식(`height > 120px`)이 `/lol/`의 20×63 이름을 놓쳤다 —
  같은 결함인데 임계 하나로 한 화면만 통과했다. 줄높이 배수(`height > lineHeight × 2.4`)로
  바꾸자 드러났다. **검출식이 틀리면 깨진 화면도 통과한다**.
- ~~PUBG 대조표 `#unannounced` 해시 동기화 미검증~~ → **Phase 2에서 렌더로 확인했다**: 세 게임
  모두 「미공지」 칩이 활성되고 표 행 수가 칩 숫자와 같다(LoL 29 · TFT 58 · PUBG 5). 그 검증이
  **TFT만 「전체」에 착지하던 것**을 잡았다.
- LoL 항목 상세 푸터의 `nVerdicts={null}` — 그 화면엔 전체 판정 수를 가진 변수가 없어 생략했다.
  "없는 값을 0으로 채우지 않는다"는 판단이지만, 판정 수를 보여주는 다른 화면과 정보량이 다르다.
