### VERIFY-SPEC — SubTask ST-22 (무기 아이콘 9종)
- 기준선 요구사항: "원격 파일명 별칭 표(`asset-path.ts`) 추가 후 `run-pubg-assets` 재실행으로 `public/pubg/weapon/` 보충. 원격에도 없으면 자리표시 유지 + `assets.json` 사유" (PLAN ST-22 · 리뷰 pubg-S21)
- 변경 파일: `src/pipeline/pubg/asset-path.ts`(수정 — `remoteWeaponUrlCandidates`) · `scripts/run-pubg-assets.ts`(수정 — 폴더 후보 순회) · `public/pubg/weapon/*.png`(+7) · `data/aggregated/pubg/assets.json`(재생성)
- 관찰 가능한 계약: 매니페스트 `weapons` 45/47, `missing` = JS9·RPD(HTTP 404). 데저트 이글·G18·M79·M9·나강·소드오프·스콜피온 아이콘이 브리핑·대조표·상세에 보인다.
- 구현 결정: 별칭 표 대신 **폴더 후보**(Main → Handgun → Melee)로 풀었다 — 실측에서 파일명은 같고 폴더만 달랐다(`Assets/Item/Weapon/Handgun/`). 키로 폴더를 맞히는 표는 금방 틀린다.
- 인접 경계: `publicWeaponPath`(브라우저 경로) 불변. `run-pubg-assets`는 빌드 이전 스크립트(런타임 외부 호출 0 원칙 유지). CI 워크플로가 이 스크립트를 부르는지 확인하지 않았다(수동 실행 산출물을 커밋).
- 미확인 사항: JS9·RPD는 api-assets 전체(세 폴더)에 없다 — 자리표시(이니셜)가 남는다. 리뷰 「9종 전부」는 **7종만 닫힘**.
