// src/pipeline/shared/env.ts
// dotenv 로드 + zod 검증. 값은 절대 로그하지 않는다 — 실패 메시지도 필드 경로만 담고
// 수신값(issue.message에 섞여 나올 수 있는 원문)은 노출하지 않는다.

import { config as loadDotenvFile } from "dotenv";
import { z } from "zod";
import { PATCH_ID_PATTERN } from "./patches";

// process.env는 수백 개 키를 가진 실제 환경이라 z.object 기본(strip) 모드로 둔다 — 미지정 키를
// 에러로 취급하지 않는다(.strict() 금지). RIOT_PERSONAL_KEY/RIOT_DEV_KEY 같은 이 프로젝트의
// 추가 키도 그대로 통과한다.
// 패치 ID 형식(예: "26.17") — scripts/shared/cli.ts의 `type: "patch"` 검증과 동일 패턴. 경로
// 조작·셸 메타문자 등 임의 문자열이 PATCH_FROM/PATCH_TO를 통해 파일 경로 조합·GH Actions
// run: 블록으로 흘러드는 것을 막는다(security-auditor Warning 대응, 2026-09-06).

const envSchema = z.object({
  RIOT_API_KEY: z.string().min(1, "RIOT_API_KEY is required"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  DISCORD_WEBHOOK_URL: z.string().min(1).optional(),
  PATCH_FROM: z.string().regex(PATCH_ID_PATTERN, "PATCH_FROM must look like 26.17").default("26.16"),
  PATCH_TO: z.string().regex(PATCH_ID_PATTERN, "PATCH_TO must look like 26.17").default("26.17"),
});

export interface Env {
  RIOT_API_KEY: string;
  ANTHROPIC_API_KEY: string | undefined;
  DISCORD_WEBHOOK_URL: string | undefined;
  PATCH_FROM: string;
  PATCH_TO: string;
}

/**
 * 환경변수를 로드·검증한다.
 * - source 미지정: `.env` 파일을 로드(dotenv)한 뒤 process.env를 검증한다(스크립트 진입점용).
 * - source 지정: dotenv 로드를 건너뛰고 주어진 객체만 검증한다(테스트 주입용 — .env 파일에 의존하지 않는다).
 * 값은 절대 콘솔에 출력하지 않으며, 실패 시에도 필드 경로만 담은 메시지를 던진다.
 */
export function loadEnv(source?: Partial<NodeJS.ProcessEnv>): Env {
  let target: Partial<NodeJS.ProcessEnv>;
  if (source) {
    target = source;
  } else {
    loadDotenvFile();
    target = process.env;
  }

  const parsed = envSchema.safeParse(target);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new Error(`invalid environment: missing/invalid keys: ${fields.join(", ")}`);
  }

  return {
    RIOT_API_KEY: parsed.data.RIOT_API_KEY,
    ANTHROPIC_API_KEY: parsed.data.ANTHROPIC_API_KEY,
    DISCORD_WEBHOOK_URL: parsed.data.DISCORD_WEBHOOK_URL,
    PATCH_FROM: parsed.data.PATCH_FROM,
    PATCH_TO: parsed.data.PATCH_TO,
  };
}
