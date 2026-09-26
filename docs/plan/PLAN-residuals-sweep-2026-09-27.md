# PLAN — 코드 레벨 잔여 전건 해소 (2026-09-27)

## ① 사용자 요구사항 원문

> 코드레벨해소가능한건 전건 수정진행 /sh-dev-loop --tdd --auto
>
> 이때 지금최신패치 및 원요구사항(표현방식 등) 기준 파서 및 llm이 정상적으로 의도대로 동작하는지 확인하고 함께수정진행해

직전 턴에 정리해 보고한 잔여 목록(🟠·⚪) 중 **코드로 해소 가능한 것 전부**가 대상이다.

## ② 확정 제약

- 사용자 확정 8: 선언 축(패치노트)은 항상 최신 — 관측 축(표본)이 선언 축을 인질로 잡지 않는다.
- 봇 커밋 검증은 **경보형**(차단형이면 확정 8을 다시 깬다).
- 판정 엔진의 `MatchStatus` 유니온은 늘리지 않는다(display-status.ts 헤더 — 상태값은 판정 계약).
- 런타임 외부 호출 0 · `any` 금지 · 신규 의존성 금지 · data/raw 커밋 금지.
- 심사 기간(9/21~10/5) 중 — 섹션 순서 뒤집기·탭 위치 통일·쌍 선택 UI는 **범위 밖**(심사 후 착수로 이미 결정됨).
- 9/29 TFT 키 갱신은 사람 작업(코드 아님) — 범위 밖.
- PUBG 43.2 · LoL 26.20 감시자 실발화는 관찰 대기(코드 아님) — 범위 밖.

## ③ SubTask

