// src/pipeline/discord/__tests__/run-notify.test.ts
// scripts/run-notify.ts는 CLI 진입점이지만 `main()` 실행은 isMainModule 가드로 막혀 있어(다른
// 스크립트와 동일 패턴, run-match.test.ts/run-aggregate.test.ts 참고) import만으로는 부수효과가
// 없다 — parseArgs/loadDeltasFile/loadNoteCount/loadMatchCount/loadDiscordWebhookUrl/runNotify를
// 단위 테스트한다. vitest include는 src/**/*.test.ts만 수집하므로 이 파일 위치는 discord/__tests__
// 이지만 scripts/를 상대경로로 import한다.
// loadDeltasFile/loadNoteCount/loadMatchCount/runNotify는 전부 `dataRoot` 오버라이드(코디네이터
// 후속 지시, 2026-09-05로 추가)를 받는 임시 디렉토리로 격리 검증한다 — data/aggregated/**(커밋
// 대상, 다른 B7 동시 작업 에이전트가 빈 데이터 빌드 검증 등으로 수시로 지웠다 되살리는 실측을
// 확인한 공유 가변 상태)에 더 이상 의존하지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  countEntityNotes,
  loadDeltasFile,
  loadDiscordWebhookUrl,
  loadMatchCount,
  loadNoteCount,
  parseArgs,
  runNotify,
} from "../../../../scripts/run-notify";
import type { DeltasFile, PatchNoteItem } from "../../types";

function note(overrides: Partial<PatchNoteItem>): PatchNoteItem {
  return {
    id: "note:x",
    patch: "26.17",
    section: "champion",
    entity: "아트록스",
    skill: null,
    stat: null,
    before: null,
    after: null,
    direction: "buff",
    summary: "",
    anchorUrl: "https://example.com",
    anchorKind: "entity",
    modeScope: "core",
    ...overrides,
  };
}

/** 임시 dataRoot 헬퍼 — beforeEach/afterEach로 describe마다 격리된 디렉토리를 만든다. */
function useTmpDataRoot(): { dir: () => string } {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "patchgap-run-notify-"));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  return { dir: () => tmpDir };
}

