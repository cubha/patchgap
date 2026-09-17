# VERIFY-SPEC — PLAN-pubg-normalization-2026-09-17.md

## 구현 결정

- 정준키 형식을 `Item_Weapon_{베이스}_C`로 통일했다(픽업/공지/노출 표기가 이미 이 형태를
  쓰고 있어 변경 지점이 가장 적음). `Weap*` 네임스페이스는 이 형태로 변환한다.
- `weaponKind` 분류를 블랙리스트(구 `NON_FIREARM` 정규식)에서 **화이트리스트**(FIREARM_BASES
  51종 명시)로 바꿨다 — 블랙리스트가 이미 한 번 장비류 7종을 놓쳤기 때문(N-2). 다음 패치가
  새 무기를 추가하면 화이트리스트에 없어 **throw**한다 — 조용히 firearm으로 기본 분류되는
  것보다 안전하다고 판단했다. 이건 유지보수 비용을 늘리는 트레이드오프다: 새 무기가 나오면
  이 파일을 갱신해야 빌드가 통과한다.
- §8 명중률 반증표(`pubg-accuracy.ts`)는 **출하하되 판정 축에는 연결하지 않았다** —
  `/pubg/` 화면 "한계" 섹션의 `<details>` 접이식 안에만 노출한다. 사용자가 "정규화도
  바로 넣어야 해"라고 명시했고, 정규화의 한 산출물이 이 반증표 재현이라 판단해 화면에도
  반영했다 — PLAN에 적힌 필수 산출물은 아니었으나(ST-4는 코드 재현만 요구) 계획 완료
  기준 "코드·화면·문서 3곳에 명시"를 맞추려면 화면 노출이 필요하다고 해석했다.
- `run-pubg-aggregate.ts`의 `ACCURACY_TARGETS`는 §8의 5개 무기(RPD·M249·MG3 vs AK47·HK416)로
  하드코딩했다 — 전체 51종 명중률 대시보드는 범위 밖이라 판단(출하 축이 아닌 것에 그 이상
  투자하지 않음).
- 26.19 표본 가드 임계값(5,000)은 PLAN에 명시된 숫자를 그대로 썼다. 26.16(10,000)·
  26.17(10,000)·26.18(10,000, 복구 후) 대비 절반 미만이면 이상 표본으로 판단한 것이며,
  9/10 실측(n=737)과는 충분히 떨어진 값이다.

## 미확인 사항

- **표본 가드가 실전에서 아직 검증되지 않았다** — 26.19(9/24) cron 발화 전까지는 워크플로우
  YAML 문법 검사(`python3 -c "import yaml..."`)와 로직 리뷰만 했다. `steps.sample_guard.outputs`
  참조가 GitHub Actions 문법상 유효한지, `if:` 조건의 `!= 'false'`가 sample_guard 스텝
  자체가 스킵된 경우(should_run=false) 의도대로 빈 문자열을 통과시키는지는 **실제 워크플로우
  실행으로 확인하지 못했다**. dry-run 도구가 없어 로컬 재현이 불가능했다.
- `pubg-weapon-key.ts`의 `EQUIPMENT_BASES`·`THROWABLE_BASES`·`FIREARM_BASES` 79종 전량이
  data/raw/pubg/telemetry-reduced(7,217건, gitignore)에 대해 0 throw임을 **로컬에서 1회
  스크립트로 검증**했으나, 이 검증 자체는 커밋된 테스트가 아니다(원본 데이터가 gitignore라
  CI에서 재현 불가). 다음 세션에서 같은 검증을 재현하려면 PLAN §3의 node 스캔 스크립트를
  다시 실행해야 한다 — 검증 결과가 코드에 고정돼 있지 않다는 뜻이다.
- `Duncans_M416`·`Julies_Kar98k`·`Lunchmeats_AK47`을 "스킨 변종"이라 판단한 근거는 이름
  패턴(인물명+무기명 조합)뿐이다. PUBG 공식 문서로 확인하지 않았다 — 픽업 수가 극히
  적다는 사실(각 76·44·37건, 베이스 무기의 0.01~0.02%)이 정황 근거다.
- §8 재현치가 원 문서(부분표본 520/460매치)와 방향은 같되 격차가 줄었다(-7.1%/-11.9% →
  -4.0%/-4.5%, 전체표본 1715/1614매치). 이 차이가 표본 확대 때문인지 다른 요인인지는
  추가로 파고들지 않았다 — 출하 축이 아니므로 정밀 조사의 우선순위가 낮다고 판단했다.
- `verify.sh --full`은 이 SPEC 작성 시점까지 아직 돌리지 않았다 — Phase 3 배치에서 실행한다.

## 범위

- 변경 파일: `src/pipeline/aggregate/pubg-weapon-key.ts`(신규) · `pubg-accuracy.ts`(신규) ·
  `pubg-weapons.ts` · `scripts/run-pubg-aggregate.ts` · `src/lib/pubgData.ts` ·
  `src/app/pubg/page.tsx` · `verify.sh` · `.github/workflows/collect.yml` ·
  `data/aggregated/README.md` · `docs/plan/PLAN-pubg-gate-2026-09-16.md` ·
  `docs/plan/provenance/2026-09-16-pubg-harvest/README.md` · 테스트 3개 신설/확장 ·
  `data/aggregated/pubg/*.json`(재생성).
- PUBG API 키 재발급은 **범위 밖**(사용자 명시 거부, 2026-09-17).
- `harvest.py`/`telemetry.py` 파이썬 수정은 **범위 밖**(provenance 불변 원칙).
- 42.3 재수집·PUBG rate-limit 증량·크래프톤 라이선스 확인은 **물리적으로 불가**(PLAN §2-4).
