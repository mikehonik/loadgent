import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { leerMaestro, libroMaestro, leerCubeMaster, productoVacio, leerOris, orisTxt, plantillaDimensiones, actualizarDimensiones, leerBundleMaestro } from "./maestro.js";

const bytes = (ruta) => new Uint8Array(readFileSync(ruta));
const sinPid = ({ pid, ...p }) => p;
const maestroReal = () => leerMaestro(bytes("datos/maestro_productos.xlsx"));
const libro = (hojas) => { const wb = XLSX.utils.book_new(); for (const [n, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), n); return XLSX.write(wb, { type: "array", bookType: "xlsx" }); };

describe("leerMaestro", () => {
  it("lee el maestro de ejemplo completo y sin errores", () => {
    const { productos, tarimas, errores } = maestroReal();
    expect(errores).toEqual([]);
    expect(productos.map((p) => p.sku)).toEqual(["PLY-001", "JNS-010", "CAL-205", "ACC-330", "CHM-120", "BLS-015", "EXH-900", "PRF-044", "BAR-200", "TEJ-001", "TUB-110"]);
    expect(tarimas.map((t) => t.nombre)).toEqual(["Americano 1219×1016", "Universal 1200×1000", "Europeo 1200×800"]);
    expect(tarimas[0]).toEqual({ nombre: "Americano 1219×1016", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 });
  });

  it("traduce los textos de captura a los valores internos", () => {
    const { productos } = maestroReal();
    const por = (sku) => productos.find((p) => p.sku === sku);
    expect(sinPid(por("PLY-001"))).toEqual({ sku: "PLY-001", idProducto: "1002345", categoria: "", desc: "Playera básica algodón (caja 24 pzas)", L: 600, W: 400, H: 300, peso: 8, piezas: 24, oris: [true, true, false, false, false, false],
      volteoPiso: false, compresion: 0, maxNiveles: 0, valorApilar: 1, pesoMaxEncima: 0, forma: "caja", diametro: 0, anidado: 0, maxAnidado: 0, piso: "libre", soportaEncima: true, umCaja: "CJ", paletizar: true, tarima: "Americano 1219×1016", porPallet: 20, porCapa: 0, capasPallet: 0, resto: "mixto",
      aceptaCajas: true, aceptaPallet: false, color: null,
      bundleCantidadEstandar: 0, bundleL: 0, bundleW: 0, bundleH: 0, bundlePeso: 0 });
    expect(por("JNS-010")).toMatchObject({ valorApilar: 2, aceptaPallet: true, porPallet: 16 });
    expect(por("CAL-205")).toMatchObject({ pesoMaxEncima: 60, resto: "parcial", porPallet: 30 });
  });

  it("acepta encabezados con otro formato, reporta SKUs repetidos y medidas faltantes", () => {
    const buf = libro({ Productos: [["Código", "LARGO", "ancho (mm)", "Alto", "Orientaciones", "Posición", "Paletizar", "Compresión bajo carga (%)"], ["A-1", 600, 400, 300, "todas", "solo piso", "mixto", 15], ["a-1", 1, 1, 1, "", "", "", ""], ["B-2", "", 400, 300, "1,3", "nunca piso", "sí", 90]] });
    const { productos, tarimas, errores } = leerMaestro(buf);
    expect(tarimas).toBeNull();
    expect(productos.map((p) => p.sku)).toEqual(["A-1", "B-2"]);
    expect(productos[0]).toMatchObject({ L: 600, oris: [true, true, true, true, true, true], piso: "soloPiso", paletizar: "mixto", compresion: 15 });
    expect(productos[1]).toMatchObject({ L: 0, oris: [true, false, true, false, false, false], piso: "noPiso", paletizar: true, compresion: 40 });
    expect(errores).toEqual(["a-1 está repetido; se usa la primera fila.", "B-2: faltan medidas (largo, ancho o alto)."]);
  });
});

