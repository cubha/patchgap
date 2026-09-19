# docs/design/tools/build-splash-wall.py
# 랜딩 스플래시 월 합성 → public/bg/splash-wall.jpg
#
# 실행: python3 docs/design/tools/build-splash-wall.py   (Pillow 필요)
#
# 왜 scripts/가 아니라 여기인가: scripts/는 파이프라인 진입점(TypeScript)의 자리이고 tsconfig
# include 대상이다(CLAUDE.md 기술 스택 고정값). 이 파일은 파이프라인이 아니라 **디자인 자산을
# 한 번 굽는 도구**라, PUBG 수집 원본 스크립트를 docs/plan/provenance/에 둔 것과 같은 판단으로
# docs 아래에 둔다. 산출물(jpg)만 커밋되고 빌드는 이 스크립트에 의존하지 않는다.
#
# **원본을 커밋하지 않는다**: 우리가 판정하지 않는 게임의 키아트는 원격에서 받아
# `.wall-cache/`(gitignore)에 캐시하고 합성 결과만 커밋한다. 레포가 남의 아트를 재배포하지
# 않게 하려는 것이다. 캐시가 비어 있으면 스크립트가 다시 받는다.
#
# 이 월은 **분위기 배경**이지 커버리지 주장이 아니다 — 실제로 판정하는 게임은 랜딩의 패널
# 목록이 말하고, 나머지 자리는 `WHO'S NEXT?`가 비워 둔다.
import os
import urllib.request

from PIL import Image, ImageChops, ImageEnhance

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".wall-cache")
W, H = 1920, 900
BG = (3, 13, 24)

STEAM = "https://cdn.cloudflare.steamstatic.com/steam/apps/{}/library_hero.jpg"

# (소스, 폭 배수, 가로 크롭 위치 0~1)
# 소스: 레포 상대 경로 또는 ("캐시 파일명", URL).
TILES = [
    ("public/dd/splash/Yasuo_0.jpg", 1.00, 0.50),
    (("cs2.jpg", STEAM.format(730)), 1.15, 0.80),
    ("public/pubg/map/Erangel.png", 1.05, 0.50),
    (("dota2.jpg", STEAM.format(570)), 1.20, 0.56),
    ("public/dd/splash/Ahri_0.jpg", 1.00, 0.45),
    (("apex.jpg", STEAM.format(1172470)), 1.15, 0.72),
    ("public/bg/pubg-key-art.webp", 1.30, 0.34),
    (("rivals.jpg", STEAM.format(2767030)), 1.10, 0.50),
    ("public/dd/splash/LeeSin_0.jpg", 1.00, 0.55),
    (("r6.jpg", STEAM.format(359550)), 1.15, 0.42),
    ("public/bg/island.webp", 1.20, 0.50),
    ("public/dd/splash/Jinx_0.jpg", 1.00, 0.48),
    ("public/pubg/map/Miramar.png", 1.05, 0.50),
    ("public/dd/splash/Lux_0.jpg", 1.00, 0.46),
]

GAP = 3


def resolve(src) -> str:
    """로컬 경로는 그대로, 원격은 캐시에 받아 두고 그 경로를 돌려준다."""
    if isinstance(src, str):
        return os.path.join(R, src)
    name, url = src
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print(f"  fetch {name}")
        req = urllib.request.Request(url, headers={"User-Agent": "patchgap-asset-build"})
        with urllib.request.urlopen(req, timeout=30) as res, open(path, "wb") as out:
            out.write(res.read())
    return path


def load_rgb(path: str) -> Image.Image:
    raw = Image.open(path)
    if raw.mode in ("RGBA", "LA", "P"):
        raw = raw.convert("RGBA")
        flat = Image.new("RGB", raw.size, BG)
        flat.paste(raw, mask=raw.split()[-1])
        return flat
    return raw.convert("RGB")


unit = (W - GAP * (len(TILES) - 1)) / sum(t[1] for t in TILES)
wall = Image.new("RGB", (W, H), BG)
x = 0
for src, mult, cx in TILES:
    tw = int(round(unit * mult))
    im = load_rgb(resolve(src))
    s = H / im.height
    im = im.resize((max(1, int(im.width * s)), H), Image.LANCZOS)
    left = int(round((im.width - tw) * min(1.0, max(0.0, cx))))
    im = im.crop((left, 0, left + tw, H))
    if im.width != tw:
        im = im.resize((tw, H), Image.LANCZOS)
    # 원색은 살리되 한 화면 안에서 튀지 않을 만큼만 — 사용자 지시("원색이 좀더잘보이게").
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Brightness(im).enhance(1.18)
    wall.paste(im, (x, 0))
    x += tw + GAP

wall = ImageChops.multiply(wall, Image.new("RGB", (W, H), (242, 244, 250)))

grad = Image.new("L", (1, H))
for y in range(H):
    t = y / H
    grad.putpixel((0, y), int(255 * min(1.0, max(0.0, (t - 0.58) / 0.42) ** 1.5)))
wall = Image.composite(Image.new("RGB", (W, H), BG), wall, grad.resize((W, H)))

edge = Image.new("L", (W, 1), 255)
for x2 in range(W):
    edge.putpixel((x2, 0), int(255 * min(1.0, min(x2, W - 1 - x2) / (W * 0.06))))
wall = Image.composite(wall, Image.new("RGB", (W, H), BG), edge.resize((W, H)))

top = Image.new("L", (1, H))
for y in range(H):
    t = y / H
    top.putpixel((0, y), int(255 * max(0.0, (0.10 - t) / 0.10)) if t < 0.10 else 0)
wall = Image.composite(Image.new("RGB", (W, H), BG), wall, top.resize((W, H)))

out_path = os.path.join(R, "public", "bg", "splash-wall.jpg")
wall.save(out_path, quality=86, optimize=True)
print("ok", os.path.getsize(out_path) // 1024, "KB", f"({len(TILES)} tiles)")
