# PLAN — 사이트 리뷰 트랙 A(오탐·실오류·결함) 보완 (2026-10-08, `/sh-dev-loop --tdd --auto`)

> 기준선: `docs/plan/PLAN-site-review-remediation-2026-10-08.md` 트랙 A(A1~A6, 48건) · 검증명세 원문 `docs/review/SITE-REVIEW-patchgap.vercel.app-20261008.md`.
> ID는 `<보고서>-S#`(lol·tft·pubg·parity). 아래 SubTask는 그 48건을 코드 원인 단위로 다시 묶은 것이다.

## ① 사용자 요구사항 원문
- "위 개선대상 보완진행할건데, 1번과같은 오탐, 실 오류및 결함 내용은 별도로 진행하고, 나머지 sync나 오타, 이전잔재 등 내용은 이후 작업으로 로드맵에 갱신해줘"
- "오케이. 트랙A /sh-dev-loop --tdd --auto 진행"

## ② 확정 제약·판정 변경
- 기술 스택 고정(CLAUDE.md §기술 스택) — 신규 의존성 0. 판정 엔진(`MatchStatus`)은 건드리지 않는다. `DisplayStatus` 키 신설 없음(「지연 반영」은 상태가 아니라 **공지의 출처**로 표현한다).
- **재현 안 됨 → 제외**: `lol-S7`·`pubg-S7`(Gap 타일 → `#unannounced` 착지). 통일성 리뷰어 실측(`crawl-parity`)에서 세 게임 모두 「미공지」 칩 `aria-pressed=true`. 리뷰어가 해시 없는 `/compare/` 캡처를 착지 화면으로 오인했다. lol-S7의 「36 vs 35」는 A1(엘리스 오탐)에서 닫힌다.
- **사용자 결정과 충돌 → 범위 조정**: `pubg-S2`·`lol-S9`·`parity-S14`가 요구하는 「공지됐는데 관측 없는 대상마다 사유(변화 없음·바닥 미달)」 표시는 2026-10-07 사용자 결정(#78, 숨김 상태 건수·사유 비노출)과 정면 충돌한다. 그래서 (a) 브리핑의 **거짓 약속 문구**("어느 쪽인지는 대조표 아래 커버리지가 밝힙니다")를 실제 표시 범위로 고치고 (b) 세 대조표가 같은 커버리지 블록을 갖게 하며 (c) PUBG의 「이 데이터로 측정 불가」 축(조준 전환·반동·차량 피해)은 통계 숨김 상태가 아니라 **데이터 한계**이므로 커버리지와 무기 상세에 노출한다. 숨김 상태 건수는 여전히 말하지 않는다.
- 산출물 재생성: A1 판정 변경 뒤 `data/aggregated/gamedata/{lol,tft}/*.json`을 로컬 스냅샷으로 재생성해 커밋한다(PUBG 산출물은 판정 로직 무변경).
- `--interact`로 확인된 사실(해시 착지)은 테스트로 고정하지 않는다 — 이미 `screen-parity`가 `useFilterHash` 공통 사용을 강제한다.

## ③ SubTask (실행 순서 = 번호 순 · 전량 `[S]`)

### A1 잠수함 판정 오탐 (6건: lol-S1 · tft-S1~S4 · pubg-S1)
| ST | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-01 | [TDD] | **값 토큰 경로** — `linkedNotes` 입력에 `value?: {before, after}`를 더하고, 노트 `before⇒after` 숫자 토큰열이 변경 값과 **정확히 같으면**(토큰 ≥2) 스킬 키·필드 낱말과 무관하게 `via: "value"`로 연결. 엘리스 R 수치 `12/22/32/42 → 14/24/34/44`가 패시브 공지와 짝지어진다. 단일 숫자는 제외(「공격력 65⇒60」이 「방어력 65→60」에 걸리면 안 된다) | `src/pipeline/gamedata/note-link.ts` · `lol.ts`(effectBurn push에 value 전달) · `tft.ts` · `__tests__/note-link.test.ts` · `lol.test.ts`(26.18→26.19 실측: 잠수함 0건) |
| ST-02 | [TDD] | **과거 노트 대조 → 「지연 반영」** — `run-gamedata-diff`가 `to` 이전 패치 노트(디스크에 있는 최근 3개)를 함께 읽어 어댑터에 `priorNotes: {patch, notes}[]`로 넘긴다. 현재 노트 짝이 없을 때 과거 노트 중 (keyword·value 경로로 걸리고) **`after`가 노트의 after와 같은** 것이 있으면 `GameDataChange.priorNote = {noteId, patch}`. `isSubmarineChange` = 현재 짝 없음 **그리고** priorNote 없음. 렝가·덩굴정령(18.3)·마오카이·마스터 이 62→60(18.4) → 지연 반영. 아이템 추출 4→3·마스터 이 65→62(18.3)는 잠수함 유지(공지 값에 못 미침). 표시: 상세 「패치노트 대조」에 세 번째 구획 「이전 패치노트가 말한 것(지연 반영)」, 홈 `SubmarineSection` 출처 줄 아래 각주 1줄 | `scripts/run-gamedata-diff.ts` · `src/pipeline/gamedata/{note-link,types,diff,lol,tft}.ts` · `src/lib/gamedata.ts` · `src/components/gamedata/{SubmarineDetailBlock,SubmarineSection}.tsx` · `submarineText.ts` · 상세 3종(`LolItemDetail`·`TftUnitDetail`·`PubgWeaponDetail` — PUBG는 priorNote 없음, prop만) · `__tests__/tft.test.ts`(18.2→18.3·18.3→18.4 실측) |
| ST-03 | [TDD] | **공지값 미반영** — 필드가 **안 바뀌었는데** keyword 경로 노트가 `before == 현재값`, `after ≠ 현재값`이면 `noteMismatch{…, unapplied: true}`를 단 변경(before=after)을 낸다(TFT 유닛 `stats`·`cost`, LoL 챔피언 `stats`·아이템 keyword 필드). 렝가 18.2(노트 0.8⇒0.75, 파일 0.8 유지)가 「공지값 불일치 · 미반영」으로 보인다. 화면: `mismatchNoteText`에 「게임 파일 미반영」 | `note-link.ts`(`unappliedNoteMismatch`) · `tft.ts` · `lol.ts` · `types.ts` · `submarineText.ts` · `SubmarineDetailBlock.tsx` · `SubmarineCell.tsx` · `__tests__/{note-link,tft}.test.ts` |
| ST-04 | — | **PUBG 0건 문구** — `SubmarineSection` 0건 분기를 출처 종류로 가른다: `telemetry-grid`면 "피해 격자 추정에서 어긋난 것을 찾지 못했다 — 게임사 수치 파일이 없어 원본 전수 대조가 아니며, 격자 밖 축(조준 전환·반동·차량 피해)은 대조하지 않는다". DDragon·CDragon은 기존 문구 | `src/components/gamedata/SubmarineSection.tsx` |
| ST-05 | — | **산출물 재생성** — `pipeline:gamedata-diff`로 LoL 3쌍·TFT 3쌍 재산출. 기대: LoL 26.19 잠수함 0, TFT 18.3 잠수함 2(마스터 이·아이템 추출)·지연 2, 18.4 잠수함 1(다이애나)·지연 2, 18.2 미반영 ≥2(렝가·마스터 이) | `data/aggregated/gamedata/{lol,tft}/*.json` |

### A2 집계·수치 오류 (16건)
| ST | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-06 | [TDD] | **결론 문장 분자**(lol-S2·parity-S4) — `countAnnouncedObservedEntities(rows, qAlpha)` = 보고 자격 행이 있고 `matchedNoteIds`가 비지 않은 **대상** 수. LoL `announcedCoverage.observed`가 이것을 쓴다(≤ 분모). TFT·PUBG도 같은 함수로 통일 | `src/pipeline/shared/headline.ts` · `src/lib/headline.ts` · `LolBriefing.tsx` · `TftBriefing.tsx` · `PubgBriefing.tsx` · `__tests__/headline.test.ts` |
| ST-07 | [TDD] | **「패치 내용」 수 단일화**(lol-S3) — 탭 배지(233)와 타일 부제(231)가 다른 출처. 실측으로 차이 원인을 확인한 뒤 **화면에 실리는 고유 노트 수** 하나를 두 자리가 공유(`noteItemCount` → 렌더 기준). 과거 쌍 146 vs 181도 같은 수 | `src/components/home/releaseStream.ts`(또는 `sectionBundle.ts`) · `LolBriefing.tsx` · `StatTiles.tsx` · `__tests__/releaseStream.test.ts` |
| ST-08 | [TDD] | **카드 대표 행**(lol-S5) — `noteDeltaIndex.better`: 보고 자격·상태가 같으면 챔피언 scope=all 행 우선(`selectAnnouncedPreview`와 같은 규칙). 라인 행이 대표가 되면 `ObservationLine`에 라인 라벨 표시 | `src/components/home/noteDeltaIndex.ts` · `ReleaseNoteRow.tsx` · `__tests__/noteDeltaIndex.test.ts` |
| ST-09 | [TDD] | **표시값 정합 델타·q 표기**(lol-S20·pubg-S17) — `DeltaValue`에 `endpoints?: {before, after}`; 있으면 델타 문자열을 **표시 정밀도로 반올림한 두 끝값의 차**로 만든다(`%p`·초 둘 다). 같은 전후 표시값 → 같은 델타. q 표기는 `formatQ`를 `lib/format.ts` `fmtQ`로 옮겨 상세 게이트 행(`toExponential`·"q 0.000")도 같은 형식 | `src/lib/format.ts` · `src/components/DeltaValue.tsx` · `ReleaseNoteRow.tsx` · `DeltaTable.tsx` · `PubgMapDetail.tsx`(`fmtPpDelta`·시간) · `LolItemDetail.tsx` · `TftUnitDetail.tsx` · `streamVerdict.ts` · `__tests__/format.test.ts` |
| ST-10 | [TDD] | **Gap 탭 지표 축 = 대조표 미공지 칩**(parity-S7·tft-S18·tft-S9) — `metricGapEntities(rows, qAlpha, numericKeys)`: 수치 축 대상은 지표 축 목록에서 뺀다(한 대상은 한 섹션). 머리 숫자는 **대상 수**(= 칩). 타일 = 수치 축 + 지표 축. TFT·PUBG 적용(LoL은 스트림 구조가 달라 `metricGapCount`만 같은 함수) | `src/pipeline/shared/gap-total.ts` · `src/lib/gapTotals.ts` · `TftBriefing.tsx` · `PubgBriefing.tsx` · `__tests__/gap-total.test.ts`(신규) |
| ST-11 | [TDD] | **푸터 판정 수**(tft-S12·S17·parity-S34·pubg-S5) — `verdictCount(rows, qAlpha)` = 보고 자격 행 수(타일 「유의한 관측」과 같은 수). 세 게임 모든 `SiteFooter` 호출부가 이것을 넘긴다(TFT 696·PUBG 47 → 유의 건수) | `src/pipeline/shared/headline.ts` · 호출부 전수(`LolBriefing`·compare·detail·methodology ×3게임) · `__tests__/headline.test.ts` |
| ST-12 | — | **PUBG 맵 카드 %p·중립색**(pubg-S4) — `signedPct` 대신 `SIGNED_POINT` 포맷, 판정이 없는 맵 카드는 `text-fg-2`(초록·빨강 금지) | `src/components/pubg/PubgBriefing.tsx` · `shared.tsx` |
| ST-13 | — | **대상별 노트 항목 수**(lol-S21) — 브리핑 카드 「N개 항목」과 대조표 「N줄」이 같은 노트 id 집합을 센다(실측으로 차이 원인 확인 후 한쪽을 다른 쪽 함수로) | `src/components/home/releaseStream.ts` · `src/components/compare/noteNav.ts`(또는 `logic.ts`) |

### A4 TFT 「관측 전」 (8건: tft-S6·S7·S21~S23 · parity-S1~S3)
| ST | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-14 | [TDD] | `latestObservedTftPair(): {pair, isLatest} \| null` 프로덕션 함수(테스트 헬퍼 `observed-briefing.tsx`의 것을 lib로 승격, 헬퍼는 이것을 쓴다) | `src/lib/tftData.ts` · `src/app/__tests__/observed-briefing.tsx` · `src/lib/__tests__/tftLatestPair.test.ts` |
| ST-15 | — | **방법론은 관측과 무관하게 9슬롯**(tft-S7·parity-S1·tft-S23) — 최신이 stub이면 최신 **관측** 쌍 번들로 슬롯을 채우고 `notice`에 "최신 쌍 {from}→{to}는 관측 전 — 표본·판정 수치는 {관측 쌍} 기준". 관측 쌍이 하나도 없으면 레이아웃·푸터·이동 경로를 유지한 채 슬롯마다 사유. PUBG 방법론도 같은 규칙 | `src/app/tft/methodology/page.tsx` · `src/app/pubg/methodology/page.tsx` · `MethodologyLayout.tsx`(notice 이미 있음) |
| ST-16 | — | **관측 전 화면 골격**(parity-S2·S3·tft-S6) — `TftUnavailable`·`PubgUnavailable`에 `observedHref`(최신 관측 쌍의 같은 섹션) 링크 + `PageHeader`(이동 경로) + 푸터. `DeclarationOnly` 배너에도 같은 링크. `TftDeclarationView`: 3타일(공지 N · — · —)·2컬럼(디스코드 사이드)·탭 자리(패치 내용 = 노트 목록 · 미공지 Gap = 수치 축 + "지표 축 관측 전") | `src/components/tft/shared.tsx` · `TftBriefing.tsx` · `TftCompareView.tsx` · `TftUnitDetail.tsx` · `src/components/DeclarationOnly.tsx` · `src/components/pubg/shared.tsx` · `src/app/__tests__/declaration-only.test.tsx`(방법론·상세 케이스 추가) |
| ST-17 | — | **최신형 상세 경로 유지**(tft-S21·S22) — 최신이 stub이면 `/tft/unit/[key]`의 `generateStaticParams`는 최신 관측 쌍의 대상 키로 만들고, 페이지는 `<meta http-equiv="refresh">` + 안내 링크로 `/tft/history/{쌍}/unit/{key}`로 보낸다(정적 export라 서버 리다이렉트 없음). 공유된 `/tft/unit/…` 링크가 404로 끊기지 않는다 | `src/app/tft/unit/[key]/page.tsx` · `src/lib/pairPages.ts` · `TftUnitDetail.tsx` |

### A6 커버리지 약속 (3건: lol-S9 · parity-S14 · pubg-S2) — ② 범위 조정 참조
| ST | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-18 | — | **약속 문구 정정 + 공용 커버리지 블록** — `AnnouncedCoverageLine` 마지막 문장을 실제 표시 범위로("대조표 하단 커버리지가 노트 대상 중 관측 짝·미공지 수를 밝힙니다"). `CoverageSection`(공용)을 LoL `CoverageBar`·TFT 인라인 섹션·PUBG(없음) 셋이 쓴다. PUBG는 노트 중 **기대값 없는 조항**을 「이 데이터로 측정 불가 N조항(축 이름)」으로 한 줄 더 — 숨김 상태 건수는 말하지 않는다(#78) | `src/components/home/AnnouncedCoverageLine.tsx` · `src/components/compare/CoverageSection.tsx`(신규, `CoverageBar` 대체) · `TftCompareView.tsx` · `PubgCompareExplorer.tsx`/`PubgCompareView` · `src/app/__tests__/screen-parity.test.ts`(공용 사용 강제) |

### A3 기능·렌더 결함 (14건 − 재현 안 됨 2 = 12건)
| ST | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-19 | [TDD] | **LoL 라인 칩이 값을 바꾼다**(lol-S6) — (a) `lanesForEntityKey`: 그 라인에 **보고 자격 행**이 있을 때만 라인 소속(지금은 행이 있기만 하면 전부) (b) `ReleaseNoteStream`(client)이 선택 라인에 맞춰 카드 대표 행을 다시 고른다(`pickObservation(rows, lane)`) — 탑을 고르면 탑 행 값, 전체면 scope=all (c) 패치 내용 탭 배지 = 거른 뒤 줄 수 | `src/lib/lane.ts` · `src/components/home/noteDeltaIndex.ts` · `ReleaseNoteStream.tsx` · `ReleaseNoteRow.tsx` · `__tests__/lane.test.ts` · `noteDeltaIndex.test.ts` |
| ST-20 | — | **현재 쌍 상세는 현재 쌍만**(lol-S11) — `/lol/item/[id]`는 최신 쌍 레코드만 그린다. 최신 쌍에 없으면 「이 쌍에 판정이 없습니다」 + 과거 쌍 상세 링크 목록(별칭 URL은 디스코드 링크 보존용으로 계속 빌드) | `src/app/lol/item/[id]/page.tsx` · `src/components/detail/LolItemDetail.tsx`(`findEntity` 교차 쌍 폴백 제거) |
| ST-21 | — | **PUBG 무기 상세 「말한 것」 전부**(pubg-S3) — `matchedNoteIds` 전체를 나열, 기대값 없는 조항은 회색 + 「이 데이터로 측정 불가」. 대조표 줄 수와 같다 | `src/components/pubg/PubgWeaponDetail.tsx` |
| ST-22 | — | **무기 아이콘 9종**(pubg-S21) — 원격 파일명 별칭 표(`asset-path.ts`) 추가 후 `run-pubg-assets` 재실행으로 `public/pubg/weapon/` 보충. 원격에도 없으면 자리표시 유지 + `assets.json` 사유 | `src/pipeline/pubg/asset-path.ts` · `scripts/run-pubg-assets.ts` · `public/pubg/weapon/*` · `data/aggregated/pubg/assets.json` |
| ST-23 | — | **맵 상세 H1 겹침**(pubg-S20) — `PageHeader` title/aside 배치(baseline wrap) 수정, 1280·375 캡처로 확인 | `src/components/PageHeader.tsx` |
| ST-24 | — | **마크다운 `**` 노출**(lol-S24) — `adapterMatrixData.ts`의 `**…**` 2곳을 평문(또는 `<strong>` 렌더) | `src/components/methodology/adapterMatrixData.ts` · `AdapterMatrix.tsx` |
| ST-25 | — | **대조표 판정 열 가시**(parity-S15·lol-S8·tft-S13) — `CompareSplit` 그리드 `minmax(0,1fr)` + LoL `DeltaTable` `overflow-x-auto`·열 최소폭(TFT·PUBG와 같은 규약). 1280 기본 상태에서 판정 열이 보인다 | `src/components/compare/CompareSplit.tsx` · `DeltaTable.tsx` |
| ST-26 | — | **404 페이지 + 하이드레이션**(tft-S24) — `src/app/not-found.tsx`(한국어, 홈·세 게임 브리핑 링크). 정적 404.html은 `/_not-found`로 렌더돼 헤더가 게임 null인데 클라이언트는 실제 경로로 게임을 읽어 #418 — not-found가 인라인 스크립트로 `window.__PATCHGAP_NOT_FOUND`를 세우고 `gameFromPathname` 소비자 3곳(Header·GameRoot·AmbientBackground)이 그 플래그면 null을 쓴다(하이드레이션 1회차에 서버와 같은 값) | `src/app/not-found.tsx`(신규) · `src/components/{Header,GameRoot,AmbientBackground}.tsx` · `src/lib/game.ts` |

### A5 무근거 회색 (1건: lol-S10) + 중복 문장 (tft-S16·pubg-S24, A3에서 이관)
| ST | 태그 | 내용 | 파일 |
|---|---|---|---|
| ST-27 | — | **LLM 요약 1회·근거 등급 색**(lol-S10·tft-S16·pubg-S24) — `ObservationCauses`가 요약을 그리고 `CausesPanel`이 또 그린다 → 한 곳만. 근거가 전부 「신뢰도 낮음」·미검증이면 요약을 `text-muted`·일반 굵기로(CLAUDE.md 「무근거 문장은 회색」). PUBG 상세의 공지 요약 2회(`:234`·`:280`)도 1회 | `src/components/observation/ObservationCauses.tsx` · `src/components/causes/CausesPanel.tsx` · `PubgWeaponDetail.tsx` · `__tests__/llmCaption.test.ts` |

## ④ 라우팅 판정
- 하드 전제: git ✅ · `verify.sh` ✅(`--ts-only`·`--full` 지원) · gbc 미설치.
- **전량 `[S]`**: A1·A2·A6는 공용 모듈(`note-link`·`gap-total`·`headline`·`SubmarineDetailBlock`·브리핑 3종)을 여러 ST가 함께 고치고, A3·A4는 TFT 공용 컴포넌트를 겹쳐 쓴다. 독립 파일 후보는 ST-22·23·24·26 네 건뿐이라 worktree 격리 오버헤드가 이득을 넘는다(임계 ≥4를 겨우 채우지만 전부 10줄 내외).
- `[TDD]`: ST-01·02·03·06·07·08·09·10·11·14·19(순수 함수 + vitest). UI 렌더 ST는 절대 제외(test-after).

## ⑤ UI 설계 명세
- Ground Truth 존재 → `/frontend-design` 생략. 전부 **기존 화면 수정**이며 `docs/design/UX-BRIEF.md` §8(동등성 계약 — 8-1 골격·8-3 대조표·8-3-1 상세·8-4 방법론 9슬롯)과 `docs/design/DESIGN-TOKENS.md`·`docs/design/prototype/{01-home,02-comparison-table,03-item-detail}.html`을 따른다.
- 주 행동: 브리핑 3곳 "디스코드 방 들어가기 →"(UX-BRIEF §7-1 미커밋 백필 기준) · 그 외 없음(열람). 이번 ST는 주 행동을 바꾸지 않는다(B3 트랙).
- 색: 지연 반영 구획은 `--fg-2`(공지됨), 미반영은 기존 `--warn`, 무근거 요약은 `--muted`. 임의 색 추가 없음.

## ⑥ 명세 변경한 기존 테스트 (보고 대상 — 구현 중 추가)
- `src/pipeline/gamedata/__tests__/tft.test.ts` 「18.1→18.2 불일치 = [마오카이·덩굴정령·어미 부리]」 → `!noteMismatch.unapplied` 필터로 좁힘(ST-03이 「미반영」 행을 같은 축에 더한다). 잠수함 31건 단언은 불변.
- `src/components/home/__tests__/{logic,render}.test.ts(x)` — `HeadlineStats`에 `announcedObservedCount` 추가(ST-06)로 픽스처·`toEqual` 기대 객체에 필드 추가.
- `src/components/compare/__tests__/render.test.tsx` 「▼ −10.8%p」 → 「▼ −10.9%p」(ST-09: 델타 = 표시된 끝값 55.4%→44.5%의 차).
- 범위 이관: `lol-S21`(카드 「N개 항목」 vs 내비 「N줄」)은 틀린 수가 아니라 **다른 단위·다른 라벨**(카드 = 펼치면 나오는 줄 수, 2026-09-23 화면 대조 V2 계약 · 내비 = 노트 줄) → 트랙 B1. ST-13은 수행하지 않는다.
- 태그 조정: ST-07 `[TDD]` 해제(한 줄 전달 — 3-AND (c) 불충족).
- `src/components/compare/__tests__/render.test.tsx` 「노트 0엔티티(0항목)」 → 「노트 0대상(0항목)」(ST-18: 커버리지가 공용 `CoverageSection`으로 바뀌며 어휘가 사용자 말 「대상」으로 통일 — parity-S16의 일부가 함께 닫힘).
- `src/lib/__tests__/lane.test.ts` `stubRecord`를 전체 `DeltaRecord`(보고 자격 있음)로 — `lanesForEntityKey`가 자격을 보게 된 ST-19 명세 변경. 라인 도출 규칙 케이스는 그대로 통과.
- 부분 수행: ST-16의 「`PubgUnavailable`에 observedHref」는 하지 않았다 — 정확한 사유(acceptance-critic 정정): PUBG는 관측 쌍은 있으나 **과거 쌍(history) 라우트 자체가 없어** 관측 전일 때 보낼 다른 쌍 주소가 없다. 이동 경로(`crumbs`)는 FIX 1회차에서 추가.
- FIX 1회차(acceptance·scope 지적): 404 복귀 링크를 `<a>`(전체 로드)로 — `<Link>`면 `NOT_FOUND_FLAG`가 window에 남아 다음 화면도 게임 null. 고아 ID tft-S8(상위 PLAN A2에 있었으나 ③에 누락): TFT·PUBG 「패치 내용」 탭 배지 = 노트 항목 수(부제와 같은 수), 대조 카드 머리 = 「대상 N종」(결론 문장 분자와 같은 함수), TFT 커버리지 「관측 짝」 = 같은 함수 — 네 숫자 중 같은 개념은 같은 수, 다른 개념(항목/대상)은 라벨이 다르다. ST-22는 9종 중 7종(JS9·RPD는 api-assets 전체에 없음). ST-23·ST-25·ST-26의 렌더 확인(캡처·콘솔)은 `--ui` 미지정이라 미실측 — Phase 3 빌드 산출물 grep으로 1차 확인.
- `src/components/observation/__tests__/observationModel.test.ts` — 판정 파일 필터를 `{from}_{to}.json` 패턴으로(사전 결함: 로컬 `*.notify.json`을 순회해 `rows is not iterable`). 테스트 약화 아님.
