import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { leerVehiculos, libroVehiculos, plantillaVehiculos, vehiculoVacio, COLS_VEHICULOS } from "./vehiculos.js";

const libro = (filas) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Vehículos"); return XLSX.write(wb, { type: "array", bookType: "xlsx" }); };

describe("leerVehiculos", () => {
  it("lee medidas, peso y la geometría de ejes", () => {
    const buf = libro([COLS_VEHICULOS, ["Tráiler 53'", "AB-1234", "Transportes del Norte", 16000, 2500, 2700, 6500, 36500, 5443, 22662, 14900, -1400, 6200, 300]]);
    const { vehiculos, errores } = leerVehiculos(buf);
    expect(errores).toEqual([]);
    expect(vehiculos).toHaveLength(1);
    expect(vehiculos[0]).toMatchObject({
      nombre: "Tráiler 53'", placa: "AB-1234", transportadora: "Transportes del Norte", L: 16000, W: 2500, H: 2700, tara: 6500, maxKg: 36500,
      ejeDelantero: 5443, ejeTrasero: 22662, xEjeDelantero: -1400, xEjeTrasero: 13500, taraDelantera: 6200, taraTrasera: 300,
    });
  });

  it("permite dejar los ejes en 0 (no se calculan)", () => {
    const { vehiculos } = leerVehiculos(libro([["Nombre", "Largo interior (mm)", "Ancho interior (mm)", "Alto interior (mm)"], ["Rabón", 5500, 2400, 2300]]));
    expect(vehiculos[0]).toMatchObject({ L: 5500, ejeDelantero: 0, ejeTrasero: 0 });
  });

  it("distingue vehículos con el mismo nombre por la placa, y avisa si de verdad se repiten", () => {
    const buf = libro([["Nombre", "Placa", "Largo interior (mm)", "Ancho interior (mm)", "Alto interior (mm)"],
      ["Torton", "AAA-111", 7300, 2450, 2450], ["Torton", "BBB-222", 7300, 2450, 2450], ["Torton", "AAA-111", 7300, 2450, 2450]]);
    const { vehiculos, errores } = leerVehiculos(buf);
    expect(vehiculos.map((v) => v.placa)).toEqual(["AAA-111", "BBB-222"]);
    expect(errores).toEqual(["Torton (AAA-111) está repetido; se usa la primera fila."]);
  });

  it("avisa si faltan medidas", () => {
    const { errores } = leerVehiculos(libro([["Nombre", "Largo interior (mm)"], ["Camión", 5000]]));
    expect(errores).toEqual(["Camión: faltan medidas interiores (largo, ancho o alto)."]);
  });
});

describe("libroVehiculos", () => {
  it("lo que escribe se vuelve a leer igual", () => {
    const original = [vehiculoVacio({ nombre: "Tráiler 53'", placa: "AB-1234", L: 16000, W: 2500, H: 2700, tara: 6500, maxKg: 36500, ejeDelantero: 5443, ejeTrasero: 22662, xEjeDelantero: -1400, xEjeTrasero: 13500, taraDelantera: 6200, taraTrasera: 300 })];
    const { vehiculos } = leerVehiculos(libroVehiculos(original));
    const sinId = ({ id, propio, ...v }) => v;
    expect(vehiculos.map(sinId)).toEqual(original.map(sinId));
  });

  it("incluye la hoja de instrucciones", () => {
    const wb = XLSX.read(libroVehiculos([vehiculoVacio({ nombre: "X", L: 1, W: 1, H: 1 })]), { type: "array" });
    expect(wb.SheetNames).toEqual(["Vehículos", "Instrucciones"]);
  });
});

describe("plantillaVehiculos", () => {
  it("trae los vehículos por omisión de la herramienta", () => {
    const { vehiculos, errores } = leerVehiculos(plantillaVehiculos());
    expect(errores).toEqual([]);
    expect(vehiculos.length).toBeGreaterThanOrEqual(6);
    expect(vehiculos.map((v) => v.nombre)).toContain("Tráiler caja seca 53'");
  });
});
