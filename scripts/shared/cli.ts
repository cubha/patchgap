// scripts/shared/cli.ts
// 파이프라인 CLI 스크립트(scripts/run-*.ts) 공용 헬퍼 — 반복되던 두 가지만 모은다:
// 1) `isMainModule` — 이 파일이 `node`/`tsx`로 직접 실행됐는지 판정(테스트가 스크립트를 import만
//    해도 `main()`이 실행되지 않게 하는 가드).
// 2) `parseCliArgs` — "--flag value"/"--flag"(boolean) 스타일 옵션의 기계적인 파싱부(알 수 없는
//    플래그·필수 옵션 누락·타입 변환 실패를 표준 에러 포맷으로 던짐). 스크립트별 도메인 검증
//    (양수 체크·enum·URL 스킴 등, 서로 완전히 다른 규칙)은 이 헬퍼 위에서 각 스크립트가 계속
//    직접 한다 — 억지로 하나의 스키마에 우겨넣지 않는다(2026-09-05 리팩토링).

import { pathToFileURL } from "node:url";

/**
 * 이 모듈이 `process.argv[1]`로 지정된 엔트리 파일과 동일한지 비교해 "직접 실행" 여부를 판정한다.
 * 호출부는 `isMainModule(import.meta.url)`로 쓴다 — import만으로는 `main()`이 돌지 않게 하는
 * 기존 관례(run-aggregate.ts/run-ddragon.ts/run-match.ts/run-notify.ts)를 그대로 헬퍼로 옮긴 것.
 */
export function isMainModule(importMetaUrl: string): boolean {
  return process.argv[1] !== undefined && importMetaUrl === pathToFileURL(process.argv[1]).href;
}

export type CliOptionType = "string" | "number" | "boolean" | "patch";

/** 패치 ID 형식(예: "26.17") — 두 자리 메이저 + 1~2자리 마이너. `type: "patch"` 옵션이 이 형식을
 * 강제한다(경로 조작·셸 메타문자 등 임의 문자열이 그대로 이 값을 소비하는 GH Actions run: 블록·
 * 파일 경로 조합(data/aggregated/{patch}/...)으로 흘러드는 것을 원천 차단 — security-auditor
 * Warning 대응, 2026-09-06). */
export const PATCH_ID_PATTERN = /^\d{2}\.\d{1,2}$/;

/**
 * 환경변수 값 — 앞뒤 공백을 걷고 빈 문자열이면 `undefined`. `*-determine.ts` 세 진입점이 같은 함수를
 * 각자 들고 있었다(2026-10-06 단일화). workflow_dispatch 입력은 env로 들어와 `parseCliArgs`를 거치지
 * 않으므로, 경로에 꿰어질 패치 값은 호출부가 `PATCH_ID_PATTERN`으로 다시 검사한다.
 */
export function envValue(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const v = (env[name] ?? "").trim();
  return v.length > 0 ? v : undefined;
}

export interface CliOptionSpec {
  /** camelCase 필드명. CLI 플래그는 이 이름을 kebab-case로 바꾼 `--{kebab}` 형태로 자동 유도한다
   * (예: "dataRoot" → "--data-root", "noLlm" → "--no-llm", "llmMax" → "--llm-max"). */
  name: string;
  type: CliOptionType;
  /** true면 값이 없고 default도 없을 때 에러. */
  required?: boolean;
  /** 플래그가 없을 때 채울 기본값. */
  default?: string | number | boolean;
}

export type CliArgValues = Record<string, string | number | boolean | undefined>;

/** camelCase → "--kebab-case" 플래그 문자열. */
function toFlag(name: string): string {
  return `--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/**
 * `argv`를 `spec`대로 파싱해 camelCase 키 값 객체로 돌려준다. 알 수 없는 플래그·필수 옵션 누락·
 * 숫자 타입 변환 실패는 전부 `"{scriptName}: ..."` 형식 Error로 던진다(각 스크립트가 그대로
 * catch해 콘솔에 출력하는 기존 관례와 동일한 포맷). boolean 옵션은 값을 소비하지 않고 존재
 * 자체로 true가 된다. 도메인 특화 검증(양수·enum·URL 스킴 등)은 반환값 위에서 호출부가 이어서
 * 한다 — 이 함수는 "플래그를 읽어 타입에 맞게 담았는가"까지만 책임진다.
 */
export function parseCliArgs(
  scriptName: string,
  argv: readonly string[],
  spec: readonly CliOptionSpec[]
): CliArgValues {
  const byFlag = new Map(spec.map((opt) => [toFlag(opt.name), opt]));
  const values: CliArgValues = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const opt = byFlag.get(arg);
    if (!opt) {
      throw new Error(`${scriptName}: unknown argument "${arg}"`);
    }

    if (opt.type === "boolean") {
      values[opt.name] = true;
      continue;
    }

    const raw = argv[++i];
    if (raw === undefined) {
      throw new Error(`${scriptName}: ${toFlag(opt.name)} requires a value`);
    }

    if (opt.type === "number") {
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        throw new Error(`${scriptName}: ${toFlag(opt.name)} must be a number (got "${raw}")`);
      }
      values[opt.name] = num;
    } else if (opt.type === "patch") {
      if (!PATCH_ID_PATTERN.test(raw)) {
        throw new Error(`${scriptName}: ${toFlag(opt.name)} must look like 26.17`);
      }
      values[opt.name] = raw;
    } else {
      values[opt.name] = raw;
    }
  }

  for (const opt of spec) {
    if (values[opt.name] !== undefined) continue;
    if (opt.default !== undefined) {
      values[opt.name] = opt.default;
    } else if (opt.required) {
      throw new Error(`${scriptName}: ${toFlag(opt.name)} <value> is required`);
    }
  }

  return values;
}
