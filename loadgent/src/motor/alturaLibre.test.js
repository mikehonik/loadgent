import { describe, it, expect } from "vitest";
import { correr, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";
const it0 = (d = {}) => ({ id: 1, nombre: "CAJA", desc: "", color: null, L: 400, W: 300, H: 300, peso: 2, qty: 400, oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: true, palletId: 0, porPallet: 0, porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d });
const vehiculo = { L: 12032, W: 2352, H: 2690, tara: 3800, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const tarimas = [{ nombre: "Universal", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 0, ovL: 0, ovW: 0 }];
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);
describe("pallet sin límite de altura", () => {
  it("apila hasta el techo del vehículo y mete más cajas por pallet", async () => {
    const a = await correr({ items: [it0()], vehiculo, tarimas, reglas }, { ejecutor });
    const b = await correr({ items: [it0({ altLibre: true })], vehiculo, tarimas, reglas }, { ejecutor });
    const cajasPal = (c) => c.resultado.pallets[0].n, alto = (c) => c.resultado.pallets[0].alto;
    expect(alto(a)).toBeLessThanOrEqual(1800);
    expect(alto(b)).toBeGreaterThan(1800);
    expect(alto(b)).toBeLessThanOrEqual(2690);
    expect(cajasPal(b)).toBeGreaterThan(cajasPal(a));
    expect(b.resultado.contenedores.length).toBeLessThanOrEqual(a.resultado.contenedores.length);
  }, 120000);
});
