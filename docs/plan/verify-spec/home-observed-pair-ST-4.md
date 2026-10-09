# VERIFY-SPEC ST-4 — NewerPatchNotice(공용 배너) · DeclarationHero 캡션 「공지 N건」 제거 + eta · ObservationPendingNotice eta
PLAN: docs/plan/PLAN-home-observed-pair-2026-10-09.md

- 변경 파일: src/components/NewerPatchNotice.tsx · src/components/DeclarationOnly.tsx · src/components/ObservationPendingNotice.tsx
- 구현 결정:
- 배너 문구: 「{to} 패치노트가 반영됐습니다({N}개 항목). 관측·판정은 {eta}부터 시작합니다. {to} 패치노트 보기 →」. 내부 href는 Link, http(s)면 ExternalLink(「원문 ↗」).
- ObservationPendingNotice는 `awaiting-observation`일 때만 날짜를 덧붙인다(키 만료·크래시는 날짜가 답이 아니다).
- 선언 히어로 캡션을 「{from} → {to} · 관측 전」으로 — 결정 7(대상 수·값 수 나란히 금지).
- 미확인 사항:
- ExternalLink는 data-* 속성을 <a>에 전달하지 않는다 — PUBG 외부 링크에는 `data-newer-patch-link`가 안 붙는다(테스트는 TFT 내부 링크만 본다).
- 배너가 모바일 375에서 히어로 아래 한 줄 더 차지 — D-UX-04(주 행동 첫 화면)는 MobileActionBar가 담당하므로 영향 없음(UI 게이트로 확인).
