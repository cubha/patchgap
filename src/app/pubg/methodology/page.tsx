// src/app/pubg/methodology/page.tsx
// PUBG 방법론 — 내비 "방법론"이 PUBG일 때 도달하는 화면. LoL `/methodology/`와 같은 자리다.
//
// 2026-09-18 라운드6(사용자 P2·C3·C1): **판정표 기준으로 전면 재작성.** 다른 게임과의 비교 서술을 전부
// 뺐고(어댑터 매핑표 포함), 브리핑에서 옮겨 온 표본·기저·게이트 카드와 "표시하지 않는 관측" 규칙을 여기
// 모았다. 이 화면이 "왜 이렇게 판정·표시하나"의 유일한 집이다 — 브리핑·대조표·상세는 결과만 말한다.
//
// PUBG 판정 규칙(pubg-delta.ts): 효과크기 바닥은 **이 데이터에서 유도**(패치노트가 언급하지 않은 무기의
// 변화 분포 90번째 백분위수), 공지 일치는 비율 밴드 [0.5, 1.5], 표본 게이트는 획득 300회, q(BH-FDR)는
// 계산하지 않는다(Wilson CI + 바닥). LLM 원인 추정은 이 게임에 없다 — 43.1 노트가 5항목이라 짝지을
// 후보 조항 자체가 없다.
import type { Metadata } from "next";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { PubgFooter, PubgPageHeader, PubgSampleNotice, PubgUnavailable, pct, signedPct } from "@/components/pubg/shared";
import { loadPubg } from "@/lib/pubgData";
import { ANNOUNCED_RATIO_BAND, PICKUP_MIN_N } from "@/pipeline/match/pubg-delta";

export const metadata: Metadata = {
  title: "PUBG 방법론 · patchgap",
  description: "PUBG 판정표의 규칙 — 표본·기저·효과크기 바닥·상태 정의·표시 규칙·검증하지 못한 축.",
};

const PIPELINE = [
  { step: 1, title: "수집", detail: "PUBG /samples → /matches → telemetry", meta: "official 매치만" },
  { step: 2, title: "리듀스", detail: "텔레메트리 → 무기별 획득·공격·명중·처치 카운트", meta: "ingest 시점 축약" },
  { step: 3, title: "정규화", detail: "Item_Weapon_* ⇄ Weap* 정준키 결합 · 스킨 접기 · 비무기 제외", meta: "pubg-weapon-key.ts" },
  { step: 4, title: "집계", detail: "총 획득 대비 점유율 + Wilson 95% CI", meta: "기저 이동 분리" },
  { step: 5, title: "판정", detail: "패치노트 짝짓기 → 효과크기 바닥 대비 → 상태 부여", meta: "pubg-delta.ts" },
] as const;

