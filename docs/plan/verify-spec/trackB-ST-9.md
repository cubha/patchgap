# VERIFY-SPEC — 트랙 B ST-9 음수 기호 1종 (parity-S21)

- 변경 요약: `percent.ts` SIGNED_POINT·SIGNED_PERCENT 음수 `-`→`−`(타입도 `"−"`만 허용). 수치 축 상대% 사본 2곳(`SubmarineSection`·`SubmarineDetailBlock`)을 공용 포매터로. TFT 등수 델타 `−`.
- 구현 결정: q 표기는 트랙 A ST-09로 이미 통일. ▲▼(LoL만)는 수용기준 밖·결정 6(표시 포맷은 게임별 허용) — 유지. 디스코드 PUBG 브리핑 출력도 `−`로 바뀐다(같은 상수).
- 검증: percent.test 신규 3 + 오라클 갱신, 전체 vitest 2369 통과.
- 미확인 사항: 하이픈을 직접 찍는 다른 렌더 경로(리터럴 `-${…}`)가 남았는지 — 빌드 산출물에서 `>-[0-9]` 패턴으로 VERIFY 때 확인.
