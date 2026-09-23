# VERIFY-SPEC — 화면 동등성 Phase 2 · Phase 3 (대조표 · 방법론 · 상세 · 자산 · 파이프라인)

기준: `docs/design/UX-BRIEF.md` §8 · `docs/plan/PLAN-screen-parity-2026-09-23.md`(요구사항 6 = 이월 전건)

## 구현한 것

| ST | 내용 | 산출물 |
|---|---|---|
| ST-11 | 공용 대조표 도구모음 — 칩 4종·개수·검색·정렬 3키 | `compare/toolbarRules.ts`(테스트 12) · `CompareToolbar.tsx` |
| ST-12 | 공용 좌 「패치노트 항목」 내비 + 2컬럼 골격 + 포커스 | `compare/noteNav.ts`(테스트 11) · `NoteNavPanel.tsx` · `CompareSplit.tsx` · `useRowFocus.ts` · `pubg/noteNav.ts`(테스트 5) |
| ST-13 | 화면 머리 — 이동 경로 + h1 + 한 줄 + 액션 | `Breadcrumb.tsx` · `PageHeader.tsx` · `lib/breadcrumbs.ts` |
| ST-14 | 타일 → 칩 착지 | `StatTiles.gapHrefOf(game)` · `compare/useFilterHash.ts` |
| ST-15 | 문체 게이트(존댓말) + 반말 교정 | `screen-parity.test.ts` 신규 규칙 · 교정 16건 |
| ST-16 | 대조표 골격 게이트 | `screen-parity.test.ts` §8-3 블록 |
| ST-17 | **방법론 9슬롯을 코드가 소유** | `methodology/slots.ts`(테스트 6) · `MethodologyLayout.tsx` · 세 방법론 재작성 |
| ST-18 | LoL 상세 **대상 단위 라우트** + 구 경로 별칭 | `lib/detailRoutes.ts`(`detailEntityKeys`·`detailRouteSlugs`·`lolEntityHref`, 테스트 11) |
| ST-19 | 상세 통일 — 제목·이동 경로·액션·JSON 경로 라벨 | 세 게임 상세 5라우트 |
| ST-20 | 전 대상 색인 슬롯 | `EntityIndexSection.tsx` · `home/entityIndex.ts`(테스트 5) |
| ST-21 | 「기타 변경」 — 데이터 차이로 종결 + 감시 게이트 | `misc-sections-parity.test.ts` |
| ST-22 | 섹션 순서 게이트 | `screen-parity.test.ts` §8-1 순서 블록 |
| ST-23 | TFT 이미지 자산 배선 | `pipeline/tft/asset-path.ts` · `scripts/run-tft-assets.ts` · `EntityIcon`에 `game`·`assetMissing` · `tft-assets.test.ts` |
| ST-24 | PUBG 추정 원인 | `llm-profile-pubg.ts`(테스트 9) · `scripts/run-pubg-llm.ts` · `PubgDeltaRow.causes/llm` · 엔진 제네릭화 |
| ST-25 | 14화면 렌더 실측 | 아래 「렌더 검증」 |

## 렌더 검증 (빌드 산출물, 1440×900)

`npm run build` → `out/`을 정적 서버로 띄워 14화면을 **실제로 렌더**해 잰 값이다.
dev 서버는 WSL inotify 때문에 변경을 놓치는 일이 반복돼(같은 증상 3회) 빌드 산출물로 본다.

| 축 | 결과 |
|---|---|
| h1 | 14/14 존재 |
| 이동 경로 | 비-브리핑 9화면 전부 `브리핑 › 대조표 › {대상}` 한 형식 |
| ISO 시각 노출 | **0건**(가시 텍스트 기준) · KST 표기만 |
| 반말 종결 | **0건** |
| `⇒` 패치 쌍 | 0건 |
| 푸터(집계·판정 수·출처·고지·운영 상태) | 14/14 |
| 가로 스크롤 | 0건 |
| 대조표 도구모음 | 세 게임 칩 4종(개수 포함)·검색·정렬 3키(`priority` 기본) 동일 |
| `#unannounced` 착지 | 세 게임 모두 「미공지」 칩 활성 + 행 수 일치(LoL 29 · TFT 58 · PUBG 5) |
| 좌 내비 | 세 게임 「패치노트 항목」 — LoL 15 · TFT 102 · PUBG 3 묶음 |
| TFT 이미지 | 브리핑 **245장** 렌더(이전 0장) · 콘솔 404 0건 |

## 검증에서 드러나 고친 것 (렌더가 아니었으면 못 잡았다)