export default function PubgMethodologyPage() {
  const bundle = loadPubg();
  if (!bundle) {
    return (
      <main>
        <Container>
          <PubgUnavailable />
        </Container>
      </main>
    );
  }

  const { deltas, before, after, notes, accuracyComparison } = bundle;
  const unverifiable = notes.filter((note) => note.expectedRelChange === null);
  const counts = deltas.meta.counts;
  const hidden = (counts["below-threshold"] ?? 0) + (counts["no-change"] ?? 0) + (counts["insufficient-sample"] ?? 0);

  const statusRows = [
    {
      status: "announced",
      definition: "패치노트가 말한 무기의 점유율 변화가 공지 방향·규모와 맞음",
      condition: `짝 존재 · 관측/공지 비율 ${ANNOUNCED_RATIO_BAND[0]}~${ANNOUNCED_RATIO_BAND[1]}`,
    },
    {
      status: "announced-anomaly",
      definition: "패치노트가 말한 무기인데 방향이 반대이거나 규모가 밴드 밖",
      condition: `짝 존재 · 비율 밴드 밖`,
    },
    {
      status: "unannounced",
      definition: "패치노트에 없는 무기가 바닥을 넘어 움직임",
      condition: `짝 없음 · |상대 변화| ≥ 바닥 ${pct(deltas.meta.effectFloor)}`,
    },
  ] as const;

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 py-8">
          <PubgPageHeader
            title="어떻게 판정했고, 무엇을 못 했나"
            lead={
              <>
                43.1 패치노트의 무기 변경을 매치 텔레메트리의 <strong className="text-fg">획득 점유율</strong> 한 축으로
                대조합니다. 효과크기 바닥은 이 데이터에서 유도하고, 판정이 서지 않는 관측은 화면에 올리지 않습니다.
              </>
            }
          />

          <PubgSampleNotice sampleScope={deltas.meta.sampleScope} />

          {/* 브리핑에서 옮겨 온 표본·기저·게이트(2026-09-18 라운드6 C3). */}
          <div className="grid gap-4 md:grid-cols-3">
            <SectionCard eyebrow="표본" title="비교 구간" variant="glass">
              <div className="p-5">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">42.3 ({deltas.meta.window.before[0]?.slice(5)}~{deltas.meta.window.before.at(-1)?.slice(5)})</dt>
                    <dd className="font-mono tabular-nums text-fg">{before.nMatches.toLocaleString()}매치</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">43.1 ({deltas.meta.window.after[0]?.slice(5)}~{deltas.meta.window.after.at(-1)?.slice(5)})</dt>
                    <dd className="font-mono tabular-nums text-fg">{after.nMatches.toLocaleString()}매치</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-border-soft pt-2">
                    <dt className="text-muted">봇 비율</dt>
                    <dd className="font-mono tabular-nums text-fg-2">
                      {pct(before.botShare)} → {pct(after.botShare)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  양쪽 다 같은 요일 5일로 맞췄습니다. 주말 비중이 다르면 플레이어 구성 차이가 패치 효과와 섞입니다.
                  패치 적용 시차가 검증되지 않은 경계 2일은 제외했습니다.
                </p>
              </div>
            </SectionCard>

            <SectionCard eyebrow="기저" title="함께 움직인 값" variant="glass">
              <div className="p-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold tabular-nums text-fg">{before.pickupsPerMatch.toFixed(0)}</span>
                  <span className="text-muted">→</span>
                  <span className="font-mono text-2xl font-bold tabular-nums text-fg">{after.pickupsPerMatch.toFixed(0)}</span>
                  <span className="text-xs text-muted">매치당 총 획득</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  총량이 함께 내려갔습니다. 이 기저를 나누지 않으면 모든 무기가 하향된 것처럼 보입니다 — 모든 수치는{" "}
                  <strong className="text-fg-2">총 획득 대비 점유율</strong>입니다.
                </p>
              </div>
            </SectionCard>

            <SectionCard eyebrow="게이트" title="효과크기 바닥" variant="glass">
              <div className="p-5">
                <div className="font-mono text-2xl font-bold tabular-nums text-fg">{pct(deltas.meta.effectFloor)}</div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  <strong className="text-fg-2">이 데이터에서 유도</strong>했습니다. 패치노트가 언급하지 않은 무기들의 변화
                  분포(귀무분포) 90번째 백분위수 — 언급 없는 무기 10개 중 9개보다 크게 움직여야 판정합니다.
                </p>
              </div>
            </SectionCard>
          </div>

          <SectionCard eyebrow="신뢰" title="데이터 파이프라인" variant="glass">
            <ol className="flex flex-col divide-y divide-border-soft">
              {PIPELINE.map((s) => (
                <li key={s.step} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                  <span className="font-mono text-xs font-bold text-accent">{s.step}</span>
                  <span className="font-display font-bold text-fg">{s.title}</span>
                  <span className="text-sm text-fg-2">{s.detail}</span>
                  <span className="ml-auto font-mono text-xs text-muted">{s.meta}</span>
                </li>
              ))}
            </ol>
            <p className="px-5 pt-1 pb-5 text-xs leading-relaxed text-muted" style={{ maxWidth: "var(--measure-wide)" }}>
              `/samples`는 official 외에 airoyale·competitive·tutorialatoz·trainingroom을 함께 돌려줍니다 — 실측에서
              표본의 약 절반이 비경쟁 매치였습니다. 2단계에서 `matchType`을 저장해 official만 씁니다.
            </p>
          </SectionCard>

          {/* 판정표 — 화면 배지가 쓰는 표시 키 3종과 조건. 표시하지 않는 관측은 아래 카드. */}
          <SectionCard eyebrow="해석" title="판정표" variant="glass">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted">상태</th>
                    <th className="border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted">정의</th>
                    <th className="border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted">판정 조건</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.map((row) => (
                    <tr key={row.status}>
                      <td className="border-b border-border-soft px-5 py-4 align-top">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-border-soft px-5 py-4 align-top text-fg-2">{row.definition}</td>
                      <td className="border-b border-border-soft px-5 py-4 align-top text-muted">{row.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="flex flex-col gap-3 p-5 text-sm">
              <div>
                <dt className="font-display font-bold text-fg">공지 일치는 비율 밴드 [{ANNOUNCED_RATIO_BAND[0]}, {ANNOUNCED_RATIO_BAND[1]}]</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  획득 점유율은 스폰율의 대리 지표입니다 — 스폰이 줄어도 남은 것을 더 적극적으로 줍거나(감쇠) 너프 소식에
                  회피하면(증폭) 관측 배수가 달라집니다. 그래서 정확한 배수 일치가 아니라 방향과 자릿수로 판정합니다.
                  &ldquo;공지값이 95% CI 안에 들어오면 일치&rdquo; 규칙은 시행수가 수만이면 CI가 ±1.3%p로 좁아져 모든
                  공지가 불일치로 찍히기 때문에 쓰지 않습니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">q(BH-FDR) 열이 없는 이유</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  이 판정은 효과크기 바닥 + Wilson 신뢰구간 방식이라 q를 계산하지 않습니다. 없는 값을 빈칸으로 채우지
                  않습니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">LLM 원인 추정 없음</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  43.1 패치노트는 무기 항목 5건뿐이라 미공지 변화에 짝지을 후보 조항이 없습니다. 무기 상세에는 관측값과
                  판정 근거만 있습니다.
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard
            eyebrow="표시 규칙"
            title="표시하지 않는 관측"
            variant="glass"
            action={<span className="font-mono text-xs tabular-nums text-muted">{hidden} / {deltas.meta.n}</span>}
          >
            <div className="p-5">
              <p className="text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                브리핑·대조표·무기 상세는 <strong className="text-fg">판정이 선 무기</strong>만 보여줍니다. 아래 세 상태는 판정
                파일에 남되 화면에는 올리지 않습니다. 예외는 수치 축의 잠수함 패치입니다 — 지표 판정이 아래 어느
                상태여도 전부 보여 주고, 배지는 <StatusBadge status="submarine" className="align-middle" />로 지표 판정을 덮습니다.
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li className="flex flex-wrap items-baseline gap-2">
                  <StatusBadge status="below-threshold" />
                  <span className="text-muted">
                    |상대 변화| &lt; 바닥 {pct(deltas.meta.effectFloor)} · {counts["below-threshold"] ?? 0}종
                  </span>
                </li>
                <li className="flex flex-wrap items-baseline gap-2">
                  <StatusBadge status="no-change" />
                  <span className="text-muted">95% CI가 0을 포함 · {counts["no-change"] ?? 0}종</span>
                </li>
                <li className="flex flex-wrap items-baseline gap-2">
                  <StatusBadge status="insufficient-sample" />
                  <span className="text-muted">
                    획득 {PICKUP_MIN_N}회 미만 — 비율 변화율은 분모가 작을 때 폭발합니다 · {counts["insufficient-sample"] ?? 0}종
                  </span>
                </li>
              </ul>
            </div>
          </SectionCard>

          {/* 수치 축(2026-09-21, F9) — 위 카드는 전부 획득 점유율이라는 **지표**의 통계 추론이다. 이 카드만
              성질이 다르다: 피해값이 실제로 바뀌었는가를 경기 로그에서 직접 읽는다. LoL·TFT 방법론의 같은
              카드와 판정 기준이 같고(게이트와 무관하게 전량 노출 · 배지 1종), 소스만 다르다. */}
          <SectionCard eyebrow="수치 축" title="잠수함 패치는 어떻게 찾나" variant="glass">
            <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
              <p>
                &ldquo;미공지&rdquo;는 두 종류입니다. <strong className="text-fg">지표 축</strong>은 위 표의 획득
                점유율이 움직였는데 짝지을 패치노트가 없는 경우로, 통계가 근거입니다.{" "}
                <strong className="text-fg">수치 축</strong>은 무기의 피해량 같은 원본 값이 실제로 바뀌었는데
                패치노트에 없는 경우이고, 통칭 잠수함 패치입니다. 잠수함은 표본 부족·바닥 미달 게이트와
                무관하게 전부 보여 주고, 배지도 따로 둡니다 — 세 게임이 같은 규칙입니다.
              </p>
              <p>
                짝이 있어도 끝이 아닙니다. 패치노트가 <strong className="text-fg">같은 항목을 말했는데 적힌
                값이 실제와 다른</strong> 경우는 「공지값 불일치」로 따로 부릅니다 — 말하지 않은 것도, 말한
                대로 한 것도 아니기 때문입니다. 값을 견줄 수 있는 표기일 때만 견줍니다. 세 게임이 같은
                규칙입니다.
              </p>
              <p>
                PUBG는 게임사가 수치 파일을 배포하지 않습니다. 대신 피격 이벤트의 피해값이{" "}
                <span className="font-mono text-xs">기본 피해량 × 부위 배율 × 방어구 계수 × 거리 감쇠</span>의
                곱이라, 기본 피해량이나 부위 배율이 바뀌면 그 부위의 피해 분포 전체가 같은 비율로 옮겨갑니다.
                방어구·거리 구성이 바뀌면 분포의 빈도는 달라져도 값의 위치는 그대로입니다. 그래서 부위별로
                패치 전후 분포를 겹쳐 놓고 <strong className="text-fg">통째로 밀었을 때 겹침이 얼마나
                늘어나는가</strong>만 봅니다. 값 하나(최대치·최빈값)를 보는 방식은 이상치와 꼬리값에 흔들려
                다섯 번 틀렸고, 전부 폐기했습니다.
              </p>
              <p className="text-muted">
                임계는 같은 패치를 무작위로 반반 나눈 무변화 대조군에서 정했습니다(대조군 최대 이득 0.021 대
                임계 0.10). 부위별 120회 미만 피격은 판정하지 않습니다. 산탄총과 발사기는 펠릿 합산·폭발
                감쇠 때문에 분포가 연속이라 작은 변경을 놓칠 수 있습니다 — 놓칠 수는 있어도 지어내지는 않습니다.
                거리 감쇠 곡선만 바뀐 변경은 이 검정의 대상 밖입니다.
              </p>
              <p className="text-muted">
                잡힌 변경은 그 무기의 <strong className="text-fg-2">피해량</strong>을 말한 패치노트 항목이 있는지
                찾고, 없으면 잠수함입니다. 같은 무기의 반동·조준 전환·차량 피해 배수 항목은 피해량을 설명하지
                않으므로 알리바이가 되지 않습니다.
              </p>
            </div>
          </SectionCard>

          <SectionCard eyebrow="한계" title="관측 축이 없는 공지 항목" variant="glass">
            <div className="p-5">
              <p className="text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                43.1 패치노트의 나머지 항목은 이 표본으로 검증하지 못했습니다. 숫자를 지어내지 않고 비워 둡니다.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {unverifiable.map((note) => (
                  <li key={note.id} className="flex flex-wrap items-baseline gap-2 text-sm text-muted">
                    <span className="font-mono text-xs text-muted">{note.stat}</span>
                    <span>{note.summary}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-muted" style={{ maxWidth: "var(--measure-wide)" }}>
                반동·조준 전환은 명중률로 분리하려 했으나 실패했습니다 — 반동이 나빠진 경기관총 3종이 대조군보다 <em>덜</em>{" "}
                떨어져 방향이 반대로 나왔습니다. 교전 거리·상대 실력·봇 비율 변화가 패치 효과를 압도합니다. 차량 피해 배수는
                1차 출처 단독이라 판정 축에서 제외했습니다.
              </p>

              {accuracyComparison && accuracyComparison.length > 0 ? (
                <details className="mt-4 rounded-md border border-border-soft">
                  <summary className="cursor-pointer px-4 py-3 font-mono text-xs font-bold text-muted">
                    버린 축 재현 — 명중률(hits ÷ attacks), 너프 3종 vs 대조군 2종
                  </summary>
                  <div className="overflow-x-auto border-t border-border-soft">
                    <table className="w-full border-collapse text-sm" style={{ minWidth: "var(--table-min)" }}>
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 pl-4 pr-3 font-mono text-xs font-bold text-muted">무기</th>
                          <th className="py-2 pr-3 font-mono text-xs font-bold text-muted">분류</th>
                          <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">42.3</th>
                          <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">43.1</th>
                          <th className="py-2 pr-4 text-right font-mono text-xs font-bold text-muted">변화</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accuracyComparison.map((row) => (
                          <tr key={row.weaponKey} className="border-b border-border-soft">
                            <td className="py-2 pl-4 pr-3 font-display font-bold text-fg">{row.weaponName}</td>
                            <td className="py-2 pr-3 text-xs text-muted">{row.nerfed ? "반동 너프" : "대조군(무변경)"}</td>
                            <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">{pct(row.before.accuracy, 2)}</td>
                            <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">{pct(row.after.accuracy, 2)}</td>
                            <td className="py-2 pr-4 text-right font-mono text-xs font-bold tabular-nums text-fg">
                              {row.relChangePct === null ? "—" : signedPct(row.relChangePct / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-4 py-3 text-xs leading-relaxed text-muted" style={{ maxWidth: "var(--measure-wide)" }}>
                    너프당한 쪽이 대조군보다 <strong className="text-fg-2">덜</strong> 움직여야 정상인데 실제로는 방향이 반대입니다 —
                    이 표가 판정에 쓰이지 않는 이유입니다.
                  </p>
                </details>
              ) : null}
            </div>
          </SectionCard>

          <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
        </div>
      </Container>
    </main>
  );
}
