# VERIFY-SPEC — 트랙 B ST-12 문구 (lol-S30 · pubg-S23 · parity-S26 · parity-S27 · lol-S19 · pubg-S14 · parity-S12 · lol-S18 문구)

- 변경 요약: `observation/footnote.ts` 순수 함수(「지표 탭으로」/「지표 탭과 X 선택지로」, 기술통계 지표 0개면 각주 없음 — pubg-S15 일부). 대조표 리드 3곳·TFT 방법론에서 「왼쪽/오른쪽」 제거. LoL 방법론 픽률·밴률 분모 = 전체 매치 / 승률 = 등장 판. PUBG 방법론 파이프라인 meta·문단의 파일명·API 경로·필드명 → 사용자 말(공개 표본·일반 매치·무기 이름 정규화·판정 규칙). PUBG 「무기 상세는 판정이 선 무기만」 → 실태(상세는 전 무기, 판정 없으면 관측 섹션 비움). TFT 방법론 `insufficient-sample`·`below-threshold`·`style`·`src/pipeline/shared/` → 「표본 부족」·「바닥 미달」·「발동 단계」·「세 게임 공용 규칙」. 렌더 문장 「엔티티」→「대상」(방법론 2·파이프라인 단계·수치 축 상세·노트 대조 패널·랜딩 표).
- 구현 결정(범위 확대 기록): TFT 대조표 리드 「대상 N종 · 보고 자격을 얻은 관측 M건」 → 「대상 N종.」 — 대상 수와 값 수를 나란히 쓰지 않는다(결정 7, 감사에서 발견). TFT 방법론 「그 건수는 표 아래에서 밝힙니다」 삭제 — #78 이후 표 아래에 숨김 건수가 없다(거짓 약속).
- PUBG `official` = 일반 매치(경쟁전 = `competitive`)로 표기 — 첫 수정에서 「일반 경쟁전」으로 잘못 썼다가 바로잡음.
- 검증: `footnote.test.ts` 3 · `src/app/__tests__/wording.test.ts` 5(방향어·분모·PUBG 내부 용어·상세 범위 문장·탭로 전수). 명세 변경 `pipelineSteps.test.ts` 3곳.
- 미확인 사항: 렌더 문장 전수의 반말 종결(「~다.」) 스캔은 빌드 산출물로 VERIFY 때(소스에는 주석 반말이 많아 소스 grep으로는 구별 불가).
