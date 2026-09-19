// src/app/page.tsx
// 랜딩(`/`) — 확정 시안 docs/design/prototype/05-landing-B.html 구현(2026-09-19 사용자 확정).
//
// **이 화면은 게임을 하나도 모른다.** 사용자 요구 원문: "이때 추후 게임이 추가될수잇으니
// 두가지종류만 단언해서 작성하지는마". 그래서 여기에는 "리그 오브 레전드"도 "배틀그라운드"도,
// 게임 수를 세는 문구도 없다 — `landingCards()`가 준 배열을 map으로 그릴 뿐이고, 합산 타일은
// 그 배열의 reduce다. 게임이 늘면 이 파일은 그대로 두고 GAMES + LANDING_LOADERS만 는다.
//
// 데이터는 빌드 타임에만 읽는다(정적 export, 런타임 외부 호출 0 — 프로젝트 CLAUDE.md).
import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import { panelSurfaceClass } from "@/lib/panelSurface";
import { fmtInt } from "@/lib/format";
import { landingCards, landingTotals } from "@/lib/landing";

export const metadata: Metadata = {
  title: "patchgap — 패치노트에 없는 변화를 찾습니다",
  description:
    "공식 패치노트와 실제 매치 통계를 자동으로 대조해, 공지되지 않은 변화와 간접 파급을 통계 게이트와 원천 링크로 보여준다.",
};

/** 하단 3열 — 파이프라인을 한 문장씩. 게임과 무관한 서술만 둔다. */
const HOW = [
  {
    title: "수집",
    body: "패치 라이브 구간의 매치를 전량 수집하고, 표본이 모자란 지표는 판정하지 않습니다.",
  },
  {
    title: "판정",
    body: "Wilson·Newcombe 신뢰구간과 BH-FDR로 거짓양성을 통제한 뒤 패치노트 항목과 짝을 맞춥니다.",
  },
  {
    title: "근거",
    body: "모든 판정문에 원천 링크가 붙습니다. 근거가 없으면 회색으로 남기고 지어내지 않습니다.",
  },
] as const;

export default function LandingPage() {
  const cards = landingCards();
  const totals = landingTotals(cards);

  return (
    <main>
      {/* 스플래시 월 한 장이 히어로와 게임 패널을 함께 덮는다 — 패널은 그 위에 떠 있는 카드로
          읽힌다(2026-09-19 사용자 지시). 배경을 히어로에만 걸면 패널 아래가 평평한 단색이라
          화면이 위아래로 잘려 보였다. */}
      <div className="landing-stage">
        <div className="landing-hero-art" aria-hidden="true" />
        <div className="landing-hero-scrim" aria-hidden="true" />
        <Container className="landing-hero-content py-14 text-center">
          <p className="text-xs font-bold tracking-wide text-accent">
            패치노트가 말한 것 vs 통계가 말하는 것
          </p>
          <h1 className="landing-headline mx-auto mt-3 max-w-[24ch] font-display text-3xl leading-tight font-bold text-fg sm:text-4xl">
            패치노트에 <span className="text-accent">없는 변화</span>를 찾습니다
          </h1>
          <p className="landing-lede mx-auto mt-4 max-w-[60ch] text-sm text-fg-2">
            패치 전후 매치를 전량 집계해 공식 패치노트와 대조하고, 짝이 없는 변화에 통계 게이트와
            원천 링크를 붙입니다.
          </p>

          {/* 합산 타일 — 전부 카드 배열의 reduce다. 숫자를 코드에 적어두지 않는다. */}
          <div
            className={`${panelSurfaceClass("glass")} mx-auto mt-8 grid max-w-xl grid-cols-3 overflow-hidden rounded-lg`}
          >
            <div className="border-r border-border-soft p-4">
              <strong className="block font-display text-2xl font-bold tabular-nums text-fg">
                {fmtInt(totals.matches)}
              </strong>
              <span className="text-xs text-muted">분석한 매치</span>
            </div>
            <div className="border-r border-border-soft p-4">
              <strong className="block font-display text-2xl font-bold tabular-nums text-fg">
                {fmtInt(totals.significant)}
              </strong>
              <span className="text-xs text-muted">유의한 관측</span>
            </div>
            <div className="p-4">
              <strong className="block font-display text-2xl font-bold tabular-nums text-accent">
                {fmtInt(totals.unannounced)}
              </strong>
              <span className="text-xs text-muted">패치노트에 없던 변화</span>
            </div>
          </div>
        </Container>

        <Container className="landing-hero-content pb-14">
          <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="landing-panel group rounded-lg border border-border-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span
                className="landing-panel-art"
                style={{ backgroundImage: `url(${card.art})` }}
                aria-hidden="true"
              />
              <span className="landing-panel-scrim" aria-hidden="true" />
              <span className="relative z-[1] flex h-full flex-col justify-end p-5">
                <span className="font-mono text-xs tracking-widest text-accent">
                  {card.tag}
                </span>
                <span className="mt-1.5 font-display text-xl font-bold text-fg">{card.label}</span>
                <span className="mt-1 font-mono text-xs text-fg-2">
                  {card.pair.from} → {card.pair.to} · {card.sample}
                </span>
                <span className="mt-3.5 flex gap-4">
                  <span>
                    <strong className="block font-display text-lg font-bold tabular-nums text-fg">
                      {fmtInt(card.announced)}
                    </strong>
                    <span className="text-xs text-muted">공지된 변화</span>
                  </span>
                  <span>
                    <strong className="block font-display text-lg font-bold tabular-nums text-fg">
                      {fmtInt(card.significant)}
                    </strong>
                    <span className="text-xs text-muted">유의한 관측</span>
                  </span>
                  <span>
                    <strong className="block font-display text-lg font-bold tabular-nums text-accent">
                      {fmtInt(card.unannounced)}
                    </strong>
                    <span className="text-xs text-muted">미공지</span>
                  </span>
                </span>
                <span className="mt-4 inline-flex h-9 w-fit items-center rounded-pill bg-accent px-4 text-xs font-bold text-accent-on">
                  시작하기 →
                </span>
              </span>
            </Link>
          ))}

          {/* 열린 끝 — 다음 게임 자리. 문구는 사용자 지정("who is next? to be continue같은").
              자기 키아트가 없으므로 뒤의 스플래시 월이 그대로 비친다 → 반투명 판(.landing-next)을
              깔아 글자만 읽히게 하고, 빈자리라는 성격은 점선 테두리로 남긴다. */}
          <div className="landing-next flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border-soft p-6 text-center">
            <div>
              <p className="font-mono text-lg leading-snug tracking-widest text-accent/85">
                WHO&rsquo;S
                <br />
                NEXT?
              </p>
              <p className="mt-3 text-xs text-muted">
                패치노트를 내고 매치 API를 여는 게임이면 어댑터만 붙습니다
              </p>
            </div>
          </div>
          </div>
        </Container>
      </div>

      <Container>
        <section id="how" className="border-t border-border-soft py-9">
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW.map((item) => (
              <div key={item.title}>
                <h2 className="text-sm font-bold text-accent">{item.title}</h2>
                <p className="mt-1.5 text-sm text-fg-2">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border-soft py-5 text-xs text-muted">
          patchgap는 각 게임사와 제휴하거나 보증을 받지 않았습니다. 상표·자산의 저작권은 각
          권리자에게 있습니다.
        </footer>
      </Container>
    </main>
  );
}
