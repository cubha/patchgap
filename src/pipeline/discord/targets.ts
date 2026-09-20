// src/pipeline/discord/targets.ts
// 게임 → 디스코드 전송 대상(채널 웹훅 + 알림 역할) 해석.
//
// **왜 게임마다 URL이 따로인가**: 디스코드 웹훅 URL은 **채널 하나에 묶여 있다.** 채널을 나누는
// 유일한 방법이 URL을 나누는 것이다. 게임을 늘릴 때 코드가 아니라 환경변수만 늘도록 이름 규칙을
// 고정한다: `DISCORD_WEBHOOK_URL_{GAME}` · `DISCORD_ROLE_ID_{GAME}`.
//
// **왜 역할 멘션이 함께 필요한가**: 채널 분리는 *읽을 때* 섞이지 않게 해줄 뿐, 디스코드는 채널에
// 글이 올라와도 기본적으로 알림을 주지 않는다(읽지 않음 배지만). 사용자가 "내가 보는 게임만
// 받는다"를 실제로 얻으려면 게임별 역할을 받아 가고 메시지가 그 역할을 멘션해야 한다.
// 멘션이 실제 핑이 되려면 payload에 `allowed_mentions`로 그 역할을 명시해야 한다 — 안 적으면
// 텍스트만 역할처럼 보이고 알림은 가지 않는다.
//
// **레거시 폴백은 LoL에만 준다**: 기존 크론이 `DISCORD_WEBHOOK_URL` 하나를 쓰고 있어서 그 값을
// 살려야 하는데, 그것을 전 게임 폴백으로 쓰면 PUBG·TFT 브리핑이 **LoL 채널로 잘못 나간다** —
// 채널을 나누려는 목적 그 자체를 깨는 실패다. 그래서 폴백은 lol 한정이고, 나머지는 미설정이면
// 조용히 다른 데로 보내지 않고 **멈춘다**.

/** 알림을 보낼 수 있는 게임. `lib/game.ts`의 `GameId`와 별개로 둔 이유는 TFT가 아직 그 유니온에
 *  없기 때문이다 — ST6에서 레지스트리에 편입되면 그쪽을 참조하도록 좁힌다. */
export type NotifyGameId = "lol" | "pubg" | "tft";

export const NOTIFY_GAMES: readonly NotifyGameId[] = ["lol", "pubg", "tft"];

export interface DiscordTarget {
  game: NotifyGameId;
  webhookUrl: string;
  /** 역할 ID(숫자 문자열). 없으면 멘션 없이 보낸다. */
  roleId: string | null;
}

export function isNotifyGameId(value: string): value is NotifyGameId {
  return (NOTIFY_GAMES as readonly string[]).includes(value);
}

export function webhookEnvName(game: NotifyGameId): string {
  return `DISCORD_WEBHOOK_URL_${game.toUpperCase()}`;
}

export function roleEnvName(game: NotifyGameId): string {
  return `DISCORD_ROLE_ID_${game.toUpperCase()}`;
}

/**
 * 게임의 전송 대상을 고른다. 없으면 **던진다** — 조용히 다른 채널로 보내지 않는다.
 * `lol`만 레거시 `DISCORD_WEBHOOK_URL`로 폴백한다(위 헤더 참고).
 */
export function resolveDiscordTarget(
  game: NotifyGameId,
  source: Partial<NodeJS.ProcessEnv> = process.env
): DiscordTarget {
  const specific = source[webhookEnvName(game)]?.trim();
  const legacy = game === "lol" ? source.DISCORD_WEBHOOK_URL?.trim() : undefined;
  const webhookUrl = specific || legacy;

  if (!webhookUrl) {
    throw new Error(
      `discord: ${game} 웹훅이 없다 — ${webhookEnvName(game)}를 설정한다. ` +
        `(웹훅 URL은 채널 하나에 묶여 있어 게임마다 따로 만들어야 한다.)`
    );
  }

  const roleId = source[roleEnvName(game)]?.trim() || null;
  return { game, webhookUrl, roleId };
}

/** 설정된 게임만 돌려준다 — 워크플로가 "있는 것만 보내기"를 할 수 있게. */
export function configuredTargets(source: Partial<NodeJS.ProcessEnv> = process.env): DiscordTarget[] {
  const out: DiscordTarget[] = [];
  for (const game of NOTIFY_GAMES) {
    try {
      out.push(resolveDiscordTarget(game, source));
    } catch {
      // 미설정 게임은 조용히 건너뛴다 — 여기서는 "전부 보내라"가 아니라 "있는 것만"이 계약이다.
    }
  }
  return out;
}

/**
 * 역할 멘션 한 줄. 역할이 없으면 `null`(멘션 없이 embed만 보낸다).
 * `allowed_mentions`와 **반드시 짝**이어야 실제 핑이 간다 — 아래 `mentionPayload` 참고.
 */
export function mentionContent(target: DiscordTarget): string | null {
  return target.roleId === null ? null : `<@&${target.roleId}>`;
}

/**
 * payload에 얹을 멘션 관련 필드. `allowed_mentions.roles`에 **그 역할만** 넣는다 —
 * 비워 두면 디스코드가 텍스트는 보여주되 알림은 보내지 않고, `parse: ["roles"]`처럼 넓게 열면
 * 브리핑 본문에 우연히 들어간 다른 역할까지 핑이 간다.
 */
export function mentionPayload(target: DiscordTarget): {
  content?: string;
  allowed_mentions: { parse: never[]; roles: string[] };
} {
  const content = mentionContent(target);
  return {
    ...(content === null ? {} : { content }),
    allowed_mentions: { parse: [], roles: target.roleId === null ? [] : [target.roleId] },
  };
}