describe("libroMaestro", () => {
  it("lo que escribe se vuelve a leer igual", () => {
    const { productos, tarimas } = maestroReal();
    const conColor = productos.map((p, i) => (i === 0 ? { ...p, color: "#1A2B3C", oris: [true, false, true, false, false, true], compresion: 12 } : p));
    const otra = leerMaestro(libroMaestro(conColor, tarimas));
    expect(otra.errores).toEqual([]);
    expect(otra.productos.map(sinPid)).toEqual(conColor.map(sinPid));
    expect(otra.tarimas).toEqual(tarimas);
  });

  it("guarda en dos hojas (Datos y Parámetros) y ambas traen la fórmula de volumen o los datos correctos", () => {
    const wb = XLSX.read(libroMaestro([productoVacio({ sku: "X", L: 600, W: 400, H: 400, categoria: "Vasos" })], []), { type: "array" });
    expect(wb.SheetNames).toEqual(["Datos", "Parámetros", "Bundles", "Pallets", "Instrucciones"]);
    expect(wb.Sheets.Datos.H2).toMatchObject({ f: "ROUND(D2*E2*F2/1000000000,4)", v: 0.096 });
    expect(XLSX.utils.sheet_to_json(wb.Sheets["Parámetros"])[0]).toMatchObject({ SKU: "X", Categoría: "Vasos" });
  });

  it("un maestro viejo de una sola hoja (Productos) se sigue leyendo igual", () => {
    const buf = libro({ Productos: [["SKU", "Descripción", "Largo", "Ancho", "Alto", "Peso", "Categoría", "Paletizar"], ["A-1", "Cosa", 600, 400, 300, 8, "Vasos", "sí"]] });
    const { productos, errores } = leerMaestro(buf);
    expect(errores).toEqual([]);
    expect(productos[0]).toMatchObject({ sku: "A-1", desc: "Cosa", L: 600, categoria: "Vasos", paletizar: true });
  });
});

describe("orientaciones", () => {
  it("texto ↔ arreglo en ambos sentidos", () => {
    for (const t of ["Todas", "De pie y acostada", "Solo de pie", "De pie sin girar", "135"]) expect(orisTxt(leerOris(t))).toBe(t);
    expect(leerOris("")).toEqual([true, true, false, false, false, false]);
  });
});

describe("leerCubeMaster", () => {
  it("convierte cm a mm, bits de orientación, color BGR y paletizado", () => {
    const cols = ["Name", "Description", "Length", "Width", "Height", "Weight", "PieceInside", "Orientations", "Palletized", "PalletName", "PalletLength", "PalletWidth", "PalletThickness", "PalletWeight", "PalletMaxHeight", "PalletMaxWeight", "OverhangAllowed", "RemainQtyToMixPallet", "PalletMaxStacksOnVehicle", "Color", "Qty", "Seq", "Group", "MaxLayer1"];
    const fila = ["PLY", "Playera", 60, 40, 30, 8, 24, 3, 1, "Americano", 121.9, 101.6, 15, 25, 180, 1200, 0, 1, 2, 255, 130, 1, "Norte", 4];
    const { productos, tarimas, lineas } = leerCubeMaster(libro({ Cargoes: [cols, fila, [...fila.slice(0, 20), 0, 0, ""]] }));
    expect(productos).toHaveLength(1);
    expect(productos[0]).toMatchObject({ sku: "PLY", desc: "Playera", L: 600, W: 400, H: 300, peso: 8, piezas: 24, oris: [true, true, false, false, false, false], paletizar: true, tarima: "Americano", resto: "mixto", aceptaPallet: true, color: "#FF0000", maxNiveles: 4 });
    expect(tarimas).toEqual([{ nombre: "Americano", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }]);
    expect(lineas).toEqual([{ sku: "PLY", qty: 130, orden: 1, grupo: "Norte" }]);
  });
});

