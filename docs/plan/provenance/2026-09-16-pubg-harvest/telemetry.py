#!/usr/bin/env python3
"""텔레메트리 reduce-on-ingest — 원본 ~30MB(gz 1.3MB)를 매치당 ~3KB 집계로 줄인다.
   43.1 밸런스 11개 항목이 전부 무기 단위라 텔레메트리가 필수(2026-09-16 게이트 판정).
   42.3(9/3~9/8)이 먼저 소멸하므로 오래된 매치부터 처리한다. 원본은 디스크에 남기지 않는다."""
import json, os, re, sys, time, gzip, io, urllib.request, urllib.error
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/mnt/d/workspace/patchgap")
MDIR = ROOT / "data/raw/pubg/matches"
TDIR = ROOT / "data/raw/pubg/telemetry-reduced"; TDIR.mkdir(parents=True, exist_ok=True)
PER_DAY = int(sys.argv[1]) if len(sys.argv) > 1 else 120

def reduce_one(path):
    mid = path.stem
    out = TDIR / f"{mid}.json"
    if out.exists(): return "skip"
    try:
        j = json.loads(path.read_bytes())
        a = j["data"]["attributes"]
        url = next(x["attributes"]["URL"] for x in j["included"]
                   if x["type"] == "asset" and x["attributes"]["name"] == "telemetry")
    except Exception:
        return "nourl"
    try:
        req = urllib.request.Request(url, headers={"Accept-Encoding": "identity"})
        with urllib.request.urlopen(req, timeout=240) as r:
            raw = gzip.decompress(r.read())
        events = json.loads(raw)
    except Exception as e:
        return f"err:{type(e).__name__}"

    patch = mode = region = mtype = None
    pickup, kills, dmg, attacks, vdmg, dsum, vdsum = (Counter() for _ in range(7))
    bots, humans = set(), set()
    n_ev = len(events)
    for e in events:
        t = e.get("_T")
        if t == "LogMatchDefinition":
            m = re.search(r"match\.[a-z]+\.([a-z0-9]+)\.(pc-2018-\d+)\.steam\.([a-z0-9\-]+)\.([a-z]+)\.",
                          e.get("MatchId", ""))
            if m: mtype, patch, mode, region = m.groups()
        elif t == "LogItemPickup":
            it = e.get("item") or {}
            if it.get("category") == "Weapon": pickup[it.get("itemId")] += 1
        elif t == "LogPlayerKillV2":
            w = (e.get("killerDamageInfo") or {}).get("damageCauserName")
            if w: kills[w] += 1
        elif t == "LogPlayerTakeDamage":
            w = e.get("damageCauserName")
            if w and w.startswith("Weap"):
                dmg[w] += 1
                dsum[w] += float(e.get("damage") or 0)
        elif t == "LogVehicleDamage":
            w = e.get("damageCauserName")
            if w and w.startswith("Weap"):
                vdmg[w] += 1
                vdsum[w] += float(e.get("damage") or 0)
        elif t == "LogPlayerAttack":
            w = (e.get("weapon") or {}).get("itemId")
            if w: attacks[w] += 1
        elif t in ("LogPlayerLogin", "LogPlayerCreate"):
            aid = str(e.get("accountId") or (e.get("character") or {}).get("accountId") or "")
            (bots if aid.startswith("ai.") else humans).add(aid)

    out.write_text(json.dumps({
        "matchId": mid, "createdAt": a.get("createdAt"), "map": a.get("mapName"),
        "gameMode": a.get("gameMode"), "duration": a.get("duration"),
        "patch": patch, "matchType": mtype, "telMode": mode, "region": region, "nEvents": n_ev,
        "nBots": len(bots), "nHumans": len(humans),
        "weaponPickup": dict(pickup), "weaponKills": dict(kills),
        "weaponDamageHits": dict(dmg), "weaponAttacks": dict(attacks),
        "vehicleDamageHits": dict(vdmg),
        "weaponDamageSum": {k: round(v, 1) for k, v in dsum.items()},
        "vehicleDamageSum": {k: round(v, 1) for k, v in vdsum.items()},
    }, separators=(",", ":")))
    return "ok"

# 날짜별 층화 선택 — 42.3(9/3~9/8) 먼저, 경계 9/9~9/10 제외, 43.1(9/11~9/16)
by_day = {}
for p in MDIR.glob("*.json"):
    try:
        ca = json.loads(p.read_bytes())["data"]["attributes"]["createdAt"][:10]
    except Exception: continue
    by_day.setdefault(ca, []).append(p)

order = ["2026-09-02","2026-09-03","2026-09-04","2026-09-05","2026-09-06","2026-09-07","2026-09-08",
         "2026-09-11","2026-09-12","2026-09-13","2026-09-14","2026-09-15"]
sel = []
for d in order:
    sel += sorted(by_day.get(d, []))[:PER_DAY]
print(f"[T] days={ {d: len(by_day.get(d,[])) for d in order} }", flush=True)
print(f"[T] selected={len(sel)} (per_day={PER_DAY})", flush=True)

stats = Counter(); t0 = time.time()
with ThreadPoolExecutor(max_workers=10) as ex:
    futs = {ex.submit(reduce_one, p): p for p in sel}
    for n, f in enumerate(as_completed(futs), 1):
        stats[f.result()] += 1
        if n % 50 == 0:
            print(f"[T] {n}/{len(sel)} {dict(stats)} {time.time()-t0:.0f}s", flush=True)
print(f"[T] DONE {dict(stats)} files={len(list(TDIR.glob('*.json')))}", flush=True)
