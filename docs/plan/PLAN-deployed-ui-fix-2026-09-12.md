# PLAN — 배포 화면 결함 6건 수정 (2026-09-12, 4~5차)

생성: 2026-09-12 · 소스: 사용자 실사용 피드백(배포된 patchgap.vercel.app, ea15bd2 기준) + planner 산출(advisor 검토 반영)
갱신: 2026-09-12(5차) — R6 아티팩트(bg-visibility-proposal.html "옵션 B") 사용자 승인 + 배치 조정 지시 반영, 구현 완료. 아래 X1을 대체하지 않고 하단에 R6 절을 추가한다(X1은 역사적 기록으로 유지, acceptance-critic이 과거 판정 근거를 추적할 수 있도록).

## 요구사항 (사용자 원문 그대로 — R1~R5. R6는 별도 아티팩트로 방향 제시 후 5차에서 구현)

- R1. bg 이미지의 좌/우가 잘려있음. 전체화면에 적용될 수 있도록 연속되는 이미지를 생성해서 bg에 적용
- R2. 좌측 패치내용 요약영역과 우측 매치평균 영역의 상단영역이 뱃지 기준으로 맞춰져있음. List 상단을 기준으로 우측 섹션 영역을 아래로 이동
- R3. 상단 크롬 바 영역을 로고 기준으로 텍스트 및 뱃지, dropdown이 가운데 align되도록 수정. → 각 항목의 gap이 너무 좁아서 영역이 혼잡해보임. 간격조정
- R4. 스크롤이 발생하는 영역의 스크롤이 전부 기본 window 스크롤임. 테마에 맞는 커스텀 스크롤로 변경
- R5. 대조표 메뉴의 델타테이블 영역의 데이터 모든항목이 expand로 보여지고있어 화면에 너무 긴 스크롤발생. 메인메뉴의 요약영역참조해서 패치노트항목 섹션과 동일한 영역으로 height 지정하고 내부 스크롤 발생하도록 변경

## 제외 합의

