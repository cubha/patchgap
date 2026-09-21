# PLAN — 잠수함 패치 표시 계층 (F9 후속)

생성: 2026-09-21 · 소스: 세션 대화 + `memory/project_submarine_patch.md` + 아티팩트 시안
기준선 시안: https://claude.ai/artifact/B7YcCGkutJjuuhKyS199MM (6 아트보드 — `Inline`=B안 확정 · `Gap`=홈 두 갈래 · `Pubg`=0건)
선행 기준선: `docs/plan/PLAN-submarine-patch-2026-09-21.md` (검출 축. ST-9가 표시 요구를 담고 있다)

## 왜 이 계획이 생겼나 (요구사항 원문)

사용자가 배포된 TFT 대조표를 열고 물었다:

> "지금 잠수함패치 대상이 많은데, 어떤수치가 잠수함패치되엇는지 안보이는데?
>  내부에 들어가보면 실제 패치노트 패치된항목이나오는데 어떤내용이 잠수함패치라는거야?"

검출(PR #44)은 출하됐지만 **값이 홈에만 보인다.** 대조표는 배지만 찍고,
상세는 `row.submarineChanges`를 읽지도 않는다. PLAN ST-9가 요구한 세 가지
**「바뀐 것」 열 · 배지 · 로더** 중 배지·로더만 만들어졌다.

이어진 확정:

> "b안으로확정. tft도 미공지gap추가하는것까지 전건 진행할거니까"

## 요구사항

- **R1** 대조표에서 **어떤 수치가 바뀌었는지 화면만 보고 알 수 있어야 한다.** 세 게임 전부.
  엔티티당 여러 건이면 표에서는 "첫 건 외 N건", 전부는 상세에서.
- **R2** 상세 페이지에 잠수함 내용을 **B안**으로 넣는다 — 선언 카드를 「패치노트 대조」로
  바꾸고 그 안에 두 구획: 「패치노트가 말한 것」 / 「패치노트가 말하지 않은 것」.
  A안(별도 카드 신설) 기각 — 두 줄이 붙어 있어야 "말한 건 이건데 그럼 잠수함은 뭐냐"가
  질문이 되기 전에 닫힌다.
- **R3** 잠수함 전용 엔티티의 상세가 **404다**(실측: `unit~DA_18_ElderDragon`·`item~DA_18_BackrowStar`·
  `unit~DA_18_Sentry` 전부 404, `unit~DA_18_KhaZix` 200). 대조표가 이미 링크를 걸고 있으므로
  **지금 깨져 있는 상태**다. 경로 생성부터 넓힌다.
- **R4** 홈 「미공지 Gap」을 **두 갈래**로 분리한다 — 수치 축(잠수함)이 위, 지표 축(미공지)이 아래.
  이름 클릭으로 상세 이동.
- **R5** TFT에 「패치 내용 / 미공지 Gap」 **탭을 신설**한다. LoL·PUBG에는 이미 있다 —
  없는 쪽에 맞추지 않고 있는 쪽으로 통일한다.

## 확정 제약 (엄수)

- 판정 엔진 무수정: `MatchStatus` · `EFFECT_SIZE_FLOORS` 기존 값 · `verdict.ts` ·
  `pubg-delta.ts classify()`. 잠수함은 판정 상태가 아니라 표시 계층의 별도 축이다.
- 기존 판정 산출물·LLM 캐시 불변: `data/aggregated/{26.16,26.17,26.18,deltas,notes,pubg,tft}/**` ·
  `data/cache/llm/**`. 이 계획은 **표시 계층만** 건드린다(파이프라인 재실행 없음).
- **판정 기준만 동일**(사용자 정정): "게임별로 넘어오는포멧도다르고 정보도 상이하니
  판정기준만 동일하게하라는말이야". 게이트 무관 전량 노출 + 배지 1종이 그 기준이고,
  **표현 포맷은 게임마다 달라도 된다.**
- `any` 금지. 미구현은 `throw new Error("TODO(...)")`. 디자인 토큰 Ground Truth.
- `docs/design/prototype/*.html` 소급 수정 금지(2026-09-05 고정).
- `git add -A` 금지 — 스크린샷·`*.notify.json`·`scratch.md.precompact-backup-*`·`*.png` 영구 제외.
- `--no-verify` 금지. 심사 기간(~10/5) 중 `collect.yml`(LoL) 무수정.

## 제외 합의 (요청 범위지만 하지 않기로 한 것)

- **X1. LoL 상세 경로는 넓히지 않는다.** R3은 TFT에만 적용한다.
  근거 셋: ① LoL 잠수함은 **1건**(`item 3095 폭풍갈퀴 가격 3000→3200`)이고 그 쌍
  `26.16_26.17`은 **기본 패치쌍이 아니다**(`getDefaultPair()` = 최신 = `26.17_26.18`, 잠수함 0건).
  ② 실측 `deltas/26.16_26.17.json`에 `entityKey=3095` 행이 **0개**다.
  ③ `/lol/item/[id]`는 페이지 전체가 `DeltaRecord` 전제로 서 있다(`findDeltaForId` →
  `delta.metric` · `buildChartData` · `StatsGatePanel` · `SourceMatchesPanel`). 델타 없는
  엔티티에 이 라우트를 주려면 합성 레코드를 지어내야 하고, 그것은 "무근거 문장은 회색" 원칙 위반이다.
  `DeltaTable.tsx`는 이미 그 판단을 코드 주석으로 들고 있다(잠수함 전용 행은 이름을 링크 없이 그린다).
  **LoL에서는 「바뀐 것」 열이 답이다** — 갈 곳이 없으므로 표에서 값을 끝까지 말한다.
- **X2. PUBG 상세 경로도 손대지 않는다.** `generateStaticParams`가 `after.weapons` 전량을
  돌므로 404가 원리적으로 없고, 42.3→43.1 잠수함은 0건이다.
- **X3. 히어로 3타일 공용 컴포넌트 추출은 이번 범위 밖이다**(마크업이 세 게임에 복제돼 있다 —
  타일을 건드릴 일이 생기면 그때 선행).
- **X4. 파이프라인·산출물 재생성 없음.** 표시만 바꾼다.

## SubTask

| ID | 내용 | 대상 파일 |
|---|---|---|
| **ST-1** `[TDD]` | **TFT 상세 경로 확장** — `buildTftEntityRows`에 submarine 색인을 물려 잠수함 전용 엔티티도 경로·메타·본문을 갖게 한다. 호출부가 **3곳**이다(`generateStaticParams`·`generateMetadata`·`TftUnitPage`) — 하나만 고치면 빌드는 초록인데 본문이 "보고할 관측이 없는 엔티티다"로 뜬다 | `src/app/tft/unit/[key]/page.tsx` · `src/components/tft/__tests__/entityRows.test.ts` |
| **ST-2** `[TDD]` | **「바뀐 것」 셀 텍스트 순수 함수** — `첫 건 + 외 N건`. **`gameDataValue`를 함수 안에서 호출**해 호출부가 원본 float를 넘길 방법을 없앤다(float32 잡음 재발 차단) | `src/components/gamedata/submarineText.ts` (신설, 최초 이름 `submarineCell.ts` — 컴포넌트 `SubmarineCell.tsx`와 대소문자만 다른 충돌로 개명) + `__tests__` |
| **ST-3** | **대조표 3종에 「바뀐 것」 열** 렌더 | `src/components/compare/DeltaTable.tsx` · `src/app/tft/compare/page.tsx` · `src/components/pubg/PubgCompareTable.tsx` |
| **ST-4** | **「패치노트가 말하지 않은 것」 공용 구획** 컴포넌트 — 세 게임이 각자 카드에 꽂는다(포맷은 달라도 판정 기준은 같다) | `src/components/gamedata/SubmarineDetailBlock.tsx` (신설) |
| **ST-5** | **B안 — TFT 상세** 선언 카드를 「패치노트 대조」로, 두 구획 | `src/app/tft/unit/[key]/page.tsx` |
| **ST-6** | **B안 — LoL 상세** 이미 제목이 「패치노트 대조」다. 그 카드 안에 두 번째 구획을 넣는다 | `src/app/lol/item/[id]/page.tsx` · `src/components/item/NoteContrastPanel.tsx` |
| **ST-7** | **B안 — PUBG 상세** 「패치노트 대조」 카드 신설(현재 선언 카드가 없다 — 노트가 판정 줄에만 있다) | `src/app/pubg/weapon/[key]/page.tsx` |
| **ST-8** | **홈 미공지 Gap 두 갈래** — 수치 축 위, 지표 축 아래 + 이름 클릭 → 상세 | `src/app/tft/page.tsx` · `src/app/lol/page.tsx` · `src/app/pubg/page.tsx` · `src/components/gamedata/SubmarineSection.tsx` |
| **ST-9** | **TFT 탭 신설** 「패치 내용 / 미공지 Gap」 | `src/app/tft/page.tsx` · `src/components/tft/TftBriefingTabs.tsx` (신설) |

## 실행 순서 · 라우팅

전량 **`[S]` 인라인 순차**. `[P]` 위임하지 않는 이유: ST-1/ST-5가 같은
`tft/unit/[key]/page.tsx`를, ST-8/ST-9가 같은 `tft/page.tsx`를 고친다 — worktree 병렬은
merge 충돌만 산다(impl-handoff §5 독립 파일 요건 미충족).

순서: **ST-1(깨진 링크 먼저) → ST-2 → ST-3 → ST-4 → ST-5·6·7 → ST-8 → ST-9.**
ST-9를 마지막에 두는 이유: `tft/page.tsx`의 가장 큰 구조 변경인데 사용자 지적과의 거리가 가장 멀다.

## 수용 기준

1. `unit~DA_18_ElderDragon` · `item~DA_18_BackrowStar` · `unit~DA_18_Sentry`가 **200**이고,
   본문에 「패치노트가 말하지 않은 것」 구획과 실제 수치(`공격력 110 → 125`)가 있다.
   (경로만 생기고 본문이 "보고할 관측이 없는 엔티티다"면 **미충족**이다.)
2. TFT 대조표 잠수함 행에 **바뀐 수치가 셀로** 보인다. 여러 건이면 "첫 건 외 N건".
3. 세 게임 어디에서도 `0.800000011920929` 같은 float32 잡음이 렌더되지 않는다.
4. TFT 홈에 「패치 내용 / 미공지 Gap」 탭이 있고, Gap 탭 안에서 수치 축이 지표 축 위에 온다.
5. `bash verify.sh --full` 통과. 기존 판정 산출물·LLM 캐시 diff **0**.

## 검증 축 문구 (Phase 3 비평가에게 그대로 준다)

`feedback_verification_asks_wrong_question.md`의 처방을 여기서 쓴다 — 속성이 아니라 목적을 묻고,
기준선 항목명을 요약하지 않고 그대로 옮긴다.

- 축B(화면): **"이 행이 어떤 수치의 변경인지 화면만 보고 아는가"** — 화면마다.
  「B안이 적용됐는가」로 쓰지 않는다(그건 또 속성이다).
- 축A(코드): PLAN ST-9의 세 항목을 **원문 그대로** — 「바뀐 것」 열 · 배지 · 로더.

## 구현 후 실측 (2026-09-21)

- TFT 상세 라우트 **114건** 생성(이전 93건). `unit~DA_18_ElderDragon`·`item~DA_18_BackrowStar`·
  `unit~DA_18_Sentry` 전부 200이고 본문에 「패치노트가 말하지 않은 것」 3건(`공격력 110 → 125` 등)이 있다.
- TFT 대조표에 「바뀐 것」 열이 렌더된다. 드레이븐은 `공격 속도 0.8 → 0.85 외 1건` —
  float32 잡음(`0.800000011920929`)이 산출물 HTML 어디에도 없다.
- 홈 탭 배지: TFT `패치 내용 49 / 미공지 Gap 126`(= 지표 축 89 + 수치 축 37),
  PUBG `2 / 5`, LoL `146 / 29`. 세 게임 모두 Gap 탭 안에서 수치 축이 지표 축 위에 온다.
- `bash verify.sh --full` 전 항목 통과. `data/` 산출물 diff **0건**.

### 재판정 반영 (acceptance-critic V1)

첫 구현은 세 게임에 똑같이 "첫 건 외 N건"을 걸었다. 그런데 **"외 N건"은 나머지를 상세에서
본다는 약속**이고, X1에 따라 LoL 잠수함 전용 행에는 그 상세가 없다 — 갈 곳 없는 약속이 된다.
X1 원문("갈 곳이 없으므로 표에서 값을 끝까지 말한다")과 어긋났다.

수정: `SubmarineCell`에 `collapsible`을 두고 LoL 대조표가 `row.representative !== null`
(= 델타가 있어 상세로 갈 수 있는 행인가)로 넘긴다. 갈 곳 없는 행은 전부 나열한다.
지금 LoL 잠수함은 1건이라 접든 안 접든 화면이 같다 — **그건 데이터의 우연이지 설계 근거가
아니다**([[feedback_structural_caps_not_current_data]]).

### 알아둘 것 — LoL 수치 축은 현재 화면에서 안 보인다

LoL 잠수함 1건(`폭풍갈퀴 가격 3000→3200`)은 쌍 `26.16_26.17`에 있는데, 홈·대조표는
`getDefaultPair()`(= 최신 = `26.17_26.18`)만 그린다. 그 쌍의 잠수함은 0건이다.
그래서 LoL의 「바뀐 것」 열과 상세 구획은 **구조만 서 있고 현재 데이터로는 비어 있다**
(0건 문장은 그대로 나온다). 다음 패치에서 LoL 잠수함이 잡히면 코드 수정 없이 보인다.
이것은 이번 작업의 누락이 아니라 **패치쌍 선택 규칙의 성질**이며, 바꾸려면 홈·대조표에
쌍 선택을 넣는 별개 작업이 필요하다(범위 밖).

## 후속 (2026-09-21, 사용자 승인 "응 진행해")

기준선이 늘었다 — **수치 축은 두 갈래다.** R1~R5는 「잠수함 = 짝 없음」 하나만 전제했는데,
전수 검증(`VERIFY-tft-submarine-2026-09-21.md`)이 세 번째 자리를 찾았다.

- **R6. 공지값 불일치를 잠수함과 가른다.** 노트가 같은 항목을 **이름으로** 말했는데 적힌 값이
  실제와 다르면 `GameDataChange.noteMismatch`가 찬다. 견줄 수 있을 때만 견준다(숫자 토큰 1개·
  `%` 비율 환산·값 맞는 노트 우선). 잠수함과 배타적이다.
- **R7. 불일치 엔티티도 행을 만든다.** 잠수함 전용 행과 **같은 규칙**이다. 실측이 그 극단이라
  강제했다 — 덩굴정령·어미 부리는 PvE 몬스터라 플레이어 보드 델타가 **0건**이고, 행을 새로
  만들지 않으면 두 발견이 화면 어디에도 안 뜬다.
- **R8. 노트 카탈로그를 CDragon으로 보강한다.** DDragon `tft-champion.json`에 없는 엔티티가
  노트 179줄 중 60줄을 버리게 하고 있었다. 미해소 60 → 16줄.

### X1은 그대로다 — 다만 이유가 하나 늘었다

LoL 상세 경로는 여전히 넓히지 않는다. 불일치는 LoL에서 **0건**이고(재생성 확인), 구조는
`SubmarineCell`·`SubmarineDetailBlock`·`buildEntityRows`에 세 게임 공통으로 깔려 있어
다음 패치에서 잡히면 코드 수정 없이 보인다.

### 구현 후 실측 (후속분)

- TFT 잠수함 33 → **31건**(대상 27 → 25종) · 공지값 불일치 **2건**. 새로 잠수함이 된 것 0건.
- 노트 항목 119 → 163 · 미해소 60 → 16 · 해소율 66.5% → **91.1%**.
- `bash verify.sh --full` 전 항목 통과(Spec·tsc·eslint·vitest 1453·빌드·design-lint).

### 새로 생긴 하드 의존과 그 해소 — R9

`run-tft-notes`는 이제 **같은 세트의 CDragon 추출본이 없으면 던진다**. 조용히 DDragon만으로
돌면 노트 대상 해소율이 91% → 66%로 떨어진 채 초록으로 지나가기 때문에 일부러 시끄럽게 실패한다.

그런데 **이 저장소에 CDragon 수집 스크립트가 없었다** — `data/cdragon/{16.17,16.18}`은 파이프라인
밖에서 만들어져 커밋된 것이었다(`grep -ri communitydragon` 결과 0건). 그대로 두면 패치마다
사람이 손으로 스냅숏을 늘려야 하고, Set 19에서 일일 cron이 노트 단계에서 멈춘다.

- **R9. 스냅숏을 파이프라인 안에서 만든다.** `scripts/run-cdragon.ts` + 순수 추출기
  `src/pipeline/gamedata/cdragon.ts`. 원본 23.4MB → 316KB(유닛 91 · 아이템 2,719).
  `collect-tft.yml`이 **노트 파싱 앞에서** 매 패치 받고, `data/cdragon`을 함께 커밋한다
  (안 하면 다음 패치의 "전 버전" 짝이 사라진다). DDragon(`run-ddragon.ts`)과 같은 모델이다.

**추출 규칙은 지어내지 않고 역산했다.** 커밋돼 있던 두 스냅숏을 **키 순서까지 그대로 재현**하는
것을 합격 기준으로 삼았고, 그 과정에서 규칙 두 개가 드러났다:
① 아이템은 **숫자 effect가 하나라도 있는 것만**(16.18 기준 2,737 → 2,719 — 18개가 `{"Gold": null}`
같은 자리표시자였다) ② 값이 `null`인 스탯은 **키째 버린다**(협곡 바위 게 `hp`). ②를 빠뜨리면
`diffValueMap`이 "한쪽에만 있는 키도 변경"으로 읽어 다음 패치에 **허위 잠수함**이 생긴다.

기존 두 파일은 Python으로 만들어져 `40.0` 형태였다 — 재생성해 정규화했고(354KB → 344KB),
`JSON.parse` 후 완전 동일함을 확인했다. 재생성 후 `18.1_18.2.json`·`notes-18.2.json` **차이 0**.
