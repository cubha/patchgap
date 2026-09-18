/* eslint-disable @next/next/no-img-element */
// src/components/pubg/PubgWeaponGrid.tsx
// PUBG 브리핑의 **무기 상세 진입 그리드**(2026-09-18 라운드6, 사용자 P1 "상세페이지 진입점이 없음 →
// 총기, 맵류 … 상세 관측내용을 확인할 수 없음"). 무기 상세(`/pubg/weapon/[key]/`)는 라운드4부터
// 있었지만 브리핑 표의 무기명 링크가 유일한 입구였고, 그 표에는 판정된 무기 2~7종만 실린다 — 나머지
// 40종의 상세는 URL을 알아야만 갈 수 있었다. 이 그리드는 **전 무기**를 렌더 카드로 나열해 상세로 보낸다.
//
// 카드 = 공식 렌더(없으면 텍스트 마크 — 실측 47종 중 9종은 `pubg/api-assets`에 없다) · 이름 · 43.1 점유율 ·
// 상대 변화(판정이 선 무기만 색으로, 노이즈 상태는 표시하지 않는다 — 사용자 C1). 컨테이너는 고정 높이
// 내부 스크롤(h-80)이라 47장이 페이지를 늘리지 않는다. 서버 컴포넌트(상태 없음).
import Link from "next/link";
import type { PubgWeaponStat } from "@/pipeline/aggregate/pubg-weapons";
import type { PubgDeltaRow } from "@/pipeline/match/pubg-delta";
import { publicWeaponPath } from "@/pipeline/pubg/asset-path";
import { weaponHref } from "@/lib/pubgRoutes";
import { isReportable } from "@/pipeline/shared/pubg-status";
import { pct, signedPct } from "./shared";

export interface PubgWeaponGridProps {
  /** 43.1(후) 집계 — 점유율 내림차순으로 나열한다. */
  weapons: readonly PubgWeaponStat[];
  rows: readonly PubgDeltaRow[];
  /** 렌더가 실재하는 정준키 집합(assets.json). 없으면 전부 폴백 마크. */
  assetKeys: ReadonlySet<string>;
}

export default function PubgWeaponGrid({ weapons, rows, assetKeys }: PubgWeaponGridProps) {
  const byKey = new Map(rows.map((row) => [row.weaponKey, row] as const));
  const ordered = [...weapons].sort((a, b) => b.share - a.share);
  return (
    <ul className="grid h-80 grid-cols-2 gap-px overflow-y-auto bg-border-soft sm:grid-cols-3 lg:grid-cols-6">
      {ordered.map((weapon) => {
        const row = byKey.get(weapon.weaponKey) ?? null;
        const judged = row !== null && isReportable(row.status);
        const rel = judged ? (row.relChange ?? 0) : null;
        return (
          <li key={weapon.weaponKey} className="bg-surface">
            <Link
              href={weaponHref(weapon.weaponKey)}
              className="flex h-full flex-col gap-1.5 p-3 transition-colors hover:bg-accent/10"
              aria-label={`${weapon.weaponName} 상세`}
            >
              <span className="flex h-14 items-center justify-center">
                {assetKeys.has(weapon.weaponKey) ? (
                  <img
                    src={publicWeaponPath(weapon.weaponKey)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="max-h-14 w-full object-contain"
                  />
                ) : (
                  <span aria-hidden="true" className="font-display text-lg font-bold text-border select-none">
                    {weapon.weaponName}
                  </span>
                )}
              </span>
              <span className="truncate font-display text-sm font-bold text-fg">{weapon.weaponName}</span>
              <span className="flex items-baseline gap-2 font-mono text-xs tabular-nums">
                <span className="text-fg-2">{pct(weapon.share, 2)}</span>
                {rel !== null ? (
                  <span className={rel > 0 ? "font-bold text-success" : "font-bold text-danger"}>{signedPct(rel)}</span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
