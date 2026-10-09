// src/components/NewerPatchNotice.tsx
// 「더 새 패치노트가 있다」 배너 한 장(PLAN-home-observed-pair ST-4, 2026-10-09). 홈은 **관측이 있는 최신 쌍**을 그리고, 그보다 새
// 패치(관측 stub = 선언만 쌍)는 이 배너가 말한다 — 노트는 즉시 최신화되되 빈 분석이 홈을 차지하지 않는다(사용자 정정:
// "최신 데이터 = 최신 상태의 **분석 내용**"). 모양은 `ObservationPendingNotice`와 같은 안내 문단이다(새 블록 유형이 아니다).
//
// 링크는 호출부가 만든다(쌍별 라우트는 `lib/pairRoutes`가 소유) — 이 컴포넌트는 게임을 모른다. 링크가 없으면(PUBG — 과거 쌍
// 라우트 없음) 문장만 남는다.
import Link from "next/link";

import ExternalLink from "@/components/ExternalLink";
import type { ObservationFailReason } from "@/pipeline/types";

export interface NewerPatchNoticeProps {
  /** 「18.4」 */
  patch: string;
  /** 머리와 같은 단위 — 대상 수(`declarationEntityCount`). */
  entityCount: number;
  /** 관측이 비어 있는 사유 — 날짜는 **대기(`awaiting-observation`)일 때만** 말한다. 키 만료·크래시는 날짜가 아니라 조치가 답이고,
   * 그걸 "표본이 쌓이면"으로 덮으면 고장을 대기로 읽게 한다(scope-critic ST-4). */
  reason: ObservationFailReason;
  /** 「10/10(토) 06:00 KST」 — 첫 관측 실행 예정. 계산 불가·이미 지난 시각이면 null(날짜를 지어내지 않는다). */
  eta: string | null;
  /** 그 패치의 선언 뷰(내부) 또는 패치노트 원문(외부 — 과거 쌍 라우트가 없는 PUBG)으로 가는 주소. 없으면 문장만. */
  href: string | null;
  className?: string;
}

function observationSentence(reason: ObservationFailReason, eta: string | null): string {
  if (reason !== "awaiting-observation") return "관측·판정은 지금 멈춰 있습니다 — 사유는 그 패치 화면이 말합니다.";
  return eta ? `관측·판정은 ${eta}부터 시작합니다.` : "관측·판정은 표본이 쌓이면 시작합니다.";
}

export default function NewerPatchNotice({ patch, entityCount, reason, eta, href, className = "" }: NewerPatchNoticeProps) {
  return (
    <p
      role="status"
      data-newer-patch={patch}
      className={`rounded-md border border-border-soft bg-surface px-4 py-3 text-sm leading-relaxed text-muted ${className}`}
    >
      <strong className="text-fg">{patch} 패치노트</strong>가 반영됐습니다({entityCount}개 항목).{" "}
      {observationSentence(reason, eta)}
      {href ? (
        <>
          {" "}
          {/^https?:\/\//.test(href) ? (
            <ExternalLink href={href} className="font-bold text-accent hover:underline" data-newer-patch-link="">
              {patch} 패치노트 원문 ↗
            </ExternalLink>
          ) : (
            <Link href={href} className="font-bold text-accent hover:underline" data-newer-patch-link="">
              {patch} 패치노트 보기 →
            </Link>
          )}
        </>
      ) : null}
    </p>
  );
}
