import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // RTL 자동 cleanup 등록(globals:false라 자동 등록이 안 된다) — vitest.setup.ts 주석 참고
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
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
