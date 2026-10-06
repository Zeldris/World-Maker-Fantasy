-- CR-55 (Q12): la leche de Múrgol la da el ganado; la orden fija de los Corrales desaparece.
DELETE FROM "OrdenProduccion" WHERE "recipeKey" = 'extraccionLecheMurgol';
