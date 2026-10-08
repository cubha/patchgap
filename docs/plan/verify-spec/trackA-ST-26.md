### VERIFY-SPEC — SubTask ST-26 (404 페이지 + 하이드레이션)
- 기준선 요구사항: "`src/app/not-found.tsx`(한국어, 홈·세 게임 브리핑 링크). … not-found가 인라인 스크립트로 `window.__PATCHGAP_NOT_FOUND`를 세우고 `gameFromPathname` 소비자 3곳이 그 플래그면 null을 쓴다" (PLAN ST-26 · 리뷰 tft-S24)
- 변경 파일: `src/app/not-found.tsx`(신규) · `src/lib/game.ts`(수정 — `NOT_FOUND_FLAG`, `gameFromPathname`이 플래그를 본다)
- 관찰 가능한 계약: `/tft/없는경로/` → 한국어 404(「이 주소에는 화면이 없습니다」) + 홈·LoL·PUBG·TFT 브리핑 링크 + 푸터. 콘솔 React #418 0건(헤더·`data-game`·배경이 서버와 같은 "게임 없음"으로 하이드레이션).
- 구현 결정: 소비자 3곳(Header·GameRoot·AmbientBackground)을 각각 고치지 않고 `gameFromPathname` **한 곳**에서 플래그를 본다 — 소비자가 늘어도 같은 규칙. 인라인 `<script>`는 파싱 즉시 실행이라 하이드레이션보다 앞선다. 플래그는 전역 1개(`window.__PATCHGAP_NOT_FOUND`).
- 인접 경계: `gameFromPathname`은 서버에서도 불린다(`typeof window` 가드). 정상 페이지에는 플래그가 없어 동작 불변. `screen-parity`가 `src/app/**/page.tsx`만 훑으므로 `not-found.tsx`는 대상 밖.
- 미확인 사항: **#418 해소를 브라우저에서 재현하지 않았다**(정적 빌드 + 실제 404 경로 로드 필요). Phase 3 빌드 뒤 `out/404.html`에 스크립트가 들어 있는지 grep으로 1차 확인, 콘솔 0은 배포 후 크롤로 확인.
