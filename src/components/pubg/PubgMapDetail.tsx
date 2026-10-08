// src/components/pubg/PubgMapDetail.tsx — 2026-10-06 `app/pubg/map/[key]/page.tsx`에서 본문 이관(무기 상세와 같은 구조).
// 페이지는 로드·정적 경로만 맡는다. 이하 원 헤더:
// PUBG 맵 상세 — 승인 아티팩트 §4의 `맵` 탭. 시안이 격하시킨 "항공뷰 지도"를 바로 여기서 쓴다
// ("항공뷰 지도는 격하돼 §4 맵 상세 탭에서만 쓴다 — 특정 맵 패치를 조회할 때는 여전히 필요").
//
// **판정 뱃지가 없는 이유**: 43.1 패치노트에 맵 항목이 0건이다. 짝지을 선언이 없는 축에 판정
// 어휘를 붙이면 "노트에 없다"가 관측이 아니라 전제가 된다 — LoL에서 집계 엔티티를 미공지에서
// 빼낸 것과 같은 판단이다(PLAN-patchgap.md 계약 확장 이력 2026-09-13 2차). 이 화면은 기술
// 통계만 말하고, 그 사실을 화면에서도 명시한다.
//
// **2026-10-06 상세 공통 관측 섹션 — 기술통계 모드**(사용자 확정, PLAN D5): 무기·LoL·TFT 상세와 **같은 섹션**을 쓰되
// 판정이 없는 축임을 그 자리에서 말한다 — 뱃지 「판정 없음」 · Δ 중립색 · CI 「산출하지 않음」 · 원천 매치 칸 없음 ·
// 원인 칸은 맵 풀 로테이션 사실(산출물에서 계산). 지표 탭은 매치 점유율 · 평균 매치 시간 · 봇 비율 · 매치당 획득.
// 스플래시는 지형도만 들고(수치는 섹션의 몫), 「많이 줍는 총」 표는 섹션 아래에 그대로 둔다.
import Link from "next/link";
import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import { detailCrumbs } from "@/lib/breadcrumbs";
import SectionCard from "@/components/SectionCard";
import ItemChart from "@/components/item/ItemChart";
import { valuesChartData } from "@/components/item/chartData";
import ObservationPanel, { NoVerdictBadge } from "@/components/observation/ObservationPanel";
import ObservationSection from "@/components/observation/ObservationSection";
import { ALL_SEGMENT } from "@/components/observation/observationModel";
import PubgDetailSplash from "@/components/pubg/PubgDetailSplash";
import { mapRotationSentence } from "@/components/pubg/mapRotation";
import { PubgFooter, PubgUnavailable, pct } from "@/components/pubg/shared";
import { loadPubgAssets, loadPubgMaps, pubgMapKeys, type PubgBundle, type PubgDeclaration } from "@/lib/pubgData";
import { mapKeyFromSlug, weaponHref } from "@/lib/pubgRoutes";
import { mapIdentity, type PubgMapDeltaRow } from "@/pipeline/aggregate/pubg-maps";
import { publicMapPath } from "@/pipeline/pubg/asset-path";
import { pubgVerdictCount } from "@/pipeline/shared/headline";
import { fmtDisplayDelta } from "@/lib/format";

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 부호 붙은 시간 차(「+1:02」). 기술통계라 방향에 좋고 나쁨이 없다 — 색은 호출부가 중립으로 둔다. */
function fmtDurationDelta(before: number | null, after: number | null): string {
  // 표시된 두 시각(분:초)의 차(ST-09) — 「29:29 → 30:31 +1:03」(차 1:02)이 나가던 결함. 소유자는 `lib/format`.
  return fmtDisplayDelta(before, after, "sec");
}

/** 부호 붙은 %p 차 — 표시된 두 퍼센트(소수 1자리)의 차(ST-09). */
function fmtPpDelta(before: number, after: number): string {
  return fmtDisplayDelta(before, after, "pp");
}

interface MapMetric {
  key: string;
  label: string;
  before: number | null;
  after: number | null;
  beforeText: string;
  afterText: string;
  deltaText: string;
}

