#!/usr/bin/env python3
"""Cobertura de los roadmaps: ¿cada tarea definida en un roadmap tiene hito asignado?

Lee las tareas (`UX-3`, `REI-40`, `ZON-10`, `CR-12`…) definidas en roadmap-front*.md y
roadmap-cronista.md, expande la tabla «Qué entra en cada hito» de 21-roadmap.md (rangos `A`…`B`,
fases R-x / Z-x / UX-x y «CR Fases N») y lista:
  - SIN HITO: tareas que nadie va a hacer porque no están en ningún hito (hay que asignarlas).
  - ASIGNADAS PERO NO DEFINIDAS: identificadores citados en el mapa que no existen.
  - EN VARIOS HITOS: repeticiones (algunas son intencionadas, p. ej. una parte en 0.1 y el resto
    después; revisar las nuevas).
  - RETRO PENDIENTE (QA-20): fases ✅ (o «Fase X cerrada» aunque queden pendientes) de un
    plan-roadmap-*.md cuya celda de estado no dice «retro ✅»
    (ni «sin retro», para las anteriores a las retros por fase).
Uso: python3 tools/roadmap/cobertura.py   (sale con código 1 si hay tareas sin hito, identificadores
sin definir nuevos o retros pendientes; lo ejecuta la CI, QA-14)
     python3 tools/roadmap/cobertura.py --fila <ID>   (QA-242: dónde está definida la tarea, su hito y cada
     línea de 21-roadmap.md que la nombra, con el trozo de alrededor; sin leer los roadmaps enteros;
     sale con 1 si la tarea no está definida o no tiene hito)
     python3 tools/roadmap/cobertura.py --libre <PREFIJO>   (QA-246: el siguiente número libre del prefijo, el
     mayor entre el árbol de trabajo y origin/main, para que dos ramas no abran el mismo identificador)
     Además la salida normal falla con «ABIERTAS TAMBIÉN EN MAIN» (QA-246): tareas que esta rama y origin/main
     han definido las dos desde su base común (merge-base) con otro título, es decir, el mismo identificador abierto
     dos veces; y con «DEFINIDAS DOS VECES»: el mismo identificador definido en dos líneas del árbol (así se ve
     también tras traer main, cuando la base ya es main).
"""
import re, sys, os, subprocess
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','docs','producto')+'/'
PREF='CFG|BAS|DAD|MOD|PAN|HUD|NAR|CMB|ATM|PRE|SON|QA|INT|UX|ZON|REI|CR|IMG|VOZ'
ID=rf'(?:{PREF})-\d+[a-z]?'
files=['roadmap-front.md','roadmap-front-ux.md','roadmap-front-zona.md','roadmap-front-reino.md','roadmap-cronista.md','roadmap-imagenes.md','roadmap-voces.md']
defs={}
titulo={}  # QA-246: id → título de su primera definición en el árbol
repetidas={}  # QA-246: id → [(archivo, línea)] de las definiciones que siguen a la primera
DEF=rf'^\s*-\s*(?:~~)?\*\*({ID})\b|^\|\s*(?:~~)?({ID})(?:~~)?\s*\||^\s*(?:~~)?\*\*({ID})\s*·'
def num(i):
    return (i.split('-')[0],int(re.sub(r'\D','',i.split('-')[1])))
def definiciones(texto):
    """(número de línea, id, título) de cada definición de tarea de un texto de roadmap."""
    for n,l in enumerate(texto.split('\n'),1):
        for m in re.finditer(DEF,l):
            i=next(g for g in m.groups() if g)
            yield n,i,re.split(r'\*\*|\|',l[m.end():].replace('~~',''))[0].strip(' ·')
for f in files:
    for n,i,tit in definiciones(open(D+f).read()):
        if i in defs: repetidas.setdefault(i,[]).append((f,n))
        else: defs[i]=(f,n); titulo[i]=tit
def git(*a):
    """QA-246: salida de una orden de git en el repo, o None si git falla (sin origin/main, sin repo)."""
    try:
        r=subprocess.run(['git',*a],cwd=D,capture_output=True,text=True)
    except OSError: return None
    return r.stdout if r.returncode==0 else None
def desde(ref, f):
    """QA-246: el texto de `docs/producto/<f>` en `ref`, o None."""
    return git('show',f'{ref}:docs/producto/{f}')
def titulos(textos):
    """QA-246: {id: título} de las tareas definidas en `textos` (la primera definición de cada una)."""
    out={}
    for t in textos:
        for _,i,tit in definiciones(t): out.setdefault(i,tit)
    return out
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
inicio_tabla=tabla[:tabla.index('### Qué entra en cada hito')].count('\n')+1
tabla=tabla[tabla.index('### Qué entra en cada hito'):tabla.index('### Dependencias que mandan el orden')]
asignado={}
fila_hito={}  # QA-242: id → (línea de 21-roadmap.md, hito) de las filas que lo asignan, en orden
for k,row in enumerate(tabla.split('\n')):
    if not row.startswith('| **`'): continue
    hito=re.search(r'`([\d.]+)`',row).group(1)
    ids=expand(row)
    limpio=row.replace('~~','').replace('*','')
    for m in re.finditer(r'\b(R-[A-F]|Z-[A-F]|UX-[A-F])\b(?!\s*`)(?!\s*parcial)',limpio):
        ids|=fases.get(m.group(1),set())
    for g in re.findall(r'CR Fases? ([\d ,y]+)',row):
        for n in re.findall(r'\d',g): ids|=cr.get(int(n),set())
    for i in ids:
        asignado.setdefault(i,set()).add(hito); fila_hito.setdefault(i,[]).append((inicio_tabla+k,hito))
