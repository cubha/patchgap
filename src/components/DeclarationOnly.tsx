// src/components/DeclarationOnly.tsx
// 선언 축만 있는 패치쌍의 브리핑(2026-09-28, C13·C14 — 사용자 결정 D5·D6). TFT·PUBG 홈이 같이 쓴다.
//
// **언제 그려지나.** 새 패치가 탐지됐는데 관측(매치 수집·판정)이 아직이거나(대기), 키가 없거나, 죽었을 때.
// 수집 워크플로가 관측 stub 판정 파일(`meta.observationFailed`)을 쓰고, 로더가 그것을 이 화면으로 보낸다.
// 결정 8 「선언 축은 항상 최신」의 화면 쪽 짝이다 — 전에는 이 상태에서 새 노트가 화면에 **안 나왔다**.
//
// **무엇을 안 그리나.** 판정·표본 숫자. 관측이 없으므로 0이 아니라 **없음**이다 — 0으로 그리면
// 「통계는 0개 변화를 말합니다」가 관측된 사실처럼 읽힌다. 관측 영역은 회색 사유 한 줄로 대신한다.
//
// 2026-10-08(ST-16, site-review parity-S2·tft-S6): 머리(`DeclarationHero`)와 노트 카드(`DeclarationNotesCard`)를 나눠
// 내보낸다 — 게임 홈이 그 사이에 3타일·탭·사이드 **골격**을 유지한 채 끼울 수 있게. 배너는 관측이 있는 최신 쌍으로 가는
// 링크를 단다(전에는 "TFT 홈에서 볼 수 있습니다"라는 링크 아닌 문장뿐이었다).
import type { ReactNode } from "react";
import ExternalLink from "@/components/ExternalLink";
import ObservationPendingNotice, { type ObservedPairLink } from "@/components/ObservationPendingNotice";
import SectionCard from "@/components/SectionCard";
import type { ObservationFailure } from "@/pipeline/types";

export interface DeclarationNote {
  id: string;
  /** 묶음 이름(대상). 없으면 묶지 않는다(PUBG 조항은 요약에 무기 이름이 들어 있다). */
  group: string | null;
  summary: string;
  anchorUrl: string;
}

/** 노트를 대상별로 묶는다 — 머리의 「N개 항목」(대상 수)과 카드의 묶음이 같은 함수를 본다. */
export function groupDeclarationNotes(notes: readonly DeclarationNote[]): Map<string, DeclarationNote[]> {
  const groups = new Map<string, DeclarationNote[]>();
  for (const note of notes) {
    const key = note.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }
  return groups;
}

/** 머리가 말하는 「N개 항목」 — 대상이 있으면 대상 수, 없으면(PUBG) 조항 수. */
export function declarationEntityCount(notes: readonly DeclarationNote[]): number {
  const entityCount = [...groupDeclarationNotes(notes).keys()].filter((k) => k !== "").length;
  return entityCount > 0 ? entityCount : notes.length;
}

export interface DeclarationHeroProps {
  from: string;
  to: string;
  notes: readonly DeclarationNote[];
  failure: ObservationFailure;
  /** 관측이 있는 최신 쌍으로 가는 링크 — 배너가 단다. 없으면 문장만. */
  observed?: ObservedPairLink | null;
  /** 첫 관측 실행 예정 「10/10(토) 06:00 KST」 — 배너가 날짜를 말한다(PLAN-home-observed-pair ST-4). */
  eta?: string | null;
}

/** 문장 1줄 + 캡션 + 관측 전 배너 — 관측 브리핑의 히어로와 같은 자리·같은 크기. */
export function DeclarationHero({ from, to, notes, failure, observed = null, eta = null }: DeclarationHeroProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">
          패치노트가 말한 것 vs 통계가 말하는 것
        </span>
        <h1 className="max-w-3xl font-display text-2xl leading-snug font-bold text-fg sm:text-3xl">
          {to} 패치노트는 <span className="text-accent">{declarationEntityCount(notes)}개 항목</span>을 말했고,
          통계는 아직 관측 전입니다
        </h1>
        {/* 캡션에 조항 수를 두지 않는다(2026-10-09) — 머리의 「N개 항목」(대상 수) 바로 아래 「공지 73건」이 붙어 한 화면에
            두 단위가 같은 말로 섰다(결정 7). 조항 수는 타일 부제 한 곳이 든다. */}
        <p className="max-w-3xl text-sm leading-relaxed text-fg-2 wrap-anywhere">
          {from} → {to} · 관측 전
        </p>
      </div>

      <ObservationPendingNotice failure={failure} observed={observed} eta={eta} />
    </>
  );
}

/** 「선언 · {to} 패치노트」 카드 — 대상별로 묶은 노트 목록. */
export function DeclarationNotesCard({
  to,
  notes,
  variant = "glass",
}: {
  to: string;
  notes: readonly DeclarationNote[];
  variant?: "glass" | "embedded";
}) {
  return (
    <SectionCard eyebrow="선언" title={`${to} 패치노트`} variant={variant}>
      <ul className="flex flex-col gap-4 p-5">
        {[...groupDeclarationNotes(notes)].map(([group, items]) => (
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
  );
}

export interface DeclarationOnlyProps extends DeclarationHeroProps {
  /** 선언 축의 다른 조각(수치 축 F9 등) — 있으면 노트 아래에 그린다. */
  extra?: ReactNode;
}

/** 머리 + 노트 카드 + 보충 — 골격 없이 세로로 쌓는 기본 조합(PUBG 홈). TFT 홈은 조각을 따로 받아 골격 안에 둔다. */
export default function DeclarationOnly({ from, to, notes, failure, observed = null, eta = null, extra }: DeclarationOnlyProps) {
  return (
    <div className="flex flex-col gap-6 pt-40 pb-8">
      <DeclarationHero from={from} to={to} notes={notes} failure={failure} observed={observed} eta={eta} />
      <DeclarationNotesCard to={to} notes={notes} />
      {extra}
    </div>
  );
}
