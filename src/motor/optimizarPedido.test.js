import { describe, it, expect } from "vitest";
import { correr, correrConBundles, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";
import { sugerirLlenado, sugerirDisminucion, sumarAlPedido, restarAlPedido } from "./optimizarPedido.js";

const caja = (d = {}) => ({ id: 1, nombre: "SKU-A", desc: "", color: null, L: 600, W: 400, H: 400, peso: 10, qty: 20, oris: [true, true, false, false, false, false],
  volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0,
  porPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d });
const vehiculo = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);
const correrPedido = (items) => correrConBundles({ items, vehiculo, tarimas: [], reglas }, { ejecutor });
const correrCarga = (items) => correr({ items, vehiculo, tarimas: [], reglas }, { ejecutor });

describe("sumar y restar al pedido", () => {
  it("lo extra de una línea paletizada va en una línea suelta aparte", () => {
    const r = sumarAlPedido([caja({ paletizar: true }), caja({ id: 2 })], new Map([[1, 5], [2, 3]]));
    expect(r.find((x) => x.id === 1).qty).toBe(20);
    expect(r.find((x) => x.extraDe === 1)).toMatchObject({ qty: 5, paletizar: false });
    expect(r.find((x) => x.id === 2).qty).toBe(23);
  });
  it("restar nunca deja cantidades negativas y quita las líneas en 0", () => {
    expect(restarAlPedido([caja(), caja({ id: 2, qty: 3 })], new Map([[2, 9]]))).toHaveLength(1);
  });
});

describe("sugerirLlenado", () => {
  it("sugiere más cajas del mismo SKU sin sumar vehículos, y lo comprueba", async () => {
    const r = await sugerirLlenado({ items: [caja()], correrPedido, correrCarga });
    expect(r.cambios).toHaveLength(1);
    expect(r.cambios[0].delta).toBeGreaterThan(50);
    expect(r.despues.n).toBe(1);
    expect(r.despues.ocupaciones[0]).toBeGreaterThan(r.antes.ocupaciones[0]);
  });
  it("respeta las líneas fijas", async () => {
    const r = await sugerirLlenado({ items: [caja()], correrPedido, correrCarga, fijas: new Set([1]) });
    expect(r.cambios).toEqual([]);
    expect(r.motivo).toBe("sinCandidatos");
  });
});

describe("sugerirDisminucion", () => {
  it("baja lo mínimo para usar un vehículo menos", async () => {
    const c = await correrPedido([caja({ qty: 1000 })]);
    const cap = c.resultado.contenedores[0].cajas.length;
    const items = [caja({ qty: cap + 6 })];
    const r = await sugerirDisminucion({ items, nActual: 2, correrPedido });
    expect(r.logrado).toBe(true);
    expect(r.despues.n).toBe(1);
    expect(r.cambios[0].delta).toBeLessThan(0);
    expect(-r.cambios[0].delta).toBeLessThanOrEqual(12);
  });
});