/** 맵 기술통계 탭 — 비교행(`PubgMapDeltaRow`)의 네 값. 판정을 만들지 않으므로 자격 필터가 없다(전부 관측값이다). */
function mapMetrics(delta: PubgMapDeltaRow): MapMetric[] {
  return [
    {
      key: "matchShare",
      label: "매치 점유율",
      before: delta.matchShare.before,
      after: delta.matchShare.after,
      beforeText: pct(delta.matchShare.before, 1),
      afterText: pct(delta.matchShare.after, 1),
      deltaText: fmtPpDelta(delta.matchShare.before, delta.matchShare.after),
    },
    {
      key: "avgDurationSec",
      label: "평균 매치 시간",
      before: delta.avgDurationSec.before,
      after: delta.avgDurationSec.after,
      beforeText: fmtDuration(delta.avgDurationSec.before),
      afterText: fmtDuration(delta.avgDurationSec.after),
      deltaText: fmtDurationDelta(delta.avgDurationSec.before, delta.avgDurationSec.after),
    },
    {
      key: "botShare",
      label: "봇 비율",
      before: delta.botShare.before,
      after: delta.botShare.after,
      beforeText: pct(delta.botShare.before),
      afterText: pct(delta.botShare.after),
      deltaText: fmtPpDelta(delta.botShare.before, delta.botShare.after),
    },
    {
      key: "pickupsPerMatch",
      label: "매치당 획득",
      before: delta.pickupsPerMatch.before,
      after: delta.pickupsPerMatch.after,
      beforeText: delta.pickupsPerMatch.before.toFixed(0),
      afterText: delta.pickupsPerMatch.after.toFixed(0),
      deltaText: `${delta.pickupsPerMatch.after >= delta.pickupsPerMatch.before ? "+" : "−"}${Math.abs(
        delta.pickupsPerMatch.after - delta.pickupsPerMatch.before
      ).toFixed(0)}`,
    },
  ];
}

