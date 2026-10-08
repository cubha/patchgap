// src/components/ObservationPendingNotice.tsx
// 「관측 전」 안내 한 장(ST-15·ST-16, 2026-10-08 site-review tft-S6·parity-S1·S2). 최신 쌍이 관측 stub(C13·C14)일 때 브리핑
// 배너·대조표·상세·방법론이 **같은 문장과 같은 링크**로 말한다 — 전에는 "패치노트는 TFT 홈에서 볼 수 있습니다"라는 링크
// 아닌 문장으로 끝나, 관측이 있는 직전 쌍으로 가는 길이 헤더 select뿐이었다.
//
// 링크는 호출부가 만든다(쌍별 라우트는 `lib/pairRoutes`가 소유) — 이 컴포넌트는 게임을 모른다.
import Link from "next/link";

import { observationReasonLabel } from "@/pipeline/shared/observation-stub";
import type { ObservationFailure } from "@/pipeline/types";

/** 관측이 있는 최신 쌍으로 가는 링크. 없으면(그 게임에 관측 쌍이 하나도 없음) 문장만 남는다. */
export interface ObservedPairLink {
  readonly href: string;
  /** 「18.2 → 18.3」 */
  readonly label: string;
  /** 「브리핑」·「대조표」·「방법론」·「상세」 — 링크가 데려다주는 화면. */
  readonly section: string;
}

export interface ObservationPendingNoticeProps {
  failure: ObservationFailure;
  observed?: ObservedPairLink | null;
  /** 방법론처럼 **아래 내용이 다른 쌍 기준**일 때 그 사실을 덧붙인다. */
  basis?: string | null;
  className?: string;
}

export default function ObservationPendingNotice({ failure, observed = null, basis = null, className = "" }: ObservationPendingNoticeProps) {
  return (
    <p
      role="status"
      data-observation={failure.reason}
      className={`rounded-md border border-border-soft bg-surface px-4 py-3 text-sm leading-relaxed text-muted ${className}`}
    >
      {observationReasonLabel(failure.reason)}
      {basis ? <> {basis}</> : null}
      {observed ? (
        <>
          {" "}
          <Link href={observed.href} className="font-bold text-accent hover:underline" data-observed-link="">
            관측이 있는 최신 쌍 {observed.label} {observed.section} 보기 →
          </Link>
        </>
      ) : null}
    </p>
  );
}
