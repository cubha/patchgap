# PUBG 격자 판별 보정 — 2026-09-21

`src/pipeline/gamedata/pubg.ts` `compareGrids`의 임계(이동 ≥ 3구간 ≈ 1.2% · 이득 D ≥ 0.10)가 어디서 왔는지의
출처다. 코드 주석·PLAN §8·VERIFY-SPEC에 적힌 수치는 전부 여기서 나왔다.

입력: `data/raw/pubg/telemetry-reduced/*.json` 5,079건(gitignore — 텔레메트리 336h 보존이라 재수신 불가.
`damageGrid`를 품은 축약본 자체가 원본이다). 이 디렉토리의 스크립트는 그 축약본에서 돌린다.

```
python3 1-cache-histograms.py /tmp/pubg_hist.json     # official 매치만, 패치별 + 무작위 반반(seed 1) 병합 히스토그램
python3 2-shift-statistic.py /tmp/pubg_hist.json 120  # 셀별 D·최적 이동 (minhits 120)
python3 3-quantiles.py       /tmp/pubg_hist.json      # 무변화 대조군·실제 쌍·합성 이동의 D 분위수
```

`output-quantiles.txt`가 2026-09-21 실행 결과다. 요지:

| 대조 | 셀 | D 최대 / 중앙값 |
|---|---|---|
| NULL42 (42.3 무작위 반반) | 200 | 0.021 / 0.000 |
| NULL43 (43.1 무작위 반반) | 181 | 0.000 / 0.000 |
| REAL 42.3 → 43.1 | 191 | 0.027 / 0.000 |
| SYNTH ×1.03 | 191 | 0.753 / 0.419 (5분위 0.125) |
| SYNTH ×0.97 | 191 | 0.757 / 0.418 |
| SYNTH ×1.10 | 191 | 0.846 / 0.517 |

합성에서 D가 낮은 셀은 산탄총(Saiga12·DP12·Sawnoff)과 PanzerFaust — 분포가 연속이라 검출력이 낮다.
무변화에서 임계 0.10을 넘는 셀은 0.

TS 구현과 이 Python의 통계는 같다(로그 구간 폭 0.004 · ±120구간 탐색 · 히스토그램 교집합). 차이는 Python이
셀별 D를 전수 출력하고, TS는 임계를 넘은 셀만 `GridShift`로 내보낸다는 것뿐이다. 실측 픽스처
`src/pipeline/gamedata/__tests__/fixtures/pubg-grid-42.3-43.1.json`은 `1-cache-histograms.py`의 캐시에서 뽑았다.