export default function PubgMapDetail({
  slug,
  bundle,
  declaration,
}: {
  slug: string;
  bundle: PubgBundle | null;
  declaration: PubgDeclaration | null;
}) {
  const maps = loadPubgMaps();
  if (!bundle || !maps) {
    return (
      <main>
      <Container>
        <PubgUnavailable failure={declaration?.failure} />
      </Container>
    </main>
    );
  }

  const mapKey = mapKeyFromSlug(slug, pubgMapKeys());
  const statAfter = mapKey ? (maps.after.maps.find((m) => m.mapKey === mapKey) ?? null) : null;
  const statBefore = mapKey ? (maps.before.maps.find((m) => m.mapKey === mapKey) ?? null) : null;
  const shown = statAfter ?? statBefore;

  if (!mapKey || !shown) {
    return (
      <main>
      <Container>
        <div className="py-12">
          <h1 className="font-display text-2xl font-bold text-fg">알 수 없는 맵</h1>
          <p className="mt-3 text-sm text-muted">
            이 표본에 그 맵이 없습니다.{" "}
            <Link href="/pubg/" className="text-accent underline-offset-2 hover:underline">
              브리핑으로 →
            </Link>
          </p>
        </div>
      </Container>
    </main>
    );
  }

  const identity = mapIdentity(mapKey);
  const assets = loadPubgAssets();
  const hasRender = identity.assetName !== "" && (assets?.maps.includes(identity.assetName) ?? false);
  const delta = maps.deltas.rows.find((r) => r.mapKey === mapKey) ?? null;
  // 한쪽 구간에만 표본이 잡힌 맵 — 비교행이 없다는 사실을 문장으로 말한다.
  const oneSided = delta === null;

  const { from, to } = maps.deltas.meta;
  // 이 수치가 어디서 나왔는지 한 문장 — 판정 근거 문단이 성립하지 않는 축이라 출처만 말한다(2026-09-19 사용자 지적
  // 「근거가 전혀 사용자가 알아볼 수 없게」의 맵 쪽 대응). 패널의 첫 줄에 선다.
  const sourceProse = delta
    ? [
        `이 수치는 Steam 전 지역·전 티어 매치 중 ${identity.koName}에서 진행된 ` +
          `${(statBefore?.nMatches ?? 0).toLocaleString()}건(${from}) · ${(statAfter?.nMatches ?? 0).toLocaleString()}건(${to})을 집계한 것입니다.`,
      ]
    : [];
  const rotation = mapRotationSentence(maps.deltas.meta);
  const metrics = delta
    ? mapMetrics(delta).map((metric) => ({
        key: metric.key,
        label: metric.label,
        segments: [
          {
            key: ALL_SEGMENT,
            label: "전체",
            panel: (
              <ObservationPanel
                badge={<NoVerdictBadge />}
                before={metric.beforeText}
                after={metric.afterText}
                delta={<span className="font-mono text-sm font-bold tabular-nums text-fg-2">{metric.deltaText}</span>}
                chart={
                  <ItemChart
                    data={valuesChartData(metric.before, metric.after, [metric.beforeText, metric.afterText], from, to)}
                  />
                }
                chartCaption="95% CI 산출하지 않음 — 판정 대상이 아닙니다"
                prose={sourceProse}
                gate={[
                  { label: "n(전) 매치", value: delta.n.before.toLocaleString() },
                  { label: "n(후) 매치", value: delta.n.after.toLocaleString() },
                  { label: "판정", value: `없음 — ${to} 패치노트에 맵 항목 없음` },
                ]}
                gateLink={{ href: "/pubg/methodology/", label: "방법론 보기 →" }}
                source={null}
                causes={
                  <p className="pt-3 text-sm text-muted">판정이 없어 원인을 추정하지 않습니다 — {rotation}</p>
                }
              />
            ),
          },
        ],
      }))
    : [];

  return (
    <main>
      <Container>
      <div className="flex flex-col gap-6 pt-12 pb-8">

        {/* 이동 경로 + h1은 `PageHeader`가 소유한다(§8-7 #1·#8): 전에는 이 화면에 h1이 없고
            이동 경로 구분자도 `/`라 다른 두 게임과 달랐다. 스플래시 카드는 그 아래 시각 블록이다. */}
        <PageHeader
          crumbs={detailCrumbs("pubg", identity.koName)}
          title={identity.koName}
          titleAside={
            // 머리 뱃지 자리도 다른 상세와 같다 — 판정이 없는 축이라 상태 어휘 대신 「판정 없음」을 둔다.
            <span className="flex items-center gap-2">
              {`맵 · ${identity.sizeLabel}`}
              <NoVerdictBadge />
            </span>
          }
          lead={
            // 맵에는 통계 판정 행이 없다 — 없는 판정을 있는 것처럼 쓰지 않고 관측값만 말한다.
            oneSided
              ? "한쪽 구간에만 표본이 잡혀 두 패치를 비교하지 않았습니다."
              : `${bundle.deltas.meta.to} 패치노트에 맵 항목이 없어 판정 없이 관측값만 표시합니다.`
          }
          actions={
            <Link
              href="/pubg/methodology/#discord"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-accent-on hover:opacity-90"
            >
              방송 규칙 보기 →
            </Link>
          }
        />

        {/* 유형·이름·판정은 위 머리가 소유한다(§8-1). 이 카드는 지형도와 수치만 든다. */}
        <PubgDetailSplash
          imageSrc={hasRender ? publicMapPath(identity.assetName) : null}
          fit="cover"
          fallbackMark={identity.koName}
          stats={[]}
        />

        {/* 선언 대조 — 네 상세가 같은 골격이다(머리 → 패치노트 대조 → 관측, 2026-10-07 화면 대조 V6). 맵은 노트가 말한
            항목이 0건이라 그 사실을 같은 자리에서 말한다 — 머리 문장으로만 흡수하면 이 상세만 섹션이 하나 빈다. */}
        <SectionCard
          eyebrow="선언 대조"
          title="패치노트 대조"
          variant="glass"
          action={<span className="font-mono text-xs text-muted">말한 것 0</span>}
        >
          <p className="px-5 py-4 text-sm text-muted">
            {to} 패치노트에 이 맵을 언급한 항목이 없습니다. 그래서 아래 관측은 판정 없이 값만 보입니다.
          </p>
        </SectionCard>

        <ObservationSection
          mode="descriptive"
          metrics={metrics}
          initial={metrics.length > 0 ? { metric: metrics[0].key, segment: ALL_SEGMENT } : null}
          segmentLabel={null}
          noSegmentNote={`판정 없음 — ${to} 패치노트에 맵 항목이 없어 관측값만 보입니다`}
          emptyText={`이 맵은 한쪽 구간에만 표본이 잡혀 두 패치를 비교하지 않았습니다(${shown.nMatches.toLocaleString()}매치). ${rotation}`}
        />

        <SectionCard
          eyebrow="구성"
          title={`${identity.koName}에서 많이 줍는 총`}
          variant="glass"
          action={<span className="font-mono text-xs text-muted">{maps.deltas.meta.to} 기준</span>}
        >
          {(statAfter ?? shown).topWeapons.length === 0 ? (
            <p className="p-5 text-sm text-muted">이 구간 표본에 무기 획득 기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-soft">
              {(statAfter ?? shown).topWeapons.map((weapon) => (
                <li key={weapon.weaponKey} className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <Link
                    href={weaponHref(weapon.weaponKey)}
                    className="font-display font-bold text-fg hover:text-accent"
                  >
                    {weapon.weaponName}
                  </Link>
                  <span className="font-mono text-sm tabular-nums text-fg-2">
                    {pct(weapon.share, 2)}
                    <span className="ml-2 text-xs text-muted">
                      {weapon.pickups.toLocaleString()}회
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-5 pt-3 pb-5 text-xs text-muted">이 맵 안의 총 무기 획득 대비 점유율</p>
        </SectionCard>

        <PubgFooter generatedAt={maps.deltas.meta.generatedAt} nVerdicts={pubgVerdictCount(bundle.deltas.rows)} />
      </div>
    </Container>
    </main>
  );
}