describe("dimensiones separadas de los parámetros", () => {
  it("plantillaDimensiones solo trae identidad y medidas, sin ninguna regla", () => {
    const p = productoVacio({ sku: "X", idProducto: "999", desc: "Cosa", L: 600, W: 400, H: 300, peso: 8, categoria: "Vasos", paletizar: true });
    const wb = XLSX.read(plantillaDimensiones([p]), { type: "array" });
    expect(wb.SheetNames).toEqual(["Datos", "Instrucciones"]);
    const fila = XLSX.utils.sheet_to_json(wb.Sheets.Datos)[0];
    expect(Object.keys(fila).sort()).toEqual(["Alto (mm)", "Ancho (mm)", "Descripción", "ID producto", "Largo (mm)", "Peso (kg)", "SKU", "Volumen (m³)"].sort());
  });

  it("actualiza medidas de un producto existente sin tocar sus parámetros", () => {
    const actuales = [productoVacio({ sku: "A-1", idProducto: "100", desc: "Vieja", L: 500, W: 300, H: 200, peso: 5, categoria: "Vasos", paletizar: true, porPallet: 20 })];
    const buf = libro({ Datos: [["SKU", "ID producto", "Descripción", "Largo", "Ancho", "Alto", "Peso"], ["A-1", "100", "Nueva descripción", 600, 400, 300, 8]] });
    const r = actualizarDimensiones(actuales, buf);
    expect(r.errores).toEqual([]);
    expect(r.actualizados).toBe(1);
    expect(r.creados).toBe(0);
    expect(r.productos[0]).toMatchObject({ sku: "A-1", desc: "Nueva descripción", L: 600, W: 400, H: 300, peso: 8, categoria: "Vasos", paletizar: true, porPallet: 20 });
  });

  it("empata por ID producto cuando el SKU cambió", () => {
    const actuales = [productoVacio({ sku: "VIEJO", idProducto: "777", L: 500, W: 300, H: 200, peso: 5, categoria: "Platos" })];
    const buf = libro({ Datos: [["SKU", "ID producto", "Largo", "Ancho", "Alto", "Peso"], ["NUEVO", "777", 600, 400, 300, 8]] });
    const r = actualizarDimensiones(actuales, buf);
    expect(r.actualizados).toBe(1);
    expect(r.productos[0]).toMatchObject({ sku: "NUEVO", categoria: "Platos" });
  });

  it("crea un producto nuevo con parámetros por omisión cuando el SKU no existía", () => {
    const r = actualizarDimensiones([], libro({ Datos: [["SKU", "Largo", "Ancho", "Alto", "Peso"], ["B-2", 600, 400, 300, 8]] }));
    expect(r.creados).toBe(1);
    expect(r.actualizados).toBe(0);
    expect(r.productos[0]).toMatchObject({ sku: "B-2", L: 600, categoria: "", paletizar: false });
  });

  it("avisa y no actualiza cuando faltan medidas", () => {
    const r = actualizarDimensiones([], libro({ Datos: [["SKU", "Largo", "Ancho", "Alto"], ["B-2", 600, 400, 0]] }));
    expect(r.creados).toBe(0);
    expect(r.errores).toEqual(["B-2: faltan medidas (largo, ancho o alto); no se actualizó."]);
  });
});

