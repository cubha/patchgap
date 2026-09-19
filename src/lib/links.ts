// src/lib/links.ts
// 외부 링크 단일 소유(2026-09-20). 지금은 디스코드 초대 하나뿐이다.
//
// **왜 상수인가**: `output:'export'`라 런타임 설정이 없다. 빌드 타임에 값이 정해져야 하고,
// 디스코드 초대 링크는 비밀이 아니라 **공개하려고 만드는 주소**라 소스에 두는 것이 맞다
// (웹훅 URL과 혼동하지 말 것 — 그건 secret이고 절대 커밋하지 않는다).
//
// 환경변수를 먼저 보는 이유: 초대를 갱신해야 할 때(만료·재생성) Vercel 환경변수만 바꿔도
// 재배포로 반영된다. 미설정이면 아래 기본 상수를 쓴다.
//
// `null`이면 "아직 공개 방이 없다"는 뜻이고, 소비처(`DiscordPanel`)는 버튼 대신 방송 규칙
// 링크만 보여준다 — 없는 방으로 데려가는 죽은 링크를 만들지 않는다.

/**
 * 브리핑이 실제로 올라오는 공개 채널 초대(2026-09-20, 사용자 제공). 없으면 null.
 *
 * 서버 `patchgap` — 이 프로젝트 전용으로 만든 읽기 전용 방이고, 만료·사용 횟수 제한이 없다.
 * 방문자는 배치가 실제로 보낸 브리핑을 그대로 본다(로그인·연동 없이).
 */
const FALLBACK_INVITE: string | null = "https://discord.gg/rNE8DHNHPb";

function readInvite(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim();
  if (fromEnv) return fromEnv;
  return FALLBACK_INVITE;
}

export const DISCORD_INVITE_URL: string | null = readInvite();
