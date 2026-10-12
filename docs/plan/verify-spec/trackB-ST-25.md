# VERIFY-SPEC — 트랙 B ST-25 경계 판정 표기 (pubg-S13 · §8 동등성으로 세 게임)

- 변경 요약: `pipeline/shared/boundary.ts` — `isBoundaryRecord`(LoL·TFT: 지표별 바닥을 CI의 0에 가까운 끝에 다시 건다), `isBoundaryPubgRow`(PUBG: `conservativeEffect(relCi) < effectFloor`, 정렬 키와 같은 값). `BoundaryMark`(테두리·muted 「경계」 + title) — 세 대조표 판정 칸(엔티티 행은 그린 지표 셀 전부가 경계일 때), 상세 머리 3종. `METRIC_VERDICTS`(지표 축 판정만 — 수치 축은 CI가 없다). 세 방법론에 같은 문장 `BOUNDARY_RULE`.
- 구현 결정: 판정·산출물 무변경(표시 계층). 세 게임 적용(감사의 「PUBG만 vs 세 게임」 질문은 §8 동등성 계약으로 판단 — PLAN ST-25에 명시).
- 부수 수정: ST-10이 주석 쪽 「홈 카드」를 바꿔 렌더 문장의 「홈 카드」가 남아 있던 것을 고침(가드 추가).
- 검증: `boundary.test.ts` 7(실측 PUBG M9·L6·Crossbow true / Beryl·Groza false) + wording 가드.
- 미확인 사항: LoL·TFT 실데이터에서 경계 행이 몇 개 생기는지(표시량) — VERIFY 빌드에서 `data-boundary` 수 확인.
