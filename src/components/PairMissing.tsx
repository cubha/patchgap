// src/components/PairMissing.tsx
// 과거 쌍 라우트가 그릴 쌍이 없을 때(빈 데이터 빌드의 `_placeholder`, 또는 최신 쌍 슬러그) — 지어내지 않고 그렇다고 말한다.
// 과거 쌍 라우트가 여섯 개(두 게임 × 브리핑·대조표·상세)라 같은 문장을 한 곳에 둔다(2026-09-28, 이월 R8).
import Container from "@/components/Container";

export default function PairMissing() {
  return (
    <main>
      <Container>
        <p className="pt-40 pb-8 text-sm text-muted">이 패치쌍의 기록이 없습니다.</p>
      </Container>
    </main>
  );
}
