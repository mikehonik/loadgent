// Piezas compartidas por las herramientas de un solo SKU.
import { prepararEntrada } from "../../motor/corrida.js";

// El motor espera la entrada ya normalizada (soporte mínimo como fracción, compresión por omisión según
// el empaque): se pasa por el mismo prepararEntrada que usa una corrida normal. Los estimados corren en el
// hilo de la pantalla, así que se topan en nivel 2 (en la práctica, milisegundos para un solo SKU).
export const paraMotor = (p, reglas, cambios = {}) => {
  const { pid, sku, tarima, ...resto } = p;
  const e = prepararEntrada({ items: [{ ...resto, ...cambios, nombre: sku, qty: 1 }], vehiculo: null, tarimas: [], reglas: { ...reglas, nivel: Math.min(2, reglas.nivel || 2) } });
  return { it: e.items[0], reglas: e.reglas };
};
