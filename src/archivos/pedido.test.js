import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { leerPedido, libroPlantilla } from "./pedido.js";
import { leerMaestro } from "./maestro.js";

const bytes = (ruta) => new Uint8Array(readFileSync(ruta));
const VEHICULOS = [{ nombre: "V0" }, { nombre: "V1" }, { nombre: "V2" }, { nombre: "Tráiler caja seca 53'" }];

describe("leerPedido", () => {
  it("lee la plantilla de ejemplo: líneas con orden, pedido y destino por separado", () => {
    const { lineas, datos } = leerPedido(bytes("datos/plantilla_carga.xlsx"));
    expect(lineas).toHaveLength(6);
    expect(lineas[0]).toMatchObject({ sku: "JNS-010", qty: 60, orden: 1, grupo: "PED-4471", destino: "Tienda Norte", um: "", pal: undefined, porPallet: undefined });
    expect(lineas.filter((l) => l.um).map((l) => [l.sku, l.qty, l.um])).toEqual([["PLY-001", 5, "ML"], ["ACC-330", 2, "ML"], ["BLS-015", 4, "ML"]]);
    expect(datos).toEqual({ nombre: "Reparto semana 37", vehiculo: "Tráiler caja seca 53'" });
  });

  it("toma paletizado y cajas por pallet solo si vienen capturados, e ignora líneas sin cantidad", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["SKU", "Cantidad", "Paletizar", "Cajas por pallet", "Destino"], ["A", 5, "Mixto", 12, "Sur"], ["B", 0, "", "", ""], ["C", "7,0", "", "", ""]]), "Pedido");
    const { lineas, datos } = leerPedido(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(lineas.map((l) => [l.sku, l.qty, l.grupo, l.destino, l.pal, l.porPallet])).toEqual([["A", 5, "", "Sur", "mixto", 12], ["C", 7, "", "", undefined, undefined]]);
    expect(datos).toEqual({});
  });

  it("acepta los nombres nuevos de columna: Entrega (parada), Pedido y Destino, cada una separada", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["SKU", "Cantidad (cajas)", "Entrega (parada)", "Pedido", "Destino"], ["A", 5, 2, "PED-9", "CDMX"], ["B", 3, "", "", ""]]), "Carga");
    const { lineas } = leerPedido(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(lineas.map((l) => [l.sku, l.qty, l.orden, l.grupo, l.destino])).toEqual([["A", 5, 2, "PED-9", "CDMX"], ["B", 3, 0, "", ""]]);
  });

  it("una plantilla vieja con la columna combinada Pedido / destino la toma como pedido (el destino queda vacío)", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["SKU", "Cantidad (cajas)", "Pedido / destino"], ["A", 5, "PED-4471 Tienda Norte"]]), "Carga");
    const { lineas } = leerPedido(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(lineas[0]).toMatchObject({ grupo: "PED-4471 Tienda Norte", destino: "" });
  });

  it("conserva las cantidades con decimales y no pierde las menores a una unidad", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["SKU", "Cantidad", "UM"], ["A", 0.4, "ML"], ["B", 2.5, "ML"], ["C", 0, "ML"]]), "Carga");
    const { lineas } = leerPedido(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(lineas.map((l) => [l.sku, l.qty])).toEqual([["A", 0.4], ["B", 2.5]]);
  });

  it("lee la unidad de medida cuando el pedido no viene en cajas", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["SKU", "Cantidad", "UM (opcional)"], ["A", 5, "ml"], ["B", 3, ""]]), "Carga");
    const { lineas } = leerPedido(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(lineas.map((l) => [l.sku, l.qty, l.um])).toEqual([["A", 5, "ML"], ["B", 3, ""]]);
  });

  it("reconoce una plantilla de CubeMaster por su hoja Cargoes", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name", "Length", "Width", "Height", "Qty"], ["Z", 50, 40, 30, 9]]), "Cargoes");
    const r = leerPedido(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    expect(r.cubemaster.productos[0]).toMatchObject({ sku: "Z", L: 500 });
    expect(r.cubemaster.lineas).toEqual([{ sku: "Z", qty: 9, orden: 0, grupo: "" }]);
  });
});

describe("libroPlantilla", () => {
  it("la plantilla que escribe se lee como pedido con los SKUs de ejemplo", () => {
    const { productos } = leerMaestro(bytes("datos/maestro_productos.xlsx"));
    const buf = libroPlantilla(productos, VEHICULOS);
    const wb = XLSX.read(buf, { type: "array" });
    expect(wb.SheetNames).toEqual(["Carga", "Medidas", "Datos de la carga"]);
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Carga, { header: 1 })[0]).toEqual(["SKU", "Cantidad", "UM (opcional)", "Entrega (parada)", "Pedido", "Destino", "Paletizar (opcional)", "Cajas por pallet (opcional)", "Descripción (referencia)", "Volumen de la línea (m³)"]);
    expect(wb.Sheets.Carga.J2.f).toContain("Medidas!$B$2:$B$500");
    expect(XLSX.utils.sheet_to_json(wb.Sheets.Medidas, { header: 1 })[1]).toEqual([productos[0].sku, productos[0].L, productos[0].W, productos[0].H, productos[0].desc]);
    expect(wb.Sheets["Datos de la carga"].B3.f).toBe("SUM(Carga!B2:B500)");
    const { lineas, datos } = leerPedido(buf);
    expect(lineas.map((l) => [l.sku, l.qty, l.orden, l.grupo, l.destino])).toEqual([[productos[0].sku, 10, 1, "PED-0001", "Tienda Norte"], [productos[1].sku, 20, 2, "PED-0002", "Tienda Norte"], [productos[2].sku, 30, 0, "", ""]]);
    expect(datos).toEqual({ nombre: "Carga ejemplo", vehiculo: "Tráiler caja seca 53'" });
  });

  it("sin maestro pone una fila de ejemplo y la hoja Medidas queda vacía", () => {
    const wb = XLSX.read(libroPlantilla([], VEHICULOS), { type: "array" });
    expect(wb.SheetNames).toEqual(["Carga", "Medidas", "Datos de la carga"]);
    expect(leerPedido(libroPlantilla([], VEHICULOS)).lineas).toEqual([expect.objectContaining({ sku: "SKU-001", qty: 20, orden: 1, grupo: "PED-0001", destino: "Tienda 1" })]);
  });
});
