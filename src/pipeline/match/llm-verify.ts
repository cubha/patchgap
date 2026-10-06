// src/pipeline/match/llm-verify.ts
// LLM 원인·요약 인용의 **후보셋 검증**(2026-10-06 `llm-match.ts` 분할). 검증을 통과하지 못한 문장은 회색으로만
// 렌더된다(무근거 회색 원칙) — 근거를 지어내 채우지 않는다.
import type { DeltaRecord, LlmCause, PatchNoteItem } from "../types";
import type { GameLlmProfile, LlmDelta } from "./llm-profile";
import type { LlmOutput } from "./llm-schema";
import { splitCombinedEntity } from "./entity-match";
import { arrowClaimsGrounded, noteNumbersOf, unsignedPercentChangeClaimsGrounded } from "./cause-factuality";

/** 노트 대상의 이름들 — 합친 이름(「세계 지도집과 룬 나침반」)은 조각까지. 2자 미만은 버린다(「룬」 같은 범주어). */
function entityNames(entity: string): string[] {
  return [entity, ...splitCombinedEntity(entity)].filter((name) => name.length >= 2);
}

/**
 * 인용 노트를 "말했다"고 볼 이름 — 대상 전체 이름 + 어절(「순간이동 재사용 대기시간」의 「순간이동」) +
 * 수치 이름의 앞 세 어절(TFT 18.3: 개화 노트의 「주술 마나가 풍부한 토양 …」을 문장이 그대로 말한다).
 * 세 어절 미만의 수치 이름은 보지 않는다 — 「스킬 피해량」·「체력」 같은 일반어를 인정하면 다른 노트를
 * 말한 문장이 통과한다(실측: 베이가 문장이 알리스타 「스킬 피해량」 노트를 인용한 행이 새어 나갔다).
 */
export function citedMentionNames(note: PatchNoteItem): string[] {
  const names = entityNames(note.entity);
  const words = names.flatMap((name) => name.split(/\s+/u)).filter((word) => word.length >= 2);
  const statWords = (note.stat ?? "").trim().split(/\s+/u);
  const statHead = statWords.length >= 3 ? statWords.slice(0, 3).join(" ") : "";
  return [...new Set([...names, ...words, ...(statHead ? [statHead] : [])])];
}

/**
 * 원인 문장이 **인용 노트와 다른 대상을 말하는가**(2026-09-27).
 *
 * 참이 되는 조건: 문장이 인용 노트 대상의 이름(또는 그 어절)을 하나도 말하지 않으면서, 다른 후보 노트
 * 대상의 이름을 말한다. 다음은 "다른 대상"으로 세지 않는다 — 델타 **자신의** 이름(「기원자 빌드가
 * 약화됐습니다」는 자연스러운 문장이다), 인용 대상 이름과 부분 문자열 관계인 이름, 인용 노트의 수치 이름에
 * 든 이름. 어느 대상도 이름으로
 * 말하지 않는 문장("서포터 아이템 체력 재생…")은 판단하지 않는다(거짓) — 이 게이트는 보수적이다.
 *
 * 왜 필요한가: 재요청 병합이 위치로 짝지어 26.19 LoL 3행·TFT 18.3 4행의 문장이 다른 노트의 인용을
 * 달고 verified로 나갔고, 그 결과가 캐시에 되쓰여 재생성으로도 고쳐지지 않았다.
 */
export function namesOtherEntityThanCited(
  text: string,
  cited: PatchNoteItem,
  candidates: readonly PatchNoteItem[],
  ownName: string | null = null
): boolean {
  if (citedMentionNames(cited).some((name) => text.includes(name))) return false;
  const citedNames = entityNames(cited.entity);
  // 인용 노트의 수치 이름 안에 든 이름도 "다른 대상"이 아니다 — TFT 18.2 「경쟁을 넘어서」의 수치가
  // 「카직스가 렝가에게 부여하는 마나」라, 카직스·렝가를 말한 문장은 그 노트를 말한 것이다.
  const citedStat = cited.stat ?? "";
  const excluded = (name: string) =>
    name === ownName || citedStat.includes(name) || citedNames.some((c) => c.includes(name) || name.includes(c));
  return candidates.some(
    (note) => note.id !== cited.id && entityNames(note.entity).some((name) => !excluded(name) && text.includes(name))
  );
}

/**
 * 요약 ↔ 인용 대상 게이트(2026-09-28, C4). 요약은 여러 노트를 한 문장에 엮으므로 **인용 전부가** 문장이
 * 말하지 않는 다른 대상일 때만 참이다(원인 게이트 `namesOtherEntityThanCited`를 인용마다 적용). 인용이
 * 없으면 델타 수치만의 요약이라 거짓. 없는 id는 `verifySummaryCites`가 이미 거르므로 여기선 건너뛴다.
 */
