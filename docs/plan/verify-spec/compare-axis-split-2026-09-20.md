# VERIFY-SPEC — PLAN-compare-axis-split-2026-09-20.md

## ST1 셀 축 분리 (src/components/compare/entityRows.ts)
- 기준선 요구사항: R1 "전체가 default" · R2 "유의미한 라인별 지표가 있을 때만 추가로"
- 변경 파일: entityRows.ts(수정)
- 관찰 가능한 계약: `EntityCell = { overall: DeltaRecord | null; lane: { record, lane } | null; representative }`.
  `buildEntityRows(rows, lane, q)`는 지표당 **경쟁시키지 않고** 축 자리에 각각 넣는다 —
  `placeInCell`이 all은 `overall`에, position은 `lane`(같은 지표에 라인 후보가 둘 이상이면 |Δ| 최대)에.
  `representative = overall ?? lane.record`. 라인 필터가 걸리면 그 라인 행만 후보라 `overall`은 항상 null.
  행의 `status`·`maxAbsDelta`는 `cellRecords()`가 낸 **그려진 관측 전부**에서 계산한다.
- 구현 결정: `betterCell`(경쟁 규칙)을 삭제하고 `placeInCell`/`newCell`/`cellRecords`로 교체했다.
  보고 가능 판정(`isReportableRecord`)은 그대로 — 축을 나눈 것이지 문턱을 바꾼 게 아니다.
  `indirect-effect`는 `displayStatus`가 `unannounced`로 접으므로 라인 관측이 셀에 합류해도 배지가 뒤집히지 않는다
  (실측: 오공 전체=unannounced · 정글=indirect-effect → 행 배지 미공지 유지).
- 인접 경계: `EntityCell.record`를 읽던 곳 — DeltaTable(ST2)·entityRows.test(갱신). 전수 확인은 tsc가 한다.
- 미확인 사항: 한 지표에 라인 행이 **둘 이상** 보고 가능한 경우 |Δ| 최대 하나만 든다.
  26.17→26.18 실측 0건이라 화면에서 관측된 적이 없다 — 26.19에서 처음 발생할 수 있고, 그때 두 번째
  라인이 조용히 사라진다(현재 규칙은 "가장 큰 것 하나"이며 사용자 확인은 없다).

## ST2 셀 렌더 (src/components/compare/DeltaTable.tsx)
- 기준선 요구사항: R3 "`전체 —`" · R4 "축 라벨은 전체 필터에서 항상, 라인 필터에선 뗀다"
- 변경 파일: DeltaTable.tsx(수정)
- 관찰 가능한 계약: `MetricCell`이 `overall`→`lane` 순으로 쌓는다. `labelled`(= `row.lane === "all"`)일 때
  전체는 `전체`, 라인은 `LaneGlyph + positionLabel`. `overall`이 없고 `lane`만 있으면 `전체 —` 한 줄을 먼저 둔다.
  `labelled=false`면 라벨도 `전체 —`도 그리지 않는다. 각 관측은 자기 `record.id`의 상세로 링크한다.
- 구현 결정: 축 라벨을 **Δ 줄**에 붙였다. 처음엔 값 쌍 줄에 붙였는데 좁은 밴률 열에서 "전/체"로
  세로 분해됐다(실렌더 실측) — 값 쌍 줄에는 `whitespace-nowrap`을 걸어 한 관측이 둘로 보이지 않게 했다.
  간격: **이번에 새로 만든 자리만** 토큰 스케일에 맞췄다 — 관측 사이 `gap-2`(`--space-2`),
  축 라벨↔Δ `gap-1`(`--space-1`). 관측 안쪽 `gap-0.5`(2px)는 라운드6부터 있던 값이라 건드리지 않았다
  (요청 밖 변경을 남기지 않는다). **다만 그 2px는 `--space-*` 스케일 밖이고, `verify.sh` Spec 정규식과
  `design-lint`는 Tailwind 소수 유틸을 검사 대상으로 잡지 못한다** — acceptance-critic이 짚은 게이트
  사각지대이며, 이 커밋의 범위 밖 부채로 남긴다.
- 인접 경계: `EntityCell` 타입(ST1) · `LaneGlyph`/`positionLabel`(기존) · 행 배지(`StatusBadge`)는 무변경.
- 미확인 사항: 라인 관측이 붙은 행은 1줄 → 2줄이 되어 640px 스크롤 안에 보이는 행이 9 → 7로 줄었다
  (실렌더 실측). 35개 엔티티 전부 스크롤로 닿는 것은 동일하나, 사용자에게 높이 증가 자체를 승인받지는 않았다.

