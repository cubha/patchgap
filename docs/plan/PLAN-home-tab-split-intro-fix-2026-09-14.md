# PLAN — 홈 스트림 탭 분리 + 앰비언트 인트로 매 로드 재생 (2026-09-14)

생성: 2026-09-14 · planner 위임 산출(opus) + 메인 세션 검수(NoteNavigator.tsx 실사 확인 후 탭 배치 A안 확정)

## 사용자 요구사항 원문

> 그리고 지금 목록 출력 방식을 좀 바꾸고싶어.
> 패치내용을 메인에서 즉시 확인할 수 있도록 --> 탭전환하면 패치내용에는 없는 Gap을 보여줄 수 있도록 하는게 맞을거같아.
>
> 추가로 지금 웹에서 열엇을때 아무리 새로고침해도 초기 영상이 재생이안되는거같은데 이것도 확인해서 정상화 진행해줘.
>
> /sh-dev-loop --tdd --auto 진행하고 탭전환 view에 대해서 아티팩트로 시안확인하고 진행해

후속: 아티팩트(https://claude.ai/code/artifact/54216707-2027-47bb-bfda-3d3601ecf6f4) 확인 후 사용자 응답 — **"A로 진행."** (탭 스타일 A = 밑줄 방식, Header.tsx nav 톤)

## 확정 제약

- 탭 스타일 A(밑줄, `border-b-2` + 활성 `border-accent text-fg` / 비활성 `border-transparent text-muted`)
- 기본 활성 탭 = "패치 내용"(공지). 영속 상태 불필요(새로고침 시 기본값 리셋 의도)
- 패치 내용 탭 = 노트 원본 문서 순서, Gap 탭 = |delta| 내림차순 — 둘 다 기존 정렬 로직 그대로
- 라인 필터는 두 탭 모두 동일 적용
- 하단 "간접 영향" 섹션은 이번 변경 범위 밖
- 인트로 영상: localStorage 영구 1회 게이트 제거 → 매 F5(하드 로드)마다 재생. `introEnded`(재생 종료 후 정지) 로직은 유지 — 새 분기 추가 없이 삭제만으로 달성(아래 SubTask A 근거)

## 탭 배치 — NoteNavigator.tsx 실사 확인으로 A안 확정 (메인 세션 검수)

planner는 아티팩트를 열 수 없어(인증 대상) 배치를 A/B 두 안으로 남겼다. 메인 세션이 `/mnt/d/workspace/patchgap/src/components/compare/NoteNavigator.tsx:54~73`을 직접 읽어 확인한 결과, `/compare/` 페이지가 **이미 동일한 탭 패턴을 패널 내부 최상단에 구현 중**이다:
```tsx
<section className={`${panelSurfaceClass("glass")} overflow-hidden rounded-lg`}>
  <div className="flex gap-2 px-5 pt-4" role="tablist" aria-label="패치노트 섹션">
    <button type="button" role="tab" aria-selected={isActive}
      className={`border-b-2 px-1 py-2 text-xs font-bold ${isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg-2"}`}>
      {section.label} {count}
    </button>
  </div>
  <ul className="overflow-y-auto">...</ul>
</section>
```
채택 근거:
1. `StreamColumnLayout.tsx`의 row1(`leftHeader`=라인필터)/row2(`left`=스트림, `right`=우측컬럼) 그리드 정렬 불변식(2026-09-12 4차 R2)이 "row2 최상단이 좌우 동일 y"를 요구한다. 탭을 `left` 패널(row2) **내부** 최상단에 두면 이 불변식이 자동 보존된다 — 패널 바깥에 별도로 얹으면 row2 상단이 다시 밀려 R2가 고친 결함이 재발한다.
2. 사이트 안에 이미 존재하는 탭 패턴과 동일한 DOM 구조(`role="tablist"`/`role="tab"`/`aria-selected`)를 재사용 — 같은 사이트에서 한쪽 탭만 시맨틱이 다르면 접근성 일관성이 깨진다. 라벨+카운트 병기(`{label} {count}`)도 동형이라 그대로 따른다. NoteNavigator가 생략한 것(`aria-controls`, `role="tabpanel"`)도 동일하게 생략 — 그 이상은 과설계.
3. 아티팩트가 보여준 것은 "밑줄 스타일 자체"(시각 언어)였지 "패널 안/밖 배치"가 아니었다 — 스타일 A 승인은 그대로 유효하고, 배치만 기존 코드 전례로 더 정확히 맞춘다.

부수 반영 사항(A안 채택 시 필요, SubTask 2에 포함):
- `panelSurfaceClass("glass")`를 현재 스크롤 `<ul>`(ReleaseNoteStream.tsx:77)에서 비스크롤 `<section>` 래퍼로 이동 — 골드 레일이 탭 위로 올라가고 "프레임 vignette" 동작이 사라짐. 관련 주석(72~75행) 갱신.
- `.panel-surface-glass .text-muted { color: var(--fg-2) }`(panel.css:61)는 후손 선택자라 래퍼 이동해도 그대로 적용 — 대비 회귀 없음.

## SubTask 목록

```
[Task] 홈 스트림 탭 분리 + 앰비언트 인트로 매 로드 재생   라우팅: 전량 [S] 순차

  [S] SubTask A: 인트로 localStorage 게이트 제거(매 페이지 로드 재생)
        → src/components/AmbientBackground.tsx

  [S] SubTask 1: [TDD] releaseStream 인터리브 제거 → matched/unannounced 완전 분리(concat 계약)
        → src/components/home/releaseStream.ts
        → src/components/home/__tests__/releaseStream.test.ts

  [S] SubTask 2: 탭 UI("패치 내용"/"미공지 Gap", NoteNavigator 패턴 재사용) + 카운트 배선
        → src/components/home/ReleaseNoteStream.tsx
        → src/app/page.tsx
        → src/components/home/__tests__/render.test.tsx (기존 100~135행 케이스 수정 포함)
```

## 실행 순서

1. SubTask A (독립, 소규모) → `verify.sh --no-build` → 커밋
2. SubTask 1 (RED→GREEN, concat 계약) → `npm run test` → `verify.sh --no-build` → 커밋
3. SubTask 2 (탭 UI, NoteNavigator 패턴) → `verify.sh --full` → Playwright 실측 → 커밋

`verify.sh`가 repo 전역 검사(tsc/eslint/vitest/build 트리 전체)라 파일 교집합이 없어도 동시 실행 시 서로의 과도기 상태를 오염시킨다 — worktree 분리는 SubTask A의 규모(~15줄 삭제) 대비 이득이 없어 **전량 [S]**.

## releaseStream.ts 계약 결정 (SubTask 1)

`buildReleaseStream()` 반환 타입을 `ReleaseStreamGroup[]` **그대로 유지**하고 `[...matched, ...unannounced]`로 concat한다(`{matched, unannounced}` 객체 분리 안 기각). 근거: concat 안은 SubTask 1이 `page.tsx`/`ReleaseNoteStream.tsx`를 전혀 건드리지 않아 SubTask 경계에서 독립적으로 `verify.sh` green이 성립한다. `ReleaseNoteRow`가 이미 `ReleaseStreamGroup` 유니온을 받으므로 상위 필터는 `entry.group.kind === "matched"` 한 줄로 충분.

`interleave()` 삭제의 계약상 의미: 기존 인터리브는 "미공지를 스트림 최상단에 최소 1건 승격"해 HANDOFF §1-1 "패치노트 요약 사이트로 오인 금지" 불변식을 지키는 장치였다. 탭 분리가 그 불변식을 **다른 방식으로 대체**한다 — Gap이 독립 탭+카운트 배지로 상시 노출되므로 끼워넣기가 불필요해진다.

RED 절차: 인터리브 전용 단언(균등분산·슬롯0 강제)을 **인덱스 위치가 아닌 3개 불변식**으로 재작성 — ① matched 필터 순서==노트 문서 순서 ② unannounced 필터 순서==|delta| 내림차순 ③ 어떤 unannounced도 어떤 matched보다 앞서지 않음.

## 카운트 배지 소스 (실측 확정, SubTask 2)

`headline.noteItemCount`(181) / `headline.unannouncedCount`(65) — `page.tsx`의 기존 `computeHeadline()` 결과 그대로 재사용(새 집계 금지). `data/aggregated/notes/26.18.json.itemCount=181`, `26.17_26.18.json`의 `status==="unannounced"` 행 65건과 실측 일치, `HeroSummary`("공지된 변화 181개 항목"/"미공지 65")와 화면 간 정합.
**의도된 트레이드오프**(VERIFY에서 결함으로 보고하지 말 것): 배지는 *항목/행* 단위(181/65)인데 렌더되는 카드는 *엔티티 그룹* 수 — 사용자 확정 시안 수치·기존 HeroSummary와 일치하는 쪽을 유지.

## SubTask 2 완료 조건 (누락 주의)

- **빈 상태에서도 탭 바는 항상 렌더**되어야 한다 — 현재 `ReleaseNoteStream.tsx:63~70`의 `filtered.length===0` early return을 그대로 쓰면 빈 탭에서 못 돌아온다. 탭 행은 무조건 렌더, 리스트 본문만 문구로 교체.
- 빈 상태 문구: content 탭="이 라인에서는 관측된 변화가 없습니다"(기존 유지) / gap 탭="이 라인에서는 미공지 변화가 없습니다"(신규).
- 기존 테스트 `render.test.tsx:100~135`("라인 엔티티 카드 아이콘")가 기본 탭(content)에서 unannounced 엔트리가 필터링돼 깨진다 — gap 탭 클릭 후 단언하거나 matched 엔트리로 교체(SubTask 2 범위 포함, 조용히 약화 금지 — 계약 변경 사유를 테스트 주석에 남길 것).

## SubTask A 결정 — "매 홈 진입" 대신 "마운트당 최대 1회"

`introEnded`는 리셋되지 않는 기존 로직이라(요구사항이 유지를 명시), localStorage만 삭제하면 자동으로 "페이지 로드(마운트)당 최대 1회, 홈에서 최초 enabled 시" 의미론이 된다 — F5→재생 ✅(확정 요구), `/compare/` 딥링크 후 클라이언트 네비로 홈 최초 진입→재생 ✅, 홈↔`/compare/` 왕복 복귀→미재생 ✅(과도한 반복 재생 방지, 요구사항 #3 우려 해소). 새 분기 추가 없이 삭제만으로 세 조건 동시 만족 — "매 진입마다"를 택하려면 `introEnded`까지 리셋해야 해서 요구 #1("introEnded 로직 유지")과 충돌하므로 미채택.

## Ground Truth

- `docs/design/DESIGN-TOKENS.md`, `src/styles/tokens.css`
- 매칭 전례: `src/components/compare/NoteNavigator.tsx`(탭 DOM/스타일 1:1 재사용), `docs/design/prototype/01-briefing-home.html`(홈 전체 구조)
- `/frontend-design` 호출 불필요 — 신규 시각 요소 0(전례 verbatim 재사용)

## TDD 태그

- SubTask A: 미적격(삭제 위주 ~15줄, 3-AND 중 (c) 비자명 미충족)
- SubTask 1: **[TDD]** 적격 — 순수 함수(부수효과 0)·vitest 존재·비자명(정렬/그룹핑 불변식 3개)
- SubTask 2: 미적격(UI 렌더링, tdd-gate 절대제외) — test-after
