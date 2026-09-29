// src/components/DeclarationOnly.tsx
// 선언 축만 있는 패치쌍의 브리핑(2026-09-28, C13·C14 — 사용자 결정 D5·D6). TFT·PUBG 홈이 같이 쓴다.
//
// **언제 그려지나.** 새 패치가 탐지됐는데 관측(매치 수집·판정)이 아직이거나(대기), 키가 없거나, 죽었을 때.
// 수집 워크플로가 관측 stub 판정 파일(`meta.observationFailed`)을 쓰고, 로더가 그것을 이 화면으로 보낸다.
// 결정 8 「선언 축은 항상 최신」의 화면 쪽 짝이다 — 전에는 이 상태에서 새 노트가 화면에 **안 나왔다**.
//
// **무엇을 안 그리나.** 판정·타일·표본 숫자. 관측이 없으므로 0이 아니라 **없음**이다 — 0으로 그리면
// 「통계는 0개 변화를 말합니다」가 관측된 사실처럼 읽힌다. 관측 영역은 회색 사유 한 줄로 대신한다.
import type { ReactNode } from "react";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import { observationReasonLabel } from "@/pipeline/shared/observation-stub";
import type { ObservationFailure } from "@/pipeline/types";

export interface DeclarationNote {
  id: string;
  /** 묶음 이름(대상). 없으면 묶지 않는다(PUBG 조항은 요약에 무기 이름이 들어 있다). */
  group: string | null;
  summary: string;
  anchorUrl: string;
}

export interface DeclarationOnlyProps {
  from: string;
  to: string;
  notes: readonly DeclarationNote[];
  failure: ObservationFailure;
  /** 선언 축의 다른 조각(수치 축 F9 등) — 있으면 노트 아래에 그린다. */
  extra?: ReactNode;
}

export default function DeclarationOnly({ from, to, notes, failure, extra }: DeclarationOnlyProps) {
  const groups = new Map<string, DeclarationNote[]>();
  for (const note of notes) {
    const key = note.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }
  const entityCount = [...groups.keys()].filter((k) => k !== "").length;

  return (
    <div className="flex flex-col gap-6 pt-40 pb-8">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">
          패치노트가 말한 것 vs 통계가 말하는 것
        </span>
        <h1 className="max-w-3xl font-display text-2xl leading-snug font-bold text-fg sm:text-3xl">
          {to} 패치노트는{" "}
          <span className="text-accent">{entityCount > 0 ? entityCount : notes.length}개 항목</span>을 말했고,
          통계는 아직 관측 전입니다
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
          {from} → {to} · 공지 {notes.length}건
        </p>
      </div>

      <p
        role="status"
        data-observation={failure.reason}
        className="rounded-md border border-border-soft bg-surface px-4 py-3 text-sm leading-relaxed text-muted"
      >
        {observationReasonLabel(failure.reason)}
      </p>

      <SectionCard eyebrow="선언" title={`${to} 패치노트`} variant="glass">
        <ul className="flex flex-col gap-4">
          {[...groups].map(([group, items]) => (
            <li key={group || "_"} className="flex flex-col gap-1">
              {group ? <span className="text-sm font-bold text-fg">{group}</span> : null}
              <ul className="flex flex-col gap-1">
                {items.map((note) => (
                  <li key={note.id} className="text-sm leading-relaxed text-fg-2">
                    <ExternalLink href={note.anchorUrl} className="hover:text-accent">
                      {note.summary}
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </SectionCard>

      {extra}
    </div>
  );
}
