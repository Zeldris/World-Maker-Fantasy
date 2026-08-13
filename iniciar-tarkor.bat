@echo off
echo Arrancando backend y frontend de Tarkor...
echo.

echo Sincronizando catalogo del mundo (seed-catalog)...
pushd C:\RPG_Tarkor\backend
call npm run seed-catalog
popd
echo.

start "Tarkor - Backend" cmd /k "cd /d C:\RPG_Tarkor\backend && npm run dev:nowatch"
start "Tarkor - Frontend" cmd /k "cd /d C:\RPG_Tarkor\frontend && npm run dev"

echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Se han abierto 2 ventanas nuevas (Backend y Frontend) - dejalas abiertas mientras juegas.
echo Para pararlo todo, cierra las 2 ventanas (Backend y Frontend) a mano
echo.
pause
