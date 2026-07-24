@echo off
echo Deteniendo backend y frontend de Tarkor...
echo.

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*RPG_Tarkor*server.ts*' -or $_.CommandLine -like '*RPG_Tarkor*frontend*vite*' } | ForEach-Object { Write-Host ('Parando PID ' + $_.ProcessId + ': ' + $_.Name); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo Hecho. Las ventanas de consola (Backend/Frontend) puedes cerrarlas a mano si siguen abiertas.
echo.
pause
