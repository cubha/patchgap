// src/components/tft/TftObservedRedirect.tsx
// 최신형 상세 주소(`/tft/unit/{key}`)가 **관측 전**일 때의 페이지(ST-17, 2026-10-08 site-review tft-S21·S22).
//
// 패치가 넘어가면 직전 최신 쌍의 상세는 `/tft/history/{쌍}/unit/{key}`로 옮겨 가는데, 그 사이 디스코드로 나간 최신형 링크는
// 리다이렉트 없이 404였다. 정적 export라 서버 리다이렉트가 없으므로(`vercel.json`은 쌍을 모른다) 이 페이지가 **meta refresh**로
// 보내고, 스크립트·refresh가 막힌 환경을 위해 같은 링크를 본문에도 둔다. React 19는 본문의 `<meta>`를 head로 올린다.
import Container from "@/components/Container";
import ObservationPendingNotice from "@/components/ObservationPendingNotice";
import PageHeader from "@/components/PageHeader";
import { TftFooter } from "@/components/tft/shared";
import { detailCrumbs } from "@/lib/breadcrumbs";
import type { ObservationFailure } from "@/pipeline/types";

export interface TftObservedRedirectProps {
  name: string;
  /** 관측이 있는 최신 쌍의 같은 대상 상세. */
  href: string;
  /** 「18.2 → 18.3」 */
  pairLabel: string;
  failure: ObservationFailure;
  generatedAt: string;
}

export default function TftObservedRedirect({ name, href, pairLabel, failure, generatedAt }: TftObservedRedirectProps) {
  return (
    <main>
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <Container>
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <PageHeader
            crumbs={detailCrumbs("tft", name)}
            title={`${name} — 최신 쌍은 관측 전`}
            lead={`이 대상의 가장 최근 관측은 ${pairLabel} 쌍에 있습니다. 그 상세로 이동합니다.`}
          />
          <ObservationPendingNotice failure={failure} observed={{ href, label: pairLabel, section: "상세" }} className="max-w-2xl" />
        </div>
      </Container>
      <TftFooter generatedAt={generatedAt} nVerdicts={0} />
    </main>
  );
}
