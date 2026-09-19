# VERIFY-SPEC — 최종 채점 보완 7건 (2026-09-19)

기준선: `docs/plan/PLAN-final-remediation-2026-09-19.md` · 대상 커밋 범위 `b24d22b..HEAD`

## 구현 결정

- **①의 분기를 status가 아니라 `relCi`에서 뽑았다.** `!isReportable(status)` 한 덩어리에 사유가
  다른 둘(`no-change`=CI가 0 포함 / `below-threshold`=CI는 0 미포함·바닥 미달)이 들어 있던 것이
  거짓의 원인이었다. 부수적으로 `announced-*` 행도 CI로 판정하게 됐다 — `classify()`는 짝 노트가
  있으면 유의성 검사를 건너뛰므로 공지 행의 CI가 0을 포함할 수 있고, status로 단정하면 같은 종류의
  거짓이 재발한다(테스트로 고정).
- **②에서 `PROMPT_VERSION`을 올리지 않았다.** 규칙을 더하면 캐시 236건이 전량 무효가 되어 지금
  통과하는 문장까지 다시 굴린다. 결함은 230건 중 13건이므로 **캐시 적중 경로에 위반 검사와 1회
  재요청**을 넣고 결과를 같은 키에 되썼다. 길이 재요청이 이미 v5 키에 되쓰고 있어 새 규약은 아니다.
  - 이름 변경: `countLengthViolations`→`countProseViolations`,
    `buildLengthRepairNote`→`buildProseRepairNote`, `LlmRunSummary.lengthRepairs`→`proseRepairs`,
    `DeltasLlmMeta.lengthRepairs`→`proseRepairs`. 대상이 길이만이 아니게 되어 이름이 거짓이 됐다.
  - 재요청 실패는 삼킨다(캐시 원문 사용) — 문장 다듬기 때문에 파이프라인이 죽으면 안 된다.
    삼킨 결과는 `meta.llm.prose.causeNounEnding`이 그대로 세므로 숨겨지지 않는다.
- **⑤에서 줄은 합치지 않고 이미지만 합쳤다.** "스킨 및 테두리"·"이벤트 크로마"·"앞으로 나올 스킨"은
  서로 다른 항목이라 줄을 합치면 없는 항목을 만드는 셈이다. `CosmeticSkinPreview`의 캡션이 원래
  노트 문구가 아니라 매칭된 스킨명이라(그 컴포넌트 주석) 묶음당 1회 렌더로 바꿔도 캡션이 가리키는
  대상은 변하지 않는다.
- **⑦을 목록이 아니라 라우트 생성에서 걸렀다.** `detailRouteIds`(신규, `src/lib/`)가 자격을
  소유한다. `isReportableRecord`와 합치지 않은 이유: 상세의 자격은 카드의 자격보다 **넓어야** 한다
  (홈이 접어 둔 "유의한 관측 없음" 행도 대조표에서 열려야 한다). 그래서 상태만 본다.
- **④는 "빠진 아이템이 실제로 있을 때만" 말한다.** 없는데 말하면 그것도 거짓이다.

## 테스트

RED 선커밋 `7a7a9ea`(13건 실패 확인 — 구현 누락 사유). 신규/확장:
`evidenceProse.test.ts` +4 · `llm-match.test.ts` +6 · `llmStats.test.ts` +2 ·
`skinPreviewBundle.test.ts`(신규 3) · `detailRoutes.test.ts`(신규 4).

**명세 변경으로 기존 테스트 2곳 수정(보고 대상)**:
- `llmStats.test.ts` "빈 입력은 전부 0" deep-equal — `withUnverifiedCauseOnly` 칸 추가. 집계 구조가
  바뀐 경우이지 통과시키려 고친 것이 아니다.
- `llm-match.test.ts` 길이 재요청 describe — 함수명 변경 + 명사형 케이스 추가.

## 미확인 사항

- **`isNounEnding`의 휴리스틱 경계**: `[다요]$`로 판정한다. "…없다"(해라체)도 통과시키므로 문체
  혼입 전부를 잡지는 못한다. 지금 데이터에 해라체는 0건이고, 더 조이면 정상 문장을 위반으로 세는
  쪽이 위험해 이 선에서 멈췄다.
- **캐시 재요청의 비결정성**: 같은 캐시를 다시 돌리면 재요청분만 새 답을 받는다. 두 번째 실행에서
  위반이 0이면 재요청이 일어나지 않아 결과는 안정되지만, 첫 실행의 재요청 결과가 무엇일지는
  실행 전에 알 수 없다. `A2`(명사형 0)로만 판정한다.
  → **실측(26.17→26.18)**: `calls=7 cacheHits=110 proseRepairs=7`, 명사형 11 → **0**. 전량
  재생성이면 110 호출이 필요했을 자리를 7 호출로 닫았고, 검증 통과 원인 189건·길이 초과 0·고신뢰
  완곡 0은 그대로다(재요청이 다른 것을 건드리지 않았다는 증거).
- ~~**⑦의 라우트 감소 폭**: 2,089 → 219 예상이나 실빌드로 확인해야 한다.~~
  → **실측**: 상세 라우트 **2,030 → 268**(예상 219는 빗나갔다 — 간접 영향·공지 행이 예상보다 많다).
  빌드 산출물 전수 크롤로 `/item/` 링크 **81건 전부 실재**(깨짐 0). `entityRows`·`ReleaseNoteRow`·
  `webhook.ts` 세 링크 소스가 전부 `isReportableRecord`를 거치므로 원리적으로도 성립한다.
- **④의 실렌더**: 라인 선택 시 캡션이 뜨는지는 단위 테스트가 아니라 실렌더로만 확인된다.
  → 재판정 화면 축에서 확인한다(A4만 미측정으로 남았다).

## 게이트 결과 (2026-09-19)

`verify.sh --full` ✅ 전 항목 · scope-critic ×2 `DECISION_CHANGED: no` ·
acceptance-critic **UNMET 0 · UNREQUESTED 0**(계획 이탈 1건은 PLAN §5 기준선 갱신으로 처리 —
ST-2의 타입 리네임이 `verdict.ts`·`run-match.ts`로 전파된 것을 계획이 말하지 않았다).
A1·A2·A3·A6·A7·A8 실측 충족, A4만 실렌더 대기.