describe("hoja Bundles del maestro", () => {
  it("se guarda solo con los SKUs que tienen Bundle y se vuelve a leer igual", () => {
    const productos = [productoVacio({ sku: "DU-1", bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000, bundlePeso: 130 }), productoVacio({ sku: "SIN-BDL" })];
    const buf = libroMaestro(productos, []);
    const wb = XLSX.read(buf, { type: "array" });
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Bundles, { header: 1 })).toEqual([["SKU", "Cajas por Bundle", "Largo Bundle (mm)", "Ancho Bundle (mm)", "Alto Bundle (mm)", "Peso Bundle (kg)"], ["DU-1", 24, 900, 600, 1000, 130]]);
    expect(XLSX.utils.sheet_to_json(wb.Sheets["Parámetros"], { header: 1 })[0].some((h) => /bundle/i.test(h))).toBe(false);
    const r = leerMaestro(buf);
    expect(r.productos[0]).toMatchObject({ bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000, bundlePeso: 130 });
    expect(r.productos[1]).toMatchObject({ bundleCantidadEstandar: 0 });
  });
  it("un maestro viejo con las columnas de Bundle en Parámetros se sigue leyendo (solo si decía Bundle activo)", () => {
    const buf = libro({ Datos: [["SKU", "Largo (mm)", "Ancho (mm)", "Alto (mm)", "Peso (kg)"], ["A", 300, 300, 250, 5], ["B", 300, 300, 250, 5]],
      "Parámetros": [["SKU", "Bundle activo", "% máximo Bundle", "Cantidad estándar por Bundle", "Largo Bundle (mm)", "Ancho Bundle (mm)", "Alto Bundle (mm)"], ["A", "Sí", 70, 24, 900, 600, 1000], ["B", "No", 70, 24, 900, 600, 1000]] });
    const r = leerMaestro(buf);
    expect(r.productos[0]).toMatchObject({ bundleCantidadEstandar: 24, bundleL: 900 });
    expect(r.productos[1]).toMatchObject({ bundleCantidadEstandar: 0 });
  });
});

describe("leerBundleMaestro", () => {
  const conDU = () => [productoVacio({ sku: "DU2014501", L: 265, W: 213, H: 28, peso: 0.5 }), productoVacio({ sku: "OTRO-SKU", L: 300, W: 200, H: 150, peso: 3 })];

  it("enciende y configura el Bundle de los SKUs que ya existen, usando CS / BDL", () => {
    const buf = libro({ "CS-BDL": [["ID Artículo", "Descr", "UM", "Rel", "Factor", "CS / BDL", "Alto (mm)", "Largo (mm)", "Ancho (mm)"],
      ["DU2014501", "Charola escolar", "BDL", 10, 0.5, 20, 2762.25, 1085.85, 882.65]] });
    const r = leerBundleMaestro(conDU(), buf);
    expect(r.errores).toEqual([]);
    expect(r.actualizados).toBe(1);
    const p = r.productos.find((x) => x.sku === "DU2014501");
    expect(p).toMatchObject({ bundleCantidadEstandar: 20, bundleL: 1085.85, bundleW: 882.65, bundleH: 2762.25 });
    // No toca el SKU que no viene en el archivo
    expect(r.productos.find((x) => x.sku === "OTRO-SKU")).toMatchObject({ bundleCantidadEstandar: 0 });
  });

  it("no modifica los productos que recibe (son estado de React)", () => {
    const buf = libro({ "CS-BDL": [["ID Artículo", "CS / BDL", "Alto (mm)", "Largo (mm)", "Ancho (mm)"], ["DU2014501", 20, 100, 200, 300]] });
    const antes = conDU(), copia = JSON.parse(JSON.stringify(antes));
    const r = leerBundleMaestro(antes, buf);
    expect(r.actualizados).toBe(1);
    expect(JSON.parse(JSON.stringify(antes))).toEqual(copia);
  });

  it("calcula la cantidad estándar como Rel ÷ Factor cuando no viene la columna CS / BDL", () => {
    const buf = libro({ "CS-BDL": [["ID Artículo", "UM", "Rel", "Factor", "Alto (mm)", "Largo (mm)", "Ancho (mm)"], ["DU2014501", "BDL", 10, 0.5, 100, 200, 300]] });
    const r = leerBundleMaestro(conDU(), buf);
    expect(r.productos.find((x) => x.sku === "DU2014501").bundleCantidadEstandar).toBe(20);
  });

  it("reporta los SKUs del archivo que no están en el maestro, sin darlos de alta", () => {
    const buf = libro({ "CS-BDL": [["ID Artículo", "UM", "Rel", "Factor", "CS / BDL", "Alto (mm)", "Largo (mm)", "Ancho (mm)"], ["NO-EXISTE", "BDL", 10, 0.5, 20, 100, 200, 300]] });
    const r = leerBundleMaestro(conDU(), buf);
    expect(r.actualizados).toBe(0);
    expect(r.productos).toHaveLength(2);
    expect(r.errores.join(" ")).toMatch(/NO-EXISTE/);
  });

  it("lee de verdad el Excel de referencia CS-BDL 1.xlsx", () => {
    const buf = bytes("datos/CS-BDL_referencia.xlsx");
    const actuales = [productoVacio({ sku: "DU2014501", L: 265, W: 213, H: 28, peso: 0.5 })];
    const r = leerBundleMaestro(actuales, buf);
    expect(r.actualizados).toBe(1);
    expect(r.productos[0]).toMatchObject({ bundleCantidadEstandar: 20, bundleL: 1085.85, bundleW: 882.65, bundleH: 2762.25 });
  });
});

