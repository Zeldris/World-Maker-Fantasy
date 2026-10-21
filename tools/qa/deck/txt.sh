#!/bin/bash
# txt.sh '<js de clics>' [máx. caracteres]: hace los clics y devuelve el texto del cajón más largo.
. "$(dirname "$0")/_raiz.sh"
"$DECK/j.sh" "$1; await page.waitForTimeout(1200); return await page.evaluate(()=>{const c=[...document.querySelectorAll('[class*=aside],[role=dialog],aside')].map(e=>e.innerText).sort((a,b)=>b.length-a.length)[0]||''; return c.slice(0,${2:-3000})})"
