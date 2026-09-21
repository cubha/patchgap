// src/app/tft/methodology/page.tsx
// TFT 방법론 — **한계를 먼저 적는다**. 이 프로젝트가 반복해서 지켜온 규칙이고,
// 특히 TFT는 수집 첫날이라 밝힐 것이 많다.
import Container from "@/components/Container";
import ExternalLink from "@/components/ExternalLink";
import SectionCard from "@/components/SectionCard";
import { TftFooter, TftUnavailable } from "@/components/tft/shared";
import { loadTft } from "@/lib/tftData";

export const metadata = { title: "TFT 방법론 — patchgap" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border-soft py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="font-body text-xs font-bold text-muted">{label}</dt>
      <dd className="text-sm leading-relaxed text-fg-2">{children}</dd>
    </div>
  );
}

export default function TftMethodologyPage() {
  const bundle = loadTft();
  if (!bundle) {
    return (
      <main>
        <Container>
          <TftUnavailable />
        </Container>
      </main>
    );
  }
  const { deltas, before, after, notes } = bundle;
  const resolveRate = notes.stats.lines === 0 ? 0 : (notes.items.length / notes.stats.lines) * 100;

  return (
    <main>
      <Container>
        <div className="flex flex-col gap-6 pt-40 pb-8">
          <header className="flex flex-col gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
              전략적 팀 전투 — 어떻게 판정하나
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-fg-2">
              판정 엔진은 LoL·배틀그라운드와 <strong className="text-fg">같은 것</strong>이다. 갈리는 것은 무엇을
              관측하느냐뿐이다.
            </p>
          </header>

          <SectionCard eyebrow="한계" title="먼저 밝히는 것" variant="glass">
            <dl className="px-5 pb-4">
              <Row label="증강 미수집">
                TFT 응답에 증강(augment) 필드가 <strong className="text-fg">존재하지 않는다</strong>. 실측으로 참가자
                400명 전원에게 그 필드가 없었다. 그래서 증강 등장률은 만들지 않는다 — 다른 값으로 대신하지 않는다.
              </Row>
              <Row label="패치 구분">
                응답의 <span className="font-mono text-xs">game_version</span>이{" "}
                <span className="font-mono text-xs">&quot;TFT Unreal Version ?.?.?.?&quot;</span>로 비어 있다. 그래서
                패치는 <strong className="text-fg">공식 패치노트 발행 시각</strong>을 경계로 가른다(18.1 = 8/25 18:00Z,
                18.2 = 9/9 18:00Z). 버전 문자열은 교차 확인용으로만 기록한다.
              </Row>
              <Row label="패치노트 해소율">
                파서가 변경 줄 {notes.stats.lines}건 중 {notes.items.length}건({resolveRate.toFixed(1)}%)에서 엔티티를
                특정했다. 나머지 {notes.stats.unresolved}건은 엔티티가 없는 체계 변경(레벨 요구 경험치 등)이거나 DDragon
                카탈로그에 없는 소환수(덩굴정령·어미 부리)다. 짝지을 수 없는 이름을 지어내 채우지 않는다.
              </Row>
              <Row label="계획 대비 확장">
                평균 등수(<span className="font-mono text-xs">avgPlacement</span>)는 원래 계획에서{" "}
                <strong className="text-fg">2차로 미룬 지표</strong>였다. 1차 범위에 넣은 것은 구현 판단이고{" "}
                <strong className="text-fg">사용자 승인을 받지 않았다</strong>. 넣은 이유는 순방률이 4등/5등 경계
                하나만 보기 때문이다 — 「8등이 늘고 3등도 늘어 순방률은 그대로인데 분산이 커진」 변화를 놓친다
                (실측 교차검증에서 두 지표의 방향이 86.8%만 일치했고, 그 13%가 그런 경우다). 되돌리려면 지표
                목록에서 빼면 되고 다른 곳에 파급이 없다. 근거·되돌리는 법은{" "}
                <span className="font-mono text-xs">docs/plan/PLAN-tft-adapter-2026-09-20.md §8-2</span>.
              </Row>
              <Row label="방향이 섞인 노트">
                한 엔티티에 상향·하향 노트가 <strong className="text-fg">같은 수</strong>로 붙으면 방향 다수결이 서지
                않는다. 판정 엔진은 그 경우를 「공지 · 이상 관측」으로 분류하는데, 정확히는 「판정할 수 없음」이다 —
                18.2에서 4종(르블랑·마오카이·레오나·케일)이 여기 해당한다. 마오카이는 대규모 변경에서 마나를 내렸다가
                추가 패치 노트에서 되돌린 경우로, 노트를 시간순으로 이어 붙이면 순변화를 낼 수 있다. 그 체이닝은 아직
                구현하지 않았고, 대신 이 문단으로 밝힌다.
              </Row>
              <Row label="표본부족 표기">
                등장 보드 200 미만인 엔티티는 순방률·평균 등수 행을 <strong className="text-fg">만들지 않는다</strong>.
                LoL은 같은 상황을 <span className="font-mono text-xs">insufficient-sample</span> 배지로 표시하는데, TFT는
                판정 엔진의 표본 게이트가 승률 지표 전용이라 그 경로를 타지 못한다. 결과적으로 양쪽 다 표에서 빠지지만
                배지 문구가 다르다 — 이 어긋남은 알고 남겨 둔 것이다.
              </Row>
            </dl>
          </SectionCard>

          <SectionCard eyebrow="관측" title="무엇을 세는가" variant="glass">
            <dl className="px-5 pb-4">
              <Row label="표본">
                KR <span className="font-mono text-xs">tft-league-v1</span> 챌린저~마스터 래더에서 시드를 뽑아{" "}
                <span className="font-mono text-xs">tft-match-v1</span>로 매치를 받는다. 랭크 큐(1100)만 쓴다 — 일반전이
                섞여 들어오는 것을 실측해 걸렀다. {deltas.meta.from} {before.matches.toLocaleString()}매치 ·{" "}
                {deltas.meta.to} {after.matches.toLocaleString()}매치.
              </Row>
              <Row label="분모">
                등장률의 분모는 매치가 아니라 <strong className="text-fg">보드(참가자)</strong>다. 한 판에 8명이 각자
                보드를 들고, 한 보드에 여러 유닛이 동시에 서므로 LoL 픽률 같은 제로섬 구조가 아니다. 같은 보드에 같은
                유닛이 두 칸 있어도 한 번만 센다.
              </Row>
              <Row label="특성">
                <span className="font-mono text-xs">style</span>이 0인 특성은 세지 않는다 — 보드에 그 유닛이 있었다는
                것과 특성이 <strong className="text-fg">발동했다</strong>는 것은 다르다.
              </Row>
              <Row label="지표">
                등장률(비율) · 순방률(상위 4등, 8인 전투라 기저 50%) · 평균 등수(1~8,{" "}
                <strong className="text-fg">작을수록 개선</strong>). 평균 등수만 방향이 반대라 화살표·색·노트 짝짓기에서
                부호를 뒤집는다.
              </Row>
              <Row label="PvE 제외">
                보드에 서는 몬스터·소환물 10종(센티넬·크러그·정찰개미 등)은 플레이어가 고른 유닛이 아니라 제외한다.
                안 걸러내면 등장률 분모가 오염된다.
              </Row>
            </dl>
          </SectionCard>

          {/* 수치 축(2026-09-21, F9) — LoL·PUBG 방법론의 같은 카드. 판정 기준은 세 게임이 같고(게이트와
              무관하게 전량 노출 · 배지 1종), 소스만 다르다 — TFT는 Community Dragon 수치 추출본.
              자리는 "관측" 뒤·"판정" 앞 — LoL·PUBG처럼 이 카드로 페이지를 닫지 않는다(verify-impl B3-1). */}
          <SectionCard eyebrow="수치 축" title="잠수함 패치는 어떻게 찾나" variant="glass">
            <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-fg-2">
              <p>
                &ldquo;미공지&rdquo;는 두 종류입니다. <strong className="text-fg">지표 축</strong>은 순방률·등장률·
                평균 등수가 움직였는데 짝지을 패치노트가 없는 경우로, 통계가 근거입니다.{" "}
                <strong className="text-fg">수치 축</strong>은 유닛 체력·스킬 피해·아이템 능력치 같은 원본 값이
                실제로 바뀌었는데 패치노트에 없는 경우이고, 통칭 잠수함 패치입니다.
              </p>
              <p>
                수치 축은 추론하지 않습니다. 게임 클라이언트의 수치 데이터(Community Dragon 추출본)를 패치 간
                그대로 대조하고, 바뀐 값마다 그것을 말한 패치노트 항목이 있는지 찾습니다. 짝이 없으면
                잠수함입니다. <strong className="text-fg">지표가 하나도 안 움직여도 발견입니다</strong> —
                그래서 표본 부족·바닥 미달 게이트와 무관하게 전부 보여 주고, 배지도 따로 둡니다.
              </p>
              <p className="text-muted">
                증거가 다르므로 위계도 다릅니다. 잠수함 패치는 미공지·간접 영향보다 위에 옵니다. 스킬 변수는
                자리의 의미가 공개되지 않아, 그 유닛을 언급한 패치노트가 하나라도 있으면 공지로 봅니다 —
                근거 없이 잠수함이라 부르지 않기 위해 덜 찾는 쪽을 고른 것입니다.
              </p>
            </div>
          </SectionCard>

          <SectionCard eyebrow="판정" title="게임 무관 — 엔진은 하나다" variant="glass">
            <dl className="px-5 pb-4">
              <Row label="유의성">
                비율은 Newcombe 신뢰구간 + 두 비율 z검정, 평균은 정규근사. 다중비교는 Benjamini-Hochberg FDR(q&lt;0.10)로
                전체 델타에 <strong className="text-fg">한 번</strong> 건다 — 버킷별로 따로 걸면 보정이 약해진다.
              </Row>
              <Row label="효과크기 바닥">
                유의하기만 하면 미공지로 올리지 않는다. 순방률은 절대 2%p(승률과 같은 값 — 둘 다 기저 50% 이항),
                등장률은 상대 25% + 저기저 차단, 평균 등수는 절대 0.15등이다. 바닥 미달은{" "}
                <span className="font-mono text-xs">below-threshold</span>로 따로 센다.
              </Row>
              <Row label="정렬·표시">
                잠수함 패치 → 미공지 → 간접효과 → 공지·불일치 → 공지·일치 → 바닥미달 → 표본부족 → 무변화. 이 순서와 보고 자격 판정은{" "}
                <span className="font-mono text-xs">src/pipeline/shared/</span>의 단일 소스이고, 세 게임이 같은 파일을
                본다. TFT 전용 술어는 하나도 만들지 않았다.
              </Row>
              <Row label="근거">
                짝지어진 노트가 있으면 그 원문 앵커를 링크로 건다. 없으면 회색이고 링크를 걸지 않는다. 원천 매치 ID
                표본은 아직 붙이지 않았다 — 보드 단위 샘플링 규칙을 정하지 않아서이고, 그래서 비어 있다.
              </Row>
            </dl>
          </SectionCard>

          <p className="text-xs leading-relaxed text-muted">
            패치노트 원문:{" "}
            <ExternalLink href={notes.sourceUrl} className="text-accent hover:underline">
              {deltas.meta.to} 패치 노트 ↗
            </ExternalLink>
          </p>
        </div>
      </Container>
      <TftFooter generatedAt={deltas.meta.generatedAt} nVerdicts={deltas.rows.length} />
    </main>
  );
}
