# VERIFY-SPEC — 트랙 B ST-1 메타·SEO (lol-S25·S26·S27·S28 · tft-S25·S26·S27 · parity-S30·S31 · pubg-S25 · lol-S29 title)

- 변경 요약: `src/lib/meta.ts` `pageMeta`(title 틀 `{대상|화면} · {게임}[ 쌍]` + template `%s · patchgap`, 게임명 `gameLabel` 단일 출처, description 라우트별, og{title,description,url,images} + canonical). 루트 `metadataBase`·게임 중립 description. 게임 라우트 21개 page.tsx 전부 `pageMeta`. 랜딩 절대 title. 404 「페이지 없음」. `app/robots.ts`·`app/sitemap.ts`(force-static, 주소 = `lib/sitemap.ts` — 라우트와 같은 자격 함수). og PNG 4장(`public/og/`, Noto Sans KR + 키아트, 1200×630). TFT 증강판 상징 이름 「(증강)」(`tftDisplayName`) — title 중복 실측에서 발견.
- 구현 결정:
  - 최신 브리핑·대조표·방법론 title에는 쌍을 넣지 않는다(쌍은 헤더 선택기, 2026-09-21 결정). 상세·과거 쌍 화면은 쌍을 넣는다.
  - LoL 상세 **별칭**(구 지표 경로, 디스코드 링크 보존용)은 정준 대상과 title이 같다 — canonical·og:url이 정준 주소를 가리키고 sitemap에서 뺀다. 「title 중복 0」은 정준 라우트 기준으로 측정(빌드 실측: 별칭·404 사본 제외 중복 0).
  - og 이미지는 정적 PNG(신규 의존성 0, `next/og`는 한글 폰트 번들 문제). PUBG 키아트는 마케팅 자산(비영리·출처) — 사이트가 이미 쓰는 이미지.
  - 404 canonical 없음(Next가 404에 noindex 자동).
- 검증: `meta.test.ts` 11 · `route-meta.test.ts`(게임 page.tsx 전부 pageMeta·메타 리터럴 금지·루트 description 게임 중립·robots/sitemap/og 존재) · 빌드 실측 robots 200·sitemap 502 loc·TFT description 「LoL」 0·og·canonical 전 라우트.
- 미확인 사항:
  - 프로덕션 Vercel에서 `/robots.txt`·`/sitemap.xml` 응답 content-type(정적 export 산출 파일 그대로 서빙 예상).
  - 실제 공유(디스코드·카카오) 미리보기 렌더는 배포 후에만 확인 가능.
  - sitemap에 TFT 최신 상세는 최신 쌍이 관측됐을 때만 넣는다 — 관측 전 쌍 전환 시 경로 수가 줄어드는 것은 의도.