- X1. R6("전체 메뉴가 아직도 반영이 안되고 각 섹션이 BG를 덮고있음")는 사용자가 "이부분은 시안먼저 작성"이라고 명시했다 — 이 PLAN/파이프라인에 구현 SubTask로 넣지 않는다. 진단+아티팩트는 별도 산출(https://claude.ai/code/artifact/89231f95-49e4-4f56-a67d-48ed0e986718)로 사용자 승인 대기 중.
- X2. R1은 "새 시임리스 이미지 생성"이 아니라 CSS 폭 공식 버그로 재정의됐다(아래 ST-UX1 근거) — 이 환경에 이미지 생성 도구가 없어 원문 그대로의 처방은 애초에 불가능. 대체 처방으로 동일 결과(끊김 없는 배경)를 달성한다.

## SubTask 목록 (전량 [S] — 근거는 실행 순서 절 참고)

| ID | 설명 | 파일 | TDD |
|---|---|---|---|
| ST-UX1 | 앰비언트 배경 래스터 좌우 잘림 제거 — `.ambient-cam-inner`/`.ambient-reveal` 폭 공식 교체 | src/styles/ambient.css | 비적격(절대제외: UI 렌더링) |
| ST-UX2 | 홈 2컬럼 상단 정렬 — 라인필터를 그리드 row1로 분리(CSS Grid 행 배치, JS 오프셋 없음) | src/components/home/StreamColumnLayout.tsx, ReleaseNoteStream.tsx, StreamLaneFilter.tsx(신규), app/page.tsx, home/__tests__/render.test.tsx(갱신) | 비적격(채택 설계에 순수 로직 없음 — 아래 근거) |
| ST-UX3 | 대조표 델타테이블 내부 스크롤(640px, 프로토타입 `.note-item-list` 규약) + sticky 헤더 | src/components/compare/DeltaTable.tsx | 비적격(절대제외: UI 렌더링) |
| ST-UX4 | 테마 커스텀 스크롤바(전역, 순수 CSS) | docs/design/DESIGN-TOKENS.md → src/styles/tokens.css, src/styles/scrollbar.css(신규), src/app/globals.css | 비적격(절대제외: UI 렌더링) |
| ST-UX5 | 상단 크롬 바 정렬(광학 중앙) · 간격(그룹간 24px/그룹내 20px) 재조정 | src/components/Header.tsx | 비적격(절대제외: UI 렌더링) |

## 실행 순서 (전량 [S] 순차)

**ST-UX1 → ST-UX2 → ST-UX3 → ST-UX4 → ST-UX5**

1. ST-UX1 먼저 — 유일하게 되돌리기 비용이 있는 시각 변경(섬 확대율 변화, 사용자 사인오프 필요).
2. ST-UX2 → ST-UX3 — 스크롤 컨테이너 최종 형태 확정.
3. ST-UX4 — 완성된 스크롤 컨테이너 위에서 스타일링(재작업 없이 1회).
4. ST-UX5 마지막 — 헤더 높이(57px) 보존 설계라 순서 무관하나, `.ambient-scrim` 재실측을 ST-UX1 이후 1회로 묶기 위해 마지막에 둔다.

[P] 후보는 파일 교집합 0이라 기술적으로 가능하나 **[S] 채택** — 근거: (a) 5건 전부 최종 판정이 동일 dev 서버·동일 브레이크포인트 스크린샷이라 병렬 시 회귀 귀속 불가, (b) ST-UX5(헤더 높이)가 ST-UX1(.ambient-scrim 정지점)과 ambient.css를 통해 간접 결합, (c) ST-UX4는 ST-UX2·ST-UX3의 산출물 위에서만 실측 가능(선행 의존).

## ST-UX1 — 사용자 확인 필요 사항 (착수 전)

**진단**: `.ambient-camera`가 `overflow:hidden`이라 결함 임계는 정확히 **뷰포트 폭 > 1320px**(마스크 62%가 아니라 래스터 폭 상한 `min(1320px,128vw)`이 지배). 1440px에서 마스크 알파 ≈0.34, 1920px ≈0.59, 2560px ≈0.78 지점에서 래스터 사각 경계가 노출된다.

**처방 3안**(택1, 기본값은 1순위):

| 순위 | 처방 | 1440 확대율 | 1920 확대율 | 2560 확대율 | 비고 |
|---|---|---|---|---|---|
| 1(기본) | `width: min(max(110vw, 1320px), 128vw)` | 1.13× | 1.51× | 2.02× | ≤1269px 완전 동일(회귀 없음) |
| 2 | `width: 128vw`(상한 제거) | 1.40× | 1.86× | — | 3840px+에서 상단 이음선 노출 우려 |
| 3 | 마스크 반경 클램프(래스터 확대 없음) | 1.0× | 1.0× | 1.0× | 선명 밴드가 화면 대비 좁아짐 — "전체화면 적용" 요구와 반대 방향 |

## 참고
- Ground Truth: docs/design/DESIGN-TOKENS.md, docs/design/UX-BRIEF.md, docs/design/prototype/{01-briefing-home,02-comparison-table}.html
- `/frontend-design` 호출 불필요 — 5건 전부 기존 화면 내부 배치/간격/스크롤 수정, 신규 화면·컴포넌트 유형 없음.
- 상세 원인·트레이드오프·함정(sticky+border-collapse, Chrome 121 scrollbar-color 우선순위, laneCamera.ts tx/ty 불변식 등)은 세션 기록 참고 — 구현 시 VERIFY-SPEC에 재기술한다.

---

## R6 — 구간 한정 유리화 + 배치 조정 (2026-09-12, 5차)

**요구사항 원문(사용자, 2차 확인 메시지)**: "아티팩트도 권장 옵션B로 하는게 좋은거같아. 근데 내가얘기한건 배치를 좀 수정하자 이거야. 모든 섹션판넬이 화면 상단에 너무가까워서 BG를 가리니까." — 즉 (a) bg-visibility-proposal.html "옵션 B(구간 한정 유리화)" 승인 + (b) 패널이 화면 상단에 너무 붙어 있다는 배치 지적, 둘 다 반영 대상.

**진단(실측, 1440×900)**: 카메라 노출 밴드(y<873px, `.ambient-scrim`이 `--bg`로 완전히 닫히는 지점) 안에서 5차 변경 전 패널 점유:
- 히어로 스탯 패널 top=203 (밴드 내 114px 불투명)
- 릴리즈노트 스트림 + 매치평균 행 top=385 (밴드 내 각 488px/278px 불투명)
- 라인별 괴리 패널 top=687 (밴드 내 186px 불투명)

`laneCamera.ts`의 초점(fy 0.255~0.575)이 투영되는 지형 영역이 y 385~873 대역과 거의 겹쳐, 라인 전환 시 카메라 pan/zoom은 코드상 정상 작동(실측 확인)하지만 그 대상 지형이 패널에 거의 다 가려 체감상 "사라진 것처럼" 보였다 — R6의 배치 지적과 동일 원인.

**적용 처방**:
1. **배치 조정** — `src/app/page.tsx` Container `py-8`→`pt-14`(하단 유지), `src/components/home/HeroSummary.tsx` 헤드라인↔스탯 패널 `gap-5`→`gap-8`. 실측: 히어로 스탯 패널 top 203→239px, 릴리즈노트/매치평균 행 top 385→422px.
2. **옵션 B(구간 한정 유리화)** — 밴드 안의 최초 1~2개 패널(히어로 스탯, 매치평균)에만 헤더와 동일 레시피 적용. 신규 토큰 `--panel-glass-fill: color-mix(in srgb, var(--surface) 46%, transparent)`(tokens.css/DESIGN-TOKENS.md), 신규 클래스 `.panel-surface-glass`(src/styles/panel.css, 배경/보더만 override — `border-top: 2px solid var(--accent)`로 골드 강조 유지), `SectionCard`에 `variant?: "opaque"|"glass"` prop 추가(Container `width` prop과 같은 선례). 릴리즈노트 스트림·라인별 괴리 패널은 아티팩트가 명시한 "최초 1~2개" 범위 밖이라 불투명 유지.
3. **대비 재검증(실측, 필수 — 유리화는 배경 알파 혼합이라 DESIGN-TOKENS.md의 불투명 채움 불변식이 적용 안 됨)**: 유리화 직후 히어로 스탯 라벨(`--muted`)을 Playwright 픽셀 샘플로 측정하니 "전체" 라인 4.01:1, "서포터" 라인 4.23:1로 AA 4.5:1 미달. 해당 3개 라벨(`공지된 변화`/`유의 변화`/`미공지`)을 `--fg-2`로 올려 재측정 — 두 라인 모두 7.3~7.8:1로 통과(2차의 히어로 보조문단 처방과 동일 패턴). 매치평균 패널 라벨은 원래 `--fg-2`라 별도 조치 불필요.

**검증**: `verify.sh --full` 통과(Spec/TS/ESLint/vitest/build/design-lint 전부 통과, 기존부터 있던 arbitrary-value 경고 2건은 이 변경과 무관·불변).

**범위 밖(이 시점 기준)**: `/compare/`·`/item/[id]/` 페이지는 R6 스크린샷·진단이 모두 홈 기준이라 이번 배치 조정 대상에서 제외. 두 라우트에서도 동일 증상이 재현되면 별도 확인 후 처방한다. → **R6.1에서 `/compare/`는 반영, `/item/[id]/`는 계속 보류(아래 참고).**

---

## R6.1 — 전면 유리화로 확대 + 필터 배지·대조표 통일 (2026-09-12, 5차 연속)

**요구사항 원문(사용자, 연속 3메시지)**:
1. "지금 좌측 요약섹션이 여전히 단색 판넬이고 투명도도 그대로라고... 저거만수정하지말고 저거랑 똑같이되어있는데를 전부수정해. 지금 매치평균 섹션과 화면상단 판넬이 내가원하는 bg color랑 투명도야."
2. "왜 좌측 요약영역 (필터 뱃지잇는곳)은 왜 혼자만 다른 bg컬러에 투명도 0이냐고"
3. "여기만이런게아니라 동일스타일사용하고잇는데좀 찾아서 알아서좀 통일시켜주면안되니?"

**방향 전환**: R6 원안(옵션 B, 카메라 밴드 안 1~2개 패널만 유리화)을 폐기하고 **홈의 모든 `.panel-surface`를 유리화**하는 것으로 바뀌었다 — 실제 배치 화면에서 인접 패널 간 이질감이 진단(아티팩트, 카드 단독 비교)보다 훨씬 크게 느껴진다는 사용자 판단.

**적용 처방**:
1. **전면 유리화** — `ReleaseNoteStream.tsx`(릴리즈노트 스트림 + 빈 상태), `LaneGapPanel.tsx`(미공지 분포, `variant="glass"`), `DiscordPanel.tsx`(`variant="glass"`)에 `panel-surface-glass` 추가. 카메라 밴드 밖(y>873px, 예: DiscordPanel top≈1081)도 예외 없이 포함 — "카메라 노출 여부와 무관한 전면 통일"이 사용자 의도.
2. **레일 통일** — `panel-surface-glass`의 상단 강조가 단색 `border-top: 2px solid var(--accent)`(아티팩트 목업 그대로)였던 걸, 불투명 패널과 동일한 골드 그라디언트 레일(`background-image` 2px 페이드)로 교체. 채움(fill)만 기능상 불가피하게 다르게 남긴다.
3. **`--muted` 대비 중앙화** — 전면 유리화로 텍스트 밀도 높은 릴리즈노트 리스트까지 유리화되며 `--muted`가 리스트 하단(더 어두운 구간)에서도 4.43:1로 AA 근접 미달 실측. 컴포넌트별 개별 치환(HeroSummary에서 먼저 했던 방식) 대신 `src/styles/panel.css`에 `.panel-surface-glass .text-muted { color: var(--fg-2) }` 한 줄로 중앙화 — 이후 유리화되는 모든 패널에 자동 적용(HeroSummary의 개별 치환은 되돌림). 재측정 7.3~9.7:1.
4. **필터 배지 통일** — `LaneFilter.tsx` 선택 상태가 유일하게 완전 불투명 `bg-accent` solid 블록으로 남아 있던 것을 지적받아, Header.tsx 활성 탭과 같은 언어(`border-accent` + 반투명 워시)로 교체: `bg-accent/20 text-accent`. 대비 재측정 5.14:1.
5. **`/compare/` 확대(사용자의 "동일 스타일 찾아서 통일" 지시로 선제 발견)** — `LaneFilter`는 홈과 `/compare/`가 공유 컴포넌트라 4번 수정이 자동 반영됨을 확인. 추가로 발견·수정: `StatusFilterChips.tsx`(비선택 칩이 `bg-surface` 불투명 — LaneFilter와 같은 필터 줄에서 이질감, 배경 제거로 통일), `NoteNavigator.tsx`·`CompareExplorer.tsx`의 델타테이블 래퍼(top≈143px부터 카메라 밴드 전체를 불투명으로 덮음 — 홈과 동일 처방으로 `panel-surface-glass` 추가). 재측정 최저 6.43:1.
6. **의도적 보류**: `/item/[id]/`(항목 상세)도 `panel-surface`(SourceMatchesPanel·CausesPanel)를 쓰지만 배경 메커니즘이 다르다(`.ambient-duo` — 우측 62% 폭, 전체 높이 스플래시. 홈/대조표의 y<873px 카메라 밴드와 다른 기하) — 검증 없이 유리화하면 뒤에 비칠 게 없어 그냥 칙칙해질 위험이 있어 이번 라운드에서 제외. 동일 요청 시 별도 실측 후 처방.

**검증**: `verify.sh --full` 통과(Spec/TS/ESLint/vitest/build/design-lint). 이 라운드 중 공유 머신 메모리 부족(스왑 소진)으로 `--full`이 3회 타임아웃됐으나 코드 원인 아님 — `--ts-only`로 각 단계 확인 후 최종 `--full` 통과로 마무리.

---

## R6.2 — 방법론 페이지 전면 유리화 + 디스코드 패널 조사 + 카드 입체감 (2026-09-12, 5차 연속)

**요구사항 원문(사용자)**: "지금 진짜 개열받는게 뭔지알아? 니가 대조표 메뉴의 델타테이블 섹션은 말한대로 잘 바꿧으면서 브리핑 메뉴에 맨처음에 문제라고 얘기한데는 안수정했어... 심지어 브리핑메뉴에 디스코드로 공유 섹션과 방법론 메뉴에 모든섹션전부 불투명판넬 그대로잖아..... 먼저 파악부터해 대상. 수정할대상 확실히 정하고 그러고 수정해" → 뒤이어 "card도 단색 평면 디자인이라 너무 입체감이없어".

**조사 결과**:
1. **`DiscordPanel.tsx`** — `variant="glass"`는 R6.1에서 이미 적용·머지됐음을 grep+Vercel 배포 상태로 재확인(배포 지연 아님). 그런데도 시각적으로 거의 차이가 없는 이유: `.ambient-scrim`이 y=873px까지 진행하며 배경을 `--bg`로 완전히 닫는 설계(대비 안전장치)인데, DiscordPanel의 content-y≈1081은 그 지점을 한참 지난 구간이라 `backdrop-filter: blur()`가 비출 밝은 배경 픽셀 자체가 없다 — 코드 결함이 아니라 스크린 안 밝기 구조의 한계. 스크림 자체를 건드리는 건 전역 대비 안전장치를 흔드는 일이라 이번 라운드에서 임의로 변경하지 않고 사용자에게 그대로 보고.
2. **방법론 페이지(`src/app/methodology/page.tsx`)** — 이전 라운드 전부 이 페이지를 건드린 적이 없어 6개 `SectionCard`(데이터 파이프라인/상태 정의/어댑터 매핑표/통계 게이트/디스코드 미리보기/고지)가 전부 `variant` 미지정(기본 opaque)이었다. 첫 패널 top≈89px(헤더 바로 아래)부터 카메라 노출 밴드 전체를 불투명으로 덮고 있었음을 실측 확인 — 진짜 누락. 6개 전부 `variant="glass"`로 전환.
3. **카드 평면 디자인** — `PipelineDiagram.tsx`(STEP 4단)·`GateGrid.tsx`(통계 게이트 4개)가 `bg-surface-warm` 단색 평면이었다. 신규 토큰 `--card-fill-from/-via/-to`(surface-warm 기준, 1차 패널 그라디언트보다 밝게 유지해 "패널 안 카드" 위계 표현, 골드 레일은 반복 안 함)와 `.card-surface` 클래스(panel.css) 추가, 두 컴포넌트에 적용.

**검증**: `.card-surface .text-muted`가 R6.1의 중앙화 규칙(`.panel-surface-glass .text-muted`)과 별개로 자동 보호되지 않아 별도 확인 필요했으나, 실측 결과 카드 자체는 `.panel-surface-glass` 후손이 아니라 무관 — 카드 단독 대비는 새 그라디언트 최저점(`--card-fill-to`)에서 8.44:1로 AA 통과(centralized `.text-muted` 규칙과 무관하게 카드 배경 자체가 충분히 밝음). `verify.sh --ts-only` 통과, `--full` 통과.

**문서화 시점 참고**: 이 섹션은 R7(컴포넌트화) 착수 직전, 동일 세션 연속 라운드 정리 목적으로 사후 기록.

---

## R7 — 반복 판넬·카드·필터 배지 컴포넌트화 (2026-09-12, 6차)

**요구사항 원문(사용자)**: "반복 사용되는 판넬이나 카드, Label, 뱃지, ... 등을 컴포넌트화하여 동일한 영역이 동일한 스타일을 보장할 수 있도록 수정 진행" — R6~R6.2에서 "동일 스타일이어야 할 영역이 실제로는 파일마다 다르다"는 지적이 5회 반복된 근본 원인이 각 파일이 className 문자열을 손으로 복붙해 왔기 때문이라는 진단하에, 재발 방지를 위한 컴포넌트/헬퍼 추출 요청.

**전수 조사 결과(grep, `panel-surface`/`card-surface`/`rounded-full`/pill 형태/"adge" 전체)**:
- **StatusBadge**: 이미 5개 소비처(`item/[id]`·`NoteNavigator`·`DeltaTable`·`ReleaseNoteRow`·`StatusDefinitionTable`) 전부 공용 컴포넌트를 재사용 중 — 드리프트 없음, 손댈 것 없음.
- **필터 pill**: `LaneFilter.tsx`와 `StatusFilterChips.tsx`가 거의 동일한 pill 버튼 마크업을 각자 손으로 구현. `CompareExplorer.tsx:87-88`에서 **같은 필터 줄에 나란히** 렌더되는데도 padding(`py-1.5` vs `py-1`)·gap(`gap-1.5` vs `gap-1`)이 다르고, 선택 상태 배경이 `LaneFilter`는 토큰 유틸(`bg-accent/20`), `StatusFilterChips`는 arbitrary 값(`bg-[color-mix(in_oklab,var(--accent),transparent_88%)]`, 토큰 우회)으로 갈라져 있었음.
- **중첩 카드**: `PipelineDiagram.tsx`(`border-border`)와 `GateGrid.tsx`(`border-border-soft`)가 같은 `.card-surface` 채움을 쓰면서 보더 색만 손으로 다르게 적어 놓은 상태.
- **유리 패널 클래스 문자열**: `"panel-surface panel-surface-glass"` 리터럴이 `SectionCard.tsx`·`CompareExplorer.tsx`·`NoteNavigator.tsx`·`HeroSummary.tsx`·`ReleaseNoteStream.tsx`(2곳) 총 6곳에 그대로 복붙돼 있음 — 오타·누락(R6.1~R6.2에서 실제로 여러 번 발생) 재발 여지.

**적용 처방**:
1. **`FilterPill`** 신설(`src/components/FilterPill.tsx`) — 선택/비선택 스타일과 마크업을 단일 소유. `LaneFilter`·`StatusFilterChips`가 라벨 콘텐츠만 넘기도록 리팩터. 크기는 `LaneFilter` 쪽(더 넓게 쓰이던 값)으로 통일, `StatusFilterChips`의 arbitrary color-mix는 제거(토큰 유틸로 대체).
2. **`Card`** 신설(`src/components/Card.tsx`) — `.card-surface` + 표준 보더(`border-border-soft`, 패널 레벨과 동일 관례)를 소유. `PipelineDiagram`·`GateGrid`가 이걸 감싸는 형태로 리팩터.
3. **`panelSurfaceClass()`** 헬퍼 신설(`src/lib/panelSurface.ts`) — `"panel-surface"` / `"panel-surface panel-surface-glass"` 조합을 함수 하나로 고정. 6개 소비처 전부 이 함수 호출로 교체(리터럴 문자열 직접 작성 금지).

**TDD 적격성 판단**: 전부 순수 프레젠테이션(분기 없는 className 조합·마크업 이동)이라 tdd-gate 절대제외(UI) 기준에 해당 — test-after로 진행, 신규 단위 테스트는 추가하지 않는다(기존 `src/__tests__/components.test.tsx`도 이 컴포넌트들을 다루지 않았음 확인).

**검증**: Playwright로 `/compare/`(필터 줄 정렬)·`/methodology/`(카드 2종) 렌더 확인 — 시각적으로 정상. `verify.sh --full` 통과(Spec/TS/ESLint/vitest/build/design-lint 전부 통과). Spec 경고 2건(`ItemChart.tsx`·`DiscordEmbedPreview.tsx` arbitrary 값)은 이 라운드 이전부터 있던 것으로 무관·불변 — StatusFilterChips.tsx의 arbitrary `color-mix` 경고는 FilterPill 추출로 사라짐(부수 효과로 기존 경고 1건 해소).

---

## R7.1 — `/verify-impl` 재검증: grep 사각지대 추가 발견 (2026-09-12, 6차 연속)

**요구사항 원문(사용자)**: "/verify-impl 진행. 특히 디자인이 기존부터 표준에 안맞게 작성되어있던 대상이나, 유사하게만 되어있어서 grep에 안잡혀서 놓친대상 없는지 면밀히 확인해봐" — R7의 grep 기반 조사(정확 문자열 매칭)가 놓쳤을 수 있는, **형태는 비슷하지만 문자열이 달라 걸리지 않은** 드리프트를 재검증.

**발견 1 — verify.sh Spec 검사의 arbitrary 값 정규식 자체가 좁다**: `\[(#[0-9a-fA-F]{3,8}|[0-9]+(px|rem))\]`만 매칭해 `bg-[color-mix(...)]` 같은 함수형 arbitrary 값을 **구조적으로** 못 잡는다. 이 사각지대로 CI를 계속 통과해온 실사용처 3곳을 전수 스캔(`grep -oP '(bg|text|border|...)-\[[^\]]+\]'`)으로 확정:
- `Header.tsx`(고정 표본 칩 KR/Master+/솔로듀오) — `bg-[color-mix(in_oklab,var(--surface),transparent_40%)]`, 정당화 주석 없음(진짜 누락).
- `DeltaTable.tsx`(대조표 행 하이라이트) — `bg-[color-mix(in_oklab,var(--accent),transparent_90%)]`, 정당화 주석 없음(진짜 누락).
- `DiscordPanel.tsx`(버튼 hover) — `hover:bg-[var(--accent-hover)]`. 원인이 다르다: `--accent-hover` 토큰 자체는 tokens.css에 있었지만 `globals.css`의 `@theme inline`에 매핑이 빠져 있어 `hover:bg-accent-hover` 유틸을 쓸 방법이 없었다(컴포넌트 중복이 아니라 인프라 공백).
- (`DeltaTable.tsx`의 `shadow-[inset_0_-1px_0_var(--border-soft)]`는 검토 후 **드리프트 아님으로 판정** — 이미 상세 주석으로 정당화돼 있고(`border-collapse`+`sticky` 상호작용 회피, HANDOFF §R5), 토큰 var() 참조라 값 자체는 하드코딩이 아니며, 반복되는 다른 소비처가 없어 무시함.)

**처방**: `Header.tsx`·`DeltaTable.tsx` 2곳은 신규 토큰(`--chip-fill`·`--row-highlight-fill`, tokens.css+DESIGN-TOKENS.md)과 CSS 클래스(`.meta-chip`·`.row-highlight`, panel.css)로 교체. `DiscordPanel.tsx`는 `globals.css`의 `@theme inline`에 `--color-accent-hover` 매핑을 추가해 arbitrary bracket 자체를 없애고 `hover:bg-accent-hover` 표준 유틸로 교체.

**발견 2 — "카드"만 찾고 "아이콘 박스"는 놓침**: R7의 grep이 `card-surface`(그라디언트 카드)만 찾아, 시각적으로 동일한 역할("정사각 아바타/아이콘 박스" — 테두리+`bg-surface-warm`+중앙정렬)을 하는 완전히 다른 마크업 패밀리를 놓쳤다. 6개 소비처(`EntityIcon.tsx`·`SpellIcon.tsx`·`NoteNavigator.tsx`의 인라인 폴백·`DeltaTable.tsx`의 `RowIcon` 라인 박스·`ReleaseNoteRow.tsx`의 `FALLBACK_ICON_CLASS`+`CardIcon` 라인 박스)가 각자 거의 동일한 className 문자열을 손으로 복붙하고 있었고, 그 과정에서 `SpellIcon.tsx`만 `border-border-soft`(나머지 5곳은 `border-border`)로 갈라진 드리프트가 실재했다. 신규 `IconBox`(`src/components/IconBox.tsx`) 컴포넌트로 통합 — 6개 소비처 전부 이걸 감싸는 형태로 교체, 보더는 다수 쪽(`border-border`)으로 통일.

**발견 3 — 미공지 행의 불투명 강조가 유리화를 사실상 무력화**: 사용자가 다시 "메인화면 좌측섹션 투명화가 진행안되어잇어서그랫어"로 재지적. 픽셀 실측(배경을 임시로 제거한 화면과 비교) 결과, `ReleaseNoteRow.tsx`의 미공지 행이 완전 불투명 `bg-surface-warm`(#12213a)을 깔고 있었고, 미공지는 스트림 최상단 정렬 로직(releaseStream.ts) 때문에 스크롤 없이 보이는 행 대부분을 차지해 부모 `<ul>`의 `panel-surface-glass`(R6.1)가 사실상 안 보였다. `.row-highlight`(DeltaTable.tsx에서 이미 이번 라운드에 도입한 반투명 골드 워시, `--row-highlight-fill`)로 교체 — 강조 신호는 `border-l-accent`(왼쪽 골드 보더)로 유지, 채움만 반투명화. Playwright로 지형 비침 확인, `.text-muted`도 중앙화 규칙(`.panel-surface-glass .text-muted`)이 그대로 cascade돼 `--fg-2`로 안전(rgb(195,183,159) 확인).

**검토했지만 조치하지 않은 것(명시 — 무비판 무시 방지)**:
- `SourceMatchesPanel.tsx`의 매치 ID 칩(`rounded-sm border-border-soft bg-surface-warm px-3 py-2 ...`) — 시각적으로 warm-chip 계열이지만 단일 소비처라 추출 실익 없음(과잉 추상화 방지 원칙).
- `ItemChart.tsx`의 `h-[220px]`, `DiscordEmbedPreview.tsx`의 `max-w-[520px]` — 둘 다 verify.sh가 원래도 잡는 숫자형 arbitrary 값(px)이고, 반복되는 UI 패밀리가 아니라 각자의 고유 사이징 제약(차트 높이·디스코드 임베드 실물 폭 모사)이라 기존 판정대로 무관·불변 유지.
- `CoverageBar.tsx`·`NoteNavigator.tsx`의 검색 input — 반복 소비처 없음(각 1곳) — 추출 보류.

**검증**: Playwright로 `/`(헤더 메타 칩)·`/compare/`(행 하이라이트 클릭 재현) 렌더 확인 — 신규 토큰 2종·IconBox 6개 소비처 전부 정상. `verify.sh --full` 통과(Spec/TS/ESLint/vitest/build/design-lint). Spec 경고는 여전히 기존 2건(`ItemChart.tsx`·`DiscordEmbedPreview.tsx`, 무관·불변)뿐 — 이번 라운드에서 새로 고친 arbitrary 값 3곳(Header 칩·DeltaTable 하이라이트·DiscordPanel hover)은애초에 이 Spec 정규식에 안 걸렸으므로 경고 목록에서 사라진 게 아니라 "원래도 안 보이던 것"이 코드상으로 해소된 것 — design-lint(렌더 산출물 기준) 통과가 실질 증거.

---

## R8 — 배치 변경 최종 결정: +120px 전 메뉴 적용 (2026-09-13, 7차)

**요구사항 원문(사용자)**: "+120px이 맞는거같아. 단 맨위의 히어로 영역 텍스트도 똑같이 내려와야할듯. 위 결정에 맞게 전메뉴 /sh-dev-loop --tdd --auto 적용진행"

**배경**: R7 이후 배경 노출 배치안 아티팩트(A/E/C/D)를 제시했고, 사용자가 A안 +120px(패널만 내리는 +560px는 "너무 극적"으로 기각)을 선택했다. 단 최초 프로토타입(패널에만 `marginTop`)은 헤드라인 텍스트는 그대로 두고 패널만 내려 "패널-헤드라인 간격만 벌어지는" 결과였는데, 사용자는 "히어로 영역 텍스트도 똑같이 내려와야" — 즉 헤드라인+패널 전체 블록이 함께 내려가 헤더 바로 아래 지형이 더 드러나는 쪽을 원한다고 명확히 했다. E안(스크림 완화)은 이번 라운드에서 보류.

**적용 원칙**: "첫 콘텐츠 블록 전체를 헤더 기준 +120px 아래로" — 페이지마다 첫 블록의 정의가 다르므로 소비처별로 구현:
- **홈**(`src/app/page.tsx`) — `Container`의 `pt-14`(56px) → `pt-44`(176px). 히어로 헤드라인부터 스탯 패널까지 한 블록으로 같이 내려간다(Tailwind 표준 스케일 값이라 arbitrary 불필요).
- **대조표**(`CompareExplorer.tsx`) — 필터 바(`glass-chrome-2`)가 헤더 바로 아래 여백 0으로 붙어 있었다. `mt-[120px]`를 필터 바 자체에 추가해 필터 바+본문 전체가 같이 내려가게 한다(대조표엔 히어로 텍스트가 없어 필터 바가 그 역할의 "첫 블록").
- **방법론**(`src/app/methodology/page.tsx`) — `Container`의 `py-8`(상하 32px) → 상단만 `pt-[152px]`(32+120)로 분리, 하단은 `pb-8` 유지. 이 페이지는 헤드라인 없이 패널이 바로 첫 블록이라 패널 자체가 120px 내려간다.
- 대조표·방법론의 arbitrary 값은 대응 토큰이 없는 페이지별 1회성 배치 수치라(Container `width` prop·`max-h-[640px]` 선례와 동일 성격) `design-lint-ignore` 처리.

**검증**: Playwright 1440×900 실측 — 첫 패널(또는 필터 바) top이 3개 페이지 전부 정확히 +120px 이동(홈 239→359, 대조표 143→263, 방법론 89→209). 스크린샷으로 홈 히어로 헤드라인이 패널과 함께 내려가 헤더 바로 아래 지형(섬·타워·빛줄기)이 드러나는 것 확인. `verify.sh --full` 진행 중.

---

## R9 — 라인 카메라 팬/줌 제거 (2026-09-13, 8차)

**요구사항 원문(사용자)**: "모두 전체야. 그리고 내가지금보니까 선택할때 시점이동하는건 없는게 맞을거같다. 오히려 어지러워" — 세션 초반 "우선 유지. 다시동작검증해보고 판단할게"로 보류했던 항목의 최종 결정.

**배경**: 배경 노출 배치 논의 중 사용자가 아티팩트 캡처와 실제 배포 화면의 지형 위치·해상도가 다르다고 지적. 조사 과정에서 라인 카메라(라인 필터 선택 시 배경이 그 라인 초점으로 55~66% 확대+재중심)가 원인 후보로 떠올랐으나, 사용자가 두 캡처 모두 "전체" 상태였다고 확인해 그 가설은 기각됐다(실제 원인은 미확정 — 아티팩트 이미지가 파일 크기 때문에 JPEG 압축·축소돼 있던 것이 유력). 대신 이 과정에서 라인 카메라 자체를 실사용해본 사용자가 "어지럽다"고 최종 판단.

**적용 처방**: `laneCamera.ts`의 라인별 초점 표(TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY, fx/fy/z 실측값)를 전부 제거하고 "전체" 프레이밍(tx=2%, ty=8%, scale=1.0)만 고정 반환하도록 축소. `AmbientBackground.tsx`는 `useAmbient().selectedLane`을 더 이상 카메라에 연결하지 않는다(라인 필터의 다른 용도 — 릴리즈노트 스트림 필터링 — 는 그대로 유지, AmbientContext는 무변경). `laneCamera.test.ts`도 고정값 검증으로 재작성.

**검증**: Playwright로 "탑" 라인 클릭 전/후 `.ambient-cam-inner`의 computed `transform` 값이 완전히 동일함 확인. `npx vitest run laneCamera.test.ts` 통과(2/2). `verify.sh --full` 진행 중.

---

## R10 — 배경 마스크 반응형 결함 수정 (2026-09-13, 8차 연속)

**요구사항 원문(사용자)**: "내가첨부한 이미지 2번째사진이 아티팩트시안이야. 반응형으로 어떤화면이든 동일 bg와 배치 보장해" — R9 조사 과정에서 발견된 "화면 폭마다 배경 구도가 통째로 달라 보인다" 문제의 근본 수정 지시.

**근본 원인(실측)**: `.ambient-cam-inner`(지형 이미지 컨테이너)의 폭은 `128vw`(뷰포트 폭 비례)인데, 그 위 마스크(`.ambient-camera`)의 세로 반경은 `560px` **고정값**이었다. 뷰포트가 좁을수록 이미지가 작아져 고정 560px 안에 이미지 전체가 들어와 버리고(모바일 393px 실측: 섬 항공뷰 전체 노출), 넓을수록 이미지가 커져 560px가 상단 일부만 덮는다(1440px 실측: 산 정상 근경만 노출) — 폭에 따라 완전히 다른 구도가 드러나는 구조적 결함. `@media (max-width:640px)`의 별도 오버라이드(90%/380px)는 오히려 640px 경계에서 또 다른 비율로 튀어 결함을 하나 더 만들고 있었다.

**적용 처방**: 마스크 세로 반경을 이미지와 같은 단위(vw)로 환산 — 확정 시안 기준 렌더 폭(1440px, 이 프로젝트 실측 표준)에서 나온 값을 그대로 비율 변환: `.ambient-camera` 560px→38.89vw, `.ambient-reveal`(인트로 리빌) 620px→43.06vw. 640px 미만 전용 마스크 오버라이드는 이제 무의미해져(모든 폭에서 이미 동일 비율) 제거.

**검증**: Playwright로 393/768/1024/1440/1920px 5개 폭에서 "마스크 반경÷이미지 렌더 높이" 비율 실측 — 전부 0.53970(오차 ±0.00003)으로 상수. 스크린샷으로 5개 폭 전부 산·타워·빛줄기 구도가 시각적으로 동일함 확인. `verify.sh --full` 진행 중.

---

## R7 — 모바일 세로 반경 하한 (2026-09-14, 7차, 사용자 실기기 스크린샷 지적)

**요구사항 원문**: "모바일에서 이렇게보이네. 이번에 반응형으로 bg개선해두지않앗니?" — 첨부 스크린샷(393px 실기기)에서 헤더 바로 아래부터 스탯 카드까지 배경 지형이 사실상 보이지 않고 단색 암전만 보임.

**근본 원인(실측)**: 6차(R6.1 이전, `.ambient-camera`/`.ambient-reveal` 세로 반경 px→vw 환산)가 "폭에 따라 구도가 달라 보인다"는 결함은 고쳤지만, 그 세로 반경 자체가 **폭(vw)** 단위로 상단 **높이** 밴드를 규정한다는 구조는 그대로 남았다. 세로로 긴 좁은 화면(모바일 세로)은 폭이 작으므로 반경도 같이 줄어 — 393px 실측 `38.89vw≈153px` — 헤더(57px) 바로 아래에서 지형이 이미 흐려지기 시작해(58% 스톱=89px) 153px에서 완전히 사라진다. 반면 `.ambient-scrim`의 암전 스케줄은 폭 무관 고정 px(873px까지 서서히 어두워짐)라, 반경이 쪼그라드는 좁은 화면일수록 "작아진 지형 vs 그대로인 암전 구간"의 불균형이 커져 지형이 사실상 안 보이게 된다. Playwright 실측(393px)으로 스크린샷 재현·확인.

**적용 처방**: 두 레이어의 세로 반경에 `max()` 하한을 추가 — `.ambient-camera` `max(38.89vw, 380px)`(380px는 6차 이전 `@media (max-width:640px)` 오버라이드가 쓰던, 이미 실측 검증됐던 값), `.ambient-reveal` `max(43.06vw, 420px)`(두 레이어의 반경 비 43.06/38.89≈1.107을 유지해 환산). 977px(=380/0.3889) 미만 뷰포트는 하한이 바닥을 잡고, 그 이상은 기존 vw 비례가 그대로 이어진다 — 6차가 없앤 하드 브레이크포인트(640px 경계에서 공식이 뚝 바뀌던 결함)를 되살리지 않는다. `max()`는 977px 지점에서 두 곡선이 만나는 연속 함수라 끊김이 없다.

**검증**: Playwright 393/768/1440px 3개 폭 실측 스크린샷 —
- 393px: 처방 전 섬 형체가 사실상 안 보임(헤더 밑 옅은 색 번짐 한 줄) → 처방 후 지형(산·타워·빛줄기) 뚜렷이 노출
- 768px: 회귀 없음, 지형 정상 노출
- 1440px: 계산 마스크 반경 `max(38.89vw, 380px)=560.016px`(38.89vw가 이미 380px보다 크므로 하한 미적용) — 기존과 완전 동일, 픽셀 단위 회귀 없음

`verify.sh --full` 통과(Spec/TS/ESLint/단위테스트/빌드/design-lint 전부, 기존 arbitrary-value 경고 2건은 무관·불변).
