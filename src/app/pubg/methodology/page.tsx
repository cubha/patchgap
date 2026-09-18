// src/app/pubg/methodology/page.tsx
// PUBG 방법론 — 내비 "방법론"이 PUBG일 때 도달하는 화면. LoL `/methodology/`와 같은 자리다.
//
// **왜 LoL 방법론을 그대로 재노출하지 않는가**: 그 화면의 수치는 전부 LoL 소유다(Riot Match-V5,
// WIN_RATE_MIN_N=200, EFFECT_SIZE_FLOORS 지표별 바닥, KR·Master+ 표본). PUBG는 판정 규칙 자체가
// 다르다 — 효과크기 바닥을 **데이터에서 유도**하고(PLAN-pubg-gate R3), q(BH-FDR) 대신 Wilson CI +
// 비율 밴드로 공지 일치를 본다. 같은 화면을 띄우면 화면이 거짓을 말한다.
// 공유되는 것은 **어댑터 매핑표**(AdapterMatrix — LoL↔PUBG 8계층 대조가 곧 내용이라 게임 무관)
// 하나뿐이고, 나머지는 PUBG 값으로 다시 쓴다.
//
// 2026-09-17: `/pubg/` 한 장이 이고 있던 "관측 축이 없는 공지 항목"과 "버린 축 재현(§8 반증표)"을
// 이 화면으로 옮겼다. 둘 다 "무엇을 어떻게 판정했고 무엇을 못 했나"라 방법론의 내용이다.
import type { Metadata } from "next";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import AdapterMatrix from "@/components/methodology/AdapterMatrix";
import {
  PubgFooter,
  PubgPageHeader,
  PubgSampleNotice,
  PubgUnavailable,
  pct,
  signedPct,
} from "@/components/pubg/shared";
import { loadPubg } from "@/lib/pubgData";

export const metadata: Metadata = {
  title: "PUBG 방법론 · patchgap",
  description: "PUBG 어댑터의 수집·집계·판정 규칙과 검증하지 못한 축을 밝힌다.",
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

  const { deltas, notes, accuracyComparison } = bundle;
  const unverifiable = notes.filter((note) => note.expectedRelChange === null);

  return (
    <main>
      <Container>
      <div className="flex flex-col gap-6 py-8">
        <PubgPageHeader
          title="어떻게 판정했고, 무엇을 못 했나"
          lead={
            <>
              판정 엔진은 리그 오브 레전드와 같습니다. 다른 것은 어댑터(수집·엔티티·지표)와
              <strong className="text-fg"> 게이트 상수</strong>입니다 — PUBG는 효과크기 바닥을
              LoL에서 가져오지 않고 이 데이터에서 유도합니다.
            </>
          }
        />

        <PubgSampleNotice sampleScope={deltas.meta.sampleScope} />

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
            `/samples`는 official 외에 airoyale·competitive·tutorialatoz·trainingroom을 함께
            돌려줍니다 — 2026-09-16 실측에서 표본의 약 절반이 비경쟁 매치였고, 이벤트가 1,583건뿐인
            튜토리얼 매치가 통계에 들어갈 뻔했습니다. 2단계에서 `matchType`을 저장해 3단계 이후가
            official만 쓰도록 걸러냅니다.
          </p>
        </SectionCard>

        <SectionCard eyebrow="해석" title="판정 규칙" variant="glass">
          <div className="flex flex-col gap-4 p-5">
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="font-display font-bold text-fg">효과크기 바닥 {pct(deltas.meta.effectFloor)}</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  패치노트가 언급하지 않은 무기들의 변화 분포(귀무분포) 90번째 백분위수입니다. LoL의
                  지표별 바닥(<span className="font-mono text-xs">EFFECT_SIZE_FLOORS</span>)을 재사용하면
                  픽률·승률 기준의 숫자를 무기 획득 점유율에 갖다 대는 셈이라, PUBG 데이터에서 직접
                  유도했습니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">공지 일치는 비율 밴드 [0.5, 1.5]</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  &ldquo;공지값이 95% CI 안에 들어오면 일치&rdquo; 규칙을 처음에 썼다가 폐기했습니다 —
                  시행수가 수만이면 CI가 ±1.3%p로 좁아져 공지값을 거의 항상 배제하고,{" "}
                  <strong className="text-fg">모든 공지 항목이 불일치로 찍힙니다</strong>. 획득 점유율은
                  스폰율의 대리 지표라 정확한 배수 일치를 요구할 근거가 없으므로 방향과 자릿수로
                  판정합니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">표본 부족 게이트 n &lt; 300</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  획득 수가 300 미만인 무기는 판정하지 않고 <span className="font-mono text-xs">insufficient-sample</span>로
                  둡니다. 비율 변화율은 분모가 작을 때 폭발합니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">요일 정렬 · 경계 2일 제외</dt>
                <dd className="mt-1 leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
                  전후 구간을 목~월 5일로 맞췄습니다(주말 비중이 다르면 플레이어 구성 차이가 패치
                  효과와 섞입니다). 패치 적용 시차가 검증되지 않은 경계 2일(9/9~9/10)은 뺐습니다.
                </dd>
              </div>
            </dl>
          </div>
        </SectionCard>

        {/* 확장성의 증명 — 셀렉터가 아니라 어댑터 매핑표로 "다른 게임에도 같은 판정 엔진을 쓸 수
            있다"를 보인다. 이 표는 LoL↔PUBG 대조 자체가 내용이라 양쪽 방법론 화면이 공유한다. */}
        <SectionCard eyebrow="확장성" title="어댑터 매핑표 (LoL ↔ PUBG)" variant="glass">
          <AdapterMatrix />
        </SectionCard>

        <SectionCard eyebrow="한계" title="관측 축이 없는 공지 항목" variant="glass">
          <div className="p-5">
            <p className="text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
              43.1 패치노트의 나머지 항목은 이 표본으로 검증하지 못했습니다. 숫자를 지어내지 않고
              비워 둡니다.
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
              반동·조준 전환은 명중률로 분리하려 했으나 실패했습니다 — 반동이 나빠진 경기관총 3종이
              대조군보다 <em>덜</em> 떨어져 방향이 반대로 나왔습니다. 교전 거리·상대 실력·봇 비율
              변화가 패치 효과를 압도합니다. 차량 피해 배수는 피해량 합을 수집했으나 1차 출처
              단독이라 판정 축에서 제외했습니다.
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
                          <td className="py-2 pr-3 text-xs text-muted">
                            {row.nerfed ? "반동 너프" : "대조군(무변경)"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">
                            {pct(row.before.accuracy, 2)}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-fg-2">
                            {pct(row.after.accuracy, 2)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-xs font-bold tabular-nums text-fg">
                            {row.relChangePct === null ? "—" : signedPct(row.relChangePct / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 py-3 text-xs leading-relaxed text-muted" style={{ maxWidth: "var(--measure-wide)" }}>
                  너프당한 쪽이 대조군보다 <strong className="text-fg-2">덜</strong> 움직여야
                  정상인데 실제로는 방향이 반대입니다 — 이 표가 판정에 쓰이지 않는 이유입니다.
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
