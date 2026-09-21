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
import { statusLabel } from "@/lib/format";
import { mismatchCellLines, submarineCellLines, submarineCellText } from "./submarineText";
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

function MismatchLines({ changes }: { changes: readonly GameDataChange[] }) {
  return (
    <div className="flex flex-col gap-2">
      {mismatchCellLines(changes).map((line) => (
        <div key={line.field} className="flex flex-col gap-0.5">
          <span className="font-body text-xs font-bold text-fg-2">{line.field}</span>
          <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted">
            {line.before} → <span className="font-bold text-warn">{line.after}</span>
          </span>
          {/* 노트가 적은 값을 같은 칸에서 말해야 "불일치"가 주장이 아니라 대조가 된다. */}
          <span className="whitespace-nowrap font-mono text-[0.65rem] tabular-nums text-muted">
            노트 {line.noteBefore} ⇒ {line.noteAfter}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SubmarineCellProps {
  changes: readonly GameDataChange[];
  /**
   * 노트가 말했는데 값이 어긋난 변경(2026-09-21). 잠수함과 **같은 칸**에 산다 — 둘 다 "게임
   * 데이터에서 무엇이 바뀌었나"의 답이고, 칸을 나누면 표가 한 열 더 넓어질 뿐 뜻이 갈리지 않는다.
   */
  mismatchChanges?: readonly GameDataChange[];
  /**
   * 이 행에 상세 화면이 있는가. `false`면 접지 않고 전부 나열한다.
   * 기본값이 `true`인 이유: 세 게임 중 둘(TFT·PUBG)은 상세가 늘 있다.
   */
  collapsible?: boolean;
}

export default function SubmarineCell({
  changes,
  mismatchChanges = [],
  collapsible = true,
}: SubmarineCellProps) {
  if (changes.length === 0 && mismatchChanges.length === 0) {
    // 수치 축에서 할 말이 없는 행 — 관측이 없는 것과 같은 어휘(`—`)를 쓴다.
    return <span className="px-1 font-mono text-xs text-muted">—</span>;
  }

  // **두 갈래를 둘 다 그린다.** 행 객체는 둘 다 담는데 칸이 한쪽만 그리면, 그건 배지만 찍고
  // 값을 말하지 않던 결함과 같은 형태다 — 데이터는 맞는데 화면에 없다
  // ([[feedback_verification_asks_wrong_question]]). 오늘 데이터에 둘 다 가진 대상이 없다는
  // 것은 설계 근거가 아니다([[feedback_structural_caps_not_current_data]]).
  const cell = collapsible ? submarineCellText(changes) : null;
  return (
    <div className="flex flex-col gap-2">
      {cell ? (
        <div className="flex flex-col gap-0.5">
          <Line field={cell.field} before={cell.before} after={cell.after} />
          {cell.rest > 0 ? (
            // 전부는 상세에서 본다 — 칸 안에 쌓으면 이 행만 높아져 표의 행 높이가 무너진다.
            <span className="font-mono text-[0.65rem] text-muted">외 {cell.rest}건</span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {submarineCellLines(changes).map((line) => (
            <Line key={line.field} {...line} />
          ))}
        </div>
      )}

      {mismatchChanges.length > 0 ? (
        <div className="flex flex-col gap-1">
          {/* 배지를 붙여야 두 갈래가 한 칸 안에서 섞이지 않는다. */}
          <span className="w-fit rounded-sm bg-warn px-1.5 py-0.5 font-mono text-[0.6rem] font-bold text-accent-on">
            {statusLabel("note-mismatch")}
          </span>
          <MismatchLines changes={mismatchChanges} />
        </div>
      ) : null}
    </div>
  );
}
