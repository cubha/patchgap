// src/components/gamedata/SubmarineSection.tsx
// 잠수함 패치 섹션 — **게임을 모른다**. 세 게임이 같은 컴포넌트를 쓴다.
//
// 빈 상태가 곧 이 축의 값이다. 다른 섹션의 "없음"은 관측 실패일 수 있지만, 여기서는
// "게임사 데이터를 전부 대조했고 노트와 어긋난 것이 없었다"는 **증명된 사실**이다.
// 그래서 회색으로 숨기지 않고 분모(검출된 수치 변경 수)와 함께 말한다.
import SectionCard from "@/components/SectionCard";
import { statusLabel } from "@/lib/format";
import type { SubmarineSummary } from "@/lib/gamedata";

/** 대조 원본의 사람용 이름 — 게임마다 소스가 다르다는 사실을 화면이 그대로 말한다. */
const SOURCE_LABELS: Record<string, string> = {
  ddragon: "Data Dragon",
  cdragon: "Community Dragon",
  "telemetry-grid": "텔레메트리 피해 격자",
};

function formatValue(value: number | string | null): string {
  if (value === null) return "없음";
  return typeof value === "number" ? String(value) : value;
}

function formatRel(rel: number | null): string | null {
  if (rel === null) return null;
  const sign = rel > 0 ? "+" : "";
  return `${sign}${(rel * 100).toFixed(1)}%`;
}

export default function SubmarineSection({ summary }: { summary: SubmarineSummary }) {
  const { submarines, changeCount, source } = summary;

  return (
    <SectionCard
      eyebrow="잠수함 패치"
      title="패치노트에 없는 수치 변경"
      variant="glass"
      action={
        <span className="font-mono text-xs text-muted">
          수치 변경 {changeCount}건 중 {submarines.length}건
        </span>
      }
    >
      {submarines.length === 0 ? (
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
          {submarines.map((change) => (
            <li
              key={change.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border-soft px-5 py-3 last:border-b-0"
            >
              <span className="text-sm font-bold text-fg">{change.entityName}</span>
              <span className="rounded-pill bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-on">
                {statusLabel("submarine")}
              </span>
              <span className="font-mono text-sm tabular-nums text-fg-2">
                {change.field} <span className="text-muted">{formatValue(change.before)}</span> →{" "}
                <span className="text-fg">{formatValue(change.after)}</span>
              </span>
              {formatRel(change.relChange) ? (
                <span className="font-mono text-xs tabular-nums text-muted">
                  {formatRel(change.relChange)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border-soft px-5 py-2 font-mono text-[0.65rem] text-muted">
        대조 원본: {SOURCE_LABELS[source.kind] ?? source.kind} {source.from} → {source.to}
      </p>
    </SectionCard>
  );
}
