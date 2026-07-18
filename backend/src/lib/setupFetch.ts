import { Agent, setGlobalDispatcher } from 'undici';

/// El fetch nativo de Node (undici) tiene por defecto un timeout de 5 min esperando
/// cabeceras/cuerpo de la respuesta. Ollama en CPU puede tardar más que eso en una sola
/// generación (sobre todo con el modelo recién cargado en frío) — lo desactivamos para
/// las llamadas locales a Ollama. Importar este módulo una vez, al arrancar el proceso
/// (server.ts y cualquier script suelto como test-turn.ts), antes de hacer ningún fetch.
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));
