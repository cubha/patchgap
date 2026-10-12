// src/components/BriefingListPanel.tsx
// 브리핑 카드 목록의 패널(트랙 B ST-20, tft-S15·lol-S13 — 사용자 결정 「패널 유지 + 더 보기」). 높이 상한 + 넘칠 때만 펼치기 +
// 「대조표에서 전체 보기 →」. 전에는 TFT·PUBG 카드 목록이 상한만 있어 잘린 행(12번째 행 반쯤)과 나머지로 가는 길이 없었다.
// 링크는 대조표의 같은 필터(`#announced`·`#unannounced`)로 착지한다 — 타일 「미공지 Gap ↗」과 같은 규약.
import Link from "next/link";
import type { ReactNode } from "react";
import PanelExpand from "@/components/PanelExpand";

export default function BriefingListPanel({
  children,
  total,
  compareHref,
}: {
  children: ReactNode;
  /** 목록의 대상 수 — 카드 머리 「대상 N종」과 같은 수. */
  total: number;
  /** 대조표 착지 주소(필터 해시 포함). */
  compareHref: string;
}) {
  return (
    <>
      <PanelExpand total={total} unit="개 대상">
        {children}
      </PanelExpand>
      <p className="border-t border-border-soft px-5 py-2 text-xs">
        <Link href={compareHref} className="font-bold text-accent hover:underline">
          대조표에서 전체 보기 →
        </Link>
      </p>
    </>
  );
}
