// src/components/SiteFooter.tsx
// 모든 화면의 푸터 — **집계 시각 · 판정 건수 · 데이터 출처 · 법적 고지**를 한 컴포넌트가 소유한다.
//
// **왜 공용인가**(UX-BRIEF §8-1, 2026-09-22 13화면 전수 렌더 실측): 같은 줄이 세 게임에서 전혀
// 다르게 나가고 있었다 —
//   - LoL: 푸터가 **전 화면에 없고**, 법적 고지만 방법론 카드에 **영문**으로 있었다
//   - TFT: 푸터는 있는데 **반말**("…자산이다")이고 집계 시각이 **ISO 원문**(`2026-09-21T11:22:11.264Z`)
//   - PUBG: 존댓말 + `KST` 포맷 — 셋 중 이것만 규약에 맞았다
// 게임마다 다른 것은 **데이터 출처명과 권리자 고지 문장뿐**이라, 그 둘만 표로 두고 나머지는 고정한다.
// 규칙을 세 곳에 복제하면 반드시 하나가 빠진다는 것이 이 저장소가 반복해서 밟은 결함이다
// (`ExternalLink` 단일 소유·`panelScroll` 단일 소유와 같은 처방).
import Container from "@/components/Container";
import { fmtKst } from "@/lib/format";
import type { GameId } from "@/lib/game";

/**
 * Riot 규정 문구는 **영문 원문 그대로** 둔다(Legal Jibber Jabber). 한국어 한 줄이 뜻을 먼저
 * 전하고, 원문이 그 아래 붙는다 — 전에는 이 원문이 LoL 방법론 카드 한 곳에만 있었고,
 * 2026-09-23 푸터 도입으로 같은 화면에 고지가 두 벌이 됐다(scope-critic 지적). 소유자를
 * 푸터로 옮겨 **모든 Riot 게임 화면**에 붙이고 카드에서는 뺐다.
 */
const RIOT_BOILERPLATE =
  "patchgap isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

const LEGAL: Record<GameId, { source: string; notice: string; boilerplate?: string }> = {
  lol: {
    source: "Riot Games Match-V5 · Data Dragon",
    notice:
      "patchgap은 Riot Games가 승인하거나 후원한 서비스가 아닙니다. Riot Games 및 관련 자산의 권리는 Riot Games, Inc.에 있습니다.",
    boilerplate: RIOT_BOILERPLATE,
  },
  tft: {
    source: "Riot Games TFT-Match-V1 · Community Dragon",
    notice:
      "patchgap은 Riot Games가 승인하거나 후원한 서비스가 아닙니다. Riot Games 및 관련 자산의 권리는 Riot Games, Inc.에 있습니다.",
    boilerplate: RIOT_BOILERPLATE,
  },
  pubg: {
    source: "PUBG Developer API",
    notice:
      "PUBG: BATTLEGROUNDS 및 관련 이미지·데이터의 권리는 KRAFTON, Inc.에 있습니다. 이 페이지는 비상업 개인 프로젝트이며 KRAFTON이 후원·제휴·승인한 서비스가 아닙니다.",
  },
};

/** 어느 게임에도 속하지 않는 화면(랜딩) — `gameFromPathname`이 `null`을 주는 그 자리다. */
const LANDING_NOTICE =
  "patchgap은 각 게임사와 제휴하거나 보증을 받지 않았습니다. 상표·자산의 저작권은 각 권리자에게 있습니다.";

export interface SiteFooterProps {
  /** `null`이면 랜딩 — 집계 줄 없이 고지만 그린다. */
  game: GameId | null;
  /** 델타 산출물의 `meta.generatedAt`(ISO). 없으면 집계 줄을 그리지 않는다 — 지어내지 않는다. */
  generatedAt?: string | null;
  /** 판정 건수. `null`이면 그 조각만 생략한다. */
  nVerdicts?: number | null;
  /** 바깥에서 이미 `Container`로 감싼 화면(랜딩)은 `false` — 컨테이너가 두 겹이 되지 않게 한다. */
  contained?: boolean;
}

export default function SiteFooter({
  game,
  generatedAt = null,
  nVerdicts = null,
  contained = true,
}: SiteFooterProps) {
  const legal = game ? LEGAL[game] : null;
  // 집계 줄은 **조각을 모아** 만든다 — 없는 값은 문장에서 빠지지, "—"로 자리만 채우지 않는다.
  const meta: string[] = [];
  if (generatedAt) meta.push(`집계 ${fmtKst(generatedAt)}`);
  if (nVerdicts !== null) meta.push(`판정 ${nVerdicts}건`);
  if (legal) meta.push(`데이터 ${legal.source}`);

  const body = (
    <footer className="flex flex-col gap-1 border-t border-border-soft py-5">
      {meta.length > 0 ? <p className="font-mono text-xs text-muted">{meta.join(" · ")}</p> : null}
      {/* 운영 상태 — 전에는 **LoL 방법론 카드에만** 있었다(§8-7 #17). 사이트 전체의 사실이므로
          푸터가 소유한다. 빌드 시각은 정적 배포 시점이고, 집계 시각과는 다른 축이다. */}
      <p className="flex items-center gap-2 font-mono text-xs text-muted">
        <span className="h-2 w-2 rounded-pill bg-success" aria-hidden="true" />
        정상 운영 · 빌드 {fmtKst(new Date().toISOString())}
      </p>
      <p className="text-xs leading-relaxed text-muted">{legal ? legal.notice : LANDING_NOTICE}</p>
      {legal?.boilerplate ? (
        <p className="text-[0.65rem] leading-relaxed text-muted">{legal.boilerplate}</p>
      ) : null}
    </footer>
  );

  return contained ? <Container>{body}</Container> : body;
}
