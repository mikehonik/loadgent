import { describe, it, expect } from "vitest";
import { rotar, mover, pegar, quitar, colocar, validar, zConGravedad, recalcularContenedor } from "./edicion.js";

const veh = { L: 3000, W: 2000, H: 2000 };
const caja = (d) => ({ x: 0, y: 0, z: 0, l: 600, w: 400, h: 400, idx: 0, ori: 1, peso: 10, pal: -1, ...d });
const items = [{ nombre: "A", oris: [true, true, false, false, false, false], soportaEncima: true, piso: "libre" }, { nombre: "Frágil", oris: [true, true, false, false, false, false], soportaEncima: false, piso: "libre" }];
const ctx = { items, pallets: [], reglas: { soporteMin: 0.75 }, cargaMax: 0 };

describe("gravedad y movimientos", () => {
  it("al mover sobre otra caja, cae encima de ella", () => {
    const cs = [caja(), caja({ x: 1000 })];
    const r = mover(cs, 1, -1000, 0, veh);
    expect(r[1]).toMatchObject({ x: 0, z: 400 });
    expect(validar(r, veh, ctx).color).toBe("verde");
  });
  it("mover no deja salir del vehículo", () => {
    const r = mover([caja()], 0, -500, 5000, veh);
    expect(r[0]).toMatchObject({ x: 0, y: 1600 });
  });
  it("rotar cambia largo por ancho, la orientación a girada, y gira sobre su centro", () => {
    const r = rotar([caja({ x: 1000, y: 800 })], 0, veh);
    expect(r[0]).toMatchObject({ l: 400, w: 600, ori: 2, x: 1100, y: 700 });
  });
  it("pegar recorre hasta la vecina o la pared", () => {
    const cs = [caja(), caja({ x: 2000 })];
    expect(pegar(cs, 1, "fondo", veh)[1].x).toBe(600);
    expect(pegar(cs, 0, "puertas", veh)[0].x).toBe(1400);
    expect(pegar(cs, 0, "izquierda", veh)[0].y).toBe(1600);
  });
  it("zConGravedad encuentra el hueco más bajo; null si ya no cabe de alto", () => {
    const cs = [caja(), caja({ z: 400 }), caja({ z: 800 }), caja({ z: 1200 })];
    expect(zConGravedad(cs, caja(), veh)).toBe(1600);
    expect(zConGravedad([...cs, caja({ z: 1600 })], caja(), veh)).toBeNull();
  });
});

describe("validar", () => {
  it("detecta caja flotando, encimada, fuera del vehículo, sobre una que no soporta, y orientación no permitida", () => {
    const cs = [caja({ z: 500 }), caja({ x: 1000 }), caja({ x: 1100 }), caja({ x: 2800 }), caja({ idx: 1, x: 0, y: 1000 }), caja({ x: 0, y: 1000, z: 400 }), caja({ x: 2000, y: 1500, ori: 3 })];
    const v = validar(cs, veh, ctx);
    expect(v.porCaja[0]).toContain("está flotando");
    expect(v.porCaja[1]).toContain("se encima con otro bulto");
    expect(v.porCaja[3]).toContain("se sale del vehículo");
    expect(v.porCaja[5].join(" ")).toMatch(/Frágil, que no soporta carga encima/);
    expect(v.porCaja[6]).toContain("va en una orientación que el producto no permite");
    expect(v.color).toBe("rojo");
  });
  it("apoyo parcial por debajo del mínimo", () => {
    const v = validar([caja(), caja({ x: 300, z: 400 })], veh, ctx);
    expect(v.porCaja[1].join(" ")).toMatch(/50% de apoyo/);
  });
  it("peso total mayor al máximo del vehículo", () => {
    const v = validar([caja({ peso: 600 }), caja({ x: 1000, peso: 600 })], veh, { ...ctx, cargaMax: 1000 });
    expect(v.generales[0]).toMatch(/1,200 kg/);
  });
  it("un pallet sobre otro solo si el de abajo es plano y acepta pallet", () => {
    const pal = (d) => caja({ l: 1200, w: 1000, h: 900, pal: 0, idx: 0, ...d });
    const itemsP = [{ nombre: "P", aceptaPallet: true, aceptaCajas: true }];
    const cs = [pal(), pal({ z: 900 })];
    expect(validar(cs, veh, { ...ctx, items: itemsP, pallets: [{ techoPlano: true }] }).color).toBe("verde");
    expect(validar(cs, veh, { ...ctx, items: itemsP, pallets: [{ techoPlano: false }] }).porCaja[1][0]).toMatch(/no acepta otro pallet/);
  });
});

describe("quitar y colocar", () => {
  it("colocar pone la caja en el primer lugar válido desde el fondo, y la gira si hace falta", () => {
    const { cajas, quitada } = quitar([caja(), caja({ x: 600 })], 1);
    expect(cajas).toHaveLength(1);
    const r = colocar(cajas, quitada, veh, ctx);
    expect(r).toHaveLength(2);
    expect(validar(r, veh, ctx).color).toBe("verde");
    expect(r[1].x).toBe(0);   // junto a la primera, al fondo
  });
  it("sin lugar devuelve null", () => {
    const lleno = [caja({ l: 3000, w: 2000, h: 2000 })];
    expect(colocar(lleno, caja(), veh, ctx)).toBeNull();
  });
});

describe("recalcularContenedor", () => {
  it("suma peso y volumen, y ordena del fondo a las puertas sin poner una caja antes de la que la sostiene", () => {
    const cs = [caja({ x: 1200 }), caja({ x: 300, z: 400, l: 600 }), caja({ x: 0 }), caja({ x: 600 })];
    const c = recalcularContenedor({ cajas: [] }, cs, items);
    expect(c.peso).toBe(40);
    expect(c.vol).toBe(4 * 600 * 400 * 400);
    const pos = (x, z) => c.cajas.findIndex((k) => k.x === x && k.z === z);
    expect(pos(300, 400)).toBeGreaterThan(pos(0, 0));
    expect(pos(300, 400)).toBeGreaterThan(pos(600, 0));
  });
});
