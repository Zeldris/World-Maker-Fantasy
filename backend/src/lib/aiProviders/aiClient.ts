/// Interfaz común para los proveedores cloud de la rotación de prompts de imagen (ver
/// orchestrator.ts) — mismo contrato que AiClient.java en VeriNews_AI, adaptado a TS/fetch.
export interface AiClient {
  /// Envía system+user y devuelve el texto de respuesta (prosa libre, no JSON).
  complete(systemPrompt: string, userContent: string, maxTokens: number): Promise<string>;
  getModelId(): string;
  /// false si no hay API key configurada — el orquestador lo salta en la rotación.
  disponible(): boolean;
}
