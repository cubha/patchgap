// src/app/pubg/page.tsx
// PUBG 브리핑 — LoL의 `/`와 **같은 자리**에 있는 화면이다. 게임 드롭다운으로 전환하면 이 화면이
// 뜨고, 내비(브리핑·대조표·방법론)는 그대로다(PLAN-game-switcher-2026-09-17 R1).
//
// 2026-09-17 재구성: 예전엔 이 한 장이 표본·발견·전체표·한계·버린축을 전부 이고 있었다
// (`/pubg/`가 4번째 내비 탭이던 시절의 구조). 게임 스위처가 붙으면서 LoL과 같은 3분할로 나눈다 —
// 브리핑은 **판정된 것**(발견 + 공지 대조), 전체 47행은 `/pubg/compare/`, 한계·버린 축은
// `/pubg/methodology/`.
//
// 이 게임은 축이 하나뿐이다(획득 점유율). 43.1 밸런스 11개 항목 중 텔레메트리로 실제 분리되는
// 축이 그것뿐이었고, 명중률로 반동 변경을 잡으려던 시도는 대조군이 더 크게 움직여 반증됐다
// (docs/plan/PLAN-pubg-gate-2026-09-16.md §8). 검증 축이 없는 공지 항목은 숫자를 지어내지 않고
// 방법론 화면에서 "관측 축 미설계"로 회색 처리한다 — 무근거 문장은 회색이라는 원칙 그대로다.
import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import {
  PubgFooter,
  PubgPageHeader,
  PubgSampleNotice,
  PubgUnavailable,
  pct,
  signedPct,
} from "@/components/pubg/shared";
import { loadPubg, isReportable } from "@/lib/pubgData";

export const metadata: Metadata = {
  title: "PUBG 42.3 ⇒ 43.1 · patchgap",
  description:
    "PUBG: BATTLEGROUNDS 43.1 패치노트의 공지와 실제 관측 데이터를 대조한다. 표본은 steam 플랫폼 전역 무작위 official 매치.",
};

