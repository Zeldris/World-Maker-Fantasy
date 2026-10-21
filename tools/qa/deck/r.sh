#!/bin/bash
# r.sh '<pestaña>' [js antes] [máx. caracteres]: abre una pestaña del Reino y vuelca su texto.
. "$(dirname "$0")/_raiz.sh"
"$DECK/j.sh" "$2; await page.locator('button',{hasText:'$1'}).first().click(); await page.waitForTimeout(1500); return await page.evaluate(()=>{const t=document.body.innerText; const i=t.lastIndexOf('Cerrar ✕'); return t.slice(i).split('\n').filter(Boolean).join(' / ').slice(0,${3:-3500})})"
