// src/components/home/CosmeticSkinPreview.tsx
// 치장 항목의 스킨 미리보기 — 사용자 지시(2026-09-18): "홀 오브 레전드 **가능한범위내에서**
// 이미지 등 간략정보제공 기능추가진행".
//
// **"가능한 범위"의 실체**: 스킨만이다. 크로마·아이콘·감정표현·와드·휘장·칭호·정수는 Data
// Dragon 배포 범위 밖이라 어떤 구현으로도 이미지가 나오지 않는다. 그 줄들은 **이미지 없이**
// 텍스트만 남는다 — 비슷한 이미지를 끌어다 채우면 "이게 그 크로마다"라고 이미지로 단언하는
// 셈이라 무근거 문장 금지 원칙과 같은 종류의 거짓이 된다.
//
// **캡션이 노트 문구가 아니라 매칭된 스킨명인 이유**: 크로마 줄("떠오른 전설 오리아나 이벤트
// 크로마")이 기본 전설 스킨을 매칭할 수 있는데, 그때 화면에 뜨는 그림은 **크로마가 아니라 그
// 스킨**이다. 캡션을 매칭된 이름으로 달면 이미지가 무엇인지에 대해 화면이 정확해진다.
//
// 순수 프레젠테이션(서버 컴포넌트). 자산 유무 판정은 빌드 타임에 page.tsx가 끝낸다 —
// 여기 오는 항목은 **파일이 존재함이 이미 확인된 것들**이다(깨진 <img> 불가).

export interface CosmeticSkinItem {
  /** ko_KR 스킨명 — 캡션이자 alt. */
  name: string;
  /** `/dd/splash/{championId}_{num}.jpg`. */
  src: string;
}

export interface CosmeticSkinPreviewProps {
  skins: CosmeticSkinItem[];
}

export default function CosmeticSkinPreview({ skins }: CosmeticSkinPreviewProps) {
  if (skins.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {skins.map((skin) => (
        <li key={skin.src} className="w-40">
          <div className="overflow-hidden rounded-sm border border-border-soft">
            {/* 스플래시 원본은 1215×717이라 카드 안에서는 가로 밴드로 잘라 쓴다.
                next/image를 쓰지 않는 이유는 output:'export'에서 최적화가 꺼져 있어서다
                (런타임 변환 서버가 없다) — 같은 이유로 PubgDetailSplash도 <img>를 쓴다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={skin.src}
              alt={`${skin.name} 스플래시`}
              loading="lazy"
              className="block h-16 w-full object-cover"
              style={{ objectPosition: "50% 22%" }}
            />
          </div>
          <span className="mt-1 block text-xs leading-snug text-fg-2">{skin.name}</span>
        </li>
      ))}
    </ul>
  );
}
