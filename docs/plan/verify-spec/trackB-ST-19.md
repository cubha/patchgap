# VERIFY-SPEC — 트랙 B ST-19 수치 축 원복 표시 (tft-S19)

- 변경 요약: `pipeline/gamedata/revert.ts` `findReverts`(직전 쌍들을 최신부터, 같은 대상·필드의 첫 변경이 정확히 반대면 원복) + `lib/gamedata.ts` `gameDataReverts`(디스크 쌍 사슬을 `from`에서 거꾸로). `SubmarineSection` `reverts` prop → 행에 「{패치} 변경 원복」. 세 브리핑(LoL·TFT 관측/선언·PUBG 관측)이 넘긴다.
- 구현 결정: 판정(잠수함)은 바꾸지 않는다 — 원복도 이번 노트가 말하지 않은 변경. 산출물 재생성 없음(빌드 타임 계산). 사이에 다른 값 변경이 있으면 원복 아님.
- 검증: `revert.test.ts` 4(실측 다이애나 포함) · `gamedataReverts.test.ts` 2.
- 미확인 사항: 상세 화면(`SubmarineDetailBlock`)에는 원복 맥락을 붙이지 않았다 — 수용기준은 브리핑 행. 대조표 수치 축 칸도 미적용.