falta=sorted((i for i in defs if i not in asignado), key=num)
fantasmas=sorted(i for i in asignado if i not in defs)
def fila(i):
    """QA-242: las líneas de una tarea (definición, hito y menciones en 21-roadmap.md), recortadas.
    Las filas de hito no se repiten como mención, y cada línea sale una vez."""
    def trozo(l, m):
        a,b=max(0,m.start()-100),min(len(l),m.end()+100)
        return ('…' if a else '')+l[a:b]+('…' if b<len(l) else '')
    patron=re.compile(rf'(?<![\w-]){re.escape(i)}(?![\w])')
    out=[]
    if i in defs:
        f,n=defs[i]; l=open(D+f).readlines()[n-1].rstrip('\n')
        out.append(f'{f}:{n}: {trozo(l, patron.search(l))}')
    else:
        out.append(f'{i}: no está definida en ningún roadmap')
    out.append('hito: '+(', '.join(f'{h} (21-roadmap.md:{n})' for n,h in fila_hito[i]) if i in asignado else 'SIN HITO'))
    filas={n for n,_ in fila_hito.get(i,[])}
    for n,l in enumerate(open(D+'21-roadmap.md'),1):
        l=l.rstrip('\n'); m=patron.search(l)
        if m and n not in filas: out.append(f'21-roadmap.md:{n}: {trozo(l, m)}')
    return out
def textos_en(ref):
    """QA-246: {archivo: texto en `ref`} de los roadmaps y del mapa; vacío si `ref` no está."""
    out={}
    for f in files+['21-roadmap.md']:
        t=desde(ref,f)
        if t is not None: out[f]=t
    return out
def libre(pref):
    """QA-246: el siguiente número libre de `pref`: el mayor que aparece en el árbol o en origin/main, más uno."""
    main=textos_en('origin/main')
    if not main: print('aviso: sin origin/main; solo cuenta el árbol de trabajo',file=sys.stderr)
    textos=[open(D+f).read() for f in files+['21-roadmap.md']]+list(main.values())
    # Menciones con su prefijo, rangos «A…B» y lo que reserva el mapa del árbol («ZON-37, 70-73»); en la prosa,
    # «QA-12 y 400» no reserva el 400.
    nums=[int(n) for t in textos for n in re.findall(rf'(?<![\w-]){pref}-(\d+)',t)]
    nums+=[int(n) for t in textos for n in re.findall(rf'(?<![\w-]){pref}-\d+\s*(?:…|\.\.\.)\s*(?:{pref}-)?(\d+)',t.replace('`',''))]
    nums+=[num(i)[1] for i in asignado if i.startswith(pref+'-')]
    return f'{pref}-{max(nums,default=0)+1}'
def choques():
    """QA-246: tareas que esta rama y origin/main han definido las dos desde su base común, con otro título.
    Con el mismo título es la misma tarea, traída de una tercera rama a las dos; cambiar el título de una tarea
    ya de main tampoco cuenta (no es nueva en main). Tras traer main la base pasa a ser main: lo ve «DEFINIDAS DOS VECES»."""
    base=(git('merge-base','HEAD','origin/main') or '').strip()
    if not base: return []
    en_main=titulos(textos_en('origin/main').values())
    nuevas_main=set(en_main)-set(titulos(textos_en(base).values()))
    return sorted((i for i in defs if i in nuevas_main and titulo[i]!=en_main[i]),key=num)
# QA-101: sin ejecutarse como script (p. ej. desde tools/qa/matriz-pruebas.py), solo calcula `defs` y `asignado`.
if __name__ == '__main__' and sys.argv[1:2] == ['--fila']:
    if len(sys.argv) != 3: sys.exit('uso: cobertura.py --fila <ID>')
    print('\n'.join(fila(sys.argv[2])))
    sys.exit(0 if sys.argv[2] in defs and sys.argv[2] in asignado else 1)
if __name__ == '__main__' and sys.argv[1:2] == ['--libre']:
    if len(sys.argv) != 3 or sys.argv[2] not in PREF.split('|'): sys.exit('uso: cobertura.py --libre <PREFIJO>')
    print(libre(sys.argv[2]))
    sys.exit(0)
if __name__ == '__main__':
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
            cerrada=estado.startswith('✅') or f'Fase {m.group(1)} cerrada' in estado
            if cerrada and 'retro ✅' not in estado and 'sin retro' not in estado:
                retros.append(f'{f} Fase {m.group(1)}')
    print('RETRO PENDIENTE:',retros)
    # QA-246: el mismo identificador abierto en esta rama y en main a la vez; sin origin/main no falla.
    otros=choques()
    print('ABIERTAS TAMBIÉN EN MAIN:',otros)
    # QA-246: UX-6 se nombra en una lista de decisiones de roadmap-cronista.md con la forma de una definición.
    DOBLES_CONOCIDAS={'UX-6'}
    dos_veces={i:[defs[i],*v] for i,v in repetidas.items() if i not in DOBLES_CONOCIDAS}
    print('DEFINIDAS DOS VECES:',dos_veces)
    sys.exit(1 if falta or nuevos or retros or otros or dos_veces else 0)