export default function PubgPage() {
  const bundle = loadPubg();
  if (!bundle) {
    return (
      <Container>
        <PubgUnavailable />
      </Container>
    );
  }

  const { deltas, before, after, notes } = bundle;
  const reportable = deltas.rows.filter((row) => isReportable(row.status));
  const unannounced = reportable.filter((row) => row.status === "unannounced");
  const announced = reportable.filter((row) => row.status !== "unannounced");

  return (
    <Container>
      {/* pt-40(160px) — 승인 시안의 `.hero-body`가 히어로 스테이지 **하단**에 붙어 있는 배치를
          옮긴 것이다. 키아트가 가장 밝은 상단 구간(잔해·낙하산)을 글자로 덮지 않고 그대로
          보여주고, 제목은 스크림이 충분히 내려앉은 아래쪽에서 읽히게 한다. LoL 홈이 같은
          이유로 pt-44를 쓴다(src/app/page.tsx:85) — 아트 밴드 높이에 맞춰 한 단계 작은 값. */}
      <div className="flex flex-col gap-6 pt-40 pb-8">
        <PubgPageHeader
          title="42.3 ⇒ 43.1 · 무기 획득 점유율"
          lead={
            <>
              리그 오브 레전드와 <strong className="text-fg">같은 판정 엔진</strong>에 PUBG
              텔레메트리를 넣은 결과입니다. 바뀐 것은 어댑터(수집·엔티티·지표)뿐이고 통계·게이트·
              판정 어휘는 그대로입니다.
            </>
          }
        />

        <PubgSampleNotice sampleScope={deltas.meta.sampleScope} />

        <div className="grid gap-4 md:grid-cols-3">
          <SectionCard eyebrow="표본" title="비교 구간" variant="glass">
            <div className="p-5">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">42.3 (9/4~9/8)</dt>
                  <dd className="font-mono tabular-nums text-fg">{before.nMatches.toLocaleString()}매치</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">43.1 (9/11~9/15)</dt>
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
                양쪽 다 목~월 5일로 요일을 맞췄습니다. 주말 비중이 다르면 플레이어 구성 차이가 패치
                효과와 섞입니다. 경계 2일(9/9~9/10)은 적용 시차가 미검증이라 제외했습니다.
              </p>
            </div>
          </SectionCard>

          <SectionCard eyebrow="기저" title="함께 움직인 값" variant="glass">
            <div className="p-5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tabular-nums text-fg">
                  {before.pickupsPerMatch.toFixed(0)}
                </span>
                <span className="text-muted">→</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-fg">
                  {after.pickupsPerMatch.toFixed(0)}
                </span>
                <span className="text-xs text-muted">매치당 총 획득</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                총량이 함께 내려갔습니다. 이 기저를 빼지 않으면 <em>모든</em> 무기가 하향된 것처럼
                보입니다 — 모든 수치는 <strong className="text-fg-2">총 획득 대비 점유율</strong>로
                정규화한 값입니다.
              </p>
            </div>
          </SectionCard>

          <SectionCard eyebrow="게이트" title="효과크기 바닥" variant="glass">
            <div className="p-5">
              <div className="font-mono text-2xl font-bold tabular-nums text-fg">
                {pct(deltas.meta.effectFloor)}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                리그 오브 레전드 바닥값을 가져오지 않고{" "}
                <strong className="text-fg-2">이 데이터에서 유도</strong>했습니다. 패치노트가
                언급하지 않은 무기들의 변화 분포(귀무분포) 90번째 백분위수 — 즉 &ldquo;언급 없는
                무기 10개 중 9개보다 크게 움직였다&rdquo;가 기준입니다.
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          eyebrow="발견"
          title="공지에 없는데 움직였다"
          variant="glass"
          action={<span className="font-mono text-xs text-muted">{unannounced.length}건</span>}
        >
          {unannounced.length === 0 ? (
            <p className="p-5 text-sm text-muted">바닥을 넘는 미공지 변화가 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft">
              {unannounced.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                  <StatusBadge status={row.status} />
                  <span className="font-display font-bold text-fg">{row.weaponName}</span>
                  <span
                    className={`font-mono text-lg font-bold tabular-nums ${
                      (row.relChange ?? 0) > 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {signedPct(row.relChange ?? 0)}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    95% CI [{signedPct(row.relCi[0])}, {signedPct(row.relCi[1])}] · n=
                    {row.n.before.toLocaleString()}→{row.n.after.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="대조"
          title="공지된 변경은 실제로 그렇게 됐나"
          variant="glass"
          action={<span className="font-mono text-xs text-muted">{announced.length}건</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: "var(--table-min)" }}>
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pl-5 pr-3 font-mono text-xs font-bold text-muted">무기</th>
                  <th className="py-2 pr-3 font-mono text-xs font-bold text-muted">공지</th>
                  <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">관측</th>
                  <th className="py-2 pr-3 text-right font-mono text-xs font-bold text-muted">95% CI</th>
                  <th className="py-2 pr-5 font-mono text-xs font-bold text-muted">판정</th>
                </tr>
              </thead>
              <tbody>
                {announced.map((row) => {
                  const note = notes.find((item) => item.id === row.matchedNoteId);
                  return (
                    <tr key={row.id} className="border-b border-border-soft">
                      <td className="py-3 pl-5 pr-3 font-display font-bold text-fg">{row.weaponName}</td>
                      <td className="py-3 pr-3 text-fg-2">
                        {note?.expectedRelChange !== null && note?.expectedRelChange !== undefined
                          ? signedPct(note.expectedRelChange, 0)
                          : "—"}
                        <span className="ml-2 text-xs text-muted">{note?.stat}</span>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-fg">
                        {signedPct(row.relChange ?? 0)}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono text-xs tabular-nums text-muted">
                        [{signedPct(row.relCi[0])}, {signedPct(row.relCi[1])}]
                      </td>
                      <td className="py-3 pr-5">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={row.status} />
                          {row.evidence.noteAnchor ? (
                            <a
                              className="font-mono text-xs text-accent underline-offset-2 hover:underline"
                              href={row.evidence.noteAnchor}
                              target="_blank"
                              rel="noreferrer"
                            >
                              패치노트 원문 →
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p
            className="px-5 pt-4 pb-5 text-xs leading-relaxed text-muted"
            style={{ maxWidth: "var(--measure-wide)" }}
          >
            획득 점유율은 스폰율의 <strong className="text-fg-2">대리 지표</strong>입니다 — 스폰이
            줄어도 플레이어가 남은 것을 더 적극적으로 줍거나(감쇠) 너프 소식에 회피하면(증폭) 관측
            배수가 달라집니다. 그래서 정확한 배수 일치가 아니라 <strong className="text-fg-2">
            방향과 자릿수</strong>로 판정합니다(공지값의 50~150% 범위면 일치).{" "}
            <Link href="/pubg/methodology/" className="text-accent underline-offset-2 hover:underline">
              판정 규칙 전체 →
            </Link>
          </p>
        </SectionCard>

        <p className="text-sm text-muted">
          바닥 미달·무변화까지 포함한 전체 {deltas.meta.n}개 무기 판정은{" "}
          <Link href="/pubg/compare/" className="text-accent underline-offset-2 hover:underline">
            대조표
          </Link>
          에 있습니다.
        </p>

        <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
      </div>
    </Container>
  );
}
