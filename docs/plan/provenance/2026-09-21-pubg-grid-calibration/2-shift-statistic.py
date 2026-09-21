import json,math,sys,collections
D=json.load(open(sys.argv[1])); H=D['H']; N=D['N']
W=0.004  # log-bin width ≈0.4%
MAXSHIFT=120  # ±~48%
def bins(h,scale=1.0):
    out=collections.Counter(); tot=0
    for v,c in h.items():
        v=float(v)*scale
        if v<=0: continue
        out[round(math.log(v)/W)]+=c; tot+=c
    return {k:c/tot for k,c in out.items()} if tot else {}
def inter(pb,pa,shift):
    return sum(min(p, pa.get(k+shift,0.0)) for k,p in pb.items())
def cell_stats(hb,ha,scale=1.0):
    pb=bins(hb); pa=bins(ha,scale)
    i0=inter(pb,pa,0)
    best=(i0,0)
    for s in range(-MAXSHIFT,MAXSHIFT+1):
        if s==0: continue
        v=inter(pb,pa,s)
        if v>best[0]: best=(v,s)
    return i0,best[0],best[1]
def run(gb,ga,minhits,label,scale=1.0,show=10):
    rows=[]
    for w in H[gb]:
        for r in H[gb][w]:
            if r not in H.get(ga,{}).get(w,{}): continue
            nb=N[gb][w][r]; na=N[ga][w][r]
            if nb<minhits or na<minhits: continue
            i0,ib,sb=cell_stats(H[gb][w][r],H[ga][w][r],scale)
            rows.append((ib-i0,i0,ib,sb,w,r,nb,na))
    rows.sort(reverse=True)
    print(f"== {label}: cells={len(rows)}")
    for row in rows[:show]: print("  D=%+.3f i0=%.3f ibest=%.3f shift=%+d(%.1f%%) %s %s n=%d/%d"%(row[0],row[1],row[2],row[3],(math.exp(row[3]*W)-1)*100,row[4],row[5],row[6],row[7]))
    ds=[r[0] for r in rows]; i0s=sorted(r[1] for r in rows)
    print("  D max %.3f · i0 min %.3f p5 %.3f p50 %.3f"%(max(ds),i0s[0],i0s[len(i0s)//20],i0s[len(i0s)//2]))
    return rows
mh=int(sys.argv[2]) if len(sys.argv)>2 else 120
run('42a','42b',mh,'NULL 42a vs 42b')
run('43a','43b',mh,'NULL 43a vs 43b')
real=run('42','43',mh,'REAL 42.3 vs 43.1',show=15)
run('42','43',mh,'SYNTH ×1.10',scale=1.10,show=5)
run('42','43',mh,'SYNTH ×0.97',scale=0.97,show=5)
run('42','43',mh,'SYNTH ×1.03',scale=1.03,show=5)
