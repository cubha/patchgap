# PUBG 수집 원본 스크립트 — 재현 근거 보존 (2026-09-16)

`PLAN-pubg-gate-2026-09-16.md` §6(상속 제약)·§7(게이트 실증)·§8(반증된 축)의 **모든 수치를 만든
정확한 스크립트**다. acceptance-critic이 "수치를 만든 코드가 저장소에 없어 재현 불가"를
`UNKNOWN 4`로 지적했고, 그 지적을 받아 여기에 보존한다.

## 왜 `src/pipeline/`이 아니라 여기인가

- **제품 파이프라인 코드가 아니다.** 스택 고정값은 TypeScript 5 / Node 22이며(`CLAUDE.md` §기술 스택),
  이 Python 스크립트를 `src/`나 `scripts/`에 두면 스택 제약을 어기게 된다.
- **그럼에도 버릴 수 없다.** PUBG API 보존창은 336시간이고 42.3 구간(9/3~9/8)은 **2026-09-22경
  영구 소멸**한다. 이 스크립트가 받아낸 데이터는 이후 어떤 방법으로도 재생성되지 않는다 —
  수치의 출처를 세션 임시 디렉토리에만 두는 것은 "모든 판정문은 원천 링크를 가진다"는
  프로젝트 원칙과 충돌한다.
- **승격 계획**: PUBG 탭을 실제로 출하하기로 하면 `src/pipeline/collect/pubg/`에 TypeScript로
  재구현한다(`collect/*`만 외부 I/O를 한다는 디렉토리 규칙 준수). 그때 이 디렉토리는 삭제한다.

## 파일

| 파일 | 역할 | 산출물(gitignore 대상) |
|---|---|---|
| `harvest.py` | `/samples` 날짜별 매치 ID 수집 → `/matches/{id}` 전량 조회 → 부분 gzip 라벨 검증 | `data/raw/pubg/{sample-ids.json,matches/,patch-verify.json}` |
| `telemetry.py` | 텔레메트리 reduce-on-ingest (원본 ~30MB → 매치당 ~3KB) | `data/raw/pubg/telemetry-reduced/` |

`PUBG_API_KEY`는 `.env`에서 읽는다(gitignore). **키를 이 디렉토리의 어떤 파일에도 적지 않는다.**

## 실행 실적 (2026-09-16)

- `harvest.py`: 유니크 매치 ID 10,556건 → 매치 객체 **10,556건 전량 조회 성공(실패 0)**.
- `telemetry.py 700`: 7,217건 선택(날짜별 상한 700, 경계 9/9~9/10 제외).

## 알려진 함정 (재구현 시 반드시 이식할 것)

1. `MatchId`의 매치 종류 세그먼트를 **반드시 파싱**한다 — `official` 외에 `airoyale`·`competitive`·
   `tutorialatoz`·`trainingroom`이 섞여 오며 실측 표본의 **약 절반**이 비경쟁 매치였다.
   최초 구현이 `official\.`을 정규식에 하드코딩해 이들을 `patch: null`로 떨궜다.
2. `damageCauserName`은 무기 전용이 아니다 — 자기장(`TslGameModeBase_BattleRoyaleBP_C`)·
   플레이어 폰이 섞인다. `Weap*` 접두로 거른다.
3. 데미지 **배수** 변경은 피격 *횟수*로 잴 수 없다 — `damage` 필드 합이 필요하다.
   이 함정 때문에 1차 수집분을 폐기하고 전량 재수집했다.
4. 무기 식별자 네임스페이스가 2종이다 — 픽업·공격은 `Item_Weapon_RPD_C`,
   킬·피해는 `WeapRPD_C`. **정규화 이행 완료(2026-09-17)** —
   `src/pipeline/aggregate/pubg-weapon-key.ts`(`docs/plan/PLAN-pubg-normalization-
   2026-09-17.md`). ⚠️ 정규화는 명중률 축을 부활시키지 않는다 — §8이 이미 실측
   반증했다(너프당한 LMG가 대조군보다 덜 움직임, 방향 반대). `pubg-accuracy.ts`가
   §8 표를 코드로 재현하지만 **출하 축이 아니고**, 방법론 화면에 "버린 축"으로만 노출된다.
5. 이 스크립트에 남은 결함 1건 — `telemetry.py`의 `LogPlayerKillV2`에는 `Weap*` 접두 필터가
   없다(함정 2가 `LogPlayerTakeDamage`·`LogVehicleDamage`에만 적용됐다). 따라서
   `weaponKills`에는 자기장·폰 사망이 섞여 있을 수 있다. **고치지 않고 남긴다** — 이 파일은
   2026-09-16에 실제로 돌아간 코드의 기록이고, 여기를 고치면 수집된 데이터와 스크립트가
   어긋나 재현 기록으로서의 가치가 사라진다. `weaponKills`는 현재 아무도 소비하지 않으므로
   출하 숫자에는 영향이 없다. 재수집할 때 이식할 것.
6. **보안 결함 1건 — `harvest.py`가 API 키를 텔레메트리 CDN에도 보낸다**(2026-09-16 ship 전
   보안 검토에서 발견). `get()`(14~19행)이 모든 요청에 `H`(`Authorization: Bearer {KEY}`)를
   무조건 병합하는데, `label()`(76행)이 그 `get()`으로 호출하는 URL은 `api.pubg.com`이 아니라
   매치 응답에서 뽑은 **텔레메트리 자산 CDN 주소**다. 즉 키가 제3자 호스트의 서버·접근 로그로
   나간다. `telemetry.py:27`이 같은 종류의 자산을 `Authorization` 없이 받아오는 것이 반증이다 —
   **CDN은 애초에 인증을 요구하지 않는다.**
   **고치지 않고 남긴다**(함정 5와 같은 이유 — 이 파일은 실제로 돌아간 코드의 기록이다).
   `src/pipeline/collect/pubg/`로 승격하거나 재실행하기 전에 **반드시** 이식할 것:
   텔레메트리 자산 요청은 `H`를 병합하지 말고 `Accept-Encoding`·`Range`만 보낸다.
   **키 재발급 = 안 함(2026-09-17 사용자 확정)** — 위 결함은 재발급 여부와 무관하게
   재실행 전 이식이 필요하므로 이 결정으로 종결되지 않는다. 다만 재발급 자체는 하지
   않는 것으로 확정됐으므로 이 항목을 다시 열 필요는 없다.
