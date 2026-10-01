import { describe, it, expect } from "vitest";
import { auditarMaestro, compararPallets, vehiculosNecesarios } from "./herramientas.js";
import { prepararEntrada } from "./corrida.js";

const prod = (d) => ({ pid: d.sku, sku: "X", L: 400, W: 300, H: 250, peso: 8, oris: [true, true, false, false, false, false], ...d });
const pallets = [{ nombre: "Americano 1219×1016", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }, { nombre: "Europeo 1200×800", L: 1200, W: 800, esp: 144, peso: 25, altMax: 1800, maxKg: 1000, ovL: 0, ovW: 0 }];
const veh = { id: "53", nombre: "53'", L: 16000, W: 2500, H: 2700, tara: 0, maxKg: 30000 };
const veh20 = { id: "20", nombre: "20'", L: 5898, W: 2352, H: 2393, tara: 0, maxKg: 28000 };
const listo = (d = {}) => { const e = prepararEntrada({ items: [{ nombre: "X", L: 400, W: 300, H: 250, peso: 8, qty: 1, oris: [true, true, false, false, false, false], piso: "libre", soportaEncima: true, ...d }], vehiculo: null, tarimas: [], reglas: { soporteMin: 75, nivel: 1 } }); return e; };

describe("auditarMaestro", () => {
  it("encuentra cada tipo de problema", () => {
    const r = auditarMaestro([
      prod({ sku: "OK" }), prod({ sku: "CERO", H: 0 }), prod({ sku: "RELLENO", L: 10, W: 10, H: 10, peso: 1 }), prod({ sku: "SINPESO", peso: 0 }),
      prod({ sku: "PLOMO", peso: 500 }), prod({ sku: "PLUMA", L: 2000, W: 1500, H: 1000, peso: 0.1 }), prod({ sku: "GIGANTE", L: 20000 }),
      prod({ sku: "SINORI", oris: [false, false, false, false, false, false] }), prod({ sku: "PALMAL", paletizar: true, tarima: "Inexistente" }), prod({ sku: "OK", pid: "OK2" }),
    ], pallets, [veh]);
    const de = (id) => r.reglas.find((x) => x.id === id).skus.map((p) => p.sku);
    expect(de("cero")).toEqual(["CERO"]);
    expect(de("relleno")).toEqual(["RELLENO"]);
    expect(de("peso")).toEqual(["SINPESO"]);
    expect(de("pesado")).toContain("PLOMO");
    expect(de("ligero")).toContain("PLUMA");
    expect(de("grande")).toEqual(["GIGANTE"]);
    expect(de("orientacion")).toEqual(["SINORI"]);
    expect(de("pallet")).toEqual(["PALMAL"]);
    expect(de("duplicado")).toEqual(["OK"]);
    expect(r.conProblema).toBeGreaterThanOrEqual(9);
  });
});

describe("compararPallets", () => {
  it("calcula cada pallet y marca como mejor el que más cajas mete al vehículo", () => {
    const e = listo();
    const f = compararPallets(e.items[0], pallets, e.reglas, veh);
    expect(f).toHaveLength(2);
    f.forEach((x) => { expect(x.def.n).toBeGreaterThan(0); expect(x.cajasVehiculo).toBeGreaterThan(0); });
    expect(f.filter((x) => x.mejor)).toHaveLength(1);
    const mejor = f.find((x) => x.mejor);
    expect(mejor.cajasVehiculo).toBe(Math.max(...f.map((x) => x.cajasVehiculo)));
  });
});

describe("vehiculosNecesarios", () => {
  it("cuántos de cada vehículo para una cantidad, con flete y costo por caja", () => {
    const e = listo();
    const tarifas = [{ id: 1, vehiculo: "53", destino: "", metodo: "vehiculo", tarifa: 30000, moneda: "MXN" }, { id: 2, vehiculo: "20", destino: "", metodo: "vehiculo", tarifa: 12000, moneda: "MXN" }];
    const f = vehiculosNecesarios(e.items[0], 5000, [veh, veh20], e.reglas, { tarifas });
    const f53 = f.find((x) => x.v.id === "53");
    expect(f53.vehiculos).toBe(Math.ceil(5000 / f53.cap));
    expect(f53.flete).toBe(30000 * f53.vehiculos);
    expect(f53.porCaja).toBeCloseTo(f53.flete / 5000, 5);
    expect(f[0].mejor).toBe(true);
    expect(f[0].flete).toBeLessThanOrEqual(f[1].flete);
  });
  it("en pallets usa la capacidad en pallets completos", () => {
    const e = listo();
    const [r] = vehiculosNecesarios(e.items[0], 1000, [veh], e.reglas, { modo: "pallets", pallet: pallets[0] });
    expect(r.detalle.pallets).toBeGreaterThan(0);
    expect(r.cap).toBe(r.detalle.pallets * r.detalle.porPallet);
  });
});

describe("SKUs de manufactura sin Bundle", () => {
  it("marca los DU sin Bundle y no toca los que sí lo tienen ni los demás SKUs", () => {
    const p = (sku, d = {}) => ({ sku, L: 300, W: 300, H: 250, peso: 5, oris: [true], bundleCantidadEstandar: 0, bundleL: 0, bundleW: 0, bundleH: 0, ...d });
    const r = auditarMaestro([p("DU40B101V"), p("DU-OK", { bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000 }), p("PLY-001")], [], []);
    const regla = r.reglas.find((x) => x.id === "duSinBundle");
    expect(regla.skus.map((x) => x.sku)).toEqual(["DU40B101V"]);
  });
});
