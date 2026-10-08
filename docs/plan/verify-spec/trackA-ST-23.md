### VERIFY-SPEC — SubTask ST-23 (맵 상세 H1 겹침)
- 기준선 요구사항: "`PageHeader` title/aside 배치(baseline wrap) 수정, 1280·375 캡처로 확인" (PLAN ST-23 · 리뷰 pubg-S20)
- 변경 파일: `src/components/PageHeader.tsx`(수정)
- 관찰 가능한 계약: `titleAside`가 있을 때 h1에서 `text-balance`를 빼고, aside는 `shrink-0 whitespace-nowrap`. 리뷰 캡처(`15-pubg_map_baltic_-desktop-fold.png`)에서 「에란겔」 글자가 「맵 · 8×8」 위를 덮던 것이 사라져야 한다.
- 구현 결정: 원인 가설 = flex 안 `text-wrap: balance`가 상자 너비를 글자 폭보다 좁게 잡아 뒤 요소가 글자 위로 온다(Chromium). 가설이라 **캡처로 확인하지 못했다** — PLAN은 "1280·375 캡처로 확인"을 요구하는데 이 파이프라인은 `--ui` 미지정이라 렌더 캡처 축이 없다.
- 인접 경계: `PageHeader`는 세 게임 대조표·상세·방법론 공용 — aside 없는 화면은 `text-balance` 그대로(변화 0).
- 미확인 사항: **겹침 해소 미실측**. Phase 3 뒤 `dev-server.sh` + probe 캡처 1장으로 확인하거나, 사용자 배포 후 확인이 필요하다. 가설이 틀리면 `.ambient-hero-headline`(text-shadow)·폰트 메트릭을 다음 후보로.
