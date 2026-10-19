// P194 (QA-27): la tarjeta de un punto da la distancia en pasos, por el camino de la ruta prevista, no «a N celdas».
export default {
  hallazgos: ['P194'],
  escenario: 'hondonada-inicio',
  async correr({ page, ayuda }) {
    const puntos = (await ayuda('puntos')).split('\n').filter((l) => /\((Recurso|NPC|Fauna|Edificio)\) @ \d+,\d+$/.test(l));
    if (puntos.length === 0) throw new Error('el mapa no tiene puntos');
    const [, x, y] = puntos[0].match(/ @ (\d+),(\d+)$/);
    await page.mouse.move(Number(x), Number(y));
    await page.waitForTimeout(600);
    const tarjeta = (await page.getByTestId('tarjeta-ficha').first().textContent()) ?? '';
    if (/celda/.test(tarjeta)) throw new Error(`dice celdas: ${tarjeta}`);
    if (!/a \d+ pasos?|aquí/.test(tarjeta)) throw new Error(`sin distancia en pasos: ${tarjeta}`);
    return tarjeta;
  },
};