describe("run-notify: parseArgs", () => {
  it("--from/--to가 없으면 에러", () => {
    expect(() => parseArgs([])).toThrow(/--from/);
  });

  it("기본값(top=5, dryRun=false, site=기본 상수)로 파싱한다", () => {
    const args = parseArgs(["--from", "26.16", "--to", "26.17"]);
    expect(args.from).toBe("26.16");
    expect(args.to).toBe("26.17");
    expect(args.top).toBe(5);
    expect(args.dryRun).toBe(false);
    expect(args.site).toMatch(/^https:\/\//);
  });

  it("--top/--site/--dry-run을 파싱한다", () => {
    const args = parseArgs([
      "--from",
      "26.16",
      "--to",
      "26.17",
      "--top",
      "3",
      "--site",
      "https://example.com",
      "--dry-run",
    ]);
    expect(args.top).toBe(3);
    expect(args.site).toBe("https://example.com");
    expect(args.dryRun).toBe(true);
  });

  it("--top이 숫자가 아니거나 0 이하면 에러", () => {
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--top", "0"])).toThrow(/--top/);
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--top", "x"])).toThrow(/--top/);
  });

  it("알 수 없는 인자는 에러", () => {
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--bogus"])).toThrow(/unknown argument/);
  });

  it("--site가 빈 문자열/공백이면 에러(기본값은 영향 없음)", () => {
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--site", ""])).toThrow(/--site/);
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--site", "   "])).toThrow(/--site/);
    // 기본값(--site 미지정)은 항상 통과한다.
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17"])).not.toThrow();
  });

  it("--site가 http(s):// 스킴이 없으면 에러", () => {
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--site", "example.com"])).toThrow(/--site/);
    expect(() => parseArgs(["--from", "26.16", "--to", "26.17", "--site", "ftp://example.com"])).toThrow(
      /--site/
    );
  });
});

describe("run-notify: loadDeltasFile (임시 dataRoot)", () => {
  const tmp = useTmpDataRoot();

  it("존재하는 deltas 파일을 로드한다", () => {
    const file = path.join(tmp.dir(), "aggregated", "deltas", "26.16_26.17.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const deltas: DeltasFile = {
      meta: { from: "26.16", to: "26.17", generatedAt: "2026-09-05T00:00:00.000Z", n: 0, counts: {}, qAlpha: 0.1 },
      rows: [],
    };
    fs.writeFileSync(file, JSON.stringify(deltas), "utf8");

    const loaded = loadDeltasFile("26.16", "26.17", tmp.dir());
    expect(loaded.meta.from).toBe("26.16");
    expect(loaded.meta.to).toBe("26.17");
    expect(loaded.rows).toEqual([]);
  });

  it("존재하지 않는 패치쌍은 run-match.ts 실행을 안내하는 에러", () => {
    expect(() => loadDeltasFile("99.98", "99.99", tmp.dir())).toThrow(/run-match\.ts/);
  });
});

describe("run-notify: countEntityNotes (순수 함수 — fixture로 distinct 계산 검증)", () => {
  it("같은 챔피언의 노트 여러 줄은 엔티티 1개로 합친다", () => {
    const items = [
      note({ id: "n1", entity: "아우렐리온 솔", skill: "Q" }),
      note({ id: "n2", entity: "아우렐리온 솔", skill: "W" }),
    ];
    expect(countEntityNotes(items)).toBe(1);
  });

  it("system/other 섹션은 엔티티로 세지 않는다", () => {
    const items = [
      note({ id: "n1", section: "champion", entity: "아트록스" }),
      note({ id: "n2", section: "system", entity: "정글 몬스터" }),
      note({ id: "n3", section: "other", entity: "버그 수정" }),
    ];
    expect(countEntityNotes(items)).toBe(1);
  });

  it("챔피언명과 아이템명이 같아도 section이 다르면 별개 엔티티로 센다", () => {
    const items = [
      note({ id: "n1", section: "champion", entity: "폭풍갈퀴" }),
      note({ id: "n2", section: "item", entity: "폭풍갈퀴" }),
    ];
    expect(countEntityNotes(items)).toBe(2);
  });

  it("항목이 없으면 0", () => {
    expect(countEntityNotes([])).toBe(0);
  });

  it("규모가 있는 fixture(챔피언 32명 × 2줄 + 아이템 3종)에서도 distinct 32+3=35를 정확히 센다", () => {
    // data/aggregated/notes/26.17.json(챔피언 32 + 아이템 3 = 35, 실측)과 같은 규모를 이 배치가
    // 소유하지 않는 공유 가변 디렉토리에 의존하지 않고 자체 생성한 fixture로 재현한다 — 다른 B7
    // 동시 작업 에이전트가 data/aggregated/**를 수시로 지웠다 되살리는 것을 실측했기 때문(아래
    // ST-13.md 미확인 사항 참고).
    const items: PatchNoteItem[] = [];
    for (let i = 0; i < 32; i++) {
      items.push(note({ id: `c${i}-1`, section: "champion", entity: `챔피언${i}`, skill: "Q" }));
      items.push(note({ id: `c${i}-2`, section: "champion", entity: `챔피언${i}`, skill: "W" })); // 중복 — 같은 엔티티
    }
    for (let i = 0; i < 3; i++) {
      items.push(note({ id: `i${i}`, section: "item", entity: `아이템${i}` }));
    }
    items.push(note({ id: "sys1", section: "system", entity: "시스템 항목" }));
    items.push(note({ id: "oth1", section: "other", entity: "기타 항목" }));

    expect(countEntityNotes(items)).toBe(35);
  });
});

describe("run-notify: loadNoteCount (임시 dataRoot)", () => {
  const tmp = useTmpDataRoot();

  it("존재하는 notes 파일에서 챔피언·아이템 고유 엔티티 수를 읽는다(전체 항목 수가 아니라 distinct)", () => {
    const file = path.join(tmp.dir(), "aggregated", "notes", "26.17.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const items = [
      note({ id: "n1", section: "champion", entity: "아트록스", skill: "Q" }),
      note({ id: "n2", section: "champion", entity: "아트록스", skill: "W" }), // 중복 — 엔티티 1개로 합산
      note({ id: "n3", section: "item", entity: "폭풍갈퀴" }),
      note({ id: "n4", section: "system", entity: "정글 몬스터" }), // 제외
    ];
    fs.writeFileSync(file, JSON.stringify({ meta: { itemCount: items.length }, items }), "utf8");

    // meta.itemCount(4)가 아니라 distinct 엔티티 수(2)를 반환해야 한다 — 후속 지시의 핵심.
    expect(loadNoteCount("26.17", tmp.dir())).toBe(2);
  });

  it("존재하지 않는 패치는 null", () => {
    expect(loadNoteCount("99.99", tmp.dir())).toBeNull();
  });
});

describe("run-notify: loadMatchCount (임시 dataRoot)", () => {
  const tmp = useTmpDataRoot();

  it("존재하는 summary.json에서 matches를 읽는다", () => {
    const file = path.join(tmp.dir(), "aggregated", "26.17", "summary.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ data: { matches: 6283 } }), "utf8");

    expect(loadMatchCount("26.17", tmp.dir())).toBe(6283);
  });

  it("존재하지 않는 패치는 null", () => {
    expect(loadMatchCount("99.99", tmp.dir())).toBeNull();
  });
});

describe("run-notify: loadDiscordWebhookUrl", () => {
  it("값이 있으면 그대로 반환한다(실제 process.env 대신 주입된 source만 읽는다)", () => {
    expect(loadDiscordWebhookUrl({ DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1/tok" })).toBe(
      "https://discord.com/api/webhooks/1/tok"
    );
  });

  it("없거나 빈 문자열이면 --dry-run을 안내하는 에러(RIOT_API_KEY는 요구하지 않는다)", () => {
    expect(() => loadDiscordWebhookUrl({})).toThrow(/DISCORD_WEBHOOK_URL/);
    expect(() => loadDiscordWebhookUrl({ DISCORD_WEBHOOK_URL: "" })).toThrow(/DISCORD_WEBHOOK_URL/);
    // 무관한 환경변수(예: RIOT_API_KEY 없음)가 섞여 있어도 이 함수는 DISCORD_WEBHOOK_URL만 본다.
    expect(() => loadDiscordWebhookUrl({ PATCH_FROM: "26.16" })).not.toThrow(/RIOT_API_KEY/);
  });
});

describe("run-notify: runNotify (전송 경로 포함 — 임시 dataRoot로 격리)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "patchgap-run-notify-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** rows=0인 최소 유효 DeltasFile을 임시 dataRoot에 써 둔다 — 이 describe는 전송/로그 기록
   * 배관을 검증하는 게 목적이라 embed 내용 자체(빈 미공지 목록)는 중요하지 않다. */
  function writeMinimalDeltas(from: string, to: string): void {
    const file = path.join(tmpDir, "aggregated", "deltas", `${from}_${to}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const deltas: DeltasFile = {
      meta: { from, to, generatedAt: "2026-09-05T00:00:00.000Z", n: 0, counts: {}, qAlpha: 0.1 },
      rows: [],
    };
    fs.writeFileSync(file, JSON.stringify(deltas), "utf8");
  }

  it("--dry-run은 어떤 환경변수도 없이 성공한다(RIOT_API_KEY·DISCORD_WEBHOOK_URL 둘 다 미설정)", async () => {
    writeMinimalDeltas("26.16", "26.17");
    const args = parseArgs(["--from", "26.16", "--to", "26.17", "--dry-run"]);

    // deps.env를 완전히 빈 객체로 주입 — dry-run 분기는 이 값을 아예 읽지 않아야 통과한다.
    const result = await runNotify(args, { dataRoot: tmpDir, env: {} });

    expect(result.dryRun).toBe(true);
    expect(result.send).toBeUndefined();
    expect(result.embeds).toHaveLength(1);
  });

  it("dry-run이 아닌데 DISCORD_WEBHOOK_URL이 없으면 에러(전송 전 실패)", async () => {
    writeMinimalDeltas("26.16", "26.17");
    const args = parseArgs(["--from", "26.16", "--to", "26.17"]);

    await expect(runNotify(args, { dataRoot: tmpDir, env: {} })).rejects.toThrow(/DISCORD_WEBHOOK_URL/);
  });

  it("전송 성공(204) → notify.json이 {game,from,to,sentAt,status,retries} 스키마로 생성되고 웹훅 URL은 담기지 않는다", async () => {
    writeMinimalDeltas("26.16", "26.17");
    const args = parseArgs(["--from", "26.16", "--to", "26.17"]);
    const fakeUrl = "https://discord.com/api/webhooks/999/super-secret-token";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await runNotify(args, {
      dataRoot: tmpDir,
      env: { DISCORD_WEBHOOK_URL: fakeUrl },
      fetchImpl,
    });

    expect(result.dryRun).toBe(false);
    expect(result.send).toEqual({
      status: 204,
      retries: 0,
      logFile: path.join(tmpDir, "aggregated", "deltas", "26.16_26.17.notify.json"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // sendWebhook에 실제로 fakeUrl이 전달됐는지(=전송 경로가 정말 실행됐는지) 호출 인자로 확인.
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(fakeUrl);

    const logFile = path.join(tmpDir, "aggregated", "deltas", "26.16_26.17.notify.json");
    expect(fs.existsSync(logFile)).toBe(true);
    const raw = fs.readFileSync(logFile, "utf8");
    const log = JSON.parse(raw) as Record<string, unknown>;
    // 2026-09-20 게임별 채널 분리로 `game`이 추가됐다 — 로그만 보고 어느 채널로 갔는지
    // 역추적할 수 있어야 한다(그러지 못하면 오발송을 사후에 확인할 방법이 없다).
    expect(Object.keys(log).sort()).toEqual(["from", "game", "retries", "sentAt", "status", "to"]);
    expect(log).toMatchObject({ game: "lol", from: "26.16", to: "26.17", status: 204, retries: 0 });
    expect(typeof log.sentAt).toBe("string");
    // 웹훅 URL(비밀)이 로그 파일에 절대 담기지 않아야 한다.
    expect(raw).not.toContain(fakeUrl);
    expect(raw).not.toContain("super-secret-token");
  });

  it("**알림 로그가 게임별 폴더로 갈린다** — 안 그러면 TFT 로그가 LoL 산출물 폴더에 떨어진다", async () => {
    const dir = path.join(tmpDir, "aggregated", "tft");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "deltas-18.1-18.2.json"),
      JSON.stringify({
        meta: { from: "18.1", to: "18.2", qAlpha: 0.1, generatedAt: "2026-09-20T00:00:00Z", noteCount: 3, matches: { before: 10, after: 20 } },
        rows: [],
      }),
      "utf8"
    );
    const args = parseArgs(["--from", "18.1", "--to", "18.2", "--game", "tft"]);
    const result = await runNotify(args, {
      dataRoot: tmpDir,
      env: { DISCORD_WEBHOOK_URL_TFT: "https://discord.com/api/webhooks/1/tft-token" },
      fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    });
    expect(result.send?.logFile).toBe(path.join(tmpDir, "aggregated", "tft", "18.1_18.2.notify.json"));
    // LoL 폴더는 건드리지 않는다.
    expect(fs.existsSync(path.join(tmpDir, "aggregated", "deltas", "18.1_18.2.notify.json"))).toBe(false);
  });
});

describe("게임별 채널 분리 (2026-09-20)", () => {
  it("--game 기본값은 lol — 기존 크론이 그대로 돈다", () => {
    const a = parseArgs(["--from", "26.17", "--to", "26.18"]);
    expect(a.game).toBe("lol");
  });

  it("알 수 없는 게임은 파싱 시점에 막는다 — 전송 직전까지 미루면 오타를 늦게 안다", () => {
    expect(() => parseArgs(["--from", "26.17", "--to", "26.18", "--game", "valorant"])).toThrow(/lol\|pubg\|tft/);
  });

  it("--game tft를 받는다", () => {
    expect(parseArgs(["--from", "18.1", "--to", "18.2", "--game", "tft"]).game).toBe("tft");
  });

});
