#!/bin/bash
# r.sh '<pestaña>' [js antes] [máx. caracteres]: abre una pestaña del Reino y vuelca su texto. Sin «Cerrar ✕» dice
# «no hay panel abierto». La pestaña y los caracteres entran como JSON; «js antes» es código del driver, tal cual.
. "$(dirname "$0")/_raiz.sh"
TAB="$(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
MAX="${3:-3500}"; case "$MAX" in ''|*[!0-9]*) echo "r.sh: máx. caracteres no numérico" >&2; exit 2 ;; esac
"$DECK/j.sh" "${2:-}; await page.locator('button',{hasText:$TAB}).first().click(); await page.waitForTimeout(1500); return await page.evaluate((max)=>{const t=document.body.innerText; const i=t.lastIndexOf('Cerrar ✕'); if(i<0)return 'no hay panel abierto'; return t.slice(i).split('\n').filter(Boolean).join(' / ').slice(0,max)},$MAX)"
