import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { fijarIdioma, traducir, tr, traducirFilas } from "./index.js";

describe("traducción al inglés", () => {
  beforeEach(() => fijarIdioma("en"));
  afterAll(() => fijarIdioma("es"));

  it("frases exactas, conservando los espacios de las orillas", () => {
    expect(traducir("Calcular carga")).toBe("Calculate load");
    expect(traducir("  Paletizado ")).toBe("  Palletizing ");
  });
  it("frases con datos por patrón", () => {
    expect(traducir("Vehículo 3")).toBe("Vehicle 3");
    expect(traducir("Maestro cargado: 11 productos, 3 pallets y conversiones de 4 SKUs.")).toBe("Master loaded: 11 products, 3 pallets and conversions for 4 SKUs.");
  });
  it("no traduce a medias una frase que no está en el diccionario", () => {
    expect(traducir("Todas las cajas")).toBe("Todas las cajas");
    expect(traducir("Scrap de película tratada")).toBe("Scrap de película tratada");
  });
  it("mensajes de error: prefijo conocido + detalle", () => {
    expect(traducir("No se pudo leer el maestro: No hay sesión activa.")).toBe("Couldn't read the master: No active session.");
  });
  it("pasos de carga armados por el motor", () => {
    expect(traducir("Coloca 10 cajas de VASO (Vaso rojo), de pie, a 0.00–2.03 m del fondo, 0.00–2.44 m del lado derecho (visto desde las puertas), sobre el piso."))
      .toBe("Place 10 boxes of VASO (Vaso rojo), upright, 0.00–2.03 m from the front, 0.00–2.44 m from the right side (seen from the doors), on the floor.");
  });
  it("tr con variables y celdas de Excel", () => {
    expect(tr("Carga sin título")).toBe("Untitled load");
    expect(traducirFilas([["Vehículo", 3, "ABC-1"]])).toEqual([["Vehicle", 3, "ABC-1"]]);
  });
  it("en español no cambia nada", () => {
    fijarIdioma("es");
    expect(traducir("Calcular carga")).toBe("Calcular carga");
    expect(tr("Hay {n} avisos", { n: 2 })).toBe("Hay 2 avisos");
  });
});
