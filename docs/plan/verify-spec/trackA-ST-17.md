### VERIFY-SPEC — SubTask ST-17 (최신형 상세 경로 유지)
- 기준선 요구사항: "최신이 stub이면 `/tft/unit/[key]`의 `generateStaticParams`는 최신 관측 쌍의 대상 키로 만들고, 페이지는 `<meta http-equiv=refresh>` + 안내 링크로 `/tft/history/{쌍}/unit/{key}`로 보낸다" (PLAN ST-17 · 리뷰 tft-S21·S22)
- 변경 파일: `src/app/tft/unit/[key]/page.tsx`(재작성) · `src/components/tft/TftObservedRedirect.tsx`(신규)
- 관찰 가능한 계약: 18.4 stub 상태에서 `/tft/unit/unit~DA_18_Rengar/`가 빌드되고(18.2→18.3의 대상 키), 본문에 `meta[http-equiv=refresh]` → `/tft/history/18_2-18_3/unit/unit~DA_18_Rengar/` + 같은 링크. 최신이 관측되면 종전처럼 최신 쌍 상세.
- 구현 결정: 서버 리다이렉트 없음(정적 export, `vercel.json`은 쌍을 모른다). React 19가 본문 `<meta>`를 head로 올린다는 사실에 기댄다. 정준 슬러그만(별칭 없음 — TFT는 별칭 체계가 없다).
- 인접 경계: `tftDetailRows`(대조표와 같은 행 집합) 재사용. `_placeholder`는 관측 쌍이 하나도 없을 때만.
- 미확인 사항: `<meta httpEquiv="refresh">`가 Next 16 정적 export에서 head로 호이스팅되는지 **빌드 산출물로 확인하지 않았다**(Phase 3 `verify.sh --full`의 빌드 뒤 `out/tft/unit/*/index.html`을 grep해 확인할 것).