| 발견 | 원인 | 처방 |
|---|---|---|
| 랜딩 확장성 표에 반말 5줄 | 문체 게이트가 `.tsx`만 걸었다 — 그 문장은 `.ts` 데이터 모듈에 있었다 | 게이트를 `.ts`까지 확대 |
| TFT만 `#unannounced`에서 「전체」에 착지 | 해시 동기화를 화면마다 손으로 적고 있었다 | `useFilterHash` 훅으로 소유권 이전 + 게이트 |
| TFT 미보유 자산 2건이 매 페이지 404 | `onError` 폴백에 의존 | `assetMissing`으로 **빌드 타임 판정**(요청 자체를 안 한다) |
| PUBG 대조표 행만 아이콘 없음 | 자산은 있었는데 배선이 없었다 | 공식 렌더를 행에 배선 |

## 독립 검증(scope-critic) 반영

| 지적 | 판정 | 반영 |
|---|---|---|
| `logic.ts`에 `sortRows`·`SortKey`가 **남아 있다** — 헤더 주석은 "지웠다"고 말하는데 | 맞다. 주석이 거짓이었다 | 정의 제거(`nOf` 포함) · 미사용 import 정리 |
| LoL 상세에서 `llm`을 `rows.find(r => r.llm)?.llm`으로 **하나만** 골라 대상 단위 패널에 붙였다 — 한 지표의 문장이 전체를 대표하는 것처럼 읽힌다 | 맞다. 더 나쁜 것은 그 문장의 `summaryVerified`가 다른 지표에서 온 원인들의 신뢰도인 양 읽히는 것 | 요약을 **지표 구획으로 이동**(`MetricSection`), 대상 패널은 검토 시각 캡션만 |
| PUBG 원인 문장이 검증 실패 시에도 본문색일 수 있다 | 아니다 | `CausesPanel`이 `verified`·`confidence`로 회색을 이미 결정한다(세 게임 공용). TFT 상세도 **지표별** 패널이라 같은 왜곡이 없다 |
| 삭제 3파일 댕글링 참조 · LoL 라인 필터/토스트/커버리지 손실 · PUBG 잠수함 열/노이즈 제외 손실 · 직렬화 불가 prop | 전부 미해당 | — |
| 9슬롯: 앵커 생존 · 내용 손실 · 지어낸 수치 · `new Date()` 정적 export | 전부 미해당 | — |
| LLM 엔진: LoL·TFT 캐시 키 불변 · 선택 필드 충돌 · `deltas.json` 필드 보존 | 전부 미해당 | — |

## /verify-impl 축B(화면 대조) 반영 — **렌더로만 드러난 5건**

시안(`docs/design/prototype/*.html`) 대비 + **세 게임 교차 대조**. 코드 게이트는 전부 통과하고
있었고, 어떤 경우엔 주석이 사실과 반대로 적혀 있었다.

| ID | 지적 | 판정 | 반영 |
|---|---|---|---|
| V1 | LoL 브리핑 행이 `[아이콘][뱃지]이름` 순 — §8-1은 「뱃지 맨 앞」 | 맞다. **바로 위 주석이 "뱃지가 맨 앞"이라고 말하고 있었다** | 뱃지를 `summary`의 첫 자식으로. 세 게임 첫 행 실측: `공지 · 이상 관측 → ICON → 이름` 동일 |
| V2 | LoL 미공지 Gap에서 오공이 1행만 뜨고 나머지 지표 존재를 알리지 않음(TFT·PUBG는 늘 「N개 항목」) | 맞다 | `itemCount`(펼치면 실제로 나오는 줄 수) 추가 — LoL `1개 항목` · TFT `2개 항목` · PUBG `1개 항목` 실측 |
| V3 | PUBG 상세 머리에 유형·판정 뱃지·부제가 없고 이름이 3회 반복 | 맞다 | `titleAside`에 유형+뱃지, `lead`에 관측 한 줄. 스플래시 카드의 `eyebrow`/`title`/`verdict`는 **선택**으로 바꿔 중복 제거. 실측 머리: `RPD / 무기 · 경기관총 / 공지 / 42.3 → 43.1 획득 점유율 3.97% → 2.94% (-26.0%)` |
| V4 | 대조표 잠수함 표시 자리가 TFT(표 안) vs PUBG(표 아래 별도 카드)로 갈림 | 맞다 | **PUBG 대조표의 중복 섹션을 제거**했다. 전수 목록의 집은 세 게임 모두 **브리핑 「미공지 Gap」 탭 최상단**이고, 대조표에서는 「바뀐 것」 열이 말한다 |
| V5 | 「공지했는데 움직이지 않았다」를 LoL 브리핑만 말함 | 맞다 | `AnnouncedCoverageLine` 신설 — 세 게임 「패치 내용」 탭 맨 아래 같은 문구. **목록 범위를 맞추지 않고 사실을 맞췄다**(범위는 파서 해소율에 매인다 — LoL 181줄 전수 vs TFT·PUBG 부분) |

