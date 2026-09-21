import json,math,sys,collections
exec(open(__file__.replace('3-quantiles.py','2-shift-statistic.py')).read().split("mh=int")[0])  # reuse funcs from pubg_stats.py
def dist(gb,ga,minhits,label,scale=1.0):
    ds=[]
    for w in H[gb]:
        for r in H[gb][w]:
            if r not in H.get(ga,{}).get(w,{}): continue
            nb=N[gb][w][r]; na=N[ga][w][r]
            if nb<minhits or na<minhits: continue
            i0,ib,sb=cell_stats(H[gb][w][r],H[ga][w][r],scale)
            ds.append((ib-i0,sb,i0,ib,w,r,nb,na))
    ds.sort()
    q=lambda p: ds[int(len(ds)*p)][0]
    print(f"== {label} cells={len(ds)} D min %.3f p5 %.3f p25 %.3f p50 %.3f max %.3f"%(ds[0][0],q(.05),q(.25),q(.5),ds[-1][0]))
    low=[d for d in ds if d[0]<0.3]
    for d in low[:8]: print("   low D=%.3f shift=%+d i0=%.3f ib=%.3f %s %s n=%d/%d"%d)
    return ds
for mh in (120,):
    for sc in (1.03,0.97,1.10,1.015):
        dist('42','43',mh,f'SYNTH real×{sc}',sc)
        dist('42a','42b',mh,f'SYNTH null42×{sc}',sc)
    dist('42a','42b',mh,'NULL42'); dist('43a','43b',mh,'NULL43'); dist('42','43',mh,'REAL')
