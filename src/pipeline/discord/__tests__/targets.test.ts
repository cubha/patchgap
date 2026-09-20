import { describe, it, expect } from "vitest";

import {
  configuredTargets,
  isNotifyGameId,
  mentionContent,
  mentionPayload,
  resolveDiscordTarget,
  roleEnvName,
  webhookEnvName,
} from "../targets";

const HOOK = "https://discord.com/api/webhooks/1/abc";
const HOOK2 = "https://discord.com/api/webhooks/2/def";

describe("환경변수 이름 규칙", () => {
  it("게임을 늘릴 때 코드가 아니라 변수만 늘도록 규칙이 고정돼 있다", () => {
    expect(webhookEnvName("tft")).toBe("DISCORD_WEBHOOK_URL_TFT");
    expect(roleEnvName("pubg")).toBe("DISCORD_ROLE_ID_PUBG");
  });

  it("알 수 없는 게임은 거른다", () => {
    expect(isNotifyGameId("lol")).toBe(true);
    expect(isNotifyGameId("valorant")).toBe(false);
  });
});

describe("resolveDiscordTarget", () => {
  it("게임별 웹훅을 고른다", () => {
    const t = resolveDiscordTarget("tft", { DISCORD_WEBHOOK_URL_TFT: HOOK, DISCORD_ROLE_ID_TFT: "123" });
    expect(t).toEqual({ game: "tft", webhookUrl: HOOK, roleId: "123" });
  });

  it("역할이 없으면 null — 웹훅만으로도 보낼 수 있다", () => {
    expect(resolveDiscordTarget("pubg", { DISCORD_WEBHOOK_URL_PUBG: HOOK }).roleId).toBeNull();
  });

  it("레거시 DISCORD_WEBHOOK_URL은 lol만 받는다", () => {
    expect(resolveDiscordTarget("lol", { DISCORD_WEBHOOK_URL: HOOK }).webhookUrl).toBe(HOOK);
  });

  it("**PUBG·TFT는 레거시로 폴백하지 않는다** — 폴백하면 LoL 채널로 잘못 나간다", () => {
    expect(() => resolveDiscordTarget("pubg", { DISCORD_WEBHOOK_URL: HOOK })).toThrow(/DISCORD_WEBHOOK_URL_PUBG/);
    expect(() => resolveDiscordTarget("tft", { DISCORD_WEBHOOK_URL: HOOK })).toThrow(/DISCORD_WEBHOOK_URL_TFT/);
  });

  it("게임별 값이 레거시보다 우선한다", () => {
    const t = resolveDiscordTarget("lol", { DISCORD_WEBHOOK_URL: HOOK, DISCORD_WEBHOOK_URL_LOL: HOOK2 });
    expect(t.webhookUrl).toBe(HOOK2);
  });

  it("빈 문자열은 미설정으로 본다 — 빈 Secret이 조용히 통과하면 안 된다", () => {
    expect(() => resolveDiscordTarget("tft", { DISCORD_WEBHOOK_URL_TFT: "   " })).toThrow();
  });
});

describe("configuredTargets", () => {
  it("설정된 게임만 돌려준다", () => {
    const targets = configuredTargets({ DISCORD_WEBHOOK_URL_LOL: HOOK, DISCORD_WEBHOOK_URL_TFT: HOOK2 });
    expect(targets.map((t) => t.game)).toEqual(["lol", "tft"]);
  });

  it("아무것도 없으면 빈 배열 — 던지지 않는다", () => {
    expect(configuredTargets({})).toEqual([]);
  });
});

describe("멘션", () => {
  it("역할이 있으면 멘션 한 줄을 만든다", () => {
    expect(mentionContent({ game: "lol", webhookUrl: HOOK, roleId: "999" })).toBe("<@&999>");
  });

  it("역할이 없으면 content를 아예 넣지 않는다", () => {
    const p = mentionPayload({ game: "lol", webhookUrl: HOOK, roleId: null });
    expect(p.content).toBeUndefined();
    expect(p.allowed_mentions).toEqual({ parse: [], roles: [] });
  });

  it("allowed_mentions에 그 역할만 넣는다 — 없으면 핑이 안 가고, 넓으면 엉뚱한 곳에 간다", () => {
    const p = mentionPayload({ game: "tft", webhookUrl: HOOK, roleId: "777" });
    expect(p.content).toBe("<@&777>");
    expect(p.allowed_mentions).toEqual({ parse: [], roles: ["777"] });
  });
});
