# VERIFY-SPEC — 트랙 B ST-15 패치노트 원문 링크 (parity-S13)

- 변경 요약: `AnnouncedCoverageLine`에 `sourceUrl` — 커버리지 줄 아래 「패치노트 원문 보기 ↗」(공용 소유). LoL `notes.meta.sourceUrl`·TFT `notes.sourceUrl`·PUBG 기존 앵커(`noteSource`)를 넘긴다. PUBG 인라인 사본 제거.
- 검증: `wording.test.ts` 가드(공용 소유·세 브리핑 전달·PUBG 사본 0).
- 미확인 사항: LoL 패치 내용 탭은 라인 필터·탭 상태에 따라 커버리지 줄이 `tab === "content"`일 때만 — 원문 링크도 같은 조건(세 게임 모두 패치 내용 탭에서만, 같은 자리).
