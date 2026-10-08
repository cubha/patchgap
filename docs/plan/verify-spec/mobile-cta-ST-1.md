# VERIFY-SPEC mobile-cta ST-1 — DiscordCta 추출 + MobileActionBar
- 변경 파일: `src/components/home/DiscordPanel.tsx`(DiscordCta·discordRulesHref export, 패널은 같은 버튼을 w-48로), `src/components/home/MobileActionBar.tsx`(신규), `src/components/home/__tests__/MobileActionBar.test.tsx`(RED 선커밋 44355c1)
- 구현 결정: 버튼 한 벌을 두 곳이 공유(라벨·href 동일 보장) · fixed 바 + 같은 높이(h-16) 인-플로우 스페이서 · `nav aria-label="주 행동"` · `min-h-11`(44px) · `lg:hidden` · z-30(헤더 z와 충돌 없는지 확인 필요)
- 테스트 변경(보고): RED 테스트의 href 완전일치 `/tft/methodology/#discord`를 `toContain("/tft/methodology")+"#discord"`로 — 트레일링 슬래시가 Next 설정 산물이라는 DiscordPanel.test의 기존 사유와 동일. 약화 아님.
- 미확인 사항: 헤더(sticky top)와 바의 z-index 우선순위 · PUBG 관측 전 선언 뷰엔 바를 두지 않음(PLAN ②) — 게이트가 그 라우트 상태에서 D-UX-04를 울릴 수 있으나 현재 데이터엔 없음 · 바 높이 h-16(64px)와 실제 렌더 높이(py-3 + min-h-11 = 68px?) 불일치 가능 → 스페이서가 4px 모자랄 수 있음