**재발 방지 게이트**(`screen-parity.test.ts` 4케이스 추가, 총 68):
뱃지가 아이콘보다 앞인지(소스 순서) · 「N개 항목」 존재 · 세 브리핑의 `AnnouncedCoverageLine` ·
세 상세의 `titleAside` 안 `StatusBadge`.

**축B가 스스로 정정한 오판 2건**(보고에 포함되지 않음, 기록만): "LoL 상세가 지표마다 노트대조·원인
섹션을 반복한다"(축소 썸네일 오독) · "PUBG 상세에 아이콘이 없다"(RPD·M9만 자산 부재, `ak47`은 정상).

## 구현 결정 (stub·보류·판단)

- **구 지표 경로를 별칭으로 살린다**: `output:'export'`라 런타임 리다이렉트가 없고 `vercel.json`
  정규식은 로컬 빌드로 검증할 수 없다. 반면 별칭 페이지는 **빌드가 증명한다**. 이미 디스코드로
  나간 링크(`itemHref(d.id)`)가 조용히 404가 되는 쪽이 정적 파일 137장보다 비싸다.
- **LLM 엔진을 넓히지 않고 좁혔다**: PUBG 델타를 태우려고 `DeltaMetric`·`DeltaEntityType` 유니온을
  넓히면 `METRIC_KIND`·`EFFECT_SIZE_FLOORS` 같은 전수 `Record`가 LoL이 읽지도 않을 칸을 갖는다.
  엔진이 실제로 보는 것이 `id`·`status`뿐이므로 `LlmDelta`로 **요구를 좁히고** 제네릭화했다.
  LoL·TFT 프로필은 기본 타입 인자로 그대로다(테스트 322건 무변경 통과).
- **섹션 순서는 뒤집지 않았다**: 사용자 확정(2026-09-21)과 출품 스크린샷이 이월 사유다. 대신
  「세 게임이 같은 순서」를 게이트로 고정했다. 뒤집기는 심사 종료 트리거를 가진 사용자 결정이다.
- **「기타 변경」은 데이터 차이로 종결**: 규칙은 이미 게임 중립(`classifyMiscNote`는 `PatchNoteItem`만
  받는다)이고, TFT 163줄에 해당 범주가 **0건**이다. 없는 묶음을 만들면 빈 카드가 남는다 —
  대신 생기면 실패하는 게이트를 뒀다.
- **PUBG 대조표에 q 열은 여전히 없다**: 그 판정이 효과크기 바닥 + Wilson CI 방식이라 q를 계산하지
  않는다. 없는 값을 빈칸으로 채우지 않는다(방법론이 그 사실을 말한다).

## 명세 변경으로 고친 테스트 (약화 아님 — 전부 사유 기록)

- `webhook.test.ts` 2건: 링크 단위가 **지표 → 대상**으로 바뀌었다(§8-7 #10). 퍼센트 인코딩
  금지라는 그 테스트의 요지는 그대로다.
- `logic.test.ts`: 상태 칩·정렬·검색·내비 묶기 describe가 `toolbarRules.test.ts`·`noteNav.test.ts`로
  **이사**했다. 제외 술어(의회 투표 줄) 게이트는 `lolNoteNavItems`로 이름만 바꿔 **유지**했다 —
  그것을 잃으면 그 줄이 내비에 되살아난다.
- `render.test.tsx`: `NoteNavigator` → `NoteNavPanel`. 검색창이 패널에서 빠진 것은 질의를
  도구모음이 소유하게 된 결과다(창이 둘이면 안 된다).
- `page-order.test.tsx`(PUBG): 카드 제목의 소유자가 화면 → 슬롯 registry로 바뀌어 기대 문자열을
  슬롯 제목으로 옮겼다. 재는 것은 여전히 **그 본문이 있는가**다.
- `panelScroll.test.ts`: 높이 규약을 재는 대상이 `CompareExplorer` → `CompareSplit`(세 게임 공용)로,
  `PANEL_SPLIT_BODY`도 통과시키도록(그 상수가 `PANEL_SCROLL_BODY`를 품는다).

## 미확인 사항

- **PUBG 원인 문장의 사실성**은 검증하지 않았다. 기계가 검증한 것은 **인용한 조항이 실재하는가**뿐이고
  (`verifyCauses`), 「제로섬 반사」라는 인과 자체는 모델의 주장이다. 신뢰도 등급과 회색 표기가 그
  한계를 표시하지만, 독립 검증은 아니다.
- TFT 미보유 자산 2건(`TFT18_Akali`·`DA_Artifact_Hullcrusher`)은 DDragon 카탈로그에 항목이 없다.
  다른 소스(CDragon)에 있는지는 확인하지 않았다.
- 렌더 검증은 **1440×900 한 뷰포트**다. 모바일 폭은 이번에 재지 않았다.
- 이 작업 전체가 **미커밋 상태**로 Phase 1 위에 쌓였다 — 하나의 diff가 세 단계를 겹친다.
