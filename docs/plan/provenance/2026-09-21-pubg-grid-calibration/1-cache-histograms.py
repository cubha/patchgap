import json,glob,collections,random,sys
files=sorted(glob.glob('data/raw/pubg/telemetry-reduced/*.json'))
random.seed(1)
groups={'42':{},'43':{},'42a':{},'42b':{},'43a':{},'43b':{}}
N={k:{} for k in groups}
def add(g,d):
    H=groups[g]; NN=N[g]
    for w,reasons in d['damageGrid'].items():
        hw=H.setdefault(w,{}); nw=NN.setdefault(w,{})
        for r,cell in reasons.items():
            hr=hw.setdefault(r,{}); nw[r]=nw.get(r,0)+cell['n']
            for v,c in cell['top']:
                hr[v]=hr.get(v,0)+c
i=0
for f in files:
    d=json.load(open(f))
    if d.get('matchType')!='official': continue
    p=d['patch'][-2:]
    add(p,d)
    add(p+('a' if random.random()<0.5 else 'b'),d)
    i+=1
    if i%500==0: print(i,file=sys.stderr)
json.dump({'H':groups,'N':N},open(sys.argv[1],'w'))
print('cached',i)
