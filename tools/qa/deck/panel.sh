#!/bin/bash
# panel.sh '<js de clics>' [máx. caracteres]: hace los clics y vuelca el panel abierto (desde «Cerrar ✕»).
. "$(dirname "$0")/_raiz.sh"
"$DECK/j.sh" "$1; await page.waitForTimeout(1200); return await page.evaluate(()=>{const t=document.body.innerText;const i=t.lastIndexOf('Cerrar ✕');return t.slice(i,i+${2:-3500})})"
