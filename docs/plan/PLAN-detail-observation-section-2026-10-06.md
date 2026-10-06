# PLAN — 상세 화면 공통 관측 섹션 (2026-10-06)

생성: 2026-10-06 · 소스: 세션 대화(사용자 확정) + 시안 아티팩트 · 실행: `/sh-dev-loop --tdd --auto` → `/verify-impl`

## 요구사항 (사용자 원문)

- R0 (실행 지시): "위 대상내용 아티팩트 시안 및 최종검증에맞게 /sh-dev-loop --tdd --auto 진행하고 /verify-impl 까지 진행"
- R1 (섹션 형태): "표본부족, 바닥미달은 분명히보여주지말라고햇는데? 나머지대상은 라인별, value별 탭이나 dropdown으로 전환해서
  한섹션내부에서 데이터 변경하며 보여줄수잇도록 아티팩트로 개선안 도출 --->> 다른게임들도 공통으로 사용할 섹션(lol기준으로
  상세통일)이니 이점 유의해서 아티팩트 작성해"
- R2 (원인 위치·맵): "대부분 좋아. 추정원인 위치도 통일하고, 맵상세도 통일하면좋긴한데 좀 애매한가?" → 시안에 반영 후
  "오케이확정" (원인 = 패널 안, PUBG 맵 = 같은 섹션의 기술통계 모드)
- R3 (숨김 규칙, 9/18 확정·재확인): 표본 부족·바닥 미달·변화 없음은 **탭도 선택지도 만들지 않는다** — 화면에 노출 0.

시안(확정본): https://claude.ai/artifact/5Jitae5GfFhk8icKRTDggB
- `Main` 보드 — 인터랙티브 관측 섹션(LoL 암베사 · TFT 카직스 · PUBG RPD · PUBG 에란겔 맵 데이터 전환)
- `Skeleton` 보드 — 페이지 골격(머리 → 선언 대조(전체 폭) → 관측 공통 섹션 → 푸터)과 게임별 축 매핑
- 로컬 사본: 세션 스크래치패드 `art/project/{Main,Skeleton}.dc.html`

## 확정 결정 (메모리 `project_screen_parity_contract.md` 「상세 화면 통일」)

- D1 기준은 LoL 상세. 4종 상세(LoL 챔피언/아이템 · TFT 유닛·특성·아이템 · PUBG 무기 · PUBG 맵)가 같은 골격:
  머리(이름·종류·뱃지·패치쌍) → 패치노트 대조(**전체 폭**, LoL 좌우 2분할 폐지) → **관측 공통 섹션** → 푸터.
- D2 관측 섹션 = **지표 탭 × 구간 선택 → 패널 하나**. 패널 = 판정 뱃지 · 전→후 · Δ · 막대 · CI · 통계 게이트 ·
  원천 매치 · 집계 경로 · **그 조합의 추정 원인**. 입력은 `지표[] → 구간[] → 행` 하나. 탭 1개면 라벨 1개,
  구간이 없으면 선택 상자가 사라질 뿐 섹션은 같다.
- D3 축 매핑: LoL 챔피언 승률·픽률·밴률 × 라인(전체·탑·정글·미드·원딜·서포터, 밴은 전체만) · LoL 아이템/라인/오브젝트
  구간 없음 · TFT 등장률·순방률·평균 등수(구간 없음) · PUBG 무기 획득 점유율(구간 없음) · PUBG 맵 매치 점유율·
  평균 매치 시간·봇 비율·매치당 획득(구간 없음).
- D4 추정 원인은 패널 안, 선택한 지표·구간 바로 아래. 별도 「추정 원인」 섹션(LoL·TFT·PUBG)과 PUBG 「이렇게
  판정했습니다」 섹션은 흡수된다.
- D5 PUBG 맵 = 같은 섹션의 **기술통계 모드**: 뱃지 「판정 없음」(회색) · Δ 중립색 · CI 「산출하지 않음」 · 원천 매치 칸
  없음 · 원인 칸은 「판정이 없어 원인을 추정하지 않습니다」 + 맵 풀 로테이션 사실. 「많이 줍는 총」 표는 섹션 아래 유지.
- D6 탭·선택지는 보고 자격 조합만 — LoL·TFT `isReportableRecord`, PUBG 무기 `isReportable(status)`(PUBG 판정 경로의
  같은 자리 술어). 자격 조합이 0이면 섹션은 「보고할 관측이 없습니다」 한 줄만 말하고, 숨긴 상태의 이름(표본 부족 등)을
  꺼내지 않는다.

## 구현 항목 (메모리 확정 6항목)

1. 공통 관측 섹션 컴포넌트(게임 중립 입력) + 4종 상세 교체
2. 상세 데이터 → 섹션 입력 변환을 보고 자격 단일 술어로(LoL 결함 수정 — 아트록스 13장 → 1건)
3. 대조 섹션 전체 폭화, 원인 섹션·PUBG 근거 섹션 흡수
4. PUBG 맵 기술통계 모드
5. 게이트: `screen-parity.test.ts`에 상세 골격·숨김 상태 미노출 단언, UX-BRIEF §8 갱신, 구 지표 상세 URL(별칭 라우트)의
   탭·구간 딥링크 처리
6. 별건 조사: 거의 0인 기준값(아트록스 원딜 픽률 0.01%→0%)에 「공지-불일치」가 붙는 판정

## SubTask (라우팅: 전량 [S] — 4종 상세가 ST1·ST2 산출물에 의존, 독립 [P] 후보 4개 미만)

| ID | 내용 | 파일 | 태그 |
|---|---|---|---|
| ST1 | 관측 모델(순수): 지표×구간 묶음 · 자격 필터 · 정렬 · 초기 선택(별칭 id 해석) | `src/components/observation/observationModel.ts` (+test) | [TDD] |
| ST2 | 공통 섹션(클라이언트: 탭·선택 상자·패널 전환) + 공통 패널(서버: 뱃지·값·Δ·막대·게이트·원천·원인 슬롯) | `src/components/observation/ObservationSection.tsx` · `ObservationPanel.tsx` (+render test) | test-after(UI) |
| ST3 | LoL 상세 교체: 대조 전체 폭(원인 카드 흡수) · 섹션 · 별칭 id → 초기 탭/구간 · 자격 0 빈 상태 | `src/components/detail/LolItemDetail.tsx` | test-after |
| ST4 | TFT 상세 교체: 지표 그리드·원인 카드 → 섹션 | `src/components/tft/TftUnitDetail.tsx` | test-after |
| ST5 | PUBG 무기 교체: 원인·근거 카드 → 섹션 패널 · 판정 없는 무기는 사유 대신 「보고할 관측 없음」 | `src/components/pubg/PubgWeaponDetail.tsx` | test-after |
| ST6 | PUBG 맵 기술통계 모드 | `src/components/pubg/PubgMapDetail.tsx` | test-after |
| ST7 | 게이트·문서: screen-parity 상세 골격 단언 · UX-BRIEF §8 · 6번 조사 결과 고정 테스트 | `src/app/__tests__/screen-parity.test.ts` · `docs/design/UX-BRIEF.md` · 판정 테스트 | test-after |

## 제외 합의

- X1 섹션 순서 뒤집기(발견 먼저)는 9/28 종결 — 건드리지 않는다.
- X2 판정 엔진 상태값(`MatchStatus`)·산출물 재생성 없음. 6번은 조사·고정이며 엔진 수정은 결함이 확인될 때만.
- X3 UX-BRIEF §7 백필(사용자 미커밋 작업)은 이 작업에 섞지 않는다(별도 worktree에서 진행).
