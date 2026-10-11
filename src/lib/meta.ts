// src/lib/meta.ts — 라우트 메타 단일 출처(ST-1, 트랙 B6). 구현 전 시그니처.
import type { Metadata } from "next";
import type { GameId } from "./game";

export const SITE_URL = "https://patchgap.vercel.app";

export type MetaScreen = "briefing" | "compare" | "methodology" | "detail";

export interface PageMetaInput {
  game: GameId;
  screen: MetaScreen;
  path: string;
  pair?: { from: string; to: string } | null;
  entity?: string | null;
  description?: string;
  canonicalPath?: string;
}

export function ogImagePath(game: GameId | null): string {
  void game;
  throw new Error("TODO(meta): ogImagePath");
}

export function pageTitle(input: PageMetaInput): string {
  void input;
  throw new Error("TODO(meta): pageTitle");
}

export function pageMeta(input: PageMetaInput): Metadata {
  void input;
  throw new Error("TODO(meta): pageMeta");
}
