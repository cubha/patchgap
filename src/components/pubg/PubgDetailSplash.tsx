// src/components/pubg/PubgDetailSplash.tsx
// 항목상세 스플래시 — 승인 아티팩트 「PUBG 테마 시안」 2차 개정 §4의 `.detail-card` 이식.
// 시안 마크업 대응:
//   .detail-card    → <section> (border-soft · radius-lg · overflow-hidden · min-h)
//   .detail-splash  → 배경 이미지 레이어. `contain`(무기 렌더) / `cover`(맵 지형도) 2종
//   .detail-tint    → 좌→우 그라디언트(본문 가독 확보)
//   .detail-body    → 아이브로우 · 제목 · 스탯 행 · 판정 박스
//   .detail-verdict → 좌측 accent 보더 박스
//
// **시안에 없어서 보충한 것 — 자산 미보유 상태**: 시안은 세 탭 모두 렌더가 있다고 전제하지만,
// 실측에서 무기 47종 중 9종(RPD·권총류·JS9·M79)이 `pubg/api-assets`에 아예 없다. 그중 RPD는
// 이 패치의 대표 판정 대상이라 폴백이 예외가 아니라 정상 경로다. 깨진 `<img>`는 상태가 아니므로
// 자산 유무를 **빌드 타임에** 판정해(매니페스트) 텍스트 마크 레이어로 대체한다 —
// 클라이언트 onError 핸들러가 필요 없다(서버 컴포넌트 유지).
//
// §1-2 불변식: 상태 색(--accent/--danger/--warn/--success)은 여기서 재정의하지 않는다.
import type { ReactNode } from "react";
import { panelSurfaceClass } from "@/lib/panelSurface";

export interface PubgDetailStat {
  label: string;
  value: ReactNode;
  /** 값의 방향 — 시안 `.detail-stat .up/.down`. 방향이 없는 기술 통계는 생략한다. */
  tone?: "up" | "down";
}

export interface PubgDetailSplashProps {
  /** 시안 `.detail-eyebrow` — "무기 · 돌격소총" / "맵 · 8×8". */
  eyebrow: string;
  title: string;
  /** 자산 경로. null이면 폴백 레이어를 그린다(깨진 이미지 금지). */
  imageSrc: string | null;
  /** 무기 렌더는 `contain`(여백 두고 실루엣), 맵 지형도는 `cover`(꽉 채움) — 시안과 동일. */
  fit: "contain" | "cover";
  /** 자산이 없을 때 이미지 자리에 놓을 짧은 마크(무기명 약자 등). */
  fallbackMark: string;
  stats: PubgDetailStat[];
  verdict?: ReactNode;
}

const TONE_CLASS: Record<"up" | "down", string> = {
  up: "text-success",
  down: "text-danger",
};

export default function PubgDetailSplash({
  eyebrow,
  title,
  imageSrc,
  fit,
  fallbackMark,
  stats,
  verdict,
}: PubgDetailSplashProps) {
  return (
    <section
      className={`${panelSurfaceClass("glass")} relative overflow-hidden rounded-lg`}
      style={{ minHeight: "260px" }}
    >
      {/* .detail-splash — next/image를 쓰지 않는다: output:'export'에서 최적화가 꺼져 있고
          (런타임 변환 서버가 없다) 여기 필요한 건 배경 레이어 한 장이라 <img>가 계약에 맞다. */}
      <div className="absolute inset-0 flex">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className={`h-full w-full ${fit === "contain" ? "object-contain p-6 md:px-10" : "object-cover"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-end pr-8">
            <span
              aria-hidden="true"
              className="font-display text-7xl font-bold text-border select-none"
            >
              {fallbackMark}
            </span>
          </div>
        )}
      </div>

      {/* .detail-tint — 좌측을 불투명하게 덮어 본문 대비를 확보한다. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 45%, transparent) 46%, transparent 78%)",
        }}
      />

      {/* .detail-body */}
      <div className="relative z-2 p-5" style={{ maxWidth: "340px" }}>
        <p className="font-mono text-xs tracking-wide uppercase" style={{ color: "var(--game-glow)" }}>
          {eyebrow}
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold text-fg">{title}</h2>

        <dl className="mt-2 flex flex-col gap-1">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2 font-mono text-sm">
              <dt className="text-muted">{stat.label}</dt>
              <dd className={`tabular-nums ${stat.tone ? `font-bold ${TONE_CLASS[stat.tone]}` : "text-fg"}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        {verdict ? (
          <div
            className="mt-3 rounded-sm border-l-2 border-accent px-2.5 py-2 text-xs leading-relaxed text-fg-2"
            style={{ background: "color-mix(in srgb, var(--bg) 40%, transparent)" }}
          >
            {verdict}
          </div>
        ) : null}
      </div>
    </section>
  );
}
