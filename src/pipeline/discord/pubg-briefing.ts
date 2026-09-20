// src/pipeline/discord/pubg-briefing.ts
// PUBG 브리핑 — `assembleBriefing`(게임 무관 조립)에 PUBG 전용 게이트·포맷만 끼운다.
//
// **왜 `buildBriefingEmbeds`(LoL/TFT)를 그대로 못 쓰는가.** PUBG 행은 `DeltaRecord`가 아니다:
//
//   | | LoL·TFT            | PUBG                                   |
//   |-|--------------------|----------------------------------------|
//   | 변화량 | `delta`(%p)   | `relChange`(비율 — -0.162 = 16.2% 감소) |
//   | 구간   | `ci`          | `relCi`                                |
//   | 유의성 | `q` + `qAlpha`| **없음** — `pubg-delta.ts classify()`가 status에 접어넣음 |
//   | 지표   | `DeltaMetric` | `"pickupShare"`(그 유니온에 없다)      |
//
// 그래서 억지 변환은 두 곳에서 조용히 틀린다: ① `metricKind("pickupShare")`가 `undefined`라
// `formatDeltaLine`의 두 분기를 다 빗나가 **초 단위 포맷터**로 떨어지고 ② `relChange: 6.758`을
// `delta` 자리에 넣으면 `fmtPp`가 **"+675.8%p"**를 찍는다(실제 값은 ×6.76). `q`를 지어내 채우는
// 것은 이 저장소의 무근거 금지 원칙에 정면으로 어긋난다.
//
// **게이트는 화면과 같은 것을 쓴다.** `src/app/pubg/page.tsx`가 `isReportable(row.status)`와
// `displayStatusOf(row.status)`를 쓰므로 여기서도 그 쌍을 부른다 — webhook.ts S11 주석(2026-09-18)이
// 기록한 결함이 정확히 이 계열이었다: 같은 행을 두고 웹은 회색으로 강등하고 디스코드는
// "공지-불일치"로 방송했다. 표면이 늘 때마다 술어를 복제하지 않는 것이 그 처방이다.
import { weaponHref } from "../../lib/pubgRoutes";
import { displayStatusOf } from "../shared/display-status";
import { isReportable } from "../shared/pubg-status";
import type { PubgDeltaRow } from "../match/pubg-delta";
import {
  assembleBriefing,
  type BuildBriefingOptions,
  type DiscordEmbed,
  type DiscordEmbedField,
} from "./webhook";

/** 이 파일이 다루는 최소 형태 — `src/lib/pubgData.ts`의 `PubgDeltasFile`과 구조가 같되 `node:fs`를
 * 끌고 오지 않으려고 여기서 다시 좁힌다(그 모듈은 로더라 fs에 의존한다). */
export interface PubgBriefingSourceFile {
  meta: { from: string; to: string; generatedAt: string };
  rows: readonly PubgDeltaRow[];
}

/** 화면(`components/pubg/shared.tsx`의 `signedPct`)과 **같은 출력**을 낸다. 그 파일은 `.tsx`
 * 컴포넌트 모듈이라 파이프라인에서 import하지 않고, 대신 규칙을 같게 유지한다. */
export function signedPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

/** 획득 점유율 자체(비율)의 표기 — 변화량(`signedPct`)과 달리 부호를 붙이지 않는다. */
export function sharePct(value: number, digits = 3): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** PUBG는 지표가 하나뿐이다(`pickupShare`). `metricLabel`은 `DeltaMetric` 전용이라 쓸 수 없다. */
const PICKUP_SHARE_LABEL = "획득 점유율";

export function buildPubgField(
  row: PubgDeltaRow,
  siteUrl: string,
  inconsistent: boolean
): DiscordEmbedField {
  const name = `${inconsistent ? "⚠ " : ""}${row.weaponName} · ${PICKUP_SHARE_LABEL}`;
  const url = `${siteUrl}${weaponHref(row.weaponKey)}`;
  // before/after가 null인 행은 애초에 보고 자격 게이트를 통과하지 못하지만, 방어적으로
  // "데이터 없음"을 내고 지어내지 않는다(LoL `formatDeltaLine`과 같은 처리).
  const value =
    row.before === null || row.after === null || row.relChange === null
      ? `데이터 없음 · [근거](${url})`
      : `${sharePct(row.before)} → ${sharePct(row.after)} (${signedPct(row.relChange)}, ` +
        `CI [${signedPct(row.relCi[0] ?? 0)}, ${signedPct(row.relCi[1] ?? 0)}]) · [근거](${url})`;
  return { name, value };
}

/**
 * PUBG deltas.json → embed. 정렬은 하지 않는다 — 산출물이 이미 판정 우선순위로 기록돼 있고,
 * 여기서 다시 정렬하면 화면 표 순서와 브리핑 순서가 갈린다.
 */
export function buildPubgBriefingEmbeds(
  deltas: PubgBriefingSourceFile,
  options: BuildBriefingOptions
): DiscordEmbed[] {
  const { from, to, generatedAt } = deltas.meta;
  const rows = deltas.rows;

  const unannounced = rows.filter((r) => r.status === "unannounced");
  const anomalies = rows.filter((r) => displayStatusOf(r.status) === "announced-anomaly");

  // 헤드라인 M — 화면 상단이 세는 것과 **같은 술어**(`isReportable(status)`)다. LoL의
  // `countReportable`은 q·바닥을 보므로 여기 쓸 수 없고, 쓸 필요도 없다: PUBG는 그 두 게이트가
  // 이미 status에 반영돼 있다.
  const significantCount = rows.filter((r) => isReportable(r.status)).length;
  // 미공지 N — 행이 아니라 **무기** 수. 지금은 무기당 지표가 하나뿐이라 값이 같지만, 지표가
  // 늘면 갈라진다(LoL `countGapEntities`가 엔티티로 세는 것과 같은 이유).
  const gapEntityCount = new Set(unannounced.map((r) => r.weaponKey)).size;

  return assembleBriefing<PubgDeltaRow>(
    { from, to, generatedAt, unannounced, anomalies, significantCount, gapEntityCount, buildField: buildPubgField },
    options
  );
}