| ID | 내용 | 파일 | TDD |
|---|---|---|---|
| ST1 | TFT·PUBG 표본 가드를 경보형으로(LoL #55와 동형): 판정·F9·브리핑·커밋의 `sample_ok` 게이트 제거, 표본 얇음은 경고 | `.github/workflows/collect-tft.yml` · `collect-pubg.yml` | — (YAML) |
| ST2 | 봇 커밋 직전 데이터 불변식을 **경보형**으로 실행(3 수집 워크플로): `vitest run` 실패 시 `::warning::` + 실행 요약 + (웹훅 있으면) 디스코드 경보, 커밋은 진행 | 위 2 + `collect.yml` | — (YAML) |
| ST3 | TFT `insufficient-sample` 표기: 개체 조건부 지표(top4Rate·avgPlacement)를 표본 미달이어도 행으로 내고 `assignStatus`의 n 게이트가 조건부 지표 전반에 걸리게 | `verdict.ts` · `tft-delta.ts` | [TDD] |
| ST4 | 방향 동률(중립) 노트의 유의 변화가 「공지·이상 관측」으로 표시되는 것 → 「공지」: 판정 시 `directionAgreement`를 행에 기록, `displayStatus`·홈 티어가 그것을 읽음 | `types.ts` · `verdict.ts` · `run-tft-match.ts` · `display-status.ts` · `releaseStream.ts` | [TDD] |
| ST5 | TFT `evidence.matchIds` 채움: 집계가 엔티티별 매치 id 표본을 내고 델타가 싣는다 + TFT 상세·방법론 문구 갱신 | `tft-boards.ts` · `tft-delta.ts` · `run-tft-aggregate.ts` · `app/tft/unit/[key]` · `app/tft/methodology` | [TDD] |
| ST6 | 합친 이름 노트(「세계 지도집과 룬 나침반」) → 구성 아이템 각각에 짝짓기 | `entity-match.ts` | [TDD] |
| ST7 | LLM 원인 품질 — (a) 재요청 병합이 **위치로** 짝지어 문장이 다른 노트의 인용을 단 채 verified로 나감(LoL 26.19 6·TFT 18.3 6·TFT 18.2 3) → 인용 id로 짝짓기 + 검증 지점에 「문장이 말하는 대상 ↔ 인용 대상」 게이트 (b) 비유의·방향 중립 공지-불일치 행을 "노트 방향과 관측이 다름"으로 LLM에 보냄 → LoL·TFT 대상을 화면의 「이상 관측」·「미공지」로 좁힘(`isTarget`) (c) 치장 노트(스킨·크로마) 인용이 verified → 인용 불가 (d) PUBG 지시문이 제로섬을 무한정 전제로 주입해 재분배 기대치(+1.9%)의 10배 변화를 high로 단정 → 상한 있는 서술 + 사용자 메시지에 기대치·전체 획득 수 + 기대치 2배 초과 시 confidence low 코드 게이트 + PUBG만 다시 묻는 `promptRevision` | `llm-match.ts` · `llm-profile*.ts` · `pubg-delta.ts` · `run-pubg-llm.ts` | [TDD] |
| ST8 | 파서 방향 판정 — (a) 천 단위 쉼표 숫자 분해(「1,020」→1·20)로 방향 뒤집힘 (b) 낮을수록 좋은 수치에 가격·기준치·요구치·소모·지연 누락(TFT 18.3 약 9줄 반대), 「반환」 예외, 「효과는 전과 동일」=조정 | `patchnotes-parser.ts`(TFT 파서가 공유) | [TDD] |
| ST11 | PUBG 화면이 `42.3`·`43.1`을 하드코딩(로더·메타데이터) + 판정 0건이면 PUBG 전체(노트 포함)를 숨김 → 산출물 meta에서 쌍을 읽고, 파일 존재만 게이트 | `lib/pubgData.ts` · `app/pubg/**` | — |
| ST12 | 수기 상수 낡음 — 방법론 어댑터 표 머리글의 패치 쌍(TFT 「18.1 → 18.2」) 제거, LoL 방법론 LLM 상한 120→400(CI 실제값) | `adapterMatrixData.ts` · `app/lol/methodology` | — |
| ST13 | CI 누락 — TFT·PUBG 워크플로에 LLM 캐시 복원 없음(매 실행 콜드), PUBG 워크플로에 LLM 2단 스텝 자체가 없음(다음 패치부터 원인 소실) | `collect-tft.yml` · `collect-pubg.yml` | — |
| ST14 | TFT·PUBG 데이터 불변식 신설(짝 노트 실재·앵커, 원인 인용 실재·비치장·대상 일치, PUBG 화면 파일 쌍 존재) + LoL 불변식에 인용 대상 일치·치장 인용 금지 추가 | `__tests__/tft-pubg-data-invariants.test.ts` · `deltas-invariants.test.ts` | — |
| ST15 | TFT 원문 표기 별칭 — 18.3 「징수의 총 공격력 40→35%」가 카탈로그 「황금 징수의 총」과 달라 미해소로 버려짐 | `tft-notes-parser.ts` | [TDD] |
| ST9 | TFT 7일 규칙의 틀린 사유 주석 정정(보드 단위 실측) | `tft-patch-calendar.ts` | — |
| ST10 | 데이터 재생성: LoL 26.19 노트(파서 수정)·26.18→26.19 판정 · TFT 18.3 노트·재집계(매치 id)·18.1→18.2/18.2→18.3 판정 · PUBG 43.1 원인 — LLM은 캐시 우선, 오염 캐시(인용 어긋남 15행)만 무효화 | `data/aggregated/**` | — |

## ④ 라우팅

전량 `[S]` — 서로 같은 파일(verdict.ts·run-tft-match.ts·워크플로)을 공유하고 `[P]` 후보가 4개 미만으로 독립이 아니다.

## ⑤ UI

ST5의 TFT 상세 「원천 매치」 표시는 기존 LoL `SourceMatchesPanel`을 재사용(신규 디자인 없음). 방법론 문구만 갱신.

## ⑥ 명시적으로 남기는 것 (범위 밖 · 근거)

- **판정 스텝 크래시 시 커밋 생략**은 유지한다. 코드 결함은 빨간 X로 드러나야 하고, 세 게임 화면은 모두 판정 파일(deltas) 기준으로 최신 쌍을 고르므로 노트만 커밋해도 화면에 반영되지 않는다.
- **합친 이름 노트의 단계값 ↔ 아이템 대응**(「30/100/200 ⇒ 0/60/200」이 어느 아이템 값인가)은 파서가 알 수 없다(도메인 지식 — 아이템 진화 단계). 짝짓기·자기참조는 조각 해소로 고쳤고, 수치 혼동(제드 밴률)은 LLM 재질의에 맡긴다.
- 섹션 순서 뒤집기·탭 위치 통일·쌍 선택 UI는 심사 종료(10/5) 후.
- LoL 모드 섹션 엔티티 이월(아레나 36줄 「아펠리오스」 등)은 판정·LLM에서 `isCoreNote`가 이미 거른다 — 26.19 원문 캐시가 없어 대조 불가, 이번 범위 밖.

