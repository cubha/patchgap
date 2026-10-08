### VERIFY-SPEC — SubTask ST-15 (방법론은 관측과 무관하게 9슬롯)
- 기준선 요구사항: "최신이 stub이면 최신 **관측** 쌍 번들로 슬롯을 채우고 `notice`에 '최신 쌍 {from}→{to}는 관측 전 — 표본·판정 수치는 {관측 쌍} 기준'. 관측 쌍이 하나도 없으면 레이아웃·푸터·이동 경로를 유지한 채 슬롯마다 사유. PUBG 방법론도 같은 규칙" (PLAN ST-15 · 리뷰 tft-S7·parity-S1·tft-S23)
- 변경 파일: `src/app/tft/methodology/page.tsx`(수정) · `src/app/pubg/methodology/page.tsx`(수정) · `src/components/methodology/slots.ts`(수정 — `allUnusedSlots`) · `src/components/ObservationPendingNotice.tsx`(신규, 공용) · `src/lib/pairRoutes.ts`(수정 — `pairSectionLink`)
- 관찰 가능한 계약: `/tft/methodology/`가 18.3→18.4 stub 상태에서 9슬롯 전부를 18.2→18.3 번들로 그리고, 머리 아래 `role=status` 배너에 "관측 대기 … 아래 표본·판정 수치는 관측이 있는 최신 쌍 18.2 → 18.3 기준입니다" + 그 쌍 브리핑 링크. 관측 쌍 0이면 9슬롯이 전부 같은 사유 문장. PUBG는 관측 쌍 0 분기만(과거 쌍 없음).
- 구현 결정: 쌍별 방법론 라우트(tft-S23)는 만들지 않았다 — nav가 가리키는 `/tft/methodology/`가 채워지므로 "존재하는 방법론으로만 연결"이 충족된다. `Container` 직접 사용 제거(레이아웃이 소유).
- 인접 경계: `MethodologyLayout.nVerdicts: null` 허용 ✓. 디스코드 패널 「무엇이 언제 나가나」 링크(`#discord` 앵커)가 이제 실재하는 슬롯에 착지.
- 미확인 사항: 렌더 테스트(`declaration-only.test.tsx`)에 방법론 케이스는 아직 없다 — Phase 3에서 추가 여부 판단(ST-16 명세에 "방법론·상세 케이스 추가"가 있어 ST-16에서 쓴다).
