// src/app/pubg/page.tsx
// PUBG 브리핑 — LoL의 `/`와 **같은 자리**에 있는 화면이다. 게임 드롭다운으로 전환하면 이 화면이
// 뜨고, 내비(브리핑·대조표·방법론)는 그대로다(PLAN-game-switcher-2026-09-17 R1).
//
// 2026-09-17 재구성: 예전엔 이 한 장이 표본·발견·전체표·한계·버린축을 전부 이고 있었다
// (`/pubg/`가 4번째 내비 탭이던 시절의 구조). 게임 스위처가 붙으면서 LoL과 같은 3분할로 나눈다 —
// 브리핑은 **판정된 것**(발견 + 공지 대조), 전체 47행은 `/pubg/compare/`, 한계·버린 축은
// `/pubg/methodology/`.
//
// 2026-09-17(2차 재구성, 사용자 지시): "gap 표시원칙을 리그오브레전드와 동일하게" — 공지 대조를
// 메인 탭으로 올리고 미공지를 두 번째 탭으로 내렸다. 이전 배치는 발견(미공지)이 대조(공지)
// **위**에 있었는데, LoL 홈은 정확히 그 반대다("패치 내용" 탭이 기본, "미공지 Gap"이 두 번째).
// 같은 사이트에서 같은 질문을 던지는 두 화면이 서로 다른 순서를 쓰면 게임 스위처의 전제가 깨진다.
// 같은 라운드에 `PubgSampleNotice`를 이 화면에서 뺐다 — 방법론에 이미 같은 고지가 있고,
// 사용자가 "시스템을 이용하는 사용자 입장에서 불필요한 부분 제거"를 명시했다.
// (기준선 갱신: docs/plan/PLAN-pubg-gate-2026-09-16.md §9-2 R5 — 세 화면 전부에 붙이던
//  이전 합의를 이 지시가 대체한다.)
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
  PubgUnavailable,
  pct,
  signedPct,
} from "@/components/pubg/shared";
import PubgBriefingTabs from "@/components/pubg/PubgBriefingTabs";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { loadPubg, loadPubgMaps, isReportable } from "@/lib/pubgData";
import { mapHref, weaponHref } from "@/lib/pubgRoutes";
import { mapIdentity } from "@/pipeline/aggregate/pubg-maps";

export const metadata: Metadata = {
  title: "PUBG 42.3 ⇒ 43.1 · patchgap",
  description:
    "PUBG: BATTLEGROUNDS 43.1 패치노트의 공지와 실제 관측 데이터를 대조한다. 표본은 steam 플랫폼 전역 무작위 official 매치.",
};

