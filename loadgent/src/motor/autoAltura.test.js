import { describe, it, expect } from "vitest";
import { correr, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";

// Si el maestro dice que en planta arman 8 niveles y en la altura del catálogo solo entran 6, la que está
// mal es la altura del catálogo. El pallet se arma contra el techo del vehículo en lugar de recortarse.
const base = { id: 1, nombre: "A", desc: "", color: null, L: 400, W: 330, H: 300, peso: 6, qty: 368,
  oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
  piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: true, palletId: 0, porPallet: 0,
  porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false };
const vehiculo = { L: 12032, W: 2352, H: 2698, tara: 3900, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const palletCon = (d) => [{ nombre: "Americano", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1500, ovL: 15, ovW: 15, ...d }];
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);
const alto = async (tarimas, it) => (await correr({ items: [{ ...base, ...it }], vehiculo, tarimas, reglas }, { ejecutor })).resultado.pallets[0].alto;

describe("altura automática del pallet", () => {
  it("el estándar que no cabe en el catálogo sube hasta el techo", async () => {
    // 8 niveles de 300 mm + 150 de tarima = 2,550 mm: no cabe en 1,800 pero sí en el vehículo de 2,698
    expect(await alto(palletCon({}), { capasPallet: 8 })).toBe(2550);
  });
  it("el estándar que sí cabe respeta la altura del catálogo", async () => {
    expect(await alto(palletCon({}), { capasPallet: 5 })).toBe(1650);
  });
  it("sin estándar capturado no se cambia nada: manda el catálogo", async () => {
    expect(await alto(palletCon({}), {})).toBeLessThanOrEqual(1800);
  });
  it("se puede apagar por pallet", async () => {
    expect(await alto(palletCon({ autoAltura: false }), { capasPallet: 8 })).toBeLessThanOrEqual(1800);
  });
  it("«sin límite de altura» en la línea sigue mandando sobre todo", async () => {
    expect(await alto(palletCon({ autoAltura: false }), { altLibre: true })).toBeGreaterThan(1800);
  });
});
