// src/components/compare/CompareNameCell.tsx
// 세 대조표의 **이름 칸 단일 구현**(트랙 B ST-11, 2026-10-11 site-review parity-S19·parity-S20·pubg-S22·pubg-S11).
//
// 리뷰 실측: 첫 행 이름 칸이 게임마다 달랐다 — LoL 이름만, TFT 이름 + 유형 줄(화살표 없음), PUBG 「Groza →」(유형 줄 없음).
// 브리핑 행(§8-2 「이름 → · 유형」)과도 갈렸다. 아이콘이 없는 PUBG 행(RPD)은 칸을 비워 이름이 왼쪽으로 밀렸다.
// 그래서 구성은 하나다: [아이콘 슬롯] 이름 → / 유형 줄. 아이콘이 없으면 **슬롯은 남긴다**(같은 x에서 이름이 시작).
//
// 이름은 한 줄(nowrap) — 표는 가로 스크롤 영역 안이라 줄바꿈 대신 표가 넓어진다(390px에서 이름이 한 글자씩 쌓이던
// 2026-09-23 실측, 행 높이가 출렁이던 2026-10-07 D-STRESS-02 둘 다 같은 처방). 말줄임(truncate)을 쓰지 않는 이유: PUBG 375폭에서
// 「Gro…」처럼 무기명이 잘렸다(pubg-S11).
import Link from "next/link";
import type { ReactNode } from "react";

export interface CompareNameCellProps {
  name: string;
  /** 유형 줄(「챔피언」·「유닛」·「무기 · 돌격소총」). */
  typeLabel: string;
  /** 상세 주소. 없으면(잠수함 전용 행 등 상세가 없는 대상) 링크·화살표 없이 이름만. */
  href: string | null;
  /** 아이콘 — 없으면 슬롯만 남는다. 슬롯 폭은 `iconSlotClass`가 정한다(게임마다 아이콘 비율이 다르다). */
  icon: ReactNode | null;
  /** 아이콘 슬롯 크기 — LoL·TFT 정사각 40, PUBG 무기 렌더 64×32. */
  iconSlotClass: string;
  /** 375폭에서 아이콘 슬롯을 숨긴다 — PUBG 무기 렌더(64px)가 이름 칸을 밀어 무기명이 잘렸다(pubg-S11). */
  hideIconOnMobile?: boolean;
}

export default function CompareNameCell({ name, typeLabel, href, icon, iconSlotClass, hideIconOnMobile = false }: CompareNameCellProps) {
  const body = (
    <>
      <span
        data-name-cell-icon
        aria-hidden={icon ? undefined : true}
        className={`${iconSlotClass} shrink-0 items-center justify-center ${hideIconOnMobile ? "hidden sm:flex" : "flex"}`}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-bold whitespace-nowrap text-fg group-hover:text-accent">
          {name}
          {href ? " →" : ""}
        </span>
        <span className="font-mono text-xs tracking-wider whitespace-nowrap text-muted uppercase">{typeLabel}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} title={name} data-name-cell className="group flex items-center gap-3">
      {body}
    </Link>
  ) : (
    <span title={name} data-name-cell className="flex items-center gap-3">
      {body}
    </span>
  );
}
