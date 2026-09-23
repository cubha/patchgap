// src/components/methodology/MethodologyLayout.tsx
// 방법론 화면의 골격 — 머리(이동 경로 + h1) + **9슬롯 고정 순서** + 푸터(UX-BRIEF §8-4).
//
// 세 게임이 이 하나를 쓴다. 슬롯 목록·순서·제목은 `slots.ts`가 소유하고, 게임은 **본문만**
// 채운다. 그래서 「LoL에는 있는데 TFT에는 없는 축」이 생길 수 없다 — 빠뜨리면 tsc가 막는다.
import type { ReactNode } from "react";

import Container from "@/components/Container";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import SiteFooter from "@/components/SiteFooter";
import { methodologyCrumbs } from "@/lib/breadcrumbs";
import type { GameId } from "@/lib/game";
import {
  METHODOLOGY_SLOTS,
  isUnusedAxis,
  type MethodologySlotKey,
  type UnusedAxis,
} from "./slots";

export type MethodologySlots = Record<MethodologySlotKey, ReactNode | UnusedAxis>;

export interface MethodologyLayoutProps {
  game: GameId;
  title: ReactNode;
  lead: ReactNode;
  eyebrow?: ReactNode;
  /** 머리 바로 아래 한 장(표본 성격 고지 등). 없으면 그리지 않는다. */
  notice?: ReactNode;
  slots: MethodologySlots;
  generatedAt: string | null;
  nVerdicts: number | null;
}

export default function MethodologyLayout({
  game,
  title,
  lead,
  eyebrow,
  notice,
  slots,
  generatedAt,
  nVerdicts,
}: MethodologyLayoutProps) {
  return (
    <div className="flex flex-1 flex-col">
      <main>
        <Container className="flex flex-col gap-6 pt-40 pb-8">
          <PageHeader crumbs={methodologyCrumbs(game)} eyebrow={eyebrow} title={title} lead={lead} />
          {notice}
          {METHODOLOGY_SLOTS.map((slot) => {
            const body = slots[slot.key];
            const card = (
              <SectionCard eyebrow={slot.eyebrow} title={slot.title} variant="glass">
                {isUnusedAxis(body) ? (
                  // 빈칸이 아니라 **그 자리에서 말한다**(§8-4). 회색인 이유는 판정이 아니라
                  // 부재의 사유이기 때문이다.
                  <p className="p-5 text-sm leading-relaxed text-muted">{body.unused}</p>
                ) : (
                  body
                )}
              </SectionCard>
            );
            // scroll-mt: sticky 헤더가 앵커 착지 시 카드 제목을 덮는다(실측 21px 가림).
            return slot.anchor ? (
              <div key={slot.key} id={slot.anchor} className="scroll-mt-20">
                {card}
              </div>
            ) : (
              <div key={slot.key}>{card}</div>
            );
          })}
        </Container>
        <Container>
          <SiteFooter game={game} generatedAt={generatedAt} nVerdicts={nVerdicts} contained={false} />
        </Container>
      </main>
    </div>
  );
}
