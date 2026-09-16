// src/components/methodology/AdapterMatrix.tsx
// 어댑터 매핑표 렌더 — HANDOFF-redesign-2026-09-10.md §4-4. 레이아웃은 기존 방법론 표
// 스타일(StatusDefinitionTable.tsx)을 그대로 따른다("레이아웃은 그대로" 원칙). 순수 렌더.
// 2026-09-10 verify-impl 축B: 4열을 "PUBG 상태" → "어댑터 인터페이스"로 교체하고 상태는
// PUBG 머리글로, 판정 엔진은 표 밖 문단 → 마지막 행으로 옮겼다(시안 구조 그대로).

import Link from "next/link";
import {
  ADAPTER_MATRIX,
  JUDGMENT_ENGINE_NOTE,
  PUBG_COLUMN_HEADER,
} from "./adapterMatrixData";

const HEAD_CLASS = "border-b border-border-soft px-5 py-3 text-left text-xs font-bold text-muted";
const CELL_CLASS = "border-b border-border-soft px-5 py-4 align-top text-fg-2";

export default function AdapterMatrix() {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={HEAD_CLASS}>파이프라인 계층</th>
              <th className={HEAD_CLASS}>리그 오브 레전드 (연결됨)</th>
              <th className={HEAD_CLASS}>{PUBG_COLUMN_HEADER}</th>
              <th className={HEAD_CLASS}>어댑터 인터페이스</th>
            </tr>
          </thead>
          <tbody>
            {ADAPTER_MATRIX.map((row) => (
              <tr key={row.layer}>
                <td className="border-b border-border-soft px-5 py-4 align-top font-bold text-fg">
                  {row.layer}
                </td>
                {/* pubg===null인 행(판정 엔진)은 게임 무관이라 LoL 셀이 PUBG 열까지 가로지른다. */}
                <td className={CELL_CLASS} colSpan={row.pubg === null ? 2 : 1}>
                  {row.lol}
                </td>
                {row.pubg === null ? null : <td className={CELL_CLASS}>{row.pubg}</td>}
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
      <p className="px-5 text-xs text-muted">{JUDGMENT_ENGINE_NOTE}</p>
      <p className="px-5 pb-5 text-xs text-muted">
        PUBG 실연결 완료(2026-09-16) — 42.3 ⇒ 43.1 구간을 실제 수집·집계·판정했다.{" "}
        <Link className="text-accent underline-offset-2 hover:underline" href="/pubg/">
          결과 보기 →
        </Link>
      </p>
    </div>
  );
}
