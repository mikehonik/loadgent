import { describe, it, expect } from "vitest";
import { correr, ejecutorEnProceso, prepararEntrada, holguraPorMezcla } from "./corrida.js";
import { optimizar } from "./motor.js";

const it0 = (d = {}) => ({ id: 1, nombre: "A", desc: "", color: null, L: 495, W: 388, H: 451, peso: 10, qty: 100,
  oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
  piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
  porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d });
const vehiculo = { L: 12031, W: 2352, H: 2698, tara: 3980, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const tarimas = [{ nombre: "U", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 1500, ovL: 0, ovW: 0 }];
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);

describe("holgura por mezcla", () => {
  it("crece con la variedad y topa en 6 mm", () => {
    expect([1, 2, 3, 4, 30].map(holguraPorMezcla)).toEqual([0, 2, 4, 6, 6]);
  });

  it("ya no engorda la caja: las medidas que recibe el motor son las reales", () => {
    const items = [it0(), it0({ id: 2, nombre: "B" }), it0({ id: 3, nombre: "C" }), it0({ id: 4, nombre: "D" })];
    const e = prepararEntrada({ items, vehiculo, tarimas, reglas });
    expect(e.reglas.holgura).toBe(6);
    e.items.forEach((x) => { expect(x.L).toBe(495); expect(x.W).toBe(388); });
  });

  it("con un solo SKU no hay holgura, ni en las reglas ni en el resultado", async () => {
    const e = prepararEntrada({ items: [it0()], vehiculo, tarimas, reglas });
    expect(e.reglas.holgura).toBe(0);
    const c = await correr({ items: [it0()], vehiculo, tarimas, reglas }, { ejecutor });
    expect(c.resultado.contenedores[0].cajas.length).toBe(100);
  });

  it("se apaga con «simular la carga real»", () => {
    const items = [it0(), it0({ id: 2, nombre: "B" })];
    expect(prepararEntrada({ items, vehiculo, tarimas, reglas: { ...reglas, compresionAuto: false } }).reglas.holgura).toBe(0);
  });

  it("dentro de un bloque las cajas van pegadas: solo se paga en la junta entre bloques", async () => {
    // Dos SKUs iguales de 100 cajas: antes cada caja crecía 2 mm y una fila de 24 perdía 48 mm.
    const items = [it0(), it0({ id: 2, nombre: "B" })];
    const c = await correr({ items, vehiculo, tarimas, reglas }, { ejecutor });
    const cajas = c.resultado.contenedores[0].cajas;
    const deA = cajas.filter((x) => x.idx === 0).sort((a, b) => a.y - b.y || a.x - b.x);
    // hay al menos un par del mismo SKU pegado al milímetro
    const pegadas = deA.some((a) => deA.some((b) => b !== a && a.z === b.z && a.y === b.y && Math.abs(b.x - (a.x + a.l)) < 1e-6));
    expect(pegadas).toBe(true);
  });

  it("entre bloques de SKUs distintos sí queda separación", async () => {
    const items = [it0({ qty: 60 }), it0({ id: 2, nombre: "B", qty: 60 })];
    const c = await correr({ items, vehiculo, tarimas, reglas }, { ejecutor });
    const cajas = c.resultado.contenedores[0].cajas;
    const a = cajas.filter((x) => x.idx === 0), b = cajas.filter((x) => x.idx === 1);
    // ninguna caja de A queda pegada al milímetro contra una de B en el eje largo
    const pegadasEntreSkus = a.some((p) => b.some((q) => p.z === q.z && p.y === q.y && Math.abs(q.x - (p.x + p.l)) < 1e-6));
    expect(pegadasEntreSkus).toBe(false);
  });

  it("la holgura ya no se cobra por caja, así que con variedad entra más carga", async () => {
    const mezcla = [
      it0({ qty: 300 }),
      it0({ id: 2, nombre: "B", L: 598, W: 356, H: 254, peso: 6, qty: 124 }),
      it0({ id: 3, nombre: "C", L: 1090, W: 1030, H: 2322, peso: 343, qty: 7 }),
      it0({ id: 4, nombre: "D", L: 1230, W: 920, H: 2208, peso: 312, qty: 10 }),
    ];
    const r4 = { ...reglas, nivel: 4 };
    const con = await correr({ items: mezcla, vehiculo, tarimas, reglas: r4 }, { ejecutor });
    const sin = await correr({ items: mezcla, vehiculo, tarimas, reglas: { ...r4, compresionAuto: false } }, { ejecutor });
    const bultos = (c) => c.resultado.contenedores[0].cajas.length;
    // la holgura sigue costando algo (es real), pero ya no puede costar una fracción grande de la carga
    expect(bultos(con)).toBeGreaterThan(bultos(sin) * 0.95);
  }, 300000);
});
