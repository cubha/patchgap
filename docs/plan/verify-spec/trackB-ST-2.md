# VERIFY-SPEC — 트랙 B ST-2 PUBG 슬러그 = 화면 이름 (pubg-S18)

- 변경 요약: `weaponSlug` = `weaponDisplayName` 기반(hk416→m416·saiga12→s12k·g18→p18c·vz61skorpion→skorpion·fnfal→slr), `mapSlug` = `PUBG_MAPS[key].slug`(명시 필드: erangel·miramar·taego·deston·rondo·vikendi·sanhok·karakin·paramo·erangelclassic·haven·campjackal). `pubgLegacyRedirects` → `vercel.json` 리다이렉트 32건(16키 × 슬래시 유무, 비영구 — `legacy-redirects.test.ts` 규약).
- 구현 결정:
  - 맵 슬러그를 `assetName`에서 유도하지 않는다 — `Baltic_Main`과 `Erangel_Main`이 같은 자산명이라 충돌.
  - **구 주소가 다른 대상의 새 주소와 겹치면 리다이렉트를 만들지 않는다**(구현 중 실측: 구 `Erangel_Main` 슬러그 「erangel」 = 에란겔 새 슬러그. Vercel 리다이렉트는 정적 파일보다 먼저라 그 화면을 가렸을 것). 대가: 구 `Erangel_Main`(데이터에 없는 맵)의 옛 주소는 이제 에란겔 화면을 연다.
  - 리다이렉트 대상 키 = 표기명 예외가 있는 무기 전부 + 등록 맵 전부(디스코드로 나간 무기 링크를 개별 추적할 수 없어 전수).
- 명세 변경 테스트: `pubgRoutes.test.ts` — `mapSlug("Baltic_Main")` "baltic"→"erangel", `mapHref` 기대값. 근거: pubg-S18 수용기준(슬러그 = 표시 이름).
- 미확인 사항: 로컬 `out/` 정적 서빙은 `vercel.json`을 읽지 않아 구 주소 리다이렉트는 배포 후에만 실측 가능. 디스코드에 실제로 나간 무기 링크 목록은 페이로드 미보존으로 확인 불가.
