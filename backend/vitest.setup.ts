import 'dotenv/config';

// No hay .env.test separado — los tests de integración usan la MISMA DATABASE_URL que dev
// (ver comentario de arriba). Sin este candado, LIVE_TEACHER_CAPTURE_ENABLED="true" de .env
// también se aplicaba en tests: cada turno de combate/narración corriendo en CI/local disparaba
// una llamada real a un proveedor cloud y escribía una fila real en LiveTeacherCapture, gastando
// cuota gratuita y contaminando el dataset de DPO con capturas de saves de usar y tirar
// (auditoría 2026-08-13: 33% de las capturas acumuladas eran texto de mocks de test).
process.env.LIVE_TEACHER_CAPTURE_ENABLED = 'false';
