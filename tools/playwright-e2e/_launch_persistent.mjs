import { chromium } from 'playwright';

// Lanza Chromium con un perfil persistente y puerto de depuración remoto, y lo deja corriendo en
// background — cada script posterior se conecta a ESTA MISMA instancia vía chromium.connectOverCDP,
// así el estado (partida cargada, pestaña, cookies) persiste entre llamadas de Bash sin recargar.
const context = await chromium.launchPersistentContext(
  '/tmp/claude-1000/-home-deck-Desktop-Desarrollos/d2c755bb-9b52-4e0a-8ca7-10f7e5d00469/scratchpad/playwright-profile',
  {
    headless: true,
    args: ['--remote-debugging-port=9222'],
  },
);
console.log('Lanzado con CDP en puerto 9222, PID del proceso mantenido vivo.');
// Mantener el proceso vivo indefinidamente (el script que lo lanzó se queda corriendo en background).
await new Promise(() => {});
