// src/app/tft/methodology/page.tsx
// TFT 방법론 — **한계를 먼저 적는다**. 이 프로젝트가 반복해서 지켜온 규칙이고,
// 특히 TFT는 수집 첫날이라 밝힐 것이 많다.
import Container from "@/components/Container";
import ExternalLink from "@/components/ExternalLink";
import MethodologyLayout, { type MethodologySlots } from "@/components/methodology/MethodologyLayout";
import { computeLlmCauseStats, dominantConfidence } from "@/components/methodology/llmStats";
import { TftUnavailable } from "@/components/tft/shared";
import { fmtKst } from "@/lib/format";
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

  const llmStats = computeLlmCauseStats(deltas.rows);
  const dominant = dominantConfidence(llmStats);

  const slots: MethodologySlots = {
    sample: (
      <dl className="px-5 pb-4">
        <dl className="px-5 pb-4">
          <Row label="표본">
            KR <span className="font-mono text-xs">tft-league-v1</span> 챌린저~마스터 래더에서 시드를 뽑아{" "}
            <span className="font-mono text-xs">tft-match-v1</span>로 매치를 받습니다. 랭크 큐(1100)만 씁니다 — 일반전이
            섞여 들어오는 것을 실측해 걸렀습니다. {deltas.meta.from} {before.matches.toLocaleString()}매치 ·{" "}
            {deltas.meta.to} {after.matches.toLocaleString()}매치.
          </Row>
          <Row label="분모">
            등장률의 분모는 매치가 아니라 <strong className="text-fg">보드(참가자)</strong>입니다. 한 판에 8명이 각자
            보드를 들고, 한 보드에 여러 유닛이 동시에 서므로 LoL 픽률 같은 제로섬 구조가 아닙니다. 같은 보드에 같은
            유닛이 두 칸 있어도 한 번만 셉니다.
          </Row>
          <Row label="특성">
            <span className="font-mono text-xs">style</span>이 0인 특성은 세지 않습니다 — 보드에 그 유닛이 있었다는
            것과 특성이 <strong className="text-fg">발동했다</strong>는 것은 다릅니다.
          </Row>
          <Row label="지표">
            등장률(비율) · 순방률(상위 4등, 8인 전투라 기저 50%) · 평균 등수(1~8,{" "}
            <strong className="text-fg">작을수록 개선</strong>). 평균 등수만 방향이 반대라 화살표·색·노트 짝짓기에서
            부호를 뒤집습니다.
          </Row>
          <Row label="PvE 제외">
            보드에 서는 몬스터·소환물 10종(센티넬·크러그·정찰개미 등)은 플레이어가 고른 유닛이 아니라 제외합니다.
            안 걸러내면 등장률 분모가 오염됩니다.
          </Row>
        </dl>
      </dl>
    ),
    pipeline: (
      <>
        <ol className="flex flex-col divide-y divide-border-soft">
          {[
            {
              step: 1,
              title: "수집",
              detail: "tft-league-v1 챌린저~마스터 래더에서 시드 → tft-match-v1",
              meta: "랭크 큐(1100)만",
            },
            {
              step: 2,
              title: "집계",
              detail: `보드 단위로 유닛·특성·아이템 등장을 셉니다 — ${deltas.meta.from} ${before.boards.toLocaleString()}보드 · ${deltas.meta.to} ${after.boards.toLocaleString()}보드`,
              meta: "PvE 10종 제외",
            },
            {
              step: 3,
              title: "패치노트",
              detail: `공식 패치노트를 파싱해 변경 줄 ${notes.stats.lines}건 중 ${notes.items.length}건에서 대상을 특정`,
              meta: "CDragon 카탈로그 보강",
            },
            {
              step: 4,
              title: "판정",
              detail: "노트 짝짓기 → 유의성·효과크기 게이트 → 상태 부여",
              meta: "src/pipeline/shared/ 공용",
            },
            {
              step: 5,
              title: "원인 추정",
              detail: "미공지·이상 관측에 한해 LLM이 다른 조항의 파급을 추정하고, 인용을 기계가 검증",
              meta: "캐시 우선 · 상한 준수",
            },
          ].map((s) => (
            <li key={s.step} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
              <span className="font-mono text-xs font-bold text-accent">{s.step}</span>
              <span className="font-display font-bold text-fg">{s.title}</span>
              <span className="text-sm text-fg-2">{s.detail}</span>
              <span className="ml-auto font-mono text-xs text-muted">{s.meta}</span>
            </li>
          ))}
        </ol>
        <p className="px-5 pt-1 pb-5 text-xs leading-relaxed text-muted">
          판정 시점은 {fmtKst(deltas.meta.generatedAt)}입니다. 수집·집계·판정은 전부 배포 이전에
          끝나고, 이 화면은 그 산출물만 읽습니다 — 브라우저에서 외부 API를 부르지 않습니다.
        </p>
      </>
    ),
    gate: (
      <dl className="px-5 pb-4">
        <Row label="유의성">
                        비율은 Newcombe 신뢰구간 + 두 비율 z검정, 평균은 정규근사. 다중비교는 Benjamini-Hochberg FDR(q&lt;0.10)로
                        전체 델타에 <strong className="text-fg">한 번</strong> 겁니다 — 버킷별로 따로 걸면 보정이 약해집니다.
                      </Row>
                      <Row label="효과크기 바닥">
                        유의하기만 하면 미공지로 올리지 않습니다. 순방률은 절대 2%p(승률과 같은 값 — 둘 다 기저 50% 이항),
                        등장률은 상대 25% + 저기저 차단, 평균 등수는 절대 0.15등입니다. 바닥 미달은{" "}
                        <span className="font-mono text-xs">below-threshold</span>로 따로 셉니다.
                      </Row>
        <Row label="표본">
          등장 보드 200 미만인 대상은 순방률·평균 등수 행 자체를 만들지 않습니다. 좁은 신뢰구간을
          지어내 유의한 것처럼 보이게 하지 않기 위해서입니다 — 등장률은 그대로 남습니다.
        </Row>
      </dl>
    ),
    verdict: (
      <dl className="px-5 pb-4">
        <Row label="정렬·표시">
                        잠수함 패치 → 미공지 → 간접효과 → 공지·불일치 → 공지·일치 → 바닥미달 → 표본부족 → 무변화. 이 순서와 보고 자격 판정은{" "}
                        <span className="font-mono text-xs">src/pipeline/shared/</span>의 단일 소스이고, 세 게임이 같은 파일을
                        봅니다. TFT 전용 술어는 하나도 만들지 않았습니다.
                      </Row>
                      <Row label="근거">
                        짝지어진 노트가 있으면 그 원문 앵커를 링크로 겁니다. 없으면 회색이고 링크를 걸지 않습니다. 원천 매치 ID
                        표본은 아직 붙이지 않았습니다 — 보드 단위 샘플링 규칙을 정하지 않아서이고, 그래서 비어 있습니다.
                      </Row>
      </dl>
    ),
    display: (
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 text-sm md:grid-cols-2">
        <div>
          <dt className="font-display font-bold text-fg">브리핑 — 패치 내용 탭</dt>
          <dd className="mt-1 leading-relaxed text-fg-2">
            행은 <strong className="text-fg">대상 1개</strong>이고, 한 대상의 여러 변경은 그 행을 펼쳐
            안에 듭니다. 판정 뱃지는 행 맨 앞에 있고, 이름을 누르면 그 대상의 상세로 갑니다.
          </dd>
        </div>
        <div>
          <dt className="font-display font-bold text-fg">브리핑 — 미공지 Gap 탭</dt>
          <dd className="mt-1 leading-relaxed text-fg-2">
            패치노트에 없는 유의 변화와 수치 축의 잠수함 패치가 함께 듭니다. 원인 문장은 인용이
            실재하고 신뢰도가 보통 이상일 때만 본문색이고, 나머지는 회색입니다.
          </dd>
        </div>
        <div>
          <dt className="font-display font-bold text-fg">대조표</dt>
          <dd className="mt-1 leading-relaxed text-fg-2">
            행은 대상 1개, 열은 지표(등장률·순방률·평균 등수)입니다. 보고 자격을 얻지 못한 지표는
            빈 칸(<span className="font-mono">—</span>)이고, 그 건수는 표 아래에서 밝힙니다. 왼쪽
            패치노트 항목을 고르면 오른쪽 그 행으로 이동합니다.
          </dd>
        </div>
        <div>
          <dt className="font-display font-bold text-fg">상세</dt>
          <dd className="mt-1 leading-relaxed text-fg-2">
            패치노트 대조와 추정 원인이 위, 지표별 관측값이 아래입니다. 짝지어진 노트가 없으면 근거
            링크를 걸지 않고 회색으로 둡니다.
          </dd>
        </div>
      </dl>
    ),
    cause: (
      <div className="flex flex-col gap-4 p-5 text-sm leading-relaxed text-fg-2">
        <p>
          패치노트와 짝지어지지 않았거나 노트와 방향이 어긋난 관측에 한해, 언어 모델이{" "}
          <strong className="text-fg">다른 항목의 파급 효과</strong>를 추정합니다. 그 대상 자신의
          노트(직접 변경)는 앞 단계인 결정론 매칭이 이미 처리하므로 후보에서 빠집니다 — 모델이
          찾는 것은 처음부터 간접 원인뿐입니다.
        </p>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          <div>
            <dt className="font-display font-bold text-fg">무엇을 보여주나</dt>
            <dd className="mt-1">
              그 패치 노트 전체를 항목 id · 대상 · 지표 · 변경 전/후 값 · 방향만 남긴 목록으로 줍니다.
              본문 산문이 아니라 구조화된 목록이라, 모델이 인용할 수 있는 것은 실재하는 항목뿐입니다.
            </dd>
          </div>
          <div>
            <dt className="font-display font-bold text-fg">기각 규칙(기계가 검사)</dt>
            <dd className="mt-1">
              인용한 id가 목록에 없으면 기각합니다. 그 관측의 대상 자신을 가리켜도 기각합니다.
              기각된 문장은 링크 없이 회색으로만 남습니다.
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="font-display font-bold text-fg">이 패치의 실측</dt>
            <dd className="mt-1">
              대상 {llmStats.attempted}건 중 원인을 못 찾은 것이 {llmStats.withoutCause}건, 후보를
              냈으나 검증에서 전부 기각된 것이 {llmStats.withUnverifiedCauseOnly}건, 검증을 통과한
              원인을 가진 것이 {llmStats.withVerifiedCause}건입니다. 검증 통과 문장{" "}
              {llmStats.confidence.low + llmStats.confidence.medium + llmStats.confidence.high}건의
              신뢰도는 낮음 {llmStats.confidence.low} · 보통 {llmStats.confidence.medium} · 높음{" "}
              {llmStats.confidence.high}건이고, 가장 많은 등급은{" "}
              <strong className="text-fg">{dominant?.label ?? "없음"}</strong>입니다 — 그 분포 자체가
              이 추정의 한계를 말합니다.
            </dd>
          </div>
        </dl>
        <p className="text-muted">
          본문색으로 단언하는 것은 인용이 실재하고 신뢰도가 보통 이상인 문장뿐입니다. 회색 문장은
          &ldquo;근거가 약하다&rdquo;는 표시이지 판정이 아닙니다.
        </p>
      </div>
    ),
    gamedata: (
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
        <p>
          짝이 있어도 끝이 아닙니다. 패치노트가 <strong className="text-fg">같은 항목을 말했는데 적힌
          값이 실제와 다른</strong> 경우가 있어서, 그것만 따로 「공지값 불일치」로 부릅니다. 말하지 않은
          것도, 말한 대로 한 것도 아니라 둘 중 어느 쪽에 넣어도 거짓말이 됩니다. 값을 견줄 수 있을 때만
          견줍니다 — 레벨별 배열(<span className="font-mono">20/30/48</span>)이나 합성 표현
          (<span className="font-mono">15 + 주문력 30%</span>)은 어느 쪽을 대표로 삼을지 정할 근거가
          없으므로 견주지 않습니다.
        </p>
        <p className="text-muted">
          증거가 다르므로 위계도 다릅니다. 잠수함 패치는 미공지·간접 영향보다 위에 옵니다. 스킬 변수는
          자리의 의미가 공개되지 않아, 그 유닛을 언급한 패치노트가 하나라도 있으면 공지로 봅니다 —
          근거 없이 잠수함이라 부르지 않기 위해 덜 찾는 쪽을 고른 것입니다.
        </p>
      </div>
    ),
    notify: (
      <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-fg-2">
        <p>
          브리핑은 <strong className="text-fg">배치가 보냅니다</strong>. 이 사이트는 정적 페이지라
          브라우저에서 아무것도 전송하지 않습니다 — 수집·집계·판정이 끝난 뒤 CI가 한 번 보냅니다.
        </p>
        <p>
          보내는 것은 <strong className="text-fg">미공지 상위 항목과 이상 관측</strong>이고,
          공지대로 움직인 관측은 보내지 않습니다 — 패치노트를 읽으면 아는 내용이기 때문입니다.
          표본 부족·바닥 미달·변화 없음으로 판정된 관측은 화면과 마찬가지로 방송에서도 빠집니다.
        </p>
        <p>
          채널은 <strong className="text-fg">게임마다 따로</strong>입니다(전략적 팀 전투 전용 웹훅) —
          한 방에 세 게임이 섞이면 어느 게임의 패치인지 매번 다시 읽어야 합니다.
        </p>
      </div>
    ),
    limits: (
      <>
        <dl className="px-5 pb-4">
        <dl className="px-5 pb-4">
          <Row label="증강 미수집">
            TFT 응답에 증강(augment) 필드가 <strong className="text-fg">존재하지 않습니다</strong>. 실측으로 참가자
            400명 전원에게 그 필드가 없었습니다. 그래서 증강 등장률은 만들지 않습니다 — 다른 값으로 대신하지 않습니다.
          </Row>
          <Row label="패치 구분">
            응답의 <span className="font-mono text-xs">game_version</span>이{" "}
            <span className="font-mono text-xs">&quot;TFT Unreal Version ?.?.?.?&quot;</span>로 비어 있습니다. 그래서
            패치는 <strong className="text-fg">공식 패치노트 발행 시각</strong>을 경계로 가릅니다(18.1 = 8/25 18:00Z,
            18.2 = 9/9 18:00Z). 버전 문자열은 교차 확인용으로만 기록합니다.
          </Row>
          <Row label="패치노트 해소율">
            파서가 변경 줄 {notes.stats.lines}건 중 {notes.items.length}건({resolveRate.toFixed(1)}%)에서 엔티티를
            특정했습니다. 나머지 {notes.stats.unresolved}건은 엔티티가 없는 체계 변경(레벨 요구 경험치 등)이거나 DDragon
            카탈로그에 없는 소환수(덩굴정령·어미 부리)입니다. 짝지을 수 없는 이름을 지어내 채우지 않습니다.
          </Row>
          <Row label="계획 대비 확장">
            평균 등수(<span className="font-mono text-xs">avgPlacement</span>)는 원래 계획에서{" "}
            <strong className="text-fg">2차로 미룬 지표</strong>였습니다. 1차 범위에 넣은 것은 구현 판단이고{" "}
            <strong className="text-fg">사용자 승인을 받지 않았습니다</strong>. 넣은 이유는 순방률이 4등/5등 경계
            하나만 보기 때문입니다 — 「8등이 늘고 3등도 늘어 순방률은 그대로인데 분산이 커진」 변화를 놓칩니다
            (실측 교차검증에서 두 지표의 방향이 86.8%만 일치했고, 그 13%가 그런 경우입니다). 되돌리려면 지표
            목록에서 빼면 되고 다른 곳에 파급이 없습니다. 근거·되돌리는 법은{" "}
            <span className="font-mono text-xs">docs/plan/PLAN-tft-adapter-2026-09-20.md §8-2</span>.
          </Row>
          <Row label="방향이 섞인 노트">
            한 엔티티에 상향·하향 노트가 <strong className="text-fg">같은 수</strong>로 붙으면 방향 다수결이 서지
            않습니다. 판정 엔진은 그 경우를 「공지 · 이상 관측」으로 분류하는데, 정확히는 「판정할 수 없음」입니다 —
            18.2에서 4종(르블랑·마오카이·레오나·케일)이 여기 해당합니다. 마오카이는 대규모 변경에서 마나를 내렸다가
            추가 패치 노트에서 되돌린 경우로, 노트를 시간순으로 이어 붙이면 순변화를 낼 수 있습니다. 그 체이닝은 아직
            구현하지 않았고, 대신 이 문단으로 밝힙니다.
          </Row>
          <Row label="표본부족 표기">
            등장 보드 200 미만인 엔티티는 순방률·평균 등수 행을 <strong className="text-fg">만들지 않습니다</strong>.
            LoL은 같은 상황을 <span className="font-mono text-xs">insufficient-sample</span> 배지로 표시하는데, TFT는
            판정 엔진의 표본 게이트가 승률 지표 전용이라 그 경로를 타지 못합니다. 결과적으로 양쪽 다 표에서 빠지지만
            배지 문구가 다릅니다 — 이 어긋남은 알고 남겨 둔 것입니다.
          </Row>
        </dl>
        </dl>
        <p className="px-5 pb-5 text-xs leading-relaxed text-muted">
          패치노트 원문:{" "}
          <ExternalLink href={notes.sourceUrl} className="text-accent hover:underline">
            {deltas.meta.to} 패치 노트 ↗
          </ExternalLink>
        </p>
      </>
    ),
  };

  return (
    <MethodologyLayout
      game="tft"
      title="전략적 팀 전투 — 어떻게 판정하나"
      lead={
        <>
          판정 엔진은 LoL·배틀그라운드와 <strong className="text-fg">같은 것</strong>입니다. 갈리는
          것은 무엇을 관측하느냐뿐입니다.
        </>
      }
      slots={slots}
      generatedAt={deltas.meta.generatedAt}
      nVerdicts={deltas.rows.length}
    />
  );
}
