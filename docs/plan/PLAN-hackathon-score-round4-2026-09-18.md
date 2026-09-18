# PLAN — 해커톤 채점 라운드4 보완

생성 2026-09-18 · 소스: `/braintrust` 5렌즈 패널 종합(`docs/plan/BRAINTRUST-residual-2026-09-18.md`) + 사용자 확정

## 1. 요구사항 (사용자 발화 원문 기준)

- **R0**(승계, 여전히 유효) "파괴적인 수정사항이나 기본 시스템의 목표, 틀을 수정하는 행위는 최대한 지양하고, 불가피한상황이면 나한테 확인 후 confirm받고 진행해"
- **R1** "남은 감점4점 후속대상 /braintrust 진행"
- **R2**(Q2 응답) "🟢 6건 전부 착수 + 재채점"
- **R3**(Q3 응답) "전건진행" — CF-1·CF-2·CF-3 **전부 승인**
- **R4**(cron 응답) "상한이 있어야돼? 전건은안되나? 그리고실질적으로 저렇게많은건수가 올라올수가잇나?"
  → 확인된 사실: 상한은 천장이지 목표가 아니다(후보<상한이면 비용 불변). 관측 후보 **113 / 244**,
  26.16→26.17에서 **124건이 미검토**였다. SCOPE §3 73번 줄의 의도가 이미 "전수"다.
  → **결정: 상한 제거가 아니라 120 → 400.** 예산 폭주 가드는 남기고 실질 전수를 보장한다.
    SCOPE §3 고정값이므로 **문서 선행 갱신**(M1 Opus 상향과 같은 절차).

## 2. 제약

- 판정 엔진(`verdict.assignStatus`) · `MatchStatus` 상태값 · `EFFECT_SIZE_FLOORS` · `FDR_ALPHA` ·
  재분류 임계 · 승인 시안 레이아웃(2026-09-11 `ac27db2` 하단 정렬 포함) = **불변**
- `items-start` 복원 금지(사용자 결정 파기) · 행 숨김/추가 정렬 조작 금지(`숨기지 않는다` 원칙)
- `streamVerdict.test.ts:97,105,155,161`("유의차 없음 ≠ 규모 미달" 경계)이 빨개지면 **수정안을 되돌린다**
- `git add -A` 금지 · `mobile-check.png`·`todo-preview.png` 영구 제외
- `data/raw`·`.env`·키 커밋 금지 · `any` 금지

## 3. SubTask

| ID | 내용 | 대상 파일 | 근거 |
|---|---|---|---|
| **S1** | SCOPE §3 LLM 상한 120→400 선행 갱신 + `CLAUDE.md` 동기화 | `docs/scope/SCOPE-patchgap-2026-09-05.md` · `CLAUDE.md` | R4 |
| **S2** | `collect.yml` `llm_max` 기본값 120→400 | `.github/workflows/collect.yml` | R4 |
| **S3** | **폭 역전 수정** — 원천 매치 메타 줄만 래핑 허용(칩에는 절대 닿지 않음) | `src/components/item/SourceMatchesPanel.tsx` | BT §1 |
| **S4** | [TDD] `explainNoObservation` 순수 함수 + 카드 헤더 배선 — 사유를 계산해 말한다(혼재면 단정하지 않음) | `src/components/home/streamVerdict.ts` · `ReleaseNoteRow.tsx:260` | BT §2-3 |
| **S5** | `"관측 보류"` 한국어 리터럴 제거 → 표시 키 `unpaired`("짝지은 관측 없음") | `display-status.ts` · `format.ts` · `ReleaseNoteRow.tsx:365` | BT N1(50건) |
| **S6** | `below-threshold` 표기 통일 `임계 미달`→`바닥 미달`(동의어 교체, 뜻 불변) | `format.ts:101` · `compare/logic.ts:36` · `CoverageBar.tsx:22` + 테스트 3곳 | BT N3 |
| **S7** | 방법론 정의표에 표시 게이트 캡션 1줄(홈은 바닥을 한 번 더 건다) | `StatusDefinitionTable.tsx` | BT N4 |
| **S8** | README 모델명 Sonnet 5→Opus 5 · 히어로 수치 실측값으로 | `README.md:3,30` | BT §4-2 |
| **S9** | **CF-1** `displayStatus` 회색 조건 확대 `!sig` → `!(sig ∧ floor)` + 라벨 재검토 | `display-status.ts` | R3 승인 |
| **S10** | **CF-2** `announced-consistent` 배지에 규모 보조 표기 | `StatusBadge.tsx` 또는 라벨 | R3 승인 |
| **S11** | **CF-3** 디스코드 "공지-불일치" 상위 N에 `isSignificantDelta` 필터 | `src/pipeline/discord/webhook.ts:150` | R3 승인 |

## 4. 제외 합의

- **X1-a 세로 공백**(`items-start`/`flex-1`) — 2026-09-11 사용자 결정의 산물. 건드리지 않는다.
  S3(가로 폭)만 고치고, 세로 공백이 줄어드는지는 **측정으로 확인**한다(예측하지 않는다).
- **X2 상세 우측 신규 카드** — 상세 2,027장 중 90.5%가 좌측도 비어 있어 빈 카드가 증식한다.
- **X3 E2 rubric 문구 수정** — 자기 채점표를 고쳐 자기 점수를 올리는 것. 현 판정(5/6) 유지.
- **X4 아티팩트 96→97 정정** — 라운드4 재채점 결과와 함께 한 번에 반영한다.

## 5. 완료 조건

1. `bash verify.sh --full` PASS
2. S3 후 **양 끝 재측정**(causes=0 유나라 / causes=5 오공, 1280): `grid-template-columns`가 의도(≈629/315)로 잡히고, **공백이 좌측으로 넘어가지 않으며**, 393px 오버플로 0
3. `streamVerdict.test.ts`의 "유의차 없음 ≠ 규모 미달" 경계 어서션 **무변경 통과**
4. `"관측 보류"` 렌더 0건 · `"임계 미달"` 렌더 0건
5. 홈 "관측 변화 없음 · 바닥 미달" 상수 문구 0건(사유별 4종으로 분기)
6. 빨강↔회색 모순 0건(CF-1 적용 후 재측정)
7. `/verify-impl` UNMET 0 · scope-critic 반영 완료 · security-auditor Critical 0
8. 배포 후 라운드4 재채점 — **E1·B2·E3 재측정 포함**(라운드3이 놓친 항목이므로 델타만 보면 안 된다)
