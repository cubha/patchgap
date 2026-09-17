// src/app/pubg/compare/page.tsx
// PUBG 대조표 — 내비 "대조표"가 PUBG일 때 도달하는 화면. LoL `/compare/`와 같은 자리다.
// 브리핑이 **판정된 것**(발견·공지 대조)만 보여주는 반면 여기는 **전부**를 보여준다 — 바닥에
// 미달했거나 변화가 없었거나 표본이 부족했던 무기까지 포함해야 "움직인 것만 골라 보여준다"는
// 의심을 받지 않는다(LoL 대조표가 below-threshold를 숨기지 않는 것과 같은 이유).
import type { Metadata } from "next";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import PubgCompareTable from "@/components/pubg/PubgCompareTable";
import {
  PubgFooter,
  PubgPageHeader,
  PubgUnavailable,
  pct,
} from "@/components/pubg/shared";
import { loadPubg } from "@/lib/pubgData";

export const metadata: Metadata = {
  title: "PUBG 대조표 · patchgap",
  description: "PUBG 42.3 ⇒ 43.1 무기별 획득 점유율 변화와 판정 상태 전체 목록.",
};

export default function PubgComparePage() {
  const bundle = loadPubg();
  if (!bundle) {
    return (
      <Container>
        <PubgUnavailable />
      </Container>
    );
  }

  const { deltas } = bundle;

  return (
    <Container>
      <div className="flex flex-col gap-6 py-8">
        <PubgPageHeader
          title="무기 판정 전체 — 42.3 ⇒ 43.1"
          lead={
            <>
              점유율이 움직인 무기만이 아니라 <strong className="text-fg">{deltas.meta.n}개 전부</strong>를
              같은 규칙으로 판정한 결과입니다. 바닥 미달·변화 없음·표본 부족도 숨기지 않습니다 —
              고른 것만 보여주면 그건 발견이 아니라 편집입니다.
            </>
          }
        />


        <SectionCard
          eyebrow="판정"
          title="무기별 획득 점유율"
          variant="glass"
          action={
            <span className="font-mono text-xs text-muted">
              효과크기 바닥 {pct(deltas.meta.effectFloor)}
            </span>
          }
        >
          <div className="p-5">
            <PubgCompareTable rows={deltas.rows} />
            <p
              className="mt-4 text-xs leading-relaxed text-muted"
              style={{ maxWidth: "var(--measure-wide)" }}
            >
              점유율 = 그 무기 획득 수 ÷ 총 무기 획득 수. 매치당 총 획득이 {" "}
              {bundle.before.pickupsPerMatch.toFixed(0)} → {bundle.after.pickupsPerMatch.toFixed(0)}
              으로 함께 내려갔기 때문에, 절대 획득 수로 보면 모든 무기가 하향된 것처럼 보입니다 —
              그 기저를 나눠서 뺀 값입니다. q값(BH-FDR 보정) 열이 없는 것은 PUBG 판정이 효과크기
              바닥 + Wilson 신뢰구간 방식이라 q를 계산하지 않기 때문입니다. 없는 값을 빈칸으로
              채우지 않습니다.
            </p>
          </div>
        </SectionCard>

        <PubgFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.meta.n} />
      </div>
    </Container>
  );
}
