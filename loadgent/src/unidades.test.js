import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { unidadesDe, factorColumna, encabezadoEn, unidadDeEncabezado, SISTEMAS } from "./unidades.js";
import { libroMaestro, leerMaestro, productoVacio, plantillaDimensiones, actualizarDimensiones } from "./archivos/maestro.js";
import { libroVehiculos, leerVehiculos } from "./archivos/vehiculos.js";

const cerca = (a, b, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const AM = SISTEMAS.americano;

describe("unidadesDe", () => {
  it("convierte ida y vuelta sin perder precisión", () => {
    const u = unidadesDe("americano");
    expect(u.L(25.4)).toBe(1);
    expect(u.P(0.45359237)).toBe(1);
    cerca(u.aMm(u.L(600)), 600, 0.02);
    expect(u.fV3(1)).toBe("35.31 ft³");
    expect(u.fD(304.8)).toBe("1 ft");
  });
  it("en métrico no cambia nada", () => {
    const u = unidadesDe("metrico");
    expect(u.L(600)).toBe(600);
    expect(u.fP(14)).toBe("14 kg");
    expect(u.fLLL(600, 400, 400)).toBe("600 × 400 × 400 mm");
  });
});

describe("unidades de archivo", () => {
  it("lee la unidad del encabezado, o usa la que eligió el usuario", () => {
    expect(unidadDeEncabezado("Largo (in)")).toBe("in");
    expect(unidadDeEncabezado("Sobresale a lo largo (mm por lado)")).toBe("mm");
    expect(factorColumna("Largo (in)", "largo")).toBe(25.4);
    expect(factorColumna("Largo (cm)", "largo")).toBe(10);
    expect(factorColumna("Peso (lb)", "peso")).toBeCloseTo(0.45359237);
    expect(factorColumna("Largo", "largo")).toBe(1);                  // sin unidad: mm
    expect(factorColumna("Largo (mm)", "largo", "in-lb")).toBe(25.4);  // la elección del usuario manda
  });
  it("escribe los encabezados en la unidad del usuario", () => {
    expect(encabezadoEn("Largo (mm)", AM)).toBe("Largo (in)");
    expect(encabezadoEn("Peso máx. encima (kg)", AM)).toBe("Peso máx. encima (lb)");
    expect(encabezadoEn("Desde las puertas (m)", AM)).toBe("Desde las puertas (ft)");
    expect(encabezadoEn("Largo (mm)", SISTEMAS.metrico)).toBe("Largo (mm)");
  });
});

describe("maestro en pulgadas y libras", () => {
  const p = productoVacio({ sku: "DU-1", desc: "Caja", L: 600, W: 400, H: 350, peso: 14, pesoMaxEncima: 60, bundleCantidadEstandar: 20, bundleL: 1085.85, bundleW: 882.65, bundleH: 2762.25, bundlePeso: 220 });
  const tarimas = [{ nombre: "T", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }];
  it("se descarga en pulgadas y se vuelve a leer en mm sin elegir nada", () => {
    const buf = libroMaestro([p], tarimas, null, AM);
    const wb = XLSX.read(buf, { type: "array" });
    const cab = XLSX.utils.sheet_to_json(wb.Sheets.Datos, { header: 1 })[0];
    expect(cab).toContain("Largo (in)");
    expect(cab).toContain("Peso (lb)");
    const r = leerMaestro(buf);
    expect(r.unidades).toBe("pulgadas y libras");
    const q = r.productos[0];
    cerca(q.L, 600, 0.03); cerca(q.W, 400, 0.03); cerca(q.H, 350, 0.03); cerca(q.peso, 14, 0.001);
    cerca(q.pesoMaxEncima, 60, 0.001); cerca(q.bundleL, 1085.85, 0.03); cerca(q.bundlePeso, 220, 0.001);
    cerca(r.tarimas[0].L, 1219, 0.03); cerca(r.tarimas[0].maxKg, 1200, 0.01);
  });
  it("un archivo sin unidades en el encabezado se lee con la unidad elegida al subirlo", () => {
    const ws = XLSX.utils.aoa_to_sheet([["SKU", "Descripción", "Largo", "Ancho", "Alto", "Peso"], ["X-1", "d", 24, 16, 12, 30]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Datos");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    cerca(leerMaestro(buf).productos[0].L, 24);                  // sin elegir: se asume mm
    const r = leerMaestro(buf, "in-lb");
    cerca(r.productos[0].L, 609.6); cerca(r.productos[0].peso, 13.6078, 0.001);
  });
  it("la plantilla de dimensiones también va y viene en pulgadas", () => {
    const buf = plantillaDimensiones([p], AM);
    const r = actualizarDimensiones([{ ...p, L: 1, W: 1, H: 1 }], buf);
    cerca(r.productos[0].L, 600, 0.03);
    expect(r.unidades).toBe("pulgadas y libras");
  });
});

describe("catálogo de vehículos en pulgadas y libras", () => {
  it("se descarga en pulgadas/libras y se vuelve a leer en mm/kg", () => {
    const v = { id: "53DV", nombre: "53FT-DryVan", placa: "", transportadora: "", L: 16154, W: 2489, H: 2794, tara: 6800, maxKg: 27200, ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: -1400, xEjeTrasero: 13500, taraDelantera: 0, taraTrasera: 0 };
    const r = leerVehiculos(libroVehiculos([v], AM));
    const w = r.vehiculos[0];
    cerca(w.L, 16154, 1); cerca(w.H, 2794, 1); cerca(w.maxKg, 27200, 1); cerca(w.xEjeDelantero, -1400, 1); cerca(w.xEjeTrasero, 13500, 1);
  });
});
