#!/usr/bin/env python3
"""PUBG 42.3/43.1 원본 확보 (임시 harvest — 채택 시 src/pipeline/collect/pubg/로 승격).
   336h 보존창이 매일 닫히므로 방향 확정 전에 원본만 먼저 긁어둔다."""
import json, os, re, sys, time, gzip, zlib, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path("/mnt/d/workspace/patchgap")
OUT  = ROOT / "data/raw/pubg"
KEY  = re.search(r"^PUBG_API_KEY=(.+)$", (ROOT/".env").read_text(), re.M).group(1).strip()
H    = {"Authorization": f"Bearer {KEY}", "Accept": "application/vnd.api+json"}
BASE = "https://api.pubg.com/shards/steam"

def get(url, headers=None, retries=4):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={**H, **(headers or {})})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(float(e.headers.get("retry-after", 6)) + 1); continue
            if e.code in (404, 400): return e.code, b"", {}
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    return 0, b"", {}

# ---- Phase A: /samples 로 날짜별 매치 ID 수집 (리밋 10 RPM → 7s 간격) ----
DAYS = [f"2026-09-{d:02d}" for d in range(2, 17)]
ids_path = OUT / "sample-ids.json"
pool = json.loads(ids_path.read_text()) if ids_path.exists() else {}
for day in DAYS:
    if day in pool: continue
    st, body, _ = get(f"{BASE}/samples?filter[createdAt-start]={day}T00:00:00Z")
    if st != 200:
        print(f"[A] {day} FAIL {st}", flush=True); pool[day] = []
    else:
        j = json.loads(body)
        pool[day] = [m["id"] for m in j["data"]["relationships"]["matches"]["data"]]
        print(f"[A] {day} {len(pool[day])} ids", flush=True)
    ids_path.write_text(json.dumps(pool))
    time.sleep(7)

uniq = sorted({i for v in pool.values() for i in v})
print(f"[A] total unique match ids = {len(uniq)}", flush=True)

# ---- Phase B: /matches/{id} (리밋 없음) 동시 수집 ----
MDIR = OUT / "matches"; MDIR.mkdir(exist_ok=True)
done = {p.stem for p in MDIR.glob("*.json")}
todo = [i for i in uniq if i not in done]
print(f"[B] todo={len(todo)} done={len(done)}", flush=True)

def fetch_match(mid):
    st, body, _ = get(f"{BASE}/matches/{mid}")
    if st != 200: return mid, st
    (MDIR / f"{mid}.json").write_bytes(body)
    return mid, 200

ok = fail = 0
with ThreadPoolExecutor(max_workers=12) as ex:
    for n, (mid, st) in enumerate(ex.map(fetch_match, todo), 1):
        if st == 200: ok += 1
        else: fail += 1
        if n % 250 == 0: print(f"[B] {n}/{len(todo)} ok={ok} fail={fail}", flush=True)
print(f"[B] DONE ok={ok} fail={fail} total_files={len(list(MDIR.glob('*.json')))}", flush=True)

# ---- Phase C: 날짜당 25건 Range 부분 디코드로 패치 라벨 검증 ----
def label(mid):
    try:
        j = json.loads((MDIR / f"{mid}.json").read_bytes())
    except Exception: return None
    url = next((x["attributes"]["URL"] for x in j.get("included", [])
                if x["type"] == "asset" and x["attributes"]["name"] == "telemetry"), None)
    if not url: return None
    st, body, _ = get(url, headers={"Range": "bytes=0-49151", "Accept-Encoding": "identity"})
    if st not in (200, 206) or not body: return None
    try:
        raw = zlib.decompressobj(16 + zlib.MAX_WBITS).decompress(body)
    except Exception: return None
    m = re.search(rb"official\.(pc-2018-\d+)\.steam\.([a-z\-]+)\.([a-z]+)\.(\d{4}\.\d{2}\.\d{2})", raw)
    return tuple(x.decode() for x in m.groups()) if m else None

verif = {}
for day, lst in pool.items():
    sub = [i for i in lst if (MDIR / f"{i}.json").exists()][:25]
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = [r for r in ex.map(label, sub) if r]
    from collections import Counter
    verif[day] = {"probed": len(sub), "parsed": len(res),
                  "patch": dict(Counter(r[0] for r in res)),
                  "region": dict(Counter(r[2] for r in res))}
    print(f"[C] {day} {verif[day]}", flush=True)
(OUT / "patch-verify.json").write_text(json.dumps(verif, indent=2))
print("[C] DONE", flush=True)
