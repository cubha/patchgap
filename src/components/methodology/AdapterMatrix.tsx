// src/components/methodology/AdapterMatrix.tsx
// 어댑터 매핑표 렌더 — HANDOFF-redesign-2026-09-10.md §4-4. 레이아웃은 기존 방법론 표
// 스타일(StatusDefinitionTable.tsx)을 그대로 따른다("레이아웃은 그대로" 원칙). 순수 렌더.
// 2026-09-10 verify-impl 축B: 4열을 "PUBG 상태" → "어댑터 인터페이스"로 교체하고 상태는
// 게임 머리글로, 판정 엔진은 표 밖 문단 → 마지막 행으로 옮겼다(시안 구조 그대로).
//
// 2026-09-20(사용자 지시): 게임 열을 **`GAMES` 레지스트리 순회로** 그린다. 이전엔 `lol` 셀과
// `pubg` 셀을 손으로 각각 렌더해, 세 번째 게임이 붙으면 이 파일도 고쳐야 했다 — 표가 증명하려는
// 것이 "게임이 늘어도 판정 엔진은 그대로"인데 표 자신이 두 게임에 묶여 있었다. 이제 게임이 늘면
// 열이 저절로 는다(데이터 누락은 `Record<GameId, string>`이 컴파일 타임에 잡는다).
//
// 표 아래에 있던 "PUBG는 42.3 ⇒ 43.1 구간을 실제로 … 결과 보기 →" 문단은 뺐다. 표가 랜딩으로
// 옮겨오면서 **바로 위 패널들이 게임마다 패치 쌍·표본·결과 링크를 이미 보여주기 때문**이고,
// 한 게임만 이름으로 지목하는 문장이라 게임이 늘면 낡는다. 그 게임이 실제로 연결됐다는 사실은
// 열 머리글(COLUMN_STATUS)이 계속 말한다.

import { GAMES, gameLabel } from "@/lib/game";
import { ADAPTER_MATRIX, COLUMN_STATUS, JUDGMENT_ENGINE_NOTE } from "./adapterMatrixData";

// `whitespace-nowrap`(머리글·계층 열) + `min-width`(표 전체)가 함께 있어야 한다. 390px에서
// 이 표는 5열을 우겨넣어 계층 칸이 52px가 되고 「파이프라인 계층」이 세로로 쌓였다(2026-09-23
// 렌더 실측). 본문 칸은 **산문**이라 nowrap을 걸면 표가 3000px가 되므로 거기엔 걸지 않는다 —
// 접히면 안 되는 것은 짧은 라벨뿐이고, 산문은 접혀도 된다.
const HEAD_CLASS = "border-b border-border-soft px-5 py-3 text-left text-xs font-bold whitespace-nowrap text-muted";
const CELL_CLASS = "border-b border-border-soft px-5 py-4 align-top text-fg-2";

export default function AdapterMatrix() {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: "var(--table-min)" }}>
          <thead>
            <tr>
              <th className={HEAD_CLASS}>파이프라인 계층</th>
              {GAMES.map((game) => (
                <th key={game.id} className={HEAD_CLASS}>
                  {gameLabel(game.id)} ({COLUMN_STATUS[game.id]})
                </th>
              ))}
              <th className={HEAD_CLASS}>어댑터 인터페이스</th>
            </tr>
          </thead>
          <tbody>
            {ADAPTER_MATRIX.map((row) => (
              <tr key={row.layer}>
                <td className="border-b border-border-soft px-5 py-4 align-top font-bold whitespace-nowrap text-fg">
                  {row.layer}
                </td>
                {/* 게임 무관 행(판정 엔진)은 게임 열 전체를 한 칸이 가로지른다 — "이 계층은
                    갈아끼우지 않는다"를 표의 모양으로 보인다. */}
                {row.byGame === null ? (
                  <td className={CELL_CLASS} colSpan={GAMES.length}>
                    {row.shared}
                  </td>
                ) : (
                  GAMES.map((game) => (
                    <td key={game.id} className={CELL_CLASS}>
                      {row.byGame?.[game.id]}
                    </td>
                  ))
                )}
                <td className="border-b border-border-soft px-5 py-4 align-top">
                  <span className="whitespace-nowrap font-mono text-xs font-bold text-accent">
                    {row.iface}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-5 text-xs text-muted">{JUDGMENT_ENGINE_NOTE}</p>
    </div>
  );
}
