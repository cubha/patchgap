// src/components/gamedata/SubmarineCell.tsx
// 대조표 「바뀐 것」 칸의 렌더. 세 게임이 공유한다 — 표 구조는 게임마다 달라도 **이 칸 하나는
// 같은 모양**이어야 배지가 같은 뜻으로 읽힌다(사용자 확정: 판정 기준은 동일, 포맷은 자유).
//
// **접을지 말지는 갈 곳이 있느냐가 정한다**(2026-09-21 acceptance-critic V1). "첫 건 외 N건"은
// *나머지는 상세에서 본다*는 약속이라, 상세가 없는 행에서 쓰면 갈 곳 없는 약속이 된다 —
// LoL 잠수함 전용 행이 그렇다(그 엔티티엔 델타가 0건이라 `/lol/item/[id]` 라우트가 없다).
// 그 경우 `collapsible={false}`로 표에서 끝까지 말한다.
//
// 서버 전용 의존이 없다 — LoL 대조표(`DeltaTable.tsx`)가 `"use client"`라 여기에 `server-only`가
// 섞이면 번들이 깨진다.
import { submarineCellLines, submarineCellText } from "./submarineText";
import type { GameDataChange } from "@/pipeline/gamedata/types";

function Line({ field, before, after }: { field: string; before: string; after: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-body text-xs font-bold text-fg-2">{field}</span>
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted">
        {before} → <span className="font-bold text-accent">{after}</span>
      </span>
    </div>
  );
}

export interface SubmarineCellProps {
  changes: readonly GameDataChange[];
  /**
   * 이 행에 상세 화면이 있는가. `false`면 접지 않고 전부 나열한다.
   * 기본값이 `true`인 이유: 세 게임 중 둘(TFT·PUBG)은 상세가 늘 있다.
   */
  collapsible?: boolean;
}

export default function SubmarineCell({ changes, collapsible = true }: SubmarineCellProps) {
  if (changes.length === 0) {
    // 수치 축에서 할 말이 없는 행 — 관측이 없는 것과 같은 어휘(`—`)를 쓴다.
    return <span className="px-1 font-mono text-xs text-muted">—</span>;
  }

  if (!collapsible) {
    return (
      <div className="flex flex-col gap-2">
        {submarineCellLines(changes).map((line) => (
          <Line key={line.field} {...line} />
        ))}
      </div>
    );
  }

  const cell = submarineCellText(changes)!;
  return (
    <div className="flex flex-col gap-0.5">
      <Line field={cell.field} before={cell.before} after={cell.after} />
      {cell.rest > 0 ? (
        // 전부는 상세에서 본다 — 칸 안에 쌓으면 이 행만 높아져 표의 행 높이가 무너진다.
        <span className="font-mono text-[0.65rem] text-muted">외 {cell.rest}건</span>
      ) : null}
    </div>
  );
}
