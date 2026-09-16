// src/app/pubg/page.tsx
// PUBG 확장 — 42.3 ⇒ 43.1 무기 획득 점유율 대조. 어댑터가 실제로 다른 게임에 붙는다는 증명이자,
// LoL 본편과 **같은 판정 엔진**을 통과한 결과를 같은 어휘(MatchStatus)로 보여주는 화면이다.
//
// 이 페이지는 축이 하나뿐이다(획득 점유율). 43.1 밸런스 11개 항목 중 텔레메트리로 실제 분리되는
// 축이 그것뿐이었고, 명중률로 반동 변경을 잡으려던 시도는 대조군이 더 크게 움직여 반증됐다
// (docs/plan/PLAN-pubg-gate-2026-09-16.md §8). 검증 축이 없는 공지 항목은 숫자를 지어내지 않고
// "관측 축 미설계"로 회색 처리한다 — 무근거 문장은 회색이라는 원칙 그대로다.
import type { Metadata } from "next";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { loadPubg, isReportable } from "@/lib/pubgData";
import { fmtKst } from "@/lib/format";

export const metadata: Metadata = {
  title: "PUBG 42.3 ⇒ 43.1 · patchgap",
  description:
    "PUBG: BATTLEGROUNDS 43.1 패치노트의 공지와 실제 관측 데이터를 대조한다. 표본은 steam 플랫폼 전역 무작위 official 매치.",
};

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function signedPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export default function PubgPage() {
  const bundle = loadPubg();

  // 출하 게이트 — 데이터가 없으면 빈 표 대신 "미연결"을 정직하게 말한다.
  if (!bundle) {
    return (
      <Container>
        <div className="py-12">
          <h1 className="font-display text-2xl font-bold text-fg">PUBG 어댑터 · 미연결</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted" style={{ maxWidth: "var(--measure)" }}>
            집계 산출물이 아직 없습니다. 어댑터 매핑은 방법론 페이지에서 확인할 수 있습니다.
          </p>
        </div>
      </Container>
    );
  }

  const { deltas, before, after, notes } = bundle;
  const reportable = deltas.rows.filter((row) => isReportable(row.status));
  const unannounced = reportable.filter((row) => row.status === "unannounced");
  const announced = reportable.filter((row) => row.status !== "unannounced");
  const unverifiable = notes.filter((note) => note.expectedRelChange === null);

  return (
    <Container>
      <div className="flex flex-col gap-6 py-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs font-bold tracking-wide text-accent uppercase">
            PUBG: BATTLEGROUNDS · 어댑터 실연결
          </p>
          <h1 className="font-display text-3xl leading-tight font-bold text-balance text-fg">
            42.3 ⇒ 43.1 · 무기 획득 점유율
          </h1>
          <p className="text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure)" }}>
            LoL과 <strong className="text-fg">같은 판정 엔진</strong>에 PUBG 텔레메트리를 넣은
            결과입니다. 바뀐 것은 어댑터(수집·엔티티·지표)뿐이고 통계·게이트·판정 어휘는 그대로입니다.
          </p>
        </header>

        {/* 표본 고지 — LoL(KR·Master+·솔로/듀오)과 성격이 다르므로 반드시 먼저 말한다. */}
        <div className="rounded-md border border-warn/40 bg-surface-warm/40 p-4">
          <p className="font-mono text-xs font-bold text-warn">표본 성격이 LoL과 다릅니다</p>
          <p className="mt-2 text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
            {deltas.meta.sampleScope}. PUBG API는 지역 샤드가 폐지돼 한국 한정 표본을 뽑을 수
            없습니다 — LoL 탭의 <span className="font-mono text-xs">KR · Master+ · 솔로/듀오</span>와
            달리 이 표본은 <strong className="text-fg">전 지역·전 티어 무작위</strong>이며 봇이
            포함됩니다(비율은 아래 병기).
          </p>
        </div>

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
                보입니다 — 아래 표는 전부 <strong className="text-fg-2">총 획득 대비 점유율</strong>로
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
                LoL 바닥값을 가져오지 않고 <strong className="text-fg-2">이 데이터에서 유도</strong>
                했습니다. 패치노트가 언급하지 않은 무기들의 변화 분포(귀무분포) 90번째 백분위수 —
                즉 &ldquo;언급 없는 무기 10개 중 9개보다 크게 움직였다&rdquo;가 기준입니다.
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
            방향과 자릿수</strong>로 판정합니다(공지값의 50~150% 범위면 일치).
          </p>
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
          </div>
        </SectionCard>

        <footer className="flex flex-col gap-1 border-t border-border-soft pt-4">
          <p className="font-mono text-xs text-muted">
            집계 {fmtKst(deltas.meta.generatedAt)} · 판정 {deltas.meta.n}건 · 데이터 PUBG Developer API
          </p>
          <p className="text-xs leading-relaxed text-muted">
            PUBG: BATTLEGROUNDS 및 관련 이미지·데이터의 권리는 KRAFTON, Inc.에 있습니다. 이 페이지는
            비상업 개인 프로젝트이며 KRAFTON이 후원·제휴·승인한 서비스가 아닙니다. 자산 사용 문의
            발송 2026-09-16.
          </p>
        </footer>
      </div>
    </Container>
  );
}
