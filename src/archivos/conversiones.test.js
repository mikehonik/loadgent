import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { leerConversiones, aCajas, filasConversiones, conversionesDeHoja, nombreUM } from "./conversiones.js";

const libro = (filas, hoja = "Sheet1") => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), hoja);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
};
const PS = [["SETID", "INV_ITEM_ID", "UNIT_OF_MEASURE", "CONVERSION_RATE"],
  ["COR01", "A-1", "ML", 1], ["COR01", "A-1", "CJ", 0.2], ["COR01", "A-1", "UN", 0.001],
  ["COR01", "B-2", "KG", 1], ["COR01", "B-2", "CJ", 12], ["COR01", "B-2", "PLT", 600],
  ["COR01", "C-3", "UN", 1], ["COR01", "C-3", "BL", 25]];

describe("leerConversiones", () => {
  it("lee el formato de PeopleSoft y agrupa por SKU", () => {
    const r = leerConversiones(libro(PS));
    expect(r.filas).toBe(8);
    expect(r.skus).toBe(3);
    expect(r.ums).toEqual(["BL", "CJ", "KG", "ML", "PLT", "UN"]);
    expect(r.porSku["a-1"]).toEqual({ ML: 1, CJ: 0.2, UN: 0.001 });
  });

  it("se queda solo con los SKUs del maestro cuando se le pasa la lista", () => {
    const r = leerConversiones(libro(PS), new Set(["a-1"]));
    expect(r.skus).toBe(1);
    expect(r.sinUsar).toBe(5);
  });

  it("acepta encabezados en español y avisa si faltan columnas", () => {
    const r = leerConversiones(libro([["SKU", "Unidad", "Factor"], ["X", "cj", "2,5"]]));
    expect(r.porSku.x).toEqual({ CJ: 2.5 });
    expect(() => leerConversiones(libro([["SKU", "Otra"], ["X", 1]]))).toThrow(/unidad/i);
    expect(() => leerConversiones(libro([["Cosa", "Unidad", "Factor"], [1, "CJ", 1]]))).toThrow(/SKU/);
  });
});

