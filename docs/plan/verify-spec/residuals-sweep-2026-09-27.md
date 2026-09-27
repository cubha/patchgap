# VERIFY-SPEC — 코드 레벨 잔여 전건 (2026-09-27)

기준선: `docs/plan/PLAN-residuals-sweep-2026-09-27.md`

## ST1 · ST2 · ST13 — 워크플로 (collect.yml · collect-tft.yml · collect-pubg.yml)
- 변경: TFT·PUBG 표본 가드 → 경보(숫자 아니면 exit 1), `sample_ok` 게이트 전부 제거. 세 워크플로에 `Data invariants`(vitest 전체, 실패해도 커밋 진행) + 디스코드 경보. TFT·PUBG에 LLM 캐시 복원(게임별 키 접두어), PUBG에 `run-pubg-llm` 스텝(키 없으면 생략, continue-on-error).
- 구현 결정: 불변식은 **전체 스위트**를 돈다 — 코드가 main과 같으므로 실패 = 이 실행이 만든 데이터. 판정 스텝 크래시 시 커밋 생략은 유지(PLAN ⑥).
- 미확인 사항: 실제 Actions 실행으로는 검증하지 않았다(YAML 파싱·셸 페이로드 JSON 생성만 로컬 확인). `vitest --reporter=dot`가 CI 러너에서 소요 시간(로컬 WSL 78s) — collect.yml timeout 350분 안. PUBG `notes_ready=false`일 때 invariants 스텝은 돌지 않는다(커밋도 없으므로 무해).

## ST3 — TFT insufficient-sample
- 변경: `tft-delta.ts`가 표본 미달 top4Rate·avgPlacement 행을 p=null(BH 가족 제외)로 낸다. `verdict.assignStatus`의 n 게이트가 {winRate, top4Rate, avgPlacement}.
- 실측: 18.1→18.2 +140행 · 18.2→18.3 +241행 전부 insufficient-sample, 기존 행 q/delta 변화 0건.
- 미확인: 표본 부족 행이 늘어 TFT 대조표·상세의 "노이즈 접기" 개수 표시가 커진다 — 화면에서 과다하게 보이는지 렌더로는 보지 않았다.

## ST4 — 방향 중립 표시
- 변경: `DeltaRecord.directionAgreement?`(types.ts), LoL `applyVerdicts`·TFT `judgeTftDeltas`가 기록, `displayStatus`가 neutral이면 「공지」, 홈 티어가 displayStatus를 읽음.
- 호환: 필드 없는 낡은 파일은 기존 동작(테스트 고정).

## ST5 — TFT 원천 매치
- 변경: `tft-boards.ts` `sampleMatchIds`(최대 10, 입력 순서, 매치당 1회) → `tft-delta.ts` evidence.matchIds. TFT 상세에 「표본 매치」 한 줄, 방법론 문구 갱신.
- 실측: 18.3 재집계가 sampleMatchIds 외 전 필드 동일(231/231 대상에 id). 18.2는 원본 2,500줄 vs 커밋 2,496매치라 **재집계하지 않았다** — 18.1→18.2 쌍의 matchIds는 빈 배열(화면은 최신 쌍만 읽는다).

## ST6 — 합친 이름 노트
- 변경: `entity-match.ts` `splitCombinedEntity`·`resolveNoteEntity`(통째 실패 + 조각 전부 해소일 때만), LoL 자기참조 판정도 같은 함수.
- 미확인: 챔피언 섹션의 합친 이름은 실데이터에 없다(테스트만).

## ST7 — LLM 품질
- 변경: `mergeRepairedProse` 인용 id 짝짓기, `namesOtherEntityThanCited` 검증 게이트(자기 이름·인용 대상 부분일치·인용 수치 이름에 든 이름 제외, 수치 이름 앞 3어절 인정), `isAnomalyOrGapTarget`(LoL·TFT 대상), `isCitableBalanceNote`(치장 제외), PUBG 재분배 기대치·확신도 게이트·`promptRevision`.
- 게이트 실측: 전 쌍 verified 원인에 적용 시 LoL 26.19 6 · TFT 18.3 6 · TFT 18.2 3건 = 전부 수동 대조로 실제 어긋남(오탐 0). 26.16·26.17 쌍 0건.
- 미확인: 게이트는 보수적(이름을 안 쓰는 문장은 판단 안 함)이라 놓치는 어긋남이 있을 수 있다. 제드 밴률 「룬 나침반 30→0」 수치 혼동은 이름이 맞아 통과한다(PLAN ⑥).
- 명세 변경한 기존 테스트: `llm-match.test.ts` 「원인 문장만 가져오고…」(인용이 바뀐 재요청 문장을 원래 인용에 붙이던 기대값 제거), `tft-delta.test.ts` 「등장 보드가 모자라면…」(행 미생성 → 표본 부족 행), `AdapterMatrix.test.tsx`(머리글 패치 쌍 제거).

## ST8 · ST15 — 파서
- 변경: `extractNumbers` 천 단위 쉼표, 낮을수록 좋은 키워드 +가격·기준치·요구치·소모·지연, 「반환」 예외, 「효과는 전과 동일」=adjust. TFT 원문 별칭 「징수의 총」→「황금 징수의 총」.
- 실측: 재파싱 방향 변경 LoL 26.19 모드 노트 4줄(core 0 — 후보 해시 불변), TFT 18.2 41줄·18.3 10줄 + 신규 해소 1줄, 전부 원문 대조로 교정 방향 맞음. 18.2 「연소 가격 5→3골드, 최대 체력 비례 피해량 15→12%」는 한 줄에 두 수치가 섞인 원문이라 가격 기준 buff로 판정된다(한계).

## ST9 · ST11 · ST12 · ST14
- ST9 주석 정정(보드 단위 실측). ST11 PUBG 쌍을 `deltas.json` meta에서(로더·메타데이터 3곳), 판정 0건 숨김 게이트 제거. ST12 수기 상수 2건. ST14 TFT·PUBG 불변식 신설 + LoL 인용 대상·치장 불변식.
- 미확인: PUBG 판정 0건 쌍에서 화면이 어떻게 보이는지(빈 목록 렌더)는 렌더로 보지 않았다 — 현재 데이터는 판정이 있다.

## ST10 — 데이터
- LoL 26.19: 노트 재파싱(모드 4줄), 판정 재생성(LLM 3 호출, 오염 캐시 3건 삭제 후 재질의). TFT 18.2·18.3 노트 재파싱, 18.3 재집계, 두 쌍 판정 재생성(후보 해시 변경으로 LLM 전량 재질의). PUBG 43.1 원인 재질의(개정 태그).
