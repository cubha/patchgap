// src/components/gamedata/SubmarineSection.tsx
// 잠수함 패치 섹션 — **게임을 모른다**. 세 게임이 같은 컴포넌트를 쓴다.
//
// 빈 상태가 곧 이 축의 값이다. 다른 섹션의 "없음"은 관측 실패일 수 있지만, 여기서는
// "게임사 데이터를 전부 대조했고 노트와 어긋난 것이 없었다"는 **증명된 사실**이다.
// 그래서 회색으로 숨기지 않고 분모(검출된 수치 변경 수)와 함께 말한다.
import Link from "next/link";

import SectionCard from "@/components/SectionCard";
import { statusLabel } from "@/lib/format";
import { mismatchCellLines, submarineCellText } from "./submarineText";
import type { SubmarineSummary } from "@/lib/gamedata";
import type { GameDataChange } from "@/pipeline/gamedata/types";

/** 대조 원본의 사람용 이름 — 게임마다 소스가 다르다는 사실을 화면이 그대로 말한다. */
const SOURCE_LABELS: Record<string, string> = {
  ddragon: "Data Dragon",
  cdragon: "Community Dragon",
  "telemetry-grid": "텔레메트리 피해 격자",
};

function formatRel(rel: number | null): string | null {
  if (rel === null) return null;
  const sign = rel > 0 ? "+" : "";
  return `${sign}${(rel * 100).toFixed(1)}%`;
}

export interface SubmarineSectionProps {
  summary: SubmarineSummary;
  /**
   * 엔티티 이름 → 상세 경로(2026-09-21 사용자 요청: "대조표의 이름을 클릭할때처럼 상세로
   * 이동하는 ux도 있으면좋겟네"). 게임마다 라우트 모양이 달라 홈이 만들어 넘긴다.
   *
   * `null`을 돌려주면 **링크를 걸지 않는다** — LoL은 잠수함 전용 엔티티에 델타가 0건이라
   * 상세 라우트가 없다(`/lol/item/[id]`는 `DeltaRecord` 전제로 서 있다). 없는 링크를
   * 만드는 대신 이름만 그린다.
   */
  hrefOf?: (change: GameDataChange) => string | null;
}

export default function SubmarineSection({ summary, hrefOf }: SubmarineSectionProps) {
  const { entities, mismatches, changeCount, source } = summary;

  return (
    <SectionCard
      eyebrow="잠수함 패치 · 수치 축"
      title="패치노트에 없는 수치 변경"
      variant="glass"
      action={
        // **대상 수로 센다**(2026-09-21 사용자 지시). 대상 수와 값 수를 나란히 쓰면 어느 쪽이
        // 발견의 크기인지 헷갈린다 — 값 개수는 그 대상의 행 안에서 말한다.
        <span className="font-mono text-xs text-muted">대상 {entities.length}종</span>
      }
    >
      {entities.length === 0 ? (
        <div className="p-5">
          <p className="text-sm text-fg-2">
            {changeCount === 0 ? (
              <>이번 패치에는 없습니다 — 대조한 원본 수치 가운데 바뀐 것이 없었습니다.</>
            ) : (
              <>
                이번 패치에는 없습니다 — 게임 데이터에서 찾은 수치 변경{" "}
                <strong className="font-mono text-fg">{changeCount}건</strong>이 모두 패치노트에
                있었습니다.
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted">
            다른 항목의 &ldquo;없음&rdquo;과 다릅니다. 통계로 못 찾았다는 뜻이 아니라, 원본 수치를
            전부 대조해 어긋난 것이 없음을 확인했다는 뜻입니다.
          </p>
        </div>
      ) : (
        <ul>
          {entities.map((entity) => {
            // 한 대상 = 한 행. 값이 여럿이면 첫 건 + "외 N건"이고, 전부는 상세에서 본다 —
            // 대조표 「바뀐 것」 칸과 **같은 규칙·같은 함수**를 쓴다(두 화면이 다르게 세면 안 된다).
            const cell = submarineCellText(entity.changes)!;
            const first = entity.changes[0];
            const href = hrefOf?.(first) ?? null;
            return (
              <li
                key={`${entity.entityType}:${entity.entityKey}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border-soft px-5 py-3 last:border-b-0"
              >
                {href ? (
                  <Link href={href} className="text-sm font-bold text-fg hover:text-accent hover:underline">
                    {entity.entityName} →
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-fg">{entity.entityName}</span>
                )}
                <span className="rounded-pill bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-on">
                  {statusLabel("submarine")}
                </span>
                <span className="font-mono text-sm tabular-nums text-fg-2">
                  {cell.field} <span className="text-muted">{cell.before}</span> →{" "}
                  <span className="text-fg">{cell.after}</span>
                </span>
                {formatRel(first.relChange) ? (
                  <span className="font-mono text-xs tabular-nums text-muted">{formatRel(first.relChange)}</span>
                ) : null}
                {cell.rest > 0 ? (
                  <span className="font-mono text-xs text-muted">외 {cell.rest}건</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {mismatches.length > 0 ? (
        // **잠수함과 같은 카드, 다른 구획.** 같은 대조에서 나온 발견이라 카드를 나누면 독자가
        // 두 축을 따로 찾아다녀야 한다. 그렇다고 한 목록에 섞으면 "패치노트에 없는"이라는 이
        // 카드의 제목이 이 줄들에 대해 **거짓말**이 된다 — 그래서 제목을 따로 단다.
        <div className="border-t border-border-soft">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <span className="h-1.5 w-1.5 rounded-pill bg-warn" aria-hidden="true" />
            <h3 className="font-body text-xs font-bold tracking-wide text-warn">
              패치노트와 값이 다른 것
            </h3>
            <span className="ml-auto font-mono text-xs text-muted">대상 {mismatches.length}종</span>
          </div>
          <p className="px-5 pb-2 text-xs text-muted">
            노트가 같은 항목을 말했는데 적힌 값이 실제 게임 데이터와 다릅니다. 말하지 않은 것도,
            말한 대로 한 것도 아닙니다.
          </p>
          <ul>
            {mismatches.map((entity) => {
              const href = hrefOf?.(entity.changes[0]) ?? null;
              return (
                <li
                  key={`mismatch:${entity.entityType}:${entity.entityKey}`}
                  className="border-b border-border-soft px-5 py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    {href ? (
                      <Link
                        href={href}
                        className="text-sm font-bold text-fg hover:text-accent hover:underline"
                      >
                        {entity.entityName} →
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-fg">{entity.entityName}</span>
                    )}
                    <span className="rounded-pill bg-warn px-2 py-0.5 text-[0.65rem] font-bold text-accent-on">
                      {statusLabel("note-mismatch")}
                    </span>
                  </div>
                  {mismatchCellLines(entity.changes).map((line) => (
                    <div
                      key={line.field}
                      className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5"
                    >
                      <span className="font-mono text-sm tabular-nums text-fg-2">
                        {line.field} <span className="text-muted">{line.before}</span> →{" "}
                        <span className="text-fg">{line.after}</span>
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        패치노트 {line.noteBefore} ⇒ {line.noteAfter}
                      </span>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className="border-t border-border-soft px-5 py-2 font-mono text-[0.65rem] text-muted">
        대조 원본: {SOURCE_LABELS[source.kind] ?? source.kind} {source.from} → {source.to}
      </p>
    </SectionCard>
  );
}
