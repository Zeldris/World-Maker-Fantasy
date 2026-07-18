import { prisma } from './prisma.js';

let cachedUserId: string | null = null;

/// Decisión de producto 2 (02-decisiones.md): sin login real todavía — un único usuario
/// implícito. Reutiliza el primero que exista o crea uno la primera vez que hace falta.
export async function getDefaultUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const existing = await prisma.user.findFirst();
  if (existing) {
    cachedUserId = existing.id;
    return existing.id;
  }

  const created = await prisma.user.create({ data: {} });
  cachedUserId = created.id;
  return created.id;
}
