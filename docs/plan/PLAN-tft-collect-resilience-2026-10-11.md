# PLAN — TFT 수집 결함 3건 재발 방지 (2026-10-11)

## 사용자 요구사항 (원문)

> 고칠 결함 3건 전부 수정진행해. 다시는 이런일발생하지않도록.
> /sh-dev-loop --tdd --auto
> 이후 배포까지 /ship 진행

결함 3건(직전 보고 원문 요지):
1. **크롤러가 필요 없는 패치까지 채운다** — 2회차 조회 3,571건 중 18.4 적재는 423건뿐. 18.1·18.2 매치 1,200여 건 + 창 밖 1,270건.
   이번 쌍(18.3·18.4)으로 좁히면 실행 횟수가 크게 준다.
2. **부분 수집 상태를 화면이 구별하지 못한다** — 예정일이 지난 뒤 배너가 날짜 없이 「표본이 쌓이면」만 말해, 실행마다 데이터 불변식
   2건(`home-observed-pair.test.tsx`) 실패 + Discord 경보. 부분 수집을 별도 상태로 기록하고 진행(N/2,500매치)·다음 수집 시각을 말하게.
3. **대기열 실행이 예약 시점 커밋으로 체크아웃** → 직전 실행 데이터 커밋과 rebase 충돌(run 38097140647). 세 수집 워크플로 공통 여부 확인.

## 실측 근거

- run 38057211872 ~ 38101744640(10/10~11, 10회): Actions raw 캐시 휘발(`Cache not found … patchgap-tft-raw-`) → 처음부터 수집.
  크롤러는 `loadTftWindows()` 전 구간을 돌고 ID 조회 `startTime`이 18.1 시작이라 18.1·18.2 매치를 계속 받았다.
- 38097140647: 잡 생성 00:03:49Z, 직전 실행 종료 00:07:00Z, 잡 시작 00:07:02Z(동시 실행 방지는 정상) — 그런데 체크아웃은
  `github.sha`(=생성 시점 fc5c7de)라 직전 실행의 64a17d1과 `deltas-18.3-18.4.json`·`gamedata/tft/18.3_18.4.json` 충돌.

## 공통 여부 판정

| 결함 | LoL `collect.yml` | TFT `collect-tft.yml` | PUBG `collect-pubg.yml` | `patch-watch.yml` |
|---|---|---|---|---|
| 1 크롤 범위 | 해당 없음(쌍별 수집) | **해당** | 해당 없음 | — |
| 2 부분 수집 표시 | stub 없음 | **해당**(75분 마감 partial) | 부분 수집 경로 없음 | — |
| 3 대기열 체크아웃 | **해당** | **해당** | **해당** | **해당** |

## 확정 제약

- 실제 관측 산출물을 stub으로 덮지 않는다(기존 `writeObservationStub` 불변식 유지).
- rebase 충돌 시 「이번 실행 쪽 우선」 자동 해소는 하지 않는다 — 낡은 실행의 stub이 새 관측을 덮어 화면을 되돌릴 수 있다. 근본(낡은 체크아웃)을 고친다.
- 날짜를 지어내지 않는다 — 캘린더에 없는 패치면 날짜 없이.
- 테스트 수정은 명세 변경일 때만, 보고한다.

## SubTask (라우팅: 전량 [S] — 독립 [P] 후보 4개 미만·상호 의존)

| ID | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-1 | [TDD] | 크롤러 ID 조회 범위를 **아직 목표 미달인 창**으로 한정 + `run-tft-collect --patches from,to`로 창 필터 + 진행(`progress=` JSON)을 GITHUB_OUTPUT에 | `src/pipeline/collect/tft-crawler.ts` · `scripts/run-tft-collect.ts` · 테스트 |
| ST-2 | [TDD] | 사유 `collecting` 신설 + `ObservationFailure.progress` + stub 쓰기 `--progress` + 사유 문구·진행 문구 | `src/pipeline/types.ts` · `src/pipeline/shared/observation-stub.ts` · `scripts/write-observation-stub.ts` · 테스트 |
| ST-3 | [TDD] | 관측 일정 `observationScheduleOf` — 대기: 예정이 미래면 「첫 관측」, 지났으면 「다음 수집」(다음 cron) · 수집 중: 「다음 수집」 | `src/lib/observationEta.ts` · 테스트 |
| ST-4 |  | 화면: 배너(`NewerPatchNotice`)·안내(`ObservationPendingNotice`)·TFT 브리핑/선언 뷰가 일정·진행을 말한다. `home-observed-pair` 테스트를 새 명세로(대기·수집 중이면 날짜 필수) | `src/components/*` · `src/components/tft/TftBriefing.tsx` · `src/app/__tests__/home-observed-pair.test.tsx` |
| ST-5 | [TDD] | 워크플로: push하는 4개 워크플로 checkout을 **브랜치 끝**(`ref: ${{ github.ref_name }}`)으로 + 게이트 테스트 · collect-tft가 `--patches "$FROM,$TO"`를 넘기고 부분 수집이면 `collecting`+진행으로 stub | `.github/workflows/*.yml` · `scripts/__tests__/*` |

## 완료 기준

- 18.3/18.4 같은 상황 재현 테스트: 18.1·18.2 창이 있어도 `--patches 18.3,18.4`면 그 둘만, ID 조회 `startTime`은 미달 창 중 최소 시작.
- 부분 수집 stub → 배너·선언 뷰가 「18.4 813/2,500매치」와 「다음 수집 MM/DD(요) 06:00 KST」를 말한다. 예정일 지난 대기도 날짜를 말한다.
- push하는 모든 워크플로의 checkout이 이벤트 SHA가 아니라 브랜치 끝 — 테스트가 강제.
- `bash verify.sh` 통과.

## 상태 (2026-10-11 VERIFY 배치 1회)

- 구현 ST-1~5 완료(TDD RED 선커밋 4건). `bash verify.sh --full` 2회 통과(FIX 전·후).
- scope-critic: ST-1 no · ST-5 no · **ST-2~4 yes** → TFT 관측 전 안내 3곳(방법론 2·대조표/상세 `TftUnavailable`·`TftObservedRedirect`)에도 일정 전달(`tftDeclarationSchedule` 단일 계산) + `home-observed-pair` 선언 뷰 단언을 정규식 → 일정 종류·라벨 정확 일치로 강화 + 소스 가드(`observation-notices.test`).
- acceptance-critic: V1(=위 범위 확대) 반영 · V2 `progress=` 출력을 `writeCollectOutputs`로 분리해 stub 파서 왕복 테스트 + 워크플로 `id: collect` 단언 · V3(verify) 통과.
- 남는 한계(의도): 「다음 수집」 시각은 빌드 시각 기준이라 cron이 돌고 커밋이 없으면 다음 빌드 전까지 지난 시각으로 남는다(정적 사이트). 부분 수집이면 그 실행이 stub을 커밋해 재빌드된다.
