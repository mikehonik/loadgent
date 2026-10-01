import { describe, it, expect } from "vitest";
import { armarReporte, ORIENTACIONES } from "./reporte.js";
import { correr, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";

const caja = (d = {}) => ({
  id: 0, color: "#000", desc: "", nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 20, piezas: 1,
  oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
  piso: "libre", soportaEncima: true, grupo: "", orden: 0, paletizar: false, palletId: 0, porPallet: 0,
  resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d,
});
const vehiculo = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const correrReal = (items) => correr({ items, vehiculo, tarimas: [], reglas }, { ejecutor: ejecutorEnProceso(optimizar) });

describe("armarReporte", () => {
  it("resuelve nombres, ordena la lista por orden de carga y cuadra los totales", async () => {
    const items = [caja({ id: 1, nombre: "Zeta", orden: 0, qty: 10, piezas: 6 }), caja({ id: 2, nombre: "Alfa", orden: 2, qty: 5 }), caja({ id: 3, nombre: "Beta", orden: 1, qty: 8, peso: 20 })];
    const R = armarReporte(await correrReal(items));
    expect(R.contenedores).toHaveLength(1);
    const t = R.contenedores[0];
    expect(t.lista.map((f) => f.nombre)).toEqual(["Beta", "Alfa", "Zeta"]);
    expect(t.lista.map((f) => f.ordenTxt)).toEqual([1, 2, "Libre"]);
    expect(t.lista.find((f) => f.nombre === "Zeta").piezas).toBe(60);
    expect(t.lista.find((f) => f.nombre === "Beta").peso).toBe(160);
    expect(t.nCajas).toBe(23); expect(t.nBultos).toBe(23); expect(t.nPallets).toBe(0);
    expect(t.pesoBruto).toBe(t.peso + vehiculo.tara);
    expect(R.totales.cajas).toBe(23);
    expect(R.totales.m3Cap).toBeCloseTo(t.m3Cap, 6);
  });

  it("los pasos cubren todas las cajas en orden y con textos con nombre", async () => {
    const R = armarReporte(await correrReal([caja({ nombre: "Cajita", qty: 12 })]));
    const t = R.contenedores[0];
    expect(t.pasos[0].ini).toBe(0);
    expect(t.pasos.at(-1).fin).toBe(12);
    expect(t.pasos.reduce((a, p) => a + p.n, 0)).toBe(12);
    expect(t.pasos[0].texto).toMatch(/^Coloca \d+ cajas? de Cajita/);
    expect(ORIENTACIONES).toContain(t.pasos[0].forma);
  });

  it("tipifica los avisos: lo que no cabe se nombra, lo que sobra se cuenta", async () => {
    const R = armarReporte(await correrReal([caja({ nombre: "Enorme", L: 7000, qty: 2 }), caja({ nombre: "Normal", qty: 5 })]));
    expect(R.avisos.map((a) => a.tipo)).toEqual(["noCaben"]);
    expect(R.avisos[0].nombres).toEqual(["Enorme"]);
    expect(R.avisos[0].texto).toContain("Enorme");
  });

  it("sin problemas no hay avisos", async () => {
    const R = armarReporte(await correrReal([caja()]));
    expect(R.avisos).toEqual([]);
    expect(R.pallets).toEqual([]);
  });

  it("entregas: zona desde las puertas, pedidos por parada y bultos que estorban", async () => {
    const items = [caja({ id: 1, nombre: "A", qty: 8, orden: 1, grupo: "PED-1" }), caja({ id: 2, nombre: "B", qty: 8, orden: 1, grupo: "PED-2" }), caja({ id: 3, nombre: "C", qty: 8, orden: 2 })];
    const R = armarReporte(await correrReal(items));
    expect(R.conEntregas).toBe(true);
    const t = R.contenedores[0];
    expect(t.estorban).toBe(0);
    expect(t.entregas.map((e) => [e.orden, e.n, e.pedidos])).toEqual([[1, 16, ["PED-1", "PED-2"]], [2, 8, []]]);
    expect(t.entregas[0].desdePuertas).toBeCloseTo(vehiculo.L - t.entregas[0].x1, 6);
    expect(t.entregas[0].desdePuertas).toBeLessThan(t.entregas[1].desdePuertas);
  });

  it("sin entregas capturadas el reporte lo dice", async () => {
    const R = armarReporte(await correrReal([caja()]));
    expect(R.conEntregas).toBe(false);
    expect(R.contenedores[0].entregas).toEqual([]);
  });

  it("con tarimas: cuenta pallets usados, cajas en pallet y pasos de pallet", async () => {
    const tarimas = [{ nombre: "Universal", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }];
    const items = [caja({ nombre: "Paletizada", qty: 24, paletizar: true, palletId: 0 })];
    const R = armarReporte(await correr({ items, vehiculo, tarimas, reglas }, { ejecutor: ejecutorEnProceso(optimizar) }));
    const t = R.contenedores[0];
    expect(R.pallets.length).toBeGreaterThan(0);
    expect(R.pallets.every((d) => d.usos > 0 && d.nSkus === 1)).toBe(true);
    expect(R.pallets.reduce((a, d) => a + d.usos, 0)).toBe(t.nPallets);
    expect(t.pallets.map((d) => d.nombre)).toEqual(R.pallets.map((d) => d.nombre));
    expect(t.nPallets).toBeGreaterThan(0);
    expect(t.lista[0].enPallet).toBe(24);
    expect(t.lista[0].sueltas).toBe(0);
    expect(t.nCajas).toBe(24);
    expect(t.pasos.some((p) => p.forma === "Pallet" && /^Coloca \d+ pallets? «/.test(p.texto))).toBe(true);
  });

  it("tipifica lo que sobra y los avisos del motor a partir de un resultado crudo", () => {
    const resultado = { contenedores: [], pallets: [], sinCargar: 7, noCaben: [], avisos: ["Aviso del motor."], estrategiasProbadas: 1 };
    const R = armarReporte({ resultado, carga: { items: [caja()], vehiculo, tarimas: [], reglas } });
    expect(R.avisos.map((a) => a.tipo)).toEqual(["sinCargar", "motor"]);
    expect(R.avisos[0].n).toBe(7);
    expect(R.avisos[0].texto).toContain("7 bultos");
    expect(R.avisos[1].texto).toBe("Aviso del motor.");
    expect(R.contenedores).toEqual([]);
    expect(R.totales).toEqual({ cajas: 0, kg: 0, m3: 0, m3Cap: 0 });
  });
});

describe("orientaciones por línea", () => {
  it("cuenta cómo quedó acomodada cada caja del SKU y trae sus medidas", () => {
    const carga = {
      items: [{ nombre: "A", desc: "", L: 600, W: 400, H: 300, peso: 8, piezas: 1, orden: 0, oris: [true, true, true, false, false, false] }],
      vehiculo: { L: 12000, W: 2400, H: 2600, tara: 0, maxKg: 0 }, tarimas: [], reglas: {},
    };
    const resultado = {
      contenedores: [{ vol: 7.2e8, peso: 80, cajas: [
        { idx: 0, pal: -1, ori: 1, peso: 8, x: 0, y: 0, z: 0, l: 600, w: 400, h: 300 },
        { idx: 0, pal: -1, ori: 1, peso: 8, x: 600, y: 0, z: 0, l: 600, w: 400, h: 300 },
        { idx: 0, pal: -1, ori: 3, peso: 8, x: 1200, y: 0, z: 0, l: 600, w: 300, h: 400 },
      ] }], pallets: [], avisos: [], noCaben: [], sinCargar: 0,
    };
    const f = armarReporte({ resultado, carga }).contenedores[0].lista[0];
    expect(f.orientaciones).toEqual([{ ori: 1, nombre: "De pie", n: 2 }, { ori: 3, nombre: "Acostada", n: 1 }]);
    expect(f.permitidas).toEqual([0, 1, 2]);
    expect([f.L, f.W, f.H]).toEqual([600, 400, 300]);
  });
});

const reglasMotor = { ...reglas, soporteMin: reglas.soporteMin / 100 };

describe("carga por eje y metros lineales en el reporte", () => {
  it("trae ejes cuando el vehículo los tiene configurados, y null cuando no", () => {
    const items = [caja({ nombre: "A", qty: 10, peso: 100 })];
    const vehConEjes = { ...vehiculo, ejeDelantero: 5000, ejeTrasero: 20000, xEjeDelantero: -1000, xEjeTrasero: 8000, tara: 3000 };
    const conEjes = optimizar(items, vehConEjes, reglasMotor, null, []);
    const rCon = armarReporte({ resultado: conEjes, carga: { items, vehiculo: vehConEjes, tarimas: [], reglas } });
    expect(rCon.contenedores[0].ejes).not.toBeNull();
    expect(rCon.contenedores[0].ejes.delantero.carga + rCon.contenedores[0].ejes.trasero.carga).toBeCloseTo(rCon.contenedores[0].pesoBruto, 0);

    const sinEjes = optimizar(items, vehiculo, reglasMotor, null, []);
    const rSin = armarReporte({ resultado: sinEjes, carga: { items, vehiculo, tarimas: [], reglas } });
    expect(rSin.contenedores[0].ejes).toBeNull();
  });

  it("los metros libres más los usados dan el largo del vehículo", () => {
    const items = [caja({ nombre: "A", L: 1000, qty: 3, peso: 50 })];
    const r = optimizar(items, vehiculo, reglasMotor, null, []);
    const rep = armarReporte({ resultado: r, carga: { items, vehiculo, tarimas: [], reglas } });
    const c = rep.contenedores[0];
    expect(c.mUsados + c.mLibres).toBeCloseTo(c.mTotal, 3);
    expect(c.mUsados).toBeGreaterThan(0);
    expect(c.mUsados).toBeLessThanOrEqual(c.mTotal);
  });
});
