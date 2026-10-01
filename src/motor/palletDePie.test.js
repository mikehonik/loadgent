import { describe, it, expect } from "vitest";
import { correr, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";

// Un pallet armado no se acuesta. Antes, el relleno final le daba las seis orientaciones a todo, así que
// tumbaba pallets de costado para meterlos en el hueco de arriba; el 3D los dibujaba de pie y se veía
// carga saliéndose del contenedor (reporte de Santiago, caso DROP SHIP).
const base = { id: 0, nombre: "X", desc: "", color: null, peso: 5, qty: 10, oris: [true, true, false, false, false, false],
  volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0,
  piezas: 1, paletizar: true, palletId: 0, porPallet: 0, porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: true };
const items = [
  { ...base, id: 1, nombre: "A", L: 406, W: 338, H: 341, peso: 7.8, qty: 1680, porCapa: 6, capasPallet: 4 },
  { ...base, id: 2, nombre: "B", L: 305, W: 254, H: 264, peso: 4.4, qty: 3840, porCapa: 8, capasPallet: 6 },
];
const vehiculo = { L: 12032, W: 2352, H: 2698, tara: 3900, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const tarimas = [{ nombre: "Americano 1219×1016", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1500, ovL: 0, ovW: 0 }];
const ejecutor = ejecutorEnProceso(optimizar);

describe("el pallet armado siempre va de pie", () => {
  it.each([1, 4])("nivel %i: ningún pallet queda acostado ni se sale del vehículo", async (nivel) => {
    const c = await correr({ items, vehiculo, tarimas, reglas: { nivel, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" } }, { ejecutor });
    const defs = c.resultado.pallets;
    c.resultado.contenedores.forEach((v) => {
      v.cajas.forEach((x) => {
        expect(x.z + x.h).toBeLessThanOrEqual(vehiculo.H + 1e-6);
        // Un pallet conserva su altura: si el motor lo tumbó, x.h sería su largo o su ancho
        if (x.pal >= 0) expect(x.h).toBe(defs[x.pal].alto);
      });
    });
  }, 300000);
});
