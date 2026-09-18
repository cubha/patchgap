# PLAN — Gap 표시원칙 통일(PUBG↔LoL) + LoL 표기 정밀화

- 생성: 2026-09-17 · 기준 HEAD: 4610f67
- 소스: 사용자 지시 원문(아래 §1) + 승인 아티팩트 「PUBG 테마 시안」 2차 개정
  (https://claude.ai/artifact/CXqUtUXTXyfmDHH8gnUMys) §4
- 성격: 두 트랙 병렬(A=PUBG 표시원칙·상세화면, B=LoL 표기 정밀화). 사용자가 "위 내용과
  병렬로수행"을 명시했다.

---

## §1 요구사항 (사용자 요청 원문 — 요약·의미 추가 금지)

> 배틀그라운드의 gap 표시원칙을 리그오브레전드와 동일하게 변경해줘
> 1. 패치내용을 메인으로 우선 표시
> 2. 미공지 gap을 추가탭으로 전환하여 표시
> 3. 표본 성격이 LoL과 다릅니다 --> 이 섹션은 불필요함. 시스템을 이용하는 사용자 입장에서
>    불필요한 부분 제거 (이미 방법론 메뉴존재. 필요하면 이곳으로 이관)
> 4. 총기류, 맵류의 상세화면 전환 및 스플레시아트 디자인이 누락됨. 보완진행
>
> 추가로 리그오브레전드 관련 아래내용 확인/수정 진행해줘 (위 내용과 병렬로수행)
> 1. 첫번째 첨부이미지처럼 동일한 스킬, 아이템, .. 등에 대한 변경내용은 인라인으로 표시하도록
>    표시변경 (현재는 동일한 스킬의 쿨타임, 데미지, ... 등 변환이 전부 개별건으로 표시됨)
> 2. 미공지 Gap 탭의 데이터와 노트에 없는 파급효과/간접 영향 섹션의 데이터가 동일한 목적으로
>    보이는데 다른영역에 별도로 표기되니 혼돈됨. 실제 두개가 동일한 성격인지, 다른내용인지
>    판별 후 통일 또는 명확하게 구분
> 3. 아직도 3% 미만의 미비한 변화내용 표기됨. 확인필요
> 4. 두번째 첨부이미지(홀오브리그오브레전드) 내용은 일반 패치, 업데이트 내용임. 신규 스킨 등에
>    대한 내용이니 관측 불필요 --> 뱃지 제거 및 신규스킨이나 챔피언, 아이템 등 패치내용을
>    간략하게 정보 및 이미지를 볼 수 있도록 개선 가능한지 여부 확인
> 5. 미공지 Gap의 데이터가 대부분 근거 미확인으로 표시됨 --> 추정 LLM 기능점검 및 모델상향 검토

요구사항 ID: **A1~A4**(PUBG), **B1~B5**(LoL). 위 번호와 1:1.

---

## §2 착수 전 실측 (추측 아님 — 전부 이번 세션에서 측정한 값)

### 2-1. B5 근본원인 — 모델 문제가 아니다

`champion:Qiyana:banRate` 류 zero-cause 행의 캐시 키를 직접 재계산해
(`cacheKeyFor(LLM_MODEL, PROMPT_VERSION, deltaId, candidateSetHash)`) `data/cache/llm/`를
대조한 결과, 26.17→26.18 미공지 47건의 내역이 **3개 원인으로 갈렸다**:

| 실측 구분 | 건수 | 의미 | 처방 |
|---|---|---|---|
| 캐시 부재(호출 자체 없음) | 14 | 상한 밖 또는 CI 콜드캐시 | 상한·캐시(모델 무관) |
| `causes: []`(LLM이 정직하게 "후보 없음") | 22 | 결함 아님 | **카피** |
| 캐시엔 후보가 있는데 현재 델타엔 0건 | 6 | 재실행 비결정성 | 캐시 보존 |
| 정상 보존 | 5 | — | — |

추가 실측:
- `data/aggregated/deltas/26.17_26.18.json` `meta.llm` = `calls: 50, cacheHits: 0`.
  **캐시 히트가 0인데 신규 캐시 파일도 0건**(`data/cache/llm/` mtime 분포: 09-06 50건 ·
  09-13 77건 · **09-16 0건**).
- 그 파일의 커밋은 `cde398d chore(data): auto-collect 26.17 -> 26.18` = **CI 실행**.
  `.github/workflows/collect.yml`의 `actions/cache@v4`는 **`data/raw`만** 보존하고
  `data/cache/llm`은 보존하지 않는다 → **CI는 매 실행 콜드캐시**이고, 로컬이 이미 답을 갖고
  있는 델타에도 예산을 다시 쓴 뒤 그 결과를 버린다.
- LLM 대상 후보는 113건(미공지 47 + 간접 2 + 공지-불일치 64)인데 `llm_max` 기본값은 **50**.
- 신뢰도 분포(캐시 127건 전수): `low 128 · medium 29 · high 0`. `meetsIndirectEffectConfidence`
  게이트를 통과한 건 최종 2건뿐.
- 미공지 상위는 대부분 **밴률**(Camille·Qiyana·Lulu·Locke·Yunara·Zoe·Poppy). 밴률 이동은
  메타·인기도 기인이라 패치노트 원인이 **정상적으로 없을 수 있다** — 이 22건에 대해
  "근거 미확인"은 시스템 실패가 아니라 정직한 관측이다. **문구가 그것을 구분하지 못하는 것이
  결함이다.**

> `LLM_MODEL = "claude-sonnet-5"`은 CLAUDE.md §기술 스택 **고정값**이다. 이 PLAN은 모델을
> 바꾸지 않는다 — B5의 "모델상향 검토"는 **동일 deltaId에 대한 A/B 실측치를 산출해 보고**하는
> 것까지가 범위이고, 채택 여부는 사용자 결정(SCOPE 선행 갱신 필요).

### 2-2. B1 — 그룹핑 키 함정

26.18 노트 181건 중 **같은 `entity|skill` 조합이 2줄 이상인 그룹 24개**
(카시오페아 `E - 쌍독니` 5줄 = 첨부 이미지 그대로, 피오라 `Q - 냉기 폭발` 4줄 …).
단 `의회 - 투표 1 결과`는 **section=champion이면서 skill=null이 34줄** — 순진한
`groupBy(note.skill)`은 이 34줄을 한 행으로 뭉갠다. **null은 절대 그룹핑하지 않는다.**

### 2-3. B3 — 비대칭이 결함이다

`selectEntityObservation()`에는 유의성·효과크기 게이트가 없다. 그런데 호출부 두 갈래의 입력
성질이 다르다:
- **미공지 카드**: 행이 이미 `meetsEffectFloor`를 통과한 것만 `unannounced`가 된다 → 게이트됨
- **공지 카드(matched)**: 게이트 없음 → 첨부 이미지의 `카시오페아 승률 -0.6%p CI ±9.2 q=1`이
  카드 대표 관측으로 올라간다(승률 바닥 2%p 미달 + q=1 = 유의하지 않음)

→ 게이트는 **matched 경로에만** 건다. 전역으로 걸면 Gap 탭이 조용히 바뀐다.
(선행 이력: 2026-09-13 `EFFECT_SIZE_FLOORS` 도입은 **판정(status)** 축이었고 화면 표기 축은
건드리지 않았다 — 그래서 사용자 눈에 "아직도"로 남았다.)

### 2-4. B4 — 분류 폭을 좁힌다

`stat === null && direction === "unknown"`은 **84/181(46%)**을 잡는데 그 안에는 `증강`(25) ·
`버그 수정`(7+4) · `의회 - 투표 1 결과`(34)가 들어 있다 — 이들은 **지표가 원리적으로 없는 게
아니라 파싱되지 않은 것**이라 "관측 보류"가 맞는 서술이다. 사용자가 지목한 것은 스킨·크로마·
테두리·아이콘 같은 **치장 항목**이다. 엔티티 기준(`홀 오브 레전드` 10 · `앞으로 나올 스킨 및
크로마` 2 · `클래식` 1)으로 **13건**, 키워드 기준으로 12건 — 이 좁은 쪽을 채택한다.

### 2-5. A4 — 자산·데이터 가용성 (실측)

- 무기: `data/aggregated/pubg/weapons-{42.3,43.1}.json` 47종 + `deltas.json` 47행 — **보유**
- 맵: 집계 없음. 단 `data/raw/pubg/matches/*.json` 10,556건 전부 `attributes.mapName` 보유 →
  **재수집 0으로 신규 집계 가능**. 실측 분포: Baltic 3,948 · Tiger 2,137 · Range 1,707 ·
  Savage 707 · Desert 650 · Neon 596 · Summerland 316 · DihorOtok 199 · Chimera 187 · Kiki 109
  (10종). `Range_Main`(Camp Jackal, 평균 539초)은 정식 매치가 아니므로 **집계에서 제외**한다.
- 자산: `pubg/api-assets` 실측 도달 확인 — 무기 `Assets/Item/Weapon/Main/{key}.png` 200,
  맵 `Assets/Maps/{표시명}_Main_No_Text_Low_Res.png` 200,
  `dictionaries/telemetry/mapName.json` 200(텔레메트리 키→표시명 사전).
  ⚠️ 맵 파일명은 **텔레메트리 키가 아니라 표시명** 기준이다(`Baltic_Main_*.png`는 404,
  `Erangel_Main_*.png`가 200) — 사전을 반드시 경유한다.
- 승인 아티팩트 첨부 자산은 AK47·에란겔 2장뿐 → 나머지는 **빌드 타임 다운로드**로 조달한다
  (`public/dd/`가 Data Dragon에 쓰는 것과 같은 선례 · 런타임 외부 호출 0 원칙 유지).

---

## §3 판별 결과 (B2 — 사용자가 "판별 후"를 요구한 항목)

**두 섹션은 같은 뿌리에서 갈라진 배타적 상태다.**

- 파이프라인 순서: `verdict.assignStatus`가 "짝 없음 + 유의 + 효과크기 바닥 통과"를
  `unannounced`로 확정 → 그 다음 `reclassifyIndirectEffects`가 **`unannounced`만 대상으로**
  LLM 원인이 `meetsIndirectEffectConfidence`를 넘으면 `indirect-effect`로 **재분류**한다.
- 즉 `indirect-effect` ⊂ (원래 `unannounced`). 두 상태는 **동시에 성립할 수 없고**, 차이는
  단 하나 — **원인이 규명됐는가**.
- 실측 규모: 미공지 47 · 간접 2.

→ **판정: 동일 성격이다.** 따라서 "통일"을 택한다. `노트에 없는 변화`는 **Gap 탭 한 곳**에
모으고, 그 안에서 `원인 규명됨`(인과 체인 표시) / `원인 미규명`(관측만) 두 구간으로 나눈다.
홈 하단의 별도 `간접 영향` 섹션은 **제거**한다. 인과 체인 렌더(`관측 ← [섹션] 원인`)는 버리지
않고 Gap 행 안으로 이식한다.

⚠️ 카운트 정합: `computeHeadline.unannouncedCount`는 **히어로 타일 · 탭 배지 · 목록 길이**
3곳이 공유한다(PLAN-home-tab-split-intro-fix-2026-09-14.md "카운트 배지 소스"). 47→49는
**셋 다 바뀌거나 셋 다 안 바뀌어야 한다.**

---

## §4 SubTask

### 트랙 A — PUBG (A1~A4)

| ID | 내용 | 대상 파일 | 요구 |
|---|---|---|---|
| ST-A1 | 브리핑을 `패치 내용`(공지 대조) 메인 + `미공지 Gap` 탭으로 재구성. 현재는 발견(미공지)이 대조(공지) **위**에 있다 — 순서를 뒤집고 탭으로 전환. 탭 시맨틱은 `ReleaseNoteStream`/`NoteNavigator` 기존 패턴 재사용(`role=tablist/tab`, `aria-selected`, `aria-controls` 미사용) | `src/components/pubg/PubgBriefingTabs.tsx`(신규, client) · `src/app/pubg/page.tsx` | A1·A2 |
| ST-A2 | `PubgSampleNotice`를 브리핑·대조표에서 제거하고 **방법론에만** 남긴다(이미 렌더 중 — `src/app/pubg/methodology/page.tsx:67`). 기준선 `PLAN-pubg-gate-2026-09-16.md` §9-2 R5("어느 화면에 들어와도 표본 성격 고지가 붙어야") **갱신 필수** | `src/components/pubg/shared.tsx` · `src/app/pubg/{page,compare/page}.tsx` · `docs/plan/PLAN-pubg-gate-2026-09-16.md` | A3 · **2026-09-18 라운드5 추기**: 표본·기저·게이트 카드 3장은 결과(탭) **아래**로 이동, 표 머리 캡션은 정규화 사실+매치 수만(표본 *성격* 고지는 여전히 방법론에만) |
| ST-A3 | 맵 집계 신설(순수 함수, 부수효과 0) — `mapName`별 매치수·평균 소요·봇 비율·무기 점유율 상위. 42.3/43.1 양쪽 산출 + 델타 | `src/pipeline/aggregate/pubg-maps.ts` + `__tests__` · `scripts/run-pubg-maps.ts` · `data/aggregated/pubg/maps-*.json` | A4 |
| ST-A4 | 자산 조달 스크립트 — `pubg/api-assets`에서 무기 47 + 맵 9종 렌더를 **빌드 타임** 내려받아 `public/pubg/`에 둔다. `mapName.json` 사전 경유. 자산 없는 엔티티는 **설계된 폴백 상태**(깨진 `<img>` 금지) | `scripts/run-pubg-assets.ts` · `src/pipeline/pubg/asset-path.ts` + `__tests__` | A4 |
| ST-A5 | 상세 라우트 `/pubg/weapon/[key]/` · `/pubg/map/[key]/` + 시안 §4 스플래시 카드(`.detail-card`/`.detail-splash`/`.detail-tint`/`.detail-body`/`.detail-verdict`) 이식. `generateStaticParams`(output:'export'). 대조표·브리핑 행에서 진입 링크 | `src/app/pubg/weapon/[key]/page.tsx` · `src/app/pubg/map/[key]/page.tsx` · `src/components/pubg/PubgDetailSplash.tsx` | A4 |

### 트랙 B — LoL (B1~B5)

| ID | 내용 | 대상 파일 | 요구 |
|---|---|---|---|
| ST-B1 | 같은 `entity|skill` 노트를 **한 행 + 스탯 인라인 다줄**로 묶는다. **`skill === null`은 그룹핑하지 않는다**(의회 34줄 함정). 뱃지 단위 결정을 주석으로 명시 | `src/components/home/noteSkillGroups.ts`(신규) + `__tests__` · `ReleaseNoteRow.tsx` | B1 |
| ST-B2 | §3 판정에 따라 간접 영향을 Gap 탭으로 통합. `IndirectEffectPanel` 제거, 인과 체인은 Gap 행으로 이식. 카운트 3곳 동시 갱신 | `releaseStream.ts` · `ReleaseNoteStream.tsx` · `ReleaseNoteRow.tsx` · `logic.ts` · `src/app/page.tsx` | B2 |
| ST-B3 | matched 카드 대표 관측에 **유의성 + 효과크기 바닥** 게이트. 미달이면 발견처럼 제시하지 않는다(회색 "유의차 없음" 처리). Gap 경로는 불변 | `streamVerdict.ts` · `ReleaseNoteRow.tsx` | B3 |
| ST-B4 | 치장 노트(§2-4 좁은 분류) → **뱃지 제거** + 치장 전용 표기. 두 번째 요구("이미지로 볼 수 있는지")는 **가능 여부 판정 리포트**를 산출물로 낸다(무단 구현·무단 생략 금지) | `src/pipeline/shared/cosmetic-note.ts`(신규) + `__tests__` · `ReleaseNoteRow.tsx` | B4 |
| ST-B5 | ① CI가 `data/cache/llm`을 보존하도록 `actions/cache` 추가 ② `llm_max` 기본 50→전수(113 커버) ③ **상태 3분 카피**: `미검토`(호출 안 됨) / `후보 없음`(LLM 검토 완료·정상) / `후보 있음` — 지금은 셋이 전부 "근거 미확인"으로 같아 보인다 ④ 동일 deltaId 모델 A/B 실측 **리포트만** 산출 | `.github/workflows/collect.yml` · `src/pipeline/types.ts` · `home/logic.ts` · `ReleaseNoteRow.tsx` · `docs/plan/LLM-AB-2026-09-17.md` | B5 |

| ST-B6 | **치장 항목 스킨 미리보기**(X3 해제, 2026-09-18). ① Data Dragon 챔피언 상세에서 스킨 인덱스(`championId`·`num`·`koName`) 생성 ② 치장 노트 요약문에 **글자 그대로 등장하는** 스킨명을 최장 일치로 매칭(추측 금지) ③ 매칭된 스킨의 스플래시만 빌드 타임 다운로드 ④ 치장 행에 썸네일 + **매칭된 스킨명** 표기. 못 잡은 줄은 이미지 없이 그대로 둔다 | `src/pipeline/shared/cosmetic-skin.ts` + `__tests__` · `scripts/run-ddragon.ts` · `data/aggregated/skin-index.json` · `src/components/home/CosmeticSkinPreview.tsx` · `ReleaseNoteRow.tsx` | B4 후반부 |

**순서 제약**: ST-B1·B2·B3·B4는 전부 `ReleaseNoteRow.tsx`를 만진다 → **직렬 1패스**로 처리한다
(병렬 금지). ST-A3·A4는 서로 독립이며 즉시 착수 가능.

---

## §5 제외 합의 (요청했으나 이번에 하지 않는 것 — 허위 누락 판정 방지)

- **X1. 시안 §4의 `장비` 탭**: 사용자 지시는 "총기류, 맵류"다. 방어구 파밍 확률·평균 생존시간
  축은 **텔레메트리 재수집이 필요**하고 42.3 보존창은 2026-09-22에 닫힌다. 시안 §4는
  **의도적으로 부분 구현**이며, 무기·맵 2탭만 낸다.
- **X2. `LLM_MODEL` 상수 변경**: 고정 스택값. B5는 **측정·보고까지**가 범위이고 채택은 사용자
  결정(SCOPE 선행 갱신 필요).
- ~~**X3. B4의 이미지 표시 구현**~~ → **2026-09-18 제외 해제**. 가능여부 판정을 받은 사용자가
  "홀 오브 레전드 **가능한범위내에서 이미지 등 간략정보제공 기능추가진행**"을 지시했다.
  ST-B6으로 편입한다(아래 §4 트랙 B). "가능한 범위"의 실체 = **스킨만**이다 —
  크로마·아이콘·와드·휘장·칭호·정수는 Data Dragon 배포 범위 밖이라 어떤 구현으로도 이미지가
  나오지 않는다(판정 근거: `docs/plan/COSMETIC-SPLASH-FEASIBILITY-2026-09-17.md`).
- **X4. `EFFECT_SIZE_FLOORS` 값 재조정**: B3는 **표기 축** 결함이다. 판정 축 바닥값은
  2026-09-13/14에 실측으로 확정된 것이라 건드리지 않는다.
- **X5. PUBG 패치노트 파서**: 43.1 노트는 수기 입력 유지(PLAN-pubg-gate 기존 합의).
- **X6. `harvest.py`/`telemetry.py`**: 맵 집계는 **이미 받아 둔** `data/raw/pubg/matches/*`만
  읽는다 — 수집 계층 무변경.

---

## §6 완료 조건

1. `bash verify.sh --full` PASS (tsc · eslint --max-warnings 0 · vitest · build · design-lint)
2. A1·A2: `/pubg/`가 공지 대조를 먼저 보여주고 미공지는 탭 뒤에 있다
3. A3: `/pubg/`·`/pubg/compare/`에 표본 성격 패널 0개, `/pubg/methodology/`에 1개
4. A4: `/pubg/weapon/{key}/`·`/pubg/map/{key}/`가 정적 생성되고 스플래시가 렌더된다
5. B1: 카시오페아 `E - 쌍독니` 5줄이 **1행 5스탯**으로, 의회 34줄은 **34행 그대로**
6. B2: 홈에 "간접 영향" 별도 섹션 0개, Gap 탭이 49건(47+2)이며 타일·배지·목록이 일치
7. B3: 공지 카드에서 바닥·유의 미달 관측이 발견처럼 제시되지 않는다
8. B4: 치장 노트에 뱃지 0개 + 가능여부 판정 리포트 존재
9. B5: CI 캐시 보존 배선 + 상태 3분 표기 + A/B 리포트 존재
10. B6: `홀 오브 레전드` 카드에서 스킨명이 명시된 줄에 썸네일이 뜨고, 자산이 없는 줄
    (크로마·아이콘·와드·휘장·칭호·정수)은 **이미지 없이** 그대로 남는다 — 다른 이미지를
    가져다 채우지 않는다

---

## §7 완료 실측 (2026-09-17, 정적 빌드 `out/` 실측 — 추정 아님)

게이트: Spec ✅ · tsc ✅ · eslint(--max-warnings 0) ✅ · vitest **782/782** ✅ · build ✅ ·
design-lint ✅. (첫 `verify.sh --full`에서 vitest 워커 기동 타임아웃 1건이 났으나 코드 실패가
아니라 러너 자원 경합이었다 — 단독 재실행에서 `smoke.test.ts` 통과, 전체 재실행 782/782 통과.)

| 요구 | 실측 |
|---|---|
| A1·A2 | `/pubg/` 탭 = `패치 내용 2`(aria-selected **true**) · `미공지 Gap 5`. 기본 탭 본문이 "공지된 변경은 실제로 그렇게 됐나" |
| A3 | `/pubg/`·`/pubg/compare/` 표본 고지 **0개**, `/pubg/methodology/` 1개 |
| A4 | 무기 라우트 **47** · 맵 라우트 **9** 정적 생성. `/pubg/weapon/ak47/` 렌더 200 · `/pubg/map/baltic/` 렌더 200 · **`/pubg/weapon/rpd/`는 폴백**(공식 자산 미보유 9종 중 하나, 문구로 명시) |
| B1 | 카시오페아 카드 **4행 / 뱃지 4개**(행당 1개), 그중 `E - 쌍독니` 1행에 **스탯 5줄 인라인**. 의회 34줄은 **34행 유지**(병합 함정 회피 확인) |
| B2 | 히어로 타일 **49** · Gap 탭 배지 **49** · 목록 28엔티티 카드(=49행) — 셋 일치. 홈 하단 `간접 영향` 섹션 **0개**, 인과 체인은 Gap 카드 **2건**에서 렌더 |
| B3 | 카시오페아 대표 관측이 `승률 -0.6%p q=1` → **"효과크기 바닥을 넘는 관측 변화 없음"** 으로 대체 |
| B4 | `홀 오브 레전드` 10행 **뱃지 0개** + "치장 항목 · 관측 대상 아님". `앞으로 나올 스킨 및 크로마` 2행도 0개. `증강`·`버그 수정`·`의회`는 **뱃지 유지**(과잉 분류 아님 확인) |
| B5 | Gap 카드 상태 분포 실측: 원인규명(인과체인) **2** · 추정원인 **5** · 후보없음(검토완료) **21** — 이전엔 전부 "근거 미확인" 한 문구였다. 근본원인·A/B는 `LLM-AB-2026-09-17.md` |

**맵 집계 실측**: official 매치 42.3 **1,715** / 43.1 **1,614**, 맵 7종씩 · 비교행 5
(한쪽 구간만 잡힌 맵 4종은 비교하지 않고 그 사실을 화면에서 말한다).
자산 조달: 무기 **38/47** · 맵 **9/9**(`pubg/api-assets`에 RPD·권총류·JS9·M79가 애초에 없음).

**PUBG 집계 재현성**: `run-pubg-aggregate.ts` 재실행 결과 `deltas.json`·`accuracy-comparison.json`
diff가 **`generatedAt` 한 줄뿐** — 맵 축 추가가 기존 판정을 건드리지 않았음을 확인.

### §7-1 실측 후 추가로 잡은 것 (advisor 검토 → 재실측)

1차 실측 뒤 외부 검토에서 네 건이 나왔고, 셋은 실제 결함이었다.

| 지적 | 실측 확인 | 처리 |
|---|---|---|
| B3가 **한 단계 아래**에서 되살아난다 — `buildNoteVerdict`에는 바닥 게이트가 없다 | 노트 짝 135행 중 **24행**(픽률 19·밴률 5)이 유의하면서 바닥 미달 | `meetsEffectFloor` 적용 + **"변화 규모 바닥 미달"** 신설 문구. "유의차 없음"으로 뭉개지 않는다 — 차이는 실재하므로 |
| 49를 말하는 타일이 **47만 보이는 화면**으로 링크 | `HeroSummary`의 href가 `#unannounced` 그대로 | 대조표에 통합 필터 `gap`("노트에 없는 변화") 신설 → 타일은 `#gap`. 실측 **49행(미공지 47 + 간접 2)** |
| `resolveCause`가 프로덕션 소비자 0 | `ReleaseNoteRow`가 `resolveGapCause`로 갈아탄 뒤 자기 테스트만 남음 | 삭제(같은 라운드 `selectIndirectEffects`와 동일 기준) + `resolveGapCause` 테스트 6건 신설 |
| Gap 카드에 "미검토"가 0건 | 카드 대표는 최대 |delta| 행이라 대부분 상한 안쪽 | **결함 아님** — 문구는 카드 대표 기준이다. 단 "상한을 올렸으니 괜찮다"는 이유로는 쓰지 않는다(현재 빌드의 `deltas.json`은 옛 상한 산출물) |

**바닥 게이트의 현재 효력에 대한 정직한 고지**: `buildNoteVerdict`에 건 게이트는 이 데이터에서
**실제로 발화하지 않는다**. `noteDeltas`가 `note.id → 델타`를 **last-wins**로 덮어써서, 95개
매핑 중 유의한 것이 1건뿐이고 그 1건도 바닥을 넘는다. 즉 이 수정은 **방어선이지 눈에 보이는
변화가 아니다** — 화면에서 사라진 미비한 수치는 카드 헤더(`selectReportableObservation`)가 잡은
쪽이다. (last-wins 매핑이 대표 행을 사실상 임의로 고른다는 별개 약점이 여기서 드러났으나,
이번 지시 범위 밖이라 고치지 않았다.)

최종 게이트: `verify.sh --full` **전 항목 PASS**(Spec·tsc·eslint·vitest·build·design-lint).

---

## §8 /verify-impl 인수검증 (2026-09-18)

```
📋 verify-impl — 인수검증 결과
대상:     Gap 표시원칙 통일(A1~A4·B1~B5) + ST-B6 치장 스킨 미리보기
기준선:   이 파일(§1 요구사항 원문 · §4 SubTask · §5 제외 합의)
          + 승인 아티팩트「PUBG 테마 시안」2차 개정 §4
          + docs/design/prototype/01-briefing-home.html · UX-BRIEF.md
```

### 축A — 요구사항·계획 대비 코드 (독립 acceptance-critic)

✅ A1·A2 · ✅ A3(코드+기준선 R5 갱신 동시 확인) · ✅ A4(폴백 포함) · ✅ B1(null 비병합 보장) ·
✅ B3(공지 경로 한정, 미공지 회귀 없음) · ✅ B4(과잉분류 없음) · ✅ B5①~④ · ✅ X2 준수
(`LLM_MODEL` 불변) · ✅ ST-B6(자산 이중 필터)
**⚠️ B2 1건** — Gap 소속 판정이 `home/logic.ts`와 `compare/logic.ts` **두 곳**에 각각 적혀
있었다. 조건이 문자 그대로 같아 동작은 일치했지만, 한쪽만 고치면 조용히 갈라지는 구조다.
판정 요약: 충족 9 · 부분 1 · 누락 0 · **미요청추가 0**

**보완 완료**: 술어를 `src/pipeline/shared/status-order.ts`로 올렸다 — 이미 서버·클라이언트가
공유하는 유일한 상태 모듈이라 여기가 제자리다. `home/logic.ts`는 재export만 하고
(`isSignificantDelta` 전례와 동일), `compare/logic.ts`는 그것을 import해 쓴다. 이제 히어로
타일·탭 배지·스트림 목록·대조표 필터 **넷이 한 함수를 본다**.

### 축B — 시안 대비 화면

**PUBG(승인 아티팩트 §4)** — `.detail-card` 구조가 1:1로 대응한다(실측, 1280×800):

| 시안 | 구현 실측 |
|---|---|
| `.detail-card { min-height: 260px }` | `260px` |
| `.detail-splash.contain img { object-fit: contain }` | `contain`(무기) / `cover`(맵) |
| `.detail-tint` 좌→우 그라디언트 | `linear-gradient(90deg, surface 0%, surface 45%…)` 동일 |
| `.detail-eyebrow { color: var(--game-glow) }` | `rgb(201,160,106)` = `#c9a06a` 토큰값 |
| `.detail-verdict` accent 좌측 보더 | `rgb(200,163,85)` = `#c8a355` |

⚠️→✅ **eyebrow 세부 분류**: 시안은 "무기 · **돌격소총**"인데 구현은 "무기 · 총기"였다
(`weaponKind`가 판정용 4분류뿐이라 총기가 전부 한 덩어리). `weaponCategoryLabel` 수기 표를
추가해 실측 47종을 **돌격소총 12 · 기관단총 8 · 지정사수소총 7 · 산탄총 5 · 저격총 4 ·
경기관총 4 · 권총 4 · 발사기 2 · 석궁 1**로 표기한다. 텔레메트리에 없는 정보라 수기이고,
표에 없는 베이스는 "총기"로 폴백한다(분류를 지어내지 않는다 — 테스트로 고정).

**LoL(프로토타입 01)** — 프로토타입이 **탭 도입 이전(2026-09-05) 상태로 고정**돼 있어 네
항목이 시안과 다르게 나온다. 전부 **이후 사용자 지시로 바뀐 것**이지 구현 이탈이 아니다:
탭 2종(9/14 지시) · 타일 라벨 `미공지`→`미공지 Gap`(B2) · 추정 원인 4상태 분리(B5) ·
스킬 행 인라인(B1). verify-impl 규약대로 **판정을 무시하지 않고 기준선을 갱신**했다 —
`docs/design/UX-BRIEF.md` §3에 폐기 목록을 명시하고, 시나리오 3의 `/compare/#unannounced`와
상태 칩 목록도 현재 값으로 고쳤다. 프로토타입 HTML 자체는 그 시점 기록으로 보존한다.

### 최종 실측 (재빌드 후)

탭 `패치 내용 181` / `미공지 Gap 49` · 타일 `49 미공지 Gap → /compare/#gap` ·
홀 오브 레전드 **10행 / 뱃지 0 / 이미지 5장**(떠오른 전설 오리아나 ×2 · 프렐요드 탈리야 ·
나무정령 르블랑 · 창공 아칼리) · 카시오페아 **4행** + "효과크기 바닥을 넘는 관측 변화 없음" ·
의회 **34행 유지** · 대조표 칩 8종에 `노트에 없는 변화` 포함 ·
무기 eyebrow 실측(ak47=돌격소총 · kar98k=저격총 · rpd=경기관총 · ump=기관단총 · m9=권총).

```
결론: 기준선 충족
UNMET: 0 · UNREQUESTED: 0
```
게이트: `verify.sh --full` 전 항목 PASS.
