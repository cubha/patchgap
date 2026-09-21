// src/components/gamedata/SubmarineDetailBlock.tsx
// 상세 페이지 「패치노트 대조」 카드의 **아래 구획** — 「패치노트가 말하지 않은 것」.
//
// **B안**(2026-09-21 사용자 확정). 상세의 기존 어휘는 선언 / 관측 / 원인 셋인데 잠수함은 셋 중
// 어디도 아니다 — 게임사가 **바꿨는데 말하지 않은 것**이라 선언과 같은 축이고 방향만 반대다.
// 그래서 카드를 하나 더 만들지 않고(A안 기각) 선언 카드 제목을 「패치노트 대조」로 바꾼 뒤
// 그 안에 두 구획을 둔다: 「패치노트가 말한 것」 / 「패치노트가 말하지 않은 것」.
// 두 줄이 붙어 있어야 "말한 건 이건데 그럼 잠수함은 뭐냐"가 질문이 되기 전에 닫힌다.
//
// **위 구획은 게임마다 다르다** — LoL은 `NoteContrastResult`, TFT는 `PatchNoteItem[]`, PUBG는
// 요약 한 줄이라 모양이 같을 수 없다. 사용자 확정: "게임별로 넘어오는포멧도다르고 정보도
// 상이하니 판정기준만 동일하게하라는말이야". 그래서 **아래 구획만** 공용으로 둔다.
//
// 값 포맷은 `submarineText`가 소유한다 — 여기서 `change.before`를 직접 찍지 않는다(float32 잡음).
import { gameDataValue, statusLabel } from "@/lib/format";
import type { GameDataChange, GameDataSource } from "@/pipeline/gamedata/types";

/** 대조 원본의 사람용 이름 — `SubmarineSection`과 같은 표(게임마다 소스가 다르다는 사실을 말한다). */
const SOURCE_LABELS: Record<string, string> = {
  ddragon: "Data Dragon",
  cdragon: "Community Dragon",
  "telemetry-grid": "텔레메트리 피해 격자",
};

function relText(rel: number | null): string | null {
  if (rel === null) return null;
  return `${rel > 0 ? "+" : ""}${(rel * 100).toFixed(1)}%`;
}

export interface SubmarineDetailBlockProps {
  changes: readonly GameDataChange[];
  /** 대조 원본. 없으면(산출물 미생성) 출처 줄을 그리지 않는다 — 없는 근거를 지어내지 않는다. */
  source?: GameDataSource | null;
}

export default function SubmarineDetailBlock({ changes, source = null }: SubmarineDetailBlockProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden="true" />
        <h3 className="font-body text-xs font-bold tracking-wide text-accent">패치노트가 말하지 않은 것</h3>
        <span className="ml-auto font-mono text-xs text-muted">{changes.length}건</span>
      </div>

      {changes.length === 0 ? (
        // 0건 **증명**(분모까지 밝히는 문장)은 홈 `SubmarineSection`이 맡는다 — 여기서는
        // 이 엔티티에 없다는 사실만 말하고 같은 말을 두 번 하지 않는다.
        <p className="px-5 pb-4 text-sm text-muted">
          이 엔티티에는 없습니다 — 원본 수치에서 패치노트와 어긋난 값을 찾지 못했습니다.
        </p>
      ) : (
        <ul className="flex flex-col">
          {changes.map((change) => (
            <li key={change.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pb-3">
              <span className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-accent-on">
                {statusLabel("submarine")}
              </span>
              <span className="text-sm font-bold text-fg">{change.field}</span>
              <span className="font-mono text-sm tabular-nums text-fg-2">
                {gameDataValue(change.before)} → <span className="text-fg">{gameDataValue(change.after)}</span>
              </span>
              {relText(change.relChange) ? (
                <span className="font-mono text-xs tabular-nums text-muted">{relText(change.relChange)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {source ? (
        <p className="border-t border-border-soft px-5 py-2 font-mono text-[0.65rem] text-muted">
          대조 원본: {SOURCE_LABELS[source.kind] ?? source.kind} {source.from} → {source.to}
        </p>
      ) : null}
    </div>
  );
}
