// Aviso de `darObjetos.ts` (puro, para probarlo sin base): el script mete objetos sin pasar por el tope de
// inventario (a propósito: prepara escenarios), pero no puede callar que la partida queda por encima de él, porque
// el juego luego rechaza recoger, recolectar y comprar y el escenario parece roto sin motivo.
export function avisoDeCarga(carga: number, capacidad: number): string | null {
  if (carga <= capacidad) return null;
  return `AVISO: el inventario queda con ${carga} unidades y la capacidad es ${capacidad} (${carga - capacidad} de más). Se han dado igual; el juego no dejará recoger ni recolectar hasta que baje la carga.`;
}