export function summaryCitesAllMismatched(
  summary: string,
  cites: readonly string[],
  candidates: readonly PatchNoteItem[],
  ownName: string | null
): boolean {
  const byId = new Map(candidates.map((note) => [note.id, note] as const));
  const cited = cites.map((id) => byId.get(id)).filter((note): note is PatchNoteItem => note !== undefined);
  if (cited.length === 0) return false;
  return cited.every((note) => namesOtherEntityThanCited(summary, note, candidates, ownName));
}

/** 델타 자신의 표시 이름 — LoL·TFT `entityName`, PUBG `weaponName`. 엔진은 `LlmDelta`만 알므로 좁혀 읽는다. */
export function ownNameOf(delta: LlmDelta): string | null {
  if ("entityName" in delta && typeof delta.entityName === "string") return delta.entityName;
  if ("weaponName" in delta && typeof delta.weaponName === "string") return delta.weaponName;
  return null;
}

/**
 * LLM이 반환한 causes를 후보셋 검증한다 — 존재하지 않는 id·자기 엔티티 참조는 candidateNoteId를
 * null로, verified를 false로 폐기(text/confidence는 회색 표기용으로 보존).
 */
export function verifyCauses<TDelta extends LlmDelta = DeltaRecord>(
  rawCauses: LlmOutput["causes"],
  candidates: readonly PatchNoteItem[],
  delta: TDelta,
  profile: GameLlmProfile<TDelta>
): LlmCause[] {
  const candidateIds = new Set(candidates.map((note) => note.id));
  const notesById = new Map(candidates.map((note) => [note.id, note] as const));

  return rawCauses.map((cause): LlmCause => {
    if (cause.candidateNoteId === null) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    if (!candidateIds.has(cause.candidateNoteId)) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    const note = notesById.get(cause.candidateNoteId);
    // 2026-09-19: 다른 게임 모드(LoL 클래식·아수라장·아레나)의 노트는 SR 관측의 원인이 될 수 없다.
    // 실측으로 26.16→26.17 쌍의 verified 원인 453건 중 282건이 모드 노트를 인용하고 있었다
    // ("클래식 피오라의 공격 속도 계수 상향으로 탑 결투 구도가…" — 라이브 협곡에 없던 변경).
    // 후보 풀 자체를 거르면 candidateSetHash가 바뀌어 LLM 캐시가 전량 무효가 되므로, 교정은
    // **검증 지점**에서 한다(BRAINTRUST-root-fix-2026-09-19.md §4).
    if (note && !profile.isCitable(note)) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    if (note && profile.isSameEntity(note, delta)) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    // 문장과 인용은 한 쌍이다 — 문장이 다른 대상을 말하면 인용 링크가 거짓 근거가 된다.
    if (note && namesOtherEntityThanCited(cause.text, note, candidates, ownNameOf(delta))) {
      return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
    }
    // 사실성(2026-09-28, C3) — 문장이 숫자로 단정한 「A→B」가 인용 노트(또는 같은 대상의 형제 노트)·델타
    // 자신의 수치와 맞나. 게임 고유 검사(PUBG 부호 백분율·전체 감소 귀속)는 프로필이 든다.
    if (note) {
      const siblings = candidates.filter((other) => other.entity === note.entity);
      const own = profile.ownNumbersOf?.(delta) ?? [];
      if (
        !arrowClaimsGrounded(cause.text, siblings, own) ||
        // 부호 없는 「X% 줄어」(R14) — 형제 노트가 말한 수치나 델타·맥락 수치여야 한다(세 게임 공통).
        !unsignedPercentChangeClaimsGrounded(cause.text, [], [...siblings.flatMap(noteNumbersOf), ...own]) ||
        (profile.isCauseGrounded !== undefined && !profile.isCauseGrounded(cause.text, note, delta))
      ) {
        return { text: cause.text, candidateNoteId: null, verified: false, confidence: cause.confidence };
      }
    }
    return {
      text: cause.text,
      candidateNoteId: cause.candidateNoteId,
      verified: true,
      confidence: cause.confidence,
    };
  });
}

/**
 * B4 후속 수정(S3 인용 강제) — `summaryCites`의 모든 id가 입력 후보셋에 실제로 존재하는지만
 * 확인한다(causes와 달리 자기참조 배제는 요구되지 않음 — summary는 델타 자신의 수치를 근거로
 * 쓰는 것이 정상이므로). 빈 배열은 "인용 없음"이라 항상 통과(true).
 */
export function verifySummaryCites<TDelta extends LlmDelta = DeltaRecord>(
  summaryCites: readonly string[],
  candidates: readonly PatchNoteItem[],
  profile: GameLlmProfile<TDelta>
): boolean {
  if (summaryCites.length === 0) return true;
  // 존재 + core. 모드 노트를 근거로 쓴 요약은 본문색으로 단언할 수 없다(위 verifyCauses와 같은 이유).
  const coreIds = new Set(candidates.filter((note) => profile.isCitable(note)).map((note) => note.id));
  return summaryCites.every((id) => coreIds.has(id));
}