describe("plantilla de Bundles", () => {
  it("se descarga con los SKUs que tienen Bundle y se vuelve a subir con Importar → Bundle", async () => {
    const { plantillaBundles } = await import("./maestro.js");
    const con = [productoVacio({ sku: "DU-1", desc: "Charola", bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000, bundlePeso: 130 })];
    const buf = plantillaBundles(con);
    const r = leerBundleMaestro([productoVacio({ sku: "DU-1" }), productoVacio({ sku: "OTRO" })], buf);
    expect(r.errores).toEqual([]);
    expect(r.actualizados).toBe(1);
    expect(r.productos[0]).toMatchObject({ bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000, bundlePeso: 130 });
  });
  it("sin SKUs con Bundle trae dos filas de ejemplo", async () => {
    const { plantillaBundles } = await import("./maestro.js");
    const wb = XLSX.read(plantillaBundles([]), { type: "array" });
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Bundles, { header: 1 })).toHaveLength(3);
  });
});

describe("SKU con sufijo de variante (-R####)", () => {
  it("la hoja Bundles del maestro aplica al SKU base cuando la variante no tiene fila propia", () => {
    const buf = libro({ Datos: [["SKU", "Largo (mm)", "Ancho (mm)", "Alto (mm)", "Peso (kg)"], ["DU4051199V", 300, 300, 250, 5], ["DU4051199V-R006940", 300, 300, 250, 5], ["DU9-R001", 300, 300, 250, 5]],
      Bundles: [["SKU", "Cajas por Bundle", "Largo Bundle (mm)", "Ancho Bundle (mm)", "Alto Bundle (mm)"], ["DU4051199V", 24, 900, 600, 1000], ["DU9-R001", 12, 500, 500, 800]] });
    const r = leerMaestro(buf);
    const por = (sku) => r.productos.find((p) => p.sku === sku);
    expect(por("DU4051199V-R006940")).toMatchObject({ bundleCantidadEstandar: 24, bundleL: 900 });
    expect(por("DU9-R001")).toMatchObject({ bundleCantidadEstandar: 12 });   // su propia fila manda
  });
  it("al importar el CS-BDL, la variante toma el Bundle del SKU base y se reporta", () => {
    const actuales = [productoVacio({ sku: "DU4051199V" }), productoVacio({ sku: "DU4051199V-R006940" }), productoVacio({ sku: "OTRO" })];
    const buf = libro({ "CS-BDL": [["ID Artículo", "CS / BDL", "Alto (mm)", "Largo (mm)", "Ancho (mm)"], ["DU4051199V", 24, 2609.85, 990.6, 869.7]] });
    const r = leerBundleMaestro(actuales, buf);
    expect(r.actualizados).toBe(2);
    expect(r.productos.find((p) => p.sku === "DU4051199V-R006940")).toMatchObject({ bundleCantidadEstandar: 24 });
    expect(r.productos.find((p) => p.sku === "OTRO")).toMatchObject({ bundleCantidadEstandar: 0 });
    expect(r.errores.join(" ")).toMatch(/sufijo de variante/);
  });
});
