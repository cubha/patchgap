### VERIFY-SPEC — SubTask ST-4
- 기준선 요구사항: "미사용 export 6건 제거(PubgPageHeader·TftPageHeader·TftMetricCaption·gameDataEntityCount·noteAnchorHash·TELEMETRY_RETENTION_HOURS) + 앵커 해시 이중 구현 정리"
- 변경 파일: components/pubg/shared.tsx · components/tft/shared.tsx · lib/gamedata.ts · pipeline/shared/excluded-notes.ts · pipeline/collect/pubg/api.ts
- 관찰 가능한 계약: 6심볼 grep 0, tsc·eslint 통과, 화면 HTML 불변
- 구현 결정: 앵커 해시는 noteAnchorHash 삭제로 mode-scope.anchorHashOf 단일화. 336시간 보존창 사실은 api.ts 헤더 주석·patch-calendar 주석에 남아 있다
- 인접 경계: 없음(참조 0)
- 미확인 사항: 없음