## ST3 렌더 단언 (src/components/compare/__tests__/render.test.tsx)
- 기준선 요구사항: R1~R4 전부
- 변경 파일: render.test.tsx(수정 — 기존 "position 행이 셀을 대표하면 라인 태그" 1건을 3건으로 교체)
- 관찰 가능한 계약: ① 전체+라인 둘 다 렌더되고 축이 각각 붙는다 ② 전체가 없으면 `전체 —`
  ③ 라인 필터에서는 축 라벨도 `전체 —`도 없다.
- 구현 결정: **test-after다.** `--tdd` 플래그가 켜져 있으나 구현이 이 파이프라인 호출 이전(미리보기
  라운드)에 이미 존재해 **유효 RED를 관측할 수 없었다**. tdd-gate §3이 "무효 RED 위의 구현은
  test-after보다 나쁘다"고 못박으므로 가짜 RED를 만들지 않았다. 교체된 옛 단언은 명세가 바뀐 것이지
  통과시키려 약화한 것이 아니다(옛 규칙 "라인 행이 셀을 대표한다" 자체가 이번에 폐기됐다).
- 인접 경계: 같은 파일의 다른 describe(NoteNavigator·CoverageBar·CompareExplorer)는 무변경.
- 미확인 사항: jsdom이라 실제 줄바꿈·열 폭은 검증하지 못한다 — 그 근거는 실렌더 캡처뿐이다.

## ST4 기준선 드리프트 기록 (docs/design/UX-BRIEF.md)
- 기준선 요구사항: `UX-BRIEF.md` §3 정책 — 프로토타입은 2026-09-05 고정, 드리프트는 번호 목록에 적는다
- 변경 파일: UX-BRIEF.md(수정 — 14항 추가). `docs/design/prototype/02-comparison-table.html`은 **무변경**.
- 관찰 가능한 계약: §3 오버라이드 목록에 14항이 있고, 셀 구조 변경·축 라벨 규칙·`전체 —`·기각된 대안이
  적혀 있다. 다음 `/verify-impl` 축B(screen-critic)가 이 목록을 먼저 읽으면 허위 결함이 뜨지 않는다.
- 구현 결정: **처음엔 시안 HTML을 고쳤다가 되돌렸다.** scope-critic이 UX-BRIEF의 고정 정책을 짚어 줬고,
  확인해 보니 그 정책이 명시적이었다("소급 수정하지 않는다"). 시안을 고치는 것은 그 기록을 지우는 일이다.
  되돌리면서 시안 design-lint(`D-TOKEN-01` `gap:2px`) 때문에 바꿨던 컴포넌트 내부 간격도
  원래 값(`gap-0.5`)으로 복구했다 — 강제 근거가 사라졌으므로 요청 밖 변경을 남기지 않는다.
  관측 사이 간격만 새 값(`gap-2`)인데, 그 자리는 이번에 처음 생긴 자리라 되돌릴 원래 값이 없다.
- 인접 경계: UX-BRIEF 13항(라운드6 명세)과 §3 표의 "우 델타 테이블" 행 — 그 표는 **프로토타입**을
  기술하는 것이고 오버라이드는 번호 목록이 맡는다는 것이 이 문서의 구조다. 표는 건드리지 않는다.
- 미확인 사항: 14항이 길다(13항과 비슷한 분량). 목록이 계속 길어지면 "먼저 읽을 목록"의 실효가
  떨어지는데, 언제 시안을 새로 찍을지에 대한 기준은 이 프로젝트에 아직 없다.

## PUBG (R5 확인 결과 — 변경 없음)
- 무기 델타는 47행 × 1지표(`pickupShare`)이고 **세그먼트 축이 없다**. 맵 델타(`map-deltas.json`)는
  맵 자체 지표 5행이고 `status`가 없다(판정 미부착). 즉 "전체 vs 세그먼트"가 한 셀에서 경쟁하는
  구조가 존재하지 않아 이번 변경을 적용할 대상이 없다. `PubgCompareTable.tsx` 무수정.
- 미확인 사항: 표본부족 은닉은 두 게임 공통이다(PUBG `isReportable(status)`로 JS9·DP12 2건).
  그 표면화는 X1·X2로 기각됐으므로 양쪽 다 그대로 둔다.
