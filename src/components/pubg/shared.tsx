// src/components/pubg/shared.tsx
// PUBG 화면 3개(브리핑·대조표·방법론)가 함께 쓰는 조각. 2026-09-18 라운드6(사용자 P2): 이 파일의
// 사용자 노출 문구에서 다른 게임과의 비교 서술을 전부 뺐다 — PUBG는 PUBG의 판정표로만 말한다.
// 표본 성격 고지는 방법론에만 붙는다(브리핑·대조표는 결과만).
import type { ReactNode } from "react";
import { fmtKst } from "@/lib/format";

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function signedPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

/**
 * 화면 상단 제목 블록 — 세 라우트가 같은 위계로 시작하게 한다.
 *
 * `ambient-hero-*` 그림자는 LoL 히어로(`HeroSummary.tsx`)와 같은 처리다 — 이 제목은 패널
 * 안이 아니라 **배경 사진 위에 직접** 앉으므로, 키아트의 밝은 지점(연기·역광 하이라이트)에서
 * 글자가 묻히지 않게 시안 `.hero-body h2`의 text-shadow를 승계한다. 사진이 깔리지 않는
 * 라우트(대조표·방법론)에서도 그림자는 무해하다(배경이 단색이면 보이지 않는다).
 */
export function PubgPageHeader({ title, lead }: { title: ReactNode; lead: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <p className="ambient-hero-sub font-mono text-xs font-bold tracking-wide text-accent uppercase">
        PUBG: BATTLEGROUNDS
      </p>
      <h1 className="ambient-hero-headline font-display text-3xl leading-tight font-bold text-balance break-keep text-fg">
        {title}
      </h1>
      <p className="ambient-hero-sub text-sm leading-relaxed text-fg" style={{ maxWidth: "var(--measure)" }}>
        {lead}
      </p>
    </header>
  );
}

/** 표본 성격 고지 — 방법론 화면 상단. 판정 숫자를 읽기 전에 알아야 할 표본의 성격만 말한다. */
export function PubgSampleNotice({ sampleScope }: { sampleScope: string }) {
  return (
    <div className="rounded-md border border-warn/40 bg-surface-warm/40 p-4">
      <p className="font-mono text-xs font-bold text-warn">표본</p>
      <p className="mt-2 text-sm leading-relaxed text-fg-2" style={{ maxWidth: "var(--measure-wide)" }}>
        {sampleScope}. 지역·티어를 고정할 수 없는 API라 <strong className="text-fg">전 지역·전 티어 무작위</strong>{" "}
        표본이며 봇이 포함됩니다(비율 병기).
      </p>
    </div>
  );
}

/** 집계 캡션 + 크래프톤 권리 고지. 세 라우트 공통 푸터. */
export function PubgFooter({ generatedAt, nVerdicts }: { generatedAt: string; nVerdicts: number }) {
  return (
    <footer className="flex flex-col gap-1 border-t border-border-soft pt-4">
      <p className="font-mono text-xs text-muted">
        집계 {fmtKst(generatedAt)} · 판정 {nVerdicts}건 · 데이터 PUBG Developer API
      </p>
      <p className="text-xs leading-relaxed text-muted">
        PUBG: BATTLEGROUNDS 및 관련 이미지·데이터의 권리는 KRAFTON, Inc.에 있습니다. 이 페이지는
        비상업 개인 프로젝트이며 KRAFTON이 후원·제휴·승인한 서비스가 아닙니다.
      </p>
    </footer>
  );
}

/** 집계 산출물이 없을 때의 정직한 빈 화면 — 정적 export라 라우트는 항상 빌드된다(게이트는
 * 드롭다운 옵션을 가릴 뿐이므로, 직접 URL로 들어온 사람에게는 이 화면이 답한다). */
export function PubgUnavailable() {
  return (
    <div className="py-12">
      <h1 className="font-display text-2xl font-bold text-fg">PUBG 어댑터 · 미연결</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted" style={{ maxWidth: "var(--measure)" }}>
        집계 산출물이 아직 없습니다. 어댑터 매핑은 방법론 화면에서 확인할 수 있습니다.
      </p>
    </div>
  );
}
