// src/app/not-found.tsx
// 404(ST-26, 2026-10-08 site-review tft-S24·lol-S29). 전에는 Next 기본 영문 페이지("This page could not be found.")였고,
// 게임 접두 경로(`/tft/unit/…`)에서는 React #418(하이드레이션 불일치)까지 났다.
//
// **#418의 원인**: 정적 export의 `404.html`은 경로 `/_not-found`로 한 번 렌더된다 — 헤더·배경·`data-game`이 경로에서 게임을
// 읽는데(`gameFromPathname`) 서버는 null, 클라이언트는 실제 주소(`/tft/…`)로 "tft"를 읽어 첫 렌더가 어긋난다. 그래서 이
// 페이지가 **하이드레이션 전에** 전역 표식을 세우고(`<script>`는 파싱 즉시 실행), 경로에서 게임을 읽는 소비자는 그 표식이
// 있으면 서버와 같은 null을 쓴다(`gameFromPathname`이 소유).
import Container from "@/components/Container";
import SiteFooter from "@/components/SiteFooter";
import { GAMES, NOT_FOUND_FLAG, sectionHref } from "@/lib/game";

export default function NotFound() {
  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: `window.${NOT_FOUND_FLAG}=true;` }} />
      <Container>
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold tracking-wide text-accent uppercase">404</span>
            <h1 className="font-display text-3xl font-bold text-fg">이 주소에는 화면이 없습니다</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-2">
              패치가 넘어가면 직전 쌍의 상세는 그 쌍의 과거 패치 주소로 옮겨 갑니다. 아래 브리핑에서 다시 찾아 주세요.
            </p>
          </div>
          {/* `<Link>`가 아니라 **전체 로드**(`<a>`)다 — 클라이언트 내비게이션이면 위에서 세운 404 표식이 window에 남아 다음 화면도
              "게임 없음"으로 읽는다(Phase 3 acceptance-critic 지적). 문서를 새로 열면 표식은 사라진다. */}
          <nav aria-label="돌아가기" className="flex flex-wrap gap-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 전체 로드가 의도다(위 주석): 404 표식을 지우려면 문서를 새로 열어야 한다 */}
            <a href="/" className="rounded-pill border border-border-soft px-4 py-2 text-sm font-bold text-fg hover:border-accent hover:text-accent">
              홈 →
            </a>
            {GAMES.map((game) => (
              <a
                key={game.id}
                href={sectionHref(game.id, "")}
                className="rounded-pill border border-border-soft px-4 py-2 text-sm font-bold text-fg hover:border-accent hover:text-accent"
              >
                {game.label} 브리핑 →
              </a>
            ))}
          </nav>
        </div>
        <SiteFooter game={null} contained={false} />
      </Container>
    </main>
  );
}