export default function PubgPage() {
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

  const { deltas, before, after, notes } = bundle;
  const maps = loadPubgMaps();
  const reportable = deltas.rows.filter((row) => isReportable(row.status));
  const unannounced = reportable.filter((row) => row.status === "unannounced");
  const announced = reportable.filter((row) => row.status !== "unannounced");

  return (
    <main>
      <Container>
      {/* pt-40(160px) — 승인 시안의 `.hero-body`가 히어로 스테이지 **하단**에 붙어 있는 배치를
          옮긴 것이다. 키아트가 가장 밝은 상단 구간(잔해·낙하산)을 글자로 덮지 않고 그대로
          보여주고, 제목은 스크림이 충분히 내려앉은 아래쪽에서 읽히게 한다. LoL 홈이 같은
          이유로 pt-44를 쓴다(src/app/page.tsx:85) — 아트 밴드 높이에 맞춰 한 단계 작은 값. */}
      <div className="flex flex-col gap-6 pt-40 pb-8">
        <PubgPageHeader
          showReplay
          title={
            <>
              <span className="text-accent">42.3 ⇒ 43.1</span> · 무기 획득 점유율
            </>
          }
          lead={
            <>
              리그 오브 레전드와 <strong className="text-fg">같은 판정 엔진</strong>에 PUBG
              텔레메트리를 넣은 결과입니다. 바뀐 것은 어댑터(수집·엔티티·지표)뿐이고 통계·게이트·
              판정 어휘는 그대로입니다.
            </>
          }
        />

        {/* 판정 요약 3타일 — 승인 시안 `.stat-row`/`.stat-tile`(공지된 변화 / 유의 변화 / 미공지).
            /verify-impl 축B(2026-09-17)에서 **PUBG 브리핑에만 없다**는 것이 잡혔다: LoL 홈은
            같은 자리에 같은 타일 3개를 갖고 있는데(14 / 403 / 47) PUBG는 표본·기저·게이트 카드로
            바로 넘어가 "이 화면이 무엇을 발견했나"가 한눈에 안 들어왔다. 게임 스위처의 전제
            (같은 사이트, 데이터와 테마만 다름)와도 어긋난다.
            숫자 정의는 PUBG 데이터에 맞게 정직하게 잡는다 — LoL의 지표를 그대로 옮기지 않는다. */}
        <section className={`${panelSurfaceClass("glass")} grid grid-cols-3 overflow-hidden rounded-lg`}>
          <div className="border-r border-border-soft p-5">
            <strong className="block font-display text-3xl font-bold tabular-nums text-fg">
              {notes.length}
            </strong>
            <span className="mt-1 block text-xs text-muted">공지된 변화 (43.1 패치노트)</span>
          </div>
          <div className="border-r border-border-soft p-5">
            <strong className="block font-display text-3xl font-bold tabular-nums text-fg">
              {reportable.length}
            </strong>
            <span className="mt-1 block text-xs text-muted">
              유의 변화 (효과크기 바닥 {pct(deltas.meta.effectFloor)} 초과)
            </span>
          </div>
          <div className="p-5">
            <strong className="block font-display text-3xl font-bold tabular-nums text-accent">
              {unannounced.length}
            </strong>
            <span className="mt-1 block text-xs text-muted">미공지</span>
          </div>
        </section>

        {/* 요구 1·2(2026-09-17): 공지 대조가 **기본 탭**이고 미공지는 두 번째 탭이다.
            이전엔 미공지 섹션이 대조 섹션 위에 통째로 놓여 있었다 — LoL 홈과 순서가 정반대라
            게임을 바꾸면 같은 질문이 다른 자리에서 답해졌다. 카운트 배지는 화면에 실제로
            렌더되는 행 수와 같다(스트림과 달리 여기선 집계 단위가 곧 행 단위라 어긋날 여지가
            없다 — LoL 홈의 "카운트 배지 소스" 주의사항이 여기엔 해당하지 않는다). */}
        <PubgBriefingTabs
          contentCount={announced.length}
          gapCount={unannounced.length}
          content={
            <SectionCard
              eyebrow="대조"
              title="공지된 변경은 실제로 그렇게 됐나"
              variant="glass"
              action={<span className="font-mono text-xs text-muted">{announced.length}건</span>}
            >
              {/* 기저 카드가 표 아래로 내려갔으므로(라운드5 A3) 정규화 사실은 표 머리에서 먼저 말한다 —
                  매치당 총 획득이 490 → 427로 함께 내려가, 이 한 줄이 없으면 모든 무기가 하향으로 읽힌다. */}
              <p className="border-b border-border-soft px-5 py-2 text-xs text-muted">
                모든 수치는 매치당 총 획득 대비 <strong className="text-fg-2">점유율</strong>(기저 보정) ·{" "}
                {before.nMatches.toLocaleString()} → {after.nMatches.toLocaleString()}매치
              </p>
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
                          <td className="py-3 pl-5 pr-3 font-display font-bold">
                            <Link href={weaponHref(row.weaponKey)} className="text-fg hover:text-accent">
                              {row.weaponName}
                            </Link>
                          </td>
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
                <Link href="/pubg/methodology/" className="text-accent underline underline-offset-2">
                  판정 규칙 전체 →
                </Link>
              </p>
            </SectionCard>
          }
          gap={
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
                      <Link
                        href={weaponHref(row.weaponKey)}
                        className="font-display font-bold text-fg hover:text-accent"
                      >
                        {row.weaponName}
                      </Link>
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
          }
        />

        {/* 라운드5 A3(2026-09-18): 표본·기저·게이트 카드는 **결과(탭) 아래**에 둔다. 이전엔 타일 →
            카드 3장 → 탭 순서라 방법이 결과 위에 있었다 — LoL 홈은 히어로 → 스트림(결과)이고 방법
            패널은 옆 열이다. 채점표가 4라운드 동안 "승인 시안"이라 적었으나 실물 시안(「PUBG 테마
            시안」)은 히어로·stat-tile까지만 정의하고 이 카드는 #9 구현이 임의 배치한 것이었다
            (docs/plan/BRAINTRUST-residual3-2026-09-18.md §0). */}
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

        {/* 맵 축(2026-09-17, A4) — 판정이 아니라 **기술 통계**다. 43.1 패치노트에 맵 항목이
            0건이라 짝지을 선언이 없다. 그 사실을 숨기지 않고 카드 안에서 말한다. */}
        {maps ? (
          <SectionCard
            eyebrow="맵"
            title="어디서 얼마나 싸웠나"
            variant="glass"
            action={
              <span className="font-mono text-xs text-muted">{maps.after.maps.length}종 · 판정 없음</span>
            }
          >
            <ul className="grid gap-px bg-border-soft sm:grid-cols-2 lg:grid-cols-3">
              {maps.after.maps.map((map) => {
                const identity = mapIdentity(map.mapKey);
                const delta = maps.deltas.rows.find((r) => r.mapKey === map.mapKey) ?? null;
                return (
                  <li key={map.mapKey} className="bg-surface p-4">
                    <Link href={mapHref(map.mapKey)} className="font-display font-bold text-fg hover:text-accent">
                      {identity.koName}
                    </Link>
                    <div className="mt-1 flex items-baseline gap-2 font-mono text-xs text-muted">
                      <span className="tabular-nums text-fg-2">{pct(map.matchShare, 1)}</span>
                      {delta ? (
                        <span
                          className={
                            delta.matchShareDelta > 0 ? "tabular-nums text-success" : "tabular-nums text-danger"
                          }
                        >
                          {signedPct(delta.matchShareDelta, 1)}
                        </span>
                      ) : (
                        <span>비교 구간 없음</span>
                      )}
                      <span className="tabular-nums">n={map.nMatches.toLocaleString()}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="px-5 pt-4 pb-5 text-xs leading-relaxed text-muted">
              43.1 패치노트에 맵 항목이 없어 <strong className="text-fg-2">판정을 붙이지
              않습니다</strong> — 짝지을 선언이 없는 축에 판정 어휘를 쓰면 &ldquo;노트에
              없다&rdquo;가 관측이 아니라 전제가 됩니다.
            </p>
          </SectionCard>
        ) : null}

        <p className="text-sm text-muted">
          바닥 미달·무변화까지 포함한 전체 {deltas.meta.n}개 무기 판정은{" "}
          <Link href="/pubg/compare/" className="text-accent underline underline-offset-2">
            대조표
          </Link>
          에 있습니다.
        </p>

        <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
      </div>
    </Container>
    </main>
  );
}
