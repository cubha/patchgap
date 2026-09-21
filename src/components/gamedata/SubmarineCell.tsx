// src/components/gamedata/SubmarineCell.tsx
// 대조표 「바뀐 것」 칸의 렌더. 세 게임이 공유한다 — 표 구조는 게임마다 달라도 **이 칸 하나는
// 같은 모양**이어야 배지가 같은 뜻으로 읽힌다(사용자 확정: 판정 기준은 동일, 포맷은 자유).
//
// 서버 전용 의존이 없다 — LoL 대조표(`DeltaTable.tsx`)가 `"use client"`라 여기에 `server-only`가
// 섞이면 번들이 깨진다.
import { submarineCellText } from "./submarineText";
import type { GameDataChange } from "@/pipeline/gamedata/types";

export default function SubmarineCell({ changes }: { changes: readonly GameDataChange[] }) {
  const cell = submarineCellText(changes);
  if (!cell) {
    // 수치 축에서 할 말이 없는 행 — 관측이 없는 것과 같은 어휘(`—`)를 쓴다.
    return <span className="px-1 font-mono text-xs text-muted">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-body text-xs font-bold text-fg-2">{cell.field}</span>
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted">
        {cell.before} → <span className="font-bold text-accent">{cell.after}</span>
      </span>
      {cell.rest > 0 ? (
        // 전부는 상세에서 본다 — 칸 안에 쌓으면 이 행만 높아져 표의 행 높이가 무너진다.
        <span className="font-mono text-[0.65rem] text-muted">외 {cell.rest}건</span>
      ) : null}
    </div>
  );
}
