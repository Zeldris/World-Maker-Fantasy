# sin pipefail: registro de la spike (sin shebang, rutas de ~/plan-imagenes-tarkor); se guarda como estaba y no se vuelve a correr
cd /home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike

g=/home/deck/Desktop/Desarrollos/World-Maker-Fantasy/image-generator/scripts/generar.sh
$g /home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike A pA.txt 1280 512 3 6 > A.out 2>&1
$g /home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike B pA.txt 1280 512 3 6 -r /home/deck/Desktop/Desarrollos/World-Maker-Fantasy/image-generator/referencias/images/fauna/aullador-rojo-macho-banner.png > B.out 2>&1
$g /home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike C pC.txt 1280 512 3 6 > C.out 2>&1
$g /home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike D pD.txt 1280 512 3 6 -r /home/deck/Desktop/Desarrollos/World-Maker-Fantasy/image-generator/referencias/images/location/laberinto-de-canones-dia-primavera-banner.png > D.out 2>&1
$g /home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike E pD.txt 1280 512 3 6 -r /home/deck/Desktop/Desarrollos/World-Maker-Fantasy/image-generator/referencias/images/location/laberinto-de-canones-dia-primavera-banner.png -r /home/deck/Desktop/Desarrollos/World-Maker-Fantasy/image-generator/referencias/images/fauna/aullador-rojo-macho-banner.png > E.out 2>&1
echo done > ALL.done
