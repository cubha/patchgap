// src/components/BrandMark.tsx
// 브랜드 마크 — 헤더 로고 자리(2026-09-19, 사용자 지시로 단순 점 마커를 대체).
//
// 형태: 육각 프레임 + 안쪽 델타(Δ=변화)를 가운데서 좌우로 가르고 **색만 반전**한다.
// 왼쪽(크림)=패치노트가 말한 것 · 오른쪽(금색)=통계가 말하는 것 — 사이트 전체가 쓰는 색 역할과
// 같다(미공지 수치가 금색인 것과 같은 규칙). 어긋남을 형태로 그리던 초안은 사용자가 반려했고,
// 정렬은 유지한 채 색으로만 가르는 쪽으로 확정했다.
//
// 인라인 SVG인 이유: 헤더는 모든 라우트에 있어 PNG로 부르면 요청이 매번 붙고, 축소 시 흐려진다.
// 색은 토큰(`--fg`·`--accent`)을 직접 참조하므로 게임 테마가 바뀌면 함께 따라간다 —
// `public/brand/patchgap-mark.svg`는 같은 도형의 앱 아이콘판(어두운 라운드 사각 배경 포함)이고,
// 여기서는 글리프만 쓴다(워드마크 옆에 사각 배경까지 들어가면 무거워진다).
//
// 원본 도형: docs/design/brand-candidates/A-split1-outline.svg

interface BrandMarkProps {
  /** 렌더 크기(px). 헤더 기본 22 — 워드마크 대문자 높이에 맞춘 값이다. */
  size?: number;
  className?: string;
}

export default function BrandMark({ size = 22, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* 왼쪽 절반 — 크림. 가운데 6px 심(seam)만 두고 정확히 정렬한다. */}
      <g clipPath="inset(0 51% 0 0)">
        <path
          d="M128 38 L204 82 L204 174 L128 218 L52 174 L52 82 Z"
          fill="none"
          stroke="var(--fg)"
          strokeWidth="15"
          strokeLinejoin="round"
        />
        <path d="M128 76 L174 164 L82 164 Z" fill="var(--fg)" />
      </g>
      {/* 오른쪽 절반 — 금색. */}
      <g clipPath="inset(0 0 0 51%)">
        <path
          d="M128 38 L204 82 L204 174 L128 218 L52 174 L52 82 Z"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="15"
          strokeLinejoin="round"
        />
        <path d="M128 76 L174 164 L82 164 Z" fill="var(--accent)" />
      </g>
    </svg>
  );
}
