# VERIFY-SPEC — TFT LLM 원인 분석 · PUBG 수집 CI · 랜딩 레일 (2026-09-20)

## 구현 결정

### TFT LLM 2단

- **게임별 부분을 `GameLlmProfile`로 뽑았다.** `llm-match.ts`에 리그 오브 레전드 전용 문자열이
  네 덩이(지시문 첫 줄·`METRIC_KO`·`POSITION_KO`·`resolvesToSameEntity`) 박혀 있었다.
  엔진 시그니처가 `ddragon: DdragonData` → `profile: GameLlmProfile`로 바뀌어
  `run-match.ts`·`run-llm-ab.ts`·기존 테스트가 함께 바뀌었다. **테스트는 시그니처만 맞췄고
  기대값은 건드리지 않았다**(44건 그대로 통과).
- **LoL 문자열은 `python`으로 원본 블록을 그대로 잘라 옮겼다** — 손으로 옮겨 적지 않았다.
  그 위에 golden 테스트(지시문 sha256 + 사용자 프롬프트 2종 전문)를 얹어 앞으로의 드리프트를 막는다.
- **캐시 무효화의 축은 프롬프트가 아니라 후보셋이다.** 캐시 키에 프롬프트 본문이 없으므로
  히트율로는 프롬프트 변경을 못 잡는다(그래서 위 golden). 실제로 866건을 날리는 것은
  `candidatesOf`이고, 그쪽은 `data/cache/llm/**`에 **실제로 적혀 있는** `candidateSetHash`를
  앵커로 고정했다.
- **3단 재분류(`indirect-effect`)를 함께 켰다.** LoL 패리티이지만 **화면 숫자가 바뀐다** —
  검증된 원인이 붙은 행이 `unannounced` → `indirect-effect`로 옮겨가므로 TFT 홈 3타일과
  랜딩 카드의 「미공지」가 줄어든다. 계획 이탈이 아니라 LoL과 같은 파이프라인을 쓴 결과이고,
  사용자 보고에 명시했다.
- **키가 없으면 죽지 않는다.** `ANTHROPIC_API_KEY` 부재 시 2단을 생략하고 로그로 알린다.
  `collect-tft.yml` env에 시크릿을 추가했다(그전 주석은 "미사용"이었다).
- UI: `components/item/CausesPanel` → `components/causes/`로 **이동**(LoL 아이템 상세 경로를
  TFT가 import하면 다음 게임이 사본을 만든다). 상세는 지표별로 나눠 보인다 — LLM은 델타
  단위로 호출되므로 등장률의 원인과 평균 등수의 원인이 같다는 보장이 없다.

### PUBG 수집 CI

- **Python → TypeScript 이식**(SCOPE §3 스택 고정). 축약은 **순수 함수**로 두어 실제 매치로
  검증 가능하게 했다.
- **원본 텔레메트리를 저장하지 않는다.** Python 재현본은 `matches/*.json`을 남겼는데 그건
  패치 라벨 검증 패스를 나중에 돌기 위한 것이었고, 지금은 축약이 라벨을 함께 담는다.
- **비교 창 하드코딩 제거.** `patch-calendar.ts`가 `to` 패치의 라이브 날짜 하나에서 산술로
  만든다(before = `patch-5…patch-1`, after = `patch+2…patch+6`). 두 창이 정확히 7일 차이라
  **요일 정렬이 산술로 보장된다**(PLAN §6-2의 요구를 사람이 매번 맞추지 않아도 된다).
- **수집 가능 구간이 사흘뿐**이라는 것이 이번 설계의 핵심 제약이다(336시간 보존창).
  그래서 cron이 매일 돌고 `determine`이 그 사흘을 고른다.
- **패치노트는 수기 입력이라 판정을 둘로 쪼갰다**(`should_run` / `notes_ready`). 노트를
  기다리다 보존창을 놓치면 그 패치쌍은 영영 못 만든다.

### 랜딩 레일

- `auto-fit` 그리드 → `.landing-rail`(가로 흐름 + 내부 스크롤). 규약은 `landing.css` 한 곳이
  소유하고, `landing-rail.test.ts`가 `auto-fit`/`auto-fill` 복귀를 막는다.
- 모바일도 세로 적층이 아니라 레일이다 — 사용자 지시가 "영역 고정 + 내부 X 스크롤"이었고,
  390px에서 다음 카드가 28px 보여 스크롤 가능함이 드러난다.

## 실측 근거

| 항목 | 값 | 확인 방법 |
|---|---|---|
| TFT 축약 이식 정확도 | 실전 매치(29,883 이벤트) **19개 필드 전부 일치** | Python 산출 `telemetry-reduced/50faa6d7….json`과 전수 비교 |
| PUBG 집계 무회귀 | 10개 산출 파일 **바이트 동일**(generatedAt 제외) | 파라미터화 후 재실행 → `diff` |
| PUBG 표본 가드 | before=1,715 / after=1,614 | 워크플로의 bash를 실데이터에 그대로 실행 (커밋된 `nMatches`와 일치) |
| PUBG 라이브 수집 | 축약 3건(라벨 `pc-2018-43` · official/competitive 구분 · 봇 수) | `--days 2026-09-19 --per-day 3` |
| PUBG 달력 ↔ 커밋된 창 | 9/4~9/8 · 9/11~9/15 재현 | 단위 테스트 |
| LoL 후보셋 해시 | 26.17 `8b5283…`(120건) · 26.18 `619b3f…`(110건) | `data/cache/llm` 전수 census |
| TFT LLM 산출 | 대상 185건 · 문장 위생 위반 0 · 원인 방향 정상 | 스모크 3건 육안 + 전량 재생성 |
| 랜딩 레일(카드 8장) | 1920/1024/768/390 전부 레일 높이 388px · 페이지 가로 스크롤 0 | Playwright 실측 |
| verify.sh --full | exit 0 | 타입·린트·단위·빌드·design-lint |

## 미확인 사항

1. **`collect-pubg.yml`은 실전 발화한 적이 없다.** 다음 PUBG 패치가 ≈10/8로 예선(~10/5) 밖이라
   이번 기간에 검증할 기회가 없다. `determine`·표본 가드·집계는 각각 로컬에서 실행해 확인했지만
   **워크플로 전체를 GitHub에서 돌린 것은 아니다**(TFT는 run 35515025960으로 확인했다).
2. **PUBG 패치노트 파서가 없다** — 43.2 노트는 사람이 넣어야 한다. 워크플로가 그것을 경고로
   말하게 했을 뿐 자동화하지 않았다.
3. **TFT 3단 재분류의 최종 수치**는 재생성이 끝나야 확정된다(스모크 3건에서 3건 이동).
4. 모바일 레일에 **스크롤바가 안 보이는 환경**(overlay scrollbar)에서는 다음 카드의 28px 노출이
   유일한 affordance다. Windows Chrome은 classic scrollbar라 보이지만, 그 차이를 코드가
   보정하지는 않는다.
5. PUBG 텔레메트리 다운로드가 매치당 16~30MB라 **CI 러너 대역폭·시간**을 실제로 얼마나 쓰는지는
   추정치다(1,200건 = 20GB 규모). `--per-day`로 줄일 수 있게 열어 뒀다.
