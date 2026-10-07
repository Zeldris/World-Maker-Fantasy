#!/usr/bin/env python3
"""Cobertura de los roadmaps: ¿cada tarea definida en un roadmap tiene hito asignado?

Lee las tareas (`UX-3`, `REI-40`, `ZON-10`, `CR-12`…) definidas en roadmap-front*.md y
roadmap-cronista.md, expande la tabla «Qué entra en cada hito» de 21-roadmap.md (rangos `A`…`B`,
fases R-x / Z-x / UX-x y «CR Fases N») y lista:
  - SIN HITO: tareas que nadie va a hacer porque no están en ningún hito (hay que asignarlas).
  - ASIGNADAS PERO NO DEFINIDAS: identificadores citados en el mapa que no existen.
  - EN VARIOS HITOS: repeticiones (algunas son intencionadas, p. ej. una parte en 0.1 y el resto
    después; revisar las nuevas).
  - RETRO PENDIENTE (QA-20): fases ✅ de un plan-roadmap-*.md cuya celda de estado no dice «retro ✅»
    (ni «sin retro», para las anteriores a las retros por fase).
Uso: python3 tools/roadmap/cobertura.py   (sale con código 1 si hay tareas sin hito, identificadores
sin definir nuevos o retros pendientes; lo ejecuta la CI, QA-14)
"""
import re, sys, os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','docs','producto')+'/'
PREF='CFG|BAS|DAD|MOD|PAN|HUD|NAR|CMB|ATM|PRE|SON|QA|INT|UX|ZON|REI|CR'
ID=rf'(?:{PREF})-\d+[a-z]?'
files=['roadmap-front.md','roadmap-front-ux.md','roadmap-front-zona.md','roadmap-front-reino.md','roadmap-cronista.md']
defs={}
for f in files:
    for n,l in enumerate(open(D+f),1):
        for m in re.finditer(rf'^\s*-\s*(?:~~)?\*\*({ID})\b|^\|\s*(?:~~)?({ID})(?:~~)?\s*\||^\s*(?:~~)?\*\*({ID})\s*·', l):
            i=next(g for g in m.groups() if g)
            defs.setdefault(i,(f,n))
def expand(text, default_prefix=None):
    out=set()
    text=text.replace('`','').replace('~~','')
    # ranges PREFIX-A…PREFIX-B or PREFIX-A…B or PREFIX-A-B (zona 70-73)
    for m in re.finditer(rf'({PREF})-(\d+)\s*(?:…|\.\.\.)\s*(?:({PREF})-)?(\d+)', text):
        p=m.group(1); a,b=int(m.group(2)),int(m.group(4))
        for k in range(a,b+1): out.add(f'{p}-{k}')
    for m in re.finditer(rf'\b({PREF})-(\d+[a-z]?)\b', text):
        out.add(f'{m.group(1)}-{m.group(2)}')
    # bare numbers following a prefix in a comma list: "ZON-10, 11, 13" / "ZON-37, 42, 70-73"
    for m in re.finditer(rf'({PREF})-\d+(?:\s*\([^)]*\))?((?:\s*(?:,|y|o)\s*\d+(?:\s*-\s*\d+)?(?:\s*\([^)]*\))?)+)', text):
        p=m.group(1)
        for r in re.finditer(r'(\d+)(?:\s*-\s*(\d+))?', m.group(2)):
            a=int(r.group(1)); b=int(r.group(2) or a)
            for k in range(a,b+1): out.add(f'{p}-{k}')
    return out
# phase tables
fases={}
for f,pat in [('roadmap-front-reino.md',r'R-[A-F]'),('roadmap-front-zona.md',r'Z-[A-F]'),('roadmap-front-ux.md',r'UX-[A-F]')]:
    for l in open(D+f):
        m=re.match(rf'^\|\s*\*\*({pat})\s*·[^|]*\|([^|]*)\|',l)
        if m: fases[m.group(1)]=expand(m.group(2))
cr={}
cur=None
for l in open(D+'roadmap-cronista.md'):
    m=re.match(r'^### Fase (\d+)',l)
    if m: cur=int(m.group(1)); cr[cur]=set(); continue
    if l.startswith('## '): cur=None
    if cur:
        for i in re.findall(r'\*\*(CR-\d+)\*\*',l): cr[cur].add(i)
# assignment rows
tabla=open(D+'21-roadmap.md').read()
tabla=tabla[tabla.index('### Qué entra en cada hito'):tabla.index('### Dependencias que mandan el orden')]
asignado={}
for row in tabla.split('\n'):
    if not row.startswith('| **`'): continue
    hito=re.search(r'`([\d.]+)`',row).group(1)
    ids=expand(row)
    limpio=row.replace('~~','').replace('*','')
    for m in re.finditer(r'\b(R-[A-F]|Z-[A-F]|UX-[A-F])\b(?!\s*`)(?!\s*parcial)',limpio):
        ids|=fases.get(m.group(1),set())
    for g in re.findall(r'CR Fases? ([\d ,y]+)',row):
        for n in re.findall(r'\d',g): ids|=cr.get(int(n),set())
    for i in ids: asignado.setdefault(i,set()).add(hito)
falta=sorted((i for i in defs if i not in asignado), key=lambda x:(x.split('-')[0],int(re.sub(r'\D','',x.split('-')[1]))))
fantasmas=sorted(i for i in asignado if i not in defs)
print('definidas',len(defs),'asignadas',len(asignado))
print('SIN HITO:',len(falta))
for i in falta: print(' ',i,defs[i][0],defs[i][1])
print('ASIGNADAS PERO NO DEFINIDAS:',fantasmas)
# QA-14: los que ya había al activar la comprobación (pendientes de definir en su roadmap); uno nuevo falla.
FANTASMAS_CONOCIDOS={'CFG-9','CR-49','ZON-5','ZON-16','ZON-18','ZON-30','ZON-31','ZON-32','ZON-33','ZON-34','ZON-35','ZON-36','ZON-38','ZON-40','ZON-41','ZON-50','ZON-51','ZON-53','ZON-58'}
nuevos=[i for i in fantasmas if i not in FANTASMAS_CONOCIDOS]
print('NO DEFINIDAS NUEVAS:',nuevos)
dobles={i:h for i,h in asignado.items() if len(h)>1}
print('EN VARIOS HITOS:',dobles)
# QA-20: una fase cerrada lleva su retro.
retros=[]
for f in sorted(os.listdir(D)):
    if not re.match(r'plan-roadmap-[\d.]+\.md$',f): continue
    for l in open(D+f):
        m=re.match(r'^\|\s*\*\*([A-Z]) —',l)
        if not m: continue
        estado=l.rstrip().rstrip('|').split('|')[-1].strip()
        if estado.startswith('✅') and 'retro ✅' not in estado and 'sin retro' not in estado:
            retros.append(f'{f} Fase {m.group(1)}')
print('RETRO PENDIENTE:',retros)
sys.exit(1 if falta or nuevos or retros else 0)
