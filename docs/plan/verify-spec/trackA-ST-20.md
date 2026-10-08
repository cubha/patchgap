### VERIFY-SPEC — SubTask ST-20 (현재 쌍 상세는 현재 쌍만)
- 기준선 요구사항: "`/lol/item/[id]`는 최신 쌍 레코드만 그린다. 최신 쌍에 없으면 「이 쌍에 판정이 없습니다」 + 과거 쌍 상세 링크 목록(별칭 URL은 디스코드 링크 보존용으로 계속 빌드)" (PLAN ST-20 · 리뷰 lol-S11)
- 변경 파일: `src/app/lol/item/[id]/page.tsx`(재작성 — `pairs=[latest]`, `otherPairs=past`) · `src/components/detail/LolItemDetail.tsx`(수정 — `otherPairs` prop, `EmptyState` 링크 목록)
- 관찰 가능한 계약: `/lol/item/item~3124/`(구인수, 26.19에 판정 없음)가 26.17→26.18 데이터 대신 「이 패치 쌍에는 이 대상의 판정이 없습니다. 판정이 있는 쌍: 26.17 → 26.18 상세 →」(`[data-elsewhere]`)를 그린다. 최신 쌍에 있는 대상은 종전과 같다.
- 구현 결정: `findEntity`의 쌍 내 우선순위(보고 자격 → 판정 → 아무 행)는 손대지 않았다 — 입력 쌍을 하나로 줄였을 뿐. `generateStaticParams`는 전 쌍 합집합 그대로(경로를 줄이면 옛 링크가 404).
- 인접 경계: 과거 쌍 상세(`/lol/history/[pair]/item/[id]`)는 원래 그 쌍 하나를 넘기므로 불변. `EmptyState`의 `AmbientDetailSplash` 초기화 유지.
- 미확인 사항: 빈 상태 화면이 헤더·푸터 골격을 갖는지(기존 EmptyState도 없었다) — 범위 밖으로 두었다. 별칭(구 지표 id) 슬러그에서 `rawId`가 `champion:X:metric` 형태일 때 `key` 추출(앞 2세그먼트)이 맞는지는 `findEntity`와 같은 규칙을 복사한 것이라 동치.
