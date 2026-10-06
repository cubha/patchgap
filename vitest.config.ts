import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // RTL 자동 cleanup 등록(globals:false라 자동 등록이 안 된다) — vitest.setup.ts 주석 참고
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules/**"],
    // 워커 상한(2026-09-28 실측). 기본값(코어 20 → 워커 19)이면 /mnt/d(WSL 9p) 위에서 jsdom 워커가 동시에
    // 뜨며 시작 응답 60s(vitest START_TIMEOUT)를 넘겨 「Failed to start forks worker」가 파일 164개에서
    // 결정론적으로 재현됐다(테스트는 전부 통과, 오류 1건으로 게이트 실패 · PR-B tip 160개에선 무발생).
    // 8 = 144s · 12 = 105s 둘 다 무오류 — verify.sh 단위 테스트 상한 240s 안에서 빠른 쪽.
    maxWorkers: 12,
    // 환경을 파일 종류로 가른다(2026-09-21). 전부 jsdom이던 때는 121개 파일마다 jsdom을 새로 만들어
    // 전체 시간의 79%가 환경 생성이었고(실측 219s), verify.sh의 단위 테스트 상한 240s에 두 번 걸렸다.
    // DOM이 필요한 건 컴포넌트·페이지 테스트(.tsx)뿐이다 — 파이프라인·스크립트 테스트(.ts)는 node로 돈다.
    projects: [
      {
        extends: true,
        test: { name: "dom", environment: "jsdom", include: ["src/**/*.test.tsx"] },
      },
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
