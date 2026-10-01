import { describe, it, expect } from "vitest";
import { tieneBundle, lineasBundle, repartirAbiertos, expandirBundles } from "./bundle.js";

const linea = (d = {}) => ({ id: 1, nombre: "DU2014501", qty: 189, L: 300, W: 200, H: 150, peso: 3, piezas: 1, oris: [true, true, false, false, false, false],
  enBundle: true, bundleCantidadEstandar: 10, bundleL: 1200, bundleW: 1000, bundleH: 1500, bundlePeso: 220, ...d });

describe("tieneBundle", () => {
  it("necesita cajas por Bundle y las tres medidas", () => {
    expect(tieneBundle(linea())).toBe(true);
    expect(tieneBundle(linea({ bundleCantidadEstandar: 0 }))).toBe(false);
    expect(tieneBundle(linea({ bundleH: 0 }))).toBe(false);
    expect(tieneBundle(null)).toBe(false);
  });
});

describe("expandirBundles", () => {
  it("sin abrir: todos los Bundles completos y el resto suelto (189 con Bundle de 10 → 18 BDL + 9 sueltas)", () => {
    const r = expandirBundles([linea()]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ esBundle: true, qty: 18, L: 1200, W: 1000, H: 1500, peso: 220, umCaja: "BDL", paletizar: false, lineaId: 1 });
    expect(r[1]).toMatchObject({ id: "1-suelto", qty: 9, L: 300, deBundle: true, lineaId: 1, abiertos: 0 });
    expect(r[0].qty * 10 + r[1].qty).toBe(189);
  });
  it("los Bundles abiertos pasan como cajas sueltas y se conserva el 100% de lo pedido", () => {
    const r = expandirBundles([linea()], { 1: 3 });
    expect(r[0].qty).toBe(15);
    expect(r[1]).toMatchObject({ qty: 39, abiertos: 3 });
    expect(r[0].qty * 10 + r[1].qty).toBe(189);
  });
  it("abrir todos deja la línea completamente suelta", () => {
    const r = expandirBundles([linea({ qty: 40 })], { 1: 99 });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ qty: 40, deBundle: true }); expect(r[0].esBundle).toBeFalsy();
  });
  it("peso del Bundle en 0: peso de la caja × cajas por Bundle; no hereda paletizado ni forma", () => {
    const r = expandirBundles([linea({ bundlePeso: 0, paletizar: true, porPallet: 24, forma: "barril", anidado: 50 })]);
    expect(r[0]).toMatchObject({ peso: 30, paletizar: false, porPallet: 0, forma: "caja", anidado: 0 });
  });
  it("líneas que no van en Bundle (o sin configuración) pasan igual", () => {
    const suelta = linea({ id: 2, enBundle: false });
    const sinConfig = linea({ id: 3, bundleL: 0 });
    const r = expandirBundles([suelta, sinConfig]);
    expect(r[0]).toBe(suelta);
    expect(r[1]).toMatchObject({ id: 3, qty: 189, enBundle: false });
  });
});

describe("repartirAbiertos", () => {
  const lineas = [{ id: "a", bundles: 10 }, { id: "b", bundles: 5 }, { id: "c", bundles: 1 }];
  it("reparte en proporción y nunca más de los que tiene cada línea", () => {
    const r = repartirAbiertos(lineas, 6);
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(6);
    expect(r.a).toBeGreaterThanOrEqual(r.b);
    expect(repartirAbiertos(lineas, 99)).toEqual({ a: 10, b: 5, c: 1 });
    expect(repartirAbiertos(lineas, 0)).toEqual({});
  });
  it("lineasBundle cuenta los Bundles completos de cada línea", () => {
    expect(lineasBundle([linea(), linea({ id: 2, qty: 5 }), linea({ id: 3, enBundle: false })])).toEqual([{ id: 1, nombre: "DU2014501", bundles: 18, cajasPorBundle: 10 }]);
  });
});

describe("cajas por Bundle con decimales del CS-BDL", () => {
  it("23.999999… se toma como 24: 24 cajas son 1 Bundle y ninguna suelta", () => {
    const r = expandirBundles([linea({ qty: 24, bundleCantidadEstandar: 23.999999999999996 })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ esBundle: true, qty: 1, cantidadPorBundle: 24 });
  });
});
