// src/components/Breadcrumb.tsx
// 이동 경로 — **한 형식**(UX-BRIEF §8-5 `브리핑 › 대조표 › {대상}`).
//
// 실측 이탈(§8-7 #8): `대조표 › 챔피언 › 오공`(LoL) · `← 대조표 / 유닛`(TFT) ·
// `브리핑 / 대조표 / Groza`(PUBG) — 구분자도, 출발점도, 중간 마디도 셋이 달랐다.
// 규칙: 출발은 항상 그 게임의 **브리핑**, 구분자는 `›`, 마지막 마디는 **대상 이름**이고
// 링크가 아니다(현재 위치). 엔티티 유형은 마디가 아니다 — 제목 옆 라벨이 이미 말한다.
import Link from "next/link";

export interface Crumb {
  label: string;
  /** 마지막 마디는 링크를 걸지 않는다(현재 위치). */
  href?: string;
}

export default function Breadcrumb({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="이동 경로" className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden="true">›</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-accent hover:underline">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-fg-2">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
