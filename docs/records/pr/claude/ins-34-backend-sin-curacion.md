**Título:** INS-34: backend empaquetado sin curación ni proveedores cloud

## Summary

Tarea `INS-34` del instalador de Tarkor ([Instalador-WMF-Tarkor](https://github.com/Zeldris/Instalador-WMF-Tarkor)); no entra en los roadmaps de WMF. El bundle de esbuild del backend no lleva la curación ni los proveedores cloud: `process.env.TARKOR_EMPAQUETADO` (`define` "1") pliega la ruta `POST /world/:slug/image-prompt` y la captura en vivo (`captureLiveTeacherExample`), cuyos módulos entran por `import()` dinámico. Exige `minifySyntax` en el empaquetador.

Retro decidida por la usuaria (2026-10-27): [`retro-2026-10-27-ins-34.md`](../../retro-2026-10-27-ins-34.md); `QA-266` (`entorno-nube.sh` instala `postgresql-16-pgvector` si falta).