describe("aCajas", () => {
  const A = { ML: 1, CJ: 0.2, UN: 0.001 }, B = { KG: 1, CJ: 12, PLT: 600 };
  it("convierte entre unidades usando la unidad base", () => {
    expect(aCajas(5, "ML", "CJ", A)).toMatchObject({ cajas: 25, exacto: true });   // 5 millares = 5000 un, caja de 200
    expect(aCajas(2000, "UN", "CJ", A)).toMatchObject({ cajas: 10, exacto: true });
    expect(aCajas(3, "PLT", "CJ", B)).toMatchObject({ cajas: 150, exacto: true }); // 1 tarima = 600 kg, caja de 12 kg
  });

  it("no toca la cantidad si no hay unidad o ya viene en la unidad de la caja", () => {
    expect(aCajas(7, "", "CJ", A)).toMatchObject({ cajas: 7, exacto: true });
    expect(aCajas(7, "cj", "CJ", A)).toMatchObject({ cajas: 7, exacto: true });
  });

  it("conserva los decimales de la cantidad y solo redondea el resultado en cajas", () => {
    const T = { UN: 1, CJ: 24, ML: 1000, PQ: 6 };
    expect(aCajas(0.4, "ML", "CJ", T)).toMatchObject({ cajas: 17, exacto: false });   // 400 piezas ÷ 24
    expect(aCajas(2.5, "ML", "CJ", T)).toMatchObject({ cajas: 105, exacto: false });
    expect(aCajas(0.048, "ML", "CJ", T)).toMatchObject({ cajas: 2, exacto: true });   // 48 piezas = 2 cajas exactas
    expect(aCajas(12, "PQ", "CJ", T)).toMatchObject({ cajas: 3, exacto: true });      // 72 piezas ÷ 24
    expect(aCajas(3.2, "", "CJ", T)).toMatchObject({ cajas: 4, exacto: false });      // cajas partidas: sube a entero
  });

  it("si la UM de la caja no existe para ese SKU usa la primera unidad de bulto que sí exista", () => {
    const T = { UN: 1, BL: 200, ML: 1000 };
    expect(aCajas(4, "ML", "CJ", T)).toMatchObject({ cajas: 20, destino: "BL", cambioDeUM: "BL" });
    expect(aCajas(4, "ML", "CJ", { UN: 1, ML: 1000 }).motivo).toMatch(/unidad de empaque/);
  });

  it("respeta la unidad del pedido cuando ya es un bulto (incluye rollos), sin convertirla a PQ", () => {
    const T = { UN: 1, CJ: 24, PQ: 6, ML: 1000 };
    // El pedido viene en cajas: son cajas, aunque el maestro diga otra cosa
    expect(aCajas(40, "CJ", "PQ", T)).toMatchObject({ cajas: 40, destino: "CJ" });
    expect(aCajas(40, "BL", "CJ", T)).toMatchObject({ cajas: 40, destino: "BL" });
    expect(aCajas(6, "RL", "CJ", T)).toMatchObject({ cajas: 6, destino: "RL" });
    // PQ sí se convierte, porque no es una unidad de bulto
    expect(aCajas(12, "PQ", "CJ", T)).toMatchObject({ cajas: 3, destino: "CJ" });
    // y nunca se elige PQ como destino
    expect(aCajas(2, "ML", "XX", T)).toMatchObject({ destino: "CJ" });
  });

  it("usa las piezas por caja del maestro cuando el pedido viene en unidades (UN)", () => {
    // Caso real: tejas sin factor de caja en el ERP, solo piezas. 500 UN con 50 piezas/paquete = 10 paquetes.
    expect(aCajas(500, "UN", "BL", null, 50)).toMatchObject({ cajas: 10, exacto: true, viaPiezas: true });
    expect(aCajas(505, "UN", "BL", {}, 50)).toMatchObject({ cajas: 11, exacto: false, viaPiezas: true });
    // Sin piezasPorCaja, sigue sin poder convertir: se copia la cantidad y se marca con motivo
    expect(aCajas(500, "UN", "BL", null)).toMatchObject({ cajas: 500, exacto: false, motivo: expect.stringContaining("tabla") });
  });

  it("prefiere las piezas por caja del maestro sobre el factor del ERP cuando el pedido no viene en UN", () => {
    // El ERP dice que 1 millar son 1000 piezas; el maestro dice que la caja real lleva 40 piezas.
    const T = { UN: 1, ML: 1000 };
    expect(aCajas(2, "ML", "CJ", T, 40)).toMatchObject({ cajas: 50, exacto: true, viaPiezas: true });
  });

  it("caso real: SKU que en el ERP solo tiene ML=1 y nada más (sin factor de caja ni de piezas)", () => {
    // Antes: se copiaba la cantidad tal cual (50 ML -> "50 cajas"), un salto de escala sin sentido.
    // Sin ninguna forma de saber cuántas piezas trae un ML de este SKU, no hay dato inventable:
    // se avisa con motivo en vez de fingir una conversión. Las piezas por caja no ayudan aquí
    // porque la tabla tampoco trae UN (piezas), así que no hay puente entre ML y piezas.
    const T = { ML: 1 };
    const r = aCajas(50, "ML", "CJ", T, 60);
    expect(r.motivo).toMatch(/no tiene la equivalencia/);
    expect(r.cajas).toBe(50); // limitación real: falta el factor UN en el ERP para poder usar piezasPorCaja
  });

  it("redondea hacia arriba y avisa cuando falta la equivalencia", () => {
    expect(aCajas(1, "UN", "CJ", A)).toMatchObject({ cajas: 1, exacto: false });
    expect(aCajas(2050, "UN", "CJ", A)).toMatchObject({ cajas: 11, exacto: false });
    expect(aCajas(5, "PQ", "CJ", A).motivo).toMatch(/PQ/);
    expect(aCajas(5, "ML", "BL", A)).toMatchObject({ cajas: 25, destino: "CJ" });
    expect(aCajas(5, "ML", "CJ", null).motivo).toMatch(/tabla/);
  });
});

describe("hoja Conversiones del maestro", () => {
  it("guarda solo los SKUs del maestro, en su orden, y se vuelve a leer igual", () => {
    const { porSku } = leerConversiones(libro(PS));
    const productos = [{ sku: "B-2" }, { sku: "A-1" }];
    const filas = filasConversiones(porSku, productos);
    expect(filas.map((f) => f[0])).toEqual(["B-2", "B-2", "B-2", "A-1", "A-1", "A-1"]);
    const ws = XLSX.utils.aoa_to_sheet([["SKU", "UM", "Factor"], ...filas]);
    expect(conversionesDeHoja(ws)).toEqual({ "b-2": porSku["b-2"], "a-1": porSku["a-1"] });
    expect(porSku["a-1"]).toBeTruthy();
    expect(conversionesDeHoja(XLSX.utils.aoa_to_sheet([["SKU", "UM", "Factor"]]))).toBeNull();
  });

  it("también escribe conversiones guardadas con la llave vieja (sin guion)", () => {
    const filas = filasConversiones({ a1: { CJ: 2 } }, [{ sku: "A-1" }]);
    expect(filas).toEqual([["A-1", "CJ", 2]]);
  });
});

describe("nombreUM", () => {
  it("traduce las unidades conocidas", () => {
    expect(nombreUM("ml")).toBe("Millar (1,000 unidades)");
    expect(nombreUM("XX")).toBe("");
  });
});
